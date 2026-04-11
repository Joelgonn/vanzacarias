// ============================================================================
// PATIENT DOMAIN TYPES (Single Source of Truth)
// ============================================================================

// ============================================================================
// FOOD ITEM (SSOT final baseado em gramas)
// ============================================================================

export interface FoodItem {
  id: string;
  name: string;
  kcal: number;
  macros: {
    p: number;
    c: number;
    g: number;
  };
  grams: number;
}

// ============================================================================
// FOOD RESTRICTIONS
// ============================================================================

export type FoodRestrictionType = 'allergy' | 'intolerance' | 'restriction';
export type FoodRestrictionSeverity = 'low' | 'medium' | 'high';

export type RegistryFoodTag =
  | 'lactose'
  | 'laticinio'
  | 'gluten'
  | 'trigo'
  | 'amendoim'
  | 'nuts'
  | 'ovo'
  | 'carne_branca'
  | 'carne_vermelha'
  | 'peixe'
  | 'frutos_do_mar'
  | 'vegano'
  | 'vegetariano'
  | 'soja';

export type ClinicalFoodTag =
  | 'sugar'
  | 'ultraprocessado';

export type FoodTag = RegistryFoodTag | ClinicalFoodTag;

export interface FoodRestriction {
  id?: string;
  type: FoodRestrictionType;
  severity?: FoodRestrictionSeverity;
  notes?: string;

  // Fonte principal: bloqueio de um alimento especifico.
  foodId?: string;

  // Fonte por grupo: lactose, gluten, ultraprocessado, etc.
  tag?: FoodTag;

  // LEGACY: fallback textual para dados antigos. Nao usar como fonte primaria.
  food?: string;
}

// ============================================================================
// QFA (Questionario de Frequencia Alimentar)
// ============================================================================

export interface QFAItem {
  id: string;
  frequency: number;
  foodId?: string;
  tag?: FoodTag;
  food?: string;
}

// ============================================================================
// PATIENT BASE
// ============================================================================

export interface PatientBase {
  id: string;
  name?: string;
  age?: number;
  gender?: 'M' | 'F';
  weight?: number;
  height?: number;
  foodRestrictions?: FoodRestriction[];
  qfa?: QFAItem[];
}

export type PatientInput = Partial<Omit<PatientBase, 'id'>>;

// ============================================================================
// HELPERS (TYPE GUARDS)
// ============================================================================

export function isAllergy(restriction: FoodRestriction): boolean {
  return restriction.type === 'allergy';
}

export function isIntolerance(restriction: FoodRestriction): boolean {
  return restriction.type === 'intolerance';
}

export function isRestriction(restriction: FoodRestriction): boolean {
  return restriction.type === 'restriction';
}

export function hasFoodId(restriction: FoodRestriction): boolean {
  return !!restriction.foodId;
}

export function hasTag(restriction: FoodRestriction): boolean {
  return !!restriction.tag;
}

export function isLegacyRestriction(restriction: FoodRestriction): boolean {
  return !restriction.foodId && !restriction.tag && !!restriction.food;
}
