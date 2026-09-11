// Safety Gate — F3.4
import { describe, it, expect } from 'vitest';
import { generateRecommendation, type RecommendationResult } from '../../lib/nutrition';

describe('Safety Gate — VCT → DietBuilder', () => {
  const base = { weight: 104, height: 180, tmb: 1895, get: 2274, avgActivity: 0, gender: 'masculino' as const };

  it('CASO 1 — VCT calculado 1780 < TMB 1895 → Safety Gate acionado, DietBuilder recebe protegido', () => {
    const rec: RecommendationResult = generateRecommendation({ ...base, get: 2225, bf: 23, leanMass: null });
    expect(rec.calculatedCalories).toBe(1780);
    expect(rec.safetyAdjustmentApplied).toBe(true);
    expect(rec.minCalories).toBe(1895);
    expect(rec.calories).toBe(1895);
    expect(rec.protectedCalories).toBe(1895);
    expect(rec.safetyReason).toContain('abaixo do limite');
    expect(rec.calories).not.toBe(1780);
  });

  it('CASO 2 — VCT acima do limite → sem alteração', () => {
    const rec: RecommendationResult = generateRecommendation({ ...base, get: 2274, bf: 18, leanMass: null, weightVelocity: -0.5 });
    expect(rec.safetyAdjustmentApplied).toBe(false);
    expect(rec.calculatedCalories).toBe(rec.calories);
    expect(rec.safetyReason).toBeNull();
  });

  it('CASO 3 — VCT exatamente no limite (1895)', () => {
    const rec: RecommendationResult = generateRecommendation({ weight: 104, height: 180, tmb: 1895, get: 1895, avgActivity: 0, gender: 'masculino', bf: 15 });
    expect(rec.calculatedCalories).toBe(1895);
    expect(rec.safetyAdjustmentApplied).toBe(false);
    expect(rec.calories).toBe(1895);
  });

  it('CASO 4 — Paciente ativo (avgActivity 200) — regra 95% removida, agora 100% TMB', () => {
    const recActive: RecommendationResult = generateRecommendation({ ...base, avgActivity: 200, get: 2274 + 200, bf: 30 });
    expect(recActive.minCalories).toBe(1895);
    expect(recActive.minCalories).not.toBe(Math.round(1895 * 0.95));
  });

  it('CASO 5 — Ajustes de tendência ainda funcionam com Safety Gate', () => {
    const recSlow: RecommendationResult = generateRecommendation({ ...base, bf: 25, weightVelocity: -0.1 });
    const recFast: RecommendationResult = generateRecommendation({ ...base, bf: 25, weightVelocity: -1.2 });
    expect(recSlow.calculatedCalories).toBeDefined();
    expect(recFast.calculatedCalories).toBeDefined();
    if (recSlow.safetyAdjustmentApplied) expect(recSlow.strategy).toContain('Proteção');
  });

  it('CASO 6 — recommendation.calories é o valor protegido usado pelo DietBuilder', () => {
    const rec: RecommendationResult = generateRecommendation({ ...base, get: 2225, bf: 23 });
    expect(rec.calories).toBe(rec.protectedCalories);
    expect(rec.calories).toBe(rec.minCalories);
  });

  it('CASO 7 — DietBuilder compatível: gera macros a partir de calories protegido', () => {
    const rec: RecommendationResult = generateRecommendation({ ...base, get: 2225, bf: 23 });
    expect(rec.macros.protein).toBeGreaterThan(0);
    expect(rec.macros.carbs).toBeGreaterThan(0);
    expect(rec.macros.fat).toBeGreaterThan(0);
    expect(rec).toHaveProperty('calories');
    expect(rec).toHaveProperty('goal');
  });
});