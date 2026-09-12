'use client'

import { CalendarCheck, Droplets, Coffee, Flame, Smile } from 'lucide-react'
import { formatCivilDate, formatCivilDateLong } from '@/lib/civilDate'
import type { DailyLogLike } from '@/lib/diario/diarioRules'
import { getHydrationStatus, getMealStatus, getActivityStatus, getMoodStatus, getDayStatus, diaryStatusMeta, classifyMealKind } from '@/lib/diario/diarioRules'
import { getHydrationInsight, getMealInsight, getActivityInsight, getMoodInsight, getOverallDayInsight, getMealsSummaryInsight } from '@/lib/diario/diarioInsights'
import { DiaryInsight } from './DiaryInsight'
import { cn } from '@/ui/system'

type Props = {
  date: string // YYYY-MM-DD civil
  log: DailyLogLike | null
  dailyLogs?: DailyLogLike[] // not used but for future comparison
  mealPlanNames: string[] | null
  waterGoal: number | null
  variant: 'primary' | 'comparison'
  onSelect?: () => void
  onMakePrimary?: () => void
}

function StatusBadge({ status }: { status: keyof typeof diaryStatusMeta }) {
  const meta = diaryStatusMeta[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${meta.bg} ${meta.border} ${meta.color}`}>
      <span className={`w-2 h-2 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

function ItemRow({ icon, label, value, status, insight }: { icon: React.ReactNode; label: string; value: React.ReactNode; status: keyof typeof diaryStatusMeta; insight: React.ReactNode }) {
  const meta = diaryStatusMeta[status]
  return (
    <div className="flex items-center justify-between gap-2 py-2.5 border-b border-stone-100 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-stone-400 shrink-0" aria-hidden="true">{icon}</span>
        <span className="text-sm font-medium text-stone-700 truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-sm font-bold tabular-nums ${status === 'sem_dados' ? 'text-stone-400 font-medium text-xs' : 'text-stone-800'}`}>{value}</span>
        <span className={`w-2 h-2 rounded-full ${meta.dot}`} aria-hidden="true" title={meta.label} />
        {insight}
      </div>
    </div>
  )
}

export function DiarioDayCard({ date, log, mealPlanNames, waterGoal, variant, onSelect, onMakePrimary }: Props) {
  const hasLog = !!log
  const hydration = getHydrationStatus(log?.water_ml, waterGoal)
  const meals = getMealStatus(log?.meals_checked, mealPlanNames)
  const activity = getActivityStatus((log || { id: '', date }) as DailyLogLike)
  const mood = getMoodStatus(log?.mood)
  const dayStatus = getDayStatus({ hydration, meals, activity, mood, hasLog })
  const overallInsight = getOverallDayInsight(dayStatus.overall, dayStatus.hasAnyData)

  const weekday = (() => {
    const [y, m, d] = date.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString('pt-BR', { weekday: 'long' })
  })()

  if (!hasLog) {
    return (
      <div className={cn('rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col', variant === 'primary' ? 'border-nutri-200 ring-1 ring-nutri-100' : 'border-stone-200')}>
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-stone-500">{variant === 'primary' ? 'Dia selecionado' : 'Dia de comparação'}</p>
            <p className="text-sm font-bold text-stone-800">{formatCivilDateLong(date)} <span className="text-xs font-medium text-stone-500 capitalize">— {weekday}</span></p>
            <p className="text-xs text-stone-400">{formatCivilDate(date)}</p>
          </div>
          <StatusBadge status="sem_dados" />
        </div>
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
          <CalendarCheck size={28} className="text-stone-300 mb-2" aria-hidden="true" />
          <p className="text-sm font-bold text-stone-600">Nenhum registro disponível para este dia.</p>
          <p className="text-xs text-stone-500 mt-1">O paciente não possui dados em {formatCivilDate(date)}.</p>
          {variant === 'comparison' && onMakePrimary && (
            <button onClick={onMakePrimary} className="mt-4 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800">Tornar principal</button>
          )}
        </div>
      </div>
    )
  }

  // Build per-meal insights for display (show each expected meal as row)
  const mealRows = meals.totalExpected !== null
    ? meals.items
    : // sem plano: mostrar apenas refeições registradas como genéricas
      (meals.checked.map((name) => ({ name, status: 'normal' as const, state: 'registrado' as const })) as any[])

  const hydrationInsight = getHydrationInsight({ hasWater: hydration.waterMl !== null, percent: hydration.percent, hasGoal: hydration.waterGoal !== null, waterMl: hydration.waterMl })
  const mealsSummaryInsight = getMealsSummaryInsight(meals.registeredCount, meals.totalExpected, meals.overallStatus)
  const activityInsight = getActivityInsight(activity.hasActivity)
  const moodInsight = getMoodInsight(mood.mood)

  return (
    <div className={cn('rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col', variant === 'primary' ? 'border-nutri-200 ring-1 ring-nutri-100' : 'border-stone-200')}>
      <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/60 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">{variant === 'primary' ? 'Dia selecionado' : 'Dia de comparação'}</p>
          <p className="text-sm font-bold text-stone-900">{formatCivilDateLong(date)} <span className="hidden sm:inline text-xs font-medium text-stone-500 capitalize">— {weekday}</span></p>
          <p className="text-xs text-stone-500">{formatCivilDate(date)} {variant === 'primary' && <span className="ml-1 inline-flex items-center rounded-full bg-nutri-900 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">Selecionado</span>}</p>
          {variant === 'primary' && (
            <div className="mt-1.5 flex items-center gap-2">
              <StatusBadge status={dayStatus.overall} />
              <DiaryInsight insight={overallInsight} label="Insight do dia" />
            </div>
          )}
          {variant === 'comparison' && (
            <div className="mt-1.5">
              <StatusBadge status={dayStatus.overall} />
            </div>
          )}
        </div>
        {variant === 'comparison' && onMakePrimary ? (
          <button onClick={onMakePrimary} className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50">Tornar principal</button>
        ) : variant === 'primary' && onSelect ? (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-nutri-700 bg-nutri-50 border border-nutri-200 rounded-full px-2 py-1">Dia em análise</span>
        ) : null}
      </div>

      {/* Resumo superior — 4 cards com insight direto nos próprios cards */}
      <div className="px-4 py-3 grid grid-cols-2 lg:grid-cols-4 gap-2 border-b border-stone-100 bg-white">
        <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-2.5 text-center flex flex-col items-center">
          <Droplets size={14} className="mb-1 text-blue-500" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Hidratação</p>
          <p className="text-xs font-bold text-stone-800 mt-0.5">{hydration.label}</p>
          {hydration.percent !== null && <p className="text-[11px] font-medium text-stone-500">{hydration.percent}% da meta</p>}
          {hydration.waterGoal !== null && <div className="mt-1.5 h-1.5 w-full bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, hydration.percent || 0)}%` }} /></div>}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${diaryStatusMeta[hydration.status].dot}`} aria-hidden="true" title={diaryStatusMeta[hydration.status].label} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{diaryStatusMeta[hydration.status].label}</span>
            <DiaryInsight insight={hydrationInsight} label="Insight hidratação" />
          </div>
        </div>
        <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-2.5 text-center flex flex-col items-center">
          <Coffee size={14} className="mb-1 text-amber-600" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Refeições</p>
          <p className="text-xs font-bold text-stone-800 mt-0.5">{meals.totalExpected !== null ? `${meals.registeredCount} de ${meals.totalExpected} registradas` : meals.registeredCount > 0 ? `${meals.registeredCount} registrada(s)` : 'Sem registro'}</p>
          {meals.totalExpected !== null && <p className="text-[11px] font-medium text-stone-500">{meals.registeredCount === meals.totalExpected ? 'Todas informadas' : 'Algumas não informadas'}</p>}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${diaryStatusMeta[meals.overallStatus].dot}`} aria-hidden="true" title={diaryStatusMeta[meals.overallStatus].label} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{diaryStatusMeta[meals.overallStatus].label}</span>
            <DiaryInsight insight={mealsSummaryInsight} label="Insight refeições" />
          </div>
        </div>
        <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-2.5 text-center flex flex-col items-center">
          <Flame size={14} className="mb-1 text-orange-500" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Atividade</p>
          <p className="text-xs font-bold text-stone-800 mt-0.5">{activity.label}</p>
          {activity.activities.length > 0 && <p className="text-[11px] font-medium text-stone-500 truncate max-w-full">{activity.activities.map((a) => a.name).join(', ')}</p>}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${diaryStatusMeta[activity.status].dot}`} aria-hidden="true" title={diaryStatusMeta[activity.status].label} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{diaryStatusMeta[activity.status].label}</span>
            <DiaryInsight insight={activityInsight} label="Insight atividade" />
          </div>
        </div>
        <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-2.5 text-center flex flex-col items-center">
          <Smile size={14} className="mb-1 text-emerald-500" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Humor</p>
          <p className="text-xs font-bold text-stone-800 mt-0.5 capitalize">{mood.mood || <span className="text-stone-400 font-medium normal-case">Sem registro</span>}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${diaryStatusMeta[mood.hasMood ? 'normal' : 'sem_dados'].dot}`} aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{mood.hasMood ? 'NORMAL' : 'SEM DADOS'}</span>
            <DiaryInsight insight={moodInsight} label="Insight humor" />
          </div>
        </div>
      </div>

      {/* Lista inferior — somente refeições */}
      <div className="px-4 py-3 flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Refeições do dia</p>
        {meals.totalExpected !== null
          ? mealRows.map((row: any) => {
              const kind = classifyMealKind(row.name)
              const ins = getMealInsight(row.name, row.state, kind)
              const val = row.state === 'registrado' ? 'Registrado' : 'Não informado'
              return (
                <ItemRow key={row.name} icon={<Coffee size={14} aria-hidden="true" />} label={row.name} value={val} status={row.status} insight={<DiaryInsight insight={ins} label={`Insight ${row.name}`} />} />
              )
            })
          : mealRows.length > 0
            ? mealRows.map((row: any) => {
                const kind = classifyMealKind(row.name)
                const ins = getMealInsight(row.name, 'registrado', kind)
                return <ItemRow key={row.name} icon={<Coffee size={14} aria-hidden="true" />} label={row.name} value="Registrado" status="normal" insight={<DiaryInsight insight={ins} />} />
              })
            : (
                <div className="py-2.5 border-b border-stone-100 flex items-center justify-between">
                  <span className="text-sm text-stone-600 flex items-center gap-2"><Coffee size={14} className="text-stone-400" aria-hidden="true" /> Refeições</span>
                  <span className="flex items-center gap-2 text-xs font-medium text-stone-400">Sem registro <DiaryInsight insight={getMealInsight('Refeição', 'nao_informado', 'refeicao_generica')} /></span>
                </div>
              )}
      </div>

      {variant === 'primary' && log && (
        <div className="px-4 py-2 border-t border-stone-100 bg-stone-50/40 text-[11px] text-stone-500">
          Data civil: {formatCivilDate(date)} — exibida com <code className="bg-white border border-stone-200 rounded px-1">formatCivilDate</code> sem conversão UTC.
        </div>
      )}
    </div>
  )
}
