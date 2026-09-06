import { describe, expect, it } from 'vitest';
import {
  SUGGESTION_CATALOG,
  selectSuggestions,
  validateCatalog,
  assertCatalogIntegrity,
  deterministicShuffle,
  type SmartSuggestContext,
  type Suggestion,
} from '../smartSuggestions';

const baseCtx = (overrides: Partial<SmartSuggestContext> = {}): SmartSuggestContext => ({
  messagesCount: 0,
  isLoading: false,
  ...overrides,
});

const idsOf = (s: Suggestion[]) => s.map((x) => x.id);

const ORIGINAL_LABELS = [
  'Como está minha evolução?',
  'Como posso melhorar minha alimentação?',
  'Registrar uma refeição',
  'O que devo priorizar hoje?',
  'Analisar uma refeição',
];

describe('SUGGESTION_CATALOG — integridade', () => {
  it('catálogo tem exatamente 12 sugestões', () => {
    expect(SUGGESTION_CATALOG).toHaveLength(12);
  });

  it('todos os ids são únicos', () => {
    const ids = idsOf(SUGGESTION_CATALOG);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todas as sugestões têm label não-vazio, prioridade 1..3 e intencao válida', () => {
    const validIntents = new Set([
      'progresso',
      'acompanhamento',
      'alimentacao',
      'habitos',
      'planejamento',
      'duvidas',
      'refeicoes',
      'motivacao',
      'geral',
    ]);
    for (const s of SUGGESTION_CATALOG) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(s.priority);
      expect(validIntents.has(s.intencao)).toBe(true);
    }
  });

  it('preserva exatamente os 5 labels originais validados', () => {
    const labels = SUGGESTION_CATALOG.map((s) => s.label);
    for (const original of ORIGINAL_LABELS) {
      expect(labels).toContain(original);
    }
    expect(labels).toEqual(expect.arrayContaining(ORIGINAL_LABELS));
  });

  it('tem pelo menos 3 sempre-ativas (ativaSe undefined) — invariante do fallback', () => {
    const alwaysActive = SUGGESTION_CATALOG.filter((s) => s.ativaSe === undefined);
    expect(alwaysActive.length).toBeGreaterThanOrEqual(3);
  });

  it('sugestões contextualizadas só ativam com o sinal presente (conservador)', () => {
    const byId = new Map(SUGGESTION_CATALOG.map((s) => [s.id, s]));
    const noFlags = baseCtx();
    expect(byId.get('beber_agua')!.ativaSe!(noFlags)).toBe(false);
    expect(byId.get('proximas_refeicoes')!.ativaSe!(noFlags)).toBe(false);
    expect(byId.get('hidratacao_meta')!.ativaSe!(noFlags)).toBe(false);
    expect(byId.get('checkin_atrasado')!.ativaSe!(noFlags)).toBe(false);
    expect(byId.get('tempo_progresso')!.ativaSe!(noFlags)).toBe(false);
  });

  it('fail-fast: validateCatalog acusa catálogo inviável', () => {
    const broken: Suggestion[] = [
      { id: 'a', label: 'A', intencao: 'geral', priority: 1 },
      { id: 'a', label: 'B', intencao: 'geral', priority: 1 },
      { id: '', label: 'C', intencao: 'geral', priority: 1 },
      { id: 'd', label: '   ', intencao: 'geral', priority: 1 },
      { id: 'e', label: 'E', intencao: 'geral', priority: 2, ativaSe: () => true },
    ];
    const errors = validateCatalog(broken, 3);
    expect(errors.some((e) => e.includes('duplicate id "a"'))).toBe(true);
    expect(errors.some((e) => e.includes('missing/empty id'))).toBe(true);
    expect(errors.some((e) => e.includes('empty label'))).toBe(true);
  });

  it('fail-fast: prioridade fora de 1..3 é inválida (aceita em runtime via cast)', () => {
    const invalid = ({ ...SUGGESTION_CATALOG[0], priority: 9 } as unknown) as Suggestion;
    const errors = validateCatalog([invalid], 1);
    expect(errors.some((e) => e.includes('priority must be 1..3'))).toBe(true);
  });

  it('fail-fast: < 3 sempre-ativas é inviável (throw em dev/test)', () => {
    const few: Suggestion[] = [
      { id: 'x', label: 'X', intencao: 'geral', priority: 1, ativaSe: () => true },
      { id: 'y', label: 'Y', intencao: 'geral', priority: 1 },
      { id: 'z', label: 'Z', intencao: 'geral', priority: 1 },
    ];
    expect(validateCatalog(few, 3)).toEqual(
      expect.arrayContaining([expect.stringContaining('at least 3 always-active')])
    );
    expect(() => assertCatalogIntegrity(few, 3)).toThrow(/catalog integrity failure/);
  });
});

describe('selectSuggestions — seleção pura', () => {
  it('retorna exatamente 3 em contexto vazio/válido', () => {
    const result = selectSuggestions(baseCtx());
    expect(result).toHaveLength(3);
    expect(new Set(idsOf(result)).size).toBe(3);
  });

  it('contexto sem flags vira fallback sempre-ativo (3 itens sempre-ativos)', () => {
    const result = selectSuggestions(baseCtx());
    expect(result.every((s) => s.ativaSe === undefined)).toBe(true);
    expect(idsOf(result)).toEqual(expect.arrayContaining(['evolucao', 'prioridade_dia']));
  });

  it('é determinística: mesma entrada → mesma saída', () => {
    const ctx = baseCtx();
    expect(selectSuggestions(ctx)).toEqual(selectSuggestions(ctx));
    expect(selectSuggestions(ctx, { seed: 7, rotationIndex: 2 })).toEqual(
      selectSuggestions(ctx, { seed: 7, rotationIndex: 2 })
    );
  });

  it('prioridade P1 entra antes quando disponível', () => {
    const result = selectSuggestions(baseCtx());
    expect(result.some((s) => s.priority === 1)).toBe(true);
    expect(result[0].priority).toBe(1);
  });

  it('não agrupa 3 sugestões da mesma intenção quando há alternativas', () => {
    const result = selectSuggestions(baseCtx());
    expect(new Set(result.map((s) => s.intencao)).size).toBe(3);
  });

  it('lança erro se count inválido (fail-fast)', () => {
    expect(() => selectSuggestions(baseCtx(), { count: 0 })).toThrow(/count must be >= 1/);
    expect(() => selectSuggestions(baseCtx(), { count: 999 })).toThrow(/cannot exceed catalog size/);
  });
});

describe('selectSuggestions — regras de ativação (ativaSe)', () => {
  it('beber_agua aparece com hidratação abaixo da meta e sai com meta completa/ausente', () => {
    expect(idsOf(selectSuggestions(baseCtx({ waterProgress: 50 })))).toContain('beber_agua');
    expect(idsOf(selectSuggestions(baseCtx({ waterProgress: 100 })))).not.toContain('beber_agua');
    expect(idsOf(selectSuggestions(baseCtx({})))).not.toContain('beber_agua');
  });

  it('proximas_refeicoes só ativa com plano + acesso (sem vazamento de Premium)', () => {
    expect(
      idsOf(selectSuggestions(baseCtx({ canAccessMealPlan: true, isMealPlanReady: true })))
    ).toContain('proximas_refeicoes');
    expect(
      idsOf(selectSuggestions(baseCtx({ canAccessMealPlan: false, isMealPlanReady: true })))
    ).not.toContain('proximas_refeicoes');
    expect(
      idsOf(selectSuggestions(baseCtx({ canAccessMealPlan: true, isMealPlanReady: false })))
    ).not.toContain('proximas_refeicoes');
  });

  it('checkin_atrasado ativa só quando ainda não fez o check-in da semana', () => {
    const item = SUGGESTION_CATALOG.find((s) => s.id === 'checkin_atrasado')!;
    expect(item.ativaSe!(baseCtx({ isCheckinDoneThisWeek: false }))).toBe(true);
    expect(item.ativaSe!(baseCtx({ isCheckinDoneThisWeek: true }))).toBe(false);
    expect(item.ativaSe!(baseCtx({}))).toBe(false);
    // integração: mesma intenção de prioridade_dia (acompanhamento) — só entra
    // no topo 3 quando prioridade_dia sai da rotação/anti-repetição
    const result = idsOf(
      selectSuggestions(baseCtx({ isCheckinDoneThisWeek: false }), {
        lastIds: ['prioridade_dia', 'evolucao', 'analisar_refeicao'],
      })
    );
    expect(result).toContain('checkin_atrasado');
  });

  it('hidratacao_meta ativa só com meta de água presente', () => {
    const item = SUGGESTION_CATALOG.find((s) => s.id === 'hidratacao_meta')!;
    expect(item.ativaSe!(baseCtx({ waterGoal: 2000 }))).toBe(true);
    expect(item.ativaSe!(baseCtx({ waterGoal: 0 }))).toBe(false);
    expect(item.ativaSe!(baseCtx({ waterGoal: null }))).toBe(false);
    expect(item.ativaSe!(baseCtx({}))).toBe(false);
  });

  it('tempo_progresso ativa só com check-ins registrados', () => {
    const item = SUGGESTION_CATALOG.find((s) => s.id === 'tempo_progresso')!;
    expect(item.ativaSe!(baseCtx({ checkinsCount: 3 }))).toBe(true);
    expect(item.ativaSe!(baseCtx({ checkinsCount: 0 }))).toBe(false);
    expect(item.ativaSe!(baseCtx({}))).toBe(false);
  });
});

describe('selectSuggestions — anti-repetição', () => {
  it('lastIds: segundo conjunto não repete o primeiro', () => {
    const ctx = baseCtx();
    const first = idsOf(selectSuggestions(ctx));
    const second = idsOf(selectSuggestions(ctx, { lastIds: first }));
    expect(second).toHaveLength(3);
    for (const id of first) {
      expect(second).not.toContain(id);
    }
  });

  it('lastIds bloqueando sempre-ativas ainda seleciona 3 se houver alternativas ativas', () => {
    const ctx = baseCtx({ waterProgress: 50 });
    const blocked = idsOf(selectSuggestions(ctx));
    const next = selectSuggestions(ctx, { lastIds: blocked });
    expect(next).toHaveLength(3);
    for (const id of blocked) {
      expect(idsOf(next)).not.toContain(id);
    }
  });

  it('rotação altera a ordem dentro do grupo (mesmo conjunto vazio)', () => {
    const a = idsOf(selectSuggestions(baseCtx(), { seed: 0, rotationIndex: 0 }));
    const b = idsOf(selectSuggestions(baseCtx(), { seed: 0, rotationIndex: 1 }));
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    expect(a.join(',')).not.toBe(b.join(','));
  });

  it('seed diferente produz ordem determinística porém diferente', () => {
    const a = idsOf(selectSuggestions(baseCtx(), { seed: 0 }));
    const b = idsOf(selectSuggestions(baseCtx(), { seed: 1 }));
    expect(a).not.toEqual(b);
  });
});

describe('deterministicShuffle — PRNG sem relógio', () => {
  it('mesmo seed → mesma ordem; seeds diferentes → ordem distinta', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    expect(deterministicShuffle(items, 42)).toEqual(deterministicShuffle(items, 42));
    const s1 = deterministicShuffle(items, 42);
    const s2 = deterministicShuffle(items, 43);
    const different = s1.some((x, i) => x !== s2[i]);
    const shuffled = s1.some((x, i) => x !== items[i]);
    expect(different).toBe(true);
    expect(shuffled).toBe(true);
  });
});