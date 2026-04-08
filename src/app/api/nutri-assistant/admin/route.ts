import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { FOOD_REGISTRY } from '@/lib/foodRegistry'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🛡️ SCHEMAS DE VALIDAÇÃO (ZOD) - ANTI-CRASH
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
// 🛠️ FUNÇÕES AUXILIARES GERAIS
// ==========================================

function normalizeString(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ==========================================
// 🧮 FUNÇÕES PARA CALCULAR E FORMATAR CARDÁPIO
// ==========================================

interface MacroPorRefeicao {
  nome: string; horario: string; kcal: number; protein: number; carbs: number; fat: number;
}
interface MacrosDiarios {
  totalKcal: number; totalProtein: number; totalCarbs: number; totalFat: number;
}

function calcularMacrosDoCardapio(mealPlan: any): { macrosDiarios: MacrosDiarios | null; macrosPorRefeicao: MacroPorRefeicao[]; } {
  if (!mealPlan || !Array.isArray(mealPlan) || mealPlan.length === 0) {
    return { macrosDiarios: null, macrosPorRefeicao: [] };
  }
  
  const macrosPorRefeicao: MacroPorRefeicao[] = [];
  let totalKcal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

  for (const meal of mealPlan) {
    const option = meal?.options?.[0];
    if (option) {
      const kcal = Number(option?.kcal) || 0;
      const protein = Number(option?.macros?.p) || 0;
      const carbs = Number(option?.macros?.c) || 0;
      const fat = Number(option?.macros?.g) || 0;

      totalKcal += kcal; totalProtein += protein; totalCarbs += carbs; totalFat += fat;
      macrosPorRefeicao.push({ 
        nome: meal?.name || 'Refeição', 
        horario: meal?.time || '--:--', 
        kcal, protein, carbs, fat 
      });
    }
  }
  return { macrosDiarios: { totalKcal, totalProtein, totalCarbs, totalFat }, macrosPorRefeicao };
}

// 🔥 1. FUNÇÃO CENTRAL (OBRIGATÓRIA)
function formatFoodItem(f: any): string {
  let grams = 0;
  
  // Mantemos a busca no registry para precisão (baseado no seu código original)
  const registryItem = FOOD_REGISTRY.find(r => r.id === f.id);
  const baseGrams = registryItem?.baseGrams || 100;

  if (f.grams != null) {
    grams = Math.round(f.grams);
  } else if (f.quantity != null) {
    // 🔥 fallback legado (somente leitura)
    grams = Math.round(f.quantity * baseGrams);
  } else {
    // 🔥 fallback final caso nenhum venha preenchido
    grams = baseGrams;
  }

  return `${grams}g ${f.name}`;
}

// 🔥 2. FORMATADOR DE OPÇÃO (NÍVEL INTERMEDIÁRIO)
function formatOption(option: any): string {
  if (!option.foodItems || option.foodItems.length === 0) {
    return option?.description || option?.name || 'Sem descrição detalhada';
  }

  const foods = option.foodItems.map(formatFoodItem);
  return foods.join(', ');
}

// 🔥 3. FORMATADOR DE REFEIÇÃO
function formatMeal(meal: any): string {
  if (!meal.options || meal.options.length === 0) return '';

  const optionsText = meal.options
    .map((opt: any, index: number) => {
      const text = formatOption(opt);
      if (!text) return null;

      const kcal = opt?.kcal || 0;
      const p = opt?.macros?.p || 0;
      const c = opt?.macros?.c || 0;
      const g = opt?.macros?.g || 0;

      const macrosText = `🔥 ${kcal} kcal | P:${p}g C:${c}g G:${g}g`;

      // Se houver apenas 1 opção, simplifica a leitura da IA. Se houver mais, enumera.
      if (meal.options.length === 1) {
        return `  ${text}\n  ${macrosText}`;
      }

      return `  Opção ${index + 1}: ${text}\n  ${macrosText}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return `- ${meal.name || 'Refeição'} (${meal.time || '--:--'}):\n${optionsText}`;
}

// 🔥 4. FORMATADOR DO CARDÁPIO COMPLETO
function formatMealPlan(mealPlan: any): string {
  if (!Array.isArray(mealPlan) || mealPlan.length === 0) {
    return 'Cardápio não disponível ou vazio.';
  }

  return mealPlan
    .map(formatMeal)
    .filter(Boolean)
    .join('\n\n');
}

// ==========================================
// 🛠️ CONSTRUTOR DE CONTEXTO ADMIN
// ==========================================

function buildAdminContext(adminData: any, currentTimeBR: string, deepContext: string): string {
  const patientsRaw = adminData?.patients;
  const patientsList = Array.isArray(patientsRaw) ? patientsRaw : (patientsRaw ? Object.values(patientsRaw) : []);

  const patientsResumo = patientsList.map((p: any) => {
    const isDietReady = p?.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0;
    const aguaHoje = p?.todayLog?.water_ml ? `${p.todayLog.water_ml}ml` : '0ml';
    const humorHoje = p?.todayLog?.mood || 'Não registrou';
    const kcalHoje = p?.todayLog?.activity_kcal ? `${p.todayLog.activity_kcal} kcal gastas` : '0 kcal';
    
    const macros = calcularMacrosDoCardapio(p?.meal_plan);
    let macrosText = '';
    if (macros.macrosDiarios) {
      macrosText = `\n    📊 MACROS DIÁRIOS: ${macros.macrosDiarios.totalKcal}kcal | P:${macros.macrosDiarios.totalProtein}g | C:${macros.macrosDiarios.totalCarbs}g | G:${macros.macrosDiarios.totalFat}g`;
    }

    return `- Nome: ${p?.full_name || 'Desconhecido'} \n    Dieta: ${isDietReady ? 'Pronta' : 'Pendente'} \n    Atrasado: ${p?.isLate ? 'Sim' : 'Não'} \n    Meta: ${p?.meta_peso ? `${p.meta_peso}kg` : 'N/A'} \n    Água: ${aguaHoje} \n    Humor: ${humorHoje} \n    Atividade: ${kcalHoje}${macrosText}`;
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

${deepContext ? `\n🔍 DADOS CLÍNICOS E CARDÁPIO PROFUNDO DO PACIENTE PESQUISADO:\n${deepContext}\n` : ''}

🔥 REGRAS DE OURO:
1. Aja como suporte direto da nutricionista e use TODOS os dados providenciados.
2. O cardápio detalhado dos pacientes estará na seção "DADOS CLÍNICOS E CARDÁPIO PROFUNDO" se um paciente for pesquisado.
3. Você DEVE utilizar essas informações para responder perguntas sobre refeições específicas (como almoço, jantar, alimentos, etc).
4. Se o cardápio ou o dado estiver presente no contexto, você NUNCA deve dizer que não tem acesso. Responda diretamente com base na informação.
5. Seja direta, profissional e proativa ao ajudar a Nutri.
`.trim();
}

// ==========================================
// 🌐 MAIN POST FUNCTION - EXCLUSIVA ADMIN
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
      return NextResponse.json({ reply: "Por favor, digite uma mensagem ou envie uma foto." }, { status: 200 });
    }

    const { data: profileCheck } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileCheck?.role !== 'admin' && profileCheck?.role !== 'nutricionista') {
      return NextResponse.json({ reply: 'Acesso negado. Esta área é restrita para administradores.' }, { status: 403 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ reply: "Erro de configuração no servidor." }, { status: 500 });

    const genAI = new GoogleGenerativeAI(geminiKey);
    const dataAtual = new Date();
    const currentTimeBR = dataAtual.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });

    let deepContext = '';
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
      const targetId = mentionedPatient.id;
      
      const [antro, logs, evals, checkins, profileTargetData] = await Promise.all([
        supabaseAdmin.from('anthropometry').select('*').eq('user_id', targetId).order('measurement_date', { ascending: false }).limit(2),
        supabaseAdmin.from('daily_logs').select('*').eq('user_id', targetId).order('date', { ascending: false }).limit(3),
        supabaseAdmin.from('evaluations').select('*').eq('user_id', targetId).limit(1),
        supabaseAdmin.from('checkins').select('*').eq('user_id', targetId).order('created_at', { ascending: false }).limit(2),
        supabaseAdmin.from('profiles').select('food_restrictions').eq('id', targetId).limit(1)
      ]);

      const rawRestrictions = profileTargetData.data?.[0]?.food_restrictions;
      const restrictionsValidation = z.array(FoodRestrictionSchema)
        .safeParse(Array.isArray(rawRestrictions) ? rawRestrictions : []);
        
      const safeRestrictions = restrictionsValidation.success ? restrictionsValidation.data : [];

      const restricoesTxt = safeRestrictions.length > 0
        ? safeRestrictions.map((r: any) => {
            const icon = r.type === 'allergy' ? '🚫' : r.type === 'intolerance' ? '⚠️' : '📋';
            return `${icon} ${r.food || r.tag || r.foodId}`;
          }).join(', ')
        : 'Nenhuma registrada';

      const cardapioTxt = formatMealPlan(mentionedPatient.meal_plan);

      deepContext = `
      DADOS DO PACIENTE: ${mentionedPatient.full_name}
      
      🚫 RESTRIÇÕES ALIMENTARES: ${restricoesTxt}
      
      🍽️ CARDÁPIO DETALHADO:
      ${cardapioTxt}
      
      📋 AVALIAÇÃO: ${JSON.stringify(evals.data)}
      ✅ CHECK-INS: ${JSON.stringify(checkins.data)}
      📊 ANTROPOMETRIA: ${JSON.stringify(antro.data)}
      💧 DIÁRIO: ${JSON.stringify(logs.data)}
      `;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: buildAdminContext(adminData, currentTimeBR, deepContext) });
    
    const mappedHistory = history.map((msg: any) => ({
      role: msg?.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg?.content || '' }]
    }));

    const chat = model.startChat({ history: mappedHistory.slice(-10) });
    const result = image ? await chat.sendMessage([safeMessage, { inlineData: { mimeType: "image/jpeg", data: image } }]) : await chat.sendMessage(safeMessage);
    
    return NextResponse.json({ reply: result.response.text(), remaining: 999 });

  } catch (error) {
    console.error('Erro na API Admin:', error);
    return NextResponse.json({ reply: 'Ocorreu um erro no servidor ao processar sua solicitação.' }, { status: 500 });
  }
}