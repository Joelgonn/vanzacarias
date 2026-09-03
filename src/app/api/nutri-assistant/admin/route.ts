import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

import { requireAdmin } from '@/lib/supabase/serverAuth'
import { buildContext } from '@/lib/contextBuilder'
import { detectSabotagePattern, buildIntervention } from '@/lib/behaviorEngine'
import { findAdminPatient } from '@/lib/adminMatching'

// IMPORTS CENTRALIZADOS
import { processBeliscos, fetchHistoricoBeliscos } from '@/lib/beliscosProcessor'
import { calcularMacrosDoCardapio } from '@/lib/macroCalculator'
import { formatMealPlan } from '@/lib/mealPlanFormatter'
import { normalizeRestrictions } from '@/lib/normalizeRestrictions'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🛡️ SCHEMAS DE VALIDAÇÃO
// ==========================================

// 🔒 S1: NENHUM dado de paciente/lead é aceito do cliente.
// O contexto do painel é montado 100% no servidor (Supabase) para impedir o
// transporte desnecessário de PII pelo navegador. O cliente apenas envia a
// mensagem/histórico/imagem. O payload é STRICT (U2) — sem passthrough/z.any().
const AdminRequestSchema = z.object({
  message: z.string().optional(),
  image: z.string().nullable().optional(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(2000)
    })
  ).max(12).optional().default([])
}).strict();

interface OverviewPatient {
  id: string;
  full_name?: string | null;
  meal_plan?: unknown;
  meta_peso?: number | string | null;
  is_late?: boolean | null;
  water_ml?: number | null;
  mood?: string | null;
  activity_kcal?: number | null;
  messages_today?: number | null;
  beliscos?: unknown;
}

interface OverviewLead {
  nome?: string | null;
  whatsapp?: string | null;
  status?: string | null;
}

interface AdminOverview {
  patients: OverviewPatient[];
  leads: OverviewLead[];
  patientsResumo: string;
  leadsResumo: string;
  activePatientsCount: number;
  todayTotalMessages: number;
  hasLeads: boolean;
}

let overviewCache: { data: AdminOverview | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
const OVERVIEW_TTL_MS = 30_000;

// 🔒 S1: consulta o painel no servidor (service role, nunca exposto ao client).
// Apenas um resumo textual é enviado ao modelo — PII pesada (telefone, data de
// nascimento, avaliações completas, medidas) fica de fora. As listas de
// pacientes/leads são filtradas para os campos mínimos necessários e ficam
// somente no servidor (usadas para achar o paciente mencionado na mensagem).
async function fetchAdminOverview(client: typeof supabaseAdmin): Promise<AdminOverview> {
  if (overviewCache.data && Date.now() - overviewCache.fetchedAt < OVERVIEW_TTL_MS) {
    return overviewCache.data;
  }

  const [patientsRes, leadsRes] = await Promise.all([
    client.from('admin_dashboard').select('id, full_name, meal_plan, meta_peso, is_late, water_ml, mood, activity_kcal, messages_today').limit(500),
    client.from('leads_avaliacao').select('nome, whatsapp, status').neq('status', 'convertido').limit(200)
  ]);

  const patients = (patientsRes.data || []) as OverviewPatient[];
  const leads = (leadsRes.data || []) as OverviewLead[];

  let todayTotalMessages = 0;
  const patientsResumo = patients.map((p) => {
    todayTotalMessages += Number(p.messages_today) || 0;
    const isDietReady = Array.isArray(p.meal_plan) && p.meal_plan.length > 0;
    const aguaHoje = p.water_ml ? `${p.water_ml}ml` : '0ml';
    const humorHoje = p.mood || 'Não registrou';
    const atividade = p.activity_kcal ? `${p.activity_kcal} kcal` : '0 kcal';
    return `- Nome: ${p.full_name || 'Desconhecido'}\n    Dieta: ${isDietReady ? 'Pronta' : 'Pendente'} \n    Atrasado: ${p.is_late ? 'Sim' : 'Não'} \n    Meta: ${p.meta_peso ? `${p.meta_peso}kg` : 'N/A'} \n    Água: ${aguaHoje} \n    Humor: ${humorHoje} \n    Atividade: ${atividade}`;
  }).join('\n') || 'Nenhum paciente cadastrado.';

  const leadsResumo = leads.map((l) => `- Nome: ${l?.nome || 'Desconhecido'} | Whats: ${l?.whatsapp || 'Sem número'} | Status: ${l?.status || 'Sem status'}`).join('\n') || 'Nenhum lead pendente.';

  const overview: AdminOverview = {
    patients,
    leads,
    patientsResumo,
    leadsResumo,
    activePatientsCount: patients.length,
    todayTotalMessages,
    hasLeads: leads.length > 0
  };

  overviewCache = { data: overview, fetchedAt: Date.now() };
  return overview;
}

// ==========================================
// 🛠️ FUNÇÕES AUXILIARES
// ==========================================

function normalizeString(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ==========================================
// 🔥 FUNÇÃO PARA BUSCAR DADOS COMPLETOS DO PACIENTE
// ==========================================
interface PatientRow {
  id?: string;
  full_name?: string | null;
  meta_peso?: number | string | null;
  meal_plan?: unknown;
  food_restrictions?: unknown;
  objetivo?: string;
  [key: string]: unknown;
}

interface DailyLogRow {
  date?: string;
  beliscos?: { items?: unknown[] };
  meals_checked?: unknown[] | number;
  activities?: Array<{ name: string }>;
  mood?: string | null;
  water_ml?: number | null;
  activity_kcal?: number | null;
  [key: string]: unknown;
}

async function getFullPatientData(patientId: string, todayStr: string) {
  const [profileRes, logsRes, qfaRes, evalRes, antroRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', patientId).single(),
    supabaseAdmin.from('daily_logs').select('*').eq('user_id', patientId).order('date', { ascending: false }).limit(3),
    supabaseAdmin.from('qfa_responses').select('answers').eq('user_id', patientId).order('created_at', { ascending: false }).limit(1),
    supabaseAdmin.from('evaluations').select('answers').eq('user_id', patientId).order('created_at', { ascending: false }).limit(1),
    supabaseAdmin.from('anthropometry').select('weight').eq('user_id', patientId).order('measurement_date', { ascending: false }).limit(2)
  ]);

  const patient = profileRes.data;
  const logs = logsRes.data || [];
  const todayLog = logs.find((log) => log.date === todayStr);
  const historicoBeliscos = await fetchHistoricoBeliscos(supabaseAdmin, patientId, todayStr, 4);
  
  let alimentosEvitar: string[] = [];
  if (qfaRes.data?.[0]?.answers) {
    alimentosEvitar = Object.entries(qfaRes.data[0].answers)
      .filter(([, f]) => f === "0")
      .map(([a]) => a.replace(/_/g, ' '));
  }

  const objetivoPrincipal = evalRes.data?.[0]?.answers?.["0"] || patient?.objetivo || 'Não informado';

  let evolucaoTxt = 'Iniciando.';
  if (antroRes.data && antroRes.data.length === 2 && antroRes.data[0]?.weight && antroRes.data[1]?.weight) {
    const diff = (antroRes.data[1].weight - antroRes.data[0].weight).toFixed(1);
    evolucaoTxt = `Variação de ${diff}kg na última medição`;
  }

  return {
    patient,
    todayLog,
    historicoBeliscos,
    alimentosEvitar,
    objetivoPrincipal,
    evolucaoTxt
  };
}

// ==========================================
// 🔥 FUNÇÃO PARA CONSTRUIR UserData DO PACIENTE
// ==========================================
async function buildPatientUserData(
  patient: PatientRow,
  todayLog: DailyLogRow | undefined,
  historicoBeliscos: { data: string; totalKcal: number; itemsCount: number }[],
  alimentosEvitar: string[],
  objetivoPrincipal: string,
  evolucaoTxt: string,
  todayStr: string
) {
  const macros = calcularMacrosDoCardapio(patient?.meal_plan);
  const beliscosProcessed = processBeliscos(todayLog?.beliscos);
  
  // NORMALIZAR RESTRIÇÕES
  const safeRestrictions = normalizeRestrictions(
    Array.isArray(patient?.food_restrictions) ? patient.food_restrictions : []
  );

  const refeicoesFeitas = Array.isArray(todayLog?.meals_checked) 
    ? todayLog.meals_checked.length 
    : (typeof todayLog?.meals_checked === 'number' ? todayLog.meals_checked : 0);

  let atividadesHojeFormatadas = 'Nenhuma';
  if (todayLog?.activities && Array.isArray(todayLog.activities) && todayLog.activities.length > 0) {
    atividadesHojeFormatadas = todayLog.activities.map((a) => `- ${a.name}`).join('\n');
  }

  const behaviorPattern = detectSabotagePattern({
    beliscos: beliscosProcessed,
    macrosDiarios: macros.macrosDiarios || undefined,
    humorHoje: todayLog?.mood ?? undefined,
    historicoBeliscos,
    objetivoPrincipal,
    refeicoesFeitas,
    totalRefeicoesPlano: macros.macrosPorRefeicao?.length || 0,
    aguaHoje: todayLog?.water_ml || 0,
    activityKcal: todayLog?.activity_kcal || 0
  });
  
  const interventionSuggestion = buildIntervention(behaviorPattern, objetivoPrincipal);

  return {
    nomePaciente: patient?.full_name?.split(' ')[0] || 'Paciente',
    objetivoPrincipal,
    metaPeso: patient?.meta_peso ? `${patient.meta_peso}kg` : 'Manutenção',
    rotinaSono: '',
    vontadesDoces: '',
    alimentosEvitar,
    restrictions: safeRestrictions,
    cardapioFormatado: formatMealPlan(patient?.meal_plan),
    evolucaoTxt,
    humorHoje: todayLog?.mood || 'Não registrado',
    aguaHoje: todayLog?.water_ml || 0,
    refeicoesFeitas,
    atividadesHojeFormatadas,
    activityKcal: todayLog?.activity_kcal || 0,
    todayStr,
    hasImage: false,
    macrosDiarios: macros.macrosDiarios || undefined,
    macrosPorRefeicao: macros.macrosPorRefeicao,
    beliscosHoje: {
      totalKcal: beliscosProcessed.totalKcal,
      totalProtein: beliscosProcessed.totalProtein,
      totalCarbs: beliscosProcessed.totalCarbs,
      totalFat: beliscosProcessed.totalFat,
      items: beliscosProcessed.items,
      hasBeliscos: beliscosProcessed.hasBeliscos
    },
    behaviorPattern,
    interventionSuggestion
  };
}

// ==========================================
// 🛠️ CONSTRUTOR DE CONTEXTO ADMIN
// ==========================================

function buildAdminContext(overview: AdminOverview, currentTimeBR: string, deepContext: string, deepContextRaw?: string): string {
  const { patientsResumo, leadsResumo, activePatientsCount, todayTotalMessages } = overview;

  return `
Você é a Assistente de Inteligência Artificial exclusiva da Nutricionista Vanusa.
Você está operando no PAINEL ADMINISTRATIVO. Data e hora (Brasília): ${currentTimeBR}.
Seu objetivo é agir como uma co-piloto CLÍNICA e administrativa. Você TEM ACESSO COMPLETO aos dados dos pacientes, INCLUSIVE cardápios detalhados.

📊 DADOS DE USO:
- Mensagens da IA hoje: ${todayTotalMessages}
- Pacientes ativos no chat: ${activePatientsCount}

👥 VISÃO GERAL DOS PACIENTES:
${patientsResumo}

🎯 OPORTUNIDADES (LEADS):
${leadsResumo}

${deepContext ? `\n🔍 ANÁLISE CLÍNICA PROFUNDA DO PACIENTE PESQUISADO (via motor de IA):\n${deepContext}\n` : ''}

${deepContextRaw ? `\n📋 DADOS BRUTOS DO PACIENTE:\n${deepContextRaw}\n` : ''}

🔥 REGRAS DE OURO:
1. Aja como suporte direto da nutricionista e use TODOS os dados providenciados.
2. A "ANÁLISE CLÍNICA PROFUNDA" já contém interpretação comportamental, score de disciplina, risco e intervenção sugerida.
3. Você DEVE utilizar essas informações para dar respostas clínicas de alto nível.
4. Seja direta, profissional e proativa ao ajudar a Nutri.
5. Destaque para a nutricionista: padrões de comportamento, recorrência de beliscos, score de disciplina e riscos identificados.
`.trim();
}

// ==========================================
// 🌐 MAIN POST FUNCTION - ADMIN
// ==========================================

export async function POST(req: NextRequest) {
  try {
    // 🔒 AUTENTICAÇÃO + AUTORIZAÇÃO NO SERVIDOR:
    // Valida a sessão via cookie e confirma que o usuário autenticado
    // tem role admin/nutricionista na tabela profiles (não confia no body).
    const auth = await requireAdmin(req);
    if (auth.error) {
      return auth.error;
    }

    const rawBody = await req.json();
    
    const parsedData = AdminRequestSchema.safeParse(rawBody);
    
    if (!parsedData.success) {
      console.error("❌ Payload Admin inválido:", parsedData.error.format());
      return NextResponse.json({ reply: "Dados de requisição inválidos." }, { status: 400 });
    }

    const { message, history, image } = parsedData.data;
    const safeMessage = message?.trim() || '';

    if (!safeMessage && !image) {
      return NextResponse.json({ reply: "Digite uma mensagem ou envie uma foto." }, { status: 200 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ reply: "Erro de configuração." }, { status: 500 });

    const genAI = new GoogleGenerativeAI(geminiKey);
    const dataAtual = new Date();
    const currentTimeBR = dataAtual.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });
    const todayStr = dataAtual.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    let deepContext = '';
    let deepContextRaw = '';
    const normalizedMsg = normalizeString(safeMessage);

    // 🔒 S1: contexto do painel montado AQUI no servidor (não aceito do cliente).
    const overview = await fetchAdminOverview(supabaseAdmin);

    const patientsList: OverviewPatient[] = overview.patients;

    const { patient: mentionedPatient, ambiguous, candidates } = findAdminPatient(patientsList, normalizedMsg);

    if (ambiguous) {
      const names = candidates.map(c => c.full_name || 'Desconhecido').join(', ');
      return NextResponse.json({
        reply: `Encontrei múltiplos pacientes correspondendo a "${safeMessage.trim()}": ${names}. Por favor, informe o nome completo (ex: "Ana Silva") para que eu possa trazer os dados corretos.`,
        ambiguous: true,
        candidates: candidates.map(c => ({ id: c.id, full_name: c.full_name })),
      }, { status: 200 });
    }

    if (mentionedPatient && mentionedPatient.id) {
      const fullData = await getFullPatientData(mentionedPatient.id, todayStr);
      
      const userData = await buildPatientUserData(
        fullData.patient,
        fullData.todayLog,
        fullData.historicoBeliscos,
        fullData.alimentosEvitar,
        fullData.objetivoPrincipal,
        fullData.evolucaoTxt,
        todayStr
      );
      
      deepContext = buildContext(safeMessage, userData);
      
      deepContextRaw = `
      DADOS DO PACIENTE: ${mentionedPatient.full_name}
      
      🚫 RESTRIÇÕES ALIMENTARES: ${userData.restrictions.map((r) => r.food || r.tag).join(', ') || 'Nenhuma'}
      
      🍽️ CARDÁPIO DETALHADO:
      ${userData.cardapioFormatado}
      
      💧 DIÁRIO DE HOJE:
      - Água: ${userData.aguaHoje}ml
      - Refeições feitas: ${userData.refeicoesFeitas}
      - Humor: ${userData.humorHoje}
      - Atividade: ${userData.activityKcal} kcal
      
      📊 MACROS DIÁRIOS:
      - Calorias: ${userData.macrosDiarios?.totalKcal || 0} kcal
      - Proteínas: ${userData.macrosDiarios?.totalProtein || 0}g
      - Carboidratos: ${userData.macrosDiarios?.totalCarbs || 0}g
      - Gorduras: ${userData.macrosDiarios?.totalFat || 0}g
      `;
    }

    const systemInstruction = buildAdminContext(overview, currentTimeBR, deepContext, deepContextRaw);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
    
    const mappedHistory = history.map((msg) => ({
      role: msg?.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg?.content || '' }]
    }));

    const chat = model.startChat({ history: mappedHistory.slice(-10) });
    const result = image 
      ? await chat.sendMessage([safeMessage || "Analise esta imagem", { inlineData: { mimeType: "image/jpeg", data: image } }]) 
      : await chat.sendMessage(safeMessage || "Olá, preciso de ajuda com os pacientes.");
    
    return NextResponse.json({ reply: result.response.text(), remaining: 999 });

  } catch (error) {
    console.error('Erro na API Admin:', error);
    return NextResponse.json({ reply: 'Ocorreu um erro no servidor.' }, { status: 500 });
  }
}