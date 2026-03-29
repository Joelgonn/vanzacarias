// =========================================================================
// METABOLIC ENGINE (Single Source of Truth)
// =========================================================================

import { generateRecommendation } from '@/lib/nutrition';

interface MetabolicInput {
  weight: number;
  height: number;
  age: number;
  gender?: string;
  bf?: number | null;
  leanMass?: number | null;
  avgActivity: number;
  weightTrend?: 'losing' | 'gaining' | 'stable';
}

export interface MetabolicOutput {
  tmb: number;
  get: number;
  avgActivity: number;
  recommendation: ReturnType<typeof generateRecommendation>;
}

// =========================================================================
// FUNÇÃO PRINCIPAL
// =========================================================================

export default function calculateMetabolism({
  weight,
  height,
  age,
  gender = '',
  bf,
  leanMass,
  avgActivity,
  weightTrend = 'stable'
}: MetabolicInput): MetabolicOutput {

  console.log("🔍 [METABOLIC_ENGINE] leanMass recebido:", leanMass);
  console.log("🔍 [METABOLIC_ENGINE] bf recebido:", bf);

  // ✅ NORMALIZAÇÃO CENTRAL (NOVA - CRÍTICO)
  let normalizedHeight = height;
  if (normalizedHeight && normalizedHeight < 3) {
    normalizedHeight = normalizedHeight * 100;
  }

  const isFemale = ['f', 'feminino', 'female', 'mulher']
    .some(v => gender.toLowerCase().trim().startsWith(v));

  let tmb = 0;

  if (leanMass && leanMass > 0) {
    tmb = Math.round(370 + (21.6 * leanMass));
  } else {
    tmb = isFemale
      ? Math.round((10 * weight) + (6.25 * normalizedHeight) - (5 * age) - 161)
      : Math.round((10 * weight) + (6.25 * normalizedHeight) - (5 * age) + 5);
  }

  const get = Math.round((tmb * 1.2) + avgActivity);

  const recommendation = generateRecommendation({
    weight,
    height: normalizedHeight,
    bf,
    leanMass,
    tmb,
    get,
    avgActivity,
    gender,
    weightTrend
  });

  return {
    tmb,
    get,
    avgActivity,
    recommendation
  };
}