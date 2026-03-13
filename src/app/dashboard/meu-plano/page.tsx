'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, FileText, Download, ChevronLeft, Lock, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MeuPlano() {
  const [plano, setPlano] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  
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

        // 1. Verifica se o usuário é Premium na tabela profiles e guarda os dados
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('account_type, full_name')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw new Error("Erro ao validar perfil.");

        setProfile(profileData);
        const isUserPremium = profileData?.account_type === 'premium';
        setIsPremium(isUserPremium);

        // 2. Só busca o plano no banco se ele for Premium
        if (isUserPremium) {
          const { data, error: fetchError } = await supabase
            .from('plans')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

          if (fetchError) {
            throw new Error("Erro ao buscar plano no banco de dados.");
          }

          if (data && data.length > 0) {
            setPlano(data[0]);
          } else {
            setError("Nenhum plano disponível no momento.");
          }
        }
      } catch (err: any) {
        console.error("Erro no fetchPlano:", err);
        setError(err.message || "Erro inesperado ao carregar o plano.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  // INTEGRAÇÃO COM MERCADO PAGO - GERA O LINK E REDIRECIONA
  const handleUpgradeClick = async () => {
    setProcessingCheckout(true);
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
      setProcessingCheckout(false);
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
    // Espaçamento superior corrigido (pt-[120px] md:pt-[140px]) para não colar no header
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-[120px] md:pt-[140px]">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Navegação de Topo com margem superior extra (mt-4 md:mt-8) */}
        <nav className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between pb-8 md:pb-16 mt-4 md:mt-8 gap-6 sm:gap-0 animate-fade-in-up">
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
          <div className="bg-white p-8 md:p-12 lg:p-16 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 text-center animate-fade-in-up relative overflow-hidden group" style={{ animationDelay: '0.1s' }}>
            
            <div className="absolute top-0 left-0 w-64 h-64 bg-nutri-50/50 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/3 -z-10 group-hover:bg-green-50/50 transition-colors duration-700"></div>

            {!isPremium ? (
              
              /* =========================================
                 TELA DE BLOQUEIO (PAYWALL PARA FREE)
                 ========================================= */
              <div className="flex flex-col items-center justify-center animate-fade-in">
                <div className="relative w-20 h-20 md:w-24 md:h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 border-4 border-white shadow-sm">
                  <Lock className="text-amber-500" size={36} strokeWidth={1.5} />
                  <div className="absolute inset-0 border border-amber-200 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
                </div>
                
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-4 md:mb-6 tracking-tight">
                  Conteúdo Exclusivo
                </h1>
                
                <p className="text-stone-500 text-base md:text-lg mb-10 max-w-md mx-auto leading-relaxed px-2 md:px-0">
                  O plano alimentar em PDF e as prescrições detalhadas pela Nutricionista Vanusa Zacarias são funcionalidades exclusivas do <strong className="text-stone-800">Acompanhamento Premium</strong>.
                </p>

                <button 
                  onClick={handleUpgradeClick}
                  disabled={processingCheckout}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-nutri-900 text-white px-8 md:px-10 py-4 rounded-2xl md:rounded-full font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-lg hover:shadow-nutri-900/30 transform md:hover:-translate-y-1 disabled:opacity-70"
                >
                  {processingCheckout ? <Loader2 size={22} className="animate-spin" /> : <Star size={22} />}
                  Desbloquear Acesso Premium
                </button>
              </div>

            ) : (

              /* =========================================
                 TELA NORMAL (USUÁRIO PREMIUM)
                 ========================================= */
              <>
                <div className="relative w-20 h-20 md:w-24 md:h-24 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 border-4 border-white shadow-sm group-hover:scale-105 transition-transform duration-500">
                  <FileText className="text-nutri-800" size={36} strokeWidth={1.5} />
                  <div className="absolute inset-0 border border-nutri-100 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
                </div>
                
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-4 md:mb-6 tracking-tight">
                  Seu Plano Alimentar
                </h1>
                
                <p className="text-stone-500 text-base md:text-lg mb-10 md:mb-12 max-w-md mx-auto leading-relaxed px-2 md:px-0">
                  O plano preparado pela Vanusa Zacarias está pronto. Você pode visualizar o arquivo abaixo ou fazer o download para consultar offline.
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
              </>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}