'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { 
  Loader2, LogOut, Users, MessageCircle, Search, Filter, 
  Edit2, Save, X, TrendingUp, AlertCircle, Bell, BellRing, 
  Activity, Target, Eye, UserPlus, Clock, ChevronRight, Star,
  DollarSign, FileText, Calendar, Link2, Copy, Check, ExternalLink, 
  Utensils, CheckCircle2, Settings, Trash2, Moon, Sun
} from 'lucide-react';
import ClinicalDataModal from '@/components/ClinicalDataModal';
import DietBuilder from '@/components/DietBuilder'; 
import ChatAssistant from '@/components/ChatAssistant'; 
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { FoodRestriction } from '@/types/patient';

import { getPatientMetabolicData } from '@/lib/getPatientMetabolicData';
import { buildBodyComposition } from '@/lib/nutrition/bodyComposition';

import { ui, SkeletonCard, cn, createRippleEffect } from '@/ui/system';
import { useDarkMode } from '@/hooks/useDarkMode';

// =========================================================================
// INTERFACES
// =========================================================================
interface Patient {
  id: string;
  full_name: string;
  phone?: string;
  data_nascimento?: string;
  sexo?: string;
  tipo_perfil?: string;
  meta_peso?: number | null;
  account_type?: string;
  created_at: string;
  meal_plan?: any[];
  evaluation?: { answers: Record<string, string> };
  isLate?: boolean;
  daysSinceLast?: number;
  isNew?: boolean;
  todayLog?: { water_ml: number; mood: string } | null;
  peso?: number | null;
  weight?: number | null;
  altura?: number | null;
  height?: number | null;
  bf?: number | null;
  massa_magra?: number | null;
  leanMass?: number | null;
  food_restrictions?: FoodRestriction[];
}

interface Lead {
  id: string;
  nome: string;
  whatsapp: string;
  status: string;
  respostas: Record<string, string>;
  updated_at: string;
}

interface SystemSettings {
  id: number;
  premium_price?: number;
  meal_plan_price?: number;
  consultation_price?: number;
  calendly_url?: string;
}

// =========================================================================
// CONSTANTES
// =========================================================================
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

const qfaSchemaDisplay = [
  { category: "Leites e Derivados", items: ["leite", "iogurte", "queijos", "requeijao"] },
  { category: "Carnes e Ovos", items: ["ovo", "carne_vermelha", "carne_porco", "frango", "peixe"] },
  { category: "Óleos", items: ["azeite", "bacon", "frituras", "manteiga", "maionese", "oleos_veg"] },
  { category: "Cereais e Leguminosas", items: ["arroz", "aveia", "pao", "macarrao", "bolos", "leguminosas", "soja", "oleaginosas"] },
  { category: "Frutas/Verduras/Legumes", items: ["fruta", "folhosos", "tuberculos", "legumes"] },
  { category: "Petiscos embutidos Enlatados", items: ["snacks", "instantaneos", "embutidos", "enlatados"] },
  { category: "Sobremesas e Doces", items: ["sorvete", "tortas", "chocolates", "balas"] },
  { category: "Bebidas", items: ["agua", "cafe_s_acucar", "suco_natural_s_acucar", "refrigerante", "cafe_c_acucar", "suco_natural_c_acucar", "suco_caixinha"] }
];

const qfaLabels: Record<string, string> = {
  leite: "Leite (copo de requeijão)", iogurte: "Iogurte natural (copo de requeijão)",
  queijos: "Queijos (1/2 fatia)", requeijao: "Requeijão / Creme de ricota (1,5 colher sopa)",
  ovo: "Ovo cozido / mexido (2 unidades)", carne_vermelha: "Carnes vermelhas (1 unidade)",
  carne_porco: "Carnes de Porco (1 fatia)", frango: "Frango (1 unidade)",
  peixe: "Peixe fresco / Frutos do Mar (1 unidade)", azeite: "Azeite (1 colher de sopa)",
  bacon: "Bacon e toucinho (1/2 fatia)", frituras: "Frituras",
  manteiga: "Manteiga / Margarina (1/2 colher sopa)", maionese: "Maionese (1/2 colher sopa)",
  oleos_veg: "Óleos vegetais (1 colher de sopa)", arroz: "Arroz Branco / Integral (4 colheres sopa)",
  aveia: "Aveia (4 colheres de sopa)", pao: "Pão (1 unidade)",
  macarrao: "Macarrão (3,5 colheres sopa)", bolos: "Bolos caseiros (1 fatia pequena)",
  leguminosas: "Leguminosas (1 concha)", soja: "Soja (1 colher de servir)",
  oleaginosas: "Oleaginosas (1 colher de sopa)", fruta: "Fruta in natura (1 unidade/fatia)",
  folhosos: "Folhosos (10 folhas)", tuberculos: "Tubérculos (2 colheres sopa)",
  legumes: "Legumes (2 colheres sopa)", snacks: "Snacks (1 pacote)",
  instantaneos: "Macarrão instantâneo (1 pacote)", embutidos: "Embutidos (2 fatias)",
  enlatados: "Enlatados (2 colheres sopa)", sorvete: "Sorvete (1 unidade ou 2 bolas)",
  tortas: "Tortas e Doces (1 fatia)", chocolates: "Chocolates (1 unidade)",
  balas: "Balas (1 unidade)", agua: "Água (1 garrafa 510 ml)",
  cafe_s_acucar: "Café sem açúcar (1 xícara)", suco_natural_s_acucar: "Suco Natural sem açúcar (copo)",
  refrigerante: "Refrigerante (copo)", cafe_c_acucar: "Café com açúcar (1 xícara)",
  suco_natural_c_acucar: "Suco Natural adoçado (copo)", suco_caixinha: "Sucos de Caixinha (copo)"
};

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = error => reject(error);
    img.src = imageUrl;
  });
};

function normalizeQFAAnswers(data: any): Record<string, string> {
  if (!data) return {};
  if (Array.isArray(data)) {
    const result: Record<string, string> = {};
    data.forEach((item: any) => {
      if (item?.id && item?.value) result[item.id] = item.value;
    });
    return result;
  }
  return data;
}

// =========================================================================
// HOOK PRINCIPAL
// =========================================================================
function useAdminDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('agora');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [lastSeenNewPatientTime, setLastSeenNewPatientTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'pacientes' | 'leads' | 'agenda' | 'financeiro'>('pacientes');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);

  const [evalModalOpen, setEvalModalOpen] = useState<{
    isOpen: boolean;
    data: any;
    name: string;
    qfaData: any;
    foodRestrictions: FoodRestriction[];
  }>({ isOpen: false, data: null, name: '', qfaData: null, foodRestrictions: [] });

  const [evalModalActiveTab, setEvalModalActiveTab] = useState<'avaliacao' | 'qfa' | 'perfil'>('avaliacao');

  const [dietModalOpen, setDietModalOpen] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    targetRecommendation: any | null;
    foodRestrictions: FoodRestriction[];
  }>({ isOpen: false, id: '', name: '', targetRecommendation: null, foodRestrictions: [] });

  const [premiumPrice, setPremiumPrice] = useState('297.00');
  const [mealPlanPrice, setMealPlanPrice] = useState('147.00');
  const [consultationPrice, setConsultationPrice] = useState('197.00');
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [usageStats, setUsageStats] = useState<Record<string, number>>({});
  const [todayTotalMessages, setTodayTotalMessages] = useState(0);

  const [editForm, setEditForm] = useState({
    data_nascimento: '',
    sexo: '',
    tipo_perfil: 'adulto',
    meta_peso: '',
    account_type: 'free',
  });

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
    if (savedTime) setLastSeenNewPatientTime(parseInt(savedTime, 10));
  }, [router, supabase]);

  async function fetchAdminData() {
    setLoading(true);
    try {
      const { data: settings } = await supabase.from('system_settings').select('*').eq('id', 1).single();
      if (settings) {
        if (settings.premium_price) setPremiumPrice(settings.premium_price.toString());
        if (settings.meal_plan_price) setMealPlanPrice(settings.meal_plan_price.toString());
        if (settings.consultation_price) setConsultationPrice(settings.consultation_price.toString());
        if (settings.calendly_url) setCalendlyUrl(settings.calendly_url);
      }

      const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
      if (pError) throw pError;

      const { data: evals } = await supabase.from('evaluations').select('user_id, answers');

      const { data: checkins } = await supabase
        .from('checkins')
        .select('user_id, created_at, peso, altura')
        .order('created_at', { ascending: false });

      const { data: antropometria } = await supabase
        .from('anthropometry')
        .select('user_id, measurement_date, weight, height')
        .order('measurement_date', { ascending: false });

      const { data: skinfolds } = await supabase
        .from('skinfolds')
        .select('*')
        .order('measurement_date', { ascending: false });

      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const { data: logs } = await supabase.from('daily_logs').select('user_id, water_ml, mood').eq('date', todayStr);

      const combined = profiles?.map(profile => {
        const userCheckins = checkins?.filter(c => c.user_id === profile.id);
        const lastCheckin = userCheckins && userCheckins.length > 0 ? userCheckins[0] : null;
        const userAntro = antropometria?.filter(a => a.user_id === profile.id);
        const lastAntro = userAntro && userAntro.length > 0 ? userAntro[0] : null;

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

        let isNew = false;
        if (profile.created_at) {
          const now = new Date();
          const createdDate = new Date(profile.created_at);
          const diffInHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
          isNew = diffInHours >= 0 && diffInHours <= 24;
        }

        const userSkinfolds = skinfolds?.filter(s => s.user_id === profile.id);
        const latestSkin = userSkinfolds?.[0];
        const weight = lastAntro?.weight || lastCheckin?.peso || null;

        const composition = buildBodyComposition({
          skin: latestSkin,
          weight,
          birthDate: profile.data_nascimento,
          gender: profile.sexo,
        });

        return {
          ...profile,
          evaluation: evals?.find(e => e.user_id === profile.id),
          isLate,
          daysSinceLast,
          isNew,
          todayLog: logs?.find(l => l.user_id === profile.id) || null,
          peso: lastAntro?.weight || lastCheckin?.peso || null,
          altura: lastAntro?.height || lastCheckin?.altura || null,
          bf: composition?.bf || null,
          leanMass: composition?.leanMass || null,
        };
      }) as Patient[];

      setPatients(combined || []);

      const { data: leadsData } = await supabase
        .from('leads_avaliacao')
        .select('*')
        .neq('status', 'convertido')
        .order('updated_at', { ascending: false });

      setLeads(leadsData as Lead[] || []);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: aiUsage } = await supabase
        .from('ai_messages')
        .select('user_id, created_at')
        .gte('created_at', startOfDay.toISOString());

      const usageMap: Record<string, number> = {};
      let total = 0;

      aiUsage?.forEach(msg => {
        if (msg.user_id) usageMap[msg.user_id] = (usageMap[msg.user_id] || 0) + 1;
        total++;
      });

      setUsageStats(usageMap);
      setTodayTotalMessages(total);
      setLastUpdateTime('agora');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Ocorreu um erro ao carregar as informações do painel.');
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  }

  const handleOpenEvalModal = async (patient: Patient) => {
    const { data: qfaData } = await supabase
      .from('qfa_responses')
      .select('answers')
      .eq('user_id', patient.id)
      .single();

    setEvalModalOpen({
      isOpen: true,
      data: patient.evaluation?.answers || null,
      name: patient.full_name,
      qfaData: normalizeQFAAnswers(qfaData?.answers),
      foodRestrictions: patient.food_restrictions || [],
    });
    setEvalModalActiveTab('avaliacao');
  };

  const newPatientsCount = useMemo(() => patients.filter(p => p.isNew).length, [patients]);
  const activeLeadsCount = useMemo(() => leads.length, [leads]);
  const unseenPatientsCount = useMemo(() => {
    return patients.filter(p => p.isNew && new Date(p.created_at).getTime() > lastSeenNewPatientTime).length;
  }, [patients, lastSeenNewPatientTime]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const nameMatch = p.full_name ? p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const isDietReady = Boolean(p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0);

      let statusMatch = true;
      if (statusFilter === 'plano_liberado') statusMatch = isDietReady;
      if (statusFilter === 'pendente') statusMatch = !isDietReady;

      const newMatch = showOnlyNew ? Boolean(p.isNew) : true;

      return nameMatch && statusMatch && newMatch;
    });
  }, [patients, searchTerm, statusFilter, showOnlyNew]);

  const sortedPatients = useMemo(() => {
    return [...filteredPatients].sort((a, b) => {
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      if (a.isLate && !b.isLate) return -1;
      if (!a.isLate && b.isLate) return 1;
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
    const newPats = patients.filter(p => p.isNew);
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
        leanMass: p.massa_magra || p.leanMass || null,
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

  const handleGeneratePDF = async (patient: Patient) => {
    if (!patient.meal_plan || patient.meal_plan.length === 0) {
      toast.warning('A dieta deste paciente está vazia.');
      return;
    }

    const toastId = toast.loading('Gerando PDF...');
    try {
      const mealPlanJSON = patient.meal_plan;
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;

      const totalKcal = mealPlanJSON.reduce((acc: number, meal: any) => acc + (meal.options[0]?.kcal || 0), 0);
      const totalProtein = mealPlanJSON.reduce((acc: number, meal: any) => acc + (meal.options[0]?.macros?.p || 0), 0);
      const totalCarbs = mealPlanJSON.reduce((acc: number, meal: any) => acc + (meal.options[0]?.macros?.c || 0), 0);
      const totalFat = mealPlanJSON.reduce((acc: number, meal: any) => acc + (meal.options[0]?.macros?.g || 0), 0);

      const daysMap = new Map<string, any[]>();
      mealPlanJSON.forEach((meal: any) => {
        meal.options.forEach((opt: any) => {
          const dayName = opt.day?.trim() || 'Opção';
          if (!daysMap.has(dayName)) daysMap.set(dayName, []);
          daysMap.get(dayName)!.push({
            mealName: meal.name,
            time: meal.time,
            description: opt.description,
            foodItems: opt.foodItems || [],
            kcal: opt.kcal,
            macros: opt.macros || { p: 0, c: 0, g: 0 },
          });
        });
      });

      const dayOrder = ['Todos os dias', 'Segunda a Sexta', 'Finais de Semana', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
      const sortedDays = Array.from(daysMap.keys()).sort((a, b) => {
        const idxA = dayOrder.indexOf(a);
        const idxB = dayOrder.indexOf(b);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });

      let logoBase64: string | null = null;
      try {
        logoBase64 = await getBase64ImageFromUrl('/images/logo-vanusa.png');
      } catch (error) {}

      const printHeaderAndFooter = () => {
        let currentY = 20;
        if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, currentY - 6, 16, 16);
        const textStartX = logoBase64 ? margin + 20 : margin;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(26);
        doc.setTextColor(26, 58, 42);
        doc.text('Vanusa Zacarias', textStartX, currentY + 2);
        doc.setFontSize(10);
        doc.setTextColor(139, 131, 120);
        doc.text('NUTRIÇÃO CLÍNICA', textStartX, currentY + 8, { charSpace: 1.5 });
        doc.setFontSize(12);
        doc.setTextColor(200, 200, 200);
        doc.text('PLANO ALIMENTAR', pageWidth - margin, currentY + 8, { align: 'right' });

        currentY += 18;
        doc.setDrawColor(26, 58, 42);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('PACIENTE:', margin, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.text(patient.full_name || 'Paciente', margin + 20, currentY);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('DATA:', margin + 85, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.text(new Date().toLocaleDateString('pt-BR'), margin + 98, currentY);

        currentY += 6;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('BASE DIÁRIA:', margin, currentY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(234, 88, 12);
        doc.text(`~${Math.round(totalKcal)} kcal`, margin + 35, currentY);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');

        doc.setTextColor(150, 150, 150);
        doc.text('|', margin + 65, currentY);
        doc.setTextColor(239, 68, 68);
        doc.text(`P: ${Math.round(totalProtein)}g`, margin + 70, currentY);
        doc.setTextColor(150, 150, 150);
        doc.text('|', margin + 95, currentY);
        doc.setTextColor(245, 158, 11);
        doc.text(`C: ${Math.round(totalCarbs)}g`, margin + 100, currentY);
        doc.setTextColor(150, 150, 150);
        doc.text('|', margin + 125, currentY);
        doc.setTextColor(59, 130, 246);
        doc.text(`G: ${Math.round(totalFat)}g`, margin + 130, currentY);
        doc.setTextColor(0, 0, 0);

        currentY += 8;
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 12;

        doc.setDrawColor(220, 220, 220);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text('Plano alimentar individual e intransferível elaborado por Vanusa Zacarias - Nutrição Clínica.', pageWidth / 2, pageHeight - 10, { align: 'center' });

        return currentY;
      };

      const formatFoodList = (foodItems: any[]) => {
        if (!foodItems || foodItems.length === 0) return '';
        return foodItems.map(item => `• ${item.name}`).join('\n');
      };

      sortedDays.forEach((day, index) => {
        if (index > 0) doc.addPage();
        let y = printHeaderAndFooter();

        doc.setFillColor(26, 58, 42);
        doc.rect(margin, y, pageWidth - margin * 2, 12, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        const titleText = day.toUpperCase() === 'TODOS OS DIAS' ? 'CARDÁPIO PADRÃO (TODOS OS DIAS)' : `CARDÁPIO: ${day.toUpperCase()}`;
        doc.text(titleText, pageWidth / 2, y + 8, { align: 'center', charSpace: 1 });
        y += 20;

        const mealsForDay = daysMap.get(day) || [];

        const dayTotal = {
          kcal: mealsForDay.reduce((sum, m) => sum + (m.kcal || 0), 0),
          p: mealsForDay.reduce((sum, m) => sum + (m.macros?.p || 0), 0),
          c: mealsForDay.reduce((sum, m) => sum + (m.macros?.c || 0), 0),
          g: mealsForDay.reduce((sum, m) => sum + (m.macros?.g || 0), 0),
        };

        mealsForDay.forEach(meal => {
          if (y > pageHeight - 50) {
            doc.addPage();
            y = printHeaderAndFooter();
            doc.setFillColor(26, 58, 42);
            doc.rect(margin, y, pageWidth - margin * 2, 12, 'F');
            doc.text(titleText, pageWidth / 2, y + 8, { align: 'center', charSpace: 1 });
            y += 20;
          }

          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(26, 58, 42);

          const mealTitle = `${meal.mealName.toUpperCase()} - ${meal.time}`;
          doc.text(mealTitle, margin, y);

          const macroStartX = pageWidth - margin - 5;

          const kcalText = `${Math.round(meal.kcal || 0)} kcal`;
          const proteinText = `P: ${Math.round(meal.macros?.p || 0)}g`;
          const carbsText = `C: ${Math.round(meal.macros?.c || 0)}g`;
          const fatText = `G: ${Math.round(meal.macros?.g || 0)}g`;

          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');

          const kcalWidth = doc.getTextWidth(kcalText);
          const proteinWidth = doc.getTextWidth(proteinText);
          const carbsWidth = doc.getTextWidth(carbsText);
          const fatWidth = doc.getTextWidth(fatText);
          const separatorWidth = doc.getTextWidth(' | ');

          const totalWidth = kcalWidth + separatorWidth + proteinWidth + separatorWidth + carbsWidth + separatorWidth + fatWidth;

          let currentX = macroStartX - totalWidth;

          doc.setTextColor(234, 88, 12);
          doc.text(kcalText, currentX, y);
          currentX += kcalWidth + 2;

          doc.setTextColor(150, 150, 150);
          doc.text('|', currentX, y);
          currentX += separatorWidth;

          doc.setTextColor(239, 68, 68);
          doc.text(proteinText, currentX, y);
          currentX += proteinWidth + 2;

          doc.setTextColor(150, 150, 150);
          doc.text('|', currentX, y);
          currentX += separatorWidth;

          doc.setTextColor(245, 158, 11);
          doc.text(carbsText, currentX, y);
          currentX += carbsWidth + 2;

          doc.setTextColor(150, 150, 150);
          doc.text('|', currentX, y);
          currentX += separatorWidth;

          doc.setTextColor(59, 130, 246);
          doc.text(fatText, currentX, y);

          doc.setTextColor(0, 0, 0);
          y += 6;

          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);

          let descriptionText = '';
          if (meal.foodItems && meal.foodItems.length > 0) {
            descriptionText = formatFoodList(meal.foodItems);
          } else if (meal.description) {
            descriptionText = meal.description;
          }

          if (descriptionText) {
            const maxWidth = pageWidth - margin * 2;
            const splitDesc = doc.splitTextToSize(descriptionText, maxWidth);
            doc.text(splitDesc, margin, y);
            y += splitDesc.length * 5;
          } else {
            y += 2;
          }

          y += 6;
        });

        if (y < pageHeight - 25) {
          doc.setDrawColor(230, 230, 230);
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(margin, pageHeight - 28, pageWidth - margin * 2, 18, 3, 3, 'FD');

          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 100, 100);
          doc.text('TOTAL DO DIA:', margin + 8, pageHeight - 18);

          doc.setFontSize(8);
          doc.setTextColor(234, 88, 12);
          doc.text(`${Math.round(dayTotal.kcal)} kcal`, margin + 45, pageHeight - 18);
          doc.setTextColor(239, 68, 68);
          doc.text(`${Math.round(dayTotal.p)}g P`, margin + 90, pageHeight - 18);
          doc.setTextColor(245, 158, 11);
          doc.text(`${Math.round(dayTotal.c)}g C`, margin + 125, pageHeight - 18);
          doc.setTextColor(59, 130, 246);
          doc.text(`${Math.round(dayTotal.g)}g G`, margin + 160, pageHeight - 18);
          doc.setTextColor(0, 0, 0);
        }
      });

      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
      toast.success('PDF gerado com sucesso!', { id: toastId });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Ocorreu um erro ao gerar o PDF.', { id: toastId });
    }
  };

  const handleSearch = (term: string) => {
    setIsFiltering(true);
    setSearchTerm(term);
    setTimeout(() => setIsFiltering(false), 300);
  };

  const handleStatusFilterChange = (filter: string) => {
    setIsFiltering(true);
    setStatusFilter(filter);
    setTimeout(() => setIsFiltering(false), 300);
  };

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
      setSearchTerm: handleSearch,
      setStatusFilter: handleStatusFilterChange,
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
      handleGeneratePDF,
      fetchAdminData,
      handleDeleteDiet,
      handleOpenDietBuilder,
      handleOpenEvalModal,
      createRippleEffect,
    },
  };
}

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function AdminDashboard() {
  const { state, actions } = useAdminDashboard();
  const { isDark, toggleDarkMode } = useDarkMode();

  if (state.loading) {
    return (
      <div className="min-h-screen bg-stone-50/50 dark:bg-stone-950 p-4">
        <div className={ui.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1 },
  };

  return (
    <main
      className={cn(
        'min-h-screen bg-[#F8F9FA] dark:bg-stone-950 p-3 sm:p-4 md:p-8 lg:p-10 pt-20 lg:pt-28',
        'font-sans text-stone-800 dark:text-stone-200',
        'selection:bg-nutri-200 dark:selection:bg-nutri-800'
      )}
    >
      {/* HEADER */}
      <header className={ui.header}>
        <div className="flex justify-between items-center gap-3">
          <div className="flex-1">
            <h1 className={ui.headerTitle}>Painel Administrativo</h1>
            <p className="hidden md:block text-stone-500 dark:text-stone-400 text-sm mt-1.5 font-medium">
              Gestão inteligente de pacientes, agendas e resultados
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
              Última atualização: {state.lastUpdateTime}
            </p>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button
              onClick={toggleDarkMode}
              className="relative flex items-center justify-center h-9 w-9 md:h-11 md:w-11 rounded-xl transition-all duration-300 bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200/60 dark:border-stone-700"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={actions.handleBellClick}
              title={state.showOnlyNew ? 'Remover filtro' : 'Filtrar novos pacientes'}
              className={cn(
                'relative flex items-center justify-center h-9 w-9 md:h-11 md:w-11 rounded-xl transition-all duration-300',
                state.showOnlyNew
                  ? 'bg-nutri-50 dark:bg-nutri-950/50 text-nutri-700 dark:text-nutri-400 ring-1 ring-nutri-200 dark:ring-nutri-800'
                  : 'bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200/60 dark:border-stone-700'
              )}
            >
              <Bell size={18} className={state.unseenPatientsCount > 0 ? 'animate-pulse text-nutri-600 dark:text-nutri-400' : ''} />
              {state.unseenPatientsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border-2 border-white dark:border-stone-900 shadow-sm">
                  {state.unseenPatientsCount}
                </span>
              )}
            </button>

            <button
              onClick={actions.handleLogout}
              className="flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/30 w-9 h-9 md:w-auto md:px-5 md:h-11 rounded-xl font-semibold text-sm hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-300 transition-all active:scale-[0.98]"
              title="Sair do sistema"
            >
              <LogOut size={16} /> <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>

        <div className="flex flex-row gap-2 md:gap-4 pt-4 md:pt-6 border-t border-stone-100/80 dark:border-stone-800/80">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 group-focus-within:text-nutri-700 dark:group-focus-within:text-nutri-400 transition-colors" size={16} />
            <input
              type="text"
              placeholder={state.activeTab === 'pacientes' ? 'Buscar nome...' : state.activeTab === 'leads' ? 'Buscar lead...' : 'Buscar...'}
              className={cn(ui.input, 'pl-9 md:pl-12 pr-3 md:pr-4 h-9 md:h-12 text-sm')}
              onChange={e => actions.setSearchTerm(e.target.value)}
            />
          </div>
          {state.activeTab === 'pacientes' && (
            <div className="relative group w-[130px] md:min-w-[240px]">
              <Filter className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 group-focus-within:text-nutri-700 dark:group-focus-within:text-nutri-400 transition-colors pointer-events-none" size={16} />
              <select
                className="w-full px-3 md:pl-11 md:pr-10 h-9 md:h-12 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 hover:bg-white dark:hover:bg-stone-800 focus:bg-white dark:focus:bg-stone-800 outline-none focus:border-nutri-400 dark:focus:border-nutri-500 focus:ring-4 focus:ring-nutri-50 dark:focus:ring-nutri-950/30 transition-all font-medium text-xs md:text-sm text-stone-700 dark:text-stone-200 appearance-none cursor-pointer shadow-sm"
                onChange={e => actions.setStatusFilter(e.target.value)}
              >
                <option value="todos">Status</option>
                <option value="pendente">Pendente</option>
                <option value="plano_liberado">Liberado</option>
              </select>
              <ChevronRight className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 rotate-90 pointer-events-none" size={14} />
            </div>
          )}
        </div>
      </header>

      {/* ABAS + STATS LADO A LADO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 md:mb-8">
        {/* Abas */}
        <div className="flex gap-1.5 md:gap-2 overflow-x-auto scrollbar-hide p-1 md:p-1.5 bg-white dark:bg-stone-900 rounded-xl md:rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.03)] dark:shadow-stone-900/50 border border-stone-100/80 dark:border-stone-800/80 w-max max-w-full">
          {(['pacientes', 'leads', 'agenda', 'financeiro'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => actions.setActiveTab(tab)}
              className={cn(
                'flex items-center gap-1.5 md:gap-2 px-3 md:px-6 h-8 md:h-11 rounded-lg md:rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 whitespace-nowrap',
                state.activeTab === tab
                  ? tab === 'pacientes'
                    ? 'bg-nutri-800 dark:bg-nutri-700 text-white shadow-md'
                    : tab === 'leads'
                    ? 'bg-nutri-800 dark:bg-nutri-700 text-white shadow-md'
                    : tab === 'agenda'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-stone-800 dark:bg-stone-700 text-white shadow-md'
                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200'
              )}
            >
              {tab === 'pacientes' && <Users size={14} />}
              {tab === 'leads' && <Target size={14} />}
              {tab === 'agenda' && <Calendar size={14} />}
              {tab === 'financeiro' && <Settings size={14} />}
              {tab === 'pacientes' ? 'Pacientes' : tab === 'leads' ? 'Leads' : tab === 'agenda' ? 'Agenda' : 'Configs'}
              {tab === 'pacientes' && <span className="opacity-80 text-[10px] md:text-xs ml-0.5">({state.patients.length})</span>}
              {tab === 'leads' && state.activeLeadsCount > 0 && (
                <span
                  className={cn(
                    'ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                    state.activeTab === 'leads' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                  )}
                >
                  {state.activeLeadsCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 🔥 STATS COMPACTOS AO LADO DAS ABAS */}
        <div className="flex gap-2 shrink-0">
          <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800 px-3 py-1.5 text-center">
            <p className="text-[8px] text-stone-400 dark:text-stone-500 uppercase font-bold tracking-wider flex items-center justify-center gap-0.5">
              <MessageCircle size={9} className="text-nutri-600 dark:text-nutri-400" /> Msgs
            </p>
            <p className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">{state.todayTotalMessages}</p>
          </div>
          
          <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800 px-3 py-1.5 text-center">
            <p className="text-[8px] text-stone-400 dark:text-stone-500 uppercase font-bold tracking-wider flex items-center justify-center gap-0.5">
              <Users size={9} className="text-nutri-600 dark:text-nutri-400" /> Ativos
            </p>
            <p className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">{Object.keys(state.usageStats).length}</p>
          </div>
          
          <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800 px-3 py-1.5 text-center">
            <p className="text-[8px] text-stone-400 dark:text-stone-500 uppercase font-bold tracking-wider flex items-center justify-center gap-0.5">
              <Activity size={9} className="text-nutri-600 dark:text-nutri-400" /> Média
            </p>
            <p className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">
              {Object.keys(state.usageStats).length > 0 ? Math.round(state.todayTotalMessages / Object.keys(state.usageStats).length) : 0}
            </p>
          </div>
        </div>
      </div>

      {/* SENSE OF SPEED - overlay de loading durante filtros */}
      <motion.div
        animate={{ opacity: state.isFiltering ? 0.7 : 1, scale: state.isFiltering ? 0.99 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* TELA DE PACIENTES */}
        {state.activeTab === 'pacientes' && (
          <>
            
            {/* GRID DE CARDS */}
            <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4" 
                initial="hidden" 
                animate="visible" 
                variants={containerVariants}
              >
              {state.sortedPatients.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center p-10 md:p-14 rounded-2xl md:rounded-3xl border border-dashed border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-center">
                  <Users size={40} className="text-stone-300 dark:text-stone-600 mb-3" />
                  <h3 className="text-base md:text-lg font-bold text-stone-800 dark:text-stone-200 mb-1 tracking-tight">Nenhum paciente encontrado</h3>
                  <p className="text-xs md:text-sm text-stone-500 dark:text-stone-400 font-medium">Ajuste os filtros ou aguarde novos cadastros.</p>
                </div>
              ) : (
                state.sortedPatients.map(p => {
                  const isDietReady = Boolean(p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0);
                  const usage = state.usageStats[p.id] || 0;

                  return (
                    <motion.div
                    key={p.id}
                    variants={cardVariants}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      ui.card,
                      ui.cardInteractive,
                      p.isNew
                        ? 'border-nutri-300 dark:border-nutri-800 ring-4 ring-nutri-50 dark:ring-nutri-950/30'
                        : p.isLate
                        ? 'border-amber-200 dark:border-amber-800 ring-4 ring-amber-50 dark:ring-amber-950/30'
                        : isDietReady
                        ? 'border-emerald-100 dark:border-emerald-900 bg-gradient-to-br from-white to-emerald-50/20 dark:from-stone-900 dark:to-emerald-950/20'
                        : 'border-stone-100 dark:border-stone-800'
                    )}
                  >
                    <div className={ui.glowOverlay} />

                    <div
                      className={cn(
                        'h-1 w-full',
                        p.isNew
                          ? 'bg-nutri-400 dark:bg-nutri-600'
                          : p.isLate
                          ? 'bg-amber-400 dark:bg-amber-600'
                          : isDietReady
                          ? 'bg-emerald-400 dark:bg-emerald-600'
                          : 'bg-transparent'
                      )}
                    />

                    {p.isLate && (
                      <div className="absolute inset-0 ring-2 ring-amber-300/40 dark:ring-amber-700/40 rounded-2xl md:rounded-3xl pointer-events-none animate-pulse-soft" />
                    )}

                    {p.isNew && (
                      <div className="absolute inset-0 ring-2 ring-nutri-400/40 dark:ring-nutri-600/40 rounded-2xl md:rounded-3xl pointer-events-none" />
                    )}

                    <div className="p-3 md:p-4 flex flex-col h-full">
                      {state.editingId === p.id ? (
                        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                          <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-1.5">
                            <h4 className="font-bold text-stone-800 dark:text-stone-200 text-xs md:text-sm">Editar Perfil</h4>
                            <button onClick={() => actions.setEditingId(null)} className="p-0.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[8px] font-bold text-stone-500 uppercase tracking-wider">Nascimento</label>
                              <input
                                type="date"
                                className={cn(ui.input, 'h-7 text-[10px] px-1.5 mt-0.5')}
                                defaultValue={p.data_nascimento}
                                onChange={e => actions.setEditForm({ ...state.editForm, data_nascimento: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-stone-500 uppercase tracking-wider">Meta (kg)</label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="Ex: 65.5"
                                className={cn(ui.input, 'h-7 text-[10px] px-1.5 mt-0.5')}
                                defaultValue={p.meta_peso || ''}
                                onChange={e => actions.setEditForm({ ...state.editForm, meta_peso: e.target.value })}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-stone-500 uppercase tracking-wider">Perfil Clínico</label>
                            <select
                              className={cn(ui.input, 'h-7 text-[10px] px-1.5 mt-0.5 bg-white dark:bg-stone-800')}
                              defaultValue={p.tipo_perfil}
                              onChange={e => actions.setEditForm({ ...state.editForm, tipo_perfil: e.target.value })}
                            >
                              <option value="adulto">Adulto</option>
                              <option value="atleta">Atleta</option>
                              <option value="crianca">Criança</option>
                              <option value="idoso">Idoso</option>
                            </select>
                          </div>
                          <div className="p-1.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100/50">
                            <label className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-0.5 mb-0.5">
                              <Star size={10} /> Nível
                            </label>
                            <select
                              className="w-full h-6 text-[9px] px-1 border border-emerald-200 bg-white rounded-md font-semibold"
                              defaultValue={p.account_type || 'free'}
                              onChange={e => actions.setEditForm({ ...state.editForm, account_type: e.target.value })}
                            >
                              <option value="free">Básico</option>
                              <option value="premium">Premium</option>
                            </select>
                          </div>
                          <button onClick={() => actions.updateProfile(p.id)} className={cn(ui.buttonPrimary, 'h-7 w-full rounded-lg text-[10px]')}>
                            <Save size={12} /> Salvar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full">
                          {/* LINHA 1: Nome + Badges */}
                          <div className="flex justify-between items-start mb-1.5">
                            <div className="flex flex-col">
                              <Link href={`/admin/paciente/${p.id}/historico`} className="group">
                                <h3 className="font-black text-sm md:text-base tracking-tight text-stone-900 dark:text-white group-hover:text-nutri-600 transition-colors flex items-center gap-1">
                                  {p.full_name || 'Sem nome'}
                                  {p.account_type === 'premium' && <Star size={10} className="text-amber-400 fill-amber-400" />}
                                </h3>
                              </Link>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {p.isNew && (
                                  <span className={cn(ui.badge, ui.badgeInfo, 'text-[8px] py-0.5 px-1')}>
                                    <Bell size={7} className="inline mr-0.5 animate-pulse" /> NOVO
                                  </span>
                                )}
                                {p.isLate && (
                                  <span className={cn(ui.badge, ui.badgeWarning, 'text-[8px] py-0.5 px-1')}>
                                    <AlertCircle size={7} className="inline mr-0.5" /> AUSENTE
                                  </span>
                                )}
                                <span className={cn(ui.badge, ui.badgeNeutral, 'text-[8px] py-0.5 px-1')}>
                                  💬 {usage} msgs
                                </span>
                              </div>
                              <p className="text-[8px] text-stone-400 dark:text-stone-500 mt-0.5">
                                {p.isLate ? 'Última interação: +7 dias' : p.isNew ? 'Ativo agora' : 'Ativo hoje'}
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              <span className={cn(ui.badge, 'text-[8px] py-0.5 px-1.5', isDietReady ? ui.badgeSuccess : ui.badgeWarning)}>
                                {isDietReady ? '✅ Dieta' : '⏳ Pendente'}
                              </span>
                              <button
                                onClick={() => {
                                  actions.setEditingId(p.id);
                                  actions.setEditForm({
                                    data_nascimento: p.data_nascimento || '',
                                    sexo: p.sexo || '',
                                    tipo_perfil: p.tipo_perfil || 'adulto',
                                    meta_peso: p.meta_peso ? p.meta_peso.toString() : '',
                                    account_type: p.account_type || 'free',
                                  });
                                }}
                                className="p-0.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md text-stone-400 hover:text-nutri-600 transition-colors"
                              >
                                <Edit2 size={11} />
                              </button>
                            </div>
                          </div>

                          {/* LINHA 2: Perfil + Meta */}
                          <div className="grid grid-cols-2 gap-1.5 mb-2">
                            <div className="bg-stone-50 dark:bg-stone-800/50 p-1 rounded-md text-center">
                              <p className="text-[7px] text-stone-400 uppercase font-bold">Perfil</p>
                              <p className="text-[10px] font-semibold text-stone-700 dark:text-stone-300 capitalize">{p.tipo_perfil || 'Não def.'}</p>
                            </div>
                            <div className="bg-stone-50 dark:bg-stone-800/50 p-1 rounded-md text-center">
                              <p className="text-[7px] text-stone-400 uppercase font-bold">Meta</p>
                              <p className="text-[10px] font-semibold text-stone-700 dark:text-stone-300">{p.meta_peso ? `${p.meta_peso} kg` : 'N/A'}</p>
                            </div>
                          </div>

                          {/* LINHA 3: Avaliação */}
                          {p.evaluation ? (
                            <button
                              onClick={() => actions.handleOpenEvalModal(p)}
                              className="w-full flex items-center justify-between bg-stone-50 dark:bg-stone-800/30 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all p-1.5 rounded-md mb-2 group text-left"
                            >
                              <div className="flex-1">
                                <p className="font-bold text-nutri-600 dark:text-nutri-400 text-[8px] uppercase tracking-wider flex items-center gap-0.5">
                                  <Eye size={9} /> Inicial + QFA + Alergias
                                </p>
                                <p className="line-clamp-1 text-[9px] font-medium text-stone-500 dark:text-stone-400 italic">
                                  "{String(Object.values(p.evaluation.answers)[0] || '').substring(0, 45)}..."
                                </p>
                              </div>
                              <ChevronRight size={12} className="text-nutri-400 group-hover:text-nutri-600 transition-colors" />
                            </button>
                          ) : (
                            <div className="text-center py-1.5 mb-2 bg-stone-50 dark:bg-stone-800/30 rounded-md">
                              <FileText size={10} className="inline text-stone-300 mr-0.5" />
                              <span className="text-[9px] text-stone-400">Sem avaliação</span>
                            </div>
                          )}
                          
                          {/* LINHA 4: BOTÕES - UMA LINHA COMPACTA COM 5 BOTÕES (todos pequenos) */}
                          <div className="flex flex-wrap items-center justify-start gap-1 mt-1 pt-1.5 border-t border-stone-100 dark:border-stone-800">
                            {/* Botão Dieta/Editar - compacto */}
                            <button
                              onClick={e => {
                                actions.createRippleEffect(e);
                                actions.handleOpenDietBuilder(p);
                              }}
                              className={cn(
                                'rounded-md flex items-center justify-center gap-0.5 text-[9px] font-medium h-6 px-1.5',
                                isDietReady ? ui.buttonGhost : ui.buttonPrimary
                              )}
                            >
                              <Utensils size={8} /> {isDietReady ? 'Editar' : 'Dieta'}
                            </button>

                            {/* Botão PDF */}
                            {isDietReady && (
                              <button
                                onClick={e => {
                                  actions.createRippleEffect(e);
                                  actions.handleGeneratePDF(p);
                                }}
                                className={cn(ui.buttonGhost, 'rounded-md flex items-center justify-center gap-0.5 text-[9px] font-medium h-6 px-1.5')}
                                title="Gerar PDF"
                              >
                                <FileText size={8} /> PDF
                              </button>
                            )}

                            {/* Botão Cobrar */}
                            <a
                              href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá!`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                'rounded-md flex items-center justify-center gap-0.5 border transition-all h-6 text-[9px] font-medium px-1.5',
                                p.isLate
                                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                  : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 border-stone-200 dark:border-stone-700'
                              )}
                            >
                              <BellRing size={8} /> Cobrar
                            </a>

                            {/* Botão Clínico */}
                            <button
                              onClick={() => actions.setSelectedPatient({ id: p.id, name: p.full_name })}
                              className="rounded-md flex items-center justify-center gap-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 hover:bg-blue-100 transition-all h-6 text-[9px] font-medium px-1.5"
                            >
                              <Activity size={8} /> Clínico
                            </button>

                            {/* Botão WhatsApp (Zap) */}
                            <a
                              href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá!`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md flex items-center justify-center gap-0.5 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-all h-6 text-[9px] font-medium px-1.5"
                            >
                              <MessageCircle size={8} /> Zap
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                  );
                })
              )}
            </motion.div>
          </>
        )}

        {/* TELA DE LEADS */}
        {state.activeTab === 'leads' && (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5" initial="hidden" animate="visible" variants={containerVariants}>
            {state.filteredLeads.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-10 md:p-14 rounded-2xl md:rounded-3xl border border-dashed border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-center">
                <UserPlus size={40} className="text-stone-300 dark:text-stone-600 mb-3" />
                <h3 className="text-base md:text-lg font-bold text-stone-800 dark:text-stone-200 mb-1 tracking-tight">Nenhuma oportunidade no momento</h3>
                <p className="text-xs md:text-sm text-stone-500 dark:text-stone-400 font-medium">Novos leads aparecerão aqui quando preencherem a avaliação.</p>
              </div>
            ) : (
              state.filteredLeads.map((lead, idx) => (
                <motion.div
                  key={lead.id}
                  variants={cardVariants}
                  transition={{ duration: 0.4, delay: idx * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(ui.card, ui.cardInteractive, 'border-stone-100 dark:border-stone-800')}
                >
                  <div className={ui.glowOverlay} />
                  <div className="p-3 md:p-4 flex flex-col h-full">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-black text-sm md:text-base tracking-tight text-stone-900 dark:text-white flex items-center gap-1.5">
                          <UserPlus size={14} className="text-amber-500" /> {lead.nome}
                        </h3>
                        <span
                          className={cn(
                            ui.badge,
                            lead.status === 'concluido'
                              ? ui.badgeSuccess
                              : ui.badgeNeutral
                          )}
                        >
                          {lead.status === 'concluido' ? 'Concluído' : 'Abandonou'}
                        </span>
                      </div>
                      <p className="text-[10px] md:text-xs font-semibold text-stone-600 dark:text-stone-400 mb-2 flex items-center gap-1 bg-stone-50 dark:bg-stone-800/50 w-fit px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700">
                        <MessageCircle size={10} className="text-[#25D366]" /> {lead.whatsapp}
                      </p>
                      <div className="bg-stone-50/50 dark:bg-stone-800/30 p-2 rounded-lg border border-stone-100 dark:border-stone-800 mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Progresso</span>
                          <span className="text-[9px] font-extrabold text-nutri-700 dark:text-nutri-400">
                            {(Object.keys(lead.respostas || {}).length / 10) * 100}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                            style={{ width: `${(Object.keys(lead.respostas || {}).length / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <a
                      href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, '')}?text=Olá!`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(ui.buttonPrimary, 'w-full h-7 rounded-md text-[10px]')}
                    >
                      <MessageCircle size={12} /> Entrar em Contato
                    </a>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* TELA DE AGENDA */}
        {state.activeTab === 'agenda' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={cn(ui.header, 'mb-4 md:mb-6 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6 text-center md:text-left p-4 md:p-6')}>
              <div>
                <h2 className="text-lg md:text-2xl font-extrabold text-stone-900 dark:text-white flex items-center justify-center md:justify-start gap-2 md:gap-3 tracking-tight">
                  <Calendar className="text-blue-500" size={20} /> Minha Agenda
                </h2>
                <p className="text-xs md:text-sm text-stone-500 dark:text-stone-400 font-medium mt-0.5">Gerencie seus compromissos e links de marcação.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                <a
                  href="https://calendly.com/app/scheduled_events/user/me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(ui.buttonPrimary, 'w-full sm:w-auto px-4 h-8 text-xs')}
                >
                  <ExternalLink size={12} /> Ver Calendário
                </a>
                <button
                  onClick={actions.copyToClipboard}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-4 h-8 rounded-lg font-medium text-xs text-stone-700 dark:text-stone-300 transition-all hover:bg-stone-50 dark:hover:bg-stone-700 active:scale-[0.98]"
                >
                  {state.copiedLink ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-stone-400" />}
                  {state.copiedLink ? 'Copiado!' : 'Copiar Link'}
                </button>
              </div>
            </div>
            <div className="bg-white dark:bg-stone-900 rounded-2xl md:rounded-3xl shadow-sm border border-stone-100 dark:border-stone-800 h-[450px] md:h-[650px] relative overflow-hidden">
              {state.calendlyUrl ? (
                <iframe src={state.calendlyUrl} width="100%" height="100%" frameBorder="0" className="absolute inset-0 bg-stone-50 dark:bg-stone-900" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-stone-400 dark:text-stone-500 p-6 text-center">
                  <Link2 size={32} className="mb-2 opacity-50" />
                  <p className="font-medium text-sm">Adicione o link do seu Calendly na aba de Configurações.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TELA DE FINANCEIRO */}
        {state.activeTab === 'financeiro' && (
          <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500 bg-white dark:bg-stone-900 p-5 md:p-10 rounded-2xl md:rounded-[2rem] shadow-sm border border-stone-100 dark:border-stone-800">
            <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-3 md:gap-4 mb-6 md:mb-8 border-b border-stone-100 dark:border-stone-800 pb-5 md:pb-6">
              <div className="bg-stone-100 dark:bg-stone-800 p-2 md:p-3 rounded-xl text-stone-700 dark:text-stone-300">
                <Settings size={22} />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-extrabold text-stone-900 dark:text-white tracking-tight">Configurações do Sistema</h2>
                <p className="text-xs md:text-sm text-stone-500 dark:text-stone-400 font-medium mt-0.5">Defina preços base e integrações para captação.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 mb-6 md:mb-8">
              <div className="bg-stone-50/50 dark:bg-stone-800/50 p-3 md:p-5 rounded-xl md:rounded-2xl border border-stone-200 dark:border-stone-700 focus-within:ring-2 focus-within:ring-amber-100 dark:focus-within:ring-amber-900 focus-within:border-amber-400 transition-all">
                <label className="text-[9px] md:text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Star size={12} className="text-amber-500" /> Premium
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-stone-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={state.premiumPrice}
                    onChange={e => actions.setPremiumPrice(e.target.value)}
                    className="w-full bg-transparent text-xl md:text-2xl font-extrabold text-stone-800 dark:text-stone-200 outline-none"
                  />
                </div>
              </div>
              <div className="bg-stone-50/50 dark:bg-stone-800/50 p-3 md:p-5 rounded-xl md:rounded-2xl border border-stone-200 dark:border-stone-700 focus-within:ring-2 focus-within:ring-nutri-100 dark:focus-within:ring-nutri-900 focus-within:border-nutri-400 transition-all">
                <label className="text-[9px] md:text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <FileText size={12} className="text-nutri-600" /> Plano
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-stone-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={state.mealPlanPrice}
                    onChange={e => actions.setMealPlanPrice(e.target.value)}
                    className="w-full bg-transparent text-xl md:text-2xl font-extrabold text-stone-800 dark:text-stone-200 outline-none"
                  />
                </div>
              </div>
              <div className="bg-stone-50/50 dark:bg-stone-800/50 p-3 md:p-5 rounded-xl md:rounded-2xl border border-stone-200 dark:border-stone-700 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900 focus-within:border-blue-400 transition-all">
                <label className="text-[9px] md:text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Calendar size={12} className="text-blue-500" /> Consulta
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-stone-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={state.consultationPrice}
                    onChange={e => actions.setConsultationPrice(e.target.value)}
                    className="w-full bg-transparent text-xl md:text-2xl font-extrabold text-stone-800 dark:text-stone-200 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-stone-50/50 dark:bg-stone-800/50 p-3 md:p-5 rounded-xl md:rounded-2xl border border-stone-200 dark:border-stone-700 mb-6 md:mb-8 focus-within:ring-2 focus-within:ring-stone-200 dark:focus-within:ring-stone-800 focus-within:border-stone-400 transition-all">
              <label className="text-[9px] md:text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Link2 size={12} className="text-stone-700 dark:text-stone-400" /> URL do Calendly
              </label>
              <input
                type="url"
                placeholder="https://calendly.com/seulink"
                value={state.calendlyUrl}
                onChange={e => actions.setCalendlyUrl(e.target.value)}
                className="w-full bg-transparent text-sm md:text-base font-medium text-stone-800 dark:text-stone-200 outline-none border-b border-stone-200 dark:border-stone-700 focus:border-stone-600 dark:focus:border-stone-400 pb-1 transition-colors"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={actions.handleSaveSettings}
                disabled={state.isSavingPrice}
                className={cn(ui.buttonPrimary, 'w-full md:w-auto px-6 h-9 rounded-lg text-sm disabled:opacity-70')}
              >
                {state.isSavingPrice ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* MODAL AVALIAÇÃO */}
      {state.evalModalOpen.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl flex flex-col max-h-[85vh] sm:max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            <div className="border-b border-stone-100 dark:border-stone-800 shrink-0">
              <div className="flex justify-between items-center p-4 md:p-5 pb-0">
                <div>
                  <h3 className="font-extrabold text-base md:text-lg text-stone-900 dark:text-white tracking-tight">Prontuário do Paciente</h3>
                  <p className="text-xs md:text-sm font-semibold text-stone-500 dark:text-stone-400 mt-0.5">{state.evalModalOpen.name}</p>
                </div>
                <button
                  onClick={() => actions.setEvalModalOpen({ isOpen: false, data: null, name: '', qfaData: null, foodRestrictions: [] })}
                  className="p-1.5 bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex gap-1 px-4 md:px-5 mt-3">
                <button
                  onClick={() => actions.setEvalModalActiveTab('avaliacao')}
                  className={cn(
                    'px-3 py-2 text-xs md:text-sm font-bold rounded-t-xl transition-all',
                    state.evalModalActiveTab === 'avaliacao'
                      ? 'bg-nutri-50 dark:bg-nutri-950/50 text-nutri-700 dark:text-nutri-400 border-b-2 border-nutri-500 dark:border-nutri-600'
                      : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                  )}
                >
                  📋 Avaliação
                </button>
                <button
                  onClick={() => actions.setEvalModalActiveTab('qfa')}
                  className={cn(
                    'px-3 py-2 text-xs md:text-sm font-bold rounded-t-xl transition-all',
                    state.evalModalActiveTab === 'qfa'
                      ? 'bg-nutri-50 dark:bg-nutri-950/50 text-nutri-700 dark:text-nutri-400 border-b-2 border-nutri-500 dark:border-nutri-600'
                      : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                  )}
                >
                  🍽️ QFA
                </button>
                <button
                  onClick={() => actions.setEvalModalActiveTab('perfil')}
                  className={cn(
                    'px-3 py-2 text-xs md:text-sm font-bold rounded-t-xl transition-all',
                    state.evalModalActiveTab === 'perfil'
                      ? 'bg-nutri-50 dark:bg-nutri-950/50 text-nutri-700 dark:text-nutri-400 border-b-2 border-nutri-500 dark:border-nutri-600'
                      : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                  )}
                >
                  ⚠️ Perfil
                </button>
              </div>
            </div>
            <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1">
              {state.evalModalActiveTab === 'avaliacao' && (
                <div className="space-y-2 md:space-y-3 animate-in fade-in duration-200">
                  {Object.entries(state.evalModalOpen.data || {}).length === 0 ? (
                    <div className="text-center py-10 text-stone-400 dark:text-stone-500 font-medium">
                      <FileText size={40} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma avaliação inicial preenchida</p>
                    </div>
                  ) : (
                    Object.entries(state.evalModalOpen.data || {}).map(([k, v]) => (
                      <div key={k} className="bg-stone-50/80 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 p-3 md:p-4 rounded-xl">
                        <p className="text-[9px] md:text-[10px] font-bold text-nutri-700 dark:text-nutri-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-nutri-100 dark:bg-nutri-900 text-nutri-800 dark:text-nutri-300 flex items-center justify-center text-[9px] shrink-0">
                            {parseInt(k as string) + 1}
                          </span>
                          <span className="line-clamp-2 leading-tight">{questionTitles[parseInt(k as string)]}</span>
                        </p>
                        <p className="text-xs md:text-sm font-medium text-stone-800 dark:text-stone-200 ml-6 leading-relaxed">{v as string}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
              {state.evalModalActiveTab === 'qfa' && (
                <div className="space-y-2 md:space-y-3 animate-in fade-in duration-200">
                  {!state.evalModalOpen.qfaData || Object.keys(state.evalModalOpen.qfaData).length === 0 ? (
                    <div className="text-center py-10 text-stone-400 dark:text-stone-500 font-medium">
                      <Utensils size={40} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum QFA preenchido</p>
                    </div>
                  ) : (
                    qfaSchemaDisplay.map((section, idx) => {
                      const answeredItems = section.items.filter(itemId => state.evalModalOpen.qfaData?.[itemId]);
                      if (answeredItems.length === 0) return null;
                      return (
                        <div key={idx} className="bg-stone-50/80 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 p-3 md:p-4 rounded-xl">
                          <h4 className="text-[10px] font-black text-nutri-700 dark:text-nutri-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <div className="w-1 h-3 bg-nutri-500 rounded-full" />
                            {section.category}
                          </h4>
                          <div className="space-y-1.5">
                            {answeredItems.map(itemId => (
                              <div key={itemId} className="flex justify-between items-center py-1 border-b border-stone-100 dark:border-stone-800 last:border-0">
                                <span className="text-[10px] md:text-xs font-medium text-stone-700 dark:text-stone-300">{qfaLabels[itemId] || itemId}</span>
                                <span className="text-[9px] md:text-[10px] font-extrabold text-nutri-800 dark:text-nutri-300 bg-nutri-100 dark:bg-nutri-900 px-2 py-0.5 rounded-full">
                                  {state.evalModalOpen.qfaData?.[itemId]}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {state.evalModalActiveTab === 'perfil' && (
                <div className="space-y-3 md:space-y-4 animate-in fade-in duration-200">
                  {!state.evalModalOpen.foodRestrictions || state.evalModalOpen.foodRestrictions.length === 0 ? (
                    <div className="text-center py-10 text-stone-400 dark:text-stone-500 font-medium">
                      <AlertCircle size={40} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma restrição alimentar cadastrada</p>
                    </div>
                  ) : (
                    <>
                      {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'allergy').length > 0 && (
                        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 md:p-4 rounded-xl">
                          <h4 className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">🚫 Alergias</h4>
                          <div className="flex flex-wrap gap-1">
                            {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'allergy').map((r, idx) => (
                              <span key={idx} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-md text-[9px] font-bold">
                                {r.food || r.tag || r.foodId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'intolerance').length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 md:p-4 rounded-xl">
                          <h4 className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">⚠️ Intolerâncias</h4>
                          <div className="flex flex-wrap gap-1">
                            {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'intolerance').map((r, idx) => (
                              <span key={idx} className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md text-[9px] font-bold">
                                {r.food || r.tag || r.foodId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'restriction').length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 md:p-4 rounded-xl">
                          <h4 className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1">📋 Restrições</h4>
                          <div className="flex flex-wrap gap-1">
                            {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'restriction').map((r, idx) => (
                              <span key={idx} className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md text-[9px] font-bold">
                                {r.food || r.tag || r.foodId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DIETA */}
      {state.dietModalOpen.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-0 md:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-5xl relative my-auto h-full md:h-auto flex flex-col animate-in zoom-in-95 duration-300">
            <div className="hidden md:flex justify-end mb-3">
              <button
                onClick={() => {
                  actions.setDietModalOpen({ ...state.dietModalOpen, isOpen: false });
                  actions.fetchAdminData();
                }}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-md transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="bg-white dark:bg-stone-900 md:rounded-2xl shadow-2xl flex-1 overflow-hidden h-full md:h-auto border border-white/20 dark:border-stone-800/20 flex flex-col">
              <div className="md:hidden flex justify-between items-center p-3 border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shrink-0">
                <span className="font-bold text-sm text-stone-800 dark:text-stone-200">Montar Dieta</span>
                <button
                  onClick={() => {
                    actions.setDietModalOpen({ ...state.dietModalOpen, isOpen: false });
                    actions.fetchAdminData();
                  }}
                  className="p-1.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-full"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <DietBuilder
                  patientId={state.dietModalOpen.id}
                  patientName={state.dietModalOpen.name}
                  onClose={() => {
                    actions.setDietModalOpen({ ...state.dietModalOpen, isOpen: false });
                    actions.fetchAdminData();
                  }}
                  targetRecommendation={state.dietModalOpen.targetRecommendation}
                  foodRestrictions={state.dietModalOpen.foodRestrictions}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <ClinicalDataModal
        isOpen={!!state.selectedPatient}
        onClose={() => actions.setSelectedPatient(null)}
        patientId={state.selectedPatient?.id || ''}
        patientName={state.selectedPatient?.name || ''}
      />

      <ChatAssistant role="admin" adminContext={state.adminContext} />
    </main>
  );
}