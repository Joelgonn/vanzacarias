// =============================================================
// Smart Suggestions — CHAT-SUG-002
// Catálogo estruturado + seleção determinística 100% no frontend.
// Sem LLM, sem API nova, sem persistência/localStorage.
// Anti-repetição via lastIds + rotação/seed em memória (sem Date.now).
// =============================================================

export type SuggestionIntent =
  | 'progresso'
  | 'acompanhamento'
  | 'alimentacao'
  | 'habitos'
  | 'planejamento'
  | 'duvidas'
  | 'refeicoes'
  | 'motivacao'
  | 'geral';

export type SuggestionPriority = 1 | 2 | 3;

export interface Suggestion {
  id: string;
  label: string;
  intencao: SuggestionIntent;
  priority: SuggestionPriority;
  /** Ausente = sempre ativa (fallback seguro). */
  ativaSe?: (ctx: SmartSuggestContext) => boolean;
}

// Contexto de sinais usados pelas regras de ativação. Apenas flags de
// presença/estado já existentes no frontend — nenhum dado clínico inventado.
export interface SmartSuggestContext {
  // estado da conversa (sempre disponível no ChatAssistant)
  messagesCount: number;
  lastRole?: 'user' | 'assistant';
  isLoading: boolean;
  // flags do dashboard (opcional, via prop smartContext)
  isPremium?: boolean;
  canAccessMealPlan?: boolean;
  isMealPlanReady?: boolean;
  isCheckinDoneThisWeek?: boolean;
  waterGoal?: number | null;
  waterProgress?: number;
  hasDailyLogToday?: boolean;
  totalMeals?: number | null;
  completedMeals?: number;
  checkinsCount?: number;
  hasCompletedQFA?: boolean;
}

// Subconjunto preenchido pelo Dashboard (tudo opcional; admin não manda nada).
export type SmartSuggestDashboardFlags = Partial<
  Pick<
    SmartSuggestContext,
    | 'isPremium'
    | 'canAccessMealPlan'
    | 'isMealPlanReady'
    | 'isCheckinDoneThisWeek'
    | 'waterGoal'
    | 'waterProgress'
    | 'hasDailyLogToday'
    | 'totalMeals'
    | 'completedMeals'
    | 'checkinsCount'
    | 'hasCompletedQFA'
  >
>;

export interface SmartSuggestOptions {
  /** Seed determinístico p/ shuffle (sem relógio). */
  seed?: number;
  /** Índice de rotação p/ circulação dentro dos grupos de prioridade. */
  rotationIndex?: number;
  /** Ids do último conjunto exibido (anti-repetição imediata). */
  lastIds?: string[];
  /** Quantidade desejada (default 3). */
  count?: number;
}

// catálogo de 12 sugestões — 5 originais preservadas (labels EXATOS):
// evolucao, melhorar_alimentacao, registrar_refeicao, prioridade_dia, analisar_refeicao
export const SUGGESTION_CATALOG: Suggestion[] = [
  { id: 'evolucao', label: 'Como está minha evolução?', intencao: 'progresso', priority: 1 },
  { id: 'prioridade_dia', label: 'O que devo priorizar hoje?', intencao: 'acompanhamento', priority: 1 },
  { id: 'analisar_refeicao', label: 'Analisar uma refeição', intencao: 'alimentacao', priority: 2 },
  { id: 'melhorar_alimentacao', label: 'Como posso melhorar minha alimentação?', intencao: 'habitos', priority: 2 },
  {
    id: 'beber_agua',
    label: 'Como me hidratar melhor hoje?',
    intencao: 'habitos',
    priority: 1,
    ativaSe: (ctx) => ctx.waterProgress !== undefined && ctx.waterProgress < 100,
  },
  { id: 'registrar_refeicao', label: 'Registrar uma refeição', intencao: 'refeicoes', priority: 2 },
  { id: 'dicas_dia_a_dia', label: 'Dicas para vencer as tentações no dia a dia', intencao: 'duvidas', priority: 3 },
  { id: 'substituicoes', label: 'Quais alimentos posso substituir?', intencao: 'planejamento', priority: 2 },
  {
    id: 'proximas_refeicoes',
    label: 'O que devo comer na próxima refeição?',
    intencao: 'refeicoes',
    priority: 1,
    ativaSe: (ctx) => !!ctx.canAccessMealPlan && !!ctx.isMealPlanReady,
  },
  {
    id: 'hidratacao_meta',
    label: 'Qual minha meta de água?',
    intencao: 'geral',
    priority: 3,
    ativaSe: (ctx) => ctx.waterGoal !== undefined && ctx.waterGoal !== null && ctx.waterGoal > 0,
  },
  {
    id: 'checkin_atrasado',
    label: 'Quero fazer meu check-in da semana',
    intencao: 'acompanhamento',
    priority: 1,
    ativaSe: (ctx) => ctx.isCheckinDoneThisWeek === false,
  },
  {
    id: 'tempo_progresso',
    label: 'Estou no caminho certo? Me dê um feed',
    intencao: 'motivacao',
    priority: 2,
    ativaSe: (ctx) => typeof ctx.checkinsCount === 'number' && ctx.checkinsCount > 0,
  },
];

// LCG determinístico (Documented no CHAT-SUG-001 §9). Nunca usa Date.now().
const LCG_MULTIPLIER = 1103515245;
const LCG_INCREMENT = 12345;
const LCG_MODULUS = 2147483648; // 2^31

function nextLcg(seed: number): number {
  return (seed * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
}

export function deterministicShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let s = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = nextLcg(s);
    const j = Math.floor((s / LCG_MODULUS) * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

function rotate<T>(items: readonly T[], offset: number): T[] {
  if (items.length <= 1 || offset === 0) return [...items];
  const k = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(k), ...items.slice(0, k)];
}

// Diversidade de intenção: evita 3 sugestões da mesma intenção no topo quando
// existir alternativa de intenção diferente ativa.
function applyIntentDiversity(ordered: readonly Suggestion[], targetCount: number): Suggestion[] {
  const result: Suggestion[] = [];
  const usedIntents = new Set<string>();
  const remaining = [...ordered];
  for (let i = 0; i < targetCount; i++) {
    const idx = remaining.findIndex((s) => !usedIntents.has(s.intencao));
    const pick = remaining.splice(idx === -1 ? 0 : idx, 1)[0];
    if (!pick) break;
    usedIntents.add(pick.intencao);
    result.push(pick);
  }
  return result;
}

// Integridade do catálogo — falha rápido se inviável (nunca retornar < count
// silenciosamente). `minCount` default 3.
export function validateCatalog(catalog: readonly Suggestion[] = SUGGESTION_CATALOG, minCount = 3): string[] {
  const errors: string[] = [];
  if (!Array.isArray(catalog) || catalog.length === 0) {
    errors.push('catalog must be a non-empty array');
    return errors;
  }
  const seen = new Map<string, number>();
  catalog.forEach((s, i) => {
    if (!s || typeof s.id !== 'string' || s.id.length === 0) errors.push(`[${i}] missing/empty id`);
    else if (seen.has(s.id)) errors.push(`duplicate id "${s.id}" at index ${i} (first at ${seen.get(s.id)})`);
    else seen.set(s.id, i);
    if (!s || typeof s.label !== 'string' || s.label.trim().length === 0) errors.push(`[${i}] empty label`);
    if (!s || typeof s.priority !== 'number' || s.priority < 1 || s.priority > 3)
      errors.push(`[${i}] "${s?.id ?? ''}": priority must be 1..3`);
    if (s && s.ativaSe !== undefined && typeof s.ativaSe !== 'function')
      errors.push(`[${i}] "${s.id}": ativaSe must be a function`);
  });
  const alwaysActiveCount = catalog.filter((s) => s.ativaSe === undefined).length;
  if (alwaysActiveCount < minCount)
    errors.push(`catalog must have at least ${minCount} always-active suggestions (found ${alwaysActiveCount})`);
  return errors;
}

export function assertCatalogIntegrity(catalog: readonly Suggestion[] = SUGGESTION_CATALOG, minCount = 3): void {
  const errors = validateCatalog(catalog, minCount);
  if (errors.length > 0) throw new Error(`[smartSuggestions] catalog integrity failure:\n- ${errors.join('\n- ')}`);
}

// Seleção pura e determinística. Garante exatamente `count` (default 3).
export function selectSuggestions(ctx: SmartSuggestContext, opts?: SmartSuggestOptions): Suggestion[] {
  const targetCount = opts?.count ?? 3;
  if (targetCount < 1) throw new Error('[smartSuggestions] count must be >= 1');
  if (targetCount > SUGGESTION_CATALOG.length)
    throw new Error('[smartSuggestions] count cannot exceed catalog size');
  assertCatalogIntegrity(SUGGESTION_CATALOG, targetCount);

  const lastIds = opts?.lastIds ?? [];
  const seed = opts?.seed ?? 0;
  const rotationIndex = opts?.rotationIndex ?? 0;

  const active = SUGGESTION_CATALOG.filter((s) => !s.ativaSe || s.ativaSe(ctx));
  const excludedLast = active.filter((s) => !lastIds.includes(s.id));

  let candidates: Suggestion[];
  if (excludedLast.length >= targetCount) {
    candidates = excludedLast;
  } else {
    // Reinsere sempre-ativas que saíram apenas pela anti-repetição, na ordem de
    // prioridade; depois completa com o restante das ativas (dedupe por id).
    const union = [...excludedLast];
    const inUnion = new Set(union.map((s) => s.id));
    const refillable = active.filter((s) => s.ativaSe === undefined && lastIds.includes(s.id));
    for (const s of refillable) {
      if (!inUnion.has(s.id)) {
        inUnion.add(s.id);
        union.push(s);
      }
    }
    for (const s of active) {
      if (!inUnion.has(s.id)) {
        inUnion.add(s.id);
        union.push(s);
      }
    }
    candidates = union;
  }

  // Ordena por prioridade (P1…P3); dentro de cada grupo aplica rotação + shuffle
  // determinístico com o seed. Invariante: seleção nunca depende do relógio.
  const groups = new Map<number, Suggestion[]>();
  for (const s of candidates) {
    const g = groups.get(s.priority) ?? [];
    g.push(s);
    groups.set(s.priority, g);
  }
  const ordered: Suggestion[] = [];
  for (const priority of [1, 2, 3] as const) {
    const group = groups.get(priority);
    if (!group || group.length === 0) continue;
    const rotated = rotate(group, rotationIndex);
    ordered.push(...deterministicShuffle(rotated, seed + priority * 31));
  }

  return applyIntentDiversity(ordered, targetCount);
}