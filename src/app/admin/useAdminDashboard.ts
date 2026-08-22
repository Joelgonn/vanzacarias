'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { FoodRestriction } from '@/types/patient';

import { getPatientMetabolicData } from '@/lib/getPatientMetabolicData';
import { buildBodyComposition } from '@/lib/nutrition/bodyComposition';
import type { MealPlan } from './dashboard/types';

// =========================================================================
// INTERFACES
// =========================================================================

// Recomendação calculada pelo motor metabólico (espelha TargetRecommendation do DietBuilder)
interface TargetRecommendation {
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Linha da VIEW admin_dashboard (Supabase)
// Campos espelham a nulabilidade da interface Patient (sem `null` explícito
// onde Patient só aceita `undefined`).
interface AdminDashboardRow {
  id: string;
  full_name: string;
  phone?: string;
  data_nascimento?: string;
  sexo?: string;
  tipo_perfil?: string;
  meta_peso?: number | null;
  account_type?: string;
  created_at: string;
  meal_plan?: MealPlan[];
  food_restrictions?: FoodRestriction[];
  evaluation_answers?: Record<string, string>;
  is_late?: boolean;
  days_since_last?: number;
  is_new?: boolean;
  water_ml?: number | null;
  mood?: string | null;
  messages_today?: number;
  peso?: number | null;
  weight?: number | null;
  altura?: number | null;
  height?: number | null;
}

export interface Patient {
  id: string;
  full_name: string;
  phone?: string;
  data_nascimento?: string;
  sexo?: string;
  tipo_perfil?: string;
  meta_peso?: number | null;
  account_type?: string;
  created_at: string;
  meal_plan?: MealPlan[];
  evaluation_answers?: Record<string, string>;
  is_late?: boolean;
  days_since_last?: number;
  is_new?: boolean;
  water_ml?: number | null;
  mood?: string | null;
  messages_today?: number;
  peso?: number | null;
  weight?: number | null;
  altura?: number | null;
  height?: number | null;
  bf?: number | null;
  leanMass?: number | null;      // 👈 PADRONIZADO: só leanMass
  food_restrictions?: FoodRestriction[];
  // Campos antigos para compatibilidade (DEPRECATED)
  evaluation?: { answers: Record<string, string> };
  isLate?: boolean;
  daysSinceLast?: number;
  isNew?: boolean;
  todayLog?: { water_ml: number; mood: string } | null;
}

export interface Lead {
  id: string;
  nome: string;
  whatsapp: string;
  status: string;
  respostas: Record<string, string>;
  updated_at: string;
}

export interface SystemSettings {
  id: number;
  premium_price?: number;
  meal_plan_price?: number;
  consultation_price?: number;
  calendly_url?: string;
}

// =========================================================================
// HOOK PRINCIPAL
// =========================================================================
export function useAdminDashboard() {
  const router = useRouter();
  const supabase = createClient();

  // =========================== ESTADOS PRINCIPAIS ===========================
  const [patients, setPatients] = useState<Patient[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('agora');

  // =========================== FILTROS E ABAS ===========================
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [lastSeenNewPatientTime, setLastSeenNewPatientTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'pacientes' | 'leads' | 'agenda' | 'financeiro'>('pacientes');

  // =========================== EDIÇÃO DE PERFIL ===========================
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [editForm, setEditForm] = useState({
    data_nascimento: '',
    sexo: '',
    tipo_perfil: 'adulto',
    meta_peso: '',
    account_type: 'free',
  });

  // =========================== MODAIS ===========================
  const [evalModalOpen, setEvalModalOpen] = useState<{
    isOpen: boolean;
    data: Record<string, string> | null;
    name: string;
    qfaData: Record<string, string> | null;
    foodRestrictions: FoodRestriction[];
  }>({ isOpen: false, data: null, name: '', qfaData: null, foodRestrictions: [] });

  const [evalModalActiveTab, setEvalModalActiveTab] = useState<'avaliacao' | 'qfa' | 'perfil'>('avaliacao');

  const [dietModalOpen, setDietModalOpen] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    targetRecommendation: TargetRecommendation | null;
    foodRestrictions: FoodRestriction[];
  }>({ isOpen: false, id: '', name: '', targetRecommendation: null, foodRestrictions: [] });

  // =========================== CONFIGURAÇÕES ===========================
  const [premiumPrice, setPremiumPrice] = useState('297.00');
  const [mealPlanPrice, setMealPlanPrice] = useState('147.00');
  const [consultationPrice, setConsultationPrice] = useState('197.00');
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // =========================== ESTATÍSTICAS ===========================
  const [usageStats, setUsageStats] = useState<Record<string, number>>({});
  const [todayTotalMessages, setTodayTotalMessages] = useState(0);

  // =========================== HELPER: NORMALIZAR PACIENTE ===========================
  const normalizePatientFromView = (rawPatient: AdminDashboardRow): Patient => {
    // 🚨 CORREÇÃO 3: todayLog com fallback seguro
    const hasTodayData = rawPatient.water_ml !== null || rawPatient.mood !== null;
    
    return {
      id: rawPatient.id,
      full_name: rawPatient.full_name,
      phone: rawPatient.phone,
      data_nascimento: rawPatient.data_nascimento,
      sexo: rawPatient.sexo,
      tipo_perfil: rawPatient.tipo_perfil,
      meta_peso: rawPatient.meta_peso,
      account_type: rawPatient.account_type,
      created_at: rawPatient.created_at,
      meal_plan: rawPatient.meal_plan,
      food_restrictions: rawPatient.food_restrictions,
      
      // Campos da VIEW
      evaluation_answers: rawPatient.evaluation_answers,
      is_late: rawPatient.is_late,
      days_since_last: rawPatient.days_since_last,
      is_new: rawPatient.is_new,
      water_ml: rawPatient.water_ml,
      mood: rawPatient.mood,
      messages_today: rawPatient.messages_today,
      
      // Dados corporais
      peso: rawPatient.peso,
      weight: rawPatient.weight,
      altura: rawPatient.altura,
      height: rawPatient.height,
      
      // 🚨 CORREÇÃO 3: todayLog com fallback
      todayLog: hasTodayData
        ? { water_ml: rawPatient.water_ml ?? 0, mood: rawPatient.mood ?? '' }
        : null,
      
      // Compatibilidade
      evaluation: rawPatient.evaluation_answers ? { answers: rawPatient.evaluation_answers } : undefined,
      isLate: rawPatient.is_late,
      daysSinceLast: rawPatient.days_since_last,
      isNew: rawPatient.is_new,
      
      // 🚨 CORREÇÃO 4: leanMass padronizado (sem fallback confuso)
      leanMass: null,
      bf: null,
    };
  };

  // =========================== FETCH PRINCIPAL (REFATORADO) ===========================
  async function fetchAdminData() {
    setLoading(true);
    try {
      // 1. BUSCAR SETTINGS
      const { data: settings } = await supabase.from('system_settings').select('*').eq('id', 1).single();
      if (settings) {
        if (settings.premium_price) setPremiumPrice(settings.premium_price.toString());
        if (settings.meal_plan_price) setMealPlanPrice(settings.meal_plan_price.toString());
        if (settings.consultation_price) setConsultationPrice(settings.consultation_price.toString());
        if (settings.calendly_url) setCalendlyUrl(settings.calendly_url);
      }

      // 2. BUSCAR VIEW
      const { data: dashboardData, error: viewError } = await supabase
        .from('admin_dashboard')
        .select('*');

      if (viewError) throw viewError;

      // 🚨 CORREÇÃO 1: AI USAGE VEM DA VIEW (sem query extra)
      const usageMap: Record<string, number> = {};
      let totalMessages = 0;

      dashboardData?.forEach(p => {
        const msgCount = p.messages_today || 0;
        usageMap[p.id] = msgCount;
        totalMessages += msgCount;
      });

      setUsageStats(usageMap);
      setTodayTotalMessages(totalMessages);

      // 3. BUSCAR SKINFOLDS (mantido, mas com otimização)
      const { data: skinfolds } = await supabase
        .from('skinfolds')
        .select('*')
        .order('measurement_date', { ascending: false });

      // 🚨 CORREÇÃO 2: Mapa O(n) em vez de filter O(n²)
      const skinfoldMap = new Map();
      skinfolds?.forEach(s => {
        if (!skinfoldMap.has(s.user_id)) {
          skinfoldMap.set(s.user_id, s);
        }
      });

      // 4. PROCESSAR CADA PACIENTE
      const processedPatients: Patient[] = (dashboardData || []).map(rawPatient => {
        const normalized = normalizePatientFromView(rawPatient);
        
        // Buscar última dobra cutânea via MAPA (O(1))
        const latestSkin = skinfoldMap.get(normalized.id);
        
        const weight = normalized.weight || normalized.peso || null;
        
        const composition = buildBodyComposition({
          skin: latestSkin,
          weight: weight,
          birthDate: normalized.data_nascimento,
          gender: normalized.sexo,
        });
        
        // 🚨 CORREÇÃO 4: padronizado
        return {
          ...normalized,
          bf: composition?.bf || null,
          leanMass: composition?.leanMass || null,
        };
      });

      setPatients(processedPatients);

      // 5. BUSCAR LEADS
      const { data: leadsData } = await supabase
        .from('leads_avaliacao')
        .select('*')
        .neq('status', 'convertido')
        .order('updated_at', { ascending: false });

      setLeads(leadsData as Lead[] || []);

      setLastUpdateTime('agora');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Ocorreu um erro ao carregar as informações do painel.');
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  }

  // =========================== CHECK AUTH ===========================
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Role vem do Supabase (profiles), nunca hardcoded por email
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!profile || (profile.role !== 'admin' && profile.role !== 'nutricionista')) {
        router.push('/dashboard');
        return;
      }

      fetchAdminData();
    }
    checkAuth();

    const savedTime = localStorage.getItem('last_seen_patient_time');
    if (savedTime) setLastSeenNewPatientTime(parseInt(savedTime, 10));
  }, [router, supabase]);

  // =========================== HANDLERS ===========================
  const handleOpenEvalModal = async (patient: Patient) => {
    const { data: qfaData } = await supabase
      .from('qfa_responses')
      .select('answers')
      .eq('user_id', patient.id)
      .single();

    setEvalModalOpen({
      isOpen: true,
      data: patient.evaluation_answers || patient.evaluation?.answers || null,
      name: patient.full_name,
      qfaData: normalizeQFAAnswers(qfaData?.answers),
      foodRestrictions: patient.food_restrictions || [],
    });
    setEvalModalActiveTab('avaliacao');
  };

  const handleOpenDietBuilder = async (p: Patient) => {
    const toastId = toast.loading('Calculando metabolismo e necessidades...');

    try {
      const metabolicData = await getPatientMetabolicData(p.id, {
        patientId: p.id,
        weight: p.peso || p.weight || null,
        height: p.altura || p.height || null,
        data_nascimento: p.data_nascimento || null,
        sexo: p.sexo || null,
        bf: p.bf || null,
        leanMass: p.leanMass || null,  // 🚨 CORREÇÃO 4: padronizado
      });

      toast.dismiss(toastId);

      setDietModalOpen({
        isOpen: true,
        id: p.id,
        name: p.full_name,
        targetRecommendation: metabolicData.recommendation,
        foodRestrictions: p.food_restrictions || [],
      });
    } catch (e) {
      console.error('Erro ao gerar recomendação:', e);
      toast.error('Erro ao calcular dados. Verifique o cadastro.', { id: toastId });
    }
  };

  const updateProfile = async (id: string) => {
    const updateData = {
      data_nascimento: editForm.data_nascimento?.trim() ? editForm.data_nascimento : null,
      sexo: editForm.sexo?.trim() ? editForm.sexo : null,
      tipo_perfil: editForm.tipo_perfil,
      account_type: editForm.account_type,
      meta_peso: editForm.meta_peso && String(editForm.meta_peso).trim() !== '' ? parseFloat(String(editForm.meta_peso)) : null,
    };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
    if (!error) {
      setEditingId(null);
      fetchAdminData();
      toast.success('Perfil atualizado com sucesso!');
    } else {
      toast.error('Falha ao atualizar o perfil.');
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingPrice(true);
    const updatePayload: Partial<SystemSettings> = {
      premium_price: parseFloat(premiumPrice),
      meal_plan_price: parseFloat(mealPlanPrice),
      consultation_price: parseFloat(consultationPrice),
      calendly_url: calendlyUrl,
    };

    const { error } = await supabase.from('system_settings').update(updatePayload).eq('id', 1);
    if (!error) toast.success('Configurações salvas com sucesso!');
    else toast.error('Erro ao salvar as configurações.');
    setIsSavingPrice(false);
  };

  const copyToClipboard = () => {
    if (!calendlyUrl) return toast.warning('Não há link configurado para copiar.');
    navigator.clipboard.writeText(calendlyUrl);
    setCopiedLink(true);
    toast.success('Link copiado para a área de transferência!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleBellClick = () => {
    setShowOnlyNew(!showOnlyNew);
    setActiveTab('pacientes');
    const newPats = patients.filter(p => p.is_new);
    if (newPats.length > 0) {
      const maxTime = Math.max(...newPats.map(p => new Date(p.created_at).getTime()));
      localStorage.setItem('last_seen_patient_time', maxTime.toString());
      setLastSeenNewPatientTime(maxTime);
    }
  };

  const handleDeleteDiet = async (patientId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir o cardápio atual? Essa ação não pode ser desfeita.')) return;

    const toastId = toast.loading('Excluindo dieta...');
    try {
      const { error } = await supabase.from('profiles').update({ meal_plan: null, status: 'pendente' }).eq('id', patientId);
      if (error) throw error;

      toast.success('Dieta excluída. Pronto para criar uma nova.', { id: toastId });
      fetchAdminData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir a dieta.', { id: toastId });
    }
  };

  const createRippleEffect = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.className = 'ripple-effect';

    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  };

  // =========================== MEMOS (FILTROS) ===========================
  const activeLeadsCount = useMemo(() => leads.length, [leads]);
  const unseenPatientsCount = useMemo(() => {
    return patients.filter(p => p.is_new && new Date(p.created_at).getTime() > lastSeenNewPatientTime).length;
  }, [patients, lastSeenNewPatientTime]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const nameMatch = p.full_name ? p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const isDietReady = Boolean(p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0);

      let statusMatch = true;
      if (statusFilter === 'plano_liberado') statusMatch = isDietReady;
      if (statusFilter === 'pendente') statusMatch = !isDietReady;

      const newMatch = showOnlyNew ? Boolean(p.is_new) : true;

      return nameMatch && statusMatch && newMatch;
    });
  }, [patients, searchTerm, statusFilter, showOnlyNew]);

  const sortedPatients = useMemo(() => {
    return [...filteredPatients].sort((a, b) => {
      if (a.is_new && !b.is_new) return -1;
      if (!a.is_new && b.is_new) return 1;
      if (a.is_late && !b.is_late) return -1;
      if (!a.is_late && b.is_late) return 1;
      return (usageStats[b.id] || 0) - (usageStats[a.id] || 0);
    });
  }, [filteredPatients, usageStats]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => l.nome?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [leads, searchTerm]);

  const adminContext = useMemo(() => {
    const patientsWithComposition = patients.map(patient => {
      const hasComposition = !!(patient.bf || patient.leanMass);
      let evolucaoGordura = '';
      let evolucaoMassaMagra = '';
      if (patient.bf) evolucaoGordura = `${patient.bf}% atualmente`;
      if (patient.leanMass) evolucaoMassaMagra = `${patient.leanMass}kg de massa magra`;
      return {
        ...patient,
        composicaoCorporal: hasComposition
          ? {
              percentualGordura: patient.bf || null,
              massaGorda: null,
              massaMagra: patient.leanMass || null,
              ultimaAvaliacao: null,
              evolucaoGordura,
              evolucaoMassaMagra,
            }
          : null,
      };
    });
    return { patients: patientsWithComposition, leads, usageStats, todayTotalMessages };
  }, [patients, leads, usageStats, todayTotalMessages]);

  // =========================== HELPER INTERNO ===========================
  function normalizeQFAAnswers(data: unknown): Record<string, string> {
    if (!data) return {};
    if (Array.isArray(data)) {
      const result: Record<string, string> = {};
      data.forEach((item) => {
        const answer = item as { id?: string; value?: string };
        if (answer?.id && answer?.value) result[answer.id] = answer.value;
      });
      return result;
    }
    return data as Record<string, string>;
  }

  // =========================== RETORNO ===========================
  return {
    state: {
      loading,
      isFiltering,
      lastUpdateTime,
      patients,
      activeTab,
      searchTerm,
      showOnlyNew,
      unseenPatientsCount,
      todayTotalMessages,
      usageStats,
      filteredPatients,
      sortedPatients,
      editingId,
      editForm,
      evalModalOpen,
      evalModalActiveTab,
      activeLeadsCount,
      filteredLeads,
      copiedLink,
      calendlyUrl,
      premiumPrice,
      mealPlanPrice,
      consultationPrice,
      isSavingPrice,
      dietModalOpen,
      selectedPatient,
      adminContext,
      statusFilter,
    },
    actions: {
      setActiveTab,
      handleBellClick,
      handleLogout,
      setSearchTerm,
      setStatusFilter,
      setShowOnlyNew,
      setEditingId,
      setEditForm,
      updateProfile,
      setEvalModalOpen,
      setEvalModalActiveTab,
      setDietModalOpen,
      setSelectedPatient,
      copyToClipboard,
      setPremiumPrice,
      setMealPlanPrice,
      setConsultationPrice,
      setCalendlyUrl,
      handleSaveSettings,
      fetchAdminData,
      handleDeleteDiet,
      handleOpenDietBuilder,
      handleOpenEvalModal,
      createRippleEffect,
    },
  };
}