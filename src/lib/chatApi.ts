// CAP-PROD-003 — transporte centralizado do Chat (frontend local → backend).
// WEB: mesma origem (sem token; cookie/SSR como hoje).
// CAPACITOR: URL remota + Authorization: Bearer <access_token> do Supabase.
import { createClient } from '@/lib/supabase/client';
import { apiUrl, isCrossOriginApi } from './apiBase';

export async function chatApiFetch(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (isCrossOriginApi()) {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}
