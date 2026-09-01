'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  LogOut, Calendar, Link2, Copy, Check, ExternalLink, Settings, Save, 
  Loader2, X, ChevronRight, Filter, Search, Users, Target, MessageCircle, 
  UserPlus, Star, FileText, AlertCircle, Utensils,
  Moon, Sun, AlertTriangle, Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, ui, SkeletonCard } from '@/ui/system';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useAdminDashboard } from '@/app/admin/useAdminDashboard';
import { usePatientScore } from './hooks/usePatientScore';
import { useAutoActions } from './hooks/useAutoActions';
import { useRetentionMetrics } from './hooks/useRetentionMetrics';
import { StatsBar } from './components/StatsBar';
import { PatientGrid } from './components/PatientGrid';
import VZ020RecoveryList from '@/components/admin/VZ020RecoveryList';
import VZ020CopilotCard from '@/components/admin/VZ020CopilotCard';
import { getRecoveryV2 } from '@/lib/vz020/recoveryEngine';
import { buildCopilot } from '@/lib/vz020/copilot';
import { buildPreConsult } from '@/lib/vz020/preConsultation';
import ClinicalDataModal from '@/components/ClinicalDataModal';
import DietBuilder from '@/components/DietBuilder';
import ChatAssistant from '@/components/ChatAssistant';
import { Patient, MealFoodItem, MealMacros } from './types';

// Item agregado por dia usado na geração do PDF da dieta
interface PdfMealItem {
  mealName: string;
  time: string;
  description?: string;
  foodItems: MealFoodItem[];
  kcal?: number;
  macros: MealMacros;
}

// =========================================================================
// CONSTANTES (restauradas)
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

// =========================================================================
// FUNÇÕES AUXILIARES
// =========================================================================

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

// Função para gerar PDF (implementação completa restaurada)
const generatePatientPDF = async (patient: Patient) => {
  if (!patient.meal_plan || patient.meal_plan.length === 0) {
    toast.warning('A dieta deste paciente está vazia.');
    return;
  }

  const toastId = toast.loading('Gerando PDF...');
  try {
    const mealPlanJSON = patient.meal_plan;
    const doc = new (await import('jspdf')).jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    const totalKcal = mealPlanJSON.reduce((acc: number, meal) => acc + (meal.options[0]?.kcal || 0), 0);
    const totalProtein = mealPlanJSON.reduce((acc: number, meal) => acc + (meal.options[0]?.macros?.p || 0), 0);
    const totalCarbs = mealPlanJSON.reduce((acc: number, meal) => acc + (meal.options[0]?.macros?.c || 0), 0);
    const totalFat = mealPlanJSON.reduce((acc: number, meal) => acc + (meal.options[0]?.macros?.g || 0), 0);

    const daysMap = new Map<string, PdfMealItem[]>();
    mealPlanJSON.forEach((meal) => {
      meal.options.forEach((opt) => {
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
    } catch {}

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

    const formatFoodList = (foodItems: MealFoodItem[]) => {
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

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================

export default function AdminDashboardPage() {
  const { state, actions } = useAdminDashboard();
  const { isDark, toggleDarkMode } = useDarkMode();
  
  // Estado para controle do modal de avaliação com todas as abas
  const [evalModalActiveTab, setEvalModalActiveTab] = useState<'avaliacao' | 'qfa' | 'perfil'>('avaliacao');
  
  // =========================================================================
  // 1. SCORE INTELIGENTE DOS PACIENTES
  // (calculado sobre TODOS os pacientes: auto-ações e críticos são globais)
  // =========================================================================
  const { 
    patientsWithScore, 
    criticalCount: scoreCriticalCount 
  } = usePatientScore(state.patients, state.usageStats);
  
  // =========================================================================
  // 2. MÉTRICAS DE RETENÇÃO (baseadas em days_since_last da VIEW)
  // =========================================================================
  const { 
    active: activeCount7d,
    atRisk: atRiskCount,
    inactive: inactiveCount,
    retentionRate,
    churnRisk
  } = useRetentionMetrics(state.patients);
  
  // =========================================================================
  // 3. AÇÕES AUTOMÁTICAS (SISTEMA PROATIVO)
  // =========================================================================
  const handleAutoReminder = (patientId: string, phone: string) => {
    toast.success(`📱 Lembrete enviado para paciente`, {
      description: `Mensagem automática de acompanhamento enviada via WhatsApp.`,
      duration: 4000,
    });
    console.log(`[AUTO-REMINDER] Enviando para ${patientId} no telefone ${phone}`);
  };
  
  useAutoActions(patientsWithScore, handleAutoReminder);

  const [chargeRefreshTick, setChargeRefreshTick] = useState(0);

  useEffect(() => {
    const handleChargeUpdate = () => setChargeRefreshTick(v => v + 1);
    window.addEventListener('admin-charge-updated', handleChargeUpdate as EventListener);
    window.addEventListener('storage', handleChargeUpdate);

    return () => {
      window.removeEventListener('admin-charge-updated', handleChargeUpdate as EventListener);
      window.removeEventListener('storage', handleChargeUpdate);
    };
  }, []);
  
  // =========================================================================
  // 1b. PACIENTES VISÍVEIS (aplica busca, filtro de status e "só novos")
  // O score é global (auto-ações), mas o grid respeita os filtros da UI.
  // =========================================================================
  const visiblePatients = useMemo(() => {
    const term = state.searchTerm.trim().toLowerCase();
    return patientsWithScore.filter(p => {
      if (term && !(p.full_name || '').toLowerCase().includes(term)) return false;
      if (state.statusFilter === 'plano_liberado' && !(p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0)) return false;
      if (state.statusFilter === 'pendente' && (p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0)) return false;
      if (state.showOnlyNew && !p.is_new) return false;
      return true;
    });
  }, [patientsWithScore, state.searchTerm, state.statusFilter, state.showOnlyNew]);

  const chargedPatientIds = useMemo(() => {
    if (typeof window === 'undefined') return new Set<string>();
    return new Set(
      state.patients
        .filter(patient => {
          try {
            return localStorage.getItem(`admin-charge:${patient.id}`) === '1';
          } catch {
            return false;
          }
        })
        .map(patient => patient.id)
    );
  }, [state.patients, chargeRefreshTick]);

  const priorityPatient = useMemo(() => {
    const eligiblePatients = visiblePatients.filter(patient => !chargedPatientIds.has(patient.id));
    if (eligiblePatients.length === 0) return null;

    return [...eligiblePatients].sort((a, b) => {
      const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const riskA = priorityOrder[a.score.risk] ?? 0;
      const riskB = priorityOrder[b.score.risk] ?? 0;

      if (riskA !== riskB) return riskB - riskA;
      if ((b.score.total ?? 0) !== (a.score.total ?? 0)) return (b.score.total ?? 0) - (a.score.total ?? 0);
      return (b.days_since_last ?? 0) - (a.days_since_last ?? 0);
    })[0] ?? null;
  }, [visiblePatients, chargedPatientIds]);

  // VZ-022 — Recuperação com adesão (last_adesao <=2) — sem score/risk
  const recoveryGroups = useMemo(() => {
    return visiblePatients
      .map((p) => {
        const isCheckinDone = p.days_since_last != null ? p.days_since_last <= 7 : false;
        const hasDailyLogToday = p.water_ml != null || p.mood != null;
        const result = getRecoveryV2({
          isCheckinDoneThisWeek: isCheckinDone,
          hasDailyLogToday,
          lastCheckinAdherence: (p as unknown as { last_adesao?: number | null }).last_adesao ?? null,
          hasReturnedRecently: false,
          totalCheckins: 0,
        });
        return { patient: p, result };
      })
      .filter((g) => g.result.state === 'OK')
      .slice(0, 6);
  }, [visiblePatients]);
  
  // =========================================================================
  // 4. HANDLERS ESPECÍFICOS (EDIT MODAL, ETC)
  // =========================================================================
  const [editFormData, setEditFormData] = useState({
    data_nascimento: '',
    sexo: '',
    tipo_perfil: 'adulto',
    meta_peso: '',
    account_type: 'free',
  });
  
  const handleEditProfile = (patient: Patient) => {
    actions.setEditingId(patient.id);
    setEditFormData({
      data_nascimento: patient.data_nascimento || '',
      sexo: patient.sexo || '',
      tipo_perfil: patient.tipo_perfil || 'adulto',
      meta_peso: patient.meta_peso ? patient.meta_peso.toString() : '',
      account_type: patient.account_type || 'free',
    });
  };
  
  const handleEditFormChange = (field: string, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSaveProfile = async () => {
    if (!state.editingId) return;
    
    const updateData = {
      data_nascimento: editFormData.data_nascimento?.trim() || null,
      sexo: editFormData.sexo?.trim() || null,
      tipo_perfil: editFormData.tipo_perfil,
      account_type: editFormData.account_type,
      meta_peso: editFormData.meta_peso && String(editFormData.meta_peso).trim() !== '' 
        ? parseFloat(String(editFormData.meta_peso)) 
        : null,
    };

    const supabase = createClient();
    const { error } = await supabase.from('profiles').update(updateData).eq('id', state.editingId);
    
    if (!error) {
      actions.setEditingId(null);
      actions.fetchAdminData();
      toast.success('Perfil atualizado com sucesso!');
    } else {
      toast.error('Falha ao atualizar o perfil.');
    }
  };
  
  const handleCancelEdit = () => {
    actions.setEditingId(null);
  };
  
  // Fase A: proteção de saída do modal de dieta (botões externos do wrapper)
  const [dietIsDirty, setDietIsDirty] = useState(false);
  const closeDietModal = () => {
    if (dietIsDirty && !window.confirm('Há alterações não salvas neste cardápio. Deseja realmente sair? As alterações serão perdidas.')) return;
    actions.setDietModalOpen({ ...state.dietModalOpen, isOpen: false });
    actions.fetchAdminData();
    setDietIsDirty(false);
  };
  
  const handleClearFilters = () => {
    actions.setSearchTerm('');
    actions.setStatusFilter('todos');
    actions.setShowOnlyNew(false);
    actions.fetchAdminData();
    toast.success('Filtros limpos', { description: 'Mostrando todos os pacientes' });
  };
  
  const handleCopyCalendlyLink = () => {
    if (!state.calendlyUrl) {
      toast.warning('Nenhum link configurado');
      return;
    }
    navigator.clipboard.writeText(state.calendlyUrl);
    toast.success('Link copiado!', { description: 'Link do Calendly copiado para a área de transferência' });
  };
  
  // =========================================================================
  // 5. RENDERIZAÇÃO CONDICIONAL (LOADING)
  // =========================================================================
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
  
  // =========================================================================
  // 6. MÉTRICAS PARA STATS BAR
  // =========================================================================
  const totalPatients = state.patients.length;
  
  // =========================================================================
  // 7. RENDERIZAÇÃO PRINCIPAL
  // =========================================================================
  return (
    <main className={cn(
      'min-h-screen bg-[#F8F9FA] dark:bg-stone-950 p-3 sm:p-4 md:p-8 lg:p-10 pt-20 lg:pt-28',
      'font-sans text-stone-800 dark:text-stone-200',
      'selection:bg-nutri-200 dark:selection:bg-nutri-800'
    )}>
      {/* ==================== HEADER ==================== */}
      <header className={ui.header}>
        <div className="flex justify-between items-center gap-3">
          <div className="flex-1">
            <h1 className={ui.headerTitle}>Painel Administrativo</h1>
            <p className="hidden md:block text-stone-500 dark:text-stone-400 text-sm mt-1.5 font-medium">
              Gestão inteligente com automação proativa e score de pacientes
            </p>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-xs text-stone-400 dark:text-stone-500">
                Última atualização: {state.lastUpdateTime}
              </p>
              {scoreCriticalCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={10} />
                  {scoreCriticalCount} paciente(s) crítico(s)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="relative flex items-center justify-center h-9 w-9 md:h-11 md:w-11 rounded-xl transition-all duration-300 bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200/60 dark:border-stone-700"
              aria-label="Alternar tema"
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
              aria-label="Filtrar novos pacientes"
            >
              <Bell size={18} className={state.unseenPatientsCount > 0 ? 'animate-pulse text-nutri-600 dark:text-nutri-400' : ''} />
              {state.unseenPatientsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border-2 border-white dark:border-stone-900 shadow-sm">
                  {state.unseenPatientsCount}
                </span>
              )}
            </button>
            
            {/* Logout Button */}
            <button
              onClick={actions.handleLogout}
              className="flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/30 w-9 h-9 md:w-auto md:px-5 md:h-11 rounded-xl font-semibold text-sm hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-300 transition-all active:scale-[0.98]"
              aria-label="Sair do sistema"
            >
              <LogOut size={16} /> <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>

      </header>

      {/* ==================== STATS BAR ==================== */}
      <div className="mb-6 md:mb-8">
        <StatsBar
          totalPatients={totalPatients}
          todayTotalMessages={state.todayTotalMessages}
          activeCount={activeCount7d}
          criticalCount={scoreCriticalCount}
          retentionRate={retentionRate}
          churnRisk={churnRisk}
          atRiskCount={atRiskCount}
          inactiveCount={inactiveCount}
          focusPatient={priorityPatient ? {
            id: priorityPatient.id,
            name: priorityPatient.full_name,
            phone: priorityPatient.phone,
            risk: priorityPatient.score.risk,
            suggestedAction: priorityPatient.score.suggestedAction,
            daysSinceLast: priorityPatient.days_since_last,
            totalScore: priorityPatient.score.total,
          } : null}
        />
      </div>

      {/* VZ-020 — Recuperação: abaixo StatsBar, acima PatientGrid */}
      {recoveryGroups.length > 0 && (
        <div className="mb-6 md:mb-8">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-3">Pacientes para acompanhar</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {recoveryGroups.map(({ patient, result }) => (
              <VZ020RecoveryList
                key={patient.id}
                patientName={patient.full_name}
                result={result}
                onAction={(type) => {
                  if (type === 'checkin' && patient.phone) handleAutoReminder(patient.id, patient.phone);
                  else toast(`Abrir ${patient.full_name} — ${type}`);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ==================== TABS ==================== */}
      <div className="flex gap-1.5 md:gap-2 overflow-x-auto scrollbar-hide p-1 md:p-1.5 bg-white dark:bg-stone-900 rounded-xl md:rounded-2xl mb-6 md:mb-8 w-max max-w-full shadow-[0_2px_8px_-3px_rgba(0,0,0,0.03)] dark:shadow-stone-900/50 border border-stone-100/80 dark:border-stone-800/80">
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
            {tab === 'pacientes' ? 'Pacientes' : tab === 'leads' ? 'Leads' : tab === 'agenda' ? 'Agenda' : 'Configurações'}
            {tab === 'pacientes' && (
              <span className="ml-1 text-[10px] opacity-80">({totalPatients})</span>
            )}
            {tab === 'leads' && state.activeLeadsCount > 0 && (
              <span className={cn(
                'ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                state.activeTab === 'leads' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
              )}>
                {state.activeLeadsCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ==================== CONTEÚDO PRINCIPAL ==================== */}
      <motion.div
        animate={{ opacity: state.isFiltering ? 0.7 : 1, scale: state.isFiltering ? 0.99 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* TELA DE PACIENTES COM SCORE INTELIGENTE */}
        {state.activeTab === 'pacientes' && (
          <div className="space-y-4 md:space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 p-3 md:p-4 shadow-sm backdrop-blur-sm">
              <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-400 dark:text-stone-500">
                    Triagem dos pacientes
                  </p>
                  <p className="text-sm md:text-base font-semibold text-stone-700 dark:text-stone-300">
                    {visiblePatients.length} paciente(s) visível(is) com os filtros atuais
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="self-start md:self-auto inline-flex items-center gap-2 rounded-full border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-700 transition-colors"
                >
                  Limpar filtros
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div className="relative group">
                  <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 group-focus-within:text-nutri-700 dark:group-focus-within:text-nutri-400 transition-colors" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por nome..."
                    className={cn(ui.input, 'pl-9 md:pl-12 pr-3 md:pr-4 h-10 md:h-11 text-sm')}
                    onChange={e => actions.setSearchTerm(e.target.value)}
                    value={state.searchTerm}
                  />
                </div>

                <div className="relative group">
                  <Filter className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 group-focus-within:text-nutri-700 dark:group-focus-within:text-nutri-400 transition-colors pointer-events-none" size={16} />
                  <select
                    className="w-full min-w-[180px] px-3 md:pl-11 md:pr-10 h-10 md:h-11 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 hover:bg-white dark:hover:bg-stone-800 focus:bg-white dark:focus:bg-stone-800 outline-none focus:border-nutri-400 dark:focus:border-nutri-500 focus:ring-4 focus:ring-nutri-50 dark:focus:ring-nutri-950/30 transition-all font-medium text-xs md:text-sm text-stone-700 dark:text-stone-200 appearance-none cursor-pointer shadow-sm"
                    onChange={e => actions.setStatusFilter(e.target.value)}
                    value={state.statusFilter}
                  >
                    <option value="todos">Todos os status</option>
                    <option value="pendente">Pendente (sem dieta)</option>
                    <option value="plano_liberado">Plano liberado</option>
                  </select>
                  <ChevronRight className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 rotate-90 pointer-events-none" size={14} />
                </div>

              </div>
            </div>

            <PatientGrid
              patients={visiblePatients}
              usageStats={state.usageStats}
              editingId={state.editingId}
              editFormData={editFormData}
              onOpenDietBuilder={actions.handleOpenDietBuilder}
              onOpenEvalModal={actions.handleOpenEvalModal}
              onOpenClinicalModal={(p) => actions.setSelectedPatient({ id: p.id, name: p.full_name })}
              onEditProfile={handleEditProfile}
              onDeleteDiet={actions.handleDeleteDiet}
              onGeneratePDF={generatePatientPDF}
              onClearFilters={handleClearFilters}
              onAutoReminder={handleAutoReminder}
              onEditFormChange={handleEditFormChange}
              onSaveProfile={handleSaveProfile}
              onCancelEdit={handleCancelEdit}
            />
          </div>
        )}

        {/* TELA DE LEADS */}
        {state.activeTab === 'leads' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {state.filteredLeads.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-10 md:p-14 rounded-2xl md:rounded-3xl border border-dashed border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-center">
                <UserPlus size={40} className="text-stone-300 dark:text-stone-600 mb-3" />
                <h3 className="text-base md:text-lg font-bold text-stone-800 dark:text-stone-200 mb-1 tracking-tight">Nenhuma oportunidade no momento</h3>
                <p className="text-xs md:text-sm text-stone-500 dark:text-stone-400 font-medium">Novos leads aparecerão aqui quando preencherem a avaliação.</p>
              </div>
            ) : (
              state.filteredLeads.map(lead => (
                <div key={lead.id} className={cn(ui.card, ui.cardInteractive, 'border-stone-100 dark:border-stone-800')}>
                  <div className={ui.glowOverlay} />
                  <div className="p-3 md:p-4 flex flex-col h-full">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-black text-sm md:text-base tracking-tight text-stone-900 dark:text-white flex items-center gap-1.5">
                          <UserPlus size={14} className="text-amber-500" /> {lead.nome}
                        </h3>
                        <span className={cn(ui.badge, lead.status === 'concluido' ? ui.badgeSuccess : ui.badgeNeutral)}>
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
                </div>
              ))
            )}
          </div>
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
                  onClick={handleCopyCalendlyLink}
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

        {/* TELA DE FINANCEIRO / CONFIGURAÇÕES */}
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

      {/* ==================== MODAL DE AVALIAÇÃO (COMPLETO COM QFA, PERFIL) ==================== */}
      {state.evalModalOpen.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl flex flex-col max-h-[85vh] sm:max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            <div className="border-b border-stone-100 dark:border-stone-800 shrink-0">
              <div className="flex justify-between items-center p-4 md:p-5 pb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base md:text-lg text-stone-900 dark:text-white tracking-tight">Prontuário do Paciente</h3>
                  <p className="text-xs md:text-sm font-semibold text-stone-500 dark:text-stone-400 mt-0.5 truncate">{state.evalModalOpen.name}</p>
                </div>
                <button
                  onClick={() => actions.setEvalModalOpen({ isOpen: false, data: null, name: '', qfaData: null, foodRestrictions: [], patientId: null })}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors shrink-0"
                  aria-label="Fechar prontuário"
                >
                  <X size={18} />
                </button>
              </div>
              {/* VZ-022 — Copiloto camada superior de contexto (não substitui abas) */}
              <div className="px-4 md:px-5 pb-4 bg-stone-50/60 dark:bg-stone-800/20 border-y border-stone-100 dark:border-stone-800">
                {(() => {
                  const patient = state.patients.find((p) => p.id === state.evalModalOpen.patientId);
                  if (!patient) return <p className="text-xs text-stone-400 py-2">Selecione um paciente para ver o contexto.</p>;
                  const copilot = buildCopilot({
                    profile: {
                      full_name: patient.full_name,
                      created_at: patient.created_at,
                      account_type: (patient as unknown as { account_type?: string | null }).account_type ?? null,
                      has_meal_plan_access: null,
                    },
                    lastCheckin: patient.days_since_last != null
                      ? {
                          created_at:
                            (patient as unknown as { last_checkin_at?: string | null }).last_checkin_at ??
                            // eslint-disable-next-line react-hooks/purity
                            new Date(Date.now() - (patient.days_since_last ?? 0) * 86400000).toISOString(),
                          peso: patient.peso != null ? String(patient.peso) : patient.weight != null ? String(patient.weight) : null,
                          altura: patient.altura != null ? String(patient.altura) : patient.height != null ? String(patient.height) : null,
                          adesao_ao_plano: (patient as unknown as { last_adesao?: number | null }).last_adesao ?? null,
                          humor_semanal: (patient as unknown as { last_humor?: number | null }).last_humor ?? null,
                          comentarios: (patient as unknown as { last_comentarios?: string | null }).last_comentarios ?? null,
                        }
                      : null,
                    previousCheckin: null,
                    dailyLogToday:
                      patient.water_ml != null || patient.mood
                        ? { water_ml: patient.water_ml ?? null, meals_checked: null, mood: patient.mood ?? null, activity_kcal: null }
                        : null,
                    checkinsCount: patient.days_since_last != null ? 1 : 0,
                    dailyLogsCount7d: 0,
                    isCheckinDoneThisWeek: patient.days_since_last != null ? patient.days_since_last <= 7 : false,
                  });
                  const preConsult = buildPreConsult({
                    lastCheckin: {
                        created_at:
                          (patient as unknown as { last_checkin_at?: string | null }).last_checkin_at ??
                          // eslint-disable-next-line react-hooks/purity
                          (patient.days_since_last != null ? new Date(Date.now() - patient.days_since_last * 86400000).toISOString() : null),
                        peso: patient.peso != null ? String(patient.peso) : null,
                        cintura: null,
                        adesao_ao_plano: (patient as unknown as { last_adesao?: number | null }).last_adesao ?? null,
                        humor_semanal: (patient as unknown as { last_humor?: number | null }).last_humor ?? null,
                      },
                    previousCheckin: null,
                    dailyLogToday: { water_ml: patient.water_ml ?? null, meals_checked: null, mood: patient.mood ?? null },
                    isCheckinDoneThisWeek: patient.days_since_last != null ? patient.days_since_last <= 7 : false,
                  });
                  return <VZ020CopilotCard copilot={copilot} preConsult={preConsult} />;
                })()}
              </div>
              <div className="flex gap-1 px-4 md:px-5 mt-0 pt-3 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Seções do prontuário">
                <button
                  role="tab"
                  id="tab-avaliacao"
                  aria-selected={evalModalActiveTab === 'avaliacao'}
                  aria-controls="panel-avaliacao"
                  onClick={() => setEvalModalActiveTab('avaliacao')}
                  className={cn(
                    'min-h-[44px] px-3 py-2 text-xs md:text-sm font-bold rounded-t-xl transition-all whitespace-nowrap shrink-0',
                    evalModalActiveTab === 'avaliacao'
                      ? 'bg-nutri-50 dark:bg-nutri-950/50 text-nutri-700 dark:text-nutri-400 border-b-2 border-nutri-500 dark:border-nutri-600'
                      : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                  )}
                >
                  📋 Avaliação
                </button>
                <button
                  role="tab"
                  id="tab-qfa"
                  aria-selected={evalModalActiveTab === 'qfa'}
                  aria-controls="panel-qfa"
                  onClick={() => setEvalModalActiveTab('qfa')}
                  className={cn(
                    'min-h-[44px] px-3 py-2 text-xs md:text-sm font-bold rounded-t-xl transition-all whitespace-nowrap shrink-0',
                    evalModalActiveTab === 'qfa'
                      ? 'bg-nutri-50 dark:bg-nutri-950/50 text-nutri-700 dark:text-nutri-400 border-b-2 border-nutri-500 dark:border-nutri-600'
                      : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                  )}
                >
                  🍽️ QFA
                </button>
                <button
                  role="tab"
                  id="tab-perfil"
                  aria-selected={evalModalActiveTab === 'perfil'}
                  aria-controls="panel-perfil"
                  onClick={() => setEvalModalActiveTab('perfil')}
                  className={cn(
                    'min-h-[44px] px-3 py-2 text-xs md:text-sm font-bold rounded-t-xl transition-all whitespace-nowrap shrink-0',
                    evalModalActiveTab === 'perfil'
                      ? 'bg-nutri-50 dark:bg-nutri-950/50 text-nutri-700 dark:text-nutri-400 border-b-2 border-nutri-500 dark:border-nutri-600'
                      : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                  )}
                >
                  ⚠️ Perfil
                </button>
              </div>
            </div>
            <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1 overscroll-contain">
              {/* Aba Avaliação */}
              {evalModalActiveTab === 'avaliacao' && (
                <div id="panel-avaliacao" role="tabpanel" aria-labelledby="tab-avaliacao" className="space-y-2 md:space-y-3 animate-in fade-in duration-200">
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

              {/* Aba QFA */}
              {evalModalActiveTab === 'qfa' && (
                <div id="panel-qfa" role="tabpanel" aria-labelledby="tab-qfa" className="space-y-2 md:space-y-3 animate-in fade-in duration-200">
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

              {/* Aba Perfil (Restrições Alimentares) */}
              {evalModalActiveTab === 'perfil' && (
                <div id="panel-perfil" role="tabpanel" aria-labelledby="tab-perfil" className="space-y-3 md:space-y-4 animate-in fade-in duration-200">
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
              <div className="pt-4 mt-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => actions.setEvalModalOpen({ isOpen: false, data: null, name: '', qfaData: null, foodRestrictions: [], patientId: null })}
                  className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-sm font-black hover:opacity-90 transition-opacity"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
       )}

      {/* ==================== MODAL DE DIETA ==================== */}
      {state.dietModalOpen.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-0 md:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-5xl relative my-auto h-full md:h-auto flex flex-col animate-in zoom-in-95 duration-300">
            <div className="hidden md:flex justify-end mb-3">
              <button
                onClick={closeDietModal}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-md transition-all"
                aria-label="Fechar montador de dieta"
              >
                <X size={20} />
              </button>
            </div>
            <div className="bg-white dark:bg-stone-900 md:rounded-2xl shadow-2xl flex-1 overflow-hidden h-full md:h-auto border border-white/20 dark:border-stone-800/20 flex flex-col">
              <div className="md:hidden flex justify-between items-center p-3 border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 shrink-0">
                <span className="font-bold text-sm text-stone-800 dark:text-stone-200">Montar Dieta</span>
                <button
                  onClick={closeDietModal}
                  className="p-1.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-full"
                  aria-label="Fechar montador de dieta"
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
                    setDietIsDirty(false);
                  }}
                  targetRecommendation={state.dietModalOpen.targetRecommendation}
                  foodRestrictions={state.dietModalOpen.foodRestrictions}
                  onDirtyChange={setDietIsDirty}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL CLÍNICO ==================== */}
      <ClinicalDataModal
        isOpen={!!state.selectedPatient}
        onClose={() => actions.setSelectedPatient(null)}
        patientId={state.selectedPatient?.id || ''}
        patientName={state.selectedPatient?.name || ''}
      />

      {/* ==================== CHAT ASSISTANT ==================== */}
      <ChatAssistant role="admin" adminContext={state.adminContext} />
    </main>
  );
}

// Import necessário para o createClient no handleSaveProfile
import { createClient } from '@/lib/supabase/client';
