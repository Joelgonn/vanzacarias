// /lib/responseCache.ts

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🔍 NORMALIZAR TEXTO
// ==========================================
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // remove acentos
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '') // remove pontuação
    .trim();
}

// ==========================================
// 🔍 BUSCAR CACHE
// ==========================================
export async function getCachedResponse(
  userId: string,
  message: string
): Promise<string | null> {

  if (!userId || !message) return null;

  const normalized = normalizeText(message);

  // ===============================
  // 📅 HOJE
  // ===============================
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // ===============================
  // 🔍 BUSCA SIMPLES (últimas mensagens)
  // ===============================
  const { data, error } = await supabase
    .from('ai_messages')
    .select('question, answer, created_at')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data) {
    console.error('Erro no cache:', error);
    return null;
  }

  // ===============================
  // 🧠 MATCH SIMPLES
  // ===============================
  for (const msg of data) {
    const normalizedStored = normalizeText(msg.question);

    // 🔥 comparação simples (prefixo + includes)
    if (
      normalizedStored.includes(normalized.slice(0, 20)) ||
      normalized.includes(normalizedStored.slice(0, 20))
    ) {
      return msg.answer;
    }
  }

  return null;
}