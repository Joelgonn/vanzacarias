// ============================================================================
// NORMALIZE RESTRICTIONS - CONVERSÃO SEGURA DE DADOS DO SUPABASE
// ============================================================================

import { FoodRestriction, FoodRestrictionType } from '@/types/patient';

// ============================================================================
// 🔥 FUNÇÃO PARA NORMALIZAR RESTRIÇÕES VINDAS DO BANCO
// ============================================================================
export function normalizeRestrictions(data: any[]): FoodRestriction[] {
  if (!Array.isArray(data)) {
    return [];
  }

  // Tipos válidos de acordo com o SSOT
  const validTypes: FoodRestrictionType[] = ['allergy', 'intolerance', 'restriction'];

  return data
    .filter(r => r && typeof r.type === 'string' && validTypes.includes(r.type as FoodRestrictionType))
    .map(r => ({
      type: r.type as FoodRestrictionType,
      foodId: typeof r.foodId === 'string' ? r.foodId : undefined,
      tag: typeof r.tag === 'string' ? r.tag as any : undefined,
      food: typeof r.food === 'string' ? r.food : undefined,
      severity: r.severity as any,
      notes: typeof r.notes === 'string' ? r.notes : undefined
    }));
}

// ============================================================================
// 🔥 FUNÇÃO PARA VALIDAR SE UMA RESTRIÇÃO É VÁLIDA
// ============================================================================
export function isValidRestriction(restriction: FoodRestriction): boolean {
  const validTypes: FoodRestrictionType[] = ['allergy', 'intolerance', 'restriction'];
  return validTypes.includes(restriction.type);
}

// ============================================================================
// 🔥 FUNÇÃO PARA FORMATAR RESTRIÇÕES PARA EXIBIÇÃO
// ============================================================================
export function formatRestrictionsForDisplay(restrictions: FoodRestriction[]): string {
  if (!restrictions || restrictions.length === 0) {
    return 'Nenhuma restrição registrada';
  }

  return restrictions.map(r => {
    const icon = r.type === 'allergy' ? '🚫' : r.type === 'intolerance' ? '⚠️' : '📋';
    const name = r.food || r.tag || r.foodId || 'alimento';
    return `${icon} ${name} (${r.type})`;
  }).join(', ');
}