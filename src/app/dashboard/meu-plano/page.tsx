'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, Utensils, Zap, AlertTriangle, Cookie,
  TrendingUp, Droplets, Star, Beef
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// =========================================================================
// COMPONENTES EXTRATOS
// =========================================================================
import { PlanHero } from '@/components/meu-plano/PlanHero';
import { PatientPageShell, PageNavigation, PageHeader, PageContent } from '@/components/layout/PatientPageShell';
import BackButton from '@/components/ui/BackButton';
import { PaywallCard } from '@/components/meu-plano/PaywallCard';
import { NutritionSummary } from '@/components/meu-plano/NutritionSummary';
import type { MacroPorRefeicao } from '@/components/meu-plano/MacroCard';
import { InsightsPanel } from '@/components/meu-plano/InsightsPanel';
import { DayNavigator } from '@/components/meu-plano/DayNavigator';
import { ActionCards } from '@/components/meu-plano/ActionCards';
import { MarketModal } from '@/components/meu-plano/MarketModal';
import { SubstitutionsModal } from '@/components/meu-plano/SubstitutionsModal';
import { ContextualSubstitutionModal } from '@/components/meu-plano/ContextualSubstitutionModal';
import { MealTimeline } from '@/components/meu-plano/MealTimeline';

// =========================================================================
// BIBLIOTECAS EXTRATAS
// =========================================================================
import { SUBSTITUICOES_PADRAO } from '@/lib/substitutions';

// =========================================================================
// IMPORTS DOS COMPONENTES DE BELISCO
// =========================================================================
import { BeliscoModal } from '@/components/BeliscoModal';
import type { FoodItem } from '@/types/patient';
import type { MealPlanOption, MealPlanItem } from '@/types/mealPlan';
import { getBaseGrams } from '@/lib/foodRegistry';
import { buildDescriptionFromFoods } from '@/lib/mealPlan';
import { 
  calculateBeliscosTotals,
  createBeliscoItemFromFood,
  createBeliscoItemManual,
  migrateOldBeliscosFormat
} from '@/lib/beliscoUtils';
import type { BeliscoItem, BeliscosTotals } from '@/lib/beliscoUtils';

interface ProfileData {
  full_name?: string | null;
  goal?: string | null;
}

interface PlanoPDF {
  publicUrl?: string;
  file_url?: string;
  meal_plan_pdf_url?: string;
}

interface PdfMealEntry {
  mealName: string;
  time?: string;
  description: string;
  kcal?: number;
  macros: { p: number; c: number; g: number };
}

// =========================================================================
// FUNÇÃO AUXILIAR DE NORMALIZAÇÃO PARA EVITAR DUPLICAÇÃO NO MARKET
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
// FUNÇÃO PARA ARREDONDAMENTO SEGURO
// =========================================================================
const safeAdd = (a: number, b: number): number => {
  return parseFloat((a + b).toFixed(2));
};










// =========================================================================
// FUNÇÕES AUXILIARES
// =========================================================================
const DAY_NAMES_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const getLocalTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseMarketDescription = (description: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  
  for (let i = 0; i < description.length; i++) {
    const char = description[i];
    
    if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (char === '+' && parenDepth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  return parts;
};

const calcularMacrosDoCardapio = (mealPlan: MealPlanItem[]) => {
  if (!mealPlan || !Array.isArray(mealPlan) || mealPlan.length === 0) {
    return {
      totalKcal: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      macrosPorRefeicao: []
    };
  }

  const macrosPorRefeicao: MacroPorRefeicao[] = [];
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const meal of mealPlan) {
    const option = meal.options?.[0] ?? null;
    if (option) {
      const kcal = option.kcal || 0;
      const protein = option.macros?.p || 0;
      const carbs = option.macros?.c || 0;
      const fat = option.macros?.g || 0;

      totalKcal = safeAdd(totalKcal, kcal);
      totalProtein = safeAdd(totalProtein, protein);
      totalCarbs = safeAdd(totalCarbs, carbs);
      totalFat = safeAdd(totalFat, fat);

      macrosPorRefeicao.push({
        nome: meal.name || 'Refeição',
        horario: meal.time || '--:--',
        kcal,
        protein,
        carbs,
        fat
      });
    }
  }

  return {
    totalKcal,
    totalProtein,
    totalCarbs,
    totalFat,
    macrosPorRefeicao
  };
};

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function MeuPlano() {
  const [planoPDF, setPlanoPDF] = useState<PlanoPDF | string | null>(null);
  const [mealPlanJSON, setMealPlanJSON] = useState<MealPlanItem[] | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  
  const [canAccess, setCanAccess] = useState<boolean>(false);
  const [prices, setPrices] = useState({ premium: 297.00, mealPlan: 147.00 });
  const [processingCheckout, setProcessingCheckout] = useState<string | null>(null);
  
  const [selectedDateOffset, setSelectedDateOffset] = useState<number>(0);
  const [historicalLogs, setHistoricalLogs] = useState<{ meals_checked: string[]; water_ml: number; beliscos: unknown } | null>(null);

  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [marketMultiplier, setMarketMultiplier] = useState<number>(7); 
  const [isCopied, setIsCopied] = useState(false);

  const [isSubstitutionsModalOpen, setIsSubstitutionsModalOpen] = useState(false);
  const [contextualCategory, setContextualCategory] = useState<string | null>(null);

  const [completedMeals, setCompletedMeals] = useState<string[]>([]);
  const [waterCount, setWaterCount] = useState<number>(0);
  const [currentMood, setCurrentMood] = useState<string | null>(null);
  
  // NOVOS STATES PARA BELISCOS (FORMATO COM HISTÓRICO)
  const [beliscosItems, setBeliscosItems] = useState<BeliscoItem[]>([]);
  const [beliscosTotals, setBeliscosTotals] = useState<BeliscosTotals>({
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });
  const [isBeliscoModalOpen, setIsBeliscoModalOpen] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  // =========================================================================
  // LOAD DATA COM CANCELAMENTO
  // =========================================================================
  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        
        if (!session) {
          setError("Usuário não autenticado.");
          setLoading(false);
          return;
        }

        const { data: settings } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', 1)
          .single();

        if (!isMounted) return;
        
        if (settings) {
          setPrices({
            premium: settings.premium_price || 297.00,
            mealPlan: settings.meal_plan_price || 147.00
          });
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!isMounted) return;
        
        if (profileError) throw profileError;

        setProfile(profileData);
        
        const hasAccess = profileData?.account_type === 'premium' || profileData?.has_meal_plan_access === true;
        setCanAccess(hasAccess);

        if (hasAccess) {
          if (profileData?.meal_plan && Array.isArray(profileData.meal_plan)) {
            setMealPlanJSON(profileData.meal_plan);
          }

          if (profileData?.meal_plan_pdf_url) {
            setPlanoPDF(profileData.meal_plan_pdf_url);
          }

          const today = getLocalTodayString();
          const { data: logs } = await supabase
            .from('daily_logs')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('date', today)
            .maybeSingle();

          if (!isMounted) return;

          if (logs) {
            setCompletedMeals(logs.meals_checked || []);
            setWaterCount(logs.water_ml ? logs.water_ml / 250 : 0);
            setCurrentMood(logs.mood || null);
            
            // CARREGAR BELISCOS COM MIGRAÇÃO (suporte a formato antigo)
            const migratedBeliscos = migrateOldBeliscosFormat(logs.beliscos);
            setBeliscosItems(migratedBeliscos.items);
            setBeliscosTotals(calculateBeliscosTotals(migratedBeliscos.items));
          }
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Erro no fetchData:", err);
        setError("Erro ao carregar seus dados.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // =========================================================================
  // HISTORICAL LOGS — buscar daily_logs para dias anteriores
  // =========================================================================
  const getDateWithOffsetString = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (selectedDateOffset === 0) {
      setHistoricalLogs(null);
      return;
    }

    let cancelled = false;

    const fetchHistorical = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const targetDate = getDateWithOffsetString(selectedDateOffset);
        const { data: logs } = await supabase
          .from('daily_logs')
          .select('meals_checked, water_ml, beliscos')
          .eq('user_id', session.user.id)
          .eq('date', targetDate)
          .maybeSingle();

        if (!cancelled) {
          setHistoricalLogs(logs ? {
            meals_checked: logs.meals_checked || [],
            water_ml: logs.water_ml || 0,
            beliscos: logs.beliscos,
          } : null);
        }
      } catch {
        if (!cancelled) setHistoricalLogs(null);
      }
    };

    fetchHistorical();
    return () => { cancelled = true; };
  }, [selectedDateOffset, supabase]);

  // =========================================================================
  // FUNÇÃO PARA ADICIONAR BELISCO A PARTIR DO FOOD_REGISTRY
  // =========================================================================
  const addBeliscoFromFood = async (food: FoodItem, grams: number) => {
    const baseGrams = getBaseGrams(food.id);
    const factor = grams / baseGrams;
    
    const newItem = createBeliscoItemFromFood(
      food.name,
      grams,
      food.kcal * factor,
      food.macros.p * factor,
      food.macros.c * factor,
      food.macros.g * factor
    );
    
    const newItems = [...beliscosItems, newItem];
    const newTotals = calculateBeliscosTotals(newItems);
    
    setBeliscosItems(newItems);
    setBeliscosTotals(newTotals);

    const { data: { session } } = await supabase.auth.getSession();
    const today = getLocalTodayString();

    await supabase.from('daily_logs').upsert({
      user_id: session?.user.id,
      date: today,
      meals_checked: completedMeals,
      water_ml: waterCount * 250,
      mood: currentMood,
      beliscos: { items: newItems }
    }, { onConflict: 'user_id, date' });

    toast.success(`✓ ${food.name} (${Math.round(grams)}g) - ${Math.round(newItem.kcal)} kcal`);
  };

  // =========================================================================
  // FUNÇÃO PARA ADICIONAR BELISCO MANUAL (FALLBACK)
  // =========================================================================
  const addBeliscoManual = async (kcal: number, protein: number, carbs: number, fat: number) => {
    const newItem = createBeliscoItemManual(kcal, protein, carbs, fat);
    
    const newItems = [...beliscosItems, newItem];
    const newTotals = calculateBeliscosTotals(newItems);
    
    setBeliscosItems(newItems);
    setBeliscosTotals(newTotals);

    const { data: { session } } = await supabase.auth.getSession();
    const today = getLocalTodayString();

    await supabase.from('daily_logs').upsert({
      user_id: session?.user.id,
      date: today,
      meals_checked: completedMeals,
      water_ml: waterCount * 250,
      mood: currentMood,
      beliscos: { items: newItems }
    }, { onConflict: 'user_id, date' });

    toast.success(`✓ Belisco manual registrado: +${Math.round(kcal)} kcal`);
  };

  // =========================================================================
  // FUNÇÃO PARA REMOVER BELISCO
  // =========================================================================
  const removeBeliscoItem = async (itemId: string) => {
    const newItems = beliscosItems.filter(item => item.id !== itemId);
    const newTotals = calculateBeliscosTotals(newItems);
    
    setBeliscosItems(newItems);
    setBeliscosTotals(newTotals);

    const { data: { session } } = await supabase.auth.getSession();
    const today = getLocalTodayString();

    await supabase.from('daily_logs').upsert({
      user_id: session?.user.id,
      date: today,
      meals_checked: completedMeals,
      water_ml: waterCount * 250,
      mood: currentMood,
      beliscos: { items: newItems }
    }, { onConflict: 'user_id, date' });

    toast.info(`Item removido do histórico`);
  };

  // =========================================================================
  // MEMOS & CÁLCULOS PREMIUM
  // =========================================================================
  const selectedDayName = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + selectedDateOffset);
    return DAY_NAMES_PT[d.getDay()];
  }, [selectedDateOffset]);

  const isReadOnly = selectedDateOffset !== 0;

  const filterTabs = useMemo(() => {
    if (!mealPlanJSON) return [];
    const days = new Set<string>();
    mealPlanJSON.forEach(meal => {
      meal.options?.forEach((opt: MealPlanOption) => {
        const d = opt.day?.trim();
        if (d && d.toLowerCase() !== 'todos os dias') days.add(d);
      });
    });
    return Array.from(days);
  }, [mealPlanJSON]);

  const filteredMeals = useMemo(() => {
    if (!mealPlanJSON) return [];

    // Hoje: mostrar tudo (comportamento original)
    if (selectedDateOffset === 0) return mealPlanJSON;

    // Dia específico: filtrar por nome do dia da semana
    return mealPlanJSON.map(meal => {
      const filteredOptions = meal.options?.filter((opt: MealPlanOption) => {
        const optDay = opt.day?.trim();
        return optDay?.toLowerCase() === 'todos os dias' || optDay === selectedDayName;
      }) || [];
      return { ...meal, options: filteredOptions };
    }).filter(meal => meal.options.length > 0);
  }, [mealPlanJSON, selectedDateOffset, selectedDayName]);

  const macros = useMemo(() => {
    return calcularMacrosDoCardapio(filteredMeals);
  }, [filteredMeals]);

  // CONSUMO DAS REFEIÇÕES (SEM BELISCOS)
  const effectiveCompletedMeals = useMemo(() => {
    return isReadOnly ? (historicalLogs?.meals_checked ?? []) : completedMeals;
  }, [isReadOnly, historicalLogs, completedMeals]);

  const mealsConsumed = useMemo(() => {
    let p = 0, c = 0, g = 0, kcal = 0;
    filteredMeals.forEach(meal => {
      if (effectiveCompletedMeals.includes(meal.name) && meal.options?.[0]) {
        kcal = safeAdd(kcal, meal.options[0].kcal || 0);
        p = safeAdd(p, meal.options[0].macros?.p || 0);
        c = safeAdd(c, meal.options[0].macros?.c || 0);
        g = safeAdd(g, meal.options[0].macros?.g || 0);
      }
    });
    return { kcal, p, c, g };
  }, [filteredMeals, effectiveCompletedMeals]);

  // CONSUMO REAL (REFEIÇÕES + BELISCOS) - USADO NO MACROCARD
  const realConsumed = useMemo(() => {
    return {
      kcal: safeAdd(mealsConsumed.kcal, beliscosTotals.kcal),
      p: safeAdd(mealsConsumed.p, beliscosTotals.protein),
      c: safeAdd(mealsConsumed.c, beliscosTotals.carbs),
      g: safeAdd(mealsConsumed.g, beliscosTotals.fat),
    };
  }, [mealsConsumed, beliscosTotals]);

  const totalMealsCount = filteredMeals.length;
  const completedCount = filteredMeals.filter(m => effectiveCompletedMeals.includes(m.name)).length;
  const adherencePercent = totalMealsCount > 0 
    ? Math.round((completedCount / totalMealsCount) * 100) 
    : 0;

  const insights = useMemo(() => {
    const list = [];
    
    if (waterCount < 4) {
      list.push({ text: "Atenção à hidratação! Beba um copo de água agora.", bg: "bg-blue-50", textCol: "text-blue-800", icon: <Droplets size={16} className="text-blue-500" aria-hidden="true"/> });
    } else if (waterCount >= 8 && waterCount < 12) {
      list.push({ text: "Hidratação excelente! Continue assim.", bg: "bg-emerald-50", textCol: "text-emerald-800", icon: <Droplets size={16} className="text-emerald-500" aria-hidden="true"/> });
    }
    
    if (completedCount === totalMealsCount && totalMealsCount > 0) {
      list.push({ text: "Dia perfeito! Todas as refeições do protocolo concluídas.", bg: "bg-amber-50", textCol: "text-amber-800", icon: <Star size={16} className="text-amber-500" aria-hidden="true"/> });
    } else if (completedCount > 0 && completedCount < totalMealsCount) {
      list.push({ text: "Mantenha o foco! Faltam poucas refeições para completar a meta.", bg: "bg-orange-50", textCol: "text-orange-800", icon: <TrendingUp size={16} className="text-orange-500" aria-hidden="true"/> });
    }
    
    if (mealsConsumed.p > 0 && mealsConsumed.p < (macros.totalProtein * 0.4) && completedCount >= (totalMealsCount / 2)) {
      list.push({ text: "Seu consumo de proteína está baixo hoje. Capriche na próxima refeição!", bg: "bg-red-50", textCol: "text-red-800", icon: <Beef size={16} className="text-red-500" aria-hidden="true"/> });
    }

    // INSIGHT DE BELISCOS (usando beliscosTotals)
    if (beliscosTotals.kcal > macros.totalKcal * 0.25) {
      list.push({ 
        text: "Beliscos já estão comprometendo seu resultado hoje. Prefira opções do protocolo.", 
        bg: "bg-orange-50", 
        textCol: "text-orange-800", 
        icon: <Cookie size={16} className="text-orange-500" aria-hidden="true"/> 
      });
    }
    
    if (beliscosTotals.kcal > macros.totalKcal * 0.4) {
      list.push({ 
        text: "⚠️ Atenção! Seu déficit calórico foi severamente impactado pelos beliscos.", 
        bg: "bg-red-50", 
        textCol: "text-red-800", 
        icon: <AlertTriangle size={16} className="text-red-500" aria-hidden="true"/> 
      });
    }

    return list.slice(0, 4);
  }, [waterCount, completedCount, totalMealsCount, mealsConsumed, macros, beliscosTotals]);

    // =========================================================================
  // LOGICA DO MERCADO COM NORMALIZAÇÃO
  // =========================================================================
  const marketList = useMemo(() => {
    if (!mealPlanJSON) return { measured: [], others: [] };
    
    const map = new Map<string, { name: string; qty: number; unit: string; originalName: string }>();
    const textItems = new Set<string>();

    mealPlanJSON.forEach(meal => {
      if (meal.options && meal.options.length > 0) {
        const opt = meal.options[0] ?? null; 
        if (!opt) return;

        let localMultiplier = marketMultiplier;
        const dayStr = opt.day?.trim().toLowerCase();
        
        if (dayStr && dayStr !== 'todos os dias' && dayStr !== 'opção') {
          if (marketMultiplier === 7) localMultiplier = 1;
          else if (marketMultiplier === 15) localMultiplier = 2;
          else if (marketMultiplier === 30) localMultiplier = 4;
          else if (marketMultiplier === 1) localMultiplier = 1 / 7;
        }

        const description = buildDescriptionFromFoods(opt);
        const parts = parseMarketDescription(description);
        
        parts.forEach((part: string) => {
          const match = part.match(/^(.*?)(?:\s*\((.*?)\))?$/);
          if (match) {
            const name = match[1].trim();
            const qtyUnit = match[2] ? match[2].trim() : '';
            
            if (qtyUnit && !qtyUnit.toLowerCase().includes('vontade')) {
              const numMatch = qtyUnit.match(/^([\d.,]+)\s*(.*)$/);
              if (numMatch) {
                const qty = parseFloat(numMatch[1].replace(',', '.'));
                const unit = numMatch[2].trim();
                const normalizedKey = `${normalizeString(name)}|${normalizeString(unit)}`;
                
                if (map.has(normalizedKey)) {
                  const existing = map.get(normalizedKey)!;
                  existing.qty = parseFloat((existing.qty + (qty * localMultiplier)).toFixed(2));
                } else {
                  map.set(normalizedKey, { 
                    name, 
                    qty: parseFloat((qty * localMultiplier).toFixed(2)), 
                    unit,
                    originalName: name 
                  });
                }
              } else {
                textItems.add(part);
              }
            } else {
              textItems.add(part);
            }
          } else {
            textItems.add(part);
          }
        });
      }
    });

    return {
      measured: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)),
      others: Array.from(textItems)
    };
  }, [mealPlanJSON, marketMultiplier]);

  // =========================================================================
  // FUNÇÕES DE AÇÃO
  // =========================================================================
  const handleUpgradeClick = async (planType: string) => {
    setProcessingCheckout(planType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          email: session.user.email,
          name: profile?.full_name || 'Paciente Vanusa Nutri',
          planType: planType 
        }),
      });

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point; 
      } else {
        throw new Error(data.error);
      }
    } catch {
      toast.error("Erro ao processar pagamento.");
      setProcessingCheckout(null);
    }
  };

  const toggleMealCompletion = async (mealName: string) => {
    const isCompleted = completedMeals.includes(mealName);
    const newList = isCompleted 
      ? completedMeals.filter(m => m !== mealName)
      : [...completedMeals, mealName];
    
    setCompletedMeals(newList);
    
    const { data: { session } } = await supabase.auth.getSession();
    const today = getLocalTodayString();
    
    await supabase.from('daily_logs').upsert({
      user_id: session?.user.id,
      date: today,
      meals_checked: newList,
      water_ml: waterCount * 250,
      mood: currentMood,
      beliscos: { items: beliscosItems }
    }, { onConflict: 'user_id, date' });

    if (!isCompleted) {
      toast.success(`Excelente! Refeição registrada. 🔥`);
    }
  };

  const updateWater = async (increment: number) => {
    const newValue = Math.max(0, waterCount + increment);
    setWaterCount(newValue);
    
    const { data: { session } } = await supabase.auth.getSession();
    const today = getLocalTodayString();
    
    await supabase.from('daily_logs').upsert({
      user_id: session?.user.id,
      date: today,
      water_ml: newValue * 250,
      meals_checked: completedMeals,
      mood: currentMood,
      beliscos: { items: beliscosItems }
    }, { onConflict: 'user_id, date' });
  };

  const generateMarketText = () => {
    let periodText = 'Diário';
    if (marketMultiplier === 7) periodText = '7 Dias (Semanal)';
    if (marketMultiplier === 15) periodText = '15 Dias (Quinzenal)';
    if (marketMultiplier === 30) periodText = '30 Dias (Mensal)';

    const lines = [];
    lines.push(`🛒 *Lista de Compras Inteligente*`);
    lines.push(`👤 *Paciente:* ${profile?.full_name || 'Paciente'}`);
    lines.push(`📅 *Período:* ${periodText}`);
    lines.push('');

    if (marketList.measured.length > 0) {
      lines.push(`📊 *ITENS COM MEDIDA:*`);
      marketList.measured.forEach(item => {
        const qty = Number.isInteger(item.qty) ? item.qty : parseFloat(item.qty.toFixed(2));
        lines.push(`✅ ${qty} ${item.unit} - ${item.name}`);
      });
      lines.push('');
    }

    if (marketList.others.length > 0) {
      lines.push(`🟢 *CONSUMO LIVRE / OUTROS:*`);
      marketList.others.forEach(item => {
        lines.push(`✅ ${item}`);
      });
      lines.push('');
    }

    lines.push(`_Gerado pelo App Meu Plano Alimentar - Vanusa Nutri_`);

    return lines.join('\n');
  };

  const handleShareWhatsApp = () => {
    const text = generateMarketText();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const baseUrl = isMobile 
      ? 'https://api.whatsapp.com/send?text=' 
      : 'https://web.whatsapp.com/send?text=';

    const url = `${baseUrl}${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyToClipboard = async () => {
    try {
      const text = generateMarketText();
      await navigator.clipboard.writeText(text);
      
      toast.success("Lista copiada com sucesso!");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
      toast.error("Falha ao copiar lista.");
    }
  };

  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = error => reject(error);
      img.src = imageUrl;
    });
  };

  const handleGenerateDynamicPDF = async () => {
    if (!mealPlanJSON) return;

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    const macrosData = calcularMacrosDoCardapio(mealPlanJSON);
    const totalKcal = macrosData.totalKcal;
    const totalProtein = macrosData.totalProtein;
    const totalCarbs = macrosData.totalCarbs;
    const totalFat = macrosData.totalFat;

    const daysMap = new Map<string, PdfMealEntry[]>();
    mealPlanJSON.forEach(meal => {
      meal.options?.forEach((opt: MealPlanOption) => {
        const dayName = opt.day?.trim() || "Opção";
        if (!daysMap.has(dayName)) daysMap.set(dayName, []);
        daysMap.get(dayName)!.push({
          mealName: meal.name,
          time: meal.time,
          description: buildDescriptionFromFoods(opt),
          kcal: opt.kcal,
          macros: opt.macros || { p: 0, c: 0, g: 0 }
        });
      });
    });

    const dayOrder = ["Todos os dias", "Segunda a Sexta", "Finais de Semana", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
    const sortedDays = Array.from(daysMap.keys()).sort((a, b) => {
      const idxA = dayOrder.indexOf(a);
      const idxB = dayOrder.indexOf(b);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    let logoBase64: string | null = null;
    try {
      logoBase64 = await getBase64ImageFromUrl('/images/logo-vanusa.png');
    } catch {
      console.warn("Logo não encontrada");
    }

    const printHeaderAndFooter = () => {
      let currentY = 20;
      
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, currentY - 6, 16, 16); 
      }
      
      const textStartX = logoBase64 ? margin + 20 : margin;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(26, 58, 42); 
      doc.text("Vanusa Zacarias", textStartX, currentY + 2);
      
      doc.setFontSize(10);
      doc.setTextColor(139, 131, 120); 
      doc.text("NUTRIÇÃO CLÍNICA", textStartX, currentY + 8, { charSpace: 1.5 });
      
      doc.setFontSize(12);
      doc.setTextColor(200, 200, 200);
      doc.text("PLANO ALIMENTAR", pageWidth - margin, currentY + 8, { align: "right" });

      currentY += 18;
      
      doc.setDrawColor(26, 58, 42);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      
      currentY += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("PACIENTE:", margin, currentY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(profile?.full_name || "Paciente", margin + 20, currentY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("DATA:", margin + 85, currentY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(new Date().toLocaleDateString('pt-BR'), margin + 98, currentY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("BASE DIÁRIA:", pageWidth - margin - 52, currentY);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(234, 88, 12);
      doc.text(`~${Math.round(totalKcal)} kcal`, pageWidth - margin, currentY, { align: "right" });
      
      currentY += 5;
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const macroText = `P: ${Math.round(totalProtein)}g | C: ${Math.round(totalCarbs)}g | G: ${Math.round(totalFat)}g`;
      doc.text(macroText, pageWidth - margin - doc.getTextWidth(macroText), currentY);

      currentY += 6;
      
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      
      currentY += 12;

      doc.setDrawColor(220, 220, 220);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text("Plano alimentar individual e intransferível elaborado por Vanusa Zacarias - Nutrição Clínica.", pageWidth / 2, pageHeight - 10, { align: "center" });

      return currentY;
    };

    sortedDays.forEach((day, index) => {
      if (index > 0) {
        doc.addPage();
      }
      let y = printHeaderAndFooter();

      doc.setFillColor(26, 58, 42); 
      doc.rect(margin, y, pageWidth - (margin * 2), 12, 'F');
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255); 
      
      const titleText = day.toUpperCase() === 'TODOS OS DIAS' 
        ? 'CARDÁPIO PADRÃO (TODOS OS DIAS)' 
        : `CARDÁPIO: ${day.toUpperCase()}`;
        
      doc.text(titleText, pageWidth / 2, y + 8, { align: "center", charSpace: 1 });
      
      y += 20;

      const mealsForDay = daysMap.get(day) || [];
      
      mealsForDay.forEach(meal => {
        if (y > pageHeight - 50) { 
          doc.addPage(); 
          y = printHeaderAndFooter();
          
          doc.setFillColor(26, 58, 42); 
          doc.rect(margin, y, pageWidth - (margin * 2), 12, 'F');
          doc.text(titleText, pageWidth / 2, y + 8, { align: "center", charSpace: 1 });
          y += 20;
        }

        doc.setFillColor(245, 248, 246); 
        doc.rect(margin, y - 6, pageWidth - (margin * 2), 12, 'F');
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 58, 42);
        doc.text(`${meal.mealName.toUpperCase()} - ${meal.time}`, margin + 3, y + 1);
        
        const macroX = pageWidth - margin - 70;
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`${Math.round(meal.kcal || 0)} kcal | P: ${Math.round(meal.macros?.p || 0)}g | C: ${Math.round(meal.macros?.c || 0)}g | G: ${Math.round(meal.macros?.g || 0)}g`, macroX, y + 1);
        
        y += 12;

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        
        const maxWidth = pageWidth - (margin * 2);
        const splitDesc = doc.splitTextToSize(meal.description, maxWidth);
        
        doc.text(splitDesc, margin + 3, y);
        
        y += (splitDesc.length * 5) + 6; 
      });
    });

    doc.save(`Plano_Alimentar_${profile?.full_name?.split(' ')[0] || 'Paciente'}.pdf`);
  };

  // =========================================================================
  // RENDER PRINCIPAL
  // =========================================================================
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] flex-col gap-4" role="status" aria-live="polite">
      <Loader2 className="animate-spin text-nutri-800" size={48} aria-hidden="true" />
      <p className="text-stone-400 font-bold animate-pulse text-xs uppercase tracking-widest">Carregando seu protocolo...</p>
    </div>
  );

  const hasAnyPlan = (mealPlanJSON && mealPlanJSON.length > 0) || !!planoPDF;
  const finalPdfUrl = typeof planoPDF === 'string' 
    ? planoPDF 
    : (planoPDF?.publicUrl || planoPDF?.file_url || planoPDF?.meal_plan_pdf_url || '#');
    
  const selectedContextualGroup = SUBSTITUICOES_PADRAO.find(g => g.categoria === contextualCategory);

  return (
    <PatientPageShell maxWidth="max-w-2xl" className="bg-[#FAFAFA] relative selection:bg-nutri-200 selection:text-nutri-900">
      <PageNavigation>
        <BackButton href="/dashboard" label="Voltar ao Painel" />
        <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" aria-hidden="true" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">Ativo</span>
        </div>
      </PageNavigation>

      <PageHeader>
        <PlanHero
          firstName={profile?.full_name?.split(' ')[0] || 'Paciente'}
          goal={profile?.goal || null}
          adherencePercent={adherencePercent}
        />
      </PageHeader>

      <PageContent>
      {!canAccess ? (
        <PaywallCard prices={prices} processingCheckout={processingCheckout} onUpgrade={handleUpgradeClick} />
      ) : (
        <div className="space-y-6 pb-24">

            {hasAnyPlan && insights.length > 0 && !isReadOnly && (
              <InsightsPanel insights={insights} />
            )}

            {hasAnyPlan && filterTabs.length > 0 && (
              <>
                <NutritionSummary
                  totalKcal={macros.totalKcal}
                  totalProtein={macros.totalProtein}
                  totalCarbs={macros.totalCarbs}
                  totalFat={macros.totalFat}
                  consumedKcal={realConsumed.kcal}
                  consumedProtein={realConsumed.p}
                  consumedCarbs={realConsumed.c}
                  consumedFat={realConsumed.g}
                  macrosPorRefeicao={macros.macrosPorRefeicao}
                  waterCount={isReadOnly ? (historicalLogs?.water_ml ?? 0) / 250 : waterCount}
                  onUpdateWater={isReadOnly ? () => {} : updateWater}
                  beliscos={beliscosTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }}
                  beliscoItems={beliscosItems ?? []}
                  beliscoTotalKcal={macros.totalKcal ?? 1}
                  onOpenBeliscoModal={isReadOnly ? () => {} : () => setIsBeliscoModalOpen(true)}
                  onRemoveBeliscoItem={isReadOnly ? () => {} : removeBeliscoItem}
                  readOnly={isReadOnly}
                />
              </>
            )}

            {!hasAnyPlan ? (
              <div className="relative overflow-hidden bg-white p-10 rounded-[2.5rem] shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)] border border-stone-100 text-center">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Utensils className="text-stone-300" size={24} aria-hidden="true" />
                </div>
                <h3 className="font-bold text-stone-900">Protocolo em Elaboração</h3>
                <p className="text-stone-500 text-sm mt-2">Nossa equipe de nutrição está montando sua estratégia personalizada. Avisaremos em breve!</p>
              </div>
            ) : (
              <>
                <ActionCards 
                  planoPDF={planoPDF} 
                  finalPdfUrl={finalPdfUrl} 
                  onGeneratePDF={handleGenerateDynamicPDF} 
                  onOpenMarket={() => setIsMarketModalOpen(true)} 
                  onOpenSubstitutions={() => setIsSubstitutionsModalOpen(true)} 
                />

                <DayNavigator selectedOffset={selectedDateOffset} onSelect={setSelectedDateOffset} />

                <MealTimeline 
                  filteredMeals={filteredMeals ?? []} 
                  completedMeals={isReadOnly ? (historicalLogs?.meals_checked ?? []) : completedMeals} 
                  toggleMealCompletion={toggleMealCompletion} 
                  setContextualCategory={setContextualCategory}
                  readOnly={isReadOnly}
                  dateLabel={isReadOnly ? selectedDayName : undefined}
                />
                
                {filteredMeals && filteredMeals.length === 0 && selectedDateOffset !== 0 && (
                   <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 text-center">
                     <p className="text-stone-500 font-medium">Nenhuma refeição configurada para <b>{selectedDayName}</b>.</p>
                     <button onClick={() => setSelectedDateOffset(0)} className="mt-4 text-nutri-800 font-bold text-sm hover:underline">
                       Ver cardápio de hoje
                     </button>
                   </div>
                )}

                <div className="relative overflow-hidden rounded-[2.5rem] bg-stone-900 text-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]">
                  <div className="p-5 sm:p-7 md:p-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                    <div className="bg-white/10 p-4 rounded-2xl shrink-0"><Zap size={24} className="text-amber-400" aria-hidden="true" /></div>
                    <div>
                      <p className="font-black text-lg mb-1 tracking-tight">O segredo é a constância</p>
                      <p className="text-sm text-stone-400 leading-relaxed max-w-lg">Clique nas palavras <span className="text-orange-400 font-bold underline decoration-dashed">destacadas em laranja</span> no seu protocolo para ver opções de substituição sem furar a dieta.</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        </PageContent>

      <MarketModal 
        isOpen={isMarketModalOpen} 
        onClose={() => setIsMarketModalOpen(false)} 
        marketList={marketList} 
        marketMultiplier={marketMultiplier} 
        onSetMarketMultiplier={setMarketMultiplier} 
        isCopied={isCopied} 
        onShareWhatsApp={handleShareWhatsApp} 
        onCopyToClipboard={handleCopyToClipboard} 
      />

      <SubstitutionsModal 
        isOpen={isSubstitutionsModalOpen} 
        onClose={() => setIsSubstitutionsModalOpen(false)} 
      />

      <ContextualSubstitutionModal 
        isOpen={!!contextualCategory && !!selectedContextualGroup} 
        onClose={() => setContextualCategory(null)} 
        group={selectedContextualGroup ?? null} 
      />

      {/* MODAL DE BELISCO - CORRIGIDO COM OS NOVOS MÉTODOS */}
      <BeliscoModal 
        isOpen={isBeliscoModalOpen}
        onClose={() => setIsBeliscoModalOpen(false)}
        onAddFood={addBeliscoFromFood}
        onAddManual={addBeliscoManual}
      />

    </PatientPageShell>
  );
}