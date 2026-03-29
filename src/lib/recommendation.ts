interface RecommendationParams {
  weight: number;
  height: number | null;
  bf?: number | null;
  leanMass?: number | null;
  tmb: number;
  get: number;
  avgActivity: number;
  gender?: string;
  weightTrend?: 'losing' | 'gaining' | 'stable' | null;
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
  weightTrend
}: RecommendationParams) {

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

    // Fallback: IMC
    const h = height < 3 ? height : height / 100;
    const imc = weight / (h * h);

    if (imc > 25) goal = 'perda de gordura';
    else if (imc < 18.5) goal = 'ganho de massa';

  } else {

    // Fallback extremo
    if (weight > 90) goal = 'perda de gordura';
  }

  // 🔥 4. AJUSTE CLÍNICO (ANTI-MANUTENÇÃO BURRA)
  if (goal === 'manutenção' && estimatedBf) {
    if (sex === 'M' && estimatedBf > 20) {
      goal = 'perda de gordura';
    }
    if (sex === 'F' && estimatedBf > 28) {
      goal = 'perda de gordura';
    }
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
    strategy = `Déficit calórico ajustado (~${Math.round(deficitFactor * 100)}%)`;

  } else if (goal === 'ganho de massa') {

    let surplusFactor = 0.10;

    if (estimatedBf) {
      if (sex === 'M' && estimatedBf < 8) surplusFactor = 0.15;
      if (sex === 'F' && estimatedBf < 16) surplusFactor = 0.15;
    }

    calories = get + (get * surplusFactor);
    strategy = `Superávit calórico leve (~${Math.round(surplusFactor * 100)}%)`;

  } else {

    strategy = 'Manutenção metabólica';
  }

  // 🔥 6. AJUSTE POR HISTÓRICO (PLATÔ)
  if (weightTrend === 'stable') {

    if (goal === 'perda de gordura') {
      calories -= 150;
      strategy += ' | Correção de platô (-150 kcal)';
    }

    if (goal === 'ganho de massa') {
      calories += 150;
      strategy += ' | Correção de platô (+150 kcal)';
    }
  }

  // 🔥 7. TRAVA FISIOLÓGICA (CRÍTICO)
  const minCalories = Math.round(tmb * 0.8);

  if (calories < minCalories) {
    calories = minCalories;
    strategy += ' | Piso metabólico aplicado';
  }

  // 🔥 8. ALERTAS INTELIGENTES
  const activityPerKg = avgActivity / weight;

  if (activityPerKg < 1) {

    if (goal === 'perda de gordura') {
      alert = 'Baixa atividade para emagrecimento. Aumentar NEAT (passos/dia) é prioridade.';
    } else {
      alert = 'Baixa atividade detectada. Risco de adaptação metabólica ou ganho de gordura.';
    }

  } else if (activityPerKg > 5) {

    if (goal === 'ganho de massa') {
      alert = 'Alto gasto calórico. Garanta ingestão adequada de carboidratos.';
    } else {
      alert = 'Alto gasto calórico. Monitorar fadiga e qualidade do sono.';
    }
  }

  // 🔥 9. CÁLCULO DE MACROS
  let protein = 0;
  let fat = 0;
  let carbs = 0;

  // base mais segura
  const baseWeight = leanMass && leanMass > 0 ? leanMass : weight * 0.7;

  // PROTEÍNA
  if (goal === 'perda de gordura') {
    protein = baseWeight * 2.2;
  } else if (goal === 'ganho de massa') {
    protein = baseWeight * 2.0;
  } else {
    protein = baseWeight * 1.8;
  }

  // 🔒 mínimo absoluto de proteína
  if (protein < 80) protein = 80;

  // GORDURA
  if (goal === 'perda de gordura') {
    fat = weight * 0.8;
  } else if (goal === 'ganho de massa') {
    fat = weight * 0.9;
  } else {
    fat = weight * 0.8;
  }

  // 🔒 limite gordura
  const maxFatKcal = calories * 0.3;
  if (fat * 9 > maxFatKcal) {
    fat = maxFatKcal / 9;
  }

  // CALORIAS
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;

  // CARBO
  const remainingKcal = calories - (proteinKcal + fatKcal);
  carbs = remainingKcal > 0 ? remainingKcal / 4 : 50;

  // 🔒 mínimo carbo
  if (carbs < 50) carbs = 50;

  return {
    goal,
    calories: Math.round(calories),
    strategy,
    alert,

    macros: {
      protein: Math.round(protein),
      fat: Math.round(fat),
      carbs: Math.round(carbs)
    }
  };
}