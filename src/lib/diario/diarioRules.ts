'use client'

/**
 * DIÁRIO — Regras determinísticas de status
 * Sem IA, sem rede, sem diagnóstico.
 * Preserva NULL (ausente ≠ 0) e diferencia "não informado" de "não realizou".
 * Estrutura real auditada: daily_logs { id, user_id, date (YYYY-MM-DD civil), water_ml, meals_checked: string[], mood, activities: Activity[], activity_kcal, beliscos }
 * Limitação documentada: meals_checked guarda apenas nomes marcados; não existe campo "não realizou" no banco — ausente = "não informado" (ATENÇÃO, nunca RISCO automático).
 */

export type DiaryStatus = 'normal' | 'atencao' | 'risco' | 'sem_dados'

export type DiaryItemKind = 'hidratacao' | 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'atividade' | 'humor' | 'refeicao_generica'

export interface HydrationEval {
  waterMl: number | null
  waterGoal: number | null // somente se houver fonte de peso válida (checkins/antro), caso contrário null
  percent: number | null
  status: DiaryStatus
  label: string // ex: "1.200 / 2.000 ml" ou "1.200 ml registrados" ou "Sem registro"
}

export interface MealEval {
  expected: string[] // nomes do meal_plan (ou fallback 5 padrão se não houver plano)
  checked: string[]
  registeredCount: number
  totalExpected: number | null // null quando não há plano definido
  items: { name: string; status: DiaryStatus; state: 'registrado' | 'nao_informado' | 'nao_realizado' }[]
  overallStatus: DiaryStatus
}

export interface ActivityEval {
  hasActivity: boolean // activity_kcal >0 ou activities.length>0
  kcal: number | null
  activities: { name: string }[]
  status: DiaryStatus
  label: string
}

export interface MoodEval {
  mood: string | null
  status: DiaryStatus
  hasMood: boolean
}

export interface DayStatusEval {
  overall: DiaryStatus
  hasAnyData: boolean // se existe pelo menos um dado no dia
  reasons: string[]
}

export interface DailyLogLike {
  id: string
  date: string
  water_ml?: number | null | unknown
  meals_checked?: string[] | unknown
  mood?: string | null | unknown
  activities?: unknown[] | unknown
  activity_kcal?: number | null | unknown
  beliscos?: unknown
  // allow extra fields
  [k: string]: unknown
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function asPositiveNumber(value: unknown): number | null {
  const n = asNumber(value)
  if (n === null || n <= 0) return null
  return n
}

// Hidratação ---------------------------------------------------------------

export function getHydrationStatus(waterMlRaw: unknown, waterGoalRaw: number | null): HydrationEval {
  const waterMl = asNumber(waterMlRaw) // 0 é dado ausente? água 0 ml = sem registro, não 0 cm
  const hasWater = waterMl !== null && waterMl > 0
  const waterGoal = waterGoalRaw && Number.isFinite(waterGoalRaw) && waterGoalRaw > 0 ? waterGoalRaw : null
  const percent = hasWater && waterGoal ? Math.round((waterMl / waterGoal) * 100) : null

  let status: DiaryStatus
  let label: string

  if (!hasWater) {
    status = 'atencao'
    label = 'Sem registro'
  } else if (waterGoal === null) {
    status = 'atencao'
    label = `${waterMl!.toLocaleString('pt-BR')} ml registrados`
  } else if (percent !== null) {
    if (percent >= 80) status = 'normal'
    else if (percent >= 40) status = 'atencao'
    else status = 'risco'
    label = `${waterMl!.toLocaleString('pt-BR')} / ${waterGoal.toLocaleString('pt-BR')} ml`
  } else {
    status = 'atencao'
    label = `${waterMl!.toLocaleString('pt-BR')} ml`
  }

  return { waterMl: hasWater ? waterMl! : null, waterGoal, percent, status, label }
}

// Refeições ---------------------------------------------------------------
// mealPlanNames: exatos de profile.meal_plan[].name — se null/empty, não há plano definido
export function getMealStatus(mealsCheckedRaw: unknown, mealPlanNames: string[] | null): MealEval {
  const checked = Array.isArray(mealsCheckedRaw) ? (mealsCheckedRaw.filter((x) => typeof x === 'string') as string[]) : []
  const hasPlan = Array.isArray(mealPlanNames) && mealPlanNames.length > 0

  if (!hasPlan) {
    // Sem plano: não inventar "5 refeições". Trata genericamente.
    const overallStatus: DiaryStatus = checked.length > 0 ? 'normal' : 'atencao'
    return {
      expected: [],
      checked,
      registeredCount: checked.length,
      totalExpected: null,
      items: checked.map((name) => ({ name, status: 'normal' as DiaryStatus, state: 'registrado' as const })),
      overallStatus,
    }
  }

  const expected = mealPlanNames!
  const items = expected.map((name) => {
    const isChecked = checked.includes(name)
    if (isChecked) return { name, status: 'normal' as DiaryStatus, state: 'registrado' as const }
    // Limitação: banco não possui "não realizou" — ausente = não informado (ATENÇÃO, nunca RISCO automático)
    return { name, status: 'atencao' as DiaryStatus, state: 'nao_informado' as const }
  })
  const registeredCount = checked.filter((c) => expected.includes(c)).length
  // Se nenhuma refeição informada, ATENÇÃO; se todas ok, NORMAL; parcial = ATENÇÃO
  const allNormal = items.every((i) => i.status === 'normal')
  const overallStatus: DiaryStatus = allNormal ? 'normal' : 'atencao'

  return { expected, checked, registeredCount, totalExpected: expected.length, items, overallStatus }
}

// Helpers para mapear refeição para categoria semântica (café/almoco/lanche/jantar)
export function classifyMealKind(mealName: string): DiaryItemKind {
  const n = mealName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (n.includes('cafe') || n.includes('manha') && n.includes('cafe')) return 'cafe'
  if (n.includes('almoco')) return 'almoco'
  if (n.includes('jantar')) return 'jantar'
  if (n.includes('lanche') || n.includes('ceia') || n.includes('colacao')) return 'lanche'
  return 'refeicao_generica'
}

// Atividade ---------------------------------------------------------------

export function getActivityStatus(log: DailyLogLike): ActivityEval {
  const kcalRaw = log.activity_kcal
  const hasKcal = asNumber(kcalRaw) !== null && asNumber(kcalRaw)! > 0
  const acts = Array.isArray(log.activities) ? (log.activities as any[]).filter((a) => a && typeof a === 'object') : []
  const hasActivity = hasKcal || acts.length > 0
  const kcal = asNumber(kcalRaw) // pode ser 0
  const activities = acts.map((a: any) => ({ name: a.name || a.type || '' })).filter((a) => a.name)

  let status: DiaryStatus
  let label: string
  if (!hasActivity) {
    status = 'atencao'
    label = 'Sem registro'
  } else {
    status = 'normal'
    label = kcal !== null && kcal > 0 ? `${kcal} kcal` : `${activities.length} atividade(s)`
  }
  return { hasActivity, kcal, activities, status, label }
}

// Humor -------------------------------------------------------------------

export function getMoodStatus(moodRaw: unknown): MoodEval {
  const mood = typeof moodRaw === 'string' && moodRaw.trim() !== '' ? moodRaw.trim() : null
  const hasMood = mood !== null
  // Humor é ponto de conversa, nunca diagnóstico — sem RISCO
  const status: DiaryStatus = hasMood ? 'normal' : 'sem_dados'
  return { mood, status, hasMood }
}

// Dia ---------------------------------------------------------------------

export function getDayStatus(args: {
  hydration: HydrationEval
  meals: MealEval
  activity: ActivityEval
  mood: MoodEval
  hasLog: boolean // se existe registro daily_logs para a data
}): DayStatusEval {
  const { hydration, meals, activity, mood, hasLog } = args
  if (!hasLog) {
    return { overall: 'sem_dados', hasAnyData: false, reasons: ['Sem registro para este dia'] }
  }
  // Verificar se há pelo menos um dado real
  const hasAnyData =
    hydration.waterMl !== null ||
    meals.registeredCount > 0 ||
    activity.hasActivity ||
    mood.hasMood

  if (!hasAnyData) {
    return { overall: 'sem_dados', hasAnyData: false, reasons: ['Dia sem dados suficientes'] }
  }

  const statuses: DiaryStatus[] = [hydration.status, meals.overallStatus, activity.status].filter((s) => s !== 'sem_dados')
  // mood sem_dados não influencia status geral
  if (statuses.includes('risco')) return { overall: 'risco', hasAnyData: true, reasons: ['Pelo menos um item em RISCO'] }
  if (statuses.includes('atencao')) return { overall: 'atencao', hasAnyData: true, reasons: ['Pelo menos um item em ATENÇÃO'] }
  return { overall: 'normal', hasAnyData: true, reasons: ['Todos os itens em NORMAL'] }
}

// Comparação --------------------------------------------------------------

export type DiaryComparison = {
  hasBoth: boolean
  hydrationDelta: { current: number | null; previous: number | null; diff: number | null; text: string | null }
  mealsDelta: { current: number; previous: number; diff: number | null; text: string | null }
  activityDelta: { current: boolean; previous: boolean; text: string | null }
}

export function compareDiaryDays(current: DailyLogLike | null, previous: DailyLogLike | null): DiaryComparison {
  const curWater = asNumber(current?.water_ml)
  const prevWater = asNumber(previous?.water_ml)
  const hasBothWater = curWater !== null && prevWater !== null && curWater > 0 && prevWater > 0
  let hydrationText: string | null = null
  let diff: number | null = null
  if (hasBothWater) {
    diff = Math.round((curWater! - prevWater!) * 10) / 10
    if (diff === 0) hydrationText = 'Mesmo volume de água registrado.'
    else if (diff > 0) hydrationText = `A ingestão registrada aumentou ${Math.abs(diff).toLocaleString('pt-BR')} ml em relação ao dia anterior.`
    else hydrationText = `A ingestão registrada diminuiu ${Math.abs(diff).toLocaleString('pt-BR')} ml em relação ao dia anterior.`
  }

  const curMeals = Array.isArray(current?.meals_checked) ? (current!.meals_checked as string[]).length : 0
  const prevMeals = Array.isArray(previous?.meals_checked) ? (previous!.meals_checked as string[]).length : 0
  const hasBothMeals = current !== null && previous !== null
  let mealsText: string | null = null
  let mealsDiff: number | null = null
  if (hasBothMeals) {
    mealsDiff = curMeals - prevMeals
    if (mealsDiff === 0) mealsText = 'Mesmo número de refeições informadas.'
    else if (mealsDiff > 0) mealsText = `O número de refeições informadas foi maior neste dia.`
    else mealsText = `O número de refeições informadas foi menor neste dia.`
  }

  const curAct = !!asPositiveNumber(current?.activity_kcal) || (Array.isArray(current?.activities) && (current!.activities as any[]).length > 0)
  const prevAct = !!asPositiveNumber(previous?.activity_kcal) || (Array.isArray(previous?.activities) && (previous!.activities as any[]).length > 0)
  let actText: string | null = null
  if (current !== null && previous !== null) {
    if (curAct && !prevAct) actText = 'Atividade registrada neste dia e ausente no anterior.'
    else if (!curAct && prevAct) actText = 'Atividade ausente neste dia e registrada no anterior.'
    else if (curAct && prevAct) actText = 'Atividade registrada em ambos os dias.'
    else actText = 'Sem atividade registrada em ambos os dias.'
  }

  return {
    hasBoth: current !== null && previous !== null,
    hydrationDelta: { current: curWater, previous: prevWater, diff, text: hydrationText },
    mealsDelta: { current: curMeals, previous: prevMeals, diff: mealsDiff, text: mealsText },
    activityDelta: { current: curAct, previous: prevAct, text: actText },
  }
}

// Util: meta hidratação derivada (35ml/kg) — somente se houver peso válido
export function deriveWaterGoal(checkinsLastWeight: number | null, antroWeight: number | null): number | null {
  const w = checkinsLastWeight ?? antroWeight
  if (w === null || !Number.isFinite(w) || w <= 0) return null
  return Math.round(w * 35)
}

export const diaryStatusMeta: Record<DiaryStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  normal: { label: 'NORMAL', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  atencao: { label: 'ATENÇÃO', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  risco: { label: 'RISCO', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
  sem_dados: { label: 'SEM DADOS', color: 'text-stone-500', bg: 'bg-stone-50', border: 'border-stone-200', dot: 'bg-stone-400' },
}
