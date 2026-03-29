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

  // 🔥 1. SEXO (PADRONIZADO)
  const g = gender?.toLowerCase().trim() || '';
  const isFemale = ['f', 'feminino', 'female', 'mulher'].some(v => g.startsWith(v));
  const sex: 'M' | 'F' = isFemale ? 'F' : 'M';

  // 🔥 2. ESTIMATIVA DE BF (PRIORIDADE CLÍNICA)
  let estimatedBf = bf;

  if (!estimatedBf && leanMass && leanMass > 0 && weight > 0) {
    estimatedBf = ((weight - leanMass) / weight) * 100;
  }

  // 🔥 3. CLASSIFICAÇÃO DO OBJETIVO (ZONA NEUTRA)
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
    const h = height; 
    const hMeters = h / 100;
    const imc = weight / (hMeters * hMeters);

    if (imc > 25) goal = 'perda de gordura';
    else if (imc < 18.5) goal = 'ganho de massa';
  } else {
    if (weight > 90) goal = 'perda de gordura';
  }

  // 🔥 4. AJUSTE CLÍNICO (ANTI-MANUTENÇÃO BURRA)
  if (goal === 'manutenção' && estimatedBf) {
    if (sex === 'M' && estimatedBf > 20) goal = 'perda de gordura';
    if (sex === 'F' && estimatedBf > 28) goal = 'perda de gordura';
  }

  // 🔥 5. DÉFICIT / SUPERÁVIT DINÂMICO
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

  // 🔥 6. AJUSTE AUTOMÁTICO SEMANAL / PLATÔ
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

  // 🔥 7. TRAVA FISIOLÓGICA TMB MIN
  const minCalories = Math.round(tmb * 0.8);
  if (calories < minCalories) {
    calories = minCalories;
    strategy += ' | Piso metabólico aplicado';
  }

  // =======================================================================
  // 🧠 [PRO] PERIODIZAÇÃO CALÓRICA (TREINO vs DESCANSO)
  // =======================================================================
  let trainingDayCalories = calories;
  let restDayCalories = calories;

  if (goal === 'perda de gordura') {
    trainingDayCalories = calories; 
    // 🔒 PISO NO DESCANSO (Evita calorias negativas/inanição extrema)
    restDayCalories = Math.max(minCalories, calories - (get * 0.08)); 
  } else if (goal === 'ganho de massa') {
    trainingDayCalories = calories + (get * 0.05); 
    restDayCalories = calories;
  }

  // =======================================================================
  // 🧠 [PRO] REFEED INTELIGENTE (ANTI-PLATÔ HORMONAL)
  // =======================================================================
  let refeedCalories = null;
  const isLean = sex === 'M' ? (estimatedBf && estimatedBf < 15) : (estimatedBf && estimatedBf < 23);
  
  // Condição forte de platô baseada em velocidade ou tendência
  const isPlateau = weightVelocity !== undefined && weightVelocity !== null
    ? weightVelocity > -0.2
    : weightTrend === 'stable';

  if (goal === 'perda de gordura' && isPlateau && isLean) {
    refeedCalories = Math.round(get * 1.05); 
    strategy += ' | Refeed recomendado (1 a 2 dias)';
  }

  // 🔥 8. ALERTAS CLÍNICOS AVANÇADOS (Formatados Corretamente)
  const activityPerKg = avgActivity / weight;
  const alertsList: string[] = [];

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

  // =======================================================================
  // 🔥 9. CÁLCULO DE MACROS (INTELIGÊNCIA DINÂMICA SEM DRIFT E COM TETOS)
  // =======================================================================
  let protein = 0;
  let fat = 0;
  let carbs = 0;

  const baseWeight = leanMass && leanMass > 0 ? leanMass : weight;

  // PROTEÍNA INTELIGENTE
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

  // GORDURA BASE
  if (goal === 'perda de gordura') fat = weight * 0.8;
  else if (goal === 'ganho de massa') fat = weight * 1.0;
  else fat = weight * 0.9;

  // AJUSTE FINO DE GORDURA X ATIVIDADE
  if (activityPerKg > 4) {
    fat = Math.max(weight * 0.6, fat * 0.85); 
  } else if (activityPerKg < 1.5) {
    fat = fat * 1.15; 
  }

  let proteinKcal = protein * 4;
  let fatKcal = fat * 9;

  // CARBOIDRATO RESTANTE
  let remainingKcal = calories - (proteinKcal + fatKcal);
  carbs = remainingKcal > 0 ? remainingKcal / 4 : 0;

  // 🔒 TETO DE CARBOIDRATOS (Evita picos extremos em altíssima atividade)
  const maxCarbs = weight * 5; 
  if (carbs > maxCarbs) {
    carbs = maxCarbs;
    // O excesso calórico vai para a gordura garantindo não quebrar a balança total
    fat = Math.max(weight * 0.5, (calories - (protein * 4) - (carbs * 4)) / 9);
  }

  // 🔒 PISO DE CARBOIDRATOS PRO (Dinâmico e justo para pessoas leves)
  const minCarbs = Math.max(80, weight * 1.5);
  if (carbs < minCarbs) {
    carbs = minCarbs;
    // A falta calórica é descontada da gordura (com trava de segurança)
    fat = Math.max(weight * 0.5, (calories - (protein * 4) - (carbs * 4)) / 9);
  }

  // Se por alguma maluquice extrema as travas criarem gordura negativa/baixa, recalibramos
  if (fat < weight * 0.5) {
     fat = weight * 0.5;
     // NÃO tocamos nas calorias. Se fat estiver cravado no mínimo e carbo no mínimo,
     // é sinal de déficit severo. As calorias já estão blindadas acima.
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