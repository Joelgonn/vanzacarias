import { FOOD_REGISTRY } from '@/lib/foodRegistry';

function normalizeString(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// JG-001.4 — pluralização conservadora (sem NLP pesado)
// Regras PT-BR mínimas: leite→leites (+s), peixe→peixes (+s), pao→paes (ao→aes),
// vegetal→vegetais (l→is), amendoim→amendoins (m→ns handled), etc.
function singularToPluralVariants(word: string): string[] {
  const variants = new Set<string>();
  if (word.endsWith('ao')) {
    variants.add(word.slice(0, -2) + 'aes');
  }
  if (word.endsWith('m')) {
    variants.add(word.slice(0, -1) + 'ns');
  }
  if (word.endsWith('l')) {
    variants.add(word.slice(0, -1) + 'is');
  }
  variants.add(word + 's');
  variants.add(word + 'es');
  return [...variants];
}

function aliasPluralVariants(aliasNorm: string): string[] {
  if (!aliasNorm.includes(' ')) {
    return singularToPluralVariants(aliasNorm);
  }
  const words = aliasNorm.split(' ');
  const pluralWords = words.map(w => {
    if (w.endsWith('ao')) return w.slice(0, -2) + 'aes';
    if (w.endsWith('m')) return w.slice(0, -1) + 'ns';
    if (w.endsWith('l')) return w.slice(0, -1) + 'is';
    if (/[rszn]$/.test(w)) return w + 'es';
    return w + 's';
  });
  const variants = new Set<string>([pluralWords.join(' ')]);
  const lastPlural = singularToPluralVariants(words[words.length - 1])[0];
  variants.add([...words.slice(0, -1), lastPlural].join(' '));
  return [...variants];
}

const SEMANTIC_DICT = new Map<string, Set<string>>();

FOOD_REGISTRY.forEach(food => {
  const keys = [food.name, ...food.aliases].map(normalizeString);
  keys.forEach(key => {
    if (!SEMANTIC_DICT.has(key)) SEMANTIC_DICT.set(key, new Set());
    SEMANTIC_DICT.get(key)!.add(food.id);
    for (const plural of aliasPluralVariants(key)) {
      if (!SEMANTIC_DICT.has(plural)) SEMANTIC_DICT.set(plural, new Set());
      SEMANTIC_DICT.get(plural)!.add(food.id);
    }
  });
});

const SORTED_ALIASES = Array.from(SEMANTIC_DICT.keys()).sort((a, b) => b.length - a.length);

const SAFE_PHRASES_BASE = [
  'leite vegetal', 'leite de amendoa', 'leite de amendoas', 'leite de coco', 'leite de soja', 'leite de aveia',
  'zero lactose', 'sem lactose', 'isento de lactose', 'nolac', 'pasta de amendoim', 'manteiga de amendoim',
  'queijo vegano', 'iogurte vegano', 'queijo vegetal', 'iogurte vegetal',
];

const SAFE_PHRASES: string[] = (() => {
  const set = new Set<string>(SAFE_PHRASES_BASE);
  for (const base of SAFE_PHRASES_BASE) {
    const norm = normalizeString(base);
    for (const plural of aliasPluralVariants(norm)) {
      set.add(plural);
    }
  }
  return [...set];
})();

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractFoodIdsFromText(text: string): { ids: Set<string>; names: string[] } {
  let normalizedText = normalizeString(text);
  for (const safe of SAFE_PHRASES) {
    const safeRegex = new RegExp(`\\b${escapeRegExp(normalizeString(safe))}\\b`, 'g');
    normalizedText = normalizedText.replace(safeRegex, '[safe_phrase]');
  }
  const foundIds = new Set<string>();
  const foundNames = new Set<string>();
  for (const alias of SORTED_ALIASES) {
    const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i');
    if (regex.test(normalizedText)) {
      const ids = SEMANTIC_DICT.get(alias)!;
      ids.forEach(id => foundIds.add(id));
      foundNames.add(alias);
      normalizedText = normalizedText.replace(regex, '[found]');
    }
  }
  return { ids: foundIds, names: Array.from(foundNames) };
}

// Re-export for testing the dict size if needed
export { SEMANTIC_DICT, SAFE_PHRASES };
