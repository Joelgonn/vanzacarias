'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, FileText, Download, ChevronLeft, Lock, Star, Check, 
  Clock, Utensils, ChevronRight, Apple, Info, Filter, ShoppingCart, X, CalendarDays
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// =========================================================================
// INTERFACES E FUNÇÕES DA LISTA DE MERCADO
// =========================================================================
interface ParsedIngredient {
  name: string;
  qty: number;
  unit: string;
  isTextOnly: boolean;
  original: string;
}

// Função inteligente que lê o texto "Arroz (100g)" e transforma em dados matemáticos
const parseDescription = (desc: string): ParsedIngredient[] => {
  if (!desc) return [];
  const parts = desc.split('+').map(s => s.trim());
  
  return parts.map(part => {
    // Busca o padrão "Nome do Alimento (Quantidade Unidade)"
    const match = part.match(/^(.*?)(?:\s*\((.*?)\))?$/);
    let name = part;
    let qty = 0;
    let unit = '';
    let isTextOnly = true;

    if (match) {
      name = match[1].trim();
      const qtyUnit = match[2] ? match[2].trim() : '';

      if (qtyUnit && !qtyUnit.toLowerCase().includes('vontade')) {
        // Separa número de letras (ex: "100g" -> 100, "g")
        const numMatch = qtyUnit.match(/^([\d.,]+)\s*(.*)$/);
        if (numMatch) {
          qty = parseFloat(numMatch[1].replace(',', '.'));
          unit = numMatch[2].trim();
          isTextOnly = false;
        } else {
          unit = qtyUnit; // Caso seja só texto como "pequena", "média"
        }
      } else if (qtyUnit.toLowerCase().includes('vontade')) {
        unit = 'à vontade';
      }
    }
    return { name, qty, unit, isTextOnly, original: part };
  });
};

export default function MeuPlano() {
  const [planoPDF, setPlanoPDF] = useState<any>(null);
  const [mealPlanJSON, setMealPlanJSON] = useState<any[] | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [canAccess, setCanAccess] = useState<boolean>(false);
  const [prices, setPrices] = useState({ premium: 297.00, mealPlan: 147.00 });
  const [processingCheckout, setProcessingCheckout] = useState<string | null>(null);
  
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('Todos');

  // NOVO: Estados para a Lista de Mercado
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [marketMultiplier, setMarketMultiplier] = useState<number>(7); // Padrão: Semanal (7 dias)

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
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
          } else {
            const { data: pdfData } = await supabase
              .from('plans')
              .select('*')
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false });

            if (pdfData && pdfData.length > 0) {
              setPlanoPDF(pdfData[0]);
            }
          }
        }
      } catch (err: any) {
        console.error("Erro no fetchData:", err);
        setError("Erro ao carregar seus dados.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  const handleUpgradeClick = async (planType: string) => {
    setProcessingCheckout(planType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

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
      if (data.init_point) window.location.href = data.init_point; 
      else throw new Error(data.error);
    } catch (error) {
      alert("Erro ao processar pagamento.");
      setProcessingCheckout(null);
    }
  };

  const filterTabs = useMemo(() => {
    if (!mealPlanJSON) return [];
    const days = new Set<string>();
    
    mealPlanJSON.forEach(meal => {
      meal.options?.forEach((opt: any) => {
        const d = opt.day?.trim();
        if (d && d.toLowerCase() !== 'todos os dias') {
          days.add(d);
        }
      });
    });
    
    return Array.from(days);
  }, [mealPlanJSON]);

  const filteredMeals = useMemo(() => {
    if (!mealPlanJSON) return [];
    if (selectedDayFilter === 'Todos') return mealPlanJSON;

    return mealPlanJSON.map(meal => {
      const filteredOptions = meal.options?.filter((opt: any) => {
        const optDay = opt.day?.trim();
        return optDay?.toLowerCase() === 'todos os dias' || optDay === selectedDayFilter;
      }) || [];

      return { ...meal, options: filteredOptions };
    }).filter(meal => meal.options.length > 0); 
  }, [mealPlanJSON, selectedDayFilter]);

  // =========================================================================
  // GERAÇÃO DA LISTA DE MERCADO
  // =========================================================================
  const marketList = useMemo(() => {
    if (!mealPlanJSON) return { measured: [], others: [] };
    const map = new Map<string, ParsedIngredient>();
    const textItems = new Set<string>();

    mealPlanJSON.forEach(meal => {
      // Para evitar que a lista fique gigante se houver várias opções na mesma refeição,
      // nós usamos a Opção 1 como base para o cálculo semanal de mercado.
      if (meal.options && meal.options.length > 0) {
        const opt = meal.options[0]; 
        
        // Determina a proporção de repetição de acordo com o dia da semana
        let localMultiplier = marketMultiplier;
        const dayStr = opt.day?.trim().toLowerCase();
        
        // Se for um dia específico (ex: "Sábado"), reduz a multiplicação
        if (dayStr && dayStr !== 'todos os dias' && dayStr !== 'opção') {
          if (marketMultiplier === 7) localMultiplier = 1;
          else if (marketMultiplier === 15) localMultiplier = 2;
          else if (marketMultiplier === 30) localMultiplier = 4;
          else if (marketMultiplier === 1) localMultiplier = 0; // Se filtra 1 dia, ignoramos se não for o dia de hoje
        }

        const parsed = parseDescription(opt.description);
        parsed.forEach(ing => {
          if (ing.isTextOnly) {
            textItems.add(ing.original);
          } else {
            const key = `${ing.name.toLowerCase()}|${ing.unit.toLowerCase()}`;
            if (map.has(key)) {
              const existing = map.get(key)!;
              existing.qty += (ing.qty * localMultiplier);
            } else {
              map.set(key, { ...ing, qty: ing.qty * localMultiplier });
            }
          }
        });
      }
    });

    return {
      measured: Array.from(map.values()).sort((a,b) => a.name.localeCompare(b.name)),
      others: Array.from(textItems)
    };
  }, [mealPlanJSON, marketMultiplier]);

  // =========================================================================

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  const hasAnyPlan = (mealPlanJSON && mealPlanJSON.length > 0) || !!planoPDF;
  const finalPdfUrl = typeof planoPDF === 'string' 
    ? planoPDF 
    : (planoPDF?.publicUrl || planoPDF?.file_url || planoPDF?.meal_plan_pdf_url || '#');

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-48 md:pt-60 relative">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        
        <nav className="flex items-center justify-between mb-12 animate-fade-in-up mt-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-stone-500 hover:text-nutri-900 transition-colors font-bold text-sm bg-white px-5 py-2.5 rounded-full border border-stone-200 shadow-sm">
            <ChevronLeft size={18} /> Painel
          </Link>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Meu Plano Alimentar</span>
        </nav>

        {!canAccess ? (
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-stone-100 text-center animate-fade-in-up">
            <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="text-stone-300" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mb-4">Acesso Bloqueado</h1>
            <p className="text-stone-500 text-sm mb-10 leading-relaxed">Seu cardápio personalizado já está disponível! Escolha uma opção para desbloquear agora mesmo.</p>
            
            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => handleUpgradeClick('premium')} disabled={!!processingCheckout} className="w-full bg-nutri-900 text-white p-5 rounded-2xl font-bold flex flex-col items-center gap-1 hover:bg-nutri-800 transition-all shadow-xl shadow-nutri-900/20">
                <span className="flex items-center gap-2"><Star size={16} fill="currentColor" className="text-amber-400"/> Plano Premium Completo</span>
                <span className="text-xs font-medium opacity-80 italic">Desbloqueia App + Cardápio por R${prices.premium.toFixed(2)}</span>
              </button>
              <button onClick={() => handleUpgradeClick('meal_plan')} disabled={!!processingCheckout} className="w-full bg-white border-2 border-stone-100 text-stone-700 p-5 rounded-2xl font-bold hover:border-nutri-800 transition-all">
                Apenas Cardápio Interativo (R${prices.mealPlan.toFixed(2)})
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            <div className="mb-6">
              <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight">O que comer hoje?</h1>
              <p className="text-stone-500 text-sm mt-1 font-medium">Siga as orientações da Nutri Vanusa para melhores resultados.</p>
            </div>

            {hasAnyPlan && filterTabs.length > 0 && (
              <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2 pt-2 animate-fade-in-up">
                <button
                  onClick={() => setSelectedDayFilter('Todos')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                    selectedDayFilter === 'Todos' 
                      ? 'bg-nutri-900 text-white shadow-md' 
                      : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Filter size={16} /> Visão Geral
                </button>
                {filterTabs.map(day => (
                  <button
                    key={day}
                    onClick={() => setSelectedDayFilter(day)}
                    className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                      selectedDayFilter === day 
                        ? 'bg-nutri-900 text-white shadow-md' 
                        : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}

            {!hasAnyPlan ? (
              <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-stone-100 text-center animate-fade-in-up">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Utensils className="text-stone-300" size={24} />
                </div>
                <h3 className="font-bold text-stone-900">Plano em Elaboração</h3>
                <p className="text-stone-500 text-sm mt-2">A Nutri está montando seu cardápio personalizado. Você receberá uma notificação assim que estiver pronto!</p>
              </div>
            ) : (
              <>
                {/* BOTÕES DE AÇÕES (PDF e MERCADO) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 animate-fade-in-up">
                  {planoPDF && finalPdfUrl !== '#' && (
                    <a 
                      href={finalPdfUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full flex flex-col justify-center bg-nutri-900 text-white p-6 rounded-[2rem] shadow-xl shadow-nutri-900/20 hover:bg-nutri-800 transition-all group active:scale-[0.98]"
                    >
                      <div className="flex justify-between items-center w-full">
                        <div className="bg-white/10 p-3 rounded-2xl text-white">
                          <FileText size={20} />
                        </div>
                        <div className="bg-white text-nutri-900 p-2 rounded-xl group-hover:-translate-y-1 transition-transform">
                          <Download size={16} />
                        </div>
                      </div>
                      <p className="font-bold text-lg mt-4 mb-0.5">Meu Cardápio</p>
                      <p className="text-xs text-nutri-100 font-medium">Baixar versão PDF</p>
                    </a>
                  )}

                  {mealPlanJSON && mealPlanJSON.length > 0 && (
                    <button 
                      onClick={() => setIsMarketModalOpen(true)}
                      className="w-full flex flex-col justify-center text-left bg-emerald-700 text-white p-6 rounded-[2rem] shadow-xl shadow-emerald-700/20 hover:bg-emerald-800 transition-all group active:scale-[0.98]"
                    >
                      <div className="flex justify-between items-center w-full">
                        <div className="bg-white/10 p-3 rounded-2xl text-white">
                          <ShoppingCart size={20} />
                        </div>
                        <div className="bg-white text-emerald-700 p-2 rounded-xl group-hover:-translate-y-1 transition-transform">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="font-bold text-lg mt-4 mb-0.5">Lista de Mercado</p>
                      <p className="text-xs text-emerald-100 font-medium">Calcular compras</p>
                    </button>
                  )}
                </div>

                {filteredMeals && filteredMeals.length > 0 && (
                  <div className="space-y-6">
                    {filteredMeals.map((refeicao: any, idx: number) => (
                      <div key={refeicao.id} className="bg-white rounded-[2rem] shadow-sm border border-stone-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                        <div className="p-6 md:p-8">
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                              <div className="bg-nutri-50 p-2.5 rounded-2xl text-nutri-800">
                                <Clock size={20} />
                              </div>
                              <div>
                                <span className="text-[10px] font-black uppercase text-nutri-800 tracking-widest">{refeicao.time}</span>
                                <h3 className="text-xl font-bold text-stone-900">{refeicao.name}</h3>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {refeicao.options.map((opcao: any, oIdx: number) => (
                              <div key={opcao.id} className="bg-stone-50 p-5 rounded-2xl border border-stone-100 relative group">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className={`text-[10px] border px-2 py-0.5 rounded font-black uppercase tracking-widest shadow-sm ${
                                    opcao.day?.toLowerCase() === 'todos os dias' 
                                      ? 'bg-nutri-50 border-nutri-100 text-nutri-800' 
                                      : 'bg-white border-stone-200 text-stone-800'
                                  }`}>
                                    {opcao.day || 'Opção'}
                                  </span>
                                  {opcao.kcal > 0 && (
                                    <span className="text-[10px] text-orange-500 font-bold lowercase">
                                      (~{opcao.kcal} kcal)
                                    </span>
                                  )}
                                </div>
                                <p className="text-stone-700 leading-relaxed text-sm md:text-base font-medium whitespace-pre-wrap">
                                  {opcao.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {filteredMeals && filteredMeals.length === 0 && selectedDayFilter !== 'Todos' && (
                   <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 text-center">
                     <p className="text-stone-500 font-medium">Nenhuma refeição específica configurada para <b>{selectedDayFilter}</b>.</p>
                     <button onClick={() => setSelectedDayFilter('Todos')} className="mt-4 text-nutri-800 font-bold text-sm hover:underline">
                       Ver cardápio completo
                     </button>
                   </div>
                )}

                <div className="bg-stone-900 p-6 rounded-[2rem] text-white flex gap-4 items-start shadow-xl mt-8">
                  <div className="bg-white/10 p-2 rounded-xl shrink-0">
                    <Info size={20} className="text-stone-300" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">Dica de Sucesso</p>
                    <p className="text-xs text-stone-400 leading-relaxed">Você pode escolher qualquer uma das opções disponíveis em cada refeição. Tente variar para não enjoar!</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL DA LISTA DE MERCADO */}
      {isMarketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 md:p-8 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 bg-emerald-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-xl">
                  <ShoppingCart size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-xl leading-tight">Lista de Mercado</h3>
                  <p className="text-xs text-emerald-100 font-medium opacity-90">Calculada baseada na Opção 1 de cada refeição</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMarketModalOpen(false)} 
                className="bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-stone-50 border-b border-stone-200 p-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 flex items-center gap-2">
                <CalendarDays size={14} /> Período de Compras
              </label>
              <div className="flex bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
                {[
                  { label: 'Diário', val: 1 },
                  { label: '7 Dias', val: 7 },
                  { label: '15 Dias', val: 15 },
                  { label: 'Mês', val: 30 }
                ].map(tab => (
                  <button 
                    key={tab.val}
                    onClick={() => setMarketMultiplier(tab.val)}
                    className={`flex-1 py-3 text-xs font-bold transition-all ${
                      marketMultiplier === tab.val 
                        ? 'bg-emerald-700 text-white' 
                        : 'text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-white flex-1 space-y-6">
              {marketList.measured.length === 0 && marketList.others.length === 0 ? (
                <div className="text-center py-10 text-stone-400">
                  <p>Não foi possível calcular a lista de mercado.</p>
                </div>
              ) : (
                <>
                  {marketList.measured.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black uppercase text-stone-400 tracking-widest mb-3 border-b border-stone-100 pb-2">Alimentos com Medidas</h4>
                      <ul className="space-y-3">
                        {marketList.measured.map((item, i) => (
                          <li key={i} className="flex justify-between items-center text-sm">
                            <span className="font-bold text-stone-700">{item.name}</span>
                            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-bold">
                              {/* Formata a quantidade para evitar números como "14.000000001" */}
                              {Number.isInteger(item.qty) ? item.qty : parseFloat(item.qty.toFixed(2))} {item.unit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {marketList.others.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black uppercase text-stone-400 tracking-widest mb-3 border-b border-stone-100 pb-2">Outros / Consumo Livre</h4>
                      <ul className="space-y-2">
                        {marketList.others.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-stone-600 font-medium">
                            <span className="text-emerald-500 mt-0.5">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="p-4 bg-stone-50 border-t border-stone-200 text-center">
               <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">
                 Dica: Leve o celular para o mercado ou tire um print!
               </p>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}