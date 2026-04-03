// lib/nutrition/restrictions.ts
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

/**
 * Obtém o tipo de restrição de um alimento específico
 * @returns RestrictionType ou null se não houver restrição
 */
export function getRestrictionType(
  foodId: string,
  restrictions: FoodRestriction[]
): RestrictionType | null {
  if (!restrictions || restrictions.length === 0) return null;

  const food = FOOD_REGISTRY.find(f => f.id === foodId);
  if (!food) return null;

  for (const r of restrictions) {
    // 1. foodId direto
    if (r.foodId === foodId) {
      return r.type;
    }

    // 2. tag (categoria inteira bloqueada)
    if (r.tag) {
      if (food.tags.includes(r.tag as any)) {
        return r.type;
      }
    }

    // 3. fallback legado (r.food string)
    if (r.food) {
      const matchesName = food.name.toLowerCase().includes(r.food.toLowerCase());
      const matchesAlias = food.aliases.some(alias =>
        alias.toLowerCase().includes(r.food.toLowerCase())
      );
      if (matchesName || matchesAlias) {
        return r.type;
      }
    }
  }

  return null;
}

/**
 * Obtém informações completas (incluindo classes CSS) para UI
 */
export function getRestrictionInfo(
  foodId: string,
  restrictions: FoodRestriction[]
): RestrictionInfo | null {
  const type = getRestrictionType(foodId, restrictions);
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
  return getRestrictionType(foodId, restrictions) !== null;
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