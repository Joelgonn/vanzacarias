'use client';

import { memo } from 'react';
import { Trash2 } from 'lucide-react';
import type { FoodItem } from '@/types/patient';
import { getBaseGrams } from '@/lib/foodRegistry';

interface FoodItemCardProps {
  foodItem: FoodItem;
  index: number;
  isActive: boolean;
  onUpdateGrams: (grams: number) => void;
  onDelete: () => void;
  onActivate: () => void;
}

function FoodItemCardComponent({ 
  foodItem, 
  isActive, 
  onUpdateGrams, 
  onDelete, 
  onActivate 
}: FoodItemCardProps) {
  const grams = foodItem.grams;
  const baseGrams = getBaseGrams(foodItem.id);
  const ratio = grams / baseGrams;
  
  const presets = [100, 150, 200];
  
  const handlePresetClick = (preset: number) => {
    onUpdateGrams(preset);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === '') {
      onUpdateGrams(0);
    } else {
      const parsedValue = parseInt(rawValue, 10);
      if (!isNaN(parsedValue)) {
        onUpdateGrams(parsedValue);
      }
    }
  };
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateGrams(Number(e.target.value));
  };
  
  return (
    <div 
      className={`bg-white border rounded-xl p-3 transition-all duration-200 ${
        isActive 
          ? 'ring-2 ring-stone-800 shadow-md border-stone-800' 
          : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'
      }`}
      onClick={onActivate}
    >
      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <span className="text-sm font-bold text-stone-800 w-full xl:w-48 shrink-0 truncate">
          {foodItem.name}
        </span>
        
        <div className="flex flex-1 flex-wrap items-center gap-3 xl:gap-4">
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1">
              <input
                type="number"
                inputMode="numeric"
                value={Math.round(grams)}
                onChange={handleInputChange}
                className="w-12 text-sm font-bold text-center bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] font-bold text-stone-400 uppercase">g</span>
            </div>
            
            {isActive && presets.map(preset => (
              <button
                key={preset}
                onClick={(e) => { e.stopPropagation(); handlePresetClick(preset); }}
                className="text-[10px] font-bold px-2 py-1 rounded-md bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-800 transition-all active:scale-95 hidden sm:block"
              >
                {preset}g
              </button>
            ))}
          </div>
          
          <div className={`flex-1 min-w-[80px] hidden sm:block ${isActive ? 'opacity-100' : 'opacity-0 xl:opacity-100 xl:opacity-30 pointer-events-none xl:pointer-events-auto transition-opacity'}`}>
            <input
              type="range"
              min={0}
              max={300}
              step={10}
              value={Math.min(grams, 300)}
              onChange={handleSliderChange}
              className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-700 opacity-70 hover:opacity-100 transition-opacity"
            />
          </div>
          
          <div className="flex items-center gap-2 text-[10px] font-bold shrink-0 opacity-80 xl:ml-auto">
            <span className="text-stone-500 w-12 text-right">{Math.round(foodItem.kcal * ratio)} kcal</span>
            <span className="text-red-500 w-8 text-right">P {Math.round(foodItem.macros.p * ratio)}</span>
            <span className="text-amber-500 w-8 text-right">C {Math.round(foodItem.macros.c * ratio)}</span>
            <span className="text-blue-500 w-8 text-right">G {Math.round(foodItem.macros.g * ratio)}</span>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }} 
            className="text-stone-300 hover:text-rose-600 transition-colors p-1 ml-auto xl:ml-0 shrink-0"
            title="Remover Alimento"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export const FoodItemCard = memo(FoodItemCardComponent);
