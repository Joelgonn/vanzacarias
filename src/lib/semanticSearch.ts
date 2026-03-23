import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from './embeddingService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 📄 TIPAGENS
// ==========================================
interface MatchResult {
  similarity: number;
  question: string;
  answer: string;
}

// ==========================================
// ⚙️ CONFIGURAÇÕES
// ==========================================
const MAX_RESULTS = 3;
const INITIAL_FETCH = 5; // busca mais pra filtrar depois

// ==========================================
// 🧠 CALCULAR THRESHOLD DINÂMICO
// ==========================================
function getDynamicThreshold(totalMessages: number): number {
  // 🔥 AJUSTE DE PRODUÇÃO: Thresholds mais rigorosos agora que temos Embeddings Ricos
  if (totalMessages < 150) return 0.60; 
  if (totalMessages < 400) return 0.65;
  return 0.75;                         
}

// ==========================================
// 📊 CONTAR MENSAGENS DO USUÁRIO
// ==========================================
async function getUserMessageCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('ai_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.warn('[RAG] Erro ao contar mensagens:', error);
    return 0;
  }

  return count || 0;
}

// ==========================================
// 🔍 BUSCA SEMÂNTICA REFINADA
// ==========================================
export async function getSemanticMemories(
  userId: string,
  message: string
): Promise<string> {

  if (!userId || !message) return '';

  try {
    // ==========================================
    // 📊 BASE DO USUÁRIO
    // ==========================================
    const totalMessages = await getUserMessageCount(userId);
    const SIMILARITY_THRESHOLD = getDynamicThreshold(totalMessages);

    // ==========================================
    // 🧠 GERAR EMBEDDING
    // ==========================================
    const embedding = await generateEmbedding(message);

    if (!embedding) {
      console.warn('[RAG] Embedding não gerado');
      return '';
    }

    // ==========================================
    // 🔍 BUSCA NO BANCO
    // ==========================================
    const { data, error } = await supabase.rpc('match_messages', {
      query_embedding: embedding,
      match_user_id: userId,
      match_count: INITIAL_FETCH
    });

    if (error || !data || data.length === 0) {
      console.warn('[RAG] Nenhum resultado encontrado');
      return '';
    }

    // ==========================================
    // 🧪 DEBUG (IMPORTANTE)
    // ==========================================
    console.log('[RAG] Total msgs:', totalMessages);
    console.log('[RAG] Threshold:', SIMILARITY_THRESHOLD);
    // Correção aplicada aqui: adicionado a tipagem (d: MatchResult)
    console.log('[RAG] Similaridades:', data.map((d: MatchResult) => d.similarity));

    // ==========================================
    // 🔥 FILTRO DE QUALIDADE
    // ==========================================
    // Correção aplicada aqui: adicionado a tipagem (item: MatchResult)
    const filtered = data
      .filter((item: MatchResult) =>
        item.similarity != null &&
        item.similarity > 0.5 && // 🔥 NOVO FILTRO EXTRA: Limite mínimo absoluto de segurança
        item.similarity >= SIMILARITY_THRESHOLD &&
        item.question?.length > 10 &&
        item.answer?.length > 20
      )
      .slice(0, MAX_RESULTS);

    if (filtered.length === 0) {
      console.log('[RAG] Nenhuma memória relevante após filtro');
      return '';
    }

    // ==========================================
    // 🧠 FORMATAÇÃO INTELIGENTE
    // ==========================================
    const formatted = filtered.map((item: MatchResult, i: number) => `
Memória relevante ${i + 1}:
Paciente: ${item.question}
Assistente: ${item.answer}
`);

    return `
CONTEXTO RELEVANTE DO PACIENTE:
${formatted.join('\n')}
`;

  } catch (error) {
    console.warn('[RAG] Falha geral:', error);
    return '';
  }
}