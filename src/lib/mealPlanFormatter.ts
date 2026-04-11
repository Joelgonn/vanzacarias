// ============================================================================
// MEAL PLAN FORMATTER - FORMATAÇÃO DE CARDÁPIOS PARA IA
// NÃO SUBSTITUI nenhuma lógica existente, apenas formata para texto
// ============================================================================

import { FOOD_REGISTRY } from '@/lib/foodRegistry';

// ============================================================================
// FUNÇÃO CENTRAL: FORMATAR ITEM ALIMENTAR
// ============================================================================
export function formatFoodItem(f: any): string {
  let grams = 0;
  
  const registryItem = FOOD_REGISTRY.find(r => r.id === f.id);
  const baseGrams = registryItem?.baseGrams || 100;

  if (f.grams != null) {
    grams = Math.round(f.grams);
  } else if (f.quantity != null) {
    grams = Math.round(f.quantity * baseGrams);
  } else {
    grams = baseGrams;
  }

  return `${grams}g ${f.name}`;
}

// ============================================================================
// FUNÇÃO: FORMATAR OPÇÃO DO CARDÁPIO
// ============================================================================
export function formatOption(option: any): string {
  if (!option.foodItems || option.foodItems.length === 0) {
    return option?.description || option?.name || 'Sem descrição detalhada';
  }

  const foods = option.foodItems.map(formatFoodItem);
  return foods.join(', ');
}

// ============================================================================
// FUNÇÃO: FORMATAR REFEIÇÃO
// ============================================================================
export function formatMeal(meal: any): string {
  if (!meal.options || meal.options.length === 0) return '';

  const optionsText = meal.options
    .map((opt: any, index: number) => {
      const text = formatOption(opt);
      if (!text) return null;

      const kcal = opt?.kcal || 0;
      const p = opt?.macros?.p || 0;
      const c = opt?.macros?.c || 0;
      const g = opt?.macros?.g || 0;

      const macrosText = `🔥 ${kcal} kcal | P:${p}g C:${c}g G:${g}g`;

      if (meal.options.length === 1) {
        return `  ${text}\n  ${macrosText}`;
      }

      return `  Opção ${index + 1}: ${text}\n  ${macrosText}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return `- ${meal.name || 'Refeição'} (${meal.time || '--:--'}):\n${optionsText}`;
}

// ============================================================================
// FUNÇÃO: FORMATAR CARDÁPIO COMPLETO
// ============================================================================
export function formatMealPlan(mealPlan: any): string {
  if (!Array.isArray(mealPlan) || mealPlan.length === 0) {
    return 'Cardápio não disponível ou vazio.';
  }

  return mealPlan
    .map(formatMeal)
    .filter(Boolean)
    .join('\n\n');
}