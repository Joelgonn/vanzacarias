'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Trash2, Save, Utensils, Check, 
  ChevronDown, ChevronUp, 
  Copy, CheckCircle2, CheckCircle, AlertCircle, CalendarRange, Loader2,
  Target, X, Clock, ChevronRight, Search,
  ChevronLeft, Calendar
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

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
  suggestAdjustments,
  generateSuggestedMeal 
} from '@/lib/macroEngine';

// ✅ CORREÇÃO: Removido o FoodItem daqui, pois agora vem de patient
import { 
  Suggestion,
  MacroAnalysis,
  MacroTargets
} from '@/types/macroEngine';

import { MacroSuggestions } from '@/components/MacroSuggestions';

// ============================================================================
// 🔥 CONSTANTES DE DIAS (ORDEM CORRETA)
// ============================================================================

const ORDERED_DAYS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo"
];

const GROUP_DAYS = ["Todos os dias", "Segunda a Sexta", "Finais de Semana"];
const ALL_DAYS = [...GROUP_DAYS, ...ORDERED_DAYS];

// ============================================================================
// 🔥 NORMALIZAÇÃO CENTRAL
// ============================================================================

function normalizeGrams(item: any): number {
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
// COMPONENTE DE SELETOR DE HORÁRIO
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

// =========================================================================
// COMPONENTE DE RESTRIÇÕES SIDEBAR
// =========================================================================

interface RestrictionsSidebarProps {
  restrictionsSummary: {
    hasRestrictions: boolean;
    allergies: number;
    intolerances: number;
    restrictions: number;
  };
}

function RestrictionsSidebar({ restrictionsSummary }: RestrictionsSidebarProps) {
  if (!restrictionsSummary?.hasRestrictions) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="text-amber-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">
          Restrições
        </span>
      </div>

      <div className="text-[11px] font-medium text-amber-700 space-y-1.5">
        {restrictionsSummary.allergies > 0 && (
          <div className="flex items-center gap-1.5"><span className="text-[10px]">🚫</span> {restrictionsSummary.allergies} alergia(s)</div>
        )}
        {restrictionsSummary.intolerances > 0 && (
          <div className="flex items-center gap-1.5"><span className="text-[10px]">⚠️</span> {restrictionsSummary.intolerances} intolerância(s)</div>
        )}
        {restrictionsSummary.restrictions > 0 && (
          <div className="flex items-center gap-1.5"><span className="text-[10px]">📋</span> {restrictionsSummary.restrictions} restrição(ões)</div>
        )}
      </div>

      <div className="text-[9px] font-bold text-amber-600 pt-2 border-t border-amber-200/50 leading-relaxed">
        Alimentos bloqueados aparecem com estilo cortado e não podem ser adicionados.
      </div>
    </div>
  );
}

// =========================================================================
// COMPONENTE DE MACROS SIDEBAR
// =========================================================================

interface MacrosSidebarProps {
  totals: { kcal: number; p: number; c: number; g: number };
  targets: { kcal: number; protein: number; carbs: number; fat: number };
  analysis?: MacroAnalysis;
}

function MacrosSidebar({ totals, targets, analysis }: MacrosSidebarProps) {
  const getPercentage = (current: number, target: number) => {
    if (!target) return 0;
    return Math.min((current / target) * 100, 100);
  };
  
  const getBarColor = (type: string) => {
    switch (type) {
      case 'kcal': return 'bg-stone-800';
      case 'p': return 'bg-red-500';
      case 'c': return 'bg-amber-500';
      case 'g': return 'bg-blue-500';
      default: return 'bg-stone-400';
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    switch(status) {
      case 'low': return <span className="text-red-500 text-[8px] font-black ml-1">▼</span>;
      case 'high': return <span className="text-amber-500 text-[8px] font-black ml-1">▲</span>;
      default: return <span className="text-emerald-500 text-[8px] font-black ml-1">✓</span>;
    }
  };
  
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4 shadow-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
        <Target size={14} className="text-stone-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Metas do Dia</span>
      </div>
      
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <div className="flex items-center">
              <span className="font-bold text-stone-700">Kcal</span>
              {analysis && getStatusBadge(analysis.status.kcal)}
            </div>
            <span className="font-mono font-bold text-stone-900">{Math.round(totals.kcal)} / {targets.kcal}</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getBarColor('kcal')} transition-all duration-300`}
              style={{ width: `${getPercentage(totals.kcal, targets.kcal)}%` }}
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <div className="flex items-center">
              <span className="font-bold text-red-600">Proteína</span>
              {analysis && getStatusBadge(analysis.status.protein)}
            </div>
            <span className="font-mono font-bold text-red-600">{Math.round(totals.p)}g / {targets.protein}g</span>
          </div>
          <div className="h-1.5 bg-red-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getBarColor('p')} transition-all duration-300`}
              style={{ width: `${getPercentage(totals.p, targets.protein)}%` }}
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <div className="flex items-center">
              <span className="font-bold text-amber-600">Carboidrato</span>
              {analysis && getStatusBadge(analysis.status.carbs)}
            </div>
            <span className="font-mono font-bold text-amber-600">{Math.round(totals.c)}g / {targets.carbs}g</span>
          </div>
          <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getBarColor('c')} transition-all duration-300`}
              style={{ width: `${getPercentage(totals.c, targets.carbs)}%` }}
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <div className="flex items-center">
              <span className="font-bold text-blue-600">Gordura</span>
              {analysis && getStatusBadge(analysis.status.fat)}
            </div>
            <span className="font-mono font-bold text-blue-600">{Math.round(totals.g)}g / {targets.fat}g</span>
          </div>
          <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getBarColor('g')} transition-all duration-300`}
              style={{ width: `${getPercentage(totals.g, targets.fat)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// COMPONENTE DE FOOD ITEM
// =========================================================================

interface FoodItemCardProps {
  foodItem: FoodItem;
  index: number;
  isActive: boolean;
  onUpdateGrams: (grams: number) => void;
  onDelete: () => void;
  onActivate: () => void;
}

function FoodItemCard({ 
  foodItem, 
  index, 
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

// =========================================================================
// BANCO VISUAL
// =========================================================================

interface QuickFoodConfigItem {
  id: string;
  label: string;
}

interface QuickFoodCategoryConfig {
  category: string;
  items: QuickFoodConfigItem[];
}

const QUICK_FOODS_CONFIG: QuickFoodCategoryConfig[] = [
  { 
    category: "🥩 Proteínas (Carnes e Ovos)", 
    items:[
      { id: "egg_scrambled", label: "Ovo mexido (2 un)" }, 
      { id: "egg_boiled", label: "Ovo cozido (2 un)" }, 
      { id: "egg_poached", label: "Ovo pochê (2 un)" },
      { id: "chicken_breast_grilled", label: "Frango grelhado (100g)" }, 
      { id: "chicken_shredded", label: "Frango desfiado (3 col)" }, 
      { id: "chicken_breast_roasted", label: "Peito de frango assado (100g)" },
      { id: "chicken_thigh_roasted", label: "Sobrecoxa frango assada (100g)" }, 
      { id: "beef_minced_lean", label: "Carne moída magra (100g)" }, 
      { id: "beef_minced_5", label: "Carne moída 5% (100g)" },
      { id: "filet_mignon", label: "Filé mignon grelhado (100g)" }, 
      { id: "striploin", label: "Contra-filé grelhado (100g)" }, 
      { id: "beef_knuckle_minced", label: "Patinho moído (100g)" },
      { id: "rump_steak", label: "Alcatra grelhada (100g)" }, 
      { id: "tri_tip", label: "Maminha assada (100g)" }, 
      { id: "fish_filet", label: "Filé de peixe (100g)" },
      { id: "salmon_grilled", label: "Salmão grelhado (100g)" }, 
      { id: "tuna_solid", label: "Atum sólido (1 lata)" }, 
      { id: "sardine_roasted", label: "Sardinha assada (100g)" },
      { id: "shrimp_grilled", label: "Camarão grelhado (100g)" }, 
      { id: "pork_loin_grilled", label: "Lombo de porco grelhado (100g)" }, 
      { id: "turkey_sliced", label: "Peru fatiado (3 fatias)" },
      { id: "hamburger_homemade", label: "Hambúrguer caseiro (100g)" }
    ] 
  },
  { 
    category: "🥛 Laticínios e Proteínas Vegetais", 
    items:[
      { id: "milk_whole", label: "Leite Integral (1 copo 200ml)" }, 
      { id: "milk_skim", label: "Leite Desnatado (1 copo 200ml)" }, 
      { id: "milk_lactose_free", label: "Leite Sem lactose (1 copo 200ml)" },
      { id: "almond_milk", label: "Leite de amêndoas (200ml)" }, 
      { id: "soy_milk", label: "Leite de soja (200ml)" }, 
      { id: "yogurt_natural", label: "Iogurte Natural (1 pote 170g)" },
      { id: "yogurt_greek", label: "Iogurte Grego (170g)" }, 
      { id: "yogurt_protein", label: "Iogurte Proteico (170g)" }, 
      { id: "kefir", label: "Kefir (200ml)" },
      { id: "cheese_minas", label: "Queijo Minas (1 fatia 30g)" }, 
      { id: "cheese_mozzarella", label: "Queijo Mussarela (2 fatias 30g)" }, 
      { id: "cheese_prato", label: "Queijo Prato (1 fatia 30g)" },
      { id: "cheese_cottage", label: "Queijo Cottage (2 col 50g)" }, 
      { id: "cheese_ricotta", label: "Queijo Ricota (2 col 50g)" }, 
      { id: "cheese_parmesan", label: "Queijo Parmesão (1 col 10g)" },
      { id: "tofu_grilled", label: "Tofu grelhado (100g)" }, 
      { id: "chickpeas_cooked", label: "Grão de bico cozido (3 col)" }, 
      { id: "lentils_cooked", label: "Lentilha cozida (3 col)" },
      { id: "peas_fresh", label: "Ervilha fresca (3 col)" }, 
      { id: "tempeh", label: "Tempeh (100g)" }, 
      { id: "seitan", label: "Seitan (100g)" }
    ] 
  },
  { 
    category: "🍚 Carboidratos (Grãos e Cereais)", 
    items:[
      { id: "rice_white_cooked", label: "Arroz branco cozido (100g)" }, 
      { id: "rice_brown_cooked", label: "Arroz integral cozido (100g)" }, 
      { id: "rice_parboiled", label: "Arroz parboilizado (100g)" },
      { id: "rice_7_grains", label: "Arroz 7 grãos (100g)" }, 
      { id: "pasta_whole", label: "Macarrão integral (100g)" }, 
      { id: "pasta_regular", label: "Macarrão comum (100g)" },
      { id: "pasta_rice", label: "Macarrão de arroz (100g)" }, 
      { id: "quinoa_cooked", label: "Quinoa cozida (100g)" }, 
      { id: "corn_couscous", label: "Cuscuz de milho (100g)" },
      { id: "corn_green", label: "Milho verde (3 col)" }, 
      { id: "oats_flakes", label: "Aveia em flocos (30g)" }, 
      { id: "granola_sugar_free", label: "Granola s/ açúcar (3 col)" },
      { id: "cereal_breakfast", label: "Cereal matinal (30g)" }, 
      { id: "bread_french", label: "Pão francês (1 un)" }, 
      { id: "bread_whole", label: "Pão integral (2 fatias)" },
      { id: "bread_white", label: "Pão de forma branco (2 fatias)" }, 
      { id: "cheese_bread", label: "Pão de queijo (1 un)" }, 
      { id: "tapioca", label: "Tapioca (3 col sopa 50g)" },
      { id: "crepioca", label: "Crepioca (1 un)" }, 
      { id: "pancake_whole", label: "Panqueca integral (1 un)" }
    ] 
  },
  { 
    category: "🥔 Tubérculos e Raízes", 
    items:[
      { id: "sweet_potato_cooked", label: "Batata doce cozida (100g)" }, 
      { id: "potato_cooked", label: "Batata inglesa cozida (150g)" }, 
      { id: "potato_roasted", label: "Batata assada (150g)" },
      { id: "potato_saute", label: "Batata sauté (150g)" }, 
      { id: "potato_mash", label: "Purê de batata (3 col)" }, 
      { id: "cassava_cooked", label: "Mandioca cozida (100g)" },
      { id: "cassava_fried", label: "Mandioca frita (100g)" }, 
      { id: "yam_cooked", label: "Inhame cozido (100g)" }, 
      { id: "cara_cooked", label: "Cará cozido (100g)" },
      { id: "arracacha_cooked", label: "Batata baroa (100g)" }
    ] 
  },
  { 
    category: "🍌 Frutas", 
    items:[
      { id: "banana_prata", label: "Banana prata (1 un)" }, 
      { id: "banana_nanica", label: "Banana nanica (1 un)" }, 
      { id: "banana_maca", label: "Banana maçã (1 un)" },
      { id: "apple", label: "Maçã (1 un média)" }, 
      { id: "apple_green", label: "Maçã verde (1 un)" }, 
      { id: "pear", label: "Pera (1 un)" },
      { id: "papaya", label: "Mamão (1 fatia média)" }, 
      { id: "orange", label: "Laranja (1 un)" }, 
      { id: "tangerine", label: "Mexerica (1 un)" },
      { id: "pineapple", label: "Abacaxi (1 fatia)" }, 
      { id: "watermelon", label: "Melancia (1 fatia)" }, 
      { id: "melon", label: "Melão (1 fatia)" },
      { id: "mango", label: "Manga (1 un pequena)" }, 
      { id: "strawberry", label: "Morango (10 un)" }, 
      { id: "grape", label: "Uva (15 un)" },
      { id: "kiwi", label: "Kiwi (1 un)" }, 
      { id: "avocado", label: "Abacate (2 col sopa)" }, 
      { id: "coconut_fresh", label: "Coco fresco (1 fatia)" },
      { id: "acai", label: "Açaí (100g s/ xarope)" }
    ] 
  },
  { 
    category: "🥬 Verduras e Legumes", 
    items:[
      { id: "salad_leaves", label: "Salada de folhas (à vontade)" }, 
      { id: "lettuce_iceberg", label: "Alface americana (5 folhas)" }, 
      { id: "arugula", label: "Rúcula (1 prato)" },
      { id: "spinach_sauteed", label: "Espinafre refogado (3 col)" }, 
      { id: "kale_sauteed", label: "Couve refogada (3 col)" }, 
      { id: "broccoli_cooked", label: "Brócolis cozido (3 ramos)" },
      { id: "cauliflower_cooked", label: "Couve-flor cozida (3 col)" }, 
      { id: "zucchini_sauteed", label: "Abobrinha refogada (3 col)" }, 
      { id: "eggplant_sauteed", label: "Berinjela refogada (3 col)" },
      { id: "chayote_sauteed", label: "Chuchu refogado (3 col)" }, 
      { id: "carrot_cooked", label: "Cenoura cozida (3 col)" }, 
      { id: "carrot_grated", label: "Cenoura ralada (3 col)" },
      { id: "beet_cooked", label: "Beterraba cozida (3 col)" }, 
      { id: "tomato", label: "Tomate (1 un)" }, 
      { id: "cucumber", label: "Pepino (1/2 un)" },
      { id: "bell_pepper", label: "Pimentão (1/2 un)" }, 
      { id: "green_beans", label: "Vagem cozida (3 col)" }, 
      { id: "asparagus_grilled", label: "Aspargo grelhado (5 un)" },
      { id: "heart_of_palm", label: "Palmito (3 talos)" }, 
      { id: "mushroom_sauteed", label: "Cogumelo refogado (3 col)" }
    ] 
  },
  { 
    category: "🍲 Leguminosas (Feijões e Grãos)", 
    items:[
      { id: "black_beans_broth", label: "Feijão preto caldo (1 concha)" }, 
      { id: "black_beans_grains", label: "Feijão preto grãos (1 escumadeira)" }, 
      { id: "pinto_beans_broth", label: "Feijão carioca caldo (1 concha)" },
      { id: "white_beans", label: "Feijão branco (3 col)" }, 
      { id: "black_eyed_peas", label: "Feijão fradinho (3 col)" }, 
      { id: "lentils_cooked", label: "Lentilha (1 escumadeira)" },
      { id: "chickpeas_cooked", label: "Grão de bico (3 col)" }, 
      { id: "peas_fresh", label: "Ervilha fresca (3 col)" }, 
      { id: "soybeans_cooked", label: "Soja cozida (3 col)" },
      { id: "edamame", label: "Edamame (100g)" }
    ] 
  },
  { 
    category: "🧈 Gorduras e Óleos", 
    items:[
      { id: "olive_oil", label: "Azeite de oliva (1 col sopa)" }, 
      { id: "coconut_oil", label: "Óleo de coco (1 col sopa)" }, 
      { id: "sesame_oil", label: "Óleo de gergelim (1 col sopa)" },
      { id: "butter", label: "Manteiga (1 col chá 10g)" }, 
      { id: "ghee_butter", label: "Manteiga ghee (1 col chá)" }, 
      { id: "peanut_butter", label: "Pasta de amendoim (1 col sopa)" },
      { id: "peanut_butter_whole", label: "Pasta de amendoim integral (1 col)" }, 
      { id: "cashew_butter", label: "Pasta de castanha (1 col sopa)" }, 
      { id: "almond_butter", label: "Pasta de amêndoas (1 col sopa)" },
      { id: "cream_cheese_light", label: "Requeijão light (1 col sopa)" }, 
      { id: "cream_cheese", label: "Requeijão cremoso (1 col sopa)" }, 
      { id: "heavy_cream_light", label: "Creme de leite light (1 col sopa)" },
      { id: "mayonnaise", label: "Maionese (1 col sopa)" }, 
      { id: "mayonnaise_light", label: "Maionese light (1 col sopa)" }
    ] 
  },
  { 
    category: "🥜 Oleaginosas e Sementes", 
    items:[
      { id: "brazil_nut", label: "Castanha do Pará (3 un)" }, 
      { id: "cashew_nut", label: "Castanha de caju (10 un)" }, 
      { id: "almonds", label: "Amêndoas (10 un)" },
      { id: "walnuts", label: "Nozes (3 un)" }, 
      { id: "macadamia", label: "Macadâmia (5 un)" }, 
      { id: "pistachio", label: "Pistache (15 un)" },
      { id: "peanut_roasted", label: "Amendoim torrado (30g)" }, 
      { id: "mixed_nuts", label: "Mix de castanhas (30g)" }, 
      { id: "pumpkin_seed", label: "Semente de abóbora (1 col sopa)" },
      { id: "sunflower_seed", label: "Semente de girassol (1 col sopa)" }, 
      { id: "chia_seed", label: "Chia (1 col sopa)" }, 
      { id: "flaxseed_golden", label: "Linhaça dourada (1 col sopa)" },
      { id: "flaxseed_brown", label: "Linhaça marrom (1 col sopa)" }, 
      { id: "sesame_seed", label: "Gergelim (1 col sopa)" }, 
      { id: "coconut_grated_dry", label: "Coco ralado seco (1 col sopa)" },
      { id: "coconut_grated_fresh", label: "Coco ralado fresco (1 col sopa)" }
    ] 
  },
  { 
    category: "🥤 Bebidas e Suplementos", 
    items:[
      { id: "whey_protein", label: "Whey Protein (1 scoop 30g)" }, 
      { id: "whey_isolate", label: "Whey Isolado (1 scoop)" }, 
      { id: "whey_vegan", label: "Whey Vegano (1 scoop)" },
      { id: "albumin", label: "Albumina (1 scoop)" }, 
      { id: "casein", label: "Caseína (1 scoop)" }, 
      { id: "creatine", label: "Creatina (5g)" },
      { id: "bcaa", label: "BCAA (5g)" }, 
      { id: "glutamine", label: "Glutamina (5g)" }, 
      { id: "coffee_black", label: "Café preto (1 xícara)" },
      { id: "coffee_milk", label: "Café com leite (1 xícara)" }, 
      { id: "coffee_plant_milk", label: "Café com leite vegetal (1 xíc)" }, 
      { id: "green_tea", label: "Chá verde (1 xícara)" },
      { id: "mate_tea", label: "Chá mate (1 xícara)" }, 
      { id: "chamomile_tea", label: "Chá de camomila (1 xícara)" }, 
      { id: "orange_juice", label: "Suco de laranja natural (1 copo)" },
      { id: "lemon_juice", label: "Suco de limão (1 copo)" }, 
      { id: "green_juice", label: "Suco verde (1 copo 300ml)" }, 
      { id: "coconut_water", label: "Água de coco (300ml)" },
      { id: "beer", label: "Cerveja (1 lata 350ml)" }, 
      { id: "wine_red", label: "Vinho tinto (1 taça 150ml)" }, 
      { id: "wine_white", label: "Vinho branco (1 taça 150ml)" },
      { id: "distilled_spirits", label: "Destilados (1 dose 50ml)" }
    ] 
  },
  { 
    category: "🍰 Doces e Extras", 
    items:[
      { id: "honey", label: "Mel (1 col sopa)" }, 
      { id: "demerara_sugar", label: "Açúcar demerara (1 col chá)" }, 
      { id: "coconut_sugar", label: "Açúcar de coco (1 col chá)" },
      { id: "stevia", label: "Stévia (líquido)" }, 
      { id: "xylitol", label: "Xilitol (1 col chá)" }, 
      { id: "erythritol", label: "Eritritol (1 col chá)" },
      { id: "diet_fruit_jelly", label: "Geleia de fruta diet (1 col sopa)" }, 
      { id: "dulce_de_leche", label: "Doce de leite (1 col sopa)" }, 
      { id: "nutella", label: "Nutella (1 col sopa)" },
      { id: "chocolate_70", label: "Chocolate 70% (1 quadrado)" }, 
      { id: "chocolate_white", label: "Chocolate branco (1 quadrado)" }, 
      { id: "brigadeiro", label: "Brigadeiro (1 un)" },
      { id: "beijinho", label: "Beijinho (1 un)" }, 
      { id: "ice_cream_vanilla", label: "Sorvete de creme (1 bola)" }, 
      { id: "ice_cream_diet", label: "Sorvete diet (1 bola)" },
      { id: "fruit_popsicle", label: "Picolé de fruta (1 un)" }, 
      { id: "cake_plain", label: "Bolo simples (1 fatia)" }, 
      { id: "cake_whole", label: "Bolo integral (1 fatia)" },
      { id: "cookie", label: "Cookie (1 un)" }, 
      { id: "brownie", label: "Brownie (1 un)" }, 
      { id: "pancake_sweet", label: "Panqueca doce (1 un)" },
      { id: "waffle", label: "Waffle (1 un)" }
    ] 
  }
];

const quickFoods: QuickFoodCategoryConfig[] = QUICK_FOODS_CONFIG.map(cat => {
  const validItems = cat.items.filter(uiItem => {
    const exists = FOOD_REGISTRY.some(f => f.id === uiItem.id);
    if (!exists) console.warn(`[DietBuilder UI Warning] Alimento não encontrado no Registry: ${uiItem.id}`);
    return exists;
  });
  return { ...cat, items: validItems };
}).filter(cat => cat.items.length > 0);

const flatFoodsList = quickFoods.flatMap(cat => cat.items);

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

// =========================================================================
// COMPONENTE DE BUSCA
// =========================================================================

interface SearchableFoodListProps {
  onSelectFood: (foodId: string) => void;
  blockedFoodIds: Set<string>;
  foodRestrictions: FoodRestriction[];
}

function SearchableFoodList({ onSelectFood, blockedFoodIds, foodRestrictions }: SearchableFoodListProps) {
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
    setHighlightIndex(0);
  }, [searchTerm]);

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
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium outline-none focus:border-stone-800 focus:ring-4 focus:ring-stone-800/10 transition-all"
          autoFocus
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
              
              let restrictionIcon = '';
              
              if (isBlocked) {
                if (restrictionInfo?.type === 'allergy') {
                  restrictionIcon = '🚫';
                } else if (restrictionInfo?.type === 'intolerance') {
                  restrictionIcon = '⚠️';
                } else {
                  restrictionIcon = '📋';
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
                    {restrictionIcon && <span className="text-[10px]">{restrictionIcon}</span>}
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

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function DietBuilder({ patientId, patientName, targetRecommendation, onClose, foodRestrictions = [] }: DietBuilderProps) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [activeTimeMealId, setActiveTimeMealId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [activeFoodKey, setActiveFoodKey] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
  
  function getNextDay(currentDay: string): string {
    const index = ORDERED_DAYS.indexOf(currentDay);
    if (index === -1 || index === ORDERED_DAYS.length - 1) {
      return currentDay;
    }
    return ORDERED_DAYS[index + 1];
  }

  // ============================================================================
  // 🔥 FUNÇÃO: VERIFICA SE DIA ESTÁ COMPLETO
  // ============================================================================
  
  function isDayComplete(day: string): boolean {
    return meals.every(meal => {
      const options = meal.options.filter(opt => 
        opt.day === day || opt.day === "Todos os dias"
      );
      return options.some(opt => opt.foodItems.length > 0);
    });
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
      const nextDay = getNextDay(activeDay);
      
      if (nextDay !== activeDay) {
        setActiveDay(nextDay);
        setAutoAdvancedDays(prev => new Set(prev).add(activeDay));
        toast.success(`✅ Dia ${activeDay} concluído! Avançando para ${nextDay}`);
      } else if (activeDay === "Domingo" && isDayComplete("Domingo")) {
        toast.success("🎉 Semana completa! Todos os dias estão montados.");
      }
    }
  }, [meals, activeDay, autoAdvancedDays]);

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
  
  const migrateExistingOption = (option: any): Option => {
    if (option.foodItems && Array.isArray(option.foodItems)) {
      return {
        ...option,
        foodItems: option.foodItems.map((item: any) => {
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
            name: item.name,
            kcal: item.kcal,
            macros: item.macros,
            grams
          };
        })
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

    setMeals(meals.map(m => {
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

    setMeals(meals.map(m => {
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
    setMeals(meals.map(m => {
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
    setMeals([...meals, newMeal]);
    setExpandedMealId(newMeal.id); 
  };

  const removeMeal = (mealId: string) => {
    setMeals(meals.filter(m => m.id !== mealId));
    if (expandedMealId === mealId) setExpandedMealId(null);
    if (activeTimeMealId === mealId) setActiveTimeMealId(null);
  };

  const updateMealTime = (mealId: string, time: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, time } : m));
  const updateMealName = (mealId: string, name: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, name } : m));

  const addOption = (mealId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        return { 
          ...m, 
          options: [...m.options, { id: `opt-${Date.now()}`, day: "Segunda-feira", foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }] 
        };
      }
      return m;
    }));
  };

  const splitIntoFullWeek = (mealId: string) => {
    setMeals(meals.map(m => {
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
  useEffect(() => {
    async function fetchExistingDiet() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('meal_plan').eq('id', patientId).single();
        if (error) throw error;

        if (data?.meal_plan && Array.isArray(data.meal_plan) && data.meal_plan.length > 0) {
          const formattedPlan: Meal[] = data.meal_plan.map((m: any) => ({
            id: m.id || `meal-${Date.now()}`, time: m.time || "", name: m.name || "Refeição",
            options: m.options.map((o: any) => migrateExistingOption({ ...o, day: o.day || "Segunda-feira", kcal: o.kcal || 0, macros: o.macros || { p: 0, c: 0, g: 0 } }))
          }));
          setMeals(formattedPlan);
          if (formattedPlan.length > 0) setExpandedMealId(formattedPlan[0].id);
        } else {
          const newMealId = `meal-${Date.now()}`;
          setMeals([{ 
            id: newMealId, time: "08:00", name: 'Café da Manhã', 
            options: [{ id: `opt-${Date.now()}`, day: "Segunda-feira", foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }] 
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

  const isMealComplete = (meal: Meal) => {
    const optionsForDay = getOptionsForDay(meal);
    return meal.options.length > 0 && meal.time !== '' && optionsForDay.some(opt => opt.foodItems.length > 0);
  };

  // =========================================================================
  // SAVE
  // =========================================================================
  const handleSave = async () => {
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
              </div>
            </div>
            
            {/* 🔥 SELETOR DE DIA (OVERRIDE MANUAL) */}
            <div className="flex items-center gap-2 bg-stone-100 rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar size={14} className="text-stone-500" />
              <select
                value={activeDay}
                onChange={(e) => {
                  setActiveDay(e.target.value);
                  toast.info(`Visualizando: ${e.target.value}`);
                }}
                className="bg-transparent text-sm font-bold text-stone-800 outline-none cursor-pointer"
              >
                {ORDERED_DAYS.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            
            <button 
              onClick={onClose} 
              className="p-2 bg-stone-50 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-all active:scale-95"
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
                  onClick={() => {
                    setActiveDay(day);
                    toast.info(`Visualizando: ${day}`);
                  }}
                  className={`flex-1 text-[8px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-stone-800 text-white shadow-md'
                      : isComplete
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  {day.substring(0, 3)}
                  {isComplete && <Check size={8} className="inline ml-1" />}
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
              <div className="bg-stone-100 rounded-xl p-3 text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Dia Ativo</span>
                <p className="text-lg font-black text-stone-800">{activeDay}</p>
                {isDayComplete(activeDay) && (
                  <span className="inline-block mt-1 text-[8px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    ✓ Completo
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
              const isComplete = isMealComplete(meal);

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
                          <div key={option.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                            
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase tracking-wider text-stone-400 bg-stone-100 px-2 py-1 rounded-md">
                                  {option.day === "Todos os dias" ? "Base" : option.day}
                                </span>
                                {option.day !== activeDay && option.day !== "Todos os dias" && (
                                  <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-2 py-1 rounded-md">
                                    ⚠️ Não exibido hoje
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center bg-stone-50 rounded-xl border border-stone-200 p-0.5 shadow-inner overflow-hidden">
                                  <div className="flex items-center pl-2 pr-1.5 py-1 border-r border-stone-200/60 group focus-within:bg-red-50 transition-colors">
                                    <span className="text-[8px] font-black uppercase text-stone-400 mr-1">P</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.p || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'p', Number(e.target.value))} className="w-7 bg-transparent text-xs font-bold text-red-600 outline-none text-center" />
                                  </div>
                                  <div className="flex items-center px-1.5 py-1 border-r border-stone-200/60 group focus-within:bg-amber-50 transition-colors">
                                    <span className="text-[8px] font-black uppercase text-stone-400 mr-1">C</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.c || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'c', Number(e.target.value))} className="w-7 bg-transparent text-xs font-bold text-amber-600 outline-none text-center" />
                                  </div>
                                  <div className="flex items-center px-1.5 py-1 group focus-within:bg-blue-50 transition-colors">
                                    <span className="text-[8px] font-black uppercase text-stone-400 mr-1">G</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.g || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'g', Number(e.target.value))} className="w-7 bg-transparent text-xs font-bold text-blue-600 outline-none text-center" />
                                  </div>
                                  <div className="flex items-center pl-1.5 pr-1 py-1 bg-stone-800 rounded-lg shadow-sm ml-0.5">
                                    <input type="number" inputMode="decimal" value={Math.round(option.kcal || 0)} onChange={(e) => updateKcal(meal.id, option.id, Number(e.target.value))} className="w-8 bg-transparent text-xs font-black text-white outline-none text-center" />
                                    <span className="text-[7px] font-black uppercase text-stone-400 ml-0.5">Kcal</span>
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
                              />

                              <div className="mt-3">
                                <div className="text-[9px] font-black text-stone-400 uppercase tracking-[0.15em] mb-2">
                                  Ou escolha por categoria:
                                </div>
                                <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-200">
                                  {quickFoods.map((cat) => {
                                    const isExpanded = expandedCategories[`${meal.id}-${option.id}-${cat.category}`] || false;
                                    
                                    return (
                                      <div key={cat.category} className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                                        <button
                                          onClick={() => setExpandedCategories(prev => ({
                                            ...prev,
                                            [`${meal.id}-${option.id}-${cat.category}`]: !prev[`${meal.id}-${option.id}-${cat.category}`]
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
                                                    tooltipText = "🚫 PROIBIDO - Alergia grave";
                                                  } else if (restrictionInfo?.type === 'intolerance') {
                                                    btnClass = "px-2 py-1 bg-amber-50 border border-amber-300 rounded-lg text-[9px] font-bold text-amber-700 line-through cursor-not-allowed opacity-80";
                                                    tooltipText = "⚠️ CUIDADO - Intolerância alimentar";
                                                  } else {
                                                    btnClass = "px-2 py-1 bg-blue-50 border border-blue-300 rounded-lg text-[9px] font-bold text-blue-700 line-through cursor-not-allowed opacity-80";
                                                    tooltipText = "📋 EVITAR - Restrição alimentar";
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
                                                    {isBlocked && restrictionInfo?.type === 'allergy' && <span className="text-red-500 text-[7px] ml-0.5">🚫</span>}
                                                    {isBlocked && restrictionInfo?.type === 'intolerance' && <span className="text-amber-500 text-[7px] ml-0.5">⚠️</span>}
                                                    {isBlocked && restrictionInfo?.type === 'restriction' && <span className="text-blue-500 text-[7px] ml-0.5">📋</span>}
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
                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-stone-600 bg-white shadow-sm border border-stone-200 hover:border-stone-800 hover:text-stone-800 px-3 py-1.5 rounded-xl transition-all active:scale-95"
                          >
                            <Plus size={12} strokeWidth={2.5} /> Adicionar Variação para {activeDay}
                          </button>

                          {meal.options.length === 1 && meal.options[0].day === "Segunda-feira" && (
                            <button 
                              onClick={() => splitIntoFullWeek(meal.id)} 
                              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-stone-800 bg-stone-100 border border-stone-200 hover:bg-stone-200 px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow-sm"
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
              onClick={onClose} 
              className="px-4 sm:px-5 py-2.5 font-bold text-stone-500 hover:text-stone-800 bg-stone-50 hover:bg-stone-100 rounded-xl transition-all active:scale-[0.98] shrink-0 text-xs sm:text-sm"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className={`flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-bold text-white transition-all duration-300 shadow-md active:scale-[0.98] text-xs sm:text-sm ${
                saved 
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' 
                  : 'bg-stone-900 hover:bg-stone-800'
              }`}
            >
              {isSaving ? (
                <><Loader2 size={16} strokeWidth={2.5} className="animate-spin shrink-0"/> <span className="truncate">Salvando...</span></>
              ) : saved ? (
                <><CheckCircle2 size={16} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Salvo!</span></>
              ) : (
                <><Save size={16} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Liberar Cardápio</span></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}