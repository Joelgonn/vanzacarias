'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Filter } from 'lucide-react';

type DayFilterTabsProps = {
  filterTabs: string[];
  selectedDayFilter: string;
  onSelect: (day: string) => void;
};

export function DayFilterTabs({ filterTabs, selectedDayFilter, onSelect }: DayFilterTabsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      {...(reduceMotion ? {} : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
      })}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide pb-2 pt-2"
      role="tablist"
      aria-label="Filtro por dia"
    >
      <button
        role="tab"
        aria-selected={selectedDayFilter === 'Todos'}
        onClick={() => onSelect('Todos')}
        className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
          selectedDayFilter === 'Todos'
            ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20'
            : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
        }`}
      >
        <Filter size={16} aria-hidden="true" /> Visão Geral
      </button>

      {filterTabs.map(day => (
        <button
          key={day}
          role="tab"
          aria-selected={selectedDayFilter === day}
          onClick={() => onSelect(day)}
          className={`px-5 py-3 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
            selectedDayFilter === day
              ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20'
              : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          {day}
        </button>
      ))}
    </motion.div>
  );
}
