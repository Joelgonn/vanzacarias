// ============================================================================
// MEAL PLAN DOMAIN TYPES (Single Source of Truth)
// ============================================================================

export interface PlanFoodItem {
  name: string;
  kcal?: number;
}

export interface MealPlanOption {
  id?: string;
  day?: string;
  kcal?: number;
  macros?: { p: number; c: number; g: number };
  description?: string;
  foodItems?: PlanFoodItem[];
}

export interface MealPlanItem {
  id?: string;
  name: string;
  time?: string;
  options?: MealPlanOption[];
}
