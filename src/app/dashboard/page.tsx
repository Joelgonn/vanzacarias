'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, CheckCircle2, TrendingDown, PlusCircle, X,
  Flame, Trophy, AlertCircle, Ruler, ArrowRight, HeartPulse, Lock, Star, Zap
} from 'lucide-react';
import Link from 'next/link';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import CheckinForm from '@/components/CheckinForm';

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [antroData, setAntroData] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    if (session.user.email === 'vankadosh@gmail.com') {
      router.push('/admin/dashboard');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, status, meta_peso, account_type, trial_ends_at, created_at')
      .eq('id', session.user.id)
      .single();

    const { data: evalData } = await supabase
      .from('evaluations')
      .select('answers')
      .eq('user_id', session.user.id)
      .single();

    const { data: checkinData } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    const { data: antro } = await supabase
      .from('anthropometry')
      .select('*')
      .eq('user_id', session.user.id)
      .order('measurement_date', { ascending: false });

    setProfile(profileData);
    setEvaluation(evalData?.answers || null);
    setCheckins(checkinData || []);
    setAntroData(antro || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [router, supabase]);

  const handleCheckinSuccess = () => {
    setIsCheckinModalOpen(false);
    setLoading(true);
    loadData();
  };

  // INTEGRAÇÃO COM MERCADO PAGO - GERA O LINK E REDIRECIONA
  const handleUpgradeClick = async () => {
    setProcessingCheckout(true);
    try {
      // 1. Pega os dados da sessão atual
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // 2. Chama a nossa API de Checkout
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

      // 3. Redireciona para o link de pagamento criptografado
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

  // ==========================================
  // LÓGICA DE GAMIFICAÇÃO & INTELIGÊNCIA
  // ==========================================

  const isCheckinDoneThisWeek = useMemo(() => {
    if (checkins.length === 0) return false;
    const lastCheckinDate = new Date(checkins[checkins.length - 1].created_at);
    const diffInDays = (new Date().getTime() - lastCheckinDate.getTime()) / (1000 * 3600 * 24);
    return diffInDays <= 7;
  }, [checkins]);

  const currentStreak = useMemo(() => {
    if (checkins.length === 0) return 0;
    const sorted = [...checkins].reverse();
    const daysSinceLatest = (new Date().getTime() - new Date(sorted[0].created_at).getTime()) / (1000 * 3600 * 24);
    if (daysSinceLatest > 10) return 0;
    
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i-1].created_at).getTime() - new Date(sorted[i].created_at).getTime()) / (1000 * 3600 * 24);
      if (diff <= 10) streak++;
      else break;
    }
    return streak;
  }, [checkins]);

  const smartFeedback = useMemo(() => {
    if (checkins.length === 0) return null;
    const last = checkins[checkins.length - 1];
    
    if (last.adesao_ao_plano >= 4) {
      return { type: 'success', title: 'Excelente foco!', text: 'Sua adesão ao plano foi ótima no último relato. Continue assim!', icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' };
    } else {
      return { type: 'support', title: 'Não desanime!', text: 'Semana difícil? Faz parte do processo. O importante é retomar o foco na próxima refeição.', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200' };
    }
  }, [checkins]);

  // ==========================================
  // LÓGICA DE FREEMIUM / ASSINATURA
  // ==========================================

  const isPremium = profile?.account_type === 'premium';
  
  const trialData = useMemo(() => {
    if (!profile) return { isActive: false, daysLeft: 0 };
    if (isPremium) return { isActive: true, daysLeft: 999 };

    let endDate = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    if (!endDate) {
      endDate = new Date(profile.created_at);
      endDate.setDate(endDate.getDate() + 30);
    }

    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      isActive: daysLeft > 0,
      daysLeft: daysLeft > 0 ? daysLeft : 0
    };
  }, [profile, isPremium]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 flex font-sans text-stone-800 pt-[72px] md:pt-20">
      
      {/* SIDEBAR (Desktop) */}
      <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col p-8 sticky top-20 h-[calc(100vh-80px)] z-10">
        <h2 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em] mb-10">Menu do Paciente</h2>        
        <nav className="flex-1 space-y-6">
          <Link href="/dashboard" className="text-nutri-800 font-bold text-sm block transition-all">Painel Geral</Link>
          <Link href="/dashboard/meu-plano" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors flex justify-between items-center">
            Meu Plano {!isPremium && <Lock size={12} className="text-stone-300"/>}
          </Link>
          <Link href="/dashboard/agendamentos" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">Agendamentos</Link>
          <Link href="/dashboard/perfil" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">Meu Perfil</Link>
        </nav>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-red-500 text-xs font-black uppercase tracking-widest hover:text-red-700 transition-colors mt-auto pt-8 border-t border-stone-100">Sair da Conta</button>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <section className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto w-full">
        
        {/* BANNER DE STATUS DA CONTA (FREE TRIAL OU EXPIRADO) */}
        {!isPremium && (
          <div className={`mb-8 p-4 md:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border animate-fade-in-up ${trialData.isActive ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className={`p-2 rounded-full ${trialData.isActive ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                {trialData.isActive ? <Zap size={20} /> : <AlertCircle size={20} />}
              </div>
              <div>
                <p className="font-bold text-sm md:text-base">
                  {trialData.isActive 
                    ? `Seu período de teste acaba em ${trialData.daysLeft} dias.` 
                    : 'Seu período de teste gratuito expirou.'}
                </p>
                <p className={`text-xs md:text-sm mt-0.5 ${trialData.isActive ? 'text-amber-700' : 'text-red-700'}`}>
                  Desbloqueie o plano alimentar completo e métricas exclusivas.
                </p>
              </div>
            </div>
            <button 
              onClick={handleUpgradeClick}
              disabled={processingCheckout}
              className="w-full sm:w-auto whitespace-nowrap bg-nutri-900 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-nutri-800 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {processingCheckout ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />} 
              Desbloquear Premium
            </button>
          </div>
        )}

        {/* HEADER E STREAK */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tighter">
                Olá, {profile?.full_name?.split(' ')[0] || 'Paciente'}!
              </h2>
              {isPremium && (
                <span className="bg-nutri-100 text-nutri-800 p-1.5 rounded-full" title="Conta Premium">
                  <Star size={16} fill="currentColor" />
                </span>
              )}
            </div>
            <p className="text-sm md:text-base text-stone-500 font-light">Seu progresso de saúde em tempo real.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {currentStreak > 0 && (
              <div className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl border border-stone-200 shadow-sm w-full sm:w-auto justify-center group">
                <div className="bg-orange-50 p-2 rounded-xl text-orange-500 group-hover:scale-110 transition-transform">
                  <Flame size={20} fill="currentColor" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Ofensiva</p>
                  <p className="font-bold text-stone-800 leading-none">{currentStreak} Semanas</p>
                </div>
              </div>
            )}

            {!isCheckinDoneThisWeek ? (
              <button 
                onClick={() => setIsCheckinModalOpen(true)} 
                disabled={!isPremium && !trialData.isActive}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-nutri-900/10 ${(!isPremium && !trialData.isActive) ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none' : 'bg-nutri-900 text-white hover:bg-nutri-800 active:scale-[0.98]'}`}
                title={!isPremium && !trialData.isActive ? 'Teste expirado' : ''}
              >
                {!isPremium && !trialData.isActive ? <Lock size={20} /> : <PlusCircle size={20} />} 
                {(!isPremium && !trialData.isActive) ? 'Check-in Bloqueado' : 'Fazer Check-in'}
              </button>
            ) : (
              <div className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-50 text-green-700 px-6 py-4 rounded-2xl font-bold border border-green-100">
                <CheckCircle2 size={20} /> Check-in Feito!
              </div>
            )}
          </div>
        </header>

        {/* FEEDBACK INTELIGENTE */}
        {smartFeedback && (
          <div className={`mb-8 p-5 md:p-6 rounded-[2rem] border ${smartFeedback.bg} ${smartFeedback.border} flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in-up`} style={{ animationDelay: '0.05s' }}>
            <div className={`p-3 bg-white rounded-2xl shadow-sm ${smartFeedback.color} shrink-0`}>
              <smartFeedback.icon size={24} />
            </div>
            <div>
              <h4 className={`font-bold text-lg mb-1 ${smartFeedback.color}`}>{smartFeedback.title}</h4>
              <p className="text-stone-600 text-sm md:text-base leading-relaxed">{smartFeedback.text}</p>
            </div>
          </div>
        )}

        {/* BLOCO DE OBJETIVO E MÉTRICAS */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          
          <div className="lg:col-span-2 bg-nutri-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group flex flex-col justify-center">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity"></div>
            <h3 className="text-nutri-200 font-bold uppercase text-[10px] tracking-[0.2em] mb-4">Foco Principal</h3>
            <p className="text-2xl md:text-3xl font-light leading-snug relative z-10">
              {evaluation ? Object.values(evaluation)[0] as string : 'Carregando objetivo...'}
            </p>
          </div>
          
          {/* Card Medidas - COM LÓGICA FREEMIUM (BLUR E CADEADO) */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="flex items-center gap-2 mb-6 text-stone-400 relative z-10">
              <Ruler size={18} />
              <h3 className="font-bold uppercase text-[10px] tracking-[0.2em]">Medida de Cintura</h3>
            </div>
            
            <div className={!isPremium ? 'filter blur-sm select-none opacity-40' : ''}>
              {antroData.length > 0 && antroData[0].waist ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-black text-stone-900">{antroData[0].waist}</span>
                    <span className="text-stone-400 font-bold">cm</span>
                  </div>
                  {antroData.length > 1 && antroData[1].waist && (
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                      Anterior: {antroData[1].waist}cm
                      {antroData[0].waist < antroData[1].waist ? (
                        <span className="text-green-500 bg-green-50 px-2 py-0.5 rounded-md ml-1">-{Math.abs(antroData[0].waist - antroData[1].waist).toFixed(1)}cm</span>
                      ) : null}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-stone-500 italic font-light">Serão atualizadas após consulta.</p>
              )}
            </div>

            {!isPremium && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px]">
                <div className="bg-white p-3 rounded-full shadow-lg border border-stone-100 text-amber-500 mb-2">
                  <Lock size={20} />
                </div>
                <span className="text-[10px] font-bold text-stone-800 uppercase tracking-widest bg-white/80 px-3 py-1 rounded-full">Exclusivo Premium</span>
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO: GRÁFICO DE EVOLUÇÃO (Sempre visível para o paciente registrar peso) */}
        <div className="mb-10 bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-stone-100 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 border-b border-stone-50 pb-6 gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-stone-900 flex items-center gap-3">
                <TrendingDown className="text-nutri-800" size={24} /> Minha Balança
              </h3>
              <p className="text-sm text-stone-500 mt-1 font-medium">Histórico de peso auto-relatado nos check-ins.</p>
            </div>
            {profile?.meta_peso && (
              <div className="text-left sm:text-right bg-stone-50 px-5 py-3 rounded-2xl border border-stone-100 w-full sm:w-auto">
                <span className="text-[10px] font-bold uppercase text-stone-400 tracking-[0.2em]">Meta de Peso</span>
                <p className="text-2xl font-black text-nutri-900 tracking-tighter">{profile.meta_peso} kg</p>
              </div>
            )}
          </div>

          <div className="h-64 md:h-80 w-full">
            {checkins.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={checkins} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                  <XAxis dataKey="created_at" tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} stroke="#d6d3d1" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#d6d3d1" fontSize={11} tickFormatter={(val) => `${val}kg`} axisLine={false} tickLine={false} />
                  <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} formatter={(value) => [`${value} kg`, 'Peso']} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                  <Line type="monotone" dataKey="peso" stroke="#166534" strokeWidth={4} dot={{ r: 5, fill: '#166534', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} animationDuration={1500} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <TrendingDown size={40} className="text-stone-200 mb-4" />
                <p className="text-stone-500 font-medium">Aguardando seu primeiro check-in.</p>
              </div>
            )}
          </div>
        </div>

        {/* CARDS DE AÇÃO RÁPIDA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          
          <Link 
            href={isPremium ? "/dashboard/meu-plano" : "#"} 
            onClick={(e) => { if(!isPremium) { e.preventDefault(); handleUpgradeClick(); } }}
            className={`p-8 rounded-[2.5rem] border transition-all group relative overflow-hidden ${isPremium ? 'bg-white shadow-sm border-stone-100 hover:border-nutri-200 hover:shadow-md' : 'bg-stone-50 border-stone-200 cursor-pointer'}`}
          >
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3 flex items-center gap-2">
              Documentação {!isPremium && <Lock size={12} className="text-amber-500" />}
            </h4>
            <h3 className={`font-bold text-lg mb-4 ${isPremium ? 'text-stone-900' : 'text-stone-500'}`}>Plano Alimentar</h3>
            <p className={`text-sm font-bold flex items-center gap-1 transition-all ${isPremium ? 'text-nutri-800 group-hover:gap-2' : 'text-stone-400'}`}>
              {isPremium ? (profile?.status === 'plano_liberado' ? 'Acessar PDF' : 'Em elaboração') : 'Desbloquear Acesso'} 
              {isPremium && <ArrowRight size={14} />}
            </p>
          </Link>

          <Link href="/dashboard/agendamentos" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:border-nutri-200 hover:shadow-md transition-all group">
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Consultas</h4>
            <h3 className="font-bold text-stone-900 text-lg mb-4">Agendamento</h3>
            <p className="text-sm text-nutri-800 font-bold flex items-center gap-1 group-hover:gap-2 transition-all">Ver horários <ArrowRight size={14} /></p>
          </Link>

          <Link href="/dashboard/perfil" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:border-nutri-200 hover:shadow-md transition-all group">
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Configurações</h4>
            <h3 className="font-bold text-stone-900 text-lg mb-4">Meus Dados</h3>
            <p className="text-sm text-nutri-800 font-bold flex items-center gap-1 group-hover:gap-2 transition-all">Editar perfil <ArrowRight size={14} /></p>
          </Link>
        </div>

      </section>

      {/* MODAL DE CHECK-IN */}
      {isCheckinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm sm:p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-white sm:bg-transparent rounded-t-[2.5rem] sm:rounded-none">
            <button onClick={() => setIsCheckinModalOpen(false)} className="absolute top-4 right-4 sm:-top-4 sm:-right-4 md:-right-12 bg-stone-100 sm:bg-white text-stone-500 p-2.5 rounded-full hover:text-stone-900 shadow-lg z-10 active:scale-95 transition-transform">
              <X size={20} />
            </button>
            <CheckinForm onSuccess={handleCheckinSuccess} onFormChange={() => {}} />
          </div>
        </div>
      )}

    </main>
  );
}