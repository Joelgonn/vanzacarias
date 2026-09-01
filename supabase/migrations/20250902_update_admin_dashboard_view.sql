-- VZ-022 Gate D — adicionar 3 campos P1 ao admin_dashboard (preserva tudo)
-- Executar via Supabase Dashboard > SQL Editor
-- Ordem exata 23 colunas originais preservadas, 3 novas ao final (24-26)

CREATE OR REPLACE VIEW public.admin_dashboard AS
SELECT
  p.id,
  p.full_name,
  p.phone,
  p.created_at,
  p.data_nascimento,
  p.sexo,
  p.tipo_perfil,
  p.meta_peso,
  p.account_type,
  p.food_restrictions,
  p.meal_plan,
  (SELECT answers
   FROM evaluations
   WHERE user_id = p.id
   ORDER BY created_at DESC
   LIMIT 1) AS evaluation_answers,

  c.last_checkin_at,
  c.peso,
  c.altura,
  a.weight,
  a.height,

  d.water_ml,
  d.mood,
  0::int AS messages_today,

  c.is_late,
  c.days_since_last,

  (p.created_at > now() - '7 days'::interval) AS is_new,

  c.adesao_ao_plano AS last_adesao,
  c.humor_semanal AS last_humor,
  c.comentarios AS last_comentarios

FROM profiles p

LEFT JOIN LATERAL (
  SELECT
    created_at AS last_checkin_at,
    peso,
    altura,
    adesao_ao_plano,
    humor_semanal,
    comentarios,
    (now() - created_at > '7 days'::interval) AS is_late,
    EXTRACT(day FROM now() - created_at)::int AS days_since_last
  FROM checkins
  WHERE user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) c ON true

LEFT JOIN LATERAL (
  SELECT
    weight,
    height
  FROM anthropometry
  WHERE user_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) a ON true

LEFT JOIN LATERAL (
  SELECT
    water_ml,
    mood
  FROM daily_logs
  WHERE user_id = p.id
    AND date = CURRENT_DATE
  LIMIT 1
) d ON true;
