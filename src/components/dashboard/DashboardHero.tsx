'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Flame, Trophy, TrendingUp, Brain, Scale, Target, ArrowDown, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// =========================================================================
// DASHBOARD HERO — Momento Atual (assinatura visual do Dashboard)
// Superfície única e contínua: estado emocional → progresso → métricas →
// insight → feedback. Mesmas props/contratos da ETAPA 2; só composição.
// =========================================================================

export interface DashboardHeroProps {
  isGoalMet: boolean | undefined;
  weightProgressPercent: number;
  currentStreak: number;
  projection: { weeksLeft?: number; weightLeft?: number | string } | null;
  deltas: { currentWeight: number | null; initialWeight: number | null };
  metaPeso?: string | null;
  smartInsight: string;
  smartFeedback: {
    type: string;
    title: string;
    text: string;
    icon: LucideIcon;
    color: string;
    bg: string;
    border: string;
  } | null;
}

// Saudação por horário — apresentação pura, sem lógica de negócio.
function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Cor semântica do anel de progresso (sem novos verdes).
function getProgressColor(isGoalMet: boolean | undefined, percent: number): string {
  if (isGoalMet) return '#10b981';      // emerald — meta atingida
  if (percent > 60) return '#f59e0b';   // amber — muito perto
  return '#166534';                     // nutri-800 — em andamento (identidade)
}

// =========================================================================
// ANEL DE PROGRESSO (assinatura visual — jornada)
// =========================================================================
interface ProgressRingProps {
  percent: number;
  isGoalMet: boolean | undefined;
}

function ProgressRing({ percent, isGoalMet }: ProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const size = 168;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const color = getProgressColor(isGoalMet, clamped);

  return (
    <div className="relative shrink-0" role="progressbar" aria-label="Progresso da sua jornada" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        {/* Trilho */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-stone-100" />
        {/* Progresso */}
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
        <span className="text-4xl font-black tracking-tight text-stone-900 tabular-nums">
          {Math.round(clamped)}
          <span className="text-xl text-stone-400 font-bold">%</span>
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mt-0.5">
          da jornada
        </span>
      </div>
    </div>
  );
}

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================

export default function DashboardHero({
  isGoalMet,
  weightProgressPercent,
  currentStreak,
  projection,
  deltas,
  metaPeso,
  smartInsight,
  smartFeedback,
}: DashboardHeroProps) {
  const reduceMotion = useReducedMotion();
  const greeting = getGreeting();

  // Estados de animação — desativados com prefers-reduced-motion
  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  // Estado emocional (Nível 1) — mesma lógica, nova apresentação
  const headline = isGoalMet
    ? { icon: <Trophy className="text-amber-500" size={36} aria-hidden="true" />, text: 'Meta atingida — incrível!' }
    : weightProgressPercent > 60
    ? { icon: <Flame className="text-orange-500" size={36} aria-hidden="true" />, text: 'Você está muito perto da sua meta' }
    : { icon: <TrendingUp className="text-nutri-700" size={36} aria-hidden="true" />, text: 'Sua evolução está em andamento' };

  const weightLost =
    deltas.initialWeight !== null && deltas.currentWeight !== null
      ? Math.round((deltas.initialWeight - deltas.currentWeight) * 10) / 10
      : null;

  // Métricas de apoio (Nível 3) — faixa contínua, sem cards independentes
  const metrics = [
    { label: 'Peso atual', value: deltas.currentWeight ? `${deltas.currentWeight} kg` : '--', icon: Scale, iconClass: 'text-blue-500' },
    { label: 'Meta', value: metaPeso ? `${metaPeso} kg` : 'Defina', icon: Target, iconClass: 'text-nutri-600' },
    { label: 'Faltam', value: projection?.weightLeft ? `${projection.weightLeft} kg` : '--', icon: ArrowDown, iconClass: 'text-rose-500' },
    { label: 'Consistência', value: `${currentStreak} sem`, icon: Flame, iconClass: 'text-orange-500' },
  ];

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]"
    >
      {/* Profundidade sutil (não decorativa) */}
      <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-nutri-50/70 blur-3xl" aria-hidden="true" />

      <div className="relative z-10 p-5 sm:p-7 md:p-10">

        {/* ============ NÍVEL 1 — ESTADO EMOCIONAL ============ */}
        <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.05 }} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-nutri-700 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" aria-hidden="true" />
              {greeting} — seu momento atual
            </p>
            <h1 className="mt-2 text-[1.65rem] font-black tracking-tight text-stone-900 leading-[1.15] flex items-center gap-2.5 flex-wrap sm:text-4xl sm:gap-3 md:text-[2.75rem] md:leading-[1.1]">
              <span className="shrink-0 [&_svg]:h-8 [&_svg]:w-8 sm:[&_svg]:h-9 sm:[&_svg]:w-9">{headline.icon}</span>
              <span>{headline.text}</span>
            </h1>
            <p className="mt-2.5 max-w-xl text-sm font-medium text-stone-500 sm:text-base">
              {projection?.weeksLeft
                ? `Mantendo esse ritmo, você atinge sua meta visual em ${projection.weeksLeft} semanas.`
                : 'Continue consistente no diário e nos check-ins para acelerar seus resultados.'}
            </p>
          </div>

          {currentStreak > 0 && (
            <div className="hidden shrink-0 flex-col items-end gap-1 rounded-2xl bg-orange-50/80 px-4 py-3 text-right sm:flex">
              <Flame size={20} className="text-orange-500" fill="currentColor" aria-hidden="true" />
              <span className="text-xl font-black leading-none text-orange-600 tabular-nums">{currentStreak}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-orange-500">semanas de consistência</span>
            </div>
          )}
        </motion.div>

        {/* ============ NÍVEL 2 + 3 — PROGRESSO + MÉTRICAS ============ */}
        <motion.div
          {...fadeUp}
          transition={{ delay: reduceMotion ? 0 : 0.12 }}
          className="mt-8 flex flex-col items-center gap-7 rounded-[2rem] bg-gradient-to-br from-stone-50/80 to-white p-6 sm:p-8 md:flex-row md:items-center md:gap-10"
        >
          <ProgressRing percent={weightProgressPercent} isGoalMet={isGoalMet} />

          <div className="w-full flex-1">
            {/* Subtítulo contextual do progresso */}
            <p className="text-center text-sm font-semibold text-stone-600 md:text-left">
              {isGoalMet ? (
                'Você chegou à meta definida. Momento de consolidar.'
              ) : weightLost !== null && weightLost > 0 ? (
                <>
                  Você já avançou <span className="font-black text-nutri-800">{Math.round(weightProgressPercent)}%</span> —{' '}
                  <span className="font-black text-emerald-600">{weightLost} kg</span> desde o início da jornada.
                </>
              ) : (
                `Você já avançou ${Math.round(weightProgressPercent)}% rumo à sua meta. Continue firme!`
              )}
            </p>

            {/* Métricas em faixa contínua (divisores sutis, sem cards) */}
            <div className="mt-6 grid grid-cols-2 gap-y-5 sm:grid-cols-4">
              {metrics.map((m, idx) => (
                <div
                  key={m.label}
                  className={`flex flex-col gap-1 px-2 sm:px-4 ${idx > 0 ? 'border-l border-stone-200/70' : ''} ${idx >= 2 ? 'border-t border-stone-200/70 pt-4 sm:border-t-0 sm:pt-0' : ''} ${idx === 2 ? 'sm:border-l' : ''}`}
                >
                  <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-stone-400">
                    <m.icon size={12} className={m.iconClass} aria-hidden="true" />
                    {m.label}
                  </span>
                  <span className="text-base font-black tracking-tight text-stone-800 tabular-nums sm:text-lg">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ============ NÍVEL 4 — INSIGHT + FEEDBACK INTEGRADOS ============ */}
        <motion.div
          {...fadeUp}
          transition={{ delay: reduceMotion ? 0 : 0.2 }}
          className="mt-7 space-y-3"
        >
          {/* Insight principal */}
          <div className="flex items-start gap-3.5 rounded-2xl bg-nutri-50/60 px-5 py-4">
            <div className="shrink-0 rounded-xl bg-nutri-700 p-2 text-white shadow-sm">
              <Brain size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-nutri-700/80">Insight inteligente</p>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-stone-700">{smartInsight}</p>
            </div>
          </div>

          {/* Feedback contextual — usa cores/bg do próprio objeto (4 estados preservados) */}
          {smartFeedback && (
            <div className={`flex items-start gap-3.5 rounded-2xl px-5 py-4 ${smartFeedback.bg} ${smartFeedback.border}`}>
              <div className={`shrink-0 rounded-xl bg-white/90 p-2 shadow-sm ${smartFeedback.color}`}>
                <smartFeedback.icon size={18} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h4 className={`text-sm font-bold tracking-tight ${smartFeedback.color}`}>{smartFeedback.title}</h4>
                <p className="mt-0.5 text-xs font-medium leading-relaxed text-stone-600">{smartFeedback.text}</p>
              </div>
            </div>
          )}
        </motion.div>

      </div>
    </motion.section>
  );
}
