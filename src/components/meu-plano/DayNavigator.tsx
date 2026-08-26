'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// =========================================================================
// DAY NAVIGATOR — Navegação por data (Anterior / Hoje / Próximo)
// Substitui DayFilterTabs. Mostra 3 dias: offset-1, hoje, offset+1.
// Limites: -3 a +3 dias.
// =========================================================================

const DAY_NAMES_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function getDateWithOffset(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase();
}

function formatWeekday(date: Date): string {
  return DAY_NAMES_PT[date.getDay()];
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

type DayNavigatorProps = {
  selectedOffset: number;
  onSelect: (offset: number) => void;
  minOffset?: number;
  maxOffset?: number;
};

export function DayNavigator({ selectedOffset, onSelect, minOffset = -3, maxOffset = 3 }: DayNavigatorProps) {
  const reduceMotion = useReducedMotion();
  const prevDate = getDateWithOffset(selectedOffset - 1);
  const currentDate = getDateWithOffset(selectedOffset);
  const nextDate = getDateWithOffset(selectedOffset + 1);

  const canGoPrev = selectedOffset > minOffset;
  const canGoNext = selectedOffset < maxOffset;
  const isReadOnly = selectedOffset !== 0;

  return (
    <motion.div
      {...(reduceMotion ? {} : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
      })}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center justify-center gap-2"
      role="tablist"
      aria-label="Navegação por dia"
    >
      {/* Dia anterior */}
      <button
        role="tab"
        aria-selected={selectedOffset === selectedOffset && selectedOffset < 0}
        aria-disabled={!canGoPrev}
        onClick={() => canGoPrev && onSelect(selectedOffset - 1)}
        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full font-bold text-xs whitespace-nowrap transition-all ${
          !canGoPrev
            ? 'bg-stone-50 text-stone-300 cursor-not-allowed'
            : selectedOffset < 0
              ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20'
              : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
        }`}
        aria-label={`Dia anterior: ${formatWeekday(prevDate)}, ${formatDateShort(prevDate)}`}
      >
        <ChevronLeft size={14} aria-hidden="true" />
        <span className="hidden sm:inline">{formatWeekday(prevDate).slice(0, 3)}.</span>
        <span className="sm:hidden">{formatDateShort(prevDate)}</span>
      </button>

      {/* Hoje (centro) */}
      <button
        role="tab"
        aria-selected={selectedOffset === 0}
        onClick={() => onSelect(0)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs whitespace-nowrap transition-all ${
          selectedOffset === 0
            ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20'
            : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
        }`}
        aria-label={`Hoje: ${formatWeekday(currentDate)}, ${formatDateShort(currentDate)}`}
      >
        {isToday(currentDate) && (
          <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
        )}
        <span className="font-black">Hoje</span>
        <span className="opacity-70">{formatDateShort(currentDate)}</span>
      </button>

      {/* Dia seguinte */}
      <button
        role="tab"
        aria-selected={selectedOffset > 0}
        aria-disabled={!canGoNext}
        onClick={() => canGoNext && onSelect(selectedOffset + 1)}
        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full font-bold text-xs whitespace-nowrap transition-all ${
          !canGoNext
            ? 'bg-stone-50 text-stone-300 cursor-not-allowed'
            : selectedOffset > 0
              ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20'
              : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
        }`}
        aria-label={`Dia seguinte: ${formatWeekday(nextDate)}, ${formatDateShort(nextDate)}`}
      >
        <span className="hidden sm:inline">{formatWeekday(nextDate).slice(0, 3)}.</span>
        <span className="sm:hidden">{formatDateShort(nextDate)}</span>
        <ChevronRight size={14} aria-hidden="true" />
      </button>

      {/* Indicador read-only */}
      {isReadOnly && (
        <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-1 rounded-md">
          Somente leitura
        </span>
      )}
    </motion.div>
  );
}
