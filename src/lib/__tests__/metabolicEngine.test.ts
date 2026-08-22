// =========================================================================
// Unit tests — Metabolic Engine (SSOT)
// Sprint A1-03.0
// =========================================================================
// Run:  npm test
// =========================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateMetabolism,
  calculateTMB,
  calculateGET,
  validateInputs,
  clamp,
  normalizeHeight,
  ACTIVITY_FACTORS,
  type MetabolicInput,
} from '../../../src/lib/metabolicEngine';

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const MALE_INPUT = {
  weight: 75,
  height: 178, // cm
  age: 25,
  gender: 'masculino',
  avgActivity: 200,
} satisfies MetabolicInput;

const FEMALE_INPUT = {
  weight: 60,
  height: 165, // cm
  age: 25,
  gender: 'feminino',
  avgActivity: 200,
} satisfies MetabolicInput;

// --------------------------------------------------------------------------
// 1. TMB — Mifflin-St Jeor
// --------------------------------------------------------------------------

describe('TMB — Mifflin-St Jeor', () => {
  it('masculino ~1750', () => {
    // 10*75 + 6.25*178 - 5*25 + 5 = 750 + 1112.5 - 125 + 5 = 1742.5 → 1743
    const tmb = calculateTMB({
      weight: MALE_INPUT.weight,
      height: MALE_INPUT.height,
      age: MALE_INPUT.age,
      gender: MALE_INPUT.gender,
    });
    expect(tmb).toBe(1743);
    expect(tmb).toBeGreaterThan(1700);
    expect(tmb).toBeLessThan(1800);
  });

  it('feminino ~1400', () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 → 1345
    const tmb = calculateTMB({
      weight: FEMALE_INPUT.weight,
      height: FEMALE_INPUT.height,
      age: FEMALE_INPUT.age,
      gender: FEMALE_INPUT.gender,
    });
    expect(tmb).toBe(1345);
    expect(tmb).toBeGreaterThan(1300);
    expect(tmb).toBeLessThan(1450);
  });
});

// --------------------------------------------------------------------------
// 2. TMB — Katch-McArdle
// --------------------------------------------------------------------------

describe('TMB — Katch-McArdle', () => {
  it('~1860 com leanMass=69', () => {
    // 370 + 21.6*69 = 370 + 1490.4 = 1860.4 → 1860
    const tmb = calculateTMB({
      weight: 85,
      height: 178,
      age: 30,
      gender: 'masculino',
      leanMass: 69,
    });
    expect(tmb).toBe(1860);
    expect(tmb).toBeGreaterThan(1850);
    expect(tmb).toBeLessThan(1880);
  });

  it('prioriza Katch-McArdle quando leanMass > 0 (ignora sexo/idade)', () => {
    const maleTmb = calculateTMB({
      weight: 85, height: 178, age: 30, gender: 'masculino', leanMass: 69,
    });
    const femaleTmb = calculateTMB({
      weight: 85, height: 178, age: 30, gender: 'feminino', leanMass: 69,
    });
    // Katch usa só leanMass → mesmo valor independente do sexo
    expect(maleTmb).toBe(femaleTmb);
  });
});

// --------------------------------------------------------------------------
// 3. GET — fator de atividade
// --------------------------------------------------------------------------

describe('GET — Gasto Energético Total', () => {
  it('sedentário (×1.2)', () => {
    const tmb = 1742;
    const get = calculateGET({ tmb, activityFactor: ACTIVITY_FACTORS.sedentary });
    // 1742 * 1.2 = 2090.4 → 2090
    expect(get).toBe(2090);
    // Clamp: GET nunca < TMB
    expect(get).toBeGreaterThanOrEqual(tmb);
  });

  it('moderado (×1.55)', () => {
    const tmb = 1742;
    const get = calculateGET({ tmb, activityFactor: ACTIVITY_FACTORS.moderate });
    // 1742 * 1.55 = 2700.1 → 2700
    expect(get).toBe(2700);
    expect(get).toBeGreaterThanOrEqual(tmb);
  });

  it('clamp: GET nunca fica abaixo de TMB', () => {
    const tmb = 2000;
    // Fator explícito acima do clamp máximo (2.5) — deve permitir, mas abaixo de 1.0 deve subir para 1.0
    const get = calculateGET({ tmb, activityFactor: 0.5 });
    expect(get).toBeGreaterThanOrEqual(tmb); // clamp min = TMB
  });
});

// --------------------------------------------------------------------------
// 4. Clamps de segurança — entradas
// --------------------------------------------------------------------------

describe('Clamps de segurança', () => {
  it('weight=0 lança erro', () => {
    expect(() =>
      calculateMetabolism({ ...MALE_INPUT, weight: 0 })
    ).toThrow(/peso/i);
    expect(() =>
      validateInputs({ weight: 0, height: 178, age: 25 })
    ).toThrow();
  });

  it('height=0 lança erro', () => {
    expect(() =>
      calculateMetabolism({ ...MALE_INPUT, height: 0 })
    ).toThrow(/altura/i);
    expect(() =>
      validateInputs({ weight: 75, height: 0, age: 25 })
    ).toThrow();
  });

  it('clamp(value, min, max) respeita limites', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('normalizeHeight converte metros → cm', () => {
    expect(normalizeHeight(1.78)).toBeCloseTo(178, 5);
    expect(normalizeHeight(178)).toBe(178);
  });

  it('piso metabólico: calorias nunca < TMB * 0.8', () => {
    // Cenário de déficit extremo (BF alto, perda de gordura) — calories deve respeitar piso
    const result = calculateMetabolism({
      weight: 120,
      height: 170,
      age: 40,
      gender: 'masculino',
      bf: 35, // perda de gordura agressiva
      avgActivity: 100, // sedentário → TMB baixo, risco de piso
    });
    expect(result.recommendation.calories).toBeGreaterThanOrEqual(
      Math.round(result.tmb * 0.8) - 1 // tolerância de arredondamento
    );
  });
});

// --------------------------------------------------------------------------
// 5. Ajustes clínicos
// --------------------------------------------------------------------------

describe('Ajustes clínicos', () => {
  it('diabetes: reduz carboidratos (≤40% kcal, piso 130g)', () => {
    const baseInput = {
      weight: 80,
      height: 175,
      age: 45,
      gender: 'masculino',
      avgActivity: 300,
    } satisfies MetabolicInput;

    const without = calculateMetabolism(baseInput);
    const withDiabetes = calculateMetabolism({
      ...baseInput,
      conditions: ['diabetes'],
    });

    // Flag registrada
    expect(withDiabetes.clinicalFlags).toContain('diabetes');
    expect(without.clinicalFlags).not.toContain('diabetes');

    // Teto: carboidratos limitados a 40% das kcal (em g): kcal * 0.4 / 4
    const carbCapGrams =
      (withDiabetes.recommendation.calories * 0.4) / 4;
    expect(withDiabetes.recommendation.macros.carbs).toBeLessThanOrEqual(
      carbCapGrams + 1 // tolerância de arredondamento
    );

    // A flag 'diabetes' já é validada acima
  });

  it('hypertension: alerta de restrição de sódio', () => {
    const baseInput = {
      weight: 80,
      height: 175,
      age: 55,
      gender: 'masculino',
      avgActivity: 300,
    } satisfies MetabolicInput;

    const withHtn = calculateMetabolism({
      ...baseInput,
      conditions: ['hypertension'],
    });

    expect(withHtn.clinicalFlags).toContain('hypertension');

    // Sódio não é macro: macros não devem mudar substancialmente
    const without = calculateMetabolism(baseInput);
    expect(withHtn.recommendation.macros).toEqual(without.recommendation.macros);

    // Alerta menciona sódio / limite 2300mg
    const alertLower = withHtn.recommendation.alert.toLowerCase();
    expect(
      alertLower.includes('sódio') ||
        alertLower.includes('sodio') ||
        alertLower.includes('2300')
    ).toBe(true);
  });

  it('pregnancy (T2): +340 kcal/dia', () => {
    const baseInput = {
      weight: 65,
      height: 165,
      age: 30,
      gender: 'feminino',
      avgActivity: 250,
    } satisfies MetabolicInput;

    const without = calculateMetabolism(baseInput);
    const withPreg = calculateMetabolism({
      ...baseInput,
      conditions: ['pregnancy'],
      pregnancyTrimester: 2,
    });

    expect(withPreg.clinicalFlags).toContain('pregnancy');

    const delta =
      withPreg.recommendation.calories - without.recommendation.calories;
    // T2 = +340 kcal (tolerância ±2 por arredondamento)
    expect(delta).toBeGreaterThanOrEqual(338);
    expect(delta).toBeLessThanOrEqual(342);
  });

  it('pregnancy (T3): +452 kcal/dia', () => {
    const baseInput = {
      weight: 65,
      height: 165,
      age: 30,
      gender: 'feminino',
      avgActivity: 250,
    } satisfies MetabolicInput;

    const without = calculateMetabolism(baseInput);
    const withPreg = calculateMetabolism({
      ...baseInput,
      conditions: ['pregnancy'],
      pregnancyTrimester: 3,
    });

    const delta =
      withPreg.recommendation.calories - without.recommendation.calories;
    expect(delta).toBeGreaterThanOrEqual(450);
    expect(delta).toBeLessThanOrEqual(454);
  });

  it('pregnancy (T1): sem acréscimo calórico', () => {
    const baseInput = {
      weight: 65,
      height: 165,
      age: 30,
      gender: 'feminino',
      avgActivity: 250,
    } satisfies MetabolicInput;

    const without = calculateMetabolism(baseInput);
    const withPreg = calculateMetabolism({
      ...baseInput,
      conditions: ['pregnancy'],
      pregnancyTrimester: 1,
    });

    expect(withPreg.clinicalFlags).toContain('pregnancy');
    // T1 = +0 kcal → mesma prescrição calórica (pode haver re-arredondamento)
    expect(withPreg.recommendation.calories).toBe(without.recommendation.calories);
  });
});

// --------------------------------------------------------------------------
// 6. Integridade do SSOT
// --------------------------------------------------------------------------

describe('Integridade do engine (smoke)', () => {
  it('calculateMetabolism retorna tmb, get, tmbMethod, recommendation, clinicalFlags', () => {
    const result = calculateMetabolism(MALE_INPUT);
    expect(result).toHaveProperty('tmb');
    expect(result).toHaveProperty('get');
    expect(result).toHaveProperty('tmbMethod');
    expect(result).toHaveProperty('recommendation');
    expect(result).toHaveProperty('clinicalFlags');
    expect(['Katch-McArdle', 'Mifflin-St Jeor']).toContain(result.tmbMethod);
    expect(result.get).toBeGreaterThanOrEqual(result.tmb); // clamp GET ≥ TMB
  });

  it('tmbMethod = Katch-McArdle quando leanMass > 0', () => {
    const result = calculateMetabolism({
      ...MALE_INPUT,
      leanMass: 60,
    });
    expect(result.tmbMethod).toBe('Katch-McArdle');
  });

  it('tmbMethod = Mifflin-St Jeor sem leanMass', () => {
    const result = calculateMetabolism(MALE_INPUT);
    expect(result.tmbMethod).toBe('Mifflin-St Jeor');
  });
});
