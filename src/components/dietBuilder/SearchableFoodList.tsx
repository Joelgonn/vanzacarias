'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Search, Ban, AlertTriangle, ClipboardList } from 'lucide-react';
import type { FoodRestriction } from '@/types/patient';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';
import { getRestrictionInfo } from '@/lib/nutrition/restrictions';
import { flatFoodsList } from './foods';

interface SearchableFoodListProps {
  onSelectFood: (foodId: string) => void;
  blockedFoodIds: Set<string>;
  foodRestrictions: FoodRestriction[];
  autoFocus?: boolean;
}

function SearchableFoodListComponent({ onSelectFood, blockedFoodIds, foodRestrictions, autoFocus = false }: SearchableFoodListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getFilteredFoods = () => {
    const normalizedSearch = searchTerm.toLowerCase().trim();
    if (!normalizedSearch) return [];

    return flatFoodsList
      .map(item => {
        const label = item.label.toLowerCase();
        let score = 0;
        if (label.startsWith(normalizedSearch)) score += 3;
        else if (label.includes(normalizedSearch)) score += 2;
        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };

  const filteredFoods = getFilteredFoods();

  useEffect(() => {
    const el = listRef.current?.children[highlightIndex] as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filteredFoods.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev < filteredFoods.length - 1 ? prev + 1 : prev));
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev > 0 ? prev - 1 : 0));
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredFoods[highlightIndex];
      if (selected) {
        onSelectFood(selected.id);
        setSearchTerm('');
        setHighlightIndex(0);
        inputRef.current?.focus();
      }
    }

    if (e.key === 'Escape') {
      setSearchTerm('');
      setHighlightIndex(0);
    }
  };

  const handleSelect = (foodId: string) => {
    onSelectFood(foodId);
    setSearchTerm('');
    setHighlightIndex(0);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar alimento... (ex: frango, arroz, banana)"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium outline-none focus:border-stone-800 focus:ring-4 focus:ring-stone-800/10 transition-all"
          autoFocus={autoFocus}
        />
      </div>

      {searchTerm.length > 0 && (
        <div 
          ref={listRef}
          className="space-y-1 max-h-64 overflow-y-auto border border-stone-200 rounded-xl bg-white p-1 shadow-sm"
        >
          {filteredFoods.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-stone-400">
              Nenhum alimento encontrado
            </div>
          ) : (
            filteredFoods.map((item, index) => {
              const food = FOOD_REGISTRY.find(f => f.id === item.id);
              const isBlocked = blockedFoodIds.has(item.id);
              const restrictionInfo = getRestrictionInfo(item.id, foodRestrictions);
              
              let restrictionIcon: React.ReactNode = null;
              
              if (isBlocked) {
                if (restrictionInfo?.type === 'allergy') {
                  restrictionIcon = <Ban size={10} className="text-red-500 shrink-0" />;
                } else if (restrictionInfo?.type === 'intolerance') {
                  restrictionIcon = <AlertTriangle size={10} className="text-amber-500 shrink-0" />;
                } else {
                  restrictionIcon = <ClipboardList size={10} className="text-blue-500 shrink-0" />;
                }
              }
              
              return (
                <button
                  key={item.id}
                  onClick={() => !isBlocked && handleSelect(item.id)}
                  disabled={isBlocked}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    index === highlightIndex
                      ? 'bg-stone-800 text-white'
                      : isBlocked
                        ? 'bg-red-50 text-red-400 cursor-not-allowed opacity-70'
                        : 'hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    {restrictionIcon}
                    {item.label}
                  </span>
                  {food && (
                    <span className={`text-[9px] font-bold ml-2 ${
                      index === highlightIndex ? 'text-white/70' : 'text-stone-400'
                    }`}>
                      {food.kcal} kcal
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export const SearchableFoodList = memo(SearchableFoodListComponent);
