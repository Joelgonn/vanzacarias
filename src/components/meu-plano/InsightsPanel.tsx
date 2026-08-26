'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

type Insight = {
  text: string;
  bg: string;
  textCol: string;
  icon: React.ReactNode;
};

type InsightsPanelProps = {
  insights: Insight[];
};

export function InsightsPanel({ insights }: InsightsPanelProps) {
  const reduceMotion = useReducedMotion();

  if (insights.length === 0) return null;

  return (
    <motion.section
      {...(reduceMotion ? {} : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
      })}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]"
    >
      <div className="relative z-10 p-5 sm:p-7 md:p-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-nutri-700 text-white shadow-sm">
            <Sparkles size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">Inteligência do Plano</h3>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mt-0.5">
              {insights.length} insight{insights.length > 1 ? 's' : ''} personalizado{insights.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Insights list */}
        <div className="space-y-3">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`${insight.bg} border border-white/60 p-4 sm:p-5 rounded-2xl flex items-start gap-3 shadow-sm`}
              role="status"
            >
              <div className="mt-0.5 shrink-0">
                {insight.icon}
              </div>
              <p className={`text-sm font-bold ${insight.textCol} leading-snug`}>
                {insight.text}
              </p>
            </div>
          ))}
        </div>

      </div>
    </motion.section>
  );
}
