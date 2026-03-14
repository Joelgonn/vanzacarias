'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, MessageCircle, ChevronLeft, Clock, Loader2, CreditCard, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Agendamentos() {
  const [price, setPrice] = useState<number>(197.00);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  
  // NOVO ESTADO: O link do Calendly agora vem do banco de dados
  const [calendlyUrl, setCalendlyUrl] = useState<string>('');

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // 1. Busca as configurações (Preço da consulta e Link do Calendly)
        const { data: settings } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', 1)
          .single();

        if (settings) {
          if (settings.consultation_price) {
            setPrice(parseFloat(settings.consultation_price));
          }
          if (settings.calendly_url) {
            setCalendlyUrl(settings.calendly_url);
          }
        }

        // 2. Busca o perfil do usuário
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setProfile(profileData);
      } catch (error) {
        console.error("Erro ao carregar dados de agendamento:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase, router]);

  // INTEGRAÇÃO COM MERCADO PAGO - TIPO 'consultation'
  const handleCheckout = async () => {
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
          planType: 'consultation'
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
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-[120px] md:pt-[140px]">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        
        {/* NAVEGAÇÃO DE TOPO */}
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
        
        {/* CARD CENTRAL GERAL */}
        <div className="flex-1 flex flex-col justify-center pb-10 md:pb-0">
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 text-center animate-fade-in-up relative overflow-hidden group" style={{ animationDelay: '0.1s' }}>
            
            <div className="absolute top-0 right-0 w-64 h-64 bg-nutri-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 -z-10 group-hover:bg-green-50/50 transition-colors duration-700"></div>

            <div className="relative w-20 h-20 md:w-24 md:h-24 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 border-4 border-white shadow-sm group-hover:scale-105 transition-transform duration-500">
              <Calendar className="text-nutri-800" size={36} strokeWidth={1.5} />
              <div className="absolute inset-0 border border-nutri-100 rounded-full animate-ping opacity-20"></div>
            </div>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-4 md:mb-6 tracking-tight">
              Agendamentos
            </h1>
            
            <p className="text-stone-500 text-base md:text-lg mb-10 max-w-3xl mx-auto leading-relaxed px-2 md:px-0">
              Gerencie suas consultas de forma rápida. Faça o pagamento, escolha o melhor horário na agenda online ou chame no suporte caso precise de ajuda.
            </p>
            
            {/* GRID DE OPÇÕES (3 COLUNAS) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
              
              {/* OPÇÃO 1: PAGAMENTO */}
              <div className="flex flex-col bg-stone-50 border border-stone-200 p-6 lg:p-8 rounded-[2rem] hover:border-nutri-200 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm text-nutri-800"><CreditCard size={24} /></div>
                  <h3 className="font-bold text-lg text-stone-900">1. Pagar Consulta</h3>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-black text-stone-900">R$ {price.toFixed(2)}</span>
                </div>
                <p className="text-xs text-stone-500 mb-8 flex-1 leading-relaxed">
                  Não possui retorno ou pacote ativo? Realize o pagamento de uma nova consulta de forma segura pelo Mercado Pago.
                </p>
                <button 
                  onClick={handleCheckout}
                  disabled={processingCheckout}
                  className="w-full inline-flex items-center justify-center gap-2 bg-nutri-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-nutri-800 transition-all disabled:opacity-50 shadow-md shadow-nutri-900/10 active:scale-95 text-sm"
                >
                  {processingCheckout ? <Loader2 size={18} className="animate-spin" /> : 'Ir para Pagamento'} <ArrowRight size={16} className={processingCheckout ? 'hidden' : 'block'} />
                </button>
              </div>

              {/* OPÇÃO 2: CALENDLY (AGENDAR) */}
              <div className="flex flex-col bg-nutri-900 border border-nutri-800 p-6 lg:p-8 rounded-[2rem] relative overflow-hidden shadow-xl transform md:-translate-y-2">
                <div className="absolute top-4 right-4 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                  Agenda Oficial
                </div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="p-3 bg-nutri-800 rounded-xl shadow-inner text-amber-400"><Calendar size={24} fill="currentColor" /></div>
                  <h3 className="font-bold text-lg text-white">2. Marcar Horário</h3>
                </div>
                <div className="mb-4 relative z-10">
                  <span className="text-sm font-bold text-nutri-100 uppercase tracking-widest">Já pagou?</span>
                </div>
                <p className="text-xs text-nutri-200 mb-8 flex-1 leading-relaxed relative z-10">
                  Se o pagamento já foi feito (ou se você tem direito a retorno), clique abaixo para ver os horários disponíveis e reservar na hora.
                </p>
                
                {calendlyUrl ? (
                  <a 
                    href={calendlyUrl} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full relative z-10 inline-flex items-center justify-center gap-2 bg-amber-500 text-amber-950 px-6 py-4 rounded-xl font-bold hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 active:scale-95 text-sm"
                  >
                    Abrir Calendário <ExternalLink size={16} />
                  </a>
                ) : (
                  <button 
                    disabled
                    className="w-full relative z-10 inline-flex items-center justify-center gap-2 bg-nutri-800 text-nutri-300 px-6 py-4 rounded-xl font-bold opacity-50 cursor-not-allowed text-sm"
                  >
                    Agenda indisponível
                  </button>
                )}
                
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
              </div>

              {/* OPÇÃO 3: WHATSAPP (SUPORTE) */}
              <div className="flex flex-col bg-stone-50 border border-stone-200 p-6 lg:p-8 rounded-[2rem] hover:border-stone-300 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm text-[#25D366]"><MessageCircle size={24} /></div>
                  <h3 className="font-bold text-lg text-stone-900">3. Falar com Suporte</h3>
                </div>
                <div className="mb-4">
                  <span className="text-sm font-bold text-stone-700 uppercase tracking-widest">Dúvidas?</span>
                </div>
                <p className="text-xs text-stone-500 mb-8 flex-1 leading-relaxed">
                  Não encontrou um horário bom na agenda? Teve problema com o pagamento? Fale diretamente no WhatsApp.
                </p>
                <a 
                  href={`https://wa.me/5544999997275?text=Olá%20Vanusa,%20aqui%20é%20${profile?.full_name?.split(' ')[0] || 'o(a) paciente'}.%20Estou%20com%20uma%20dúvida%20sobre%20meu%20agendamento!`} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 bg-white border-2 border-stone-200 text-stone-700 px-6 py-4 rounded-xl font-bold hover:border-stone-300 transition-all active:scale-95 text-sm"
                >
                  Chamar no WhatsApp
                </a>
              </div>

            </div>

            <div className="flex items-center justify-center gap-2 text-stone-400 text-xs mt-10 bg-stone-50 md:bg-transparent py-2 px-4 rounded-lg md:rounded-none w-max mx-auto">
              <Clock size={16} className="shrink-0" /> 
              <span>Atendimentos confirmados recebem aviso automático.</span>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}