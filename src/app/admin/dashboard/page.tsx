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

// Importação do motor metabólico centralizado
import { getPatientMetabolicData } from '@/lib/getPatientMetabolicData';

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
  const [evalModalOpen, setEvalModalOpen] = useState<{isOpen: boolean, data: any, name: string}>({ isOpen: false, data: null, name: '' });
  
  const [dietModalOpen, setDietModalOpen] = useState<{
    isOpen: boolean, 
    id: string, 
    name: string,
    targetRecommendation: any | null
  }>({ 
    isOpen: false, 
    id: '', 
    name: '',
    targetRecommendation: null 
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

      // 1. Busca os Perfis (data_nascimento e sexo estão aqui)
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

        const patientLog = logs?.find(l => l.user_id === profile.id);

        return {
          ...profile,
          evaluation: evals?.find(e => e.user_id === profile.id),
          isLate,
          daysSinceLast,
          isNew,
          todayLog: patientLog || null,
          peso: lastAntro?.weight || lastCheckin?.peso || null,
          altura: lastAntro?.height || lastCheckin?.altura || null
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

  const adminContext = useMemo(() => ({
    patients, leads, usageStats, todayTotalMessages
  }), [patients, leads, usageStats, todayTotalMessages]);

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
      toast.success("Perfil do paciente atualizado com sucesso!");
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
    if (!error) toast.success("Configurações do sistema salvas com sucesso!");
    else toast.error("Erro ao salvar as configurações.");
    setIsSavingPrice(false);
  };

  const copyToClipboard = () => {
    if(!calendlyUrl) return toast.warning("Não há link configurado para copiar.");
    navigator.clipboard.writeText(calendlyUrl);
    setCopiedLink(true);
    toast.success("Link da agenda copiado!");
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

      toast.success("Dieta excluída com sucesso! Agora você pode criar uma nova.", { id: toastId });
      fetchAdminData(); 
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir a dieta.", { id: toastId });
    }
  };

  // 🔥 CÁLCULO CENTRALIZADO (Single Source of Truth) - CORRIGIDO E SIMPLIFICADO
  const handleOpenDietBuilder = async (p: Patient) => {
    const toastId = toast.loading("Calculando necessidades metabólicas...");

    try {
      // Chama a função centralizada que faz exatamente toda a lógica anterior
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
        targetRecommendation: metabolicData.recommendation
      });

    } catch (e) {
      console.error("Erro ao gerar recomendação no Admin:", e);
      toast.error("Erro ao calcular dados metabólicos.", { id: toastId });
    }
  };
  
  const handleGeneratePDF = async (patient: Patient) => {
    if (!patient.meal_plan || patient.meal_plan.length === 0) {
      toast.warning("A dieta deste paciente está vazia.");
      return;
    }

    const toastId = toast.loading("Gerando PDF, aguarde...");
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

        currentY += 6; // Espaço antes da base diária

        // Linha da base diária
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text("BASE DIÁRIA:", margin, currentY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(234, 88, 12);
        doc.text(`~${Math.round(totalKcal)} kcal`, margin + 35, currentY);
        
        // Macros totais na mesma linha
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        
        // Separador
        doc.setTextColor(150, 150, 150);
        doc.text("|", margin + 65, currentY);
        
        // Proteína (vermelho)
        doc.setTextColor(239, 68, 68);
        doc.text(`P: ${Math.round(totalProtein)}g`, margin + 70, currentY);
        
        // Separador
        doc.setTextColor(150, 150, 150);
        doc.text("|", margin + 95, currentY);
        
        // Carboidrato (laranja)
        doc.setTextColor(245, 158, 11);
        doc.text(`C: ${Math.round(totalCarbs)}g`, margin + 100, currentY);
        
        // Separador
        doc.setTextColor(150, 150, 150);
        doc.text("|", margin + 125, currentY);
        
        // Gordura (azul)
        doc.setTextColor(59, 130, 246);
        doc.text(`G: ${Math.round(totalFat)}g`, margin + 130, currentY);
        
        // Reset cor
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

      // Função para formatar a lista de alimentos com bullets
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
        
        // Calcula total do dia
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

          // Cabeçalho da refeição COM macros na mesma linha
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(26, 58, 42);
          
          // Nome e horário da refeição
          const mealTitle = `${meal.mealName.toUpperCase()} - ${meal.time}`;
          doc.text(mealTitle, margin, y);
          
          // Calcular posição das macros (à direita)
          const macroStartX = pageWidth - margin - 5;
          
          // Construir o texto das macros com cores
          const kcalText = `${Math.round(meal.kcal || 0)} kcal`;
          const proteinText = `P: ${Math.round(meal.macros?.p || 0)}g`;
          const carbsText = `C: ${Math.round(meal.macros?.c || 0)}g`;
          const fatText = `G: ${Math.round(meal.macros?.g || 0)}g`;
          
          // Medir larguras para posicionamento
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          
          const kcalWidth = doc.getTextWidth(kcalText);
          const proteinWidth = doc.getTextWidth(proteinText);
          const carbsWidth = doc.getTextWidth(carbsText);
          const fatWidth = doc.getTextWidth(fatText);
          const separatorWidth = doc.getTextWidth(" | ");
          
          const totalWidth = kcalWidth + separatorWidth + proteinWidth + separatorWidth + carbsWidth + separatorWidth + fatWidth;
          
          let currentX = macroStartX - totalWidth;
          
          // Calorias (laranja)
          doc.setTextColor(234, 88, 12);
          doc.text(kcalText, currentX, y);
          currentX += kcalWidth + 2;
          
          // Separador
          doc.setTextColor(150, 150, 150);
          doc.text("|", currentX, y);
          currentX += separatorWidth;
          
          // Proteína (vermelho)
          doc.setTextColor(239, 68, 68);
          doc.text(proteinText, currentX, y);
          currentX += proteinWidth + 2;
          
          // Separador
          doc.setTextColor(150, 150, 150);
          doc.text("|", currentX, y);
          currentX += separatorWidth;
          
          // Carboidrato (laranja)
          doc.setTextColor(245, 158, 11);
          doc.text(carbsText, currentX, y);
          currentX += carbsWidth + 2;
          
          // Separador
          doc.setTextColor(150, 150, 150);
          doc.text("|", currentX, y);
          currentX += separatorWidth;
          
          // Gordura (azul)
          doc.setTextColor(59, 130, 246);
          doc.text(fatText, currentX, y);
          
          // Reset cor
          doc.setTextColor(0, 0, 0);
          
          y += 6;
          
          // Lista de alimentos (com bullets)
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
          
          // Espaçamento entre refeições
          y += 6;
        });

        // Rodapé com total do dia
        if (y < pageHeight - 25) {
          doc.setDrawColor(230, 230, 230);
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(margin, pageHeight - 28, pageWidth - (margin * 2), 18, 3, 3, 'FD');
          
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(100, 100, 100);
          doc.text("TOTAL DO DIA:", margin + 8, pageHeight - 18);
          
          // Calorias
          doc.setFontSize(8);
          doc.setTextColor(234, 88, 12);
          doc.text(`${Math.round(dayTotal.kcal)} kcal`, margin + 45, pageHeight - 18);
          
          // Proteína
          doc.setTextColor(239, 68, 68);
          doc.text(`${Math.round(dayTotal.p)}g P`, margin + 90, pageHeight - 18);
          
          // Carboidrato
          doc.setTextColor(245, 158, 11);
          doc.text(`${Math.round(dayTotal.c)}g C`, margin + 125, pageHeight - 18);
          
          // Gordura
          doc.setTextColor(59, 130, 246);
          doc.text(`${Math.round(dayTotal.g)}g G`, margin + 160, pageHeight - 18);
          
          // Reset cor
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
    state: { loading, patients, activeTab, searchTerm, showOnlyNew, unseenPatientsCount, todayTotalMessages, usageStats, filteredPatients, editingId, editForm, evalModalOpen, activeLeadsCount, filteredLeads, copiedLink, calendlyUrl, premiumPrice, mealPlanPrice, consultationPrice, isSavingPrice, dietModalOpen, selectedPatient, adminContext, statusFilter },
    actions: { setActiveTab, handleBellClick, handleLogout, setSearchTerm, setStatusFilter, setEditingId, setEditForm, updateProfile, setEvalModalOpen, setDietModalOpen, setSelectedPatient, copyToClipboard, setPremiumPrice, setMealPlanPrice, setConsultationPrice, setCalendlyUrl, handleSaveSettings, handleGeneratePDF, fetchAdminData, handleDeleteDiet, handleOpenDietBuilder }
  };
}

// =========================================================================
// COMPONENTE PRINCIPAL (UI)
// =========================================================================
export default function AdminDashboard() {
  const { state, actions } = useAdminDashboard();

  if (state.loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
        <p className="text-stone-500 font-medium animate-pulse">Carregando painel...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 pt-24 lg:pt-28 font-sans text-stone-800">
      
      {/* HEADER */}
      <header className="flex flex-col gap-6 mb-8 bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 transition-all">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-nutri-900 tracking-tight">Painel Administrativo</h1>
            <p className="text-stone-500 text-sm mt-1">Gestão de Pacientes, Consultas & Captação</p>
          </div>
          
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <button 
              onClick={actions.handleBellClick}
              title={state.showOnlyNew ? "Remover filtro" : "Filtrar novos pacientes"}
              className={`relative group p-2.5 rounded-full transition-all duration-300 ${state.showOnlyNew ? 'bg-nutri-100 shadow-inner' : 'hover:bg-stone-100 hover:-translate-y-0.5'}`}
            >
              <Bell size={22} className={`transition-colors ${state.unseenPatientsCount > 0 ? 'text-nutri-800 animate-pulse' : state.showOnlyNew ? 'text-nutri-800' : 'text-stone-400 group-hover:text-stone-600'}`} />
              {state.unseenPatientsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">{state.unseenPatientsCount}</span>
              )}
            </button>

            <button onClick={actions.handleLogout} title="Sair do Sistema" className="flex items-center gap-2 text-red-600 bg-red-50 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-100 hover:-translate-y-0.5 transition-all active:scale-95">
              <LogOut size={16} strokeWidth={2.5} /> Sair
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-stone-100">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder={state.activeTab === 'pacientes' ? "Buscar paciente por nome..." : state.activeTab === 'leads' ? "Buscar lead por nome..." : "Buscar..."}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-stone-200 focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none transition-all font-medium text-stone-700 bg-stone-50 focus:bg-white"
              onChange={(e) => actions.setSearchTerm(e.target.value)}
            />
          </div>
          {state.activeTab === 'pacientes' && (
            <div className="relative group min-w-[200px]">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={18} />
              <select className="w-full pl-11 pr-10 py-3.5 rounded-2xl border border-stone-200 bg-stone-50 focus:bg-white outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 transition-all font-medium text-stone-700 appearance-none cursor-pointer" onChange={(e) => actions.setStatusFilter(e.target.value)}>
                <option value="todos">Todos os status</option>
                <option value="pendente">Dieta Pendente</option>
                <option value="plano_liberado">Plano Liberado</option>
              </select>
            </div>
          )}
        </div>
      </header>

      {/* ABAS */}
      <div className="flex gap-4 mb-8 overflow-x-auto scrollbar-hide pb-2 px-1">
        <button onClick={() => actions.setActiveTab('pacientes')} className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap active:scale-95 ${state.activeTab === 'pacientes' ? 'bg-nutri-900 text-white shadow-lg shadow-nutri-900/20 translate-y-0' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:-translate-y-0.5 shadow-sm'}`}>
          <Users size={18} /> Meus Pacientes ({state.patients.length})
        </button>
        <button onClick={() => actions.setActiveTab('leads')} className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap active:scale-95 ${state.activeTab === 'leads' ? 'bg-nutri-900 text-white shadow-lg shadow-nutri-900/20 translate-y-0' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:-translate-y-0.5 shadow-sm'}`}>
          <Target size={18} /> Oportunidades 
          {state.activeLeadsCount > 0 && <span className={`ml-1.5 px-2 py-0.5 rounded-lg text-xs ${state.activeTab === 'leads' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{state.activeLeadsCount}</span>}
        </button>
        <button onClick={() => actions.setActiveTab('agenda')} className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap active:scale-95 ${state.activeTab === 'agenda' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 translate-y-0' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:-translate-y-0.5 shadow-sm'}`}>
          <Calendar size={18} /> Minha Agenda
        </button>
        <button onClick={() => actions.setActiveTab('financeiro')} className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap active:scale-95 ${state.activeTab === 'financeiro' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20 translate-y-0' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:-translate-y-0.5 shadow-sm'}`}>
          <Settings size={18} /> Configurações
        </button>
      </div>

      {/* TELA DE PACIENTES */}
      {state.activeTab === 'pacientes' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-in-up">
            <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest flex items-center gap-2 mb-1"><MessageCircle size={14} className="text-nutri-800" /> Mensagens Hoje</p>
              <p className="text-3xl font-extrabold text-nutri-900">{state.todayTotalMessages}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest flex items-center gap-2 mb-1"><Users size={14} className="text-nutri-800" /> Pacientes Ativos</p>
              <p className="text-3xl font-extrabold text-nutri-900">{Object.keys(state.usageStats).length}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest flex items-center gap-2 mb-1"><Activity size={14} className="text-nutri-800" /> Média por Paciente</p>
              <p className="text-3xl font-extrabold text-nutri-900">{Object.keys(state.usageStats).length > 0 ? Math.round(state.todayTotalMessages / Object.keys(state.usageStats).length) : 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
            {state.filteredPatients.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-[2.5rem] shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center">
                <Users size={48} className="text-stone-300 mb-4" />
                <h3 className="text-xl font-bold text-stone-800 mb-2">Nenhum paciente encontrado</h3>
              </div>
            ) : (
              state.filteredPatients.map((p) => {
                const isDietReady = Boolean(p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0);
                const usage = state.usageStats[p.id] || 0;
                const isHeavyUser = usage >= 20;

                return (
                <div key={p.id} className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border flex flex-col justify-between transition-all duration-300 ${p.isNew ? 'border-nutri-300 ring-2 ring-nutri-50' : p.isLate ? 'border-amber-200 ring-2 ring-amber-50' : isDietReady ? 'border-green-100/50 bg-green-50/5' : 'border-stone-100'}`}>
                  {state.editingId === p.id ? (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Nascimento</label>
                          <input type="date" className="w-full p-3 border border-stone-200 rounded-xl font-medium text-sm mt-1" defaultValue={p.data_nascimento} onChange={e => actions.setEditForm({...state.editForm, data_nascimento: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Meta (kg)</label>
                          <input type="number" step="0.1" className="w-full p-3 border border-stone-200 rounded-xl font-medium text-sm mt-1" defaultValue={p.meta_peso || ''} onChange={e => actions.setEditForm({...state.editForm, meta_peso: e.target.value})} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Perfil Clínico</label>
                        <select className="w-full p-3 border border-stone-200 rounded-xl font-medium text-sm mt-1" defaultValue={p.tipo_perfil} onChange={e => actions.setEditForm({...state.editForm, tipo_perfil: e.target.value})}>
                          <option value="adulto">Adulto</option>
                          <option value="atleta">Atleta</option>
                          <option value="crianca">Criança</option>
                          <option value="idoso">Idoso</option>
                        </select>
                      </div>
                      <div className="space-y-3 pt-4 border-t border-stone-100">
                        <div>
                          <label className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1 mb-1"><Star size={12}/> Acesso no App</label>
                          <select className="w-full p-3 border border-green-200 bg-green-50 rounded-xl font-bold text-sm text-green-900" defaultValue={p.account_type || 'free'} onChange={e => actions.setEditForm({...state.editForm, account_type: e.target.value})}>
                            <option value="free">Básico (Apenas Check-in)</option>
                            <option value="premium">Premium (Acesso Total Liberado)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-4 border-t border-stone-100 mt-2">
                        <button onClick={() => actions.updateProfile(p.id)} className="bg-nutri-900 text-white px-4 py-3 rounded-xl flex-1 flex items-center justify-center gap-2 font-bold"><Save size={18}/> Salvar</button>
                        <button onClick={() => actions.setEditingId(null)} className="bg-stone-100 text-stone-600 px-4 py-3 rounded-xl flex-1 flex items-center justify-center gap-2 font-bold"><X size={18}/> Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full animate-fade-in">
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex flex-col">
                            <Link href={`/admin/paciente/${p.id}/historico`} className="group font-extrabold text-lg flex items-center gap-2 text-stone-900 hover:text-nutri-800">
                              <Users size={18} className="text-nutri-800" /> {p.full_name || 'Sem nome'}
                              <span title={p.account_type === 'premium' ? "Premium" : "Free"}><Star size={14} className={p.account_type === 'premium' ? "text-amber-500 fill-amber-500" : "text-stone-300"} /></span>
                            </Link>
                            {p.isNew ? <span className="flex items-center gap-1.5 text-[10px] text-nutri-700 font-bold uppercase mt-1.5"><Bell size={12} className="animate-pulse" /> Novo Paciente</span> 
                            : p.isLate && <span className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold uppercase mt-1.5"><AlertCircle size={12} /> Atrasado</span>}
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            <span className={`px-3 py-1.5 rounded-full text-[10px] uppercase font-black flex items-center gap-1.5 ${isDietReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {isDietReady ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {isDietReady ? 'Dieta Pronta' : 'Pendente'}
                            </span>
                            <button onClick={() => { actions.setEditingId(p.id); actions.setEditForm({ data_nascimento: p.data_nascimento || '', sexo: p.sexo || '', tipo_perfil: p.tipo_perfil || 'adulto', meta_peso: p.meta_peso ? p.meta_peso.toString() : '', account_type: p.account_type || 'free'}); }} className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-nutri-800"><Edit2 size={16} /></button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6 bg-stone-50/80 p-4 rounded-2xl border border-stone-100 text-center">
                          <div><p className="text-[10px] text-stone-400 uppercase font-black mb-1">Perfil</p><p className="text-sm font-bold text-stone-700 capitalize">{p.tipo_perfil || 'Não def.'}</p></div>
                          <div><p className="text-[10px] text-stone-400 uppercase font-black mb-1">Meta</p><p className="text-sm font-bold text-stone-700">{p.meta_peso ? `${p.meta_peso} kg` : '---'}</p></div>
                        </div>

                        {p.evaluation ? (
                          <button onClick={() => actions.setEvalModalOpen({ isOpen: true, data: p.evaluation?.answers, name: p.full_name })} className="w-full flex items-center justify-between bg-nutri-50/50 hover:bg-nutri-50 transition-colors p-4 rounded-2xl mb-4 group text-left border border-nutri-100/50">
                            <div className="flex-1 pr-4">
                              <p className="font-bold text-nutri-900 mb-1.5 text-[10px] uppercase flex items-center gap-1.5"><Eye size={14}/> Avaliação Respondida</p>
                              <p className="line-clamp-1 text-xs text-stone-600 italic">"{Object.values(p.evaluation.answers)[0] as string}"</p>
                            </div>
                            <ChevronRight size={16} className="text-nutri-800 opacity-40 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <div className="text-xs text-stone-400 font-medium italic mb-4 bg-stone-50 p-4 rounded-2xl text-center border border-dashed border-stone-200 flex items-center justify-center gap-2"><FileText size={14}/> Sem avaliação</div>
                        )}

                        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 mb-6">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-stone-400 uppercase">Uso do Chat</span>
                            {isHeavyUser && <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-md">Alto uso ⚠️</span>}
                          </div>
                          <div className="mt-2"><span className="text-xl font-extrabold text-nutri-900">{usage} msgs</span></div>
                          <div className="w-full bg-stone-200 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isHeavyUser ? 'bg-red-500' : 'bg-nutri-800'}`} style={{ width: `${Math.min(100, (usage / 25) * 100)}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="pt-5 border-t border-stone-100 flex items-center justify-between flex-wrap gap-3 mt-auto">
                        
                        <div className="flex gap-2 w-full sm:w-auto">
                          {/* BOTÃO DINÂMICO: MONTAR OU EDITAR */}
                          <button 
                            onClick={() => actions.handleOpenDietBuilder(p)} 
                            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${isDietReady ? 'bg-stone-100 text-stone-700 hover:bg-stone-200' : 'bg-nutri-900 text-white hover:bg-nutri-800 shadow-md'}`}
                          >
                            <Utensils size={16} /> {isDietReady ? 'Editar Cardápio' : 'Montar Dieta'}
                          </button>
                          
                          {isDietReady && (
                            <>
                              <button 
                                onClick={() => actions.handleGeneratePDF(p)} 
                                title="Gerar PDF"
                                className="px-3 py-2.5 bg-rose-600 text-white rounded-xl flex items-center justify-center transition-all hover:bg-rose-700 active:scale-95 shadow-md"
                              >
                                <FileText size={16} />
                              </button>
                              
                              <button 
                                onClick={() => actions.handleDeleteDiet(p.id)} 
                                title="Excluir Dieta / Nova Dieta"
                                className="px-3 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl flex items-center justify-center transition-all hover:bg-red-100 active:scale-95 shadow-sm"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                          <a href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá!`} target="_blank" rel="noopener noreferrer" className={`p-2.5 rounded-xl border ${p.isLate ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}><BellRing size={18} /></a>
                          <button onClick={() => actions.setSelectedPatient({ id: p.id, name: p.full_name })} className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"><Activity size={18} /></button>
                          <a href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá!`} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"><MessageCircle size={18} /></a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* TELA DE LEADS */}
      {state.activeTab === 'leads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
          {state.filteredLeads.map((lead) => (
            <div key={lead.id} className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col justify-between hover:shadow-md">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2"><UserPlus size={18} className="text-amber-500" /> {lead.nome}</h3>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${lead.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>{lead.status === 'concluido' ? 'Concluído' : 'Abandonou'}</span>
                </div>
                <p className="text-sm font-bold text-stone-500 mb-6 flex items-center gap-2"><MessageCircle size={14} className="text-[#25D366]" /> {lead.whatsapp}</p>
                <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100 mb-6 relative overflow-hidden">
                  <div className="flex justify-between text-[10px] font-black uppercase text-stone-400 mb-3"><span>Progresso</span><span className="text-nutri-800">{(Object.keys(lead.respostas || {}).length / 10) * 100}%</span></div>
                  <div className="w-full h-2 bg-stone-200 rounded-full"><div className="h-full bg-nutri-800" style={{ width: `${(Object.keys(lead.respostas || {}).length / 10) * 100}%` }}></div></div>
                </div>
              </div>
              <a href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, '')}?text=Olá!`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-xl font-bold">
                <MessageCircle size={18} /> Resgatar Contato
              </a>
            </div>
          ))}
        </div>
      )}

      {/* TELA DE AGENDA */}
      {state.activeTab === 'agenda' && (
        <div className="animate-fade-in-up">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-stone-100 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div><h2 className="text-2xl font-bold flex items-center gap-3"><Calendar className="text-blue-500" /> Consultas</h2></div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              
              {/* 🔥 NOVO BOTÃO DE VER AGENDAMENTOS RESTAURADO */}
              <a 
                href="https://calendly.com/app/scheduled_events/user/me" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-1 flex items-center justify-center gap-2 bg-nutri-900 hover:bg-nutri-800 text-white px-5 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95 whitespace-nowrap"
              >
                <ExternalLink size={18} /> Ver Agendamentos
              </a>

              <button onClick={actions.copyToClipboard} className="flex-1 flex items-center justify-center gap-2 bg-stone-50 border border-stone-200 px-5 py-3.5 rounded-xl font-bold text-sm transition-all hover:bg-stone-100 active:scale-95">
                {state.copiedLink ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-stone-400" />} {state.copiedLink ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-stone-100 h-[800px] relative overflow-hidden">
            {state.calendlyUrl ? <iframe src={state.calendlyUrl} width="100%" height="100%" frameBorder="0" className="absolute inset-0 bg-stone-50"></iframe> : <div className="text-center p-8 mt-40">Adicione o link nas Configurações.</div>}
          </div>
        </div>
      )}

      {/* TELA DE FINANCEIRO */}
      {state.activeTab === 'financeiro' && (
        <div className="max-w-4xl mx-auto animate-fade-in-up bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-stone-100">
          <div className="flex items-center gap-5 mb-10 border-b border-stone-100 pb-8"><div className="bg-amber-100 p-4 rounded-3xl text-amber-600"><Settings size={32} /></div><div><h2 className="text-2xl font-bold text-stone-900">Configurações</h2></div></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200">
              <label className="text-xs font-black text-stone-500 uppercase flex items-center gap-2 mb-3"><Star size={16} className="text-amber-500" /> Premium</label>
              <input type="number" step="0.01" value={state.premiumPrice} onChange={(e) => actions.setPremiumPrice(e.target.value)} className="w-full bg-transparent text-3xl font-extrabold outline-none" />
            </div>
            <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200">
              <label className="text-xs font-black text-stone-500 uppercase flex items-center gap-2 mb-3"><FileText size={16} className="text-nutri-800" /> Plano (PDF)</label>
              <input type="number" step="0.01" value={state.mealPlanPrice} onChange={(e) => actions.setMealPlanPrice(e.target.value)} className="w-full bg-transparent text-3xl font-extrabold outline-none" />
            </div>
            <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200">
              <label className="text-xs font-black text-stone-500 uppercase flex items-center gap-2 mb-3"><Calendar size={16} className="text-blue-500" /> Consulta</label>
              <input type="number" step="0.01" value={state.consultationPrice} onChange={(e) => actions.setConsultationPrice(e.target.value)} className="w-full bg-transparent text-3xl font-extrabold outline-none" />
            </div>
          </div>
          
          <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200 mb-10">
            <label className="text-xs font-black text-stone-500 uppercase flex items-center gap-2 mb-3"><Link2 size={16} /> URL Calendly</label>
            <input type="url" value={state.calendlyUrl} onChange={(e) => actions.setCalendlyUrl(e.target.value)} className="w-full bg-transparent text-base font-bold text-stone-800 outline-none border-b-2 border-stone-200 pb-2" />
          </div>

          <button onClick={actions.handleSaveSettings} disabled={state.isSavingPrice} className="w-full md:w-auto px-12 py-4 flex justify-center bg-nutri-900 text-white rounded-2xl font-bold">
            {state.isSavingPrice ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      )}

      {/* MODAL DE AVALIAÇÃO */}
      {state.evalModalOpen.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between p-6 border-b"><h3 className="font-extrabold text-xl">Avaliação de {state.evalModalOpen.name}</h3><button onClick={() => actions.setEvalModalOpen({ isOpen: false, data: null, name: '' })}><X size={20} /></button></div>
            <div className="p-6 overflow-y-auto space-y-6">
              {Object.entries(state.evalModalOpen.data || {}).map(([k, v]) => (
                <div key={k} className="bg-stone-50 p-5 rounded-2xl"><p className="text-[10px] font-black text-nutri-800 uppercase mb-2">{questionTitles[parseInt(k)]}</p><p className="text-sm font-medium">{v as string}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DIETA ATUALIZADO */}
      {state.dietModalOpen.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/80 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl relative my-auto">
            <button onClick={() => { actions.setDietModalOpen({ ...state.dietModalOpen, isOpen: false }); actions.fetchAdminData(); }} className="absolute -top-14 right-0 text-white p-3"><X size={24} /></button>
            
            <DietBuilder 
              patientId={state.dietModalOpen.id} 
              patientName={state.dietModalOpen.name} 
              onClose={() => { actions.setDietModalOpen({ ...state.dietModalOpen, isOpen: false }); actions.fetchAdminData(); }} 
              targetRecommendation={state.dietModalOpen.targetRecommendation} 
            />

          </div>
        </div>
      )}

      <ClinicalDataModal isOpen={!!state.selectedPatient} onClose={() => actions.setSelectedPatient(null)} patientId={state.selectedPatient?.id || ''} patientName={state.selectedPatient?.name || ''} />
      
      <ChatAssistant adminContext={state.adminContext} />

    </main>
  );
}