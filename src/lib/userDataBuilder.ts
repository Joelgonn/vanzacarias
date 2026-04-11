// ============================================================================
// USER DATA BUILDER - CONSTRUTOR CENTRALIZADO DE UserData
// NÃO SUBSTITUI nenhum arquivo existente, apenas integra
// ============================================================================

import { z } from 'zod';
import { processBeliscos, fetchHistoricoBeliscos } from '@/lib/beliscosProcessor';
import { calcularMacrosDoCardapio } from '@/lib/macroCalculator';
import { detectSabotagePattern, buildIntervention } from '@/lib/behaviorEngine';
import { formatMealPlan } from '@/lib/mealPlanFormatter';

// ============================================================================
// TIPAGENS
// ============================================================================
const FoodRestrictionSchema = z.object({
  type: z.string().optional(),
  foodId: z.string().optional(),
  tag: z.string().optional(),
  food: z.string().optional()
}).passthrough();

export interface UserDataForContext {
  nomePaciente: string;
  objetivoPrincipal: string;
  metaPeso: string;
  rotinaSono: string;
  vontadesDoces: string;
  alimentosEvitar: string[];
  restrictions: any[];
  cardapioFormatado: string;
  evolucaoTxt: string;
  humorHoje: string;
  aguaHoje: number;
  refeicoesFeitas: number;
  atividadesHojeFormatadas: string;
  activityKcal: number;
  todayStr: string;
  hasImage: boolean;
  macrosDiarios?: any;
  macrosPorRefeicao?: any[];
  beliscosHoje?: any;
  behaviorPattern?: any;
  interventionSuggestion?: string | null;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================
function getRefeicoesFeitasSafe(mealsChecked: any): number {
  if (Array.isArray(mealsChecked)) {
    return mealsChecked.length;
  }
  if (typeof mealsChecked === 'number') {
    return mealsChecked;
  }
  return 0;
}

// ============================================================================
// 🔥 FUNÇÃO PRINCIPAL: CONSTRUIR UserData
// ============================================================================
export async function buildUserData(params: {
  patient: any;
  todayLog: any;
  historicoBeliscos: { data: string; totalKcal: number; itemsCount: number }[];
  todayStr: string;
  supabase: any;
}): Promise<UserDataForContext> {
  const { patient, todayLog, historicoBeliscos, todayStr, supabase } = params;
  
  // Usar SEU macroEngine
  const macros = calcularMacrosDoCardapio(patient?.meal_plan);
  
  // Processar beliscos
  const beliscosProcessed = processBeliscos(todayLog?.beliscos);
  
  // Processar restrições
  const rawRestrictions = patient?.food_restrictions;
  const restrictionsValidation = z.array(FoodRestrictionSchema)
    .safeParse(Array.isArray(rawRestrictions) ? rawRestrictions : []);
  const safeRestrictions = restrictionsValidation.success ? restrictionsValidation.data : [];

  // Buscar alimentos a evitar (QFA)
  let alimentosEvitar: string[] = [];
  const { data: qfaData } = await supabase
    .from('qfa_responses')
    .select('answers')
    .eq('user_id', patient.id)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (qfaData?.[0]?.answers) {
    alimentosEvitar = Object.entries(qfaData[0].answers)
      .filter(([_, f]) => f === "0")
      .map(([a]) => a.replace(/_/g, ' '));
  }

  // Buscar avaliação para objetivo principal
  const { data: evalData } = await supabase
    .from('evaluations')
    .select('answers')
    .eq('user_id', patient.id)
    .order('created_at', { ascending: false })
    .limit(1);
  
  const objetivoPrincipal = evalData?.[0]?.answers?.["0"] || patient?.objetivo || 'Não informado';

  // Buscar evolução de peso
  const { data: antroData } = await supabase
    .from('anthropometry')
    .select('weight')
    .eq('user_id', patient.id)
    .order('measurement_date', { ascending: false })
    .limit(2);
  
  let evolucaoTxt = 'Iniciando.';
  if (antroData && antroData.length === 2 && antroData[0]?.weight && antroData[1]?.weight) {
    const diff = (antroData[1].weight - antroData[0].weight).toFixed(1);
    evolucaoTxt = `Variação de ${diff}kg na última medição`;
  }

  // Refeições feitas (seguro)
  const refeicoesFeitas = getRefeicoesFeitasSafe(todayLog?.meals_checked);

  // DETECTAR PADRÃO DE COMPORTAMENTO
  const behaviorPattern = detectSabotagePattern({
    beliscos: beliscosProcessed,
    macrosDiarios: macros?.macrosDiarios || undefined,
    humorHoje: todayLog?.mood,
    historicoBeliscos,
    objetivoPrincipal,
    refeicoesFeitas,
    totalRefeicoesPlano: macros?.macrosPorRefeicao?.length || 0,
    aguaHoje: todayLog?.water_ml || 0,
    activityKcal: todayLog?.activity_kcal || 0
  });
  
  const interventionSuggestion = buildIntervention(behaviorPattern, objetivoPrincipal);

  // Formatar atividades
  let atividadesHojeFormatadas = 'Nenhuma';
  if (todayLog?.activities && Array.isArray(todayLog.activities) && todayLog.activities.length > 0) {
    atividadesHojeFormatadas = todayLog.activities.map((a: any) => `- ${a.name}`).join('\n');
  }

  return {
    nomePaciente: patient?.full_name?.split(' ')[0] || 'Paciente',
    objetivoPrincipal,
    metaPeso: patient?.meta_peso ? `${patient.meta_peso}kg` : 'Manutenção',
    rotinaSono: '',
    vontadesDoces: '',
    alimentosEvitar,
    restrictions: safeRestrictions,
    cardapioFormatado: formatMealPlan(patient?.meal_plan),
    evolucaoTxt,
    humorHoje: todayLog?.mood || 'Não registrado',
    aguaHoje: todayLog?.water_ml || 0,
    refeicoesFeitas,
    atividadesHojeFormatadas,
    activityKcal: todayLog?.activity_kcal || 0,
    todayStr,
    hasImage: false,
    macrosDiarios: macros?.macrosDiarios || undefined,
    macrosPorRefeicao: macros?.macrosPorRefeicao,
    beliscosHoje: beliscosProcessed,
    behaviorPattern,
    interventionSuggestion
  };
}