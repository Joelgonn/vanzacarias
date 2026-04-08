// ============================================================================
// /types/macroEngine.ts - SSOT DE TIPAGENS (CONTRATOS)
// ============================================================================

export interface MacroTargets {
  kcal: number;
  // Tornamos opcional para aceitar tanto o formato novo quanto o antigo
  macros?: {
    p: number;
    c: number;
    g: number;
  };
  // Fallbacks de segurança para compatibilidade com o DietBuilder
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface MacroTotals {
  kcal: number;
  macros?: {
    p: number;
    c: number;
    g: number;
  };
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface MacroDiff {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroAnalysis {
  totals: MacroTotals;
  diff: MacroDiff;
  status: {
    kcal: 'low' | 'ok' | 'high';
    protein: 'low' | 'ok' | 'high';
    carbs: 'low' | 'ok' | 'high';
    fat: 'low' | 'ok' | 'high';
  };
  priority: 'kcal' | 'protein' | 'carbs' | 'fat' | null;
}

export interface Suggestion {
  foodId: string;
  foodName: string;
  action: 'increase' | 'decrease';
  grams: number;
  currentGrams: number;
  newGrams: number;
  reason: string;
  priority: number; // 1 = urgente, 5 = opcional
}

export interface SuggestedMeal {
  name: string;
  foods: {
    foodId: string;
    grams: number;
  }[];
}