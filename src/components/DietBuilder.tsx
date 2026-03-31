'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Save, Utensils, Check, 
  ChevronDown, ChevronUp, 
  Copy, CheckCircle2, AlertCircle, CalendarRange, Loader2,
  Beef, Wheat, Droplet, Target, X, Clock, ChevronRight
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

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
}

interface FoodItem {
  id: string;
  name: string;
  kcal: number;
  macros: {
    p: number;
    c: number;
    g: number;
  };
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
// COMPONENTE DE SELETOR DE HORÁRIO COMPACTO PREMIUM
// =========================================================================

interface TimeSelectorProps {
  value: string;
  onChange: (time: string) => void;
  mealType: string;
  className?: string;
}

function TimeSelector({ value, onChange, mealType, className = '' }: TimeSelectorProps) {
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
        {/* Botões de horário sugerido */}
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
        
        {/* Botão para horário personalizado */}
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
      
      {/* Input para horário personalizado */}
      {showCustomInput && (
        <div className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2">
          <div className="relative">
            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="HH:MM"
              value={customTime || (value && !hasSuggested ? value : '')}
              onChange={(e) => setCustomTime(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCustomTimeSubmit()}
              className="w-24 pl-8 pr-3 py-2 rounded-xl border border-stone-200 font-bold text-stone-800 outline-none focus:border-nutri-500 focus:ring-4 focus:ring-nutri-500/10 bg-white text-sm transition-all"
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

// =========================================================================
// BANCO DE ALIMENTOS E CONSTANTES
// =========================================================================

interface QuickFoodItem {
  name: string;
  kcal: number;
  macros: {
    c: number;
    p: number;
    g: number;
  };
}

interface QuickFoodCategory {
  category: string;
  items: QuickFoodItem[];
}

const quickFoods: QuickFoodCategory[] =[
  { 
    category: "Proteínas e Laticínios", 
    items:[
      { name: "Ovo mexido (2 un)", kcal: 156, macros: { c: 1, p: 12, g: 11 } },
      { name: "Ovo cozido (2 un)", kcal: 140, macros: { c: 1, p: 12, g: 10 } },
      { name: "Frango grelhado (100g)", kcal: 165, macros: { c: 0, p: 31, g: 3 } },
      { name: "Frango desfiado (3 col)", kcal: 105, macros: { c: 0, p: 20, g: 2 } },
      { name: "Carne moída magra (100g)", kcal: 133, macros: { c: 0, p: 21, g: 5 } },
      { name: "Filé de peixe (100g)", kcal: 110, macros: { c: 0, p: 20, g: 2 } },
      { name: "Whey Protein (1 scp 30g)", kcal: 120, macros: { c: 3, p: 24, g: 1.5 } },
      { name: "Leite Int. (1 copo 200ml)", kcal: 120, macros: { c: 10, p: 6, g: 6 } },
      { name: "Leite Desn. (1 copo 200ml)", kcal: 70, macros: { c: 10, p: 6, g: 0 } },
      { name: "Iogurte Nat. (1 pote 170g)", kcal: 70, macros: { c: 9, p: 7, g: 0 } },
      { name: "Queijo Minas (1 fatia 30g)", kcal: 66, macros: { c: 1, p: 5, g: 4 } },
      { name: "Mussarela (2 fatias 30g)", kcal: 96, macros: { c: 1, p: 7, g: 7 } }
    ] 
  },
  { 
    category: "Carboidratos", 
    items:[
      { name: "Arroz branco coz. (100g)", kcal: 130, macros: { c: 28, p: 2.5, g: 0.2 } },
      { name: "Arroz integral coz. (100g)", kcal: 112, macros: { c: 24, p: 2.5, g: 1 } },
      { name: "Mandioca cozida (100g)", kcal: 125, macros: { c: 30, p: 1, g: 0 } },
      { name: "Tapioca (3 col sopa 50g)", kcal: 120, macros: { c: 30, p: 0, g: 0 } },
      { name: "Pão francês (1 un)", kcal: 135, macros: { c: 28, p: 4, g: 0 } },
      { name: "Pão forma int. (2 fatias)", kcal: 115, macros: { c: 20, p: 5, g: 1.5 } },
      { name: "Batata doce coz. (100g)", kcal: 86, macros: { c: 20, p: 1, g: 0.1 } },
      { name: "Batata inglesa coz. (150g)", kcal: 110, macros: { c: 26, p: 2, g: 0.1 } },
      { name: "Aveia em flocos (30g)", kcal: 118, macros: { c: 17, p: 4.5, g: 2.5 } },
      { name: "Granola s/ açúc. (3 col)", kcal: 140, macros: { c: 20, p: 4, g: 5 } },
      { name: "Macarrão cozido (100g)", kcal: 157, macros: { c: 31, p: 5, g: 1 } },
      { name: "Cuscuz de milho (100g)", kcal: 120, macros: { c: 25, p: 2, g: 1 } }
    ] 
  },
  { 
    category: "Leguminosas", 
    items:[
      { name: "Feijão caldo (1 concha)", kcal: 106, macros: { c: 14, p: 7, g: 0.5 } },
      { name: "Feijão grãos (1 escumad.)", kcal: 140, macros: { c: 20, p: 9, g: 1 } },
      { name: "Lentilha (1 escumadeira)", kcal: 115, macros: { c: 20, p: 9, g: 0.5 } },
      { name: "Grão de bico (3 col)", kcal: 130, macros: { c: 22, p: 7, g: 2 } },
      { name: "Ervilha fresca (3 col)", kcal: 70, macros: { c: 10, p: 5, g: 0.5 } }
    ] 
  },
  { 
    category: "Vegetais e Frutas", 
    items:[
      { name: "Salada de Folhas (à vont.)", kcal: 15, macros: { c: 2, p: 1, g: 0 } },
      { name: "Tomate/Pepino (1 porção)", kcal: 25, macros: { c: 5, p: 1, g: 0 } },
      { name: "Brócolis coz. (3 ramos)", kcal: 25, macros: { c: 4, p: 2, g: 0 } },
      { name: "Banana prata (1 un)", kcal: 90, macros: { c: 23, p: 1, g: 0 } },
      { name: "Maçã (1 un média)", kcal: 70, macros: { c: 15, p: 0.3, g: 0 } },
      { name: "Mamão (1 fatia média)", kcal: 45, macros: { c: 11, p: 0.5, g: 0 } },
      { name: "Morangos (10 un)", kcal: 32, macros: { c: 7, p: 0.6, g: 0.3 } },
      { name: "Abacate (2 col sopa)", kcal: 110, macros: { c: 5, p: 1, g: 10 } }
    ] 
  },
  { 
    category: "Gorduras/Extras", 
    items:[
      { name: "Azeite oliva (1 col. sopa)", kcal: 108, macros: { c: 0, p: 0, g: 12 } },
      { name: "Pasta amendoim (1 col. sp)", kcal: 90, macros: { c: 3, p: 4, g: 8 } },
      { name: "Manteiga (1 col chá 10g)", kcal: 70, macros: { c: 0, p: 0, g: 8 } },
      { name: "Requeijão light (1 col. sp)", kcal: 50, macros: { c: 1, p: 3, g: 4 } },
      { name: "Castanhas (Mix 30g)", kcal: 170, macros: { c: 9, p: 4, g: 15 } },
      { name: "Chia/Linhaça (1 col. sp)", kcal: 55, macros: { c: 4, p: 2, g: 4 } },
      { name: "Café s/ açúcar (1 xícara)", kcal: 0, macros: { c: 0, p: 0, g: 0 } }
    ] 
  }
];

const MEAL_TYPES =[
  "Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", 
  "Jantar", "Ceia", "Pré-treino", "Pós-treino", "Refeição Livre"
];

const MEAL_TIMES: Record<string, string[]> = {
  "Café da Manhã": ["07:00", "07:30", "08:00", "08:30"],
  "Lanche da Manhã": ["09:30", "10:00", "10:30"],
  "Almoço": ["11:30", "12:00", "12:30", "13:00"],
  "Lanche da Tarde": ["15:00", "15:30", "16:00"],
  "Jantar": ["18:30", "19:00", "19:30", "20:00"],
  "Ceia": ["21:00", "21:30", "22:00"],
  "Pré-treino": ["Antes do treino", "06:00", "07:00", "16:00"],
  "Pós-treino": ["Após o treino", "08:00", "09:00", "18:00"],
  "Refeição Livre": ["Quando desejar", "12:00", "19:00"]
};

const SINGLE_DAYS =["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const GROUP_DAYS = ["Todos os dias", "Segunda a Sexta", "Finais de Semana"];
const ALL_DAYS = [...GROUP_DAYS, ...SINGLE_DAYS];

// =========================================================================
// FUNÇÕES DE FEEDBACK VISUAL (HUD)
// =========================================================================
const getMetricFeedback = (current: number, target: number, isKcal = false) => {
  if (!target) return { statusText: "Sem Meta", statusColorClass: "text-stone-400", barColorClass: "bg-stone-200" };
  
  const ratio = current / target;
  let statusColorClass = "text-emerald-500";
  let barColorClass = "bg-gradient-to-r from-emerald-400 to-emerald-500";
  let statusText = "Na Meta ✓";

  if (ratio < 0.90) {
    statusColorClass = "text-amber-500";
    barColorClass = "bg-gradient-to-r from-amber-300 to-amber-400";
    statusText = `Falta ${Math.round(target - current)}${isKcal ? '' : 'g'}`;
  } else if (ratio > 1.10) {
    statusColorClass = "text-rose-500";
    barColorClass = "bg-gradient-to-r from-rose-400 to-rose-500";
    statusText = `Passou ${Math.round(current - target)}${isKcal ? '' : 'g'}`;
  }

  return { statusText, statusColorClass, barColorClass };
};

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function DietBuilder({ patientId, patientName, targetRecommendation, onClose }: DietBuilderProps) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);

  const supabase = createClient();

  // =========================================================================
  // FUNÇÕES DE MIGRAÇÃO
  // =========================================================================
  const migrateExistingOption = (option: any): Option => {
    if (option.foodItems && Array.isArray(option.foodItems)) return option;
    
    if (option.description && typeof option.description === 'string') {
      const lines = option.description.split('\n').filter((line: string) => line.trim().startsWith('- ') || line.trim().startsWith('+ '));
      const foodItems: FoodItem[] = lines.map((line: string, idx: number) => ({
        id: `food-${Date.now()}-${idx}-${Math.random()}`,
        name: line.replace(/^[-+]\s*/, '').trim(),
        kcal: 0,
        macros: { p: 0, c: 0, g: 0 }
      }));
      
      if (foodItems.length === 0 && option.description.trim()) {
        foodItems.push({
          id: `food-${Date.now()}-${Math.random()}`,
          name: option.description,
          kcal: option.kcal || 0,
          macros: option.macros || { p: 0, c: 0, g: 0 }
        });
      }
      return {
        id: option.id, day: option.day || "Todos os dias", foodItems,
        kcal: option.kcal || 0, macros: option.macros || { p: 0, c: 0, g: 0 }
      };
    }
    return {
      id: option.id, day: option.day || "Todos os dias", foodItems: [],
      kcal: option.kcal || 0, macros: option.macros || { p: 0, c: 0, g: 0 }
    };
  };

  // =========================================================================
  // MANIPULAÇÃO DE DADOS
  // =========================================================================
  const addFoodItem = (mealId: string, optId: string, food: QuickFoodItem) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id === optId) {
            const newFoodItem: FoodItem = {
              id: `food-${Date.now()}-${Math.random()}`,
              name: food.name, kcal: food.kcal, macros: { ...food.macros }
            };
            const updatedFoodItems = [...(o.foodItems || []), newFoodItem];
            const newKcal = updatedFoodItems.reduce((sum, item) => sum + item.kcal, 0);
            const newMacros = updatedFoodItems.reduce((acc, item) => ({
              p: acc.p + item.macros.p, c: acc.c + item.macros.c, g: acc.g + item.macros.g
            }), { p: 0, c: 0, g: 0 });
            return { ...o, foodItems: updatedFoodItems, kcal: newKcal, macros: newMacros };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  const removeFoodItem = (mealId: string, optId: string, foodItemId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id === optId) {
            const itemToRemove = o.foodItems?.find(item => item.id === foodItemId);
            if (!itemToRemove) return o;
            const updatedFoodItems = o.foodItems.filter(item => item.id !== foodItemId);
            const newKcal = Math.max(0, (o.kcal || 0) - itemToRemove.kcal);
            const newMacros = {
              p: Math.max(0, (o.macros?.p || 0) - itemToRemove.macros.p),
              c: Math.max(0, (o.macros?.c || 0) - itemToRemove.macros.c),
              g: Math.max(0, (o.macros?.g || 0) - itemToRemove.macros.g)
            };
            return { ...o, foodItems: updatedFoodItems, kcal: newKcal, macros: newMacros };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
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
    setMeals([...meals, newMeal]);
    setExpandedMealId(newMeal.id); 
  };

  const removeMeal = (mealId: string) => {
    setMeals(meals.filter(m => m.id !== mealId));
    if (expandedMealId === mealId) setExpandedMealId(null);
  };

  const updateMealTime = (mealId: string, time: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, time } : m));
  const updateMealName = (mealId: string, name: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, name } : m));

  const addOption = (mealId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const lastOptionDay = m.options[m.options.length - 1].day;
        let nextDay = "Terça-feira"; 
        if (lastOptionDay === "Segunda a Sexta") nextDay = "Finais de Semana";
        else {
          const dayIndex = SINGLE_DAYS.indexOf(lastOptionDay);
          if (dayIndex >= 0 && dayIndex < SINGLE_DAYS.length - 1) nextDay = SINGLE_DAYS[dayIndex + 1]; 
          else nextDay = "Segunda-feira"; 
        }
        return { 
          ...m, 
          options: [...m.options, { id: `opt-${Date.now()}`, day: nextDay, foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }] 
        };
      }
      return m;
    }));
  };

  const splitIntoFullWeek = (mealId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId && m.options.length > 0) {
        const baseOption = m.options[0];
        const newOptions = SINGLE_DAYS.map((day, idx) => ({
          id: `opt-${Date.now()}-${idx}`, day: day, foodItems: [...baseOption.foodItems],
          kcal: baseOption.kcal, macros: { ...baseOption.macros }
        }));
        return { ...m, options: newOptions };
      }
      return m;
    }));
    toast.success("Dias separados com sucesso!");
  };

  const duplicateToEmptyDays = (mealId: string, sourceOption: Option) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id !== sourceOption.id && o.foodItems.length === 0) {
            return { ...o, foodItems: [...sourceOption.foodItems], kcal: sourceOption.kcal, macros: { ...sourceOption.macros } };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
    toast.success('Prato copiado!');
  };

  const removeOption = (mealId: string, optionId: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, options: m.options.filter(o => o.id !== optionId) } : m));
  const updateOptionDay = (mealId: string, optionId: string, day: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, options: m.options.map(o => o.id === optionId ? { ...o, day } : o) } : m));

  const updateMacro = (mealId: string, optionId: string, macro: 'p' | 'c' | 'g', value: number) => {
    setMeals(meals.map(m => {
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

  const updateKcal = (mealId: string, optionId: string, kcal: number) => setMeals(meals.map(m => m.id === mealId ? { ...m, options: m.options.map(o => o.id === optionId ? { ...o, kcal } : o) } : m));

  // =========================================================================
  // INIT & LOAD
  // =========================================================================
  useEffect(() => {
    async function fetchExistingDiet() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('meal_plan').eq('id', patientId).single();
        if (error) throw error;

        if (data?.meal_plan && Array.isArray(data.meal_plan) && data.meal_plan.length > 0) {
          const formattedPlan: Meal[] = data.meal_plan.map((m: any) => ({
            id: m.id || `meal-${Date.now()}`, time: m.time || "", name: m.name || "Refeição",
            options: m.options.map((o: any) => migrateExistingOption({ ...o, day: o.day || "Todos os dias", kcal: o.kcal || 0, macros: o.macros || { p: 0, c: 0, g: 0 } }))
          }));
          setMeals(formattedPlan);
          if (formattedPlan.length > 0) setExpandedMealId(formattedPlan[0].id);
        } else {
          const newMealId = `meal-${Date.now()}`;
          setMeals([{ 
            id: newMealId, time: "08:00", name: 'Café da Manhã', 
            options: [{ id: `opt-${Date.now()}`, day: 'Todos os dias', foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }] 
          }]);
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

  const liveTotals = meals.reduce((acc, meal) => {
    const relevantOption = meal.options[0];
    if (!relevantOption) return acc;
    return {
      kcal: acc.kcal + (relevantOption.kcal || 0), p: acc.p + (relevantOption.macros?.p || 0),
      c: acc.c + (relevantOption.macros?.c || 0), g: acc.g + (relevantOption.macros?.g || 0),
    };
  }, { kcal: 0, p: 0, c: 0, g: 0 });

  const isMealComplete = (meal: Meal) => meal.options.length > 0 && meal.time !== '' && meal.options.some(opt => opt.foodItems.length > 0);

  const kcalStatus = getMetricFeedback(liveTotals.kcal, kcalTarget, true);
  const pStatus = getMetricFeedback(liveTotals.p, proteinTarget);
  const cStatus = getMetricFeedback(liveTotals.c, carbsTarget);
  const gStatus = getMetricFeedback(liveTotals.g, fatTarget);

  const handleSave = async () => {
    setIsSaving(true);
    setExpandedMealId(null);
    const cleanedMeals = meals.map(m => ({ ...m, options: m.options.filter(o => o.foodItems.length > 0) })).filter(m => m.options.length > 0);
    
    if (cleanedMeals.length === 0) {
      toast.warning("Não há nenhuma refeição preenchida para salvar.");
      setIsSaving(false); return;
    }
    
    try {
      const { error } = await supabase.from('profiles').update({ meal_plan: cleanedMeals, status: 'plano_liberado' }).eq('id', patientId);
      if (error) throw error;
      setSaved(true);
      toast.success("Cardápio salvo e liberado para o paciente!");
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (error) {
      toast.error("Erro ao salvar cardápio. Verifique sua conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-stone-900/60 backdrop-blur-sm sm:p-4 transition-all duration-300">
      
      {/* CONTAINER PRINCIPAL */}
      <div className="bg-[#fcfcfc] w-full max-w-4xl h-full sm:h-[95vh] mt-auto sm:mt-0 rounded-t-[2rem] sm:rounded-[2.5rem] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-8 sm:zoom-in-95 overflow-hidden relative">
        
        {/* HEADER (Sticky) */}
        <div className="bg-white px-5 sm:px-8 pt-5 pb-4 border-b border-stone-100 shrink-0 z-20 flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <div>
            <div className="w-12 h-1.5 bg-stone-200 rounded-full mb-4 sm:hidden mx-auto" />
            <div className="flex items-center gap-3">
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/60 text-stone-800 hidden sm:block">
                <Utensils size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight leading-none mb-1">
                  Montar Cardápio
                </h2>
                <p className="text-xs text-stone-500 font-medium">Paciente: <b className="text-stone-800">{patientName}</b></p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-stone-50 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-all active:scale-95">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* HUD DE MACROS HORIZONTAL (Mobile-First Premium) */}
        <div className="bg-white border-b border-stone-100 shrink-0 z-10 relative shadow-sm">
          {/* Sombra interna para indicar scroll lateral no mobile */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden z-10" />
          
          <div className="flex overflow-x-auto scrollbar-hide snap-x gap-3 px-5 sm:px-8 py-4 md:grid md:grid-cols-4">
            
            {/* KCAL */}
            <div className="min-w-[140px] flex-1 bg-stone-50/80 border border-stone-200/60 rounded-2xl p-3.5 flex flex-col snap-center shadow-inner relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-stone-500 mb-1">
                 <Target size={14} strokeWidth={2.5} />
                 <p className="text-[9px] font-black uppercase tracking-widest">Kcal</p>
              </div>
              <p className="text-xl font-black text-stone-800 tracking-tight leading-none mb-1">
                {Math.round(liveTotals.kcal)} <span className="text-xs text-stone-400 font-bold opacity-60">/ {kcalTarget}</span>
              </p>
              <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${kcalStatus.statusColorClass}`}>{kcalStatus.statusText}</p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-200/50">
                <div className={`h-full transition-all duration-1000 ease-out ${kcalStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.kcal / kcalTarget) * 100, 100)}%` }} />
              </div>
            </div>

            {/* PROTEINA */}
            <div className="min-w-[140px] flex-1 bg-stone-50/80 border border-stone-200/60 rounded-2xl p-3.5 flex flex-col snap-center shadow-inner relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-red-500 mb-1">
                 <Beef size={14} strokeWidth={2.5} />
                 <p className="text-[9px] font-black uppercase tracking-widest">Proteína</p>
              </div>
              <p className="text-xl font-black text-stone-800 tracking-tight leading-none mb-1">
                {Math.round(liveTotals.p)}g <span className="text-xs text-stone-400 font-bold opacity-60">/ {proteinTarget}g</span>
              </p>
              <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${pStatus.statusColorClass}`}>{pStatus.statusText}</p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-200/50">
                <div className={`h-full transition-all duration-1000 ease-out ${pStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.p / proteinTarget) * 100, 100)}%` }} />
              </div>
            </div>

            {/* CARBO */}
            <div className="min-w-[140px] flex-1 bg-stone-50/80 border border-stone-200/60 rounded-2xl p-3.5 flex flex-col snap-center shadow-inner relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                 <Wheat size={14} strokeWidth={2.5} />
                 <p className="text-[9px] font-black uppercase tracking-widest">Carbo</p>
              </div>
              <p className="text-xl font-black text-stone-800 tracking-tight leading-none mb-1">
                {Math.round(liveTotals.c)}g <span className="text-xs text-stone-400 font-bold opacity-60">/ {carbsTarget}g</span>
              </p>
              <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${cStatus.statusColorClass}`}>{cStatus.statusText}</p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-200/50">
                <div className={`h-full transition-all duration-1000 ease-out ${cStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.c / carbsTarget) * 100, 100)}%` }} />
              </div>
            </div>

            {/* GORDURA */}
            <div className="min-w-[140px] flex-1 bg-stone-50/80 border border-stone-200/60 rounded-2xl p-3.5 flex flex-col snap-center shadow-inner relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-blue-500 mb-1">
                 <Droplet size={14} strokeWidth={2.5} />
                 <p className="text-[9px] font-black uppercase tracking-widest">Gordura</p>
              </div>
              <p className="text-xl font-black text-stone-800 tracking-tight leading-none mb-1">
                {Math.round(liveTotals.g)}g <span className="text-xs text-stone-400 font-bold opacity-60">/ {fatTarget}g</span>
              </p>
              <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${gStatus.statusColorClass}`}>{gStatus.statusText}</p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-200/50">
                <div className={`h-full transition-all duration-1000 ease-out ${gStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.g / fatTarget) * 100, 100)}%` }} />
              </div>
            </div>

          </div>
        </div>

        {/* ÁREA DE ROLAGEM: LISTA DE REFEIÇÕES */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 scrollbar-thin scrollbar-thumb-stone-200 pb-28">
          {meals.map((meal) => {
            const isExpanded = expandedMealId === meal.id;
            const isComplete = isMealComplete(meal);

            return (
              <div 
                key={meal.id} 
                className={`rounded-[2rem] transition-all duration-300 relative group overflow-hidden ${
                  isExpanded 
                    ? 'bg-white border-2 border-stone-800 shadow-[0_20px_40px_rgba(0,0,0,0.06)] scale-[1.01]' 
                    : isComplete 
                      ? 'bg-emerald-50/50 border border-emerald-100 hover:border-emerald-300 cursor-pointer shadow-sm' 
                      : 'bg-white border border-stone-200 hover:border-stone-300 cursor-pointer shadow-sm'
                }`}
              >
                {/* Botão Flutuante de Excluir Refeição (Visível no Hover) */}
                <button 
                  onClick={(e) => { e.stopPropagation(); removeMeal(meal.id); }} 
                  title="Excluir Refeição"
                  className="absolute top-4 right-4 bg-white border border-stone-200 p-2.5 rounded-full shadow-sm text-stone-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-all z-20 active:scale-90"
                >
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>

                {/* CARD RETRAÍDO (RESUMO) */}
                <div 
                  onClick={() => setExpandedMealId(isExpanded ? null : meal.id)}
                  className={`p-5 sm:p-6 flex items-center justify-between relative z-10 ${isExpanded ? 'border-b border-stone-100 bg-stone-50/50' : ''}`}
                >
                  <div className="flex items-center gap-4 w-full pr-12">
                    <div className={`p-3.5 rounded-2xl shrink-0 transition-colors shadow-sm border ${
                      isComplete 
                        ? 'bg-emerald-100 border-emerald-200 text-emerald-600' 
                        : isExpanded 
                          ? 'bg-stone-800 border-stone-800 text-white'
                          : 'bg-stone-50 border-stone-200 text-stone-400'
                    }`}>
                      {isComplete ? <CheckCircle2 size={22} strokeWidth={2.5} /> : <Clock size={22} strokeWidth={2.5} />}
                    </div>
                    
                    <div className="w-full">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {!isExpanded && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 bg-stone-100 px-2.5 py-1 rounded-md">
                            {meal.time || '--:--'}
                          </span>
                        )}
                        {meal.options[0]?.kcal > 0 && !isExpanded && (
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider hidden sm:flex">
                             <span className="text-stone-500 bg-stone-100 px-2 py-1 rounded-md">{meal.options[0]?.kcal} kcal</span>
                             <span className="text-red-500 bg-red-50 px-2 py-1 rounded-md">P {Math.round(meal.options[0]?.macros?.p || 0)}g</span>
                             <span className="text-amber-500 bg-amber-50 px-2 py-1 rounded-md">C {Math.round(meal.options[0]?.macros?.c || 0)}g</span>
                             <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded-md">G {Math.round(meal.options[0]?.macros?.g || 0)}g</span>
                          </div>
                        )}
                      </div>
                      <h3 className={`text-lg sm:text-xl font-extrabold tracking-tight ${isComplete && !isExpanded ? 'text-emerald-900' : 'text-stone-900'}`}>
                        {meal.name}
                      </h3>
                    </div>
                  </div>
                  
                  <div className={`shrink-0 transition-transform duration-300 bg-white shadow-sm border border-stone-100 rounded-full p-1.5 ${isExpanded ? 'text-stone-800 rotate-180' : 'text-stone-400'}`}>
                    <ChevronDown size={20} strokeWidth={2.5} />
                  </div>
                </div>

                {/* CARD EXPANDIDO (CONTEÚDO) */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 bg-stone-50/50 animate-in fade-in slide-in-from-top-4 duration-300">
                    
                    {/* LINHA 1: NOME E HORÁRIO */}
                    <div className="flex flex-col sm:flex-row gap-5 mb-8 bg-white p-5 rounded-[1.5rem] border border-stone-200 shadow-sm">
                      <div className="flex-1">
                        <label className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400 mb-2 block ml-1">
                          Refeição
                        </label>
                        <div className="relative">
                          <select 
                            value={meal.name}
                            onChange={(e) => updateMealName(meal.id, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 font-extrabold text-stone-800 outline-none focus:border-stone-800 focus:ring-4 focus:ring-stone-800/10 bg-stone-50 appearance-none transition-all cursor-pointer text-sm"
                          >
                            {MEAL_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="flex-[2]">
                        <label className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400 mb-2 block ml-1">
                          Horário Previsto
                        </label>
                        <TimeSelector
                          value={meal.time}
                          onChange={(time) => updateMealTime(meal.id, time)}
                          mealType={meal.name}
                        />
                      </div>
                    </div>

                    {/* OPÇÕES (DIAS) */}
                    <div className="space-y-6">
                      {meal.options.map((option, idx) => (
                        <div key={option.id} className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-stone-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative transition-all">
                          
                          {/* Dia Header */}
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-5 border-b border-stone-100">
                            
                            <div className="relative inline-block w-full sm:w-auto">
                              <select 
                                value={option.day}
                                onChange={(e) => updateOptionDay(meal.id, option.id, e.target.value)}
                                className={`w-full sm:w-auto pl-4 pr-10 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-[0.15em] outline-none transition-all cursor-pointer shadow-sm appearance-none ${
                                  option.day === 'Todos os dias' 
                                    ? 'bg-stone-900 text-white border-stone-900' 
                                    : 'bg-stone-100 text-stone-700 border-stone-200'
                                }`}
                              >
                                {ALL_DAYS.map(day => (
                                  <option key={day} value={day}>{day}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${option.day === 'Todos os dias' ? 'text-white/50' : 'text-stone-400'}`} />
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              
                              {/* BARRA DE MACROS UNIFICADA PREMIUM */}
                              <div className="flex items-center bg-stone-50 rounded-xl border border-stone-200 p-1 shadow-inner overflow-hidden">
                                 <div className="flex items-center pl-3 pr-2 py-1 border-r border-stone-200/60 group focus-within:bg-red-50 transition-colors">
                                    <span className="text-[9px] font-black uppercase text-stone-400 mr-2">P</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.p || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'p', Number(e.target.value))} className="w-8 bg-transparent text-sm font-bold text-red-600 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                 </div>
                                 <div className="flex items-center px-2 py-1 border-r border-stone-200/60 group focus-within:bg-amber-50 transition-colors">
                                    <span className="text-[9px] font-black uppercase text-stone-400 mr-2">C</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.c || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'c', Number(e.target.value))} className="w-8 bg-transparent text-sm font-bold text-amber-600 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                 </div>
                                 <div className="flex items-center px-2 py-1 group focus-within:bg-blue-50 transition-colors">
                                    <span className="text-[9px] font-black uppercase text-stone-400 mr-2">G</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.g || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'g', Number(e.target.value))} className="w-8 bg-transparent text-sm font-bold text-blue-600 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                 </div>
                                 <div className="flex items-center pl-2 pr-1 py-1 bg-stone-800 rounded-lg shadow-sm ml-1">
                                    <input type="number" inputMode="decimal" value={Math.round(option.kcal || 0)} onChange={(e) => updateKcal(meal.id, option.id, Number(e.target.value))} className="w-10 bg-transparent text-sm font-black text-white outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <span className="text-[8px] font-black uppercase text-stone-400 ml-1">Kcal</span>
                                 </div>
                              </div>

                              {meal.options.length > 1 && option.foodItems.length > 0 && (
                                <button 
                                  onClick={() => duplicateToEmptyDays(meal.id, option)} 
                                  title="Copiar para dias vazios"
                                  className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors active:scale-95"
                                >
                                  <Copy size={16} strokeWidth={2.5} />
                                </button>
                              )}

                              {meal.options.length > 1 && (
                                <button 
                                  onClick={() => removeOption(meal.id, option.id)} 
                                  className="p-2.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors rounded-xl border border-stone-200 active:scale-95"
                                  title="Remover dia"
                                >
                                  <Trash2 size={16} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* ALIMENTOS SELECIONADOS */}
                          <div className="mb-6">
                            <label className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400 mb-2.5 block ml-1">
                              Prato Montado
                            </label>
                            <div className="flex flex-wrap gap-2 min-h-[56px] p-2 sm:p-3 bg-stone-50/80 rounded-2xl border border-stone-200 border-dashed">
                              {option.foodItems && option.foodItems.length > 0 ? (
                                option.foodItems.map((foodItem) => (
                                  <div 
                                    key={foodItem.id}
                                    className="group/food flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl pl-3 pr-1 py-1.5 shadow-sm hover:border-stone-300 transition-all animate-in zoom-in-95 duration-200"
                                  >
                                    <span className="text-sm font-bold text-stone-700">
                                      {foodItem.name}
                                    </span>
                                    <button
                                      onClick={() => removeFoodItem(meal.id, option.id, foodItem.id)}
                                      className="text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-1 transition-all"
                                    >
                                      <X size={14} strokeWidth={3} />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div className="w-full flex items-center justify-center p-2">
                                  <p className="text-xs text-stone-400 font-medium">Prato vazio. Adicione alimentos abaixo.</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* LISTA DE ALIMENTOS RÁPIDOS */}
                          <div>
                            <div className="flex items-center gap-2 mb-3 ml-1">
                              <Plus size={12} className="text-stone-400" strokeWidth={3} />
                              <p className="text-[9px] font-black text-stone-400 uppercase tracking-[0.15em]">Adição Rápida</p>
                            </div>
                            
                            <div className="space-y-4">
                              {quickFoods.map((cat) => (
                                <div key={cat.category}>
                                   <p className="text-[10px] font-black text-stone-800 mb-2 flex items-center gap-1.5">
                                     <ChevronRight size={12} className="text-stone-300"/> {cat.category}
                                   </p>
                                   <div className="flex flex-wrap gap-1.5">
                                     {cat.items.map(food => (
                                       <button
                                         key={food.name}
                                         onClick={() => addFoodItem(meal.id, option.id, food)}
                                         className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-[11px] font-bold text-stone-500 hover:border-stone-800 hover:text-stone-800 transition-all active:scale-95 shadow-sm"
                                       >
                                         {food.name}
                                       </button>
                                     ))}
                                   </div>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      ))}
                      
                      {/* AÇÕES DE VARIAÇÃO DE DIAS */}
                      <div className="flex flex-wrap gap-3 pt-2">
                        {!meal.options.some(opt => opt.day === "Todos os dias") && meal.options.length < 7 && (
                          <button 
                            onClick={() => addOption(meal.id)} 
                            className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-600 bg-white shadow-sm border border-stone-200 hover:border-stone-800 hover:text-stone-800 px-5 py-3 rounded-xl transition-all active:scale-95"
                          >
                            <Plus size={16} strokeWidth={2.5} /> Adicionar Variação
                          </button>
                        )}

                        {meal.options.length === 1 && meal.options[0].day === "Todos os dias" && (
                          <button 
                            onClick={() => splitIntoFullWeek(meal.id)} 
                            className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-800 bg-stone-100 border border-stone-200 hover:bg-stone-200 px-5 py-3 rounded-xl transition-all active:scale-95 shadow-sm"
                          >
                            <CalendarRange size={16} strokeWidth={2.5} /> Separar Seg a Dom
                          </button>
                        )}
                      </div>
                    </div>

                    {/* FECHAR ABA */}
                    <div className="mt-8 flex justify-center">
                       <button 
                         onClick={() => setExpandedMealId(null)}
                         className="flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-800 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm transition-all active:scale-95"
                       >
                         <ChevronUp size={16} strokeWidth={3} /> {isComplete ? "Pronto, Fechar Aba" : "Fechar Aba"}
                       </button>
                    </div>

                  </div>
                )}
              </div>
            );
          })}

          {/* ADICIONAR NOVA REFEIÇÃO */}
          <button 
            onClick={addMeal} 
            className="w-full border-2 border-dashed border-stone-200/80 rounded-[2rem] py-12 flex flex-col items-center justify-center text-stone-400 hover:border-stone-400 hover:text-stone-800 hover:bg-stone-50/50 transition-all group mt-6 active:scale-[0.98]"
          >
            <div className="bg-white p-3.5 rounded-2xl shadow-sm mb-3 group-hover:scale-110 group-hover:bg-stone-800 group-hover:text-white transition-all duration-300 border border-stone-100 group-hover:border-stone-800">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <span className="font-black uppercase tracking-[0.15em] text-[11px]">Adicionar Refeição</span>
          </button>
        </div>

        {/* FOOTER FIXO (Bottom Sheet Premium) - AGORA EM LINHA NO MOBILE */}
        <div className="absolute bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-stone-100 p-4 sm:p-6 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl mx-auto flex flex-row items-center gap-2.5 sm:gap-3">
            <button 
              onClick={onClose} 
              className="px-5 sm:px-6 py-4 font-bold text-stone-500 hover:text-stone-800 bg-stone-50 hover:bg-stone-100 rounded-2xl transition-all active:scale-[0.98] shrink-0 text-[13px] sm:text-base"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className={`flex-1 flex items-center justify-center gap-2 px-4 sm:px-8 py-4 rounded-2xl font-bold text-white transition-all duration-300 shadow-[0_8px_25px_rgba(0,0,0,0.15)] active:scale-[0.98] text-[13px] sm:text-base truncate ${
                saved 
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' 
                  : 'bg-stone-900 hover:bg-stone-800'
              }`}
            >
              {isSaving ? (
                <><Loader2 size={18} strokeWidth={2.5} className="animate-spin shrink-0"/> <span className="truncate">Salvando...</span></>
              ) : saved ? (
                <><CheckCircle2 size={18} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Salvo!</span></>
              ) : (
                <><Save size={18} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Liberar Cardápio</span></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}