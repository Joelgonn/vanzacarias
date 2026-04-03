// ============================================================================
// PATIENT DOMAIN TYPES (Single Source of Truth)
// ============================================================================

export type FoodRestrictionType = 'allergy' | 'intolerance' | 'restriction';

export type FoodRestrictionSeverity = 'low' | 'medium' | 'high';

// ----------------------------------------------------------------------------
// FOOD RESTRICTIONS
// ----------------------------------------------------------------------------

export interface FoodRestriction {
  id?: string;
  food: string; // nome do alimento (ex: "leite", "amendoim") - Legado obrigatório
  type: FoodRestrictionType;
  severity?: FoodRestrictionSeverity; // útil principalmente para intolerâncias
  notes?: string;
  
  // ========================================================================
  // NOVOS CAMPOS - OPÇÃO 3 (HÍBRIDO)
  // ========================================================================
  // foodId: Referência direta ao FoodEntity do foodRegistry
  // Ex: "milk_whole", "egg_scrambled", "chicken_breast"
  foodId?: string;
  
  // tag: Restrição por categoria/componente (abrangente)
  // Ex: "lactose" bloqueia leite, queijo, whey; "gluten" bloqueia pão, macarrão
  tag?: string;
}

// ----------------------------------------------------------------------------
// QFA (Questionário de Frequência Alimentar)
// ----------------------------------------------------------------------------

export interface QFAItem {
  food: string;
  frequency: number; // vezes por dia/semana dependendo do modelo
}

// ----------------------------------------------------------------------------
// PATIENT BASE
// ----------------------------------------------------------------------------

export interface PatientBase {
  id: string;

  // Dados básicos
  name?: string;
  age?: number;
  gender?: 'M' | 'F';

  // Antropometria
  weight?: number;
  height?: number;

  // 🔥 NOVO: Perfil alimentar
  foodRestrictions?: FoodRestriction[];

  // 🔥 QFA vinculado
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

/**
 * Verifica se a restrição usa a nova arquitetura com foodId
 */
export function hasFoodId(restriction: FoodRestriction): boolean {
  return !!restriction.foodId;
}

/**
 * Verifica se a restrição usa tag (restrição por categoria)
 */
export function hasTag(restriction: FoodRestriction): boolean {
  return !!restriction.tag;
}

/**
 * Verifica se a restrição é do legado (apenas food string)
 */
export function isLegacyRestriction(restriction: FoodRestriction): boolean {
  return !restriction.foodId && !restriction.tag;
}