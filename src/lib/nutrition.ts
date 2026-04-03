import { FoodRestriction } from '@/types/patient';
import { FOOD_REGISTRY, FoodEntity } from '@/lib/foodRegistry';

// ============================================================================
// 🧠 HELPERS INTERNOS (MATCH INTELIGENTE)
// ============================================================================

function findFoodsByTag(tag: string): FoodEntity[] {
  return FOOD_REGISTRY.filter(f => f.tags.includes(tag as any));
}

function matchFoodLegacy(food: string): FoodEntity[] {
  const normalized = food.toLowerCase();
  return FOOD_REGISTRY.filter(f =>
    f.aliases.some(alias => normalized.includes(alias.toLowerCase()))
  );
}

// ============================================================================
// 🛡️ [CORE CLINICAL VALIDATORS] - SEGURANÇA ALIMENTAR
// ============================================================================

/**
 * Resolve todos os alimentos proibidos baseado em foodId, tag ou fallback legado
 */
function resolveRestrictedFoods(
  restrictions: FoodRestriction[] | undefined
): Set<string> {
  const blocked = new Set<string>();

  if (!restrictions) return blocked;

  restrictions.forEach(r => {
    if (r.foodId) {
      blocked.add(r.foodId);
      return;
    }
    if (r.tag) {
      findFoodsByTag(r.tag).forEach(f => blocked.add(f.id));
      return;
    }
    if (r.food) {
      matchFoodLegacy(r.food).forEach(f => blocked.add(f.id));
    }
  });

  return blocked;
}

/**
 * Filtra a lista de alimentos removendo os que possuem restrição
 */
export function filterAllowedFoods(
  foods: string[],
  restrictions: FoodRestriction[] | undefined
): string[] {
  if (!restrictions || restrictions.length === 0) return foods;

  const blocked = resolveRestrictedFoods(restrictions);
  return foods.filter(foodId => !blocked.has(foodId));
}

/**
 * Valida o QFA cruzando as respostas com as restrições do paciente
 */
export function validateQFAConsistency(
  qfaAnswers: Record<string, string>,
  restrictions: FoodRestriction[] | undefined
): string[] {
  const warnings: string[] = [];

  if (!restrictions || restrictions.length === 0) return warnings;

  const blocked = resolveRestrictedFoods(restrictions);

  Object.entries(qfaAnswers).forEach(([foodKey, frequency]) => {
    if (frequency === "0") return;

    const matchedFoods = matchFoodLegacy(foodKey);

    matchedFoods.forEach(food => {
      if (blocked.has(food.id)) {
        warnings.push(
          `Risco Crítico: Consumo de "${food.name}" conflita com restrição alimentar.`
        );
      }
    });
  });

  return warnings;
}

// ============================================================================
// 📊 [METABOLIC ENGINE] - CÁLCULO DE MACROS E RECOMENDAÇÕES
// ============================================================================

export interface RecommendationParams {
  weight: number;
  height: number | null;
  bf?: number | null;
  leanMass?: number | null;
  tmb: number;
  get: number;
  avgActivity: number;
  gender?: string;
  weightTrend?: 'losing' | 'gaining' | 'stable' | null;
  weightVelocity?: number | null; 
}

export interface RecommendationResult {
  goal: 'perda de gordura' | 'ganho de massa' | 'manutenção';
  calories: number;
  trainingDayCalories: number;
  restDayCalories: number;
  refeedCalories: number | null;
  strategy: string;
  alert: string;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

export function generateRecommendation({
  weight,
  height,
  bf,
  leanMass,
  tmb,
  get,
  avgActivity,
  gender,
  weightTrend,
  weightVelocity
}: RecommendationParams): RecommendationResult {

  let goal: 'perda de gordura' | 'ganho de massa' | 'manutenção' = 'manutenção';
  let calories = get;
  let strategy = '';
  let alert = '';

  const g = gender?.toLowerCase().trim() || '';
  const isFemale = ['f', 'feminino', 'female', 'mulher'].some(v => g.startsWith(v));
  const sex: 'M' | 'F' = isFemale ? 'F' : 'M';

  let estimatedBf = bf;

  if (!estimatedBf && leanMass && leanMass > 0 && weight > 0) {
    estimatedBf = ((weight - leanMass) / weight) * 100;
  }

  if (estimatedBf && estimatedBf > 0) {
    if (sex === 'M') {
      if (estimatedBf > 22) goal = 'perda de gordura';
      else if (estimatedBf < 10) goal = 'ganho de massa';
      else goal = 'manutenção';
    } else {
      if (estimatedBf > 30) goal = 'perda de gordura';
      else if (estimatedBf < 18) goal = 'ganho de massa';
      else goal = 'manutenção';
    }
  } else if (!leanMass && height && height > 0) {
    const hMeters = height / 100;
    const imc = weight / (hMeters * hMeters);

    if (imc > 25) goal = 'perda de gordura';
    else if (imc < 18.5) goal = 'ganho de massa';
  } else {
    if (weight > 90) goal = 'perda de gordura';
  }

  if (goal === 'manutenção' && estimatedBf) {
    if (sex === 'M' && estimatedBf > 20) goal = 'perda de gordura';
    if (sex === 'F' && estimatedBf > 28) goal = 'perda de gordura';
  }

  if (goal === 'perda de gordura') {
    let deficitFactor = 0.20;

    if (estimatedBf) {
      if (sex === 'M') {
        if (estimatedBf > 30) deficitFactor = 0.25;
        else if (estimatedBf < 15) deficitFactor = 0.15;
      } else {
        if (estimatedBf > 38) deficitFactor = 0.25;
        else if (estimatedBf < 23) deficitFactor = 0.15;
      }
    }

    calories = get - (get * deficitFactor);
    strategy = `Déficit calórico dinâmico (~${Math.round(deficitFactor * 100)}%)`;

  } else if (goal === 'ganho de massa') {
    let surplusFactor = 0.10;

    if (estimatedBf) {
      if (sex === 'M' && estimatedBf < 8) surplusFactor = 0.15;
      if (sex === 'F' && estimatedBf < 16) surplusFactor = 0.15;
    }

    calories = get + (get * surplusFactor);
    strategy = `Superávit calórico dinâmico (~${Math.round(surplusFactor * 100)}%)`;
  } else {
    strategy = 'Manutenção metabólica';
  }

  if (weightVelocity !== undefined && weightVelocity !== null) {
    if (goal === 'perda de gordura') {
      if (weightVelocity > -0.2) {
        calories -= get * 0.05;
        strategy += ' | Ajuste de velocidade (Lento demais -5%)';
      } else if (weightVelocity < -1.0) {
        calories += get * 0.05;
        strategy += ' | Ajuste de velocidade (Rápido demais +5%)';
      }
    }
  } else if (weightTrend === 'stable') {
    const adjustment = Math.round(get * 0.06);
    if (goal === 'perda de gordura') {
      calories -= adjustment;
      strategy += ` | Correção de platô (-${adjustment} kcal)`;
    }
    if (goal === 'ganho de massa') {
      calories += adjustment;
      strategy += ` | Correção de platô (+${adjustment} kcal)`;
    }
  }

  const alertsList: string[] = [];
  const isSedentary = avgActivity < 150;
  const tmbFactor = isSedentary ? 1.0 : 0.95;
  const minCalories = Math.round(tmb * tmbFactor);

  if (calories < minCalories) {
    calories = minCalories;
    strategy += ' | Proteção metabólica aplicada';
  }

  if (calories <= tmb * 1.02) {
    alertsList.push('Calorias muito próximas da TMB. Monitorar adaptação metabólica.');
  }

  let trainingDayCalories = calories;
  let restDayCalories = calories;

  if (goal === 'perda de gordura') {
    trainingDayCalories = calories; 
    restDayCalories = Math.max(minCalories, calories - (get * 0.08)); 
  } else if (goal === 'ganho de massa') {
    trainingDayCalories = calories + (get * 0.05); 
    restDayCalories = calories;
  }

  let refeedCalories = null;
  const isLean = sex === 'M' ? (estimatedBf && estimatedBf < 15) : (estimatedBf && estimatedBf < 23);
  const isPlateau = weightVelocity !== undefined && weightVelocity !== null
    ? weightVelocity > -0.2
    : weightTrend === 'stable';

  if (goal === 'perda de gordura' && isPlateau && isLean) {
    refeedCalories = Math.round(get * 1.05); 
    strategy += ' | Refeed recomendado (1 a 2 dias)';
  }

  const activityPerKg = avgActivity / weight;

  if (activityPerKg < 1) {
    if (goal === 'perda de gordura') alertsList.push('Baixa atividade para emagrecimento. Aumentar NEAT (passos/dia) é prioridade.');
    else alertsList.push('Baixa atividade detectada. Risco de adaptação metabólica.');
  } else if (activityPerKg > 5) {
    if (goal === 'ganho de massa') alertsList.push('Alto gasto calórico. Garanta ingestão adequada de carboidratos.');
    else alertsList.push('Alto gasto calórico. Monitorar fadiga e qualidade do sono.');
  }

  if (goal === 'perda de gordura' && estimatedBf && ((sex === 'M' && estimatedBf < 10) || (sex === 'F' && estimatedBf < 18))) {
    alertsList.push('Atenção: Risco elevado de perda muscular (BF muito baixo). Considere Diet Break.');
  }
  if (goal === 'ganho de massa' && estimatedBf && ((sex === 'M' && estimatedBf > 18) || (sex === 'F' && estimatedBf > 26))) {
    alertsList.push('Atenção: BF elevado para fase de Bulking. Risco de particionamento ruim (ganho excessivo de gordura).');
  }

  alert = alertsList.join(' | ');

  let protein = 0;
  let fat = 0;
  let carbs = 0;
  const baseWeight = leanMass && leanMass > 0 ? leanMass : weight;

  if (goal === 'perda de gordura') {
    const isHighBf = sex === 'M' ? (estimatedBf && estimatedBf > 25) : (estimatedBf && estimatedBf > 33);
    protein = isHighBf ? baseWeight * 2.0 : baseWeight * 2.4; 
  } else if (goal === 'ganho de massa') {
    protein = baseWeight * 2.0;
  } else {
    protein = baseWeight * 1.8;
  }

  if (goal !== 'perda de gordura') {
    const maxProteinKcal = calories * 0.35;
    if (protein * 4 > maxProteinKcal) {
      protein = maxProteinKcal / 4;
    }
  }

  if (goal === 'perda de gordura') fat = weight * 0.8;
  else if (goal === 'ganho de massa') fat = weight * 1.0;
  else fat = weight * 0.9;

  if (activityPerKg > 4) {
    fat = Math.max(weight * 0.6, fat * 0.85); 
  } else if (activityPerKg < 1.5) {
    fat = fat * 1.15; 
  }

  let proteinKcal = protein * 4;
  let fatKcal = fat * 9;
  let remainingKcal = calories - (proteinKcal + fatKcal);
  carbs = remainingKcal > 0 ? remainingKcal / 4 : 0;

  const maxCarbs = weight * 5; 
  if (carbs > maxCarbs) {
    carbs = maxCarbs;
    fat = Math.max(weight * 0.5, (calories - (protein * 4) - (carbs * 4)) / 9);
  }

  const minCarbs = Math.max(80, weight * 1.5);
  if (carbs < minCarbs) {
    carbs = minCarbs;
    fat = Math.max(weight * 0.5, (calories - (protein * 4) - (carbs * 4)) / 9);
  }

  if (fat < weight * 0.5) {
     fat = weight * 0.5;
  }

  return {
    goal,
    calories: Math.round(calories),
    trainingDayCalories: Math.round(trainingDayCalories),
    restDayCalories: Math.round(restDayCalories),
    refeedCalories,
    strategy: strategy.trim(),
    alert: alert.trim(),
    macros: {
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat)
    }
  };
}