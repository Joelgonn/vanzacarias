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
  /** @deprecated VZ-017: removido ScoreRing — mantido opcional para compatibilidade, não renderizado */
  dailyScore?: number;
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

        {/* VZ-017: ScoreRing removido — dados objetivos preservados nas etapas abaixo */}

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
