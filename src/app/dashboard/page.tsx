'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, CheckCircle2, TrendingDown, PlusCircle, X,
  Flame, Trophy, AlertCircle, Ruler, ArrowRight, HeartPulse
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
  const [antroData, setAntroData] = useState<any[]>([]); // Novo: Medidas
  const [loading, setLoading] = useState(true);
  
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);

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
      .select('full_name, status, meta_peso')
      .eq('id', session.user.id)
      .single();

    const { data: evalData } = await supabase
      .from('evaluations')
      .select('answers')
      .eq('user_id', session.user.id)
      .single();

    // Busca check-ins ordenados por data crescente para o Gráfico
    const { data: checkinData } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    // Busca medidas do paciente
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

  // ==========================================
  // LÓGICA DE GAMIFICAÇÃO & INTELIGÊNCIA
  // ==========================================

  // 1. O paciente fez check-in nos últimos 7 dias?
  const isCheckinDoneThisWeek = useMemo(() => {
    if (checkins.length === 0) return false;
    const lastCheckinDate = new Date(checkins[checkins.length - 1].created_at);
    const diffInDays = (new Date().getTime() - lastCheckinDate.getTime()) / (1000 * 3600 * 24);
    return diffInDays <= 7;
  }, [checkins]);

  // 2. Motor de Ofensiva (Streak): Semanas seguidas fazendo check-in
  const currentStreak = useMemo(() => {
    if (checkins.length === 0) return 0;
    
    // Inverte o array para olhar do mais recente pro mais antigo
    const sorted = [...checkins].reverse();
    const daysSinceLatest = (new Date().getTime() - new Date(sorted[0].created_at).getTime()) / (1000 * 3600 * 24);
    
    // Se o último check-in foi há mais de 10 dias, ele perdeu a ofensiva.
    if (daysSinceLatest > 10) return 0;
    
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i-1].created_at).getTime() - new Date(sorted[i].created_at).getTime()) / (1000 * 3600 * 24);
      // Se a diferença entre os check-ins for menor que 10 dias, conta como semana seguida
      if (diff <= 10) streak++;
      else break;
    }
    return streak;
  }, [checkins]);

  // 3. Feedback Inteligente baseado na Adesão do último check-in
  const smartFeedback = useMemo(() => {
    if (checkins.length === 0) return null;
    const last = checkins[checkins.length - 1];
    
    if (last.adesao_ao_plano >= 4) {
      return { type: 'success', title: 'Excelente foco!', text: 'Sua adesão ao plano foi ótima no último relato. Continue assim!', icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' };
    } else {
      return { type: 'support', title: 'Não desanime!', text: 'Semana difícil? Faz parte do processo. O importante é retomar o foco na próxima refeição.', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200' };
    }
  }, [checkins]);


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
          <Link href="/dashboard/meu-plano" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">Meu Plano</Link>
          <Link href="/dashboard/agendamentos" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">Agendamentos</Link>
          <Link href="/dashboard/perfil" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">Meu Perfil</Link>
        </nav>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-red-500 text-xs font-black uppercase tracking-widest hover:text-red-700 transition-colors mt-auto pt-8 border-t border-stone-100">Sair da Conta</button>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <section className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto w-full">
        
        {/* HEADER E STREAK */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
          <div className="text-left">
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tighter">
              Olá, {profile?.full_name?.split(' ')[0] || 'Paciente'}!
            </h2>
            <p className="text-sm md:text-base text-stone-500 mt-1 font-light">Seu progresso de saúde em tempo real.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* GAMIFICAÇÃO: FOGUINHO (STREAK) */}
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

            {/* BOTÃO DE CHECK-IN INTELIGENTE */}
            {!isCheckinDoneThisWeek ? (
              <button onClick={() => setIsCheckinModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-nutri-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-xl shadow-nutri-900/10">
                <PlusCircle size={20} /> Fazer Check-in
              </button>
            ) : (
              <div className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-50 text-green-700 px-6 py-4 rounded-2xl font-bold border border-green-100">
                <CheckCircle2 size={20} /> Check-in Feito!
              </div>
            )}
          </div>
        </header>

        {/* FEEDBACK INTELIGENTE (GAMIFICAÇÃO POSITIVA/NEGATIVA) */}
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
          
          {/* Card Objetivo */}
          <div className="lg:col-span-2 bg-nutri-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group flex flex-col justify-center">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity"></div>
            <h3 className="text-nutri-200 font-bold uppercase text-[10px] tracking-[0.2em] mb-4">Foco Principal</h3>
            <p className="text-2xl md:text-3xl font-light leading-snug relative z-10">
              {evaluation ? Object.values(evaluation)[0] as string : 'Carregando objetivo...'}
            </p>
          </div>
          
          {/* Card Medidas (Além da Balança) */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-6 text-stone-400">
              <Ruler size={18} />
              <h3 className="font-bold uppercase text-[10px] tracking-[0.2em]">Medida de Cintura</h3>
            </div>
            
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
              <p className="text-sm text-stone-500 italic font-light">Métricas corporais serão atualizadas após a consulta.</p>
            )}
          </div>
        </div>

        {/* SEÇÃO: GRÁFICO DE EVOLUÇÃO */}
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
          <Link href="/dashboard/meu-plano" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:border-nutri-200 hover:shadow-md transition-all group">
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Documentação</h4>
            <h3 className="font-bold text-stone-900 text-lg mb-4">Plano Alimentar</h3>
            <p className="text-sm text-nutri-800 font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
              {profile?.status === 'plano_liberado' ? 'Acessar PDF' : 'Em elaboração'} <ArrowRight size={14} />
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