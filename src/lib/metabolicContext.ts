import { createClient } from '@/lib/supabase/client';

export interface MetabolicContext {
  currentWeight: number | null;
  baselineWeight: number | null;
  weightTrend: 'losing' | 'gaining' | 'stable';
  weightVelocity: number | null;
  avgActivity: number;
  adherenceScore: number; // 0–1
  lastCheckinDate: string | null;
}

export async function buildMetabolicContext(patientId: string): Promise<MetabolicContext> {
  const supabase = createClient();

  // =========================================================================
  // 1. CHECK-INS (PESO)
  // =========================================================================
  const { data: checkins } = await supabase
    .from('checkins')
    .select('peso, created_at, adesao_ao_plano')
    .eq('user_id', patientId)
    .order('created_at', { ascending: true });

  let currentWeight: number | null = null;
  let baselineWeight: number | null = null;
  let weightTrend: 'losing' | 'gaining' | 'stable' = 'stable';
  let weightVelocity: number | null = null;
  let lastCheckinDate: string | null = null;

  if (checkins && checkins.length > 0) {
    const last = checkins[checkins.length - 1];
    currentWeight = last.peso;
    lastCheckinDate = last.created_at;

    // BASELINE = média dos primeiros 3
    const first = checkins.slice(0, 3);
    baselineWeight =
      first.reduce((acc, c) => acc + c.peso, 0) / first.length;

    // TREND (últimos 2)
    if (checkins.length >= 2) {
      const w1 = checkins[checkins.length - 1].peso;
      const w2 = checkins[checkins.length - 2].peso;
      const diff = w1 - w2;

      if (diff <= -0.3) weightTrend = 'losing';
      else if (diff >= 0.3) weightTrend = 'gaining';
    }

    // VELOCIDADE (últimos ~14 dias)
    const recent = checkins.slice(-5);

    if (recent.length >= 2) {
      const firstDate = new Date(recent[0].created_at).getTime();
      const lastDate = new Date(recent[recent.length - 1].created_at).getTime();

      const days = (lastDate - firstDate) / (1000 * 3600 * 24);

      if (days > 0) {
        const weightDiff = recent[recent.length - 1].peso - recent[0].peso;
        weightVelocity = (weightDiff / days) * 7; // kg/semana
      }
    }
  }

  // =========================================================================
  // 2. ATIVIDADE (7 dias)
  // =========================================================================
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('activity_kcal')
    .eq('user_id', patientId)
    .order('date', { ascending: false })
    .limit(7);

  let avgActivity = 0;

  if (logs && logs.length > 0) {
    const total = logs.reduce((acc, l) => acc + (l.activity_kcal || 0), 0);
    avgActivity = Math.round(total / logs.length);
  }

  // =========================================================================
  // 3. ADERÊNCIA (COMPORTAMENTO)
  // =========================================================================
  let adherenceScore = 0;

  if (checkins && checkins.length > 0) {
    const recent = checkins.slice(-5);

    const valid = recent.filter(c => c.adesao_ao_plano !== null);

    if (valid.length > 0) {
      const avg = valid.reduce((acc, c) => acc + c.adesao_ao_plano, 0) / valid.length;
      adherenceScore = avg / 5; // normaliza 0–1
    }
  }

  return {
    currentWeight,
    baselineWeight,
    weightTrend,
    weightVelocity,
    avgActivity,
    adherenceScore,
    lastCheckinDate
  };
}