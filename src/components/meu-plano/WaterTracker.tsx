'use client';

import { Droplets, Plus, Minus } from 'lucide-react';

type WaterTrackerProps = {
  waterCount: number;
  onUpdateWater: (increment: number) => void;
};

export function WaterTracker({ waterCount, onUpdateWater }: WaterTrackerProps) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-500/30">
            <Droplets size={24} fill="currentColor" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-0.5">Hidratação Estratégica</p>
            <h3 className="font-black text-stone-900 text-2xl leading-none">
              {waterCount * 250} <span className="text-sm text-stone-400">ml consumidos</span>
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-stone-50 p-2 rounded-2xl border border-stone-100">
          <button 
            onClick={() => onUpdateWater(-1)} 
            className="w-12 h-12 rounded-xl bg-white border border-stone-200 text-stone-400 flex items-center justify-center font-bold hover:bg-stone-100 hover:text-stone-600 transition-colors shadow-sm active:scale-95"
          >
            <Minus size={20} />
          </button>
          <div className="flex flex-col items-center justify-center px-2">
            <span className="text-xs font-black text-stone-800">{waterCount}</span>
            <span className="text-[10px] font-bold text-stone-400 uppercase">Copos</span>
          </div>
          <button 
            onClick={() => onUpdateWater(1)} 
            className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
