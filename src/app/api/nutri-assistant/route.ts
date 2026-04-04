import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildContext } from '@/lib/contextBuilder'
import { checkRateLimit } from '@/lib/rateLimiter'
import { getCachedResponse } from '@/lib/responseCache'
import { getUserSummary, updateUserSummary } from '@/lib/memorySummary'
import { getSemanticMemories } from '@/lib/semanticSearch'
import { generateEmbedding } from '@/lib/embeddingService'

// 🔥 CORREÇÃO DO IMPORT: Trazendo a função do motor e o tipo do arquivo correto
import { expandRestrictions } from '@/lib/nutrition/restrictions';
import { type FoodRestriction } from '@/types/patient';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🛠️ FUNÇÕES AUXILIARES GERAIS
// ==========================================

function isComplexRequest(message: string, hasImage: boolean): boolean {
  const msg = message.toLowerCase();
  if (hasImage) return true;
  if (msg.includes('trocar') || msg.includes('substituir') || msg.includes('substituicao')) return true;
  if (msg.includes('emagrec') || msg.includes('resultado') || msg.includes('nao emagreci')) return true;
  if (msg.includes('desanimei') || msg.includes('não consegui') || msg.includes('nao consegui')) return true;
  return false;
}

function normalizeString(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ==========================================
// 🛡️ GUARDRAIL 10/10: AUTO-SYNC & SEMÂNTICA
// ==========================================

// 1. DICIONÁRIO DINÂMICO (Auto-Sync com o FOOD_REGISTRY)
const SEMANTIC_DICT = new Map<string, Set<string>>();

// Popula o dicionário na inicialização da API (Zero manutenção manual)
FOOD_REGISTRY.forEach(food => {
  // Pega o nome real e todos os aliases, normaliza tudo
  const keys = [food.name, ...food.aliases].map(normalizeString);
  keys.forEach(key => {
    if (!SEMANTIC_DICT.has(key)) SEMANTIC_DICT.set(key, new Set());
    SEMANTIC_DICT.get(key)!.add(food.id);
  });
});

// Ordena os aliases por tamanho decrescente (Longest Match First)
// Garante que "leite de soja" seja checado antes de "leite"
const SORTED_ALIASES = Array.from(SEMANTIC_DICT.keys()).sort((a, b) => b.length - a.length);

// 2. EXCEÇÕES CLÍNICAS (Falsos Positivos)
// Removemos essas frases antes de buscar no dicionário
const SAFE_PHRASES = [
  'leite vegetal', 'leite de amendoa', 'leite de amendoas', 'leite de coco', 'leite de soja', 'leite de aveia',
  'zero lactose', 'sem lactose', 'isento de lactose', 'nolac', 'pasta de amendoim', 'manteiga de amendoim'
];

function extractFoodIdsFromText(text: string): { ids: Set<string>, names: string[] } {
  let normalizedText = normalizeString(text);

  // A. Sanitização de Falsos Positivos
  for (const safe of SAFE_PHRASES) {
    const safeRegex = new RegExp(normalizeString(safe), 'g');
    normalizedText = normalizedText.replace(safeRegex, '[safe_phrase]');
  }

  const foundIds = new Set<string>();
  const foundNames = new Set<string>();

  // B. Matcher Semântico baseado no FOOD_REGISTRY
  for (const alias of SORTED_ALIASES) {
    const regex = new RegExp(`\\b${alias}\\b`, 'i');
    if (regex.test(normalizedText)) {
      const ids = SEMANTIC_DICT.get(alias)!;
      ids.forEach(id => foundIds.add(id));
      foundNames.add(alias);
      
      // Substitui para evitar duplo match em palavras menores (ex: achar 'pão francês' e depois 'pão')
      normalizedText = normalizedText.replace(regex, '[found]');
    }
  }

  return { ids: foundIds, names: Array.from(foundNames) };
}

// 3. MOTOR DE INTERCEPTAÇÃO E AUTOCORREÇÃO (UX Premium)
async function ensureSafeResponse(
  initialReply: string,
  restrictions: FoodRestriction[] | undefined,
  chatSession: any
): Promise<string> {
  if (!restrictions || restrictions.length === 0) return initialReply;

  const blockedIds = expandRestrictions(restrictions);
  if (blockedIds.size === 0) return initialReply;

  // Validação Local (Custo/Latência Zero)
  const { ids: mentionedFoodIds } = extractFoodIdsFromText(initialReply);
  const violations = Array.from(mentionedFoodIds).filter(id => blockedIds.has(id));

  // Se estiver limpo, segue o jogo instantaneamente!
  if (violations.length === 0) return initialReply;

  // Recupera o nome real para usar no prompt corretivo
  const violatedNames = violations.map(id => FOOD_REGISTRY.find(f => f.id === id)?.name || id);
  console.warn(`[🚨 GUARDRAIL ATIVADO] IA sugeriu bloqueados:`, violatedNames);

  // Double-Pass: Autocorreção via LLM (Acionado apenas em caso de falha)
  try {
    const correctionResult = await chatSession.sendMessage(
      `[ALERTA DE SEGURANÇA INTERNO - NÃO EXIBA ESTE AVISO] 
      Você gerou uma resposta sugerindo estes alimentos: ${violatedNames.join(', ')}.
      O paciente possui RESTRIÇÃO MÉDICA OBRIGATÓRIA a eles.
      
      TAREFA:
      Reescreva sua resposta anterior. Substitua os alimentos proibidos por alternativas perfeitamente seguras do mesmo grupo alimentar, respeitando as restrições.
      Mantenha exatamente o mesmo tom empático e formatação. Não peça desculpas pelo erro, apenas me dê o texto final corrigido de forma natural.`
    );
    return correctionResult.response.text();
  } catch (e) {
    // Fallback absoluto em caso de queda de API na 2ª chamada
    return `Pensei em algumas opções, mas notei que elas incluem derivados que esbarram nas suas restrições (${violatedNames.join(', ')}). Para sua segurança, que tal olharmos outras opções do seu plano ou conversarmos com a Nutri Vanusa? 😊`;
  }
}

// ==========================================
// 🧮 FUNÇÃO PARA CALCULAR MACROS DO CARDÁPIO
// ==========================================

interface MacroPorRefeicao {
  nome: string; horario: string; kcal: number; protein: number; carbs: number; fat: number;
}
interface MacrosDiarios {
  totalKcal: number; totalProtein: number; totalCarbs: number; totalFat: number;
}

function calcularMacrosDoCardapio(mealPlan: any[]): { macrosDiarios: MacrosDiarios | null; macrosPorRefeicao: MacroPorRefeicao[]; } {
  if (!mealPlan || !Array.isArray(mealPlan) || mealPlan.length === 0) {
    return { macrosDiarios: null, macrosPorRefeicao: [] };
  }
  const macrosPorRefeicao: MacroPorRefeicao[] = [];
  let totalKcal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

  for (const meal of mealPlan) {
    const option = meal.options?.[0];
    if (option) {
      const kcal = option.kcal || 0;
      const protein = option.macros?.p || 0;
      const carbs = option.macros?.c || 0;
      const fat = option.macros?.g || 0;

      totalKcal += kcal; totalProtein += protein; totalCarbs += carbs; totalFat += fat;
      macrosPorRefeicao.push({ nome: meal.name || 'Refeição', horario: meal.time || '--:--', kcal, protein, carbs, fat });
    }
  }
  return { macrosDiarios: { totalKcal, totalProtein, totalCarbs, totalFat }, macrosPorRefeicao };
}

// ==========================================
// 🛠️ CONSTRUTOR DE CONTEXTO ADMIN
// ==========================================

function buildAdminContext(adminData: any, currentTimeBR: string, deepContext: string): string {
  const patientsResumo = adminData?.patients?.map((p: any) => {
    const isDietReady = p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0;
    const aguaHoje = p.todayLog?.water_ml ? `${p.todayLog.water_ml}ml` : '0ml';
    const humorHoje = p.todayLog?.mood || 'Não registrou';
    const kcalHoje = p.todayLog?.activity_kcal ? `${p.todayLog.activity_kcal} kcal gastas` : '0 kcal';
    
    const macros = calcularMacrosDoCardapio(p.meal_plan || []);
    let macrosText = '';
    if (macros.macrosDiarios) {
      macrosText = `\n    📊 MACROS DIÁRIOS: ${macros.macrosDiarios.totalKcal}kcal | P:${macros.macrosDiarios.totalProtein}g | C:${macros.macrosDiarios.totalCarbs}g | G:${macros.macrosDiarios.totalFat}g`;
      if (macros.macrosPorRefeicao.length > 0) {
        macrosText += `\n    🍽️ MACROS POR REFEIÇÃO:`;
        macros.macrosPorRefeicao.forEach(ref => {
          macrosText += `\n       - ${ref.nome} (${ref.horario}): ${ref.kcal}kcal | P:${ref.protein}g | C:${ref.carbs}g | G:${ref.fat}g`;
        });
      }
    }

    return `- Nome: ${p.full_name || 'Desconhecido'} \n    Dieta: ${isDietReady ? 'Pronta' : 'Pendente'} \n    Atrasado: ${p.isLate ? 'Sim' : 'Não'} \n    Meta: ${p.meta_peso ? `${p.meta_peso}kg` : 'N/A'} \n    Água: ${aguaHoje} \n    Humor: ${humorHoje} \n    Atividade: ${kcalHoje}${macrosText}`;
  }).join('\n') || 'Nenhum paciente cadastrado.';

  const leadsResumo = adminData?.leads?.map((l: any) => `- Nome: ${l.nome} | Whats: ${l.whatsapp} | Status: ${l.status}`).join('\n') || 'Nenhum lead pendente.';

  return `
Você é a Assistente de Inteligência Artificial exclusiva da Nutricionista Vanusa.
Você está operando no PAINEL ADMINISTRATIVO dela. Data e hora (Brasília): ${currentTimeBR}.
Seu objetivo é agir como uma co-piloto clínica e administrativa.

📊 DADOS DE USO:
- Mensagens da IA hoje: ${adminData?.todayTotalMessages || 0}
- Pacientes ativos no chat: ${Object.keys(adminData?.usageStats || {}).length}

👥 VISÃO GERAL DOS PACIENTES:
${patientsResumo}

🎯 OPORTUNIDADES (LEADS):
${leadsResumo}

${deepContext ? `\n🔍 DADOS CLÍNICOS PROFUNDOS ENCONTRADOS NO BANCO DE DADOS:\n${deepContext}\n` : ''}

REGRAS: Aja como suporte da nutricionista e utilize os dados providenciados.
`.trim();
}

function formatarCardapio(mealPlan: any[]): string {
  if (!mealPlan || !Array.isArray(mealPlan) || mealPlan.length === 0) return 'Cardápio ainda não elaborado.';
  return mealPlan.map((meal: any) => {
    const option = meal.options?.[0];
    if (!option) return `- ${meal.time} | ${meal.name}: Sem descrição`;
    const kcal = option.kcal || 0;
    const macros = option.macros || { p: 0, c: 0, g: 0 };
    return `- ${meal.time} | ${meal.name}: ${option.description || 'Sem descrição'} (${kcal} kcal | P:${macros.p}g | C:${macros.c}g | G:${macros.g}g)`;
  }).join('\n');
}

// ==========================================
// 🌐 MAIN POST FUNCTION
// ==========================================

export async function POST(req: Request) {
  try {
    const { userId, message, history, image, isAdmin, adminData } = await req.json()
    const safeMessage = message?.trim() || '';

    if (!safeMessage && !image) return NextResponse.json({ reply: "Por favor, digite uma mensagem ou envie uma foto." }, { status: 200 });
    if (!userId) return NextResponse.json({ reply: "Sessão inválida. Por favor, faça login novamente." }, { status: 401 });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ reply: "Erro de configuração no servidor." }, { status: 500 });

    const genAI = new GoogleGenerativeAI(geminiKey);
    const dataAtual = new Date();
    const todayStr = dataAtual.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const currentTimeBR = dataAtual.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });

    // ==========================================
    // 👑 MODO ADMINISTRADOR
    // ==========================================
    if (isAdmin) {
      const { data: profilesData } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).limit(1);
      const userProfile = profilesData && profilesData.length > 0 ? profilesData[0] : null;

      if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'nutricionista')) {
        return NextResponse.json({ reply: `Acesso negado.` }, { status: 403 });
      }

      let deepContext = '';
      const normalizedMsg = normalizeString(safeMessage);
      const mentionedPatient = adminData?.patients?.find((p: any) => {
        if (!p.full_name) return false;
        return p.full_name.split(' ')[0].length > 2 && normalizedMsg.includes(normalizeString(p.full_name.split(' ')[0]));
      });

      if (mentionedPatient) {
        const targetId = mentionedPatient.id;
        const [antro, logs, evals, checkins] = await Promise.all([
          supabaseAdmin.from('anthropometry').select('*').eq('user_id', targetId).order('measurement_date', { ascending: false }).limit(2),
          supabaseAdmin.from('daily_logs').select('*').eq('user_id', targetId).order('date', { ascending: false }).limit(3),
          supabaseAdmin.from('evaluations').select('*').eq('user_id', targetId).limit(1),
          supabaseAdmin.from('checkins').select('*').eq('user_id', targetId).order('created_at', { ascending: false }).limit(2)
        ]);

        deepContext = `
        DADOS DO PACIENTE: ${mentionedPatient.full_name}
        📋 AVALIAÇÃO: ${JSON.stringify(evals.data)}
        ✅ CHECK-INS: ${JSON.stringify(checkins.data)}
        📊 ANTROPOMETRIA: ${JSON.stringify(antro.data)}
        💧 DIÁRIO: ${JSON.stringify(logs.data)}
        `;
      }

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: buildAdminContext(adminData, currentTimeBR, deepContext) });
      const chat = model.startChat({ history: (history || []).slice(-10).map((msg: any) => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] })) });
      const result = image ? await chat.sendMessage([safeMessage, { inlineData: { mimeType: "image/jpeg", data: image } }]) : await chat.sendMessage(safeMessage);
      
      return NextResponse.json({ reply: result.response.text(), remaining: 999 });
    }

    // ==========================================
    // ⚡ FLUXO PADRÃO (PACIENTE)
    // ==========================================

    if (!image && safeMessage) {
      const cached = await getCachedResponse(userId, safeMessage);
      if (cached) {
        const currentRate = await checkRateLimit(userId);
        if (!currentRate.allowed) return NextResponse.json({ reply: `Limite atingido.`, limitReached: true, remaining: 0 }, { status: 200 });
        return NextResponse.json({ reply: cached, cached: true, remaining: Math.max(currentRate.remaining - 1, 0), limit: currentRate.limit }, { status: 200 });
      }
    }

    const rate = await checkRateLimit(userId);
    if (!rate.allowed) return NextResponse.json({ reply: `Limite atingido.`, limitReached: true, remaining: 0 }, { status: 200 });

    const [profileRes, dailyLogRes, evalRes, qfaRes, antroRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, meta_peso, meal_plan, restrictions').eq('id', userId).limit(1),
      supabaseAdmin.from('daily_logs').select('water_ml, meals_checked, mood, activities, activity_kcal').eq('user_id', userId).eq('date', todayStr).limit(1),
      supabaseAdmin.from('evaluations').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabaseAdmin.from('qfa_responses').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabaseAdmin.from('anthropometry').select('weight, waist').eq('user_id', userId).order('measurement_date', { ascending: false }).limit(2)
    ]);

    const profile = profileRes.data?.[0];
    const dailyLog = dailyLogRes.data?.[0];
    const evaluation = evalRes.data?.[0];
    
    let alimentosEvitar: string[] = [];
    if (qfaRes.data?.[0]?.answers) {
      alimentosEvitar = Object.entries(qfaRes.data[0].answers).filter(([_, f]) => f === "0").map(([a]) => a.replace(/_/g, ' '));
    }

    const { macrosDiarios, macrosPorRefeicao } = calcularMacrosDoCardapio(profile?.meal_plan || []);

    const baseContext = buildContext(safeMessage, {
      nomePaciente: profile?.full_name?.split(' ')[0] || 'Paciente',
      objetivoPrincipal: evaluation?.answers?.["0"] || 'Não informado',
      metaPeso: profile?.meta_peso ? `${profile.meta_peso}kg` : 'Manutenção',
      rotinaSono: evaluation?.answers?.["3"] || '',
      vontadesDoces: evaluation?.answers?.["7"] || '',
      alimentosEvitar,
      restrictions: profile?.restrictions || [],
      cardapioFormatado: formatarCardapio(profile?.meal_plan || []),
      evolucaoTxt: antroRes.data?.length === 2 ? `Reduziu ${antroRes.data[1].weight - antroRes.data[0].weight}kg` : 'Iniciando.',
      humorHoje: dailyLog?.mood || 'Não registrado',
      aguaHoje: dailyLog?.water_ml || 0,
      refeicoesFeitas: dailyLog?.meals_checked?.length || 0,
      atividadesHojeFormatadas: dailyLog?.activities ? dailyLog.activities.map((a:any) => `- ${a.name}`).join('\n') : 'Nenhuma',
      activityKcal: dailyLog?.activity_kcal || 0,
      todayStr,
      hasImage: !!image,
      macrosDiarios: macrosDiarios || undefined,
      macrosPorRefeicao
    });

    const summary = await getUserSummary(userId);
    const msgLower = safeMessage.toLowerCase();
    const shouldUseMemory = !!image || safeMessage.length > 20 || msgLower.includes('trocar');
    const semanticMemory = (shouldUseMemory && safeMessage) ? await getSemanticMemories(userId, safeMessage) : '';

    const contextoInjetado = `
[INFORMAÇÃO DO SISTEMA]: Hora atual: ${currentTimeBR}.
${baseContext}
${summary ? `RESUMO:\n${summary}\n` : ''}
${semanticMemory || ''}`.trim();

    const modelName = (isComplexRequest(safeMessage, !!image) || macrosDiarios !== null) ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";

    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: contextoInjetado });
    const chat = model.startChat({ history: (history || []).slice(-7).map((msg: any) => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] })) });

    let result = image 
      ? await chat.sendMessage([safeMessage || "Analise esse prato", { inlineData: { mimeType: "image/jpeg", data: image } }]) 
      : await chat.sendMessage(safeMessage);

    let reply = result.response.text();
    if (!reply) return NextResponse.json({ reply: "Pode repetir?" }, { status: 200 });

    // 🔥 EXECUÇÃO DO GUARDRAIL SOTA
    reply = await ensureSafeResponse(reply, profile?.restrictions, chat);

    // Salvamento Assíncrono
    if (userId) {
      const qText = safeMessage || 'Enviou imagem';
      const { data: insertedMsgs } = await supabaseAdmin.from('ai_messages').insert({ user_id: userId, question: qText, answer: reply }).select('id');
      if (insertedMsgs?.[0]) {
        (async () => {
          try {
            await updateUserSummary(userId, { question: qText, answer: reply });
            if (qText.length > 10) {
              const vector = await generateEmbedding(`Pergunta: ${qText}\nResposta: ${reply}`);
              if (vector) await supabaseAdmin.from('ai_messages').update({ embedding: vector }).eq('id', insertedMsgs[0].id);
            }
          } catch (e) { console.error('Background Task Error', e); }
        })();
      }
    }

    return NextResponse.json({ reply, remaining: Math.max(rate.remaining - 1, 0), limit: rate.limit });

  } catch (error) {
    console.error('Erro na API:', error);
    return NextResponse.json({ reply: 'Tive um pequeno soluço técnico. Pode tentar novamente?' }, { status: 200 });
  }
}