'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, ChevronLeft, TrendingUp, User, Ruler, Layers, 
  Syringe, CalendarCheck, BookOpen, Trash2, AlertCircle, 
  CheckCircle2, AlertTriangle, Activity, Target, Clock, Zap, 
  ChevronRight, Scale, Droplets, Smile, Frown, Meh, 
  Coffee, Check, Brain, Flame, MessageCircle, ClipboardList, 
  Stethoscope, ListChecks, Save, MoveRight
} from 'lucide-react';
import Link from 'next/link';
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Scatter 
} from 'recharts';
import { toast } from 'sonner';

import MetabolicSummary from '@/components/admin/MetabolicSummary';
// 🔥 Importamos o motor de cálculo e validador de QFA para usar no componente Pai
import { generateRecommendation, validateQFAConsistency } from '@/lib/nutrition'; 
import { getPatientMetabolicData } from '@/lib/getPatientMetabolicData';
// NOVO: Tipos para o perfil alimentar
import { FoodRestriction } from '@/types/patient';

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
}

interface CheckinData {
  id: string;
  created_at: string;
  peso: number;
  altura: number;
  imc: number;
  adesao_ao_plano: number;
  humor_semanal: number;
  comentarios: string;
}

interface AntroData {
  id: string;
  measurement_date: string;
  weight?: string | number;
  height?: string | number;
  waist?: string | number;
  hip?: string | number;
  arm?: string | number;
  calf?: string | number;
  neck?: string | number;
}

interface SkinfoldsData {
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
}

interface BioData {
  id: string;
  exam_date: string;
  [key: string]: any; 
}

interface DailyLog {
  id: string;
  date: string;
  water_ml: number;
  mood: string;
  meals_checked: string[];
  activity_kcal?: number;
  activities?: any[];
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
  
  // NOVO: Estados para o perfil alimentar e QFA
  const [foodRestrictions, setFoodRestrictions] = useState<FoodRestriction[]>([]);
  const [qfaResponses, setQfaResponses] = useState<Record<string, string>>({});

  const [soapNote, setSoapNote] = useState({ s: '', o: '', a: '', p: '' });
  const [savingNote, setSavingNote] = useState(false);

  const [activeTab, setActiveTab] = useState<'prontuario' | 'diario' | 'checkins' | 'antropometria' | 'dobras' | 'bioquimicos'>('prontuario');
  const [activeLens, setActiveLens] = useState<'medidas' | 'composicao' | 'metabolico'>('medidas');
  
  const [isRadarExpanded, setIsRadarExpanded] = useState(false);
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
      if (!session || session.user.email !== 'vankadosh@gmail.com') {
        router.push('/login');
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
        qfaRes // NOVO: Busca do QFA
      ] = await Promise.all([
        supabase.from('checkins').select('*').eq('user_id', pacienteId).order('created_at', { ascending: true }),
        supabase.from('anthropometry').select('*').eq('user_id', pacienteId).order('measurement_date', { ascending: false }),
        supabase.from('skinfolds').select('*').eq('user_id', pacienteId).order('measurement_date', { ascending: false }),
        supabase.from('biochemicals').select('*').eq('user_id', pacienteId).order('exam_date', { ascending: false }),
        supabase.from('clinical_notes').select('*').eq('user_id', pacienteId).order('created_at', { ascending: false }),
        supabase.from('daily_logs').select('*').eq('user_id', pacienteId).order('date', { ascending: false }),
        supabase.from('qfa_responses').select('answers').eq('user_id', pacienteId).single() // NOVO
      ]);
      
      const processedHistory = checkinRes.data?.map(item => ({
        ...item,
        imc: item.altura ? (item.peso / (item.altura * item.altura)) : 0
      })) as CheckinData[] || [];

      setProfile(profileData as PatientProfile);
      setHistory(processedHistory);
      setAntroData(antroRes.data || []);
      setSkinfoldsData(skinRes.data || []);
      setBioData(bioRes.data || []);
      setNotes(notesRes.data || []);
      setDailyLogs(dailyRes.data || []);
      
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
  // FUNÇÕES DE CÁLCULO E INTERPRETAÇÃO
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

  const calculateBodyComposition = (sum7: number, age: number | null, gender: string | undefined, weight: number) => {
    if (!sum7 || sum7 === 0 || !weight || age === null) return null; 
    
    let bd = 0;
    const isMale = gender?.toLowerCase() === 'masculino' || gender?.toLowerCase() === 'homem';
    
    if (isMale) {
      bd = 1.112 - (0.00043499 * sum7) + (0.00000055 * (sum7 * sum7)) - (0.00028826 * age);
    } else {
      bd = 1.097 - (0.00046971 * sum7) + (0.00000056 * (sum7 * sum7)) - (0.00012828 * age);
    }

    if (bd === 0) return null;
    const bf = (4.95 / bd - 4.5) * 100; 
    const validBF = bf > 0 && bf < 60 ? bf : null;

    if (!validBF) return null;

    const fatMass = weight * (validBF / 100);
    const leanMass = weight - fatMass;

    return { 
      bf: validBF.toFixed(1), 
      fatMass: fatMass.toFixed(1), 
      leanMass: leanMass.toFixed(1) 
    };
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
          value = ((parseFloat(latestBio.glucose) * parseFloat(latestBio.insulin)) / 405).toFixed(2);
        }
        if(value !== null && value !== undefined) {
          const analysis = interpretBiochemical(key, parseFloat(value));
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

    let defaultHeightRaw = antroData.find(a => a.height)?.height || history.find(h => h.altura)?.altura || profile?.altura || null;
    const defaultHeight = defaultHeightRaw ? parseFloat(defaultHeightRaw.toString()) : null;

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

      let sumFolds: number | null = null;
      let bf: number | null = null;
      let fatMass: number | null = null;
      let leanMass: number | null = null;
      
      if (skin) {
        const s1 = parseFloat(skin.triceps?.toString()||"0") + parseFloat(skin.biceps?.toString()||"0") + parseFloat(skin.subscapular?.toString()||"0") + parseFloat(skin.axillary_media?.toString()||"0") + parseFloat(skin.pectoral?.toString()||"0") + parseFloat(skin.suprailiac?.toString()||"0") + parseFloat(skin.abdominal?.toString()||"0") + parseFloat(skin.thigh?.toString()||"0") + parseFloat(skin.calf?.toString()||"0");
        if (s1 > 0) {
          sumFolds = parseFloat(s1.toFixed(1));
          if (currentWeight && patientAge !== null) {
            const comp = calculateBodyComposition(s1, patientAge, profile?.sexo, currentWeight);
            if (comp) {
              bf = parseFloat(comp.bf);
              fatMass = parseFloat(comp.fatMass);
              leanMass = parseFloat(comp.leanMass);
            }
          }
        }
      }

      let homa: number | null = null;
      if (bio && bio.glucose && bio.insulin) {
        homa = parseFloat(((parseFloat(bio.glucose) * parseFloat(bio.insulin)) / 405).toFixed(2));
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
        homair: homa,
        adesao: checkin?.adesao_ao_plano || null,
        hasExam: !!bio, 
      };
    });
  }, [history, antroData, skinfoldsData, bioData, profile, patientAge]);

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

    // 🔥 EXTRAIR COMPOSIÇÃO CORPORAL MAIS RECENTE PARA O CHATBOT (Jackson & Pollock)
  const latestBodyComposition = useMemo(() => {
    if (timelineData.length === 0) return null;
    
    // Encontrar o ponto mais recente com dados de composição
    const latestComposition = [...timelineData].reverse().find(t => t.bf !== null);
    
    if (!latestComposition) return null;
    
    // Calcular evolução comparando com o primeiro registro
    const firstComposition = timelineData.find(t => t.bf !== null);
    
    let evolucaoGordura = '';
    let evolucaoMassaMagra = '';
    
    if (firstComposition && firstComposition.bf !== null && latestComposition.bf !== null) {
      const diffGordura = latestComposition.bf - firstComposition.bf;
      if (diffGordura < 0) {
        evolucaoGordura = `Reduziu ${Math.abs(diffGordura).toFixed(1)}% de gordura corporal`;
      } else if (diffGordura > 0) {
        evolucaoGordura = `Aumentou ${diffGordura.toFixed(1)}% de gordura corporal`;
      } else {
        evolucaoGordura = `Manteve o percentual de gordura`;
      }
    }
    
    if (firstComposition && firstComposition.leanMass !== null && latestComposition.leanMass !== null) {
      const diffMagra = latestComposition.leanMass - firstComposition.leanMass;
      if (diffMagra > 0) {
        evolucaoMassaMagra = `Ganhou ${diffMagra.toFixed(1)}kg de massa magra`;
      } else if (diffMagra < 0) {
        evolucaoMassaMagra = `Perdeu ${Math.abs(diffMagra).toFixed(1)}kg de massa magra`;
      } else {
        evolucaoMassaMagra = `Manteve a massa magra`;
      }
    }
    
    return {
      percentualGordura: latestComposition.bf,
      massaGorda: latestComposition.fatMass,
      massaMagra: latestComposition.leanMass,
      ultimaAvaliacao: latestComposition.date,
      evolucaoGordura,
      evolucaoMassaMagra
    };
  }, [timelineData]);

  // =========================================================================
  // 🔥 LÓGICA DE FONTE ÚNICA DE VERDADE (SINGLE SOURCE OF TRUTH)
  // Calculamos a recomendação AQUI no Pai e enviamos para os filhos
  // =========================================================================

  const avgActivityKcal = useMemo(() => {
    if (!dailyLogs || dailyLogs.length === 0) return 0;
    const last7 = dailyLogs.slice(0, 7);
    const total = last7.reduce((acc, log) => acc + (Number(log.activity_kcal) || 0), 0);
    return Math.round(total / 7);
  }, [dailyLogs]);

  const { tmb, tmbMethod } = useMemo(() => {
    const weight = latestMetabolicData.weight;
    const height = latestMetabolicData.height;
    const age = patientAge;
    const leanMass = latestMetabolicData.leanMass;
    const gender = profile?.sexo;

    if (!weight || !height || !age) return { tmb: 0, tmbMethod: '' };

    const normalizedHeight = height < 3 ? height * 100 : height;
    const g = gender?.toLowerCase().trim() || '';
    const isFemale = ['f', 'feminino', 'female', 'mulher'].some(v => g.startsWith(v));
    const sex: 'M' | 'F' = isFemale ? 'F' : 'M';

    if (leanMass && leanMass > 0) {
      return {
        tmb: Math.round(370 + (21.6 * leanMass)),
        tmbMethod: 'Katch-McArdle (via Massa Magra)'
      };
    }

    const calc = sex === 'M'
        ? (10 * weight) + (6.25 * normalizedHeight) - (5 * age) + 5
        : (10 * weight) + (6.25 * normalizedHeight) - (5 * age) - 161;

    return {
      tmb: Math.round(calc),
      tmbMethod: 'Mifflin-St Jeor (Estimativa)'
    };
  }, [latestMetabolicData, patientAge, profile?.sexo]);

  const getVal = useMemo(() => {
    return tmb > 0 ? Math.round((tmb * 1.2) + avgActivityKcal) : 0;
  }, [tmb, avgActivityKcal]);

  const weightTrend = useMemo(() => {
      if (history.length < 2) return 'stable';
      const w1 = history[history.length - 1].peso;
      const w2 = history[history.length - 2].peso;
      const diff = w1 - w2;
      if (diff <= -0.5) return 'losing';
      if (diff >= 0.5) return 'gaining';
      return 'stable';
  }, [history]);

  const masterRecommendation = useMemo(() => {
    // 🔥 BLOQUEIO CLÍNICO DE SEGURANÇA
    if (hasCriticalFoodRisk) return null;

    if (!tmb || !getVal || !latestMetabolicData.weight) return null;

    return generateRecommendation({
      weight: latestMetabolicData.weight,
      height: latestMetabolicData.height,
      bf: latestMetabolicData.bf,
      leanMass: latestMetabolicData.leanMass,
      tmb,
      get: getVal,
      avgActivity: avgActivityKcal,
      gender: profile?.sexo,
      weightTrend 
    });
  }, [tmb, getVal, latestMetabolicData, avgActivityKcal, profile?.sexo, weightTrend, hasCriticalFoodRisk]);


  const dangerCount = activeAlerts.filter(a => a.type === 'danger').length;
  const warningCount = activeAlerts.filter(a => a.type === 'warning').length;
  const successCount = activeAlerts.filter(a => a.type === 'success').length;

  // =========================================================================
  // SUB-COMPONENTES
  // =========================================================================
  const ExamBadge = ({ label, value, unit, type }: { label: string, value: any, unit: string, type: string }) => {
    const analysis = interpretBiochemical(type, value ? parseFloat(value) : null);
    if (value === null || value === undefined || isNaN(value)) return null;

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
            <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-0.5">Prontuário Eletrônico</p>
            <h1 className="text-lg md:text-2xl lg:text-3xl font-extrabold text-stone-900 flex items-center justify-end gap-2 tracking-tight truncate">
              <User size={20} className="text-nutri-600 hidden sm:block" /> 
              <span className="truncate">{profile?.full_name}</span>
            </h1>
          </div>
        </nav>

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
                    content={({ active, payload, label }) => {
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
                  
                  <Scatter yAxisId="left" dataKey="hasExam" shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (!payload.hasExam) return <g></g>;
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
              { id: 'prontuario', label: 'S.O.A.P', icon: <BookOpen size={14} /> },
              { id: 'diario', label: 'Diário', icon: <Coffee size={14} /> },
              { id: 'checkins', label: 'Check-ins', icon: <CalendarCheck size={14} /> },
              { id: 'antropometria', label: 'Medidas', icon: <Ruler size={14} /> },
              { id: 'dobras', label: 'Dobras/BF%', icon: <Layers size={14} /> },
              { id: 'bioquimicos', label: 'Exames', icon: <Activity size={14} /> }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
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

            {/* DIÁRIO NO APP (WIDGETS) */}
            {activeTab === 'diario' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 gap-2 md:gap-4">
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2.5 tracking-tight">
                      <div className="bg-stone-100 p-2 rounded-xl text-stone-600"><Coffee size={18} /></div>
                      Diário do Paciente
                    </h2>
                    <p className="text-xs md:text-sm text-stone-500 mt-1 font-medium">Registro diário de água, humor, refeições e treino.</p>
                  </div>
                </div>

                {dailyLogs.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 font-medium text-sm bg-stone-50/50 rounded-2xl md:rounded-[2.5rem] border-2 border-dashed border-stone-200 flex flex-col items-center justify-center">
                    <Coffee size={40} className="mb-3 text-stone-300 opacity-50" />
                    <p>Sem registros no diário no momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                    {dailyLogs.map((log) => {
                      const mealCount = Array.isArray(log.meals_checked) ? log.meals_checked.length : 0;
                      return (
                        <div key={log.id} className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all relative flex flex-col">
                          <div className="flex justify-between items-center mb-5 border-b border-stone-100 pb-4">
                            <div>
                              <p className="text-[9px] md:text-[10px] font-bold uppercase text-stone-400 tracking-widest mb-0.5">Data</p>
                              <h3 className="font-extrabold text-stone-800 text-sm md:text-base">{new Date(log.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</h3>
                            </div>
                            <div title={`Humor: ${log.mood || 'Não informado'}`}>{getMoodIcon(log.mood)}</div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
                            {/* Água */}
                            <div className="bg-blue-50/60 p-3 md:p-4 rounded-xl md:rounded-2xl border border-blue-100/50 flex flex-col justify-center items-center text-center">
                              <Droplets size={18} className="text-blue-500 mb-1.5" />
                              <p className="text-xl md:text-2xl font-black text-blue-900 tracking-tight">{log.water_ml || 0} <span className="text-[10px] font-bold text-blue-500">ml</span></p>
                              <p className="text-[9px] md:text-[10px] font-bold text-blue-400/80 uppercase tracking-widest mt-1">Hidratação</p>
                            </div>
                            {/* Refeições */}
                            <div className="bg-emerald-50/60 p-3 md:p-4 rounded-xl md:rounded-2xl border border-emerald-100/50 flex flex-col justify-center items-center text-center">
                              <Check size={18} className="text-emerald-500 mb-1.5" />
                              <p className="text-xl md:text-2xl font-black text-emerald-900 tracking-tight">{mealCount}</p>
                              <p className="text-[9px] md:text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest mt-1">Refeições</p>
                            </div>
                          </div>

                          {/* Exercício */}
                          {(log.activity_kcal && log.activity_kcal > 0) ? (
                            <div className="bg-orange-50/60 p-3 md:p-4 rounded-xl md:rounded-2xl border border-orange-100/50 flex justify-between items-center text-left">
                               <div>
                                 <p className="text-[9px] md:text-[10px] font-bold text-orange-500/80 uppercase tracking-widest mb-0.5">Treino (Gasto)</p>
                                 <p className="text-lg md:text-xl font-black text-orange-900 tracking-tight">{log.activity_kcal} <span className="text-[10px] font-bold text-orange-600">kcal</span></p>
                               </div>
                               <div className="bg-white p-2 rounded-lg shadow-sm border border-orange-100/50">
                                 <Flame size={20} className="text-orange-500" />
                               </div>
                            </div>
                          ) : (
                            <div className="bg-stone-50/80 p-3 md:p-4 rounded-xl md:rounded-2xl border border-stone-100 flex items-center justify-center h-full">
                              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5"><Activity size={12}/> Sem Treino</p>
                            </div>
                          )}

                          {mealCount > 0 && (
                            <div className="mt-4 md:mt-5 pt-4 border-t border-stone-100">
                              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-2.5">Refeições checadas:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {log.meals_checked.map((meal: string, idx: number) => (
                                  <span key={idx} className="bg-stone-100/80 text-stone-600 text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-md border border-stone-200/50 truncate max-w-full">
                                    {meal}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CHECK-INS SEMANAIS (Tabela Responsiva) */}
            {activeTab === 'checkins' && (
              <div className="animate-in fade-in duration-300">
                <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-stone-900 flex items-center gap-2.5 tracking-tight">
                  <div className="bg-stone-100 p-2 rounded-xl text-stone-600"><CalendarCheck size={18} /></div>
                  Histórico de Check-ins
                </h2>
                <div className="overflow-x-auto rounded-2xl md:rounded-3xl border border-stone-200 shadow-sm scrollbar-hide bg-white">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="bg-stone-50/80">
                      <tr>
                        <th className="py-4 px-5 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200 whitespace-nowrap">Data</th>
                        <th className="py-4 px-5 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200">Peso</th>
                        <th className="py-4 px-5 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200 text-center">Adesão</th>
                        <th className="py-4 px-5 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200 text-center">Humor</th>
                        <th className="py-4 px-5 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200">Comentários</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {history.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-10 text-stone-400 text-sm font-medium italic">Nenhum check-in registrado.</td></tr>
                      )}
                      {history.slice().reverse().map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-4 px-5 font-bold text-stone-800 text-xs md:text-sm whitespace-nowrap">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-5 font-extrabold text-xs md:text-sm text-emerald-600">{item.peso} kg</td>
                          <td className="py-4 px-5 text-xs text-center">
                            <span className={`inline-flex px-2 py-1 rounded-lg font-bold tracking-wider border ${item.adesao_ao_plano >= 4 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                              {item.adesao_ao_plano}/5
                            </span>
                          </td>
                          <td className="py-4 px-5 font-bold text-xs text-stone-500 text-center">
                            {item.humor_semanal}/5
                          </td>
                          <td className="py-4 px-5 text-xs text-stone-600 font-medium max-w-[200px] truncate" title={item.comentarios}>{item.comentarios || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ANTROPOMETRIA (Tabela Responsiva) */}
            {activeTab === 'antropometria' && (
              <div className="animate-in fade-in duration-300">
                <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-stone-900 flex items-center gap-2.5 tracking-tight">
                  <div className="bg-stone-100 p-2 rounded-xl text-stone-600"><Ruler size={18} /></div>
                  Circunferências
                </h2>
                <div className="overflow-x-auto rounded-2xl md:rounded-3xl border border-stone-200 shadow-sm scrollbar-hide bg-white">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-stone-50/80">
                      <tr>
                        <th className="py-4 px-5 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200">Data</th>
                        <th className="py-4 px-4 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200">Peso</th>
                        <th className="py-4 px-4 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200">Cintura</th>
                        <th className="py-4 px-4 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200">Quadril</th>
                        <th className="py-4 px-4 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200">Braço</th>
                        <th className="py-4 px-4 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200">Pant.</th>
                        <th className="py-4 px-4 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200">Pesc.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {antroData.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-10 text-stone-400 text-sm font-medium italic">Nenhuma medida cadastrada.</td></tr>
                      )}
                      {antroData.map(i => (
                        <tr key={i.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-4 px-5 font-bold text-xs md:text-sm text-stone-800 whitespace-nowrap">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-4 font-extrabold text-xs md:text-sm text-emerald-600">{i.weight ? `${i.weight} kg` : '-'}</td>
                          <td className="py-4 px-4 font-medium text-xs md:text-sm text-stone-600">{i.waist ? `${i.waist}` : '-'}</td>
                          <td className="py-4 px-4 font-medium text-xs md:text-sm text-stone-600">{i.hip ? `${i.hip}` : '-'}</td>
                          <td className="py-4 px-4 font-medium text-xs md:text-sm text-stone-600">{i.arm ? `${i.arm}` : '-'}</td>
                          <td className="py-4 px-4 font-medium text-xs md:text-sm text-stone-600">{i.calf ? `${i.calf}` : '-'}</td>
                          <td className="py-4 px-4 font-medium text-xs md:text-sm text-stone-600">{i.neck ? `${i.neck}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DOBRAS E COMPOSIÇÃO: Redesenhado Hermético e Comparativo Avançado */}
            {activeTab === 'dobras' && (
              <div className="animate-in fade-in duration-300">
                {skinfoldsData.length > 0 && timelineData.length > 0 && (
                  <div className="bg-stone-900 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 mb-6 md:mb-8 text-white flex flex-col gap-5 md:gap-6 shadow-xl relative overflow-hidden border border-stone-800">
                    <div className="absolute -right-20 -top-20 w-60 h-60 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10">
                      <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                        <Layers size={14}/> Composição Corporal 
                        <span className="hidden sm:inline">(Jackson & Pollock)</span>
                      </h3>
                      <p className="text-xs md:text-sm font-medium text-stone-400 mt-1.5">
                        {patientAge !== null 
                          ? `Protocolo 7 dobras. Idade: ${patientAge} anos (${profile?.sexo || 'Indefinido'}).`
                          : <span className="text-rose-300 flex items-center gap-1 font-bold text-xs"><AlertCircle size={12}/> Idade ausente no perfil.</span>
                        }
                      </p>
                    </div>
                    
                    {(() => {
                      const latestSkin = skinfoldsData[0];
                      const s1 = parseFloat(latestSkin.triceps?.toString()||"0") + parseFloat(latestSkin.biceps?.toString()||"0") + parseFloat(latestSkin.subscapular?.toString()||"0") + parseFloat(latestSkin.suprailiac?.toString()||"0") + parseFloat(latestSkin.abdominal?.toString()||"0") + parseFloat(latestSkin.thigh?.toString()||"0") + parseFloat(latestSkin.calf?.toString()||"0");
                      const currentPoint = timelineData.slice().reverse().find(t => t.somatorio_dobras === parseFloat(s1.toFixed(1)));
                      
                      const initialPoint = timelineData.find(t => t.bf !== null && t.bf !== undefined);

                      let targetImc: string | null = null;
                      const defaultHeightRaw = antroData.find(a => a.height)?.height || profile?.altura || null;
                      const defaultHeight = defaultHeightRaw ? parseFloat(defaultHeightRaw.toString()) : null;
                      
                      if (profile?.meta_peso && defaultHeight) {
                        targetImc = (profile.meta_peso / (defaultHeight * defaultHeight)).toFixed(1);
                      }

                      if (currentPoint && currentPoint.bf && patientAge !== null) {
                        
                        const getDelta = (current: number, initial: number) => (current - initial).toFixed(1);
                        const renderDelta = (delta: string, reverseColors = false) => {
                          const val = parseFloat(delta);
                          if (isNaN(val) || val === 0) return <span className="text-stone-500">Mantido</span>;
                          const isPositive = val > 0;
                          
                          let colorClass = isPositive ? 'text-emerald-400' : 'text-rose-400';
                          if (reverseColors) {
                            colorClass = isPositive ? 'text-rose-400' : 'text-emerald-400';
                          }

                          return (
                            <span className={`font-bold flex items-center gap-0.5 ${colorClass}`}>
                              {isPositive ? '+' : ''}{delta}
                            </span>
                          );
                        };

                        return (
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 w-full relative z-10 border-t border-white/10 pt-5">
                            
                            {/* CARD IMC */}
                            <div className="flex flex-col bg-white/5 backdrop-blur-md p-4 rounded-xl md:rounded-2xl border border-white/10 shadow-inner">
                              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-cyan-200/50 mb-1.5">Índice IMC</span>
                              <div className="flex items-baseline mb-3">
                                <span className="text-2xl md:text-3xl font-black text-cyan-400 tracking-tight">{currentPoint.imc || '-'}</span>
                              </div>
                              <div className="mt-auto pt-3 border-t border-white/5 flex flex-col gap-1 text-[9px] font-bold tracking-widest uppercase text-stone-500">
                                {initialPoint?.imc && (
                                  <>
                                    <span className="flex justify-between">Início: <span className="text-cyan-100/70">{initialPoint.imc}</span></span>
                                    <span className="flex justify-between mt-0.5">Evol: {renderDelta(getDelta(currentPoint.imc!, initialPoint.imc), true)}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* CARD GORDURA */}
                            <div className="flex flex-col bg-white/5 backdrop-blur-md p-4 rounded-xl md:rounded-2xl border border-white/10 shadow-inner">
                              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-amber-200/50 mb-1.5">% Gordura</span>
                              <div className="flex items-baseline mb-3">
                                <span className="text-2xl md:text-3xl font-black text-amber-400 tracking-tight">{currentPoint.bf}</span>
                                <span className="text-xs font-bold text-amber-400/50 ml-1 uppercase">%</span>
                              </div>
                              <div className="mt-auto pt-3 border-t border-white/5 flex flex-col gap-1 text-[9px] font-bold tracking-widest uppercase text-stone-500">
                                {initialPoint?.bf && (
                                  <>
                                    <span className="flex justify-between">Início: <span className="text-amber-100/70">{initialPoint.bf}%</span></span>
                                    <span className="flex justify-between mt-0.5">Evol: {renderDelta(getDelta(currentPoint.bf, initialPoint.bf), true)}%</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* CARD MASSA MAGRA */}
                            <div className="flex flex-col bg-white/5 backdrop-blur-md p-4 rounded-xl md:rounded-2xl border border-white/10 shadow-inner">
                              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-200/50 mb-1.5">Massa Magra</span>
                              <div className="flex items-baseline mb-3">
                                <span className="text-2xl md:text-3xl font-black text-emerald-400 tracking-tight">{currentPoint.leanMass}</span>
                                <span className="text-xs font-bold text-emerald-400/50 ml-1 uppercase">kg</span>
                              </div>
                              <div className="mt-auto pt-3 border-t border-white/5 flex flex-col gap-1 text-[9px] font-bold tracking-widest uppercase text-stone-500">
                                {initialPoint?.leanMass && (
                                  <>
                                    <span className="flex justify-between">Início: <span className="text-emerald-100/70">{initialPoint.leanMass}</span></span>
                                    <span className="flex justify-between mt-0.5">Evol: {renderDelta(getDelta(currentPoint.leanMass!, initialPoint.leanMass))} kg</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* CARD MASSA GORDA */}
                            <div className="flex flex-col bg-white/5 backdrop-blur-md p-4 rounded-xl md:rounded-2xl border border-white/10 shadow-inner">
                              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-rose-200/50 mb-1.5">Massa Gorda</span>
                              <div className="flex items-baseline mb-3">
                                <span className="text-2xl md:text-3xl font-black text-rose-400 tracking-tight">{currentPoint.fatMass}</span>
                                <span className="text-xs font-bold text-rose-400/50 ml-1 uppercase">kg</span>
                              </div>
                              <div className="mt-auto pt-3 border-t border-white/5 flex flex-col gap-1 text-[9px] font-bold tracking-widest uppercase text-stone-500">
                                {initialPoint?.fatMass && (
                                  <>
                                    <span className="flex justify-between">Início: <span className="text-rose-100/70">{initialPoint.fatMass}</span></span>
                                    <span className="flex justify-between mt-0.5">Evol: {renderDelta(getDelta(currentPoint.fatMass!, initialPoint.fatMass), true)} kg</span>
                                  </>
                                )}
                              </div>
                            </div>

                          </div>
                        )
                      }
                      return <p className="text-xs md:text-sm font-bold text-amber-300 italic mt-4 bg-amber-900/30 p-4 rounded-xl border border-amber-500/20">O peso do paciente deve ser atualizado na mesma data das dobras para cálculo da composição.</p>;
                    })()}
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl md:rounded-3xl border border-stone-200 shadow-sm scrollbar-hide bg-white">
                  <table className="w-full text-left min-w-[900px]">
                    <thead className="bg-stone-50/80">
                      <tr>
                        <th className="py-4 px-5 text-[10px] text-stone-500 uppercase font-bold tracking-widest border-b border-stone-200 whitespace-nowrap">Data</th>
                        <th className="py-4 px-4 text-[10px] text-stone-800 uppercase font-bold tracking-widest border-b border-stone-200">Soma</th>
                        <th className="py-4 px-4 text-[10px] text-cyan-600 uppercase font-bold tracking-widest border-b border-stone-200">IMC</th>
                        <th className="py-4 px-4 text-[10px] text-amber-500 uppercase font-bold tracking-widest border-b border-stone-200">BF%</th>
                        <th className="py-4 px-4 text-[10px] text-emerald-600 uppercase font-bold tracking-widest border-b border-stone-200">M. Magra</th>
                        <th className="py-4 px-4 text-[10px] text-stone-400 uppercase font-bold tracking-widest pl-5 border-l border-stone-200 border-b">Tri</th>
                        <th className="py-4 px-3 text-[10px] text-stone-400 uppercase font-bold tracking-widest border-b border-stone-200">Bic</th>
                        <th className="py-4 px-3 text-[10px] text-stone-400 uppercase font-bold tracking-widest border-b border-stone-200">Sub</th>
                        <th className="py-4 px-3 text-[10px] text-stone-400 uppercase font-bold tracking-widest border-b border-stone-200">Sup</th>
                        <th className="py-4 px-3 text-[10px] text-stone-400 uppercase font-bold tracking-widest border-b border-stone-200">Abd</th>
                        <th className="py-4 px-3 text-[10px] text-stone-400 uppercase font-bold tracking-widest border-b border-stone-200">Cox</th>
                        <th className="py-4 px-3 text-[10px] text-stone-400 uppercase font-bold tracking-widest border-b border-stone-200">Pan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {skinfoldsData.length === 0 && (
                        <tr><td colSpan={12} className="text-center py-10 text-stone-400 text-sm font-medium italic">Nenhum protocolo cadastrado.</td></tr>
                      )}
                      {skinfoldsData.map(i => {
                         const sum = parseFloat(i.triceps?.toString()||"0") + parseFloat(i.biceps?.toString()||"0") + parseFloat(i.subscapular?.toString()||"0") + parseFloat(i.suprailiac?.toString()||"0") + parseFloat(i.abdominal?.toString()||"0") + parseFloat(i.thigh?.toString()||"0") + parseFloat(i.calf?.toString()||"0");
                         
                         const formatD = (d: string) => new Date(d).toISOString().split('T')[0];
                         const tPoint = timelineData.find(t => t.date === formatD(i.measurement_date) && t.somatorio_dobras === parseFloat(sum.toFixed(1)));
                         
                         const bf = tPoint?.bf;
                         const imc = tPoint?.imc;
                         const mMag = tPoint?.leanMass;

                         return (
                          <tr key={i.id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="py-3 px-5 font-bold text-xs md:text-sm text-stone-800 whitespace-nowrap">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td>
                            <td className="py-3 px-4 font-black text-stone-700 text-xs md:text-sm bg-stone-50/30">{sum > 0 ? sum.toFixed(1) : '-'}</td>
                            <td className="py-3 px-4 font-extrabold text-cyan-600 text-xs md:text-sm">{imc ? imc : '-'}</td>
                            <td className="py-3 px-4 font-extrabold text-amber-500 text-xs md:text-sm">{bf ? `${bf}%` : '-'}</td>
                            <td className="py-3 px-4 font-extrabold text-emerald-600 text-xs md:text-sm">{mMag ? `${mMag}kg` : '-'}</td>
                            <td className="py-3 px-4 font-medium text-xs text-stone-500 pl-5 border-l border-stone-100">{i.triceps || '-'}</td>
                            <td className="py-3 px-3 font-medium text-xs text-stone-500">{i.biceps || '-'}</td>
                            <td className="py-3 px-3 font-medium text-xs text-stone-500">{i.subscapular || '-'}</td>
                            <td className="py-3 px-3 font-medium text-xs text-stone-500">{i.suprailiac || '-'}</td>
                            <td className="py-3 px-3 font-medium text-xs text-stone-500">{i.abdominal || '-'}</td>
                            <td className="py-3 px-3 font-medium text-xs text-stone-500">{i.thigh || '-'}</td>
                            <td className="py-3 px-3 font-medium text-xs text-stone-500">{i.calf || '-'}</td>
                          </tr>
                         )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* BIOQUÍMICOS */}
            {activeTab === 'bioquimicos' && (
              <div className="animate-in fade-in duration-300 space-y-8 md:space-y-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h2 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2.5 tracking-tight">
                    <div className="bg-stone-100 p-2 rounded-xl text-stone-600"><Activity size={18} /></div>
                    Exames de Sangue
                  </h2>
                  <div className="flex gap-3 md:gap-4 text-[9px] md:text-[10px] font-bold uppercase text-stone-500 bg-stone-50 px-3 md:px-4 py-2 rounded-lg md:rounded-xl border border-stone-200/80 shrink-0">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-emerald-500 shadow-sm"></span> Normal</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-amber-400 shadow-sm"></span> Atenção</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-rose-500 shadow-sm"></span> Risco</span>
                  </div>
                </div>

                {bioData.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 font-medium text-sm bg-stone-50/50 rounded-2xl md:rounded-[2.5rem] border-2 border-dashed border-stone-200 flex flex-col items-center">
                    <Syringe size={40} className="mb-3 text-stone-300 opacity-50" />
                    <p>Nenhum biomarcador cadastrado para este paciente.</p>
                  </div>
                ) : (
                  bioData.map((item) => {
                    const homaIr = (item.glucose && item.insulin) ? ((parseFloat(item.glucose) * parseFloat(item.insulin)) / 405).toFixed(2) : null;

                    return (
                      <div key={item.id} className="bg-white rounded-3xl md:rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="bg-stone-50/80 px-5 md:px-8 py-4 border-b border-stone-200">
                          <span className="font-extrabold text-stone-800 text-xs md:text-sm uppercase tracking-wider flex items-center gap-2">
                            <CalendarCheck size={16} className="text-nutri-600" /> Coleta: {new Date(item.exam_date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="p-5 md:p-8 space-y-8 md:space-y-10">
                          
                          {(item.glucose || item.insulin || item.hba1c) && (
                            <div className="border-b border-stone-100 pb-8 md:pb-10 last:border-0 last:pb-0">
                              <h3 className="text-[10px] md:text-xs font-bold uppercase text-stone-400 mb-4 md:mb-5 tracking-widest flex items-center gap-1.5">Eixo Glicêmico</h3>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                                <ExamBadge label="Glicose" value={item.glucose} unit="mg/dL" type="glucose" />
                                <ExamBadge label="Insulina" value={item.insulin} unit="µUI/mL" type="insulin" />
                                <ExamBadge label="HbA1c" value={item.hba1c} unit="%" type="hba1c" />
                                <ExamBadge label="HOMA-IR" value={homaIr} unit="" type="homair" />
                              </div>
                            </div>
                          )}

                          {(item.total_cholesterol || item.hdl || item.ldl || item.triglycerides) && (
                            <div className="border-b border-stone-100 pb-8 md:pb-10 last:border-0 last:pb-0">
                              <h3 className="text-[10px] md:text-xs font-bold uppercase text-stone-400 mb-4 md:mb-5 tracking-widest flex items-center gap-1.5">Perfil Lipídico</h3>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                                <ExamBadge label="Col. Total" value={item.total_cholesterol} unit="mg/dL" type="total_cholesterol" />
                                <ExamBadge label="HDL" value={item.hdl} unit="mg/dL" type="hdl" />
                                <ExamBadge label="LDL" value={item.ldl} unit="mg/dL" type="ldl" />
                                <ExamBadge label="Triglicerídeos" value={item.triglycerides} unit="mg/dL" type="triglycerides" />
                              </div>
                            </div>
                          )}

                          {(item.ferritin || item.pcr || item.tgp || item.creatinine || item.urea) && (
                            <div className="border-b border-stone-100 pb-8 md:pb-10 last:border-0 last:pb-0">
                              <h3 className="text-[10px] md:text-xs font-bold uppercase text-stone-400 mb-4 md:mb-5 tracking-widest flex items-center gap-1.5">Órgãos & Inflamação</h3>
                              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-5">
                                <ExamBadge label="Ferritina" value={item.ferritin} unit="ng/mL" type="ferritin" />
                                <ExamBadge label="PCR" value={item.pcr} unit="mg/dL" type="pcr" />
                                <ExamBadge label="TGP" value={item.tgp} unit="U/L" type="tgp" />
                                <ExamBadge label="Creatinina" value={item.creatinine} unit="mg/dL" type="creatinine" />
                                <ExamBadge label="Ureia" value={item.urea} unit="mg/dL" type="urea" />
                              </div>
                            </div>
                          )}

                          {(item.vitamin_d || item.vitamin_b12 || item.tsh || item.iron) && (
                            <div className="pb-2">
                              <h3 className="text-[10px] md:text-xs font-bold uppercase text-stone-400 mb-4 md:mb-5 tracking-widest flex items-center gap-1.5">Vitaminas & Tireoide</h3>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                                <ExamBadge label="Vit. D (25OH)" value={item.vitamin_d} unit="ng/mL" type="vitamin_d" />
                                <ExamBadge label="Vit. B12" value={item.vitamin_b12} unit="pg/mL" type="vitamin_b12" />
                                <ExamBadge label="TSH" value={item.tsh} unit="µUI/mL" type="tsh" />
                                <ExamBadge label="Ferro Sérico" value={item.iron} unit="µg/dL" type="iron" />
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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
    </main>
  );
}