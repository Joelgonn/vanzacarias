import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🧠 FUNÇÃO PRINCIPAL DE RATE LIMIT
// ==========================================
export async function checkRateLimit(userId: string) {
  if (!userId) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0
    };
  }

  try {
    // ===============================
    // 1. CHECAGEM DE PERFIL E PLANO
    // ===============================
    // Buscamos o papel (role) e futuramente você pode adicionar a coluna 'plan' aqui
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, status') 
      .eq('id', userId)
      .limit(1);

    if (profileError) {
      console.error('[Rate Limiter] Erro ao buscar perfil:', profileError);
    }

    const userProfile = profileData?.[0];

    // ===============================
    // 2. REGRA DO ADMINISTRADOR
    // ===============================
    // Admins e Nutricionistas têm limite infinito por padrão
    if (userProfile?.role === 'admin' || userProfile?.role === 'nutricionista') {
      return {
        allowed: true,
        remaining: 9999,
        limit: 9999,
        used: 0
      };
    }

    // ===============================
    // 3. REGRA DO PACIENTE / MONETIZAÇÃO
    // ===============================
    // Aqui você altera no futuro: const DAILY_LIMIT = userProfile?.plan === 'premium' ? 200 : 25;
    const DAILY_LIMIT = 25; 

    // ===============================
    // 4. INÍCIO E FIM DO DIA (FUSO HORÁRIO BRASIL)
    // ===============================
    // Garante que o limite zere exatamente à meia-noite do Horário de Brasília, e não no horário UTC do servidor
    const now = new Date();
    const tzString = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    
    const startOfDay = new Date(tzString);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(tzString);
    endOfDay.setHours(23, 59, 59, 999);

    // ===============================
    // 5. CONTAR MENSAGENS DO DIA
    // ===============================
    const { count, error: countError } = await supabaseAdmin
      .from('ai_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    if (countError) {
      throw countError;
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

  } catch (error) {
    console.error('[Rate Limiter] Erro de processamento:', error);

    // ===============================
    // 6. FALLBACK SEGURO
    // ===============================
    // Se o banco de dados cair ou der timeout, não bloqueamos o usuário injustamente.
    // Deixamos passar com o limite padrão.
    return {
      allowed: true,
      remaining: 25,
      limit: 25,
      used: 0
    };
  }
}