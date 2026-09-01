'use client';

import { ArrowRight, ClipboardCheck, Droplets, Footprints, Sparkles, Target, Utensils } from 'lucide-react';
import type { FocusAction, FocusActionType, FocusResult } from '@/lib/vz015/types';

interface FocusTodayCardProps {
  result: FocusResult;
  onCheckin: () => void;
  onMeals: () => void;
  onHydration: () => void;
  onAdherence: () => void;
}

const ACTION_META: Record<Exclude<FocusActionType, 'no_data'>, { icon: typeof ClipboardCheck; cta: string }> = {
  checkin: { icon: ClipboardCheck, cta: 'Fazer check-in' },
  meals: { icon: Utensils, cta: 'Registrar' },
  hydration: { icon: Droplets, cta: 'Adicionar água' },
  adherence: { icon: Target, cta: 'Retomar rotina' },
  activity: { icon: Footprints, cta: 'Registrar atividade' },
};

function getActionCta(action: FocusAction): string {
  return ACTION_META[action.type as Exclude<FocusActionType, 'no_data'>]?.cta || 'Continuar';
}

function getActionIcon(action: FocusAction) {
  return ACTION_META[action.type as Exclude<FocusActionType, 'no_data'>]?.icon || Sparkles;
}

function getButtonProps(action: FocusAction, handlers: FocusTodayCardProps) {
  switch (action.type) {
    case 'checkin':
      return { onClick: handlers.onCheckin, label: 'Abrir check-in semanal' };
    case 'meals':
      return { onClick: handlers.onMeals, label: 'Abrir área de refeições' };
    case 'hydration':
      return { onClick: handlers.onHydration, label: 'Adicionar água' };
    case 'adherence':
      return { onClick: handlers.onAdherence, label: 'Retomar rotina' };
    default:
      return { onClick: handlers.onCheckin, label: 'Continuar' };
  }
}

export default function FocusTodayCard({ result, onCheckin, onMeals, onHydration, onAdherence }: FocusTodayCardProps) {
  if (result.state === 'NO_DATA' || result.actions.length === 0) {
    return null;
  }

  const actionCount = result.actions.length;

  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]" aria-labelledby="focus-today-title">
      <div className="relative z-10 p-5 sm:p-7 md:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
            <Sparkles size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="focus-today-title" className="text-2xl font-black tracking-tight text-stone-900 leading-tight">Seu foco hoje</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mt-0.5">Ação objetiva para agora</p>
          </div>
        </div>

        <div className={`mt-6 ${actionCount > 1 ? 'divide-y divide-stone-100 rounded-[2rem] border border-stone-100' : ''}`}>
          {result.actions.map((action, index) => {
            const Icon = getActionIcon(action);
            const buttonProps = getButtonProps(action, { result, onCheckin, onMeals, onHydration, onAdherence });

            return (
              <article
                key={action.id}
                className={`flex flex-col gap-4 bg-white ${actionCount > 1 ? 'px-5 py-5 first:rounded-t-[2rem] last:rounded-b-[2rem]' : 'rounded-[2rem] border border-stone-100 px-5 py-5'}`}
                aria-label={`${index + 1}. ${action.title}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-nutri-50 text-nutri-700">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">{String(index + 1).padStart(2, '0')}</p>
                        <h3 className="mt-1 text-base font-black tracking-tight text-stone-900">{action.title}</h3>
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-stone-600">{action.description}</p>
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-stone-500">{action.reason}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={buttonProps.onClick}
                  aria-label={buttonProps.label}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-nutri-900 px-4 py-3 text-sm font-black text-white transition-all hover:bg-nutri-800 hover:shadow-lg hover:shadow-nutri-900/20 active:scale-[0.98]"
                >
                  {getActionCta(action)}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
