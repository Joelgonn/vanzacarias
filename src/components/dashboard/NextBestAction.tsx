'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  ClipboardCheck, Utensils, ShieldAlert, CalendarDays,
  Lock, ChevronRight, ArrowRight, ClipboardList, Check, User,
} from 'lucide-react';
import Link from 'next/link';
import type { PatientJourneySnapshot } from '@/lib/patientJourney';

// =========================================================================
// NEXT BEST ACTION — Próximo Passo
// Uma ação principal determinística + faixa horizontal de atalhos.
// A prioridade das etapas de onboarding vem do estado central
// (patientJourney.ts). A recorrência semanal do check-in continua separada:
// ela é acompanhamento, não conclusão do onboarding.
// =========================================================================

export interface NextBestActionProps {
  /** Estado central das quatro etapas obrigatórias. */
  journey: PatientJourneySnapshot;
  isPremium: boolean;
  trialActive: boolean;
  isCheckinDoneThisWeek: boolean;
  canAccessMealPlan: boolean | null | undefined;
  isMealPlanReady: boolean;
  onOpenCheckin: () => void;
}

export type BestActionKey =
  | 'perfil'
  | 'perfilAlimentar'
  | 'raioX'
  | 'checkin'
  | 'plano_pronto'
  | 'plano_elaboracao'
  | 'plano_bloqueado'
  | 'agenda';

export interface NextBestActionInput {
  journey: PatientJourneySnapshot;
  isCheckinDoneThisWeek: boolean;
  isLocked: boolean;
  canAccessMealPlan: boolean;
  isMealPlanReady: boolean;
}

// -------------------------------------------------------------------------
// ORDEM DETERMINÍSTICA DA AÇÃO PRINCIPAL:
//   1. Perfil pendente            → Completar Perfil (básico)
//   2. Perfil alimentar pendente  → Completar Perfil Alimentar
//   3. Raio-X pendente            → Fazer Raio-X Alimentar (QFA)
//   4. Check-in inicial pendente  → Primeiro check-in (independe de premium)
//   5. Check-in semanal pendente  → Fazer Check-in semanal (quando acessível)
//   6. Plano pronto               → Ver plano alimentar liberado
//   7. Plano em elaboração        → Acompanhar plano
//   8. Plano bloqueado            → Conhecer o plano
//   9. Fallback                   → Agendamentos
// Etapas "unavailable" nunca são tratadas como pendentes nem concluídas.
// -------------------------------------------------------------------------
export function getNextBestAction(input: NextBestActionInput): BestActionKey {
  const next = input.journey.nextAction;

  if (next === 'perfil') return 'perfil';
  if (next === 'perfilAlimentar') return 'perfilAlimentar';
  if (next === 'raioX') return 'raioX';
  // O primeiro check-in é obrigatório para concluir o onboarding. A regra de
  // premium não pode impedir essa etapa (check-in não é funcionalidade paga).
  if (next === 'checkin') return 'checkin';

  // Onboarding concluído (ou indisponível): segue a vida normal do paciente.
  if (
    !input.isCheckinDoneThisWeek &&
    !input.isLocked &&
    input.journey.checkin !== 'unavailable'
  ) {
    return 'checkin';
  }
  if (input.canAccessMealPlan && input.isMealPlanReady) return 'plano_pronto';
  if (input.canAccessMealPlan) return 'plano_elaboracao';
  return 'plano_bloqueado';
}

const ACTION_COPY: Record<BestActionKey, { icon: typeof ClipboardCheck; title: string; desc: string; cta: string }> = {
  perfil: {
    icon: User,
    title: 'Complete seu Perfil',
    desc: 'Informe nome, WhatsApp, data de nascimento e sexo para personalizar seu atendimento.',
    cta: 'Completar perfil',
  },
  perfilAlimentar: {
    icon: ShieldAlert,
    title: 'Complete seu Perfil Alimentar',
    desc: 'Confirme restrições e informações alimentares para o Raio-X ser seguro.',
    cta: 'Completar perfil alimentar',
  },
  raioX: {
    icon: ClipboardList,
    title: 'Complete seu Raio-X Alimentar',
    desc: 'Responda o questionário para a Nutri criar um plano personalizado.',
    cta: 'Fazer Raio-X',
  },
  checkin: {
    icon: ClipboardCheck,
    title: 'Hora do check-in semanal',
    desc: 'Registre suas medidas e evolua com mais precisão.',
    cta: 'Fazer check-in',
  },
  plano_pronto: {
    icon: Utensils,
    title: 'Seu plano está liberado',
    desc: 'Consulte o cardápio preparado para você.',
    cta: 'Ver plano',
  },
  plano_elaboracao: {
    icon: Utensils,
    title: 'Seu plano está em elaboração',
    desc: 'A Nutri está montando um cardápio sob medida para você.',
    cta: 'Acompanhar',
  },
  plano_bloqueado: {
    icon: Utensils,
    title: 'Conheça seu plano alimentar',
    desc: 'Desbloqueie o acesso para receber seu cardápio personalizado.',
    cta: 'Ver opções',
  },
  agenda: {
    icon: CalendarDays,
    title: 'Organize sua agenda',
    desc: 'Marque sua próxima consulta ou acompanhe seus retornos.',
    cta: 'Ver agendamentos',
  },
};

const ACTION_HREF: Partial<Record<BestActionKey, string>> = {
  perfil: '/dashboard/perfil',
  perfilAlimentar: '/dashboard/completar-perfil',
  raioX: '/paciente/avaliacao',
  agenda: '/dashboard/agendamentos',
  plano_pronto: '/dashboard/meu-plano',
  plano_elaboracao: '/dashboard/meu-plano',
  plano_bloqueado: '/dashboard/meu-plano',
};

export default function NextBestAction({
  journey,
  isPremium,
  trialActive,
  isCheckinDoneThisWeek,
  canAccessMealPlan,
  isMealPlanReady,
  onOpenCheckin,
}: NextBestActionProps) {
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  const isLocked = !isPremium && !trialActive;
  const hasPlanAccess = canAccessMealPlan === true;

  // Decisão determinística (função pura)
  const actionKey = getNextBestAction({
    journey,
    isCheckinDoneThisWeek,
    isLocked,
    canAccessMealPlan: hasPlanAccess,
    isMealPlanReady,
  });

  const action =
    actionKey === 'checkin' && journey.nextAction === 'checkin'
      ? {
          ...ACTION_COPY.checkin,
          title: 'Registre seu primeiro check-in',
          desc: 'Salve peso, adesão e humor para iniciar seu acompanhamento.',
        }
      : ACTION_COPY[actionKey];
  const ActionIcon = action.icon;

  const perfilDone = journey.perfil === 'completed';
  const perfilPending = journey.perfil === 'not_started';
  const perfilUnavailable = journey.perfil === 'unavailable';

  const perfilAlimentarDone = journey.perfilAlimentar === 'completed';
  const perfilAlimentarPending = journey.perfilAlimentar === 'not_started';
  const perfilAlimentarUnavailable = journey.perfilAlimentar === 'unavailable';

  const raioXDone = journey.raioX === 'completed';
  const raioXPending = journey.raioX === 'not_started';
  const raioXUnavailable = journey.raioX === 'unavailable';

  // O check-in desta faixa é o SEMANAL (acompanhamento). O primeiro check-in
  // obrigatório é representado na ação principal pelo nextAction central.
  const checkinDone = isCheckinDoneThisWeek;
  const checkinUnavailable = journey.checkin === 'unavailable';
  const isOnboardingCheckin = journey.nextAction === 'checkin';

  const shortcuts = [
    {
      label: 'Perfil',
      icon: User,
      href: '/dashboard/perfil',
      onClick: null as (() => void) | null,
      locked: false,
      done: perfilDone,
      pending: perfilPending,
      hint: perfilUnavailable ? 'Indisponível' : perfilDone ? 'Concluído' : 'Pendência',
    },
    {
      label: 'Perfil Alimentar',
      icon: ShieldAlert,
      href: '/dashboard/completar-perfil',
      onClick: null as (() => void) | null,
      locked: false,
      done: perfilAlimentarDone,
      pending: perfilAlimentarPending,
      hint: perfilAlimentarUnavailable
        ? 'Indisponível'
        : perfilAlimentarDone
          ? 'Concluído'
          : 'Pendência',
    },
    {
      label: 'Raio-X Alimentar',
      icon: ClipboardList,
      href: '/paciente/avaliacao',
      onClick: null as (() => void) | null,
      locked: false,
      done: raioXDone,
      pending: raioXPending,
      hint: raioXUnavailable ? 'Indisponível' : raioXDone ? 'Concluído' : 'Pendência',
    },
    {
      label: 'Check-in',
      icon: ClipboardCheck,
      href: null as string | null,
      onClick: onOpenCheckin,
      locked: isLocked && !isOnboardingCheckin,
      done: checkinDone && (!isLocked || isOnboardingCheckin),
      pending:
        !checkinDone &&
        !checkinUnavailable &&
        (!isLocked || isOnboardingCheckin),
      hint: isOnboardingCheckin && !checkinDone
        ? 'Primeiro check-in'
        : isLocked
          ? 'Disponível na próxima semana'
          : checkinUnavailable
            ? 'Indisponível'
            : checkinDone
              ? 'Feito esta semana'
              : 'Semanal',
    },
    {
      label: 'Meu plano',
      icon: Utensils,
      href: '/dashboard/meu-plano',
      onClick: null as (() => void) | null,
      locked: false,
      done: false,
      pending: false,
      hint: hasPlanAccess ? (isMealPlanReady ? 'Liberado' : 'Em elaboração') : 'Bloqueado',
    },
  ];

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]"
    >
      <div className="relative z-10 p-5 sm:p-7 md:p-10">

        {/* ============ CABEÇALHO ============ */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
            <ClipboardList size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">Próximo Passo</h3>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mt-0.5">Sua jornada continua</p>
          </div>
        </div>

        {/* ============ NÍVEL 1 — AÇÃO PRINCIPAL ============ */}
        <motion.div
          {...fadeUp}
          transition={{ delay: reduceMotion ? 0 : 0.05 }}
          className="mt-6 flex flex-col gap-4 rounded-[2rem] bg-nutri-900 px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <ActionIcon size={22} aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-lg font-black tracking-tight leading-tight">{action.title}</h4>
              <p className="mt-1 max-w-md text-sm font-medium text-nutri-100/90">{action.desc}</p>
            </div>
          </div>

          {actionKey === 'checkin' ? (
            <button
              onClick={onOpenCheckin}
              className="group inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-white px-6 py-3 text-sm font-black text-nutri-900 transition-all hover:bg-amber-50 hover:shadow-lg hover:shadow-amber-500/30 active:scale-[0.98] sm:self-center"
            >
              {action.cta}
              <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          ) : (
            <Link
              href={ACTION_HREF[actionKey] ?? '/dashboard'}
              className="group inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-white px-6 py-3 text-sm font-black text-nutri-900 transition-all hover:bg-amber-50 hover:shadow-lg hover:shadow-amber-500/30 active:scale-[0.98] sm:self-center"
            >
              {action.cta}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          )}
        </motion.div>

        {/* ============ NÍVEL 2 — ATALHOS HORIZONTAIS ============ */}
        <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.1 }} className="mt-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-stone-100 bg-stone-100 md:grid-cols-5">
            {shortcuts.map((s) => {
              const Icon = s.icon;
              const inner = (
                <div className={`flex h-full flex-col items-center justify-center gap-2 px-3 py-5 text-center transition-colors duration-200 ${s.done ? 'bg-emerald-50/40' : s.pending ? 'bg-amber-50/40' : ''}`}>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
                      s.done
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : s.pending
                        ? 'bg-amber-50 text-amber-600 shadow-[0_0_0_1px_rgba(245,158,11,0.25)] group-hover:bg-amber-100'
                        : s.locked
                        ? 'bg-stone-50 text-stone-400'
                        : 'bg-stone-50 text-stone-500 group-hover:bg-amber-50 group-hover:text-amber-600'
                    }`}
                  >
                    {s.done ? (
                      <Check size={20} strokeWidth={3} aria-hidden="true" />
                    ) : s.pending ? (
                      <motion.span
                        className="flex h-full w-full items-center justify-center"
                        animate={reduceMotion ? undefined : { scale: [1, 1.06, 1], opacity: [1, 0.75, 1] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Icon size={20} aria-hidden="true" />
                      </motion.span>
                    ) : (
                      <Icon size={20} aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-black transition-colors ${s.done ? 'text-emerald-700' : s.pending ? 'text-amber-700' : 'text-stone-700 group-hover:text-amber-700'}`}>{s.label}</p>
                    {/* Fase 2.2 — contraste AA: stone-500 (4,80:1) e emerald-700 (5,36:1)
                        no lugar de stone-400/emerald-600 (2,52:1/3,68:1) a 10 px. */}
                    <p className={`mt-0.5 text-[10px] font-semibold ${s.done ? 'text-emerald-700' : 'text-stone-500'}`}>
                      {s.locked && !s.done && <Lock size={9} className="mr-0.5 inline" aria-hidden="true" />}
                      {s.hint}
                    </p>
                  </div>
                </div>
              );
              const cls = 'group flex h-full w-full items-stretch bg-white transition-colors duration-200 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400';

              // Check-in concluído: mantém a regra de indisponibilidade (não abre novo),
              // mas parece uma conquista — não um botão com defeito.
              const isDoneNonAction = s.done;

              return s.href ? (
                <Link key={s.label} href={s.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button
                  key={s.label}
                  onClick={s.onClick || undefined}
                  disabled={s.locked || isDoneNonAction}
                  aria-disabled={s.locked || isDoneNonAction}
                  className={`${cls} ${s.locked || isDoneNonAction ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </motion.div>

      </div>
    </motion.section>
  );
}
