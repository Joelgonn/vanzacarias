'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, FileText, Download, ChevronLeft, Lock, Star, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MeuPlano() {
  const [plano, setPlano] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Novos estados para gerenciar acessos e preços
  const [canAccess, setCanAccess] = useState<boolean>(false);
  const [prices, setPrices] = useState({ premium: 297.00, mealPlan: 147.00 });
  const [processingCheckout, setProcessingCheckout] = useState<string | null>(null);
  
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

        // 1. Busca os preços (Usando * para não quebrar se a coluna faltar)
        const { data: settings, error: settingsError } = await supabase
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

        // 2. Verifica as permissões (Usando * para não quebrar se faltar has_meal_plan_access)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error("ERRO DO SUPABASE NO PERFIL:", profileError);
          throw new Error("Erro de comunicação com o banco de dados.");
        }

        setProfile(profileData);
        
        // Verifica se é Premium OU se comprou o plano avulso (se a coluna não existir, será undefined/false)
        const hasAccess = profileData?.account_type === 'premium' || profileData?.has_meal_plan_access === true;
        setCanAccess(hasAccess);

        // 3. Só busca o PDF no banco se ele tiver permissão
        if (hasAccess) {
          const { data, error: fetchError } = await supabase
            .from('plans')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

          if (fetchError) {
            console.error("ERRO AO BUSCAR PLANO:", fetchError);
            throw new Error("Erro ao buscar plano no banco de dados.");
          }

          if (data && data.length > 0) {
            setPlano(data[0]);
          } else {
            setError("Seu plano ainda está sendo elaborado. Volte em breve!");
          }
        }
      } catch (err: any) {
        console.error("Erro no fetchPlano:", err);
        setError(err.message || "Erro inesperado ao carregar os dados.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  // INTEGRAÇÃO COM MERCADO PAGO
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        throw new Error(data.error || 'Erro ao gerar link de pagamento');
      }
    } catch (error) {
      console.error(error);
      alert("Não foi possível iniciar o pagamento. Tente novamente mais tarde.");
      setProcessingCheckout(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-[120px] md:pt-[140px]">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Navegação de Topo */}
        <nav className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between pb-8 md:pb-12 mt-4 md:mt-8 gap-6 sm:gap-0 animate-fade-in-up">
          <Link 
            href="/dashboard" 
            className="group w-full sm:w-auto flex items-center justify-center sm:justify-start gap-3 bg-white px-6 py-4 sm:py-3 rounded-2xl sm:rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 active:scale-[0.98] transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1.5 sm:p-1 rounded-xl sm:rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          
          <div className="w-full sm:w-auto text-center sm:text-right text-xs md:text-sm font-bold text-stone-400 md:text-stone-900 uppercase md:normal-case tracking-widest md:tracking-tight">
            Vanusa Zacarias Nutrição
          </div>
        </nav>

        {/* Card de Conteúdo Principal */}
        <div className="flex-1 flex flex-col justify-center pb-10 md:pb-0">
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 animate-fade-in-up relative overflow-hidden group" style={{ animationDelay: '0.1s' }}>
            
            <div className="absolute top-0 left-0 w-64 h-64 bg-nutri-50/50 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/3 -z-10 group-hover:bg-green-50/50 transition-colors duration-700"></div>

            {!canAccess ? (
              
              /* =========================================
                 TELA DE BLOQUEIO / VENDAS (PAYWALL)
                 ========================================= */
              <div className="flex flex-col items-center animate-fade-in w-full">
                <div className="relative w-20 h-20 md:w-24 md:h-24 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 border-4 border-white shadow-sm">
                  <Lock className="text-stone-400" size={36} strokeWidth={1.5} />
                </div>
                
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-4 tracking-tight text-center">
                  Plano Alimentar Bloqueado
                </h1>
                
                <p className="text-stone-500 text-base md:text-lg mb-10 max-w-xl mx-auto leading-relaxed text-center">
                  Para visualizar seu cardápio e baixar o arquivo em PDF, escolha uma das opções de desbloqueio abaixo.
                </p>

                {/* Opções de Compra em Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                  
                  {/* OPÇÃO 1: APENAS O PLANO (Compra Avulsa) */}
                  <div className="flex flex-col bg-stone-50 border border-stone-200 p-8 rounded-[2rem] hover:border-nutri-200 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-white rounded-xl shadow-sm text-nutri-800"><FileText size={24} /></div>
                      <h3 className="font-bold text-xl text-stone-900">Apenas o Plano</h3>
                    </div>
                    <div className="mb-6">
                      <span className="text-3xl font-black text-stone-900">R$ {prices.mealPlan.toFixed(2)}</span>
                      <span className="text-stone-400 text-sm ml-1">/ pagamento único</span>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-start gap-2 text-sm text-stone-600"><Check size={16} className="text-nutri-800 mt-0.5 shrink-0"/> Acesso vitalício ao PDF atual</li>
                      <li className="flex items-start gap-2 text-sm text-stone-600"><Check size={16} className="text-nutri-800 mt-0.5 shrink-0"/> Orientações alimentares básicas</li>
                    </ul>
                    <button 
                      onClick={() => handleUpgradeClick('meal_plan')}
                      disabled={processingCheckout !== null}
                      className="w-full inline-flex items-center justify-center gap-2 bg-white border-2 border-stone-200 text-stone-700 px-6 py-4 rounded-xl font-bold hover:border-nutri-800 hover:text-nutri-900 transition-all disabled:opacity-50"
                    >
                      {processingCheckout === 'meal_plan' ? <Loader2 size={20} className="animate-spin" /> : 'Comprar Acesso Avulso'}
                    </button>
                  </div>

                  {/* OPÇÃO 2: PREMIUM COMPLETO (Upsell Recomendado) */}
                  <div className="flex flex-col bg-nutri-900 border border-nutri-800 p-8 rounded-[2rem] relative overflow-hidden shadow-xl transform md:-translate-y-2">
                    <div className="absolute top-4 right-4 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                      Recomendado
                    </div>
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                      <div className="p-3 bg-nutri-800 rounded-xl shadow-inner text-amber-400"><Star size={24} fill="currentColor" /></div>
                      <h3 className="font-bold text-xl text-white">Premium Completo</h3>
                    </div>
                    <div className="mb-6 relative z-10">
                      <span className="text-3xl font-black text-white">R$ {prices.premium.toFixed(2)}</span>
                      <span className="text-nutri-200 text-sm ml-1">/ pagamento único</span>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1 relative z-10">
                      <li className="flex items-start gap-2 text-sm text-nutri-100"><Check size={16} className="text-amber-400 mt-0.5 shrink-0"/> Acesso ao Plano Alimentar (PDF)</li>
                      <li className="flex items-start gap-2 text-sm text-nutri-100"><Check size={16} className="text-amber-400 mt-0.5 shrink-0"/> Check-ins semanais liberados</li>
                      <li className="flex items-start gap-2 text-sm text-nutri-100"><Check size={16} className="text-amber-400 mt-0.5 shrink-0"/> Gráficos e histórico de evolução</li>
                    </ul>
                    <button 
                      onClick={() => handleUpgradeClick('premium')}
                      disabled={processingCheckout !== null}
                      className="w-full relative z-10 inline-flex items-center justify-center gap-2 bg-amber-500 text-amber-950 px-6 py-4 rounded-xl font-bold hover:bg-amber-400 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                    >
                      {processingCheckout === 'premium' ? <Loader2 size={20} className="animate-spin" /> : 'Desbloquear Premium'}
                    </button>
                    {/* Efeito de brilho de fundo no card premium */}
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
                  </div>

                </div>
              </div>

            ) : (

              /* =========================================
                 TELA NORMAL (ACESSO LIBERADO)
                 ========================================= */
              <div className="text-center">
                <div className="relative w-20 h-20 md:w-24 md:h-24 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 border-4 border-white shadow-sm group-hover:scale-105 transition-transform duration-500">
                  <FileText className="text-nutri-800" size={36} strokeWidth={1.5} />
                  <div className="absolute inset-0 border border-nutri-100 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
                </div>
                
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-4 md:mb-6 tracking-tight">
                  Seu Plano Alimentar
                </h1>
                
                <p className="text-stone-500 text-base md:text-lg mb-10 md:mb-12 max-w-md mx-auto leading-relaxed px-2 md:px-0">
                  O cardápio preparado pela Nutricionista Vanusa Zacarias está pronto. Você pode visualizar o arquivo abaixo ou fazer o download para consultar offline.
                </p>

                {error ? (
                  <div className="bg-amber-50 text-amber-800 p-6 md:p-8 rounded-2xl md:rounded-[2rem] border border-amber-100/50 max-w-sm mx-auto shadow-sm animate-fade-in">
                    <p className="font-medium text-sm md:text-base leading-relaxed">{error}</p>
                  </div>
                ) : plano ? (
                  <div className="flex flex-col gap-4 items-center w-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <a 
                      href={plano.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-nutri-900 text-white px-8 md:px-10 py-4 rounded-2xl md:rounded-full font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-lg hover:shadow-nutri-900/30 transform md:hover:-translate-y-1"
                    >
                      <Download size={22} />
                      Baixar / Visualizar PDF
                    </a>
                    <p className="text-[10px] md:text-xs text-stone-400 mt-4 md:mt-6 font-bold uppercase tracking-widest bg-stone-50 py-2 px-4 rounded-xl">
                      Última atualização: {new Date(plano.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}