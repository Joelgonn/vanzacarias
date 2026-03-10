'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  User, 
  FileText, 
  Calendar, 
  LogOut, 
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
  
  // Estado para controlar o Modal de Check-in
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    // Redirecionamento para Admin
    if (session.user.email === 'vankadosh@gmail.com') {
      router.push('/admin/dashboard');
      return;
    }

    // Busca dados do perfil
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, status, meta_peso')
      .eq('id', session.user.id)
      .single();

    // Busca a avaliação inicial
    const { data: evalData } = await supabase
      .from('evaluations')
      .select('answers')
      .eq('user_id', session.user.id)
      .single();

    // Busca o histórico de check-ins para o Gráfico
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
    loadData(); // Recarrega os dados para atualizar o gráfico instantaneamente
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
      </div>
    );
  }

  return (
    // Adicionado pt-20 para empurrar todo o painel para baixo do Header Global
    <main className="min-h-screen bg-stone-50 flex font-sans text-stone-800 pt-20">
      
      {/* SIDEBAR COMPLETO */}
      {/* Tornou-se sticky e com altura calculada para não rolar junto com a página */}
      <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col p-6 sticky top-20 h-[calc(100vh-80px)]">
        
        {/* Título alterado para evitar redundância visual com o Header superior */}
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-8">
          Menu do Paciente
        </h2>        
        
        <nav className="flex-1 space-y-4">
          <Link href="/dashboard" className="text-stone-500 hover:text-nutri-800 font-medium flex items-center gap-3 p-3">
            <User size={20} /> Painel Geral
          </Link>
          <Link href="/dashboard/meu-plano" className="text-stone-500 hover:text-nutri-800 font-medium flex items-center gap-3 p-3">
            <FileText size={20} /> Meu Plano
          </Link>
          {/* AQUI ESTÁ A MÁGICA: */}
          <Link href="/dashboard/agendamentos" className="text-stone-500 hover:text-nutri-800 font-medium flex items-center gap-3 p-3">
            <Calendar size={20} /> Agendamentos
          </Link>
          <Link href="/dashboard/perfil" className="text-stone-500 hover:text-nutri-800 font-medium flex items-center gap-3 p-3">
            <User size={20} /> Meu Perfil
          </Link>
        </nav>
        
        <button 
          onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} 
          className="text-red-500 flex items-center gap-2 font-medium hover:bg-red-50 p-3 rounded-lg transition-colors mt-auto"
        >
          <LogOut size={18} /> Sair
        </button>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <section className="flex-1 p-8 md:p-12 overflow-y-auto">
        
        {/* HEADER DO PACIENTE (Sem pt-12 porque a main já deu o respiro) */}
        <header className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Olá, {profile?.full_name?.split(' ')[0] || 'Paciente'}!</h2>
            <p className="text-stone-500 mt-1">Bem-vindo à sua área exclusiva de acompanhamento.</p>
          </div>
          
          <button 
            onClick={() => setIsCheckinModalOpen(true)}
            className="flex items-center gap-2 bg-nutri-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-nutri-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <PlusCircle size={18} />
            Fazer Check-in Semanal
          </button>
        </header>

        {/* BLOCO DE OBJETIVO E STATUS */}
        {evaluation ? (
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-nutri-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
              <h3 className="flex items-center gap-2 text-nutri-200 font-medium uppercase text-xs tracking-widest mb-4">
                <CheckCircle2 size={16} /> Foco Principal
              </h3>
              <p className="text-2xl font-light leading-relaxed relative z-10">
                {Object.values(evaluation)[0] as string}
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
              <h3 className="flex items-center gap-2 text-stone-400 font-bold uppercase text-xs tracking-widest mb-4">
                <ClipboardList size={16} /> Status da Análise
              </h3>
              <p className="text-stone-600 italic leading-relaxed">
                {profile?.status === 'plano_liberado' 
                  ? "A Vanusa liberou seu protocolo! Acesse a aba 'Meu Plano' no menu lateral para visualizar e baixar." 
                  : "Você completou seu questionário inicial com sucesso. A Vanusa está revisando seus dados para personalizar seu protocolo."}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-10 p-8 bg-amber-50 border border-amber-100 rounded-3xl text-amber-800 max-w-3xl">
            Ainda não encontramos sua avaliação inicial. <Link href="/avaliacao" className="font-bold underline">Responder questionário aqui.</Link>
          </div>
        )}

        {/* SEÇÃO: GRÁFICO DE EVOLUÇÃO */}
        <div className="mb-10 bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
          <div className="flex justify-between items-end mb-8 border-b border-stone-100 pb-4">
            <div>
              <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                <TrendingDown className="text-nutri-800" /> Minha Evolução de Peso
              </h3>
              <p className="text-sm text-stone-500 mt-1">Acompanhe seu progresso através dos check-ins semanais.</p>
            </div>
            {profile?.meta_peso && (
              <div className="text-right">
                <span className="text-xs font-bold uppercase text-stone-400 tracking-wider">Meta</span>
                <p className="text-xl font-bold text-nutri-900">{profile.meta_peso} kg</p>
              </div>
            )}
          </div>

          {checkins.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={checkins} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                  <XAxis 
                    dataKey="created_at" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} 
                    stroke="#a8a29e" 
                    fontSize={12}
                    tickMargin={10}
                  />
                  <YAxis 
                    domain={['dataMin - 2', 'dataMax + 2']} 
                    stroke="#a8a29e" 
                    fontSize={12}
                    tickFormatter={(val) => `${val}kg`}
                  />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')}
                    formatter={(value) => [`${value} kg`, 'Peso']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="peso" 
                    stroke="#166534" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#166534', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 8 }} 
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              <TrendingDown size={40} className="text-stone-300 mb-4" />
              <p className="text-stone-500 font-medium">Nenhum dado registrado ainda.</p>
              <p className="text-sm text-stone-400 mb-6">Faça seu primeiro check-in para começar a ver seu gráfico.</p>
              <button 
                onClick={() => setIsCheckinModalOpen(true)}
                className="text-nutri-800 font-bold hover:underline"
              >
                Fazer meu primeiro Check-in
              </button>
            </div>
          )}
        </div>

        {/* CARDS DE AÇÃO RÁPIDA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow group">
            <h3 className="font-bold text-stone-900 mb-2">Plano Alimentar</h3>
            {profile?.status === 'plano_liberado' ? (
              <Link href="/dashboard/meu-plano" className="text-sm text-nutri-800 font-bold group-hover:underline">
                Acessar meu plano aqui →
              </Link>
            ) : (
              <p className="text-sm text-stone-500">Aguardando a Vanusa liberar seu protocolo.</p>
            )}
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
            <h3 className="font-bold text-stone-900 mb-2">Próxima Consulta</h3>
            <p className="text-sm text-stone-500">Ainda sem consultas marcadas no momento.</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
            <h3 className="font-bold text-stone-900 mb-2">Suporte</h3>
            <p className="text-sm text-stone-500">Dúvidas? Fale direto com a Vanusa.</p>
          </div>
        </div>

      </section>

      {/* MODAL DE CHECK-IN */}
      {isCheckinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg">
            <button 
              onClick={() => setIsCheckinModalOpen(false)}
              className="absolute -top-4 -right-4 md:-right-12 bg-white text-stone-500 p-2 rounded-full hover:text-stone-900 shadow-lg z-10"
            >
              <X size={24} />
            </button>
            
            <CheckinForm 
              onSuccess={handleCheckinSuccess} 
              onFormChange={() => {}} 
            />
          </div>
        </div>
      )}

    </main>
  );
}