'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  AlertTriangle,
  Clock,
  CalendarClock,
  Sparkles,
  ArrowUpRight,
  BellRing,
} from 'lucide-react';
import { cn } from '@/ui/system';

interface FocusPatient {
  id: string;
  name: string;
  phone?: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedAction: string;
  daysSinceLast?: number | null;
  totalScore?: number;
}

interface StatsBarProps {
  totalPatients: number;
  todayTotalMessages: number;
  activeCount: number;
  criticalCount: number;
  retentionRate: number;
  churnRisk: number;
  atRiskCount?: number;
  inactiveCount?: number;
  focusPatient?: FocusPatient | null;
}

const riskStyles = {
  CRITICAL: {
    label: 'Crítico',
    chip: 'bg-rose-500/15 text-rose-200 border-rose-400/20',
  },
  HIGH: {
    label: 'Alto risco',
    chip: 'bg-orange-500/15 text-orange-200 border-orange-400/20',
  },
  MEDIUM: {
    label: 'Atenção',
    chip: 'bg-amber-500/15 text-amber-200 border-amber-400/20',
  },
  LOW: {
    label: 'Estável',
    chip: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20',
  },
} as const;

export function StatsBar({
  totalPatients,
  todayTotalMessages,
  activeCount,
  criticalCount,
  retentionRate,
  churnRisk,
  atRiskCount = 0,
  inactiveCount = 0,
  focusPatient,
}: StatsBarProps) {
  const focusRisk = focusPatient ? riskStyles[focusPatient.risk] : riskStyles.LOW;
  const chargeStorageKey = focusPatient ? `admin-charge:${focusPatient.id}` : '';
  const [chargeHandled, setChargeHandled] = useState(false);

  useEffect(() => {
    if (!focusPatient) return;
    try {
      setChargeHandled(localStorage.getItem(chargeStorageKey) === '1');
    } catch {
      setChargeHandled(false);
    }
  }, [chargeStorageKey, focusPatient]);

  const handleFocusCharge = () => {
    if (!focusPatient) return;

    const phone = focusPatient.phone?.replace(/\D/g, '');
    const message = focusPatient.risk === 'CRITICAL'
      ? 'Olá! Seu acompanhamento está pendente. Vamos retomar?'
      : 'Olá! Sentimos sua falta. Como está o acompanhamento?';

    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    }

    try {
      localStorage.setItem(chargeStorageKey, '1');
    } catch {}
    setChargeHandled(true);
  };

  const mainInsight = focusPatient
    ? focusPatient.risk === 'CRITICAL'
      ? `Contato hoje: ${focusPatient.name}.`
      : focusPatient.risk === 'HIGH'
        ? `Reengajar: ${focusPatient.name}.`
        : `Próximo foco: ${focusPatient.name}.`
    : criticalCount > 0
      ? `${criticalCount} paciente(s) pedem ação.`
      : 'Carteira estável. Use a triagem para avançar.';

  const mainDetail = focusPatient
    ? `${focusPatient.suggestedAction}${focusPatient.daysSinceLast ? ` · ${focusPatient.daysSinceLast} dia${focusPatient.daysSinceLast === 1 ? '' : 's'} sem check-in` : ''}`
    : `Retenção ${retentionRate}% · churn ${churnRisk}%`;

  const stats = [
    {
      label: 'Críticos',
      value: criticalCount,
      icon: AlertTriangle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      accent: criticalCount > 0,
      helper: 'Exigem contato ou cobrança hoje.',
    },
    {
      label: 'Em risco',
      value: atRiskCount,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      helper: inactiveCount > 0 ? `${inactiveCount} inativos além de 14 dias` : '8 a 14 dias sem atividade.',
    },
    {
      label: 'Ativos (7d)',
      value: activeCount,
      icon: CalendarClock,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      helper: `${totalPatients > 0 ? Math.round((activeCount / totalPatients) * 100) : 0}% da base`,
    },
    {
      label: 'Mensagens hoje',
      value: todayTotalMessages,
      icon: MessageCircle,
      color: 'text-nutri-600 dark:text-nutri-400',
      bg: 'bg-nutri-50 dark:bg-nutri-950/30',
      helper: 'Volume de interação do dia.',
    },
  ];

  return (
    <section className="space-y-3">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-stone-200/70 dark:border-stone-800 bg-stone-900 text-white shadow-[0_16px_50px_rgba(15,23,42,0.16)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_28%)]" />
        <div className="relative grid gap-3 p-3.5 md:p-4 lg:grid-cols-[1.35fr_0.9fr] lg:items-center">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">
                <Sparkles size={12} /> Insight do dia
              </span>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]', focusRisk.chip)}>
                {focusPatient ? focusRisk.label : 'Triagem geral'}
              </span>
            </div>

            <div className="max-w-3xl space-y-1.5">
              <h2 className="text-lg md:text-xl lg:text-[1.75rem] font-black tracking-tight text-white leading-tight">
                {mainInsight}
              </h2>
              <p className="max-w-2xl text-xs md:text-sm leading-relaxed text-stone-300">
                {mainDetail}
              </p>
            </div>

            {focusPatient && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleFocusCharge}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors',
                    chargeHandled
                      ? 'border-emerald-400/20 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                  )}
                >
                  <BellRing size={12} />
                  {chargeHandled ? 'Cobrado hoje' : 'Cobrar foco'}
                </button>
                <span className="text-[11px] text-stone-400">
                  {chargeHandled ? 'Cobrança registrada no painel.' : 'Atalho para cobrar o paciente prioritário.'}
                </span>
              </div>
            )}
          </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-stone-400">Base total</p>
                <p className="mt-1 text-lg md:text-xl font-black leading-none">{totalPatients}</p>
                <p className="mt-0.5 text-[9px] text-stone-400">pacientes</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-stone-400">Retenção</p>
                <p className="mt-1 text-lg md:text-xl font-black leading-none">{retentionRate}%</p>
                <p className="mt-0.5 text-[9px] text-stone-400">7 dias ativos</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-stone-400">Churn</p>
                <p className="mt-1 text-lg md:text-xl font-black leading-none">{churnRisk}%</p>
                <p className="mt-0.5 text-[9px] text-stone-400">base em risco</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-stone-400">Foco</p>
                <p className="mt-1 text-lg md:text-xl font-black leading-none">{focusPatient?.totalScore ?? '--'}</p>
                <p className="mt-0.5 text-[9px] text-stone-400">score</p>
              </div>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2.5">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              'group rounded-2xl border p-2 md:p-2.5 shadow-sm transition-all duration-200',
              stat.bg,
              stat.accent && 'ring-1 ring-rose-300/70 dark:ring-rose-700/70'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <stat.icon size={14} className={cn('shrink-0', stat.color)} />
                  <p className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    {stat.label}
                  </p>
                </div>
                <p className={cn(
                  'text-lg md:text-xl font-black tracking-tight',
                  stat.accent ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-white'
                )}>
                  {stat.value}
                </p>
              </div>
              <ArrowUpRight size={12} className={cn('opacity-30', stat.color)} />
            </div>
            <p className="mt-1 text-[9px] leading-snug text-stone-500 dark:text-stone-400">
              {stat.helper}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
