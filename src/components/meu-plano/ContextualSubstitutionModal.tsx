'use client';

import { Activity, X, Info } from 'lucide-react';
import type { SubstituicaoGrupo } from '@/lib/substitutions';

type ContextualSubstitutionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  group: SubstituicaoGrupo | null;
};

export function ContextualSubstitutionModal({ isOpen, onClose, group }: ContextualSubstitutionModalProps) {
  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-md p-0 sm:p-4 md:p-8 animate-fade-in">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] md:max-h-[90vh] animate-slide-up">
        
        <div className="p-6 bg-stone-900 text-white flex justify-between items-center relative">
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm"><Activity size={24} className="text-orange-400" /></div>
            <div>
              <h3 className="font-black text-xl tracking-tight leading-tight">Troca Equivalente</h3>
              <p className="text-xs text-stone-400 font-medium">Categoria: <span className="text-white font-bold">{group.categoria}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-colors relative z-10"><X size={20} /></button>
        </div>

        <div className="bg-stone-50 border-b border-stone-200 p-4">
          <p className="text-xs text-stone-500 font-bold text-center flex items-center justify-center gap-2"><Info size={14}/> {group.referencia?.descricao || 'Esses itens se equivalem na dieta'}</p>
        </div>

        <div className="p-6 overflow-y-auto bg-white flex-1 space-y-3">
          {group.itens.map((item, iIndex) => (
            <div key={iIndex} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:border-orange-200 transition-colors">
              <div className="flex flex-col">
                <span className="font-bold text-stone-800 text-sm">{item.nome}</span>
                <span className="text-orange-600 font-black text-xs mt-1">{item.medida}</span>
              </div>
              {item.macros && (
                <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
                  <span className="bg-orange-100 text-orange-800 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide shadow-sm">{item.macros.kcal} kcal</span>
                  <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">C: {item.macros.carbo}g</span>
                  <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">P: {item.macros.proteina}g</span>
                  <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">G: {item.macros.gordura}g</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-stone-100 bg-white pb-8 sm:pb-5">
          <button onClick={onClose} className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black tracking-wide hover:bg-stone-800 transition-colors shadow-lg active:scale-[0.98]">
            Entendido, voltar
          </button>
        </div>
      </div>
    </div>
  );
}
