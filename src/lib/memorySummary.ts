// /lib/memorySummary.ts

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite" // 🔥 barato aqui
  });

  const result = await model.generateContent(prompt);
  const newSummary = result.response.text();

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