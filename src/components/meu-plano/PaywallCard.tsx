'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Lock, Star, CheckCircle2 } from 'lucide-react';

type PaywallCardProps = {
  prices: { premium: number; mealPlan: number };
  processingCheckout: string | null;
  onUpgrade: (planType: string) => void;
};

export function PaywallCard({ prices, processingCheckout, onUpgrade }: PaywallCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      {...(reduceMotion ? {} : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
      })}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)] text-center"
    >
      <div className="relative z-10 p-5 sm:p-7 md:p-10">

        {/* Lock icon */}
        <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="text-stone-300" size={32} aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-black text-stone-900 mb-3 tracking-tight">Protocolo Restrito</h1>
        <p className="text-stone-500 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
          Seu planejamento estratégico está pronto. Desbloqueie para acessar metas, acompanhamento diário e substituições inteligentes.
        </p>

        {/* CTAs */}
        <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
          <button
            onClick={() => onUpgrade('premium')}
            disabled={!!processingCheckout}
            className="w-full bg-gradient-to-r from-nutri-900 to-nutri-800 text-white p-4 rounded-2xl font-bold flex flex-col items-center gap-1 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <Star size={18} fill="currentColor" className="text-amber-400" aria-hidden="true" /> Acesso Premium Completo
            </span>
            <span className="text-xs font-medium opacity-80">Desbloqueia App + Inteligência por R${prices.premium.toFixed(2)}</span>
          </button>

          <button
            onClick={() => onUpgrade('meal_plan')}
            disabled={!!processingCheckout}
            className="w-full bg-white border-2 border-stone-100 text-stone-500 p-4 rounded-2xl font-bold hover:border-nutri-800 hover:text-nutri-800 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            Apenas Protocolo Interativo (R${prices.mealPlan.toFixed(2)})
          </button>
        </div>

        {/* Benefits */}
        <div className="mt-8 pt-6 border-t border-stone-100 text-left max-w-sm mx-auto">
          <p className="text-[10px] uppercase font-black tracking-widest text-stone-400 mb-3">O que você recebe:</p>
          <ul className="text-sm text-stone-500 space-y-2.5 font-medium" role="list">
            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" aria-hidden="true" /> Cardápio flexível e adaptável</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" aria-hidden="true" /> Lista de mercado automática</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" aria-hidden="true" /> Acompanhamento diário de metas</li>
          </ul>
        </div>

      </div>
    </motion.div>
  );
}
