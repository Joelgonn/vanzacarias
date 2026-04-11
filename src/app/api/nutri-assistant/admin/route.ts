import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

import { buildContext } from '@/lib/contextBuilder'
import { detectSabotagePattern, buildIntervention } from '@/lib/behaviorEngine'

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

const FoodRestrictionSchema = z.object({
  type: z.string().optional(),
  foodId: z.string().optional(),
  tag: z.string().optional(),
  food: z.string().optional()
}).passthrough();

const AdminRequestSchema = z.object({
  userId: z.string().min(1, "ID obrigatório"),
  message: z.string().optional(),
  image: z.string().nullable().optional(),
  history: z.array(z.object({ role: z.string(), content: z.string() }).passthrough()).optional().default([]),
  adminData: z.any().optional() 
});

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
  const todayLog = logs.find((log: any) => log.date === todayStr);
  const historicoBeliscos = await fetchHistoricoBeliscos(supabaseAdmin, patientId, todayStr, 4);
  
  let alimentosEvitar: string[] = [];
  if (qfaRes.data?.[0]?.answers) {
    alimentosEvitar = Object.entries(qfaRes.data[0].answers)
      .filter(([_, f]) => f === "0")
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
  patient: any,
  todayLog: any,
  historicoBeliscos: any[],
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
    atividadesHojeFormatadas = todayLog.activities.map((a: any) => `- ${a.name}`).join('\n');
  }

  const behaviorPattern = detectSabotagePattern({
    beliscos: beliscosProcessed,
    macrosDiarios: macros.macrosDiarios || undefined,
    humorHoje: todayLog?.mood,
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

function buildAdminContext(adminData: any, currentTimeBR: string, deepContext: string, deepContextRaw?: string): string {
  const patientsRaw = adminData?.patients;
  const patientsList = Array.isArray(patientsRaw) ? patientsRaw : (patientsRaw ? Object.values(patientsRaw) : []);

  const patientsResumo = patientsList.map((p: any) => {
    const isDietReady = p?.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0;
    const aguaHoje = p?.todayLog?.water_ml ? `${p.todayLog.water_ml}ml` : '0ml';
    const humorHoje = p?.todayLog?.mood || 'Não registrou';
    const kcalHoje = p?.todayLog?.activity_kcal ? `${p.todayLog.activity_kcal} kcal gastas` : '0 kcal';
    
    const hasBeliscos = p?.todayLog?.beliscos?.items?.length > 0;
    const beliscosInfo = hasBeliscos ? '⚠️ COM BELISCOS' : '✅ SEM BELISCOS';
    
    const macros = calcularMacrosDoCardapio(p?.meal_plan);
    let macrosText = '';
    if (macros.macrosDiarios) {
      macrosText = `\n    📊 MACROS: ${macros.macrosDiarios.totalKcal}kcal | P:${macros.macrosDiarios.totalProtein}g | C:${macros.macrosDiarios.totalCarbs}g | G:${macros.macrosDiarios.totalFat}g`;
    }

    return `- Nome: ${p?.full_name || 'Desconhecido'} ${beliscosInfo}\n    Dieta: ${isDietReady ? 'Pronta' : 'Pendente'} \n    Atrasado: ${p?.isLate ? 'Sim' : 'Não'} \n    Meta: ${p?.meta_peso ? `${p.meta_peso}kg` : 'N/A'} \n    Água: ${aguaHoje} \n    Humor: ${humorHoje} \n    Atividade: ${kcalHoje}${macrosText}`;
  }).join('\n') || 'Nenhum paciente cadastrado.';

  const leadsRaw = adminData?.leads;
  const leadsList = Array.isArray(leadsRaw) ? leadsRaw : (leadsRaw ? Object.values(leadsRaw) : []);
  const leadsResumo = leadsList.map((l: any) => `- Nome: ${l?.nome || 'Desconhecido'} | Whats: ${l?.whatsapp || 'Sem número'} | Status: ${l?.status || 'Sem status'}`).join('\n') || 'Nenhum lead pendente.';

  const usageStats = adminData?.usageStats || {};
  const activePatientsCount = Object.keys(usageStats).length;

  return `
Você é a Assistente de Inteligência Artificial exclusiva da Nutricionista Vanusa.
Você está operando no PAINEL ADMINISTRATIVO. Data e hora (Brasília): ${currentTimeBR}.
Seu objetivo é agir como uma co-piloto CLÍNICA e administrativa. Você TEM ACESSO COMPLETO aos dados dos pacientes, INCLUSIVE cardápios detalhados.

📊 DADOS DE USO:
- Mensagens da IA hoje: ${adminData?.todayTotalMessages || 0}
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

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    
    const parsedData = AdminRequestSchema.safeParse(rawBody);
    
    if (!parsedData.success) {
      console.error("❌ Payload Admin inválido:", parsedData.error.format());
      return NextResponse.json({ reply: "Dados de requisição inválidos." }, { status: 400 });
    }

    const { userId, message, history, image, adminData } = parsedData.data;
    const safeMessage = message?.trim() || '';

    if (!safeMessage && !image) {
      return NextResponse.json({ reply: "Digite uma mensagem ou envie uma foto." }, { status: 200 });
    }

    const { data: profileCheck } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileCheck?.role !== 'admin' && profileCheck?.role !== 'nutricionista') {
      return NextResponse.json({ reply: 'Acesso negado. Área restrita para administradores.' }, { status: 403 });
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
    
    const patientsRaw = adminData?.patients;
    const patientsList: any[] = Array.isArray(patientsRaw) ? patientsRaw : (patientsRaw ? Object.values(patientsRaw) : []);
    
    const mentionedPatient = patientsList.find((p: any) => {
      if (!p?.full_name) return false;
      const fullNameNorm = normalizeString(p.full_name);
      if (normalizedMsg.includes(fullNameNorm)) return true;
      const parts = fullNameNorm.split(' ');
      if (parts.length > 1 && normalizedMsg.includes(`${parts[0]} ${parts[1]}`)) return true;
      return parts.length > 0 && parts[0].length > 2 && normalizedMsg.includes(parts[0]);
    });

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
      
      🚫 RESTRIÇÕES ALIMENTARES: ${userData.restrictions.map((r: any) => r.food || r.tag).join(', ') || 'Nenhuma'}
      
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

    const systemInstruction = buildAdminContext(adminData, currentTimeBR, deepContext, deepContextRaw);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
    
    const mappedHistory = history.map((msg: any) => ({
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