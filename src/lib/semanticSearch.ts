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
// ⚙️ CONFIGURAÇÕES E THRESHOLD FIXO — VZ-017
// ==========================================
const MAX_RESULTS_FREE = 2;
const MAX_RESULTS_PREMIUM = 5;
const INITIAL_FETCH_FREE = 4;
const INITIAL_FETCH_PREMIUM = 7;

// 🔥 AJUSTE DE PERFORMANCE: Threshold fixo e ideal para o text-embedding-3-small.
// Isso elimina a necessidade de fazer um "SELECT COUNT" no banco a cada mensagem.
const SIMILARITY_THRESHOLD = 0.65; 

// ==========================================
// 🔍 BUSCA SEMÂNTICA REFINADA
// ==========================================
export async function getSemanticMemories(
  userId: string,
  message: string,
  canAccessMealPlan?: boolean
): Promise<string> {

  if (!userId || !message) return '';

  try {
    // ==========================================
    // 🧠 GERAR EMBEDDING
    // ==========================================
    const embedding = await generateEmbedding(message);

    if (!embedding) {
      console.warn('[RAG] Embedding não gerado');
      return '';
    }

    // ==========================================
    // 🔍 BUSCA NO BANCO — VZ-017: diferencia Free/Premium
    // ==========================================
    const isPremium = canAccessMealPlan === true;
    const fetchCount = isPremium ? INITIAL_FETCH_PREMIUM : INITIAL_FETCH_FREE;
    const maxResults = isPremium ? MAX_RESULTS_PREMIUM : MAX_RESULTS_FREE;
    const { data, error } = await supabase.rpc('match_messages', {
      query_embedding: embedding,
      match_user_id: userId,
      match_count: fetchCount
    });

    if (error || !data || data.length === 0) {
      console.warn('[RAG] Nenhum resultado encontrado');
      return '';
    }

    // ==========================================
    // 🧪 DEBUG — VZ-016: apenas em desenvolvimento
    // ==========================================
    if (process.env.NODE_ENV === 'development') {
      console.log('[RAG] Threshold Aplicado:', SIMILARITY_THRESHOLD);
      console.log('[RAG] Similaridades:', data.map((d: MatchResult) => d.similarity));
    }

    // ==========================================
    // 🔥 FILTRO DE QUALIDADE
    // ==========================================
    const filtered = data
      .filter((item: MatchResult) =>
        item.similarity != null &&
        item.similarity > 0.5 && // 🔥 Limite mínimo absoluto de segurança
        item.similarity >= SIMILARITY_THRESHOLD &&
        item.question?.length > 10 &&
        item.answer?.length > 20
      )
      .slice(0, maxResults);

    if (filtered.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[RAG] Nenhuma memória relevante após filtro');
      }
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