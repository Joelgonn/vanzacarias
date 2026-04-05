'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, LogOut, Users, MessageCircle, Search, Filter, 
  Edit2, Save, X, TrendingUp, AlertCircle, Bell, BellRing, 
  Activity, Target, Eye, UserPlus, Clock, ChevronRight, Star,
  DollarSign, FileText, Calendar, Link2, Copy, Check, ExternalLink, 
  Utensils, CheckCircle2, Settings, Trash2
} from 'lucide-react';
import ClinicalDataModal from '@/components/ClinicalDataModal';
import DietBuilder from '@/components/DietBuilder'; 
import ChatAssistant from '@/components/ChatAssistant'; 
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { FoodRestriction } from '@/types/patient';

// Importação do motor metabólico centralizado
import { getPatientMetabolicData } from '@/lib/getPatientMetabolicData';
import { buildBodyComposition } from '@/lib/nutrition/bodyComposition';

// =========================================================================
// INTERFACES E TIPAGENS
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
// CONSTANTES E HELPERS
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

// 🔥 SCHEMA DO QFA PARA EXIBIÇÃO NO MODAL
const qfaSchemaDisplay = [
  {
    category: "Leites e Derivados",
    items: ["leite", "iogurte", "queijos", "requeijao"]
  },
  {
    category: "Carnes e Ovos",
    items: ["ovo", "carne_vermelha", "carne_porco", "frango", "peixe"]
  },
  {
    category: "Óleos",
    items: ["azeite", "bacon", "frituras", "manteiga", "maionese", "oleos_veg"]
  },
  {
    category: "Cereais e Leguminosas",
    items: ["arroz", "aveia", "pao", "macarrao", "bolos", "leguminosas", "soja", "oleaginosas"]
  },
  {
    category: "Frutas/Verduras/Legumes",
    items: ["fruta", "folhosos", "tuberculos", "legumes"]
  },
  {
    category: "Petiscos embutidos Enlatados",
    items: ["snacks", "instantaneos", "embutidos", "enlatados"]
  },
  {
    category: "Sobremesas e Doces",
    items: ["sorvete", "tortas", "chocolates", "balas"]
  },
  {
    category: "Bebidas",
    items: ["agua", "cafe_s_acucar", "suco_natural_s_acucar", "refrigerante", "cafe_c_acucar", "suco_natural_c_acucar", "suco_caixinha"]
  }
];

const qfaLabels: Record<string, string> = {
  leite: "Leite (copo de requeijão)",
  iogurte: "Iogurte natural (copo de requeijão)",
  queijos: "Queijos (1/2 fatia)",
  requeijao: "Requeijão / Creme de ricota (1,5 colher sopa)",
  ovo: "Ovo cozido / mexido (2 unidades)",
  carne_vermelha: "Carnes vermelhas (1 unidade)",
  carne_porco: "Carnes de Porco (1 fatia)",
  frango: "Frango (1 unidade)",
  peixe: "Peixe fresco / Frutos do Mar (1 unidade)",
  azeite: "Azeite (1 colher de sopa)",
  bacon: "Bacon e toucinho (1/2 fatia)",
  frituras: "Frituras",
  manteiga: "Manteiga / Margarina (1/2 colher sopa)",
  maionese: "Maionese (1/2 colher sopa)",
  oleos_veg: "Óleos vegetais (1 colher de sopa)",
  arroz: "Arroz Branco / Integral (4 colheres sopa)",
  aveia: "Aveia (4 colheres de sopa)",
  pao: "Pão (1 unidade)",
  macarrao: "Macarrão (3,5 colheres sopa)",
  bolos: "Bolos caseiros (1 fatia pequena)",
  leguminosas: "Leguminosas (1 concha)",
  soja: "Soja (1 colher de servir)",
  oleaginosas: "Oleaginosas (1 colher de sopa)",
  fruta: "Fruta in natura (1 unidade/fatia)",
  folhosos: "Folhosos (10 folhas)",
  tuberculos: "Tubérculos (2 colheres sopa)",
  legumes: "Legumes (2 colheres sopa)",
  snacks: "Snacks (1 pacote)",
  instantaneos: "Macarrão instantâneo (1 pacote)",
  embutidos: "Embutidos (2 fatias)",
  enlatados: "Enlatados (2 colheres sopa)",
  sorvete: "Sorvete (1 unidade ou 2 bolas)",
  tortas: "Tortas e Doces (1 fatia)",
  chocolates: "Chocolates (1 unidade)",
  balas: "Balas (1 unidade)",
  agua: "Água (1 garrafa 510 ml)",
  cafe_s_acucar: "Café sem açúcar (1 xícara)",
  suco_natural_s_acucar: "Suco Natural sem açúcar (copo)",
  refrigerante: "Refrigerante (copo)",
  cafe_c_acucar: "Café com açúcar (1 xícara)",
  suco_natural_c_acucar: "Suco Natural adoçado (copo)",
  suco_caixinha: "Sucos de Caixinha (copo)"
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

// =========================================================================
// HOOK DE LÓGICA E ESTADO
// =========================================================================
function useAdminDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [lastSeenNewPatientTime, setLastSeenNewPatientTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'pacientes' | 'leads' | 'agenda' | 'financeiro'>('pacientes');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{id: string, name: string} | null>(null);
  
  // 🔥 ESTADO EXPANDIDO DO MODAL (com qfaData, foodRestrictions)
  const [evalModalOpen, setEvalModalOpen] = useState<{
    isOpen: boolean, 
    data: any, 
    name: string,
    qfaData: any,
    foodRestrictions: FoodRestriction[]
  }>({ 
    isOpen: false, 
    data: null, 
    name: '',
    qfaData: null,
    foodRestrictions: []
  });
  
  // 🔥 ABA ATIVA DO MODAL
  const [evalModalActiveTab, setEvalModalActiveTab] = useState<'avaliacao' | 'qfa' | 'perfil'>('avaliacao');
  
  const [dietModalOpen, setDietModalOpen] = useState<{
    isOpen: boolean, 
    id: string, 
    name: string,
    targetRecommendation: any | null,
    foodRestrictions: FoodRestriction[]
  }>({ 
    isOpen: false, 
    id: '', 
    name: '',
    targetRecommendation: null,
    foodRestrictions: [] 
  });
  
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
    account_type: 'free'
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

      // 1. Busca os Perfis
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

        const weight =
          lastAntro?.weight ||
          lastCheckin?.peso ||
          null;

        const composition = buildBodyComposition({
          skin: latestSkin,
          weight,
          birthDate: profile.data_nascimento,
          gender: profile.sexo
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
          leanMass: composition?.leanMass || null
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

      aiUsage?.forEach((msg) => {
        if (msg.user_id) usageMap[msg.user_id] = (usageMap[msg.user_id] || 0) + 1;
        total++;
      });

      setUsageStats(usageMap);
      setTodayTotalMessages(total);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Ocorreu um erro ao carregar as informações do painel.");
    } finally {
      setLoading(false);
    }
  }

  // 🔥 FUNÇÃO PARA ABRIR MODAL COM DADOS COMPLETOS (QFA + RESTRIÇÕES)
  const handleOpenEvalModal = async (patient: Patient) => {
    // Buscar QFA do paciente
    const { data: qfaData } = await supabase
      .from('qfa_responses')
      .select('answers')
      .eq('user_id', patient.id)
      .single();
    
    setEvalModalOpen({
      isOpen: true,
      data: patient.evaluation?.answers || null,
      name: patient.full_name,
      qfaData: qfaData?.answers || null,
      foodRestrictions: patient.food_restrictions || []
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

  const filteredLeads = useMemo(() => {
    return leads.filter(l => l.nome?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [leads, searchTerm]);
  
  const adminContext = useMemo(() => {
    // Mapeia os pacientes para incluir a composição corporal mais recente
    const patientsWithComposition = patients.map(patient => {
      // Buscar a composição mais recente do paciente a partir dos dados disponíveis
      // Como os dados de BF e leanMass já estão no paciente (vindos do fetchAdminData)
      const hasComposition = !!(patient.bf || patient.leanMass);
      
      let evolucaoGordura = '';
      let evolucaoMassaMagra = '';
      
      // Tentar encontrar evolução comparando com registros anteriores
      // (Isso seria ideal, mas para simplificar, usamos apenas o dado atual)
      if (patient.bf) {
        // Se tiver percentual de gordura, incluímos
        evolucaoGordura = patient.bf ? `${patient.bf}% atualmente` : '';
      }
      
      if (patient.leanMass) {
        evolucaoMassaMagra = patient.leanMass ? `${patient.leanMass}kg de massa magra` : '';
      }
      
      return {
        ...patient,
        composicaoCorporal: hasComposition ? {
          percentualGordura: patient.bf || null,
          massaGorda: null, // Não temos esse dado diretamente no patient
          massaMagra: patient.leanMass || null,
          ultimaAvaliacao: null,
          evolucaoGordura,
          evolucaoMassaMagra
        } : null
      };
    });
    
    return {
      patients: patientsWithComposition,
      leads,
      usageStats,
      todayTotalMessages
    };
  }, [patients, leads, usageStats, todayTotalMessages]);

  const updateProfile = async (id: string) => {
    const updateData = {
      data_nascimento: editForm.data_nascimento?.trim() ? editForm.data_nascimento : null,
      sexo: editForm.sexo?.trim() ? editForm.sexo : null,
      tipo_perfil: editForm.tipo_perfil,
      account_type: editForm.account_type,
      meta_peso: editForm.meta_peso && String(editForm.meta_peso).trim() !== '' ? parseFloat(String(editForm.meta_peso)) : null
    };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
    if (!error) {
      setEditingId(null);
      fetchAdminData();
      toast.success("Perfil atualizado com sucesso!");
    } else {
      toast.error("Falha ao atualizar o perfil.");
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingPrice(true);
    const updatePayload: Partial<SystemSettings> = { 
      premium_price: parseFloat(premiumPrice),
      meal_plan_price: parseFloat(mealPlanPrice),
      consultation_price: parseFloat(consultationPrice),
      calendly_url: calendlyUrl
    };

    const { error } = await supabase.from('system_settings').update(updatePayload).eq('id', 1);
    if (!error) toast.success("Configurações salvas com sucesso!");
    else toast.error("Erro ao salvar as configurações.");
    setIsSavingPrice(false);
  };

  const copyToClipboard = () => {
    if(!calendlyUrl) return toast.warning("Não há link configurado para copiar.");
    navigator.clipboard.writeText(calendlyUrl);
    setCopiedLink(true);
    toast.success("Link copiado para a área de transferência!");
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
    if (!window.confirm("Tem certeza que deseja excluir o cardápio atual? Essa ação não pode ser desfeita.")) {
      return;
    }

    const toastId = toast.loading("Excluindo dieta...");
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ meal_plan: null, status: 'pendente' })
        .eq('id', patientId);

      if (error) throw error;

      toast.success("Dieta excluída. Pronto para criar uma nova.", { id: toastId });
      fetchAdminData(); 
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir a dieta.", { id: toastId });
    }
  };

  const handleOpenDietBuilder = async (p: Patient) => {
    const toastId = toast.loading("Calculando metabolismo e necessidades...");

    try {
      const metabolicData = await getPatientMetabolicData(p.id, {
        patientId: p.id,
        weight: p.peso || p.weight || null,
        height: p.altura || p.height || null,
        data_nascimento: p.data_nascimento || null,
        sexo: p.sexo || null,
        bf: p.bf || null,
        leanMass: p.massa_magra || p.leanMass || null
      });

      toast.dismiss(toastId);

      setDietModalOpen({
        isOpen: true,
        id: p.id,
        name: p.full_name,
        targetRecommendation: metabolicData.recommendation,
        foodRestrictions: p.food_restrictions || []
      });

    } catch (e) {
      console.error("Erro ao gerar recomendação:", e);
      toast.error("Erro ao calcular dados. Verifique o cadastro.", { id: toastId });
    }
  };
  
  const handleGeneratePDF = async (patient: Patient) => {
    if (!patient.meal_plan || patient.meal_plan.length === 0) {
      toast.warning("A dieta deste paciente está vazia.");
      return;
    }

    const toastId = toast.loading("Gerando PDF...");
    try {
      const mealPlanJSON = patient.meal_plan;
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;

      // Cálculos totais com macros
      const totalKcal = mealPlanJSON.reduce((acc: number, meal: any) => acc + (meal.options[0]?.kcal || 0), 0);
      const totalProtein = mealPlanJSON.reduce((acc: number, meal: any) => acc + (meal.options[0]?.macros?.p || 0), 0);
      const totalCarbs = mealPlanJSON.reduce((acc: number, meal: any) => acc + (meal.options[0]?.macros?.c || 0), 0);
      const totalFat = mealPlanJSON.reduce((acc: number, meal: any) => acc + (meal.options[0]?.macros?.g || 0), 0);

      const daysMap = new Map<string, any[]>();
      mealPlanJSON.forEach((meal: any) => {
        meal.options.forEach((opt: any) => {
          const dayName = opt.day?.trim() || "Opção";
          if (!daysMap.has(dayName)) daysMap.set(dayName, []);
          daysMap.get(dayName)!.push({ 
            mealName: meal.name, 
            time: meal.time, 
            description: opt.description,
            foodItems: opt.foodItems || [],
            kcal: opt.kcal,
            macros: opt.macros || { p: 0, c: 0, g: 0 }
          });
        });
      });

      const dayOrder = ["Todos os dias", "Segunda a Sexta", "Finais de Semana", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
      const sortedDays = Array.from(daysMap.keys()).sort((a, b) => {
        let idxA = dayOrder.indexOf(a); let idxB = dayOrder.indexOf(b);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });

      let logoBase64: string | null = null;
      try { logoBase64 = await getBase64ImageFromUrl('/images/logo-vanusa.png'); } catch (error) {}

      const printHeaderAndFooter = () => {
        let currentY = 20;
        if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, currentY - 6, 16, 16); 
        const textStartX = logoBase64 ? margin + 20 : margin;
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(26, 58, 42); 
        doc.text("Vanusa Zacarias", textStartX, currentY + 2);
        doc.setFontSize(10);
        doc.setTextColor(139, 131, 120); 
        doc.text("NUTRIÇÃO CLÍNICA", textStartX, currentY + 8, { charSpace: 1.5 });
        doc.setFontSize(12);
        doc.setTextColor(200, 200, 200);
        doc.text("PLANO ALIMENTAR", pageWidth - margin, currentY + 8, { align: "right" });

        currentY += 18;
        doc.setDrawColor(26, 58, 42);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;

        // Linha do paciente e data
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text("PACIENTE:", margin, currentY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        doc.text(patient.full_name || "Paciente", margin + 20, currentY);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text("DATA:", margin + 85, currentY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        doc.text(new Date().toLocaleDateString('pt-BR'), margin + 98, currentY);

        currentY += 6; 

        // Linha da base diária
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text("BASE DIÁRIA:", margin, currentY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(234, 88, 12);
        doc.text(`~${Math.round(totalKcal)} kcal`, margin + 35, currentY);
        
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        
        doc.setTextColor(150, 150, 150);
        doc.text("|", margin + 65, currentY);
        
        doc.setTextColor(239, 68, 68);
        doc.text(`P: ${Math.round(totalProtein)}g`, margin + 70, currentY);
        
        doc.setTextColor(150, 150, 150);
        doc.text("|", margin + 95, currentY);
        
        doc.setTextColor(245, 158, 11);
        doc.text(`C: ${Math.round(totalCarbs)}g`, margin + 100, currentY);
        
        doc.setTextColor(150, 150, 150);
        doc.text("|", margin + 125, currentY);
        
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
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text("Plano alimentar individual e intransferível elaborado por Vanusa Zacarias - Nutrição Clínica.", pageWidth / 2, pageHeight - 10, { align: "center" });

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
        doc.rect(margin, y, pageWidth - (margin * 2), 12, 'F');
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255); 
        const titleText = day.toUpperCase() === 'TODOS OS DIAS' ? 'CARDÁPIO PADRÃO (TODOS OS DIAS)' : `CARDÁPIO: ${day.toUpperCase()}`;
        doc.text(titleText, pageWidth / 2, y + 8, { align: "center", charSpace: 1 });
        y += 20;

        const mealsForDay = daysMap.get(day) || [];
        
        const dayTotal = {
          kcal: mealsForDay.reduce((sum, m) => sum + (m.kcal || 0), 0),
          p: mealsForDay.reduce((sum, m) => sum + (m.macros?.p || 0), 0),
          c: mealsForDay.reduce((sum, m) => sum + (m.macros?.c || 0), 0),
          g: mealsForDay.reduce((sum, m) => sum + (m.macros?.g || 0), 0)
        };

        mealsForDay.forEach(meal => {
          if (y > pageHeight - 50) { 
            doc.addPage(); 
            y = printHeaderAndFooter(); 
            doc.setFillColor(26, 58, 42); 
            doc.rect(margin, y, pageWidth - (margin * 2), 12, 'F');
            doc.text(titleText, pageWidth / 2, y + 8, { align: "center", charSpace: 1 });
            y += 20;
          }

          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(26, 58, 42);
          
          const mealTitle = `${meal.mealName.toUpperCase()} - ${meal.time}`;
          doc.text(mealTitle, margin, y);
          
          const macroStartX = pageWidth - margin - 5;
          
          const kcalText = `${Math.round(meal.kcal || 0)} kcal`;
          const proteinText = `P: ${Math.round(meal.macros?.p || 0)}g`;
          const carbsText = `C: ${Math.round(meal.macros?.c || 0)}g`;
          const fatText = `G: ${Math.round(meal.macros?.g || 0)}g`;
          
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          
          const kcalWidth = doc.getTextWidth(kcalText);
          const proteinWidth = doc.getTextWidth(proteinText);
          const carbsWidth = doc.getTextWidth(carbsText);
          const fatWidth = doc.getTextWidth(fatText);
          const separatorWidth = doc.getTextWidth(" | ");
          
          const totalWidth = kcalWidth + separatorWidth + proteinWidth + separatorWidth + carbsWidth + separatorWidth + fatWidth;
          
          let currentX = macroStartX - totalWidth;
          
          doc.setTextColor(234, 88, 12);
          doc.text(kcalText, currentX, y);
          currentX += kcalWidth + 2;
          
          doc.setTextColor(150, 150, 150);
          doc.text("|", currentX, y);
          currentX += separatorWidth;
          
          doc.setTextColor(239, 68, 68);
          doc.text(proteinText, currentX, y);
          currentX += proteinWidth + 2;
          
          doc.setTextColor(150, 150, 150);
          doc.text("|", currentX, y);
          currentX += separatorWidth;
          
          doc.setTextColor(245, 158, 11);
          doc.text(carbsText, currentX, y);
          currentX += carbsWidth + 2;
          
          doc.setTextColor(150, 150, 150);
          doc.text("|", currentX, y);
          currentX += separatorWidth;
          
          doc.setTextColor(59, 130, 246);
          doc.text(fatText, currentX, y);
          
          doc.setTextColor(0, 0, 0);
          y += 6;
          
          doc.setFontSize(9.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(50, 50, 50);
          
          let descriptionText = '';
          if (meal.foodItems && meal.foodItems.length > 0) {
            descriptionText = formatFoodList(meal.foodItems);
          } else if (meal.description) {
            descriptionText = meal.description;
          }
          
          if (descriptionText) {
            const maxWidth = pageWidth - (margin * 2);
            const splitDesc = doc.splitTextToSize(descriptionText, maxWidth);
            doc.text(splitDesc, margin, y);
            y += (splitDesc.length * 5);
          } else {
            y += 2;
          }
          
          y += 6;
        });

        if (y < pageHeight - 25) {
          doc.setDrawColor(230, 230, 230);
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(margin, pageHeight - 28, pageWidth - (margin * 2), 18, 3, 3, 'FD');
          
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(100, 100, 100);
          doc.text("TOTAL DO DIA:", margin + 8, pageHeight - 18);
          
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
      toast.success("PDF gerado com sucesso!", { id: toastId });

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Ocorreu um erro ao gerar o PDF.", { id: toastId });
    }
  };

  return {
    state: { 
      loading, patients, activeTab, searchTerm, showOnlyNew, unseenPatientsCount, 
      todayTotalMessages, usageStats, filteredPatients, editingId, editForm, 
      evalModalOpen, evalModalActiveTab, activeLeadsCount, filteredLeads, copiedLink, 
      calendlyUrl, premiumPrice, mealPlanPrice, consultationPrice, isSavingPrice, 
      dietModalOpen, selectedPatient, adminContext, statusFilter 
    },
    actions: { 
      setActiveTab, handleBellClick, handleLogout, setSearchTerm, setStatusFilter, 
      setEditingId, setEditForm, updateProfile, setEvalModalOpen, setEvalModalActiveTab,
      setDietModalOpen, setSelectedPatient, copyToClipboard, setPremiumPrice, 
      setMealPlanPrice, setConsultationPrice, setCalendlyUrl, handleSaveSettings, 
      handleGeneratePDF, fetchAdminData, handleDeleteDiet, handleOpenDietBuilder,
      handleOpenEvalModal // 🔥 NOVA AÇÃO EXPORTADA
    }
  };
}

// =========================================================================
// COMPONENTE PRINCIPAL (UI)
// =========================================================================
export default function AdminDashboard() {
  const { state, actions } = useAdminDashboard();

  if (state.loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50/50">
      <div className="flex flex-col items-center gap-5">
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-stone-100">
          <Loader2 className="animate-spin text-nutri-700" size={36} />
        </div>
        <p className="text-stone-500 font-medium tracking-wide animate-pulse">Sincronizando sistema...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#F8F9FA] p-3 sm:p-4 md:p-8 lg:p-10 pt-20 lg:pt-28 font-sans text-stone-800 selection:bg-nutri-200">
      
      {/* HEADER COMPACTO E PREMIUM NO MOBILE */}
      <header className="flex flex-col gap-4 md:gap-6 mb-5 md:mb-8 bg-white p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] border border-stone-100/80 backdrop-blur-xl transition-all">
        <div className="flex justify-between items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl md:text-3xl font-extrabold text-stone-900 tracking-tight leading-none">Painel Administrativo</h1>
            <p className="hidden md:block text-stone-500 text-sm mt-1.5 font-medium">Gestão inteligente de pacientes, agendas e resultados</p>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button 
              onClick={actions.handleBellClick}
              title={state.showOnlyNew ? "Remover filtro" : "Filtrar novos pacientes"}
              className={`relative flex items-center justify-center h-10 w-10 md:h-11 md:w-11 rounded-xl transition-all duration-300 ${
                state.showOnlyNew 
                  ? 'bg-nutri-50 text-nutri-700 ring-1 ring-nutri-200' 
                  : 'bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-700 border border-stone-200/60'
              }`}
            >
              <Bell size={20} className={state.unseenPatientsCount > 0 ? 'animate-pulse text-nutri-600' : ''} />
              {state.unseenPatientsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  {state.unseenPatientsCount}
                </span>
              )}
            </button>

            <button 
              onClick={actions.handleLogout} 
              className="flex items-center justify-center gap-2 text-rose-600 bg-rose-50/80 w-10 h-10 md:w-auto md:px-5 md:h-11 rounded-xl font-semibold text-sm hover:bg-rose-100 hover:text-rose-700 transition-all active:scale-[0.98]"
              title="Sair do sistema"
            >
              <LogOut size={18} /> <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* FILTROS E BUSCA (Lado a Lado no Mobile) */}
        <div className="flex flex-row gap-2 md:gap-4 pt-4 md:pt-6 border-t border-stone-100/80">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-700 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder={state.activeTab === 'pacientes' ? "Buscar nome..." : state.activeTab === 'leads' ? "Buscar lead..." : "Buscar..."}
              className="w-full pl-9 md:pl-12 pr-3 md:pr-4 h-10 md:h-12 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-white focus:bg-white focus:border-nutri-400 focus:ring-4 focus:ring-nutri-50 outline-none transition-all font-medium text-sm md:text-base text-stone-700 placeholder:text-stone-400 shadow-sm"
              onChange={(e) => actions.setSearchTerm(e.target.value)}
            />
          </div>
          {state.activeTab === 'pacientes' && (
            <div className="relative group w-[130px] md:min-w-[240px]">
              <Filter className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-700 transition-colors pointer-events-none" size={18} />
              <select 
                className="w-full px-3 md:pl-11 md:pr-10 h-10 md:h-12 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-white focus:bg-white outline-none focus:border-nutri-400 focus:ring-4 focus:ring-nutri-50 transition-all font-medium text-xs md:text-sm text-stone-700 appearance-none cursor-pointer shadow-sm" 
                onChange={(e) => actions.setStatusFilter(e.target.value)}
              >
                <option value="todos">Status</option>
                <option value="pendente">Pendente</option>
                <option value="plano_liberado">Liberado</option>
              </select>
              <ChevronRight className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-stone-400 rotate-90 pointer-events-none" size={14} />
            </div>
          )}
        </div>
      </header>

      {/* ABAS PREMIUM (Segmented Control Style - Mais finas no mobile) */}
      <div className="flex gap-1.5 md:gap-2 mb-6 md:mb-8 overflow-x-auto scrollbar-hide p-1 md:p-1.5 bg-white rounded-xl md:rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.03)] border border-stone-100/80 w-max max-w-full">
        <button 
          onClick={() => actions.setActiveTab('pacientes')} 
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 h-9 md:h-11 rounded-lg md:rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 whitespace-nowrap ${
            state.activeTab === 'pacientes' 
              ? 'bg-nutri-800 text-white shadow-md' 
              : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
          }`}
        >
          <Users size={16} /> Pacientes <span className="opacity-80 text-[10px] md:text-xs ml-0.5">({state.patients.length})</span>
        </button>
        <button 
          onClick={() => actions.setActiveTab('leads')} 
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 h-9 md:h-11 rounded-lg md:rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 whitespace-nowrap ${
            state.activeTab === 'leads' 
              ? 'bg-nutri-800 text-white shadow-md' 
              : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
          }`}
        >
          <Target size={16} /> Leads 
          {state.activeLeadsCount > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${state.activeTab === 'leads' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {state.activeLeadsCount}
            </span>
          )}
        </button>
        <button 
          onClick={() => actions.setActiveTab('agenda')} 
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 h-9 md:h-11 rounded-lg md:rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 whitespace-nowrap ${
            state.activeTab === 'agenda' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
          }`}
        >
          <Calendar size={16} /> Agenda
        </button>
        <button 
          onClick={() => actions.setActiveTab('financeiro')} 
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 h-9 md:h-11 rounded-lg md:rounded-xl font-semibold text-xs md:text-sm transition-all duration-300 whitespace-nowrap ${
            state.activeTab === 'financeiro' 
              ? 'bg-stone-800 text-white shadow-md' 
              : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
          }`}
        >
          <Settings size={16} /> Configs
        </button>
      </div>

            {/* TELA DE PACIENTES */}
      {state.activeTab === 'pacientes' && (
        <>
          {/* ESTATÍSTICAS (WIDGET UNIFICADO NO MOBILE) */}
          <div className="bg-white rounded-2xl md:rounded-3xl border border-stone-100 shadow-sm mb-6 md:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-stone-100">
              <div className="p-3 md:p-6 text-center md:text-left flex flex-col md:justify-center hover:bg-stone-50/50 transition-colors">
                <p className="text-[9px] md:text-[11px] text-stone-400 uppercase font-bold tracking-widest flex items-center justify-center md:justify-start gap-1 md:gap-2 mb-1 md:mb-2">
                  <MessageCircle size={12} className="text-nutri-600 hidden md:block" /> Msgs Hoje
                </p>
                <p className="text-xl md:text-4xl font-extrabold text-stone-900 tracking-tight">{state.todayTotalMessages}</p>
              </div>
              <div className="p-3 md:p-6 text-center md:text-left flex flex-col md:justify-center hover:bg-stone-50/50 transition-colors">
                <p className="text-[9px] md:text-[11px] text-stone-400 uppercase font-bold tracking-widest flex items-center justify-center md:justify-start gap-1 md:gap-2 mb-1 md:mb-2">
                  <Users size={12} className="text-nutri-600 hidden md:block" /> Ativos
                </p>
                <p className="text-xl md:text-4xl font-extrabold text-stone-900 tracking-tight">{Object.keys(state.usageStats).length}</p>
              </div>
              <div className="p-3 md:p-6 text-center md:text-left flex flex-col md:justify-center hover:bg-stone-50/50 transition-colors">
                <p className="text-[9px] md:text-[11px] text-stone-400 uppercase font-bold tracking-widest flex items-center justify-center md:justify-start gap-1 md:gap-2 mb-1 md:mb-2">
                  <Activity size={12} className="text-nutri-600 hidden md:block" /> Média
                </p>
                <p className="text-xl md:text-4xl font-extrabold text-stone-900 tracking-tight">
                  {Object.keys(state.usageStats).length > 0 ? Math.round(state.todayTotalMessages / Object.keys(state.usageStats).length) : 0}
                </p>
              </div>
            </div>
          </div>

          {/* GRID DE PACIENTES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 animate-in fade-in duration-700">
            {state.filteredPatients.length === 0 ? (
              <div className="col-span-full bg-white p-10 md:p-16 rounded-[2rem] shadow-sm border border-stone-100 border-dashed flex flex-col items-center justify-center text-center">
                <div className="bg-stone-50 p-6 rounded-full mb-6">
                  <Users size={48} className="text-stone-300" />
                </div>
                <h3 className="text-xl font-bold text-stone-800 mb-2 tracking-tight">Nenhum paciente encontrado</h3>
                <p className="text-stone-500 font-medium">Tente ajustar seus filtros ou termos de busca.</p>
              </div>
            ) : (
              state.filteredPatients.map((p) => {
                const isDietReady = Boolean(p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0);
                const usage = state.usageStats[p.id] || 0;
                const isHeavyUser = usage >= 20;

                return (
                <div 
                  key={p.id} 
                  className={`bg-white rounded-2xl md:rounded-3xl shadow-sm border flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative overflow-hidden ${
                    p.isNew 
                      ? 'border-nutri-300 ring-4 ring-nutri-50' 
                      : p.isLate 
                        ? 'border-amber-200 ring-4 ring-amber-50' 
                        : isDietReady 
                          ? 'border-emerald-100 bg-gradient-to-br from-white to-emerald-50/10' 
                          : 'border-stone-100'
                  }`}
                >
                  <div className={`h-1.5 w-full ${p.isNew ? 'bg-nutri-400' : p.isLate ? 'bg-amber-400' : isDietReady ? 'bg-emerald-400' : 'bg-transparent'}`} />

                  <div className="p-5 md:p-8 flex flex-col h-full">
                    {state.editingId === p.id ? (
                      // FORMULÁRIO DE EDIÇÃO PREMIUM
                      <div className="space-y-4 md:space-y-5 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-2 border-b border-stone-100 pb-3 md:pb-4">
                          <h4 className="font-bold text-stone-800 text-sm md:text-base">Editar Perfil</h4>
                          <button onClick={() => actions.setEditingId(null)} className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-full transition-colors"><X size={18} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                          <div>
                            <label className="text-[10px] md:text-[11px] font-bold text-stone-500 uppercase tracking-wider">Nascimento</label>
                            <input type="date" className="w-full h-10 md:h-11 px-3 mt-1.5 border border-stone-200 rounded-lg md:rounded-xl font-medium text-xs md:text-sm focus:ring-2 focus:ring-nutri-100 focus:border-nutri-400 outline-none transition-all" defaultValue={p.data_nascimento} onChange={e => actions.setEditForm({...state.editForm, data_nascimento: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[10px] md:text-[11px] font-bold text-stone-500 uppercase tracking-wider">Meta (kg)</label>
                            <input type="number" step="0.1" placeholder="Ex: 65.5" className="w-full h-10 md:h-11 px-3 mt-1.5 border border-stone-200 rounded-lg md:rounded-xl font-medium text-xs md:text-sm focus:ring-2 focus:ring-nutri-100 focus:border-nutri-400 outline-none transition-all" defaultValue={p.meta_peso || ''} onChange={e => actions.setEditForm({...state.editForm, meta_peso: e.target.value})} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] md:text-[11px] font-bold text-stone-500 uppercase tracking-wider">Perfil Clínico</label>
                          <select className="w-full h-10 md:h-11 px-3 mt-1.5 border border-stone-200 rounded-lg md:rounded-xl font-medium text-xs md:text-sm focus:ring-2 focus:ring-nutri-100 focus:border-nutri-400 outline-none transition-all bg-white" defaultValue={p.tipo_perfil} onChange={e => actions.setEditForm({...state.editForm, tipo_perfil: e.target.value})}>
                            <option value="adulto">Adulto</option>
                            <option value="atleta">Atleta</option>
                            <option value="crianca">Criança</option>
                            <option value="idoso">Idoso</option>
                          </select>
                        </div>
                        <div className="p-3 md:p-4 bg-emerald-50/50 rounded-xl md:rounded-2xl border border-emerald-100/50">
                          <label className="text-[10px] md:text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                            <Star size={14}/> Nível de Acesso
                          </label>
                          <select className="w-full h-10 md:h-11 px-3 border border-emerald-200 bg-white rounded-lg md:rounded-xl font-semibold text-xs md:text-sm text-emerald-900 focus:ring-2 focus:ring-emerald-100 outline-none transition-all" defaultValue={p.account_type || 'free'} onChange={e => actions.setEditForm({...state.editForm, account_type: e.target.value})}>
                            <option value="free">Básico (Check-in)</option>
                            <option value="premium">Premium (Completo)</option>
                          </select>
                        </div>
                        <div className="flex pt-2">
                          <button onClick={() => actions.updateProfile(p.id)} className="bg-stone-900 hover:bg-stone-800 text-white h-11 md:h-12 w-full rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all active:scale-[0.98] shadow-sm"><Save size={18}/> Salvar Dados</button>
                        </div>
                      </div>
                    ) : (
                      // VISUALIZAÇÃO DO CARD DO PACIENTE
                      <div className="flex flex-col h-full animate-in fade-in duration-300">
                        <div className="flex-1">
                          
                          {/* Cabeçalho do Card */}
                          <div className="flex justify-between items-start mb-5 md:mb-6">
                            <div className="flex flex-col">
                              <Link href={`/admin/paciente/${p.id}/historico`} className="group">
                                <h3 className="font-extrabold text-base md:text-lg flex items-center gap-2 text-stone-900 group-hover:text-nutri-600 transition-colors tracking-tight">
                                  {p.full_name || 'Sem nome'}
                                  {p.account_type === 'premium' && (
                                    <span title="Conta Premium" className="flex items-center shrink-0">
                                      <Star size={16} className="text-amber-400 fill-amber-400" />
                                    </span>
                                  )}
                                </h3>
                              </Link>
                              
                              <div className="flex flex-wrap items-center gap-2 mt-1.5 md:mt-2">
                                {p.isNew && (
                                  <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-md bg-nutri-100 text-nutri-700 text-[9px] md:text-[10px] font-bold uppercase tracking-wider">
                                    <Bell size={10} className="animate-pulse" /> Novo
                                  </span>
                                )}
                                {p.isLate && (
                                  <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] md:text-[10px] font-bold uppercase tracking-wider">
                                    <AlertCircle size={10} /> Ausente
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-md md:rounded-lg text-[9px] md:text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 border ${isDietReady ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                {isDietReady ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} 
                                <span className="hidden sm:inline">{isDietReady ? 'Dieta Pronta' : 'Pendente'}</span>
                              </span>
                              <button onClick={() => { actions.setEditingId(p.id); actions.setEditForm({ data_nascimento: p.data_nascimento || '', sexo: p.sexo || '', tipo_perfil: p.tipo_perfil || 'adulto', meta_peso: p.meta_peso ? p.meta_peso.toString() : '', account_type: p.account_type || 'free'}); }} className="p-1.5 md:p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-nutri-600 transition-colors bg-stone-50"><Edit2 size={14} /></button>
                            </div>
                          </div>

                          {/* Info Box */}
                          <div className="grid grid-cols-2 gap-2 md:gap-3 mb-5 md:mb-6">
                            <div className="bg-stone-50 p-2 md:p-3 rounded-xl md:rounded-2xl border border-stone-100/80 text-center">
                              <p className="text-[9px] md:text-[10px] text-stone-400 uppercase font-bold tracking-wider mb-0.5">Perfil</p>
                              <p className="text-xs md:text-sm font-semibold text-stone-700 capitalize">{p.tipo_perfil || 'Não def.'}</p>
                            </div>
                            <div className="bg-stone-50 p-2 md:p-3 rounded-xl md:rounded-2xl border border-stone-100/80 text-center">
                              <p className="text-[9px] md:text-[10px] text-stone-400 uppercase font-bold tracking-wider mb-0.5">Meta</p>
                              <p className="text-xs md:text-sm font-semibold text-stone-700">{p.meta_peso ? `${p.meta_peso} kg` : 'N/A'}</p>
                            </div>
                          </div>

                          {/* 🔥 AVALIAÇÃO - USANDO NOVA FUNÇÃO handleOpenEvalModal */}
                          {p.evaluation ? (
                            <button onClick={() => actions.handleOpenEvalModal(p)} className="w-full flex items-center justify-between bg-white border border-nutri-100 hover:border-nutri-300 hover:shadow-md transition-all p-3 md:p-4 rounded-xl md:rounded-2xl mb-5 md:mb-6 group text-left relative overflow-hidden">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-nutri-400 group-hover:bg-nutri-500 transition-colors" />
                              <div className="flex-1 pr-3 pl-2">
                                <p className="font-bold text-nutri-700 mb-0.5 md:mb-1 text-[10px] md:text-[11px] uppercase tracking-wider flex items-center gap-1.5"><Eye size={12} className="md:w-3.5 md:h-3.5"/> Inicial + 🍽️ QFA + 🚫 Alergias</p>
                                <p className="line-clamp-1 text-xs md:text-sm font-medium text-stone-500 italic">"{Object.values(p.evaluation.answers)[0] as string}"</p>
                              </div>
                              <ChevronRight size={16} className="text-nutri-400 group-hover:text-nutri-600 transition-colors transform group-hover:translate-x-1" />
                            </button>
                          ) : (
                            <div className="text-xs md:text-sm text-stone-400 font-medium mb-5 md:mb-6 bg-stone-50 p-3 md:p-4 rounded-xl md:rounded-2xl text-center border border-dashed border-stone-200 flex flex-col items-center justify-center gap-1.5">
                              <FileText size={16} className="text-stone-300 md:w-5 md:h-5" />
                              <p>Sem avaliação preenchida</p>
                            </div>
                          )}

                          {/* Chat Usage Stats */}
                          <div className="mb-6 md:mb-8">
                            <div className="flex justify-between items-end mb-1.5 md:mb-2">
                              <span className="text-[10px] md:text-[11px] font-bold text-stone-500 uppercase tracking-wider">Interações IA</span>
                              <span className="text-base md:text-lg font-extrabold text-stone-800">{usage} <span className="text-[10px] md:text-xs font-medium text-stone-400">msgs hoje</span></span>
                            </div>
                            <div className="w-full bg-stone-100 h-1.5 md:h-2 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ease-out ${isHeavyUser ? 'bg-rose-500' : 'bg-nutri-500'}`} style={{ width: `${Math.min(100, (usage / 25) * 100)}%` }} />
                            </div>
                            {isHeavyUser && <p className="text-[9px] md:text-[10px] text-rose-500 font-bold mt-1.5 flex items-center gap-1"><AlertCircle size={10}/> Alto volume de interação</p>}
                          </div>
                        </div>

                        {/* Ações Inferiores Premium */}
                        <div className="pt-4 md:pt-5 border-t border-stone-100 flex flex-col xl:flex-row items-center justify-between gap-3 mt-auto">
                          
                          <div className="flex gap-2 w-full xl:w-auto">
                            <button 
                              onClick={() => actions.handleOpenDietBuilder(p)} 
                              className={`flex-1 xl:flex-none px-4 md:px-5 h-10 md:h-11 rounded-lg md:rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                                isDietReady 
                                  ? 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-transparent' 
                                  : 'bg-nutri-800 text-white hover:bg-nutri-700 shadow-md shadow-nutri-800/20'
                              }`}
                            >
                              <Utensils size={16} /> {isDietReady ? 'Editar Dieta' : 'Montar Dieta'}
                            </button>
                            
                            {isDietReady && (
                              <>
                                <button 
                                  onClick={() => actions.handleGeneratePDF(p)} 
                                  title="Exportar PDF"
                                  className="w-10 h-10 md:w-11 md:h-11 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-100 rounded-lg md:rounded-xl flex items-center justify-center transition-all active:scale-[0.98] shadow-sm shrink-0"
                                >
                                  <FileText size={16} />
                                </button>
                                
                                <button 
                                  onClick={() => actions.handleDeleteDiet(p.id)} 
                                  title="Excluir Dieta"
                                  className="w-10 h-10 md:w-11 md:h-11 bg-stone-50 text-stone-400 hover:bg-rose-50 hover:text-rose-600 border border-stone-200 rounded-lg md:rounded-xl flex items-center justify-center transition-all active:scale-[0.98] shrink-0"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>

                          <div className="flex gap-2 w-full xl:w-auto justify-end">
                            <a href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá!`} target="_blank" rel="noopener noreferrer" title="Cobrar check-in" className={`flex-1 xl:flex-none w-auto xl:w-11 h-10 md:h-11 flex items-center justify-center rounded-lg md:rounded-xl border transition-colors ${p.isLate ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' : 'bg-stone-50 text-stone-400 hover:bg-stone-100 border-stone-200'}`}>
                              <BellRing size={16} />
                            </a>
                            <button onClick={() => actions.setSelectedPatient({ id: p.id, name: p.full_name })} title="Dados Clínicos" className="flex-1 xl:flex-none w-auto xl:w-11 h-10 md:h-11 flex items-center justify-center rounded-lg md:rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors">
                              <Activity size={16} />
                            </button>
                            <a href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá!`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="flex-1 xl:flex-none w-auto xl:w-11 h-10 md:h-11 flex items-center justify-center rounded-lg md:rounded-xl bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors">
                              <MessageCircle size={16} />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* TELA DE LEADS (OPORTUNIDADES) */}
      {state.activeTab === 'leads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {state.filteredLeads.length === 0 ? (
             <div className="col-span-full text-center py-20 text-stone-400">Nenhuma oportunidade no momento.</div>
          ) : (
            state.filteredLeads.map((lead) => (
              <div key={lead.id} className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-stone-100 flex flex-col justify-between hover:shadow-lg transition-shadow">
                <div>
                  <div className="flex justify-between items-start mb-4 md:mb-5">
                    <h3 className="font-extrabold text-base md:text-lg text-stone-900 flex items-center gap-2 tracking-tight">
                      <UserPlus size={18} className="text-amber-500" /> {lead.nome}
                    </h3>
                    <span className={`px-2.5 md:px-3 py-1 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${lead.status === 'concluido' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {lead.status === 'concluido' ? 'Concluído' : 'Abandonou'}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm font-semibold text-stone-600 mb-5 md:mb-6 flex items-center gap-2 bg-stone-50 w-fit px-3 py-1.5 rounded-lg border border-stone-200">
                    <MessageCircle size={14} className="text-[#25D366]" /> {lead.whatsapp}
                  </p>
                  
                  <div className="bg-stone-50/50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-stone-100 mb-5 md:mb-6 relative">
                    <div className="flex justify-between items-center mb-2 md:mb-3">
                      <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-stone-500">Progresso do Funil</span>
                      <span className="text-xs md:text-sm font-extrabold text-nutri-700">{(Object.keys(lead.respostas || {}).length / 10) * 100}%</span>
                    </div>
                    <div className="w-full h-2 md:h-2.5 bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: `${(Object.keys(lead.respostas || {}).length / 10) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
                <a 
                  href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, '')}?text=Olá!`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white h-11 md:h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-sm shadow-[#25D366]/20"
                >
                  <MessageCircle size={18} /> Entrar em Contato
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {/* TELA DE AGENDA */}
      {state.activeTab === 'agenda' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-stone-100 mb-5 md:mb-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 text-center md:text-left">
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-stone-900 flex items-center justify-center md:justify-start gap-2 md:gap-3 tracking-tight">
                <Calendar className="text-blue-500" size={24} /> Minha Agenda
              </h2>
              <p className="text-xs md:text-sm text-stone-500 font-medium mt-1">Gerencie seus compromissos e links de marcação.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0">
              <a 
                href="https://calendly.com/app/scheduled_events/user/me" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-5 md:px-6 h-11 md:h-12 rounded-xl font-bold text-xs md:text-sm transition-all shadow-md active:scale-[0.98]"
              >
                <ExternalLink size={16} /> Ver Calendário
              </a>
              <button 
                onClick={actions.copyToClipboard} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border-2 border-stone-200 px-5 md:px-6 h-11 md:h-12 rounded-xl font-bold text-xs md:text-sm text-stone-700 transition-all hover:bg-stone-50 active:scale-[0.98]"
              >
                {state.copiedLink ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} className="text-stone-400" />} 
                {state.copiedLink ? 'Link Copiado!' : 'Copiar Link'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-stone-100 h-[500px] md:h-[700px] relative overflow-hidden">
            {state.calendlyUrl ? (
              <iframe src={state.calendlyUrl} width="100%" height="100%" frameBorder="0" className="absolute inset-0 bg-stone-50"></iframe>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-stone-400 p-6 text-center">
                <Link2 size={40} className="mb-3 opacity-50" />
                <p className="font-medium text-sm">Adicione o link do seu Calendly na aba de Configurações.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TELA DE FINANCEIRO / CONFIGURAÇÕES */}
      {state.activeTab === 'financeiro' && (
        <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500 bg-white p-6 md:p-12 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-stone-100">
          <div className="flex flex-col sm:flex-row items-center text-center sm:text-left gap-4 md:gap-5 mb-8 md:mb-10 border-b border-stone-100 pb-6 md:pb-8">
            <div className="bg-stone-100 p-3 md:p-4 rounded-xl md:rounded-2xl text-stone-700">
              <Settings size={28} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-stone-900 tracking-tight">Configurações do Sistema</h2>
              <p className="text-xs md:text-sm text-stone-500 font-medium mt-1">Defina preços base e integrações para captação.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
            <div className="bg-stone-50/50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-stone-200 focus-within:ring-2 focus-within:ring-amber-100 focus-within:border-amber-400 transition-all group">
              <label className="text-[10px] md:text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                <Star size={14} className="text-amber-500" /> Valor Premium
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base md:text-lg font-bold text-stone-400">R$</span>
                <input type="number" step="0.01" value={state.premiumPrice} onChange={(e) => actions.setPremiumPrice(e.target.value)} className="w-full bg-transparent text-2xl md:text-3xl font-extrabold text-stone-800 outline-none" />
              </div>
            </div>
            <div className="bg-stone-50/50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-stone-200 focus-within:ring-2 focus-within:ring-nutri-100 focus-within:border-nutri-400 transition-all group">
              <label className="text-[10px] md:text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                <FileText size={14} className="text-nutri-600" /> Plano Avulso
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base md:text-lg font-bold text-stone-400">R$</span>
                <input type="number" step="0.01" value={state.mealPlanPrice} onChange={(e) => actions.setMealPlanPrice(e.target.value)} className="w-full bg-transparent text-2xl md:text-3xl font-extrabold text-stone-800 outline-none" />
              </div>
            </div>
            <div className="bg-stone-50/50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-stone-200 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all group">
              <label className="text-[10px] md:text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                <Calendar size={14} className="text-blue-500" /> Consulta Direta
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base md:text-lg font-bold text-stone-400">R$</span>
                <input type="number" step="0.01" value={state.consultationPrice} onChange={(e) => actions.setConsultationPrice(e.target.value)} className="w-full bg-transparent text-2xl md:text-3xl font-extrabold text-stone-800 outline-none" />
              </div>
            </div>
          </div>
          
          <div className="bg-stone-50/50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-stone-200 mb-8 md:mb-10 focus-within:ring-2 focus-within:ring-stone-200 focus-within:border-stone-400 transition-all group">
            <label className="text-[10px] md:text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
              <Link2 size={16} className="text-stone-700" /> URL da sua Agenda Calendly
            </label>
            <input 
              type="url" 
              placeholder="https://calendly.com/seulink"
              value={state.calendlyUrl} 
              onChange={(e) => actions.setCalendlyUrl(e.target.value)} 
              className="w-full bg-transparent text-base md:text-lg font-medium text-stone-800 outline-none border-b-2 border-stone-200 focus:border-stone-600 pb-2 transition-colors" 
            />
          </div>

          <div className="flex justify-end">
            <button 
              onClick={actions.handleSaveSettings} 
              disabled={state.isSavingPrice} 
              className="w-full md:w-auto px-8 md:px-10 h-12 md:h-14 flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl md:rounded-2xl font-bold text-sm md:text-base transition-all active:scale-[0.98] shadow-lg shadow-stone-900/10 disabled:opacity-70"
            >
              {state.isSavingPrice ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : <><Save size={18} /> Salvar Configurações</>}
            </button>
          </div>
        </div>
      )}

      {/* 🔥 NOVO MODAL UNIFICADO COM 3 ABAS: AVALIAÇÃO INICIAL, QFA E PERFIL ALIMENTAR */}
      {state.evalModalOpen.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-3xl flex flex-col max-h-[85vh] sm:max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            
            {/* HEADER COM ABAS */}
            <div className="border-b border-stone-100 shrink-0">
              <div className="flex justify-between items-center p-5 md:p-6 pb-0">
                <div>
                  <h3 className="font-extrabold text-lg md:text-xl text-stone-900 tracking-tight">Prontuário do Paciente</h3>
                  <p className="text-xs md:text-sm font-semibold text-stone-500 mt-0.5">{state.evalModalOpen.name}</p>
                </div>
                <button 
                  onClick={() => actions.setEvalModalOpen({ isOpen: false, data: null, name: '', qfaData: null, foodRestrictions: [] })} 
                  className="p-2 bg-stone-50 text-stone-500 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* 🔥 ABAS */}
              <div className="flex gap-1 px-5 md:px-6 mt-4">
                <button
                  onClick={() => actions.setEvalModalActiveTab('avaliacao')}
                  className={`px-4 py-2.5 text-xs md:text-sm font-bold rounded-t-xl transition-all ${
                    state.evalModalActiveTab === 'avaliacao'
                      ? 'bg-nutri-50 text-nutri-700 border-b-2 border-nutri-500'
                      : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  📋 Avaliação Inicial
                </button>
                <button
                  onClick={() => actions.setEvalModalActiveTab('qfa')}
                  className={`px-4 py-2.5 text-xs md:text-sm font-bold rounded-t-xl transition-all ${
                    state.evalModalActiveTab === 'qfa'
                      ? 'bg-nutri-50 text-nutri-700 border-b-2 border-nutri-500'
                      : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  🍽️ QFA
                </button>
                <button
                  onClick={() => actions.setEvalModalActiveTab('perfil')}
                  className={`px-4 py-2.5 text-xs md:text-sm font-bold rounded-t-xl transition-all ${
                    state.evalModalActiveTab === 'perfil'
                      ? 'bg-nutri-50 text-nutri-700 border-b-2 border-nutri-500'
                      : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  ⚠️ Perfil Alimentar
                </button>
              </div>
            </div>

            {/* CONTEÚDO DINÂMICO POR ABA */}
            <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* ABA 1: AVALIAÇÃO INICIAL */}
              {state.evalModalActiveTab === 'avaliacao' && (
                <div className="space-y-3 md:space-y-4 animate-in fade-in duration-200">
                  {Object.entries(state.evalModalOpen.data || {}).length === 0 ? (
                    <div className="text-center py-12 text-stone-400 font-medium">
                      <FileText size={48} className="mx-auto mb-3 opacity-50" />
                      <p>Nenhuma avaliação inicial preenchida</p>
                    </div>
                  ) : (
                    Object.entries(state.evalModalOpen.data || {}).map(([k, v]) => (
                      <div key={k} className="bg-stone-50/80 border border-stone-100 p-4 md:p-5 rounded-2xl">
                        <p className="text-[10px] md:text-[11px] font-bold text-nutri-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-nutri-100 text-nutri-800 flex items-center justify-center text-[10px] shrink-0">{parseInt(k as string)+1}</span>
                          <span className="line-clamp-2 leading-tight">{questionTitles[parseInt(k as string)]}</span>
                        </p>
                        <p className="text-sm font-medium text-stone-800 ml-7 leading-relaxed">{v as string}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ABA 2: QFA (Questionário de Frequência Alimentar) */}
              {state.evalModalActiveTab === 'qfa' && (
                <div className="space-y-3 md:space-y-4 animate-in fade-in duration-200">
                  {!state.evalModalOpen.qfaData || Object.keys(state.evalModalOpen.qfaData).length === 0 ? (
                    <div className="text-center py-12 text-stone-400 font-medium">
                      <Utensils size={48} className="mx-auto mb-3 opacity-50" />
                      <p>Nenhum QFA preenchido</p>
                    </div>
                  ) : (
                    qfaSchemaDisplay.map((section, idx) => {
                      const answeredItems = section.items.filter(itemId => state.evalModalOpen.qfaData?.[itemId]);
                      if (answeredItems.length === 0) return null;
                      
                      return (
                        <div key={idx} className="bg-stone-50/80 border border-stone-100 p-4 md:p-5 rounded-2xl">
                          <h4 className="text-[11px] font-black text-nutri-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-nutri-500 rounded-full"></div>
                            {section.category}
                          </h4>
                          <div className="space-y-2">
                            {answeredItems.map(itemId => (
                              <div key={itemId} className="flex justify-between items-center py-2 border-b border-stone-100 last:border-0">
                                <span className="text-xs font-medium text-stone-700">{qfaLabels[itemId] || itemId}</span>
                                <span className="text-xs font-extrabold text-nutri-800 bg-nutri-100 px-3 py-1 rounded-full">
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

              {/* ABA 3: PERFIL ALIMENTAR (Restrições) */}
              {state.evalModalActiveTab === 'perfil' && (
                <div className="space-y-4 md:space-y-5 animate-in fade-in duration-200">
                  {!state.evalModalOpen.foodRestrictions || state.evalModalOpen.foodRestrictions.length === 0 ? (
                    <div className="text-center py-12 text-stone-400 font-medium">
                      <AlertCircle size={48} className="mx-auto mb-3 opacity-50" />
                      <p>Nenhuma restrição alimentar cadastrada</p>
                    </div>
                  ) : (
                    <>
                      {/* Alergias */}
                      {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'allergy').length > 0 && (
                        <div className="bg-red-50 border border-red-200 p-4 md:p-5 rounded-2xl">
                          <h4 className="text-[11px] font-black text-red-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                            🚫 Alergias
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'allergy').map((r, idx) => (
                              <span key={idx} className="bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold">
                                {r.food || r.tag || r.foodId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Intolerâncias */}
                      {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'intolerance').length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 p-4 md:p-5 rounded-2xl">
                          <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                            ⚠️ Intolerâncias
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'intolerance').map((r, idx) => (
                              <span key={idx} className="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold">
                                {r.food || r.tag || r.foodId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Restrições */}
                      {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'restriction').length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 p-4 md:p-5 rounded-2xl">
                          <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                            📋 Restrições
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {state.evalModalOpen.foodRestrictions.filter(r => r.type === 'restriction').map((r, idx) => (
                              <span key={idx} className="bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold">
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

      {/* MODAL DE DIETA */}
      {state.dietModalOpen.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-0 md:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-5xl relative my-auto h-full md:h-auto flex flex-col animate-in zoom-in-95 duration-300">
            <div className="hidden md:flex justify-end mb-4">
              <button 
                onClick={() => { actions.setDietModalOpen({ ...state.dietModalOpen, isOpen: false }); actions.fetchAdminData(); }} 
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-3 backdrop-blur-md transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="bg-white md:rounded-[2.5rem] shadow-2xl flex-1 overflow-hidden h-full md:h-auto border border-white/20 flex flex-col">
              {/* No mobile, botão de fechar interno */}
              <div className="md:hidden flex justify-between items-center p-4 border-b border-stone-100 bg-white shrink-0">
                <span className="font-bold text-stone-800">Montar Dieta</span>
                <button 
                  onClick={() => { actions.setDietModalOpen({ ...state.dietModalOpen, isOpen: false }); actions.fetchAdminData(); }} 
                  className="p-2 bg-stone-100 text-stone-600 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <DietBuilder 
                  patientId={state.dietModalOpen.id} 
                  patientName={state.dietModalOpen.name} 
                  onClose={() => { actions.setDietModalOpen({ ...state.dietModalOpen, isOpen: false }); actions.fetchAdminData(); }} 
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