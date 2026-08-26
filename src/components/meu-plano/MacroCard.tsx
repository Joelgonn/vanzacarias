'use client';

import { useState } from 'react';
import { Activity, Flame, Beef, Wheat, Droplets, ChevronRight } from 'lucide-react';

export interface MacroPorRefeicao {
  nome: string;
  horario: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

type MacroCardProps = {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  consumedKcal: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  macrosPorRefeicao?: MacroPorRefeicao[];
};

export function MacroCard({
  totalKcal,
  totalProtein,
  totalCarbs,
  totalFat,
  consumedKcal,
  consumedProtein,
  consumedCarbs,
  consumedFat,
  macrosPorRefeicao = []
}: MacroCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (totalKcal === 0 && totalProtein === 0 && totalCarbs === 0 && totalFat === 0) {
    return null;
  }

  const calcPercent = (consumed: number, total: number) => {
    return Math.min(Math.round((consumed / (total || 1)) * 100), 100);
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-stone-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-stone-800 uppercase tracking-widest flex items-center gap-2">
          <Activity size={18} className="text-nutri-600" />
          Dashboard Metabólico
        </h3>
        <span className="text-xs font-bold text-stone-400">Meta: {Math.round(totalKcal)} kcal</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-2">
        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex flex-col justify-center">
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1">
              <Flame size={14} className="text-orange-500"/> Consumo Real
            </span>
            <span className="text-xl font-black text-stone-800">
              {Math.round(consumedKcal)} <span className="text-xs font-bold text-stone-400 uppercase">/ {Math.round(totalKcal)} kcal</span>
            </span>
          </div>
          <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden w-full">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${calcPercent(consumedKcal, totalKcal)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3">
          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
              <span className="text-stone-500 flex items-center gap-1">
                <Beef size={12} className="text-red-500"/> Proteínas
              </span>
              <span className="text-stone-800">
                {Math.round(consumedProtein)}g <span className="text-stone-400">/ {Math.round(totalProtein)}g</span>
              </span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-1000"
                style={{ width: `${calcPercent(consumedProtein, totalProtein)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
              <span className="text-stone-500 flex items-center gap-1">
                <Wheat size={12} className="text-amber-500"/> Carboidratos
              </span>
              <span className="text-stone-800">
                {Math.round(consumedCarbs)}g <span className="text-stone-400">/ {Math.round(totalCarbs)}g</span>
              </span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                style={{ width: `${calcPercent(consumedCarbs, totalCarbs)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
              <span className="text-stone-500 flex items-center gap-1">
                <Droplets size={12} className="text-blue-500"/> Gorduras
              </span>
              <span className="text-stone-800">
                {Math.round(consumedFat)}g <span className="text-stone-400">/ {Math.round(totalFat)}g</span>
              </span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                style={{ width: `${calcPercent(consumedFat, totalFat)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {macrosPorRefeicao.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest font-bold text-stone-400 hover:text-nutri-700 py-3 rounded-xl hover:bg-stone-50 transition-all border border-transparent hover:border-stone-100"
          >
            <span>Detalhamento por refeição</span>
            <ChevronRight size={14} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>

          {expanded && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fade-in">
              {macrosPorRefeicao.map((ref) => (
                <div key={`${ref.nome}-${ref.horario}`} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm gap-2">
                  <div>
                    <p className="font-bold text-stone-700 text-xs">{ref.nome}</p>
                    <p className="text-[10px] text-stone-400 font-bold uppercase">{ref.horario}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-black">
                    <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                      {Math.round(ref.kcal)} kcal
                    </span>
                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                      {Math.round(ref.protein)}g P
                    </span>
                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      {Math.round(ref.carbs)}g C
                    </span>
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {Math.round(ref.fat)}g G
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
