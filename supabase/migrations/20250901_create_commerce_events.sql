-- VZ-019 Fase C — commerce_events (observabilidade comercial)
-- Tabela minimal, sem conteúdo clínico, falha não quebra produto

create table if not exists public.commerce_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null check (event in (
    'premium_viewed',
    'premium_cta_clicked',
    'checkout_started',
    'checkout_completed',
    'upgrade_success',
    'chatbot_message',
    'focus_viewed',
    'recovery_viewed'
  )),
  is_premium boolean,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_commerce_events_user_event on public.commerce_events(user_id, event);
create index if not exists idx_commerce_events_created on public.commerce_events(created_at desc);
create index if not exists idx_commerce_events_event on public.commerce_events(event);

-- RLS: apenas service_role pode inserir/ler; nenhum SELECT público (isolamento por user_id via service_role)
alter table public.commerce_events enable row level security;

drop policy if exists "service_role_all" on public.commerce_events;
create policy "service_role_all" on public.commerce_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Nota: trackCommerceEvent usa service_role, portanto passa na policy acima.
-- Leitura pública é bloqueada; dashboard nunca lê esta tabela diretamente.
-- Auditoria: metadata nunca deve conter prompt, answer, message, plan, image, memory, RAG
comment on table public.commerce_events is 'VZ-018/019 — observabilidade comercial, sem conteúdo clínico';
