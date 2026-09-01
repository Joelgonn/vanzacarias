'use client';

import { ArrowRight, ClipboardCheck, FileText, Sparkles, Target, type LucideIcon } from 'lucide-react';
import type { RecoveryAction, RecoveryActionType, RecoveryResult } from '@/lib/vz015/types';

interface RecoveryTodayCardProps {
  result: RecoveryResult;
  onCheckin: () => void;
  onDailyLog: () => void;
  onAdherence: () => void;
}

const ACTION_META: Record<Exclude<RecoveryActionType, 'no_data'>, { icon: LucideIcon; cta: string }> = {
  checkin: { icon: ClipboardCheck, cta: 'Retomar check-in' },
  daily_log: { icon: FileText, cta: 'Completar diário' },
  adherence: { icon: Target, cta: 'Voltar à rotina' },
};

function getActionCta(action: RecoveryAction): string {
  return ACTION_META[action.type as Exclude<RecoveryActionType, 'no_data'>]?.cta || 'Recuperar';
}

function getActionIcon(action: RecoveryAction): LucideIcon {
  return ACTION_META[action.type as Exclude<RecoveryActionType, 'no_data'>]?.icon || Sparkles;
}

function getButtonProps(action: RecoveryAction, handlers: RecoveryTodayCardProps) {
  switch (action.type) {
    case 'checkin':
      return { onClick: handlers.onCheckin, label: 'Retomar check-in semanal' };
    case 'daily_log':
      return { onClick: handlers.onDailyLog, label: 'Completar registro diário' };
    case 'adherence':
      return { onClick: handlers.onAdherence, label: 'Voltar à rotina' };
    default:
      return { onClick: handlers.onCheckin, label: 'Recuperar' };
  }
}

export default function RecoveryTodayCard({ result, onCheckin, onDailyLog, onAdherence }: RecoveryTodayCardProps) {
  if (result.state === 'NO_DATA' || result.actions.length === 0) {
    return null;
  }

  const actionCount = result.actions.length;

  return (
    <section
      className="relative mt-5 overflow-hidden rounded-[2.5rem] border border-amber-100 bg-gradient-to-b from-amber-50 to-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(180,83,9,0.18)]"
      aria-labelledby="recovery-today-title"
    >
      <div className="relative z-10 p-5 sm:p-7 md:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-sm">
            <Sparkles size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="recovery-today-title" className="text-2xl font-black tracking-tight text-stone-900 leading-tight">
              Sinais de recuperação
            </h2>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-stone-400">
              Ação corretiva para hoje
            </p>
          </div>
        </div>

        <div className={`mt-6 ${actionCount > 1 ? 'divide-y divide-amber-100 rounded-[2rem] border border-amber-100' : ''}`}>
          {result.actions.map((action, index) => {
            const Icon = getActionIcon(action);
            const buttonProps = getButtonProps(action, { result, onCheckin, onDailyLog, onAdherence });

            return (
              <article
                key={action.id}
                className={`flex flex-col gap-4 bg-white/80 backdrop-blur ${actionCount > 1 ? 'px-5 py-5 first:rounded-t-[2rem] last:rounded-b-[2rem]' : 'rounded-[2rem] border border-amber-100 px-5 py-5'}`}
                aria-label={`${index + 1}. ${action.title}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">
                          {String(index + 1).padStart(2, '0')}
                        </p>
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
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-black text-white transition-all hover:bg-amber-500 hover:shadow-lg hover:shadow-amber-600/20 active:scale-[0.98]"
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
