'use client';

import Link from 'next/link';
import {
  AlertCircle,
  Check,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  RefreshCw,
  User,
  Utensils,
} from 'lucide-react';
import {
  getOnboardingRoute,
  JOURNEY_STEP_ORDER,
  type JourneyStepKey,
  type JourneyStepState,
  type PatientJourneySnapshot,
} from '@/lib/patientJourney';

interface OnboardingProgressProps {
  snapshot: PatientJourneySnapshot;
  onRetry?: () => void;
}

const STEP_META: Record<JourneyStepKey, { label: string; href: string; icon: typeof User }> = {
  perfil: { label: 'Perfil', href: '/dashboard/perfil', icon: User },
  perfilAlimentar: {
    label: 'Perfil alimentar',
    href: '/dashboard/completar-perfil',
    icon: Utensils,
  },
  raioX: { label: 'Raio-X Alimentar', href: '/paciente/avaliacao', icon: ClipboardList },
  checkin: { label: 'Primeiro check-in', href: '/dashboard/checkin', icon: ClipboardCheck },
};

function estadoLabel(state: JourneyStepState): string {
  if (state === 'completed') return 'Concluído';
  if (state === 'unavailable') return 'Indisponível';
  return 'Pendente';
}

export default function OnboardingProgress({
  snapshot,
  onRetry,
}: OnboardingProgressProps) {
  if (!snapshot.hasPending && !snapshot.hasUnavailable) return null;

  const progress = Math.round((snapshot.completedCount / snapshot.totalSteps) * 100);
  const nextRoute = getOnboardingRoute(snapshot.nextAction);

  return (
    <section
      aria-labelledby="onboarding-progress-title"
      className="rounded-[2rem] border border-stone-100 bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="onboarding-progress-title"
            className="text-lg font-black tracking-tight text-stone-900"
          >
            Sua jornada de entrada
          </h2>
          <p className="mt-0.5 text-xs font-semibold text-stone-500">
            {snapshot.completedCount} de {snapshot.totalSteps} etapas concluídas
          </p>
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-nutri-700">
          {progress}%
        </span>
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Progresso do onboarding"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-nutri-600 to-nutri-800 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {snapshot.hasUnavailable && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-900">
              Não foi possível verificar todas as etapas agora. Nenhuma etapa foi
              marcada como concluída por suposição.
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-stone-800"
            >
              <RefreshCw size={14} /> Tentar novamente
            </button>
          )}
        </div>
      )}

      <ol className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {JOURNEY_STEP_ORDER.map((key, index) => {
            const meta = STEP_META[key];
            const state = snapshot[key];
            const Icon = meta.icon;
            const done = state === 'completed';
            const unavailable = state === 'unavailable';

            return (
              <li key={key}>
                <Link
                  href={meta.href}
                  className={`group flex h-full items-center gap-3 rounded-2xl border p-3 transition-colors ${
                    done
                      ? 'border-emerald-100 bg-emerald-50/60'
                      : unavailable
                        ? 'border-stone-200 bg-stone-50'
                        : 'border-amber-100 bg-amber-50/50 hover:border-amber-200'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : unavailable
                          ? 'bg-stone-200 text-stone-500'
                          : 'bg-white text-amber-600 shadow-sm'
                    }`}
                  >
                    {done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-stone-800">
                      {index + 1}. {meta.label}
                    </span>
                    <span
                      className={`mt-0.5 block text-[10px] font-bold uppercase tracking-widest ${
                        done ? 'text-emerald-700' : 'text-stone-500'
                      }`}
                    >
                      {estadoLabel(state)}
                    </span>
                  </span>
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
      </ol>

      {nextRoute && (
        <Link
          href={nextRoute}
          className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-nutri-900 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-nutri-800 sm:w-auto"
        >
          Continuar pela próxima etapa
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
