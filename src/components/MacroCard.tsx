// components/MacroCard.tsx
'use client';

import { Flame, Beef, Wheat, Droplet, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface MacroPorRefeicao {
  nome: string;
  horario: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MacroCardProps {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  macrosPorRefeicao?: MacroPorRefeicao[];
  compact?: boolean;
}

export default function MacroCard({ 
  totalKcal, 
  totalProtein, 
  totalCarbs, 
  totalFat, 
  macrosPorRefeicao = [],
  compact = false 
}: MacroCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (totalKcal === 0 && totalProtein === 0 && totalCarbs === 0 && totalFat === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-stone-50 to-white rounded-xl border border-stone-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="text-orange-500" />
            <span className="font-bold text-sm text-stone-800">{Math.round(totalKcal)}<span className="text-xs text-stone-400">kcal</span></span>
          </div>
          <div className="w-px h-4 bg-stone-200" />
          <div className="flex items-center gap-1.5">
            <Beef size={14} className="text-red-500" />
            <span className="font-bold text-sm text-stone-800">{Math.round(totalProtein)}<span className="text-xs text-stone-400">g</span></span>
          </div>
          <div className="w-px h-4 bg-stone-200" />
          <div className="flex items-center gap-1.5">
            <Wheat size={14} className="text-amber-500" />
            <span className="font-bold text-sm text-stone-800">{Math.round(totalCarbs)}<span className="text-xs text-stone-400">g</span></span>
          </div>
          <div className="w-px h-4 bg-stone-200" />
          <div className="flex items-center gap-1.5">
            <Droplet size={14} className="text-blue-500" />
            <span className="font-bold text-sm text-stone-800">{Math.round(totalFat)}<span className="text-xs text-stone-400">g</span></span>
          </div>
        </div>
        {macrosPorRefeicao.length > 0 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-bold text-nutri-600 hover:text-nutri-800 transition-colors flex items-center gap-1"
          >
            {expanded ? 'Menos' : 'Ver por refeição'}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
        {expanded && macrosPorRefeicao.length > 0 && (
          <div className="w-full mt-3 pt-3 border-t border-stone-100 space-y-2">
            {macrosPorRefeicao.map((ref, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="font-medium text-stone-600">{ref.nome} ({ref.horario})</span>
                <div className="flex gap-2">
                  <span className="text-orange-600 font-bold">{Math.round(ref.kcal)}<span className="text-[10px]">kcal</span></span>
                  <span className="text-red-600">{Math.round(ref.protein)}g</span>
                  <span className="text-amber-600">{Math.round(ref.carbs)}g</span>
                  <span className="text-blue-600">{Math.round(ref.fat)}g</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
      <h3 className="text-sm font-bold text-stone-600 mb-4 flex items-center gap-2">
        <Flame size={18} className="text-orange-500" />
        Valores Nutricionais Diários
      </h3>
      
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="text-center">
          <Flame size={20} className="text-orange-500 mx-auto mb-1" />
          <p className="text-xl font-black text-stone-800">{Math.round(totalKcal)}</p>
          <p className="text-[10px] font-bold text-stone-400 uppercase">Kcal</p>
        </div>
        <div className="text-center">
          <Beef size={20} className="text-red-500 mx-auto mb-1" />
          <p className="text-xl font-black text-stone-800">{Math.round(totalProtein)}<span className="text-sm">g</span></p>
          <p className="text-[10px] font-bold text-stone-400 uppercase">Proteínas</p>
        </div>
        <div className="text-center">
          <Wheat size={20} className="text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-black text-stone-800">{Math.round(totalCarbs)}<span className="text-sm">g</span></p>
          <p className="text-[10px] font-bold text-stone-400 uppercase">Carboidratos</p>
        </div>
        <div className="text-center">
          <Droplet size={20} className="text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-black text-stone-800">{Math.round(totalFat)}<span className="text-sm">g</span></p>
          <p className="text-[10px] font-bold text-stone-400 uppercase">Gorduras</p>
        </div>
      </div>

      {macrosPorRefeicao.length > 0 && (
        <>
          <button 
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-sm font-medium text-nutri-600 hover:text-nutri-800 py-2 border-t border-stone-100 mt-2"
          >
            <span>Distribuição por refeição</span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {expanded && (
            <div className="mt-3 space-y-2">
              {macrosPorRefeicao.map((ref, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-stone-50 rounded-xl text-sm">
                  <div>
                    <p className="font-bold text-stone-700">{ref.nome}</p>
                    <p className="text-xs text-stone-400">{ref.horario}</p>
                  </div>
                  <div className="flex gap-3 text-xs font-bold">
                    <span className="text-orange-600">{Math.round(ref.kcal)}kcal</span>
                    <span className="text-red-600">{Math.round(ref.protein)}g P</span>
                    <span className="text-amber-600">{Math.round(ref.carbs)}g C</span>
                    <span className="text-blue-600">{Math.round(ref.fat)}g G</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}