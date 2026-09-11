-- F3.4 — body_compositions: resultado auditável da composição corporal
-- skinfolds = coleta, body_compositions = cálculo, bodyComposition.ts = fórmula

create table if not exists public.body_compositions (
  id uuid primary key default gen_random_uuid(),
  skinfold_id uuid not null references public.skinfolds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_date date not null,
  protocol text not null check (protocol in ('jp3','jp7','petroski4')),
  protocol_version text not null,
  method text not null check (method in ('siri','brozek')),
  sum double precision,
  density double precision,
  bf double precision,
  fat_mass double precision,
  lean_mass double precision,
  calculated_at timestamptz not null default now(),
  is_official boolean not null default true,
  created_by uuid references auth.users(id) on delete set null
);

-- Índices para histórico, auditoria e oficialidade
create index if not exists idx_body_compositions_skinfold on public.body_compositions(skinfold_id);
create index if not exists idx_body_compositions_user_date on public.body_compositions(user_id, measurement_date desc);
create index if not exists idx_body_compositions_protocol on public.body_compositions(protocol);
create index if not exists idx_body_compositions_official on public.body_compositions(skinfold_id, is_official) where is_official = true;
create index if not exists idx_body_compositions_user_protocol on public.body_compositions(user_id, protocol);

-- Unicidade: no máximo um oficial ativo por medição
create unique index if not exists uq_body_compositions_official_per_skinfold
  on public.body_compositions(skinfold_id) where is_official = true;

comment on table public.body_compositions is 'F3.4 — skinfolds=COLETA, body_compositions=CALCULADO, bodyComposition.ts=FORMULA. Sem backfill, sem trigger.';
comment on column public.body_compositions.protocol is 'jp3/jp7/petroski4 — copiado de skinfolds.protocol no momento do cálculo';
comment on column public.body_compositions.protocol_version is 'Versão dos coeficientes, ex: 2026-09-11';
comment on column public.body_compositions.method is 'siri (default) ou brozek';
comment on column public.body_compositions.is_official is 'true = resultado oficial atual da medição; false = histórico/simulação persistida';

-- RLS — espelha skinfolds: usuário acessa próprias composições; admin/nutricionista acessa todas via profiles.role
alter table public.body_compositions enable row level security;

drop policy if exists "Users can view own body_compositions" on public.body_compositions;
create policy "Users can view own body_compositions"
  on public.body_compositions for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin','nutricionista'))
  );

drop policy if exists "Users can insert body_compositions" on public.body_compositions;
create policy "Users can insert body_compositions"
  on public.body_compositions for insert
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin','nutricionista'))
  );

drop policy if exists "Users can update body_compositions" on public.body_compositions;
create policy "Users can update body_compositions"
  on public.body_compositions for update
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin','nutricionista'))
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin','nutricionista'))
  );

drop policy if exists "Users can delete body_compositions" on public.body_compositions;
create policy "Users can delete body_compositions"
  on public.body_compositions for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin','nutricionista'))
  );
