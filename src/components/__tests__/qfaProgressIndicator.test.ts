import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Sprint QFA — verificação estrutural do indicador de progresso.
// Cobre a causa raiz do sticky (overflow do ancestral), o offset da barra,
// a semântica acessível, o contraste e o respeito a movimento reduzido.
// O comportamento de rolagem real exige validação manual/E2E.

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const navigation = read('src/components/NavigationWrapper.tsx');
const qfa = read('src/components/QFAForm.tsx');

describe('QFA — overflow horizontal condicional na rota do QFA', () => {
  it('usa overflow-x-clip apenas quando isPanel é verdadeiro', () => {
    expect(navigation).toContain(
      "const horizontalOverflow = isPanel ? 'overflow-x-clip' : 'overflow-x-hidden';",
    );
    expect(navigation).toContain('selection:text-white ${horizontalOverflow}');
  });

  it('não mantém overflow-x-hidden fixo no wrapper', () => {
    expect(navigation).not.toMatch(/selection:text-white overflow-x-hidden/);
  });
});

describe('QFA — posicionamento do indicador', () => {
  it('é sticky no topo sem o offset de 80px do Header', () => {
    expect(qfa).toContain('sticky top-0 z-40');
    expect(qfa).not.toContain('md:top-20');
  });

  it('usa fundo opaco o suficiente para a sobreposição do sticky', () => {
    expect(qfa).toContain('bg-white/95');
  });
});

describe('QFA — semântica acessível do progresso', () => {
  for (const attribute of [
    'role="progressbar"',
    'aria-valuemin={0}',
    'aria-valuemax={100}',
    'aria-valuenow={displayProgress}',
    'aria-valuetext={`${displayProgress}% concluído`}',
    'aria-label="Progresso do Raio-X Alimentar"',
  ]) {
    it(`declara ${attribute}`, () => {
      expect(qfa).toContain(attribute);
    });
  }

  it('limita o percentual exibido ao intervalo de 0 a 100', () => {
    expect(qfa).toContain(
      'const displayProgress = Math.min(100, Math.max(0, progress));',
    );
    expect(qfa).not.toContain('progress > 100');
  });

  it('não anuncia cada atualização com aria-live', () => {
    expect(qfa).not.toContain('aria-live');
  });
});

describe('QFA — contraste e movimento reduzido', () => {
  it('usa cores de texto e preenchimento com contraste suficiente', () => {
    expect(qfa).toContain('text-emerald-700');
    expect(qfa).toContain('text-stone-600');
    expect(qfa).toContain('bg-emerald-600');
  });

  it('desativa as transições quando o usuário prefere movimento reduzido', () => {
    const matches = qfa.match(/motion-reduce:transition-none/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
