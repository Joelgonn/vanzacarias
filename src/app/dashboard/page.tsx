'use client';

import { useEffect, useState, useMemo } from 'react';
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
  X,
  LayoutDashboard
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

  // NOVA LÓGICA PREMIUM: Verifica se o check-in já foi realizado nos últimos 7 dias
  const isCheckinDoneThisWeek = useMemo(() => {
    if (checkins.length === 0) return false;
    
    // Pega o check-in mais recente (assumindo que o array vem ordenado por data)
    const lastCheckinDate = new Date(checkins[checkins.length - 1].created_at);
    const now = new Date();
    
    // Calcula a diferença em milissegundos e converte para dias
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
    <main className="min-h-screen bg-stone-50 flex font-sans text-stone-800 pt-[72px] md:pt-20">
      
      {/* SIDEBAR COMPLETO (Desktop) */}
      <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col p-6 sticky top-20 h-[calc(100vh-80px)] z-10">
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-8">
          Menu do Paciente
        </h2>        
        
        <nav className="flex-1 space-y-4">
          <Link href="/dashboard" className="text-nutri-800 bg-nutri-50 font-bold flex items-center gap-3 p-3 rounded-xl transition-all">
            <LayoutDashboard size={20} /> Painel Geral
          </Link>
          <Link href="/dashboard/meu-plano" className="text-stone-500 hover:text-nutri-800 font-medium flex items-center gap-3 p-3 transition-colors">
            <FileText size={20} /> Meu Plano
          </Link>
          <Link href="/dashboard/agendamentos" className="text-stone-500 hover:text-nutri-800 font-medium flex items-center gap-3 p-3 transition-colors">
            <Calendar size={20} /> Agendamentos
          </Link>
          <Link href="/dashboard/perfil" className="text-stone-500 hover:text-nutri-800 font-medium flex items-center gap-3 p-3 transition-colors">
            <User size={20} /> Meu Perfil
          </Link>
        </nav>
        
        <button 
          onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} 
          className="text-red-500 flex items-center gap-2 font-medium hover:bg-red-50 p-3 rounded-xl transition-colors mt-auto"
        >
          <LogOut size={18} /> Sair
        </button>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <section className="flex-1 p-5 md:p-8 lg:p-12 overflow-y-auto w-full max-w-full">
        
        {/* MENU RÁPIDO MOBILE (Resolve o acesso ao perfil/sair no celular) */}
        <div className="md:hidden flex overflow-x-auto gap-3 mb-8 pb-2 scrollbar-hide">
          <Link href="/dashboard/meu-plano" className="flex flex-col items-center justify-center min-w-[100px] p-4 bg-white rounded-2xl shadow-sm border border-stone-100 active:scale-95 transition-all">
            <FileText size={20} className="text-nutri-800 mb-1" />
            <span className="text-[10px] font-black uppercase text-stone-400">Plano</span>
          </Link>
          <Link href="/dashboard/agendamentos" className="flex flex-col items-center justify-center min-w-[100px] p-4 bg-white rounded-2xl shadow-sm border border-stone-100 active:scale-95 transition-all">
            <Calendar size={20} className="text-nutri-800 mb-1" />
            <span className="text-[10px] font-black uppercase text-stone-400">Agenda</span>
          </Link>
          <Link href="/dashboard/perfil" className="flex flex-col items-center justify-center min-w-[100px] p-4 bg-white rounded-2xl shadow-sm border border-stone-100 active:scale-95 transition-all">
            <User size={20} className="text-nutri-800 mb-1" />
            <span className="text-[10px] font-black uppercase text-stone-400">Perfil</span>
          </Link>
          <button 
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="flex flex-col items-center justify-center min-w-[100px] p-4 bg-white rounded-2xl shadow-sm border border-stone-100 active:scale-95 transition-all"
          >
            <LogOut size={20} className="text-red-500 mb-1" />
            <span className="text-[10px] font-black uppercase text-red-500">Sair</span>
          </button>
        </div>

        {/* HEADER DO PACIENTE */}
        <header className="mb-8 md:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6 md:gap-4 animate-fade-in-up">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight">
              Olá, {profile?.full_name?.split(' ')[0] || 'Paciente'}!
            </h2>
            <p className="text-sm md:text-base text-stone-500 mt-1">Sua jornada de saúde está em progresso.</p>
          </div>
          
          {/* LÓGICA DE EXIBIÇÃO DO BOTÃO DE CHECK-IN */}
          {!isCheckinDoneThisWeek ? (
            <button 
              onClick={() => setIsCheckinModalOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-nutri-900 text-white px-6 py-4 md:py-3 rounded-2xl md:rounded-xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-lg"
            >
              <PlusCircle size={20} />
              Fazer Check-in Semanal
            </button>
          ) : (
            <div className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-50 text-green-700 px-6 py-4 md:py-3 rounded-2xl md:rounded-xl font-bold border border-green-100 animate-fade-in">
              <CheckCircle2 size={20} />
              Check-in da semana realizado!
            </div>
          )}
        </header>

        {/* BLOCO DE OBJETIVO E STATUS */}
        {evaluation ? (
          <div className="mb-8 md:mb-10 grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="bg-nutri-900 text-white p-6 md:p-8 rounded-[2rem] shadow-xl relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity"></div>
              <h3 className="flex items-center gap-2 text-nutri-200 font-semibold uppercase text-[10px] md:text-xs tracking-[0.2em] mb-3 md:mb-4">
                <CheckCircle2 size={16} /> Foco Principal
              </h3>
              <p className="text-xl md:text-2xl font-light leading-relaxed relative z-10">
                {Object.values(evaluation)[0] as string}
              </p>
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col justify-center">
              <h3 className="flex items-center gap-2 text-stone-400 font-bold uppercase text-[10px] md:text-xs tracking-[0.2em] mb-3 md:mb-4">
                <ClipboardList size={16} /> Status da Análise
              </h3>
              <p className="text-sm md:text-base text-stone-600 italic leading-relaxed">
                {profile?.status === 'plano_liberado' 
                  ? "Sua nutri liberou seu protocolo! Acesse o menu 'Meu Plano' para visualizar e baixar seu arquivo." 
                  : "Recebemos seus dados! Vanusa está revisando as informações para personalizar sua estratégia nutricional."}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-8 md:mb-10 p-6 md:p-8 bg-amber-50 border border-amber-100 rounded-[2rem] text-amber-800 w-full animate-fade-in-up">
            <p className="text-sm md:text-base font-medium">Ainda não encontramos sua avaliação inicial.</p> 
            <Link href="/avaliacao" className="font-bold underline mt-2 inline-block">Clique aqui para responder agora</Link>
          </div>
        )}

        {/* SEÇÃO: GRÁFICO DE EVOLUÇÃO */}
        <div className="mb-8 md:mb-10 bg-white p-5 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 animate-fade-in-up w-full overflow-hidden" style={{ animationDelay: '0.2s' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 md:mb-8 border-b border-stone-100 pb-4 gap-4">
            <div>
              <h3 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2">
                <TrendingDown className="text-nutri-800" size={24} /> Minha Evolução
              </h3>
              <p className="text-xs md:text-sm text-stone-500 mt-1">Progresso corporal monitorado por data.</p>
            </div>
            {profile?.meta_peso && (
              <div className="text-left sm:text-right bg-stone-50 sm:bg-transparent p-3 sm:p-0 rounded-xl w-full sm:w-auto">
                <span className="text-[10px] md:text-xs font-bold uppercase text-stone-400 tracking-wider">Meta Definida</span>
                <p className="text-lg md:text-xl font-black text-nutri-900 tracking-tight">{profile.meta_peso} kg</p>
              </div>
            )}
          </div>

          {checkins.length > 0 ? (
            <div className="h-60 md:h-72 w-full -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={checkins} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                  <XAxis 
                    dataKey="created_at" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} 
                    stroke="#a8a29e" 
                    fontSize={11}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={['dataMin - 2', 'dataMax + 2']} 
                    stroke="#a8a29e" 
                    fontSize={11}
                    tickFormatter={(val) => `${val}kg`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')}
                    formatter={(value) => [`${value} kg`, 'Peso']}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="peso" 
                    stroke="#166534" 
                    strokeWidth={4} 
                    dot={{ r: 5, fill: '#166534', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 8, strokeWidth: 0 }} 
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-10 md:py-12 flex flex-col items-center justify-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 px-4 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <TrendingDown size={32} className="text-stone-300" />
              </div>
              <p className="text-stone-700 font-semibold mb-1">Nenhum dado registrado ainda.</p>
              <p className="text-xs md:text-sm text-stone-400 mb-6">Realize seu check-in para começar a ver sua evolução.</p>
              <button 
                onClick={() => setIsCheckinModalOpen(true)}
                className="text-nutri-800 font-bold text-sm md:text-base hover:underline active:scale-[0.98] transition-transform"
              >
                Fazer meu primeiro Check-in
              </button>
            </div>
          )}
        </div>

        {/* CARDS DE AÇÃO RÁPIDA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100 hover:shadow-md transition-shadow group">
            <div className="w-10 h-10 bg-nutri-50 rounded-xl flex items-center justify-center mb-4">
              <FileText size={20} className="text-nutri-800" />
            </div>
            <h3 className="font-bold text-stone-900 mb-2 uppercase tracking-widest text-[10px]">Plano Alimentar</h3>
            {profile?.status === 'plano_liberado' ? (
              <Link href="/dashboard/meu-plano" className="text-sm text-nutri-800 font-bold group-hover:underline">
                Acessar arquivo do protocolo &rarr;
              </Link>
            ) : (
              <p className="text-xs text-stone-500 leading-relaxed">Aguardando liberação do documento.</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
            <div className="w-10 h-10 bg-nutri-50 rounded-xl flex items-center justify-center mb-4">
              <Calendar size={20} className="text-nutri-800" />
            </div>
            <h3 className="font-bold text-stone-900 mb-2 uppercase tracking-widest text-[10px]">Próxima Consulta</h3>
            <p className="text-xs text-stone-500 leading-relaxed">Consultas agendadas aparecerão aqui.</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
            <div className="w-10 h-10 bg-nutri-50 rounded-xl flex items-center justify-center mb-4">
              <User size={20} className="text-nutri-800" />
            </div>
            <h3 className="font-bold text-stone-900 mb-2 uppercase tracking-widest text-[10px]">Suporte</h3>
            <p className="text-xs text-stone-500 leading-relaxed">Dúvidas? Utilize nossos canais de atendimento.</p>
          </div>
        </div>

      </section>

      {/* MODAL DE CHECK-IN */}
      {isCheckinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm sm:p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-white sm:bg-transparent rounded-t-3xl sm:rounded-none animate-fade-in-up sm:animate-none">
            <button 
              onClick={() => setIsCheckinModalOpen(false)}
              className="absolute top-4 right-4 sm:-top-4 sm:-right-4 md:-right-12 bg-stone-100 sm:bg-white text-stone-500 p-2 rounded-full hover:text-stone-900 sm:shadow-lg z-10 transition-colors"
            >
              <X size={20} className="sm:w-6 sm:h-6" />
            </button>
            <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 sm:hidden mb-2"></div>
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