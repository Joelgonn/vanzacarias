'use client';

import { ArrowLeftRight, X, Info, Flame } from 'lucide-react';
import { SUBSTITUICOES_PADRAO } from '@/lib/substitutions';

type SubstitutionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function SubstitutionsModal({ isOpen, onClose }: SubstitutionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-md p-0 sm:p-4 md:p-8 animate-fade-in">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[90vh]">
        
        <div className="p-6 md:p-8 bg-orange-600 text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><ArrowLeftRight size={24} /></div>
            <div>
              <h3 className="font-black text-2xl tracking-tight leading-tight">Substituições</h3>
              <p className="text-xs text-orange-100 font-medium opacity-90">Troque alimentos de forma inteligente</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-black/10 hover:bg-black/20 p-2.5 rounded-full transition-colors relative z-10"><X size={20} /></button>
        </div>

        <div className="bg-orange-50 p-4 border-b border-orange-100">
          <p className="text-xs text-orange-800 font-bold text-center flex items-center justify-center gap-2"><Info size={16} /> Alimentos do mesmo bloco são nutricionalmente equivalentes.</p>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto bg-stone-50 flex-1 space-y-8">
          {SUBSTITUICOES_PADRAO.map((grupo, gIndex) => (
            <div key={gIndex} className="bg-white border border-stone-200/60 rounded-[2rem] p-5 shadow-sm">
              <div className="mb-5 border-b border-stone-50 pb-4">
                <h4 className="text-lg font-black text-stone-800 flex items-center gap-2 tracking-tight"><Flame size={20} className="text-orange-500" /> {grupo.categoria}</h4>
                {grupo.referencia && <p className="text-[11px] text-stone-400 font-bold uppercase tracking-widest mt-2">{grupo.referencia.descricao}</p>}
              </div>
              
              <ul className="space-y-3">
                {grupo.itens.map((item, iIndex) => (
                  <li key={iIndex} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:border-orange-200 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-bold text-stone-800 text-sm">{item.nome}</span>
                      <span className="text-orange-600 font-black text-xs mt-1">{item.medida}</span>
                    </div>
                    {item.macros && (
                      <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                        <span className="bg-orange-100 text-orange-800 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide shadow-sm">{item.macros.kcal} kcal</span>
                        <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">C: {item.macros.carbo}g</span>
                        <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">P: {item.macros.proteina}g</span>
                        <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">G: {item.macros.gordura}g</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
