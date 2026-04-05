// ============================================================================
// PATIENT DOMAIN TYPES (Single Source of Truth)
// ============================================================================

// ============================================================================
// 🆕 FOOD ITEM (BASE DO SISTEMA DE DIETA - FASE 1 COMPATÍVEL)
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

  // 🔥 NOVO PADRÃO (FASE 1 - OPCIONAL)
  grams?: number;

  // 🔥 LEGADO (MANTIDO TEMPORARIAMENTE)
  quantity?: number;
}

// ============================================================================
// FOOD RESTRICTIONS
// ============================================================================

export type FoodRestrictionType = 'allergy' | 'intolerance' | 'restriction';

export type FoodRestrictionSeverity = 'low' | 'medium' | 'high';

// ----------------------------------------------------------------------------
// FOOD RESTRICTIONS
// ----------------------------------------------------------------------------

export interface FoodRestriction {
  id?: string;
  food: string;
  type: FoodRestrictionType;
  severity?: FoodRestrictionSeverity;
  notes?: string;

  foodId?: string;
  tag?: string;
}

// ----------------------------------------------------------------------------
// QFA (Questionário de Frequência Alimentar)
// ----------------------------------------------------------------------------

export interface QFAItem {
  food: string;
  frequency: number;
}

// ----------------------------------------------------------------------------
// PATIENT BASE
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// INPUT (CREATE / UPDATE)
// ----------------------------------------------------------------------------

export interface PatientInput {
  name?: string;
  age?: number;
  gender?: 'M' | 'F';
  weight?: number;
  height?: number;

  foodRestrictions?: FoodRestriction[];
  qfa?: QFAItem[];
}

// ----------------------------------------------------------------------------
// HELPERS (TYPE GUARDS)
// ----------------------------------------------------------------------------

export function isAllergy(restriction: FoodRestriction): boolean {
  return restriction.type === 'allergy';
}

export function isIntolerance(restriction: FoodRestriction): boolean {
  return restriction.type === 'intolerance';
}

export function isRestriction(restriction: FoodRestriction): boolean {
  return restriction.type === 'restriction';
}

// ============================================================================
// NOVOS HELPERS PARA OPÇÃO 3 (HÍBRIDO)
// ============================================================================

export function hasFoodId(restriction: FoodRestriction): boolean {
  return !!restriction.foodId;
}

export function hasTag(restriction: FoodRestriction): boolean {
  return !!restriction.tag;
}

export function isLegacyRestriction(restriction: FoodRestriction): boolean {
  return !restriction.foodId && !restriction.tag;
}