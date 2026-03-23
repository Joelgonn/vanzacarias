// /lib/memoryRetriever.ts

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🧠 BUSCAR MEMÓRIA DO PACIENTE
// ==========================================
export async function getRelevantMemories(
  userId: string,
  limit: number = 5
): Promise<string> {

  if (!userId) return '';

  // ===============================
  // 🔍 BUSCA SIMPLES (RECENTE)
  // ===============================
  const { data, error } = await supabase
    .from('ai_messages')
    .select('question, answer, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) {
    return '';
  }

  // ===============================
  // 🧠 FORMATAÇÃO DA MEMÓRIA
  // ===============================
  const memories = data.map((msg, index) => {
    return `
Interação passada ${index + 1}:
Paciente: ${msg.question}
Assistente: ${msg.answer}
`;
  });

  return `
MEMÓRIA DO PACIENTE (INTERAÇÕES RECENTES):
${memories.join('\n')}
`;
}