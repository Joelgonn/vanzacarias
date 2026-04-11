// ============================================================================
// BEHAVIOR ENGINE - DETECÇÃO DE PADRÕES DE SABOTAGEM
// Nível: Elite | Propósito: Interpretar comportamento, não apenas calorias
// ============================================================================

export interface BeliscoItem {
  id: string;
  name?: string;
  grams?: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp?: string;
}

export interface BeliscosProcessed {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: BeliscoItem[];
  hasBeliscos: boolean;
}

export interface MacrosDiarios {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface BehaviorPatternInput {
  beliscos: BeliscosProcessed;
  macrosDiarios?: MacrosDiarios;
  humorHoje?: string;
  historicoBeliscos?: {
    data: string;
    totalKcal: number;
    itemsCount: number;
  }[];
  objetivoPrincipal?: string;
  refeicoesFeitas?: number;
  totalRefeicoesPlano?: number;
  aguaHoje?: number;
  metaAgua?: number;
  activityKcal?: number;
}

export interface PatternSummary {
  frequencia: 'ocasional' | 'frequente' | 'recorrente';
  periodoCritico: 'manha' | 'tarde' | 'noite' | 'nenhum';
  horarioPredominante?: string;
  diasConsecutivos: number;
  tendencia: string;
}

export interface RiskLevel {
  level: 'baixo' | 'medio' | 'alto' | 'critico';
  score: number;
  description: string;
}

export interface DisciplineScore {
  score: number;
  level: 'excelente' | 'bom' | 'regular' | 'atencao' | 'critico';
  components: {
    refeicoes: number;
    agua: number;
    beliscos: number;
    atividade: number;
  };
}

export interface BehaviorPatternOutput {
  isSabotaging: boolean;
  signals: {
    highCalories: boolean;
    frequentSnacks: boolean;
    emotionalEating: boolean;
    lateNightSnacking: boolean;
    recorrente: boolean;
  };
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  percent: number;
  totalKcal: number;
  itemsCount: number;
  lateNightCount: number;
  emotionalTrigger: boolean;
  patternSummary: PatternSummary;
  impactOnGoal: string;
  riskLevel: RiskLevel;
  disciplineScore: DisciplineScore;
}

// ============================================================================
// 🔍 FUNÇÃO PARA ANALISAR PADRÃO TEMPORAL
// ============================================================================
function analyzeTemporalPattern(items: BeliscoItem[]): { periodoCritico: 'manha' | 'tarde' | 'noite' | 'nenhum', horarioPredominante?: string, tendencia: string } {
  if (items.length === 0) {
    return { periodoCritico: 'nenhum', tendencia: 'sem padrão definido' };
  }

  let manha = 0;
  let tarde = 0;
  let noite = 0;

  items.forEach(item => {
    if (item.timestamp) {
      const hour = new Date(item.timestamp).getHours();
      if (hour >= 5 && hour < 12) manha++;
      else if (hour >= 12 && hour < 18) tarde++;
      else if (hour >= 18 || hour < 5) noite++;
    }
  });

  let tendencia = '';
  let periodoCritico: 'manha' | 'tarde' | 'noite' | 'nenhum' = 'nenhum';
  let horarioPredominante = '';

  if (noite > manha && noite > tarde) {
    periodoCritico = 'noite';
    horarioPredominante = 'noturno';
    tendencia = 'tendência a beliscar no período noturno';
  } else if (tarde > manha && tarde > noite) {
    periodoCritico = 'tarde';
    horarioPredominante = 'vespertino';
    tendencia = 'tendência a beliscar no período da tarde';
  } else if (manha > 0) {
    periodoCritico = 'manha';
    horarioPredominante = 'matutino';
    tendencia = 'tendência a beliscar no período da manhã';
  } else {
    tendencia = 'padrão esporádico sem horário definido';
  }

  return { periodoCritico, horarioPredominante, tendencia };
}

// ============================================================================
// 🔍 FUNÇÃO PARA ANALISAR FREQUÊNCIA
// ============================================================================
function analyzeFrequency(historicoBeliscos?: { data: string; totalKcal: number; itemsCount: number }[]): { frequencia: 'ocasional' | 'frequente' | 'recorrente', diasConsecutivos: number, tendencia: string } {
  if (!historicoBeliscos || historicoBeliscos.length === 0) {
    return { frequencia: 'ocasional', diasConsecutivos: 0, tendencia: 'evento isolado' };
  }

  const diasComBelisco = historicoBeliscos.filter(dia => dia.totalKcal > 0).length;
  const totalDias = historicoBeliscos.length;
  const proporcao = diasComBelisco / totalDias;

  let diasConsecutivos = 0;
  let currentStreak = 0;
  for (let i = 0; i < historicoBeliscos.length; i++) {
    if (historicoBeliscos[i].totalKcal > 0) {
      currentStreak++;
      diasConsecutivos = Math.max(diasConsecutivos, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  let frequencia: 'ocasional' | 'frequente' | 'recorrente' = 'ocasional';
  let tendencia = '';

  if (proporcao >= 0.7 || diasConsecutivos >= 3) {
    frequencia = 'recorrente';
    tendencia = 'padrão recorrente - tem acontecido com frequência nos últimos dias';
  } else if (proporcao >= 0.4 || diasConsecutivos >= 2) {
    frequencia = 'frequente';
    tendencia = 'tem acontecido com certa frequência';
  } else {
    tendencia = 'ocorrência ocasional, sem padrão consistente';
  }

  return { frequencia, diasConsecutivos, tendencia };
}

// ============================================================================
// 🔍 FUNÇÃO PARA CALCULAR RISK LEVEL
// ============================================================================
function calculateRiskLevel(percent: number, itemsCount: number, isRecorrente: boolean, isEmotional: boolean, currentHour?: number): RiskLevel {
  let score = 0;
  
  // Impacto calórico (0-40 pontos)
  if (percent > 30) score += 40;
  else if (percent > 20) score += 30;
  else if (percent > 10) score += 20;
  else if (percent > 0) score += 10;
  
  // Frequência (0-30 pontos)
  if (itemsCount >= 5) score += 30;
  else if (itemsCount >= 3) score += 20;
  else if (itemsCount >= 1) score += 10;
  
  // Recorrência (0-20 pontos)
  if (isRecorrente) score += 20;
  
  // Gatilho emocional (0-10 pontos)
  if (isEmotional) score += 10;
  
  // Bônus: horário de risco (noturno)
  if (currentHour && (currentHour >= 18 || currentHour < 5)) score += 5;
  
  let level: 'baixo' | 'medio' | 'alto' | 'critico';
  let description = '';
  
  if (score >= 70) {
    level = 'critico';
    description = 'RISCO CRÍTICO - Intervenção imediata necessária para não comprometer resultados';
  } else if (score >= 50) {
    level = 'alto';
    description = 'RISCO ALTO - Padrão pode estar prejudicando o déficit calórico';
  } else if (score >= 30) {
    level = 'medio';
    description = 'RISCO MÉDIO - Vale observar e ajustar comportamento';
  } else {
    level = 'baixo';
    description = 'RISCO BAIXO - Impacto controlado, seguir monitorando';
  }
  
  return { level, score, description };
}

// ============================================================================
// 🔍 FUNÇÃO PARA CALCULAR DISCIPLINE SCORE
// ============================================================================
function calculateDisciplineScore(
  refeicoesFeitas?: number,
  totalRefeicoesPlano?: number,
  aguaHoje?: number,
  metaAgua: number = 2000,
  beliscosPercent: number = 0,
  activityKcal?: number
): DisciplineScore {
  // Componente 1: Refeições (0-30 pontos)
  let refeicoesScore = 0;
  if (totalRefeicoesPlano && totalRefeicoesPlano > 0) {
    const proportion = (refeicoesFeitas || 0) / totalRefeicoesPlano;
    refeicoesScore = proportion * 30;
  } else {
    refeicoesScore = 15; // Neutro se não tem dados
  }
  
  // Componente 2: Água (0-25 pontos)
  let aguaScore = 0;
  const aguaProportion = Math.min((aguaHoje || 0) / metaAgua, 1);
  aguaScore = aguaProportion * 25;
  
  // Componente 3: Beliscos (0-30 pontos) - quanto menos beliscos, maior pontuação
  let beliscosScore = 0;
  if (beliscosPercent === 0) {
    beliscosScore = 30;
  } else if (beliscosPercent <= 10) {
    beliscosScore = 25;
  } else if (beliscosPercent <= 20) {
    beliscosScore = 18;
  } else if (beliscosPercent <= 30) {
    beliscosScore = 10;
  } else {
    beliscosScore = 5;
  }
  
  // Componente 4: Atividade (0-15 pontos)
  let atividadeScore = 0;
  if (activityKcal && activityKcal > 0) {
    if (activityKcal >= 300) atividadeScore = 15;
    else if (activityKcal >= 150) atividadeScore = 10;
    else atividadeScore = 5;
  } else {
    atividadeScore = 0;
  }
  
  const totalScore = Math.round(refeicoesScore + aguaScore + beliscosScore + atividadeScore);
  
  let level: 'excelente' | 'bom' | 'regular' | 'atencao' | 'critico';
  if (totalScore >= 85) level = 'excelente';
  else if (totalScore >= 70) level = 'bom';
  else if (totalScore >= 50) level = 'regular';
  else if (totalScore >= 30) level = 'atencao';
  else level = 'critico';
  
  return {
    score: totalScore,
    level,
    components: {
      refeicoes: Math.round(refeicoesScore),
      agua: Math.round(aguaScore),
      beliscos: Math.round(beliscosScore),
      atividade: Math.round(atividadeScore)
    }
  };
}

// ============================================================================
// 🔍 FUNÇÃO PARA CALCULAR IMPACTO NO OBJETIVO
// ============================================================================
function calculateImpactOnGoal(percent: number, objetivoPrincipal?: string): string {
  if (percent === 0) return 'sem impacto';
  
  const isEmagrecimento = objetivoPrincipal?.toLowerCase().includes('emagrec') || 
                          objetivoPrincipal?.toLowerCase().includes('perder') ||
                          objetivoPrincipal?.toLowerCase().includes('peso');
  
  if (isEmagrecimento) {
    if (percent > 30) return 'impacto crítico no déficit calórico para emagrecimento';
    if (percent > 20) return 'impacto significativo no déficit calórico';
    if (percent > 10) return 'impacto moderado no déficit calórico';
    return 'impacto leve no déficit calórico';
  }
  
  if (percent > 30) return 'pode comprometer a manutenção do peso';
  if (percent > 20) return 'requer atenção no equilíbrio calórico';
  if (percent > 10) return 'impacto controlado, mas observe';
  return 'impacto mínimo';
}

// ============================================================================
// 🔍 FUNÇÃO PRINCIPAL DE DETECÇÃO
// ============================================================================
export function detectSabotagePattern(data: BehaviorPatternInput): BehaviorPatternOutput {
  const { 
    beliscos, 
    macrosDiarios, 
    humorHoje, 
    historicoBeliscos, 
    objetivoPrincipal,
    refeicoesFeitas,
    totalRefeicoesPlano,
    aguaHoje,
    activityKcal
  } = data;
  
  // Caso não tenha beliscos
  if (!beliscos.hasBeliscos || beliscos.totalKcal === 0) {
    const disciplineScore = calculateDisciplineScore(
      refeicoesFeitas, totalRefeicoesPlano, aguaHoje, 2000, 0, activityKcal
    );
    
    return {
      isSabotaging: false,
      signals: {
        highCalories: false,
        frequentSnacks: false,
        emotionalEating: false,
        lateNightSnacking: false,
        recorrente: false
      },
      severity: 'none',
      percent: 0,
      totalKcal: 0,
      itemsCount: 0,
      lateNightCount: 0,
      emotionalTrigger: false,
      patternSummary: {
        frequencia: 'ocasional',
        periodoCritico: 'nenhum',
        diasConsecutivos: 0,
        tendencia: 'sem beliscos registrados'
      },
      impactOnGoal: 'sem impacto',
      riskLevel: {
        level: 'baixo',
        score: 0,
        description: 'Sem risco identificado'
      },
      disciplineScore
    };
  }

  const totalKcal = beliscos.totalKcal;
  const items = beliscos.items || [];
  const itemsCount = items.length;
  const meta = macrosDiarios?.totalKcal || 1;
  const percent = (totalKcal / meta) * 100;

  // DETECÇÃO DE BELISCOS NOTURNOS
  let lateNightCount = 0;
  let currentHour = new Date().getHours();
  items.forEach(item => {
    if (item.timestamp) {
      const hour = new Date(item.timestamp).getHours();
      if (hour >= 18) {
        lateNightCount++;
      }
    }
  });
  const lateNightSnacking = lateNightCount > 0;

  // DETECÇÃO DE ALIMENTAÇÃO EMOCIONAL
  const humoresDificeis = ['dificil', 'triste', 'ansioso', 'estressado', 'deprimido'];
  const emotionalEating = humoresDificeis.includes(humorHoje || '') && itemsCount > 0;

  // DETECÇÃO DE FREQUÊNCIA ALTA
  const frequentSnacks = itemsCount >= 4;

  // DETECÇÃO DE ALTO IMPACTO CALÓRICO
  const highCalories = percent > 20;

  // ANÁLISE DE PADRÃO TEMPORAL
  const temporalPattern = analyzeTemporalPattern(items);

  // ANÁLISE DE FREQUÊNCIA
  const frequencyAnalysis = analyzeFrequency(historicoBeliscos);
  const recorrente = frequencyAnalysis.frequencia === 'recorrente' || frequencyAnalysis.diasConsecutivos >= 2;

  // DETERMINA SE ESTÁ SABOTANDO
  const isSabotaging = highCalories || frequentSnacks || lateNightSnacking || recorrente;

  // DETERMINA GRAVIDADE
  let severity: 'critical' | 'high' | 'medium' | 'low' | 'none' = 'none';
  
  if (percent > 30 || (emotionalEating && itemsCount >= 3)) {
    severity = 'critical';
  } else if (percent > 20 || (lateNightSnacking && itemsCount >= 3)) {
    severity = 'high';
  } else if (percent > 10 || itemsCount >= 3) {
    severity = 'medium';
  } else if (percent > 0) {
    severity = 'low';
  }

  // CALCULA RISK LEVEL
  const riskLevel = calculateRiskLevel(percent, itemsCount, recorrente, emotionalEating, currentHour);

  // CALCULA DISCIPLINE SCORE
  const disciplineScore = calculateDisciplineScore(
    refeicoesFeitas, totalRefeicoesPlano, aguaHoje, 2000, percent, activityKcal
  );

  // CALCULA IMPACTO NO OBJETIVO
  const impactOnGoal = calculateImpactOnGoal(percent, objetivoPrincipal);

  // CONSTRÓI TENDÊNCIA COMPLETA
  let tendenciaCompleta = '';
  if (frequencyAnalysis.tendencia !== 'evento isolado') {
    tendenciaCompleta = frequencyAnalysis.tendencia;
    if (temporalPattern.tendencia !== 'sem padrão definido' && temporalPattern.tendencia !== 'padrão esporádico sem horário definido') {
      tendenciaCompleta += `. ${temporalPattern.tendencia}`;
    }
  } else {
    tendenciaCompleta = temporalPattern.tendencia;
  }

  return {
    isSabotaging,
    signals: {
      highCalories,
      frequentSnacks,
      emotionalEating,
      lateNightSnacking,
      recorrente
    },
    severity,
    percent,
    totalKcal,
    itemsCount,
    lateNightCount,
    emotionalTrigger: emotionalEating,
    patternSummary: {
      frequencia: frequencyAnalysis.frequencia,
      periodoCritico: temporalPattern.periodoCritico,
      horarioPredominante: temporalPattern.horarioPredominante,
      diasConsecutivos: frequencyAnalysis.diasConsecutivos,
      tendencia: tendenciaCompleta
    },
    impactOnGoal,
    riskLevel,
    disciplineScore
  };
}

// ============================================================================
// 💬 FUNÇÃO PARA CONSTRUIR INTERVENÇÃO INTELIGENTE (VERSÃO ATUALIZADA)
// ============================================================================
export function buildIntervention(pattern: BehaviorPatternOutput, objetivoPrincipal?: string): string | null {
  if (!pattern.isSabotaging) return null;

  const isEmagrecimento = objetivoPrincipal?.toLowerCase().includes('emagrec') || 
                          objetivoPrincipal?.toLowerCase().includes('perder') ||
                          objetivoPrincipal?.toLowerCase().includes('peso');

  // 🔴 PRIORIDADE 1: ALIMENTAÇÃO EMOCIONAL
  if (pattern.signals.emotionalEating) {
    if (pattern.severity === 'critical') {
      return `Percebi que hoje foi um dia realmente difícil e isso refletiu na sua alimentação. Isso é mais comum do que você imagina. Não se cobre tanto. Vamos focar apenas na próxima refeição, ok? Você consegue retomar o controle agora. 💙

🎯 PRÓXIMA AÇÃO IMEDIATA: Beba um copo d'água agora e respire fundo.`;
    }
    return `Vi que hoje o dia foi desafiador e os beliscos apareceram. Isso acontece com todo mundo. Que tal beber um copo d'água e respirar? A próxima refeição é uma nova chance. 🫂

🎯 PRÓXIMA AÇÃO IMEDIATA: Faça a próxima refeição do seu plano sem culpa.`;
  }

  // 🔴 PRIORIDADE 2: BELISCOS NOTURNOS
  if (pattern.signals.lateNightSnacking) {
    if (pattern.severity === 'critical') {
      return `${pattern.patternSummary.tendencia}. Isso costuma estar ligado a cansaço acumulado ou ansiedade. Que tal preparar um lanche estratégico para esse horário amanhã? Posso te ajudar com sugestões. 🌙

🎯 PRÓXIMA AÇÃO IMEDIATA: Prepare um chá ou água com limão para quando der vontade de beliscar à noite.`;
    }
    return `${pattern.patternSummary.tendencia}. Muita gente passa por isso. Podemos ajustar um lanche leve e gostoso para esse horário se quiser. 💡

🎯 PRÓXIMA AÇÃO IMEDIATA: Na próxima vez, tente esperar 10 minutos antes de beliscar.`;
  }

  // 🔴 PRIORIDADE 3: ALTO IMPACTO CALÓRICO
  if (pattern.signals.highCalories) {
    if (pattern.severity === 'critical') {
      return `${pattern.impactOnGoal}. ${pattern.patternSummary.tendencia}. Não precisa compensar amanhã, mas vale a pena retomar o plano na próxima refeição com atenção. Vamos juntos? 🎯

🎯 PRÓXIMA AÇÃO IMEDIATA: Retome o plano na próxima refeição sem pular nenhuma.`;
    }
    return `${pattern.impactOnGoal}. ${pattern.patternSummary.tendencia}. Isso pode atrasar seus resultados se repetir. Que tal fazermos um check dos seus horários de fome? 🍽️

🎯 PRÓXIMA AÇÃO IMEDIATA: Identifique qual horário você sente mais fome e me avise.`;
  }

  // 🟡 PRIORIDADE 4: FREQUÊNCIA ALTA
  if (pattern.signals.frequentSnacks) {
    return `${pattern.patternSummary.tendencia}. Às vezes isso acontece quando as refeições principais não estão saciando completamente. Podemos rever seu cardápio se quiser. 🔍

🎯 PRÓXIMA AÇÃO IMEDIATA: Na próxima refeição, aumente um pouco a porção de proteína e veja se ajuda.`;
  }

  // 🟡 PRIORIDADE 5: PADRÃO RECORRENTE
  if (pattern.signals.recorrente) {
    return `${pattern.patternSummary.tendencia}. Isso pode indicar um padrão que vale a pena observarmos juntos. Você tem percebido algo que desencadeia esses momentos? 🤔

🎯 PRÓXIMA AÇÃO IMEDIATA: Anote o que você estava sentindo antes de beliscar na próxima vez.`;
  }

  return null;
}

// ============================================================================
// 📊 FUNÇÃO PARA FORMATAR CONTEXTO PARA IA (SOMENTE DADOS, SEM INTERPRETAÇÃO)
// ============================================================================
export function formatBeliscosDataForContext(beliscos: BeliscosProcessed, macrosDiarios?: MacrosDiarios): string {
  if (!beliscos.hasBeliscos || beliscos.totalKcal === 0) {
    return '';
  }

  const metaKcal = macrosDiarios?.totalKcal || 1;
  const percentImpacto = (beliscos.totalKcal / metaKcal) * 100;

  let itensLista = '';
  if (beliscos.items && beliscos.items.length > 0) {
    const topItens = beliscos.items.slice(0, 5);
    itensLista = '\nITENS REGISTRADOS:\n';
    topItens.forEach(item => {
      const nome = item.name || 'Belisco manual';
      const horario = item.timestamp ? new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'horário não registrado';
      itensLista += `  - ${nome}: ${Math.round(item.kcal)} kcal (${horario})`;
      if (item.grams) itensLista += ` - ${Math.round(item.grams)}g`;
      itensLista += ` | P:${Math.round(item.protein)}g | C:${Math.round(item.carbs)}g | G:${Math.round(item.fat)}g\n`;
    });
    if (beliscos.items.length > 5) {
      itensLista += `  - ... e mais ${beliscos.items.length - 5} itens\n`;
    }
  }

  return `
[BELISCOS DO DIA - DADOS BRUTOS]
- Total de calorias extras: ${Math.round(beliscos.totalKcal)} kcal (${percentImpacto.toFixed(1)}% da meta diária)
- Proteínas extras: ${Math.round(beliscos.totalProtein)}g
- Carboidratos extras: ${Math.round(beliscos.totalCarbs)}g
- Gorduras extras: ${Math.round(beliscos.totalFat)}g
- Número de episódios: ${beliscos.items.length}
${itensLista}
`.trim();
}