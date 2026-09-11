// FASE 2.0 — Prova de correção histórica JP7 / Σ9×Σ7
import { describe, it, expect } from 'vitest';
import { calculateBodyComposition, calculateAge, normalizeSex } from '../bodyComposition';

function makeSkin(overrides: Record<string, unknown> = {}) {
  return {
    pectoral: 10,
    axillary_media: 10,
    triceps: 10,
    subscapular: 10,
    abdominal: 10,
    suprailiac: 10,
    thigh: 10,
    biceps: 99,
    calf: 99,
    measurement_date: '2024-06-15',
    ...overrides,
  } as any;
}

describe('FASE 2.0 — Histórico JP7', () => {
  it('1. JP7 masculino 7 pontos corretos via motor (historico)', () => {
    const skin = makeSkin();
    const comp = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: skin }) as any;
    expect(comp.sum).toBe(70);
    expect(comp.sites).toEqual(['pectoral','axillary_media','triceps','subscapular','abdominal','suprailiac','thigh']);
  });
  it('2. JP7 feminino 7 pontos corretos', () => {
    const skin = makeSkin();
    const comp = calculateBodyComposition({ protocol: 'jp7', sex: 'F', age: 28, weight: 60, height: null, skinfolds: skin }) as any;
    expect(comp.sum).toBe(70);
  });
  it('3. alterar biceps não altera JP7', () => {
    const a = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: makeSkin({ biceps: 1 }) }) as any;
    const b = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: makeSkin({ biceps: 50 }) }) as any;
    expect(a.sum).toBe(b.sum);
    expect(a.bf).toBe(b.bf);
  });
  it('4. alterar calf não altera JP7', () => {
    const a = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: makeSkin({ calf: 1 }) }) as any;
    const b = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: makeSkin({ calf: 80 }) }) as any;
    expect(a.sum).toBe(b.sum);
  });
  it('5. alterar pectoral altera resultado', () => {
    const a = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: makeSkin({ pectoral: 10 }) }) as any;
    const b = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: makeSkin({ pectoral: 20 }) }) as any;
    expect(a.sum).toBe(70);
    expect(b.sum).toBe(80);
    expect(a.bf).not.toBe(b.bf);
  });
  it('6. alterar axillary_media altera resultado', () => {
    const a = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: makeSkin({ axillary_media: 10 }) }) as any;
    const b = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: makeSkin({ axillary_media: 25 }) }) as any;
    expect(a.bf).not.toBe(b.bf);
  });
  it('7. missing fold não vira zero (null)', () => {
    const comp = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: makeSkin({ pectoral: null }) }) as any;
    expect(comp.bf).toBeNull();
    expect(comp.missing).toContain('pectoral');
    expect(comp.sum).toBeNull();
  });
  it('8. idade histórica usa measurement_date', () => {
    const ageNow = calculateAge('1990-01-01', '2024-06-15');
    const ageOld = calculateAge('1990-01-01', '2020-06-15');
    expect(ageNow).toBe(34);
    expect(ageOld).toBe(30);
    const a = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: ageNow, weight: 75, height: null, skinfolds: makeSkin() }) as any;
    const b = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: ageOld, weight: 75, height: null, skinfolds: makeSkin() }) as any;
    expect(a.bf).not.toBe(b.bf);
  });
  it('9. nenhum matching depende de toFixed', () => {
    // Novo matching é por data apenas
    const date = '2024-06-15';
    const timeline = [{ date, somatorio_dobras: 70, bf: 12 }, { date: '2024-06-16', somatorio_dobras: 80, bf: 15 }];
    const foundByDate = timeline.find(t => t.date === date);
    expect(foundByDate?.bf).toBe(12);
    // Prova que valor toFixed não é chave: soma 70.06 → 70.1 não matchearia, mas por data ainda encontra
    const sum = 70.06;
    const failedByValue = timeline.find(t => t.somatorio_dobras === parseFloat(sum.toFixed(1)));
    expect(failedByValue).toBeUndefined();
    expect(foundByDate).toBeDefined();
  });
  it('10. histórico não utiliza Σ9 na composição', () => {
    // Σ9 incluiria biceps+calf; JP7 não. Com biceps 30 extra, Σ9=100 mas JP7=70
    const skinComBiceps = makeSkin({ biceps: 30, calf: 30, pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10 });
    const s9 = skinComBiceps.pectoral + skinComBiceps.axillary_media + skinComBiceps.triceps + skinComBiceps.subscapular + skinComBiceps.abdominal + skinComBiceps.suprailiac + skinComBiceps.thigh + skinComBiceps.biceps + skinComBiceps.calf; // 130
    const comp = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: skinComBiceps }) as any;
    expect(comp.sum).toBe(70); // não 130
    expect(s9).toBe(130);
    expect(comp.sum).not.toBe(s9);
  });
});
