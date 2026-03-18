'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import confetti from 'canvas-confetti';
import { 
  Loader2, CheckCircle2, TrendingDown, PlusCircle, X,
  Flame, Trophy, AlertCircle, Ruler, ArrowRight, HeartPulse, 
  Lock, Star, Zap, Utensils, ClipboardCheck, Droplets, Check,
  Smile, Frown, Meh, BellRing, Scale, Layers, Activity, Syringe,
  Target, Calendar, ArrowDown, ArrowUp, Minus
} from 'lucide-react';
import Link from 'next/link';
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Scatter 
} from 'recharts';
import CheckinForm from '@/components/CheckinForm';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [antroData, setAntroData] = useState<any[]>([]); 
  const [skinfoldsData, setSkinfoldsData] = useState<any[]>([]);
  const [bioData, setBioData] = useState<any[]>([]);
  const [nextAppointment, setNextAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [hasCompletedQFA, setHasCompletedQFA] = useState<boolean>(true);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);

  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(true); 
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  
  const [activeLens, setActiveLens] = useState<'medidas' | 'composicao' | 'metabolico'>('medidas');

  const [dailyLog, setDailyLog] = useState({
    water_ml: 0,
    meals_checked: [] as string[],
    mood: null as string | null
  });

  const router = useRouter();
  const supabase = createClient();

  const getTodayString = () => {
    const today = new Date();
    return today.toLocaleDateString('en-CA'); 
  };

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    if (session.user.email === 'vankadosh@gmail.com') {
      router.push('/admin/dashboard');
      return;
    }

    const userId = session.user.id;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, status, meta_peso, account_type, trial_ends_at, created_at, has_meal_plan_access, meal_plan')
      .eq('id', userId)
      .single();

    const { data: evalData } = await supabase
      .from('evaluations')
      .select('answers')
      .eq('user_id', userId)
      .single();

    const { data: qfaData } = await supabase
      .from('qfa_responses')
      .select('id')
      .eq('user_id', userId)
      .single();

    const { data: checkinData } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    const { data: antro } = await supabase
      .from('anthropometry')
      .select('*')
      .eq('user_id', userId)
      .order('measurement_date', { ascending: false });

    const { data: skin } = await supabase
      .from('skinfolds')
      .select('*')
      .eq('user_id', userId)
      .order('measurement_date', { ascending: false });

    const { data: bio } = await supabase
      .from('biochemicals')
      .select('*')
      .eq('user_id', userId)
      .order('exam_date', { ascending: false });

    const todayStr = getTodayString();
    const { data: dailyData } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .single();

    if (dailyData) {
      setDailyLog({
        water_ml: dailyData.water_ml || 0,
        meals_checked: dailyData.meals_checked || [],
        mood: dailyData.mood || null
      });
    }

    try {
      const { data: apptData } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', userId)
        .gte('appointment_date', new Date().toISOString())
        .order('appointment_date', { ascending: true })
        .limit(1)
        .single();
      
      if (apptData) setNextAppointment(apptData);
    } catch (e) {
      console.log("Módulo de agendamentos ainda não configurado.");
    }

    setProfile(profileData);
    setEvaluation(evalData?.answers || null);
    setHasCompletedQFA(!!qfaData); 
    setCheckins(checkinData || []);
    setAntroData(antro || []);
    setSkinfoldsData(skin || []);
    setBioData(bio || []);
    
    checkPushSubscription();
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [router, supabase]);

  const checkPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsPushSubscribed(true); 
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setIsPushSubscribed(!!subscription);
  };

  const subscribeToPush = async () => {
    setIsSubscribingPush(true);
    try {
      if (!('Notification' in window)) {
        alert('Este navegador não suporta notificações.');
        setIsSubscribingPush(false);
        return;
      }

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        alert('Você precisa permitir as notificações no seu navegador/celular para ativar os lembretes.');
        setIsSubscribingPush(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) throw new Error('VAPID key não configurada no .env');

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          subscription: subscription
        })
      });

      if (!response.ok) throw new Error('Falha ao salvar no banco');

      setIsPushSubscribed(true);
      alert('Notificações ativadas! Você receberá lembretes de água.');

    } catch (error) {
      console.error('Erro ao assinar push:', error);
      alert('Não foi possível ativar as notificações.');
    } finally {
      setIsSubscribingPush(false);
    }
  };

  // =========================================================================
  // LÓGICA DE METAS DIÁRIAS (ÁGUA E REFEIÇÕES)
  // =========================================================================
  const latestWeightForWater = useMemo(() => {
    if (checkins.length > 0) return checkins[checkins.length - 1].peso;
    if (antroData.length > 0) return antroData[0].weight;
    return 70; // fallback seguro
  }, [checkins, antroData]);

  const waterGoal = Math.round(latestWeightForWater * 35);
  const waterProgress = Math.min(Math.round((dailyLog.water_ml / waterGoal) * 100), 100);
  const isWaterGoalMet = waterProgress >= 100;

  const isMealPlanReady = profile?.meal_plan && Array.isArray(profile.meal_plan) && profile.meal_plan.length > 0;
  const mealNames = isMealPlanReady ? profile.meal_plan.map((meal: any) => meal.name) : [];
  
  const totalMeals = mealNames.length;
  const completedMeals = dailyLog.meals_checked.length;
  const mealProgress = totalMeals > 0 ? Math.round((completedMeals / totalMeals) * 100) : 0;
  const isMealGoalMet = mealProgress >= 100;

  const handleUpdateDailyLog = async (updates: Partial<typeof dailyLog>) => {
    const newLog = { ...dailyLog, ...updates };
    setDailyLog(newLog); 

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const todayStr = getTodayString();

    await supabase
      .from('daily_logs')
      .upsert({
        user_id: session.user.id,
        date: todayStr,
        water_ml: newLog.water_ml,
        meals_checked: newLog.meals_checked,
        mood: newLog.mood
      }, { onConflict: 'user_id, date' });
  };

  const handleAddWater = () => {
    const newAmount = dailyLog.water_ml + 250;
    handleUpdateDailyLog({ water_ml: newAmount });

    if (newAmount >= waterGoal && dailyLog.water_ml < waterGoal) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#60a5fa', '#bfdbfe'] 
      });
    }
  };

  const handleToggleMeal = (mealName: string) => {
    const current = dailyLog.meals_checked;
    const isChecked = current.includes(mealName);
    const newMeals = isChecked 
      ? current.filter(m => m !== mealName) 
      : [...current, mealName];
    
    handleUpdateDailyLog({ meals_checked: newMeals });

    if (!isChecked && newMeals.length === totalMeals) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#166534', '#22c55e', '#bbf7d0'] 
      });
    }
  };

  const handleCheckinSuccess = () => {
    setIsCheckinModalOpen(false);
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } }); 
    setLoading(true);
    loadData();
  };

  const handleUpgradeClick = async (planType: string = 'premium') => {
    setProcessingCheckout(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          email: session.user.email,
          name: profile?.full_name || 'Paciente Vanusa Nutri',
          planType: planType
        }),
      });

      const data = await response.json();
      if (data.init_point) window.location.href = data.init_point; 
      else throw new Error(data.error);
    } catch (error) {
      alert("Erro ao iniciar pagamento.");
      setProcessingCheckout(false);
    }
  };

  const isCheckinDoneThisWeek = useMemo(() => {
    if (checkins.length === 0) return false;
    const lastCheckinDate = new Date(checkins[checkins.length - 1].created_at);
    const diffInDays = (new Date().getTime() - lastCheckinDate.getTime()) / (1000 * 3600 * 24);
    return diffInDays <= 7;
  }, [checkins]);

  const daysUntilNextCheckin = useMemo(() => {
    if (!isCheckinDoneThisWeek || checkins.length === 0) return 0;
    const lastDate = new Date(checkins[checkins.length - 1].created_at);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 7);
    const diff = Math.ceil((nextDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 0;
  }, [isCheckinDoneThisWeek, checkins]);

  const currentStreak = useMemo(() => {
    if (checkins.length === 0) return 0;
    const sorted = [...checkins].reverse();
    const daysSinceLatest = (new Date().getTime() - new Date(sorted[0].created_at).getTime()) / (1000 * 3600 * 24);
    if (daysSinceLatest > 10) return 0;
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i-1].created_at).getTime() - new Date(sorted[i].created_at).getTime()) / (1000 * 3600 * 24);
      if (diff <= 10) streak++;
      else break;
    }
    return streak;
  }, [checkins]);

  const smartFeedback = useMemo(() => {
    if (checkins.length === 0) return null;
    const last = checkins[checkins.length - 1];
    if (last.adesao_ao_plano >= 4) {
      return { type: 'success', title: 'Excelente foco!', text: 'Sua adesão ao plano foi ótima no último relato. Continue assim!', icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' };
    } else {
      return { type: 'support', title: 'Não desanime!', text: 'Semana difícil? Faz parte do processo. O importante é retomar o foco na próxima refeição.', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200' };
    }
  }, [checkins]);

  const isPremium = profile?.account_type === 'premium';
  const canAccessMealPlan = isPremium || profile?.has_meal_plan_access;

  const trialData = useMemo(() => {
    if (!profile) return { isActive: false, daysLeft: 0 };
    if (isPremium) return { isActive: true, daysLeft: 999 };
    let endDate = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    if (!endDate) {
      endDate = new Date(profile.created_at);
      endDate.setDate(endDate.getDate() + 30);
    }
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { isActive: daysLeft > 0, daysLeft: daysLeft > 0 ? daysLeft : 0 };
  }, [profile, isPremium]);

  // =========================================================================
  // FUNÇÕES DE CÁLCULO DE IMC
  // =========================================================================
  const getIMC = (peso: number, altura: number) => {
    if (!peso || !altura || altura === 0) return null;
    return (peso / (altura * altura)).toFixed(1);
  };

  const getClassificacaoIMC = (imc: number) => {
    if (imc < 18.5) return 'Abaixo do peso';
    if (imc < 25) return 'Peso normal';
    if (imc < 30) return 'Sobrepeso';
    if (imc < 35) return 'Obesidade Grau I';
    if (imc < 40) return 'Obesidade Grau II';
    return 'Obesidade Grau III';
  };

  // =========================================================================
  // LOGICA DO GRAFICO UNIFICADO (MULTI-LENTES) + IMC
  // =========================================================================
  const timelineData = useMemo(() => {
    const dateSet = new Set<string>();
    const formatD = (d: string) => new Date(d).toISOString().split('T')[0];

    checkins.forEach(h => dateSet.add(formatD(h.created_at)));
    antroData.forEach(a => dateSet.add(formatD(a.measurement_date)));
    skinfoldsData.forEach(s => dateSet.add(formatD(s.measurement_date)));
    bioData.forEach(b => dateSet.add(formatD(b.exam_date)));

    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Busca a altura mais recente que o paciente informou nos check-ins
    const checkinComAltura = [...checkins].reverse().find(c => c.altura);
    const ultimaAltura = checkinComAltura?.altura || null;

    return sortedDates.map(dateStr => {
      const checkin = checkins.find(h => formatD(h.created_at) === dateStr);
      const antro = antroData.find(a => formatD(a.measurement_date) === dateStr);
      const skin = skinfoldsData.find(s => formatD(s.measurement_date) === dateStr);
      const bio = bioData.find(b => formatD(b.exam_date) === dateStr);

      const pesoAtual = checkin?.peso || antro?.weight || null;
      const imcAtual = pesoAtual && ultimaAltura ? getIMC(pesoAtual, ultimaAltura) : null;

      let sumFolds: number | null = null;
      if (skin) {
        const s1 = parseFloat(skin.triceps||0) + parseFloat(skin.biceps||0) + parseFloat(skin.subscapular||0) + parseFloat(skin.suprailiac||0) + parseFloat(skin.abdominal||0) + parseFloat(skin.thigh||0) + parseFloat(skin.calf||0);
        if (s1 > 0) sumFolds = parseFloat(s1.toFixed(1));
      }

      let homa: number | null = null;
      if (bio && bio.glucose && bio.insulin) {
        homa = parseFloat(((parseFloat(bio.glucose) * parseFloat(bio.insulin)) / 405).toFixed(2));
      }

      return {
        date: dateStr,
        peso: pesoAtual,
        imc: imcAtual,
        classificacao: imcAtual ? getClassificacaoIMC(parseFloat(imcAtual)) : '',
        cintura: antro?.waist || null,
        somatorio_dobras: sumFolds,
        homair: homa,
        adesao: checkin?.adesao_ao_plano || null,
        hasExam: !!bio, 
      };
    });
  }, [checkins, antroData, skinfoldsData, bioData]);

  // =========================================================================
  // DELTAS (RESUMO DE EVOLUÇÃO)
  // =========================================================================
  const deltas = useMemo(() => {
    const validWeights = timelineData.filter(d => d.peso !== null).map(d => d.peso!);
    const validWaists = timelineData.filter(d => d.cintura !== null).map(d => d.cintura!);

    const weightDelta = validWeights.length > 1 ? (validWeights[validWeights.length - 1] - validWeights[0]).toFixed(1) : null;
    const waistDelta = validWaists.length > 1 ? (validWaists[validWaists.length - 1] - validWaists[0]).toFixed(1) : null;

    return { weightDelta, waistDelta, currentWeight: validWeights[validWeights.length - 1] };
  }, [timelineData]);

  const isGoalMet = profile?.meta_peso && deltas.currentWeight && deltas.currentWeight <= profile.meta_peso;

  // =========================================================================
  // PROJEÇÃO DE CHEGADA (ETA INTELIGENTE)
  // =========================================================================
  const projection = useMemo(() => {
    if (!profile?.meta_peso) return null;
    
    const validPoints = timelineData.filter(d => d.peso !== null);
    if (validPoints.length < 2) return null; // Precisa de pelo menos 2 registros para ter uma média

    const firstPoint = validPoints[0];
    const lastPoint = validPoints[validPoints.length - 1];
    
    const weightLost = firstPoint.peso! - lastPoint.peso!;
    if (weightLost <= 0) return null; // Só projeta se estiver perdendo peso

    const daysPassed = (new Date(lastPoint.date).getTime() - new Date(firstPoint.date).getTime()) / (1000 * 3600 * 24);
    const weeksPassed = daysPassed / 7;
    
    if (weeksPassed < 1) return null; // Menos de 1 semana é pouco tempo para estipular um ritmo real

    const ratePerWeek = weightLost / weeksPassed;
    const weightLeft = lastPoint.peso! - profile.meta_peso;
    
    if (weightLeft <= 0) return { achieved: true };

    const weeksLeft = weightLeft / ratePerWeek;
    
    return {
      ratePerWeek: ratePerWeek.toFixed(2),
      weeksLeft: Math.ceil(weeksLeft),
      weightLeft: weightLeft.toFixed(1)
    };
  }, [timelineData, profile?.meta_peso]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 flex font-sans text-stone-800 pt-[72px] md:pt-20 pb-24 md:pb-0">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col p-8 sticky top-20 h-[calc(100vh-80px)] z-10">
        <h2 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em] mb-10">Menu do Paciente</h2>        
        <nav className="flex-1 space-y-6">
          <Link href="/dashboard" className="text-nutri-800 font-bold text-sm block transition-all">Painel Geral</Link>
          <Link href="/paciente/avaliacao" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">Minha Avaliação (QFA)</Link>
          <Link href="/dashboard/meu-plano" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors flex justify-between items-center">
            Meu Plano {!canAccessMealPlan && <Lock size={12} className="text-stone-300"/>}
          </Link>
          <Link href="/dashboard/agendamentos" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">Agendamentos</Link>
          <Link href="/dashboard/perfil" className="text-stone-500 hover:text-nutri-800 font-bold text-sm block transition-colors">Meu Perfil</Link>
        </nav>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-red-500 text-xs font-black uppercase tracking-widest hover:text-red-700 transition-colors mt-auto pt-8 border-t border-stone-100">Sair da Conta</button>
      </aside>

      <section className="flex-1 p-5 md:p-10 lg:p-12 overflow-y-auto w-full">
        
        {!hasCompletedQFA && (
          <div className="mb-8 p-6 bg-rose-600 rounded-[2rem] text-white shadow-xl shadow-rose-600/20 flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in-up">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="bg-white/20 p-3 rounded-2xl">
                <ClipboardCheck size={28} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Avaliação Pendente!</h3>
                <p className="text-rose-100 text-sm">Preencha seu Raio-X alimentar para a Nutri liberar seu cardápio.</p>
              </div>
            </div>
            <Link href="/paciente/avaliacao" className="w-full md:w-auto bg-white text-rose-600 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-100 transition-all text-center shadow-sm">
              Começar Agora
            </Link>
          </div>
        )}

        {!isPremium && (
          <div className={`mb-8 p-4 md:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border animate-fade-in-up ${trialData.isActive ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className={`p-2 rounded-full ${trialData.isActive ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                {trialData.isActive ? <Zap size={20} /> : <AlertCircle size={20} />}
              </div>
              <div>
                <p className="font-bold text-sm md:text-base">{trialData.isActive ? `Período de teste acaba em ${trialData.daysLeft} dias.` : 'Seu teste gratuito expirou.'}</p>
                <p className={`text-xs md:text-sm mt-0.5 ${trialData.isActive ? 'text-amber-700' : 'text-red-700'}`}>Desbloqueie o acesso completo para continuar evoluindo.</p>
              </div>
            </div>
            <button onClick={() => handleUpgradeClick('premium')} disabled={processingCheckout} className="w-full sm:w-auto bg-nutri-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-nutri-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
              {processingCheckout ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />} Desbloquear Premium
            </button>
          </div>
        )}

        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tighter">Olá, {profile?.full_name?.split(' ')[0] || 'Paciente'}!</h2>
              {isPremium && <span className="bg-nutri-100 text-nutri-800 p-1.5 rounded-full"><Star size={16} fill="currentColor" /></span>}
            </div>
            <p className="text-sm md:text-base text-stone-500 font-light">Seu progresso de saúde em tempo real.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {currentStreak > 0 && (
              <div className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl border border-stone-200 shadow-sm w-full sm:w-auto justify-center group">
                <div className="bg-orange-50 p-2 rounded-xl text-orange-500 group-hover:scale-110 transition-transform"><Flame size={20} fill="currentColor" /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Ofensiva</p>
                  <p className="font-bold text-stone-800 leading-none">{currentStreak} Semanas</p>
                </div>
              </div>
            )}
            
            {!isCheckinDoneThisWeek ? (
              <button onClick={() => setIsCheckinModalOpen(true)} disabled={!isPremium && !trialData.isActive} className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-nutri-900/10 ${(!isPremium && !trialData.isActive) ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-nutri-900 text-white hover:bg-nutri-800 active:scale-[0.98]'}`}>
                {!isPremium && !trialData.isActive ? <Lock size={20} /> : <PlusCircle size={20} />} {!isPremium && !trialData.isActive ? 'Check-in Bloqueado' : 'Relato Semanal'}
              </button>
            ) : (
              <div className="w-full sm:w-auto flex flex-col items-center justify-center bg-green-50 text-green-800 px-6 py-3 rounded-2xl border border-green-200 text-center">
                <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} /> Relato da semana feito!</div>
                <span className="text-xs text-green-600 font-medium mt-0.5">Próximo abre em {daysUntilNextCheckin} dias</span>
              </div>
            )}
          </div>
        </header>

        {smartFeedback && (
          <div className={`mb-8 p-5 md:p-6 rounded-[2rem] border ${smartFeedback.bg} ${smartFeedback.border} flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in-up`}>
            <div className={`p-3 bg-white rounded-2xl shadow-sm ${smartFeedback.color} shrink-0`}><smartFeedback.icon size={24} /></div>
            <div>
              <h4 className={`font-bold text-lg mb-1 ${smartFeedback.color}`}>{smartFeedback.title}</h4>
              <p className="text-stone-600 text-sm md:text-base leading-relaxed">{smartFeedback.text}</p>
            </div>
          </div>
        )}

        {/* ==================== DIÁRIO DE HÁBITOS (REFEIÇÕES E ÁGUA) ==================== */}
        {canAccessMealPlan && (
          <div className="mb-8 bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-stone-100 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-nutri-50 p-2.5 rounded-2xl text-nutri-800">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-stone-900">Meu Diário de Hoje</h3>
                <p className="text-sm text-stone-500">Marque o que você conseguiu fazer hoje.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="md:col-span-2 bg-stone-50 p-6 rounded-3xl border border-stone-100 flex flex-col">
                <div className="flex justify-between items-end mb-4">
                  <h4 className="text-xs font-black uppercase text-stone-400 tracking-widest flex items-center gap-2">
                    <Utensils size={14} /> Refeições
                  </h4>
                  <span className="text-xs font-bold text-nutri-800 bg-nutri-100 px-2 py-1 rounded-md">
                    {completedMeals} de {totalMeals} ({mealProgress}%)
                  </span>
                </div>
                
                <div className="w-full bg-stone-200 rounded-full h-2.5 mb-6 overflow-hidden">
                  <div 
                    className={`h-2.5 rounded-full transition-all duration-500 ${isMealGoalMet ? 'bg-green-500' : 'bg-nutri-700'}`} 
                    style={{ width: `${mealProgress}%` }}
                  ></div>
                </div>

                {isMealPlanReady ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 content-start">
                    {mealNames.map((mealName: string, i: number) => {
                      const isChecked = dailyLog.meals_checked.includes(mealName);
                      return (
                        <button 
                          key={i}
                          onClick={() => handleToggleMeal(mealName)}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${
                            isChecked 
                              ? 'bg-nutri-50 border-nutri-200 text-nutri-900 shadow-sm' 
                              : 'bg-white border-stone-200 text-stone-600 hover:border-nutri-200 hover:bg-white'
                          }`}
                        >
                          <span className={`text-sm font-bold ${isChecked ? 'line-through opacity-70' : ''}`}>{mealName}</span>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                            isChecked ? 'bg-nutri-600 border-nutri-600 text-white' : 'bg-stone-50 border-stone-300 group-hover:border-nutri-300'
                          }`}>
                            {isChecked && <Check size={14} strokeWidth={3} />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-stone-500 italic bg-white p-4 rounded-2xl border border-stone-200 text-center w-full">
                      Seu cardápio ainda está sendo elaborado.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-6 flex flex-col">
                
                {/* CARD DE ÁGUA COM META E PROGRESSO */}
                <div className={`flex-1 p-6 rounded-3xl border transition-colors relative overflow-hidden group flex flex-col items-center justify-center ${isWaterGoalMet ? 'bg-blue-500 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                  <h4 className={`text-xs font-black uppercase tracking-widest mb-1 z-10 w-full text-center ${isWaterGoalMet ? 'text-blue-100' : 'text-blue-400'}`}>
                    {isWaterGoalMet ? 'Meta Atingida! 💧' : 'Água Consumida'}
                  </h4>
                  <p className={`text-[10px] font-bold mb-3 z-10 ${isWaterGoalMet ? 'text-blue-200' : 'text-stone-400'}`}>Meta: {waterGoal}ml</p>
                  
                  <div className="flex items-baseline gap-1 mb-4 z-10">
                    <span className={`text-4xl font-black ${isWaterGoalMet ? 'text-white' : 'text-blue-900'}`}>{dailyLog.water_ml}</span>
                    <span className={`text-sm font-bold ${isWaterGoalMet ? 'text-blue-200' : 'text-blue-600'}`}>ml</span>
                  </div>

                  <div className="w-full bg-black/10 rounded-full h-1.5 mb-5 z-10">
                    <div className="bg-white h-1.5 rounded-full transition-all duration-500" style={{ width: `${waterProgress}%` }}></div>
                  </div>

                  <button 
                    onClick={handleAddWater}
                    className={`px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm z-10 active:scale-95 ${isWaterGoalMet ? 'bg-white/20 text-white hover:bg-white/30 border border-white/30' : 'bg-white border-2 border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 group-hover:shadow-md'}`}
                  >
                    <Droplets size={16} fill="currentColor" className={dailyLog.water_ml > 0 && !isWaterGoalMet ? "text-blue-400 group-hover:text-white" : ""} /> + 250ml
                  </button>

                  {!isPushSubscribed && !isWaterGoalMet && (
                    <button 
                      onClick={subscribeToPush}
                      disabled={isSubscribingPush}
                      className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg z-10 hover:bg-blue-200 transition-colors"
                    >
                      {isSubscribingPush ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />}
                      Ativar Lembretes
                    </button>
                  )}

                  <Droplets size={140} className={`absolute -bottom-8 -right-8 opacity-10 rotate-12 ${isWaterGoalMet ? 'text-black' : 'text-blue-500'}`} />
                </div>

                {/* CARD DE HUMOR */}
                <div className="bg-stone-50 p-5 rounded-3xl border border-stone-100">
                  <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-3 text-center">Como foi o dia?</h4>
                  <div className="flex justify-center gap-3">
                    <button 
                      onClick={() => handleUpdateDailyLog({ mood: 'feliz' })}
                      className={`p-3 rounded-full transition-all border-2 ${dailyLog.mood === 'feliz' ? 'bg-green-100 border-green-500 text-green-600 scale-110 shadow-sm' : 'bg-white border-transparent text-stone-400 hover:bg-stone-100 hover:scale-105'}`}
                    >
                      <Smile size={28} />
                    </button>
                    <button 
                      onClick={() => handleUpdateDailyLog({ mood: 'neutro' })}
                      className={`p-3 rounded-full transition-all border-2 ${dailyLog.mood === 'neutro' ? 'bg-amber-100 border-amber-500 text-amber-600 scale-110 shadow-sm' : 'bg-white border-transparent text-stone-400 hover:bg-stone-100 hover:scale-105'}`}
                    >
                      <Meh size={28} />
                    </button>
                    <button 
                      onClick={() => handleUpdateDailyLog({ mood: 'dificil' })}
                      className={`p-3 rounded-full transition-all border-2 ${dailyLog.mood === 'dificil' ? 'bg-rose-100 border-rose-500 text-rose-600 scale-110 shadow-sm' : 'bg-white border-transparent text-stone-400 hover:bg-stone-100 hover:scale-105'}`}
                    >
                      <Frown size={28} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ==================== GRÁFICO E EVOLUÇÃO ==================== */}
        <div className="mb-10 bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-stone-100 animate-fade-in-up">
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-stone-900 flex items-center gap-3"><TrendingDown className="text-nutri-800" size={24} /> Meu Progresso</h3>
              <p className="text-sm text-stone-500">Acompanhe sua evolução através de diferentes métricas.</p>
            </div>

            <div className="flex bg-stone-100 p-1.5 rounded-2xl w-full lg:w-auto">
              <button 
                onClick={() => setActiveLens('medidas')} 
                className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeLens === 'medidas' ? 'bg-white text-nutri-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <Scale size={14} /> Medidas
              </button>
              
              <button 
                onClick={() => isPremium ? setActiveLens('composicao') : handleUpgradeClick()} 
                className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeLens === 'composicao' ? 'bg-white text-nutri-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <Layers size={14} /> {isPremium ? 'Dobras' : <Lock size={12} className="text-amber-500" />}
              </button>

              <button 
                onClick={() => isPremium ? setActiveLens('metabolico') : handleUpgradeClick()} 
                className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${activeLens === 'metabolico' ? 'bg-white text-nutri-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <Activity size={14} /> {isPremium ? 'Metabolismo' : <Lock size={12} className="text-amber-500" />}
              </button>
            </div>
          </div>

          {/* DELTAS DE PROGRESSO */}
          {(deltas.weightDelta || deltas.waistDelta) && (
            <div className="flex gap-4 mb-8">
              {deltas.weightDelta && (
                <div className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold border ${parseFloat(deltas.weightDelta) <= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {parseFloat(deltas.weightDelta) <= 0 ? <ArrowDown size={16}/> : <ArrowUp size={16}/>}
                  {Math.abs(parseFloat(deltas.weightDelta))} kg {parseFloat(deltas.weightDelta) <= 0 ? 'perdidos' : 'ganhos'}
                </div>
              )}
              {deltas.waistDelta && (
                <div className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold border ${parseFloat(deltas.waistDelta) <= 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-stone-50 text-stone-700 border-stone-200'}`}>
                  {parseFloat(deltas.waistDelta) <= 0 ? <ArrowDown size={16}/> : <Minus size={16}/>}
                  {Math.abs(parseFloat(deltas.waistDelta))} cm de cintura
                </div>
              )}
            </div>
          )}

          <div className="h-72 w-full -ml-4 lg:ml-0">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isGoalMet ? "#22c55e" : "#166534"} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={isGoalMet ? "#22c55e" : "#166534"} stopOpacity={0}/>
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
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-xl border border-stone-800">
                            <p className="text-xs font-bold text-stone-400 mb-2 border-b border-stone-700 pb-2">{new Date(data.date).toLocaleDateString('pt-BR')}</p>
                            
                            {activeLens === 'medidas' && (
                              <>
                                {data.peso && (
                                  <div className="space-y-1 mb-2">
                                    <p className="font-black text-emerald-400 flex justify-between gap-4">Peso: <span>{data.peso} kg</span></p>
                                    {data.imc && (
                                      <p className="text-xs text-stone-300 flex justify-between gap-4">
                                        IMC: <span className="font-bold text-white">{data.imc} ({data.classificacao})</span>
                                      </p>
                                    )}
                                  </div>
                                )}
                                {data.cintura && <p className="font-black text-indigo-400 flex justify-between gap-4">Cintura: <span>{data.cintura} cm</span></p>}
                              </>
                            )}

                            {activeLens === 'composicao' && (
                              <>
                                {data.peso && (
                                  <div className="space-y-1 mb-2">
                                    <p className="font-black text-emerald-400 flex justify-between gap-4">Peso: <span>{data.peso} kg</span></p>
                                    {data.imc && (
                                      <p className="text-xs text-stone-300 flex justify-between gap-4">
                                        IMC: <span className="font-bold text-white">{data.imc} ({data.classificacao})</span>
                                      </p>
                                    )}
                                  </div>
                                )}
                                {data.somatorio_dobras && <p className="font-black text-pink-400 flex justify-between gap-4">7 Dobras: <span>{data.somatorio_dobras} mm</span></p>}
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
                      {profile?.meta_peso && <ReferenceLine y={profile.meta_peso} yAxisId="left" stroke={isGoalMet ? "#22c55e" : "#d6d3d1"} strokeDasharray="5 5" label={{ position: 'top', value: isGoalMet ? 'META ATINGIDA!' : 'META', fill: isGoalMet ? '#16a34a' : '#a8a29e', fontSize: 10, fontWeight: 'bold' }} />}
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke={isGoalMet ? "#16a34a" : "#166534"} strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" connectNulls activeDot={{ r: 6, strokeWidth: 0, fill: isGoalMet ? "#22c55e" : "#166534" }} />
                      <Line type="monotone" yAxisId="right" dataKey="cintura" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: "#818cf8" }} connectNulls />
                    </>
                  )}

                  {activeLens === 'composicao' && (
                    <>
                      {profile?.meta_peso && <ReferenceLine y={profile.meta_peso} yAxisId="left" stroke={isGoalMet ? "#22c55e" : "#d6d3d1"} strokeDasharray="5 5" label={{ position: 'top', value: isGoalMet ? 'META ATINGIDA!' : 'META', fill: isGoalMet ? '#16a34a' : '#a8a29e', fontSize: 10, fontWeight: 'bold' }} />}
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke={isGoalMet ? "#16a34a" : "#166534"} strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" connectNulls activeDot={{ r: 6, strokeWidth: 0, fill: isGoalMet ? "#22c55e" : "#166534" }} />
                      <Line type="monotone" yAxisId="right" dataKey="somatorio_dobras" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, fill: "#ec4899", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0, fill: "#f472b6" }} connectNulls />
                    </>
                  )}

                  {activeLens === 'metabolico' && (
                    <>
                      <ReferenceLine y={2.0} yAxisId="right" stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'ALERTA HOMA-IR', fill: '#ef4444', fontSize: 10 }} />
                      <Area type="monotone" yAxisId="left" dataKey="cintura" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAreaWaist)" connectNulls activeDot={{ r: 6, strokeWidth: 0, fill: "#818cf8" }} />
                      <Line type="monotone" yAxisId="right" dataKey="homair" stroke="#f59e0b" strokeWidth={4} dot={{ r: 5, fill: "#f59e0b", strokeWidth: 0 }} activeDot={{ r: 7, strokeWidth: 0, fill: "#fbbf24" }} connectNulls />
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
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-200">
                <TrendingDown size={40} />
                <p className="text-stone-500 mt-4">Faça seu primeiro check-in para ver sua evolução.</p>
              </div>
            )}
          </div>

          {/* PAINEL DE PREVISÃO DE CHEGADA E STATUS DA META */}
          {profile?.meta_peso && timelineData.length > 0 && (
            <div className={`mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl border transition-colors ${isGoalMet ? 'bg-green-50 border-green-200' : 'bg-stone-50 border-stone-100'}`}>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className={`p-3 rounded-2xl ${isGoalMet ? 'bg-green-200 text-green-800' : 'bg-nutri-100 text-nutri-900 shadow-sm'}`}>
                  {isGoalMet ? <Trophy size={24}/> : <Target size={24}/>}
                </div>
                <div className="text-center sm:text-left">
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isGoalMet ? 'text-green-700' : 'text-stone-400'}`}>
                    {isGoalMet ? 'Meta Atingida!' : 'Destino: Peso Meta'}
                  </p>
                  <p className={`font-black text-xl md:text-2xl ${isGoalMet ? 'text-green-900' : 'text-stone-900'}`}>{profile.meta_peso} kg</p>
                </div>
              </div>
              
              {!isGoalMet && projection && !projection.achieved && (
                <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-stone-200 pt-4 sm:pt-0 sm:pl-6">
                   <p className="text-sm text-stone-600 font-medium">Ritmo atual: <strong className="text-emerald-600">-{projection.ratePerWeek} kg/sem</strong></p>
                   <p className="text-xs text-stone-500 mt-1">Mantendo o foco, você chega lá em <strong className="text-stone-800">~{projection.weeksLeft} semanas</strong>.</p>
                </div>
              )}
              
              {!isGoalMet && !projection && (
                <p className={`text-xs font-medium text-center sm:text-right text-stone-500 max-w-xs`}>
                  Continue registrando seus relatos semanais para o sistema calcular sua previsão de chegada.
                </p>
              )}
              
              {isGoalMet && (
                <p className={`text-xs font-medium text-center sm:text-right text-green-700 max-w-xs`}>
                  Parabéns pela dedicação! Você alcançou seu objetivo. O foco agora é a manutenção.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ==================== WIDGETS INFERIORES ==================== */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          <div className="lg:col-span-2 bg-nutri-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group flex flex-col justify-center">
            <h3 className="text-nutri-200 font-bold uppercase text-[10px] tracking-[0.2em] mb-4">Foco Principal</h3>
            <p className="text-2xl md:text-3xl font-light leading-snug relative z-10">{evaluation ? Object.values(evaluation)[0] as string : 'Objetivo não definido.'}</p>
          </div>
          
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="flex items-center gap-2 mb-6 text-stone-400 relative z-10">
              <Ruler size={18} /><h3 className="font-bold uppercase text-[10px] tracking-[0.2em]">Medida de Cintura</h3>
            </div>
            <div className={!isPremium ? 'filter blur-sm select-none opacity-40' : ''}>
              {antroData.length > 0 && antroData[0].waist ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-2"><span className="text-4xl font-black text-stone-900">{antroData[0].waist}</span><span className="text-stone-400 font-bold">cm</span></div>
                  {antroData.length > 1 && <p className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">Anterior: {antroData[1].waist}cm</p>}
                </div>
              ) : <p className="text-sm text-stone-500 italic font-light">Aguardando consulta.</p>}
            </div>
            {!isPremium && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px]">
                <div className="bg-white p-3 rounded-full shadow-lg border border-stone-100 text-amber-500 mb-2"><Lock size={20} /></div>
                <span className="text-[10px] font-bold text-stone-800 uppercase tracking-widest bg-white/80 px-3 py-1 rounded-full">Exclusivo Premium</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up pb-10">
          <Link href="/dashboard/meu-plano" className={`p-8 rounded-[2.5rem] border transition-all group relative overflow-hidden ${canAccessMealPlan ? 'bg-white shadow-sm border-stone-100 hover:border-nutri-200' : 'bg-stone-50 border-stone-200'}`}>
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3 flex items-center gap-2">Alimentação {!canAccessMealPlan && <Lock size={12} className="text-amber-500" />}</h4>
            <h3 className={`font-bold text-lg mb-4 ${canAccessMealPlan ? 'text-stone-900' : 'text-stone-500'}`}>Plano Alimentar</h3>
            <div className="flex items-center justify-between">
              <p className={`text-sm font-bold flex items-center gap-1 ${canAccessMealPlan ? 'text-nutri-800' : 'text-stone-400'}`}>
                {canAccessMealPlan ? (isMealPlanReady ? 'Cardápio Liberado' : 'Em elaboração') : 'Desbloquear Acesso'} 
                <ArrowRight size={14} />
              </p>
              {isMealPlanReady && canAccessMealPlan && <div className="bg-green-100 text-green-700 p-2 rounded-full animate-bounce"><Utensils size={14} /></div>}
            </div>
          </Link>

          <Link href="/paciente/avaliacao" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:border-nutri-200 transition-all group flex flex-col justify-between">
            <div>
              <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Minha Rotina</h4>
              <h3 className="font-bold text-stone-900 text-lg mb-4">Raio-X Alimentar</h3>
            </div>
            <p className="text-sm text-nutri-800 font-bold flex items-center gap-1 group-hover:gap-2 transition-all mt-auto">
              {hasCompletedQFA ? 'Ver minhas respostas' : 'Preencher agora'} <ArrowRight size={14} />
            </p>
          </Link>

          <Link href="/dashboard/agendamentos" className={`p-8 rounded-[2.5rem] shadow-sm border transition-all group flex flex-col justify-between ${nextAppointment ? 'bg-nutri-50 border-nutri-200 hover:bg-nutri-100' : 'bg-white border-stone-100 hover:border-nutri-200'}`}>
            <div>
              <h4 className={`font-black uppercase text-[10px] tracking-[0.2em] mb-3 flex items-center gap-2 ${nextAppointment ? 'text-nutri-600' : 'text-stone-400'}`}>
                <Calendar size={14}/> Consultas
              </h4>
              <h3 className="font-bold text-stone-900 text-lg mb-2">Agendamento</h3>
              
              {nextAppointment ? (
                <p className="text-sm text-stone-700 font-medium leading-tight">
                  Sua próxima consulta é no dia <b className="text-nutri-800">{new Date(nextAppointment.appointment_date).toLocaleDateString('pt-BR')}</b> às <b className="text-nutri-800">{nextAppointment.appointment_time}</b>.
                </p>
              ) : (
                <p className="text-sm text-stone-500">Nenhuma consulta futura agendada.</p>
              )}
            </div>
            
            <p className="text-sm text-nutri-800 font-bold flex items-center gap-1 group-hover:gap-2 transition-all mt-4">
              {nextAppointment ? 'Ver detalhes' : 'Ver horários'} <ArrowRight size={14} />
            </p>
          </Link>
        </div>

      </section>

      {/* MODAL DE CHECK-IN */}
      {isCheckinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm sm:p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-white sm:bg-transparent rounded-t-[2.5rem] sm:rounded-none">
            <button onClick={() => setIsCheckinModalOpen(false)} className="absolute top-4 right-4 sm:-top-4 sm:-right-4 md:-right-12 bg-stone-100 sm:bg-white text-stone-500 p-2.5 rounded-full z-10 hover:bg-stone-200 transition-colors">
              <X size={20} />
            </button>
            <CheckinForm onSuccess={handleCheckinSuccess} onFormChange={() => {}} />
          </div>
        </div>
      )}
    </main>
  );
}