'use client';

import React, { useEffect, useLayoutEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, ChevronLeft, TrendingUp, User, Ruler, Layers, 
  Syringe, CalendarCheck, BookOpen, Trash2, AlertCircle, 
  CheckCircle2, AlertTriangle, Activity, Target, Clock, Zap, 
  ChevronRight, Scale, Droplets, Smile, Frown, Meh, 
  Coffee, Check, Brain, Flame, MessageCircle, ClipboardList, 
  Stethoscope, ListChecks, Save, Plus
} from 'lucide-react';
import Link from 'next/link';
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Scatter 
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/ui/system';

import MetabolicSummary from '@/components/admin/MetabolicSummary';
import CopilotTab from './components/CopilotTab';
import CheckinsSection from '@/components/admin/historico/CheckinsSection';
import MedidasSection from '@/components/admin/historico/MedidasSection';
import { ExamStatusWithTooltip } from '@/components/admin/historico/ExamTooltip';
import DobrasSection from '@/components/admin/historico/DobrasSection';
import ClinicalDataModalStepped from '@/components/ClinicalDataModalStepped';
import ClinicalDataModal from '@/components/ClinicalDataModal';
// Motor central de composição corporal (DO-000.0) — fonte única JP7
import { calculateBodyComposition, calculateAge as calculateAgeMotor, normalizeSex, PROTOCOLS } from '@/lib/nutrition/bodyComposition';
import type { ProtocolId } from '@/lib/nutrition/bodyComposition';
import { formatCivilDate, formatCivilDateLong, formatCivilDateShort, todayCivilSP, addDaysCivil } from '@/lib/civilDate';
// 🔥 Sprint Z-001: histórico delega o cálculo metabólico ao modelo único (SSOT)
import { buildMetabolicSnapshot, calculateWeightTrend, calculateWeightVelocity } from '@/lib/metabolicModel';
// Validador de QFA (perfil alimentar) — mantido aqui
import { validateQFAConsistency } from '@/lib/nutrition';
import { DiarioDayCard } from '@/components/admin/diario/DiarioDayCard';
import { compareDiaryDays, deriveWaterGoal, getHydrationStatus, getMealStatus, getActivityStatus, getMoodStatus, getDayStatus } from '@/lib/diario/diarioRules';
// NOVO: Tipos para o perfil alimentar
import type { FoodRestriction } from '@/types/patient';

// =========================================================================
// INTERFACES E TIPAGENS
// =========================================================================
interface PatientProfile {
  id: string;
  full_name: string;
  phone?: string;
  data_nascimento?: string;
  sexo?: string;
  tipo_perfil?: string;
  meta_peso?: number | null;
  altura?: number | null;
  food_restrictions?: FoodRestriction[];
  meal_plan?: { name: string }[] | null;
}

// Exportado como fonte de verdade única do tipo (consumido por CheckinsSection).
export interface CheckinData {
  id: string;
  created_at: string;
  peso: number;
  altura: number;
  imc: number;
  adesao_ao_plano: number;
  humor_semanal: number;
  comentarios: string;
}

// Exportado como fonte de verdade única do tipo (consumido por MedidasSection) — 11 campos (abdominal entre waist e hip).
export interface AntroData {
  id: string;
  measurement_date: string;
  weight?: string | number;
  height?: string | number;
  waist?: string | number;
  abdominal?: string | number;
  hip?: string | number;
  arm?: string | number;
  forearm?: string | number;
  thigh?: string | number;
  calf?: string | number;
  neck?: string | number;
  chest?: string | number;
}

// Exportado como fonte de verdade única do tipo (consumido por DobrasSection).
export interface SkinfoldsData {
  id: string;
  measurement_date: string;
  triceps?: string | number;
  biceps?: string | number;
  subscapular?: string | number;
  axillary_media?: string | number; // 🔥 CORREÇÃO: Adicionado para o TS não quebrar
  pectoral?: string | number;       // 🔥 CORREÇÃO: Adicionado para o TS não quebrar
  suprailiac?: string | number;
  abdominal?: string | number;
  thigh?: string | number;
  calf?: string | number;
  protocol?: string | null; // F3.1 — protocolo oficial por medição (jp3/jp7/petroski4), NULL = histórico pré-F3.1
}

interface BioData {
  id: string;
  exam_date: string;
  glucose?: string | number | null;
  insulin?: string | number | null;
  hba1c?: string | number | null;
  total_cholesterol?: string | number | null;
  hdl?: string | number | null;
  ldl?: string | number | null;
  triglycerides?: string | number | null;
  ferritin?: string | number | null;
  pcr?: string | number | null;
  tgp?: string | number | null;
  creatinine?: string | number | null;
  urea?: string | number | null;
  vitamin_d?: string | number | null;
  vitamin_b12?: string | number | null;
  tsh?: string | number | null;
  iron?: string | number | null;
  [key: string]: string | number | null | undefined;
}

interface DailyLog {
  id: string;
  date: string;
  water_ml: number;
  mood: string;
  meals_checked: string[];
  activity_kcal?: number;
  activities?: unknown[];
}

interface ClinicalNote {
  id: string;
  created_at: string;
  content: string;
}

interface Alert {
  id: string;
  type: 'success' | 'warning' | 'danger';
  text: string;
  icon: React.ReactNode;
  waLink?: string;
  waText?: string;
}

  type ClinicalTab = 'prontuario' | 'diario' | 'checkins' | 'antropometria' | 'dobras' | 'bioquimicos' | 'copiloto';

export default function PacienteHistoricoAdmin() {
  // =========================================================================
  // ESTADOS
  // =========================================================================
  const [history, setHistory] = useState<CheckinData[]>([]); 
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [antroData, setAntroData] = useState<AntroData[]>([]);
  const [skinfoldsData, setSkinfoldsData] = useState<SkinfoldsData[]>([]);
  const [bioData, setBioData] = useState<BioData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [bodyCompsData, setBodyCompsData] = useState<any[]>([]); // F3.6 — body_compositions oficial
  
  // NOVO: Estados para o perfil alimentar e QFA
  const [foodRestrictions, setFoodRestrictions] = useState<FoodRestriction[]>([]);
  const [qfaResponses, setQfaResponses] = useState<Record<string, string>>({});

  const [soapNote, setSoapNote] = useState({ s: '', o: '', a: '', p: '' });
  const [savingNote, setSavingNote] = useState(false);

  const [activeTab, setActiveTab] = useState<ClinicalTab>('copiloto');
  const [activeLens, setActiveLens] = useState<'medidas' | 'composicao' | 'metabolico'>('medidas');
  
  const [isRadarExpanded, setIsRadarExpanded] = useState(false);
  const [isSteppedOpen, setIsSteppedOpen] = useState(false);
  const [clinicalMode, setClinicalMode] = useState<'anthropometry' | 'skinfolds' | 'biochemicals' | 'full'>('full');
  const [dobrasProtocol, setDobrasProtocol] = useState<ProtocolId | null>(null);
  const [diarioDate, setDiarioDate] = useState<string>(() => todayCivilSP());
  const [diarioSaving, setDiarioSaving] = useState(false);
  const [isProtocolPickerOpen, setIsProtocolPickerOpen] = useState(false);
  const [contactedAlerts, setContactedAlerts] = useState<Set<string>>(new Set());

  const router = useRouter();
  const params = useParams();
  const pacienteId = params.id as string;
  const supabase = createClient();

  // =========================================================================
  // BUSCA DE DADOS
  // =========================================================================
  // MODIFICADO: Função de busca de dados
  async function fetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Role vem do Supabase (profiles), nunca hardcoded por email
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'nutricionista')) {
        router.push('/dashboard');
        return;
      }

      // Busca o perfil incluindo as restrições
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*, food_restrictions') // Garantindo que a coluna venha
        .eq('id', pacienteId)
        .single();
      if (profileErr) throw profileErr;

      // Busca das outras tabelas em paralelo para otimização
      const [
        checkinRes,
        antroRes,
        skinRes,
        bioRes,
        notesRes,
        dailyRes,
        qfaRes, // NOVO: Busca do QFA
        bodyCompsRes // F3.6 — body_compositions oficial
      ] = await Promise.all([
        supabase.from('checkins').select('*').eq('user_id', pacienteId).order('created_at', { ascending: true }),
        supabase.from('anthropometry').select('*').eq('user_id', pacienteId).order('measurement_date', { ascending: false }),
        supabase.from('skinfolds').select('*').eq('user_id', pacienteId).order('measurement_date', { ascending: false }),
        supabase.from('biochemicals').select('*').eq('user_id', pacienteId).order('exam_date', { ascending: false }),
        supabase.from('clinical_notes').select('*').eq('user_id', pacienteId).order('created_at', { ascending: false }),
        supabase.from('daily_logs').select('*').eq('user_id', pacienteId).order('date', { ascending: false }),
        supabase.from('qfa_responses').select('answers').eq('user_id', pacienteId).single(), // NOVO
        supabase.from('body_compositions').select('*').eq('user_id', pacienteId).eq('is_official', true) // F3.6
      ]);
      
      // =======================================================================
      // Sprint Fase 1.1 (REGRA DEFINITIVA) — ALTURA DE REFERÊNCIA PARA O IMC
      // Para adultos a altura é medida de referência e não precisa ser
      // redigitada em cada check-in.
      // A referência é a altura VÁLIDA MAIS RECENTE do histórico COMPLETO,
      // portanto a altura registrada em um check-in POSTERIOR pode ser usada
      // para calcular o IMC de registros ANTERIORES (retropropagação).
      // `history` já chega em ordem CRONOLÓGICA CRESCENTE
      // (order('created_at', { ascending: true })), então a mais recente é
      // simplesmente a ÚLTIMA altura válida encontrada na varredura.
      // `item.altura` permanece exatamente como foi registrada: a altura
      // efetiva é apenas referência interna de cálculo. Nada é gravado no banco.
      // =======================================================================
      const checkinRows = checkinRes.data || [];

      // 1) Altura de referência do histórico completo (a mais recente válida).
      let referenceHeight: number | null = null;
      for (const row of checkinRows) {
        const height = Number(row.altura);
        if (Number.isFinite(height) && height > 0) referenceHeight = height;
      }

      // 2) IMC de cada registro: altura própria quando houver, senão referência.
      const processedHistory = checkinRows.map(item => {
        const ownHeight = Number(item.altura);
        const hasOwnHeight = Number.isFinite(ownHeight) && ownHeight > 0;
        const effectiveHeight = hasOwnHeight ? ownHeight : referenceHeight;

        // Sem NENHUMA altura válida no histórico: IMC permanece indisponível.
        const imc = effectiveHeight
          ? (item.peso / (effectiveHeight * effectiveHeight))
          : 0;

        return { ...item, imc };
      }) as CheckinData[];

      setProfile(profileData as PatientProfile);
      setHistory(processedHistory);
      setAntroData(antroRes.data || []);
      setSkinfoldsData(skinRes.data || []);
      setBioData(bioRes.data || []);
      setNotes(notesRes.data || []);
      setDailyLogs(dailyRes.data || []);
      setBodyCompsData((bodyCompsRes as any)?.data || []);
      
      // NOVO: Seta os novos estados
      setFoodRestrictions(profileData.food_restrictions || []);
      setQfaResponses(qfaRes.data?.answers || {});

    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      toast.error("Ocorreu um erro ao carregar os dados clínicos deste paciente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    if (pacienteId) fetchData(); 
  }, [supabase, router, pacienteId]);

  // UX-REF-006: garantir topo após F5 — sem timeout, sem scrollIntoView
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    // Evitar salto visível durante hidratação
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    let prev: ScrollRestoration | undefined
    try {
      if ('scrollRestoration' in window.history) {
        prev = window.history.scrollRestoration as ScrollRestoration
        window.history.scrollRestoration = 'manual'
      }
    } catch {}
    // Correção no elemento real de scroll (window) e containers internos se existirem
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      // Se houver container interno com overflow-y-auto (admin layout), zerar também
      const containers = document.querySelectorAll<HTMLElement>('[data-scroll-container], main, [class*="overflow-y-auto"]')
      containers.forEach((el) => {
        if (el.scrollHeight > el.clientHeight) {
          try { el.scrollTop = 0 } catch {}
        }
      })
    }
    scrollToTop()
    // Reaplicar após carregamento dos dados (sem timeout artificial, apenas no próximo frame)
    const raf = requestAnimationFrame(scrollToTop)
    return () => {
      cancelAnimationFrame(raf)
      try {
        if (prev && 'scrollRestoration' in window.history) {
          window.history.scrollRestoration = prev
        }
      } catch {}
    }
  }, [])

  // =========================================================================
  // AÇÕES
  // =========================================================================
  const handleSaveNote = async () => {
    if (!soapNote.s && !soapNote.o && !soapNote.a && !soapNote.p) return;
    setSavingNote(true);
    
    const formattedContent = `**Subjetivo (S):**\n${soapNote.s || '---'}\n\n**Objetivo (O):**\n${soapNote.o || '---'}\n\n**Avaliação (A):**\n${soapNote.a || '---'}\n\n**Plano (P):**\n${soapNote.p || '---'}`;
    
    const { error } = await supabase.from('clinical_notes').insert([{ user_id: pacienteId, content: formattedContent }]);
    if (!error) {
      setSoapNote({ s: '', o: '', a: '', p: '' });
      fetchData();
      toast.success("Prontuário (S.O.A.P) salvo com sucesso!");
    } else {
      toast.error("Erro ao salvar o prontuário. Tente novamente.");
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir permanentemente esta anotação do prontuário?")) return;
    
    const { error } = await supabase.from('clinical_notes').delete().eq('id', id);
    if (!error) {
      fetchData();
      toast.success("Anotação excluída com sucesso.");
    } else {
      toast.error("Erro ao excluir a anotação.");
    }
  };

  const handleContactAlert = (alertId: string) => {
    setContactedAlerts(prev => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  };

  // =========================================================================
  // FUNÇÕES DE CÁLCULO E INTERPRETAÇÃO (fora composição — motor já é central)
  // =========================================================================
  const calculateAge = (dob: string | null | undefined): number | null => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const interpretBiochemical = (type: string, value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return { status: 'neutral', text: 'Sem dados', color: 'text-stone-400', bg: 'bg-stone-50/50', border: 'border-stone-100', icon: null };
    }

    let status = 'normal';
    let text = 'Ideal';

    switch (type) {
      case 'glucose': 
        if (value >= 126) { status = 'danger'; text = 'Risco de Diabetes (>125)'; }
        else if (value >= 100) { status = 'warning'; text = 'Glicemia de Jejum Alterada'; }
        break;
      case 'insulin': 
        if (value >= 15) { status = 'warning'; text = 'Resistência à Insulina alta'; }
        else if (value > 25) { status = 'danger'; text = 'Hiperinsulinemia severa'; }
        break;
      case 'hba1c': 
        if (value >= 6.5) { status = 'danger'; text = 'Diabetes Clínico (>=6.5%)'; }
        else if (value >= 5.7) { status = 'warning'; text = 'Pré-diabetes (5.7-6.4%)'; }
        break;
      case 'homair': 
        if (value >= 2.5) { status = 'danger'; text = 'Resistência Severa (>2.5)'; }
        else if (value >= 2.0) { status = 'warning'; text = 'Resistência Moderada'; }
        break;
      case 'ldl': 
        if (value >= 160) { status = 'danger'; text = 'Risco Cardiovascular Alto'; }
        else if (value >= 130) { status = 'warning'; text = 'Acima do recomendado'; }
        break;
      case 'hdl': 
        if (value < 40) { status = 'danger'; text = 'Colesterol Bom Baixo'; }
        else if (value < 50) { status = 'warning'; text = 'Atenção para HDL'; }
        break;
      case 'triglycerides': 
        if (value >= 200) { status = 'danger'; text = 'Risco Cardiovascular/Metabólico'; }
        else if (value >= 150) { status = 'warning'; text = 'Atenção dietética necessária'; }
        break;
      case 'vitamin_d': 
        if (value < 20) { status = 'danger'; text = 'Deficiência Severa (<20)'; }
        else if (value < 30) { status = 'warning'; text = 'Insuficiência (20-29)'; }
        break;
      case 'vitamin_b12': 
        if (value < 200) { status = 'danger'; text = 'Deficiência (Risco Neurológico)'; }
        else if (value < 300) { status = 'warning'; text = 'Abaixo do ideal para cognição'; }
        break;
      case 'ferritin': 
        if (value > 300) { status = 'danger'; text = 'Excesso de Ferro / Inflamação (>300)'; }
        else if (value < 30) { status = 'warning'; text = 'Risco de Anemia (<30)'; }
        break;
      case 'pcr': 
        if (value > 3) { status = 'danger'; text = 'Inflamação Sistêmica Alta'; }
        else if (value > 1) { status = 'warning'; text = 'Inflamação Moderada'; }
        break;
      case 'urea': 
        if (value > 50) { status = 'warning'; text = 'Atenção Função Renal / Hidratação'; }
        break;
      case 'tsh': 
        if (value > 4.5) { status = 'warning'; text = 'Hipotireoidismo (Tendência)'; }
        else if (value < 0.4) { status = 'warning'; text = 'Hipertireoidismo (Tendência)'; }
        break;
      case 'iron': 
        if (value < 50) { status = 'danger'; text = 'Ferro Baixo / Risco Anemia'; }
        else if (value > 170) { status = 'warning'; text = 'Ferro Sérico Elevado'; }
        break;
      default:
        break;
    }

    const configs = {
      normal: { color: 'text-emerald-700', bg: 'bg-emerald-50/80', border: 'border-emerald-200/60', icon: <CheckCircle2 size={16} className="text-emerald-500" /> },
      warning: { color: 'text-amber-700', bg: 'bg-amber-50/80', border: 'border-amber-200/60', icon: <AlertTriangle size={16} className="text-amber-500" /> },
      danger: { color: 'text-rose-700', bg: 'bg-rose-50/80', border: 'border-rose-200/60', icon: <AlertCircle size={16} className="text-rose-500" /> },
      neutral: { color: 'text-stone-500', bg: 'bg-stone-50/50', border: 'border-stone-100', icon: null }
    };

    return { ...configs[status as keyof typeof configs], text, status };
  };

  const getMoodIcon = (mood: string) => {
    if (mood === 'feliz') return <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-full shadow-sm"><Smile size={20} strokeWidth={2.5} /></div>;
    if (mood === 'neutro') return <div className="bg-amber-100 text-amber-600 p-2.5 rounded-full shadow-sm"><Meh size={20} strokeWidth={2.5} /></div>;
    if (mood === 'dificil') return <div className="bg-rose-100 text-rose-600 p-2.5 rounded-full shadow-sm"><Frown size={20} strokeWidth={2.5} /></div>;
    return <div className="bg-stone-100 text-stone-400 p-2.5 rounded-full shadow-sm"><Meh size={20} strokeWidth={2.5} /></div>;
  };

  // =========================================================================
  // MEMOIZAÇÕES PRINCIPAIS (ALERTS E GRÁFICOS)
  // =========================================================================
  // Idade exibida no header (idade hoje) — composição histórica usa idade na data da medida
  const patientAge = useMemo(() => calculateAge(profile?.data_nascimento), [profile]);

  // NOVO: Extração dos alertas do QFA para gerenciar o Bloqueio Clínico
  const qfaWarnings = useMemo(() => {
    return validateQFAConsistency(qfaResponses, foodRestrictions);
  }, [qfaResponses, foodRestrictions]);

  const hasCriticalFoodRisk = qfaWarnings.length > 0;

  // Filtros de perfil alimentar para exibição UI
  const allergies = useMemo(() => foodRestrictions.filter(r => r.type === 'allergy'), [foodRestrictions]);
  const intolerances = useMemo(() => foodRestrictions.filter(r => r.type === 'intolerance'), [foodRestrictions]);
  const restrictions = useMemo(() => foodRestrictions.filter(r => r.type !== 'allergy' && r.type !== 'intolerance'), [foodRestrictions]);
  const hasAnyRestriction = foodRestrictions.length > 0;

  // MODIFICADO: useMemo do Radar IA
  const activeAlerts = useMemo(() => {
    const alerts: Alert[] = [];
    
    let lastCheckin: CheckinData | null = null;
    let daysSinceLastCheckin = 0;
    
    const phone = profile?.phone?.replace(/\D/g, '');
    const firstName = profile?.full_name?.split(' ')[0] || 'Paciente';
    const waBase = phone ? `https://wa.me/55${phone}?text=` : '';

    if (history.length > 0) {
      lastCheckin = history[history.length - 1];
      daysSinceLastCheckin = Math.floor((new Date().getTime() - new Date(lastCheckin.created_at).getTime()) / (1000 * 3600 * 24));
      
      if (daysSinceLastCheckin > 14) {
        alerts.push({ 
          id: 'a1', type: 'danger', 
          text: `Risco de Evasão: Paciente sem check-in há ${daysSinceLastCheckin} dias.`, 
          icon: <Clock size={16}/>,
          waText: 'Cobrar Retorno',
          waLink: waBase ? `${waBase}${encodeURIComponent(`Olá ${firstName}, notei que faz um tempinho que você não preenche seu check-in semanal. Está tudo bem? Precisando de ajuda com o plano, me avise!`)}` : undefined
        });
      } else if (daysSinceLastCheckin > 7) {
        alerts.push({ 
          id: 'a2', type: 'warning', 
          text: `Atraso no relato semanal detectado. Lembrete recomendado.`, 
          icon: <Clock size={16}/>,
          waText: 'Lembrar Check-in',
          waLink: waBase ? `${waBase}${encodeURIComponent(`Oie ${firstName}, passando pra lembrar de enviar seu check-in dessa semana lá no App, tá bom? Qualquer dúvida me chama!`)}` : undefined
        });
      }
      
      if (history.length >= 3) {
        const last3 = history.slice(-3);
        const allGood = last3.every(c => c.adesao_ao_plano >= 4);
        if (allGood) {
          alerts.push({ 
            id: 'a3', type: 'success', 
            text: `Fase de Cruzeiro: Alta consistência na adesão há 3 semanas seguidas.`, 
            icon: <Flame size={16} />,
            waText: 'Elogiar Adesão',
            waLink: waBase ? `${waBase}${encodeURIComponent(`Oi ${firstName}! Analisando seu histórico vi que sua adesão nas últimas 3 semanas foi impecável. Parabéns pelo foco, você tá arrasando! 👏🏻🔥`)}` : undefined
          });
        }
      }
    }

    let avgWater = 0;
    let hasRecentDifficultMood = false;
    let lowActivityWarning = false;
    
    if (dailyLogs.length > 0) {
      const recentLogs = dailyLogs.slice(0, 3);
      avgWater = recentLogs.reduce((acc, log) => acc + (log.water_ml || 0), 0) / recentLogs.length;
      hasRecentDifficultMood = recentLogs.some(log => log.mood === 'dificil');

      const avgActivity = recentLogs.reduce((acc, log) => acc + (log.activity_kcal || 0), 0) / recentLogs.length;
      if (avgActivity < 100) {
         lowActivityWarning = true;
      }

      if (hasRecentDifficultMood && lastCheckin && lastCheckin.adesao_ao_plano <= 3) {
        alerts.push({ 
          id: 'ia1', type: 'danger', 
          text: 'Comportamental: Dias reportados como "difíceis" no diário combinados com baixa adesão.', 
          icon: <Brain size={16}/>,
          waText: 'Acolher Paciente',
          waLink: waBase ? `${waBase}${encodeURIComponent(`Oi ${firstName}, vi pelo seu diário que os últimos dias foram um pouco difíceis. Quer conversar sobre isso? Podemos adaptar o plano se necessário, estou aqui pra te ajudar.`)}` : undefined
        });
      }

      if (avgWater > 0 && avgWater < 1200) {
        alerts.push({ 
          id: 'ia2', type: 'warning', 
          text: `Desidratação: Média hídrica nos últimos dias é de apenas ${Math.round(avgWater)}ml.`, 
          icon: <Droplets size={16}/>,
          waText: 'Avisar H2O',
          waLink: waBase ? `${waBase}${encodeURIComponent(`Oi ${firstName}, vi no app que sua ingestão de água caiu bastante esses dias. Lembra da sua garrafinha! O metabolismo precisa de água pra funcionar bem. 💧`)}` : undefined
        });
      }

      if (lowActivityWarning) {
        alerts.push({ 
          id: 'ia4', type: 'warning', 
          text: `Baixa Atividade Física: Gasto energético com exercícios quase nulo nos últimos dias.`, 
          icon: <Activity size={16}/>,
          waText: 'Incentivar Treino',
          waLink: waBase ? `${waBase}${encodeURIComponent(`Oi ${firstName}, sumiu dos treinos esses dias? Bora voltar pro foco que o exercício potencializa muito o nosso plano! 💪🏻`)}` : undefined
        });
      }
    }

    if (bioData.length > 0) {
      const latestBio = bioData[0];
      const examMap: Record<string, string> = {
        glucose: 'Glicose', insulin: 'Insulina', hba1c: 'HbA1c', homair: 'HOMA-IR',
        ldl: 'LDL', hdl: 'HDL', triglycerides: 'Triglicerídeos', vitamin_d: 'Vit. D',
        vitamin_b12: 'Vit. B12', ferritin: 'Ferritina', pcr: 'PCR', tsh: 'TSH', iron: 'Ferro'
      };
      
      const dangerExams: string[] = [];

      Object.keys(examMap).forEach(key => {
        let value = latestBio[key];
        if (key === 'homair' && !value && latestBio.glucose && latestBio.insulin) {
          value = ((parseFloat(latestBio.glucose as string) * parseFloat(latestBio.insulin as string)) / 405).toFixed(2);
        }
        if(value !== null && value !== undefined) {
          const analysis = interpretBiochemical(key, parseFloat(value as string));
          if(analysis.status === 'danger') dangerExams.push(examMap[key]);
        }
      });

      if (dangerExams.length > 0) {
        alerts.push({ 
          id: 'b1', type: 'danger', 
          text: `Atenção Clínica: Parâmetros em risco elevado (${dangerExams.join(', ')}).`, 
          icon: <Activity size={16}/> 
        });
      }
    }

    if (history.length >= 2) {
      const w1 = history[history.length - 1].peso;
      const w2 = history[history.length - 2].peso;
      if (w1 >= w2 && avgWater > 0 && avgWater < 1500) {
        alerts.push({ 
          id: 'ia3', type: 'warning', 
          text: `Fator de Estagnação: O platô de peso recente pode estar agravado pelo baixo consumo hídrico.`, 
          icon: <TrendingUp size={16}/> 
        });
      }
    }

    // NOVO: Push dos Alertas de QFA Consistência
    qfaWarnings.forEach((warning, index) => {
      alerts.push({
        id: `qfa_${index}`,
        type: 'danger',
        text: warning,
        icon: <AlertTriangle size={16} />,
        waText: 'Corrigir Alimentação',
        waLink: waBase
          ? `${waBase}${encodeURIComponent(
              `Oi ${firstName}, identifiquei um possível conflito alimentar no seu questionário (QFA). Precisamos ajustar isso para garantir sua segurança. Me chama aqui pra alinharmos.`
            )}`
          : undefined
      });
    });

    return alerts;
  }, [history, bioData, dailyLogs, profile, qfaWarnings]);

  const timelineData = useMemo(() => {
    const dateSet = new Set<string>();
    const formatD = (d: string) => new Date(d).toISOString().split('T')[0];
    
    history.forEach(h => dateSet.add(formatD(h.created_at)));
    antroData.forEach(a => dateSet.add(formatD(a.measurement_date)));
    skinfoldsData.forEach(s => dateSet.add(formatD(s.measurement_date)));
    bioData.forEach(b => dateSet.add(formatD(b.exam_date)));

    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const defaultHeightRaw = antroData.find(a => a.height)?.height || history.find(h => h.altura)?.altura || profile?.altura || null;
    const defaultHeight = defaultHeightRaw ? parseFloat(defaultHeightRaw.toString()) : null;

    // F3.6 — mapa oficial body_compositions por skinfold_id (evita N+1)
    const bodyCompMap = new Map((bodyCompsData as any[]).map((b: any) => [b.skinfold_id, b]));

    return sortedDates.map(dateStr => {
      const checkin = history.find(h => formatD(h.created_at) === dateStr);
      const antro = antroData.find(a => formatD(a.measurement_date) === dateStr);
      const skin = skinfoldsData.find(s => formatD(s.measurement_date) === dateStr);
      const bio = bioData.find(b => formatD(b.exam_date) === dateStr);

      const currentWeightRaw = checkin?.peso || antro?.weight;
      const currentWeight = currentWeightRaw ? parseFloat(currentWeightRaw.toString()) : null;

      const currentHeightRaw = checkin?.altura || antro?.height;
      const currentHeight = currentHeightRaw ? parseFloat(currentHeightRaw.toString()) : defaultHeight;

      let imc: number | null = null;
      if (currentWeight && currentHeight && currentHeight > 0) {
        imc = parseFloat((currentWeight / (currentHeight * currentHeight)).toFixed(1));
      }

      // F3.6 — prioriza body_compositions is_official, fallback on-the-fly
      let sumFolds: number | null = null;
      let bf: number | null = null;
      let fatMass: number | null = null;
      let leanMass: number | null = null;
      let protocol: string | null = null;
      let density: number | null = null;
      let protocolVersion: string | null = null;
      let method: string | null = null;
      let calculatedAt: string | null = null;
      
      if (skin) {
        const official = bodyCompMap.get((skin as any).id) as any;
        if (official) {
          // Conjunto indivisível do oficial — não recalcular
          sumFolds = official.sum;
          bf = official.bf;
          fatMass = official.fat_mass;
          leanMass = official.lean_mass;
          protocol = official.protocol;
          density = official.density;
          protocolVersion = official.protocol_version;
          method = official.method;
          calculatedAt = official.calculated_at;
        } else {
          const rawProtocol = (skin as any).protocol ?? null;
          const isValidProtocol = rawProtocol === 'jp3' || rawProtocol === 'jp7' || rawProtocol === 'petroski4';
          protocol = isValidProtocol ? rawProtocol : null;
          if (protocol) {
            const ageAtMeasure = skin.measurement_date ? calculateAgeMotor(profile?.data_nascimento, skin.measurement_date) : null;
            const sexNorm = normalizeSex(profile?.sexo);
            const comp = calculateBodyComposition({
              protocol: protocol as any,
              sex: sexNorm,
              age: ageAtMeasure,
              weight: currentWeight,
              height: currentHeight,
              skinfolds: skin as unknown as Record<string, unknown>,
              conversion: 'siri',
            });
            if (comp && comp.sum !== null) sumFolds = comp.sum;
            if (comp && comp.bf !== null) {
              bf = comp.bf;
              fatMass = comp.fatMass;
              leanMass = comp.leanMass;
              density = (comp as any).density ?? null;
            }
          } else {
            sumFolds = null;
          }
        }
      }

      let homa: number | null = null;
      if (bio && bio.glucose && bio.insulin) {
        homa = parseFloat(((parseFloat(bio.glucose as string) * parseFloat(bio.insulin as string)) / 405).toFixed(2));
      }

      return {
        date: dateStr,
        peso: currentWeight,
        cintura: antro?.waist || null,
        somatorio_dobras: sumFolds,
        imc,
        bf,
        fatMass,
        leanMass,
        protocol,
        density,
        protocolVersion,
        method,
        calculatedAt,
        skinfoldId: (skin as any)?.id ?? null,
        homair: homa,
        adesao: checkin?.adesao_ao_plano || null,
        hasExam: !!bio, 
      };
    });
  }, [history, antroData, skinfoldsData, bioData, profile, bodyCompsData]);

  const projectionDate = useMemo(() => {
    if (history.length < 3 || !profile?.meta_peso) return null;
    const recentData = history.slice(-5); 
    const n = recentData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    recentData.forEach(p => {
      const x = new Date(p.created_at).getTime() / (1000 * 3600 * 24);
      const y = p.peso;
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
    });
    
    const divisor = (n * sumX2 - sumX * sumX);
    if (divisor === 0) return "Estagnado";

    const m = (n * sumXY - sumX * sumY) / divisor;
    const b = (sumY - m * sumX) / n;
    
    if (m >= 0) return "Estagnado ou Subindo"; 
    const targetX = (profile.meta_peso - b) / m;
    const targetDate = new Date(targetX * (1000 * 3600 * 24));
    
    if (targetDate.getTime() - new Date().getTime() > 365 * 24 * 60 * 60 * 1000) return "+ de 1 ano";
    return targetDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }, [history, profile?.meta_peso]);

  const latestMetabolicData = useMemo(() => {
    let weight: number | null = null;
    let bf: number | null = null;
    let leanMass: number | null = null;
    
    let heightRaw: string | number | null | undefined = profile?.altura || null;
    
    if (!heightRaw && history.length > 0) {
      const lastCheckinWithHeight = [...history].reverse().find(h => h.altura);
      if (lastCheckinWithHeight) heightRaw = lastCheckinWithHeight.altura;
    }
    
    if (!heightRaw && antroData.length > 0) {
      const lastAntroWithHeight = [...antroData].find(a => a.height);
      if (lastAntroWithHeight) heightRaw = lastAntroWithHeight.height;
    }

    const height = heightRaw ? parseFloat(heightRaw.toString()) : null;

    if (timelineData.length > 0) {
      for (let i = timelineData.length - 1; i >= 0; i--) {
        if (weight === null && timelineData[i].peso) weight = timelineData[i].peso;
        if (bf === null && timelineData[i].bf) bf = timelineData[i].bf;
        if (leanMass === null && timelineData[i].leanMass) leanMass = timelineData[i].leanMass;
      }
    }
    
    return { weight, bf, leanMass, height };
  }, [timelineData, profile, history, antroData]); 

  // =========================================================================
  // 🔥 LÓGICA METABÓLICA VIA MODELO ÚNICO (Sprint Z-001 — SSOT)
  // O historico não recalcula mais TMB/GET/tendência: delega ao metabolicModel.
  // =========================================================================

  const avgActivityKcal = useMemo(() => {
    if (!dailyLogs || dailyLogs.length === 0) return 0;
    const last7 = dailyLogs.slice(0, 7);
    // Média pela QUANTIDADE REAL de logs (correção: não dividir por 7 fixo)
    const total = last7.reduce((acc, log) => acc + (Number(log.activity_kcal) || 0), 0);
    return Math.round(total / last7.length);
  }, [dailyLogs]);

  const metabolicSnapshot = useMemo(() => {
    const weight = latestMetabolicData.weight;
    const height = latestMetabolicData.height;
    const age = patientAge;
    const leanMass = latestMetabolicData.leanMass;
    const gender = profile?.sexo;

    if (!weight || !height || !age) return null;

    const weightVelocity = calculateWeightVelocity(
      history
        .filter(h => typeof h.peso === 'number' && !isNaN(h.peso))
        .map(h => ({ peso: h.peso, created_at: h.created_at }))
    );

    return buildMetabolicSnapshot({
      weight,
      height,
      age,
      gender,
      bf: latestMetabolicData.bf,
      leanMass,
      avgActivity: avgActivityKcal,
      weightTrend: calculateWeightTrend(history.map(h => h.peso)),
      weightVelocity
    });
  }, [latestMetabolicData, patientAge, profile?.sexo, avgActivityKcal, history]);

  const tmb = metabolicSnapshot?.tmb || 0;
  const tmbMethod = metabolicSnapshot?.tmbMethod || '';
  const getVal = metabolicSnapshot?.get || 0;

  const masterRecommendation = useMemo(() => {
    // 🔥 BLOQUEIO CLÍNICO DE SEGURANÇA
    if (hasCriticalFoodRisk) return null;

    if (!tmb || !getVal || !latestMetabolicData.weight) return null;

    return metabolicSnapshot?.recommendation || null;
  }, [tmb, getVal, latestMetabolicData, metabolicSnapshot, hasCriticalFoodRisk]);


  const dangerCount = activeAlerts.filter(a => a.type === 'danger').length;
  const warningCount = activeAlerts.filter(a => a.type === 'warning').length;
  const successCount = activeAlerts.filter(a => a.type === 'success').length;

  const daysSinceLastCheckin = useMemo(() => {
    if (history.length === 0) return null;
    const lastCheckin = history[history.length - 1];
    return Math.floor((new Date().getTime() - new Date(lastCheckin.created_at).getTime()) / (1000 * 60 * 60 * 24));
  }, [history]);

  const clinicalBrief = useMemo(() => {
    if (hasCriticalFoodRisk) {
      return {
        eyebrow: 'Bloqueio clínico',
        title: 'Revisar QFA antes da prescrição',
        body: qfaWarnings[0] || 'Conflito alimentar detectado no perfil do paciente.',
        action: 'Ajustar segurança alimentar',
        tone: 'danger' as const,
      };
    }

    if (daysSinceLastCheckin !== null && daysSinceLastCheckin > 14) {
      return {
        eyebrow: 'Risco de evasão',
        title: `Paciente sem check-in há ${daysSinceLastCheckin} dias`,
        body: 'Vale priorizar reengajamento e cobrança ativa.',
        action: 'Cobrar retorno',
        tone: 'danger' as const,
      };
    }

    const topAlert = activeAlerts[0];
    if (topAlert) {
      return {
        eyebrow: topAlert.type === 'danger' ? 'Ação imediata' : topAlert.type === 'warning' ? 'Atenção do momento' : 'Ponto positivo',
        title: topAlert.text,
        body: topAlert.waText ? `Próximo passo: ${topAlert.waText}` : 'Revisar o ponto clínico com tranquilidade.',
        action: topAlert.waText || 'Revisar agora',
        tone: topAlert.type,
      };
    }

    if (masterRecommendation) {
      return {
        eyebrow: 'Prescrição sugerida',
        title: `${masterRecommendation.calories} kcal/dia`,
        body: `${masterRecommendation.goal} · ${masterRecommendation.strategy}`,
        action: 'Usar recomendação',
        tone: 'success' as const,
      };
    }

    return {
      eyebrow: 'Leitura estável',
      title: 'Nenhum alerta relevante no momento',
      body: 'Use as demais abas para aprofundar medidas, exames e evolução.',
      action: 'Manter acompanhamento',
      tone: 'success' as const,
    };
  }, [activeAlerts, daysSinceLastCheckin, hasCriticalFoodRisk, masterRecommendation, qfaWarnings]);

  // =========================================================================
  // SUB-COMPONENTES
  // =========================================================================
  const ExamBadge = ({ label, value, unit, type }: { label: string, value: string | number | null | undefined, unit: string, type: string }) => {
    const analysis = interpretBiochemical(type, value ? parseFloat(value as string) : null);
    if (value === null || value === undefined || isNaN(value as number)) return null;

    return (
      <div className={`relative overflow-hidden group flex items-center justify-between p-4 rounded-2xl border ${analysis.border} ${analysis.bg} transition-all duration-300 hover:shadow-md`}>
        <div className="relative z-10 flex flex-col">
          <span className="text-[10px] md:text-xs uppercase font-bold text-stone-500 tracking-wider mb-0.5">{label}</span>
          <span className={`font-extrabold text-xl md:text-2xl tracking-tight ${analysis.color}`}>
            {value} <span className="text-[10px] md:text-xs font-bold opacity-60 ml-0.5">{unit}</span>
          </span>
        </div>
        <div className="relative z-10 flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-white shadow-sm border border-white/80">
          {analysis.icon}
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-stone-900/90 backdrop-blur-sm text-white text-[10px] md:text-xs font-bold px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-20 shadow-xl text-center transform translate-y-2 group-hover:translate-y-0">
          {analysis.text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900/90"></div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50/50">
      <div className="flex flex-col items-center gap-5">
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-stone-100">
          <Loader2 className="animate-spin text-nutri-700" size={36} />
        </div>
        <p className="text-stone-500 font-medium tracking-wide animate-pulse">Carregando prontuário...</p>
      </div>
    </div>
  );

  

  return (
    <main className="min-h-screen bg-[#F8F9FA] p-3 sm:p-4 md:p-8 lg:p-10 pt-20 md:pt-24 lg:pt-28 font-sans text-stone-800 selection:bg-nutri-200">
      <div className="max-w-7xl mx-auto w-full">
        
        {/* NAVEGAÇÃO E HEADER PREMIUM */}
        <nav className="flex items-center justify-between mb-6 md:mb-8 gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Link 
            href="/admin/dashboard" 
            className="flex items-center justify-center gap-2 h-10 md:h-12 px-3 md:px-5 bg-white border border-stone-200/80 rounded-xl md:rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:border-nutri-300 hover:shadow-md active:scale-[0.98] transition-all duration-300 text-stone-600 hover:text-nutri-700 group shrink-0"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline font-bold text-sm">Painel Principal</span>
          </Link>
          
          <div className="text-right flex-1 truncate">
            <p className="text-[9px] md:text-[10px] text-stone-400 uppercase font-bold tracking-[0.22em] mb-0.5">Prontuário Eletrônico</p>
            <h1 className="text-base md:text-xl lg:text-2xl font-extrabold text-stone-900 flex items-center justify-end gap-1.5 tracking-tight truncate">
              <User size={16} className="text-nutri-600 hidden sm:block" /> 
              <span className="truncate">{profile?.full_name}</span>
            </h1>
            <div className="mt-1.5 flex flex-wrap justify-end gap-1">
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-[3px] text-[9px] md:text-[10px] font-bold text-stone-600">
                <User size={10} className="text-stone-400" />
                {patientAge !== null ? `${patientAge} anos` : 'Idade indisponível'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-[3px] text-[9px] md:text-[10px] font-bold text-stone-600 capitalize">
                <Stethoscope size={10} className="text-stone-400" />
                {profile?.tipo_perfil || 'Perfil não definido'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-[3px] text-[9px] md:text-[10px] font-bold text-stone-600 capitalize">
                <Clock size={10} className="text-stone-400" />
                {daysSinceLastCheckin !== null ? `${daysSinceLastCheckin}d sem check-in` : 'Sem check-in registrado'}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[9px] md:text-[10px] font-bold',
                dangerCount > 0
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : warningCount > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              )}>
                <AlertTriangle size={10} />
                {activeAlerts.length} alerta{activeAlerts.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </nav>

        <section className="mb-5 md:mb-6 overflow-hidden rounded-[1.5rem] border border-stone-200 bg-stone-900 text-white shadow-[0_16px_50px_rgba(15,23,42,0.16)]">
          <div className="grid gap-3 p-3.5 md:p-4 lg:grid-cols-[1.35fr_0.95fr] lg:items-center">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">
                  <Zap size={12} className="text-amber-400" /> Leitura rápida
                </span>
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                  clinicalBrief.tone === 'danger'
                    ? 'border-rose-400/20 bg-rose-500/15 text-rose-200'
                    : clinicalBrief.tone === 'warning'
                      ? 'border-amber-400/20 bg-amber-500/15 text-amber-200'
                      : 'border-emerald-400/20 bg-emerald-500/15 text-emerald-200'
                )}>
                  {clinicalBrief.eyebrow}
                </span>
              </div>

              <div className="max-w-3xl space-y-2">
                <h2 className="text-lg md:text-xl lg:text-[1.75rem] font-black tracking-tight leading-tight">
                  {clinicalBrief.title}
                </h2>
                <p className="max-w-2xl text-xs md:text-sm leading-relaxed text-stone-300">
                  {clinicalBrief.body}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-stone-400">Check-ins</p>
                <p className="mt-1 text-lg md:text-xl font-black leading-none">{history.length}</p>
                <p className="mt-0.5 text-[9px] text-stone-400">registros</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-stone-400">Diário</p>
                <p className="mt-1 text-lg md:text-xl font-black leading-none">{dailyLogs.length}</p>
                <p className="mt-0.5 text-[9px] text-stone-400">dias rastreados</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-stone-400">Exames</p>
                <p className="mt-1 text-lg md:text-xl font-black leading-none">{bioData.length}</p>
                <p className="mt-0.5 text-[9px] text-stone-400">janelas</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-stone-400">Próximo passo</p>
                <p className="mt-1 text-xs md:text-sm font-bold leading-snug text-white">
                  {clinicalBrief.action}
                </p>
                <p className="mt-0.5 text-[9px] text-stone-400">ação sugerida</p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            LINHA SUPERIOR DE DASHBOARD (Resumo, Metabolismo, Alertas)
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-in fade-in duration-700">
          
          {/* WIDGET: RESUMO DO PACIENTE */}
          <section className="bg-white p-5 md:p-8 rounded-3xl shadow-sm border border-stone-100 flex flex-col hover:shadow-md transition-shadow h-full min-h-[300px]">
            <div>
              <h2 className="text-base md:text-lg font-bold mb-4 md:mb-6 border-b border-stone-100 pb-3 text-stone-900 flex items-center gap-2 tracking-tight">
                <BookOpen size={18} className="text-nutri-600" /> Resumo Clínico
              </h2>
              <div className="space-y-4 md:space-y-5">
                
                <div className="flex justify-between items-center bg-stone-50/50 p-3 rounded-2xl border border-stone-100/80">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Idade / Sexo</p>
                    <p className="font-extrabold text-stone-800 text-sm md:text-base flex items-center gap-1.5">
                      {patientAge !== null ? `${patientAge} anos` : <span className="text-rose-500 text-[10px] flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md"><AlertCircle size={12}/> Info. ausente</span>} 
                      <span className="text-stone-300 font-normal">|</span>
                      <span className="capitalize">{profile?.sexo || 'N/D'}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Perfil</p>
                    <span className="font-bold text-nutri-700 uppercase bg-nutri-50 px-2.5 py-1 rounded-lg text-[10px] tracking-wider border border-nutri-100">{profile?.tipo_perfil || 'Não definido'}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 p-3 rounded-2xl bg-stone-50/50 border border-stone-100/80 text-center">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Meta de Peso</p>
                    <p className="font-extrabold text-stone-700 text-lg md:text-xl">{profile?.meta_peso ? `${profile.meta_peso} kg` : 'N/A'}</p>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-2xl bg-emerald-50/30 border border-emerald-100/50 text-center">
                    <p className="text-[10px] text-emerald-600/70 uppercase tracking-widest font-bold">Último Peso</p>
                    <p className="font-extrabold text-emerald-600 text-lg md:text-xl">{latestMetabolicData.weight ? `${latestMetabolicData.weight} kg` : 'N/A'}</p>
                  </div>
                </div>
                
                {projectionDate && projectionDate !== "Estagnado ou Subindo" && (
                  <div className="bg-gradient-to-r from-nutri-50/80 to-white p-3 md:p-4 rounded-2xl border border-nutri-100 mt-2 flex items-center gap-3 shadow-sm">
                    <div className="bg-white shadow-sm p-2 rounded-xl border border-nutri-50 shrink-0"><Target className="text-nutri-600" size={18} /></div>
                    <div>
                      <p className="text-[9px] font-bold text-nutri-600 uppercase tracking-widest mb-0.5">GPS da Meta</p>
                      <p className="text-sm md:text-base font-extrabold text-stone-800 leading-tight">Atingir em: {projectionDate}</p>
                    </div>
                  </div>
                )}

                {/* 🔥 NOVO: PERFIL ALIMENTAR CLÍNICO VISUAL */}
                {hasAnyRestriction && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2">
                    <p className="text-amber-700 font-bold text-sm mb-2">
                      Perfil Alimentar do Paciente
                    </p>

                    {allergies.length > 0 && (
                      <p className="text-rose-600 text-xs font-medium">
                        🚫 Alergias: {allergies.map(a => a.food || a.tag || a.foodId).filter(Boolean).join(', ')}
                      </p>
                    )}

                    {intolerances.length > 0 && (
                      <p className="text-orange-600 text-xs font-medium mt-1">
                        ⚠️ Intolerâncias: {intolerances.map(i => i.food || i.tag || i.foodId).filter(Boolean).join(', ')}
                      </p>
                    )}

                    {restrictions.length > 0 && (
                      <p className="text-yellow-700 text-xs font-medium mt-1">
                        ⚠️ Restrições: {restrictions.map(r => r.food || r.tag || r.foodId).filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* 🔥 NOVO: BLOQUEIO CLÍNICO DE PRESCRIÇÃO VISUAL */}
                {hasCriticalFoodRisk && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mt-2">
                    <p className="text-rose-700 font-bold text-sm flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Atenção: conflito alimentar detectado
                    </p>
                    <p className="text-rose-600 text-xs mt-1 font-medium">
                      Ajuste necessário antes de prosseguir com prescrição.
                    </p>
                  </div>
                )}

              </div>
            </div>
          </section>

          {/* 🔥 WIDGET METABÓLICO */}
          <MetabolicSummary 
            weight={latestMetabolicData.weight}
            height={latestMetabolicData.height}
            age={patientAge}
            gender={profile?.sexo}
            bf={latestMetabolicData.bf}
            leanMass={latestMetabolicData.leanMass}
            dailyLogs={dailyLogs}
            tmb={tmb}
            tmbMethod={tmbMethod}
            getVal={getVal}
            avgActivityKcal={avgActivityKcal}
            recommendation={masterRecommendation}
            foodRestrictions={foodRestrictions} // <-- 🔥 PROP ADICIONADA AQUI
          />

          {/* WIDGET: RADAR CLÍNICO */}
          <section 
            onClick={() => setIsRadarExpanded(true)}
            className="bg-stone-900 text-white p-5 md:p-8 rounded-3xl shadow-xl relative overflow-hidden group flex flex-col h-full min-h-[300px] border border-stone-800 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer"
          >
            <div className="absolute -right-20 -top-20 w-60 h-60 bg-white opacity-5 rounded-full blur-3xl transition-opacity group-hover:opacity-10 duration-700 pointer-events-none"></div>
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex flex-col">
                <h2 className="text-[10px] md:text-xs font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Zap size={16} className="text-amber-400 fill-amber-400/20" /> Radar IA
                </h2>
                <p className="text-[9px] md:text-[10px] text-stone-500 font-bold mt-1 tracking-wider">Monitoramento ativo</p>
              </div>
              <div className="p-1.5 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                <ChevronRight size={16} className="text-stone-400 group-hover:text-white" />
              </div>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 mt-2">
              {activeAlerts.length > 0 ? (
                <>
                  <div className="bg-stone-800/80 p-3 md:p-4 rounded-full mb-3 md:mb-4 border border-stone-700/50 shadow-inner">
                    <Activity size={28} className="text-amber-400" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-white mb-1.5 tracking-tight">{activeAlerts.length} Alertas</h3>
                  <p className="text-stone-400 text-xs md:text-sm font-medium">Toque para revisar insights.</p>
                  
                  <div className="flex flex-wrap justify-center gap-2 mt-4 md:mt-5 w-full">
                    {dangerCount > 0 && (
                      <div className="bg-rose-500/15 border border-rose-500/20 text-rose-400 px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold flex items-center gap-1.5">
                        <AlertCircle size={12} /> {dangerCount} Crítico
                      </div>
                    )}
                    {warningCount > 0 && (
                      <div className="bg-amber-500/15 border border-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold flex items-center gap-1.5">
                        <AlertTriangle size={12} /> {warningCount} Atenção
                      </div>
                    )}
                    {successCount > 0 && (
                      <div className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold flex items-center gap-1.5">
                        <Flame size={12} /> {successCount} Positivo
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-emerald-500/15 p-3 md:p-4 rounded-full mb-3 md:mb-4 border border-emerald-500/20">
                    <CheckCircle2 size={28} className="text-emerald-400" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-emerald-400 mb-1.5 tracking-tight">Tudo Estável</h3>
                  <p className="text-stone-400 text-xs md:text-sm font-medium">Nenhum risco detectado.</p>
                </>
              )}
            </div>
          </section>
        </div>

        {/* =========================================================================
            LINHA CENTRAL (GRÁFICO MULTI-LENTES)
            ========================================================================= */}
        <section className="bg-white p-5 md:p-8 rounded-3xl shadow-sm border border-stone-100 flex flex-col hover:shadow-md transition-shadow mb-6 md:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2.5 text-stone-900 tracking-tight">
              <div className="bg-stone-50 p-2 rounded-xl border border-stone-100">
                <TrendingUp className="text-nutri-700" size={18} />
              </div>
              Evolução Gráfica
            </h2>

            {/* SEGMENTED CONTROL PARA GRÁFICO */}
            <div className="flex bg-stone-100/80 p-1 md:p-1.5 rounded-xl md:rounded-2xl w-full lg:w-auto border border-stone-200/50">
              <button 
                onClick={() => setActiveLens('medidas')} 
                className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-5 h-9 md:h-10 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${activeLens === 'medidas' ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <Scale size={14} className={activeLens === 'medidas' ? 'text-nutri-600' : ''} /> Medidas
              </button>
              <button 
                onClick={() => setActiveLens('composicao')} 
                className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-5 h-9 md:h-10 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${activeLens === 'composicao' ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <Layers size={14} className={activeLens === 'composicao' ? 'text-nutri-600' : ''} /> Composição
              </button>
              <button 
                onClick={() => setActiveLens('metabolico')} 
                className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 md:px-5 h-9 md:h-10 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${activeLens === 'metabolico' ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <Activity size={14} className={activeLens === 'metabolico' ? 'text-nutri-600' : ''} /> Metabólico
              </button>
            </div>
          </div>

          <div className="h-[300px] md:h-[400px] w-full -ml-4 sm:ml-0 mt-2">
            {timelineData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-100 rounded-2xl bg-stone-50/50 p-4 text-center">
                <TrendingUp size={36} className="mb-3 opacity-40" />
                <p className="font-medium text-xs md:text-sm">Insira dados de peso ou check-ins para visualizar a evolução.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineData} margin={{ top: 20, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAreaWaist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} stroke="#a8a29e" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                  
                  <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#a8a29e" fontSize={10} axisLine={false} tickLine={false} dx={-10} />
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#818cf8" fontSize={10} axisLine={false} tickLine={false} dx={10} />
                  
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/90 backdrop-blur-xl p-4 md:p-5 rounded-2xl shadow-xl border border-stone-100 pointer-events-none min-w-[180px]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 border-b border-stone-100 pb-2">{new Date(data.date).toLocaleDateString('pt-BR')}</p>
                            
                            <div className="space-y-1.5">
                              {activeLens === 'medidas' && (
                                <>
                                  {data.peso && <p className="font-semibold text-xs text-stone-600 flex justify-between gap-4">Peso: <span className="font-extrabold text-emerald-600">{data.peso} kg</span></p>}
                                  {data.cintura && <p className="font-semibold text-xs text-stone-600 flex justify-between gap-4">Cintura: <span className="font-extrabold text-indigo-600">{data.cintura} cm</span></p>}
                                </>
                              )}

                              {activeLens === 'composicao' && (
                                <>
                                  {data.peso && <p className="font-semibold text-xs text-stone-600 flex justify-between gap-4">Peso: <span className="font-extrabold text-emerald-600">{data.peso} kg</span></p>}
                                  {data.somatorio_dobras && <p className="font-semibold text-xs text-stone-600 flex justify-between gap-4">Dobras: <span className="font-extrabold text-pink-600">{data.somatorio_dobras} mm</span></p>}
                                  {data.bf && <p className="font-semibold text-xs text-stone-600 flex justify-between gap-4">% Gordura: <span className="font-extrabold text-amber-500">{data.bf}%</span></p>}
                                </>
                              )}

                              {activeLens === 'metabolico' && (
                                <>
                                  {data.cintura && <p className="font-semibold text-xs text-stone-600 flex justify-between gap-4">Cintura: <span className="font-extrabold text-indigo-600">{data.cintura} cm</span></p>}
                                  {data.homair && <p className="font-semibold text-xs text-stone-600 flex justify-between gap-4">HOMA-IR: <span className="font-extrabold text-amber-500">{data.homair}</span></p>}
                                </>
                              )}
                            </div>

                            {(data.adesao || data.hasExam) && (
                              <div className="mt-3 pt-2 border-t border-stone-100 space-y-1.5">
                                {data.adesao && <p className="text-[10px] text-stone-500 flex justify-between font-medium">Adesão: <span className="font-bold text-stone-800">{data.adesao}/5</span></p>}
                                {data.hasExam && <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><Syringe size={12}/> Exame Adicionado</p>}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  
                  {activeLens === 'medidas' && (
                    <>
                      {profile?.meta_peso && <ReferenceLine y={profile.meta_peso} yAxisId="left" stroke="#d6d3d1" strokeDasharray="4 4" label={{ position: 'top', value: 'META', fill: '#a8a29e', fontSize: 9, fontWeight: 'bold' }} />}
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" connectNulls />
                      <Line type="monotone" yAxisId="right" dataKey="cintura" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} connectNulls />
                    </>
                  )}

                  {activeLens === 'composicao' && (
                    <>
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" connectNulls />
                      <Line type="monotone" yAxisId="right" dataKey="somatorio_dobras" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4, fill: "#ec4899", strokeWidth: 2, stroke: "#fff" }} connectNulls />
                      {timelineData.some(d => d.bf) && (
                        <Line type="monotone" yAxisId="right" dataKey="bf" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }} connectNulls />
                      )}
                    </>
                  )}

                  {activeLens === 'metabolico' && (
                    <>
                      <ReferenceLine y={2.0} yAxisId="right" stroke="#ef4444" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'ALERTA', fill: '#ef4444', fontSize: 9, fontWeight: 'bold' }} />
                      <Area type="monotone" yAxisId="left" dataKey="cintura" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAreaWaist)" connectNulls />
                      <Line type="monotone" yAxisId="right" dataKey="homair" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7 }} connectNulls />
                    </>
                  )}
                  
                  <Scatter yAxisId="left" dataKey="hasExam" shape={(props: { cx?: number; cy?: number; payload?: { hasExam?: boolean } }) => {
                    const { cx = 0, cy = 0, payload } = props;
                    if (!payload?.hasExam) return <g></g>;
                    return (
                      <g transform={`translate(${cx - 8},${cy - 24})`} className="cursor-pointer">
                        <circle cx="8" cy="8" r="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
                        <Syringe x="2" y="2" size={12} color="#d97706" />
                      </g>
                    );
                  }} />

                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* =========================================================================
            SESSÃO INFERIOR: ABAS E TABELAS CLÍNICAS
            ========================================================================= */}
        <section className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-stone-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          
          {/* ABAS INFERIORES PREMIUM (Scrollável no mobile) */}
          <div className="flex overflow-x-auto border-b border-stone-100 bg-stone-50/50 p-2 md:p-3 gap-1.5 md:gap-2 scrollbar-hide">
            {[
              { id: 'copiloto', label: 'Copiloto', icon: <Brain size={14} /> },
              { id: 'prontuario', label: 'S.O.A.P', icon: <BookOpen size={14} /> },
              { id: 'diario', label: 'Diário', icon: <Coffee size={14} /> },
              { id: 'checkins', label: 'Check-ins', icon: <CalendarCheck size={14} /> },
              { id: 'antropometria', label: 'Medidas', icon: <Ruler size={14} /> },
              { id: 'dobras', label: 'Dobras/BF%', icon: <Layers size={14} /> },
              { id: 'bioquimicos', label: 'Exames', icon: <Activity size={14} /> }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ClinicalTab)} 
                className={`flex items-center justify-center gap-1.5 md:gap-2 px-4 md:px-6 h-10 md:h-12 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-lg md:rounded-xl transition-all whitespace-nowrap active:scale-[0.98] ${
                  activeTab === tab.id 
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/50' 
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100/50'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6 md:p-8 lg:p-10 min-h-[400px]">
            
            {/* PRONTUÁRIO S.O.A.P */}
            {activeTab === 'prontuario' && (
              <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                <h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 text-stone-900 flex items-center gap-2.5 tracking-tight">
                  <div className="bg-stone-100 p-2 rounded-xl text-stone-600"><Stethoscope size={20} /></div> 
                  Prontuário Eletrônico
                </h2>
                
                {/* FORMULÁRIO SOAP PREMIUM */}
                <div className="mb-10 bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-stone-200 shadow-sm focus-within:ring-4 focus-within:ring-nutri-50 transition-all">
                  <div className="space-y-4 md:space-y-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-nutri-600 transition-colors">
                        <MessageCircle size={14} className="text-stone-300 group-focus-within:text-nutri-400"/> S - Subjetivo (Relato)
                      </label>
                      <textarea value={soapNote.s} onChange={e => setSoapNote({...soapNote, s: e.target.value})} placeholder="Queixas, sintomas relatados, facilidades e dificuldades..." className="w-full p-4 rounded-xl border border-stone-200 focus:border-nutri-400 outline-none h-24 resize-none text-sm font-medium bg-stone-50/50 focus:bg-white transition-all shadow-inner focus:shadow-none" />
                    </div>
                    <div className="group">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-nutri-600 transition-colors">
                        <ClipboardList size={14} className="text-stone-300 group-focus-within:text-nutri-400"/> O - Objetivo (Dados Físicos)
                      </label>
                      <textarea value={soapNote.o} onChange={e => setSoapNote({...soapNote, o: e.target.value})} placeholder="Sinais clínicos observados, resultados, medidas..." className="w-full p-4 rounded-xl border border-stone-200 focus:border-nutri-400 outline-none h-24 resize-none text-sm font-medium bg-stone-50/50 focus:bg-white transition-all shadow-inner focus:shadow-none" />
                    </div>
                    <div className="group">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-nutri-600 transition-colors">
                        <Brain size={14} className="text-stone-300 group-focus-within:text-nutri-400"/> A - Avaliação (Diagnóstico)
                      </label>
                      <textarea value={soapNote.a} onChange={e => setSoapNote({...soapNote, a: e.target.value})} placeholder="Interpretação do quadro geral, diagnóstico nutricional..." className="w-full p-4 rounded-xl border border-stone-200 focus:border-nutri-400 outline-none h-24 resize-none text-sm font-medium bg-stone-50/50 focus:bg-white transition-all shadow-inner focus:shadow-none" />
                    </div>
                    <div className="group">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-nutri-600 transition-colors">
                        <ListChecks size={14} className="text-stone-300 group-focus-within:text-nutri-400"/> P - Plano (Conduta)
                      </label>
                      <textarea value={soapNote.p} onChange={e => setSoapNote({...soapNote, p: e.target.value})} placeholder="Conduta, prescrição, metas para a próxima consulta..." className="w-full p-4 rounded-xl border border-stone-200 focus:border-nutri-400 outline-none h-24 resize-none text-sm font-medium bg-stone-50/50 focus:bg-white transition-all shadow-inner focus:shadow-none" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-6 pt-5 border-t border-stone-100">
                    <button 
                      onClick={handleSaveNote} 
                      disabled={savingNote || (!soapNote.s && !soapNote.o && !soapNote.a && !soapNote.p)} 
                      className="w-full sm:w-auto bg-stone-900 text-white px-8 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-800 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 disabled:shadow-none"
                    >
                      {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Prontuário
                    </button>
                  </div>
                </div>

                {/* HISTÓRICO DE ANOTAÇÕES (TIMELINE) */}
                <div className="space-y-6 md:space-y-8 relative before:absolute before:inset-0 before:ml-[22px] md:before:ml-6 before:-translate-x-px before:h-full before:w-[2px] before:bg-gradient-to-b before:from-stone-200 before:to-transparent">
                  {notes.length === 0 ? (
                    <div className="text-center py-12 text-stone-400 font-medium text-sm bg-stone-50/50 rounded-2xl md:rounded-3xl border-2 border-dashed border-stone-200">Nenhuma anotação registrada ainda.</div>
                  ) : (
                    notes.map((note) => {
                      const formattedContent = note.content.includes('**S') ? (
                        <div dangerouslySetInnerHTML={{ __html: note.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-stone-800 block mt-4 mb-1 text-[10px] uppercase tracking-widest border-b border-stone-100 pb-1">$1</strong>').replace(/\n/g, '<br/>') }} />
                      ) : (
                        <p className="whitespace-pre-wrap">{note.content}</p>
                      );

                      return (
                        <div key={note.id} className="relative flex items-start group">
                          <div className="absolute left-0 flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-full bg-white border-2 border-stone-200 shadow-sm z-10 text-stone-500 group-hover:border-nutri-300 group-hover:text-nutri-600 transition-colors">
                            <BookOpen size={16} />
                          </div>
                          <div className="ml-14 md:ml-16 flex-1 bg-white p-5 md:p-7 rounded-2xl md:rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start md:items-center mb-4 border-b border-stone-100 pb-3 md:pb-4">
                              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                {new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} <span className="opacity-50 mx-1">•</span> {new Date(note.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}
                              </span>
                              <button onClick={() => handleDeleteNote(note.id)} className="text-stone-300 hover:text-rose-500 bg-stone-50 hover:bg-rose-50 p-1.5 md:p-2 rounded-lg transition-colors shrink-0 ml-2">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="text-stone-600 leading-relaxed text-xs md:text-sm font-medium">
                              {formattedContent}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* DIÁRIO — dois cards + status inteligente + insights contextuais (civil YYYY-MM-DD) */}
            {activeTab === 'diario' && (() => {
              const selectedLog = (dailyLogs.find(l => l.date === diarioDate) as any) || null
              const isToday = diarioDate === todayCivilSP()
              // Meta hidratação derivada apenas se houver fonte de peso válida (checkins/antro) — não inventar
              const lastCheckinWeight = history.length > 0 ? Number(history[history.length - 1]?.peso) : null
              const lastAntroWeight = antroData.length > 0 ? Number((antroData[0] as any)?.weight) : null
              const waterGoal = deriveWaterGoal(Number.isFinite(lastCheckinWeight!) && lastCheckinWeight! > 0 ? lastCheckinWeight : null, Number.isFinite(lastAntroWeight!) && lastAntroWeight! > 0 ? lastAntroWeight : null)
              const mealPlanNames = (profile as any)?.meal_plan && Array.isArray((profile as any).meal_plan) ? (profile as any).meal_plan.map((m: any) => m.name).filter(Boolean) : null

              // Card comparação: dia anterior; fallback último dia disponível < diarioDate; senão vazio
              const comparisonDateRaw = addDaysCivil(diarioDate, -1)
              let comparisonLog: any = dailyLogs.find((l: any) => l.date === comparisonDateRaw) || null
              let comparisonDate = comparisonDateRaw
              if (!comparisonLog) {
                const sortedBefore = (dailyLogs as any[]).filter((l) => l.date < diarioDate).sort((a, b) => (b.date as string).localeCompare(a.date as string))
                if (sortedBefore.length > 0) {
                  comparisonLog = sortedBefore[0]
                  comparisonDate = comparisonLog.date
                }
              }
              const comparison = compareDiaryDays(selectedLog, comparisonLog)

              return (
                <div className="animate-in fade-in duration-300">
                  {/* Cabeçalho */}
                  <div className="mb-3">
                    <h2 className="text-base md:text-lg font-bold text-stone-900 flex items-center gap-2">
                      <div className="bg-stone-100 p-1.5 rounded-lg text-stone-600"><Coffee size={16} aria-hidden="true" /></div>
                      Diário
                    </h2>
                    <p className="text-xs text-stone-500 mt-1">Dois dias lado a lado — hidratação, refeições, atividade e humor com insights educativos. Datas civis sem deslocamento UTC.</p>
                  </div>

                  {/* Navegação — preserva todayCivilSP / addDaysCivil / formatCivilDate */}
                  <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50/60 p-2.5">
                    <div className="hidden sm:flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setDiarioDate(addDaysCivil(diarioDate, -1))} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-stone-200 hover:bg-white text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nutri-300" aria-label="Dia anterior"><ChevronLeft size={14} aria-hidden="true" /></button>
                        <span className="min-w-[200px] text-center text-sm font-bold text-stone-800 px-2">{formatCivilDateLong(diarioDate)}</span>
                        <button onClick={() => setDiarioDate(addDaysCivil(diarioDate, 1))} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-stone-200 hover:bg-white text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nutri-300" aria-label="Próximo dia"><ChevronRight size={14} aria-hidden="true" /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor="diario-date-desktop" className="sr-only">Selecionar data</label>
                        <input id="diario-date-desktop" type="date" value={diarioDate} onChange={(e) => e.target.value && setDiarioDate(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700 focus:border-nutri-400 focus:ring-2 focus:ring-nutri-100 outline-none" />
                        <button onClick={() => setDiarioDate(todayCivilSP())} className={isToday ? "px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-stone-400 text-xs font-bold" : "px-3 py-1.5 rounded-lg bg-nutri-50 border border-nutri-200 text-nutri-700 text-xs font-bold hover:bg-nutri-100"}>Hoje</button>
                      </div>
                    </div>
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => setDiarioDate(addDaysCivil(diarioDate, -1))} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-600" aria-label="Dia anterior"><ChevronLeft size={14} aria-hidden="true" /></button>
                        <span className="flex-1 text-center text-sm font-bold text-stone-800">{formatCivilDateShort(diarioDate)}</span>
                        <button onClick={() => setDiarioDate(addDaysCivil(diarioDate, 1))} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-600" aria-label="Próximo dia"><ChevronRight size={14} aria-hidden="true" /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor="diario-date-mobile" className="sr-only">Selecionar data</label>
                        <input id="diario-date-mobile" type="date" value={diarioDate} onChange={(e) => e.target.value && setDiarioDate(e.target.value)} className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700" />
                        <button onClick={() => setDiarioDate(todayCivilSP())} className={isToday ? "px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-stone-400 text-xs font-bold" : "px-3 py-1.5 rounded-lg bg-nutri-50 border border-nutri-200 text-nutri-700 text-xs font-bold"}>Hoje</button>
                      </div>
                    </div>
                  </div>

                  {loading ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="h-64 rounded-2xl bg-stone-100 animate-pulse" />
                        <div className="h-64 rounded-2xl bg-stone-100 animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <DiarioDayCard date={diarioDate} log={selectedLog} mealPlanNames={mealPlanNames} waterGoal={waterGoal} variant="primary" />
                        <DiarioDayCard date={comparisonDate} log={comparisonLog} mealPlanNames={mealPlanNames} waterGoal={waterGoal} variant="comparison" onMakePrimary={() => setDiarioDate(comparisonDate)} />
                      </div>

                      {/* Comparação neutra — somente quando há dados nos dois dias */}
                      {selectedLog && comparisonLog && (
                        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                          <h3 className="text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Comparação</h3>
                          <ul className="space-y-1.5 text-sm text-stone-700">
                            {comparison.hydrationDelta.text && <li className="flex gap-2"><span className="text-stone-400">•</span> {comparison.hydrationDelta.text}</li>}
                            {comparison.mealsDelta.text && <li className="flex gap-2"><span className="text-stone-400">•</span> {comparison.mealsDelta.text}</li>}
                            {comparison.activityDelta.text && <li className="flex gap-2"><span className="text-stone-400">•</span> {comparison.activityDelta.text}</li>}
                          </ul>
                          <p className="mt-2 text-[11px] text-stone-400">Comparação apenas entre campos equivalentes; NULL nunca como zero; sem frases conclusivas como “piorou”.</p>
                        </div>
                      )}
                      {!selectedLog && !comparisonLog && (
                        <div className="mt-4 text-center py-6 rounded-2xl border border-dashed border-stone-200 bg-white">
                          <p className="text-sm font-bold text-stone-600">Nenhum registro diário disponível.</p>
                          <p className="text-xs text-stone-500 mt-1">Selecione outra data ou verifique o preenchimento do paciente.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })()}

            {/* CHECK-INS SEMANAIS

            {/* CHECK-INS SEMANAIS            {/* CHECK-INS SEMANAIS (Timeline responsiva — Sprint Histórico/Fase 1) */}
            {activeTab === 'checkins' && (
              <CheckinsSection
                history={history}
                getMoodIcon={getMoodIcon}
              />
            )}

            {/* MEDIDAS (antropometria) — somente medidas, sem protocolo/dobras/exames */}
            {activeTab === 'antropometria' && (
              <div className="animate-in fade-in duration-300 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2.5 tracking-tight">
                      <div className="bg-nutri-50 p-2 rounded-xl border border-nutri-100 text-nutri-800"><Ruler size={18} /></div>
                      Medidas
                    </h2>
                    <p className="text-xs md:text-sm text-stone-500 mt-1 font-medium">Medidas antropométricas por data de avaliação. Sem protocolo ou exames.</p>
                  </div>
                  <button onClick={() => { setClinicalMode('anthropometry'); setIsSteppedOpen(true); }} className="inline-flex items-center gap-2 bg-nutri-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-nutri-800 transition-all shadow-md shrink-0">
                    <Plus size={16} /> Coletar medidas
                  </button>
                </div>
                <MedidasSection measurements={antroData} />
              </div>
            )}

            {/* DOBRAS / BF% — dois botões independentes: protocolo e coleta */}
            {activeTab === 'dobras' && (
              <div className="animate-in fade-in duration-300 space-y-4">
                <div className="flex flex-col gap-3 border-b border-stone-100 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2.5 tracking-tight">
                        <div className="bg-nutri-50 p-2 rounded-xl border border-nutri-100 text-nutri-800"><Layers size={18} /></div>
                        Dobras / BF%
                      </h2>
                      <p className="text-xs md:text-sm text-stone-500 mt-1 font-medium">Dobras cutâneas e composição corporal por protocolo.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button onClick={() => setIsProtocolPickerOpen(true)} className="inline-flex items-center gap-2 bg-white border border-nutri-200 text-nutri-800 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-nutri-50 transition-all shadow-sm">
                        <Layers size={16} /> Escolher protocolo
                      </button>
                      <button onClick={() => {
                        if (!dobrasProtocol) { toast.error('Escolha o protocolo antes de coletar as dobras.'); return; }
                        setClinicalMode('skinfolds'); setIsSteppedOpen(true);
                      }} className="inline-flex items-center gap-2 bg-nutri-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-nutri-800 transition-all shadow-md">
                        <Plus size={16} /> Coletar dobras
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-stone-500">Protocolo selecionado:</span>
                    {dobrasProtocol ? (
                      <span className="inline-flex items-center rounded-full border border-nutri-200 bg-nutri-50 px-3 py-1 text-xs font-black text-nutri-800">
                        {PROTOCOLS[dobrasProtocol].label}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">Nenhum protocolo selecionado</span>
                    )}
                  </div>
                </div>
                <DobrasSection skinfolds={skinfoldsData} timeline={timelineData} patientAge={patientAge} sexo={profile?.sexo} />
              </div>
            )}

            {/* EXAMES — somente resultados laboratoriais */}
            {activeTab === 'bioquimicos' && (
              <div className="animate-in fade-in duration-300 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2.5 tracking-tight">
                      <div className="bg-stone-100 p-2 rounded-xl text-stone-600"><Syringe size={18} /></div>
                      Exames
                    </h2>
                    <p className="text-xs md:text-sm text-stone-500 mt-1 font-medium">Resultados laboratoriais por data de coleta. Sem protocolo ou medidas.</p>
                  </div>
                  <button onClick={() => { setClinicalMode('biochemicals'); setIsSteppedOpen(true); }} className="inline-flex items-center gap-2 bg-nutri-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-nutri-800 transition-all shadow-md shrink-0">
                    <Plus size={16} /> Adicionar exames
                  </button>
                </div>
                <div className="space-y-8">
                  <div className="flex gap-3 text-[9px] font-bold uppercase text-stone-500 bg-stone-50 px-3 py-2 rounded-lg border border-stone-200/80 w-fit">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Atenção</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Risco</span>
                  </div>
                  {bioData.length === 0 ? (
                    <div className="text-center py-10 text-stone-400 font-medium text-sm bg-stone-50/50 rounded-2xl border-2 border-dashed border-stone-200">Nenhum exame cadastrado. Use Adicionar exames para registrar.</div>
                  ) : (
                    bioData.map((item) => {
                      const homaIr = (item.glucose && item.insulin) ? ((parseFloat(item.glucose as string) * parseFloat(item.insulin as string)) / 405).toFixed(2) : null;
                      return (
                          <div key={item.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                            <div className="bg-stone-50 px-3 py-2.5 border-b border-stone-200">
                              <span className="font-bold text-stone-700 text-xs uppercase tracking-wider flex items-center gap-2">
                                <CalendarCheck size={14} className="text-nutri-600" /> Exames laboratoriais — {new Date(item.exam_date).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-6xl">
                              {(item.glucose || item.insulin || item.hba1c || homaIr) && (
                                <div className="overflow-hidden rounded-xl border border-stone-200">
                                  <div className="bg-stone-50 px-3 py-1.5 border-b border-stone-200">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Glicêmico & Insulina</h4>
                                  </div>
                                  <div className="divide-y divide-stone-100 bg-white">
                                    {[
                                      { k: 'glucose', label: 'Glicose', v: item.glucose, unit: 'mg/dL' },
                                      { k: 'insulin', label: 'Insulina', v: item.insulin, unit: 'µUI/mL' },
                                      { k: 'hba1c', label: 'HbA1c', v: item.hba1c, unit: '%' },
                                      { k: 'homair', label: 'HOMA-IR', v: homaIr, unit: '' },
                                    ].filter(e=> e.v !== null && e.v !== undefined && String(e.v).trim() !== '').map(e=> {
                                      const interp = interpretBiochemical(e.k, Number(e.v));
                                      return (
                                        <div key={e.k} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                          <span className="text-xs font-medium text-stone-700">{e.label}</span>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm font-bold tabular-nums text-stone-800">{e.v} <span className="text-[10px] font-medium text-stone-500">{e.unit}</span></span>
                                            <ExamStatusWithTooltip examKey={e.k} status={interp.status as any} statusText={interp.text} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {(item.total_cholesterol || item.hdl || item.ldl || item.triglycerides) && (
                                <div className="overflow-hidden rounded-xl border border-stone-200">
                                  <div className="bg-stone-50 px-3 py-1.5 border-b border-stone-200">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Perfil Lipídico</h4>
                                  </div>
                                  <div className="divide-y divide-stone-100 bg-white">
                                    {[
                                      { k: 'total_cholesterol', label: 'Col. Total', v: item.total_cholesterol, unit: 'mg/dL' },
                                      { k: 'hdl', label: 'HDL', v: item.hdl, unit: 'mg/dL' },
                                      { k: 'ldl', label: 'LDL', v: item.ldl, unit: 'mg/dL' },
                                      { k: 'triglycerides', label: 'Triglicerídeos', v: item.triglycerides, unit: 'mg/dL' },
                                    ].filter(e=> e.v !== null && e.v !== undefined && String(e.v).trim() !== '').map(e=> {
                                      const interp = interpretBiochemical(e.k, Number(e.v));
                                      return (
                                        <div key={e.k} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                          <span className="text-xs font-medium text-stone-700">{e.label}</span>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm font-bold tabular-nums text-stone-800">{e.v} <span className="text-[10px] font-medium text-stone-500">{e.unit}</span></span>
                                            <ExamStatusWithTooltip examKey={e.k} status={interp.status as any} statusText={interp.text} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {(item.ferritin || item.pcr || item.tgp || item.creatinine || item.urea) && (
                                <div className="overflow-hidden rounded-xl border border-stone-200">
                                  <div className="bg-stone-50 px-3 py-1.5 border-b border-stone-200">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Inflamação & Órgãos</h4>
                                  </div>
                                  <div className="divide-y divide-stone-100 bg-white">
                                    {[
                                      { k: 'ferritin', label: 'Ferritina', v: item.ferritin, unit: 'ng/mL' },
                                      { k: 'pcr', label: 'PCR', v: item.pcr, unit: 'mg/dL' },
                                      { k: 'tgp', label: 'TGP', v: item.tgp, unit: 'U/L' },
                                      { k: 'creatinine', label: 'Creatinina', v: item.creatinine, unit: 'mg/dL' },
                                      { k: 'urea', label: 'Ureia', v: item.urea, unit: 'mg/dL' },
                                    ].filter(e=> e.v !== null && e.v !== undefined && String(e.v).trim() !== '').map(e=> {
                                      const interp = interpretBiochemical(e.k, Number(e.v));
                                      return (
                                        <div key={e.k} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                          <span className="text-xs font-medium text-stone-700">{e.label}</span>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm font-bold tabular-nums text-stone-800">{e.v} <span className="text-[10px] font-medium text-stone-500">{e.unit}</span></span>
                                            <ExamStatusWithTooltip examKey={e.k} status={interp.status as any} statusText={interp.text} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {(item.vitamin_d || item.vitamin_b12 || item.tsh || item.iron) && (
                                <div className="overflow-hidden rounded-xl border border-stone-200">
                                  <div className="bg-stone-50 px-3 py-1.5 border-b border-stone-200">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Vitaminas & Hormonal</h4>
                                  </div>
                                  <div className="divide-y divide-stone-100 bg-white">
                                    {[
                                      { k: 'vitamin_d', label: 'Vit. D', v: item.vitamin_d, unit: 'ng/mL' },
                                      { k: 'vitamin_b12', label: 'Vit. B12', v: item.vitamin_b12, unit: 'pg/mL' },
                                      { k: 'tsh', label: 'TSH', v: item.tsh, unit: 'µUI/mL' },
                                      { k: 'iron', label: 'Ferro Sérico', v: item.iron, unit: 'µg/dL' },
                                    ].filter(e=> e.v !== null && e.v !== undefined && String(e.v).trim() !== '').map(e=> {
                                      const interp = interpretBiochemical(e.k, Number(e.v));
                                      return (
                                        <div key={e.k} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                          <span className="text-xs font-medium text-stone-700">{e.label}</span>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm font-bold tabular-nums text-stone-800">{e.v} <span className="text-[10px] font-medium text-stone-500">{e.unit}</span></span>
                                            <ExamStatusWithTooltip examKey={e.k} status={interp.status as any} statusText={interp.text} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* COPILOTO */}
            {activeTab === 'copiloto' && (
              <CopilotTab profile={profile} history={history} dailyLogs={dailyLogs} />
            )}

          </div>
        </section>

        {/* MODAL DE RADAR EXPANDIDO (PREMIUM GLASS) */}
        {isRadarExpanded && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-stone-800 w-full max-w-3xl max-h-[85vh] sm:max-h-[80vh] rounded-t-[2.5rem] sm:rounded-[3rem] overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
              <div className="p-6 md:p-8 border-b border-stone-800 flex items-center justify-between bg-stone-900 shrink-0">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
                    <Zap className="text-amber-400" size={24} /> Radar IA
                  </h2>
                  <p className="text-[10px] md:text-xs text-stone-400 font-medium mt-1">Insights detectados no perfil</p>
                </div>
                <button 
                  onClick={() => setIsRadarExpanded(false)}
                  className="bg-stone-800 hover:bg-stone-700 w-10 h-10 rounded-full text-stone-400 flex items-center justify-center transition-all"
                >
                  <AlertCircle size={20} className="rotate-45" />
                </button>
              </div>
              
              <div className="p-6 md:p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 custom-scrollbar bg-stone-950/30">
                {activeAlerts.map(alert => {
                  const isContacted = contactedAlerts.has(alert.id);
                  
                  return (
                    <div key={alert.id} className={`p-5 rounded-3xl border flex flex-col justify-between transition-colors relative overflow-hidden ${
                      alert.type === 'danger' ? 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40' : 
                      alert.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' : 
                      'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                    }`}>
                       <div className="flex items-start gap-3 mb-5 relative z-10">
                          <div className={`p-2.5 rounded-2xl shrink-0 ${
                            alert.type === 'danger' ? 'bg-rose-500/20 text-rose-400' : 
                            alert.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 
                            'bg-emerald-500/20 text-emerald-400'
                          }`}> {alert.icon} </div>
                          <h4 className="text-sm font-semibold text-stone-200 mt-1 leading-snug">{alert.text}</h4>
                       </div>
                       
                       {alert.waLink && (
                          <a 
                            href={alert.waLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={() => handleContactAlert(alert.id)}
                            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest h-11 rounded-xl transition-all w-full justify-center mt-auto border relative z-10 ${
                              isContacted 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'text-stone-300 bg-white/5 hover:bg-white/10 border-white/10'
                            }`}
                          >
                            {isContacted ? (
                              <><CheckCircle2 size={16} /> Enviada</>
                            ) : (
                              <><MessageCircle size={16} /> {alert.waText}</>
                            )}
                          </a>
                       )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal escalonado — modo independente por aba (sem protocolo em Medidas/Exames) */}
      {(() => {
        const USE_STEPPED_HISTORICO = true;
        const protocolForModal = clinicalMode === 'skinfolds' ? dobrasProtocol : undefined;
        return USE_STEPPED_HISTORICO ? (
          <ClinicalDataModalStepped
            isOpen={isSteppedOpen}
            onClose={() => { setIsSteppedOpen(false); fetchData(); }}
            patientId={pacienteId}
            patientName={profile?.full_name || ''}
            patientSex={profile?.sexo ?? null}
            protocol={protocolForModal}
            mode={clinicalMode}
          />
        ) : (
          <ClinicalDataModal
            isOpen={isSteppedOpen}
            onClose={() => { setIsSteppedOpen(false); fetchData(); }}
            patientId={pacienteId}
            patientName={profile?.full_name || ''}
            patientSex={profile?.sexo ?? null}
            protocol={protocolForModal as any}
          />
        );
      })()}

      {/* Picker de protocolo para Dobras/BF% — dois botões independentes */}
      {isProtocolPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-black text-stone-800 mb-1">Escolher protocolo</h3>
            <p className="text-xs text-stone-500 mb-4">Selecione o protocolo que será usado na coleta de dobras.</p>
            <div className="space-y-2">
              {(['jp3','jp7','petroski4'] as const).map(p => (
                <button key={p} onClick={() => { setDobrasProtocol(p); setIsProtocolPickerOpen(false); toast.success(`Protocolo ${PROTOCOLS[p].label} selecionado`); }} className={cn("w-full text-left px-4 py-3 rounded-xl border font-bold text-sm transition-all", dobrasProtocol===p ? "bg-nutri-900 text-white border-nutri-900" : "bg-white border-stone-200 hover:bg-stone-50 text-stone-700")}>
                  {PROTOCOLS[p].label}
                </button>
              ))}
            </div>
            <button onClick={() => setIsProtocolPickerOpen(false)} className="mt-4 w-full py-2.5 rounded-xl border border-stone-200 font-bold text-sm hover:bg-stone-50">Cancelar</button>
          </div>
        </div>
      )}
    </main>
  );
}
