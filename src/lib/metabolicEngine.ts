// =========================================================================
// METABOLIC ENGINE (compat layer → metabolicModel)
// Mantido como wrapper fino para não quebrar consumidores existentes.
// Toda a lógica real vive em @/lib/metabolicModel (SSOT — Sprint Z-001).
// =========================================================================

import { buildMetabolicSnapshot, type MetabolicSnapshotInput } from '@/lib/metabolicModel';
import { generateRecommendation } from '@/lib/nutrition';

export {
  normalizeHeight,
  calculateTMB,
  calculateGET,
  calculateAvgActivity,
  calculateWeightTrend,
  calculateWeightVelocity,
  buildMetabolicSnapshot,
} from '@/lib/metabolicModel';

export type { WeightTrend, MetabolicSnapshot, MetabolicSnapshotInput } from '@/lib/metabolicModel';

export interface MetabolicOutput {
  tmb: number;
  get: number;
  avgActivity: number;
  recommendation: ReturnType<typeof generateRecommendation>;
}

export default function calculateMetabolism(input: MetabolicSnapshotInput): MetabolicOutput {
  const snapshot = buildMetabolicSnapshot(input);
  return {
    tmb: snapshot.tmb,
    get: snapshot.get,
    avgActivity: snapshot.avgActivity,
    recommendation: snapshot.recommendation || (null as unknown as ReturnType<typeof generateRecommendation>),
  };
}
