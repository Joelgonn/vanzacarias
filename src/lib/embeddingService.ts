import OpenAI from 'openai'

// ==========================================
// 🔒 CLIENTE OPENAI (singleton)
// ==========================================
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('[Embedding] OPENAI_API_KEY não configurada');
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  return openai;
}

// ==========================================
// ⚙️ CONFIGURAÇÃO
// ==========================================
const EMBEDDING_MODEL = "text-embedding-3-small";

// ==========================================
// 🧠 NORMALIZAÇÃO (reduz ruído)
// ==========================================
function normalizeInput(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 2000); // 🔥 limite de segurança (tokens/custo)
}

// ==========================================
// 🚀 GERAR EMBEDDING
// ==========================================
export async function generateEmbedding(
  text: string
): Promise<number[] | null> {

  try {
    if (!text || text.length < 3) {
      console.warn('[Embedding] Texto muito curto, ignorado');
      return null;
    }

    const client = getOpenAIClient();

    const input = normalizeInput(text);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input
    });

    const vector = response.data?.[0]?.embedding;

    if (!vector) {
      console.warn('[Embedding] Vetor vazio retornado');
      return null;
    }

    return vector;

  } catch (error: any) {
    // ==========================================
    // ⚠️ LOG INTELIGENTE (SEM QUEBRAR SISTEMA)
    // ==========================================
    console.warn('[Embedding Error]', {
      message: error?.message,
      status: error?.status
    });

    // 🔥 NÃO quebra o fluxo (RAG opcional)
    return null;
  }
}