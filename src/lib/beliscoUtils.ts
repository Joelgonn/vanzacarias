// lib/beliscoUtils.ts

// =========================================================================
// TIPAGEM COMPLETA PARA BELISCOS
// =========================================================================

export interface BeliscoItem {
  id: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
}

export interface BeliscosState {
  items: BeliscoItem[];
}

export interface BeliscosTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

// =========================================================================
// FUNÇÃO PARA GERAR ID ÚNICO (COM FALLBACK)
// =========================================================================
export const generateBeliscoId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// =========================================================================
// FUNÇÃO PARA CALCULAR TOTAIS A PARTIR DOS ITEMS
// =========================================================================
export const calculateBeliscosTotals = (items: BeliscoItem[]): BeliscosTotals => {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }
  );
};

// =========================================================================
// FUNÇÃO PARA CRIAR UM NOVO ITEM DE BELISCO (A PARTIR DO FOOD_REGISTRY)
// =========================================================================
export const createBeliscoItemFromFood = (
  foodName: string,
  grams: number,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number
): BeliscoItem => {
  return {
    id: generateBeliscoId(),
    name: foodName,
    grams: Math.round(grams),
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    createdAt: new Date().toISOString(),
  };
};

// =========================================================================
// FUNÇÃO PARA CRIAR UM NOVO ITEM DE BELISCO (MANUAL)
// =========================================================================
export const createBeliscoItemManual = (
  kcal: number,
  protein: number,
  carbs: number,
  fat: number
): BeliscoItem => {
  return {
    id: generateBeliscoId(),
    name: 'Registro manual',
    grams: 0,
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    createdAt: new Date().toISOString(),
  };
};

// =========================================================================
// FUNÇÃO PARA MIGRAR DADOS ANTIGOS (SE NECESSÁRIO)
// =========================================================================
export const migrateOldBeliscosFormat = (oldData: any): BeliscosState => {
  // Se já tem o formato novo com items
  if (oldData?.items && Array.isArray(oldData.items)) {
    return { items: oldData.items };
  }
  
  // Se tem o formato antigo (kcal, protein, carbs, fat soltos)
  if (oldData && typeof oldData === 'object' && 'kcal' in oldData) {
    // Se não tem nenhum belisco registrado
    if (oldData.kcal === 0 && oldData.protein === 0 && oldData.carbs === 0 && oldData.fat === 0) {
      return { items: [] };
    }
    
    // Se tem dados no formato antigo, cria um item genérico
    // Isso preserva o histórico do paciente
    if (oldData.kcal > 0 || oldData.protein > 0 || oldData.carbs > 0 || oldData.fat > 0) {
      return {
        items: [
          {
            id: generateBeliscoId(),
            name: 'Belisco registrado anteriormente',
            grams: 0,
            kcal: oldData.kcal || 0,
            protein: oldData.protein || 0,
            carbs: oldData.carbs || 0,
            fat: oldData.fat || 0,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
  }
  
  // Fallback: lista vazia
  return { items: [] };
};