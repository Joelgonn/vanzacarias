import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🛠️ FUNÇÃO AUXILIAR DE RETRY INTELIGENTE
// ==========================================
async function generateSummaryWithRetry(model: any, prompt: string, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: any) {
      // O SDK do Google pode enviar o 503 no status ou dentro da mensagem de erro
      const is503 = error?.status === 503 || error?.message?.includes('503');

      if (!is503 || i === retries) {
        throw error; // Se não for 503 ou acabaram as tentativas, explode o erro para o fallback pegar
      }

      console.warn(`[Retry] API sobrecarregada (503). Tentando novamente resumo (${i + 1}/${retries})...`);

      // ⏳ Backoff simples (espera 500ms, depois 1000ms, etc.)
      await new Promise(res => setTimeout(res, 500 * (i + 1)));
    }
  }
}

// ==========================================
// 📥 GET SUMMARY (Corrigido para evitar crash)
// ==========================================
export async function getUserSummary(userId: string): Promise<string> {
  if (!userId) return '';

  // Substituímos .single() por .limit(1) para não quebrar a API em pacientes novos sem resumo
  const { data, error } = await supabase
    .from('user_memory_summary')
    .select('summary')
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    console.error('[Memory Summary] Erro ao buscar resumo:', error);
    return '';
  }

  return data?.[0]?.summary || '';
}

// ==========================================
// 🔄 UPDATE SUMMARY (IA - Incremental e Controlado)
// ==========================================
export async function updateUserSummary(
  userId: string,
  newInteraction: { question: string; answer: string }
) {
  if (!userId) return;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return;

  const genAI = new GoogleGenerativeAI(geminiKey);

  // ===============================
  // 🔍 BUSCAR RESUMO ATUAL
  // ===============================
  const currentSummary = await getUserSummary(userId);

  // ===============================
  // 🧠 PROMPT DE RESUMO (Anti Crescimento Infinito)
  // ===============================
  // A instrução agora obriga a IA a "esquecer" coisas antigas em favor das novas,
  // mantendo o texto curto e condensado.
  const prompt = `
Você é uma IA de memória responsável por atualizar o perfil comportamental de um paciente clínico.
Sua tarefa é reescrever o resumo existente incorporando o que foi falado na nova interação.

REGRAS RÍGIDAS (EVITAR CRESCIMENTO INFINITO):
1. O resumo DEVE ter NO MÁXIMO 5 tópicos (bullet points curtos).
2. Limite estrito de 500 caracteres no total.
3. Se o limite de espaço estiver sendo atingido, EXCLUA (esqueça) informações antigas ou problemas já resolvidos. 
4. O resumo deve ser uma "foto" do momento atual do paciente, não um histórico do passado.
5. Foque estritamente em: Dificuldades atuais de adesão à dieta, emoções recorrentes, preferências novas ou sintomas reportados.
6. Responda APENAS com o texto do resumo, sem introduções ou cumprimentos.

[RESUMO ATUAL]:
${currentSummary || 'Nenhum paciente registrado ainda.'}

[NOVA INTERAÇÃO]:
Paciente: "${newInteraction.question}"
Assistente: "${newInteraction.answer}"

[NOVO RESUMO ATUALIZADO (Máximo 5 tópicos e 500 caracteres)]:
`;

  let newSummary: string | undefined = '';

  // ===============================
  // 🚀 TENTATIVA COM RETRY E FALLBACK
  // ===============================
  try {
    const modelLite = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite" // 🔥 barato aqui
    });
    
    newSummary = await generateSummaryWithRetry(modelLite, prompt);
    
  } catch (error) {
    console.warn('[Fallback] O modelo Flash-Lite falhou repetidas vezes. Mudando para o modelo principal (Flash)...');
    
    try {
      const modelFallback = genAI.getGenerativeModel({
        model: "gemini-2.5-flash" // 🔥 mais resiliente
      });
      
      newSummary = await generateSummaryWithRetry(modelFallback, prompt);
    } catch (fallbackError) {
      console.error('[Erro Fatal Resumo] Ambos os modelos falharam na atualização da memória:', fallbackError);
      return; // Abandona a atualização silenciosamente
    }
  }

  // Verifica se a string existe e não é vazia antes de salvar
  if (!newSummary || newSummary.trim() === '') return;

  // ===============================
  // 💾 UPSERT NO BANCO
  // ===============================
  await supabase
    .from('user_memory_summary')
    .upsert({
      user_id: userId,
      summary: newSummary.trim(),
      updated_at: new Date().toISOString()
    });
}