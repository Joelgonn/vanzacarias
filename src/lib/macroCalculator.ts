// ============================================================================
// MACRO CALCULATOR - CÁLCULO SIMPLES DE MACROS DO CARDÁPIO
// Separado do macroEngine.ts para evitar conflitos de bundler
// ============================================================================

export interface MacroPorRefeicao {
  nome: string;
  horario: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacrosDiarios {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface MacrosResult {
  macrosDiarios: MacrosDiarios | null;
  macrosPorRefeicao: MacroPorRefeicao[];
}

// ============================================================================
// 🔥 FUNÇÃO PRINCIPAL: CALCULAR MACROS DO CARDÁPIO
// ============================================================================
export function calcularMacrosDoCardapio(mealPlan: any): MacrosResult {
  if (!mealPlan || !Array.isArray(mealPlan) || mealPlan.length === 0) {
    return { macrosDiarios: null, macrosPorRefeicao: [] };
  }

  const macrosPorRefeicao: MacroPorRefeicao[] = [];
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const meal of mealPlan) {
    const option = meal?.options?.[0];
    if (option) {
      const kcal = Number(option?.kcal) || 0;
      const protein = Number(option?.macros?.p) || 0;
      const carbs = Number(option?.macros?.c) || 0;
      const fat = Number(option?.macros?.g) || 0;

      totalKcal += kcal;
      totalProtein += protein;
      totalCarbs += carbs;
      totalFat += fat;

      macrosPorRefeicao.push({
        nome: meal?.name || 'Refeição',
        horario: meal?.time || '--:--',
        kcal,
        protein,
        carbs,
        fat
      });
    }
  }

  return {
    macrosDiarios: {
      totalKcal,
      totalProtein,
      totalCarbs,
      totalFat
    },
    macrosPorRefeicao
  };
}

// ============================================================================
// 🔥 FUNÇÃO PARA FORMATAR MACROS PARA EXIBIÇÃO
// ============================================================================
export function formatMacrosDisplay(macros: MacrosDiarios): string {
  return `${Math.round(macros.totalKcal)} kcal | P:${Math.round(macros.totalProtein)}g | C:${Math.round(macros.totalCarbs)}g | G:${Math.round(macros.totalFat)}g`;
}

// ============================================================================
// 🔥 FUNÇÃO PARA FORMATAR MACROS DE UMA REFEIÇÃO
// ============================================================================
export function formatRefeicaoMacros(refeicao: MacroPorRefeicao): string {
  return `${refeicao.nome} (${refeicao.horario}): ${Math.round(refeicao.kcal)} kcal | P:${Math.round(refeicao.protein)}g | C:${Math.round(refeicao.carbs)}g | G:${Math.round(refeicao.fat)}g`;
}