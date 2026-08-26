'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Sparkles } from 'lucide-react';

// =========================================================================
// PLAN HERO — Contexto unificado do plano alimentar
// PlanNav + Hero integrados em superfície única.
// Referência visual: DashboardHero do Premium Dashboard.
// =========================================================================

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return '#f59e0b';
  if (percent >= 70) return '#f97316';
  if (percent >= 40) return '#10b981';
  return '#3b82f6';
}

function getLevelInfo(adh: number) {
  if (adh >= 100) return { label: 'Elite', icon: '🏆', colorClass: 'text-amber-500', bgClass: 'bg-amber-50/80' };
  if (adh >= 70) return { label: 'Focado', icon: '🔥', colorClass: 'text-orange-500', bgClass: 'bg-orange-50/80' };
  if (adh >= 40) return { label: 'Consistente', icon: '⚡', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-50/80' };
  return { label: 'Iniciante', icon: '🌱', colorClass: 'text-blue-500', bgClass: 'bg-blue-50/80' };
}

// =========================================================================
// PROGRESS RING (assinatura visual — padrão DashboardHero)
// =========================================================================
interface ProgressRingProps {
  percent: number;
}

function ProgressRing({ percent }: ProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const size = 140;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const color = getProgressColor(clamped);

  return (
    <div
      className="relative shrink-0"
      role="progressbar"
      aria-label="Progresso de adesão do dia"
      aria-valuenow={Math.round(clamped)}
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
        <span className="text-3xl font-black tracking-tight text-stone-900 tabular-nums">
          {Math.round(clamped)}
          <span className="text-lg text-stone-400 font-bold">%</span>
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mt-0.5">
          adesão
        </span>
      </div>
    </div>
  );
}

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
type PlanHeroProps = {
  firstName: string;
  goal: string | null;
  adherencePercent: number;
};

export function PlanHero({ firstName, goal, adherencePercent }: PlanHeroProps) {
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
  const greeting = getGreeting();
  const level = getLevelInfo(adherencePercent);

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]"
    >
      <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-nutri-50/70 blur-3xl" aria-hidden="true" />

      <div className="relative z-10 p-5 sm:p-7 md:p-10">

        {/* ============ NAVEGAÇÃO INTEGRADA ============ */}
        <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.03 }} className="flex items-center justify-between mb-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-stone-500 hover:text-nutri-900 transition-colors font-bold text-sm rounded-full border border-stone-200 bg-stone-50 px-4 py-2 hover:bg-white hover:shadow-sm active:scale-95"
          >
            <ChevronLeft size={16} aria-hidden="true" /> Painel
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">Ativo</span>
          </div>
        </motion.div>

        {/* ============ CONTEXTO + PROGRESS RING ============ */}
        <motion.div
          {...fadeUp}
          transition={{ delay: reduceMotion ? 0 : 0.06 }}
          className="flex flex-col items-center gap-7 rounded-[2rem] bg-gradient-to-br from-stone-50/80 to-white p-6 sm:p-8 md:flex-row md:items-center md:gap-10"
        >
          <ProgressRing percent={adherencePercent} />

          <div className="w-full flex-1 text-center md:text-left">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-nutri-700 flex items-center gap-1.5 justify-center md:justify-start">
              <Sparkles size={13} className="text-amber-500" aria-hidden="true" />
              {greeting} — seu plano de hoje
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-stone-900 leading-[1.15] md:text-[2.5rem]">
              {firstName}
            </h1>
            <p className="mt-1.5 max-w-md text-sm font-medium text-stone-500">
              {goal || 'Protocolo de otimização metabólica e reeducação alimentar.'}
            </p>

            {/* Nível */}
            <div className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-3 border border-stone-100 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner ${level.bgClass}`}>
                {level.icon}
              </div>
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Nível Atual</p>
                <p className={`font-bold text-base leading-tight ${level.colorClass}`}>{level.label}</p>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </motion.section>
  );
}
