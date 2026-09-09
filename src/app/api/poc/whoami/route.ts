// CAP-PROD-003 — rota PoC: identidade autenticada (Bearer ou cookie).
// Somente leitura/verificação — não altera nenhum comportamento de produção.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/serverAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, id: user.id, email: user.email });
}
