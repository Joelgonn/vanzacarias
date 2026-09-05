import { describe, it, expect } from 'vitest';
import { normalizePcm, trimSilence } from '../audio/normalize';

describe('VOZ-010 — normalizePcm', () => {
  it('não altera PCM vazio', () => {
    const pcm = new Float32Array(0);
    expect(normalizePcm(pcm)).toBe(pcm);
  });

  it('não altera PCM com pico já alto (>=0.5)', () => {
    const pcm = new Float32Array([0.6, -0.6, 0.3]);
    const out = normalizePcm(pcm);
    // Pico 0.6 >=0.5, apenas DC removal se necessário (mean 0.1, então deve remover DC)
    // Neste caso mean = 0.1, newPeak após DC = 0.5, ainda >=0.5, então deve apenas remover DC
    expect(out[0]).toBeCloseTo(0.5, 5);
  });

  it('normaliza pico baixo <0.5 para 0.9', () => {
    const pcm = new Float32Array([0.2, -0.2, 0.1]);
    const out = normalizePcm(pcm);
    // Peak original 0.2, mean ~0.033, newPeak ~0.233, gain = 0.9/0.233 ≈3.86, peak deve ir para ~0.9
    let peak = 0;
    for (const v of out) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeCloseTo(0.9, 2);
  });

  it('remove DC offset', () => {
    const pcm = new Float32Array([0.5, 0.5, 0.5]); // DC 0.5
    const out = normalizePcm(pcm);
    // Após remover DC, todos devem ser ~0
    for (const v of out) expect(v).toBeCloseTo(0, 5);
  });

  it('não amplifica silêncio (peak <0.01)', () => {
    const pcm = new Float32Array([0.005, -0.005, 0.003]);
    const out = normalizePcm(pcm);
    // Peak 0.005 <0.01, deve retornar sem amplificar (apenas DC)
    let peak = 0;
    for (const v of out) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThan(0.01);
  });

  it('clampa para [-1, 1] após ganho', () => {
    const pcm = new Float32Array([0.4, -0.4]);
    const out = normalizePcm(pcm);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('VOZ-010 — trimSilence', () => {
  it('não altera PCM vazio', () => {
    const pcm = new Float32Array(0);
    expect(trimSilence(pcm, 16000).length).toBe(0);
  });

  it('não trim quando silêncio <500ms', () => {
    // 400ms de silêncio no início (4 windows) + 1s voz
    const pcm = new Float32Array(16000 * 1.4); // 1.4s
    // Primeiros 400ms silêncio (0), resto 1s com 0.5
    for (let i = 6400; i < pcm.length; i++) pcm[i] = 0.5;
    const trimmed = trimSilence(pcm, 16000);
    // Deve manter tudo (silêncio <500ms não trim)
    expect(trimmed.length).toBe(pcm.length);
  });

  it('trim silêncio excessivo >500ms no início, mantendo 200ms', () => {
    // 800ms silêncio + 1s voz + 800ms silêncio = 2.6s
    const pcm = new Float32Array(16000 * 2.6);
    for (let i = 12800; i < 12800 + 16000; i++) pcm[i] = 0.5; // 1s voz no meio
    const trimmed = trimSilence(pcm, 16000);
    // Deve trimar 600ms do início (800-200) e 600ms do fim, total 1.2s removido
    expect(trimmed.length).toBeLessThan(pcm.length);
    expect(trimmed.length).toBeGreaterThan(16000); // ainda tem voz
  });

  it('não trim quando todo silêncio', () => {
    const pcm = new Float32Array(16000).fill(0);
    const trimmed = trimSilence(pcm, 16000);
    expect(trimmed.length).toBe(pcm.length);
  });

  it('preserva pausas internas curtas', () => {
    // Voz com pausa interna 300ms (<500ms) não deve ser removida
    const pcm = new Float32Array(16000 * 2); // 2s
    // 0.5s voz, 0.3s silêncio, 0.5s voz, resto silêncio 0.7s
    for (let i = 0; i < 8000; i++) pcm[i] = 0.5;
    for (let i = 8000 + 4800; i < 8000 + 4800 + 8000; i++) pcm[i] = 0.5;
    const trimmed = trimSilence(pcm, 16000);
    // Não deve trimar pausa interna, apenas talvez trailing
    expect(trimmed.length).toBeGreaterThan(16000);
  });
});
