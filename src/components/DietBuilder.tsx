'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Save, Utensils, Check, 
  Flame, Calculator, ChevronDown, ChevronUp, 
  Copy, CheckCircle2, AlertCircle, CalendarRange, Loader2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// =========================================================================
// INTERFACES E TIPAGENS
// =========================================================================
interface QuickFoodItem {
  name: string;
  kcal: number;
}

interface QuickFoodCategory {
  category: string;
  items: QuickFoodItem[];
}

export interface Option {
  id: string;
  day: string;
  description: string;
  kcal: number;
}

export interface Meal {
  id: string;
  time: string;
  name: string;
  options: Option[];
}

interface DietBuilderProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
}

// =========================================================================
// BANCO DE ALIMENTOS E CONSTANTES (VERSÃO ELITE - EXPANDIDA)
// =========================================================================

interface QuickFoodItem {
  name: string;
  kcal: number;
  macros: {
    c: number; // Carboidratos (g)
    p: number; // Proteínas (g)
    g: number; // Gorduras (g)
  };
}

interface QuickFoodCategory {
  category: string;
  items: QuickFoodItem[];
}

const quickFoods: QuickFoodCategory[] = [
  { 
    category: "Proteínas e Laticínios", 
    items: [
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
    items: [
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
    items: [
      { name: "Feijão caldo (1 concha)", kcal: 106, macros: { c: 14, p: 7, g: 0.5 } },
      { name: "Feijão em grãos (1 escumadeira)", kcal: 140, macros: { c: 20, p: 9, g: 1 } },
      { name: "Lentilha (1 escumadeira)", kcal: 115, macros: { c: 20, p: 9, g: 0.5 } },
      { name: "Grão de bico (3 colheres)", kcal: 130, macros: { c: 22, p: 7, g: 2 } },
      { name: "Ervilha fresca (3 colheres)", kcal: 70, macros: { c: 10, p: 5, g: 0.5 } }
    ] 
  },
  { 
    category: "Vegetais e Saladas", 
    items: [
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
    items: [
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
    items: [
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

const MEAL_TYPES = [
  "Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", 
  "Jantar", "Ceia", "Pré-treino", "Pós-treino", "Refeição Livre"
];

const SINGLE_DAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const GROUP_DAYS = ["Todos os dias", "Segunda a Sexta", "Finais de Semana"];
const ALL_DAYS = [...GROUP_DAYS, ...SINGLE_DAYS];

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function DietBuilder({ patientId, patientName, onClose }: DietBuilderProps) {
  // =========================================================================
  // ESTADOS
  // =========================================================================
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);

  const supabase = createClient();

  // =========================================================================
  // EFEITOS (BUSCA DE DADOS INICIAIS)
  // =========================================================================
  useEffect(() => {
    async function fetchExistingDiet() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('meal_plan').eq('id', patientId).single();
        
        if (error) throw error;

        if (data?.meal_plan && Array.isArray(data.meal_plan) && data.meal_plan.length > 0) {
          const formattedPlan: Meal[] = data.meal_plan.map(m => ({
            ...m,
            options: m.options.map((o: any) => ({
              ...o,
              day: o.day || "Todos os dias",
              kcal: o.kcal || 0
            }))
          }));
          setMeals(formattedPlan);
          
          if (formattedPlan.length > 0) setExpandedMealId(formattedPlan[0].id);
        } else {
          // Inicia com um modelo vazio se não houver dieta
          const newMealId = `meal-${Date.now()}`;
          setMeals([{ 
            id: newMealId, time: '08:00', name: 'Café da Manhã', 
            options: [{ id: `opt-${Date.now()}`, day: 'Todos os dias', description: '', kcal: 0 }] 
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

  // =========================================================================
  // FUNÇÕES AUXILIARES E CÁLCULOS
  // =========================================================================
  const totalDailyKcal = meals.reduce((acc, meal) => acc + (meal.options[0]?.kcal || 0), 0);

  const isMealComplete = (meal: Meal) => {
    if (meal.options.length === 0) return false;
    return meal.time !== '' && meal.options.every(opt => opt.description.trim() !== '');
  };

  // =========================================================================
  // MANIPULAÇÃO DO CARDÁPIO (REFEIÇÕES E OPÇÕES)
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
      id: `meal-${Date.now()}`, time: '', name: nextMealName, 
      options: [{ id: `opt-${Date.now()}`, day: 'Todos os dias', description: '', kcal: 0 }] 
    };
    setMeals([...meals, newMeal]);
    setExpandedMealId(newMeal.id); 
  };

  const removeMeal = (mealId: string) => {
    setMeals(meals.filter(m => m.id !== mealId));
    if (expandedMealId === mealId) setExpandedMealId(null);
  };

  const updateMeal = (mealId: string, field: 'time' | 'name', value: string) => {
    setMeals(meals.map(m => m.id === mealId ? { ...m, [field]: value } : m));
  };

  const addOption = (mealId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const lastOptionDay = m.options[m.options.length - 1].day;
        let nextDay = "Terça-feira"; 

        if (lastOptionDay === "Segunda a Sexta") nextDay = "Finais de Semana";
        else {
          const dayIndex = SINGLE_DAYS.indexOf(lastOptionDay);
          if (dayIndex >= 0 && dayIndex < SINGLE_DAYS.length - 1) {
            nextDay = SINGLE_DAYS[dayIndex + 1]; 
          } else if (lastOptionDay === "Domingo") {
             nextDay = "Segunda-feira"; 
          } else {
             nextDay = "Segunda-feira"; 
          }
        }

        return { 
          ...m, 
          options: [...m.options, { id: `opt-${Date.now()}`, day: nextDay, description: '', kcal: 0 }] 
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
          description: baseOption.description, 
          kcal: baseOption.kcal
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
          if (o.id !== sourceOption.id && o.description.trim() === '') {
            return { ...o, description: sourceOption.description, kcal: sourceOption.kcal };
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

  const updateOption = (mealId: string, optionId: string, field: keyof Option, value: string | number) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => o.id === optionId ? { ...o, [field]: value } : o);
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  const addFoodToOption = (mealId: string, optId: string, food: QuickFoodItem) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id === optId) {
            const currentDesc = o.description.trim();
            const separator = currentDesc === '' ? '' : '\n+ '; // Melhor formatação para quebra de linha
            return { 
              ...o, 
              description: currentDesc === '' ? `- ${food.name}` : `${currentDesc}${separator}${food.name}`,
              kcal: o.kcal + food.kcal 
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
  // SALVAR NO SUPABASE
  // =========================================================================
  const handleSave = async () => {
    setIsSaving(true);
    setExpandedMealId(null); 

    const cleanedMeals = meals.map(m => ({
      ...m,
      options: m.options.filter(o => o.description.trim() !== '')
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

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  if (isLoading) return (
    <div className="bg-white p-10 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-nutri-800 mb-4" size={48} />
      <p className="text-stone-500 font-medium">Carregando o cardápio...</p>
    </div>
  );

  return (
    <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-stone-100 flex flex-col max-h-[90vh]">
      
      {/* HEADER FIXO NO TOPO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-stone-100 pb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900 flex items-center gap-2">
            <Utensils className="text-nutri-800" /> Montar Cardápio
          </h2>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <p className="text-stone-500 text-sm font-medium">Paciente: <b className="text-nutri-900 font-black">{patientName}</b></p>
            <div className="flex items-center gap-2 bg-stone-900 text-white px-4 py-1.5 rounded-full shadow-sm">
              <Calculator size={14} className="text-nutri-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">Base Diária Estimada: <span className="text-amber-400">{totalDailyKcal} kcal</span></span>
            </div>
          </div>
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
              {/* BOTÃO EXCLUIR REFEIÇÃO */}
              <button 
                onClick={(e) => { e.stopPropagation(); removeMeal(meal.id); }} 
                title="Excluir Refeição Completa"
                className="absolute top-5 right-5 bg-white border border-stone-100 p-2.5 rounded-full shadow-sm text-stone-300 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 opacity-0 group-hover:opacity-100 transition-all z-10 active:scale-90"
              >
                <Trash2 size={16} />
              </button>

              {/* CABEÇALHO DO ACORDEÃO */}
              <div 
                onClick={() => setExpandedMealId(isExpanded ? null : meal.id)}
                className="p-6 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3.5 rounded-2xl shadow-sm transition-colors ${isComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-white border border-stone-100 text-stone-300 group-hover:text-nutri-500'}`}>
                    {isComplete ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">{meal.time || '--:--'}</span>
                      {meal.options[0]?.kcal > 0 && !isExpanded && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100/50">~{meal.options[0]?.kcal} kcal</span>
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

              {/* CORPO EXPANDÍVEL */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-4 border-t border-stone-200/50 bg-stone-50">
                  
                  {/* Edição de Horário e Nome da Refeição */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <div className="flex-1 max-w-[150px]">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 block ml-1">Horário</label>
                      <input 
                        type="time" 
                        value={meal.time} 
                        onChange={(e) => updateMeal(meal.id, 'time', e.target.value)} 
                        className="w-full px-4 py-3.5 rounded-xl border border-stone-200 font-extrabold text-stone-700 outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 bg-white shadow-sm transition-all" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 block ml-1">Nome da Refeição</label>
                      <select 
                        value={meal.name}
                        onChange={(e) => updateMeal(meal.id, 'name', e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-stone-200 font-extrabold text-stone-700 outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 bg-white appearance-none shadow-sm transition-all cursor-pointer"
                      >
                        {MEAL_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dias / Opções */}
                  <div className="space-y-6">
                    {meal.options.map((option) => (
                      <div key={option.id} className="bg-white p-5 rounded-[1.5rem] border border-stone-200 shadow-sm relative transition-all focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-800/5">
                        
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                          
                          <select 
                            value={option.day}
                            onChange={(e) => updateOption(meal.id, option.id, 'day', e.target.value)}
                            className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider outline-none transition-all cursor-pointer shadow-sm ${
                              option.day === 'Todos os dias' ? 'bg-stone-800 text-white border-stone-800 hover:bg-stone-700' : 'bg-nutri-50 text-nutri-800 border-nutri-200 hover:bg-nutri-100'
                            }`}
                          >
                            {ALL_DAYS.map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>

                          <div className="flex items-center gap-3">
                            {/* BOTÃO REPLICAR PARA VAZIOS */}
                            {meal.options.length > 1 && option.description.trim() !== '' && (
                              <button 
                                onClick={() => duplicateToEmptyDays(meal.id, option)} 
                                title="Copiar este prato para os dias que estão em branco nesta mesma refeição"
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors active:scale-95"
                              >
                                <Copy size={14} /> Replicar prato
                              </button>
                            )}

                            {/* INPUT KCAL COMO BADGE */}
                            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-amber-700 shadow-sm focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
                              <Flame size={16} />
                              <input 
                                type="number" 
                                value={option.kcal || ''}
                                placeholder="0"
                                onChange={(e) => updateOption(meal.id, option.id, 'kcal', Number(e.target.value))}
                                className="w-12 bg-transparent text-sm font-black outline-none text-right placeholder:text-amber-300"
                              />
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">kcal</span>
                            </div>

                            {/* EXCLUIR DIA */}
                            {meal.options.length > 1 && (
                              <button 
                                onClick={() => removeOption(meal.id, option.id)} 
                                title="Remover este dia"
                                className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors p-2 bg-white rounded-xl border border-stone-200 active:scale-90 shadow-sm"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* TEXTAREA DESCRIÇÃO */}
                        <textarea 
                          rows={4} 
                          placeholder="Ex: 2 ovos mexidos com 1 fatia de pão integral..." 
                          value={option.description} 
                          onChange={(e) => updateOption(meal.id, option.id, 'description', e.target.value)} 
                          className="w-full px-5 py-4 rounded-xl border border-stone-200 bg-stone-50 text-sm font-medium text-stone-700 outline-none focus:bg-white focus:border-nutri-400 transition-all resize-none shadow-inner leading-relaxed" 
                        />

                        {/* PAINEL RÁPIDO COM ALIMENTOS */}
                        <div className="mt-5 pt-5 border-t border-stone-100">
                          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 ml-1">Adicionar Alimento Rápido</p>
                          <div className="flex flex-wrap gap-4">
                            {quickFoods.map((cat) => (
                              <div key={cat.category} className="flex flex-col gap-2 w-full sm:w-auto">
                                 <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest bg-stone-100 px-2 py-1 rounded w-max">{cat.category}</span>
                                 <div className="flex flex-wrap gap-1.5">
                                   {cat.items.map(food => (
                                     <button
                                       key={food.name}
                                       onClick={() => addFoodToOption(meal.id, option.id, food)}
                                       className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold text-stone-600 hover:border-nutri-400 hover:bg-nutri-50 hover:text-nutri-800 transition-all active:scale-90 flex items-center gap-1.5 shadow-sm"
                                       title={`${food.kcal} kcal`}
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
                    
                    {/* BOTÕES DE AÇÃO INFERIORES DO ACORDEÃO */}
                    <div className="flex flex-wrap gap-3 pt-4">
                      {!meal.options.some(opt => opt.day === "Todos os dias") && meal.options.length < 7 && (
                        <button 
                          onClick={() => addOption(meal.id)} 
                          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-600 bg-white shadow-sm border border-stone-200 hover:border-nutri-400 hover:text-nutri-800 px-5 py-3 rounded-xl transition-all active:scale-95 hover:-translate-y-0.5"
                        >
                          <Plus size={16} /> Adicionar outro dia
                        </button>
                      )}

                      {/* BOTÃO BÔNUS: Desmembrar em 7 dias */}
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

        {/* BOTÃO GIGANTE: Adicionar Nova Refeição */}
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