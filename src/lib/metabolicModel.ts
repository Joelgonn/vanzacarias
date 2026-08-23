// =========================================================================
// METABOLIC MODEL — Single Source of Truth (Sprint Z-001)
// Unifica: normalização de altura, TMB, GET, média de atividade, tendência,
// velocity de peso e recomendação em um único snapshot.
//
// REGRA DE OURO: os valores de TMB/GET para o mesmo input são IMUTÁVEIS.
// Qualquer mudança numérica aqui deve ser acompanhada de teste de paridade.
// =========================================================================

import { generateRecommendation, type RecommendationResult } from '@/lib/nutrition';

// -------------------------------------------------------------------------
// TIPOS PÚBLICOS
// -------------------------------------------------------------------------

export type WeightTrend = 'losing' | 'gaining' | 'stable';

export interface MetabolicSnapshotInput {
  weight: number | null;
  height: number | null;
  age: number | null;
  gender?: string;
  bf?: number | null;
  leanMass?: number | null;
  avgActivity: number;
  weightTrend?: WeightTrend;
  weightVelocity?: number | null;
}

export interface MetabolicSnapshot {
  weight: number | null;
  height: number | null;
  age: number | null;
  gender: string;
  bf: number | null;
  leanMass: number | null;
  avgActivity: number;
  weightTrend: WeightTrend;
  weightVelocity: number | null;
  tmb: number;
  tmbMethod: 'Katch-McArdle' | 'Mifflin-St Jeor';
  get: number;
  recommendation: RecommendationResult | null;
  sourceMetadata: {
    weightSource?: string;
    heightSource?: string;
    bfSource?: string;
    lastWeightDate?: string | null;
    activityLogsUsed: number;
  };
}

export interface ActivityLogLike {
  activity_kcal?: number | null;
}

export interface CheckinLike {
  peso: number | null;
  created_at: string;
}

// -------------------------------------------------------------------------
// FUNÇÕES PURAS
// -------------------------------------------------------------------------

/** Altura: aceita metros (1.78) ou centímetros (178) e normaliza para cm. */
export function normalizeHeight(height: number | null): number | null {
  if (!height) return null;
  return height < 3 ? height * 100 : height;
}

/** TMB — Katch-McArdle quando há massa magra; Mifflin-St Jeor como fallback. */
export function calculateTMB(input: {
  weight: number | null;
  height: number | null;
  age: number | null;
  gender?: string;
  leanMass?: number | null;
}): { tmb: number; method: 'Katch-McArdle' | 'Mifflin-St Jeor' } {
  const { weight, height, age, gender, leanMass } = input;

  if (!weight || !height || !age) {
    return { tmb: 0, method: 'Mifflin-St Jeor' };
  }

  const normalizedHeight = normalizeHeight(height)!;

  if (leanMass && leanMass > 0) {
    return { tmb: Math.round(370 + (21.6 * leanMass)), method: 'Katch-McArdle' };
  }

  const g = (gender || '').toLowerCase().trim();
  const isFemale = ['f', 'feminino', 'female', 'mulher'].some(v => g.startsWith(v));

  const tmb = isFemale
    ? Math.round((10 * weight) + (6.25 * normalizedHeight) - (5 * age) - 161)
    : Math.round((10 * weight) + (6.25 * normalizedHeight) - (5 * age) + 5);

  return { tmb, method: 'Mifflin-St Jeor' };
}

/** GET estimado = TMB * 1.2 (fator basal sedentário/leve) + atividade média. */
export function calculateGET(tmb: number, avgActivity: number): number {
  return Math.round((tmb * 1.2) + avgActivity);
}

/** Média de atividade: divide pela QUANTIDADE REAL de logs (não por 7 fixo). */
export function calculateAvgActivity(logs: ActivityLogLike[]): number {
  if (!logs || logs.length === 0) return 0;
  const total = logs.reduce((acc, log) => acc + (Number(log.activity_kcal) || 0), 0);
  return Math.round(total / logs.length);
}

/** Tendência pelos últimos 2 check-ins (limiar 0.5 kg). */
export function calculateWeightTrend(weights: Array<number | null>): WeightTrend {
  const recent = weights.filter((w): w is number => typeof w === 'number' && !isNaN(w));
  if (recent.length < 2) return 'stable';

  const w1 = recent[recent.length - 1];
  const w2 = recent[recent.length - 2];
  const diff = w1 - w2;

  if (diff <= -0.5) return 'losing';
  if (diff >= 0.5) return 'gaining';
  return 'stable';
}

/** Velocidade de peso em kg/semana (últimos ~5 check-ins, janela temporal real). */
export function calculateWeightVelocity(checkins: CheckinLike[]): number | null {
  if (!checkins || checkins.length < 2) return null;

  const sorted = [...checkins].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const recent = sorted.slice(-5);
  if (recent.length < 2) return null;

  const firstDate = new Date(recent[0].created_at).getTime();
  const lastDate = new Date(recent[recent.length - 1].created_at).getTime();
  const days = (lastDate - firstDate) / (1000 * 3600 * 24);

  if (days <= 0) return null;

  const weightDiff = (recent[recent.length - 1].peso || 0) - (recent[0].peso || 0);
  return Math.round(((weightDiff / days) * 7) * 100) / 100; // kg/semana
}

// -------------------------------------------------------------------------
// SNAPSHOT ÚNICO (SSOT)
// -------------------------------------------------------------------------

export function buildMetabolicSnapshot(input: MetabolicSnapshotInput): MetabolicSnapshot {
  const { weight, height, age, gender, bf, leanMass, avgActivity, weightTrend, weightVelocity } = input;

  const { tmb, method: tmbMethod } = calculateTMB({ weight, height, age, gender, leanMass });
  const get = calculateGET(tmb, avgActivity);

  const recommendation = weight && height && age !== null
    ? generateRecommendation({
        weight,
        height: normalizeHeight(height) || height,
        bf,
        leanMass,
        tmb,
        get,
        avgActivity,
        gender,
        weightTrend,
        weightVelocity
      })
    : null;

  return {
    weight,
    height,
    age,
    gender: gender || '',
    bf: bf || null,
    leanMass: leanMass || null,
    avgActivity,
    weightTrend: weightTrend || 'stable',
    weightVelocity: weightVelocity ?? null,
    tmb,
    tmbMethod,
    get,
    recommendation,
    sourceMetadata: {
      activityLogsUsed: 0, // preenchido pelo chamador quando souber a contagem
    }
  };
}
