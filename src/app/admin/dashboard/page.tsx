'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, LogOut, Users, MessageCircle, Search, Filter, 
  Edit2, Save, X, TrendingUp, AlertCircle, Bell, BellRing, 
  Activity, Target, Eye, UserPlus, Clock, ChevronRight, Star,
  DollarSign, CreditCard, Settings, FileText, Calendar, Link2, Copy, Check, ExternalLink
} from 'lucide-react';
import AdminUpload from '@/components/AdminUpload';
import ClinicalDataModal from '@/components/ClinicalDataModal';
import Link from 'next/link';

// Mapeamento das perguntas do Quiz
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
  const [leads, setLeads] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // Estados de Filtros e Abas (Adicionado a aba 'agenda')
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [lastSeenNewPatientTime, setLastSeenNewPatientTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'pacientes' | 'leads' | 'agenda' | 'financeiro'>('pacientes');
  
  // Estados de Edição de Paciente
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{id: string, name: string} | null>(null);
  const [evalModalOpen, setEvalModalOpen] = useState<{isOpen: boolean, data: any, name: string}>({ isOpen: false, data: null, name: '' });
  
  // Estado do Financeiro e Configurações
  const [premiumPrice, setPremiumPrice] = useState('297.00');
  const [mealPlanPrice, setMealPlanPrice] = useState('147.00');
  const [consultationPrice, setConsultationPrice] = useState('197.00');
  const [calendlyUrl, setCalendlyUrl] = useState('https://calendly.com/seu-link-aqui'); // Novo estado para o link
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Estado do formulário de edição
  const [editForm, setEditForm] = useState({ 
    data_nascimento: '', 
    sexo: '', 
    tipo_perfil: 'adulto',
    meta_peso: '',
    account_type: 'free',
    has_meal_plan_access: false
  });

  const router = useRouter();
  const supabase = createClient();

  async function fetchAdminData() {
    setLoading(true);
    try {
      // 1. Busca Configurações do Sistema
      const { data: settings } = await supabase.from('system_settings').select('*').eq('id', 1).single();
      if (settings) {
        if (settings.premium_price) setPremiumPrice(settings.premium_price.toString());
        if (settings.meal_plan_price) setMealPlanPrice(settings.meal_plan_price.toString());
        if (settings.consultation_price) setConsultationPrice(settings.consultation_price.toString());
        if (settings.calendly_url) setCalendlyUrl(settings.calendly_url);
      }

      // 2. Busca os Pacientes Oficiais
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

        // --- Lógica à prova de falhas para Novo Paciente ---
        let isNew = false;
        if (profile.created_at) {
          const now = new Date();
          const createdDate = new Date(profile.created_at);          
         
          const diffInHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);          
          
          isNew = diffInHours >= 0 && diffInHours <= 24;
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

      // 3. Busca os Leads do Funil
      const { data: leadsData } = await supabase
        .from('leads_avaliacao')
        .select('*')
        .neq('status', 'convertido')
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
  
  const unseenPatientsCount = useMemo(() => {
    return patients.filter(p => p.isNew && new Date(p.created_at).getTime() > lastSeenNewPatientTime).length;
  }, [patients, lastSeenNewPatientTime]);

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

  // Salvar Configurações (Preços + Calendly)
  const handleSaveSettings = async () => {
    setIsSavingPrice(true);
    
    const updatePayload: any = { 
      premium_price: parseFloat(premiumPrice) 
    };
    
    try {
      updatePayload.meal_plan_price = parseFloat(mealPlanPrice);
      updatePayload.consultation_price = parseFloat(consultationPrice);
      updatePayload.calendly_url = calendlyUrl;
    } catch(e) {}

    const { error } = await supabase
      .from('system_settings')
      .update(updatePayload)
      .eq('id', 1);

    if (!error) {
      alert("Configurações atualizadas com sucesso!");
    } else {
      console.error(error);
      alert("Erro ao salvar configurações.");
    }
    setIsSavingPrice(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(calendlyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const nameMatch = p.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = statusFilter === 'todos' || p.status === statusFilter;
      const newMatch = showOnlyNew ? p.isNew : true;
      return nameMatch && statusMatch && newMatch;
    });
  }, [patients, searchTerm, statusFilter, showOnlyNew]);

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

    const savedTime = localStorage.getItem('last_seen_patient_time');
    if (savedTime) {
      setLastSeenNewPatientTime(parseInt(savedTime, 10));
    }
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleBellClick = () => {
    setShowOnlyNew(!showOnlyNew);
    setActiveTab('pacientes'); 
    
    // SALVAR NA MEMÓRIA: Pega a data do paciente novo mais recente e salva
    const newPats = patients.filter(p => p.isNew);
    if (newPats.length > 0) {
      const maxTime = Math.max(...newPats.map(p => new Date(p.created_at).getTime()));
      localStorage.setItem('last_seen_patient_time', maxTime.toString());
      setLastSeenNewPatientTime(maxTime);
    }
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
            
            {/* SININHO DO TOPO */}
            <button 
              onClick={handleBellClick}
              className={`relative group p-2 rounded-full transition-all ${showOnlyNew ? 'bg-nutri-100' : 'hover:bg-stone-100'}`}
              title={showOnlyNew ? "Remover filtro de novos pacientes" : "Mostrar novos pacientes"}
            >
              <Bell 
                size={24} 
                className={`${unseenPatientsCount > 0 ? 'text-nutri-800 animate-bounce' : showOnlyNew ? 'text-nutri-800' : 'text-stone-400'}`} 
              />
              {unseenPatientsCount > 0 && (
                <span className="absolute -top-0 -right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {unseenPatientsCount}
                </span>
              )}
            </button>

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
              placeholder={activeTab === 'pacientes' ? "Buscar paciente..." : activeTab === 'leads' ? "Buscar lead..." : "Buscar..."}
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

      {/* ABAS DO SISTEMA */}
      <div className="flex gap-4 mb-8 overflow-x-auto scrollbar-hide pb-2">
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
        <button 
          onClick={() => setActiveTab('agenda')} 
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${activeTab === 'agenda' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
        >
          <Calendar size={18} /> Minha Agenda
        </button>
        <button 
          onClick={() => setActiveTab('financeiro')} 
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${activeTab === 'financeiro' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
        >
          <Settings size={18} /> Configurações
        </button>
      </div>

      {/* =========================================
          CONTEÚDO: PACIENTES
          ========================================= */}
      {activeTab === 'pacientes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
          {filteredPatients.map((p) => (
            <div key={p.id} className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border flex flex-col justify-between transition-all ${p.isNew ? 'border-nutri-300 ring-2 ring-nutri-50' : p.isLate ? 'border-amber-200 ring-2 ring-amber-50' : 'border-stone-100'}`}>
              
              {editingId === p.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Nascimento</label>
                      <input type="date" className="w-full p-3 border rounded-xl font-medium text-sm mt-1" defaultValue={p.data_nascimento} onChange={e => setEditForm({...editForm, data_nascimento: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Meta (kg)</label>
                      <input type="number" step="0.1" className="w-full p-3 border rounded-xl font-medium text-sm mt-1" defaultValue={p.meta_peso} onChange={e => setEditForm({...editForm, meta_peso: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Perfil Clínico</label>
                    <select className="w-full p-3 border rounded-xl font-medium text-sm mt-1" defaultValue={p.tipo_perfil} onChange={e => setEditForm({...editForm, tipo_perfil: e.target.value})}>
                      <option value="adulto">Adulto</option>
                      <option value="atleta">Atleta</option>
                      <option value="crianca">Criança</option>
                      <option value="idoso">Idoso</option>
                    </select>
                  </div>
                  
                  {/* SEÇÃO DE PERMISSÕES E PLANOS NO EDITAR */}
                  <div className="space-y-3 pt-2 border-t border-stone-100">
                    <div>
                      <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1"><Star size={12}/> Tipo de Conta (App Completo)</label>
                      <select className="w-full p-3 border border-amber-200 bg-amber-50 rounded-xl font-bold text-sm mt-1 text-amber-900 outline-none" defaultValue={p.account_type || 'free'} onChange={e => setEditForm({...editForm, account_type: e.target.value})}>
                        <option value="free">Básico (Apenas Check-in)</option>
                        <option value="premium">Premium (Acesso Total Liberado)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-200">
                      <div>
                        <p className="text-xs font-bold text-stone-700 flex items-center gap-1"><FileText size={14} className="text-nutri-800"/> PDF do Plano Alimentar</p>
                        <p className="text-[10px] text-stone-500">Liberar apenas o cardápio</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={editForm.has_meal_plan_access}
                          onChange={(e) => setEditForm({...editForm, has_meal_plan_access: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nutri-800"></div>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2 border-t border-stone-100 mt-2">
                    <button onClick={() => updateProfile(p.id)} className="bg-nutri-900 text-white p-3 rounded-xl flex-1 flex justify-center hover:bg-nutri-800"><Save size={20}/></button>
                    <button onClick={() => setEditingId(null)} className="bg-stone-100 text-stone-600 p-3 rounded-xl flex-1 flex justify-center hover:bg-stone-200"><X size={20}/></button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <Link href={`/admin/paciente/${p.id}/historico`} className="group font-bold text-lg flex items-center gap-2 text-stone-900 hover:text-nutri-800 transition-colors">
                          <Users size={18} className="text-nutri-800" /> 
                          {p.full_name || 'Sem nome'}
                          {p.account_type === 'premium' && (
                            <span title="Paciente Premium">
                              <Star size={14} className="text-amber-500 fill-amber-500" />
                            </span>
                          )}
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
                        <button onClick={() => { 
                          setEditingId(p.id); 
                          setEditForm({ 
                            data_nascimento: p.data_nascimento, 
                            sexo: p.sexo, 
                            tipo_perfil: p.tipo_perfil, 
                            meta_peso: p.meta_peso, 
                            account_type: p.account_type || 'free',
                            has_meal_plan_access: p.has_meal_plan_access || false
                          }); 
                        }} className="p-2 hover:bg-stone-100 rounded-lg transition-colors"><Edit2 size={16} className="text-stone-400" /></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6 bg-stone-50 p-4 rounded-2xl border border-stone-100 text-center">
                      <div><p className="text-[10px] text-stone-400 uppercase font-bold text-center">Perfil</p><p className="text-sm font-semibold text-stone-700 uppercase">{p.tipo_perfil}</p></div>
                      <div><p className="text-[10px] text-stone-400 uppercase font-bold text-center">Peso Meta</p><p className="text-sm font-semibold text-stone-700">{p.meta_peso ? `${p.meta_peso} kg` : '---'}</p></div>
                    </div>

                    {p.evaluation ? (
                      <button onClick={() => setEvalModalOpen({ isOpen: true, data: p.evaluation.answers, name: p.full_name })} className="w-full flex items-center justify-between bg-nutri-50 hover:bg-nutri-100 transition-colors p-4 rounded-2xl border border-nutri-100 mb-6 group text-left">
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

                  <div className="pt-4 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-2 w-full sm:w-auto">
                      <AdminUpload patientId={p.id} onUpdate={fetchAdminData} />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                      <a 
                        href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá%20${p.full_name?.split(' ')[0]},%20aqui%20é%20a%20Nutri%20Vanusa!%20Notei%20que%20você%20ainda%20não%20enviou%20seu%20check-in%20dessa%20semana.%20Como%20estão%20as%20coisas?`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`p-3 rounded-xl transition-all shadow-sm flex items-center justify-center ${p.isLate ? 'bg-amber-100 text-amber-600 hover:bg-amber-200 animate-bounce' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
                      >
                        <BellRing size={18} />
                      </a>
                      <button onClick={() => setSelectedPatient({ id: p.id, name: p.full_name })} className="p-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><Activity size={18} /></button>
                      <a href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá%20${p.full_name?.split(' ')[0]},%20tudo%20bem?`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition-colors"><MessageCircle size={18} /></a>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* =========================================
          CONTEÚDO: LEADS
          ========================================= */}
      {activeTab === 'leads' && (
        <div className="animate-fade-in-up">
          {filteredLeads.length === 0 ? (
            // AVISO DE LISTA VAZIA (Aparece quando não tem leads)
            <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6">
                <Target size={32} className="text-stone-300" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Nenhum lead no momento</h3>
              <p className="text-stone-500 text-sm max-w-md">
                Você não possui oportunidades em andamento no momento. Quando alguém iniciar a avaliação do funil, aparecerá aqui.
              </p>
            </div>
          ) : (
            // LISTA DE LEADS (Aparece quando tem leads)
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLeads.map((lead) => {
                const numRespostas = Object.keys(lead.respostas || {}).length;
                const progresso = (numRespostas / 10) * 100;
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
                      <p className="text-sm font-medium text-stone-600 mb-6">{lead.whatsapp}</p>
                      <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 mb-6">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-stone-400 mb-2">
                          <span>Progresso Quiz</span>
                          <span className="text-nutri-800">{progresso}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <div className="h-full bg-nutri-800 transition-all" style={{ width: `${progresso}%` }}></div>
                        </div>
                        <p className="text-xs text-stone-500 mt-3 flex items-center gap-1">
                          <Clock size={12} /> {new Date(lead.updated_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <a href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, '')}?text=Olá%20${lead.nome?.split(' ')[0]},%20posso%20te%20ajudar%20com%20nossa%20avaliação?`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-xl font-bold hover:bg-[#1ebd5b] transition-all">
                      <MessageCircle size={18} /> Resgatar Contato
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================
          NOVA ABA: AGENDA (CALENDLY)
          ========================================= */}
      {activeTab === 'agenda' && (
        <div className="animate-fade-in-up">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-stone-100 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-3"><Calendar className="text-blue-500" /> Controle de Consultas</h2>
              <p className="text-stone-500 mt-1 text-sm">Acompanhe seus horários ou agende um paciente manualmente através do seu calendário.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={copyToClipboard}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
              >
                {copiedLink ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                {copiedLink ? 'Copiado!' : 'Copiar Link'}
              </button>
              <a 
                href="https://calendly.com/app/scheduled_events/user/me" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95"
              >
                Consultas Agendadas <ExternalLink size={16} />
              </a>
            </div>
          </div>

          {/* Calendly Embutido */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-stone-100 overflow-hidden h-[800px] flex flex-col items-center justify-center relative">
            {calendlyUrl && calendlyUrl.includes('calendly.com') ? (
              <iframe 
                src={calendlyUrl} 
                width="100%" 
                height="100%" 
                frameBorder="0"
                className="absolute inset-0"
              ></iframe>
            ) : (
              <div className="text-center p-8 max-w-md">
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6"><Link2 size={32} className="text-stone-300" /></div>
                <h3 className="font-bold text-xl text-stone-800 mb-2">Link não configurado</h3>
                <p className="text-stone-500 text-sm mb-6">Você precisa configurar o seu link do Calendly na aba "Configurações" para visualizá-lo aqui.</p>
                <button onClick={() => setActiveTab('financeiro')} className="bg-nutri-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-nutri-800">Ir para Configurações</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================
          CONTEÚDO: CONFIGURAÇÕES (PREÇOS + LINKS)
          ========================================= */}
      {activeTab === 'financeiro' && (
        <div className="max-w-4xl mx-auto animate-fade-in-up">
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-stone-100">
            <div className="flex items-center gap-4 mb-10 border-b border-stone-50 pb-8">
              <div className="bg-amber-100 p-4 rounded-3xl text-amber-600">
                <Settings size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Configurações do Sistema</h2>
                <p className="text-stone-500">Defina os valores dos serviços e configure links externos (como sua Agenda).</p>
              </div>
            </div>

            <div className="space-y-10 mb-8">
              
              {/* BLOCO DE PREÇOS */}
              <div>
                <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-6 flex items-center gap-2"><DollarSign size={16} /> Preços de Venda (Checkout)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Opção 1: Pacote Premium Completo */}
                  <div className="relative group flex flex-col bg-stone-50 p-6 rounded-3xl border border-stone-100 focus-within:bg-white focus-within:ring-4 focus-within:ring-nutri-800/10 transition-all">
                    <label className="text-xs font-black text-stone-400 uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
                      <Star size={16} className="text-amber-500" /> Premium Completo
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-light text-stone-300">R$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={premiumPrice} 
                        onChange={(e) => setPremiumPrice(e.target.value)}
                        className="w-full bg-transparent text-3xl font-black text-stone-900 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-3 leading-relaxed">Acesso total ao app: métricas, histórico e plano alimentar.</p>
                  </div>

                  {/* Opção 2: Apenas Plano Alimentar */}
                  <div className="relative group flex flex-col bg-stone-50 p-6 rounded-3xl border border-stone-100 focus-within:bg-white focus-within:ring-4 focus-within:ring-nutri-800/10 transition-all">
                    <label className="text-xs font-black text-stone-400 uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
                      <FileText size={16} className="text-nutri-800" /> Meu Plano (PDF)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-light text-stone-300">R$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={mealPlanPrice} 
                        onChange={(e) => setMealPlanPrice(e.target.value)}
                        className="w-full bg-transparent text-3xl font-black text-stone-900 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-3 leading-relaxed">Compra avulsa apenas do cardápio. Paciente continua Free.</p>
                  </div>

                  {/* Opção 3: Agendamento de Consulta */}
                  <div className="relative group flex flex-col bg-stone-50 p-6 rounded-3xl border border-stone-100 focus-within:bg-white focus-within:ring-4 focus-within:ring-nutri-800/10 transition-all">
                    <label className="text-xs font-black text-stone-400 uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
                      <Calendar size={16} className="text-blue-500" /> Nova Consulta
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-light text-stone-300">R$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={consultationPrice} 
                        onChange={(e) => setConsultationPrice(e.target.value)}
                        className="w-full bg-transparent text-3xl font-black text-stone-900 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-3 leading-relaxed">Valor cobrado para o paciente comprar uma consulta avulsa.</p>
                  </div>
                </div>
              </div>

              {/* BLOCO DE INTEGRAÇÕES */}
              <div>
                <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Link2 size={16} /> Integrações Externas</h3>
                <div className="relative group flex flex-col bg-stone-50 p-6 rounded-3xl border border-stone-100 focus-within:bg-white focus-within:ring-4 focus-within:ring-nutri-800/10 transition-all">
                  <label className="text-xs font-black text-stone-400 uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
                    <Calendar size={16} className="text-blue-500" /> URL do Calendly Oficial
                  </label>
                  <input 
                    type="url" 
                    value={calendlyUrl} 
                    onChange={(e) => setCalendlyUrl(e.target.value)}
                    className="w-full bg-transparent text-base font-medium text-stone-900 outline-none border-b border-stone-200 focus:border-nutri-800 pb-2 transition-colors"
                    placeholder="https://calendly.com/seu-link-aqui"
                  />
                  <p className="text-[10px] text-stone-400 mt-3 leading-relaxed">
                    Cole aqui o link principal da sua agenda. Ele será exibido na tela do paciente e na aba "Minha Agenda" aqui no painel.
                  </p>
                </div>
              </div>

            </div>

            <div className="pt-8 border-t border-stone-50">
              <button 
                onClick={handleSaveSettings}
                disabled={isSavingPrice}
                className="w-full md:w-auto px-10 flex mx-auto items-center justify-center gap-3 bg-nutri-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-nutri-800 transition-all shadow-xl shadow-nutri-900/20 active:scale-[0.98] disabled:opacity-50"
              >
                {isSavingPrice ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AVALIAÇÃO COMPLETA */}
      {evalModalOpen.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50/50">
              <div><h3 className="font-bold text-xl text-stone-900">Avaliação Inicial</h3><p className="text-sm text-stone-500">Respostas de <span className="font-bold text-nutri-900">{evalModalOpen.name}</span></p></div>
              <button onClick={() => setEvalModalOpen({ isOpen: false, data: null, name: '' })} className="bg-white text-stone-400 hover:text-stone-700 p-2 rounded-full border border-stone-200 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              {Object.entries(evalModalOpen.data || {}).map(([key, value]) => (
                <div key={key} className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-widest mb-1.5">{questionTitles[parseInt(key)] || `Pergunta ${parseInt(key) + 1}`}</p>
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