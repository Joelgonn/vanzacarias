'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, 
  CheckCircle2, 
  ClipboardList,
  TrendingDown,
  PlusCircle,
  X
} from 'lucide-react';
import Link from 'next/link';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

import CheckinForm from '@/components/CheckinForm';

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const isCheckinDoneThisWeek = useMemo(() => {
    if (checkins.length === 0) return false;
    const lastCheckinDate = new Date(checkins[checkins.length - 1].created_at);
    const now = new Date();
    const diffInTime = now.getTime() - lastCheckinDate.getTime();
    const diffInDays = diffInTime / (1000 * 3600 * 24);
    return diffInDays < 7;
  }, [checkins]);

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

    const { data: checkinData } = await supabase
      .from('checkins')
      .select('peso, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    setProfile(profileData);
    setEvaluation(evalData?.answers || null);
    setCheckins(checkinData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [router, supabase]);

  const handleCheckinSuccess = () => {
    setIsCheckinModalOpen(false);
    setLoading(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 flex font-sans text-stone-800 pt-[72px] md:pt-20">
      
      {/* SIDEBAR (Desktop) - Limpa e Minimalista */}
      <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col p-8 sticky top-20 h-[calc(100vh-80px)] z-10">
        <h2 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em] mb-10">
          Menu do Paciente
        </h2>        
        
        <nav className="flex-1 space-y-6">
          <Link href="/dashboard" className="text-nutri-800 font-bold text-sm block transition-all">
            Painel Geral
          </Link>
          <Link href="/dashboard/meu-plano" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">
            Meu Plano
          </Link>
          <Link href="/dashboard/agendamentos" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">
            Agendamentos
          </Link>
          <Link href="/dashboard/perfil" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">
            Meu Perfil
          </Link>
        </nav>
        
        <button 
          onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} 
          className="text-red-500 text-xs font-black uppercase tracking-widest hover:text-red-700 transition-colors mt-auto pt-8 border-t border-stone-100"
        >
          Sair da Conta
        </button>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <section className="flex-1 p-6 md:p-12 overflow-y-auto w-full">
        
        {/* HEADER DO PACIENTE */}
        <header className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6 animate-fade-in-up">
          <div className="text-left">
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tighter">
              Olá, {profile?.full_name?.split(' ')[0] || 'Paciente'}!
            </h2>
            <p className="text-sm md:text-base text-stone-500 mt-1">Seu progresso de saúde em tempo real.</p>
          </div>
          
          {!isCheckinDoneThisWeek ? (
            <button 
              onClick={() => setIsCheckinModalOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-nutri-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-xl shadow-nutri-900/10"
            >
              <PlusCircle size={20} />
              Fazer Check-in
            </button>
          ) : (
            <div className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-50 text-green-700 px-6 py-4 rounded-2xl font-bold border border-green-100">
              <CheckCircle2 size={20} />
              Check-in semanal realizado!
            </div>
          )}
        </header>

        {/* BLOCO DE OBJETIVO E STATUS */}
        {evaluation && (
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="bg-nutri-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity"></div>
              <h3 className="text-nutri-200 font-bold uppercase text-[10px] tracking-[0.2em] mb-4">
                Foco Principal
              </h3>
              <p className="text-2xl md:text-3xl font-light leading-snug relative z-10">
                {Object.values(evaluation)[0] as string}
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 flex flex-col justify-center">
              <h3 className="text-stone-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-4">
                Status da Análise
              </h3>
              <p className="text-base md:text-lg text-stone-600 italic leading-relaxed">
                {profile?.status === 'plano_liberado' 
                  ? "Seu protocolo personalizado já está disponível para consulta e download no menu." 
                  : "Vanusa Zacarias está analisando seu perfil para criar sua estratégia exclusiva."}
              </p>
            </div>
          </div>
        )}

        {/* SEÇÃO: GRÁFICO DE EVOLUÇÃO */}
        <div className="mb-10 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-stone-100 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 border-b border-stone-50 pb-6 gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-stone-900 flex items-center gap-3">
                <TrendingDown className="text-nutri-800" size={28} /> Minha Evolução
              </h3>
              <p className="text-sm text-stone-500 mt-1 font-medium">Histórico de peso auto-relatado.</p>
            </div>
            {profile?.meta_peso && (
              <div className="text-left sm:text-right bg-stone-50 px-6 py-3 rounded-2xl border border-stone-100 w-full sm:w-auto">
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
                  <XAxis dataKey="created_at" tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} stroke="#d6d3d1" fontSize={12} tickMargin={15} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#d6d3d1" fontSize={12} tickFormatter={(val) => `${val}kg`} axisLine={false} tickLine={false} />
                  <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} formatter={(value) => [`${value} kg`, 'Peso']} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }} />
                  <Line type="monotone" dataKey="peso" stroke="#166534" strokeWidth={5} dot={{ r: 6, fill: '#166534', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 10, strokeWidth: 0 }} animationDuration={2000} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <TrendingDown size={48} className="text-stone-200 mb-4" />
                <p className="text-stone-400 font-medium">Aguardando seu primeiro check-in.</p>
              </div>
            )}
          </div>
        </div>

        {/* CARDS DE AÇÃO RÁPIDA (Sem Ícones - Limpeza Total) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:border-nutri-200 transition-all group">
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Documentação</h4>
            <h3 className="font-bold text-stone-900 text-lg mb-4">Plano Alimentar</h3>
            {profile?.status === 'plano_liberado' ? (
              <Link href="/dashboard/meu-plano" className="text-sm text-nutri-800 font-bold group-hover:underline">Visualizar Protocolo &rarr;</Link>
            ) : (
              <p className="text-xs text-stone-500">Em fase de elaboração.</p>
            )}
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100">
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Consultas</h4>
            <h3 className="font-bold text-stone-900 text-lg mb-4">Agendamento</h3>
            <Link href="/dashboard/agendamentos" className="text-sm text-nutri-800 font-bold hover:underline">Ver disponibilidade &rarr;</Link>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100">
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Configurações</h4>
            <h3 className="font-bold text-stone-900 text-lg mb-4">Meus Dados</h3>
            <Link href="/dashboard/perfil" className="text-sm text-nutri-800 font-bold hover:underline">Editar perfil &rarr;</Link>
          </div>
        </div>

      </section>

      {/* MODAL DE CHECK-IN */}
      {isCheckinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm sm:p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-white sm:bg-transparent rounded-t-3xl sm:rounded-none">
            <button onClick={() => setIsCheckinModalOpen(false)} className="absolute top-4 right-4 sm:-top-4 sm:-right-4 md:-right-12 bg-stone-100 sm:bg-white text-stone-500 p-2 rounded-full hover:text-stone-900 shadow-lg z-10">
              <X size={20} />
            </button>
            <CheckinForm onSuccess={handleCheckinSuccess} onFormChange={() => {}} />
          </div>
        </div>
      )}

    </main>
  );
}