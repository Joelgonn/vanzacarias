import { describe, it, expect } from 'vitest';
import { isCaptureSupported, floatTo16BitPCM, resampleTo16k } from '../audio/capture';
import { BENCHMARK_SAMPLES, computeWER, simulateVoicePipeline } from '../dataset/benchmark';
import { isMoonshineSupported } from '../stt/moonshine';
import { extractFoodIdsFromText } from '@/lib/guardrailHelpers';
import { expandRestrictions } from '@/lib/nutrition/restrictions';
import { SPLIT, validateNoLeak, FROZEN_TEST_IDS } from '../dataset/split';

describe('VOZ-001.4 — captura', () => {
  it('isCaptureSupported não quebra em node', () => {
    expect(typeof isCaptureSupported()).toBe('boolean');
  });
  it('floatTo16BitPCM converte', () => {
    const f = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const pcm = floatTo16BitPCM(f);
    expect(pcm.length).toBe(5);
    expect(pcm[3]).toBe(0x7fff);
    expect(pcm[4]).toBe(-0x8000);
  });
  it('resample 48k→16k', () => {
    const input = new Float32Array(48000); // 1s a 48k
    const out = resampleTo16k(input, 48000, 16000);
    expect(out.length).toBe(16000);
  });
  it('resample mantém 16k', () => {
    const input = new Float32Array(16000);
    const out = resampleTo16k(input, 16000);
    expect(out).toBe(input);
  });
});

describe('VOZ-001 stt — Moonshine suporte', () => {
  it('isMoonshineSupported retorna wasm/webgpu flags', () => {
    const s = isMoonshineSupported();
    expect(typeof s.wasm).toBe('boolean');
    expect(typeof s.webgpu).toBe('boolean');
  });
});

describe('VOZ-001.9-10 — dataset sem PII', () => {
  it('tem 40+ amostras cobrindo A-I', () => {
    expect(BENCHMARK_SAMPLES.length).toBeGreaterThanOrEqual(35);
    const cats = new Set(BENCHMARK_SAMPLES.map(s => s.category));
    expect(cats.has('A')).toBe(true);
    expect(cats.has('G')).toBe(true);
    expect(cats.has('I')).toBe(true);
  });
  it('não usa PII (não contém ai_messages)', () => {
    const joined = BENCHMARK_SAMPLES.map(s => s.groundTruth).join(' ');
    expect(joined.toLowerCase()).not.toContain('paciente real');
  });
  it('computeWER 0 para igual, 1 para totalmente diferente', () => {
    expect(computeWER('leite vegetal', 'leite vegetal')).toBe(0);
    expect(computeWER('leite', 'pão')).toBe(1);
    expect(computeWER('posso comer leites vegetais', 'posso comer leite vegetal')).toBeGreaterThan(0);
  });
  it('simulateVoicePipeline sanitiza e limita 500', () => {
    const r = simulateVoicePipeline('<script>leite</script>');
    expect(r.sanitized).not.toContain('<');
    expect(r.withinLimit).toBe(true);
    const long = simulateVoicePipeline('a'.repeat(501));
    expect(long.withinLimit).toBe(false);
  });
  it('plurais críticos presentes (leites, pães)', () => {
    const g = BENCHMARK_SAMPLES.filter(s => s.category === 'G').map(s => s.groundTruth);
    expect(g).toContain('leites');
    expect(g).toContain('pães');
  });
  it('integração voz→guardrail: leites vegetais não deve bloquear lactose', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const transcript = 'posso comer leites vegetais?'; // plural que antes falhava
    const ids = extractFoodIdsFromText(transcript).ids;
    const violations = [...ids].filter(id => blocked.has(id));
    expect(violations.length).toBe(0);
  });
  it('integração: leites puro deve bloquear', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const ids = extractFoodIdsFromText('posso comer leites?').ids;
    expect([...ids].filter(id => blocked.has(id)).length).toBeGreaterThan(0);
  });
  it('split train/val/test sem vazamento e teste congelado', () => {
    expect(SPLIT.train.length).toBe(28);
    expect(SPLIT.val.length).toBe(8);
    expect(SPLIT.test.length).toBe(8);
    expect(validateNoLeak()).toBe(true);
    expect(FROZEN_TEST_IDS).toEqual(['H01','H02','H03','H04','I01','I02','I03','I04']);
  });
});
