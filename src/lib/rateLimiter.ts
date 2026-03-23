// /lib/rateLimiter.ts

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🔒 CONFIGURAÇÃO
// ==========================================
//Base para monetização - depois você só troca:(const DAILY_LIMIT = 25; por const DAILY_LIMIT = user.plan === 'premium' ? 200 : 25;)
const DAILY_LIMIT = 25;

// ==========================================
// 🧠 FUNÇÃO PRINCIPAL
// ==========================================
export async function checkRateLimit(userId: string) {
  if (!userId) {
    return {
      allowed: false,
      remaining: 0,
      limit: DAILY_LIMIT,
      used: DAILY_LIMIT
    };
  }

  // ===============================
  // 📅 INÍCIO E FIM DO DIA
  // ===============================
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // ===============================
  // 📊 CONTAR MENSAGENS DO DIA
  // ===============================
  const { count, error } = await supabase
    .from('ai_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());

  if (error) {
    console.error('Erro no rate limit:', error);

    // fallback seguro (não bloquear usuário por erro)
    return {
      allowed: true,
      remaining: DAILY_LIMIT,
      limit: DAILY_LIMIT,
      used: 0
    };
  }

  const used = count || 0;
  const remaining = Math.max(DAILY_LIMIT - used, 0);
  const allowed = used < DAILY_LIMIT;

  return {
    allowed,
    remaining,
    limit: DAILY_LIMIT,
    used
  };
}