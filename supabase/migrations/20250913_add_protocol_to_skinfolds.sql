-- F3.1 — persistência canônica do protocolo por medição
-- Tabela: public.skinfolds
-- Valores válidos: jp3, jp7, petroski4 — NULL preserva histórico pré-F3.1

alter table public.skinfolds
  add column if not exists protocol text;

-- Constraint permite NULL (histórico) e rejeita strings arbitrárias
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'skinfolds_protocol_check'
  ) then
    alter table public.skinfolds
      add constraint skinfolds_protocol_check
      check (protocol is null or protocol in ('jp3','jp7','petroski4'));
  end if;
end $$;

comment on column public.skinfolds.protocol is 'F3.1 protocolo oficial por medicao (jp3/jp7/petroski4), NULL para historico pre-F3.1 — ver docs/body-composition/';

create index if not exists idx_skinfolds_protocol on public.skinfolds(protocol);
create index if not exists idx_skinfolds_user_protocol_date on public.skinfolds(user_id, protocol, measurement_date desc);
