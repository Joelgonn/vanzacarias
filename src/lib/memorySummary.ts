// /lib/memorySummary.ts

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
// 📥 GET SUMMARY
// ==========================================
export async function getUserSummary(userId: string): Promise<string> {
  if (!userId) return '';

  const { data } = await supabase
    .from('user_memory_summary')
    .select('summary')
    .eq('user_id', userId)
    .single();

  return data?.summary || '';
}

// ==========================================
// 🔄 UPDATE SUMMARY (IA)
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
  // 🧠 PROMPT DE RESUMO
  // ===============================
  const prompt = `
Você é um sistema que mantém um resumo nutricional de um paciente.

Atualize o resumo com base na nova interação.

REGRAS:
- Máximo 5-6 linhas
- Foque em comportamento, preferências e dificuldades
- Não repetir informações
- Seja direto

RESUMO ATUAL:
${currentSummary || 'Nenhum'}

NOVA INTERAÇÃO:
Paciente: ${newInteraction.question}
Assistente: ${newInteraction.answer}

NOVO RESUMO:
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

  if (!newSummary) return;

  // ===============================
  // 💾 UPSERT
  // ===============================
  await supabase
    .from('user_memory_summary')
    .upsert({
      user_id: userId,
      summary: newSummary,
      updated_at: new Date().toISOString()
    });
}