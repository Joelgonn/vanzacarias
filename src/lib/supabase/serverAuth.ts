import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// =========================================================================
// AUTH SERVER-SIDE PARA API ROUTES (Next.js App Router)
// Valida a sessão via cookie (same-origin fetch) e NUNCA confia no userId
// enviado pelo cliente. Previne ataques IDOR.
//
// CAP-PROD-003 — frontend local (Capacitor, origem https://localhost):
//   aceita também `Authorization: Bearer <access_token>` (validado pelo
//   Supabase). O cookie continua sendo o caminho da web; o Bearer é o caminho
//   do shell local. Autorização/roles permanecem centralizadas aqui.
// =========================================================================

export const ADMIN_ROLES = ['admin', 'nutricionista'];

export type AuthOk = { user: User; error: null };
export type AuthFail = { user: null; error: NextResponse };
export type AuthResult = AuthOk | AuthFail;

/** Extrai um token Bearer do header de Authorization (função pura, testável). */
export function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match ? match[1]!.trim() : null;
}

/** Resolve o usuário autenticado: Bearer (Capacitor) OU cookie (web). */
export async function getAuthenticatedUser(request: NextRequest) {
  // Caminho Capacitor: Authorization: Bearer <access_token> (validado pelo Supabase)
  const bearer = getBearerToken(request.headers.get('authorization'));
  if (bearer) {
    const supabase = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearer);
    if (!error && user) return user;
    return null;
  }

  // Caminho web: cookie de sessão (same-origin)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // API routes são read-only: não renovamos/gravamos cookies aqui
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

// Retorna o usuário autenticado ou uma resposta 401
export async function requireUser(request: NextRequest): Promise<AuthResult> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Não autorizado. Faça login para continuar.' },
        { status: 401 }
      ),
    };
  }
  return { user, error: null };
}

// Busca o role do usuário na tabela profiles (fonte de verdade)
export async function getUserRole(userId: string): Promise<string | null> {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return data?.role ?? null;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

// Retorna o usuário autenticado com role admin/nutricionista ou 401/403
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const { user, error } = await requireUser(request);
  if (error || !user) return { user: null, error };

  const role = await getUserRole(user.id);
  if (!isAdminRole(role)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Acesso restrito a administradores.' },
        { status: 403 }
      ),
    };
  }

  return { user, error: null };
}
