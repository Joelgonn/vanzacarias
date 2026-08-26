'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  ClipboardCheck, Utensils, ShieldAlert, CalendarDays,
  Lock, ChevronRight, ArrowRight, ClipboardList, Check,
} from 'lucide-react';
import Link from 'next/link';

// =========================================================================
// NEXT BEST ACTION — Próximo Passo
// Uma ação principal determinística + faixa horizontal de 4 atalhos.
// A função getNextBestAction é PURA: não faz fetch, não altera estado,
// não persiste nada — apenas prioriza visualmente uma ação já existente.
// =========================================================================

export interface NextBestActionProps {
  isPremium: boolean;
  trialActive: boolean;
  isCheckinDoneThisWeek: boolean;
  canAccessMealPlan: boolean | null | undefined;
  isMealPlanReady: boolean;
  hasCompletedQFA: boolean;
  hasFoodRestrictions: boolean;
  foodStatusConfig: {
    icon: React.ReactNode;
    bgClass: string;
    label: string;
  };
  nextAppointment: {
    appointment_date: string;
    appointment_time: string;
  } | null;
  onOpenCheckin: () => void;
}

// -------------------------------------------------------------------------
// ORDEM DETERMINÍSTICA DA AÇÃO PRINCIPAL (documentada):
//   1. QFA pendente        → Atualizar perfil alimentar (pendência crítica)
//   2. Check-in pendente   → Fazer Check-in semanal (quando acessível)
//   3. Plano pronto        → Ver plano alimentar liberado
//   4. Plano em elaboração → Acompanhar plano (acessível)
//   5. Plano bloqueado     → Conhecer o plano (mostra caminho de acesso)
//   6. Fallback            → Agendamentos (próxima consulta)
// -------------------------------------------------------------------------
type BestActionKey = 'perfil' | 'checkin' | 'plano_pronto' | 'plano_elaboracao' | 'plano_bloqueado' | 'agenda';

function getNextBestAction(input: {
  hasCompletedQFA: boolean;
  isCheckinDoneThisWeek: boolean;
  isLocked: boolean;
  canAccessMealPlan: boolean;
  isMealPlanReady: boolean;
}): BestActionKey {
  if (!input.hasCompletedQFA) return 'perfil';
  if (!input.isCheckinDoneThisWeek && !input.isLocked) return 'checkin';
  if (input.canAccessMealPlan && input.isMealPlanReady) return 'plano_pronto';
  if (input.canAccessMealPlan) return 'plano_elaboracao';
  if (!input.canAccessMealPlan) return 'plano_bloqueado';
  return 'agenda';
}

const ACTION_COPY: Record<BestActionKey, { icon: typeof ClipboardCheck; title: string; desc: string; cta: string }> = {
  perfil: {
    icon: ShieldAlert,
    title: 'Complete seu perfil alimentar',
    desc: 'Preencha seu Raio-X para a Nutri criar um plano personalizado.',
    cta: 'Atualizar perfil',
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
    desc: nextAppointmentHint(),
    cta: 'Ver agendamentos',
  },
};

// helper (função pura usada apenas para o fallback)
function nextAppointmentHint() {
  return 'Marque sua próxima consulta ou acompanhe seus retornos.';
}

export default function NextBestAction({
  isPremium,
  trialActive,
  isCheckinDoneThisWeek,
  canAccessMealPlan,
  isMealPlanReady,
  hasCompletedQFA,
  foodStatusConfig,
  nextAppointment,
  onOpenCheckin,
}: NextBestActionProps) {
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  const isLocked = !isPremium && !trialActive;
  const hasPlanAccess = canAccessMealPlan === true;

  // Decisão determinística (função pura)
  const actionKey = getNextBestAction({
    hasCompletedQFA,
    isCheckinDoneThisWeek,
    isLocked,
    canAccessMealPlan: hasPlanAccess,
    isMealPlanReady,
  });

  const action = ACTION_COPY[actionKey];
  const ActionIcon = action.icon;

  // Atalhos — sempre disponíveis (mesmas rotas/handlers de antes)
  // Check-in tem 3 estados visuais derivados APENAS de isCheckinDoneThisWeek
  // e da regra premium existente (sem nova lógica de negócio):
  //   pendente  → microdestaque âmbar + pulso sutil
  //   concluído → emerald, "Feito esta semana" (parece conquista, não botão quebrado)
  //   bloqueado → discreto, "Disponível na próxima semana"
  const checkinDone = isCheckinDoneThisWeek;
  const shortcuts = [
    {
      label: 'Check-in',
      icon: ClipboardCheck,
      href: null as string | null,
      onClick: onOpenCheckin,
      locked: isLocked,
      done: checkinDone && !isLocked,
      pending: !checkinDone && !isLocked,
      hint: isLocked ? 'Disponível na próxima semana' : checkinDone ? 'Feito esta semana' : 'Semanal',
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
    {
      label: 'Alergias',
      icon: ShieldAlert,
      href: '/dashboard/completar-perfil',
      onClick: null as (() => void) | null,
      locked: false,
      done: false,
      pending: !hasCompletedQFA,
      hint: !hasCompletedQFA ? 'Pendência' : foodStatusConfig.label,
    },
    {
      label: 'Agenda',
      icon: CalendarDays,
      href: '/dashboard/agendamentos',
      onClick: null as (() => void) | null,
      locked: false,
      done: false,
      pending: false,
      hint: nextAppointment
        ? new Date(nextAppointment.appointment_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : 'Marcar',
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
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mt-0.5">Sua jornada continua</p>
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
              href={actionKey === 'perfil' ? '/dashboard/completar-perfil' : actionKey === 'agenda' ? '/dashboard/agendamentos' : '/dashboard/meu-plano'}
              className="group inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-white px-6 py-3 text-sm font-black text-nutri-900 transition-all hover:bg-amber-50 hover:shadow-lg hover:shadow-amber-500/30 active:scale-[0.98] sm:self-center"
            >
              {action.cta}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          )}
        </motion.div>

        {/* ============ NÍVEL 2 — ATALHOS HORIZONTAIS ============ */}
        <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.1 }} className="mt-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-stone-100 bg-stone-100 md:grid-cols-4">
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
                    <p className={`mt-0.5 text-[10px] font-semibold ${s.done ? 'text-emerald-600' : s.locked ? 'text-stone-400' : 'text-stone-400'}`}>
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
