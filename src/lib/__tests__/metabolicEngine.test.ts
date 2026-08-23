// =========================================================================
// Unit tests — Metabolic Model (SSOT — Sprint Z-001)
// Paridade numérica validada na auditoria:
//   - Homem 75kg/178cm/25a (Mifflin): 1743 kcal
//   - Mulher 60kg/165cm/25a (Mifflin): 1345 kcal
//   - leanMass 69kg (Katch-McArdle): 1860 kcal
// Run: npx vitest run
// =========================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateTMB,
  calculateGET,
  calculateAvgActivity,
  calculateWeightTrend,
  calculateWeightVelocity,
  normalizeHeight,
  buildMetabolicSnapshot,
} from '../../../src/lib/metabolicModel';

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const MALE_INPUT = {
  weight: 75,
  height: 178,
  age: 25,
  gender: 'masculino',
};

const FEMALE_INPUT = {
  weight: 60,
  height: 165,
  age: 25,
  gender: 'feminino',
};

// --------------------------------------------------------------------------
// 1. TMB — Mifflin-St Jeor (paridade da auditoria)
// --------------------------------------------------------------------------

describe('TMB — Mifflin-St Jeor', () => {
  it('homem 75kg/178cm/25a → 1743 kcal', () => {
    const { tmb, method } = calculateTMB(MALE_INPUT);
    expect(tmb).toBe(1743);
    expect(method).toBe('Mifflin-St Jeor');
  });

  it('mulher 60kg/165cm/25a → 1345 kcal', () => {
    const { tmb, method } = calculateTMB(FEMALE_INPUT);
    expect(tmb).toBe(1345);
    expect(method).toBe('Mifflin-St Jeor');
  });
});

// --------------------------------------------------------------------------
// 2. TMB — Katch-McArdle (paridade da auditoria)
// --------------------------------------------------------------------------

describe('TMB — Katch-McArdle', () => {
  it('leanMass=69 → 1860 kcal', () => {
    const { tmb, method } = calculateTMB({ ...MALE_INPUT, leanMass: 69 });
    expect(tmb).toBe(1860);
    expect(method).toBe('Katch-McArdle');
  });

  it('prioriza Katch-McArdle quando leanMass > 0 (ignora sexo/idade)', () => {
    const male = calculateTMB({ ...MALE_INPUT, leanMass: 69 });
    const female = calculateTMB({ ...FEMALE_INPUT, leanMass: 69 });
    expect(male.tmb).toBe(female.tmb);
  });
});

// --------------------------------------------------------------------------
// 3. GET — estimado (TMB × 1.2 + atividade média)
// --------------------------------------------------------------------------

describe('GET — Gasto Energético Total (estimado)', () => {
  it('TMB 1743 + atividade 200 → 2292 kcal', () => {
    // 1743 * 1.2 = 2091.6 → 2092 (arredondado) + 200 = 2292
    const get = calculateGET(1743, 200);
    expect(get).toBe(2292);
    expect(get).toBeGreaterThanOrEqual(1743); // nunca < TMB
  });

  it('sem atividade → 1.2 × TMB', () => {
    expect(calculateGET(1743, 0)).toBe(2092);
  });
});

// --------------------------------------------------------------------------
// 4. Média de atividade (divisão pela quantidade REAL de logs)
// --------------------------------------------------------------------------

describe('Média de atividade', () => {
  it('3 logs: 100/120/80 → 100 kcal/dia (não /7)', () => {
    const avg = calculateAvgActivity([
      { activity_kcal: 100 },
      { activity_kcal: 120 },
      { activity_kcal: 80 },
    ]);
    expect(avg).toBe(100); // (100+120+80)/3 = 100 — corrige a subestimativa de /7
  });

  it('7 logs com gaps → divide pela quantidade real', () => {
    const avg = calculateAvgActivity([
      { activity_kcal: 200 },
      { activity_kcal: 200 },
      { activity_kcal: 200 },
      { activity_kcal: 200 },
    ]);
    expect(avg).toBe(200);
  });

  it('sem logs → 0', () => {
    expect(calculateAvgActivity([])).toBe(0);
  });
});

// --------------------------------------------------------------------------
// 5. Tendência de peso (últimos 2 check-ins, limiar 0.5 kg)
// --------------------------------------------------------------------------

describe('Tendência de peso', () => {
  it('perda ≥ 0.5 kg → losing', () => {
    expect(calculateWeightTrend([80, 79.4])).toBe('losing');
  });

  it('ganho ≥ 0.5 kg → gaining', () => {
    expect(calculateWeightTrend([79, 79.8])).toBe('gaining');
  });

  it('variação < 0.5 kg → stable', () => {
    expect(calculateWeightTrend([80, 79.8])).toBe('stable');
  });

  it('menos de 2 check-ins → stable', () => {
    expect(calculateWeightTrend([80])).toBe('stable');
  });
});

// --------------------------------------------------------------------------
// 6. Velocidade de peso (kg/semana)
// --------------------------------------------------------------------------

describe('Velocidade de peso', () => {
  it('perdeu 0.5 kg em 7 dias → ≈ -0.5 kg/semana', () => {
    const v = calculateWeightVelocity([
      { peso: 80, created_at: '2025-01-01T00:00:00Z' },
      { peso: 79.5, created_at: '2025-01-08T00:00:00Z' },
    ]);
    expect(v).toBeCloseTo(-0.5, 1);
  });

  it('menos de 2 check-ins → null', () => {
    expect(calculateWeightVelocity([{ peso: 80, created_at: '2025-01-01T00:00:00Z' }])).toBeNull();
  });

  it('ordena por data (não depende da ordem de chegada)', () => {
    const v = calculateWeightVelocity([
      { peso: 79.5, created_at: '2025-01-08T00:00:00Z' },
      { peso: 80, created_at: '2025-01-01T00:00:00Z' },
    ]);
    expect(v).toBeCloseTo(-0.5, 1);
  });
});

// --------------------------------------------------------------------------
// 7. Normalização de altura (m → cm)
// --------------------------------------------------------------------------

describe('Normalização de altura', () => {
  it('1.78 m → 178 cm', () => {
    expect(normalizeHeight(1.78)).toBe(178);
  });

  it('178 cm → 178 cm (intacto)', () => {
    expect(normalizeHeight(178)).toBe(178);
  });

  it('null → null', () => {
    expect(normalizeHeight(null)).toBeNull();
  });
});

// --------------------------------------------------------------------------
// 8. Snapshot completo (SSOT)
// --------------------------------------------------------------------------

describe('buildMetabolicSnapshot', () => {
  it('retorna tmb, tmbMethod, get e recommendation coerentes', () => {
    const snap = buildMetabolicSnapshot({
      weight: 75,
      height: 178,
      age: 25,
      gender: 'masculino',
      avgActivity: 200,
    });

    expect(snap.tmb).toBe(1743);
    expect(snap.tmbMethod).toBe('Mifflin-St Jeor');
    expect(snap.get).toBe(2292);
    expect(snap.get).toBeGreaterThanOrEqual(snap.tmb);
    expect(snap.recommendation).not.toBeNull();
    expect(snap.recommendation!.calories).toBeGreaterThan(0);
    expect(snap.recommendation!.macros.protein).toBeGreaterThan(0);
    expect(snap.weightTrend).toBe('stable');
    expect(snap.weightVelocity).toBeNull();
  });

  it('dados insuficientes → recommendation null e tmb 0', () => {
    const snap = buildMetabolicSnapshot({
      weight: null,
      height: null,
      age: null,
      avgActivity: 0,
    });
    expect(snap.tmb).toBe(0);
    expect(snap.recommendation).toBeNull();
  });

  it('aceita weightVelocity e weightTrend na entrada', () => {
    const snap = buildMetabolicSnapshot({
      weight: 75,
      height: 178,
      age: 25,
      gender: 'masculino',
      avgActivity: 200,
      weightTrend: 'losing',
      weightVelocity: -0.8,
    });
    expect(snap.weightTrend).toBe('losing');
    expect(snap.weightVelocity).toBe(-0.8);
  });
});
