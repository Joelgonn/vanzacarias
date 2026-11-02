import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Fase 2.2 — acessibilidade dos hints da jornada.
// Mede o contraste WCAG dos tokens usados no NextBestAction. O hint fica sobre
// branco ou sobre o tint 40% de amber-50/emerald-50 (célula do atalho).

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/dashboard/NextBestAction.tsx'),
  'utf8'
);

type RGB = [number, number, number];

const rgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const luminance = ([r, g, b]: RGB): number => {
  const channel = (value: number) => {
    const x = value / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: RGB, b: RGB): number => {
  const first = luminance(a);
  const second = luminance(b);
  const [high, low] = first > second ? [first, second] : [second, first];
  return (high + 0.05) / (low + 0.05);
};

const tint = (color: RGB, alpha: number, base: RGB = [255, 255, 255]): RGB => [
  Math.round(color[0] * alpha + base[0] * (1 - alpha)),
  Math.round(color[1] * alpha + base[1] * (1 - alpha)),
  Math.round(color[2] * alpha + base[2] * (1 - alpha)),
];

const WHITE = rgb('#ffffff');
const AMBER_TINT = tint(rgb('#fffbeb'), 0.4);
const EMERALD_TINT = tint(rgb('#ecfdf5'), 0.4);
const STONE_500 = rgb('#78716c');
const STONE_400 = rgb('#a8a29e');
const EMERALD_700 = rgb('#047857');

describe('Fase 2.2 — contraste dos hints da jornada', () => {
  it('hint padrão/indisponível usa stone-500 e atinge AA', () => {
    expect(source).toContain("s.done ? 'text-emerald-700' : 'text-stone-500'");
    expect(contrast(STONE_500, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(STONE_500, AMBER_TINT)).toBeGreaterThanOrEqual(4.5);
  });

  it('hint concluído usa emerald-700 e atinge AA', () => {
    expect(contrast(EMERALD_700, EMERALD_TINT)).toBeGreaterThanOrEqual(4.5);
  });

  it('registra o ganho em relação ao token anterior (2,52:1)', () => {
    const before = contrast(STONE_400, WHITE);
    expect(before).toBeLessThan(3);
    expect(contrast(STONE_500, WHITE)).toBeGreaterThan(before);
  });
});
