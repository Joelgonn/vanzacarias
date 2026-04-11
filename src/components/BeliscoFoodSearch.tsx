'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Plus, ChevronRight } from 'lucide-react';
import { FOOD_REGISTRY, getBaseGrams } from '@/lib/foodRegistry';
import { FoodItem } from '@/types/patient';
import { toast } from 'sonner';

// =========================================================================
// FUNÇÃO DE NORMALIZAÇÃO (REAPROVEITANDO A MESMA DO PROJETO)
// =========================================================================
const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// =========================================================================
// FUNÇÃO PARA CALCULAR TOTAIS COM BASE NAS GRAMAS
// =========================================================================
const calculateFoodTotals = (food: FoodItem, grams: number) => {
  const baseGrams = getBaseGrams(food.id);
  const factor = grams / baseGrams;
  
  return {
    kcal: food.kcal * factor,
    protein: food.macros.p * factor,
    carbs: food.macros.c * factor,
    fat: food.macros.g * factor
  };
};

// =========================================================================
// FUNÇÃO PARA CONVERTER FOOD_ENTITY PARA FOOD_ITEM
// =========================================================================
const convertToFoodItem = (food: any): FoodItem => {
  return {
    id: food.id,
    name: food.name,
    kcal: food.kcal,
    macros: {
      p: food.macros?.p || 0,
      c: food.macros?.c || 0,
      g: food.macros?.g || 0
    },
    grams: getBaseGrams(food.id)
  };
};

// =========================================================================
// INTERFACE DO COMPONENTE (CORRIGIDA)
// =========================================================================
interface BeliscoFoodSearchProps {
  onSelectFood: (food: FoodItem, grams: number) => void;
  onManualAdd: (kcal: number, protein: number, carbs: number, fat: number) => void;
  autoFocus?: boolean;
}

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export function BeliscoFoodSearch({ onSelectFood, onManualAdd, autoFocus = false }: BeliscoFoodSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showManualMode, setShowManualMode] = useState(false);
  const [manualKcal, setManualKcal] = useState<string>('');
  const [manualProtein, setManualProtein] = useState<string>('');
  const [manualCarbs, setManualCarbs] = useState<string>('');
  const [manualFat, setManualFat] = useState<string>('');
  
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🔥 MELHORIA DE PERFORMANCE: Map para busca O(1) (CORRIGIDO: converte para FoodItem)
  const foodMap = useMemo(() => {
    const map = new Map<string, FoodItem>();
    FOOD_REGISTRY.forEach(food => {
      map.set(food.id, convertToFoodItem(food));
    });
    return map;
  }, []);

  // Lista plana de alimentos para busca com normalização (CORRIGIDO: usa FoodItem)
  const flatFoodsList = useMemo(() => {
    return Array.from(foodMap.values()).map(food => ({
      id: food.id,
      name: food.name,
      nameNormalized: normalizeString(food.name),
      kcal: food.kcal,
      baseGrams: food.grams || 100
    }));
  }, [foodMap]);

  // 🔥 BUSCA COM NORMALIZAÇÃO (corrige acentos e caracteres especiais)
  const getFilteredFoods = () => {
    const normalizedSearch = normalizeString(searchTerm);
    if (!normalizedSearch) return [];

    return flatFoodsList
      .map(item => {
        let score = 0;
        if (item.nameNormalized.startsWith(normalizedSearch)) score += 3;
        else if (item.nameNormalized.includes(normalizedSearch)) score += 2;
        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  };

  const filteredFoods = getFilteredFoods();

  // Presets de gramas
  const presets = [50, 100, 150, 200, 250];

  // Auto-focus quando o modal abrir
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  // Scroll para o item destacado
  useEffect(() => {
    const el = listRef.current?.children[highlightIndex] as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Reset do estado quando sair do modo manual
  const resetSearchState = () => {
    setSearchTerm('');
    setHighlightIndex(0);
    setSelectedFood(null);
    setShowManualMode(false);
  };

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showManualMode) return;
    
    if (!filteredFoods.length && searchTerm.length > 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        setShowManualMode(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev < filteredFoods.length - 1 ? prev + 1 : prev));
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev > 0 ? prev - 1 : 0));
    }

    if (e.key === 'Enter' && filteredFoods[highlightIndex]) {
      e.preventDefault();
      const food = foodMap.get(filteredFoods[highlightIndex].id);
      if (food) {
        setSelectedFood(food);
        setGrams(food.grams || 100);
        setSearchTerm('');
        setHighlightIndex(0);
      }
    }

    if (e.key === 'Escape') {
      if (selectedFood) {
        setSelectedFood(null);
        setSearchTerm('');
        setHighlightIndex(0);
      } else if (showManualMode) {
        setShowManualMode(false);
        setManualKcal('');
        setManualProtein('');
        setManualCarbs('');
        setManualFat('');
      }
    }
  };

  // Selecionar alimento da lista
  const handleSelectFood = (foodId: string) => {
    const food = foodMap.get(foodId);
    if (food) {
      setSelectedFood(food);
      setGrams(food.grams || 100);
      setSearchTerm('');
      setHighlightIndex(0);
      setShowManualMode(false);
    }
  };

  // Adicionar alimento selecionado
  const handleAddFood = () => {
    if (selectedFood && grams > 0) {
      const totals = calculateFoodTotals(selectedFood, grams);
      onSelectFood(selectedFood, grams);
      toast.success(`✓ ${selectedFood.name} (${Math.round(grams)}g) - ${Math.round(totals.kcal)} kcal`);
      setSelectedFood(null);
      setSearchTerm('');
      setGrams(100);
      setHighlightIndex(0);
    }
  };

  // Adicionar alimento manual
  const handleAddManual = () => {
    const kcal = parseFloat(manualKcal) || 0;
    const protein = parseFloat(manualProtein) || 0;
    const carbs = parseFloat(manualCarbs) || 0;
    const fat = parseFloat(manualFat) || 0;

    if (kcal === 0 && protein === 0 && carbs === 0 && fat === 0) {
      toast.error('Preencha pelo menos as calorias');
      return;
    }

    onManualAdd(kcal, protein, carbs, fat);
    toast.success(`✓ Belisco manual registrado: +${Math.round(kcal)} kcal`);
    
    setManualKcal('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    setShowManualMode(false);
    setSearchTerm('');
    setHighlightIndex(0);
  };

  // Voltar para busca
  const handleBackToSearch = () => {
    setShowManualMode(false);
    setSelectedFood(null);
    setSearchTerm('');
    setHighlightIndex(0);
    setManualKcal('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

    return (
    <div className="space-y-4">
      {/* MODO BUSCA */}
      {!showManualMode && !selectedFood && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
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
              className="w-full pl-10 pr-3 py-3 rounded-xl border border-stone-200 bg-white text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
            />
          </div>

          {searchTerm.length > 0 && (
            <div 
              ref={listRef}
              className="space-y-1 max-h-64 overflow-y-auto border border-stone-200 rounded-xl bg-white p-1 shadow-sm"
            >
              {filteredFoods.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-stone-400 mb-3">Nenhum alimento encontrado para "{searchTerm}"</p>
                  <button
                    onClick={() => setShowManualMode(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
                  >
                    <Plus size={14} /> Adicionar manualmente
                  </button>
                </div>
              ) : (
                filteredFoods.map((item, index) => {
                  const food = foodMap.get(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectFood(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                        index === highlightIndex
                          ? 'bg-orange-500 text-white'
                          : 'hover:bg-stone-50 text-stone-700'
                      }`}
                    >
                      <span className="truncate font-medium">{item.name}</span>
                      {food && (
                        <span className={`text-[10px] font-bold ml-2 ${
                          index === highlightIndex ? 'text-white/70' : 'text-stone-400'
                        }`}>
                          {Math.round(food.kcal)} kcal | base {food.grams || 100}g
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {searchTerm.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-stone-400">Digite para buscar alimentos no nosso banco de dados</p>
              <button
                onClick={() => setShowManualMode(true)}
                className="mt-3 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors inline-flex items-center gap-1"
              >
                <Plus size={12} /> Cadastrar alimento manualmente
              </button>
            </div>
          )}
        </>
      )}

      {/* MODO MANUAL */}
      {showManualMode && !selectedFood && (
        <div className="space-y-4 animate-fade-in">
          <button
            onClick={handleBackToSearch}
            className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-700 transition-colors mb-2"
          >
            <ChevronRight size={14} className="rotate-180" /> Voltar para busca
          </button>

          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
            <p className="text-[10px] font-black uppercase text-orange-600 tracking-wider mb-3">
              ✍️ Cadastro Manual Rápido
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1 block">
                  Calorias (kcal) *
                </label>
                <input
                  type="number"
                  value={manualKcal}
                  onChange={(e) => setManualKcal(e.target.value)}
                  placeholder="Ex: 120"
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-bold text-stone-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1 block">
                    Proteína (g)
                  </label>
                  <input
                    type="number"
                    value={manualProtein}
                    onChange={(e) => setManualProtein(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-bold text-stone-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1 block">
                    Carboidrato (g)
                  </label>
                  <input
                    type="number"
                    value={manualCarbs}
                    onChange={(e) => setManualCarbs(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-bold text-stone-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1 block">
                    Gordura (g)
                  </label>
                  <input
                    type="number"
                    value={manualFat}
                    onChange={(e) => setManualFat(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-bold text-stone-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleAddManual}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all active:scale-[0.98] mt-2"
              >
                Adicionar Belisco Manual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODO SELECIONADO (ALIMENTO ESCOLHIDO) */}
      {selectedFood && !showManualMode && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[10px] font-black uppercase text-orange-600 tracking-wider">Alimento selecionado</p>
                <p className="font-black text-stone-800 text-lg">{selectedFood.name}</p>
              </div>
              <button 
                onClick={() => {
                  setSelectedFood(null);
                  setSearchTerm('');
                  setHighlightIndex(0);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-full hover:bg-white/50 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[11px] font-bold text-stone-600 bg-white px-2 py-1 rounded-lg">
                Base: {getBaseGrams(selectedFood.id)}g (porção padrão)
              </span>
              <span className="text-[11px] font-bold text-orange-600 bg-white px-2 py-1 rounded-lg">
                {Math.round(selectedFood.kcal)} kcal
              </span>
              <span className="text-[10px] font-bold text-red-500 bg-white px-2 py-1 rounded-lg">
                P: {Math.round(selectedFood.macros.p)}g
              </span>
              <span className="text-[10px] font-bold text-amber-500 bg-white px-2 py-1 rounded-lg">
                C: {Math.round(selectedFood.macros.c)}g
              </span>
              <span className="text-[10px] font-bold text-blue-500 bg-white px-2 py-1 rounded-lg">
                G: {Math.round(selectedFood.macros.g)}g
              </span>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2 block">
                Quantidade consumida (gramas)
              </label>
              
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    value={grams}
                    onChange={(e) => setGrams(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-bold text-stone-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400">g</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {presets.map(preset => (
                  <button
                    key={preset}
                    onClick={() => setGrams(preset)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      grams === preset
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-white border border-stone-200 text-stone-600 hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    {preset}g
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-orange-100">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-stone-500">Total calculado:</span>
                <div className="flex gap-3">
                  <span className="text-orange-600 bg-white px-2 py-0.5 rounded">
                    {Math.round(calculateFoodTotals(selectedFood, grams).kcal)} kcal
                  </span>
                  <span className="text-red-500 bg-white px-2 py-0.5 rounded">
                    P: {Math.round(calculateFoodTotals(selectedFood, grams).protein)}g
                  </span>
                  <span className="text-amber-500 bg-white px-2 py-0.5 rounded">
                    C: {Math.round(calculateFoodTotals(selectedFood, grams).carbs)}g
                  </span>
                  <span className="text-blue-500 bg-white px-2 py-0.5 rounded">
                    G: {Math.round(calculateFoodTotals(selectedFood, grams).fat)}g
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleAddFood}
            className="w-full bg-orange-600 text-white py-3.5 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98]"
          >
            Adicionar Belisco
          </button>
        </div>
      )}
    </div>
  );
}