import type { FoodRestriction } from '@/types/patient';

export type PatientPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PatientScore {
  total: number;
  engagement: number;
  recency: number;
  adherence: number;
  risk: PatientPriority;
  suggestedAction: string;
}

// =========================================================================
// ESTRUTURA DO PLANO ALIMENTAR (meal_plan - JSON do Supabase)
// =========================================================================
export interface MealMacros {
  p: number;
  c: number;
  g: number;
}

export interface MealFoodItem {
  name: string;
}

export interface MealOption {
  day?: string;
  description?: string;
  foodItems?: MealFoodItem[];
  kcal?: number;
  macros?: MealMacros;
}

export interface MealPlan {
  name: string;
  time: string;
  options: MealOption[];
}

export interface Patient {
  id: string;
  full_name: string;
  phone?: string;
  data_nascimento?: string;
  sexo?: string;
  tipo_perfil?: string;
  meta_peso?: number | null;
  account_type?: string;
  created_at: string;
  meal_plan?: MealPlan[];
  evaluation_answers?: Record<string, string>;
  is_late?: boolean;
  days_since_last?: number;
  is_new?: boolean;
  water_ml?: number | null;
  mood?: string | null;
  messages_today?: number;
  peso?: number | null;
  weight?: number | null;
  altura?: number | null;
  height?: number | null;
  bf?: number | null;
  leanMass?: number | null;
  food_restrictions?: FoodRestriction[];
  priority?: PatientPriority;
  score?: PatientScore;
}