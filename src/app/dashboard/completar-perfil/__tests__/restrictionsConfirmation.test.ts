import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { podeContinuarEtapaRestricoes } from '../restrictionsConfirmation';

// Sprint UX/UI — confirmação de ausência de restrições alimentares.
// A regra de habilitação é pura e testada diretamente; o restante é verificado
// por inspeção de fonte, padrão já usado em patientJourneyWiring.test.ts.

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/app/dashboard/completar-perfil/page.tsx'),
  'utf8'
);

const submitBlock = source.slice(
  source.indexOf('const handleSubmit'),
  source.indexOf('const nextStep')
);

const restrictionsChangeBlock = source.slice(
  source.indexOf('const handleRestrictionsChange'),
  source.indexOf('if (fetching) return')
);

describe('Confirmação de ausência — regra do botão Continuar', () => {
  it('lista vazia e checkbox desmarcado desabilita Continuar', () => {
    expect(podeContinuarEtapaRestricoes(0, false)).toBe(false);
  });

  it('lista vazia e checkbox marcado habilita Continuar', () => {
    expect(podeContinuarEtapaRestricoes(0, true)).toBe(true);
  });

  it('desmarcar volta a desabilitar Continuar', () => {
    expect(podeContinuarEtapaRestricoes(0, true)).toBe(true);
    expect(podeContinuarEtapaRestricoes(0, false)).toBe(false);
  });

  it('com uma ou mais restrições, Continuar permanece habilitado sem confirmação', () => {
    expect(podeContinuarEtapaRestricoes(1, false)).toBe(true);
    expect(podeContinuarEtapaRestricoes(5, false)).toBe(true);
  });
});

describe('Confirmação de ausência — reset e apresentação', () => {
  it('a confirmação só aparece quando a lista está vazia', () => {
    expect(source).toContain('{foodRestrictions.length === 0 && (');
    expect(source).toContain(
      'Não tenho restrições, alergias ou intolerâncias a declarar.'
    );
  });

  it('checkbox é acessível por label, id e descrição', () => {
    expect(source).toContain('htmlFor="confirmar-sem-restricoes"');
    expect(source).toContain('id="confirmar-sem-restricoes"');
    expect(source).toContain('type="checkbox"');
    expect(source).toContain('aria-describedby="confirmar-sem-restricoes-ajuda"');
    expect(source).toContain('id="confirmar-sem-restricoes-ajuda"');
    expect(source).not.toContain('text-stone-400">\n                Não tenho');
  });

  it('o estado vive em CompletarPerfil e não é persistido', () => {
    expect(source).toContain(
      'const [confirmouAusencia, setConfirmouAusencia] = useState(false);'
    );
    expect(source).not.toContain('food_restrictions: confirmouAusencia');
    expect(submitBlock).not.toContain('confirmouAusencia');
  });

  it('qualquer mudança na lista reseta a confirmação para desmarcado', () => {
    expect(source).toContain('const handleRestrictionsChange = (next: FoodRestriction[]) => {');
    expect(restrictionsChangeBlock).toContain('setFoodRestrictions(next);');
    expect(restrictionsChangeBlock).toContain('setConfirmouAusencia(false);');
    expect(source).toContain('setFoodRestrictions={handleRestrictionsChange}');
  });

  it('Continuar usa a regra e possui estado visual desabilitado', () => {
    expect(source).toContain(
      'const podeContinuar = podeContinuarEtapaRestricoes(foodRestrictions.length, confirmouAusencia);'
    );
    expect(source).toContain('disabled={!podeContinuar}');
    expect(source).toContain('disabled:opacity-50 disabled:cursor-not-allowed');
  });
});

describe('Confirmação de ausência — preservação funcional', () => {
  it('handleSubmit e o payload original permanecem intactos', () => {
    expect(submitBlock).toContain('.update({');
    expect(submitBlock).toContain('food_restrictions: foodRestrictions,');
    expect(submitBlock).toContain("if (error || !data)");
    expect(submitBlock).toContain('resolveNextOnboardingRoute(supabase, session.user.id)');
  });

  it('Finalizar continua dependendo apenas de loading', () => {
    expect(source).toContain('disabled={loading}');
    expect(source).not.toContain('disabled={loading || !podeContinuar}');
  });
});
