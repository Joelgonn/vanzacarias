'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, LogOut, Users, MessageCircle, Search, Filter, 
  Edit2, Save, X, TrendingUp, AlertCircle, Bell, BellRing, 
  Activity, Target, Eye, UserPlus, Clock, ChevronRight, Star,
  DollarSign, FileText, Calendar, Link2, Copy, Check, ExternalLink, 
  Utensils, CheckCircle2, Settings
} from 'lucide-react';
import ClinicalDataModal from '@/components/ClinicalDataModal';
import DietBuilder from '@/components/DietBuilder'; 
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

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

const formatCurrency = (value: string | number) => {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numericValue)) return '0,00';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numericValue);
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

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();

  // =========================================================================
  // ESTADOS DO COMPONENTE
  // =========================================================================
  const [patients, setPatients] = useState<Patient[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // Filtros e Abas
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [lastSeenNewPatientTime, setLastSeenNewPatientTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'pacientes' | 'leads' | 'agenda' | 'financeiro'>('pacientes');
  
  // Edição e Modais
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{id: string, name: string} | null>(null);
  const [evalModalOpen, setEvalModalOpen] = useState<{isOpen: boolean, data: any, name: string}>({ isOpen: false, data: null, name: '' });
  const [dietModalOpen, setDietModalOpen] = useState<{isOpen: boolean, id: string, name: string}>({ isOpen: false, id: '', name: '' });
  
  // Configurações do Sistema
  const [premiumPrice, setPremiumPrice] = useState('297.00');
  const [mealPlanPrice, setMealPlanPrice] = useState('147.00');
  const [consultationPrice, setConsultationPrice] = useState('197.00');
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Formulário de Edição Rápida
  const [editForm, setEditForm] = useState({ 
    data_nascimento: '', 
    sexo: '', 
    tipo_perfil: 'adulto',
    meta_peso: '',
    account_type: 'free'
  });

  // =========================================================================
  // EFEITOS E BUSCA DE DADOS
  // =========================================================================
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
      }) as Patient[];
      
      setPatients(combined || []);

      const { data: leadsData } = await supabase
        .from('leads_avaliacao')
        .select('*')
        .neq('status', 'convertido')
        .order('updated_at', { ascending: false });

      setLeads(leadsData as Lead[] || []);

    } catch (error) {
      console.error("Erro ao carregar dados do admin:", error);
      toast.error("Ocorreu um erro ao carregar as informações do painel.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // MEMOIZAÇÕES E CÁLCULOS
  // =========================================================================
  const newPatientsCount = useMemo(() => patients.filter(p => p.isNew).length, [patients]);  
  const activeLeadsCount = useMemo(() => leads.length, [leads]);
  const unseenPatientsCount = useMemo(() => {
    return patients.filter(p => p.isNew && new Date(p.created_at).getTime() > lastSeenNewPatientTime).length;
  }, [patients, lastSeenNewPatientTime]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      // CORREÇÃO TYPESCRIPT: Forçando conversão estrita para Booleano
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

  // =========================================================================
  // FUNÇÕES DE AÇÃO
  // =========================================================================
  const updateProfile = async (id: string) => {
    const updateData = {
      // Evita strings vazias em colunas DATE/TEXT do PostgreSQL enviando null explicitamente
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
      toast.error("Falha ao atualizar o perfil. Tente novamente.");
      // Transforma o erro em JSON legível caso seja devolvido um objeto opaco
      console.error("Erro Supabase:", JSON.stringify(error, null, 2), error);
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

    const { error } = await supabase
      .from('system_settings')
      .update(updatePayload)
      .eq('id', 1);

    if (!error) {
      toast.success("Configurações do sistema salvas com sucesso!");
    } else {
      console.error("Erro nas configurações:", error);
      toast.error("Erro ao salvar as configurações.");
    }
    setIsSavingPrice(false);
  };

  const copyToClipboard = () => {
    if(!calendlyUrl) {
      toast.warning("Não há link configurado para copiar.");
      return;
    }
    navigator.clipboard.writeText(calendlyUrl);
    setCopiedLink(true);
    toast.success("Link da agenda copiado para a área de transferência!");
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

  // =========================================================================
  // GERAÇÃO DE PDF PAGINADO USANDO jsPDF
  // =========================================================================
  const handleGeneratePDF = async (patient: Patient) => {
    if (!patient.meal_plan || patient.meal_plan.length === 0) {
      toast.warning("A dieta deste paciente está vazia. Adicione refeições antes de gerar o PDF.");
      return;
    }

    const toastId = toast.loading("Gerando PDF, aguarde...");
    
    try {
      const mealPlanJSON = patient.meal_plan;
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;

      const totalKcal = mealPlanJSON.reduce((acc: number, meal: any) => acc + (meal.options[0]?.kcal || 0), 0);

      const daysMap = new Map<string, any[]>();
      mealPlanJSON.forEach((meal: any) => {
        meal.options.forEach((opt: any) => {
          const dayName = opt.day?.trim() || "Opção";
          if (!daysMap.has(dayName)) daysMap.set(dayName, []);
          daysMap.get(dayName)!.push({
            mealName: meal.name,
            time: meal.time,
            description: opt.description,
            kcal: opt.kcal
          });
        });
      });

      const dayOrder = ["Todos os dias", "Segunda a Sexta", "Finais de Semana", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
      const sortedDays = Array.from(daysMap.keys()).sort((a, b) => {
        let idxA = dayOrder.indexOf(a); let idxB = dayOrder.indexOf(b);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });

      let logoBase64: string | null = null;
      try {
        logoBase64 = await getBase64ImageFromUrl('/images/logo-vanusa.png');
      } catch (error) {
        console.warn("Logo não encontrada para o PDF.");
      }

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

        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text("BASE DIÁRIA:", pageWidth - margin - 52, currentY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(234, 88, 12); 
        doc.text(`~${totalKcal} kcal`, pageWidth - margin, currentY, { align: "right" });

        currentY += 6;
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 12;

        // Footer
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text("Plano alimentar individual e intransferível elaborado por Vanusa Zacarias - Nutrição Clínica.", pageWidth / 2, pageHeight - 10, { align: "center" });

        return currentY;
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
        mealsForDay.forEach(meal => {
          if (y > pageHeight - 40) { doc.addPage(); y = printHeaderAndFooter(); }

          doc.setFillColor(245, 248, 246); 
          doc.rect(margin, y - 6, pageWidth - (margin * 2), 10, 'F');
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(26, 58, 42);
          doc.text(`${meal.mealName.toUpperCase()} - ${meal.time}`, margin + 3, y + 1);
          
          if (meal.kcal > 0) {
            doc.setFontSize(9);
            doc.setTextColor(234, 88, 12);
            doc.text(`~${meal.kcal} kcal`, pageWidth - margin - 3, y + 1, { align: "right" });
          }
          y += 10;

          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(50, 50, 50);
          const maxWidth = pageWidth - (margin * 2);
          const splitDesc = doc.splitTextToSize(meal.description, maxWidth);
          doc.text(splitDesc, margin + 3, y);
          y += (splitDesc.length * 5) + 6; 
        });
      });

      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
      toast.success("PDF gerado com sucesso!", { id: toastId });

    } catch (error) {
      console.error(error);
      toast.error("Ocorreu um erro ao gerar o PDF.", { id: toastId });
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
        <p className="text-stone-500 font-medium animate-pulse">Carregando painel...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 pt-24 lg:pt-28 font-sans text-stone-800">
      
      {/* =========================================================================
          HEADER E FILTROS PRINCIPAIS
          ========================================================================= */}
      <header className="flex flex-col gap-6 mb-8 bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 transition-all">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-nutri-900 tracking-tight">Painel Administrativo</h1>
            <p className="text-stone-500 text-sm mt-1">Gestão de Pacientes, Consultas & Captação</p>
          </div>
          
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <button 
              onClick={handleBellClick}
              title={showOnlyNew ? "Remover filtro de novos pacientes" : "Filtrar novos pacientes"}
              className={`relative group p-2.5 rounded-full transition-all duration-300 ${showOnlyNew ? 'bg-nutri-100 shadow-inner' : 'hover:bg-stone-100 hover:-translate-y-0.5'}`}
            >
              <Bell 
                size={22} 
                className={`transition-colors ${unseenPatientsCount > 0 ? 'text-nutri-800 animate-pulse' : showOnlyNew ? 'text-nutri-800' : 'text-stone-400 group-hover:text-stone-600'}`} 
              />
              {unseenPatientsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {unseenPatientsCount}
                </span>
              )}
            </button>

            <button 
              onClick={handleLogout} 
              title="Sair do Sistema" 
              className="flex items-center gap-2 text-red-600 bg-red-50 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-100 hover:-translate-y-0.5 transition-all active:scale-95"
            >
              <LogOut size={16} strokeWidth={2.5} /> Sair
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-stone-100">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder={activeTab === 'pacientes' ? "Buscar paciente por nome..." : activeTab === 'leads' ? "Buscar lead por nome..." : "Buscar..."}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-stone-200 focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none transition-all font-medium text-stone-700 bg-stone-50 focus:bg-white"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === 'pacientes' && (
            <div className="relative group min-w-[200px]">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={18} />
              <select 
                title="Filtrar por Status do Plano" 
                className="w-full pl-11 pr-10 py-3.5 rounded-2xl border border-stone-200 bg-stone-50 focus:bg-white outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 transition-all font-medium text-stone-700 appearance-none cursor-pointer" 
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="todos">Todos os status</option>
                <option value="pendente">Dieta Pendente</option>
                <option value="plano_liberado">Plano Liberado</option>
              </select>
            </div>
          )}
        </div>
      </header>

      {/* =========================================================================
          NAVEGAÇÃO EM ABAS
          ========================================================================= */}
      <div className="flex gap-4 mb-8 overflow-x-auto scrollbar-hide pb-2 px-1">
        <button 
          onClick={() => setActiveTab('pacientes')} 
          className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap active:scale-95 ${activeTab === 'pacientes' ? 'bg-nutri-900 text-white shadow-lg shadow-nutri-900/20 translate-y-0' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:-translate-y-0.5 shadow-sm'}`}
        >
          <Users size={18} /> Meus Pacientes ({patients.length})
        </button>
        <button 
          onClick={() => setActiveTab('leads')} 
          className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap active:scale-95 ${activeTab === 'leads' ? 'bg-nutri-900 text-white shadow-lg shadow-nutri-900/20 translate-y-0' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:-translate-y-0.5 shadow-sm'}`}
        >
          <Target size={18} /> Oportunidades 
          {activeLeadsCount > 0 && <span className={`ml-1.5 px-2 py-0.5 rounded-lg text-xs ${activeTab === 'leads' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{activeLeadsCount}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('agenda')} 
          className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap active:scale-95 ${activeTab === 'agenda' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 translate-y-0' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:-translate-y-0.5 shadow-sm'}`}
        >
          <Calendar size={18} /> Minha Agenda
        </button>
        <button 
          onClick={() => setActiveTab('financeiro')} 
          className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap active:scale-95 ${activeTab === 'financeiro' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20 translate-y-0' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:-translate-y-0.5 shadow-sm'}`}
        >
          <Settings size={18} /> Configurações
        </button>
      </div>

      {/* =========================================================================
          ABA 1: MEUS PACIENTES
          ========================================================================= */}
      {activeTab === 'pacientes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
          {filteredPatients.length === 0 ? (
            <div className="col-span-full bg-white p-12 rounded-[2.5rem] shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center">
              <Users size={48} className="text-stone-300 mb-4" />
              <h3 className="text-xl font-bold text-stone-800 mb-2">Nenhum paciente encontrado</h3>
              <p className="text-stone-500 max-w-md">Verifique os filtros aplicados ou a busca realizada. Caso seja um paciente novo, ele aparecerá aqui assim que se cadastrar no App.</p>
            </div>
          ) : (
            filteredPatients.map((p) => {
              const isDietReady = Boolean(p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0);

              return (
              <div key={p.id} className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm hover:shadow-md border flex flex-col justify-between transition-all duration-300 ${p.isNew ? 'border-nutri-300 ring-2 ring-nutri-50' : p.isLate ? 'border-amber-200 ring-2 ring-amber-50' : isDietReady ? 'border-green-100/50 bg-green-50/5' : 'border-stone-100'}`}>
                
                {editingId === p.id ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Nascimento</label>
                        <input type="date" className="w-full p-3 border border-stone-200 rounded-xl font-medium text-sm mt-1 outline-none focus:border-nutri-800" defaultValue={p.data_nascimento} onChange={e => setEditForm({...editForm, data_nascimento: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Meta (kg)</label>
                        <input type="number" step="0.1" placeholder="0.0" className="w-full p-3 border border-stone-200 rounded-xl font-medium text-sm mt-1 outline-none focus:border-nutri-800" defaultValue={p.meta_peso || ''} onChange={e => setEditForm({...editForm, meta_peso: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Perfil Clínico</label>
                      <select className="w-full p-3 border border-stone-200 rounded-xl font-medium text-sm mt-1 outline-none focus:border-nutri-800 bg-white" defaultValue={p.tipo_perfil} onChange={e => setEditForm({...editForm, tipo_perfil: e.target.value})}>
                        <option value="adulto">Adulto</option>
                        <option value="atleta">Atleta</option>
                        <option value="crianca">Criança</option>
                        <option value="idoso">Idoso</option>
                      </select>
                    </div>
                    
                    <div className="space-y-3 pt-4 border-t border-stone-100">
                      <div>
                        <label className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1 mb-1"><Star size={12}/> Acesso no App</label>
                        <select className="w-full p-3 border border-green-200 bg-green-50 rounded-xl font-bold text-sm text-green-900 outline-none focus:ring-2 focus:ring-green-500" defaultValue={p.account_type || 'free'} onChange={e => setEditForm({...editForm, account_type: e.target.value})}>
                          <option value="free">Básico (Apenas Check-in)</option>
                          <option value="premium">Premium (Acesso Total Liberado)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-stone-100 mt-2">
                      <button onClick={() => updateProfile(p.id)} title="Salvar Alterações" className="bg-nutri-900 text-white px-4 py-3 rounded-xl flex-1 flex items-center justify-center gap-2 font-bold hover:bg-nutri-800 active:scale-95 transition-all shadow-sm"><Save size={18}/> Salvar</button>
                      <button onClick={() => setEditingId(null)} title="Cancelar Edição" className="bg-stone-100 text-stone-600 px-4 py-3 rounded-xl flex-1 flex items-center justify-center gap-2 font-bold hover:bg-stone-200 active:scale-95 transition-all"><X size={18}/> Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full animate-fade-in">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-col">
                          <Link href={`/admin/paciente/${p.id}/historico`} title="Acessar Prontuário Completo" className="group font-extrabold text-lg flex items-center gap-2 text-stone-900 hover:text-nutri-800 transition-colors">
                            <Users size={18} className="text-nutri-800" /> 
                            {p.full_name || 'Sem nome'}
                            
                            <span title={p.account_type === 'premium' ? "Conta Premium Ativa" : "Conta Básica"}>
                              <Star size={14} className={p.account_type === 'premium' ? "text-amber-500 fill-amber-500" : "text-stone-300"} />
                            </span>

                            <TrendingUp size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -ml-1 text-stone-400" />
                          </Link>
                          {p.isNew ? (
                            <span className="flex items-center gap-1.5 text-[10px] text-nutri-700 font-bold uppercase tracking-wider mt-1.5">
                              <Bell size={12} fill="currentColor" className="animate-pulse" /> Novo Paciente
                            </span>
                          ) : p.isLate && (
                            <span className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold uppercase tracking-wider mt-1.5">
                              <AlertCircle size={12} /> Check-in Atrasado
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-3">
                          <span className={`px-3 py-1.5 rounded-full text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 shadow-sm ${isDietReady ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                            {isDietReady ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            {isDietReady ? 'Dieta Pronta' : 'Dieta Pendente'}
                          </span>

                          <button onClick={() => { 
                            setEditingId(p.id); 
                            setEditForm({ 
                              data_nascimento: p.data_nascimento || '', 
                              sexo: p.sexo || '', 
                              tipo_perfil: p.tipo_perfil || 'adulto', 
                              meta_peso: p.meta_peso ? p.meta_peso.toString() : '', 
                              account_type: p.account_type || 'free'
                            }); 
                          }} title="Editar Perfil do Paciente" className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400 hover:text-nutri-800">
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6 bg-stone-50/80 p-4 rounded-2xl border border-stone-100 text-center">
                        <div><p className="text-[10px] text-stone-400 uppercase font-black tracking-widest text-center mb-1">Perfil</p><p className="text-sm font-bold text-stone-700 capitalize">{p.tipo_perfil || 'Não def.'}</p></div>
                        <div><p className="text-[10px] text-stone-400 uppercase font-black tracking-widest text-center mb-1">Meta de Peso</p><p className="text-sm font-bold text-stone-700">{p.meta_peso ? `${p.meta_peso} kg` : '---'}</p></div>
                      </div>

                      {p.evaluation ? (
                        <button onClick={() => setEvalModalOpen({ isOpen: true, data: p.evaluation?.answers, name: p.full_name })} title="Ver Respostas da Avaliação Inicial" className="w-full flex items-center justify-between bg-nutri-50/50 hover:bg-nutri-50 transition-colors p-4 rounded-2xl border border-nutri-100/50 mb-6 group text-left">
                          <div className="flex-1 pr-4">
                            <p className="font-bold text-nutri-900 mb-1.5 text-[10px] uppercase tracking-widest flex items-center gap-1.5"><Eye size={14}/> Avaliação Respondida</p>
                            <p className="line-clamp-1 text-xs text-stone-600 italic leading-relaxed">"{Object.values(p.evaluation.answers)[0] as string}"</p>
                          </div>
                          <ChevronRight size={16} className="text-nutri-800 opacity-40 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <div className="text-xs text-stone-400 font-medium italic mb-6 bg-stone-50 p-4 rounded-2xl text-center border border-dashed border-stone-200 flex items-center justify-center gap-2">
                          <FileText size={14}/> Sem avaliação cadastrada.
                        </div>
                      )}
                    </div>

                    <div className="pt-5 border-t border-stone-100 flex items-center justify-between flex-wrap gap-3 mt-auto">
                      
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                          onClick={() => setDietModalOpen({ isOpen: true, id: p.id, name: p.full_name })}
                          title={isDietReady ? "Editar Dieta do Paciente" : "Montar Nova Dieta"}
                          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                            isDietReady 
                              ? 'bg-stone-100 text-stone-700 hover:bg-stone-200' 
                              : 'bg-nutri-900 text-white shadow-lg shadow-nutri-900/20 hover:bg-nutri-800 hover:-translate-y-0.5'
                          }`}
                        >
                          <Utensils size={16} /> {isDietReady ? 'Editar Dieta' : 'Montar Dieta'}
                        </button>

                        {isDietReady && (
                          <button 
                            onClick={() => handleGeneratePDF(p)}
                            title="Gerar e Imprimir Dieta em PDF"
                            className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all active:scale-95 hover:-translate-y-0.5"
                          >
                            <FileText size={16} /> PDF
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                        <a 
                          href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá%20${p.full_name?.split(' ')[0]},%20aqui%20é%20a%20Nutri%20Vanusa!%20Notei%20que%20você%20ainda%20não%20enviou%20seu%20check-in%20dessa%20semana.%20Como%20estão%20as%20coisas?`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          title="Cobrar Check-in via WhatsApp"
                          className={`p-2.5 rounded-xl transition-all flex items-center justify-center border ${p.isLate ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 hover:scale-105' : 'bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100'}`}
                        >
                          <BellRing size={18} />
                        </a>
                        <button 
                          onClick={() => setSelectedPatient({ id: p.id, name: p.full_name })} 
                          title="Inserir/Ver Dados Clínicos (Medidas e Exames)" 
                          className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:scale-105 transition-all"
                        >
                          <Activity size={18} />
                        </button>
                        <a 
                          href={`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=Olá%20${p.full_name?.split(' ')[0]},%20tudo%20bem?`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          title="Enviar Mensagem no WhatsApp" 
                          className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 hover:scale-105 transition-all"
                        >
                          <MessageCircle size={18} />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 2: OPORTUNIDADES (LEADS)
          ========================================================================= */}
      {activeTab === 'leads' && (
        <div className="animate-fade-in-up">
          {filteredLeads.length === 0 ? (
            <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 border border-stone-100 shadow-inner">
                <Target size={32} className="text-stone-300" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Nenhuma oportunidade pendente</h3>
              <p className="text-stone-500 text-sm max-w-md">
                Quando um visitante iniciar a avaliação do funil de vendas, os dados dele aparecerão aqui para que você possa resgatá-lo via WhatsApp.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLeads.map((lead) => {
                const numRespostas = Object.keys(lead.respostas || {}).length;
                const progresso = (numRespostas / 10) * 100;
                return (
                  <div key={lead.id} className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                          <UserPlus size={18} className="text-amber-500" /> {lead.nome}
                        </h3>
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${lead.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                          {lead.status === 'concluido' ? 'Quiz Concluído' : 'Abandonou'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-stone-500 mb-6 flex items-center gap-2">
                        <MessageCircle size={14} className="text-[#25D366]" /> {lead.whatsapp}
                      </p>
                      
                      <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100 mb-6 relative overflow-hidden">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
                          <span>Progresso do Quiz</span>
                          <span className="text-nutri-800">{progresso}%</span>
                        </div>
                        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div className="h-full bg-nutri-800 transition-all duration-1000 ease-out" style={{ width: `${progresso}%` }}></div>
                        </div>
                        <p className="text-xs font-medium text-stone-500 mt-4 flex items-center gap-1.5">
                          <Clock size={12} className="text-stone-400" /> Visto em: {new Date(lead.updated_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <a 
                      href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, '')}?text=Olá%20${lead.nome?.split(' ')[0]},%20vi%20que%20você%20começou%20nossa%20avaliação.%20Posso%20te%20ajudar%20com%20alguma%20dúvida?`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-xl font-bold hover:bg-[#1ebd5b] transition-all active:scale-95 shadow-lg shadow-[#25D366]/20"
                    >
                      <MessageCircle size={18} /> Resgatar Contato
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ABA 3: AGENDA (INTEGRAÇÃO CALENDLY)
          ========================================================================= */}
      {activeTab === 'agenda' && (
        <div className="animate-fade-in-up">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-stone-100 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-3"><Calendar className="text-blue-500" /> Controle de Consultas</h2>
              <p className="text-stone-500 mt-1.5 text-sm font-medium">Acompanhe seus horários disponíveis e gerencie agendamentos diretamente pelo seu calendário.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={copyToClipboard}
                title="Copiar link da agenda"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-stone-50 border border-stone-200 hover:bg-stone-100 text-stone-700 px-5 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95"
              >
                {copiedLink ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-stone-400" />}
                {copiedLink ? 'Copiado!' : 'Copiar Link Público'}
              </button>
              <a 
                href="https://calendly.com/app/scheduled_events/user/me" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Abrir painel administrativo do Calendly"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 active:scale-95 hover:-translate-y-0.5"
              >
                Painel do Calendly <ExternalLink size={16} />
              </a>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-stone-100 overflow-hidden h-[800px] flex flex-col items-center justify-center relative">
            {calendlyUrl && calendlyUrl.includes('calendly.com') ? (
              <iframe 
                src={calendlyUrl} 
                width="100%" 
                height="100%" 
                frameBorder="0"
                className="absolute inset-0 bg-stone-50"
              ></iframe>
            ) : (
              <div className="text-center p-8 max-w-md">
                <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-stone-100"><Link2 size={32} className="text-stone-300" /></div>
                <h3 className="font-bold text-xl text-stone-800 mb-2">Link de Agenda Ausente</h3>
                <p className="text-stone-500 text-sm mb-6 leading-relaxed">Você precisa configurar a URL do seu Calendly na aba de "Configurações" para conseguir visualizá-lo embutido aqui no painel.</p>
                <button onClick={() => setActiveTab('financeiro')} className="bg-nutri-900 text-white px-6 py-3.5 rounded-xl font-bold text-sm hover:bg-nutri-800 transition-colors shadow-lg shadow-nutri-900/20">Acessar Configurações</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 4: CONFIGURAÇÕES E FINANCEIRO
          ========================================================================= */}
      {activeTab === 'financeiro' && (
        <div className="max-w-4xl mx-auto animate-fade-in-up">
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-stone-100">
            <div className="flex items-center gap-5 mb-10 border-b border-stone-100 pb-8">
              <div className="bg-amber-100 p-4 rounded-3xl text-amber-600 border border-amber-200">
                <Settings size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Configurações do Sistema</h2>
                <p className="text-stone-500 mt-1 font-medium">Defina os valores de venda dos seus serviços e configure integrações externas.</p>
              </div>
            </div>

            <div className="space-y-10 mb-10">
              {/* Preços */}
              <section>
                <h3 className="text-sm font-black text-stone-400 uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                  <DollarSign size={16} /> Preços de Checkout
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  <div className="relative group flex flex-col bg-stone-50 p-6 rounded-3xl border border-stone-200 focus-within:bg-white focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-800/10 transition-all">
                    <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Star size={16} className="text-amber-500" /> Assinatura Premium
                    </label>
                    <div className="flex items-center gap-2 text-stone-900">
                      <span className="text-xl font-medium text-stone-400">R$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={premiumPrice} 
                        onChange={(e) => setPremiumPrice(e.target.value)}
                        className="w-full bg-transparent text-3xl font-extrabold outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-4 leading-relaxed">Valor cobrado para liberação total do App (Métricas, Histórico e Check-ins avançados).</p>
                  </div>

                  <div className="relative group flex flex-col bg-stone-50 p-6 rounded-3xl border border-stone-200 focus-within:bg-white focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-800/10 transition-all">
                    <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FileText size={16} className="text-nutri-800" /> Meu Plano (PDF)
                    </label>
                    <div className="flex items-center gap-2 text-stone-900">
                      <span className="text-xl font-medium text-stone-400">R$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={mealPlanPrice} 
                        onChange={(e) => setMealPlanPrice(e.target.value)}
                        className="w-full bg-transparent text-3xl font-extrabold outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-4 leading-relaxed">Compra avulsa do cardápio atualizado em PDF. O paciente mantém a conta na versão Free.</p>
                  </div>

                  <div className="relative group flex flex-col bg-stone-50 p-6 rounded-3xl border border-stone-200 focus-within:bg-white focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-800/10 transition-all">
                    <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Calendar size={16} className="text-blue-500" /> Nova Consulta
                    </label>
                    <div className="flex items-center gap-2 text-stone-900">
                      <span className="text-xl font-medium text-stone-400">R$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={consultationPrice} 
                        onChange={(e) => setConsultationPrice(e.target.value)}
                        className="w-full bg-transparent text-3xl font-extrabold outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-4 leading-relaxed">Valor exibido para compra de consulta ou retorno diretamente pelo aplicativo.</p>
                  </div>

                </div>
              </section>

              {/* Integrações */}
              <section>
                <h3 className="text-sm font-black text-stone-400 uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                  <Link2 size={16} /> Integrações Externas
                </h3>
                <div className="relative group flex flex-col bg-stone-50 p-6 rounded-3xl border border-stone-200 focus-within:bg-white focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-800/10 transition-all">
                  <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Calendar size={16} className="text-blue-500" /> URL da Agenda Calendly
                  </label>
                  <input 
                    type="url" 
                    value={calendlyUrl} 
                    onChange={(e) => setCalendlyUrl(e.target.value)}
                    className="w-full bg-transparent text-base font-bold text-stone-800 outline-none border-b-2 border-stone-200 focus:border-nutri-800 pb-2 transition-colors placeholder:text-stone-300 placeholder:font-medium"
                    placeholder="https://calendly.com/seu-usuario"
                  />
                  <p className="text-[11px] font-medium text-stone-400 mt-3 leading-relaxed">
                    Insira o link principal da sua agenda Calendly. Ele será exibido para o paciente agendar consultas e para você controlar os horários internamente.
                  </p>
                </div>
              </section>
            </div>

            <div className="pt-8 border-t border-stone-100 flex justify-end">
              <button 
                onClick={handleSaveSettings}
                disabled={isSavingPrice}
                className="w-full md:w-auto px-12 flex items-center justify-center gap-3 bg-nutri-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-nutri-800 transition-all shadow-xl shadow-nutri-900/20 active:scale-95 disabled:opacity-70"
              >
                {isSavingPrice ? <Loader2 className="animate-spin" size={22} /> : <Save size={22} />}
                {isSavingPrice ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: VISUALIZAR AVALIAÇÃO INICIAL
          ========================================================================= */}
      {evalModalOpen.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="flex justify-between items-center p-6 md:p-8 border-b border-stone-100 bg-stone-50/50">
              <div>
                <h3 className="font-extrabold text-xl md:text-2xl text-stone-900 tracking-tight">Avaliação Inicial</h3>
                <p className="text-sm font-medium text-stone-500 mt-1">
                  Respostas enviadas por <span className="font-bold text-nutri-900">{evalModalOpen.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setEvalModalOpen({ isOpen: false, data: null, name: '' })} 
                className="bg-white text-stone-400 hover:text-stone-700 hover:bg-stone-50 p-2.5 rounded-full border border-stone-200 transition-all active:scale-90"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 bg-white">
              {Object.entries(evalModalOpen.data || {}).map(([key, value]) => (
                <div key={key} className="bg-stone-50 p-5 rounded-2xl border border-stone-100 relative group hover:border-nutri-200 transition-colors">
                  <div className="absolute top-0 left-0 w-1 h-full bg-nutri-800 rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-widest mb-2">
                    {questionTitles[parseInt(key)] || `Pergunta ${parseInt(key) + 1}`}
                  </p>
                  <p className="text-sm md:text-base text-stone-700 font-medium leading-relaxed">
                    {value as string}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CONSTRUTOR DE DIETA
          ========================================================================= */}
      {dietModalOpen.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4 md:p-8 animate-fade-in overflow-y-auto">
          <div className="w-full max-w-4xl relative my-auto animate-fade-in-up">
            <button 
              onClick={() => {
                setDietModalOpen({ isOpen: false, id: '', name: '' });
                fetchAdminData();
              }} 
              title="Fechar Construtor de Dieta"
              className="absolute -top-14 right-0 bg-white/10 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-md transition-all active:scale-90 border border-white/20"
            >
              <X size={24} />
            </button>
            
            <DietBuilder 
              patientId={dietModalOpen.id} 
              patientName={dietModalOpen.name} 
              onClose={() => {
                setDietModalOpen({ isOpen: false, id: '', name: '' });
                fetchAdminData();
              }} 
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: INSERÇÃO DE DADOS CLÍNICOS
          ========================================================================= */}
      <ClinicalDataModal 
        isOpen={!!selectedPatient} 
        onClose={() => setSelectedPatient(null)} 
        patientId={selectedPatient?.id || ''} 
        patientName={selectedPatient?.name || ''} 
      />

    </main>
  );
}