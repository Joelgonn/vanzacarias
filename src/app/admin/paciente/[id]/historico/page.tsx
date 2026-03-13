'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, ChevronLeft, TrendingUp, User, Ruler, Layers, 
  Syringe, CalendarCheck, BookOpen, Send, Trash2, 
  AlertCircle, CheckCircle2, AlertTriangle, Activity, Target,
  Clock, Zap
} from 'lucide-react';
import Link from 'next/link';
import { 
  ComposedChart, LineChart, Area, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Scatter 
} from 'recharts';

export default function PacienteHistoricoAdmin() {
  const [history, setHistory] = useState<any[]>([]); 
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [antroData, setAntroData] = useState<any[]>([]);
  const [skinfoldsData, setSkinfoldsData] = useState<any[]>([]);
  const [bioData, setBioData] = useState<any[]>([]);
  
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [activeTab, setActiveTab] = useState<'checkins' | 'antropometria' | 'dobras' | 'bioquimicos' | 'prontuario'>('prontuario');

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

    setProfile(profileData);
    setHistory(processedHistory);
    setAntroData(antro || []);
    setSkinfoldsData(skin || []);
    setBioData(bio || []);
    setNotes(notesData || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [supabase, router, pacienteId]);

  const handleSaveNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { error } = await supabase.from('clinical_notes').insert([{ user_id: pacienteId, content: newNote }]);
    if (!error) {
      setNewNote('');
      fetchData();
    } else {
      alert("Erro ao salvar nota.");
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Deseja excluir esta anotação do prontuário?")) return;
    await supabase.from('clinical_notes').delete().eq('id', id);
    fetchData();
  };

  const getReferenceRange = (perfil: string) => {
    if (perfil === 'idoso') return { min: 22, max: 27 };
    if (perfil === 'crianca') return { min: 14, max: 19 };
    return { min: 18.5, max: 24.9 };
  };

  const range = getReferenceRange(profile?.tipo_perfil || 'adulto');

  const chartData = useMemo(() => {
    if (!history.length) return [];
    
    return history.map(h => {
      const date = new Date(h.created_at);
      const nearestAntro = antroData.find(a => Math.abs(new Date(a.measurement_date).getTime() - date.getTime()) < 7 * 24*60*60*1000);
      const hasExam = bioData.some(b => Math.abs(new Date(b.exam_date).getTime() - date.getTime()) < 5 * 24*60*60*1000);

      return {
        date: h.created_at,
        peso: h.peso,
        imc: h.imc,
        cintura: nearestAntro ? nearestAntro.waist : null,
        adesao: h.adesao_ao_plano,
        humor: h.humor_semanal,
        hasExam: hasExam ? h.peso : null, 
      };
    });
  }, [history, antroData, bioData]);

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

  const interpretBiochemical = (type: string, value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return { status: 'neutral', text: 'Sem dados', color: 'text-stone-400', bg: 'bg-stone-100', border: 'border-stone-100', icon: null, stroke: '#d6d3d1' };
    }

    let status = 'normal';
    let text = 'Ideal';

    switch (type) {
      case 'glucose': 
        if (value >= 126) { status = 'danger'; text = 'Risco de Diabetes (>125)'; }
        else if (value >= 100) { status = 'warning'; text = 'Resistência à Insulina / Pré-diabetes'; }
        break;
      case 'insulin': 
        if (value >= 15) { status = 'warning'; text = 'Resistência à Insulina alta'; }
        else if (value > 25) { status = 'danger'; text = 'Hiperinsulinemia severa'; }
        break;
      case 'homair': 
        if (value >= 2.5) { status = 'danger'; text = 'Resistência Severa (>2.5)'; }
        else if (value >= 2.0) { status = 'warning'; text = 'Resistência Moderada'; }
        break;
      case 'ldl': 
        if (value >= 160) { status = 'danger'; text = 'Risco Cardiovascular Alto'; }
        else if (value >= 130) { status = 'warning'; text = 'Acima do recomendado'; }
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

  // ==========================================
  // PILAR 3: RADAR CLÍNICO INTELIGENTE (IA Ativa)
  // ==========================================
  const activeAlerts = useMemo(() => {
    const alerts: { id: string, type: 'success' | 'warning' | 'danger', text: string, icon: any }[] = [];
    
    // 1. Alertas de Engajamento e Adesão
    if (history.length > 0) {
      const lastCheckin = history[history.length - 1];
      const daysSince = Math.floor((new Date().getTime() - new Date(lastCheckin.created_at).getTime()) / (1000 * 3600 * 24));
      
      if (daysSince > 10) {
        alerts.push({ id: 'a1', type: 'warning', text: `Ausente: Sem check-in há ${daysSince} dias.`, icon: <Clock size={16}/> });
      }
      
      if (lastCheckin.adesao_ao_plano <= 2) {
        alerts.push({ id: 'a2', type: 'danger', text: `Baixa adesão no último relato (${lastCheckin.adesao_ao_plano}/5).`, icon: <AlertTriangle size={16}/> });
      } else if (lastCheckin.adesao_ao_plano === 5) {
        alerts.push({ id: 'a3', type: 'success', text: `Adesão excelente no último check-in!`, icon: <Star size={16} className="text-emerald-500"/> });
      }
    }

    // 2. Alertas de Medidas (Evolução de Cintura)
    if (antroData.length >= 2) {
      if (antroData[0].waist && antroData[1].waist) {
        const diff = antroData[0].waist - antroData[1].waist;
        if (diff < 0) {
          alerts.push({ id: 'm1', type: 'success', text: `Cintura reduziu ${Math.abs(diff).toFixed(1)}cm desde a última medida.`, icon: <TrendingUp size={16} className="rotate-180"/> });
        } else if (diff > 0) {
          alerts.push({ id: 'm2', type: 'warning', text: `Cintura aumentou ${Math.abs(diff).toFixed(1)}cm.`, icon: <TrendingUp size={16}/> });
        }
      }
    }

    // 3. Alertas Bioquímicos (Detectar Risco em Exames)
    if (bioData.length > 0) {
      const latestBio = bioData[0];
      const examsToCheck = ['glucose', 'insulin', 'ldl', 'triglycerides', 'vitamin_d', 'vitamin_b12', 'ferritin', 'pcr'];
      let dangerCount = 0;
      let warningCount = 0;

      examsToCheck.forEach(exam => {
        if(latestBio[exam] !== null && latestBio[exam] !== undefined) {
          const analysis = interpretBiochemical(exam, parseFloat(latestBio[exam]));
          if(analysis.status === 'danger') dangerCount++;
          if(analysis.status === 'warning') warningCount++;
        }
      });

      if (dangerCount > 0) {
        alerts.push({ id: 'b1', type: 'danger', text: `${dangerCount} exame(s) em nível de RISCO no laboratório atual.`, icon: <Activity size={16}/> });
      } else if (warningCount > 0) {
        alerts.push({ id: 'b2', type: 'warning', text: `${warningCount} exame(s) merecem atenção dietética.`, icon: <Syringe size={16}/> });
      }
    }

    return alerts;
  }, [history, antroData, bioData]);


  const ExamBadge = ({ label, value, unit, type }: { label: string, value: any, unit: string, type: string }) => {
    const analysis = interpretBiochemical(type, value ? parseFloat(value) : null);
    const historyData = bioData.map(b => ({ val: parseFloat(b[type]) })).filter(b => !isNaN(b.val)).reverse();
    
    if (!value) return null;

    return (
      <div className={`relative overflow-hidden group flex items-center justify-between p-3 rounded-xl border ${analysis.border} ${analysis.bg} transition-all`}>
        {historyData.length > 1 && (
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <Line type="monotone" dataKey="val" stroke={analysis.stroke} strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
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
            <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">Prontuário</p>
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
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Perfil Definido</p><p className="font-bold text-nutri-900 uppercase bg-nutri-50 inline-block px-3 py-1 rounded-lg text-sm">{profile?.tipo_perfil}</p></div>
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Meta de Peso</p><p className="font-bold text-stone-700 text-lg">{profile?.meta_peso ? `${profile.meta_peso} kg` : 'Não definida'}</p></div>
                  <div><p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Último Peso (Check-in)</p><p className="font-bold text-stone-700 text-lg">{history.length > 0 ? `${history[history.length - 1].peso} kg` : '---'}</p></div>
                  
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

            {/* O NOVO RADAR CLÍNICO */}
            <section className="bg-stone-900 text-white p-6 md:p-8 rounded-[2rem] shadow-xl relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl transition-opacity"></div>
              <h2 className="text-sm font-black text-stone-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2 relative z-10">
                <Zap size={16} className="text-amber-400" /> Radar Clínico (IA)
              </h2>
              
              <div className="space-y-3 relative z-10">
                {activeAlerts.length > 0 ? (
                  activeAlerts.map(alert => (
                    <div key={alert.id} className={`flex items-start gap-3 p-3.5 rounded-xl border ${alert.type === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-100' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100'}`}>
                      <div className={`mt-0.5 ${alert.type === 'danger' ? 'text-red-400' : alert.type === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {alert.icon}
                      </div>
                      <p className="text-sm leading-snug font-medium">{alert.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-800/50 border border-stone-800 text-stone-300">
                    <CheckCircle2 size={16} className="text-stone-500 mt-0.5" />
                    <p className="text-sm leading-snug font-medium">Sem alertas urgentes ou dados insuficientes.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* GRÁFICO PREMIUM: EIXO DUPLO E EXAMES */}
          <section className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-stone-900">
                <TrendingUp className="text-nutri-800" size={24} /> Diagnóstico Evolutivo
              </h2>
              <div className="hidden sm:flex gap-4 text-[10px] font-bold uppercase text-stone-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-500"></span> Peso</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1 rounded-full bg-indigo-500"></span> Cintura</span>
                <span className="flex items-center gap-1"><Syringe size={12} className="text-amber-500" /> Exames</span>
              </div>
            </div>

            <div className="flex-1 min-h-[300px] w-full -ml-3 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: -10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPeso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} tickFormatter={val => `${val}kg`} />
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#818cf8" fontSize={11} axisLine={false} tickLine={false} tickFormatter={val => `${val}cm`} />
                  <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} />
                  
                  <RechartsTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-xl border border-stone-800">
                            <p className="text-xs font-bold text-stone-400 mb-2 border-b border-stone-700 pb-2">{new Date(data.date).toLocaleDateString('pt-BR')}</p>
                            <p className="font-black text-emerald-400 flex justify-between gap-4">Peso: <span>{data.peso} kg</span></p>
                            {data.cintura && <p className="font-black text-indigo-400 flex justify-between gap-4">Cintura: <span>{data.cintura} cm</span></p>}
                            <div className="mt-2 pt-2 border-t border-stone-700 space-y-1">
                              <p className="text-xs text-stone-300">Adesão: <span className="font-bold text-white">{data.adesao}/5</span></p>
                              {data.hasExam && <p className="text-xs font-bold text-amber-400 mt-1 flex items-center gap-1"><Syringe size={12}/> Exame Realizado</p>}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  
                  {profile?.meta_peso && <ReferenceLine y={profile.meta_peso} yAxisId="left" stroke="#d6d3d1" strokeDasharray="5 5" label={{ position: 'top', value: 'META', fill: '#a8a29e', fontSize: 10, fontWeight: 'bold' }} />}
                  <Area type="monotone" yAxisId="left" dataKey="peso" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPeso)" activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Line type="monotone" yAxisId="right" dataKey="cintura" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: "#6366f1" }} connectNulls />
                  
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

        {/* --- ABAS (PRONTUÁRIO, EXAMES, ETC) MANTIDAS INTACTAS ABAIXO --- */}
        <section className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex overflow-x-auto border-b border-stone-100 bg-stone-50/50 px-4 pt-4 gap-1 scrollbar-hide">
            <button onClick={() => setActiveTab('prontuario')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'prontuario' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><BookOpen size={18} /> Prontuário / Evolução</button>
            <button onClick={() => setActiveTab('checkins')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'checkins' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><CalendarCheck size={18} /> Check-ins</button>
            <button onClick={() => setActiveTab('antropometria')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'antropometria' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><Ruler size={18} /> Antropometria</button>
            <button onClick={() => setActiveTab('dobras')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'dobras' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><Layers size={18} /> Dobras Cutâneas</button>
            <button onClick={() => setActiveTab('bioquimicos')} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'bioquimicos' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}><Activity size={18} /> Análise Bioquímica</button>
          </div>

          <div className="p-6 md:p-8">
            
            {activeTab === 'prontuario' && (
              <div className="animate-fade-in max-w-4xl mx-auto">
                <h2 className="text-lg md:text-xl font-bold mb-8 text-stone-900 flex items-center gap-2">
                  <BookOpen className="text-nutri-800" /> Evolução Clínica e Conduta
                </h2>
                <div className="mb-12 bg-stone-50/50 p-6 rounded-[2rem] border border-stone-100">
                  <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Escreva aqui a evolução do paciente nesta consulta ou conduta técnica..." className="w-full p-5 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-nutri-800 outline-none h-32 resize-none text-sm leading-relaxed bg-white"/>
                  <div className="flex justify-end mt-4"><button onClick={handleSaveNote} disabled={savingNote || !newNote.trim()} className="bg-nutri-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-nutri-800 active:scale-95 transition-all disabled:opacity-50">{savingNote ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Salvar no Prontuário</button></div>
                </div>
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-stone-200 before:to-transparent">
                  {notes.map((note) => (
                    <div key={note.id} className="relative flex items-start group">
                      <div className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-nutri-800 shadow-sm z-10"><div className="w-2 h-2 bg-nutri-800 rounded-full"></div></div>
                      <div className="ml-14 flex-1 bg-white p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-black text-nutri-800 uppercase tracking-widest">{new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                          <button onClick={() => handleDeleteNote(note.id)} className="text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                        <p className="text-stone-600 leading-relaxed text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && <div className="text-center py-10 text-stone-400 italic bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">Nenhuma anotação registrada ainda.</div>}
                </div>
              </div>
            )}

            {activeTab === 'checkins' && (
              <div className="animate-fade-in">
                <h2 className="text-lg md:text-xl font-bold mb-6 text-stone-900">Relatos Dominicais</h2>
                <div className="overflow-x-auto -mx-6 px-6">
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
              <div className="animate-fade-in overflow-x-auto">
                <h2 className="text-lg md:text-xl font-bold mb-6 text-stone-900">Medidas de Circunferência</h2>
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="border-b-2 border-stone-100">
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Data</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Peso</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Cintura</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Quadril</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {antroData.map(i => (
                      <tr key={i.id} className="hover:bg-stone-50/50">
                        <td className="py-4 px-2 font-bold text-sm">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td>
                        <td className="py-4 px-2 text-sm">{i.weight}kg</td>
                        <td className="py-4 px-2 text-sm">{i.waist}cm</td>
                        <td className="py-4 px-2 text-sm">{i.hip}cm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'dobras' && (
              <div className="animate-fade-in overflow-x-auto">
                <h2 className="text-lg md:text-xl font-bold mb-6 text-stone-900">Protocolo de Dobras (mm)</h2>
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="border-b-2 border-stone-100">
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Data</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Abdominal</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Coxa</th>
                      <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Subescapular</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {skinfoldsData.map(i => (
                      <tr key={i.id} className="hover:bg-stone-50/50">
                        <td className="py-4 px-2 font-bold text-sm">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td>
                        <td className="py-4 px-2 text-sm">{i.abdominal}</td>
                        <td className="py-4 px-2 text-sm">{i.thigh}</td>
                        <td className="py-4 px-2 text-sm">{i.subscapular}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'bioquimicos' && (
              <div className="animate-fade-in space-y-12">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg md:text-xl font-bold text-stone-900 flex items-center gap-2">
                    <Activity className="text-nutri-800" /> Histórico Inteligente de Laboratório
                  </h2>
                  <div className="flex gap-4 text-[10px] font-bold uppercase text-stone-500">
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
                        
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {(item.glucose || item.insulin) && (
                            <div className="col-span-full border-b border-stone-100 pb-4 mb-2">
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-3 tracking-widest">Perfil Glicêmico</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <ExamBadge label="Glicose" value={item.glucose} unit="mg/dL" type="glucose" />
                                <ExamBadge label="Insulina" value={item.insulin} unit="µUI/mL" type="insulin" />
                                <ExamBadge label="HOMA-IR" value={homaIr} unit="índice" type="homair" />
                              </div>
                            </div>
                          )}

                          {(item.total_cholesterol || item.ldl || item.triglycerides) && (
                            <div className="col-span-full border-b border-stone-100 pb-4 mb-2">
                              <h3 className="text-xs font-black uppercase text-stone-400 mb-3 tracking-widest">Perfil Lipídico</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <ExamBadge label="Colesterol Total" value={item.total_cholesterol} unit="mg/dL" type="total_cholesterol" />
                                <ExamBadge label="LDL" value={item.ldl} unit="mg/dL" type="ldl" />
                                <ExamBadge label="Triglicerídeos" value={item.triglycerides} unit="mg/dL" type="triglycerides" />
                              </div>
                            </div>
                          )}

                          <div className="col-span-full">
                            <h3 className="text-xs font-black uppercase text-stone-400 mb-3 tracking-widest">Vitamínico e Inflamatório</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <ExamBadge label="Vitamina D" value={item.vitamin_d} unit="ng/mL" type="vitamin_d" />
                              <ExamBadge label="Vitamina B12" value={item.vitamin_b12} unit="pg/mL" type="vitamin_b12" />
                              <ExamBadge label="Ferritina" value={item.ferritin} unit="ng/mL" type="ferritin" />
                              <ExamBadge label="PCR" value={item.pcr} unit="mg/dL" type="pcr" />
                              <ExamBadge label="TGP (Fígado)" value={item.tgp} unit="U/L" type="tgp" />
                              <ExamBadge label="Creatinina (Rins)" value={item.creatinine} unit="mg/dL" type="creatinine" />
                            </div>
                          </div>
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

// Icone extra faltante: Import do icone Star precisa existir no topo, mas criei localmente caso não ache.
function Star(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  );
}