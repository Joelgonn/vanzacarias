'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export function PlanNav() {
  return (
    <nav className="flex items-center justify-between mb-8 mt-4 md:mt-10 animate-fade-in-up">
      <Link href="/dashboard" className="flex items-center gap-2 text-stone-500 hover:text-nutri-900 transition-colors font-bold text-sm bg-white px-5 py-2.5 rounded-[1.5rem] border border-stone-200 shadow-sm hover:shadow-md active:scale-95">
        <ChevronLeft size={18} /> Voltar ao Painel
      </Link>
      <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-[1.5rem] border border-stone-200 shadow-sm">
         <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">Acompanhamento Ativo</span>
      </div>
    </nav>
  );
}
