import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

import { buildContext } from '@/lib/contextBuilder'
import { checkRateLimit } from '@/lib/rateLimiter'
import { getCachedResponse } from '@/lib/responseCache'
import { getUserSummary, updateUserSummary } from '@/lib/memorySummary'
import { getSemanticMemories } from '@/lib/semanticSearch'
import { generateEmbedding } from '@/lib/embeddingService'
import { expandRestrictions } from '@/lib/nutrition/restrictions'
import { FOOD_REGISTRY } from '@/lib/foodRegistry'

// ==========================================
// 🛡️ SCHEMAS DE VALIDAÇÃO (ZOD) - NÍVEL ELITE
// ==========================================

// 1. Schemas de Payload (Frontend)
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'model']),
  content: z.string()
});

const PatientRequestSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1),

  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })
  ).optional().default([]),

  image: z.string().optional().nullable()
}).passthrough(); // 🔥 CRÍTICO

// 2. Schemas de Banco de Dados (Evitando 'any' do Supabase)
const FoodRestrictionSchema = z.object({
  type: z.enum(['allergy', 'intolerance', 'preference', 'restriction']).catch('restriction'),
  foodId: z.string().optional(),
  tag: z.string().optional(),
  food: z.string().optional()
});

// 🔥 NOVO: Schema dos itens de alimento para que o Zod não descarte os dados
const FoodItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().optional().default(1)
});

const MealOptionSchema = z.object({
  kcal: z.number().optional().default(0),
  macros: z.object({
    p: z.number().optional().default(0),
    c: z.number().optional().default(0),
    g: z.number().optional().default(0)
  }).optional(),
  description: z.string().optional(),
  // 🔥 NOVO: O Zod agora reconhece e valida a estrutura visual montada no DietBuilder
  foodItems: z.array(FoodItemSchema).optional().default([])
});

const MealPlanSchema = z.array(
  z.object({
    name: z.string().optional().default('Refeição'),
    time: z.string().optional().default('--:--'),
    options: z.array(MealOptionSchema).optional()
  })
).nullable().default([]);

// Tipagens Ingeridas
type MealPlan = z.infer<typeof MealPlanSchema>;
type FoodRestriction = z.infer<typeof FoodRestrictionSchema>;

// ==========================================
// CONFIGURAÇÕES INICIAIS
// ==========================================

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

const SEMANTIC_DICT = new Map<string, Set<string>>();

FOOD_REGISTRY.forEach(food => {
  const keys = [food.name, ...food.aliases].map(normalizeString);
  keys.forEach(key => {
    if (!SEMANTIC_DICT.has(key)) SEMANTIC_DICT.set(key, new Set());
    SEMANTIC_DICT.get(key)!.add(food.id);
  });
});

const SORTED_ALIASES = Array.from(SEMANTIC_DICT.keys()).sort((a, b) => b.length - a.length);

const SAFE_PHRASES = [
  'leite vegetal', 'leite de amendoa', 'leite de amendoas', 'leite de coco', 'leite de soja', 'leite de aveia',
  'zero lactose', 'sem lactose', 'isento de lactose', 'nolac', 'pasta de amendoim', 'manteiga de amendoim'
];

function extractFoodIdsFromText(text: string): { ids: Set<string>, names: string[] } {
  let normalizedText = normalizeString(text);

  for (const safe of SAFE_PHRASES) {
    const safeRegex = new RegExp(normalizeString(safe), 'g');
    normalizedText = normalizedText.replace(safeRegex, '[safe_phrase]');
  }

  const foundIds = new Set<string>();
  const foundNames = new Set<string>();

  for (const alias of SORTED_ALIASES) {
    const regex = new RegExp(`\\b${alias}\\b`, 'i');
    if (regex.test(normalizedText)) {
      const ids = SEMANTIC_DICT.get(alias)!;
      ids.forEach(id => foundIds.add(id));
      foundNames.add(alias);
      normalizedText = normalizedText.replace(regex, '[found]');
    }
  }

  return { ids: foundIds, names: Array.from(foundNames) };
}

async function ensureSafeResponse(
  initialReply: string,
  restrictions: FoodRestriction[],
  chatSession: any
): Promise<string> {
  if (!restrictions || restrictions.length === 0) return initialReply;

  // Usa o casting seguro já que o tipo base foi validado pelo Zod
  const blockedIds = expandRestrictions(restrictions as any[]);
  if (blockedIds.size === 0) return initialReply;

  const { ids: mentionedFoodIds } = extractFoodIdsFromText(initialReply);
  const violations = Array.from(mentionedFoodIds).filter(id => blockedIds.has(id));

  if (violations.length === 0) return initialReply;

  const violatedNames = violations.map(id => FOOD_REGISTRY.find(f => f.id === id)?.name || id);
  console.warn(`[🚨 GUARDRAIL ATIVADO] IA sugeriu bloqueados:`, violatedNames);

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

function calcularMacrosDoCardapio(mealPlan: MealPlan): { macrosDiarios: MacrosDiarios | null; macrosPorRefeicao: MacroPorRefeicao[]; } {
  if (!mealPlan || mealPlan.length === 0) {
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
      macrosPorRefeicao.push({ nome: meal.name, horario: meal.time, kcal, protein, carbs, fat });
    }
  }
  return { macrosDiarios: { totalKcal, totalProtein, totalCarbs, totalFat }, macrosPorRefeicao };
}

function formatarCardapio(mealPlan: MealPlan): string {
  if (!mealPlan || mealPlan.length === 0) return 'Cardápio ainda não elaborado.';
  
  return mealPlan.map((meal) => {
    const option = meal.options?.[0];
    if (!option) return `- ${meal.time} | ${meal.name}: Sem descrição`;
    
    // 🔥 CORREÇÃO: Formatação priorizando foodItems (com fallback para description)
    const foods = option.foodItems?.length
      ? option.foodItems.map(f => `${f.quantity}x ${f.name}`).join(', ')
      : option.description || 'Sem descrição';

    const kcal = option.kcal || 0;
    const macros = option.macros || { p: 0, c: 0, g: 0 };
    
    return `- ${meal.time} | ${meal.name}: ${foods} (${kcal} kcal | P:${macros.p}g | C:${macros.c}g | G:${macros.g}g)`;
  }).join('\n');
}

// ==========================================
// 🌐 MAIN POST FUNCTION - EXCLUSIVA PACIENTE
// ==========================================

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    
    // 🔥 VALIDAÇÃO ZOD: Failsafe absoluto do payload
    const parsedData = PatientRequestSchema.safeParse(rawBody);
    
    if (!parsedData.success) {
      console.error("❌ Payload inválido rejeitado pelo Zod:", parsedData.error.format());
      return NextResponse.json({ reply: "Dados de requisição inválidos. Por favor, recarregue a página." }, { status: 400 });
    }

    const { userId, message, history, image } = parsedData.data;
    const safeMessage = message?.trim() || '';

    if (!safeMessage && !image) {
      return NextResponse.json({ reply: "Por favor, digite uma mensagem ou envie uma foto." }, { status: 200 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ reply: "Erro de configuração no servidor." }, { status: 500 });

    const genAI = new GoogleGenerativeAI(geminiKey);
    const dataAtual = new Date();
    const todayStr = dataAtual.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const currentTimeBR = dataAtual.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });

    // CACHE & RATE LIMIT
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

    // BUSCA DE DADOS DO PACIENTE
    const [profileRes, dailyLogRes, evalRes, qfaRes, antroRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, meta_peso, meal_plan, food_restrictions').eq('id', userId).limit(1),
      supabaseAdmin.from('daily_logs').select('water_ml, meals_checked, mood, activities, activity_kcal').eq('user_id', userId).eq('date', todayStr).limit(1),
      supabaseAdmin.from('evaluations').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabaseAdmin.from('qfa_responses').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabaseAdmin.from('anthropometry').select('weight, waist').eq('user_id', userId).order('measurement_date', { ascending: false }).limit(2)
    ]);

    const profile = profileRes.data?.[0];
    const dailyLog = dailyLogRes.data?.[0];
    const evaluation = evalRes.data?.[0];
    
    // 🔥 AQUI O ZOD NÃO VAI MAIS DESTRUIR OS ALIMENTOS MONTADOS NO FRONTEND
    const safeMealPlan = MealPlanSchema.parse(profile?.meal_plan);
    
    const restrictionsValidation = z.array(FoodRestrictionSchema).safeParse(profile?.food_restrictions);
    const safeRestrictions = restrictionsValidation.success ? restrictionsValidation.data : [];

    let alimentosEvitar: string[] = [];
    if (qfaRes.data?.[0]?.answers) {
      alimentosEvitar = Object.entries(qfaRes.data[0].answers).filter(([_, f]) => f === "0").map(([a]) => a.replace(/_/g, ' '));
    }

    const { macrosDiarios, macrosPorRefeicao } = calcularMacrosDoCardapio(safeMealPlan);

    const baseContext = buildContext(safeMessage, {
      nomePaciente: profile?.full_name?.split(' ')[0] || 'Paciente',
      objetivoPrincipal: evaluation?.answers?.["0"] || 'Não informado',
      metaPeso: profile?.meta_peso ? `${profile.meta_peso}kg` : 'Manutenção',
      rotinaSono: evaluation?.answers?.["3"] || '',
      vontadesDoces: evaluation?.answers?.["7"] || '',
      alimentosEvitar,
      restrictions: safeRestrictions as any, // Cast necessário para alinhar com a tipagem da biblioteca
      cardapioFormatado: formatarCardapio(safeMealPlan),
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
    
    // Converte o history de forma segura
    const mappedHistory = history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history: mappedHistory });

    let result = image 
      ? await chat.sendMessage([safeMessage || "Analise esse prato", { inlineData: { mimeType: "image/jpeg", data: image } }]) 
      : await chat.sendMessage(safeMessage);

    let reply = result.response.text();
    if (!reply) return NextResponse.json({ reply: "Pode repetir?" }, { status: 200 });

    reply = await ensureSafeResponse(reply, safeRestrictions, chat);

    // Salvamento assíncrono na memória
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
    console.error('Erro na API Patient:', error);
    return NextResponse.json({ reply: 'Tive um pequeno soluço técnico. Pode tentar novamente?' }, { status: 500 });
  }
}