'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check, Clock, Utensils, CheckCircle2 } from 'lucide-react';
import { renderDescriptionWithTooltips } from '@/lib/foodTooltips';
import { buildDescriptionFromFoods } from '@/lib/mealPlan';
import type { PlanFoodItem, MealPlanOption, MealPlanItem } from '@/types/mealPlan';

// =========================================================================
// MEAL TIMELINE — Jornada alimentar do dia
// Padrão JourneyStep (contínuo, sem cards independentes por refeição).
// Referência visual: DailyJourney do Premium Dashboard.
// =========================================================================

type MealTimelineProps = {
  filteredMeals: MealPlanItem[];
  completedMeals: string[];
  toggleMealCompletion: (mealName: string) => void;
  setContextualCategory: (category: string | null) => void;
  readOnly?: boolean;
  dateLabel?: string;
};

export function MealTimeline({ filteredMeals, completedMeals, toggleMealCompletion, setContextualCategory, readOnly = false, dateLabel }: MealTimelineProps) {
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  if (!filteredMeals || filteredMeals.length === 0) return null;

  const todayLabel = dateLabel || new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase();
  const completedCount = filteredMeals.filter(m => completedMeals.includes(m.name)).length;

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]"
    >
      <div className="relative z-10 p-5 sm:p-7 md:p-10">

        {/* ============ CABEÇALHO ============ */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-nutri-700 text-white shadow-sm">
              <Utensils size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">{readOnly ? 'Cardápio' : 'Hoje'}</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mt-0.5">{todayLabel}</p>
            </div>
          </div>
          <span className="text-sm font-black text-nutri-800 tabular-nums">
            {completedCount}<span className="text-xs font-bold text-stone-400"> de {filteredMeals.length}</span>
          </span>
        </div>

        {/* ============ REFEIÇÕES (etapas contínuas) ============ */}
        <div className="mt-6" role="list" aria-label="Refeições de hoje">
          {filteredMeals.map((refeicao: MealPlanItem) => {
            const isCompleted = completedMeals.includes(refeicao.name);
            const option = refeicao.options?.[0] ?? null;

            return (
              <div
                key={refeicao.id || `${refeicao.name}-${refeicao.time}`}
                className={`border-t border-stone-100 py-6 first:border-t-0 first:pt-0 last:pb-0`}
                role="listitem"
              >
                {/* ============ LINHA DA REFEIÇÃO ============ */}
                <button
                  onClick={() => !readOnly && toggleMealCompletion(refeicao.name)}
                  aria-pressed={isCompleted}
                  aria-label={`${refeicao.name} — ${refeicao.time}${isCompleted ? ' — concluída' : ' — pendente'}${readOnly ? ' — somente leitura' : ''}`}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${
                    readOnly ? 'cursor-default' : 'active:scale-[0.98]'
                  } ${
                    isCompleted
                      ? 'border-emerald-100 bg-emerald-50/50'
                      : 'border-stone-100 bg-white hover:border-nutri-200'
                  }`}
                >
                  <span className={`flex items-center gap-3 text-sm font-bold transition-colors ${
                    isCompleted ? 'text-stone-400 line-through decoration-stone-300' : 'text-stone-700'
                  }`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                      isCompleted
                        ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                        : 'border-stone-200 bg-stone-50 text-transparent'
                    }`} aria-hidden="true">
                      <Check size={14} strokeWidth={3} className={isCompleted ? 'opacity-100' : 'opacity-0'} />
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock size={12} className={isCompleted ? 'text-emerald-500' : 'text-stone-400'} aria-hidden="true" />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-600' : 'text-stone-500'}`}>
                        {refeicao.time}
                      </span>
                    </span>
                    <span className={isCompleted ? 'text-emerald-700' : 'text-stone-900'}>
                      {refeicao.name}
                    </span>
                  </span>

                  {/* Macros summary */}
                  {option && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(option.kcal ?? 0) > 0 && (
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold tracking-wide shadow-sm whitespace-nowrap ${
                          isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-900 text-white'
                        }`}>
                          ~{option.kcal} kcal
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {/* ============ CONTEÚDO DA REFEIÇÃO ============ */}
                {!isCompleted && (
                  <div className="mt-3 ml-10 space-y-3">
                    {(refeicao.options ?? []).map((opcao: MealPlanOption, oIdx: number) => (
                      <div key={opcao.id || oIdx}>
                        {opcao.day && opcao.day.toLowerCase() !== 'todos os dias' && (
                          <span className="inline-block text-[9px] bg-stone-100 text-stone-600 px-2 py-1 rounded-md font-black uppercase tracking-widest mb-2">
                            {opcao.day}
                          </span>
                        )}

                        <div className="text-stone-700 leading-relaxed text-sm md:text-base font-medium whitespace-pre-wrap">
                          {opcao.foodItems && Array.isArray(opcao.foodItems) && opcao.foodItems.length > 0 ? (
                            <ul className="space-y-1.5">
                              {opcao.foodItems.map((food: PlanFoodItem, fIdx: number) => (
                                <li key={fIdx} className="flex items-start gap-2">
                                  <span className="text-nutri-500 mt-1.5 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-nutri-400" aria-hidden="true" />
                                  <span>
                                    {renderDescriptionWithTooltips(food.name, setContextualCategory)}
                                    {food.kcal ? <span className="text-stone-400 text-xs ml-1 font-normal">({food.kcal} kcal)</span> : ''}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>{renderDescriptionWithTooltips(buildDescriptionFromFoods(opcao), setContextualCategory)}</p>
                          )}
                        </div>

                        {/* Macros detalhados */}
                        {option && oIdx === 0 && option.macros && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">P: {option.macros.p}g</span>
                            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">C: {option.macros.c}g</span>
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">G: {option.macros.g}g</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ============ ESTADO CONCLUÍDO ============ */}
                {isCompleted && (
                  <div className="mt-2 ml-10">
                    <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 size={14} aria-hidden="true" /> Concluído
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </motion.section>
  );
}
