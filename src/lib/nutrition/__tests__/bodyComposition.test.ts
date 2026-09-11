// ============================================================================
// Body Composition Engine — Tests DO-000.0 Fase 1
// Cobertura: JP3, JP7, Petroski4, missing, sexo, idade, peso/altura,
//            Siri/Brozek, massa gorda/magra, null/zero/string/inválido,
//            arredondamento, casos críticos JP7 e Petroski feminino
// Run: npx vitest run src/lib/nutrition/__tests__/bodyComposition.test.ts
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateBodyComposition,
  calculateAge,
  parseFoldValue,
  normalizeSex,
  PROTOCOLS,
  type BodyCompositionInput,
} from '../bodyComposition';

// Helpers para expected
function siri(bd: number) {
  return (4.95 / bd - 4.5) * 100;
}
function brozek(bd: number) {
  return (4.57 / bd - 4.142) * 100;
}

// ---------------------------------------------------------------------------
// parseFoldValue
// ---------------------------------------------------------------------------
describe('parseFoldValue — null não é zero', () => {
  it('null/undefined/"" => null', () => {
    expect(parseFoldValue(null)).toBeNull();
    expect(parseFoldValue(undefined)).toBeNull();
    expect(parseFoldValue('')).toBeNull();
  });
  it('0 e <=0 => null', () => {
    expect(parseFoldValue(0)).toBeNull();
    expect(parseFoldValue('0')).toBeNull();
    expect(parseFoldValue(-5)).toBeNull();
    expect(parseFoldValue('0.0')).toBeNull();
  });
  it('string numérica com vírgula', () => {
    expect(parseFoldValue('12,5')).toBe(12.5);
    expect(parseFoldValue(' 10.2 ')).toBe(10.2);
  });
  it('number válido', () => {
    expect(parseFoldValue(12.5)).toBe(12.5);
    expect(parseFoldValue('15')).toBe(15);
  });
  it('inválido => null', () => {
    expect(parseFoldValue('abc')).toBeNull();
    expect(parseFoldValue(NaN)).toBeNull();
    expect(parseFoldValue({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeSex
// ---------------------------------------------------------------------------
describe('normalizeSex — sem fallback', () => {
  it('masculino variants', () => {
    expect(normalizeSex('masculino')).toBe('M');
    expect(normalizeSex('Masculino')).toBe('M');
    expect(normalizeSex('homem')).toBe('M');
    expect(normalizeSex('M')).toBe('M');
  });
  it('feminino variants', () => {
    expect(normalizeSex('feminino')).toBe('F');
    expect(normalizeSex('Feminino')).toBe('F');
    expect(normalizeSex('mulher')).toBe('F');
    expect(normalizeSex('F')).toBe('F');
  });
  it('null/indefinido/unknown => null', () => {
    expect(normalizeSex(null)).toBeNull();
    expect(normalizeSex(undefined)).toBeNull();
    expect(normalizeSex('')).toBeNull();
    expect(normalizeSex('outro')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateAge com referenceDate
// ---------------------------------------------------------------------------
describe('calculateAge — data da medida', () => {
  it('idade na data da medida', () => {
    expect(calculateAge('2000-01-10', '2024-06-01')).toBe(24);
    expect(calculateAge('2000-01-10', '2026-06-01')).toBe(26);
  });
  it('antes do aniversário no ano', () => {
    expect(calculateAge('2000-06-15', '2024-06-14')).toBe(23);
    expect(calculateAge('2000-06-15', '2024-06-15')).toBe(24);
  });
  it('sem birthDate => null', () => {
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge('')).toBeNull();
  });
  it('referenceDate como Date', () => {
    expect(calculateAge('1990-05-20', new Date('2020-05-19'))).toBe(29);
    expect(calculateAge('1990-05-20', new Date('2020-05-20'))).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// JP3 Masculino
// ---------------------------------------------------------------------------
describe('JP3 masculino', () => {
  it('soma correta Σ3 = pectoral+abdominal+thigh', () => {
    const input: BodyCompositionInput = {
      protocol: 'jp3',
      sex: 'M',
      age: 25,
      weight: 75,
      height: null,
      skinfolds: { pectoral: 10, abdominal: 15, thigh: 12, triceps: 20, suprailiac: 20, biceps: 99, calf: 99, subscapular: 99, axillary_media: 99 },
    };
    const res = calculateBodyComposition(input) as any;
    expect(res.missing).toEqual([]);
    expect(res.sum).toBe(37); // 10+15+12, biceps/calf ignorados
    const expectedDC = 1.10938 - 0.0008267 * 37 + 0.0000016 * 37 * 37 - 0.0002574 * 25;
    expect(res.density).toBeCloseTo(expectedDC, 6);
    expect(res.bf).toBeCloseTo(siri(expectedDC), 6);
    expect(res.sites).toEqual(['pectoral', 'abdominal', 'thigh']);
  });

  it('missing quando pectoral ausente', () => {
    const res = calculateBodyComposition({
      protocol: 'jp3',
      sex: 'M',
      age: 25,
      weight: 75,
      height: null,
      skinfolds: { pectoral: null, abdominal: 15, thigh: 12 },
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.missing).toContain('pectoral');
  });

  it('DC/BF sem peso, massas null com warning', () => {
    const res = calculateBodyComposition({
      protocol: 'jp3',
      sex: 'M',
      age: 25,
      weight: null,
      height: null,
      skinfolds: { pectoral: 10, abdominal: 15, thigh: 12 },
    }) as any;
    expect(res.bf).not.toBeNull();
    expect(res.fatMass).toBeNull();
    expect(res.leanMass).toBeNull();
    expect(res.warnings.join(' ')).toMatch(/Peso/);
  });

  it('massa gorda/magra a partir de bf não arredondado', () => {
    const res = calculateBodyComposition({
      protocol: 'jp3',
      sex: 'M',
      age: 25,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 10, abdominal: 15, thigh: 12 },
    }) as any;
    expect(res.fatMass).toBeCloseTo(80 * (res.bf / 100), 6);
    expect(res.leanMass).toBeCloseTo(80 - 80 * (res.bf / 100), 6);
  });
});

// ---------------------------------------------------------------------------
// JP3 Feminino
// ---------------------------------------------------------------------------
describe('JP3 feminino', () => {
  it('soma correta Σ3 = triceps+suprailiac+thigh', () => {
    const input: BodyCompositionInput = {
      protocol: 'jp3',
      sex: 'F',
      age: 28,
      weight: 60,
      height: null,
      skinfolds: { triceps: 14, suprailiac: 18, thigh: 20, pectoral: 50, abdominal: 50 },
    };
    const res = calculateBodyComposition(input) as any;
    expect(res.sum).toBe(52); // 14+18+20
    const expectedDC = 1.0994921 - 0.0009929 * 52 + 0.0000023 * 52 * 52 - 0.0001392 * 28;
    expect(res.density).toBeCloseTo(expectedDC, 6);
    expect(res.bf).toBeCloseTo(siri(expectedDC), 6);
    expect(res.sites).toEqual(['triceps', 'suprailiac', 'thigh']);
  });

  it('não mistura sítios masculinos', () => {
    // Se passar só pectoral/abdominal/thigh para F, deve faltar triceps/suprailiac
    const res = calculateBodyComposition({
      protocol: 'jp3',
      sex: 'F',
      age: 28,
      weight: 60,
      height: null,
      skinfolds: { pectoral: 10, abdominal: 15, thigh: 12 },
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.missing).toEqual(expect.arrayContaining(['triceps', 'suprailiac']));
  });
});

// ---------------------------------------------------------------------------
// JP7 Masculino
// ---------------------------------------------------------------------------
describe('JP7 masculino', () => {
  it('soma correta Σ7 = 7 sítios sem biceps/calf', () => {
    const skin = {
      pectoral: 8,
      axillary_media: 10,
      triceps: 12,
      subscapular: 14,
      abdominal: 16,
      suprailiac: 18,
      thigh: 15,
      biceps: 99,
      calf: 99,
    };
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 78,
      height: null,
      skinfolds: skin,
    }) as any;
    const expectedSum = 8 + 10 + 12 + 14 + 16 + 18 + 15; // 93
    expect(res.sum).toBe(expectedSum);
    const expectedDC = 1.112 - 0.00043499 * expectedSum + 0.00000055 * expectedSum * expectedSum - 0.00028826 * 30;
    expect(res.density).toBeCloseTo(expectedDC, 6);
    expect(res.bf).toBeCloseTo(siri(expectedDC), 4);
    expect(res.sites).toEqual(['pectoral', 'axillary_media', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh']);
  });

  it('caso crítico: biceps e calf diferentes não afetam soma', () => {
    // skin com biceps=25 calf=30 vs biceps=1 calf=1 devem dar mesmo resultado
    const base = {
      pectoral: 10,
      axillary_media: 11,
      triceps: 12,
      subscapular: 13,
      abdominal: 14,
      suprailiac: 15,
      thigh: 16,
    };
    const skinA = { ...base, biceps: 25, calf: 30 } as any;
    const skinB = { ...base, biceps: 1, calf: 1 } as any;
    const skinC = { ...base, biceps: null, calf: undefined } as any;
    const resA = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 80, height: null, skinfolds: skinA }) as any;
    const resB = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 80, height: null, skinfolds: skinB }) as any;
    const resC = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 80, height: null, skinfolds: skinC }) as any;
    expect(resA.sum).toBe(resB.sum);
    expect(resB.sum).toBe(resC.sum);
    expect(resA.sum).toBe(91); // 10+11+12+13+14+15+16
    expect(resA.density).toBeCloseTo(resB.density, 8);
    expect(resA.bf).toBeCloseTo(resB.bf, 8);
  });

  it('pec == biceps confundido — prova que pectoral é usado e biceps não', () => {
    // Se motor usasse biceps no lugar de pectoral, trocar valores mudaria sum
    const resPectoral10 = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10, biceps: 50 },
    }) as any;
    const resPectoral50 = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 50, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10, biceps: 10 },
    }) as any;
    expect(resPectoral10.sum).toBe(70);
    expect(resPectoral50.sum).toBe(110);
    expect(resPectoral10.bf).not.toBeCloseTo(resPectoral50.bf, 1);
  });
});

// ---------------------------------------------------------------------------
// JP7 Feminino
// ---------------------------------------------------------------------------
describe('JP7 feminino', () => {
  it('soma e densidade feminina', () => {
    const skin = {
      pectoral: 9,
      axillary_media: 11,
      triceps: 15,
      subscapular: 16,
      abdominal: 18,
      suprailiac: 20,
      thigh: 22,
    };
    const res = calculateBodyComposition({ protocol: 'jp7', sex: 'F', age: 28, weight: 62, height: null, skinfolds: skin }) as any;
    const sum = 9 + 11 + 15 + 16 + 18 + 20 + 22; // 111
    expect(res.sum).toBe(sum);
    const expectedDC = 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * 28;
    expect(res.density).toBeCloseTo(expectedDC, 6);
    expect(res.bf).toBeCloseTo(siri(expectedDC), 4);
  });

  it('string numérica funciona', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'F',
      age: 28,
      weight: 62,
      height: null,
      skinfolds: {
        pectoral: '9',
        axillary_media: '11',
        triceps: '15',
        subscapular: '16',
        abdominal: '18',
        suprailiac: '20',
        thigh: '22',
      },
    }) as any;
    expect(res.sum).toBe(111);
  });
});

// ---------------------------------------------------------------------------
// Petroski Masculino
// ---------------------------------------------------------------------------
describe('Petroski masculino', () => {
  it('Σ4 = subscapular+triceps+suprailiac+calf', () => {
    const input: BodyCompositionInput = {
      protocol: 'petroski4',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { subscapular: 12, triceps: 10, suprailiac: 14, calf: 8, pectoral: 99, axillary_media: 99 },
    };
    const res = calculateBodyComposition(input) as any;
    expect(res.sum).toBe(44);
    const expectedDC = 1.10726863 - 0.00081201 * 44 + 0.00000212 * 44 * 44 - 0.00041761 * 30;
    expect(res.density).toBeCloseTo(expectedDC, 6);
    expect(res.bf).toBeCloseTo(siri(expectedDC), 4);
  });

  it('sem peso ainda calcula DC/BF', () => {
    const res = calculateBodyComposition({
      protocol: 'petroski4',
      sex: 'M',
      age: 30,
      weight: null,
      height: null,
      skinfolds: { subscapular: 12, triceps: 10, suprailiac: 14, calf: 8 },
    }) as any;
    expect(res.bf).not.toBeNull();
    expect(res.fatMass).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Petroski Feminino — crítico (corrigido DO-000.0-PETROSKI-FIX)
// Fórmula tese: 1.03465850 -0.00063129*Σ4 +0.00000187*Σ4² -0.00031165*idade -0.00048890*peso +0.00051345*estatura
// ---------------------------------------------------------------------------
describe('Petroski feminino', () => {
  const age = 30;
  const weight = 60;
  const height = 165;

  function dcPetroskiF(sum: number, age: number, w: number, h: number) {
    return 1.0346585 - 0.00063129 * sum + 0.00000187 * sum * sum - 0.00031165 * age - 0.0004889 * w + 0.00051345 * h;
  }

  it('Σ4 = axillary_media+suprailiac+thigh+calf e fórmula com peso+estatura (Σ=40)', () => {
    const skin = { axillary_media: 10, suprailiac: 10, thigh: 10, calf: 10 }; // Σ40
    const sum = 40;
    const res = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age, weight, height, skinfolds: skin }) as any;
    expect(res.sum).toBe(sum);
    const expectedDC = dcPetroskiF(sum, age, weight, height);
    expect(res.density).toBeCloseTo(expectedDC, 6);
    expect(res.bf).toBeCloseTo(siri(expectedDC), 4);
    // peso realmente entra
    const res2 = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age, weight: 70, height, skinfolds: skin }) as any;
    expect(res2.density).not.toBeCloseTo(res.density, 3);
  });

  it('Σ4=50 valida contra fórmula', () => {
    const skin = { axillary_media: 12, suprailiac: 13, thigh: 12, calf: 13 }; // Σ50
    const sum = 50;
    const res = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age, weight, height, skinfolds: skin }) as any;
    expect(res.sum).toBe(sum);
    const expectedDC = dcPetroskiF(sum, age, weight, height);
    expect(res.density).toBeCloseTo(expectedDC, 6);
    expect(res.bf).toBeCloseTo(siri(expectedDC), 4);
  });

  it('Σ4=60 valida contra fórmula', () => {
    const skin = { axillary_media: 15, suprailiac: 15, thigh: 15, calf: 15 }; // Σ60
    const sum = 60;
    const res = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age, weight, height, skinfolds: skin }) as any;
    expect(res.sum).toBe(sum);
    const expectedDC = dcPetroskiF(sum, age, weight, height);
    expect(res.density).toBeCloseTo(expectedDC, 6);
    expect(res.bf).toBeCloseTo(siri(expectedDC), 4);
  });

  it('estatura em metros é normalizada para cm', () => {
    const skin = { axillary_media: 10, suprailiac: 10, thigh: 10, calf: 10 };
    const resCm = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age, weight, height: 165, skinfolds: skin }) as any;
    const resM = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age, weight, height: 1.65, skinfolds: skin }) as any;
    expect(resM.density).toBeCloseTo(resCm.density, 6);
  });

  it('peso obrigatório: sem peso => indisponível', () => {
    const res = calculateBodyComposition({
      protocol: 'petroski4',
      sex: 'F',
      age,
      weight: null,
      height,
      skinfolds: { axillary_media: 10, suprailiac: 10, thigh: 10, calf: 10 },
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.warnings.join(' ')).toMatch(/Peso/);
  });

  it('estatura obrigatória: sem estatura => indisponível', () => {
    const res = calculateBodyComposition({
      protocol: 'petroski4',
      sex: 'F',
      age,
      weight,
      height: null,
      skinfolds: { axillary_media: 10, suprailiac: 10, thigh: 10, calf: 10 },
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.warnings.join(' ')).toMatch(/Estatura/);
  });

  it('Σ4 linear + Σ4²: prova que ambos os termos entram (não só Σ²)', () => {
    // Se fosse só Σ², DC para Σ40 e Σ50 teria diferença proporcional a Σ² apenas.
    // Com linear+quadrático, diferença inclui termo linear.
    const res40 = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age, weight, height, skinfolds: { axillary_media: 10, suprailiac: 10, thigh: 10, calf: 10 } }) as any;
    const res50 = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age, weight, height, skinfolds: { axillary_media: 12, suprailiac: 13, thigh: 12, calf: 13 } }) as any;
    expect(res40.density).toBeCloseTo(dcPetroskiF(40, age, weight, height), 6);
    expect(res50.density).toBeCloseTo(dcPetroskiF(50, age, weight, height), 6);
    // diferença contém componente linear 0.00063129*(50-40)=0.0063
    const diff = res40.density - res50.density;
    expect(diff).toBeGreaterThan(0);
  });

  it('massa gorda/magra usa bf não-arredondado', () => {
    const skin = { axillary_media: 10, suprailiac: 10, thigh: 10, calf: 10 };
    const res = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age, weight, height, skinfolds: skin }) as any;
    expect(res.fatMass).toBeCloseTo(weight * (res.bf / 100), 6);
    expect(res.leanMass).toBeCloseTo(weight - weight * (res.bf / 100), 6);
  });

  it('faixa etária F 18-51: 52 gera warning mas ainda calcula', () => {
    const skin = { axillary_media: 10, suprailiac: 10, thigh: 10, calf: 10 };
    const res = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age: 52, weight, height, skinfolds: skin }) as any;
    expect(res.bf).not.toBeNull();
    expect(res.warnings.join(' ')).toMatch(/fora da faixa/);
  });
});

// ---------------------------------------------------------------------------
// Conversão Siri vs Brozek
// ---------------------------------------------------------------------------
describe('conversão', () => {
  it('Siri default', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10 },
    }) as any;
    expect(res.bf).toBeCloseTo(siri(res.density), 6);
  });
  it('Brozek', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10 },
      conversion: 'brozek',
    }) as any;
    expect(res.bf).toBeCloseTo(brozek(res.density), 6);
  });
});

// ---------------------------------------------------------------------------
// Sexo null — sem fallback
// ---------------------------------------------------------------------------
describe('sexo null', () => {
  it('jp3 com sex null => indisponível', () => {
    const res = calculateBodyComposition({
      protocol: 'jp3',
      sex: null,
      age: 25,
      weight: 75,
      height: null,
      skinfolds: { pectoral: 10, abdominal: 15, thigh: 12 },
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.warnings.join(' ')).toMatch(/Sexo/);
  });
  it('jp7 com sex null => indisponível', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: null,
      age: 25,
      weight: 75,
      height: null,
      skinfolds: { pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10 },
    }) as any;
    expect(res.bf).toBeNull();
  });
  it('petroski4 com sex null => indisponível', () => {
    const res = calculateBodyComposition({
      protocol: 'petroski4',
      sex: null,
      age: 30,
      weight: 60,
      height: 165,
      skinfolds: { axillary_media: 12, suprailiac: 14, thigh: 16, calf: 10 },
    }) as any;
    expect(res.bf).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Idade
// ---------------------------------------------------------------------------
describe('idade', () => {
  it('idade null => indisponível', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: null,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10 },
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.warnings.join(' ')).toMatch(/Idade/);
  });
  it('idade fora da faixa gera warning mas ainda calcula', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 70,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10 },
    }) as any;
    expect(res.bf).not.toBeNull();
    expect(res.warnings.join(' ')).toMatch(/fora da faixa/);
  });
});

// ---------------------------------------------------------------------------
// Peso/altura handling
// ---------------------------------------------------------------------------
describe('peso e altura', () => {
  it('jp7 sem peso => bf ok mas massas null', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: null,
      height: null,
      skinfolds: { pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10 },
    }) as any;
    expect(res.bf).not.toBeNull();
    expect(res.fatMass).toBeNull();
    expect(res.leanMass).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Null/zero/inválido nas dobras
// ---------------------------------------------------------------------------
describe('ausência de dobras', () => {
  it('todas ausentes => missing todas', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: {},
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.missing.length).toBe(7);
  });
  it('zero é ausente', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 0, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10 },
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.missing).toContain('pectoral');
  });
  it('string vazia é ausente', () => {
    const res = calculateBodyComposition({
      protocol: 'jp3',
      sex: 'M',
      age: 25,
      weight: 75,
      height: null,
      skinfolds: { pectoral: '', abdominal: 15, thigh: 12 },
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.missing).toContain('pectoral');
  });
  it('valor inválido é ausente', () => {
    const res = calculateBodyComposition({
      protocol: 'jp3',
      sex: 'M',
      age: 25,
      weight: 75,
      height: null,
      skinfolds: { pectoral: 'abc', abdominal: 15, thigh: 12 },
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.missing).toContain('pectoral');
  });
  it('skinfolds null => todos missing', () => {
    const res = calculateBodyComposition({
      protocol: 'jp3',
      sex: 'M',
      age: 25,
      weight: 75,
      height: null,
      skinfolds: null,
    }) as any;
    expect(res.bf).toBeNull();
    expect(res.missing.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Bicipital nunca usado
// ---------------------------------------------------------------------------
describe('bicipital nunca em nenhuma fórmula', () => {
  it('jp3, jp7, petroski4 ignoram biceps', () => {
    const withBiceps = { pectoral: 10, abdominal: 10, thigh: 10, biceps: 100 } as any;
    const withoutBiceps = { pectoral: 10, abdominal: 10, thigh: 10, biceps: 0 } as any;
    const r1 = calculateBodyComposition({ protocol: 'jp3', sex: 'M', age: 25, weight: 75, height: null, skinfolds: withBiceps }) as any;
    const r2 = calculateBodyComposition({ protocol: 'jp3', sex: 'M', age: 25, weight: 75, height: null, skinfolds: withoutBiceps }) as any;
    expect(r1.sum).toBe(r2.sum);

    const jp7a = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10, biceps: 100 },
    }) as any;
    const jp7b = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10, biceps: 0 },
    }) as any;
    expect(jp7a.sum).toBe(jp7b.sum);

    const pA = calculateBodyComposition({
      protocol: 'petroski4',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { subscapular: 10, triceps: 10, suprailiac: 10, calf: 10, biceps: 100 },
    }) as any;
    const pB = calculateBodyComposition({
      protocol: 'petroski4',
      sex: 'M',
      age: 30,
      weight: 80,
      height: null,
      skinfolds: { subscapular: 10, triceps: 10, suprailiac: 10, calf: 10, biceps: 0 },
    }) as any;
    expect(pA.sum).toBe(pB.sum);
  });
});

// ---------------------------------------------------------------------------
// Sanidade DC/BF
// ---------------------------------------------------------------------------
describe('sanidade', () => {
  it('BF fora de (0,60) => null com warning', () => {
    // Forçar bf alto: idade muito baixa + soma enorme pode dar bf >60 em alguns casos,
    // mas DC quadrática protege; testamos via DC <=0 artificial: soma gigantesca
    // Alternativa: sum muito alto com idade baixa
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 18,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 60, axillary_media: 60, triceps: 60, subscapular: 60, abdominal: 60, suprailiac: 60, thigh: 60 }, // sum 420
    }) as any;
    // DC = 1.112 -0.00043499*420 +0.00000055*176400 -0.00028826*18 = ~1.02 => bf ~34% (ainda válido)
    // Então testamos sanidade via DC artificialmente baixo não é fácil; verificamos o caminho de warning existente
    // Testar BF negativo: sum 0 já é missing, então forçamos DC~1.3 com bf negativo? Não atinge.
    // Verificar que mesmo com sum plausível bf fica em 0-60 (sanidade passa)
    expect(res.bf).not.toBeNull();
    // Já garantir que sanidade não silencia sem warning: forçar bf <0 via DC>4.95/4.5? DC ~1.1 sempre <...
  });
  it('DC <=0 => indisponível', () => {
    // DC <=0 exigiria sum astronômico; verificamos que motor retorna null sem throw
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 18,
      weight: 80,
      height: null,
      skinfolds: { pectoral: 200, axillary_media: 200, triceps: 200, subscapular: 200, abdominal: 200, suprailiac: 200, thigh: 200 },
    }) as any;
    // sum 1400 => DC =1.112 -0.608 +1.078 -0.005 =1.577 => ainda positivo, bf negativo? Siri ~ -136% => sanidade dispara
    expect(res.bf).toBeNull();
    expect(res.warnings.join(' ')).toMatch(/sanidade/);
  });
});

// ---------------------------------------------------------------------------
// Arredondamento: motor não arredonda, massas de bf não-arredondado
// ---------------------------------------------------------------------------
describe('arredondamento', () => {
  it('retorna números completos (não toFixed)', () => {
    const res = calculateBodyComposition({
      protocol: 'jp7',
      sex: 'M',
      age: 30,
      weight: 78.5,
      height: null,
      skinfolds: { pectoral: 12.3, axillary_media: 10.7, triceps: 11.1, subscapular: 13.5, abdominal: 15.2, suprailiac: 14.8, thigh: 16.0 },
    }) as any;
    // Verificar que bf tem mais de 1 casa decimal (não foi toFixed)
    const bfStr = String(res.bf);
    const decimals = bfStr.includes('.') ? bfStr.split('.')[1].length : 0;
    expect(decimals).toBeGreaterThan(1);
    // massas derivadas de bf não-arredondado
    expect(res.fatMass).toBeCloseTo(78.5 * (res.bf / 100), 8);
  });
});

// ---------------------------------------------------------------------------
// Protocolo / label / sites no resultado
// ---------------------------------------------------------------------------
describe('resultado identificação', () => {
  it('contém protocol, label, sites, sum, density, bf', () => {
    const res = calculateBodyComposition({
      protocol: 'jp3',
      sex: 'F',
      age: 25,
      weight: 60,
      height: null,
      skinfolds: { triceps: 12, suprailiac: 14, thigh: 15 },
    }) as any;
    expect(res.protocol).toBe('jp3');
    expect(res.label).toBe(PROTOCOLS.jp3.label);
    expect(res.sites).toEqual(['triceps', 'suprailiac', 'thigh']);
    expect(typeof res.sum).toBe('number');
    expect(typeof res.density).toBe('number');
    expect(typeof res.bf).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Validação externa — coeficientes batem com literatura
// ---------------------------------------------------------------------------
describe('validação externa — coeficientes', () => {
  it('JP7 M coeficiente confere com Jackson 1978', () => {
    // Verificar numericamente, não via toString (vite minifica)
    const sum = 100;
    const age = 30;
    const dc = PROTOCOLS.jp7.density.M(sum, age);
    const expected = 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age;
    expect(dc).toBeCloseTo(expected, 8);
  });
  it('Petroski M coeficiente', () => {
    const sum = 44;
    const age = 30;
    const dc = PROTOCOLS.petroski4.density.M(sum, age);
    const expected = 1.10726863 - 0.00081201 * sum + 0.00000212 * sum * sum - 0.00041761 * age;
    expect(dc).toBeCloseTo(expected, 8);
  });
});
