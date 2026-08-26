'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Sparkles, PlusCircle, Droplets, BellRing, Loader2,
  Smile, Frown, Meh, Utensils, Check, Footprints, ClipboardList,
} from 'lucide-react';
import ActivityCard from '@/components/ActivityCard';
import type { Activity } from '@/lib/activities';

// =========================================================================
// DAILY JOURNEY — Meu Dia (jornada diária única)
// Score como âncora + etapas contínuas. Mesmas props/handlers da ETAPA 2;
// somente composição, hierarquia e apresentação.
// =========================================================================

export interface DailyJourneyProps {
  dailyLog: {
    water_ml: number;
    meals_checked: string[];
    mood: string | null;
    activities: Activity[];
    activity_kcal: number;
  };
  dailyScore: number;
  waterGoal: number;
  waterProgress: number;
  isWaterGoalMet: boolean;
  mealNames: string[];
  totalMeals: number;
  completedMeals: number;
  mealProgress: number;
  isMealGoalMet: boolean;
  isMealPlanReady: boolean;
  latestWeightForWater: number;
  isPushSubscribed: boolean;
  isSubscribingPush: boolean;
  handleAddWater: () => void;
  handleToggleMeal: (mealName: string) => void;
  handleUpdateDailyLog: (updates: Partial<{ water_ml: number; meals_checked: string[]; mood: string | null; activities: Activity[]; activity_kcal: number }>) => void;
  handleRemoveActivity: (id: string) => void;
  onOpenActivityModal: () => void;
  subscribeToPush: () => void;
}

// Cor semântica do score (mesmos thresholds existentes)
function getScoreColor(score: number): string {
  if (score > 80) return '#10b981';   // emerald — excelente
  if (score > 50) return '#f59e0b';   // amber — em progresso
  return '#a8a29e';                   // stone — precisa de atenção
}

// =========================================================================
// ANEL DO SCORE (assinatura visual do Meu Dia)
// =========================================================================
interface ScoreRingProps {
  score: number;
}

function ScoreRing({ score }: ScoreRingProps) {
  const reduceMotion = useReducedMotion();
  const size = 176;
  const stroke = 13;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = getScoreColor(clamped);

  return (
    <div
      className="relative shrink-0"
      role="progressbar"
      aria-label="Score do dia"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-stone-100" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-5xl font-black tracking-tight text-stone-900 tabular-nums">
          {Math.round(clamped)}
          <span className="text-2xl text-stone-400 font-bold">/100</span>
        </span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-stone-400">
          Score do dia
        </span>
      </div>
    </div>
  );
}

// =========================================================================
// ETAPA DA JORNADA (container contínuo — dividido por linhas sutis)
// =========================================================================
interface JourneyStepProps {
  icon: React.ReactNode;
  iconClass?: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}

function JourneyStep({ icon, iconClass = 'text-nutri-700', title, right, children }: JourneyStepProps) {
  return (
    <div className="border-t border-stone-100 py-6 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconClass} bg-stone-50`}>
            {icon}
          </span>
          <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-700">{title}</h4>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// Barra de progresso fina (role="progressbar")
function ThinBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================

export default function DailyJourney({
  dailyLog,
  dailyScore,
  waterGoal,
  waterProgress,
  isWaterGoalMet,
  mealNames,
  totalMeals,
  completedMeals,
  mealProgress,
  isMealGoalMet,
  isMealPlanReady,
  latestWeightForWater,
  isPushSubscribed,
  isSubscribingPush,
  handleAddWater,
  handleToggleMeal,
  handleUpdateDailyLog,
  handleRemoveActivity,
  onOpenActivityModal,
  subscribeToPush,
}: DailyJourneyProps) {
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  // Data de hoje (apresentação pura)
  const todayLabel = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase();

  // Contexto operacional do score (derivado dos mesmos dados — sem IA)
  const scoreContext = dailyScore > 80
    ? 'Dia excelente — mantenha o ritmo!'
    : dailyScore > 50
    ? 'Você está no caminho certo.'
    : 'Pequenos passos contam. Comece pela hidratação.';

  // Contextos operacionais por etapa (apresentação derivada dos estados)
  const waterRemaining = Math.max(0, waterGoal - dailyLog.water_ml);
  const waterContext = isWaterGoalMet
    ? 'Meta de hidratação atingida!'
    : waterRemaining > 0
    ? `Faltam ${waterRemaining} ml para sua meta`
    : 'Meta de hidratação atingida!';

  const mealsContext = isMealPlanReady
    ? completedMeals === totalMeals
      ? 'Todas as refeições concluídas!'
      : `Você concluiu ${completedMeals} de ${totalMeals} refeições`
    : 'Cardápio em elaboração pela Nutri';

  const moodLabels: Record<string, string> = { feliz: 'Ótimo', neutro: 'Normal', dificil: 'Difícil' };
  const moodContext = dailyLog.mood
    ? `Você registrou: ${moodLabels[dailyLog.mood] || dailyLog.mood}`
    : 'Registre como está se sentindo hoje';

  const activityKcal = dailyLog.activities?.length
    ? Math.round(dailyLog.activity_kcal || 0)
    : 0;
  const activityContext = dailyLog.activities?.length
    ? `${activityKcal} kcal queimadas hoje`
    : 'Registre seu movimento do dia';

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]"
    >
      <div className="relative z-10 p-5 sm:p-7 md:p-10">

        {/* ============ CABEÇALHO + SCORE (âncora) ============ */}
        <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.05 }} className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-nutri-700 text-white shadow-sm">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">Meu Dia</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mt-0.5">Hoje · {todayLabel}</p>
            </div>
          </div>
        </motion.div>

        {/* Bloco do score — protagonista */}
        <motion.div
          {...fadeUp}
          transition={{ delay: reduceMotion ? 0 : 0.1 }}
          className="mt-7 flex flex-col items-center gap-5 rounded-[2rem] bg-gradient-to-br from-stone-50/80 to-white px-6 py-8 sm:py-9"
        >
          <ScoreRing score={dailyScore} />
          <p className="max-w-sm text-center text-sm font-semibold text-stone-600">{scoreContext}</p>

          {/* Representação discreta da conclusão geral (complementa, não compete) */}
          <div className="mt-1 w-full max-w-md">
            <div className="mb-2 hidden items-center justify-between text-[9px] font-bold uppercase tracking-widest text-stone-400 sm:flex">
              <span className="flex items-center gap-1"><Droplets size={11} className="text-blue-500" aria-hidden="true" /> Água</span>
              <span className="flex items-center gap-1"><Utensils size={11} className="text-nutri-600" aria-hidden="true" /> Refeições</span>
              <span className="flex items-center gap-1"><Smile size={11} className="text-amber-500" aria-hidden="true" /> Humor</span>
              <span className="flex items-center gap-1"><Footprints size={11} className="text-rose-500" aria-hidden="true" /> Movimento</span>
            </div>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${waterProgress}%` }} />
              </div>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-nutri-600 transition-all duration-700" style={{ width: `${mealProgress}%` }} />
              </div>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${dailyLog.mood ? (dailyLog.mood === 'feliz' ? 100 : dailyLog.mood === 'neutro' ? 60 : 30) : 0}%` }} />
              </div>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-rose-500 transition-all duration-700" style={{ width: `${dailyLog.activities?.length ? 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ============ JORNADA DIÁRIA (etapas contínuas) ============ */}
        <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.16 }} className="mt-6">

          {/* 💧 HIDRATAÇÃO */}
          <JourneyStep
            icon={<Droplets size={16} aria-hidden="true" />}
            iconClass="bg-blue-50 text-blue-600"
            title="Hidratação"
            right={
              <span className="text-sm font-black text-blue-600 tabular-nums">
                {dailyLog.water_ml}<span className="text-xs font-bold text-stone-400"> / {waterGoal} ml</span>
              </span>
            }
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-stone-500">{waterContext}</p>
                  <span className="text-xs font-black text-stone-600 tabular-nums">{Math.round(waterProgress)}%</span>
                </div>
                <ThinBar value={waterProgress} color={isWaterGoalMet ? '#10b981' : '#3b82f6'} />
              </div>

              <button
                onClick={handleAddWater}
                aria-label={isWaterGoalMet ? 'Meta de água atingida. Adicionar mais 250 ml' : `Adicionar 250 ml de água (${waterProgress}% da meta)`}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 ${isWaterGoalMet ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40'}`}
              >
                <PlusCircle size={22} aria-hidden="true" />
              </button>
            </div>

            {!isPushSubscribed && !isWaterGoalMet && (
              <button
                onClick={subscribeToPush}
                disabled={isSubscribingPush}
                className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 transition-colors"
              >
                {isSubscribingPush ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />} Aviso de meta
              </button>
            )}
          </JourneyStep>

          {/* 🍽 REFEIÇÕES */}
          <JourneyStep
            icon={<Utensils size={16} aria-hidden="true" />}
            iconClass="bg-nutri-50 text-nutri-700"
            title="Refeições"
            right={
              <span className="text-sm font-black text-nutri-800 tabular-nums">
                {completedMeals}<span className="text-xs font-bold text-stone-400"> de {totalMeals}</span>
              </span>
            }
          >
            <div className="mb-3.5 flex items-center gap-3">
              <div className="flex-1">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-stone-500">{mealsContext}</p>
                  <span className="text-xs font-black text-stone-600 tabular-nums">{mealProgress}%</span>
                </div>
                <ThinBar value={mealProgress} color={isMealGoalMet ? '#10b981' : '#166534'} />
              </div>
            </div>

            {isMealPlanReady ? (
              <div className="space-y-2" role="list" aria-label="Refeições de hoje">
                {mealNames.map((mealName: string, i: number) => {
                  const isChecked = dailyLog.meals_checked.includes(mealName);
                  return (
                    <button
                      key={i}
                      onClick={() => handleToggleMeal(mealName)}
                      aria-pressed={isChecked}
                      aria-label={`${mealName}${isChecked ? ' — concluída' : ' — pendente'}`}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.98] ${isChecked ? 'border-emerald-100 bg-emerald-50/50' : 'border-stone-100 bg-white hover:border-nutri-200'}`}
                    >
                      <span className={`flex items-center gap-3 text-sm font-bold transition-colors ${isChecked ? 'text-stone-400 line-through decoration-stone-300' : 'text-stone-700'}`}>
                        <ClipboardList size={16} className={isChecked ? 'text-emerald-500' : 'text-stone-300'} aria-hidden="true" />
                        {mealName}
                      </span>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${isChecked ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm' : 'border-stone-200 bg-stone-50 text-transparent'}`}
                        aria-hidden="true"
                      >
                        <Check size={15} strokeWidth={3} className={isChecked ? 'opacity-100' : 'opacity-0'} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 p-5">
                <p className="text-xs font-medium text-stone-500">Cardápio em elaboração pela Nutri.</p>
              </div>
            )}
          </JourneyStep>

          {/* ☺ COMO VOCÊ ESTÁ? */}
          <JourneyStep
            icon={<Smile size={16} aria-hidden="true" />}
            iconClass="bg-amber-50 text-amber-600"
            title="Como você está?"
            right={
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{moodContext}</span>
            }
          >
            <div className="flex gap-2" role="group" aria-label="Seu humor de hoje">
              <button
                onClick={() => handleUpdateDailyLog({ mood: 'feliz' })}
                aria-pressed={dailyLog.mood === 'feliz'}
                aria-label="Humor ótimo"
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-3.5 transition-all duration-200 active:scale-[0.97] ${dailyLog.mood === 'feliz' ? 'border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm' : 'border-stone-100 bg-white text-stone-400 hover:text-stone-600'}`}
              >
                <Smile size={26} strokeWidth={dailyLog.mood === 'feliz' ? 2.5 : 2} aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Ótimo</span>
              </button>
              <button
                onClick={() => handleUpdateDailyLog({ mood: 'neutro' })}
                aria-pressed={dailyLog.mood === 'neutro'}
                aria-label="Humor normal"
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-3.5 transition-all duration-200 active:scale-[0.97] ${dailyLog.mood === 'neutro' ? 'border-amber-200 bg-amber-50 text-amber-600 shadow-sm' : 'border-stone-100 bg-white text-stone-400 hover:text-stone-600'}`}
              >
                <Meh size={26} strokeWidth={dailyLog.mood === 'neutro' ? 2.5 : 2} aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Normal</span>
              </button>
              <button
                onClick={() => handleUpdateDailyLog({ mood: 'dificil' })}
                aria-pressed={dailyLog.mood === 'dificil'}
                aria-label="Humor difícil"
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-3.5 transition-all duration-200 active:scale-[0.97] ${dailyLog.mood === 'dificil' ? 'border-rose-200 bg-rose-50 text-rose-600 shadow-sm' : 'border-stone-100 bg-white text-stone-400 hover:text-stone-600'}`}
              >
                <Frown size={26} strokeWidth={dailyLog.mood === 'dificil' ? 2.5 : 2} aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Difícil</span>
              </button>
            </div>
          </JourneyStep>

          {/* 🚶 MOVIMENTO */}
          <JourneyStep
            icon={<Footprints size={16} aria-hidden="true" />}
            iconClass="bg-rose-50 text-rose-600"
            title="Movimento"
            right={
              <span className="text-sm font-black text-rose-600 tabular-nums">
                {activityKcal}<span className="text-xs font-bold text-stone-400"> kcal</span>
              </span>
            }
          >
            <p className="mb-3.5 text-xs font-medium text-stone-500">{activityContext}</p>
            <ActivityCard
              activities={dailyLog.activities || []}
              weight={latestWeightForWater}
              onAdd={onOpenActivityModal}
              onRemove={handleRemoveActivity}
            />
          </JourneyStep>

        </motion.div>

      </div>
    </motion.section>
  );
}
