// VOZ-001-B — Split train/val/test sem vazamento
import { BENCHMARK_SAMPLES, type BenchmarkSample } from './benchmark';

export const SPLIT = {
  train: BENCHMARK_SAMPLES.slice(0, 28), // 0-27
  val: BENCHMARK_SAMPLES.slice(28, 36), // 28-35
  test: BENCHMARK_SAMPLES.slice(36), // 36-43 (8 amostras congeladas)
};

export function getSplit(): typeof SPLIT {
  return SPLIT;
}

// Validação: nenhuma frase groundTruth duplicada entre splits (evita vazamento)
export function validateNoLeak(): boolean {
  const all = [...SPLIT.train, ...SPLIT.val, ...SPLIT.test];
  const truths = all.map(s => s.groundTruth.toLowerCase().trim());
  const set = new Set(truths);
  if (set.size !== all.length) return false;
  const testIds = SPLIT.test.map(s => s.id).sort().join(',');
  const expected = FROZEN_TEST_IDS.slice().sort().join(',');
  return testIds === expected;
}

// Para fine-tuning, o teste deve ser congelado antes da avaliação final
export const FROZEN_TEST_IDS = ['H01','H02','H03','H04','I01','I02','I03','I04']; // 8 congelado
