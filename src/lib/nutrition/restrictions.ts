import { FoodRestriction } from '@/types/patient';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';

export type RestrictionType = 'allergy' | 'intolerance' | 'restriction';

export interface RestrictionInfo {
  type: RestrictionType;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  hoverClass: string;
  icon: string;
  description: string;
}

export interface NormalizedRestriction {
  foodIds: string[];
  type: RestrictionType;
}

/**
 * ==========================================
 * 1. NORMALIZAÇÃO (Nível Profissional)
 * ==========================================
 * Converte qualquer regra (id direto, tag ou string legada) para uma lista exata de foodIds.
 * Elimina a ambiguidade. Ordem de prioridade estrita: foodId > tag > food (legado)
 */
export function normalizeRestriction(r: FoodRestriction): NormalizedRestriction {
  let foodIds: string[] = [];

  if (r.foodId) {
    // 1. Fonte da verdade mais forte: ID direto
    const exists = FOOD_REGISTRY.some(f => f.id === r.foodId);
    
    if (exists) {
      foodIds.push(r.foodId);
    } else {
      console.warn(
        `[Restriction] foodId inválido: ${r.foodId} | restriction:`,
        r
      );
    }
  } else if (r.tag) {
    // 2. Tag: Categoria inteira bloqueada -> mapeia para todos os IDs que possuem a tag
    foodIds = FOOD_REGISTRY.filter(f => f.tags.includes(r.tag as any)).map(f => f.id);
    
    if (foodIds.length === 0) {
      console.warn(
        `[Restriction] tag sem correspondência: ${r.tag} | restriction:`,
        r
      );
    }
  } else if (r.food) {
    // 3. Fallback legado: Varre o registry fazendo fuzzy match em name e aliases
    const searchTerm = r.food.toLowerCase();
    foodIds = FOOD_REGISTRY.filter(f => {
      const matchesName = f.name.toLowerCase().includes(searchTerm);
      const matchesAlias = f.aliases.some(alias => alias.toLowerCase().includes(searchTerm));
      return matchesName || matchesAlias;
    }).map(f => f.id);
    
    if (foodIds.length === 0) {
      console.warn(
        `[Restriction] food sem correspondência: ${r.food} | restriction:`,
        r
      );
    }
  }

  return {
    foodIds,
    type: r.type
  };
}

/**
 * ==========================================
 * 2. EXPANSÃO COMPLETA
 * ==========================================
 * Retorna um Set rápido com TODOS os foodIds que estão bloqueados.
 */
export function expandRestrictions(restrictions: FoodRestriction[]): Set<string> {
  const blockedIds = new Set<string>();

  if (!restrictions || restrictions.length === 0) return blockedIds;

  for (const r of restrictions) {
    const normalized = normalizeRestriction(r);
    for (const id of normalized.foodIds) {
      blockedIds.add(id);
    }
  }

  return blockedIds;
}

/**
 * ==========================================
 * 3. FUNÇÃO CORE DE RESOLUÇÃO (Single Source of Truth)
 * ==========================================
 * Avalia se um foodId específico bate com alguma restrição.
 */
export function resolveRestriction(
  foodId: string,
  restrictions: FoodRestriction[]
): RestrictionType | null {
  if (!restrictions || restrictions.length === 0) return null;

  const food = FOOD_REGISTRY.find(f => f.id === foodId);
  if (!food) return null;

  // Percorre aplicando a mesma ordem de prioridade
  for (const r of restrictions) {
    // 1. Match direto por ID
    if (r.foodId === foodId) {
      return r.type;
    }

    // 2. Match por Tag
    if (r.tag && food.tags.includes(r.tag as any)) {
      return r.type;
    }

    // 3. Match legado (string no form antigo)
    if (r.food) {
      const searchTerm = r.food.toLowerCase();
      const matchesName = food.name.toLowerCase().includes(searchTerm);
      const matchesAlias = food.aliases.some(alias =>
        alias.toLowerCase().includes(searchTerm)
      );
      if (matchesName || matchesAlias) {
        return r.type;
      }
    }
  }

  return null;
}

/**
 * ==========================================
 * 4. API PÚBLICA
 * ==========================================
 */

/**
 * Alias de retrocompatibilidade: aponta diretamente para o novo Core
 */
export function getRestrictionType(
  foodId: string,
  restrictions: FoodRestriction[]
): RestrictionType | null {
  return resolveRestriction(foodId, restrictions);
}

/**
 * Obtém informações completas (incluindo classes CSS) para UI
 */
export function getRestrictionInfo(
  foodId: string,
  restrictions: FoodRestriction[]
): RestrictionInfo | null {
  const type = resolveRestriction(foodId, restrictions);
  if (!type) return null;

  const config: Record<RestrictionType, Omit<RestrictionInfo, 'type'>> = {
    allergy: {
      label: 'Alergia Grave',
      colorClass: 'text-red-700',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-200',
      hoverClass: 'hover:bg-red-100 hover:border-red-300',
      icon: '🚫',
      description: 'PROIBIDO - Alergia grave confirmada'
    },
    intolerance: {
      label: 'Intolerância',
      colorClass: 'text-amber-700',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
      hoverClass: 'hover:bg-amber-100 hover:border-amber-300',
      icon: '⚠️',
      description: 'CUIDADO - Intolerância alimentar'
    },
    restriction: {
      label: 'Restrição',
      colorClass: 'text-blue-700',
      bgClass: 'bg-blue-50',
      borderClass: 'border-blue-200',
      hoverClass: 'hover:bg-blue-100 hover:border-blue-300',
      icon: '📋',
      description: 'EVITAR - Restrição por orientação'
    }
  };

  return {
    type,
    ...config[type]
  };
}

/**
 * Verifica se um alimento está bloqueado (qualquer tipo)
 */
export function isFoodBlocked(
  foodId: string,
  restrictions: FoodRestriction[]
): boolean {
  return resolveRestriction(foodId, restrictions) !== null;
}

/**
 * Resumo das restrições para alerta global
 */
export function getRestrictionsSummary(restrictions: FoodRestriction[]) {
  if (!restrictions || restrictions.length === 0) {
    return { hasRestrictions: false, total: 0, allergies: 0, intolerances: 0, restrictions: 0 };
  }

  return {
    hasRestrictions: true,
    total: restrictions.length,
    allergies: restrictions.filter(r => r.type === 'allergy').length,
    intolerances: restrictions.filter(r => r.type === 'intolerance').length,
    restrictions: restrictions.filter(r => r.type === 'restriction').length
  };
}