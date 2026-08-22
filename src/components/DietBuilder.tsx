'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Trash2, Save, Utensils, Check, 
  ChevronDown, ChevronUp, 
  CheckCircle2, CheckCircle, AlertTriangle, CalendarRange, Loader2,
  X, Clock, ChevronRight,
  ChevronLeft, Calendar, Ban, ClipboardList
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn, ui } from '@/ui/system';

// ✅ CORREÇÃO: FoodItem agora é importado do SSOT correto (patient)
import { FoodRestriction, FoodItem } from '@/types/patient';
import { FOOD_REGISTRY, FoodEntity, getBaseGrams } from '@/lib/foodRegistry';

import { 
  getRestrictionInfo, 
  getRestrictionsSummary,
  expandRestrictions,
  resolveRestriction
} from '@/lib/nutrition/restrictions';

// ============================================================================
// 🔥 IMPORTS DA MACRO ENGINE
// ============================================================================
import { 
  analyzeMacros, 
  suggestAdjustments
} from '@/lib/macroEngine';

// ✅ CORREÇÃO: Removido o FoodItem daqui, pois agora vem de patient
import { 
  MacroTargets
} from '@/types/macroEngine';

import { MacroSuggestions } from '@/components/MacroSuggestions';

// ============================================================================
// 🔥 MÓDULOS EXTRAÍDOS (Fase D — arquitetura)
// ============================================================================
import { ORDERED_DAYS, MEAL_TYPES, MEAL_TIMES } from '@/components/dietBuilder/constants';
import { quickFoods } from '@/components/dietBuilder/foods';
import { TimeSelector } from '@/components/dietBuilder/TimeSelector';
import { RestrictionsSidebar } from '@/components/dietBuilder/RestrictionsSidebar';
import { MacrosSidebar } from '@/components/dietBuilder/MacrosSidebar';
import { FoodItemCard } from '@/components/dietBuilder/FoodItemCard';
import { SearchableFoodList } from '@/components/dietBuilder/SearchableFoodList';

// ============================================================================
// 🔥 NORMALIZAÇÃO CENTRAL
// ============================================================================

// Formato mínimo aceito pelo normalizador (vem do cardápio salvo no Supabase)
interface NormalizableFoodItem {
  id: string;
  grams?: number | null;
  quantity?: number | null;
}

function normalizeGrams(item: NormalizableFoodItem): number {
  if (item.grams != null) return item.grams;
  if (item.quantity != null) {
    return item.quantity * getBaseGrams(item.id);
  }
  return getBaseGrams(item.id);
}

function calculateTotals(foodItems: FoodItem[]) {
  return foodItems.reduce((acc, item) => {
    const baseGrams = getBaseGrams(item.id);
    const grams = normalizeGrams(item);
    const factor = grams / baseGrams;

    return {
      kcal: acc.kcal + (item.kcal * factor),
      macros: {
        p: acc.macros.p + (item.macros.p * factor),
        c: acc.macros.c + (item.macros.c * factor),
        g: acc.macros.g + (item.macros.g * factor),
      }
    };
  }, {
    kcal: 0,
    macros: { p: 0, c: 0, g: 0 }
  });
}

function mapToFoodItem(food: FoodEntity): FoodItem {
  return {
    id: food.id,
    name: food.name,
    kcal: food.kcal,
    macros: {
      p: food.macros.p,
      c: food.macros.c,
      g: food.macros.g
    },
    grams: food.baseGrams
  };
}

// =========================================================================
// INTERFACES E TIPAGENS
// =========================================================================

interface TargetRecommendation {
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface DietBuilderProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
  targetRecommendation: TargetRecommendation | null;
  foodRestrictions?: FoodRestriction[]; 
  /** Opcional: notifica o pai quando há alterações não salvas (para proteger o botão de fechar externo) */
  onDirtyChange?: (dirty: boolean) => void;
}

export interface Option {
  id: string;
  day: string;
  foodItems: FoodItem[];
  kcal: number;
  macros: { 
    p: number;
    c: number;
    g: number;
  };
}

export interface Meal {
  id: string;
  time: string;
  name: string;
  options: Option[];
}

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function DietBuilder({ patientId, patientName, targetRecommendation, onClose, foodRestrictions = [], onDirtyChange }: DietBuilderProps) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [activeTimeMealId, setActiveTimeMealId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [activeFoodKey, setActiveFoodKey] = useState<string | null>(null);
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const optionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ============================================================================
  // 🔥 CONTROLE DE ALTERAÇÕES NÃO SALVAS (Fase A)
  // Toda mutação de refeições passa por updateMeals → marca isDirty.
  // O load inicial usa setMeals direto (não é alteração do usuário).
  // ============================================================================
  const updateMeals = (updater: (prev: Meal[]) => Meal[]) => {
    setMeals(updater);
    setIsDirty(true);
  };

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // ============================================================================
  // 🔥 FLUXO GUIADO POR DIA (NOVO)
  // ============================================================================
  
  const [activeDay, setActiveDay] = useState<string>("Segunda-feira");
  const [autoAdvancedDays, setAutoAdvancedDays] = useState<Set<string>>(new Set());

  const supabase = createClient();

  const blockedFoodIds = expandRestrictions(foodRestrictions);
  const restrictionsSummary = getRestrictionsSummary(foodRestrictions);

  // ============================================================================
  // 🔥 FUNÇÃO: PRÓXIMO DIA
  // ============================================================================
  
  function isDayCompleteForMeals(day: string, mealsToCheck: Meal[]): boolean {
    if (mealsToCheck.length === 0) return false;

    return mealsToCheck.every(meal => {
      const options = meal.options.filter(opt =>
        opt.day === day || opt.day === "Todos os dias"
      );
      return options.some(opt => opt.foodItems.length > 0);
    });
  }

  function getFirstIncompleteDay(mealsToCheck: Meal[]): string {
    return ORDERED_DAYS.find(day => !isDayCompleteForMeals(day, mealsToCheck)) || ORDERED_DAYS[0];
  }

  // ============================================================================
  // 🔥 FUNÇÃO: VERIFICA SE DIA ESTÁ COMPLETO
  // ============================================================================
  
  function isDayComplete(day: string): boolean {
    return isDayCompleteForMeals(day, meals);
  }

  // ============================================================================
  // 🔥 FUNÇÃO: FILTRA OPÇÕES POR DIA ATIVO
  // ============================================================================
  
  const getOptionsForDay = (meal: Meal) => {
    return meal.options.filter(opt =>
      opt.day === activeDay || opt.day === "Todos os dias"
    );
  };

  // ============================================================================
  // 🔥 AUTO-AVANÇO QUANDO DIA ESTÁ COMPLETO
  // ============================================================================
  
  useEffect(() => {
    if (autoAdvancedDays.has(activeDay)) return;
    
    if (isDayComplete(activeDay)) {
      const nextDay = ORDERED_DAYS.find(day =>
        ORDERED_DAYS.indexOf(day) > ORDERED_DAYS.indexOf(activeDay) && !isDayComplete(day)
      );
      
      if (nextDay) {
        setActiveDay(nextDay);
        setAutoAdvancedDays(prev => new Set(prev).add(activeDay));
        toast.success(`✅ Dia ${activeDay} concluído! Avançando para ${nextDay}`);
      } else if (activeDay === "Domingo" && isDayComplete("Domingo")) {
        toast.success("🎉 Semana completa! Todos os dias estão montados.");
      }
    }
  }, [meals, activeDay, autoAdvancedDays]);

  useEffect(() => {
    if (!activeOptionId) return;

    const optionEl = optionRefs.current[activeOptionId];
    if (!optionEl) return;

    optionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const searchInput = optionEl.querySelector('input[type="text"]') as HTMLInputElement | null;
    searchInput?.focus();
  }, [activeOptionId, meals, activeDay, expandedMealId]);

  // ============================================================================
  // 🔥 CÁLCULO DIÁRIO (BASEADO NO DIA ATIVO)
  // ============================================================================
  
  const allFoodItems = useMemo(() => {
    return meals.flatMap(meal =>
      getOptionsForDay(meal).flatMap(option => option.foodItems)
    );
  }, [meals, activeDay]);

  const dailyTotals = useMemo(() => {
    return calculateTotals(allFoodItems);
  }, [allFoodItems]);

  const analysis = useMemo(() => {
    if (!targetRecommendation) return null;
    
    const targets: MacroTargets = {
      kcal: targetRecommendation.calories,
      macros: {
        p: targetRecommendation.macros.protein,
        c: targetRecommendation.macros.carbs,
        g: targetRecommendation.macros.fat
      }
    };
    
    return analyzeMacros({
      kcal: dailyTotals.kcal,
      macros: {
        p: dailyTotals.macros.p,
        c: dailyTotals.macros.c,
        g: dailyTotals.macros.g
      }
    }, targets);
  }, [dailyTotals, targetRecommendation]);

  const suggestions = useMemo(() => {
    if (!analysis) return [];
    return suggestAdjustments(analysis, allFoodItems, foodRestrictions);
  }, [analysis, allFoodItems, foodRestrictions]);

  // =========================================================================
  // MIGRAÇÃO LIMPA
  // =========================================================================
  
  // Formatos crus vindos do JSON salvo no Supabase (coluna meal_plan)
  interface RawFoodItem {
    id: string;
    name?: string;
    kcal?: number;
    macros?: { p: number; c: number; g: number };
    grams?: number | null;
    quantity?: number | null;
  }

  interface RawOption {
    id: string;
    day?: string;
    foodItems?: RawFoodItem[];
    kcal?: number;
    macros?: { p: number; c: number; g: number };
  }

  const migrateExistingOption = (option: RawOption): Option => {
    if (option.foodItems && Array.isArray(option.foodItems)) {
      return {
        ...option,
        day: option.day as string,
        foodItems: option.foodItems.map((item: RawFoodItem) => {
          const baseGrams = getBaseGrams(item.id);
          let grams: number;

          if (item.grams != null) {
            grams = item.grams;
          } else if (item.quantity != null) {
            grams = item.quantity * baseGrams;
          } else {
            grams = baseGrams;
          }

          return {
            id: item.id,
            name: item.name as string,
            kcal: item.kcal as number,
            macros: item.macros as Option['macros'],
            grams
          };
        }),
        kcal: option.kcal as number,
        macros: option.macros as Option['macros']
      };
    }

    return {
      id: option.id,
      day: option.day || "Todos os dias",
      foodItems: [],
      kcal: option.kcal || 0,
      macros: option.macros || { p: 0, c: 0, g: 0 }
    };
  };

  // =========================================================================
  // MANIPULAÇÃO DE DADOS
  // =========================================================================
  
  const addFoodItem = (mealId: string, optId: string, foodId: string) => {
    const registryFood = FOOD_REGISTRY.find(f => f.id === foodId);

    if (!registryFood) {
      toast.error("Erro estrutural: Alimento não encontrado.");
      return;
    }

    if (blockedFoodIds.has(registryFood.id)) {
      const restrictionType = resolveRestriction(registryFood.id, foodRestrictions);
      toast.error(
        restrictionType === 'allergy'
          ? `❌ Alergia: ${registryFood.name}`
          : `❌ Restrição: ${registryFood.name}`
      );
      return;
    }

    updateMeals(prevMeals => prevMeals.map(m => {
      if (m.id !== mealId) return m;

      return {
        ...m,
        options: m.options.map(o => {
          if (o.id !== optId) return o;

          const existing = o.foodItems.find(f => f.id === registryFood.id);

          let updatedFoodItems: FoodItem[];

          if (existing) {
            const base = getBaseGrams(existing.id);
            updatedFoodItems = o.foodItems.map(f =>
              f.id === existing.id
                ? { ...f, grams: f.grams + base }
                : f
            );
          } else {
            updatedFoodItems = [...o.foodItems, mapToFoodItem(registryFood)];
          }

          const totals = calculateTotals(updatedFoodItems);

          return {
            ...o,
            foodItems: updatedFoodItems,
            kcal: totals.kcal,
            macros: totals.macros
          };
        })
      };
    }));
  };

  const updateFoodItemGrams = (
    mealId: string,
    optId: string,
    foodItemId: string,
    newGrams: number
  ) => {
    const safeGrams = Math.max(0, Math.floor(newGrams || 0));

    updateMeals(prevMeals => prevMeals.map(m => {
      if (m.id !== mealId) return m;

      return {
        ...m,
        options: m.options.map(o => {
          if (o.id !== optId) return o;

          let updatedFoodItems: FoodItem[];

          if (safeGrams === 0) {
            updatedFoodItems = o.foodItems.filter(f => f.id !== foodItemId);
          } else {
            updatedFoodItems = o.foodItems.map(f =>
              f.id === foodItemId
                ? { ...f, grams: safeGrams }
                : f
            );
          }

          const totals = calculateTotals(updatedFoodItems);

          return {
            ...o,
            foodItems: updatedFoodItems,
            kcal: totals.kcal,
            macros: totals.macros
          };
        })
      };
    }));
  };

  const deleteFoodItem = (mealId: string, optId: string, foodItemId: string) => {
    updateMeals(prevMeals => prevMeals.map(m => {
      if (m.id !== mealId) return m;

      return {
        ...m,
        options: m.options.map(o => {
          if (o.id !== optId) return o;

          const updatedFoodItems = o.foodItems.filter(f => f.id !== foodItemId);
          const totals = calculateTotals(updatedFoodItems);

          return {
            ...o,
            foodItems: updatedFoodItems,
            kcal: totals.kcal,
            macros: totals.macros
          };
        })
      };
    }));
  };

  const addMeal = () => {
    let nextMealName = MEAL_TYPES[0];
    if (meals.length > 0) {
      const lastMealName = meals[meals.length - 1].name;
      const lastIndex = MEAL_TYPES.indexOf(lastMealName);
      if (lastIndex >= 0 && lastIndex < MEAL_TYPES.length - 1) {
        nextMealName = MEAL_TYPES[lastIndex + 1];
      }
    }
    const newMeal: Meal = { 
      id: `meal-${Date.now()}`, 
      time: MEAL_TIMES[nextMealName]?.[0] || "08:00",
      name: nextMealName, 
      options: [{ id: `opt-${Date.now()}`, day: 'Todos os dias', foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }] 
    };
    updateMeals(prevMeals => [...prevMeals, newMeal]);
    setExpandedMealId(newMeal.id); 
  };

  const removeMeal = (mealId: string) => {
    if (!window.confirm('Excluir esta refeição? Essa ação não pode ser desfeita.')) return;
    updateMeals(prevMeals => prevMeals.filter(m => m.id !== mealId));
    if (expandedMealId === mealId) setExpandedMealId(null);
    if (activeTimeMealId === mealId) setActiveTimeMealId(null);
  };

  const updateMealTime = (mealId: string, time: string) => updateMeals(prevMeals => prevMeals.map(m => m.id === mealId ? { ...m, time } : m));
  const updateMealName = (mealId: string, name: string) => updateMeals(prevMeals => prevMeals.map(m => m.id === mealId ? { ...m, name } : m));

  const addOption = (mealId: string) => {
    const newOptionId = `opt-${Date.now()}`;

    updateMeals(prevMeals => prevMeals.map(m => {
      if (m.id === mealId) {
        return {
          ...m,
          options: [...m.options, { id: newOptionId, day: activeDay, foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }]
        };
      }
      return m;
    }));

    setExpandedMealId(mealId);
    setActiveOptionId(newOptionId);
  };

  const splitIntoFullWeek = (mealId: string) => {
    const targetMeal = meals.find(m => m.id === mealId);
    const hasVariations = targetMeal && targetMeal.options.length > 1;
    if (hasVariations) {
      const ok = window.confirm(
        'Copiar para a semana inteira vai SUBSTITUIR as variações já montadas para cada dia. Deseja continuar?'
      );
      if (!ok) return;
    }
    updateMeals(prevMeals => prevMeals.map(m => {
      if (m.id === mealId && m.options.length > 0) {
        const baseOption = m.options[0];
        const newOptions = ORDERED_DAYS.map((day, idx) => ({
          id: `opt-${Date.now()}-${idx}`, day: day, foodItems: [...baseOption.foodItems],
          kcal: baseOption.kcal, macros: { ...baseOption.macros }
        }));
        return { ...m, options: newOptions };
      }
      return m;
    }));
    toast.success("Dias separados com sucesso!");
  };

  const updateMacro = (mealId: string, optionId: string, macro: 'p' | 'c' | 'g', value: number) => {
    updateMeals(prevMeals => prevMeals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id === optionId) {
            const newMacros = { ...o.macros, [macro]: value };
            const newKcal = (newMacros.p * 4) + (newMacros.c * 4) + (newMacros.g * 9);
            return { ...o, macros: newMacros, kcal: newKcal };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  const updateKcal = (mealId: string, optionId: string, kcal: number) => updateMeals(prevMeals => prevMeals.map(m => m.id === mealId ? { ...m, options: m.options.map(o => o.id === optionId ? { ...o, kcal } : o) } : m));

  // =========================================================================
  // TOTAIS PARA SIDEBAR
  // =========================================================================
  
  const liveTotals = {
    kcal: dailyTotals.kcal,
    p: dailyTotals.macros.p,
    c: dailyTotals.macros.c,
    g: dailyTotals.macros.g
  };

  // =========================================================================
  // INIT & LOAD
  // =========================================================================
  
  // Formato cru de uma refeição salva no Supabase (coluna meal_plan)
  interface RawMeal {
    id?: string;
    time?: string;
    name?: string;
    options?: RawOption[];
  }

  useEffect(() => {
    async function fetchExistingDiet() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('meal_plan').eq('id', patientId).single();
        if (error) throw error;

        if (data?.meal_plan && Array.isArray(data.meal_plan) && data.meal_plan.length > 0) {
          const formattedPlan: Meal[] = data.meal_plan.map((m: RawMeal) => ({
            id: m.id || `meal-${Date.now()}`, time: m.time || "", name: m.name || "Refeição",
            options: (m.options ?? []).map((o: RawOption) => migrateExistingOption({ ...o, day: o.day || "Segunda-feira", kcal: o.kcal || 0, macros: o.macros || { p: 0, c: 0, g: 0 } }))
          }));
          setMeals(formattedPlan);
          setActiveDay(getFirstIncompleteDay(formattedPlan));
          setAutoAdvancedDays(new Set());
          if (formattedPlan.length > 0) setExpandedMealId(formattedPlan[0].id);
        } else {
          const newMealId = `meal-${Date.now()}`;
          setMeals([{ 
            id: newMealId, time: "08:00", name: 'Café da Manhã', 
            options: [{ id: `opt-${Date.now()}`, day: "Segunda-feira", foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }] 
          }]);
          setActiveDay("Segunda-feira");
          setAutoAdvancedDays(new Set());
          setExpandedMealId(newMealId);
        }
      } catch (error) {
        console.error(error);
        toast.error("Falha ao carregar o cardápio existente.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchExistingDiet();
  }, [patientId, supabase]);

  if (!targetRecommendation || isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4">
        <div className="bg-white p-10 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[400px] shadow-2xl animate-in zoom-in-95">
          <Loader2 className="animate-spin text-stone-800 mb-5" size={48} strokeWidth={2} />
          <p className="text-stone-500 font-bold text-lg">Carregando laboratório da dieta...</p>
        </div>
      </div>
    );
  }

  const { calories: kcalTarget, macros: { protein: proteinTarget, carbs: carbsTarget, fat: fatTarget } } = targetRecommendation;

  // =========================================================================
  // SAVE
  // =========================================================================
  // SAVE (Fase A: rascunho separado de liberação)
  // =========================================================================
  const savePlan = async (mode: 'draft' | 'release') => {
    setIsSaving(true);
    setExpandedMealId(null);
    
    const cleanedMeals = meals.map(m => ({
      ...m,
      options: m.options
        .map(o => ({
          ...o,
          foodItems: o.foodItems.map(f => ({
            id: f.id,
            name: f.name,
            kcal: f.kcal,
            macros: f.macros,
            grams: f.grams
          }))
        }))
        .filter(o => o.foodItems.length > 0)
    })).filter(m => m.options.length > 0);
    
    if (cleanedMeals.length === 0) {
      toast.warning("Não há nenhuma refeição preenchida para salvar.");
      setIsSaving(false); 
      return;
    }
    
    try {
      // Rascunho: salva o plano mantendo o status atual (não libera para o paciente)
      const { error } = await supabase.from('profiles').update({
        meal_plan: cleanedMeals,
        status: mode === 'release' ? 'plano_liberado' : 'pendente'
      }).eq('id', patientId);
      if (error) throw error;
      setIsDirty(false);
      if (mode === 'release') {
        setSaved(true);
        toast.success("Cardápio salvo e liberado para o paciente!");
        setTimeout(() => { setSaved(false); onClose(); }, 1500);
      } else {
        toast.success("Rascunho salvo! Você pode continuar editando quando quiser.");
      }
    } catch {
      toast.error("Erro ao salvar cardápio. Verifique sua conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => savePlan('release');
  const handleSaveDraft = () => savePlan('draft');

  // =========================================================================
  // FASE A: PROTEÇÃO DE SAÍDA (alerta se houver alterações não salvas)
  // =========================================================================
  const handleRequestClose = () => {
    if (isDirty) {
      const ok = window.confirm(
        'Há alterações não salvas neste cardápio. Deseja realmente sair? As alterações serão perdidas.'
      );
      if (!ok) return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-2 sm:p-4 transition-all duration-300">
      
      <div className="bg-[#fcfcfc] w-full max-w-[95vw] md:max-w-[1400px] h-[90vh] rounded-2xl sm:rounded-[2rem] flex flex-col shadow-2xl animate-in zoom-in-95 overflow-hidden">
        
        {/* HEADER COM SELETOR DE DIA */}
        <div className="bg-white px-4 sm:px-6 py-3 border-b border-stone-100 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-stone-50 p-2 rounded-xl border border-stone-200/60 text-stone-800 hidden sm:block">
                <Utensils size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-black text-stone-900 tracking-tight leading-none flex items-center flex-wrap gap-2">
                  Montar Cardápio
                  <span className="text-xs text-stone-500 font-medium tracking-normal mt-0.5 sm:mt-0">
                    • {patientName}
                  </span>
                </h2>
                {isDirty && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Alterações não salvas
                  </span>
                )}
              </div>
            </div>
            
            {/* 🔥 SELETOR DE DIA (OVERRIDE MANUAL) */}
            <div className="flex items-center gap-2 bg-stone-100 rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar size={14} className="text-stone-500" />
              <select
                value={activeDay}
                onChange={(e) => setActiveDay(e.target.value)}
                className="bg-transparent text-sm font-bold text-stone-800 outline-none cursor-pointer"
              >
                {ORDERED_DAYS.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            
            <button 
              onClick={handleRequestClose} 
              className="p-2 bg-stone-50 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-all active:scale-95"
              title={isDirty ? "Fechar (alterações não salvas)" : "Fechar"}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
          
          {/* 🔥 INDICADOR DE PROGRESSO DA SEMANA */}
          <div className="flex gap-1 mt-3">
            {ORDERED_DAYS.map(day => {
              const isComplete = isDayComplete(day);
              const isActive = activeDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  title={day}
                  className={cn(
                    'flex-1 text-[8px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all flex items-center justify-center gap-1',
                    isActive
                      ? 'bg-stone-800 text-white shadow-md'
                      : isComplete
                        ? 'bg-emerald-600 text-white border border-emerald-700 shadow-sm shadow-emerald-700/30'
                        : 'bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-600'
                  )}
                >
                  {day.substring(0, 3)}
                  {isComplete && <Check size={8} strokeWidth={3.5} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
          
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="md:hidden flex items-center justify-between gap-2 mx-4 mt-3 p-2.5 bg-stone-800 text-white rounded-xl text-xs font-bold"
          >
            <span>Ver metas do dia e restrições</span>
            <ChevronLeft size={14} className={`transition-transform ${isMobileSidebarOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {/* SIDEBAR */}
          <div className={`
            ${isMobileSidebarOpen ? 'block' : 'hidden'} 
            md:block md:w-64 lg:w-72 shrink-0 border-r border-stone-100 bg-stone-50/30 p-4 overflow-y-auto
          `}>
            <div className="sticky top-4 space-y-4">
              
              {/* BADGE DO DIA ATIVO */}
              <div className={cn(
                'rounded-xl p-3 text-center border transition-colors',
                isDayComplete(activeDay)
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-stone-100 border-stone-200/60'
              )}>
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Dia Ativo</span>
                <p className="text-lg font-black text-stone-800">{activeDay}</p>
                {isDayComplete(activeDay) && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[8px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                    <Check size={8} strokeWidth={3.5} /> Completo
                  </span>
                )}
              </div>
              
              {/* SUGESTÕES */}
              {analysis && suggestions.length > 0 && (
                <MacroSuggestions 
                  suggestions={suggestions}
                  analysis={analysis}
                />
              )}
              
              {analysis && suggestions.length === 0 && targetRecommendation && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-emerald-900">✅ Cardápio balanceado!</p>
                      <p className="text-xs text-emerald-700 mt-0.5">Macros dentro da meta para {activeDay}.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {targetRecommendation && (
                <MacrosSidebar 
                  totals={liveTotals}
                  targets={{
                    kcal: kcalTarget,
                    protein: proteinTarget,
                    carbs: carbsTarget,
                    fat: fatTarget
                  }}
                  analysis={analysis || undefined}
                />
              )}
              
              <RestrictionsSidebar restrictionsSummary={restrictionsSummary} />
            </div>
          </div>
          
          {/* ÁREA PRINCIPAL - REFEIÇÕES DO DIA ATIVO */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-stone-200">
            
            {meals.map((meal) => {
              const optionsForDay = getOptionsForDay(meal);
              const isExpanded = expandedMealId === meal.id;
              const hasContentForDay = optionsForDay.some(opt => opt.foodItems.length > 0);

              return (
                <div 
                  key={meal.id} 
                  className={`rounded-2xl transition-all duration-300 relative group overflow-hidden ${
                    isExpanded 
                      ? 'bg-white border-2 border-stone-800 shadow-lg' 
                      : hasContentForDay
                        ? 'bg-emerald-50/50 border border-emerald-100 hover:border-emerald-300 cursor-pointer shadow-sm' 
                        : 'bg-white border border-stone-200 hover:border-stone-300 cursor-pointer shadow-sm'
                  }`}
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeMeal(meal.id); }} 
                    title="Excluir Refeição"
                    className="absolute top-3 right-3 bg-white border border-stone-200 p-2 rounded-full shadow-sm text-stone-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-all z-20 active:scale-90"
                  >
                    <Trash2 size={14} strokeWidth={2.5} />
                  </button>

                  <div 
                    onClick={() => setExpandedMealId(isExpanded ? null : meal.id)}
                    className={`p-4 flex items-center justify-between relative z-10 ${isExpanded ? 'border-b border-stone-100 bg-stone-50/50' : ''}`}
                  >
                    <div className="flex items-center gap-3 w-full pr-10">
                      <div className={`p-2.5 rounded-xl shrink-0 transition-colors shadow-sm border ${
                        hasContentForDay 
                          ? 'bg-emerald-100 border-emerald-200 text-emerald-600' 
                          : isExpanded 
                            ? 'bg-stone-800 border-stone-800 text-white'
                            : 'bg-stone-50 border-stone-200 text-stone-400'
                      }`}>
                        {hasContentForDay ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <Clock size={18} strokeWidth={2.5} />}
                      </div>
                      
                      <div className="w-full">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {!isExpanded && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                              {meal.time || '--:--'}
                            </span>
                          )}
                          {optionsForDay[0]?.kcal > 0 && !isExpanded && (
                            <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider hidden sm:flex">
                              <span className="text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-md">{Math.round(optionsForDay[0]?.kcal)} kcal</span>
                              <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">P {Math.round(optionsForDay[0]?.macros?.p || 0)}g</span>
                              <span className="text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md">C {Math.round(optionsForDay[0]?.macros?.c || 0)}g</span>
                              <span className="text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md">G {Math.round(optionsForDay[0]?.macros?.g || 0)}g</span>
                            </div>
                          )}
                        </div>
                        <h3 className={`text-base sm:text-lg font-extrabold tracking-tight ${hasContentForDay && !isExpanded ? 'text-emerald-900' : 'text-stone-900'}`}>
                          {meal.name}
                        </h3>
                      </div>
                    </div>
                    
                    <div className={`shrink-0 transition-transform duration-300 bg-white shadow-sm border border-stone-100 rounded-full p-1 ${isExpanded ? 'text-stone-800 rotate-180' : 'text-stone-400'}`}>
                      <ChevronDown size={16} strokeWidth={2.5} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-stone-50/50 animate-in fade-in slide-in-from-top-4 duration-300">
                      
                      <div className="flex items-center justify-between gap-3 mb-4 bg-white px-3 py-2.5 rounded-xl border border-stone-200 shadow-sm">
                        <div className="flex items-center gap-1.5 min-w-0 bg-stone-50 hover:bg-stone-100 px-2 py-1.5 rounded-lg transition-colors border border-stone-100">
                          <Utensils size={14} className="text-stone-500 shrink-0 ml-0.5" />
                          <select 
                            value={meal.name}
                            onChange={(e) => updateMealName(meal.id, e.target.value)}
                            className="text-sm font-extrabold text-stone-800 bg-transparent outline-none cursor-pointer appearance-none truncate pr-2 pl-1"
                          >
                            {MEAL_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="text-stone-400 shrink-0 pointer-events-none -ml-1 mr-0.5" />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Clock size={14} className="text-stone-400 hidden sm:block" />
                          <button
                            onClick={() => setActiveTimeMealId(activeTimeMealId === meal.id ? null : meal.id)}
                            className="text-sm font-bold bg-stone-100 text-stone-700 hover:bg-stone-200 hover:text-stone-900 px-3 py-1.5 rounded-lg transition-colors active:scale-95 border border-stone-200/50"
                          >
                            {meal.time || '--:--'}
                          </button>
                        </div>
                      </div>

                      {activeTimeMealId === meal.id && (
                        <div className="mb-4 p-3 bg-white border border-stone-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider ml-1">Selecione o Horário</span>
                            <button 
                              onClick={() => setActiveTimeMealId(null)} 
                              className="text-stone-400 hover:text-stone-800 p-1 bg-stone-50 rounded-lg"
                            >
                              <X size={14} strokeWidth={2.5}/>
                            </button>
                          </div>
                          <TimeSelector
                            value={meal.time}
                            onChange={(time) => { 
                              updateMealTime(meal.id, time); 
                              setActiveTimeMealId(null); 
                            }}
                            mealType={meal.name}
                          />
                        </div>
                      )}

                      <div className="space-y-4">
                        {/* 🔥 MOSTRA APENAS A OPÇÃO DO DIA ATIVO */}
                        {optionsForDay.map((option) => (
                          <div
                            key={option.id}
                            ref={(el) => {
                              optionRefs.current[option.id] = el;
                            }}
                            className={`bg-white p-4 rounded-xl shadow-sm transition-all ${
                              activeOptionId === option.id
                                ? 'border-2 border-stone-800 ring-4 ring-stone-800/5'
                                : 'border border-stone-200'
                            }`}
                          >
                            
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase tracking-wider text-stone-400 bg-stone-100 px-2 py-1 rounded-md">
                                  {option.day === "Todos os dias" ? "Base" : option.day}
                                </span>
                                {option.day !== activeDay && option.day !== "Todos os dias" && (
                                  <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-2 py-1 rounded-md flex items-center gap-0.5">
                                    <AlertTriangle size={8} className="shrink-0" /> Não exibido hoje
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-stretch bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden divide-x divide-stone-200/70">
                                  <div className="flex items-center px-2.5 py-1.5 group focus-within:bg-red-50/60 transition-colors" title="Proteína (g)">
                                    <span className="text-[9px] font-black uppercase text-stone-400 mr-1.5">P</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.p || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'p', Number(e.target.value))} className="w-10 bg-transparent text-sm font-bold text-red-600 outline-none text-center" />
                                  </div>
                                  <div className="flex items-center px-2.5 py-1.5 group focus-within:bg-amber-50/60 transition-colors" title="Carboidrato (g)">
                                    <span className="text-[9px] font-black uppercase text-stone-400 mr-1.5">C</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.c || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'c', Number(e.target.value))} className="w-10 bg-transparent text-sm font-bold text-amber-600 outline-none text-center" />
                                  </div>
                                  <div className="flex items-center px-2.5 py-1.5 group focus-within:bg-blue-50/60 transition-colors" title="Gordura (g)">
                                    <span className="text-[9px] font-black uppercase text-stone-400 mr-1.5">G</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.g || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'g', Number(e.target.value))} className="w-10 bg-transparent text-sm font-bold text-blue-600 outline-none text-center" />
                                  </div>
                                  <div className="flex items-center px-2.5 py-1.5 bg-stone-800 shadow-sm" title="Calorias (kcal)">
                                    <input type="number" inputMode="decimal" value={Math.round(option.kcal || 0)} onChange={(e) => updateKcal(meal.id, option.id, Number(e.target.value))} className="w-11 bg-transparent text-sm font-black text-white outline-none text-center" />
                                    <span className="text-[8px] font-black uppercase text-stone-400 ml-1">kcal</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mb-4">
                              <label className="text-[8px] font-black uppercase tracking-[0.15em] text-stone-400 mb-2 block ml-1">
                                Prato Montado
                              </label>

                              <div className="flex flex-col gap-2 min-h-[56px] p-3 bg-stone-50/80 rounded-xl border border-stone-200 border-dashed">
                                {option.foodItems && option.foodItems.length > 0 ? (
                                  option.foodItems.map((foodItem, foodIndex) => {
                                    const foodKey = `${meal.id}-${option.id}-${foodItem.id}`;
                                    return (
                                      <FoodItemCard
                                        key={foodItem.id}
                                        foodItem={foodItem}
                                        index={foodIndex}
                                        isActive={activeFoodKey === foodKey}
                                        onUpdateGrams={(grams) => updateFoodItemGrams(meal.id, option.id, foodItem.id, grams)}
                                        onDelete={() => deleteFoodItem(meal.id, option.id, foodItem.id)}
                                        onActivate={() => setActiveFoodKey(foodKey)}
                                      />
                                    );
                                  })
                                ) : (
                                  <div className="w-full flex items-center justify-center p-4">
                                    <p className="text-xs text-stone-400 font-medium">
                                      Prato vazio. Adicione alimentos abaixo.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center gap-2 mb-2 ml-1">
                                <Plus size={10} className="text-stone-400" strokeWidth={3} />
                                <p className="text-[8px] font-black text-stone-400 uppercase tracking-[0.15em]">Adicionar Alimentos</p>
                              </div>

                              <SearchableFoodList 
                                onSelectFood={(foodId) => addFoodItem(meal.id, option.id, foodId)}
                                blockedFoodIds={blockedFoodIds}
                                foodRestrictions={foodRestrictions}
                                autoFocus={activeOptionId === option.id}
                              />

                              <div className="mt-3">
                                <div className="text-[9px] font-black text-stone-400 uppercase tracking-[0.15em] mb-2">
                                  Ou escolha por categoria:
                                </div>
                                <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-200">
                                  {quickFoods.map((cat) => {
                                    // Expansão GLOBAL por categoria (memória entre refeições/opções)
                                    const isExpanded = expandedCategories[cat.category] || false;
                                    
                                    return (
                                      <div key={cat.category} className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                                        <button
                                          onClick={() => setExpandedCategories(prev => ({
                                            ...prev,
                                            [cat.category]: !prev[cat.category]
                                          }))}
                                          className="w-full flex items-center justify-between px-2 py-1.5 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <ChevronRight size={10} className={`text-stone-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                            <span className="text-[9px] font-extrabold text-stone-700 uppercase tracking-wider">{cat.category}</span>
                                          </div>
                                        </button>

                                        {isExpanded && (
                                          <div className="p-2 pt-1.5 border-t border-stone-100 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="flex flex-wrap gap-1 max-h-[150px] overflow-y-auto">
                                              {cat.items.map(foodUI => {
                                                const registryMatch = FOOD_REGISTRY.find(f => f.id === foodUI.id);
                                                
                                                if (!registryMatch) return null;

                                                const isBlocked = blockedFoodIds.has(registryMatch.id);
                                                const restrictionInfo = getRestrictionInfo(registryMatch.id, foodRestrictions);
                                                
                                                let btnClass = "px-2 py-1 bg-white border border-stone-200 rounded-lg text-[9px] font-bold text-stone-500 hover:border-stone-800 hover:text-stone-800 transition-all active:scale-95 shadow-sm";
                                                let tooltipText = "Adicionar ao Prato";
                                                
                                                if (isBlocked) {
                                                  if (restrictionInfo?.type === 'allergy') {
                                                    btnClass = "px-2 py-1 bg-red-50 border border-red-300 rounded-lg text-[9px] font-bold text-red-600 line-through cursor-not-allowed opacity-80";
                                                    tooltipText = "PROIBIDO - Alergia grave";
                                                  } else if (restrictionInfo?.type === 'intolerance') {
                                                    btnClass = "px-2 py-1 bg-amber-50 border border-amber-300 rounded-lg text-[9px] font-bold text-amber-700 line-through cursor-not-allowed opacity-80";
                                                    tooltipText = "CUIDADO - Intolerância alimentar";
                                                  } else {
                                                    btnClass = "px-2 py-1 bg-blue-50 border border-blue-300 rounded-lg text-[9px] font-bold text-blue-700 line-through cursor-not-allowed opacity-80";
                                                    tooltipText = "EVITAR - Restrição alimentar";
                                                  }
                                                }

                                                return (
                                                  <button
                                                    key={registryMatch.id}
                                                    onClick={() => addFoodItem(meal.id, option.id, registryMatch.id)}
                                                    disabled={isBlocked}
                                                    title={tooltipText}
                                                    className={btnClass}
                                                  >
                                                    {foodUI.label}
                                                    {isBlocked && restrictionInfo?.type === 'allergy' && <Ban size={8} className="inline ml-0.5 text-red-500 -mt-0.5" />}
                                                    {isBlocked && restrictionInfo?.type === 'intolerance' && <AlertTriangle size={8} className="inline ml-0.5 text-amber-500 -mt-0.5" />}
                                                    {isBlocked && restrictionInfo?.type === 'restriction' && <ClipboardList size={8} className="inline ml-0.5 text-blue-500 -mt-0.5" />}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button 
                            onClick={() => addOption(meal.id)} 
                            className={cn(ui.buttonSecondary, ui.buttonSecondaryNutri, 'font-black uppercase tracking-widest')}
                          >
                            <Plus size={12} strokeWidth={2.5} /> Adicionar Variação para {activeDay}
                          </button>

                          {meal.options.length === 1 && meal.options[0].day === "Segunda-feira" && (
                            <button 
                              onClick={() => splitIntoFullWeek(meal.id)} 
                              className={cn(ui.buttonSecondary, ui.buttonSecondaryNeutral, 'font-black uppercase tracking-widest')}
                            >
                              <CalendarRange size={12} strokeWidth={2.5} /> Copiar para Semana Inteira
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex justify-center">
                         <button 
                           onClick={() => setExpandedMealId(null)}
                           className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500 hover:text-stone-800 bg-white px-4 py-2 rounded-full border border-stone-200 shadow-sm transition-all active:scale-95"
                         >
                           <ChevronUp size={12} strokeWidth={3} /> {hasContentForDay ? "Pronto, Fechar Aba" : "Fechar Aba"}
                         </button>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}

            <button 
              onClick={addMeal} 
              className="w-full border-2 border-dashed border-stone-200/80 rounded-2xl py-8 flex flex-col items-center justify-center text-stone-400 hover:border-stone-400 hover:text-stone-800 hover:bg-stone-50/50 transition-all group mt-2 active:scale-[0.98]"
            >
              <div className="bg-white p-2 rounded-xl shadow-sm mb-2 group-hover:scale-110 group-hover:bg-stone-800 group-hover:text-white transition-all duration-300 border border-stone-100 group-hover:border-stone-800">
                <Plus size={18} strokeWidth={2.5} />
              </div>
              <span className="font-black uppercase tracking-[0.15em] text-[9px]">Adicionar Refeição</span>
            </button>
          </div>
        </div>

        <div className="border-t border-stone-100 bg-white/95 p-3 sm:p-4 shrink-0">
          <div className="flex flex-row items-center gap-2">
            <button 
              onClick={handleRequestClose} 
              className="px-4 sm:px-5 py-2.5 font-bold text-stone-500 hover:text-stone-800 bg-stone-50 hover:bg-stone-100 rounded-xl transition-all active:scale-[0.98] shrink-0 text-xs sm:text-sm"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSaveDraft} 
              disabled={isSaving} 
              className={cn(
                ui.buttonSecondary,
                ui.buttonSecondaryNeutral,
                'flex-1 h-11 rounded-xl font-bold text-xs sm:text-sm disabled:opacity-60'
              )}
              title="Salva o progresso sem liberar para o paciente"
            >
              {isSaving ? (
                <><Loader2 size={16} strokeWidth={2.5} className="animate-spin shrink-0"/> <span className="truncate">Salvando...</span></>
              ) : (
                <><Save size={16} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Salvar rascunho</span></>
              )}
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className={cn(
                ui.buttonPrimarySuccess,
                'flex-1 h-11 rounded-xl font-bold text-xs sm:text-sm disabled:opacity-60'
              )}
              title="Salva e libera o cardápio para o paciente"
            >
              {isSaving ? (
                <><Loader2 size={16} strokeWidth={2.5} className="animate-spin shrink-0"/> <span className="truncate">Salvando...</span></>
              ) : saved ? (
                <><CheckCircle2 size={16} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Salvo!</span></>
              ) : (
                <><CheckCircle2 size={16} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Liberar Cardápio</span></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

