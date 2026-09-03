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
    // 1. CHECAGEM DE PERFIL E PLANO — VZ-017
    // ===============================
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, status, account_type, has_meal_plan_access') 
      .eq('id', userId)
      .limit(1);

    if (profileError) {
      console.error('[Rate Limiter] Erro ao buscar perfil:', profileError);
      throw profileError;
    }

    const userProfile = profileData?.[0] as { role?: string; account_type?: string | null; has_meal_plan_access?: boolean | null; status?: string | null } | undefined;

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
    // 3. REGRA DO PACIENTE / MONETIZAÇÃO — VZ-017
    // ===============================
    const isPremium = userProfile?.account_type === 'premium' || !!userProfile?.has_meal_plan_access;
    const DAILY_LIMIT = isPremium ? 80 : 25; 

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
    // 6. FALLBACK SEGURO — JG-002.1 fail-close
    // ===============================
    // Antes: fail-open (allowed:true) permitia bypass silencioso se Supabase falhasse.
    // Agora: fail-close para novas mensagens — retorna erro distinguível para o chamador.
    // O chamador deve responder com erro seguro (não expor detalhes internos) e não liberar a mensagem.
    return {
      allowed: false,
      remaining: 0,
      limit: 25,
      used: 0,
      error: 'rate_limit_check_failed' as const,
    };
  }
}