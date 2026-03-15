'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, FileText, Download, ChevronLeft, Lock, Star, Check, 
  Clock, Utensils, ChevronRight, Apple, Info, Filter
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MeuPlano() {
  const [planoPDF, setPlanoPDF] = useState<any>(null);
  const [mealPlanJSON, setMealPlanJSON] = useState<any[] | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [canAccess, setCanAccess] = useState<boolean>(false);
  const [prices, setPrices] = useState({ premium: 297.00, mealPlan: 147.00 });
  const [processingCheckout, setProcessingCheckout] = useState<string | null>(null);
  
  // NOVO: Estado para controlar o filtro de dias da semana
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('Todos');

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

        // Busca configurações do sistema (preços)
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

        // Busca o perfil do paciente
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;

        setProfile(profileData);
        
        // Verifica se o paciente tem acesso
        const hasAccess = profileData?.account_type === 'premium' || profileData?.has_meal_plan_access === true;
        setCanAccess(hasAccess);

        if (hasAccess) {
          // 1. Pega a dieta interativa (JSON do construtor)
          if (profileData?.meal_plan && Array.isArray(profileData.meal_plan)) {
            setMealPlanJSON(profileData.meal_plan);
          }

          // 2. Pega o PDF (Upload feito pela Nutri no Painel Admin)
          if (profileData?.meal_plan_pdf_url) {
            setPlanoPDF(profileData.meal_plan_pdf_url);
          } else {
            // Fallback por segurança: busca na tabela antiga de plans caso o paciente seja antigo
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

  // =========================================================================
  // LÓGICA DE FILTRAGEM POR DIAS DA SEMANA
  // =========================================================================

  // 1. Extrai todos os dias únicos usados no cardápio (ignorando "Todos os dias")
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

  // 2. Filtra as refeições com base na aba selecionada
  const filteredMeals = useMemo(() => {
    if (!mealPlanJSON) return [];
    if (selectedDayFilter === 'Todos') return mealPlanJSON;

    return mealPlanJSON.map(meal => {
      // Filtra as opções dentro desta refeição
      const filteredOptions = meal.options?.filter((opt: any) => {
        const optDay = opt.day?.trim();
        // Se a opção for "Todos os dias", ela deve aparecer sempre.
        // Se for igual ao dia selecionado, também aparece.
        return optDay?.toLowerCase() === 'todos os dias' || optDay === selectedDayFilter;
      }) || [];

      // Retorna a refeição com as opções filtradas
      return { ...meal, options: filteredOptions };
    }).filter(meal => meal.options.length > 0); // Se a refeição ficar vazia após o filtro, esconde ela.
  }, [mealPlanJSON, selectedDayFilter]);

  // =========================================================================

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  const hasAnyPlan = (mealPlanJSON && mealPlanJSON.length > 0) || !!planoPDF;

  // Blinda o URL do PDF: se vier um objeto do banco, ele extrai o link em formato de texto.
  const finalPdfUrl = typeof planoPDF === 'string' 
    ? planoPDF 
    : (planoPDF?.publicUrl || planoPDF?.file_url || planoPDF?.meal_plan_pdf_url || '#');

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-48 md:pt-60">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Navegação */}
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

            {/* BARRA DE FILTRO POR DIAS (Só aparece se tiver dias diferentes de "Todos os dias") */}
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
              // ESTADO VAZIO: Nenhum JSON e nenhum PDF
              <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-stone-100 text-center animate-fade-in-up">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Utensils className="text-stone-300" size={24} />
                </div>
                <h3 className="font-bold text-stone-900">Plano em Elaboração</h3>
                <p className="text-stone-500 text-sm mt-2">A Nutri está montando seu cardápio personalizado. Você receberá uma notificação assim que estiver pronto!</p>
              </div>
            ) : (
              <>
                {/* MOSTRA O BOTÃO DE PDF SE TIVER UPLOAD OU PLANO ANTIGO */}
                {planoPDF && finalPdfUrl !== '#' && (
                  <div className="animate-fade-in-up mb-8">
                    <a 
                      href={finalPdfUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between bg-nutri-900 text-white p-6 rounded-[2rem] shadow-xl shadow-nutri-900/20 hover:bg-nutri-800 transition-all group active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-3.5 rounded-2xl text-white">
                          <FileText size={24} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-lg mb-0.5">Baixar Meu Cardápio</p>
                          <p className="text-xs text-nutri-100 font-medium">Versão em PDF pronta para impressão</p>
                        </div>
                      </div>
                      <div className="bg-white text-nutri-900 p-3 rounded-xl group-hover:-translate-y-1 transition-transform">
                        <Download size={20} />
                      </div>
                    </a>
                  </div>
                )}

                {/* MOSTRA A LISTA INTERATIVA FILTRADA */}
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
                
                {/* Se o filtro não retornar nada (por exemplo, se der algum erro lógico, mostra um aviso amigável) */}
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
    </main>
  );
}