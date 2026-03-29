'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Save, Utensils, Check, 
  ChevronDown, ChevronUp, 
  Copy, CheckCircle2, AlertCircle, CalendarRange, Loader2,
  Beef, Wheat, Droplet, Target, X
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
// COMPONENTE DE SELETOR DE HORÁRIO COMPACTO
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
      <div className="flex flex-wrap gap-1.5">
        {/* Botões de horário sugerido */}
        {suggestedTimes.slice(0, 4).map(time => (
          <button
            key={time}
            onClick={() => {
              onChange(time);
              setShowCustomInput(false);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              value === time && !showCustomInput
                ? 'bg-nutri-800 text-white shadow-md'
                : 'bg-stone-100 text-stone-600 hover:bg-nutri-100 hover:text-nutri-800'
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
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !hasSuggested && value && !showCustomInput
                ? 'bg-nutri-800 text-white shadow-md'
                : 'bg-stone-100 text-stone-600 hover:bg-nutri-100 hover:text-nutri-800'
            }`}
          >
            {!hasSuggested && value ? value : 'Outro'}
          </button>
        )}
      </div>
      
      {/* Input para horário personalizado */}
      {showCustomInput && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="HH:MM"
            value={customTime || (value && !hasSuggested ? value : '')}
            onChange={(e) => setCustomTime(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCustomTimeSubmit()}
            className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 font-medium text-stone-700 outline-none focus:border-nutri-800 focus:ring-2 focus:ring-nutri-800/10 bg-white text-sm"
            autoFocus
          />
          <button
            onClick={handleCustomTimeSubmit}
            className="px-3 py-1.5 bg-nutri-800 text-white rounded-lg text-xs font-bold hover:bg-nutri-700 transition-colors"
          >
            OK
          </button>
          <button
            onClick={() => {
              setShowCustomInput(false);
              setCustomTime('');
            }}
            className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
      
      {/* Indicador se o horário é válido para múltiplos dias */}
      {!showCustomInput && value && (
        <p className="text-[9px] text-stone-400 ml-1 flex items-center gap-1">
          <CalendarRange size={10} /> Horário: {value}
        </p>
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
      { name: "Frango desfiado (3 colheres)", kcal: 105, macros: { c: 0, p: 20, g: 2 } },
      { name: "Carne moída magra (100g)", kcal: 133, macros: { c: 0, p: 21, g: 5 } },
      { name: "Filé de peixe (100g)", kcal: 110, macros: { c: 0, p: 20, g: 2 } },
      { name: "Whey Protein (1 scoop 30g)", kcal: 120, macros: { c: 3, p: 24, g: 1.5 } },
      { name: "Leite Integral (1 copo 200ml)", kcal: 120, macros: { c: 10, p: 6, g: 6 } },
      { name: "Leite Desnatado (1 copo 200ml)", kcal: 70, macros: { c: 10, p: 6, g: 0 } },
      { name: "Iogurte Natural (1 pote 170g)", kcal: 70, macros: { c: 9, p: 7, g: 0 } },
      { name: "Queijo branco/Minas (1 fatia 30g)", kcal: 66, macros: { c: 1, p: 5, g: 4 } },
      { name: "Queijo Mussarela (2 fatias 30g)", kcal: 96, macros: { c: 1, p: 7, g: 7 } }
    ] 
  },
  { 
    category: "Carboidratos", 
    items:[
      { name: "Arroz branco cozido (100g)", kcal: 130, macros: { c: 28, p: 2.5, g: 0.2 } },
      { name: "Arroz integral cozido (100g)", kcal: 112, macros: { c: 24, p: 2.5, g: 1 } },
      { name: "Mandioca/Macaxeira cozida (100g)", kcal: 125, macros: { c: 30, p: 1, g: 0 } },
      { name: "Tapioca (3 colheres sopa 50g)", kcal: 120, macros: { c: 30, p: 0, g: 0 } },
      { name: "Pão francês (1 un)", kcal: 135, macros: { c: 28, p: 4, g: 0 } },
      { name: "Pão de forma int. (2 fatias)", kcal: 115, macros: { c: 20, p: 5, g: 1.5 } },
      { name: "Batata doce cozida (100g)", kcal: 86, macros: { c: 20, p: 1, g: 0.1 } },
      { name: "Batata inglesa cozida (150g)", kcal: 110, macros: { c: 26, p: 2, g: 0.1 } },
      { name: "Aveia em flocos (30g)", kcal: 118, macros: { c: 17, p: 4.5, g: 2.5 } },
      { name: "Granola s/ açúcar (3 colheres)", kcal: 140, macros: { c: 20, p: 4, g: 5 } },
      { name: "Macarrão cozido (100g)", kcal: 157, macros: { c: 31, p: 5, g: 1 } },
      { name: "Cuscuz de milho (100g)", kcal: 120, macros: { c: 25, p: 2, g: 1 } }
    ] 
  },
  { 
    category: "Leguminosas", 
    items:[
      { name: "Feijão caldo (1 concha)", kcal: 106, macros: { c: 14, p: 7, g: 0.5 } },
      { name: "Feijão em grãos (1 escumadeira)", kcal: 140, macros: { c: 20, p: 9, g: 1 } },
      { name: "Lentilha (1 escumadeira)", kcal: 115, macros: { c: 20, p: 9, g: 0.5 } },
      { name: "Grão de bico (3 colheres)", kcal: 130, macros: { c: 22, p: 7, g: 2 } },
      { name: "Ervilha fresca (3 colheres)", kcal: 70, macros: { c: 10, p: 5, g: 0.5 } }
    ] 
  },
  { 
    category: "Vegetais e Saladas", 
    items:[
      { name: "Salada de Folhas (à vontade)", kcal: 15, macros: { c: 2, p: 1, g: 0 } },
      { name: "Tomate e Pepino (1 porção)", kcal: 25, macros: { c: 5, p: 1, g: 0 } },
      { name: "Brócolis cozido (3 ramos)", kcal: 25, macros: { c: 4, p: 2, g: 0 } },
      { name: "Cenoura ralada (2 colheres)", kcal: 20, macros: { c: 4, p: 0.5, g: 0 } },
      { name: "Abóbora cozida (100g)", kcal: 40, macros: { c: 9, p: 1, g: 0 } },
      { name: "Abobrinha/Chuchu (1 pires)", kcal: 30, macros: { c: 6, p: 1, g: 0 } },
      { name: "Beterraba (2 fatias)", kcal: 35, macros: { c: 8, p: 1, g: 0 } }
    ] 
  },
  { 
    category: "Frutas", 
    items:[
      { name: "Banana prata (1 un média)", kcal: 90, macros: { c: 23, p: 1, g: 0 } },
      { name: "Maçã (1 un média)", kcal: 70, macros: { c: 15, p: 0.3, g: 0 } },
      { name: "Laranja (1 un média)", kcal: 60, macros: { c: 15, p: 1, g: 0 } },
      { name: "Melancia (1 fatia grande 200g)", kcal: 60, macros: { c: 14, p: 1, g: 0 } },
      { name: "Mamão (1 fatia média)", kcal: 45, macros: { c: 11, p: 0.5, g: 0 } },
      { name: "Uva sem semente (1 cacho peq.)", kcal: 70, macros: { c: 17, p: 0.5, g: 0 } },
      { name: "Abacaxi (1 fatia grossa)", kcal: 50, macros: { c: 13, p: 0.5, g: 0 } },
      { name: "Morangos (10 un)", kcal: 32, macros: { c: 7, p: 0.6, g: 0.3 } },
      { name: "Abacate (2 colheres sopa)", kcal: 110, macros: { c: 5, p: 1, g: 10 } }
    ] 
  },
  { 
    category: "Gorduras/Extras", 
    items:[
      { name: "Azeite de oliva (1 col. sopa)", kcal: 108, macros: { c: 0, p: 0, g: 12 } },
      { name: "Pasta de amendoim (1 col. sopa)", kcal: 90, macros: { c: 3, p: 4, g: 8 } },
      { name: "Manteiga (1 colher chá 10g)", kcal: 70, macros: { c: 0, p: 0, g: 8 } },
      { name: "Requeijão light (1 col. sopa)", kcal: 50, macros: { c: 1, p: 3, g: 4 } },
      { name: "Castanhas (Mix 30g)", kcal: 170, macros: { c: 9, p: 4, g: 15 } },
      { name: "Chia/Linhaça (1 col. sopa)", kcal: 55, macros: { c: 4, p: 2, g: 4 } },
      { name: "Chocolate 70% Cacau (2 quadradinhos)", kcal: 120, macros: { c: 9, p: 2, g: 9 } },
      { name: "Café s/ açúcar (1 xícara)", kcal: 0, macros: { c: 0, p: 0, g: 0 } }
    ] 
  }
];

const MEAL_TYPES =[
  "Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", 
  "Jantar", "Ceia", "Pré-treino", "Pós-treino", "Refeição Livre"
];

// Horários sugeridos por tipo de refeição
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
  if (!target) return { statusText: "Sem Meta", statusColorClass: "text-stone-400", barColorClass: "bg-stone-300" };
  
  const ratio = current / target;
  let statusColorClass = "text-emerald-600";
  let barColorClass = "bg-emerald-500";
  let statusText = "Na Meta ✓";

  if (ratio < 0.90) {
    statusColorClass = "text-amber-600";
    barColorClass = "bg-amber-400";
    statusText = `Falta ${Math.round(target - current)}${isKcal ? '' : 'g'}`;
  } else if (ratio > 1.10) {
    statusColorClass = "text-rose-600";
    barColorClass = "bg-rose-500";
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
  // FUNÇÕES DE MIGRAÇÃO (para compatibilidade com dados antigos)
  // =========================================================================
  const migrateExistingOption = (option: any): Option => {
    if (option.foodItems && Array.isArray(option.foodItems)) {
      return option;
    }
    
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
        id: option.id,
        day: option.day || "Todos os dias",
        foodItems,
        kcal: option.kcal || 0,
        macros: option.macros || { p: 0, c: 0, g: 0 }
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
  // ADICIONAR ALIMENTO
  // =========================================================================
  const addFoodItem = (mealId: string, optId: string, food: QuickFoodItem) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id === optId) {
            const newFoodItem: FoodItem = {
              id: `food-${Date.now()}-${Math.random()}`,
              name: food.name,
              kcal: food.kcal,
              macros: { ...food.macros }
            };
            
            const updatedFoodItems = [...(o.foodItems || []), newFoodItem];
            
            const newKcal = updatedFoodItems.reduce((sum, item) => sum + item.kcal, 0);
            const newMacros = updatedFoodItems.reduce((acc, item) => ({
              p: acc.p + item.macros.p,
              c: acc.c + item.macros.c,
              g: acc.g + item.macros.g
            }), { p: 0, c: 0, g: 0 });
            
            return {
              ...o,
              foodItems: updatedFoodItems,
              kcal: newKcal,
              macros: newMacros
            };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  // =========================================================================
  // REMOVER ALIMENTO
  // =========================================================================
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
            
            return {
              ...o,
              foodItems: updatedFoodItems,
              kcal: newKcal,
              macros: newMacros
            };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  // =========================================================================
  // MANIPULAÇÃO DE ESTADO
  // =========================================================================
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
      options: [{ 
        id: `opt-${Date.now()}`, 
        day: 'Todos os dias', 
        foodItems: [],
        kcal: 0, 
        macros: { p: 0, c: 0, g: 0 } 
      }] 
    };
    setMeals([...meals, newMeal]);
    setExpandedMealId(newMeal.id); 
  };

  const removeMeal = (mealId: string) => {
    setMeals(meals.filter(m => m.id !== mealId));
    if (expandedMealId === mealId) setExpandedMealId(null);
  };

  const updateMealTime = (mealId: string, time: string) => {
    setMeals(meals.map(m => m.id === mealId ? { ...m, time } : m));
  };

  const updateMealName = (mealId: string, name: string) => {
    setMeals(meals.map(m => m.id === mealId ? { ...m, name } : m));
  };

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
          options: [...m.options, { 
            id: `opt-${Date.now()}`, 
            day: nextDay, 
            foodItems: [],
            kcal: 0, 
            macros: { p: 0, c: 0, g: 0 } 
          }] 
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
          id: `opt-${Date.now()}-${idx}`,
          day: day,
          foodItems: [...baseOption.foodItems],
          kcal: baseOption.kcal,
          macros: { ...baseOption.macros }
        }));
        return { ...m, options: newOptions };
      }
      return m;
    }));
    toast.success("Dias separados com sucesso! O horário permanece o mesmo para todos os dias.");
  };

  const duplicateToEmptyDays = (mealId: string, sourceOption: Option) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id !== sourceOption.id && o.foodItems.length === 0) {
            return { 
              ...o, 
              foodItems: [...sourceOption.foodItems],
              kcal: sourceOption.kcal, 
              macros: { ...sourceOption.macros } 
            };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
    toast.success('Prato copiado para os dias em branco com sucesso!');
  };

  const removeOption = (mealId: string, optionId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) return { ...m, options: m.options.filter(o => o.id !== optionId) };
      return m;
    }));
  };

  const updateOptionDay = (mealId: string, optionId: string, day: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => o.id === optionId ? { ...o, day } : o);
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

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

  const updateKcal = (mealId: string, optionId: string, kcal: number) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => o.id === optionId ? { ...o, kcal } : o);
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  // =========================================================================
  // INIT
  // =========================================================================
  useEffect(() => {
    async function fetchExistingDiet() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('meal_plan').eq('id', patientId).single();
        
        if (error) throw error;

        if (data?.meal_plan && Array.isArray(data.meal_plan) && data.meal_plan.length > 0) {
          const formattedPlan: Meal[] = data.meal_plan.map((m: any) => ({
            id: m.id || `meal-${Date.now()}`,
            time: m.time || "",
            name: m.name || "Refeição",
            options: m.options.map((o: any) => migrateExistingOption({
              ...o,
              day: o.day || "Todos os dias",
              kcal: o.kcal || 0,
              macros: o.macros || { p: 0, c: 0, g: 0 } 
            }))
          }));
          setMeals(formattedPlan);
          if (formattedPlan.length > 0) setExpandedMealId(formattedPlan[0].id);
        } else {
          const newMealId = `meal-${Date.now()}`;
          setMeals([{ 
            id: newMealId, 
            time: "08:00", 
            name: 'Café da Manhã', 
            options: [{ 
              id: `opt-${Date.now()}`, 
              day: 'Todos os dias', 
              foodItems: [],
              kcal: 0, 
              macros: { p: 0, c: 0, g: 0 } 
            }] 
          }]);
          setExpandedMealId(newMealId);
        }
      } catch (error) {
        console.error("Erro ao buscar dieta:", error);
        toast.error("Falha ao carregar o cardápio existente.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchExistingDiet();
  }, [patientId, supabase]);

  // Guard clause
  if (!targetRecommendation) {
    return (
      <div className="bg-white p-10 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-nutri-800 mb-4" size={48} />
        <p className="text-stone-500 font-medium">Aguardando recomendação de metas...</p>
      </div>
    );
  }

  const kcalTarget = targetRecommendation.calories;
  const proteinTarget = targetRecommendation.macros.protein;
  const carbsTarget = targetRecommendation.macros.carbs;
  const fatTarget = targetRecommendation.macros.fat;

  // Cálculos LIVE (HUD)
  const liveTotals = meals.reduce((acc, meal) => {
    const relevantOption = meal.options[0];
    if (!relevantOption) return acc;
    return {
      kcal: acc.kcal + (relevantOption.kcal || 0),
      p: acc.p + (relevantOption.macros?.p || 0),
      c: acc.c + (relevantOption.macros?.c || 0),
      g: acc.g + (relevantOption.macros?.g || 0),
    };
  }, { kcal: 0, p: 0, c: 0, g: 0 });

  const isMealComplete = (meal: Meal) => {
    if (meal.options.length === 0) return false;
    return meal.time !== '' && meal.options.some(opt => opt.foodItems.length > 0);
  };

  const kcalStatus = getMetricFeedback(liveTotals.kcal, kcalTarget, true);
  const pStatus = getMetricFeedback(liveTotals.p, proteinTarget);
  const cStatus = getMetricFeedback(liveTotals.c, carbsTarget);
  const gStatus = getMetricFeedback(liveTotals.g, fatTarget);

  if (isLoading) return (
    <div className="bg-white p-10 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-nutri-800 mb-4" size={48} />
      <p className="text-stone-500 font-medium">Carregando o cardápio existente...</p>
    </div>
  );

  const handleSave = async () => {
    setIsSaving(true);
    setExpandedMealId(null);
    
    const cleanedMeals = meals.map(m => ({
      ...m,
      options: m.options.filter(o => o.foodItems.length > 0)
    })).filter(m => m.options.length > 0);
    
    if (cleanedMeals.length === 0) {
      toast.warning("Não há nenhuma refeição preenchida para salvar.");
      setIsSaving(false);
      return;
    }
    
    try {
      const { error } = await supabase.from('profiles').update({ meal_plan: cleanedMeals, status: 'plano_liberado' }).eq('id', patientId);
      if (error) throw error;
      setSaved(true);
      toast.success("Cardápio salvo e liberado para o paciente!");
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar cardápio. Verifique sua conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-stone-100 flex flex-col max-h-[90vh]">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-stone-100 pb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900 flex items-center gap-2">
            <Utensils className="text-nutri-800" /> Montar Cardápio
          </h2>
          <p className="text-stone-500 text-sm font-medium mt-1">Paciente: <b className="text-nutri-900 font-black">{patientName}</b></p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={onClose} className="px-6 py-3 font-bold text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-xl transition-all">Sair</button>
          <button 
            onClick={handleSave} 
            disabled={isSaving} 
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all duration-300 ${saved ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-nutri-900 shadow-lg shadow-nutri-900/20 hover:bg-nutri-800 active:scale-95'}`}
          >
            {isSaving ? <><Loader2 size={18} className="animate-spin"/> Salvando...</> : saved ? <><CheckCircle2 size={18}/> Salvo!</> : <><Save size={18}/> Salvar Dieta</>}
          </button>
        </div>
      </div>

      {/* HUD DE MACROS */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-stone-500 mb-1">
             <Target size={14} />
             <p className="text-[10px] font-black uppercase tracking-widest">Kcal Totais</p>
          </div>
          <p className="text-lg font-black text-stone-800">
            {Math.round(liveTotals.kcal)} <span className="text-xs text-stone-400 font-bold opacity-60">/ {kcalTarget}</span>
          </p>
          <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${kcalStatus.statusColorClass}`}>{kcalStatus.statusText}</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-200">
            <div className={`h-full transition-all duration-500 ${kcalStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.kcal / kcalTarget) * 100, 100)}%` }} />
          </div>
        </div>

        <div className="bg-red-50/50 border border-red-100 rounded-2xl p-3 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-red-500 mb-1">
             <Beef size={14} />
             <p className="text-[10px] font-black uppercase tracking-widest">Proteína</p>
          </div>
          <p className="text-lg font-black text-red-700">
            {Math.round(liveTotals.p)}g <span className="text-xs text-red-400 font-bold opacity-70">/ {proteinTarget}g</span>
          </p>
          <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${pStatus.statusColorClass}`}>{pStatus.statusText}</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-red-200">
            <div className={`h-full transition-all duration-500 ${pStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.p / proteinTarget) * 100, 100)}%` }} />
          </div>
        </div>

        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-amber-500 mb-1">
             <Wheat size={14} />
             <p className="text-[10px] font-black uppercase tracking-widest">Carbo</p>
          </div>
          <p className="text-lg font-black text-amber-700">
            {Math.round(liveTotals.c)}g <span className="text-xs text-amber-400 font-bold opacity-70">/ {carbsTarget}g</span>
          </p>
          <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${cStatus.statusColorClass}`}>{cStatus.statusText}</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-200">
            <div className={`h-full transition-all duration-500 ${cStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.c / carbsTarget) * 100, 100)}%` }} />
          </div>
        </div>

        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-blue-500 mb-1">
             <Droplet size={14} />
             <p className="text-[10px] font-black uppercase tracking-widest">Gordura</p>
          </div>
          <p className="text-lg font-black text-blue-700">
            {Math.round(liveTotals.g)}g <span className="text-xs text-blue-400 font-bold opacity-70">/ {fatTarget}g</span>
          </p>
          <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${gStatus.statusColorClass}`}>{gStatus.statusText}</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-200">
            <div className={`h-full transition-all duration-500 ${gStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.g / fatTarget) * 100, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* ÁREA DE ROLAGEM: LISTA DE REFEIÇÕES */}
      <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-4 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent">
        {meals.map((meal) => {
          const isExpanded = expandedMealId === meal.id;
          const isComplete = isMealComplete(meal);

          return (
            <div 
              key={meal.id} 
              className={`rounded-[2rem] border transition-all duration-300 relative group animate-fade-in-up overflow-hidden ${
                isExpanded 
                  ? 'bg-stone-50 border-nutri-200 ring-4 ring-nutri-800/5 shadow-md' 
                  : isComplete 
                    ? 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50' 
                    : 'bg-white border-stone-200 hover:border-nutri-200 hover:bg-stone-50'
              }`}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); removeMeal(meal.id); }} 
                title="Excluir Refeição Completa"
                className="absolute top-5 right-5 bg-white border border-stone-100 p-2.5 rounded-full shadow-sm text-stone-300 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 opacity-0 group-hover:opacity-100 transition-all z-10 active:scale-90"
              >
                <Trash2 size={16} />
              </button>

              <div 
                onClick={() => setExpandedMealId(isExpanded ? null : meal.id)}
                className="p-6 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3.5 rounded-2xl shadow-sm transition-colors ${isComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-white border border-stone-100 text-stone-300 group-hover:text-nutri-500'}`}>
                    {isComplete ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {/* Novo TimeSelector compacto */}
                      <TimeSelector
                        value={meal.time}
                        onChange={(time) => updateMealTime(meal.id, time)}
                        mealType={meal.name}
                        className="inline-block"
                      />
                      {meal.options[0]?.kcal > 0 && !isExpanded && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                           <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100/50">~{meal.options[0]?.kcal} kcal</span>
                           <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">P: {Math.round(meal.options[0]?.macros?.p || 0)}g</span>
                           <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">C: {Math.round(meal.options[0]?.macros?.c || 0)}g</span>
                           <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">G: {Math.round(meal.options[0]?.macros?.g || 0)}g</span>
                        </div>
                      )}
                    </div>
                    <h3 className={`text-xl font-extrabold tracking-tight ${isComplete && !isExpanded ? 'text-emerald-900' : 'text-stone-900'}`}>
                      {meal.name}
                    </h3>
                  </div>
                </div>
                
                <div className={`pr-12 transition-transform duration-300 ${isExpanded ? 'text-nutri-800' : 'text-stone-300'}`}>
                  {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 pb-6 pt-4 border-t border-stone-200/50 bg-stone-50">
                  
                  {/* HORÁRIO - EM VERSÃO MAIS COMPACTA QUANDO EXPANDIDO */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    {/* Horário - versão expandida mais detalhada */}
                    <div className="flex-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 block ml-1">
                        Horário
                      </label>
                      <TimeSelector
                        value={meal.time}
                        onChange={(time) => updateMealTime(meal.id, time)}
                        mealType={meal.name}
                      />
                    </div>

                    {/* NOME DA REFEIÇÃO */}
                    <div className="flex-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 block ml-1">
                        Nome da Refeição
                      </label>
                      <select 
                        value={meal.name}
                        onChange={(e) => updateMealName(meal.id, e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 font-extrabold text-stone-700 outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 bg-white appearance-none shadow-sm transition-all cursor-pointer text-sm"
                      >
                        {MEAL_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {meal.options.map((option) => (
                      <div key={option.id} className="bg-white p-5 rounded-[1.5rem] border border-stone-200 shadow-sm relative transition-all">
                        
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
                          
                          <select 
                            value={option.day}
                            onChange={(e) => updateOptionDay(meal.id, option.id, e.target.value)}
                            className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider outline-none transition-all cursor-pointer shadow-sm ${
                              option.day === 'Todos os dias' ? 'bg-stone-800 text-white border-stone-800 hover:bg-stone-700' : 'bg-nutri-50 text-nutri-800 border-nutri-200 hover:bg-nutri-100'
                            }`}
                          >
                            {ALL_DAYS.map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>

                          <div className="flex flex-wrap items-center gap-2">
                            {meal.options.length > 1 && option.foodItems.length > 0 && (
                              <button 
                                onClick={() => duplicateToEmptyDays(meal.id, option)} 
                                title="Copiar este prato para os dias em branco"
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors active:scale-95"
                              >
                                <Copy size={14} /> Replicar
                              </button>
                            )}
                            
                            <div className="flex items-center gap-1 bg-stone-50 p-1 rounded-xl border border-stone-200">
                               <div className="flex flex-col items-center px-2 py-1 bg-red-50 rounded-lg text-red-600">
                                  <span className="text-[8px] font-black uppercase mb-0.5">P (g)</span>
                                  <input type="number" value={Math.round(option.macros?.p || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'p', Number(e.target.value))} className="w-8 bg-transparent text-xs font-bold text-center outline-none" />
                               </div>
                               <div className="flex flex-col items-center px-2 py-1 bg-amber-50 rounded-lg text-amber-600">
                                  <span className="text-[8px] font-black uppercase mb-0.5">C (g)</span>
                                  <input type="number" value={Math.round(option.macros?.c || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'c', Number(e.target.value))} className="w-8 bg-transparent text-xs font-bold text-center outline-none" />
                               </div>
                               <div className="flex flex-col items-center px-2 py-1 bg-blue-50 rounded-lg text-blue-600">
                                  <span className="text-[8px] font-black uppercase mb-0.5">G (g)</span>
                                  <input type="number" value={Math.round(option.macros?.g || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'g', Number(e.target.value))} className="w-8 bg-transparent text-xs font-bold text-center outline-none" />
                               </div>
                               <div className="flex flex-col items-center px-3 py-1 bg-stone-800 rounded-lg text-white ml-1">
                                  <span className="text-[8px] font-black uppercase text-stone-300 mb-0.5">Kcal</span>
                                  <input type="number" value={Math.round(option.kcal || 0)} onChange={(e) => updateKcal(meal.id, option.id, Number(e.target.value))} className="w-10 bg-transparent text-xs font-bold text-center outline-none" />
                               </div>
                            </div>

                            {meal.options.length > 1 && (
                              <button 
                                onClick={() => removeOption(meal.id, option.id)} 
                                className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors p-2.5 bg-white rounded-xl border border-stone-200 active:scale-90 shadow-sm"
                                title="Remover este dia"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* LISTA DE ALIMENTOS COM BOTÃO DE REMOVER INDIVIDUAL */}
                        <div className="mb-5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 block ml-1">
                            Alimentos
                          </label>
                          <div className="flex flex-wrap gap-2 min-h-[48px] p-2 bg-stone-50 rounded-xl border border-stone-200">
                            {option.foodItems && option.foodItems.length > 0 ? (
                              option.foodItems.map((foodItem) => (
                                <div 
                                  key={foodItem.id}
                                  className="group/food flex items-center gap-2 bg-white border border-stone-200 rounded-full px-3 py-1.5 shadow-sm hover:shadow-md transition-all"
                                >
                                  <span className="text-sm font-medium text-stone-700">
                                    {foodItem.name}
                                  </span>
                                  <button
                                    onClick={() => removeFoodItem(meal.id, option.id, foodItem.id)}
                                    className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-full p-0.5 transition-all opacity-0 group-hover/food:opacity-100"
                                    title="Remover este alimento"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-stone-400 italic ml-1">Nenhum alimento adicionado. Clique nos botões abaixo para adicionar.</p>
                            )}
                          </div>
                        </div>

                        {/* ADICIONAR ALIMENTO RÁPIDO */}
                        <div className="pt-2">
                          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 ml-1">Adicionar Alimento</p>
                          <div className="flex flex-wrap gap-4 max-h-48 overflow-y-auto">
                            {quickFoods.map((cat) => (
                              <div key={cat.category} className="flex flex-col gap-2 w-full sm:w-auto">
                                 <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest bg-stone-100 px-2 py-1 rounded w-max">{cat.category}</span>
                                 <div className="flex flex-wrap gap-1.5">
                                   {cat.items.map(food => (
                                     <button
                                       key={food.name}
                                       onClick={() => addFoodItem(meal.id, option.id, food)}
                                       className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold text-stone-600 hover:border-nutri-400 hover:bg-nutri-50 hover:text-nutri-800 transition-all active:scale-90 flex items-center gap-1.5 shadow-sm"
                                       title={`${food.kcal} kcal | P:${food.macros.p}g C:${food.macros.c}g G:${food.macros.g}g`}
                                     >
                                       <Plus size={10} strokeWidth={3} /> {food.name}
                                     </button>
                                   ))}
                                 </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex flex-wrap gap-3 pt-4">
                      {!meal.options.some(opt => opt.day === "Todos os dias") && meal.options.length < 7 && (
                        <button 
                          onClick={() => addOption(meal.id)} 
                          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-600 bg-white shadow-sm border border-stone-200 hover:border-nutri-400 hover:text-nutri-800 px-5 py-3 rounded-xl transition-all active:scale-95 hover:-translate-y-0.5"
                        >
                          <Plus size={16} /> Adicionar outro dia
                        </button>
                      )}

                      {meal.options.length === 1 && meal.options[0].day === "Todos os dias" && (
                        <button 
                          onClick={() => splitIntoFullWeek(meal.id)} 
                          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-nutri-800 bg-nutri-50 border border-nutri-200 hover:bg-nutri-100 px-5 py-3 rounded-xl transition-all active:scale-95 hover:-translate-y-0.5 shadow-sm"
                        >
                          <CalendarRange size={16} /> Separar Seg a Dom
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex justify-center border-t border-stone-200 pt-6">
                     <button 
                       onClick={() => setExpandedMealId(null)}
                       className="flex items-center gap-2 text-sm font-bold text-stone-400 hover:text-stone-800 bg-white px-6 py-2.5 rounded-full border border-stone-200 shadow-sm transition-all active:scale-95"
                     >
                       <Check size={16} /> {isComplete ? "Refeição Completa - Fechar Aba" : "Fechar Aba"}
                     </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button 
          onClick={addMeal} 
          className="w-full border-2 border-dashed border-stone-300 rounded-[2rem] py-10 flex flex-col items-center justify-center text-stone-400 hover:border-nutri-400 hover:text-nutri-800 hover:bg-nutri-50 transition-all group mt-6 active:scale-[0.98]"
        >
          <div className="bg-white p-3.5 rounded-full shadow-md mb-3 group-hover:scale-110 group-hover:bg-nutri-800 group-hover:text-white transition-all duration-300">
            <Plus size={24} />
          </div>
          <span className="font-black uppercase tracking-[0.15em] text-xs">Adicionar Próxima Refeição</span>
        </button>
      </div>
    </div>
  );
}