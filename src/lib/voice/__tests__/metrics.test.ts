import { describe, it, expect } from 'vitest';
import { computeWER, computeCER, normalizeText, computeRTF } from '../metrics';

describe('WER', () => {
  it('referência == hipótese → 0', () => {
    expect(computeWER('leite vegetal', 'leite vegetal')).toBe(0);
  });
  it('hipótese vazia → 1', () => {
    expect(computeWER('leite vegetal', '')).toBe(1);
  });
  it('referência vazia + hipótese vazia → 0', () => {
    expect(computeWER('', '')).toBe(0);
  });
  it('substituição', () => {
    expect(computeWER('leite vegetal', 'leite mineral')).toBe(0.5);
  });
  it('deleção', () => {
    expect(computeWER('leite vegetal', 'leite')).toBe(0.5);
  });
  it('inserção', () => {
    expect(computeWER('leite', 'leite vegetal')).toBe(1);
  });
  it('múltiplos erros', () => {
    expect(computeWER('a b c', 'x y z')).toBe(1);
  });
});

describe('CER', () => {
  it('igual → 0', () => {
    expect(computeCER('leite', 'leite')).toBe(0);
  });
  it('vazia → 1 ou 0', () => {
    expect(computeCER('', '')).toBe(0);
    expect(computeCER('leite', '')).toBe(1);
  });
  it('substituição 1 char', () => {
    expect(computeCER('leite', 'leita')).toBeCloseTo(0.2, 2);
  });
});

describe('Normalização', () => {
  it('acentuação', () => {
    expect(normalizeText('pães')).toBe('paes');
    expect(normalizeText('Açúcar')).toBe('acucar');
  });
  it('pontuação', () => {
    expect(normalizeText('Oi, tudo bem?')).toBe('oi tudo bem');
  });
  it('espaços', () => {
    expect(normalizeText('  leite   vegetal  ')).toBe('leite vegetal');
  });
  it('maiúsculas/minúsculas', () => {
    expect(normalizeText('Leite VEGETAL')).toBe('leite vegetal');
  });
});

describe('RTF', () => {
  it('RTF <1 mais rápido que tempo real', () => {
    expect(computeRTF(500, 1000)).toBe(0.5);
  });
  it('RTF =1 tempo real', () => {
    expect(computeRTF(1000, 1000)).toBe(1);
  });
  it('RTF >1 mais lento', () => {
    expect(computeRTF(1500, 1000)).toBe(1.5);
  });
  it('casos extremos audio 0', () => {
    expect(computeRTF(100, 0)).toBe(0);
  });
});
