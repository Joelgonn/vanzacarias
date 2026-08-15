import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// =========================================================================
// PROXY DE PROTEÇÃO DE ROTAS (Next.js 16 - substitui o antigo middleware)
// Bloqueia o acesso a rotas privadas (/dashboard, /admin, /paciente)
// redirecionando usuários não autenticados para /login.
// =========================================================================

export async function proxy(request: NextRequest) {
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

  return response;
}

export const config = {
  // Apenas rotas privadas passam pelo proxy; estáticos (_next) são ignorados pelo Next
  matcher: ['/dashboard/:path*', '/admin/:path*', '/paciente/:path*'],
};
