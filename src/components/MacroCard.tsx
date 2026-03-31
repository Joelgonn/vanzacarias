'use client';

import { Flame, Beef, Wheat, Droplet, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

// =========================================================================
// INTERFACES
// =========================================================================
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
  // =========================================================================
  // ESTADOS
  // =========================================================================
  const [expanded, setExpanded] = useState(false);

  // Prevenção de renderização vazia
  if (totalKcal === 0 && totalProtein === 0 && totalCarbs === 0 && totalFat === 0) {
    return null;
  }

  // =========================================================================
  // RENDERIZAÇÃO: MODO COMPACTO (Ideal para listas rápidas ou cabeçalhos)
  // =========================================================================
  if (compact) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] p-3 md:p-4 transition-all duration-300 hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          
          {/* Fita de Macros (Com scroll horizontal no mobile para não quebrar layout) */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 md:pb-0 w-full md:w-auto mask-fade-edges">
            
            {/* Kcal */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50/80 border border-orange-100 whitespace-nowrap">
              <Flame size={14} className="text-orange-500" />
              <span className="font-extrabold text-sm text-stone-800">
                {Math.round(totalKcal)} <span className="text-[10px] uppercase font-bold text-orange-600/70">kcal</span>
              </span>
            </div>
            
            {/* Proteína */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50/80 border border-rose-100 whitespace-nowrap">
              <Beef size={14} className="text-rose-500" />
              <span className="font-extrabold text-sm text-stone-800">
                {Math.round(totalProtein)} <span className="text-[10px] uppercase font-bold text-rose-600/70">g</span>
              </span>
            </div>
            
            {/* Carbos */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50/80 border border-amber-100 whitespace-nowrap">
              <Wheat size={14} className="text-amber-500" />
              <span className="font-extrabold text-sm text-stone-800">
                {Math.round(totalCarbs)} <span className="text-[10px] uppercase font-bold text-amber-600/70">g</span>
              </span>
            </div>
            
            {/* Gorduras */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/80 border border-blue-100 whitespace-nowrap">
              <Droplet size={14} className="text-blue-500" />
              <span className="font-extrabold text-sm text-stone-800">
                {Math.round(totalFat)} <span className="text-[10px] uppercase font-bold text-blue-600/70">g</span>
              </span>
            </div>
          </div>

          {/* Botão de Expandir */}
          {macrosPorRefeicao.length > 0 && (
            <button 
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center gap-1.5 w-full md:w-auto py-2 md:py-1 px-4 bg-stone-50 md:bg-transparent rounded-xl md:rounded-none text-[11px] uppercase tracking-wider font-bold text-stone-500 hover:text-nutri-700 transition-colors active:scale-95"
            >
              {expanded ? 'Ocultar Refeições' : 'Ver Refeições'}
              {expanded ? <ChevronUp size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
            </button>
          )}
        </div>

        {/* Lista Expandida (Compacta) */}
        {expanded && macrosPorRefeicao.length > 0 && (
          <div className="w-full mt-4 pt-4 border-t border-stone-100 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
            {macrosPorRefeicao.map((ref, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-stone-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-nutri-400"></span>
                  <span className="font-bold text-xs text-stone-700">{ref.nome}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-500">{ref.horario}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-3 sm:pl-0">
                  <span className="text-[10px] font-black bg-orange-50 text-orange-600 px-2 py-1 rounded-lg">{Math.round(ref.kcal)} kcal</span>
                  <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-1 rounded-lg">{Math.round(ref.protein)}g P</span>
                  <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-1 rounded-lg">{Math.round(ref.carbs)}g C</span>
                  <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">{Math.round(ref.fat)}g G</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDERIZAÇÃO: MODO NORMAL (Ideal para Dashboards e Visão Detalhada)
  // =========================================================================
  return (
    <div className="bg-white rounded-[1.5rem] p-5 md:p-6 border border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shadow-inner">
          <Flame size={16} className="text-orange-500" />
        </div>
        <h3 className="text-[11px] uppercase tracking-[0.2em] font-black text-stone-500">
          Metas Diárias
        </h3>
      </div>
      
      {/* Grid Principal de Macros */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        
        {/* Card KCal */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-orange-50/50 to-white border border-orange-100/50 hover:border-orange-200 transition-colors group">
          <Flame size={20} className="text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-2xl font-black text-stone-800 tracking-tight leading-none mb-1">
            {Math.round(totalKcal)}
          </p>
          <p className="text-[9px] font-black text-orange-600/60 uppercase tracking-widest">Calorias</p>
        </div>

        {/* Card Proteína */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-rose-50/50 to-white border border-rose-100/50 hover:border-rose-200 transition-colors group">
          <Beef size={20} className="text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-2xl font-black text-stone-800 tracking-tight leading-none mb-1">
            {Math.round(totalProtein)}<span className="text-sm font-bold text-stone-400 ml-0.5">g</span>
          </p>
          <p className="text-[9px] font-black text-rose-600/60 uppercase tracking-widest">Proteínas</p>
        </div>

        {/* Card Carbos */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-amber-50/50 to-white border border-amber-100/50 hover:border-amber-200 transition-colors group">
          <Wheat size={20} className="text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-2xl font-black text-stone-800 tracking-tight leading-none mb-1">
            {Math.round(totalCarbs)}<span className="text-sm font-bold text-stone-400 ml-0.5">g</span>
          </p>
          <p className="text-[9px] font-black text-amber-600/60 uppercase tracking-widest">Carboidratos</p>
        </div>

        {/* Card Gorduras */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-blue-50/50 to-white border border-blue-100/50 hover:border-blue-200 transition-colors group">
          <Droplet size={20} className="text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-2xl font-black text-stone-800 tracking-tight leading-none mb-1">
            {Math.round(totalFat)}<span className="text-sm font-bold text-stone-400 ml-0.5">g</span>
          </p>
          <p className="text-[9px] font-black text-blue-600/60 uppercase tracking-widest">Gorduras</p>
        </div>
      </div>

      {/* Seção Expansível: Por Refeição */}
      {macrosPorRefeicao.length > 0 && (
        <div className="pt-2 border-t border-stone-100/80">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 transition-colors group"
            aria-expanded={expanded}
          >
            <span className="text-[11px] uppercase tracking-[0.15em] font-bold text-stone-500 group-hover:text-nutri-700 transition-colors">
              Distribuição por refeição
            </span>
            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 group-hover:bg-nutri-50 group-hover:text-nutri-600 transition-colors">
              {expanded ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
            </div>
          </button>
          
          {expanded && (
            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-4 duration-500 pb-2">
              {macrosPorRefeicao.map((ref, idx) => (
                <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-stone-50/80 rounded-2xl border border-stone-100/50 hover:border-stone-200 transition-colors gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-nutri-500 font-black text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-extrabold text-stone-800 text-sm">{ref.nome}</p>
                      <p className="text-[11px] font-bold text-stone-400 flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-300"></span>
                        {ref.horario}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 pl-12 md:pl-0">
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-orange-100 rounded-lg text-[11px] font-black text-orange-600 shadow-sm">
                      <Flame size={10} /> {Math.round(ref.kcal)} kcal
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-rose-100 rounded-lg text-[11px] font-black text-rose-600 shadow-sm">
                      <Beef size={10} /> {Math.round(ref.protein)}g
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-100 rounded-lg text-[11px] font-black text-amber-600 shadow-sm">
                      <Wheat size={10} /> {Math.round(ref.carbs)}g
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-100 rounded-lg text-[11px] font-black text-blue-600 shadow-sm">
                      <Droplet size={10} /> {Math.round(ref.fat)}g
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}