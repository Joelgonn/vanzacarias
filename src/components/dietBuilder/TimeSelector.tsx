'use client';

import { useState } from 'react';
import { Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { MEAL_TIMES } from './constants';

interface TimeSelectorProps {
  value: string;
  onChange: (time: string) => void;
  mealType: string;
  className?: string;
}

export function TimeSelector({ value, onChange, mealType, className = '' }: TimeSelectorProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customTime, setCustomTime] = useState('');
  
  const suggestedTimes = MEAL_TIMES[mealType] || ["08:00", "12:00", "19:00"];
  const hasSuggested = suggestedTimes.includes(value);
  
  const handleCustomTimeSubmit = () => {
    if (customTime && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(customTime)) {
      onChange(customTime);
      setShowCustomInput(false);
      setCustomTime('');
    } else if (customTime) {
      toast.error('Formato de horário inválido. Use HH:MM (ex: 14:30)');
    }
  };
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {suggestedTimes.slice(0, 4).map(time => (
          <button
            key={time}
            onClick={() => {
              onChange(time);
              setShowCustomInput(false);
            }}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all duration-300 active:scale-95 ${
              value === time && !showCustomInput
                ? 'bg-stone-800 text-white shadow-md shadow-stone-800/20'
                : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-800'
            }`}
          >
            {time}
          </button>
        ))}
        
        {!showCustomInput && (
          <button
            onClick={() => {
              setShowCustomInput(true);
              if (!hasSuggested) setCustomTime(value);
            }}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all duration-300 active:scale-95 ${
              !hasSuggested && value && !showCustomInput
                ? 'bg-stone-800 text-white shadow-md shadow-stone-800/20'
                : 'bg-stone-50 border border-stone-200 border-dashed text-stone-500 hover:border-stone-400 hover:text-stone-800'
            }`}
          >
            {!hasSuggested && value ? value : 'Outro'}
          </button>
        )}
      </div>
      
      {showCustomInput && (
        <div className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2 mt-2">
          <div className="relative">
            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="HH:MM"
              value={customTime || (value && !hasSuggested ? value : '')}
              onChange={(e) => setCustomTime(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCustomTimeSubmit()}
              className="w-24 pl-8 pr-3 py-2 rounded-xl border border-stone-200 font-bold text-stone-800 outline-none focus:border-stone-500 focus:ring-4 focus:ring-stone-500/10 bg-white text-sm transition-all"
              autoFocus
            />
          </div>
          <button
            onClick={handleCustomTimeSubmit}
            className="px-4 py-2 bg-stone-800 text-white rounded-xl text-xs font-bold hover:bg-stone-700 transition-colors shadow-sm"
          >
            OK
          </button>
          <button
            onClick={() => {
              setShowCustomInput(false);
              setCustomTime('');
            }}
            className="px-3 py-2 bg-stone-100 text-stone-500 hover:text-stone-700 rounded-xl transition-colors"
            title="Cancelar"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
