import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from './embeddingService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 🔥 AVISANDO AO TYPESCRIPT O FORMATO DA NOSSA FUNÇÃO SQL
interface SemanticMemory {
  id: string;
  question: string;
  answer: string;
  similarity: number;
}

export async function getSemanticMemories(
  userId: string,
  message: string
): Promise<string> {

  if (!userId || !message) return '';

  const embedding = await generateEmbedding(message);

  const { data, error } = await supabase.rpc('match_messages', {
    query_embedding: embedding,
    match_user_id: userId,
    match_count: 2 // 🔥 Ajustado para 2 conforme combinamos para economizar limite de contexto
  });

  if (error || !data || data.length === 0) return '';

  // 🔥 AGORA O TYPESCRIPT SABE O QUE É O 'item'
  const formatted = (data as SemanticMemory[]).map((item, i) => `
Memória relevante ${i + 1}:
Paciente: ${item.question}
Assistente: ${item.answer}
`);

  return `
MEMÓRIA RELEVANTE (SEMÂNTICA):
${formatted.join('\n')}
`;
}