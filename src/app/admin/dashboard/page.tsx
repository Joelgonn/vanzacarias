'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, LogOut, Users, MessageCircle } from 'lucide-react';
import AdminUpload from '@/components/AdminUpload';

export default function AdminDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  async function fetchAdminData() {
    setLoading(true);
    // Busca perfis incluindo o status, e avaliações associadas
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, status');
    
    const { data: evals } = await supabase
      .from('evaluations')
      .select('user_id, answers');

    const combined = profiles?.map(profile => ({
      ...profile,
      evaluation: evals?.find(e => e.user_id === profile.id)
    }));

    setPatients(combined || []);
    setLoading(false);
  }

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== 'vankadosh@gmail.com') {
        router.push('/login');
        return;
      }
      fetchAdminData();
    }
    checkAuth();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-8 md:p-12 pt-24 lg:pt-28 font-sans text-stone-800">
      <header className="flex justify-between items-center mb-10 bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
        <div>
          <h1 className="text-3xl font-bold text-nutri-900">Painel Administrativo</h1>
          <p className="text-stone-500">Gestão de Pacientes da Vanusa Zacarias</p>
        </div>
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-2 text-red-600 bg-red-50 px-5 py-2.5 rounded-xl font-medium hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} /> Sair
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {patients.map((p) => (
          <div key={p.id} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Users size={18} className="text-nutri-800" /> {p.full_name || 'Sem nome'}
                </h3>
                <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                  p.status === 'plano_liberado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {p.status || 'Pendente'}
                </span>
              </div>
              
              {p.evaluation ? (
                <div className="text-sm text-stone-600 bg-stone-50 p-4 rounded-xl border border-stone-100 mb-4">
                  <p className="font-bold text-nutri-900 mb-1">Foco Principal:</p>
                  <p className="line-clamp-2">{Object.values(p.evaluation.answers)[0] as string}</p>
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic mb-4">Ainda não respondeu o questionário.</p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2">
              <AdminUpload patientId={p.id} onUpdate={fetchAdminData} />
              
              <a 
                href={`https://wa.me/55${p.phone || ''}?text=Olá!%20Seu%20plano%20alimentar%20já%20está%20disponível%20no%20nosso%20portal.`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                title="Avisar no WhatsApp"
              >
                <MessageCircle size={20} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}