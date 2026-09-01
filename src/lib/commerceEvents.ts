import { createClient } from '@supabase/supabase-js';

// Métricas comerciais VZ-018 — minimal, sem conteúdo clínico
// Tabela sugerida (criar no Supabase se não existir):
// create table commerce_events (id uuid primary key default gen_random_uuid(), user_id uuid, event text, created_at timestamptz default now(), metadata jsonb, is_premium boolean);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type CommerceEvent =
  | 'premium_viewed'
  | 'premium_cta_clicked'
  | 'checkout_started'
  | 'checkout_completed'
  | 'upgrade_success'
  | 'chatbot_message'
  | 'focus_viewed'
  | 'recovery_viewed';

export async function trackCommerceEvent(
  userId: string | null,
  event: CommerceEvent,
  metadata: Record<string, unknown> = {},
  isPremium?: boolean
): Promise<void> {
  // Nunca registrar conteúdo clínico: metadata deve conter apenas tipo, timestamp, estado Free/Premium
  const safeMetadata: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (typeof v === 'string' && v.length > 200) continue; // evita texto longo clínico
    if (k.includes('message') || k.includes('prompt') || k.includes('answer') || k.includes('plan') || k.includes('image')) continue;
    safeMetadata[k] = v;
  }

  const payload = {
    user_id: userId,
    event,
    metadata: safeMetadata,
    is_premium: isPremium ?? null,
  };

  // Log observável em dev/prod sem PII clínica
  if (process.env.NODE_ENV === 'development') {
    console.log('[COMMERCE]', event, payload);
  }

  try {
    await supabaseAdmin.from('commerce_events').insert({
      user_id: userId,
      event,
      metadata: safeMetadata,
      is_premium: isPremium ?? null,
    });
  } catch (e) {
    // Tabela pode não existir ainda — não quebra fluxo comercial
    if (process.env.NODE_ENV === 'development') {
      console.warn('[COMMERCE] insert falhou (tabela pode não existir)', e);
    }
  }
}
