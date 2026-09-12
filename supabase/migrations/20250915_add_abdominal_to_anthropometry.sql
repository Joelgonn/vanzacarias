-- SPRINT: Adicionar circunferência abdominal — independente de waist e forearm
-- Não renomear, remover ou substituir campos existentes. Nullable, sem backfill, sem default.

-- Auditoria confirmou que todas as demais medidas antropométricas usam numeric — abdominal segue o mesmo tipo
alter table public.anthropometry
  add column if not exists abdominal numeric null;

comment on column public.anthropometry.abdominal is 'Circunferência abdominal — perímetro abdominal no ponto anatômico definido pelo protocolo clínico da nutricionista. Independente de waist (cintura) e forearm (antebraço). Coletada com 3 leituras e média. Nullable para compatibilidade com registros antigos.';

-- Índice opcional para consultas por data (se já existir, ignora)
-- create index if not exists idx_anthropometry_abdominal on public.anthropometry(abdominal) where abdominal is not null;
