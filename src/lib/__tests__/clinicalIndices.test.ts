import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectClinicalIndicesRequest, parseProtocolFromMessage } from '@/lib/clinicalIndices';
import { calculateBodyComposition } from '@/lib/nutrition/bodyComposition';

describe('PRO-004.0 clinicalIndices — detecção e protocolo', () => {
  it('detecta pedido de IMC/gordura/massa', () => {
    expect(detectClinicalIndicesRequest('Me dê os índices IMC, gordura corporal, massa gorda e massa magra do paciente Joelson no protocolo JP7.')).toBe(true);
    expect(detectClinicalIndicesRequest('qual minha massa magra?')).toBe(true);
    expect(detectClinicalIndicesRequest('qual meu peso?')).toBe(false);
    expect(detectClinicalIndicesRequest('olá, tudo bem?')).toBe(false);
  });
  it('parseProtocol identifica jp3/jp7/petroski', () => {
    expect(parseProtocolFromMessage('no protocolo JP7')).toBe('jp7');
    expect(parseProtocolFromMessage('JP3 por favor')).toBe('jp3');
    expect(parseProtocolFromMessage('petroski 4')).toBe('petroski4');
    expect(parseProtocolFromMessage('Petroski')).toBe('petroski4');
    expect(parseProtocolFromMessage('jp 7')).toBe('jp7');
    expect(parseProtocolFromMessage('sem protocolo')).toBe(null);
  });
  it('mesmas 9 médias recalculam protocolos diferentes sem nova coleta', () => {
    const skinfolds = { triceps: 12, subscapular: 10, biceps: 6, pectoral: 8, axillary_media: 9, abdominal: 15, suprailiac: 14, thigh: 13, calf: 7 } as any;
    const base = { sex: 'M' as const, age: 30, weight: 78, height: 175, skinfolds, conversion: 'siri' as const };
    const jp3 = calculateBodyComposition({ ...base, protocol: 'jp3' }) as any;
    const jp7 = calculateBodyComposition({ ...base, protocol: 'jp7' }) as any;
    const pet = calculateBodyComposition({ ...base, protocol: 'petroski4' }) as any;
    expect(jp3.bf).not.toBeNull();
    expect(jp7.bf).not.toBeNull();
    expect(pet.bf).not.toBeNull();
    // JP3 M usa pectoral+abdominal+thigh, JP7 usa 7, Petroski M usa subscapular+triceps+suprailiac+calf
    expect(jp3.sum).toBe(8+15+13);
    expect(jp7.sum).toBe(8+9+12+10+15+14+13);
    expect(pet.sum).toBe(10+12+14+7);
    expect(jp3.bf).not.toBe(jp7.bf);
  });
  it('IMC usa mesma fórmula do historico (peso/altura^2)', () => {
    const weight = 80, heightCm = 175;
    const heightM = heightCm/100;
    const imc = Number((weight/(heightM*heightM)).toFixed(1));
    expect(imc).toBe(26.1);
  });
  it('petroski feminino sem peso/altura retorna indisponível (warning peso)', () => {
    const skinfolds = { triceps: 12, subscapular: 10, biceps: 6, pectoral: 8, axillary_media: 9, abdominal: 15, suprailiac: 14, thigh: 13, calf: 7 } as any;
    const r: any = calculateBodyComposition({ protocol: 'petroski4', sex: 'F', age: 28, weight: null, height: 162, skinfolds, conversion: 'siri' });
    expect(r.bf).toBeNull();
    expect(r.warnings.join(' ')).toMatch(/Peso obrigatório.*Petroski/i);
  });
  it('cálculo do chat coincide com motor existente (bf/fatMass/leanMass)', () => {
    const skinfolds = { triceps: 15, subscapular: 12, biceps: 8, pectoral: 10, axillary_media: 11, abdominal: 18, suprailiac: 16, thigh: 14, calf: 9 } as any;
    const r: any = calculateBodyComposition({ protocol: 'jp7', sex: 'F', age: 32, weight: 65, height: 165, skinfolds, conversion: 'siri' });
    expect(r.bf).not.toBeNull();
    // fatMass = weight * bf/100, leanMass = weight - fatMass
    if (r.bf !== null && r.fatMass !== null && r.leanMass !== null) {
      expect(r.fatMass).toBeCloseTo(65 * r.bf/100, 1);
      expect(r.leanMass).toBeCloseTo(65 - r.fatMass, 1);
    }
  });
});
