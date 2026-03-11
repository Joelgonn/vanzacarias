'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, 
  LogOut, 
  Users, 
  MessageCircle, 
  Search, 
  Filter, 
  Edit2, 
  Save, 
  X, 
  TrendingUp,
  AlertCircle,
  Bell,
  BellRing,
  Activity // Adicionado ícone de Dados Clínicos
} from 'lucide-react';
import AdminUpload from '@/components/AdminUpload';
import ClinicalDataModal from '@/components/ClinicalDataModal'; // Importando o modal que criamos
import Link from 'next/link';

export default function AdminDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Novo estado para controlar a abertura do modal de Dados Clínicos
  const [selectedPatient, setSelectedPatient] = useState<{id: string, name: string} | null>(null);
  
  const [editForm, setEditForm] = useState({ 
    data_nascimento: '', 
    sexo: '', 
    tipo_perfil: 'adulto',
    meta_peso: '' 
  });

  const router = useRouter();
  const supabase = createClient();

  async function fetchAdminData() {
    setLoading(true);
    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*');

      if (pError) throw pError;

      const { data: evals } = await supabase.from('evaluations').select('user_id, answers');

      const { data: checkins } = await supabase
        .from('checkins')
        .select('user_id, created_at')
        .order('created_at', { ascending: false });
      
      const combined = profiles?.map(profile => {
        const userCheckins = checkins?.filter(c => c.user_id === profile.id);
        const lastCheckin = userCheckins && userCheckins.length > 0 ? userCheckins[0] : null;
        
        let isLate = false;
        let daysSinceLast = 0;

        if (!lastCheckin) {
          isLate = true;
        } else {
          const lastDate = new Date(lastCheckin.created_at);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - lastDate.getTime());
          daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (daysSinceLast >= 7) isLate = true;
        }

        let isNew = false;
        if (profile.created_at) {
          const regDate = new Date(profile.created_at);
          const now = new Date();
          isNew = (now.getTime() - regDate.getTime()) < (24 * 60 * 60 * 1000);
        }

        return {
          ...profile,
          evaluation: evals?.find(e => e.user_id === profile.id),
          isLate,
          daysSinceLast,
          isNew
        };
      });
      
      setPatients(combined || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  const newPatientsCount = useMemo(() => {
    return patients.filter(p => p.isNew).length;
  }, [patients]);

  const updateProfile = async (id: string) => {
    const updateData = {
      ...editForm,
      meta_peso: editForm.meta_peso ? parseFloat(editForm.meta_peso) : null
    };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
    if (!error) {
      setEditingId(null);
      fetchAdminData();
    } else {
      alert("Erro ao atualizar perfil.");
    }
  };

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const nameMatch = p.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = statusFilter === 'todos' || p.status === statusFilter;
      return nameMatch && statusMatch;
    });
  }, [patients, searchTerm, statusFilter]);

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
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 pt-24 lg:pt-28 font-sans text-stone-800">
      <header className="flex flex-col gap-6 mb-10 bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-nutri-900">Painel Administrativo</h1>
            <p className="text-stone-500 text-sm">Gestão de Pacientes da Vanusa Zacarias</p>
          </div>
          
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <div className="relative group cursor-help" title={`${newPatientsCount} novos pacientes hoje`}>
              <Bell size={24} className={`${newPatientsCount > 0 ? 'text-nutri-800 animate-pulse' : 'text-stone-300'}`} />
              {newPatientsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {newPatientsCount}
                </span>
              )}
            </div>

            <button onClick={handleLogout} className="flex items-center gap-2 text-red-600 bg-red-50 px-5 py-2.5 rounded-xl font-medium hover:bg-red-100 transition-colors">
              <LogOut size={18} /> Sair
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar paciente..." 
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-200 focus:ring-4 focus:ring-nutri-800/10 outline-none transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-3.5 text-stone-400" size={18} />
            <select className="w-full md:w-auto pl-10 pr-10 py-3 rounded-2xl border border-stone-200 bg-white outline-none focus:ring-4 focus:ring-nutri-800/10 transition-all" onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="todos">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="plano_liberado">Plano Liberado</option>
            </select>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.map((p) => (
          <div key={p.id} className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border flex flex-col justify-between transition-all ${p.isNew ? 'border-nutri-300 ring-2 ring-nutri-50' : p.isLate ? 'border-amber-200 ring-2 ring-amber-50' : 'border-stone-100'}`}>
            {editingId === p.id ? (
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Nascimento</label>
                <input type="date" className="w-full p-3 border rounded-2xl" defaultValue={p.data_nascimento} onChange={e => setEditForm({...editForm, data_nascimento: e.target.value})} />
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Peso Meta (kg)</label>
                <input type="number" step="0.1" className="w-full p-3 border rounded-2xl" defaultValue={p.meta_peso} onChange={e => setEditForm({...editForm, meta_peso: e.target.value})} />
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Perfil</label>
                <select className="w-full p-3 border rounded-2xl" defaultValue={p.tipo_perfil} onChange={e => setEditForm({...editForm, tipo_perfil: e.target.value})}>
                  <option value="adulto">Adulto</option>
                  <option value="atleta">Atleta</option>
                  <option value="crianca">Criança</option>
                  <option value="idoso">Idoso</option>
                </select>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => updateProfile(p.id)} className="bg-nutri-900 text-white p-3 rounded-2xl flex-1 flex justify-center hover:bg-nutri-800"><Save size={20}/></button>
                  <button onClick={() => setEditingId(null)} className="bg-stone-100 text-stone-600 p-3 rounded-2xl flex-1 flex justify-center hover:bg-stone-200"><X size={20}/></button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col">
                      <Link href={`/admin/paciente/${p.id}/historico`} className="group font-bold text-lg flex items-center gap-2 text-stone-900 hover:text-nutri-800 transition-colors">
                        <Users size={18} className="text-nutri-800" /> {p.full_name || 'Sem nome'}
                        <TrendingUp size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                      {p.isNew ? (
                        <span className="flex items-center gap-1 text-[10px] text-nutri-800 font-bold uppercase mt-1">
                          <Bell size={12} fill="currentColor" /> Novo Paciente
                        </span>
                      ) : p.isLate && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold uppercase mt-1">
                          <AlertCircle size={12} /> Check-in Pendente
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${p.status === 'plano_liberado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.status || 'Pendente'}
                      </span>
                      <button onClick={() => { setEditingId(p.id); setEditForm({ data_nascimento: p.data_nascimento, sexo: p.sexo, tipo_perfil: p.tipo_perfil, meta_peso: p.meta_peso }); }} className="p-2 hover:bg-stone-100 rounded-lg transition-colors"><Edit2 size={16} className="text-stone-400" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6 bg-stone-50 p-4 rounded-2xl border border-stone-100 text-center">
                    <div><p className="text-[10px] text-stone-400 uppercase font-bold text-center">Perfil</p><p className="text-sm font-semibold text-stone-700 uppercase">{p.tipo_perfil}</p></div>
                    <div><p className="text-[10px] text-stone-400 uppercase font-bold text-center">Peso Meta</p><p className="text-sm font-semibold text-stone-700">{p.meta_peso ? `${p.meta_peso} kg` : '---'}</p></div>
                  </div>

                  {p.evaluation ? (
                    <div className="text-sm text-stone-600 bg-nutri-50/50 p-4 rounded-2xl border border-nutri-100 mb-6">
                      <p className="font-bold text-nutri-900 mb-1 text-[10px] uppercase tracking-widest">Objetivo:</p>
                      <p className="line-clamp-2 italic font-light">"{Object.values(p.evaluation.answers)[0] as string}"</p>
                    </div>
                  ) : <p className="text-xs text-stone-400 italic mb-6">Ainda não respondeu o questionário.</p>}
                </div>

                <div className="pt-4 border-t border-stone-100 flex items-center gap-2 flex-wrap">
                  <AdminUpload patientId={p.id} onUpdate={fetchAdminData} />
                  
                  <button 
                    onClick={() => setSelectedPatient({ id: p.id, name: p.full_name })}
                    className="p-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="Dados Clínicos"
                  >
                    <Activity size={20} />
                  </button>

                  <a href={`https://wa.me/55${p.phone || ''}?text=Olá%20${p.full_name?.split(' ')[0]},%20seu%20plano%20alimentar%20já%20está%20disponível!`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition-colors" title="WhatsApp"><MessageCircle size={20} /></a>
                  
                  {p.isLate && (
                    <a 
                      href={`https://wa.me/55${p.phone || ''}?text=Olá%20${p.full_name?.split(' ')[0]},%20é%20a%20Vanusa%20passando%20para%20te%20lembrar%20do%20seu%20check-in%20semanal!`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-3 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors" 
                      title="Cobrar Check-in"
                    >
                      <BellRing size={20} />
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <ClinicalDataModal 
        isOpen={!!selectedPatient} 
        onClose={() => setSelectedPatient(null)} 
        patientId={selectedPatient?.id || ''} 
        patientName={selectedPatient?.name || ''} 
      />
    </main>
  );
}