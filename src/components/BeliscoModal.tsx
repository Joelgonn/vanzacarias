'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, TrendingUp, Clock, Flame, Check, Loader2 } from 'lucide-react';
import { FoodItem } from '@/types/patient';
import { FOOD_REGISTRY, getBaseGrams, searchFoods } from '@/lib/foodRegistry';

interface BeliscoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFood: (food: FoodItem, grams: number) => void;
  onAddManual: (kcal: number, protein: number, carbs: number, fat: number) => void;
}

interface QuickAddItem {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
}

const QUICK_ADD_OPTIONS: QuickAddItem[] = [
  { name: 'Biscoito recheado (1 un)', kcal: 85, protein: 1, carbs: 12, fat: 4, grams: 20 },
  { name: 'Barra de cereal (1 un)', kcal: 90, protein: 1.5, carbs: 14, fat: 3, grams: 25 },
  { name: 'Salgadinho (1 pacote pequeno)', kcal: 120, protein: 2, carbs: 15, fat: 6, grams: 30 },
  { name: 'Chocolate ao leite (1 quadrado)', kcal: 55, protein: 0.5, carbs: 6, fat: 3.5, grams: 10 },
  { name: 'Sorvete (1 bola)', kcal: 110, protein: 2, carbs: 15, fat: 5, grams: 60 },
  { name: 'Pão de queijo (1 un)', kcal: 95, protein: 3, carbs: 10, fat: 5, grams: 30 },
  { name: 'Coxinha (1 un pequena)', kcal: 150, protein: 5, carbs: 18, fat: 7, grams: 50 },
  { name: 'Pastel (1 un pequeno)', kcal: 180, protein: 4, carbs: 20, fat: 10, grams: 60 },
];

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

export function BeliscoModal({ isOpen, onClose, onAddFood, onAddManual }: BeliscoModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [activeTab, setActiveTab] = useState<'search' | 'quick' | 'manual'>('search');
  
  // Estado para modo manual
  const [manualKcal, setManualKcal] = useState<string>('');
  const [manualProtein, setManualProtein] = useState<string>('');
  const [manualCarbs, setManualCarbs] = useState<string>('');
  const [manualFat, setManualFat] = useState<string>('');

  // 🔥 Converter FOOD_REGISTRY para FoodItem[] (CORRIGIDO)
  const foodRegistryItems = useMemo(() => {
    return FOOD_REGISTRY.map(convertToFoodItem);
  }, []);

  // Função de busca (CORRIGIDO: usa foodRegistryItems)
  const searchFoodsLocal = (term: string): FoodItem[] => {
    if (!term.trim()) return [];
    const normalizedTerm = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return foodRegistryItems.filter(food => {
      const normalizedName = food.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normalizedName.includes(normalizedTerm);
    });
  };

  const searchResults = useMemo(() => {
    return searchFoodsLocal(searchTerm);
  }, [searchTerm, foodRegistryItems]);

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedFood(null);
      setGrams(100);
      setActiveTab('search');
      setManualKcal('');
      setManualProtein('');
      setManualCarbs('');
      setManualFat('');
    }
  }, [isOpen]);

  const handleAddFood = () => {
    if (selectedFood && grams > 0) {
      onAddFood(selectedFood, grams);
      onClose();
    }
  };

  const handleQuickAdd = (item: QuickAddItem) => {
    onAddManual(item.kcal, item.protein, item.carbs, item.fat);
    onClose();
  };

  const handleManualAdd = () => {
    const kcal = parseFloat(manualKcal);
    const protein = parseFloat(manualProtein) || 0;
    const carbs = parseFloat(manualCarbs) || 0;
    const fat = parseFloat(manualFat) || 0;
    
    if (isNaN(kcal) || kcal <= 0) {
      return;
    }
    
    onAddManual(kcal, protein, carbs, fat);
    onClose();
  };

  const baseGrams = selectedFood ? getBaseGrams(selectedFood.id) : 100;
  const factor = grams / baseGrams;
  const calculatedKcal = selectedFood ? selectedFood.kcal * factor : 0;
  const calculatedProtein = selectedFood ? selectedFood.macros.p * factor : 0;
  const calculatedCarbs = selectedFood ? selectedFood.macros.c * factor : 0;
  const calculatedFat = selectedFood ? selectedFood.macros.g * factor : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-tight">Adicionar Belisco</h3>
              <p className="text-xs text-amber-100 opacity-90">Registre um consumo extra</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-black/20 hover:bg-black/30 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${
              activeTab === 'search' 
                ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/30' 
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Buscar Alimento
          </button>
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${
              activeTab === 'quick' 
                ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/30' 
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Rápidos
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${
              activeTab === 'manual' 
                ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/30' 
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Manual
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          
          {/* TAB: SEARCH */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar alimento (ex: chocolate, biscoito, sorvete)..."
                  className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {searchTerm && searchResults.length === 0 && (
                <div className="text-center py-8 text-stone-400">
                  <p className="text-sm">Nenhum alimento encontrado</p>
                </div>
              )}

              {searchResults.length > 0 && !selectedFood && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-stone-400 tracking-widest">
                    Resultados ({searchResults.length})
                  </p>
                  {searchResults.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => setSelectedFood(food)}
                      className="w-full text-left p-4 bg-stone-50 rounded-xl border border-stone-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all"
                    >
                      <p className="font-bold text-stone-800">{food.name}</p>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span className="text-amber-600 font-bold">{Math.round(food.kcal)} kcal</span>
                        <span className="text-stone-400">P: {food.macros.p}g</span>
                        <span className="text-stone-400">C: {food.macros.c}g</span>
                        <span className="text-stone-400">G: {food.macros.g}g</span>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1">Base: {food.grams || getBaseGrams(food.id)}g</p>
                    </button>
                  ))}
                </div>
              )}

                            {selectedFood && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div>
                      <p className="font-bold text-stone-800">{selectedFood.name}</p>
                      <p className="text-xs text-stone-500">Base: {baseGrams}g</p>
                    </div>
                    <button
                      onClick={() => setSelectedFood(null)}
                      className="text-stone-400 hover:text-stone-600 text-sm"
                    >
                      Trocar
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-stone-500 block mb-2">
                      Quantidade (gramas)
                    </label>
                    <input
                      type="number"
                      value={grams}
                      onChange={(e) => setGrams(parseFloat(e.target.value) || 0)}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      step={10}
                      min={10}
                    />
                  </div>

                  <div className="p-4 bg-stone-50 rounded-xl">
                    <p className="text-xs font-bold uppercase text-stone-400 mb-2">Total calculado</p>
                    <div className="flex flex-wrap gap-3">
                      <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg font-bold">
                        {Math.round(calculatedKcal)} kcal
                      </span>
                      <span className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-sm">
                        P: {Math.round(calculatedProtein)}g
                      </span>
                      <span className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-sm">
                        C: {Math.round(calculatedCarbs)}g
                      </span>
                      <span className="bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-sm">
                        G: {Math.round(calculatedFat)}g
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleAddFood}
                    disabled={grams <= 0}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Adicionar ao registro
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: QUICK ADD */}
          {activeTab === 'quick' && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase text-stone-400 tracking-widest mb-3">
                Opções comuns
              </p>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ADD_OPTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAdd(item)}
                    className="text-left p-3 bg-stone-50 rounded-xl border border-stone-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all"
                  >
                    <p className="font-bold text-sm text-stone-800">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Flame size={12} className="text-amber-500" />
                      <span className="text-xs font-bold text-amber-600">{item.kcal} kcal</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB: MANUAL */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase text-stone-400 tracking-widest">
                Registro manual de calorias
              </p>
              
              <div>
                <label className="text-sm font-bold text-stone-700 block mb-1">
                  Calorias (kcal) *
                </label>
                <input
                  type="number"
                  value={manualKcal}
                  onChange={(e) => setManualKcal(e.target.value)}
                  placeholder="Ex: 150"
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-600 block mb-1">
                    Proteína (g)
                  </label>
                  <input
                    type="number"
                    value={manualProtein}
                    onChange={(e) => setManualProtein(e.target.value)}
                    placeholder="0"
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-600 block mb-1">
                    Carboidrato (g)
                  </label>
                  <input
                    type="number"
                    value={manualCarbs}
                    onChange={(e) => setManualCarbs(e.target.value)}
                    placeholder="0"
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-600 block mb-1">
                    Gordura (g)
                  </label>
                  <input
                    type="number"
                    value={manualFat}
                    onChange={(e) => setManualFat(e.target.value)}
                    placeholder="0"
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                onClick={handleManualAdd}
                disabled={!manualKcal || parseFloat(manualKcal) <= 0}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                Registrar manualmente
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50">
          <p className="text-[10px] text-stone-400 text-center font-medium">
            Registrar beliscos ajuda a manter o controle do seu progresso
          </p>
        </div>
      </div>
    </div>
  );
}