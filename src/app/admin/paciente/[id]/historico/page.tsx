'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, ChevronLeft, TrendingUp, User, Ruler, Layers, 
  Syringe, CalendarCheck, BookOpen, Send, Trash2, 
  AlertCircle, CheckCircle2, AlertTriangle, Activity, Target,
  Clock, Zap, ChevronRight, Scale, Droplets, Smile, Frown, Meh, 
  Coffee, Check, Brain, Flame, MessageCircle, FileText, ClipboardList, 
  Stethoscope, ListChecks, Save 
} from 'lucide-react';
import Link from 'next/link';
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Scatter 
} from 'recharts';

export default function PacienteHistoricoAdmin() {
  const [history, setHistory] = useState<any[]>([]); 
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [antroData, setAntroData] = useState<any[]>([]);
  const [skinfoldsData, setSkinfoldsData] = useState<any[]>([]);
  const [bioData, setBioData] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  
  const [soapNote, setSoapNote] = useState({ s: '', o: '', a: '', p: '' });
  const [savingNote, setSavingNote] = useState(false);

  const [activeTab, setActiveTab] = useState<'prontuario' | 'diario' | 'checkins' | 'antropometria' | 'dobras' | 'bioquimicos'>('prontuario');
  const [activeLens, setActiveLens] = useState<'medidas' | 'composicao' | 'metabolico'>('medidas');

  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const pacienteId = params.id as string;

  async function fetchData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.email !== 'vankadosh@gmail.com') {
      router.push('/login');
      return;
    }

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', pacienteId).single();
    const { data: checkinData } = await supabase.from('checkins').select('*').eq('user_id', pacienteId).order('created_at', { ascending: true });

    const processedHistory = checkinData?.map(item => ({
      ...item,
      imc: item.altura ? (item.peso / (item.altura * item.altura)) : 0
    })) || [];

    const { data: antro } = await supabase.from('anthropometry').select('*').eq('user_id', pacienteId).order('measurement_date', { ascending: false });
    const { data: skin } = await supabase.from('skinfolds').select('*').eq('user_id', pacienteId).order('measurement_date', { ascending: false });
    const { data: bio } = await supabase.from('biochemicals').select('*').eq('user_id', pacienteId).order('exam_date', { ascending: false });
    const { data: notesData } = await supabase.from('clinical_notes').select('*').eq('user_id', pacienteId).order('created_at', { ascending: false });
    const { data: dailyData } = await supabase.from('daily_logs').select('*').eq('user_id', pacienteId).order('date', { ascending: false });

    setProfile(profileData);
    setHistory(processedHistory);
    setAntroData(antro || []);
    setSkinfoldsData(skin || []);
    setBioData(bio || []);
    setNotes(notesData || []);
    setDailyLogs(dailyData || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [supabase, router, pacienteId]);

  const handleSaveNote = async () => {
    if (!soapNote.s && !soapNote.o && !soapNote.a && !soapNote.p) return;
    setSavingNote(true);
    
    const formattedContent = `**Subjetivo (S):**\n${soapNote.s || '---'}\n\n**Objetivo (O):**\n${soapNote.o || '---'}\n\n**Avaliação (A):**\n${soapNote.a || '---'}\n\n**Plano (P):**\n${soapNote.p || '---'}`;
    
    const { error } = await supabase.from('clinical_notes').insert([{ user_id: pacienteId, content: formattedContent }]);
    if (!error) {
      setSoapNote({ s: '', o: '', a: '', p: '' });
      fetchData();
    } else {
      alert("Erro ao salvar prontuário.");
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Deseja excluir esta anotação do prontuário?")) return;
    await supabase.from('clinical_notes').delete().eq('id', id);
    fetchData();
  };

  // =========================================================================
  // CÁLCULO DE COMPOSIÇÃO CORPORAL (JACKSON & POLLOCK 7 DOBRAS)
  // CORRIGIDO: Idade e Sexo estritos. Se faltar Idade, retorna NULL.
  // =========================================================================
  const calculateAge = (dob: string | null): number | null => {
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

  const calculateBodyComposition = (sum7: number, age: number | null, gender: string, weight: number) => {
    if (!sum7 || sum7 === 0 || !weight || age === null) return null; 
    
    let bd = 0;
    const isMale = gender?.toLowerCase() === 'masculino' || gender?.toLowerCase() === 'homem';
    
    if (isMale) {
      // Fórmula Homens (Jackson & Pollock, 1978)
      bd = 1.112 - (0.00043499 * sum7) + (0.00000055 * (sum7 * sum7)) - (0.00028826 * age);
    } else {
      // Fórmula Mulheres (Jackson, Pollock & Ward, 1980)
      bd = 1.097 - (0.00046971 * sum7) + (0.00000056 * (sum7 * sum7)) - (0.00012828 * age);
    }

    if (bd === 0) return null;
    const bf = (4.95 / bd - 4.5) * 100; // Equação de Siri
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
      return { status: 'neutral', text: 'Sem dados', color: 'text-stone-400', bg: 'bg-stone-100', border: 'border-stone-100', icon: null, stroke: '#d6d3d1' };
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
      normal: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 size={14} className="text-emerald-500" />, stroke: '#10b981' },
      warning: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <AlertTriangle size={14} className="text-amber-500" />, stroke: '#f59e0b' },
      danger: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <AlertCircle size={14} className="text-red-500" />, stroke: '#ef4444' },
      neutral: { color: 'text-stone-500', bg: 'bg-stone-50', border: 'border-stone-100', icon: null, stroke: '#d6d3d1' }
    };

    return { ...configs[status as keyof typeof configs], text, status };
  };

  const activeAlerts = useMemo(() => {
    const alerts: { id: string, type: 'success' | 'warning' | 'danger', text: string, icon: any, waLink?: string, waText?: string }[] = [];
    
    let lastCheckin: any = null;
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
          text: `Risco de Evasão: Sem check-in há ${daysSinceLastCheckin} dias.`, 
          icon: <Clock size={16}/>,
          waText: 'Cobrar Retorno',
          waLink: waBase ? `${waBase}${encodeURIComponent(`Olá ${firstName}, notei que faz um tempinho que você não preenche seu check-in semanal. Está tudo bem? Precisando de ajuda com o plano, me avise!`)}` : undefined
        });
      } else if (daysSinceLastCheckin > 7) {
        alerts.push({ 
          id: 'a2', type: 'warning', 
          text: `Atraso no relato semanal. Lembrete recomendado.`, 
          icon: <Clock size={16}/>,
          waText: 'Lembrar',
          waLink: waBase ? `${waBase}${encodeURIComponent(`Oie ${firstName}, passando pra lembrar de enviar seu check-in dessa semana lá no App, tá bom? Beijos!`)}` : undefined
        });
      }
      
      if (history.length >= 3) {
        const last3 = history.slice(-3);
        const allGood = last3.every(c => c.adesao_ao_plano >= 4);
        if (allGood) {
          alerts.push({ 
            id: 'a3', type: 'success', 
            text: `Fase de Cruzeiro: Alta consistência na adesão há 3 semanas.`, 
            icon: <Flame size={16} className="text-orange-500"/>,
            waText: 'Elogiar',
            waLink: waBase ? `${waBase}${encodeURIComponent(`Oi ${firstName}! Analisando seu histórico vi que sua adesão nas últimas 3 semanas foi impecável. Parabéns pelo foco, você tá arrasando! 👏🏻🔥`)}` : undefined
          });
        }
      }
    }

    let avgWater = 0;
    let hasRecentDifficultMood = false;
    
    if (dailyLogs.length > 0) {
      const recentLogs = dailyLogs.slice(0, 3);
      avgWater = recentLogs.reduce((acc, log) => acc + (log.water_ml || 0), 0) / recentLogs.length;
      hasRecentDifficultMood = recentLogs.some(log => log.mood === 'dificil');

      if (hasRecentDifficultMood && lastCheckin && lastCheckin.adesao_ao_plano <= 3) {
        alerts.push({ 
          id: 'ia1', type: 'danger', 
          text: 'Comportamental: Dias relatados como "difíceis" combinados com baixa adesão.', 
          icon: <Brain size={16}/>,
          waText: 'Acolher',
          waLink: waBase ? `${waBase}${encodeURIComponent(`Oi ${firstName}, vi pelo seu diário que os últimos dias foram um pouco difíceis. Quer conversar sobre isso? Podemos adaptar o plano se necessário.`)}` : undefined
        });
      }

      if (avgWater > 0 && avgWater < 1200) {
        alerts.push({ 
          id: 'ia2', type: 'warning', 
          text: `Desidratação Crônica: Média hídrica recente é de apenas ${Math.round(avgWater)}ml.`, 
          icon: <Droplets size={16}/>,
          waText: 'Avisar H2O',
          waLink: waBase ? `${waBase}${encodeURIComponent(`Oi ${firstName}, vi no app que sua ingestão de água caiu bastante esses dias. Lembra da sua garrafinha! O metabolismo precisa de água pra funcionar bem. 💧`)}` : undefined
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
        if (key === 'homair' && !value && latestBio.glucose && latestBio.insulin) value = ((parseFloat(latestBio.glucose) * parseFloat(latestBio.insulin)) / 405).toFixed(2);
        if(value !== null && value !== undefined) {
          const analysis = interpretBiochemical(key, parseFloat(value));
          if(analysis.status === 'danger') dangerExams.push(examMap[key]);
        }
      });

      if (dangerExams.length > 0) {
        alerts.push({ 
          id: 'b1', type: 'danger', 
          text: `Atenção Clínica Crítica: ${dangerExams.join(', ')} em níveis de risco elevado.`, 
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
          text: `Fator de Estagnação: O ganho/manutenção de peso recente pode estar agravado pelo baixo consumo hídrico.`, 
          icon: <TrendingUp size={16}/> 
        });
      }
    }

    return alerts;
  }, [history, antroData, bioData, dailyLogs, profile]);

  const patientAge = useMemo(() => calculateAge(profile?.data_nascimento), [profile]);

  const timelineData = useMemo(() => {
    const dateSet = new Set<string>();
    const formatD = (d: string) => new Date(d).toISOString().split('T')[0];
    
    history.forEach(h => dateSet.add(formatD(h.created_at)));
    antroData.forEach(a => dateSet.add(formatD(a.measurement_date)));
    skinfoldsData.forEach(s => dateSet.add(formatD(s.measurement_date)));
    bioData.forEach(b => dateSet.add(formatD(b.exam_date)));

    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Captura a altura baseada no histórico caso falte na linha do tempo atual (A altura em adultos é constante)
    let defaultHeightRaw = antroData.find(a => a.height)?.height || history.find(h => h.altura)?.altura || profile?.altura || null;
    const defaultHeight = defaultHeightRaw ? parseFloat(defaultHeightRaw) : null;

    return sortedDates.map(dateStr => {
      const checkin = history.find(h => formatD(h.created_at) === dateStr);
      const antro = antroData.find(a => formatD(a.measurement_date) === dateStr);
      const skin = skinfoldsData.find(s => formatD(s.measurement_date) === dateStr);
      const bio = bioData.find(b => formatD(b.exam_date) === dateStr);

      const currentWeightRaw = checkin?.peso || antro?.weight;
      const currentWeight = currentWeightRaw ? parseFloat(currentWeightRaw) : null;

      const currentHeightRaw = checkin?.altura || antro?.height;
      const currentHeight = currentHeightRaw ? parseFloat(currentHeightRaw) : defaultHeight;

      let imc: number | null = null;
      if (currentWeight && currentHeight) {
        imc = parseFloat((currentWeight / (currentHeight * currentHeight)).toFixed(1));
      }

      let sumFolds: number | null = null;
      let bf: number | null = null;
      let fatMass: number | null = null;
      let leanMass: number | null = null;
      
      if (skin) {
        const s1 = parseFloat(skin.triceps||0) + parseFloat(skin.biceps||0) + parseFloat(skin.subscapular||0) + parseFloat(skin.suprailiac||0) + parseFloat(skin.abdominal||0) + parseFloat(skin.thigh||0) + parseFloat(skin.calf||0);
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
    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - m * sumX) / n;
    
    if (m >= 0) return "Estagnado/Subindo"; 
    const targetX = (profile.meta_peso - b) / m;
    const targetDate = new Date(targetX * (1000 * 3600 * 24));
    
    if (targetDate.getTime() - new Date().getTime() > 365 * 24*60*60*1000) return "+ de 1 ano";
    return targetDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }, [history, profile?.meta_peso]);

  const ExamBadge = ({ label, value, unit, type }: { label: string, value: any, unit: string, type: string }) => {
    const analysis = interpretBiochemical(type, value ? parseFloat(value) : null);
    if (value === null || value === undefined || isNaN(value)) return null;

    return (
      <div className={`relative overflow-hidden group flex items-center justify-between p-3 rounded-xl border ${analysis.border} ${analysis.bg} transition-all`}>
        <div className="relative z-10 flex flex-col">
          <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider mb-0.5">{label}</span>
          <span className={`font-black text-lg ${analysis.color}`}>
            {value} <span className="text-xs font-semibold opacity-60">{unit}</span>
          </span>
        </div>
        <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm">
          {analysis.icon}
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-stone-900 text-white text-xs font-medium px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-xl text-center">
          {analysis.text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></div>
        </div>
      </div>
    );
  };

  const getMoodIcon = (mood: string) => {
    if (mood === 'feliz') return <div className="bg-green-100 text-green-600 p-2 rounded-full"><Smile size={20} /></div>;
    if (mood === 'neutro') return <div className="bg-amber-100 text-amber-600 p-2 rounded-full"><Meh size={20} /></div>;
    if (mood === 'dificil') return <div className="bg-rose-100 text-rose-600 p-2 rounded-full"><Frown size={20} /></div>;
    return <div className="bg-stone-100 text-stone-400 p-2 rounded-full"><Meh size={20} /></div>;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 pt-28 md:pt-36 lg:pt-40 font-sans text-stone-800">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* NAVEGAÇÃO */}
        <nav className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between mb-8 md:mb-12 gap-6 sm:gap-0 animate-fade-in-up">
          <Link href="/admin/dashboard" className="group w-full sm:w-auto flex items-center justify-center sm:justify-start gap-3 bg-white px-6 py-4 sm:py-3 rounded-2xl sm:rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 active:scale-[0.98] transition-all duration-300">
            <div className="bg-nutri-50 p-1.5 sm:p-1 rounded-xl sm:rounded-full group-hover:bg-nutri-800 transition-colors"><ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" /></div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel Admin</span>
          </Link>
          <div className="text-center sm:text-right w-full sm:w-auto">
            <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">Prontuário e Evolução</p>
            <h1 className="text-xl md:text-2xl font-bold text-nutri-900 flex items-center gap-2 justify-center sm:justify-end tracking-tight">
              <User size={20} /> {profile?.full_name}
            </h1>
          </div>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-10 animate-fade-in-up">
          
          {/* COLUNA 1: DADOS + RADAR CLÍNICO */}
          <div className="lg:col-span-1 flex flex-col gap-6 md:gap-8">
            <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 flex flex-col justify-between h-full">
              <div>
                <h2 className="text-lg md:text-xl font-bold mb-6 border-b border-stone-100 pb-4 text-stone-900">Dados do Paciente</h2>
                <div className="space-y-6 md:space-y-5">
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Idade e Sexo</p>
                    <p className="font-bold text-stone-700 text-lg">
                      {patientAge !== null ? `${patientAge} anos` : <span className="text-red-500 text-sm flex items-center gap-1"><AlertCircle size={14}/> Faltando no Perfil</span>} 
                      {profile?.sexo ? ` • ${profile.sexo}` : ' • Sexo não def.'}
                    </p>
                  </div>
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Perfil Definido</p><p className="font-bold text-nutri-900 uppercase bg-nutri-50 inline-block px-3 py-1 rounded-lg text-sm">{profile?.tipo_perfil || 'Não definido'}</p></div>
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Meta de Peso</p><p className="font-bold text-stone-700 text-lg">{profile?.meta_peso ? `${profile.meta_peso} kg` : 'Não definida'}</p></div>
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Último Peso Registrado</p><p className="font-bold text-stone-700 text-lg">{timelineData.length > 0 && timelineData[timelineData.length - 1].peso ? `${timelineData[timelineData.length - 1].peso} kg` : '---'}</p></div>
                  
                  {projectionDate && projectionDate !== "Estagnado/Subindo" && (
                    <div className="bg-nutri-50 p-4 rounded-xl border border-nutri-100 mt-6 flex items-start gap-3">
                      <Target className="text-nutri-600 mt-0.5 shrink-0" size={18} />
                      <div>
                        <p className="text-[10px] font-bold text-nutri-600 uppercase tracking-widest">Previsão da Meta (GPS)</p>
                        <p className="text-base font-black text-nutri-900">{projectionDate}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* RADAR CLÍNICO */}
            <section className="bg-stone-900 text-white p-6 md:p-8 rounded-[2rem] shadow-xl relative overflow-hidden group flex-1">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl transition-opacity"></div>
              <h2 className="text-sm font-black text-stone-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2 relative z-10">
                <Zap size={16} className="text-amber-400" /> Radar Clínico (IA)
              </h2>
              
              <div className="space-y-3 relative z-10">
                {activeAlerts.length > 0 ? (
                  activeAlerts.map(alert => (
                    <div key={alert.id} className={`flex flex-col gap-3 p-4 rounded-2xl border ${alert.type === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-100' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${alert.type === 'danger' ? 'text-red-400' : alert.type === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {alert.icon}
                        </div>
                        <p className="text-[13px] leading-snug font-medium flex-1">{alert.text}</p>
                      </div>
                      
                      {/* BOTÃO MÁGICO DO WHATSAPP */}
                      {alert.waLink && (
                        <a 
                          href={alert.waLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`mt-1 self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            alert.type === 'danger' ? 'bg-red-500/20 hover:bg-red-500/40 text-red-200' : 
                            alert.type === 'warning' ? 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-200' : 
                            'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-200'
                          }`}
                        >
                          <MessageCircle size={12} /> {alert.waText}
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-stone-800/50 border border-stone-800 text-stone-300">
                    <CheckCircle2 size={16} className="text-stone-500 mt-0.5 shrink-0" />
                    <p className="text-[13px] leading-snug font-medium">Sem alertas urgentes. Paciente estável dentro dos dados fornecidos.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* COLUNA 2: GRÁFICO PREMIUM MULTI-LENTES */}
          <section className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-stone-900">
                <TrendingUp className="text-nutri-800" size={24} /> Diagnóstico Evolutivo
              </h2>

              <div className="flex bg-stone-100 p-1.5 rounded-2xl w-full sm:w-auto">
                <button 
                  onClick={() => setActiveLens('medidas')} 
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeLens === 'medidas' ? 'bg-white text-nutri-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  <Scale size={14} /> Medidas
                </button>
                <button 
                  onClick={() => setActiveLens('composicao')} 
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeLens === 'composicao' ? 'bg-white text-nutri-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  <Layers size={14} /> Dobras
                </button>
                <button 
                  onClick={() => setActiveLens('metabolico')} 
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeLens === 'metabolico' ? 'bg-white text-nutri-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  <Activity size={14} /> Metabolismo
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[300px] w-full -ml-3 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineData} margin={{ top: 20, right: -10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAreaWaist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} />
                  
                  <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#818cf8" fontSize={11} axisLine={false} tickLine={false} />
                  
                  <RechartsTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-xl border border-stone-800">
                            <p className="text-xs font-bold text-stone-400 mb-2 border-b border-stone-700 pb-2">{new Date(data.date).toLocaleDateString('pt-BR')}</p>
                            
                            {activeLens === 'medidas' && (
                              <>
                                {data.peso && <p className="font-black text-emerald-400 flex justify-between gap-4">Peso: <span>{data.peso} kg</span></p>}
                                {data.cintura && <p className="font-black text-indigo-400 flex justify-between gap-4">Cintura: <span>{data.cintura} cm</span></p>}
                              </>
                            )}

                            {activeLens === 'composicao' && (
                              <>
                                {data.peso && <p className="font-black text-emerald-400 flex justify-between gap-4">Peso: <span>{data.peso} kg</span></p>}
                                {data.somatorio_dobras && <p className="font-black text-pink-400 flex justify-between gap-4">7 Dobras: <span>{data.somatorio_dobras} mm</span></p>}
                                {data.bf && <p className="font-black text-amber-400 flex justify-between gap-4">% Gordura: <span>{data.bf}%</span></p>}
                              </>
                            )}

                            {activeLens === 'metabolico' && (
                              <>
                                {data.cintura && <p className="font-black text-indigo-400 flex justify-between gap-4">Cintura: <span>{data.cintura} cm</span></p>}
                                {data.homair && <p className="font-black text-amber-400 flex justify-between gap-4">HOMA-IR: <span>{data.homair}</span></p>}
                              </>
                            )}

                            <div className="mt-2 pt-2 border-t border-stone-700 space-y-1">
                              {data.adesao && <p className="text-xs text-stone-300">Adesão: <span className="font-bold text-white">{data.adesao}/5</span></p>}
                              {data.hasExam && <p className="text-xs font-bold text-amber-400 mt-1 flex items-center gap-1"><Syringe size={12}/> Exame Realizado</p>}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  
                  {activeLens === 'medidas' && (
                    <>
                      {profile?.meta_peso && <ReferenceLine y={profile.meta_peso} yAxisId="left" stroke="#d6d3d1" strokeDasharray="5 5" label={{ position: 'top', value: 'META', fill: '#a8a29e', fontSize: 10, fontWeight: 'bold' }} />}
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" connectNulls />
                      <Line type="monotone" yAxisId="right" dataKey="cintura" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: "#6366f1" }} connectNulls />
                    </>
                  )}

                  {activeLens === 'composicao' && (
                    <>
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" connectNulls />
                      <Line type="monotone" yAxisId="right" dataKey="somatorio_dobras" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, fill: "#ec4899" }} connectNulls />
                      {/* Adicionando a linha de % de Gordura se houver dados */}
                      {timelineData.some(d => d.bf) && (
                         <Line type="monotone" yAxisId="right" dataKey="bf" stroke="#f59e0b" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: "#f59e0b" }} connectNulls />
                      )}
                    </>
                  )}

                  {activeLens === 'metabolico' && (
                    <>
                      <ReferenceLine y={2.0} yAxisId="right" stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'RISCO HOMA-IR', fill: '#ef4444', fontSize: 10 }} />
                      <Area type="monotone" yAxisId="left" dataKey="cintura" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAreaWaist)" connectNulls />
                      <Line type="monotone" yAxisId="right" dataKey="homair" stroke="#f59e0b" strokeWidth={4} dot={{ r: 5, fill: "#f59e0b" }} connectNulls />
                    </>
                  )}
                  
                  <Scatter yAxisId="left" dataKey="hasExam" shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (!payload.hasExam) return <g></g>;
                    return (
                      <g transform={`translate(${cx - 8},${cy - 25})`}>
                        <circle cx="8" cy="8" r="12" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
                        <Syringe x="1" y="1" size={14} color="#d97706" />
                      </g>
                    );
                  }} />

                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* --- ABAS DE TABELAS E PRONTUÁRIO --- */}
        <section className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex overflow-x-auto border-b border-stone-100 bg-stone-50/50 px-4 pt-4 gap-1 scrollbar-hide">
            <button onClick={() => setActiveTab('prontuario')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'prontuario' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><BookOpen size={18} /> Prontuário</button>
            <button onClick={() => setActiveTab('diario')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'diario' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><Coffee size={18} /> Diário do Paciente</button>
            <button onClick={() => setActiveTab('checkins')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'checkins' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><CalendarCheck size={18} /> Check-ins</button>
            <button onClick={() => setActiveTab('antropometria')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'antropometria' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><Ruler size={18} /> Antropometria</button>
            <button onClick={() => setActiveTab('dobras')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'dobras' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><Layers size={18} /> Dobras e BF%</button>
            <button onClick={() => setActiveTab('bioquimicos')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'bioquimicos' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><Activity size={18} /> Bioquímicos</button>
          </div>

          <div className="p-6 md:p-8">
            
            {activeTab === 'prontuario' && (
              <div className="animate-fade-in max-w-4xl mx-auto">
                <h2 className="text-lg md:text-xl font-bold mb-8 text-stone-900 flex items-center gap-2">
                  <Stethoscope className="text-nutri-800" /> Prontuário Clínico (Método S.O.A.P)
                </h2>
                
                {/* FORMS SOAP */}
                <div className="mb-12 bg-stone-50 p-6 rounded-[2rem] border border-stone-200 shadow-inner">
                  <div className="space-y-6">
                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-500 uppercase tracking-widest mb-2"><MessageCircle size={14}/> S - Subjetivo</label>
                      <textarea value={soapNote.s} onChange={e => setSoapNote({...soapNote, s: e.target.value})} placeholder="Queixas, relatos e informações dadas pelo paciente..." className="w-full p-4 rounded-xl border border-stone-200 focus:ring-2 focus:ring-nutri-800 outline-none h-20 resize-none text-sm bg-white" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-500 uppercase tracking-widest mb-2"><ClipboardList size={14}/> O - Objetivo</label>
                      <textarea value={soapNote.o} onChange={e => setSoapNote({...soapNote, o: e.target.value})} placeholder="Sinais clínicos, resultados de exames e medidas físicas observadas..." className="w-full p-4 rounded-xl border border-stone-200 focus:ring-2 focus:ring-nutri-800 outline-none h-20 resize-none text-sm bg-white" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-500 uppercase tracking-widest mb-2"><Brain size={14}/> A - Avaliação</label>
                      <textarea value={soapNote.a} onChange={e => setSoapNote({...soapNote, a: e.target.value})} placeholder="Seu diagnóstico nutricional e análise do quadro..." className="w-full p-4 rounded-xl border border-stone-200 focus:ring-2 focus:ring-nutri-800 outline-none h-20 resize-none text-sm bg-white" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-500 uppercase tracking-widest mb-2"><ListChecks size={14}/> P - Plano</label>
                      <textarea value={soapNote.p} onChange={e => setSoapNote({...soapNote, p: e.target.value})} placeholder="Conduta dietética, suplementação prescrita e próximos passos..." className="w-full p-4 rounded-xl border border-stone-200 focus:ring-2 focus:ring-nutri-800 outline-none h-20 resize-none text-sm bg-white" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <button onClick={handleSaveNote} disabled={savingNote || (!soapNote.s && !soapNote.o && !soapNote.a && !soapNote.p)} className="bg-nutri-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-nutri-800 active:scale-95 transition-all disabled:opacity-50">
                      {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Prontuário
                    </button>
                  </div>
                </div>

                {/* HISTÓRICO DE NOTAS */}
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-stone-200 before:to-transparent">
                  {notes.map((note) => {
                    // Simples formatador visual se a nota já foi salva com ** ou se é velha
                    const formattedContent = note.content.includes('**S') ? (
                      <div dangerouslySetInnerHTML={{ __html: note.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-nutri-900 block mt-2 mb-0.5">$1</strong>').replace(/\n/g, '<br/>') }} />
                    ) : (
                      <p className="whitespace-pre-wrap">{note.content}</p>
                    );

                    return (
                      <div key={note.id} className="relative flex items-start group">
                        <div className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-nutri-800 shadow-sm z-10"><div className="w-2 h-2 bg-nutri-800 rounded-full"></div></div>
                        <div className="ml-14 flex-1 bg-white p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-center mb-3 border-b border-stone-100 pb-3">
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</span>
                            <button onClick={() => handleDeleteNote(note.id)} className="text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                          </div>
                          <div className="text-stone-600 leading-relaxed text-sm">
                            {formattedContent}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {notes.length === 0 && <div className="text-center py-10 text-stone-400 italic bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">Nenhum prontuário registrado ainda.</div>}
                </div>
              </div>
            )}

            {activeTab === 'diario' && (
              <div className="animate-fade-in">
                {/* Diário UI */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                  <div><h2 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2"><Coffee className="text-nutri-800" /> Rotina Diária</h2><p className="text-sm text-stone-500 mt-1">Acompanhe o que o paciente registra no aplicativo dia a dia.</p></div>
                </div>
                {dailyLogs.length === 0 ? (
                  <div className="text-center py-12 text-stone-400 italic bg-stone-50/50 rounded-[2rem] border border-dashed border-stone-200 flex flex-col items-center justify-center"><Coffee size={40} className="mb-4 text-stone-300" /><p>O paciente ainda não começou a registrar sua rotina diária no app.</p></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dailyLogs.map((log) => {
                      const mealCount = Array.isArray(log.meals_checked) ? log.meals_checked.length : 0;
                      return (
                        <div key={log.id} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                          <div className="flex justify-between items-start mb-6 border-b border-stone-50 pb-4">
                            <div><p className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-1">Data</p><h3 className="font-bold text-stone-800">{new Date(log.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</h3></div>
                            <div title={`Humor: ${log.mood || 'Não informado'}`}>{getMoodIcon(log.mood)}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col justify-center items-center text-center"><Droplets size={18} className="text-blue-500 mb-2" /><p className="text-xl font-black text-blue-900">{log.water_ml || 0} <span className="text-xs font-bold text-blue-600">ml</span></p><p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1">Água</p></div>
                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex flex-col justify-center items-center text-center relative"><Check size={18} className="text-green-500 mb-2" /><p className="text-xl font-black text-stone-900">{mealCount}</p><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Refeições</p></div>
                          </div>
                          {mealCount > 0 && (
                            <div className="mt-4 pt-4 border-t border-stone-100"><p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Refeições Marcadas:</p><ul className="flex flex-wrap gap-1.5">{log.meals_checked.map((meal: string, idx: number) => (<li key={idx} className="bg-stone-100 text-stone-600 text-[10px] px-2 py-1 rounded-md font-medium">{meal}</li>))}</ul></div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'checkins' && (
              <div className="animate-fade-in">
                <h2 className="text-lg md:text-xl font-bold mb-6 text-stone-900">Relatos Dominicais</h2>
                <div className="overflow-x-auto -mx-6 px-6 scrollbar-hide">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b-2 border-stone-100">
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Data</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Peso</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Adesão</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Humor</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Relato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {history.slice().reverse().map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-4 px-2 font-bold text-stone-700 text-sm whitespace-nowrap">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-2 font-medium text-sm">{item.peso} kg</td>
                          <td className="py-4 px-2 text-sm"><span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${item.adesao_ao_plano >= 4 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{item.adesao_ao_plano}/5</span></td>
                          <td className="py-4 px-2 font-bold text-sm text-stone-500">{item.humor_semanal}/5</td>
                          <td className="py-4 px-2 text-xs text-stone-600 leading-relaxed">{item.comentarios || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'antropometria' && (
              <div className="animate-fade-in overflow-x-auto scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
                <h2 className="text-lg md:text-xl font-bold mb-6 text-stone-900">Medidas de Circunferência</h2>
                <table className="w-full text-left min-w-[900px]">
                  <thead>
                    <tr className="border-b-2 border-stone-100">
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Data</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Peso</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Altura</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Cintura</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Quadril</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Braço</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Panturrilha</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Pescoço</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {antroData.map(i => (
                      <tr key={i.id} className="hover:bg-stone-50/50">
                        <td className="py-4 px-2 font-bold text-sm">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td>
                        <td className="py-4 px-2 text-sm">{i.weight ? `${i.weight}kg` : '-'}</td>
                        <td className="py-4 px-2 text-sm">{i.height ? `${i.height}m` : '-'}</td>
                        <td className="py-4 px-2 text-sm">{i.waist ? `${i.waist}cm` : '-'}</td>
                        <td className="py-4 px-2 text-sm">{i.hip ? `${i.hip}cm` : '-'}</td>
                        <td className="py-4 px-2 text-sm">{i.arm ? `${i.arm}cm` : '-'}</td>
                        <td className="py-4 px-2 text-sm">{i.calf ? `${i.calf}cm` : '-'}</td>
                        <td className="py-4 px-2 text-sm">{i.neck ? `${i.neck}cm` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ABA DE DOBRAS COM QUADRANTE DE OURO (IMC, % GORDURA, M. MAGRA E M. GORDA) */}
            {activeTab === 'dobras' && (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2">
                    <Layers className="text-nutri-800" /> Dobras Cutâneas & Composição
                  </h2>
                </div>

                {/* CARD DE COMPOSIÇÃO CORPORAL ATUAL */}
                {skinfoldsData.length > 0 && timelineData.length > 0 && (
                  <div className="bg-nutri-900 rounded-[2rem] p-6 md:p-8 mb-8 text-white flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl shadow-nutri-900/20">
                    <div className="text-center lg:text-left w-full lg:w-auto">
                      <h3 className="text-[10px] font-black text-nutri-300 uppercase tracking-[0.2em] mb-2">Composição Atual (Jackson & Pollock)</h3>
                      <p className="text-sm text-nutri-100/80">
                        {patientAge !== null 
                          ? `Fórmula de 7 dobras. Calculada p/ ${patientAge} anos (${profile?.sexo || 'Não def.'}).`
                          : <span className="text-red-300 flex items-center gap-1 font-bold justify-center lg:justify-start"><AlertCircle size={14}/> Preencha a data de nascimento no perfil para calcular.</span>
                        }
                      </p>
                    </div>
                    
                    {(() => {
                      const latestSkin = skinfoldsData[0];
                      const s1 = parseFloat(latestSkin.triceps||0) + parseFloat(latestSkin.biceps||0) + parseFloat(latestSkin.subscapular||0) + parseFloat(latestSkin.suprailiac||0) + parseFloat(latestSkin.abdominal||0) + parseFloat(latestSkin.thigh||0) + parseFloat(latestSkin.calf||0);
                      const tPoint = timelineData.slice().reverse().find(t => t.somatorio_dobras === parseFloat(s1.toFixed(1)));
                      
                      if (tPoint && tPoint.bf && patientAge !== null) {
                        return (
                          <div className="flex flex-wrap gap-3 w-full lg:w-auto mt-4 lg:mt-0 justify-center lg:justify-end">
                            <div className="bg-white/10 p-4 rounded-2xl flex-1 min-w-[100px] max-w-[140px] text-center border border-white/20">
                              <p className="text-2xl font-black text-cyan-400">{tPoint.imc || '-'}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">IMC</p>
                            </div>
                            <div className="bg-white/10 p-4 rounded-2xl flex-1 min-w-[100px] max-w-[140px] text-center border border-white/20">
                              <p className="text-2xl font-black text-amber-400">{tPoint.bf}%</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">Gordura</p>
                            </div>
                            <div className="bg-white/10 p-4 rounded-2xl flex-1 min-w-[100px] max-w-[140px] text-center border border-white/20">
                              <p className="text-2xl font-black text-emerald-400">{tPoint.leanMass}kg</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">M. Magra</p>
                            </div>
                            <div className="bg-white/10 p-4 rounded-2xl flex-1 min-w-[100px] max-w-[140px] text-center border border-white/20">
                              <p className="text-2xl font-black text-rose-400">{tPoint.fatMass}kg</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">M. Gorda</p>
                            </div>
                          </div>
                        )
                      }
                      return <p className="text-sm font-medium italic opacity-70">Necessário peso atualizado.</p>;
                    })()}
                  </div>
                )}

                <div className="overflow-x-auto scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
                  <table className="w-full text-left min-w-[1000px]">
                    <thead>
                      <tr className="border-b-2 border-stone-100">
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Data</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Somatório</th>
                        <th className="py-4 px-2 text-[10px] text-cyan-600 uppercase font-black">IMC</th>
                        <th className="py-4 px-2 text-[10px] text-amber-500 uppercase font-black">% Gord.</th>
                        <th className="py-4 px-2 text-[10px] text-emerald-500 uppercase font-black">M. Magra</th>
                        <th className="py-4 px-2 text-[10px] text-rose-500 uppercase font-black">M. Gorda</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black pl-4 border-l border-stone-100">Tric.</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Bic.</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Sub.</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Sup.</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Abd.</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Coxa</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Pant.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {skinfoldsData.map(i => {
                         const sum = parseFloat(i.triceps||0) + parseFloat(i.biceps||0) + parseFloat(i.subscapular||0) + parseFloat(i.suprailiac||0) + parseFloat(i.abdominal||0) + parseFloat(i.thigh||0) + parseFloat(i.calf||0);
                         
                         const formatD = (d: string) => new Date(d).toISOString().split('T')[0];
                         const tPoint = timelineData.find(t => t.date === formatD(i.measurement_date) && t.somatorio_dobras === parseFloat(sum.toFixed(1)));
                         
                         const bf = tPoint?.bf;
                         const imc = tPoint?.imc;
                         const mMag = tPoint?.leanMass;
                         const mGorda = tPoint?.fatMass;

                         return (
                          <tr key={i.id} className="hover:bg-stone-50/50">
                            <td className="py-4 px-2 font-bold text-sm text-stone-700">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td>
                            <td className="py-4 px-2 font-black text-nutri-700">{sum > 0 ? sum.toFixed(1) : '-'}</td>
                            <td className="py-4 px-2 font-bold text-cyan-600">{imc ? imc : '-'}</td>
                            <td className="py-4 px-2 font-bold text-amber-600">{bf ? `${bf}%` : '-'}</td>
                            <td className="py-4 px-2 font-bold text-emerald-600">{mMag ? `${mMag}kg` : '-'}</td>
                            <td className="py-4 px-2 font-bold text-rose-600">{mGorda ? `${mGorda}kg` : '-'}</td>
                            <td className="py-4 px-2 text-sm pl-4 border-l border-stone-100">{i.triceps || '-'}</td>
                            <td className="py-4 px-2 text-sm">{i.biceps || '-'}</td>
                            <td className="py-4 px-2 text-sm">{i.subscapular || '-'}</td>
                            <td className="py-4 px-2 text-sm">{i.suprailiac || '-'}</td>
                            <td className="py-4 px-2 text-sm">{i.abdominal || '-'}</td>
                            <td className="py-4 px-2 text-sm">{i.thigh || '-'}</td>
                            <td className="py-4 px-2 text-sm">{i.calf || '-'}</td>
                          </tr>
                         )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'bioquimicos' && (
              <div className="animate-fade-in space-y-12">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2">
                    <Activity className="text-nutri-800" /> Histórico Inteligente de Laboratório
                  </h2>
                  <div className="hidden sm:flex gap-4 text-[10px] font-bold uppercase text-stone-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ideal</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Atenção</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Risco</span>
                  </div>
                </div>

                {bioData.length === 0 ? (
                  <div className="text-center py-10 text-stone-400 italic bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                    Nenhum exame cadastrado.
                  </div>
                ) : (
                  bioData.map((item) => {
                    const homaIr = (item.glucose && item.insulin) ? ((parseFloat(item.glucose) * parseFloat(item.insulin)) / 405).toFixed(2) : null;

                    return (
                      <div key={item.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                        <div className="bg-stone-50/80 px-6 py-4 border-b border-stone-200 flex items-center justify-between">
                          <span className="font-bold text-nutri-900 text-sm">Realizado em: {new Date(item.exam_date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        
                        <div className="p-6 space-y-8">
                          
                          {(item.glucose || item.insulin || item.hba1c) && (
                            <div className="border-b border-stone-100 pb-8">
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-4 tracking-widest flex items-center gap-1"><ChevronRight size={14}/> Perfil Glicêmico</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <ExamBadge label="Glicose" value={item.glucose} unit="mg/dL" type="glucose" />
                                <ExamBadge label="Insulina" value={item.insulin} unit="µUI/mL" type="insulin" />
                                <ExamBadge label="HbA1c" value={item.hba1c} unit="%" type="hba1c" />
                                <ExamBadge label="HOMA-IR" value={homaIr} unit="índice" type="homair" />
                              </div>
                            </div>
                          )}

                          {(item.total_cholesterol || item.hdl || item.ldl || item.triglycerides) && (
                            <div className="border-b border-stone-100 pb-8">
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-4 tracking-widest flex items-center gap-1"><ChevronRight size={14}/> Perfil Lipídico</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <ExamBadge label="Colesterol Total" value={item.total_cholesterol} unit="mg/dL" type="total_cholesterol" />
                                <ExamBadge label="HDL (Bom)" value={item.hdl} unit="mg/dL" type="hdl" />
                                <ExamBadge label="LDL (Ruim)" value={item.ldl} unit="mg/dL" type="ldl" />
                                <ExamBadge label="Triglicerídeos" value={item.triglycerides} unit="mg/dL" type="triglycerides" />
                              </div>
                            </div>
                          )}

                          {(item.ferritin || item.pcr || item.tgp || item.creatinine || item.urea) && (
                            <div className="border-b border-stone-100 pb-8">
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-4 tracking-widest flex items-center gap-1"><ChevronRight size={14}/> Inflamação & Órgãos</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                <ExamBadge label="Ferritina" value={item.ferritin} unit="ng/mL" type="ferritin" />
                                <ExamBadge label="PCR" value={item.pcr} unit="mg/dL" type="pcr" />
                                <ExamBadge label="TGP (Fígado)" value={item.tgp} unit="U/L" type="tgp" />
                                <ExamBadge label="Creatinina" value={item.creatinine} unit="mg/dL" type="creatinine" />
                                <ExamBadge label="Ureia" value={item.urea} unit="mg/dL" type="urea" />
                              </div>
                            </div>
                          )}

                          {(item.vitamin_d || item.vitamin_b12 || item.tsh || item.iron) && (
                            <div>
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-4 tracking-widest flex items-center gap-1"><ChevronRight size={14}/> Vitaminas & Hormonal</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <ExamBadge label="Vitamina D" value={item.vitamin_d} unit="ng/mL" type="vitamin_d" />
                                <ExamBadge label="Vitamina B12" value={item.vitamin_b12} unit="pg/mL" type="vitamin_b12" />
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

      </div>
    </main>
  );
}