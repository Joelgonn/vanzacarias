'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Save, Clock, Utensils, Check, 
  FileJson, Apple, Zap, Search, Loader2, Flame, Calculator,
  ChevronDown, ChevronUp, Copy, CheckCircle2, AlertCircle, CalendarRange
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// 1. BANCO DE ALIMENTOS EXPANDIDO
const quickFoods = [
  { 
    category: "Proteínas", 
    items: [
      { name: "Ovo mexido (2 un)", kcal: 156 },
      { name: "Ovo cozido (2 un)", kcal: 140 },
      { name: "Frango grelhado (100g)", kcal: 165 },
      { name: "Carne moída (100g)", kcal: 133 },
      { name: "Filé de peixe (100g)", kcal: 110 },
      { name: "Whey Protein (1 scoop)", kcal: 120 },
      { name: "Iogurte Natural", kcal: 70 },
      { name: "Queijo branco (30g)", kcal: 66 }
    ] 
  },
  { 
    category: "Carboidratos", 
    items: [
      { name: "Arroz branco (100g)", kcal: 130 },
      { name: "Arroz integral (100g)", kcal: 112 },
      { name: "Pão francês (1 un)", kcal: 135 },
      { name: "Pão de forma int. (2 fatias)", kcal: 115 },
      { name: "Batata doce (100g)", kcal: 86 },
      { name: "Aveia (30g)", kcal: 118 },
      { name: "Macarrão (100g)", kcal: 157 }
    ] 
  },
  { 
    category: "Leguminosas", 
    items: [
      { name: "Feijão caldo (1 concha)", kcal: 106 },
      { name: "Lentilha (1 escumadeira)", kcal: 115 },
      { name: "Grão de bico (3 colheres)", kcal: 130 },
      { name: "Ervilha fresca (3 colheres)", kcal: 70 }
    ] 
  },
  { 
    category: "Vegetais e Saladas", 
    items: [
      { name: "Salada de Folhas (à vontade)", kcal: 15 },
      { name: "Tomate e Pepino", kcal: 25 },
      { name: "Brócolis cozido (3 ramos)", kcal: 25 },
      { name: "Cenoura ralada (2 colheres)", kcal: 20 },
      { name: "Abobrinha/Chuchu (1 pires)", kcal: 30 },
      { name: "Beterraba (2 fatias)", kcal: 35 }
    ] 
  },
  { 
    category: "Frutas", 
    items: [
      { name: "Banana (1 un)", kcal: 40 },
      { name: "Mamão (1 fatia)", kcal: 45 },
      { name: "Maçã (1 un)", kcal: 52 },
      { name: "Abacaxi (1 fatia)", kcal: 40 },
      { name: "Morangos (10 un)", kcal: 32 },
      { name: "Abacate (2 colheres)", kcal: 110 }
    ] 
  },
  { 
    category: "Gorduras/Extras", 
    items: [
      { name: "Azeite (1 colher)", kcal: 108 },
      { name: "Pasta de amendoim", kcal: 90 },
      { name: "Castanhas (30g)", kcal: 170 },
      { name: "Chia/Linhaça", kcal: 55 },
      { name: "Café s/ açúcar", kcal: 0 }
    ] 
  }
];

// LISTAS INTELIGENTES DE SEQUÊNCIA
const MEAL_TYPES = [
  "Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", 
  "Jantar", "Ceia", "Pré-treino", "Pós-treino", "Refeição Livre"
];

const SINGLE_DAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const GROUP_DAYS = ["Todos os dias", "Segunda a Sexta", "Finais de Semana"];
const ALL_DAYS = [...GROUP_DAYS, ...SINGLE_DAYS];

type Option = { id: string; day: string; description: string; kcal: number; };
type Meal = { id: string; time: string; name: string; options: Option[]; };

interface DietBuilderProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
}

export default function DietBuilder({ patientId, patientName, onClose }: DietBuilderProps) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  
  // NOVO ESTADO: Controla qual refeição está expandida (Acordeão)
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function fetchExistingDiet() {
      setIsLoading(true);
      const { data } = await supabase.from('profiles').select('meal_plan').eq('id', patientId).single();
      
      if (data?.meal_plan && Array.isArray(data.meal_plan) && data.meal_plan.length > 0) {
        const formattedPlan = data.meal_plan.map(m => ({
          ...m,
          options: m.options.map((o: any) => ({
            ...o,
            day: o.day || "Todos os dias",
            kcal: o.kcal || 0
          }))
        }));
        setMeals(formattedPlan);
        // Expande a primeira refeição por padrão se for editar
        if (formattedPlan.length > 0) setExpandedMealId(formattedPlan[0].id);
      } else {
        const newMealId = `meal-${Date.now()}`;
        setMeals([{ 
          id: newMealId, time: '08:00', name: 'Café da Manhã', 
          options: [{ id: `opt-${Date.now()}`, day: 'Todos os dias', description: '', kcal: 0 }] 
        }]);
        setExpandedMealId(newMealId); // Expande a refeição recém-criada
      }
      setIsLoading(false);
    }
    fetchExistingDiet();
  }, [patientId, supabase]);

  // CÁLCULO TOTAL DA DIETA (Baseado na primeira opção de cada refeição)
  const totalDailyKcal = meals.reduce((acc, meal) => acc + (meal.options[0]?.kcal || 0), 0);

  // FUNÇÃO AUXILIAR: Verifica se a refeição está 100% preenchida
  const isMealComplete = (meal: Meal) => {
    if (meal.options.length === 0) return false;
    // Se todos os dias tiverem pelo menos alguma descrição e horário preenchido
    return meal.time !== '' && meal.options.every(opt => opt.description.trim() !== '');
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
      id: `meal-${Date.now()}`, time: '', name: nextMealName, 
      options: [{ id: `opt-${Date.now()}`, day: 'Todos os dias', description: '', kcal: 0 }] 
    };
    setMeals([...meals, newMeal]);
    setExpandedMealId(newMeal.id); // Auto-expande a nova refeição
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

  // NOVO: Função para desmembrar a opção "Todos os dias" em 7 dias separados
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
  };

  // NOVO: Função para Replicar dados para os dias vazios
  const duplicateToEmptyDays = (mealId: string, sourceOption: Option) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          // Se for diferente da origem e a descrição estiver vazia
          if (o.id !== sourceOption.id && o.description.trim() === '') {
            return { ...o, description: sourceOption.description, kcal: sourceOption.kcal };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
    alert('Prato copiado para os dias em branco com sucesso!');
  };

  const removeOption = (mealId: string, optionId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) return { ...m, options: m.options.filter(o => o.id !== optionId) };
      return m;
    }));
  };

  const updateOption = (mealId: string, optionId: string, field: 'day' | 'description' | 'kcal', value: string | number) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => o.id === optionId ? { ...o, [field]: value } : o);
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  const addFoodToOption = (mealId: string, optId: string, food: {name: string, kcal: number}) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id === optId) {
            const currentDesc = o.description.trim();
            const separator = currentDesc === '' ? '' : ' + ';
            return { 
              ...o, 
              description: `${currentDesc}${separator}${food.name}`,
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

  const handleSave = async () => {
    setIsSaving(true);
    setExpandedMealId(null); // Retrai tudo ao salvar para dar uma visão geral

    const cleanedMeals = meals.map(m => ({
      ...m,
      options: m.options.filter(o => o.description.trim() !== '')
    })).filter(m => m.options.length > 0);

    const { error } = await supabase.from('profiles').update({ meal_plan: cleanedMeals, status: 'plano_liberado' }).eq('id', patientId);

    if (!error) {
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    }
    setIsSaving(false);
  };

  if (isLoading) return <div className="bg-white p-10 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[400px]"><Loader2 className="animate-spin text-nutri-800" size={48} /></div>;

  return (
    <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-stone-100 flex flex-col max-h-[90vh]">
      
      {/* HEADER FIXO NO TOPO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-stone-100 pb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Utensils className="text-nutri-800" /> Montar Cardápio
          </h2>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <p className="text-stone-500 text-sm">Paciente: <b className="text-nutri-900">{patientName}</b></p>
            <div className="flex items-center gap-2 bg-stone-900 text-white px-3 py-1.5 rounded-full shadow-sm">
              <Calculator size={14} className="text-nutri-400" />
              <span className="text-xs font-bold uppercase tracking-widest">Base Diária: {totalDailyKcal} kcal</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={onClose} className="px-6 py-3 font-bold text-stone-400 hover:text-stone-600 transition-colors">Sair</button>
          <button onClick={handleSave} disabled={isSaving} className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-bold text-white transition-all ${saved ? 'bg-green-500' : 'bg-nutri-900 shadow-lg shadow-nutri-900/20 active:scale-95'}`}>
            {isSaving ? "Salvando..." : saved ? "Salvo com Sucesso!" : "Salvar Dieta"}
          </button>
        </div>
      </div>

      {/* ÁREA DE ROLAGEM: LISTA DE REFEIÇÕES */}
      <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-4">
        {meals.map((meal) => {
          const isExpanded = expandedMealId === meal.id;
          const isComplete = isMealComplete(meal);
          const mealTotalKcal = meal.options.reduce((acc, opt) => acc + opt.kcal, 0); // Soma das kcal das opções (pode ser ajustado se preferir média)

          return (
            <div 
              key={meal.id} 
              className={`rounded-[2rem] border transition-all duration-300 relative group animate-fade-in-up overflow-hidden ${
                isExpanded 
                  ? 'bg-stone-50 border-nutri-200 ring-4 ring-nutri-50 shadow-md' 
                  : isComplete 
                    ? 'bg-green-50/30 border-green-100 hover:border-green-300 hover:bg-green-50' 
                    : 'bg-white border-stone-200 hover:border-nutri-200 hover:bg-stone-50'
              }`}
            >
              {/* BOTÃO EXCLUIR REFEIÇÃO (Sempre visível no hover, seja retraído ou expandido) */}
              <button onClick={(e) => { e.stopPropagation(); removeMeal(meal.id); }} className="absolute top-4 right-4 bg-white p-2.5 rounded-full shadow-sm text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all z-10">
                <Trash2 size={16} />
              </button>

              {/* CABEÇALHO DO ACORDEÃO (Clicável para expandir/retrair) */}
              <div 
                onClick={() => setExpandedMealId(isExpanded ? null : meal.id)}
                className="p-6 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isComplete ? 'bg-green-100 text-green-700' : 'bg-white shadow-sm text-stone-400'}`}>
                    {isComplete ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{meal.time || '--:--'}</span>
                      {meal.options[0]?.kcal > 0 && !isExpanded && (
                        <span className="text-[10px] text-orange-500 font-bold bg-orange-50 px-2 py-0.5 rounded-md">~{meal.options[0]?.kcal} kcal</span>
                      )}
                    </div>
                    <h3 className={`text-xl font-bold ${isComplete && !isExpanded ? 'text-green-900' : 'text-stone-900'}`}>
                      {meal.name}
                    </h3>
                  </div>
                </div>
                
                <div className="pr-12 text-stone-400">
                  {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
              </div>

              {/* CORPO EXPANDÍVEL (Conteúdo da Refeição) */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-stone-200/50 bg-stone-50">
                  
                  {/* Edição de Horário e Nome da Refeição */}
                  <div className="flex gap-4 mb-8 mt-4">
                    <input 
                      type="time" 
                      value={meal.time} 
                      onChange={(e) => updateMeal(meal.id, 'time', e.target.value)} 
                      className="w-32 px-4 py-3 rounded-xl border border-stone-200 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-nutri-800/20 bg-white shadow-sm" 
                    />
                    <select 
                      value={meal.name}
                      onChange={(e) => updateMeal(meal.id, 'name', e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl border border-stone-200 font-bold text-stone-700 outline-none focus:ring-2 focus:ring-nutri-800/20 bg-white appearance-none shadow-sm"
                    >
                      {MEAL_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dias / Opções */}
                  <div className="space-y-6">
                    {meal.options.map((option) => (
                      <div key={option.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm relative transition-all focus-within:ring-2 focus-within:ring-nutri-100">
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <select 
                            value={option.day}
                            onChange={(e) => updateOption(meal.id, option.id, 'day', e.target.value)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wider outline-none transition-all ${
                              option.day === 'Todos os dias' ? 'bg-stone-800 text-white border-stone-800' : 'bg-nutri-50 text-nutri-800 border-nutri-200'
                            }`}
                          >
                            {ALL_DAYS.map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>

                          <div className="flex items-center gap-2">
                            {/* BOTÃO BÔNUS: REPLICAR PARA VAZIOS */}
                            {meal.options.length > 1 && option.description.trim() !== '' && (
                              <button 
                                onClick={() => duplicateToEmptyDays(meal.id, option)} 
                                title="Copiar este prato para os dias que estão em branco"
                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Copy size={14} /> Replicar p/ vazios
                              </button>
                            )}

                            <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 text-orange-600">
                              <Flame size={14} />
                              <input 
                                type="number" 
                                value={option.kcal}
                                onChange={(e) => updateOption(meal.id, option.id, 'kcal', Number(e.target.value))}
                                className="w-14 bg-transparent text-sm font-bold outline-none text-right"
                              />
                              <span className="text-xs font-medium">kcal</span>
                            </div>

                            {meal.options.length > 1 && (
                              <button onClick={() => removeOption(meal.id, option.id)} className="text-stone-300 hover:text-red-500 transition-colors p-1.5 bg-stone-50 rounded-lg border border-stone-100"><Trash2 size={16} /></button>
                            )}
                          </div>
                        </div>
                        
                        <textarea 
                          rows={3} 
                          placeholder="Descreva o prato ou clique nos botões rápidos abaixo..." 
                          value={option.description} 
                          onChange={(e) => updateOption(meal.id, option.id, 'description', e.target.value)} 
                          className="w-full px-4 py-3 rounded-xl border border-stone-100 bg-stone-50/50 text-sm text-stone-700 outline-none focus:bg-white focus:border-nutri-200 transition-all resize-none" 
                        />

                        {/* PAINEL RÁPIDO COM ALIMENTOS */}
                        <div className="mt-4 pt-4 border-t border-stone-50">
                          <div className="flex flex-wrap gap-2">
                            {quickFoods.map((cat) => (
                              <div key={cat.category} className="flex flex-wrap gap-1.5 p-2 bg-stone-50 rounded-xl border border-stone-100 w-full md:w-auto">
                                 <span className="w-full text-[9px] font-black text-stone-400 uppercase mb-1">{cat.category}</span>
                                 {cat.items.map(food => (
                                   <button
                                     key={food.name}
                                     onClick={() => addFoodToOption(meal.id, option.id, food)}
                                     className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold text-stone-600 hover:border-nutri-800 hover:bg-nutri-50 hover:text-nutri-800 transition-all active:scale-95 flex items-center gap-1"
                                     title={`${food.kcal} kcal`}
                                   >
                                     + {food.name}
                                   </button>
                                 ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* BOTÕES DE AÇÃO INFERIORES */}
                    <div className="flex flex-wrap gap-3 pt-4">
                      {/* Lógica original: adicionar dia */}
                      {!meal.options.some(opt => opt.day === "Todos os dias") && meal.options.length < 7 && (
                        <button onClick={() => addOption(meal.id)} className="flex items-center gap-2 text-xs font-bold text-stone-600 bg-white shadow-sm border border-stone-200 hover:border-nutri-300 hover:text-nutri-800 px-4 py-2.5 rounded-xl transition-all">
                          <Plus size={14} /> Adicionar outro dia da semana
                        </button>
                      )}

                      {/* BOTÃO BÔNUS: Desmembrar em 7 dias */}
                      {meal.options.length === 1 && meal.options[0].day === "Todos os dias" && (
                        <button 
                          onClick={() => splitIntoFullWeek(meal.id)} 
                          className="flex items-center gap-2 text-xs font-bold text-nutri-800 bg-nutri-50 border border-nutri-100 hover:bg-nutri-100 px-4 py-2.5 rounded-xl transition-all"
                        >
                          <CalendarRange size={14} /> Desmembrar em Segunda a Domingo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Botão para fechar o acordeão após preencher a refeição */}
                  <div className="mt-8 flex justify-center border-t border-stone-200 pt-6">
                     <button 
                       onClick={() => setExpandedMealId(null)}
                       className="flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-stone-800 transition-colors"
                     >
                       <Check size={18} /> {isComplete ? "Refeição Completa - Retrair" : "Retrair Refeição"}
                     </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={addMeal} className="w-full border-2 border-dashed border-stone-200 rounded-[2rem] py-8 flex flex-col items-center justify-center text-stone-400 hover:border-nutri-200 hover:text-nutri-800 hover:bg-nutri-50/50 transition-all group mt-6">
          <div className="bg-white p-3 rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform"><Plus size={24} /></div>
          <span className="font-bold uppercase tracking-wider text-xs">Adicionar Próxima Refeição</span>
        </button>
      </div>
    </div>
  );
}