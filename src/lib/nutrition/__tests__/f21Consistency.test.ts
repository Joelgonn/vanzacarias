// F2.1 — Validação de consistência histórica — fixture determinístico + null per site
import { describe, it, expect } from 'vitest';
import { calculateBodyComposition, calculateAge } from '../bodyComposition';

const fixture = {
  sexo: 'M' as const,
  nascimento: '1990-01-01',
  measurement_date: '2024-06-15',
  peso: 75,
  altura: null,
  skinfolds: {
    pectoral: 12,
    axillary_media: 11,
    triceps: 13,
    subscapular: 14,
    abdominal: 15,
    suprailiac: 12,
    thigh: 11,
    biceps: 22, // deve ser ignorado
    calf: 18,   // deve ser ignorado
  } as any,
};

function expectedSum(s: typeof fixture.skinfolds) {
  return s.pectoral + s.axillary_media + s.triceps + s.subscapular + s.abdominal + s.suprailiac + s.thigh;
}

describe('F2.1 — Fixture determinístico 9 campos', () => {
  it('Σ7 consistente com motor para mesmo fixture', () => {
    const age = calculateAge(fixture.nascimento, fixture.measurement_date)!;
    const comp = calculateBodyComposition({ protocol: 'jp7', sex: fixture.sexo, age, weight: fixture.peso, height: fixture.altura, skinfolds: fixture.skinfolds }) as any;
    expect(comp.sum).toBe(expectedSum(fixture.skinfolds));
    // biceps/calf diferentes não interferem
    const skin2 = { ...fixture.skinfolds, biceps: 99, calf: 99 };
    const comp2 = calculateBodyComposition({ protocol: 'jp7', sex: fixture.sexo, age, weight: fixture.peso, height: null, skinfolds: skin2 }) as any;
    expect(comp2.sum).toBe(comp.sum);
    expect(comp2.bf).toBe(comp.bf);
  });

  it('todos os consumidores usariam mesmo sum/bf/massas para mesmo fixture', () => {
    const age = calculateAge(fixture.nascimento, fixture.measurement_date)!;
    const compHistorico = calculateBodyComposition({ protocol: 'jp7', sex: fixture.sexo, age, weight: fixture.peso, height: null, skinfolds: fixture.skinfolds }) as any;
    const compDashboard = calculateBodyComposition({ protocol: 'jp7', sex: fixture.sexo, age, weight: fixture.peso, height: null, skinfolds: fixture.skinfolds }) as any;
    const compDobras = calculateBodyComposition({ protocol: 'jp7', sex: fixture.sexo, age, weight: fixture.peso, height: null, skinfolds: fixture.skinfolds }) as any;
    expect(compHistorico.sum).toBe(compDashboard.sum);
    expect(compDashboard.sum).toBe(compDobras.sum);
    expect(compHistorico.bf).toBe(compDashboard.bf);
    expect(compHistorico.fatMass).toBe(compDashboard.fatMass);
    expect(compHistorico.leanMass).toBe(compDashboard.leanMass);
    // interna precisão total (não toFixed)
    expect(String(compHistorico.bf).split('.')[1]?.length).toBeGreaterThan(1);
  });

  it('massas derivadas de bf não-arredondado', () => {
    const age = calculateAge(fixture.nascimento, fixture.measurement_date)!;
    const comp = calculateBodyComposition({ protocol: 'jp7', sex: fixture.sexo, age, weight: fixture.peso, height: null, skinfolds: fixture.skinfolds }) as any;
    expect(comp.fatMass).toBeCloseTo(fixture.peso * (comp.bf / 100), 8);
    expect(comp.leanMass).toBeCloseTo(fixture.peso - fixture.peso * (comp.bf / 100), 8);
  });
});

describe('F2.1 — NULL por site (7 sites)', () => {
  const sites: (keyof typeof fixture.skinfolds)[] = ['pectoral','axillary_media','triceps','subscapular','abdominal','suprailiac','thigh'];
  for (const site of sites) {
    it(`${String(site)} null → composição incompleta`, () => {
      const age = calculateAge(fixture.nascimento, fixture.measurement_date)!;
      const skin = { ...fixture.skinfolds, [site]: null };
      const comp = calculateBodyComposition({ protocol: 'jp7', sex: fixture.sexo, age, weight: fixture.peso, height: null, skinfolds: skin }) as any;
      expect(comp.bf).toBeNull();
      expect(comp.sum).toBeNull();
      expect(comp.missing).toContain(site);
    });
  }
});

describe('F2.1 — Idade histórica', () => {
  it('mesmo paciente, duas datas → idades 30 e 34', () => {
    const ageOld = calculateAge('1990-01-01', '2020-06-15');
    const ageNew = calculateAge('1990-01-01', '2024-06-15');
    expect(ageOld).toBe(30);
    expect(ageNew).toBe(34);
    const skin = fixture.skinfolds;
    const cOld = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: ageOld!, weight: 75, height: null, skinfolds: skin }) as any;
    const cNew = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: ageNew!, weight: 75, height: null, skinfolds: skin }) as any;
    expect(cOld.bf).not.toBe(cNew.bf);
  });
  it('measurement_date ausente → motor usa comportamento definido (age null → indisponível)', () => {
    const comp = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: null, weight: 75, height: null, skinfolds: fixture.skinfolds }) as any;
    expect(comp.bf).toBeNull();
    expect(comp.warnings.join(' ')).toMatch(/Idade/);
  });
});

describe('F2.1 — Invariância por site e variância', () => {
  it.each([['pectoral'],['axillary_media'],['triceps'],['subscapular'],['abdominal'],['suprailiac'],['thigh']] as const)('alterar %s altera sum/bf', (site) => {
    const age = calculateAge(fixture.nascimento, fixture.measurement_date)!;
    const base = calculateBodyComposition({ protocol: 'jp7', sex: fixture.sexo, age, weight: fixture.peso, height: null, skinfolds: fixture.skinfolds }) as any;
    const skin2 = { ...fixture.skinfolds, [site]: (fixture.skinfolds as any)[site] + 5 };
    const altered = calculateBodyComposition({ protocol: 'jp7', sex: fixture.sexo, age, weight: fixture.peso, height: null, skinfolds: skin2 }) as any;
    expect(altered.sum).toBe(base.sum + 5);
    expect(altered.bf).not.toBe(base.bf);
  });
});
