import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getUserRole, isAdminRole } from '@/lib/supabase/serverAuth';

// CAP-PROD-003 — CORS restrito para o shell local do Capacitor (origem
// https://localhost). Aplica-se APENAS a /api/* quando o Origin está na
// allowlist — nunca `*`. Web same-origin continua intocada.
const CAPACITOR_ALLOWED_ORIGINS: readonly string[] = ['https://localhost'];
const CORS_ALLOW_METHODS = 'GET, POST, OPTIONS';
const CORS_ALLOW_HEADERS = 'Authorization, Content-Type';

function isAllowedCapacitorOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return CAPACITOR_ALLOWED_ORIGINS.includes(origin);
}

// =========================================================================
// PROXY DE PROTEÇÃO DE ROTAS (Next.js 16 - substitui o antigo middleware)
// Bloqueia o acesso a rotas privadas (/dashboard, /admin, /paciente)
// redirecionando usuários não autenticados para /login.
// Rotas /admin exigem role admin/nutricionista na tabela profiles.
// =========================================================================

export async function proxy(request: NextRequest) {
  const apiPathname = request.nextUrl.pathname;

  // CAP-PROD-003 — CORS restrito para APIs consumidas pelo frontend local.
  if (apiPathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (isAllowedCapacitorOrigin(origin)) {
      const headers = {
        'Access-Control-Allow-Origin': origin as string,
        Vary: 'Origin',
        'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
        'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
        'Access-Control-Max-Age': '86400',
      };
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, { status: 204, headers });
      }
      return NextResponse.next({ request, headers });
    }
    // Não é o Capacitor: comportamento web original (sem headers CORS).
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Valida o token da sessão no servidor (não confia apenas no cookie)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 🔒 Rotas de administração exigem role admin/nutricionista
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/admin')) {
    const role = await getUserRole(user.id);
    if (!isAdminRole(role)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Rotas privadas de PÁGINA + APIs (as APIs passam apenas pelo ramo CORS
  // restrito do Capacitor; nada de redirect/auth de página é aplicado a /api).
  matcher: ['/dashboard/:path*', '/admin/:path*', '/paciente/:path*', '/api/:path*'],
};
