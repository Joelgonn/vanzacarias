'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FileText, Download, ShoppingCart, ChevronRight, ArrowLeftRight } from 'lucide-react';

type ActionCardsProps = {
  planoPDF: { publicUrl?: string; file_url?: string; meal_plan_pdf_url?: string } | string | null;
  finalPdfUrl: string;
  onGeneratePDF: () => void;
  onOpenMarket: () => void;
  onOpenSubstitutions: () => void;
};

export function ActionCards({ planoPDF, finalPdfUrl, onGeneratePDF, onOpenMarket, onOpenSubstitutions }: ActionCardsProps) {
  const reduceMotion = useReducedMotion();

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
            <FileText size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">Ferramentas</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mt-0.5">Ações rápidas</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Baixar Protocolo */}
          <button
            onClick={() => {
              if (planoPDF && finalPdfUrl !== '#') {
                window.open(finalPdfUrl, '_blank');
              } else {
                onGeneratePDF();
              }
            }}
            className="w-full text-left p-5 rounded-2xl border border-stone-100 bg-stone-50 hover:bg-white hover:border-stone-200 hover:shadow-md transition-all group active:scale-[0.98] flex flex-col justify-between"
          >
            <div className="flex justify-between items-start w-full mb-4">
              <div className="bg-white p-3 rounded-xl text-stone-700 group-hover:bg-stone-900 group-hover:text-white transition-colors shadow-sm">
                <FileText size={20} aria-hidden="true" />
              </div>
              <div className="text-stone-300 group-hover:text-stone-900 transition-colors">
                <Download size={18} aria-hidden="true" />
              </div>
            </div>
            <div>
              <p className="font-black text-stone-800 text-sm mb-0.5 tracking-tight">Baixar Protocolo</p>
              <p className="text-[11px] text-stone-500 font-medium">Versão em PDF</p>
            </div>
          </button>

          {/* Compras Inteligentes */}
          <button
            onClick={onOpenMarket}
            className="w-full text-left p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-700/20 hover:shadow-xl hover:shadow-emerald-700/30 transition-all group active:scale-[0.98] flex flex-col justify-between"
          >
            <div className="flex justify-between items-start w-full mb-4">
              <div className="bg-white/20 p-3 rounded-xl text-white backdrop-blur-sm">
                <ShoppingCart size={20} aria-hidden="true" />
              </div>
              <div className="text-emerald-200 group-hover:translate-x-1 transition-transform">
                <ChevronRight size={18} aria-hidden="true" />
              </div>
            </div>
            <div>
              <p className="font-black text-white text-sm mb-0.5 tracking-tight">Compras Inteligentes</p>
              <p className="text-[11px] text-emerald-100 font-medium">Lista automática gerada</p>
            </div>
          </button>

          {/* Substituições */}
          <button
            onClick={onOpenSubstitutions}
            className="w-full text-left p-5 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-600/20 hover:shadow-xl hover:shadow-orange-600/30 transition-all group active:scale-[0.98] flex flex-col justify-between"
          >
            <div className="flex justify-between items-start w-full mb-4">
              <div className="bg-white/20 p-3 rounded-xl text-white backdrop-blur-sm">
                <ArrowLeftRight size={20} aria-hidden="true" />
              </div>
              <div className="text-orange-200 group-hover:translate-x-1 transition-transform">
                <ChevronRight size={18} aria-hidden="true" />
              </div>
            </div>
            <div>
              <p className="font-black text-white text-sm mb-0.5 tracking-tight">Substituições</p>
              <p className="text-[11px] text-orange-100 font-medium">Trocas estratégicas</p>
            </div>
          </button>
        </div>

      </div>
    </motion.section>
  );
}
