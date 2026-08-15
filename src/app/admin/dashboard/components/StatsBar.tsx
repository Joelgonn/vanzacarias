'use client';

import { motion } from 'framer-motion';
import { 
  Users, 
  MessageCircle, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Clock,
  CalendarClock
} from 'lucide-react';
import { cn } from '@/ui/system';

interface StatsBarProps {
  totalPatients: number;
  todayTotalMessages: number;
  activeCount: number;
  criticalCount: number;
  retentionRate: number;
  churnRisk: number;
  atRiskCount?: number;
  inactiveCount?: number;
}

export function StatsBar({
  totalPatients,
  todayTotalMessages,
  activeCount,
  criticalCount,
  retentionRate,
  churnRisk,
  atRiskCount = 0,
  inactiveCount = 0
}: StatsBarProps) {
  
  const stats = [
    {
      label: 'Mensagens Hoje',
      value: todayTotalMessages,
      icon: MessageCircle,
      color: 'text-nutri-600 dark:text-nutri-400',
      bg: 'bg-nutri-50 dark:bg-nutri-950/30',
      tooltip: 'Total de mensagens trocadas no chat hoje'
    },
    {
      label: 'Ativos (7d)',
      value: activeCount,
      icon: CalendarClock,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      tooltip: 'Pacientes com atividade (checkin/log/mensagem) nos últimos 7 dias',
      subValue: `${totalPatients > 0 ? Math.round((activeCount / totalPatients) * 100) : 0}% do total`
    },
    {
      label: 'Retenção',
      value: `${retentionRate}%`,
      icon: TrendingUp,
      color: retentionRate >= 70 ? 'text-emerald-600' : retentionRate >= 40 ? 'text-amber-600' : 'text-rose-600',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      highlight: retentionRate < 50,
      tooltip: 'Percentual de pacientes ativos nos últimos 7 dias'
    },
    {
      label: '🚨 Críticos',
      value: criticalCount,
      icon: AlertTriangle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      highlight: criticalCount > 0,
      tooltip: 'Pacientes ausentes há mais de 14 dias ou com score muito baixo'
    },
    {
      label: 'Risco Churn',
      value: `${churnRisk}%`,
      icon: DollarSign,
      color: churnRisk > 30 ? 'text-rose-600' : churnRisk > 15 ? 'text-amber-600' : 'text-emerald-600',
      bg: 'bg-stone-50 dark:bg-stone-800/50',
      highlight: churnRisk > 30,
      tooltip: 'Percentual de pacientes em risco de abandono (inativos + em risco)'
    },
    {
      label: 'Em risco (8-14d)',
      value: atRiskCount,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      tooltip: 'Pacientes sem atividade há 8 a 14 dias',
      subValue: inactiveCount > 0 ? `${inactiveCount} inativos (+14d)` : undefined
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className={cn(
            'group relative rounded-xl p-2 md:p-3 text-center transition-all duration-200',
            stat.bg,
            stat.highlight && 'ring-1 ring-rose-300 dark:ring-rose-700'
          )}
          title={stat.tooltip}
        >
          <stat.icon size={14} className={cn('mx-auto mb-1', stat.color)} />
          <p className="text-[9px] text-stone-500 dark:text-stone-400 uppercase font-bold tracking-wider">
            {stat.label}
          </p>
          <p className={cn(
            'text-base md:text-lg font-extrabold',
            stat.highlight ? 'text-rose-600 dark:text-rose-400' : 'text-stone-800 dark:text-white'
          )}>
            {stat.value}
          </p>
          {stat.subValue && (
            <p className="text-[8px] text-stone-400 dark:text-stone-500 mt-0.5">
              {stat.subValue}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}