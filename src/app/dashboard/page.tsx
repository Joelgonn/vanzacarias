'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, FileText, Calendar, LogOut, Loader2, CheckCircle2, ClipboardList, History } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [needsCheckin, setNeedsCheckin] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
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
        .select('*') // Buscando tudo para validar o Guard
        .eq('id', session.user.id)
        .single();

      // Guard: Redireciona se perfil incompleto (Telefone ou Data Nascimento)
      if (profileData && (!profileData.phone || !profileData.data_nascimento)) {
        router.push('/dashboard/completar-perfil');
        return;
      }

      const { data: evalData } = await supabase
        .from('evaluations')
        .select('answers')
        .eq('user_id', session.user.id)
        .single();

      // Verifica necessidade de check-in semanal
      const { data: checkinData } = await supabase
        .from('checkins')
        .select('created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (checkinData && checkinData.length > 0) {
        const lastDate = new Date(checkinData[0].created_at);
        const today = new Date();
        const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        setNeedsCheckin(diffDays >= 7);
      } else {
        setNeedsCheckin(true); // Se nunca fez check-in, precisa fazer
      }

      setProfile(profileData);
      setEvaluation(evalData?.answers || null);
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 flex">
      {/* Sidebar Completo */}
      <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col p-6">
        <h1 className="text-xl font-bold text-nutri-900 mb-10">Vanusa Zacarias</h1>
        <nav className="flex-1 space-y-4">
          <div className="text-nutri-800 font-medium flex items-center gap-3 bg-nutri-50 p-3 rounded-xl border border-nutri-100">
            <User size={20} /> Painel Geral
          </div>
          
          {/* Link Dinâmico de Check-in ou Histórico */}
          <Link 
            href={needsCheckin ? "/dashboard/checkin" : "/dashboard/historico"} 
            className="text-stone-500 hover:text-nutri-800 flex items-center gap-3 p-3 transition-colors"
          >
            {needsCheckin ? (
              <><ClipboardList size={20} /> Check-in Semanal</>
            ) : (
              <><History size={20} /> Consultar Histórico</>
            )}
          </Link>

          <Link href="/dashboard/meu-plano" className="text-stone-500 hover:text-nutri-800 flex items-center gap-3 p-3 transition-colors cursor-pointer">
            <FileText size={20} /> Meu Plano
          </Link>
          
          <div className="text-stone-500 hover:text-nutri-800 flex items-center gap-3 p-3 transition-colors cursor-pointer"><Calendar size={20} /> Agendamentos</div>
        </nav>
        
        <button 
          onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} 
          className="text-red-500 flex items-center gap-2 font-medium hover:bg-red-50 p-3 rounded-lg transition-colors"
        >
          <LogOut size={18} /> Sair
        </button>
      </aside>

      {/* Conteúdo Principal */}
      <section className="flex-1 p-8 md:p-12 overflow-y-auto">
        <header className="mb-10 pt-12">
          <h2 className="text-3xl font-bold text-stone-900">Olá, {profile?.full_name?.split(' ')[0] || 'Paciente'}!</h2>
          <p className="text-stone-500">Bem-vindo à sua área exclusiva de acompanhamento.</p>
        </header>

        {/* ALERTA DE CHECK-IN */}
        {needsCheckin && (
          <div className="mb-10 p-6 bg-white border-l-4 border-nutri-800 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-nutri-900">Hora do Check-in Semanal!</h3>
              <p className="text-stone-500">Ajude a Vanusa a ajustar seu plano registrando seus dados desta semana.</p>
            </div>
            <Link 
              href="/dashboard/checkin" 
              className="bg-nutri-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-nutri-800 transition-all shadow-md"
            >
              Fazer Check-in
            </Link>
          </div>
        )}

        {evaluation ? (
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-nutri-900 text-white p-8 rounded-3xl shadow-xl">
              <h3 className="flex items-center gap-2 text-nutri-200 font-medium uppercase text-xs tracking-widest mb-4">
                <CheckCircle2 size={16} /> Foco Principal
              </h3>
              <p className="text-2xl font-light leading-relaxed">{Object.values(evaluation)[0] as string}</p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
              <h3 className="flex items-center gap-2 text-stone-400 font-medium uppercase text-xs tracking-widest mb-4">
                <ClipboardList size={16} /> Status da Análise
              </h3>
              <p className="text-stone-600 italic">
                {profile?.status === 'plano_liberado' 
                  ? "A Vanusa liberou seu protocolo! Acesse a aba 'Meu Plano' no menu lateral para visualizar." 
                  : <>
                      Você completou seu questionário inicial com sucesso. A Vanusa está revisando seus dados para personalizar seu protocolo. Que tal você fazer o seu <strong>Check-in Semanal</strong> enquanto isso? Assim, quando o plano for liberado, ele já estará ainda mais alinhado com suas necessidades atuais!
                    </>
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-10 p-8 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 max-w-3xl">
            Ainda não encontramos sua avaliação. <a href="/avaliacao" className="font-bold underline">Responder questionário.</a>
          </div>
        )}

        {/* Cards de Ação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <h3 className="font-semibold mb-2">Plano Alimentar</h3>
            {profile?.status === 'plano_liberado' ? (
              <Link href="/dashboard/meu-plano" className="text-sm text-nutri-800 font-bold underline transition-all hover:text-nutri-900">
                Acessar meu plano aqui →
              </Link>
            ) : (
              <p className="text-sm text-stone-500 mb-4">Aguardando a Vanusa liberar seu protocolo.</p>
            )}
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <h3 className="font-semibold mb-2">Próxima Consulta</h3>
            <p className="text-sm text-stone-500 mb-4">Ainda sem consultas marcadas no momento.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <h3 className="font-semibold mb-2">Suporte</h3>
            <p className="text-sm text-stone-500 mb-4">Dúvidas? Fale direto com a Vanusa.</p>
          </div>
        </div>
      </section>
    </main>
  );
}