'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Calendar, MessageCircle, ChevronLeft, Clock, 
  Loader2, CreditCard, ArrowRight, ShieldCheck, 
  CheckCircle2, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Agendamentos() {
  const [price, setPrice] = useState<number>(197.00);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);
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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-nutri-800" size={40} />
          <p className="text-stone-400 font-medium text-sm animate-pulse">Carregando sua agenda...</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Paciente';

  return (
    <main className="min-h-screen bg-stone-50 p-4 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-[140px] md:pt-[160px]">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        
        {/* NAVEGAÇÃO E HEADER */}
        <nav className="flex items-center justify-between mb-8 mt-8 md:mt-10 animate-fade-in-up">
          <Link 
            href="/dashboard" 
            className="group flex items-center gap-2 text-stone-500 hover:text-nutri-800 transition-colors bg-white px-4 py-2.5 rounded-full border border-stone-200 shadow-sm hover:shadow-md"
          >
            <ChevronLeft size={18} />
            <span className="text-sm font-bold">Voltar ao Painel</span>
          </Link>
          <div className="hidden md:flex items-center gap-2 text-sm font-bold text-stone-400 uppercase tracking-widest">
            <Calendar size={16} /> Agendamento Online
          </div>
        </nav>

        {/* MENSAGEM DE BOAS VINDAS */}
        <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight mb-2">
            Olá, {firstName}! Vamos agendar?
          </h1>
          <p className="text-stone-500 md:text-lg max-w-2xl leading-relaxed">
            Se você já realizou o pagamento ou tem direito a um retorno, basta escolher o horário na agenda abaixo. Caso seja uma nova consulta, realize o pagamento na lateral.
          </p>
        </div>
        
        {/* CONTEÚDO PRINCIPAL (GRID 2/3 AGENDA - 1/3 PAGAMENTO/SUPORTE) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          
          {/* COLUNA ESQUERDA: CALENDÁRIO (OCUPA 2 ESPAÇOS) */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-xl shadow-stone-200/40 border border-stone-100 overflow-hidden flex flex-col h-full min-h-[600px] md:min-h-[750px] relative group">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-nutri-100 p-2.5 rounded-xl text-nutri-800">
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-stone-900 text-lg">Agenda Oficial</h2>
                  <p className="text-xs text-stone-500">Selecione o dia e horário desejado</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 size={14} /> Sincronizado
              </div>
            </div>

            <div className="flex-1 w-full bg-stone-50/30 relative">
              {calendlyUrl ? (
                // IFRAME DO CALENDLY - Incorporado na tela
                <iframe 
                  src={`${calendlyUrl}?embed_domain=${typeof window !== 'undefined' ? window.location.hostname : ''}&embed_type=Inline`} 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  className="absolute inset-0 w-full h-full"
                  title="Agendamento Calendly"
                ></iframe>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle size={32} className="text-stone-400" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-800 mb-2">Agenda Indisponível</h3>
                  <p className="text-stone-500 max-w-sm">
                    A nutri ainda não configurou o link da agenda. Por favor, entre em contato via WhatsApp para marcar seu horário.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA: PAGAMENTO E SUPORTE */}
          <div className="flex flex-col gap-6">
            
            {/* CARD DE PAGAMENTO */}
            <div className="bg-white rounded-[2rem] shadow-lg shadow-stone-200/50 border border-stone-100 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-nutri-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="bg-stone-100 p-3 rounded-2xl text-stone-700">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-stone-900">Nova Consulta</h3>
                  <p className="text-xs text-stone-500 font-medium">Pagamento Avulso</p>
                </div>
              </div>

              <div className="mb-6 relative z-10">
                <span className="text-4xl font-black text-stone-900 tracking-tight">
                  <span className="text-xl text-stone-400 font-medium mr-1">R$</span>
                  {price.toFixed(2)}
                </span>
              </div>

              <ul className="space-y-3 mb-8 relative z-10">
                <li className="flex items-start gap-2.5 text-sm text-stone-600 font-medium">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" /> 
                  Consulta online ou presencial
                </li>
                <li className="flex items-start gap-2.5 text-sm text-stone-600 font-medium">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" /> 
                  Plano alimentar personalizado
                </li>
                <li className="flex items-start gap-2.5 text-sm text-stone-600 font-medium">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" /> 
                  Acesso total ao aplicativo
                </li>
              </ul>

              <button 
                onClick={handleCheckout}
                disabled={processingCheckout}
                className="w-full relative z-10 flex items-center justify-center gap-2 bg-nutri-900 text-white px-6 py-4 rounded-xl font-extrabold hover:bg-nutri-800 transition-all disabled:opacity-70 shadow-xl shadow-nutri-900/20 active:scale-[0.98] text-sm md:text-base group"
              >
                {processingCheckout ? (
                  <><Loader2 size={20} className="animate-spin" /> Gerando Pagamento...</>
                ) : (
                  <>Pagar via Mercado Pago <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
              
              <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-stone-400">
                <ShieldCheck size={14} /> Pagamento 100% Seguro
              </div>
            </div>

            {/* CARD DE SUPORTE */}
            <div className="bg-stone-50 rounded-[2rem] border border-stone-200 p-6 hover:border-stone-300 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white p-2.5 rounded-xl shadow-sm text-[#25D366]">
                  <MessageCircle size={22} />
                </div>
                <h3 className="font-bold text-stone-900">Precisa de Ajuda?</h3>
              </div>
              <p className="text-sm text-stone-500 mb-6 leading-relaxed">
                Não achou um horário que encaixe na sua rotina? Teve problemas com o pagamento? Fale diretamente com o suporte.
              </p>
              <a 
                href={`https://wa.me/5544999997275?text=Olá,%20aqui%20é%20${firstName}.%20Estou%20no%20aplicativo%20e%20preciso%20de%20ajuda%20com%20meu%20agendamento!`} 
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-stone-200 text-stone-700 px-6 py-3.5 rounded-xl font-bold hover:border-stone-300 hover:bg-stone-50 transition-all active:scale-[0.98] text-sm"
              >
                Chamar no WhatsApp
              </a>
            </div>

            {/* AVISO RÁPIDO */}
            <div className="flex items-center gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
              <Clock size={24} className="text-blue-500 shrink-0" />
              <p className="text-xs font-medium text-blue-800 leading-relaxed">
                Ao concluir o agendamento na agenda, você receberá a confirmação por e-mail automaticamente.
              </p>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}