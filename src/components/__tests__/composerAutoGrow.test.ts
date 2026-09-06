import { describe, it, expect } from 'vitest';
import { autoGrowHeight, AUTO_GROW_MAX_HEIGHT, estimateLines } from '../composerAutoGrow';

// CHAT-UX-008 — T-AUTOGROW-01..10: lógica pura do auto-grow.
// Contrato: scrollHeight (conteúdo medido pelo browser após commit) cresce a
// cada linha nova → heightPx cresce até AUTO_GROW_MAX_HEIGHT; overflow interno
// SOMENTE quando scrollHeight > limite. Valores de referência de comportamento
// (linhas × ~24px + padding): 1→44, 2→68, 3→92, 4→116, 5→140 (medir no device).

describe('CHAT-UX-008 — auto-grow (lógica pura)', () => {
  it('T-AUTOGROW-01 — textarea vazio: altura 0 e sem scroll (overflow hidden)', () => {
    const r = autoGrowHeight(0);
    expect(r.heightPx).toBe(0);
    expect(r.overflowY).toBe('hidden');
    // CSS min-h-[44px] do componente garante a altura mínima visual de toque.
  });

  it('T-AUTOGROW-02 — 1 linha (scrollHeight≈44) → altura 44, sem scroll', () => {
    const r = autoGrowHeight(44);
    expect(r.heightPx).toBe(44);
    expect(r.overflowY).toBe('hidden');
  });

  it('T-AUTOGROW-03 — 2 linhas (≈68) → cresce para 68, sem scroll', () => {
    const r = autoGrowHeight(68);
    expect(r.heightPx).toBe(68);
    expect(r.overflowY).toBe('hidden');
  });

  it('T-AUTOGROW-04 — 3 linhas (≈92) → cresce para 92, sem scroll', () => {
    const r = autoGrowHeight(92);
    expect(r.heightPx).toBe(92);
    expect(r.overflowY).toBe('hidden');
  });

  it('T-AUTOGROW-05 — 4 linhas (≈116) → cresce para 116, sem scroll', () => {
    const r = autoGrowHeight(116);
    expect(r.heightPx).toBe(116);
    expect(r.overflowY).toBe('hidden');
  });

  it('T-AUTOGROW-06 — 5 linhas (≈140) → cresce para 140, sem scroll', () => {
    const r = autoGrowHeight(140);
    expect(r.heightPx).toBe(140);
    expect(r.overflowY).toBe('hidden');
  });

  it('T-AUTOGROW-07 — conteúdo acima de 200px → altura travada no limite (200)', () => {
    const r = autoGrowHeight(260);
    expect(r.heightPx).toBe(AUTO_GROW_MAX_HEIGHT);
    expect(r.heightPx).toBe(200);
  });

  it('T-AUTOGROW-08 — scroll interno SOMENTE depois do limite (scrollHeight > 200)', () => {
    expect(autoGrowHeight(200).overflowY).toBe('hidden'); // exatamente no limite: sem scroll
    expect(autoGrowHeight(201).overflowY).toBe('auto'); // acima: scroll interno
    expect(autoGrowHeight(300).overflowY).toBe('auto');
  });

  it('T-AUTOGROW-09 — apagar conteúdo reduz a altura (crescimento progressivo reversível)', () => {
    const cinco = autoGrowHeight(140);
    const tres = autoGrowHeight(92);
    const um = autoGrowHeight(44);
    expect(tres.heightPx).toBeLessThan(cinco.heightPx);
    expect(um.heightPx).toBeLessThan(tres.heightPx);
    expect(autoGrowHeight(44).heightPx).toBe(44);
  });

  it('T-AUTOGROW-10 — monotonía 1→5→limite e entradas inválidas seguras', () => {
    const seq = [44, 68, 92, 116, 140, 200, 260].map((s) => autoGrowHeight(s).heightPx);
    for (let i = 1; i < seq.length - 1; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    expect(seq[seq.length - 1]).toBe(200); // clamp no teto
    // NaN/negativo → tratado como vazio (0, sem scroll)
    expect(autoGrowHeight(Number.NaN).heightPx).toBe(0);
    expect(autoGrowHeight(-5).heightPx).toBe(0);
    expect(autoGrowHeight(Number.NaN).overflowY).toBe('hidden');
    // estimateLines (diagnóstico): 140px ≈ 5 linhas
    expect(estimateLines(140)).toBe(5);
  });
});
