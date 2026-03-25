'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import confetti from 'canvas-confetti';
import { 
  Loader2, CheckCircle2, TrendingDown, PlusCircle, X,
  Flame, Trophy, AlertCircle, Ruler, ArrowRight, HeartPulse, 
  Lock, Star, Zap, Utensils, ClipboardCheck, Droplets, Check,
  Smile, Frown, Meh, BellRing, Scale, Layers, Activity as ActivityIcon, Syringe,
  Target, Calendar, ArrowDown, ArrowUp, Minus
} from 'lucide-react';
import Link from 'next/link';
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Scatter 
} from 'recharts';
import CheckinForm from '@/components/CheckinForm';
import ChatAssistant from '@/components/ChatAssistant';
import ActivityCard from '@/components/ActivityCard';
import AddActivityModal from '@/components/AddActivityModal';
import { Activity, getTotalActivityKcal } from '@/lib/activities';
import { toast } from 'sonner';

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

const getLocalTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);

  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(true); 
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  
  const [activeLens, setActiveLens] = useState<'medidas' | 'composicao' | 'metabolico'>('medidas');

  const [dailyLog, setDailyLog] = useState({
    water_ml: 0,
    meals_checked: [] as string[],
    mood: null as string | null,
    activities: [] as Activity[],
    activity_kcal: 0
  });

  const router = useRouter();
  const supabase = createClient();

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

    const todayStr = getLocalTodayString(); 
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
        mood: dailyData.mood || null,
        activities: dailyData.activities || [],
        activity_kcal: dailyData.activity_kcal || 0
      });
    } else {
      setDailyLog({
        water_ml: 0,
        meals_checked: [],
        mood: null,
        activities: [],
        activity_kcal: 0
      });
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
        toast.error('Este navegador não suporta notificações.');
        setIsSubscribingPush(false);
        return;
      }

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        toast.warning('Você precisa permitir as notificações no seu navegador/celular para ativar os lembretes.');
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
      toast.success('Notificações ativadas! Você receberá lembretes de água.');

    } catch (error) {
      console.error('Erro ao assinar push:', error);
      toast.error('Não foi possível ativar as notificações.');
    } finally {
      setIsSubscribingPush(false);
    }
  };

  const latestWeightForWater = useMemo(() => {
    if (checkins.length > 0) return checkins[checkins.length - 1].peso;
    if (antroData.length > 0) return antroData[0].weight;
    return 70; 
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

    const todayStr = getLocalTodayString();

    await supabase
      .from('daily_logs')
      .upsert({
        user_id: session.user.id,
        date: todayStr,
        water_ml: newLog.water_ml,
        meals_checked: newLog.meals_checked,
        mood: newLog.mood,
        activities: newLog.activities,
        activity_kcal: newLog.activity_kcal
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

  const handleAddActivity = (activity: Activity) => {
    const updatedActivities = [...(dailyLog.activities || []), activity];
    const totalKcal = getTotalActivityKcal(updatedActivities, latestWeightForWater);
  
    handleUpdateDailyLog({
      activities: updatedActivities,
      activity_kcal: totalKcal
    });
  };
  
  const handleRemoveActivity = (id: string) => {
    const updatedActivities = (dailyLog.activities || []).filter(a => a.id !== id);
    const totalKcal = getTotalActivityKcal(updatedActivities, latestWeightForWater);
  
    handleUpdateDailyLog({
      activities: updatedActivities,
      activity_kcal: totalKcal
    });
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
      toast.error("Erro ao iniciar pagamento.");
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
      return { type: 'success', title: 'Excelente foco!', text: 'Sua adesão ao plano foi ótima no último relato. Continue assim!', icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50/50', border: 'border-amber-200/50' };
    } else {
      return { type: 'support', title: 'Não desanime!', text: 'Semana difícil? Faz parte do processo. O importante é retomar o foco na próxima refeição.', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-50/50', border: 'border-rose-200/50' };
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

  const timelineData = useMemo(() => {
    const dateSet = new Set<string>();
    const formatD = (d: string) => new Date(d).toISOString().split('T')[0];

    checkins.forEach(h => dateSet.add(formatD(h.created_at)));
    antroData.forEach(a => dateSet.add(formatD(a.measurement_date)));
    skinfoldsData.forEach(s => dateSet.add(formatD(s.measurement_date)));
    bioData.forEach(b => dateSet.add(formatD(b.exam_date)));

    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

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

  const deltas = useMemo(() => {
    const validWeights = timelineData.filter(d => d.peso !== null).map(d => d.peso!);
    const validWaists = timelineData.filter(d => d.cintura !== null).map(d => d.cintura!);

    const weightDelta = validWeights.length > 1 ? (validWeights[validWeights.length - 1] - validWeights[0]).toFixed(1) : null;
    const waistDelta = validWaists.length > 1 ? (validWaists[validWaists.length - 1] - validWaists[0]).toFixed(1) : null;

    return { weightDelta, waistDelta, currentWeight: validWeights[validWeights.length - 1] };
  }, [timelineData]);

  const isGoalMet = profile?.meta_peso && deltas.currentWeight && deltas.currentWeight <= profile.meta_peso;

  const projection = useMemo(() => {
    if (!profile?.meta_peso) return null;
    
    const validPoints = timelineData.filter(d => d.peso !== null);
    if (validPoints.length < 2) return null; 

    const firstPoint = validPoints[0];
    const lastPoint = validPoints[validPoints.length - 1];
    
    const weightLost = firstPoint.peso! - lastPoint.peso!;
    if (weightLost <= 0) return null; 

    const daysPassed = (new Date(lastPoint.date).getTime() - new Date(firstPoint.date).getTime()) / (1000 * 3600 * 24);
    const weeksPassed = daysPassed / 7;
    
    if (weeksPassed < 1) return null; 

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
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-nutri-800" size={40} strokeWidth={2.5} />
        <p className="text-stone-400 font-medium text-sm animate-pulse">Preparando seu painel...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#F9FAFB] flex font-sans text-stone-800 pt-[72px] md:pt-20 pb-24 md:pb-0 selection:bg-nutri-200 selection:text-nutri-900">
      
      {/* SIDEBAR DESKTOP PREMIUM */}
      <aside className="w-64 bg-white/60 backdrop-blur-xl border-r border-stone-200/50 hidden md:flex flex-col p-8 sticky top-20 h-[calc(100vh-80px)] z-10 shadow-[4px_0_24px_rgba(0,0,0,0.01)]">
        <h2 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em] mb-10">Navegação</h2>        
        <nav className="flex-1 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 bg-white text-nutri-900 font-bold text-sm rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-stone-100 transition-all">Painel Geral</Link>
          <Link href="/paciente/avaliacao" className="flex items-center gap-3 px-4 py-3 text-stone-500 hover:bg-stone-50/80 hover:text-stone-900 font-semibold text-sm rounded-2xl transition-all">Avaliação (QFA)</Link>
          <Link href="/dashboard/meu-plano" className="flex items-center justify-between px-4 py-3 text-stone-500 hover:bg-stone-50/80 hover:text-stone-900 font-semibold text-sm rounded-2xl transition-all">
            Meu Plano {!canAccessMealPlan && <Lock size={14} className="text-stone-300"/>}
          </Link>
          <Link href="/dashboard/agendamentos" className="flex items-center gap-3 px-4 py-3 text-stone-500 hover:bg-stone-50/80 hover:text-stone-900 font-semibold text-sm rounded-2xl transition-all">Agendamentos</Link>
          <Link href="/dashboard/perfil" className="flex items-center gap-3 px-4 py-3 text-stone-500 hover:bg-stone-50/80 hover:text-stone-900 font-semibold text-sm rounded-2xl transition-all">Meu Perfil</Link>
        </nav>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-stone-400 text-xs font-bold uppercase tracking-wider hover:text-red-500 transition-colors mt-auto pt-8 border-t border-stone-200/60 w-full text-left flex items-center gap-2">Sair da Conta</button>
      </aside>

      <section className="flex-1 p-5 md:p-10 lg:p-12 overflow-y-auto w-full max-w-7xl mx-auto">
        
        {!hasCompletedQFA && (
          <div className="mb-8 p-6 bg-gradient-to-r from-rose-600 to-rose-500 rounded-[2rem] text-white shadow-[0_8px_30px_rgba(225,29,72,0.2)] flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in-up border border-rose-400/30">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="bg-white/20 backdrop-blur-md p-3.5 rounded-2xl shadow-inner">
                <ClipboardCheck size={28} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Avaliação Pendente!</h3>
                <p className="text-rose-100/90 text-sm mt-0.5">Preencha seu Raio-X alimentar para a Nutri liberar seu cardápio.</p>
              </div>
            </div>
            <Link href="/paciente/avaliacao" className="w-full md:w-auto bg-white text-rose-600 px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-stone-50 hover:scale-[1.02] transition-all text-center shadow-sm">
              Começar Agora
            </Link>
          </div>
        )}

        {!isPremium && (
          <div className={`mb-8 p-5 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-5 border shadow-sm animate-fade-in-up ${trialData.isActive ? 'bg-gradient-to-r from-amber-50 to-white border-amber-200/60' : 'bg-gradient-to-r from-red-50 to-white border-red-200/60'}`}>
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className={`p-3 rounded-2xl ${trialData.isActive ? 'bg-amber-100/50 text-amber-600' : 'bg-red-100/50 text-red-600'}`}>
                {trialData.isActive ? <Zap size={24} /> : <AlertCircle size={24} />}
              </div>
              <div>
                <p className={`font-bold text-base ${trialData.isActive ? 'text-amber-900' : 'text-red-900'}`}>{trialData.isActive ? `Período de teste acaba em ${trialData.daysLeft} dias.` : 'Seu teste gratuito expirou.'}</p>
                <p className={`text-sm mt-0.5 ${trialData.isActive ? 'text-amber-700/80' : 'text-red-700/80'}`}>Desbloqueie o acesso completo para continuar evoluindo.</p>
              </div>
            </div>
            <button onClick={() => handleUpgradeClick('premium')} disabled={processingCheckout} className="w-full sm:w-auto bg-stone-900 text-white px-7 py-3.5 rounded-xl font-bold text-sm hover:bg-stone-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)]">
              {processingCheckout ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} />} Desbloquear Premium
            </button>
          </div>
        )}

        <header className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6 animate-fade-in-up">
          <div className="text-left">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl md:text-[2.5rem] font-bold text-stone-900 tracking-tight leading-none">Olá, {profile?.full_name?.split(' ')[0] || 'Paciente'}!</h2>
              {isPremium && <span className="bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900 p-1.5 rounded-full shadow-sm"><Star size={16} fill="currentColor" /></span>}
            </div>
            <p className="text-base text-stone-500 font-medium">Bem-vindo(a) de volta ao seu progresso de saúde.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {currentStreak > 0 && (
              <div className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] w-full sm:w-auto justify-center group">
                <div className="bg-orange-50 p-2.5 rounded-xl text-orange-500 group-hover:scale-110 group-hover:-rotate-6 transition-all"><Flame size={20} fill="currentColor" /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Ofensiva</p>
                  <p className="font-bold text-stone-800 leading-none">{currentStreak} Semanas</p>
                </div>
              </div>
            )}
            
            {!isCheckinDoneThisWeek ? (
              <button onClick={() => setIsCheckinModalOpen(true)} disabled={!isPremium && !trialData.isActive} className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all shadow-lg ${(!isPremium && !trialData.isActive) ? 'bg-stone-100 text-stone-400 cursor-not-allowed shadow-none' : 'bg-nutri-900 text-white hover:bg-nutri-800 shadow-nutri-900/20 hover:shadow-nutri-900/30 active:scale-[0.98]'}`}>
                {!isPremium && !trialData.isActive ? <Lock size={20} /> : <PlusCircle size={20} />} {!isPremium && !trialData.isActive ? 'Check-in Bloqueado' : 'Relato Semanal'}
              </button>
            ) : (
              <div className="w-full sm:w-auto flex flex-col items-center justify-center bg-green-50/80 text-green-800 px-6 py-3 rounded-2xl border border-green-200/50 text-center shadow-[0_2px_10px_rgba(34,197,94,0.05)]">
                <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} className="text-green-600" /> Relato concluído!</div>
                <span className="text-xs text-green-600/80 font-medium mt-0.5">Próximo abre em {daysUntilNextCheckin} dias</span>
              </div>
            )}
          </div>
        </header>

        {smartFeedback && (
          <div className={`mb-10 p-5 md:p-6 rounded-[2rem] border shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] ${smartFeedback.bg} ${smartFeedback.border} flex flex-col sm:flex-row items-start sm:items-center gap-5 animate-fade-in-up backdrop-blur-sm`}>
            <div className={`p-3.5 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm ${smartFeedback.color} shrink-0`}><smartFeedback.icon size={26} strokeWidth={2.5} /></div>
            <div>
              <h4 className={`font-bold text-lg mb-1 tracking-tight ${smartFeedback.color}`}>{smartFeedback.title}</h4>
              <p className="text-stone-600 text-sm md:text-base leading-relaxed font-medium">{smartFeedback.text}</p>
            </div>
          </div>
        )}

        {/* ==================== DIÁRIO DE HÁBITOS (NOVO LAYOUT BENTO BOX) ==================== */}
        {canAccessMealPlan && (
          <div className="mb-10 bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white animate-fade-in-up">
            
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-nutri-50 p-3 rounded-2xl text-nutri-800 shadow-sm border border-nutri-100/50">
                <ClipboardCheck size={26} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-stone-900 tracking-tight">Meu Diário de Hoje</h3>
                <p className="text-sm text-stone-500 font-medium mt-0.5">Registre suas conquistas diárias e acompanhe seu ritmo.</p>
              </div>
            </div>

            {/* O NOVO GRID BENTO BOX */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* === LINHA SUPERIOR (AÇÕES RÁPIDAS) === */}
              {/* CARD DE ÁGUA HORIZONTAL */}
              <div className="lg:col-span-6 flex flex-col justify-center relative p-6 md:px-8 md:py-7 rounded-[2rem] border overflow-hidden transition-all duration-500 min-h-[140px] shadow-sm bg-gradient-to-br from-white to-blue-50/30 border-blue-100">
                {/* Elemento decorativo */}
                <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl opacity-40 pointer-events-none transition-all duration-700 ${isWaterGoalMet ? 'bg-blue-400' : 'bg-blue-300'}`}></div>
                
                <div className="z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets size={16} className={isWaterGoalMet ? 'text-blue-500' : 'text-blue-400'} />
                      <h4 className={`text-[11px] font-black uppercase tracking-[0.15em] ${isWaterGoalMet ? 'text-blue-600' : 'text-blue-400'}`}>
                        {isWaterGoalMet ? 'Meta Atingida!' : 'Hidratação'}
                      </h4>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-4xl md:text-5xl font-black tracking-tight text-stone-800">{dailyLog.water_ml}</span>
                      <span className="text-lg font-bold text-blue-400">/ {waterGoal}ml</span>
                    </div>
                    <div className="w-full max-w-[80%] bg-blue-100/50 rounded-full h-1.5 overflow-hidden shadow-inner">
                      <div className={`h-1.5 rounded-full transition-all duration-700 ease-out ${isWaterGoalMet ? 'bg-blue-500' : 'bg-blue-400'}`} style={{ width: `${waterProgress}%` }}></div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center justify-end gap-3 shrink-0">
                    <button 
                      onClick={handleAddWater}
                      className={`w-full md:w-auto px-6 py-3 md:py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${isWaterGoalMet ? 'bg-white text-blue-600 border border-blue-100 shadow-sm hover:bg-blue-50' : 'bg-blue-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)] hover:-translate-y-0.5'}`}
                    >
                      <PlusCircle size={18} /> 250ml
                    </button>

                    {!isPushSubscribed && !isWaterGoalMet && (
                      <button 
                        onClick={subscribeToPush}
                        disabled={isSubscribingPush}
                        className="w-full md:w-auto px-4 py-2 text-xs font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 bg-transparent transition-colors flex items-center justify-center gap-1.5"
                      >
                        {isSubscribingPush ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
                        Lembretes
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* CARD DE HUMOR HORIZONTAL */}
              <div className="lg:col-span-6 bg-white p-6 md:px-8 md:py-7 rounded-[2rem] border border-stone-100 shadow-sm flex flex-col justify-center min-h-[140px]">
                <h4 className="text-[11px] font-black uppercase text-stone-400 tracking-[0.15em] mb-4">Como você está se sentindo?</h4>
                <div className="flex bg-stone-50/80 p-1.5 rounded-2xl border border-stone-100/50">
                  <button 
                    onClick={() => handleUpdateDailyLog({ mood: 'feliz' })}
                    className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 ${dailyLog.mood === 'feliz' ? 'bg-white shadow-[0_2px_10px_rgba(34,197,94,0.15)] text-green-500 scale-[1.02]' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    <Smile size={22} strokeWidth={dailyLog.mood === 'feliz' ? 2.5 : 2} />
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Ótimo</span>
                  </button>
                  <button 
                    onClick={() => handleUpdateDailyLog({ mood: 'neutro' })}
                    className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 ${dailyLog.mood === 'neutro' ? 'bg-white shadow-[0_2px_10px_rgba(245,158,11,0.15)] text-amber-500 scale-[1.02]' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    <Meh size={22} strokeWidth={dailyLog.mood === 'neutro' ? 2.5 : 2} />
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Normal</span>
                  </button>
                  <button 
                    onClick={() => handleUpdateDailyLog({ mood: 'dificil' })}
                    className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 ${dailyLog.mood === 'dificil' ? 'bg-white shadow-[0_2px_10px_rgba(244,63,94,0.15)] text-rose-500 scale-[1.02]' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    <Frown size={22} strokeWidth={dailyLog.mood === 'dificil' ? 2.5 : 2} />
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Difícil</span>
                  </button>
                </div>
              </div>


              {/* === LINHA INFERIOR (LISTAS/ACOMPANHAMENTOS) === */}
              {/* REFEIÇÕES */}
              <div className="lg:col-span-7 bg-stone-50/50 p-6 md:p-8 rounded-[2rem] border border-stone-100/80 flex flex-col">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h4 className="text-[11px] font-black uppercase text-stone-400 tracking-[0.15em] flex items-center gap-2 mb-1.5">
                      <Utensils size={14} /> Refeições do Plano
                    </h4>
                    <span className="text-xl font-bold text-stone-800 tracking-tight">
                      {completedMeals} de {totalMeals} concluídas
                    </span>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-stone-100 font-bold text-sm text-nutri-800">
                    {mealProgress}%
                  </div>
                </div>
                
                <div className="w-full bg-stone-200/60 rounded-full h-2 mb-8 overflow-hidden shadow-inner">
                  <div 
                    className={`h-2 rounded-full transition-all duration-700 ease-out ${isMealGoalMet ? 'bg-green-500' : 'bg-nutri-600'}`} 
                    style={{ width: `${mealProgress}%` }}
                  ></div>
                </div>

                {isMealPlanReady ? (
                  <div className="space-y-3 flex-1 content-start">
                    {mealNames.map((mealName: string, i: number) => {
                      const isChecked = dailyLog.meals_checked.includes(mealName);
                      return (
                        <button 
                          key={i}
                          onClick={() => handleToggleMeal(mealName)}
                          className={`w-full flex items-center justify-between p-4 md:p-5 rounded-2xl border transition-all duration-300 text-left group ${
                            isChecked 
                              ? 'bg-white border-green-100 shadow-[0_2px_10px_rgba(34,197,94,0.06)] scale-[0.99]' 
                              : 'bg-white border-stone-100/80 hover:border-nutri-200 hover:shadow-md hover:-translate-y-0.5'
                          }`}
                        >
                          <span className={`text-base font-bold transition-colors ${isChecked ? 'text-stone-400 line-through decoration-stone-300' : 'text-stone-700 group-hover:text-nutri-900'}`}>
                            {mealName}
                          </span>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-300 ${
                            isChecked ? 'bg-green-500 border-green-500 text-white scale-110 shadow-sm' : 'bg-stone-50 border-stone-200 text-transparent group-hover:border-nutri-400 group-hover:bg-nutri-50'
                          }`}>
                            <Check size={16} strokeWidth={isChecked ? 3 : 2} className={isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-50 group-hover:text-nutri-400'} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-white rounded-2xl border border-dashed border-stone-200 p-8">
                    <p className="text-sm text-stone-500 font-medium text-center">
                      Seu cardápio está sendo elaborado com carinho.<br/>Em breve aparecerá aqui.
                    </p>
                  </div>
                )}
              </div>

              {/* CARD DE ATIVIDADE FÍSICA */}
              <div className="lg:col-span-5 flex flex-col h-full">
                <ActivityCard
                  activities={dailyLog.activities || []}
                  weight={latestWeightForWater}
                  onAdd={() => setIsActivityModalOpen(true)}
                  onRemove={handleRemoveActivity}
                />
              </div>

            </div>
          </div>
        )}

        {/* ==================== GRÁFICO E EVOLUÇÃO ==================== */}
        <div className="mb-10 bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white animate-fade-in-up">
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
            <div>
              <h3 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-3">
                <div className="bg-nutri-50 p-2 rounded-xl"><TrendingDown className="text-nutri-800" size={20} /></div>
                Visão de Evolução
              </h3>
              <p className="text-sm text-stone-500 font-medium mt-1">Acompanhe seu progresso ao longo do tempo.</p>
            </div>

            <div className="flex bg-stone-50 p-1.5 rounded-2xl w-full lg:w-auto border border-stone-100">
              <button 
                onClick={() => setActiveLens('medidas')} 
                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeLens === 'medidas' ? 'bg-white text-nutri-900 shadow-sm border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
              >
                <Scale size={16} /> Medidas
              </button>
              
              <button 
                onClick={() => isPremium ? setActiveLens('composicao') : handleUpgradeClick()} 
                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeLens === 'composicao' ? 'bg-white text-nutri-900 shadow-sm border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
              >
                <Layers size={16} /> {isPremium ? 'Dobras' : <Lock size={14} className="text-amber-400" />}
              </button>

              <button 
                onClick={() => isPremium ? setActiveLens('metabolico') : handleUpgradeClick()} 
                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeLens === 'metabolico' ? 'bg-white text-nutri-900 shadow-sm border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
              >
                <ActivityIcon size={16} /> {isPremium ? 'Metabolismo' : <Lock size={14} className="text-amber-400" />}
              </button>
            </div>
          </div>

          {/* DELTAS DE PROGRESSO */}
          {(deltas.weightDelta || deltas.waistDelta) && (
            <div className="flex flex-wrap gap-4 mb-8">
              {deltas.weightDelta && (
                <div className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold border backdrop-blur-sm ${parseFloat(deltas.weightDelta) <= 0 ? 'bg-green-50/50 text-green-700 border-green-200' : 'bg-red-50/50 text-red-700 border-red-200'}`}>
                  {parseFloat(deltas.weightDelta) <= 0 ? <ArrowDown size={16}/> : <ArrowUp size={16}/>}
                  {Math.abs(parseFloat(deltas.weightDelta))} kg {parseFloat(deltas.weightDelta) <= 0 ? 'perdidos' : 'ganhos'}
                </div>
              )}
              {deltas.waistDelta && (
                <div className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold border backdrop-blur-sm ${parseFloat(deltas.waistDelta) <= 0 ? 'bg-indigo-50/50 text-indigo-700 border-indigo-200' : 'bg-stone-50/50 text-stone-700 border-stone-200'}`}>
                  {parseFloat(deltas.waistDelta) <= 0 ? <ArrowDown size={16}/> : <Minus size={16}/>}
                  {Math.abs(parseFloat(deltas.waistDelta))} cm de cintura
                </div>
              )}
            </div>
          )}

          <div className="h-80 w-full -ml-4 lg:ml-0">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isGoalMet ? "#22c55e" : "#166534"} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={isGoalMet ? "#22c55e" : "#166534"} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAreaWaist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                  
                  <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#818cf8" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                  
                  <RechartsTooltip 
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/90 backdrop-blur-xl text-stone-800 p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-stone-200 min-w-[180px]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-100 pb-2">{new Date(data.date).toLocaleDateString('pt-BR')}</p>
                            
                            {activeLens === 'medidas' && (
                              <>
                                {data.peso && (
                                  <div className="space-y-1.5 mb-3">
                                    <p className="font-bold text-stone-700 flex justify-between gap-4">Peso: <span className="text-emerald-600 font-black">{data.peso} kg</span></p>
                                    {data.imc && (
                                      <p className="text-xs text-stone-500 flex justify-between gap-4">
                                        IMC: <span className="font-bold text-stone-700">{data.imc} <span className="font-medium text-[10px]">({data.classificacao})</span></span>
                                      </p>
                                    )}
                                  </div>
                                )}
                                {data.cintura && <p className="font-bold text-stone-700 flex justify-between gap-4">Cintura: <span className="text-indigo-600 font-black">{data.cintura} cm</span></p>}
                              </>
                            )}

                            {activeLens === 'composicao' && (
                              <>
                                {data.peso && (
                                  <div className="space-y-1.5 mb-3">
                                    <p className="font-bold text-stone-700 flex justify-between gap-4">Peso: <span className="text-emerald-600 font-black">{data.peso} kg</span></p>
                                    {data.imc && (
                                      <p className="text-xs text-stone-500 flex justify-between gap-4">
                                        IMC: <span className="font-bold text-stone-700">{data.imc} <span className="font-medium text-[10px]">({data.classificacao})</span></span>
                                      </p>
                                    )}
                                  </div>
                                )}
                                {data.somatorio_dobras && <p className="font-bold text-stone-700 flex justify-between gap-4">7 Dobras: <span className="text-pink-500 font-black">{data.somatorio_dobras} mm</span></p>}
                              </>
                            )}

                            {activeLens === 'metabolico' && (
                              <>
                                {data.cintura && <p className="font-bold text-stone-700 flex justify-between gap-4">Cintura: <span className="text-indigo-600 font-black">{data.cintura} cm</span></p>}
                                {data.homair && <p className="font-bold text-stone-700 flex justify-between gap-4 mt-1.5">HOMA-IR: <span className="text-amber-500 font-black">{data.homair}</span></p>}
                              </>
                            )}

                            <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
                              {data.adesao && <p className="text-xs text-stone-500 flex justify-between">Adesão: <span className="font-bold text-stone-700">{data.adesao}/5</span></p>}
                              {data.hasExam && <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mt-2 flex items-center justify-center gap-1 bg-amber-50 py-1 rounded-md"><Syringe size={12}/> Exame Consta</p>}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  
                  {activeLens === 'medidas' && (
                    <>
                      {profile?.meta_peso && <ReferenceLine y={profile.meta_peso} yAxisId="left" stroke={isGoalMet ? "#22c55e" : "#cbd5e1"} strokeDasharray="5 5" label={{ position: 'insideTopLeft', value: isGoalMet ? 'META ATINGIDA!' : 'META', fill: isGoalMet ? '#16a34a' : '#94a3b8', fontSize: 10, fontWeight: 800 }} />}
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke={isGoalMet ? "#16a34a" : "#166534"} strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" connectNulls activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: isGoalMet ? "#22c55e" : "#166534" }} />
                      <Line type="monotone" yAxisId="right" dataKey="cintura" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: "#818cf8" }} connectNulls />
                    </>
                  )}

                  {activeLens === 'composicao' && (
                    <>
                      {profile?.meta_peso && <ReferenceLine y={profile.meta_peso} yAxisId="left" stroke={isGoalMet ? "#22c55e" : "#cbd5e1"} strokeDasharray="5 5" label={{ position: 'insideTopLeft', value: isGoalMet ? 'META ATINGIDA!' : 'META', fill: isGoalMet ? '#16a34a' : '#94a3b8', fontSize: 10, fontWeight: 800 }} />}
                      <Area type="monotone" yAxisId="left" dataKey="peso" stroke={isGoalMet ? "#16a34a" : "#166534"} strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" connectNulls activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: isGoalMet ? "#22c55e" : "#166534" }} />
                      <Line type="monotone" yAxisId="right" dataKey="somatorio_dobras" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, fill: "#ec4899", strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: "#f472b6" }} connectNulls />
                    </>
                  )}

                  {activeLens === 'metabolico' && (
                    <>
                      <ReferenceLine y={2.0} yAxisId="right" stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'ALERTA HOMA-IR', fill: '#ef4444', fontSize: 10, fontWeight: 800 }} />
                      <Area type="monotone" yAxisId="left" dataKey="cintura" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAreaWaist)" connectNulls activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: "#818cf8" }} />
                      <Line type="monotone" yAxisId="right" dataKey="homair" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: "#fbbf24" }} connectNulls />
                    </>
                  )}
                  
                  <Scatter yAxisId="left" dataKey="hasExam" shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (!payload.hasExam) return <g></g>;
                    return (
                      <g transform={`translate(${cx - 8},${cy - 25})`}>
                        <circle cx="8" cy="8" r="10" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
                        <Syringe x="3" y="3" size={10} color="#d97706" />
                      </g>
                    );
                  }} />

                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-300">
                <TrendingDown size={48} strokeWidth={1} />
                <p className="text-stone-500 mt-4 font-medium text-sm">Faça seu primeiro check-in para gerar os gráficos.</p>
              </div>
            )}
          </div>

          {/* PAINEL DE PREVISÃO DE CHEGADA E STATUS DA META */}
          {profile?.meta_peso && timelineData.length > 0 && (
            <div className={`mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 md:p-6 rounded-2xl border transition-colors shadow-sm ${isGoalMet ? 'bg-gradient-to-r from-green-50 to-white border-green-200' : 'bg-gradient-to-r from-stone-50 to-white border-stone-100'}`}>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className={`p-3.5 rounded-2xl ${isGoalMet ? 'bg-green-100 text-green-700' : 'bg-white shadow-sm border border-stone-100 text-nutri-800'}`}>
                  {isGoalMet ? <Trophy size={24}/> : <Target size={24}/>}
                </div>
                <div className="text-center sm:text-left">
                  <p className={`text-[10px] font-black uppercase tracking-[0.15em] mb-1 ${isGoalMet ? 'text-green-600' : 'text-stone-400'}`}>
                    {isGoalMet ? 'Você Chegou Lá!' : 'Destino: Peso Meta'}
                  </p>
                  <p className={`font-black text-2xl tracking-tight ${isGoalMet ? 'text-green-800' : 'text-stone-800'}`}>{profile.meta_peso} kg</p>
                </div>
              </div>
              
              {!isGoalMet && projection && !projection.achieved && (
                <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-stone-200/60 pt-4 sm:pt-0 sm:pl-8">
                   <p className="text-sm text-stone-600 font-medium">Ritmo atual: <strong className="text-emerald-600">-{projection.ratePerWeek} kg/sem</strong></p>
                   <p className="text-xs text-stone-500 mt-1">Mantendo o foco, você chega lá em <strong className="text-stone-800">~{projection.weeksLeft} semanas</strong>.</p>
                </div>
              )}
              
              {!isGoalMet && !projection && (
                <p className="text-xs font-medium text-center sm:text-right text-stone-500 max-w-xs">
                  Continue registrando seus relatos semanais para a IA projetar sua data de chegada.
                </p>
              )}
              
              {isGoalMet && (
                <p className="text-xs font-medium text-center sm:text-right text-green-700 max-w-xs leading-relaxed">
                  Parabéns pela dedicação fantástica! Você alcançou seu objetivo. O foco agora é a manutenção.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ==================== WIDGETS INFERIORES PREMIUM ==================== */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          <div className="lg:col-span-2 bg-gradient-to-br from-nutri-900 to-stone-900 text-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.12)] relative overflow-hidden group flex flex-col justify-center">
            {/* Elementos decorativos */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            
            <h3 className="text-nutri-200/80 font-bold uppercase text-[11px] tracking-[0.2em] mb-4 relative z-10 flex items-center gap-2">
              <Target size={14} /> Foco Principal
            </h3>
            <p className="text-2xl md:text-[2rem] font-medium leading-snug tracking-tight relative z-10">{evaluation ? Object.values(evaluation)[0] as string : 'Objetivo ainda não definido.'}</p>
          </div>
          
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-stone-100 relative overflow-hidden flex flex-col justify-between min-h-[180px] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all">
            <div className="flex items-center gap-2 mb-6 text-stone-400 relative z-10">
              <Ruler size={18} /><h3 className="font-bold uppercase text-[10px] tracking-[0.2em]">Medida de Cintura</h3>
            </div>
            <div className={!isPremium ? 'filter blur-[6px] select-none opacity-40 transition-all' : ''}>
              {antroData.length > 0 && antroData[0].waist ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-2"><span className="text-[2.5rem] font-black tracking-tight text-stone-900">{antroData[0].waist}</span><span className="text-stone-400 font-bold text-lg">cm</span></div>
                  {antroData.length > 1 && <p className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowRight size={12} /> Anterior: {antroData[1].waist}cm</p>}
                </div>
              ) : <p className="text-sm text-stone-500 font-medium">Aguardando consulta médica.</p>}
            </div>
            {!isPremium && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/50 backdrop-blur-[4px]">
                <div className="bg-white p-3.5 rounded-2xl shadow-lg border border-stone-100 text-amber-500 mb-3"><Lock size={22} /></div>
                <span className="text-[10px] font-bold text-stone-800 uppercase tracking-[0.15em] bg-white shadow-sm border border-stone-100 px-4 py-1.5 rounded-full">Exclusivo Premium</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up pb-10">
          <Link href="/dashboard/meu-plano" className={`p-8 rounded-[2.5rem] border transition-all duration-300 group relative overflow-hidden flex flex-col justify-between ${canAccessMealPlan ? 'bg-white shadow-sm border-stone-100 hover:border-nutri-200 hover:shadow-md hover:-translate-y-1' : 'bg-stone-50/50 border-stone-200'}`}>
            <div>
              <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3 flex items-center gap-2">Alimentação {!canAccessMealPlan && <Lock size={12} className="text-amber-500" />}</h4>
              <h3 className={`font-bold text-xl mb-4 tracking-tight ${canAccessMealPlan ? 'text-stone-900' : 'text-stone-500'}`}>Plano Alimentar</h3>
            </div>
            <div className="flex items-center justify-between mt-auto pt-4">
              <p className={`text-sm font-bold flex items-center gap-1.5 group-hover:gap-2.5 transition-all ${canAccessMealPlan ? 'text-nutri-800' : 'text-stone-400'}`}>
                {canAccessMealPlan ? (isMealPlanReady ? 'Cardápio Liberado' : 'Em elaboração') : 'Desbloquear Acesso'} 
                <ArrowRight size={14} />
              </p>
              {isMealPlanReady && canAccessMealPlan && <div className="bg-green-100/50 border border-green-200 text-green-600 p-2.5 rounded-2xl animate-pulse"><Utensils size={16} /></div>}
            </div>
          </Link>

          <Link href="/paciente/avaliacao" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:border-nutri-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
            <div>
              <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Minha Rotina</h4>
              <h3 className="font-bold text-stone-900 text-xl mb-4 tracking-tight">Raio-X Alimentar</h3>
            </div>
            <p className="text-sm text-nutri-800 font-bold flex items-center gap-1.5 group-hover:gap-2.5 transition-all mt-auto pt-4">
              {hasCompletedQFA ? 'Ver minhas respostas' : 'Preencher agora'} <ArrowRight size={14} />
            </p>
          </Link>

          <Link href="/dashboard/agendamentos" className={`p-8 rounded-[2.5rem] shadow-sm border transition-all duration-300 hover:-translate-y-1 group flex flex-col justify-between ${nextAppointment ? 'bg-nutri-50/50 border-nutri-200 hover:shadow-md hover:bg-nutri-50' : 'bg-white border-stone-100 hover:border-nutri-200 hover:shadow-md'}`}>
            <div>
              <h4 className={`font-black uppercase text-[10px] tracking-[0.2em] mb-3 flex items-center gap-2 ${nextAppointment ? 'text-nutri-600' : 'text-stone-400'}`}>
                <Calendar size={14}/> Consultas
              </h4>
              <h3 className="font-bold text-stone-900 text-xl mb-3 tracking-tight">Agendamento</h3>
              
              {nextAppointment ? (
                <p className="text-sm text-stone-600 font-medium leading-relaxed">
                  Sua próxima consulta é no dia <b className="text-nutri-900 bg-white px-1.5 py-0.5 rounded-md border border-nutri-100">{new Date(nextAppointment.appointment_date).toLocaleDateString('pt-BR')}</b> às <b className="text-nutri-900 bg-white px-1.5 py-0.5 rounded-md border border-nutri-100">{nextAppointment.appointment_time}</b>.
                </p>
              ) : (
                <p className="text-sm text-stone-500 font-medium">Nenhuma consulta futura agendada.</p>
              )}
            </div>
            
            <p className="text-sm text-nutri-800 font-bold flex items-center gap-1.5 group-hover:gap-2.5 transition-all mt-auto pt-4">
              {nextAppointment ? 'Ver detalhes' : 'Ver horários disponíveis'} <ArrowRight size={14} />
            </p>
          </Link>
        </div>

      </section>

      {/* MODAL DE CHECK-IN */}
      {isCheckinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-md sm:p-4 animate-fade-in transition-all">
          <div className="relative w-full max-w-lg bg-white sm:bg-transparent rounded-t-[2.5rem] sm:rounded-none shadow-2xl">
            <button onClick={() => setIsCheckinModalOpen(false)} className="absolute top-4 right-4 sm:-top-4 sm:-right-4 md:-right-12 bg-stone-100 sm:bg-white text-stone-500 p-2.5 rounded-full z-10 hover:bg-stone-200 hover:text-stone-800 transition-colors shadow-sm">
              <X size={20} />
            </button>
            <CheckinForm onSuccess={handleCheckinSuccess} onFormChange={() => {}} />
          </div>
        </div>
      )}

      {/* MODAL DE ADICIONAR ATIVIDADE FÍSICA */}
      <AddActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        onSave={handleAddActivity}
      />

      {/* MODAL / COMPONENTE DE CHAT FLUTUANTE */}
      <ChatAssistant />
    </main>
  );
}