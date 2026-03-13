'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, LogOut, Users, MessageCircle, Search, Filter, 
  Edit2, Save, X, TrendingUp, AlertCircle, Bell, BellRing, 
  Activity, Target, Eye, UserPlus, Clock
} from 'lucide-react';
import AdminUpload from '@/components/AdminUpload';
import ClinicalDataModal from '@/components/ClinicalDataModal';
import Link from 'next/link';

// Mapeamento das perguntas para o Admin saber o que o paciente respondeu
const questionTitles = [
  "Objetivo Principal",
  "Condições de Saúde / Medicação",
  "Funcionamento do Intestino",
  "Nível de Energia Diário",
  "Qualidade do Sono",
  "Consumo de Água",
  "Rotina de Atividade Física",
  "Relação Emocional com a Comida",
  "Rotina e Tempo para Cozinhar",
  "Maiores Obstáculos com Dietas"
];

export default function AdminDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]); // Novo estado para os Leads
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState<'pacientes' | 'leads'>('pacientes');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{id: string, name: string} | null>(null);
  const [evalModalOpen, setEvalModalOpen] = useState<{isOpen: boolean, data: any, name: string}>({ isOpen: false, data: null, name: '' });
  
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
      // 1. Busca os Pacientes Oficiais
      const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
      if (pError) throw pError;

      const { data: evals } = await supabase.from('evaluations').select('user_id, answers');
      const { data: checkins } = await supabase.from('checkins').select('user_id, created_at').order('created_at', { ascending: false });
      
      const combined = profiles?.map(profile => {
        const userCheckins = checkins?.filter(c => c.user_id === profile.id);
        const lastCheckin = userCheckins && userCheckins.length > 0 ? userCheckins[0] : null;
        
        let isLate = false;
        let daysSinceLast = 0;

        if (!lastCheckin) {
          isLate = true;
        } else {
          const lastDate = new Date(lastCheckin.created_at);
          const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
          daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (daysSinceLast >= 7) isLate = true;
        }

        const isNew = profile.created_at ? (new Date().getTime() - new Date(profile.created_at).getTime()) < (24 * 60 * 60 * 1000) : false;

        return {
          ...profile,
          evaluation: evals?.find(e => e.user_id === profile.id),
          isLate,
          daysSinceLast,
          isNew
        };
      });
      
      setPatients(combined || []);

      // 2. Busca os Leads do Funil (Que ainda não criaram conta)
      const { data: leadsData } = await supabase
        .from('leads_avaliacao')
        .select('*')
        .neq('status', 'convertido') // Não mostra quem já virou paciente
        .order('updated_at', { ascending: false });

      setLeads(leadsData || []);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  const newPatientsCount = useMemo(() => patients.filter(p => p.isNew).length, [patients]);
  const activeLeadsCount = useMemo(() => leads.length, [leads]);

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

  const filteredLeads = useMemo(() => {
    return leads.filter(l => l.nome?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [leads, searchTerm]);

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
      
      {/* HEADER E FILTROS */}
      <header className="flex flex-col gap-6 mb-8 bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-nutri-900">Painel Administrativo</h1>
            <p className="text-stone-500 text-sm">Gestão de Pacientes & Captação</p>
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

        <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-stone-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder={activeTab === 'pacientes' ? "Buscar paciente..." : "Buscar lead..."}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-200 focus:ring-4 focus:ring-nutri-800/10 outline-none transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === 'pacientes' && (
            <div className="relative">
              <Filter className="absolute left-3 top-3.5 text-stone-400" size={18} />
              <select className="w-full md:w-auto pl-10 pr-10 py-3 rounded-2xl border border-stone-200 bg-white outline-none focus:ring-4 focus:ring-nutri-800/10 transition-all" onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="todos">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="plano_liberado">Plano Liberado</option>
              </select>
            </div>
          )}
        </div>
      </header>

      {/* ABAS (TABS) */}
      <div className="flex gap-4 mb-8 overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setActiveTab('pacientes')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${activeTab === 'pacientes' ? 'bg-nutri-900 text-white shadow-lg' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
        >
          <Users size={18} /> Meus Pacientes ({patients.length})
        </button>
        <button 
          onClick={() => setActiveTab('leads')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${activeTab === 'leads' ? 'bg-nutri-900 text-white shadow-lg' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
        >
          <Target size={18} /> Oportunidades / Leads 
          {activeLeadsCount > 0 && <span className={`ml-1 px-2 py-0.5 rounded-lg text-xs ${activeTab === 'leads' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>{activeLeadsCount}</span>}
        </button>
      </div>

      {/* CONTEÚDO: PACIENTES */}
      {activeTab === 'pacientes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
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
                          {p.status === 'plano_liberado' ? 'Liberado' : 'Pendente'}
                        </span>
                        <button onClick={() => { setEditingId(p.id); setEditForm({ data_nascimento: p.data_nascimento, sexo: p.sexo, tipo_perfil: p.tipo_perfil, meta_peso: p.meta_peso }); }} className="p-2 hover:bg-stone-100 rounded-lg transition-colors"><Edit2 size={16} className="text-stone-400" /></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6 bg-stone-50 p-4 rounded-2xl border border-stone-100 text-center">
                      <div><p className="text-[10px] text-stone-400 uppercase font-bold text-center">Perfil</p><p className="text-sm font-semibold text-stone-700 uppercase">{p.tipo_perfil}</p></div>
                      <div><p className="text-[10px] text-stone-400 uppercase font-bold text-center">Peso Meta</p><p className="text-sm font-semibold text-stone-700">{p.meta_peso ? `${p.meta_peso} kg` : '---'}</p></div>
                    </div>

                    {/* MOSTRAR AVALIAÇÃO - CORRIGIDO */}
                    {p.evaluation ? (
                      <button 
                        onClick={() => setEvalModalOpen({ isOpen: true, data: p.evaluation.answers, name: p.full_name })}
                        className="w-full flex items-center justify-between bg-nutri-50 hover:bg-nutri-100 transition-colors p-4 rounded-2xl border border-nutri-100 mb-6 group text-left"
                      >
                        <div>
                          <p className="font-bold text-nutri-900 mb-1 text-[10px] uppercase tracking-widest flex items-center gap-1"><Eye size={12}/> Ver Avaliação</p>
                          <p className="line-clamp-1 text-xs text-stone-600 italic">"{Object.values(p.evaluation.answers)[0] as string}"</p>
                        </div>
                        <ChevronRight size={16} className="text-nutri-800 opacity-50 group-hover:opacity-100" />
                      </button>
                    ) : (
                      <p className="text-xs text-stone-400 italic mb-6 bg-stone-50 p-4 rounded-2xl text-center">Sem avaliação cadastrada.</p>
                    )}
                  </div>

                  {/* AÇÕES */}
                  <div className="pt-4 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
                    <AdminUpload patientId={p.id} onUpdate={fetchAdminData} />
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedPatient({ id: p.id, name: p.full_name })}
                        className="p-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        title="Inserir Dados Clínicos"
                      >
                        <Activity size={18} />
                      </button>

                      <a href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá%20${p.full_name?.split(' ')[0]},%20tudo%20bem?`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition-colors" title="Chamar no WhatsApp"><MessageCircle size={18} /></a>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          {filteredPatients.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-stone-200">
              <p className="text-stone-400 font-medium">Nenhum paciente encontrado.</p>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO: LEADS (OPORTUNIDADES) */}
      {activeTab === 'leads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
          {filteredLeads.map((lead) => {
            const numRespostas = Object.keys(lead.respostas || {}).length;
            const progresso = (numRespostas / 10) * 100;
            const dataUltimaMexida = new Date(lead.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });

            return (
              <div key={lead.id} className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                      <UserPlus size={18} className="text-amber-500" /> {lead.nome}
                    </h3>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${lead.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                      {lead.status === 'concluido' ? 'Concluído' : 'Abandonou'}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-stone-600 mb-6 flex items-center gap-2">
                    {lead.whatsapp}
                  </p>

                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 mb-6">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-stone-400 tracking-widest mb-2">
                      <span>Progresso do Quiz</span>
                      <span className="text-nutri-800">{progresso}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full bg-nutri-800 transition-all" style={{ width: `${progresso}%` }}></div>
                    </div>
                    <p className="text-xs text-stone-500 mt-3 flex items-center gap-1">
                      <Clock size={12} /> Última ação: {dataUltimaMexida}
                    </p>
                  </div>
                </div>

                <a 
                  href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}?text=Olá%20${lead.nome.split(' ')[0]},%20aqui%20é%20da%20equipe%20da%20Nutri%20Vanusa.%20Vi%20que%20você%20começou%20nossa%20avaliação%20mas%20não%20terminou.%20Posso%20te%20ajudar%20com%20algo?`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-xl font-bold hover:bg-[#1ebd5b] active:scale-[0.98] transition-all shadow-sm"
                >
                  <MessageCircle size={18} /> Resgatar Contato
                </a>
              </div>
            );
          })}
          
          {filteredLeads.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-stone-200">
              <Target size={40} className="text-stone-300 mx-auto mb-4" />
              <p className="text-stone-500 font-medium">Nenhum lead pendente no momento.</p>
              <p className="text-sm text-stone-400 mt-1">Os contatos que não finalizarem o cadastro aparecerão aqui.</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL: VER AVALIAÇÃO COMPLETA */}
      {evalModalOpen.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            
            <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50/50">
              <div>
                <h3 className="font-bold text-xl text-stone-900 tracking-tight">Avaliação Inicial</h3>
                <p className="text-sm text-stone-500">Respostas de <span className="font-bold text-nutri-900">{evalModalOpen.name}</span></p>
              </div>
              <button onClick={() => setEvalModalOpen({ isOpen: false, data: null, name: '' })} className="bg-white text-stone-400 hover:text-stone-700 p-2 rounded-full border border-stone-200 shadow-sm transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {Object.entries(evalModalOpen.data || {}).map(([key, value]) => (
                <div key={key} className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-widest mb-1.5">
                    {questionTitles[parseInt(key)] || `Pergunta ${parseInt(key) + 1}`}
                  </p>
                  <p className="text-sm md:text-base text-stone-700 font-medium">{value as string}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      <ClinicalDataModal 
        isOpen={!!selectedPatient} 
        onClose={() => setSelectedPatient(null)} 
        patientId={selectedPatient?.id || ''} 
        patientName={selectedPatient?.name || ''} 
      />
    </main>
  );
}

// Para usar o ícone do ChevronRight no botão de avaliação
function ChevronRight(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}