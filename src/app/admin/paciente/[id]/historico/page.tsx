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
// 🔥 Importamos o motor de cálculo para usar no componente Pai
import { generateRecommendation } from '@/lib/nutrition'; 
import { getPatientMetabolicData } from '@/lib/getPatientMetabolicData';

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
  async function fetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== 'vankadosh@gmail.com') {
        router.push('/login');
        return;
      }

      const { data: profileData, error: profileErr } = await supabase.from('profiles').select('*').eq('id', pacienteId).single();
      if (profileErr) throw profileErr;

      const { data: checkinData } = await supabase.from('checkins').select('*').eq('user_id', pacienteId).order('created_at', { ascending: true });
      
      const processedHistory = checkinData?.map(item => ({
        ...item,
        imc: item.altura ? (item.peso / (item.altura * item.altura)) : 0
      })) as CheckinData[] || [];

      const { data: antro } = await supabase.from('anthropometry').select('*').eq('user_id', pacienteId).order('measurement_date', { ascending: false });
      const { data: skin } = await supabase.from('skinfolds').select('*').eq('user_id', pacienteId).order('measurement_date', { ascending: false });
      const { data: bio } = await supabase.from('biochemicals').select('*').eq('user_id', pacienteId).order('exam_date', { ascending: false });
      const { data: notesData } = await supabase.from('clinical_notes').select('*').eq('user_id', pacienteId).order('created_at', { ascending: false });
      const { data: dailyData } = await supabase.from('daily_logs').select('*').eq('user_id', pacienteId).order('date', { ascending: false });

      setProfile(profileData as PatientProfile);
      setHistory(processedHistory);
      setAntroData(antro || []);
      setSkinfoldsData(skin || []);
      setBioData(bio || []);
      setNotes(notesData || []);
      setDailyLogs(dailyData || []);
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
      return { status: 'neutral', text: 'Sem dados', color: 'text-stone-400', bg: 'bg-stone-50', border: 'border-stone-100', icon: null };
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
      normal: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 size={16} className="text-emerald-500" /> },
      warning: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <AlertTriangle size={16} className="text-amber-500" /> },
      danger: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <AlertCircle size={16} className="text-red-500" /> },
      neutral: { color: 'text-stone-500', bg: 'bg-stone-50', border: 'border-stone-100', icon: null }
    };

    return { ...configs[status as keyof typeof configs], text, status };
  };

  const getMoodIcon = (mood: string) => {
    if (mood === 'feliz') return <div className="bg-green-100 text-green-600 p-2.5 rounded-full shadow-sm"><Smile size={20} strokeWidth={2.5} /></div>;
    if (mood === 'neutro') return <div className="bg-amber-100 text-amber-600 p-2.5 rounded-full shadow-sm"><Meh size={20} strokeWidth={2.5} /></div>;
    if (mood === 'dificil') return <div className="bg-rose-100 text-rose-600 p-2.5 rounded-full shadow-sm"><Frown size={20} strokeWidth={2.5} /></div>;
    return <div className="bg-stone-100 text-stone-400 p-2.5 rounded-full shadow-sm"><Meh size={20} strokeWidth={2.5} /></div>;
  };

  // =========================================================================
  // MEMOIZAÇÕES PRINCIPAIS (ALERTS E GRÁFICOS)
  // =========================================================================
  const patientAge = useMemo(() => calculateAge(profile?.data_nascimento), [profile]);

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

    return alerts;
  }, [history, bioData, dailyLogs, profile]);

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
        const s1 = parseFloat(skin.triceps?.toString()||"0") + parseFloat(skin.biceps?.toString()||"0") + parseFloat(skin.subscapular?.toString()||"0") + parseFloat(skin.suprailiac?.toString()||"0") + parseFloat(skin.abdominal?.toString()||"0") + parseFloat(skin.thigh?.toString()||"0") + parseFloat(skin.calf?.toString()||"0");
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
    
    // Explicitando o tipo da variável para corrigir o erro de inferência estrita do TypeScript
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
    if (!tmb || !getVal || !latestMetabolicData.weight) return null;

    console.log("🔍 [HISTORICO] Inputs para generateRecommendation:", {
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

    console.log("🔍 [HISTORICO] tmb:", tmb, "getVal:", getVal, "avgActivity:", avgActivityKcal);

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
  }, [tmb, getVal, latestMetabolicData, avgActivityKcal, profile?.sexo, weightTrend]);


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
          <span className="text-[10px] uppercase font-black text-stone-400 tracking-widest mb-1">{label}</span>
          <span className={`font-black text-xl tracking-tight ${analysis.color}`}>
            {value} <span className="text-xs font-bold opacity-60 ml-0.5">{unit}</span>
          </span>
        </div>
        <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm border border-white/50">
          {analysis.icon}
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-stone-900 text-white text-xs font-bold px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-20 shadow-xl text-center transform translate-y-1 group-hover:translate-y-0">
          {analysis.text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
        <p className="text-stone-500 font-medium animate-pulse">Carregando prontuário...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 pt-16 md:pt-20 lg:pt-24 font-sans text-stone-800">
      <div className="max-w-7xl mx-auto w-full">
        
        {/* NAVEGAÇÃO E HEADER */}
        <nav className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-4 sm:gap-0 animate-fade-in-up">
          <Link href="/admin/dashboard" className="group w-full sm:w-auto flex items-center justify-center sm:justify-start gap-3 bg-white px-6 py-4 sm:py-3.5 rounded-2xl sm:rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 hover:shadow-md active:scale-95 transition-all duration-300">
            <div className="bg-nutri-50 p-1.5 sm:p-1.5 rounded-xl sm:rounded-full group-hover:bg-nutri-800 transition-colors"><ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" /></div>
            <span className="text-sm font-bold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          <div className="text-center sm:text-right w-full sm:w-auto">
            <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest mb-1">Prontuário Clínico Eletrônico</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-nutri-900 flex items-center gap-2 justify-center sm:justify-end tracking-tight">
              <User size={24} className="text-nutri-800" /> {profile?.full_name}
            </h1>
          </div>
        </nav>

        {/* =========================================================================
            LINHA SUPERIOR DE DASHBOARD (Resumo, Metabolismo, Alertas)
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8 animate-fade-in-up">
          
          <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col hover:shadow-md transition-shadow h-full min-h-[320px]">
            <div>
              <h2 className="text-lg md:text-xl font-bold mb-6 border-b border-stone-100 pb-4 text-stone-900 flex items-center gap-2">
                <BookOpen size={20} className="text-nutri-800" /> Resumo do Paciente
              </h2>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-black">Idade e Biotipo</p>
                    <p className="font-extrabold text-stone-700 text-lg flex items-center gap-2">
                      {patientAge !== null ? `${patientAge} anos` : <span className="text-red-500 text-sm flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg"><AlertCircle size={14}/> Faltando</span>} 
                      <span className="text-stone-300">|</span>
                      <span className="capitalize">{profile?.sexo || 'Indefinido'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-black">Perfil Definido</p>
                  <div><span className="font-bold text-nutri-900 uppercase bg-nutri-50 px-3 py-1.5 rounded-lg text-sm tracking-wider border border-nutri-100">{profile?.tipo_perfil || 'Não definido'}</span></div>
                </div>
                
                <div className="flex justify-between items-end border-t border-stone-50 pt-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-black">Meta de Peso</p>
                    <p className="font-extrabold text-stone-700 text-lg">{profile?.meta_peso ? `${profile.meta_peso} kg` : 'N/D'}</p>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-black">Último Peso</p>
                    <p className="font-extrabold text-emerald-600 text-lg">{latestMetabolicData.weight ? `${latestMetabolicData.weight} kg` : 'N/D'}</p>
                  </div>
                </div>
                
                {projectionDate && projectionDate !== "Estagnado ou Subindo" && (
                  <div className="bg-gradient-to-br from-nutri-50 to-white p-4 rounded-2xl border border-nutri-200 mt-2 flex items-center gap-4 shadow-sm">
                    <div className="bg-nutri-100 p-2 rounded-xl shrink-0"><Target className="text-nutri-700" size={20} /></div>
                    <div>
                      <p className="text-[9px] font-black text-nutri-700 uppercase tracking-widest mb-0.5">GPS da Meta de Peso</p>
                      <p className="text-base font-black text-nutri-900 leading-tight">Previsão: {projectionDate}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 🔥 AQUI PASSAMOS AS PROPS RECALCULADAS PARA O FILHO */}
          <MetabolicSummary 
            weight={latestMetabolicData.weight}
            height={latestMetabolicData.height}
            age={patientAge}
            gender={profile?.sexo}
            bf={latestMetabolicData.bf}
            leanMass={latestMetabolicData.leanMass}
            dailyLogs={dailyLogs}
            // Novas Props da Fonte Única de Verdade
            tmb={tmb}
            tmbMethod={tmbMethod}
            getVal={getVal}
            avgActivityKcal={avgActivityKcal}
            recommendation={masterRecommendation}
          />

          <section 
            onClick={() => setIsRadarExpanded(true)}
            className="bg-stone-900 text-white p-6 md:p-8 rounded-[2rem] shadow-xl relative overflow-hidden group flex flex-col h-full min-h-[320px] border border-stone-800 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
          >
            <div className="absolute -right-20 -top-20 w-60 h-60 bg-white opacity-5 rounded-full blur-3xl transition-opacity group-hover:opacity-10 duration-700"></div>
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex flex-col">
                <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Zap size={18} className="text-amber-400 fill-amber-400/20" /> Radar Clínico AI
                </h2>
                <p className="text-[10px] text-stone-500 font-bold mt-1">Monitoramento ativo</p>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 mt-4">
              {activeAlerts.length > 0 ? (
                <>
                  <div className="bg-stone-800/50 p-4 rounded-full mb-4 border border-stone-700">
                    <Activity size={32} className="text-amber-400" />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-2">{activeAlerts.length} Alertas</h3>
                  <p className="text-stone-400 text-sm font-medium">Clique para revisar os insights.</p>
                  
                  <div className="flex gap-3 mt-6">
                    {dangerCount > 0 && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <AlertCircle size={14} /> {dangerCount} Crítico
                      </div>
                    )}
                    {warningCount > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} /> {warningCount} Atenção
                      </div>
                    )}
                    {successCount > 0 && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <Flame size={14} /> {successCount} Positivo
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-emerald-500/10 p-4 rounded-full mb-4 border border-emerald-500/20">
                    <CheckCircle2 size={32} className="text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-black text-emerald-400 mb-2">Paciente Estável</h3>
                  <p className="text-stone-400 text-sm font-medium">Nenhum alerta clínico detectado.</p>
                </>
              )}
            </div>
          </section>
        </div>

        {/* =========================================================================
            LINHA CENTRAL (GRÁFICO MULTI-LENTES)
            ========================================================================= */}
        <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col hover:shadow-md transition-shadow mb-6 md:mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-3 text-stone-900 tracking-tight">
              <div className="bg-nutri-50 p-2 rounded-xl border border-nutri-100">
                <TrendingUp className="text-nutri-800" size={20} />
              </div>
              Diagnóstico Evolutivo
            </h2>

            <div className="flex bg-stone-50 p-1.5 rounded-2xl w-full md:w-auto border border-stone-100 shadow-inner">
              <button 
                onClick={() => setActiveLens('medidas')} 
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeLens === 'medidas' ? 'bg-white text-nutri-900 shadow-sm border border-stone-200/50' : 'text-stone-400 hover:text-stone-700'}`}
              >
                <Scale size={14} /> Medidas
              </button>
              <button 
                onClick={() => setActiveLens('composicao')} 
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeLens === 'composicao' ? 'bg-white text-nutri-900 shadow-sm border border-stone-200/50' : 'text-stone-400 hover:text-stone-700'}`}
              >
                <Layers size={14} /> Composição
              </button>
              <button 
                onClick={() => setActiveLens('metabolico')} 
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeLens === 'metabolico' ? 'bg-white text-nutri-900 shadow-sm border border-stone-200/50' : 'text-stone-400 hover:text-stone-700'}`}
              >
                <Activity size={14} /> Metabólico
              </button>
            </div>
          </div>

          <div className="h-[400px] w-full -ml-3 sm:ml-0 mt-4">
            {timelineData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-100 rounded-3xl bg-stone-50/50">
                <TrendingUp size={40} className="mb-4 opacity-50" />
                <p className="font-medium text-sm">Insira dados de peso ou check-ins para visualizar o gráfico evolutivo.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAreaWaist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} dy={10} />
                  
                  <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} dx={-10} />
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#818cf8" fontSize={11} axisLine={false} tickLine={false} dx={10} />
                  
                  <RechartsTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-stone-900/95 backdrop-blur-md text-white p-5 rounded-2xl shadow-2xl border border-stone-800 pointer-events-none">
                            <p className="text-xs font-black uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-700/50 pb-2">{new Date(data.date).toLocaleDateString('pt-BR')}</p>
                            
                            <div className="space-y-2">
                              {activeLens === 'medidas' && (
                                <>
                                  {data.peso && <p className="font-medium text-sm flex justify-between gap-6">Peso: <span className="font-black text-emerald-400">{data.peso} kg</span></p>}
                                  {data.cintura && <p className="font-medium text-sm flex justify-between gap-6">Cintura: <span className="font-black text-indigo-400">{data.cintura} cm</span></p>}
                                </>
                              )}

                              {activeLens === 'composicao' && (
                                <>
                                  {data.peso && <p className="font-medium text-sm flex justify-between gap-6">Peso Atual: <span className="font-black text-emerald-400">{data.peso} kg</span></p>}
                                  {data.somatorio_dobras && <p className="font-medium text-sm flex justify-between gap-6">Somatório Dobras: <span className="font-black text-pink-400">{data.somatorio_dobras} mm</span></p>}
                                  {data.bf && <p className="font-medium text-sm flex justify-between gap-6">% Gordura: <span className="font-black text-amber-400">{data.bf}%</span></p>}
                                </>
                              )}

                              {activeLens === 'metabolico' && (
                                <>
                                  {data.cintura && <p className="font-medium text-sm flex justify-between gap-6">Cintura: <span className="font-black text-indigo-400">{data.cintura} cm</span></p>}
                                  {data.homair && <p className="font-medium text-sm flex justify-between gap-6">Índice HOMA-IR: <span className="font-black text-amber-400">{data.homair}</span></p>}
                                </>
                              )}
                            </div>

                            {(data.adesao || data.hasExam) && (
                              <div className="mt-4 pt-3 border-t border-stone-700/50 space-y-2">
                                {data.adesao && <p className="text-xs text-stone-300 flex justify-between">Adesão Dieta: <span className="font-black text-white">{data.adesao}/5</span></p>}
                                {data.hasExam && <p className="text-xs font-bold text-amber-400 mt-1 flex items-center gap-1.5"><Syringe size={14}/> Exame Sangue Relatado</p>}
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
                      {profile?.meta_peso && <ReferenceLine y={profile.meta_peso} yAxisId="left" stroke="#d6d3d1" strokeDasharray="4 4" label={{ position: 'top', value: 'META DE PESO', fill: '#a8a29e', fontSize: 9, fontWeight: 'bold' }} />}
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorArea)" connectNulls />
                      <Line type="monotone" yAxisId="right" dataKey="cintura" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7 }} connectNulls />
                    </>
                  )}

                  {activeLens === 'composicao' && (
                    <>
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorArea)" connectNulls />
                      <Line type="monotone" yAxisId="right" dataKey="somatorio_dobras" stroke="#ec4899" strokeWidth={3} dot={{ r: 5, fill: "#ec4899", strokeWidth: 2, stroke: "#fff" }} connectNulls />
                      {timelineData.some(d => d.bf) && (
                        <Line type="monotone" yAxisId="right" dataKey="bf" stroke="#f59e0b" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 5, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }} connectNulls />
                      )}
                    </>
                  )}

                  {activeLens === 'metabolico' && (
                    <>
                      <ReferenceLine y={2.0} yAxisId="right" stroke="#ef4444" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'ALERTA HOMA-IR', fill: '#ef4444', fontSize: 9, fontWeight: 'bold' }} />
                      <Area type="monotone" yAxisId="left" dataKey="cintura" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorAreaWaist)" connectNulls />
                      <Line type="monotone" yAxisId="right" dataKey="homair" stroke="#f59e0b" strokeWidth={4} dot={{ r: 6, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 8 }} connectNulls />
                    </>
                  )}
                  
                  <Scatter yAxisId="left" dataKey="hasExam" shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (!payload.hasExam) return <g></g>;
                    return (
                      <g transform={`translate(${cx - 10},${cy - 28})`} className="cursor-pointer">
                        <circle cx="10" cy="10" r="14" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
                        <Syringe x="3" y="3" size={14} color="#d97706" />
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
        <section className="bg-white rounded-[2.5rem] shadow-sm border border-stone-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          
          <div className="flex overflow-x-auto border-b border-stone-100 bg-stone-50/50 px-2 md:px-6 pt-4 gap-2 scrollbar-hide">
            {[
              { id: 'prontuario', label: 'Prontuário (S.O.A.P)', icon: <BookOpen size={16} /> },
              { id: 'diario', label: 'Diário no App', icon: <Coffee size={16} /> },
              { id: 'checkins', label: 'Check-ins Semanais', icon: <CalendarCheck size={16} /> },
              { id: 'antropometria', label: 'Antropometria', icon: <Ruler size={16} /> },
              { id: 'dobras', label: 'Dobras & BF%', icon: <Layers size={16} /> },
              { id: 'bioquimicos', label: 'Exames de Sangue', icon: <Activity size={16} /> }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all whitespace-nowrap active:scale-95 ${activeTab === tab.id ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/50 rounded-t-2xl'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 md:p-8 lg:p-10 min-h-[400px]">
            
            {/* PRONTUÁRIO S.O.A.P */}
            {activeTab === 'prontuario' && (
              <div className="animate-fade-in max-w-4xl mx-auto">
                <h2 className="text-xl md:text-2xl font-bold mb-8 text-stone-900 flex items-center gap-3">
                  <Stethoscope className="text-nutri-800" size={28} /> Prontuário Clínico
                </h2>
                
                <div className="mb-12 bg-white p-6 md:p-8 rounded-[2rem] border border-stone-200 shadow-sm focus-within:ring-4 focus-within:ring-nutri-800/5 transition-all">
                  <div className="space-y-6">
                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-400 uppercase tracking-widest mb-3"><MessageCircle size={14} className="text-stone-300"/> S - Subjetivo (Relato do Paciente)</label>
                      <textarea value={soapNote.s} onChange={e => setSoapNote({...soapNote, s: e.target.value})} placeholder="Queixas, sintomas relatados, facilidades e dificuldades percebidas..." className="w-full p-4 rounded-xl border border-stone-200 focus:border-nutri-800 outline-none h-24 resize-none text-sm font-medium bg-stone-50 focus:bg-white transition-colors" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-400 uppercase tracking-widest mb-3"><ClipboardList size={14} className="text-stone-300"/> O - Objetivo (Dados Físicos/Exames)</label>
                      <textarea value={soapNote.o} onChange={e => setSoapNote({...soapNote, o: e.target.value})} placeholder="Sinais clínicos observados, resultados de laboratório, peso atual, medidas..." className="w-full p-4 rounded-xl border border-stone-200 focus:border-nutri-800 outline-none h-24 resize-none text-sm font-medium bg-stone-50 focus:bg-white transition-colors" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-400 uppercase tracking-widest mb-3"><Brain size={14} className="text-stone-300"/> A - Avaliação (Diagnóstico Nutricional)</label>
                      <textarea value={soapNote.a} onChange={e => setSoapNote({...soapNote, a: e.target.value})} placeholder="Interpretação do quadro geral, diagnóstico nutricional, evolução..." className="w-full p-4 rounded-xl border border-stone-200 focus:border-nutri-800 outline-none h-24 resize-none text-sm font-medium bg-stone-50 focus:bg-white transition-colors" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-400 uppercase tracking-widest mb-3"><ListChecks size={14} className="text-stone-300"/> P - Plano (Conduta Dietética)</label>
                      <textarea value={soapNote.p} onChange={e => setSoapNote({...soapNote, p: e.target.value})} placeholder="Conduta, prescrição de dieta/suplementos, metas para a próxima consulta..." className="w-full p-4 rounded-xl border border-stone-200 focus:border-nutri-800 outline-none h-24 resize-none text-sm font-medium bg-stone-50 focus:bg-white transition-colors" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-8 pt-6 border-t border-stone-100">
                    <button onClick={handleSaveNote} disabled={savingNote || (!soapNote.s && !soapNote.o && !soapNote.a && !soapNote.p)} className="bg-nutri-900 text-white px-8 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-nutri-800 active:scale-95 transition-all shadow-lg shadow-nutri-900/20 disabled:opacity-50 disabled:shadow-none">
                      {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Prontuário
                    </button>
                  </div>
                </div>

                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-stone-200 before:to-transparent">
                  {notes.length === 0 ? (
                    <div className="text-center py-16 text-stone-400 font-medium italic bg-stone-50/50 rounded-3xl border-2 border-dashed border-stone-200">Nenhuma anotação médica registrada ainda.</div>
                  ) : (
                    notes.map((note) => {
                      const formattedContent = note.content.includes('**S') ? (
                        <div dangerouslySetInnerHTML={{ __html: note.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-nutri-900 block mt-4 mb-1 text-xs uppercase tracking-widest border-b border-stone-100 pb-1">$1</strong>').replace(/\n/g, '<br/>') }} />
                      ) : (
                        <p className="whitespace-pre-wrap">{note.content}</p>
                      );

                      return (
                        <div key={note.id} className="relative flex items-start group">
                          <div className="absolute left-0 flex items-center justify-center w-12 h-12 rounded-full bg-stone-50 border-[3px] border-white shadow-sm z-10 text-nutri-800"><BookOpen size={18} /></div>
                          <div className="ml-16 flex-1 bg-white p-6 md:p-8 rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-center mb-4 border-b border-stone-100 pb-4">
                              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</span>
                              <button onClick={() => handleDeleteNote(note.id)} className="text-stone-300 hover:text-red-500 bg-stone-50 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button>
                            </div>
                            <div className="text-stone-700 leading-relaxed text-sm font-medium">
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

            {/* DIÁRIO */}
            {activeTab === 'diario' && (
              <div className="animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2"><Coffee className="text-nutri-800" /> Diário de Rotina</h2>
                    <p className="text-sm text-stone-500 mt-1 font-medium">Histórico diário de ingestão de água, humor, atividades e refeições.</p>
                  </div>
                </div>
                {dailyLogs.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 font-medium italic bg-stone-50/50 rounded-[2.5rem] border-2 border-dashed border-stone-200 flex flex-col items-center justify-center">
                    <Coffee size={48} className="mb-4 text-stone-300" />
                    <p>O paciente ainda não possui registros no diário.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dailyLogs.map((log) => {
                      const mealCount = Array.isArray(log.meals_checked) ? log.meals_checked.length : 0;
                      return (
                        <div key={log.id} className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-md transition-all relative group">
                          <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
                            <div>
                              <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-1">Data</p>
                              <h3 className="font-bold text-stone-800">{new Date(log.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</h3>
                            </div>
                            <div title={`Humor: ${log.mood || 'Não informado'}`}>{getMoodIcon(log.mood)}</div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex flex-col justify-center items-center text-center">
                              <Droplets size={20} className="text-blue-500 mb-2" />
                              <p className="text-2xl font-black text-blue-900">{log.water_ml || 0} <span className="text-xs font-bold text-blue-600">ml</span></p>
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1">Água Ingerida</p>
                            </div>
                            <div className="bg-stone-50/50 p-4 rounded-2xl border border-stone-200/50 flex flex-col justify-center items-center text-center">
                              <Check size={20} className="text-emerald-500 mb-2" />
                              <p className="text-2xl font-black text-stone-900">{mealCount}</p>
                              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Refeições Feitas</p>
                            </div>
                          </div>

                          {(log.activity_kcal && log.activity_kcal > 0) ? (
                            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100/50 flex justify-between items-center text-left">
                               <div>
                                 <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Gasto Calórico</p>
                                 <p className="text-lg font-black text-orange-900">{log.activity_kcal} <span className="text-xs font-bold text-orange-600">kcal</span></p>
                               </div>
                               <Flame size={24} className="text-orange-400" />
                            </div>
                          ) : (
                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex items-center justify-center">
                              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Sem atividades registradas</p>
                            </div>
                          )}

                          {mealCount > 0 && (
                            <div className="mt-5 pt-5 border-t border-stone-100">
                              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Checklist do dia:</p>
                              <ul className="flex flex-wrap gap-2">
                                {log.meals_checked.map((meal: string, idx: number) => (
                                  <li key={idx} className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-stone-200/50">{meal}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CHECK-INS */}
            {activeTab === 'checkins' && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-bold mb-6 text-stone-900 flex items-center gap-2"><CalendarCheck className="text-nutri-800" /> Relatos Semanais</h2>
                <div className="overflow-x-auto rounded-[2rem] border border-stone-200 shadow-sm scrollbar-hide">
                  <table className="w-full text-left border-collapse min-w-[800px] bg-white">
                    <thead className="bg-stone-50/80">
                      <tr>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Data do Relato</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Peso Registrado</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Nota Adesão</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Humor da Semana</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Comentários e Queixas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {history.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-10 text-stone-400 font-medium italic">Nenhum check-in registrado.</td></tr>
                      )}
                      {history.slice().reverse().map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-5 px-6 font-bold text-stone-800 text-sm whitespace-nowrap">{new Date(item.created_at).toLocaleDateString('pt-BR', {day: '2-digit', month: 'long', year: 'numeric'})}</td>
                          <td className="py-5 px-6 font-extrabold text-sm text-nutri-800">{item.peso} kg</td>
                          <td className="py-5 px-6 text-sm">
                            <span className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-widest border ${item.adesao_ao_plano >= 4 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{item.adesao_ao_plano} / 5</span>
                          </td>
                          <td className="py-5 px-6 font-bold text-sm text-stone-500 flex items-center gap-2">
                            {item.humor_semanal} / 5
                          </td>
                          <td className="py-5 px-6 text-sm text-stone-600 font-medium leading-relaxed max-w-xs truncate" title={item.comentarios}>{item.comentarios || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ANTROPOMETRIA */}
            {activeTab === 'antropometria' && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-bold mb-6 text-stone-900 flex items-center gap-2"><Ruler className="text-nutri-800" /> Circunferências e Medidas Físicas</h2>
                <div className="overflow-x-auto rounded-[2rem] border border-stone-200 shadow-sm scrollbar-hide">
                  <table className="w-full text-left min-w-[1000px] bg-white">
                    <thead className="bg-stone-50/80">
                      <tr>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Data</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Peso</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Altura</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Cintura</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Quadril</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Braço</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Panturrilha</th>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Pescoço</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {antroData.length === 0 && (
                        <tr><td colSpan={8} className="text-center py-10 text-stone-400 font-medium italic">Nenhuma medida cadastrada.</td></tr>
                      )}
                      {antroData.map(i => (
                        <tr key={i.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-5 px-6 font-bold text-sm text-stone-800">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td>
                          <td className="py-5 px-6 font-extrabold text-sm text-nutri-800">{i.weight ? `${i.weight} kg` : '-'}</td>
                          <td className="py-5 px-6 font-medium text-sm text-stone-600">{i.height ? `${i.height} m` : '-'}</td>
                          <td className="py-5 px-6 font-medium text-sm text-stone-600">{i.waist ? `${i.waist} cm` : '-'}</td>
                          <td className="py-5 px-6 font-medium text-sm text-stone-600">{i.hip ? `${i.hip} cm` : '-'}</td>
                          <td className="py-5 px-6 font-medium text-sm text-stone-600">{i.arm ? `${i.arm} cm` : '-'}</td>
                          <td className="py-5 px-6 font-medium text-sm text-stone-600">{i.calf ? `${i.calf} cm` : '-'}</td>
                          <td className="py-5 px-6 font-medium text-sm text-stone-600">{i.neck ? `${i.neck} cm` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DOBRAS E COMPOSIÇÃO: Redesenhado Hermético e Comparativo Avançado */}
            {activeTab === 'dobras' && (
              <div className="animate-fade-in">
                {skinfoldsData.length > 0 && timelineData.length > 0 && (
                  <div className="bg-stone-900 rounded-[2rem] p-6 md:p-8 mb-8 text-white flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute -right-20 -top-20 w-60 h-60 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10">
                      <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                        <Layers size={14}/> Composição Corporal (Jackson & Pollock)
                      </h3>
                      <p className="text-sm font-medium text-stone-400">
                        {patientAge !== null 
                          ? `Protocolo de 7 dobras. Calculado para a idade biológica de ${patientAge} anos (${profile?.sexo || 'Indefinido'}).`
                          : <span className="text-red-300 flex items-center gap-1 font-bold"><AlertCircle size={14}/> Preencha a data de nascimento no perfil para calcular a gordura.</span>
                        }
                      </p>
                    </div>
                    
                    {(() => {
                      const latestSkin = skinfoldsData[0];
                      const s1 = parseFloat(latestSkin.triceps?.toString()||"0") + parseFloat(latestSkin.biceps?.toString()||"0") + parseFloat(latestSkin.subscapular?.toString()||"0") + parseFloat(latestSkin.suprailiac?.toString()||"0") + parseFloat(latestSkin.abdominal?.toString()||"0") + parseFloat(latestSkin.thigh?.toString()||"0") + parseFloat(latestSkin.calf?.toString()||"0");
                      const currentPoint = timelineData.slice().reverse().find(t => t.somatorio_dobras === parseFloat(s1.toFixed(1)));
                      
                      // Buscando os dados da primeira avaliação para "Início"
                      const initialPoint = timelineData.find(t => t.bf !== null && t.bf !== undefined);

                      // Calculando a Meta do IMC se existir meta de peso
                      let targetImc: string | null = null;
                      const defaultHeightRaw = antroData.find(a => a.height)?.height || profile?.altura || null;
                      const defaultHeight = defaultHeightRaw ? parseFloat(defaultHeightRaw.toString()) : null;
                      
                      if (profile?.meta_peso && defaultHeight) {
                        targetImc = (profile.meta_peso / (defaultHeight * defaultHeight)).toFixed(1);
                      }

                      if (currentPoint && currentPoint.bf && patientAge !== null) {
                        
                        // Funções auxiliares para cálculo de evolução (Deltas)
                        const getDelta = (current: number, initial: number) => (current - initial).toFixed(1);
                        const renderDelta = (delta: string, reverseColors = false) => {
                          const val = parseFloat(delta);
                          if (isNaN(val) || val === 0) return <span className="text-stone-500">Mantido</span>;
                          const isPositive = val > 0;
                          
                          // Lógica de cores:
                          // reverseColors = false (Padrão): Verde se for positivo (ex: Massa magra)
                          // reverseColors = true: Verde se for negativo (ex: Gordura, IMC)
                          let colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
                          if (reverseColors) {
                            colorClass = isPositive ? 'text-red-400' : 'text-emerald-400';
                          }

                          return (
                            <span className={`font-bold flex items-center gap-0.5 ${colorClass}`}>
                              {isPositive ? '+' : ''}{delta}
                            </span>
                          );
                        };

                        return (
                          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 w-full relative z-10 border-t border-white/10 pt-6">
                            
                            {/* CARD IMC */}
                            <div className="flex flex-col bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-inner">
                              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-200/50 mb-2">Índice Clínico</span>
                              <div className="flex items-baseline">
                                <span className="text-4xl font-black text-cyan-400 tracking-tight">{currentPoint.imc || '-'}</span>
                                <span className="text-sm font-bold text-cyan-400/50 ml-1.5 uppercase tracking-wider">IMC</span>
                              </div>
                              <div className="mt-auto pt-4 flex flex-col gap-1 text-[10px] font-black tracking-widest uppercase text-stone-500">
                                {initialPoint?.imc && (
                                  <>
                                    <span className="flex items-center justify-between border-b border-white/5 pb-1">
                                      Início: <strong className="text-cyan-100/70">{initialPoint.imc}</strong>
                                    </span>
                                    <span className="flex items-center justify-between border-b border-white/5 pb-1 mt-1">
                                      Evolução: {renderDelta(getDelta(currentPoint.imc!, initialPoint.imc), true)}
                                    </span>
                                  </>
                                )}
                                {targetImc && (
                                  <span className="flex items-center justify-between pt-1 mt-1">
                                    Alvo: <strong className="text-cyan-400">{targetImc}</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* CARD GORDURA */}
                            <div className="flex flex-col bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-inner">
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-200/50 mb-2">% de Gordura</span>
                              <div className="flex items-baseline">
                                <span className="text-4xl font-black text-amber-400 tracking-tight">{currentPoint.bf}</span>
                                <span className="text-sm font-bold text-amber-400/50 ml-1.5 uppercase tracking-wider">%</span>
                              </div>
                              <div className="mt-auto pt-4 flex flex-col gap-1 text-[10px] font-black tracking-widest uppercase text-stone-500">
                                {initialPoint?.bf && (
                                  <>
                                    <span className="flex items-center justify-between border-b border-white/5 pb-1">
                                      Início: <strong className="text-amber-100/70">{initialPoint.bf}%</strong>
                                    </span>
                                    <span className="flex items-center justify-between pt-1 mt-1">
                                      Evolução: {renderDelta(getDelta(currentPoint.bf, initialPoint.bf), true)}%
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* CARD MASSA MAGRA */}
                            <div className="flex flex-col bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-inner">
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200/50 mb-2">Massa Magra</span>
                              <div className="flex items-baseline">
                                <span className="text-4xl font-black text-emerald-400 tracking-tight">{currentPoint.leanMass}</span>
                                <span className="text-sm font-bold text-emerald-400/50 ml-1.5 uppercase tracking-wider">kg</span>
                              </div>
                              <div className="mt-auto pt-4 flex flex-col gap-1 text-[10px] font-black tracking-widest uppercase text-stone-500">
                                {initialPoint?.leanMass && (
                                  <>
                                    <span className="flex items-center justify-between border-b border-white/5 pb-1">
                                      Início: <strong className="text-emerald-100/70">{initialPoint.leanMass} kg</strong>
                                    </span>
                                    <span className="flex items-center justify-between pt-1 mt-1">
                                      Evolução: {renderDelta(getDelta(currentPoint.leanMass!, initialPoint.leanMass))} kg
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* CARD MASSA GORDA */}
                            <div className="flex flex-col bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-inner">
                              <span className="text-[10px] font-black uppercase tracking-widest text-rose-200/50 mb-2">Massa Gorda</span>
                              <div className="flex items-baseline">
                                <span className="text-4xl font-black text-rose-400 tracking-tight">{currentPoint.fatMass}</span>
                                <span className="text-sm font-bold text-rose-400/50 ml-1.5 uppercase tracking-wider">kg</span>
                              </div>
                              <div className="mt-auto pt-4 flex flex-col gap-1 text-[10px] font-black tracking-widest uppercase text-stone-500">
                                {initialPoint?.fatMass && (
                                  <>
                                    <span className="flex items-center justify-between border-b border-white/5 pb-1">
                                      Início: <strong className="text-rose-100/70">{initialPoint.fatMass} kg</strong>
                                    </span>
                                    <span className="flex items-center justify-between pt-1 mt-1">
                                      Evolução: {renderDelta(getDelta(currentPoint.fatMass!, initialPoint.fatMass), true)} kg
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                          </div>
                        )
                      }
                      return <p className="text-sm font-bold text-amber-300 italic mt-4 bg-amber-900/40 p-4 rounded-xl border border-amber-500/30">O peso do paciente deve ser atualizado na mesma data das dobras para liberar este painel.</p>;
                    })()}
                  </div>
                )}

                <div className="overflow-x-auto rounded-[2rem] border border-stone-200 shadow-sm scrollbar-hide">
                  <table className="w-full text-left min-w-[1100px] bg-white">
                    <thead className="bg-stone-50/80">
                      <tr>
                        <th className="py-5 px-6 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Data</th>
                        <th className="py-5 px-6 text-[10px] text-stone-800 uppercase font-black tracking-widest border-b border-stone-200">Somatório</th>
                        <th className="py-5 px-4 text-[10px] text-cyan-600 uppercase font-black tracking-widest border-b border-stone-200">IMC</th>
                        <th className="py-5 px-4 text-[10px] text-amber-500 uppercase font-black tracking-widest border-b border-stone-200">% Gordura</th>
                        <th className="py-5 px-4 text-[10px] text-emerald-600 uppercase font-black tracking-widest border-b border-stone-200">M. Magra</th>
                        <th className="py-5 px-4 text-[10px] text-rose-500 uppercase font-black tracking-widest border-b border-stone-200">M. Gorda</th>
                        <th className="py-5 px-4 text-[10px] text-stone-400 uppercase font-black tracking-widest pl-6 border-l border-stone-200 border-b">Tric.</th>
                        <th className="py-5 px-4 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Bic.</th>
                        <th className="py-5 px-4 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Sub.</th>
                        <th className="py-5 px-4 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Supra.</th>
                        <th className="py-5 px-4 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Abd.</th>
                        <th className="py-5 px-4 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Coxa</th>
                        <th className="py-5 px-4 text-[10px] text-stone-400 uppercase font-black tracking-widest border-b border-stone-200">Pant.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {skinfoldsData.length === 0 && (
                        <tr><td colSpan={13} className="text-center py-10 text-stone-400 font-medium italic">Nenhum protocolo de dobras cadastrado.</td></tr>
                      )}
                      {skinfoldsData.map(i => {
                         const sum = parseFloat(i.triceps?.toString()||"0") + parseFloat(i.biceps?.toString()||"0") + parseFloat(i.subscapular?.toString()||"0") + parseFloat(i.suprailiac?.toString()||"0") + parseFloat(i.abdominal?.toString()||"0") + parseFloat(i.thigh?.toString()||"0") + parseFloat(i.calf?.toString()||"0");
                         
                         const formatD = (d: string) => new Date(d).toISOString().split('T')[0];
                         const tPoint = timelineData.find(t => t.date === formatD(i.measurement_date) && t.somatorio_dobras === parseFloat(sum.toFixed(1)));
                         
                         const bf = tPoint?.bf;
                         const imc = tPoint?.imc;
                         const mMag = tPoint?.leanMass;
                         const mGorda = tPoint?.fatMass;

                         return (
                          <tr key={i.id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="py-4 px-6 font-bold text-sm text-stone-800 whitespace-nowrap">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td>
                            <td className="py-4 px-6 font-black text-nutri-900 text-sm bg-stone-50/50">{sum > 0 ? sum.toFixed(1) : '-'}</td>
                            <td className="py-4 px-4 font-extrabold text-cyan-600 text-sm">{imc ? imc : '-'}</td>
                            <td className="py-4 px-4 font-extrabold text-amber-500 text-sm">{bf ? `${bf}%` : '-'}</td>
                            <td className="py-4 px-4 font-extrabold text-emerald-600 text-sm">{mMag ? `${mMag} kg` : '-'}</td>
                            <td className="py-4 px-4 font-extrabold text-rose-500 text-sm">{mGorda ? `${mGorda} kg` : '-'}</td>
                            <td className="py-4 px-4 font-medium text-sm text-stone-500 pl-6 border-l border-stone-100">{i.triceps || '-'}</td>
                            <td className="py-4 px-4 font-medium text-sm text-stone-500">{i.biceps || '-'}</td>
                            <td className="py-4 px-4 font-medium text-sm text-stone-500">{i.subscapular || '-'}</td>
                            <td className="py-4 px-4 font-medium text-sm text-stone-500">{i.suprailiac || '-'}</td>
                            <td className="py-4 px-4 font-medium text-sm text-stone-500">{i.abdominal || '-'}</td>
                            <td className="py-4 px-4 font-medium text-sm text-stone-500">{i.thigh || '-'}</td>
                            <td className="py-4 px-4 font-medium text-sm text-stone-500">{i.calf || '-'}</td>
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
              <div className="animate-fade-in space-y-12">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                    <Activity className="text-nutri-800" /> Resultados Laboratoriais
                  </h2>
                  <div className="flex gap-4 text-[10px] font-black uppercase text-stone-500 bg-stone-50 px-4 py-2 rounded-xl border border-stone-200">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span> Ideal</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm"></span> Atenção</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></span> Risco Clínico</span>
                  </div>
                </div>

                {bioData.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 font-medium italic bg-stone-50/50 rounded-[2.5rem] border-2 border-dashed border-stone-200">
                    <Syringe size={48} className="mx-auto mb-4 text-stone-300" />
                    Nenhum exame de sangue ou biomarcador cadastrado para este paciente.
                  </div>
                ) : (
                  bioData.map((item) => {
                    const homaIr = (item.glucose && item.insulin) ? ((parseFloat(item.glucose) * parseFloat(item.insulin)) / 405).toFixed(2) : null;

                    return (
                      <div key={item.id} className="bg-white rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="bg-stone-50 px-6 md:px-8 py-5 border-b border-stone-200 flex items-center justify-between">
                          <span className="font-extrabold text-nutri-900 text-sm uppercase tracking-wider">Data do Exame: {new Date(item.exam_date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        
                        <div className="p-6 md:p-8 space-y-10">
                          
                          {(item.glucose || item.insulin || item.hba1c) && (
                            <div className="border-b border-stone-100 pb-10">
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-6 tracking-[0.15em] flex items-center gap-2"><ChevronRight size={16} className="text-nutri-400"/> Eixo Glicêmico</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                <ExamBadge label="Glicose Jejum" value={item.glucose} unit="mg/dL" type="glucose" />
                                <ExamBadge label="Insulina Basal" value={item.insulin} unit="µUI/mL" type="insulin" />
                                <ExamBadge label="Hemoglobina G." value={item.hba1c} unit="%" type="hba1c" />
                                <ExamBadge label="Índice HOMA-IR" value={homaIr} unit="" type="homair" />
                              </div>
                            </div>
                          )}

                          {(item.total_cholesterol || item.hdl || item.ldl || item.triglycerides) && (
                            <div className="border-b border-stone-100 pb-10">
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-6 tracking-[0.15em] flex items-center gap-2"><ChevronRight size={16} className="text-nutri-400"/> Perfil Lipídico</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                <ExamBadge label="Colesterol Total" value={item.total_cholesterol} unit="mg/dL" type="total_cholesterol" />
                                <ExamBadge label="Colesterol HDL" value={item.hdl} unit="mg/dL" type="hdl" />
                                <ExamBadge label="Colesterol LDL" value={item.ldl} unit="mg/dL" type="ldl" />
                                <ExamBadge label="Triglicerídeos" value={item.triglycerides} unit="mg/dL" type="triglycerides" />
                              </div>
                            </div>
                          )}

                          {(item.ferritin || item.pcr || item.tgp || item.creatinine || item.urea) && (
                            <div className="border-b border-stone-100 pb-10">
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-6 tracking-[0.15em] flex items-center gap-2"><ChevronRight size={16} className="text-nutri-400"/> Fígado, Rins & Inflamação</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                                <ExamBadge label="Ferritina Sérica" value={item.ferritin} unit="ng/mL" type="ferritin" />
                                <ExamBadge label="Prot. C Reativa" value={item.pcr} unit="mg/dL" type="pcr" />
                                <ExamBadge label="TGP (Fígado)" value={item.tgp} unit="U/L" type="tgp" />
                                <ExamBadge label="Creatinina" value={item.creatinine} unit="mg/dL" type="creatinine" />
                                <ExamBadge label="Ureia" value={item.urea} unit="mg/dL" type="urea" />
                              </div>
                            </div>
                          )}

                          {(item.vitamin_d || item.vitamin_b12 || item.tsh || item.iron) && (
                            <div>
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-6 tracking-[0.15em] flex items-center gap-2"><ChevronRight size={16} className="text-nutri-400"/> Vitaminas & Hormônios</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                <ExamBadge label="Vitamina D (25 OH)" value={item.vitamin_d} unit="ng/mL" type="vitamin_d" />
                                <ExamBadge label="Vitamina B12" value={item.vitamin_b12} unit="pg/mL" type="vitamin_b12" />
                                <ExamBadge label="Hormônio TSH" value={item.tsh} unit="µUI/mL" type="tsh" />
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

        {/* MODAL DE RADAR EXPANDIDO */}
        {isRadarExpanded && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-stone-800 w-full max-w-4xl max-h-[85vh] rounded-[3rem] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-8 border-b border-stone-800 flex items-center justify-between bg-stone-900/50 shrink-0">
                <div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <Zap className="text-amber-400" size={28} /> Insights do Radar Clínico
                  </h2>
                  <p className="text-stone-400 font-medium mt-1">Análise completa baseada nos dados de {profile?.full_name}</p>
                </div>
                <button 
                  onClick={() => setIsRadarExpanded(false)}
                  className="bg-stone-800 hover:bg-red-500/20 hover:text-red-400 p-3 rounded-2xl text-stone-400 transition-all"
                >
                  <AlertCircle size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 custom-scrollbar">
                {activeAlerts.map(alert => {
                  const isContacted = contactedAlerts.has(alert.id);
                  
                  return (
                    <div key={alert.id} className={`p-6 rounded-3xl border flex flex-col justify-between transition-colors ${
                      alert.type === 'danger' ? 'bg-red-500/10 border-red-500/20' : 
                      alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 
                      'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                       <div className="flex items-start gap-4 mb-6">
                          <div className={`p-3 rounded-2xl ${
                            alert.type === 'danger' ? 'bg-red-500/20 text-red-400' : 
                            alert.type === 'warning' ? 'bg-amber-500/20 text-amber-400' : 
                            'bg-emerald-500/20 text-emerald-400'
                          }`}> {alert.icon} </div>
                          <h4 className="text-sm font-bold text-white mt-1 leading-relaxed">{alert.text}</h4>
                       </div>
                       
                       {alert.waLink && (
                          <a 
                            href={alert.waLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={() => handleContactAlert(alert.id)}
                            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] px-6 py-3.5 rounded-xl transition-all w-full justify-center mt-auto border ${
                              isContacted 
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30'
                                : 'text-white bg-white/10 hover:bg-white/20 border-white/10'
                            }`}
                          >
                            {isContacted ? (
                              <><CheckCircle2 size={16} /> Mensagem Enviada</>
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