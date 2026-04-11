'use client';

import React, { useState } from 'react';
import { Cookie, Plus, Trash2, AlertCircle, Flame } from 'lucide-react';
import { BeliscoItem, BeliscosTotals } from '@/lib/beliscoUtils';

interface BeliscoCardProps {
  beliscos: BeliscosTotals;
  items: BeliscoItem[];
  totalKcal: number;
  onOpenModal: () => void;
  onRemoveItem: (id: string) => void;
}

export function BeliscoCard({ 
  beliscos, 
  items, 
  totalKcal, 
  onOpenModal, 
  onRemoveItem 
}: BeliscoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Validação de segurança
  const safeBeliscos = beliscos || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const safeTotalKcal = totalKcal || 1;
  const safeItems = items || [];

  // Calcula percentual para a barra (máximo 100% visual)
  const percent = Math.min((safeBeliscos.kcal / safeTotalKcal) * 100, 100);
  // Percentual real (pode passar de 100%)
  const realPercent = safeTotalKcal > 0 ? (safeBeliscos.kcal / safeTotalKcal) * 100 : 0;

  // Cores baseadas no percentual
  const getBarColor = () => {
    if (realPercent <= 15) return 'bg-emerald-500';
    if (realPercent <= 25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getStatusMessage = () => {
    if (realPercent <= 10) {
      return { text: 'Controle excelente!', color: 'text-emerald-600' };
    }
    if (realPercent <= 20) {
      return { text: 'Dentro do esperado', color: 'text-emerald-600' };
    }
    if (realPercent <= 30) {
      return { text: 'Atenção! Consumo elevado', color: 'text-amber-600' };
    }
    return { text: 'Alerta! Muitos beliscos', color: 'text-red-600' };
  };

  const status = getStatusMessage();

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-md">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2.5 rounded-xl">
            <Cookie size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-black text-stone-800 text-lg tracking-tight">Beliscos Extras</h3>
            <p className="text-[10px] font-bold uppercase text-stone-400 tracking-widest">
              Fora do protocolo
            </p>
          </div>
        </div>
        
        <button
          onClick={onOpenModal}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-md shadow-amber-500/20 active:scale-95"
        >
          <Plus size={16} />
          Adicionar
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="mb-4">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-xs font-bold text-stone-500 flex items-center gap-1">
            <Flame size={12} className="text-amber-500" />
            Consumo extra
          </span>
          <div className="text-right">
            <span className={`text-xl font-black ${status.color}`}>
              {Math.round(safeBeliscos.kcal)}
            </span>
            <span className="text-xs font-bold text-stone-400"> / {Math.round(safeTotalKcal)} kcal</span>
          </div>
        </div>
        
        <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-700 ${getBarColor()}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-bold text-stone-400 uppercase">
            Meta diária
          </span>
          <span className={`text-[10px] font-bold uppercase ${status.color}`}>
            {status.text}
          </span>
        </div>
      </div>

      {/* Resumo de macros */}
      {(safeBeliscos.protein > 0 || safeBeliscos.carbs > 0 || safeBeliscos.fat > 0) && (
        <div className="flex gap-2 mb-4 p-3 bg-stone-50 rounded-xl">
          {safeBeliscos.protein > 0 && (
            <div className="flex-1 text-center">
              <p className="text-[9px] font-black uppercase text-stone-400">Proteína</p>
              <p className="text-sm font-bold text-stone-700">{Math.round(safeBeliscos.protein)}g</p>
            </div>
          )}
          {safeBeliscos.carbs > 0 && (
            <div className="flex-1 text-center">
              <p className="text-[9px] font-black uppercase text-stone-400">Carboidrato</p>
              <p className="text-sm font-bold text-stone-700">{Math.round(safeBeliscos.carbs)}g</p>
            </div>
          )}
          {safeBeliscos.fat > 0 && (
            <div className="flex-1 text-center">
              <p className="text-[9px] font-black uppercase text-stone-400">Gordura</p>
              <p className="text-sm font-bold text-stone-700">{Math.round(safeBeliscos.fat)}g</p>
            </div>
          )}
        </div>
      )}

      {/* Lista de itens */}
      {safeItems.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between text-left text-xs font-bold uppercase text-stone-400 tracking-widest py-2 hover:text-stone-600 transition-colors"
          >
            <span>Histórico de hoje ({safeItems.length})</span>
            <span className="text-stone-300">{isExpanded ? '▲' : '▼'}</span>
          </button>
          
          {isExpanded && (
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
              {safeItems.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100 group hover:border-stone-200 transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-700">
                        {item.name || 'Belisco manual'}
                      </span>
                      {item.grams && (
                        <span className="text-[10px] font-bold text-stone-400">
                          {Math.round(item.grams)}g
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] font-bold text-amber-600">
                        {Math.round(item.kcal)} kcal
                      </span>
                      {item.protein > 0 && (
                        <span className="text-[10px] text-stone-400">P: {Math.round(item.protein)}g</span>
                      )}
                      {item.carbs > 0 && (
                        <span className="text-[10px] text-stone-400">C: {Math.round(item.carbs)}g</span>
                      )}
                      {item.fat > 0 && (
                        <span className="text-[10px] text-stone-400">G: {Math.round(item.fat)}g</span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-stone-400 hover:text-red-500 transition-all"
                    title="Remover item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mensagem quando não há beliscos */}
      {safeItems.length === 0 && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <AlertCircle size={14} className="text-emerald-500" />
          <p className="text-xs font-medium text-emerald-700">
            Nenhum belisco registrado hoje. Continue assim! 🎯
          </p>
        </div>
      )}

      {/* Alerta de excesso */}
      {realPercent > 30 && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
          <AlertCircle size={14} className="text-red-500" />
          <p className="text-xs font-medium text-red-700">
            Os beliscos já representam {Math.round(realPercent)}% das suas calorias diárias. Reflita sobre suas escolhas!
          </p>
        </div>
      )}
    </div>
  );
}