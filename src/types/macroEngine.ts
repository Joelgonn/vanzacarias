// ============================================================================
// /types/macroEngine.ts - SSOT de contratos de macros
// ============================================================================

export interface MacroValues {
  p: number;
  c: number;
  g: number;
}

export interface MacroTargets {
  kcal: number;
  macros: MacroValues;
}

export interface MacroTotals {
  kcal: number;
  macros: MacroValues;
}

export interface LegacyMacroInput {
  kcal: number;
  macros?: Partial<MacroValues>;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat';
export type MacroStatus = 'low' | 'ok' | 'high';
export type MacroAction = 'increase' | 'decrease';
export type SuggestionPriority = 1 | 2 | 3 | 4 | 5;

export interface MacroDiff {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroAnalysis {
  totals: MacroTotals;
  diff: MacroDiff;
  status: Record<MacroKey, MacroStatus>;
  priority: MacroKey | null;
}

export interface Suggestion {
  foodId: string;
  foodName: string;
  action: MacroAction;
  grams: number;
  currentGrams: number;
  newGrams: number;
  reason: string;
  priority: SuggestionPriority;
}

export interface SuggestedMeal {
  name: string;
  foods: {
    foodId: string;
    grams: number;
  }[];
}

export function normalizeMacroTargets(input: MacroTargets | LegacyMacroInput): MacroTargets {
  const legacy = input as LegacyMacroInput;

  return {
    kcal: input.kcal,
    macros: {
      p: input.macros?.p ?? legacy.protein ?? 0,
      c: input.macros?.c ?? legacy.carbs ?? 0,
      g: input.macros?.g ?? legacy.fat ?? 0,
    }
  };
}

export function normalizeMacroTotals(input: MacroTotals | LegacyMacroInput): MacroTotals {
  const legacy = input as LegacyMacroInput;

  return {
    kcal: input.kcal,
    macros: {
      p: input.macros?.p ?? legacy.protein ?? 0,
      c: input.macros?.c ?? legacy.carbs ?? 0,
      g: input.macros?.g ?? legacy.fat ?? 0,
    }
  };
}
