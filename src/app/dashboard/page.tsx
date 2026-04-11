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
  Target, Calendar, ArrowDown, ArrowUp, Minus, ChevronRight, ShieldAlert, ShieldCheck,
  Brain, Sparkles, LayoutDashboard, ClipboardList, CalendarDays, UserCircle, LogOut, Compass
} from 'lucide-react';
import Link from 'next/link';
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Scatter 
} from 'recharts';
import CheckinForm from '@/components/CheckinForm';
import ChatAssistant from '@/components/ChatAssistant';
import type { AdminContext } from '@/components/ChatAssistant';
import ActivityCard from '@/components/ActivityCard';
import AddActivityModal from '@/components/AddActivityModal';
import { Activity, getTotalActivityKcal } from '@/lib/activities';
import { toast } from 'sonner';

// =========================================================================
// 🔥 COMPONENTES UI PREMIUM (NÍVEL SAAS) COM ÍCONES COLORIDOS
// =========================================================================
function MetricCard({ label, value, subtext, icon: Icon, highlight, iconColor }: any) {
  return (
    <div className={`p-5 md:p-6 rounded-[2rem] border transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[140px] ${
      highlight 
        ? 'bg-gradient-to-br from-nutri-900 to-stone-900 border-nutri-800 text-white shadow-md hover:shadow-xl hover:shadow-amber-500/30 relative overflow-hidden' 
        : 'bg-white border-stone-100 shadow-md hover:shadow-xl hover:shadow-amber-500/20 hover:border-amber-200'
    }`}>
      {highlight && <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>}
      <div className="flex justify-between items-start mb-3 relative z-10">
        <p className={`text-[10px] md:text-xs uppercase font-bold tracking-widest ${highlight ? 'text-nutri-200' : 'text-stone-400'}`}>{label}</p>
        {Icon && <Icon size={20} strokeWidth={2.5} className={iconColor || (highlight ? "text-nutri-400" : "text-stone-300")} />}
      </div>
      <div className="relative z-10">
        <p className={`text-2xl md:text-3xl font-black tracking-tight ${highlight ? 'text-white' : 'text-stone-900'}`}>
          {value}
        </p>
        {subtext && (
          <p className={`text-xs mt-1 font-medium ${highlight ? 'text-nutri-300' : 'text-stone-500'}`}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 🔥 FUNÇÃO DE CÁLCULO DE COMPOSIÇÃO CORPORAL (Jackson & Pollock)
// =========================================================================
function calculateBodyComposition(sum7: number, age: number | null, gender: string | undefined, weight: number) {
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
}

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

  const [bodyComposition, setBodyComposition] = useState<{
    percentualGordura: number | null;
    massaGorda: number | null;
    massaMagra: number | null;
    ultimaAvaliacao: string | null;
  } | null>(null);

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
      .select('full_name, status, meta_peso, account_type, trial_ends_at, created_at, has_meal_plan_access, meal_plan, food_restrictions, data_nascimento, sexo')
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

    try {
      const latestSkin = skin?.[0];
      const latestWeight = antro?.find(a => a.weight) || antro?.[0];

      if (!latestSkin || !latestWeight || !latestWeight.weight) {
        setBodyComposition(null);
      } else {
        const sum =
          parseFloat(latestSkin.triceps?.toString() || "0") +
          parseFloat(latestSkin.biceps?.toString() || "0") +
          parseFloat(latestSkin.subscapular?.toString() || "0") +
          parseFloat(latestSkin.suprailiac?.toString() || "0") +
          parseFloat(latestSkin.abdominal?.toString() || "0") +
          parseFloat(latestSkin.thigh?.toString() || "0") +
          parseFloat(latestSkin.calf?.toString() || "0");

        if (sum === 0) {
          setBodyComposition(null);
        } else {
          let age: number | null = null;
          if (profileData?.data_nascimento) {
            const birthDate = new Date(profileData.data_nascimento);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
          }

          if (!age) {
            setBodyComposition(null);
          } else {
            const result = calculateBodyComposition(
              sum,
              age,
              profileData?.sexo,
              parseFloat(latestWeight.weight)
            );

            if (result) {
              setBodyComposition({
                percentualGordura: parseFloat(result.bf),
                massaGorda: parseFloat(result.fatMass),
                massaMagra: parseFloat(result.leanMass),
                ultimaAvaliacao: latestSkin.measurement_date || latestWeight.measurement_date
              });
            } else {
              setBodyComposition(null);
            }
          }
        }
      }
    } catch (compError) {
      console.error("Erro ao calcular composição corporal:", compError);
      setBodyComposition(null);
    }

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
    if (checkins.length > 0) return parseFloat(checkins[checkins.length - 1].peso);
    if (antroData.length > 0) return parseFloat(antroData[0].weight);
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

  const dailyScore = useMemo(() => {
    let moodScore = 0;
    if (dailyLog.mood === 'feliz') moodScore = 100;
    else if (dailyLog.mood === 'neutro') moodScore = 60;
    else if (dailyLog.mood === 'dificil') moodScore = 20;

    const actScore = (dailyLog.activities?.length > 0) ? 100 : 0;

    return Math.round(
      (waterProgress * 0.25) +
      (mealProgress * 0.35) +
      (actScore * 0.20) +
      (moodScore * 0.20)
    );
  }, [waterProgress, mealProgress, dailyLog.mood, dailyLog.activities]);

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

  // =========================================================================
  // 🔥 CORREÇÃO DO GRÁFICO (Garante pontos e linhas visíveis)
  // =========================================================================
  const timelineData = useMemo(() => {
    const dateSet = new Set<string>();
    const formatD = (d: string) => new Date(d).toISOString().split('T')[0];

    checkins.forEach(h => dateSet.add(formatD(h.created_at)));
    antroData.forEach(a => dateSet.add(formatD(a.measurement_date)));
    skinfoldsData.forEach(s => dateSet.add(formatD(s.measurement_date)));
    bioData.forEach(b => dateSet.add(formatD(b.exam_date)));

    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const checkinComAltura = [...checkins].reverse().find(c => c.altura);
    const ultimaAltura = checkinComAltura?.altura ? parseFloat(checkinComAltura.altura) : null;

    return sortedDates.map(dateStr => {
      const checkin = checkins.find(h => formatD(h.created_at) === dateStr);
      const antro = antroData.find(a => formatD(a.measurement_date) === dateStr);
      const skin = skinfoldsData.find(s => formatD(s.measurement_date) === dateStr);
      const bio = bioData.find(b => formatD(b.exam_date) === dateStr);

      const rawPeso = checkin?.peso || antro?.weight;
      const rawCintura = antro?.waist || checkin?.cintura; 
      
      const pesoAtual = rawPeso ? parseFloat(rawPeso) : null;
      const cinturaAtual = rawCintura ? parseFloat(rawCintura) : null;
      const imcAtual = pesoAtual && ultimaAltura ? parseFloat(getIMC(pesoAtual, ultimaAltura) || "0") : null;

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
        classificacao: imcAtual ? getClassificacaoIMC(imcAtual) : '',
        cintura: cinturaAtual,
        somatorio_dobras: sumFolds,
        homair: homa,
        adesao: checkin?.adesao_ao_plano ? parseFloat(checkin.adesao_ao_plano) : null,
        hasExam: !!bio, 
      };
    });
  }, [checkins, antroData, skinfoldsData, bioData]);

  const deltas = useMemo(() => {
    const validWeights = timelineData.filter(d => d.peso !== null).map(d => d.peso!);
    const validWaists = timelineData.filter(d => d.cintura !== null).map(d => d.cintura!);

    const weightDelta = validWeights.length > 1 ? (validWeights[validWeights.length - 1] - validWeights[0]).toFixed(1) : null;
    const waistDelta = validWaists.length > 1 ? (validWaists[validWaists.length - 1] - validWaists[0]).toFixed(1) : null;

    return { 
      weightDelta, 
      waistDelta, 
      initialWeight: validWeights.length > 0 ? validWeights[0] : null,
      currentWeight: validWeights.length > 0 ? validWeights[validWeights.length - 1] : null,
      currentWaist: validWaists.length > 0 ? validWaists[validWaists.length - 1] : null
    };
  }, [timelineData]);

  const isGoalMet = profile?.meta_peso && deltas.currentWeight && deltas.currentWeight <= parseFloat(profile.meta_peso);

  const weightProgressPercent = useMemo(() => {
    if (!profile?.meta_peso || !deltas.initialWeight || !deltas.currentWeight) return 0;
    const initial = deltas.initialWeight;
    const current = deltas.currentWeight;
    const target = parseFloat(profile.meta_peso);
    
    if (initial === target) return 100;

    if (initial > target) {
      if (current <= target) return 100;
      if (current >= initial) return 0;
      return Math.max(0, Math.min(100, ((initial - current) / (initial - target)) * 100));
    } 
    
    if (initial < target) {
      if (current >= target) return 100;
      if (current <= initial) return 0;
      return Math.max(0, Math.min(100, ((current - initial) / (target - initial)) * 100));
    }

    return 0;
  }, [deltas.initialWeight, deltas.currentWeight, profile?.meta_peso]);

  const projection = useMemo(() => {
    if (!profile?.meta_peso) return null;
    const target = parseFloat(profile.meta_peso);
    
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
    const weightLeft = lastPoint.peso! - target;
    
    if (weightLeft <= 0) return { achieved: true };

    const weeksLeft = weightLeft / ratePerWeek;
    
    return {
      ratePerWeek: ratePerWeek.toFixed(2),
      weeksLeft: Math.ceil(weeksLeft),
      weightLeft: weightLeft.toFixed(1)
    };
  }, [timelineData, profile?.meta_peso]);

  const smartInsight = useMemo(() => {
    if (!deltas.currentWeight || !deltas.initialWeight) return "Faça seu primeiro relato para destravar insights automáticos do seu corpo.";
    
    if (deltas.currentWeight < deltas.initialWeight) {
      if (dailyLog.mood === 'dificil') return "Seu humor caiu — isso pode impactar sua consistência logo mais. Ajuste leve recomendado. ⚠️";
      if (dailyScore > 80) return "Você está evoluindo de forma incrivelmente consistente — excelente trabalho! 🔥";
      return "Sua evolução está em andamento. Consistência é o segredo agora.";
    }

    if (dailyScore < 50) return "Seu progresso deu uma pausada e a adesão diária está baixa. Retome o foco hoje com hidratação e metas simples. 🎯";
    return "Seu progresso está estável. Pequenos ajustes podem acelerar seus resultados.";
  }, [deltas, dailyLog.mood, dailyScore]);

  const foodRestrictions = profile?.food_restrictions || [];
  const hasFoodRestrictions = foodRestrictions.length > 0;
  const foodStatusConfig = hasFoodRestrictions 
    ? { icon: <ShieldAlert size={20} strokeWidth={2.5} />, bgClass: 'bg-amber-50 text-amber-600', textClass: 'text-amber-900', label: `${foodRestrictions.length} restrições cadastradas`, desc: 'Ativo e monitorado' }
    : { icon: <ShieldCheck size={20} strokeWidth={2.5} />, bgClass: 'bg-green-50 text-green-600', textClass: 'text-stone-900', label: 'Sem restrições', desc: 'Perfil atualizado' };

  const adminContextForChat: AdminContext = {
    patients: [],
    leads: [],
    usageStats: {},
    todayTotalMessages: 0,
    bodyComposition: bodyComposition
  };

  const validWeightsCount = timelineData.filter(d => d.peso !== null).length;
  const validWaistsCount = timelineData.filter(d => d.cintura !== null).length;

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
      
      {/* ========================================================================= */}
      {/* 🔥 SIDEBAR DESKTOP PREMIUM (Com Ícones em Containers) */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-white/60 backdrop-blur-xl border-r border-stone-200/50 hidden md:flex flex-col p-8 sticky top-20 h-[calc(100vh-80px)] z-10 shadow-[4px_0_24px_rgba(0,0,0,0.01)]">
        <h2 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em] mb-8 flex items-center gap-2">
          <Compass size={14} /> Navegação
        </h2>
        
        <nav className="flex-1 space-y-2">
          {/* MENU ATIVO */}
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3.5 bg-white text-nutri-900 font-bold text-sm rounded-2xl shadow-[0_4px_20px_rgba(28,25,23,0.05)] border border-stone-100 transition-all group">
            <div className="p-2 bg-nutri-50 rounded-xl text-nutri-600 group-hover:scale-110 transition-transform">
              <LayoutDashboard size={18} strokeWidth={2.5} />
            </div>
            Painel Geral
          </Link>

          {/* MENUS INATIVOS (Com Glow Dourado no Hover) */}
          <Link href="/paciente/avaliacao" className="flex items-center gap-3 px-4 py-3.5 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm font-semibold text-sm rounded-2xl transition-all border border-transparent hover:border-stone-100 group">
            <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
              <ClipboardList size={18} strokeWidth={2.5} />
            </div>
            Avaliação (QFA)
          </Link>

          <Link href="/dashboard/meu-plano" className="flex items-center justify-between px-4 py-3.5 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm font-semibold text-sm rounded-2xl transition-all border border-transparent hover:border-stone-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
                <Utensils size={18} strokeWidth={2.5} />
              </div>
              Meu Plano
            </div>
            {!canAccessMealPlan && <Lock size={14} className="text-stone-300"/>}
          </Link>

          <Link href="/dashboard/agendamentos" className="flex items-center gap-3 px-4 py-3.5 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm font-semibold text-sm rounded-2xl transition-all border border-transparent hover:border-stone-100 group">
            <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
              <CalendarDays size={18} strokeWidth={2.5} />
            </div>
            Agendamentos
          </Link>

          <Link href="/dashboard/perfil" className="flex items-center gap-3 px-4 py-3.5 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm font-semibold text-sm rounded-2xl transition-all border border-transparent hover:border-stone-100 group">
            <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
              <UserCircle size={18} strokeWidth={2.5} />
            </div>
            Meu Perfil
          </Link>
        </nav>

        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-stone-400 text-xs font-bold uppercase tracking-wider hover:text-red-500 transition-colors mt-auto pt-8 border-t border-stone-200/60 w-full text-left flex items-center gap-3 group">
          <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-red-50 group-hover:text-red-500 transition-colors">
             <LogOut size={16} strokeWidth={2.5} />
          </div>
          Sair da Conta
        </button>
      </aside>

      {/* ÁREA PRINCIPAL DO DASHBOARD */}
      <section className="flex-1 p-4 sm:p-6 md:p-10 lg:p-12 overflow-y-auto w-full max-w-6xl mx-auto space-y-8 md:space-y-10">
        
        {/* ALERTAS DO SISTEMA */}
        <div className="space-y-4">
          {!hasCompletedQFA && (
            <div className="p-4 md:p-6 bg-gradient-to-r from-rose-600 to-rose-500 rounded-3xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in-up border border-rose-400/30">
              <div className="flex items-center gap-3 w-full">
                <div className="bg-white/20 backdrop-blur-md p-2.5 rounded-xl shadow-inner shrink-0">
                  <ClipboardCheck size={22} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base md:text-lg font-bold tracking-tight leading-tight">Avaliação Pendente</h3>
                  <p className="text-rose-100/90 text-xs md:text-sm mt-0.5 line-clamp-1 md:line-clamp-none">Preencha seu Raio-X alimentar. Assim a Nutri Vanusa poderá criar um plano personalizado para você.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href="/paciente/avaliacao" className="bg-white text-rose-600 px-4 py-2 rounded-lg font-bold text-xs hover:bg-stone-50 transition-all shadow-sm">Avaliação</Link>
                  <Link href="/dashboard/completar-perfil" className={`px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-sm ${hasFoodRestrictions ? 'bg-green-500 text-white hover:bg-green-400' : 'bg-yellow-500 text-white hover:bg-yellow-400'}`}>Perfil Alimentar</Link>
                </div>
              </div>
            </div>
          )}

          {!isPremium && (
            <div className={`p-4 md:p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 border shadow-sm animate-fade-in-up ${trialData.isActive ? 'bg-gradient-to-r from-amber-50 to-white border-amber-200/60' : 'bg-gradient-to-r from-red-50 to-white border-red-200/60'}`}>
              <div className="flex items-center gap-3 w-full">
                <div className={`p-2.5 rounded-xl shrink-0 ${trialData.isActive ? 'bg-amber-100/50 text-amber-600' : 'bg-red-100/50 text-red-600'}`}>
                  {trialData.isActive ? <Zap size={20} /> : <AlertCircle size={20} />}
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-sm md:text-base leading-tight ${trialData.isActive ? 'text-amber-900' : 'text-red-900'}`}>{trialData.isActive ? `${trialData.daysLeft} dias de teste` : 'Teste expirado'}</p>
                  <p className={`text-xs mt-0.5 line-clamp-1 md:line-clamp-none ${trialData.isActive ? 'text-amber-700/80' : 'text-red-700/80'}`}>Desbloqueie o acesso completo e tenha análises completas.</p>
                </div>
                <button onClick={() => handleUpgradeClick('premium')} disabled={processingCheckout} className="shrink-0 bg-stone-900 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg hover:shadow-amber-500/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-md">
                  {processingCheckout ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />} Assinar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 1. HERO SECTION */}
        <header className="flex flex-col gap-2 animate-fade-in-up mt-2">
          <p className="text-sm font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
            Seu progresso hoje 
            {currentStreak > 0 && (
              <span className="bg-orange-100 text-orange-600 px-2.5 py-0.5 rounded-full text-[10px] flex items-center gap-1"><Flame size={12} fill="currentColor"/> {currentStreak} Semanas</span>
            )}
          </p>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-stone-900 tracking-tight leading-tight">
            {isGoalMet 
              ? "Meta atingida — incrível! 🏆"
              : weightProgressPercent > 60
              ? "Você está muito perto da sua meta 🔥"
              : "Sua evolução está em andamento 📈"}
          </h1>
          <p className="text-stone-500 mt-2 max-w-xl text-base md:text-lg">
            {projection?.weeksLeft 
              ? `Mantendo esse ritmo, você atinge sua meta visual em ${projection.weeksLeft} semanas.`
              : "Continue consistente no diário e nos check-ins para acelerar seus resultados."}
          </p>
        </header>

        {/* 2. SUPER CARDS (AGORA COM ÍCONES COLORIDOS 🔥) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <MetricCard 
            label="Progresso" 
            value={`${Math.round(weightProgressPercent)}%`} 
            highlight 
            icon={Target}
            iconColor="text-amber-400"
          />
          <MetricCard 
            label="Peso atual" 
            value={deltas.currentWeight ? `${deltas.currentWeight} kg` : '--'} 
            icon={Scale}
            subtext={deltas.initialWeight ? `Iniciou com ${deltas.initialWeight}kg` : ''}
            iconColor="text-blue-500"
          />
          <MetricCard 
            label="Faltam" 
            value={projection?.weightLeft ? `${projection.weightLeft} kg` : '--'} 
            icon={ArrowDown}
            subtext={profile?.meta_peso ? `Meta: ${profile.meta_peso}kg` : 'Defina sua meta'}
            iconColor="text-rose-500"
          />
          <MetricCard 
            label="Consistência" 
            value={`${currentStreak} sem`} 
            icon={Flame}
            subtext="Check-ins seguidos"
            iconColor="text-orange-500"
          />
        </div>

        {/* 3. INSIGHT INTELIGENTE */}
        <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-md flex items-start sm:items-center gap-5 animate-fade-in-up hover:shadow-xl hover:shadow-amber-500/20 hover:-translate-y-1 transition-all duration-300" style={{ animationDelay: '0.2s' }}>
          <div className="p-3 bg-nutri-50 rounded-2xl text-nutri-800 shrink-0">
            <Brain size={28} />
          </div>
          <div>
            <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-1">
              Insight Inteligente
            </p>
            <p className="text-base md:text-lg font-bold text-stone-800 leading-snug">
              {smartInsight}
            </p>
          </div>
        </div>

        {/* FEEDBACK INTELIGENTE */}
        {smartFeedback && (
          <div className={`p-5 rounded-3xl border shadow-md ${smartFeedback.bg} ${smartFeedback.border} flex items-start sm:items-center gap-4 animate-fade-in-up backdrop-blur-sm`}>
            <div className={`p-2.5 bg-white/80 backdrop-blur-md rounded-xl shadow-sm ${smartFeedback.color} shrink-0`}><smartFeedback.icon size={22} strokeWidth={2.5} /></div>
            <div>
              <h4 className={`font-bold text-base mb-0.5 tracking-tight ${smartFeedback.color}`}>{smartFeedback.title}</h4>
              <p className="text-stone-600 text-xs md:text-sm leading-relaxed font-medium">{smartFeedback.text}</p>
            </div>
          </div>
        )}

        {/* 4. DIÁRIO GAMIFICADO */}
        {canAccessMealPlan && (
          <div className="bg-white/80 backdrop-blur-xl p-5 md:p-8 rounded-[2rem] shadow-md hover:shadow-xl hover:shadow-amber-500/20 hover:-translate-y-1 transition-all duration-300 border border-stone-100 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-nutri-50 p-2.5 rounded-xl text-nutri-800 border border-nutri-100/50">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-stone-900 tracking-tight leading-tight">Diário Gamificado</h3>
                  <p className="text-xs md:text-sm text-stone-500 font-medium mt-1">Complete ações para maximizar sua adesão diária.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-stone-50 px-4 py-2.5 rounded-2xl border border-stone-100 shadow-sm">
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Score do Dia</p>
                  <p className="text-xl md:text-2xl font-black text-nutri-900">{dailyScore}/100</p>
                </div>
                <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                  <svg className="w-10 h-10 transform -rotate-90">
                    <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-stone-200" />
                    <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="100.5" strokeDashoffset={100.5 - (100.5 * dailyScore) / 100} className={`transition-all duration-1000 ${dailyScore > 80 ? 'text-green-500' : dailyScore > 50 ? 'text-amber-500' : 'text-stone-400'}`} />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
              {/* CARD DE ÁGUA */}
              <div className="lg:col-span-6 flex flex-col justify-center relative p-6 rounded-[1.5rem] border overflow-hidden transition-all duration-500 min-h-[140px] shadow-sm bg-gradient-to-br from-white to-blue-50/30 border-blue-100 hover:shadow-md">
                <div className={`absolute -right-10 -bottom-10 w-32 h-32 rounded-full blur-2xl opacity-40 pointer-events-none transition-all duration-700 ${isWaterGoalMet ? 'bg-blue-400' : 'bg-blue-300'}`}></div>
                
                <div className="z-10 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Droplets size={14} className={isWaterGoalMet ? 'text-blue-500' : 'text-blue-400'} />
                      <h4 className={`text-[10px] font-black uppercase tracking-[0.15em] ${isWaterGoalMet ? 'text-blue-600' : 'text-blue-400'}`}>
                        {isWaterGoalMet ? 'Meta Atingida!' : 'Hidratação'}
                      </h4>
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-3xl font-black tracking-tight text-stone-800">{dailyLog.water_ml}</span>
                      <span className="text-sm font-bold text-blue-400">/ {waterGoal}ml</span>
                    </div>
                    <div className="w-full bg-blue-100/50 rounded-full h-1.5 overflow-hidden shadow-inner">
                      <div className={`h-1.5 rounded-full transition-all duration-700 ease-out ${isWaterGoalMet ? 'bg-blue-500' : 'bg-blue-400'}`} style={{ width: `${waterProgress}%` }}></div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-3 shrink-0">
                    <button 
                      onClick={handleAddWater}
                      className={`h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${isWaterGoalMet ? 'bg-blue-50 text-blue-600 border border-blue-100 shadow-sm' : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'}`}
                    >
                      <PlusCircle size={24} />
                    </button>
                    {!isPushSubscribed && !isWaterGoalMet && (
                      <button onClick={subscribeToPush} disabled={isSubscribingPush} className="text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1">
                        {isSubscribingPush ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />} Aviso
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* CARD DE HUMOR */}
              <div className="lg:col-span-6 bg-white p-6 rounded-[1.5rem] border border-stone-100 shadow-sm flex flex-col justify-center hover:shadow-md transition-all">
                <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.15em] mb-4">Seu Humor</h4>
                <div className="flex bg-stone-50/80 p-1.5 rounded-2xl border border-stone-100/50 gap-2">
                  <button onClick={() => handleUpdateDailyLog({ mood: 'feliz' })} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-300 ${dailyLog.mood === 'feliz' ? 'bg-white shadow-sm text-green-500 border border-stone-100 scale-105' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Smile size={24} strokeWidth={dailyLog.mood === 'feliz' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold uppercase tracking-wider mt-1">Ótimo</span>
                  </button>
                  <button onClick={() => handleUpdateDailyLog({ mood: 'neutro' })} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-300 ${dailyLog.mood === 'neutro' ? 'bg-white shadow-sm text-amber-500 border border-stone-100 scale-105' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Meh size={24} strokeWidth={dailyLog.mood === 'neutro' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold uppercase tracking-wider mt-1">Normal</span>
                  </button>
                  <button onClick={() => handleUpdateDailyLog({ mood: 'dificil' })} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-300 ${dailyLog.mood === 'dificil' ? 'bg-white shadow-sm text-rose-500 border border-stone-100 scale-105' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Frown size={24} strokeWidth={dailyLog.mood === 'dificil' ? 2.5 : 2} />
                    <span className="text-[9px] font-bold uppercase tracking-wider mt-1">Difícil</span>
                  </button>
                </div>
              </div>

              {/* REFEIÇÕES */}
              <div className="lg:col-span-7 bg-stone-50/50 p-6 rounded-[1.5rem] border border-stone-100/80 flex flex-col">
                <div className="flex justify-between items-end mb-5">
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.15em] flex items-center gap-1.5 mb-1">
                      <Utensils size={12} /> Refeições
                    </h4>
                    <span className="text-lg font-bold text-stone-800 tracking-tight">
                      {completedMeals} de {totalMeals} concluídas
                    </span>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-stone-100 font-bold text-xs text-nutri-800">
                    {mealProgress}%
                  </div>
                </div>
                
                <div className="w-full bg-stone-200/60 rounded-full h-1.5 mb-6 overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all duration-700 ease-out ${isMealGoalMet ? 'bg-green-500' : 'bg-nutri-600'}`} style={{ width: `${mealProgress}%` }}></div>
                </div>

                {isMealPlanReady ? (
                  <div className="space-y-3 flex-1">
                    {mealNames.map((mealName: string, i: number) => {
                      const isChecked = dailyLog.meals_checked.includes(mealName);
                      return (
                        <button key={i} onClick={() => handleToggleMeal(mealName)} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 text-left active:scale-[0.98] ${isChecked ? 'bg-white border-green-100 shadow-sm' : 'bg-white border-stone-100 hover:border-nutri-200'}`}>
                          <span className={`text-sm font-bold transition-colors ${isChecked ? 'text-stone-400 line-through decoration-stone-300' : 'text-stone-700'}`}>
                            {mealName}
                          </span>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-200 ${isChecked ? 'bg-green-500 border-green-500 text-white shadow-sm' : 'bg-stone-50 border-stone-200 text-transparent'}`}>
                            <Check size={14} strokeWidth={isChecked ? 3 : 2} className={isChecked ? 'opacity-100' : 'opacity-0'} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-white rounded-2xl border border-dashed border-stone-200 p-6">
                    <p className="text-xs text-stone-500 font-medium text-center">Cardápio em elaboração.</p>
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

        {/* 5. GRÁFICO E EVOLUÇÃO / PAYWALL */}
        {!isPremium && !trialData.isActive ? (
          
          <div className="bg-white p-8 md:p-16 rounded-[3rem] shadow-md border border-stone-100 text-center relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-nutri-50 to-amber-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3 -z-10"></div>
            
            <div className="w-20 h-20 bg-gradient-to-tr from-nutri-900 to-nutri-700 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg rotate-3">
              <Lock className="text-white" size={32} />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-4 tracking-tight">
              Seu progresso completo está bloqueado
            </h2>
            <p className="text-stone-500 text-lg mb-8 max-w-xl mx-auto">
              Desbloqueie análises inteligentes, previsões corporais, acompanhamento profissional e seu histórico de evolução ilimitado.
            </p>

            <button onClick={() => handleUpgradeClick('premium')} disabled={processingCheckout} className="inline-flex items-center justify-center w-full sm:w-auto gap-3 bg-nutri-900 text-white px-10 py-5 rounded-full font-black text-lg transition-all shadow-md hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-1 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-md">
              {processingCheckout ? <Loader2 size={24} className="animate-spin" /> : <Star size={24} />}
              Desbloquear Evolução Completa
            </button>
            <p className="text-xs text-stone-400 mt-6 font-medium">Usuários Premium têm 3x mais consistência rumo à meta.</p>
          </div>

        ) : (
          
          <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] shadow-md hover:shadow-xl hover:shadow-amber-500/20 transition-shadow duration-300 border border-stone-100 animate-fade-in-up">
            
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-5">
              <div>
                <h3 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-3">
                  <TrendingDown className="text-nutri-800" size={24} /> Curva de Transformação
                </h3>
              </div>

              {/* Menu de Lentes Scrollável */}
              <div className="flex overflow-x-auto pb-2 -mx-6 px-6 md:mx-0 md:px-0 md:pb-0 hide-scrollbar">
                <div className="flex bg-stone-50 p-1.5 rounded-2xl border border-stone-100 shrink-0 w-max">
                  <button onClick={() => setActiveLens('medidas')} className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeLens === 'medidas' ? 'bg-white text-nutri-900 shadow-sm border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Scale size={16} /> Medidas
                  </button>
                  <button onClick={() => setActiveLens('composicao')} className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeLens === 'composicao' ? 'bg-white text-nutri-900 shadow-sm border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}>
                    <Layers size={16} /> Dobras
                  </button>
                  <button onClick={() => setActiveLens('metabolico')} className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeLens === 'metabolico' ? 'bg-white text-nutri-900 shadow-sm border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}>
                    <ActivityIcon size={16} /> Metabolismo
                  </button>
                </div>
              </div>
            </div>

            <div className="h-72 w-full -ml-4 lg:ml-0 mb-4">
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
                    <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                    
                    <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                    <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#818cf8" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                    
                    <RechartsTooltip 
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }}
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white/95 backdrop-blur-xl text-stone-800 p-4 rounded-[1.5rem] shadow-xl border border-stone-100 min-w-[160px]">
                              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-100 pb-2">{new Date(data.date).toLocaleDateString('pt-BR')}</p>
                              
                              {activeLens === 'medidas' && (
                                <div className="space-y-2">
                                  {data.peso && <p className="font-bold text-sm flex justify-between gap-4">Peso: <span className="text-emerald-600">{data.peso} kg</span></p>}
                                  {data.cintura && <p className="font-bold text-sm flex justify-between gap-4">Cintura: <span className="text-indigo-600">{data.cintura} cm</span></p>}
                                  {data.imc && <p className="font-bold text-sm flex justify-between gap-4">IMC: <span className="text-stone-600">{data.imc}</span></p>}
                                </div>
                              )}

                              {activeLens === 'composicao' && (
                                <div className="space-y-2">
                                  {data.peso && <p className="font-bold text-sm flex justify-between gap-4">Peso: <span className="text-emerald-600">{data.peso} kg</span></p>}
                                  {data.somatorio_dobras && <p className="font-bold text-sm flex justify-between gap-4">Dobras: <span className="text-pink-500">{data.somatorio_dobras} mm</span></p>}
                                </div>
                              )}

                              {activeLens === 'metabolico' && (
                                <div className="space-y-2">
                                  {data.cintura && <p className="font-bold text-sm flex justify-between gap-4">Cintura: <span className="text-indigo-600">{data.cintura} cm</span></p>}
                                  {data.homair && <p className="font-bold text-sm flex justify-between gap-4">HOMA-IR: <span className="text-amber-500">{data.homair}</span></p>}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    
                    {/* 🔥 RENDERIZAÇÃO MELHORADA DAS LINHAS (Com fallback para ponto único) */}
                    {activeLens === 'medidas' && (
                      <>
                        {profile?.meta_peso && <ReferenceLine y={parseFloat(profile.meta_peso)} yAxisId="left" stroke={isGoalMet ? "#22c55e" : "#cbd5e1"} strokeDasharray="5 5" label={{ value: 'Meta', position: 'insideTopLeft', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />}
                        
                        {validWeightsCount > 1 ? (
                          <Area type="monotone" yAxisId="left" dataKey="peso" stroke={isGoalMet ? "#16a34a" : "#166534"} strokeWidth={4} fillOpacity={1} fill="url(#colorArea)" connectNulls activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: isGoalMet ? "#22c55e" : "#166534" }} />
                        ) : (
                          <Scatter yAxisId="left" dataKey="peso" fill="#166534" shape="circle" r={6} />
                        )}

                        {validWaistsCount > 1 ? (
                          <Line type="monotone" yAxisId="right" dataKey="cintura" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: "#818cf8" }} connectNulls />
                        ) : (
                          <Scatter yAxisId="right" dataKey="cintura" fill="#6366f1" shape="circle" r={6} />
                        )}
                      </>
                    )}

                    {activeLens === 'composicao' && (
                      <>
                        {profile?.meta_peso && <ReferenceLine y={parseFloat(profile.meta_peso)} yAxisId="left" stroke={isGoalMet ? "#22c55e" : "#cbd5e1"} strokeDasharray="5 5" />}
                        
                        {validWeightsCount > 1 ? (
                          <Area type="monotone" yAxisId="left" dataKey="peso" stroke={isGoalMet ? "#16a34a" : "#166534"} strokeWidth={4} fillOpacity={1} fill="url(#colorArea)" connectNulls activeDot={{ r: 8 }} />
                        ) : (
                          <Scatter yAxisId="left" dataKey="peso" fill="#166534" shape="circle" r={6} />
                        )}

                        {timelineData.filter(d => d.somatorio_dobras !== null).length > 1 ? (
                          <Line type="monotone" yAxisId="right" dataKey="somatorio_dobras" stroke="#ec4899" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 8 }} connectNulls />
                        ) : (
                          <Scatter yAxisId="right" dataKey="somatorio_dobras" fill="#ec4899" shape="circle" r={6} />
                        )}
                      </>
                    )}

                    {activeLens === 'metabolico' && (
                      <>
                        <ReferenceLine y={2.0} yAxisId="right" stroke="#ef4444" strokeDasharray="3 3" />
                        
                        {validWaistsCount > 1 ? (
                          <Area type="monotone" yAxisId="left" dataKey="cintura" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorAreaWaist)" connectNulls activeDot={{ r: 8 }} />
                        ) : (
                          <Scatter yAxisId="left" dataKey="cintura" fill="#6366f1" shape="circle" r={6} />
                        )}

                        {timelineData.filter(d => d.homair !== null).length > 1 ? (
                          <Line type="monotone" yAxisId="right" dataKey="homair" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 8 }} connectNulls />
                        ) : (
                          <Scatter yAxisId="right" dataKey="homair" fill="#f59e0b" shape="circle" r={6} />
                        )}
                      </>
                    )}
                    
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-stone-300 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                  <TrendingDown size={36} strokeWidth={1.5} />
                  <p className="text-stone-500 mt-3 font-bold text-sm">Aguardando o primeiro relato.</p>
                </div>
              )}
            </div>

            <div className="text-center mt-6">
              <p className="text-sm text-stone-500 font-medium">
                {weightProgressPercent > 0
                  ? `Você já avançou ${Math.round(weightProgressPercent)}% rumo à sua meta. Continue firme!`
                  : validWeightsCount === 1 
                  ? "Sua primeira medida foi registrada! Adicione mais check-ins para formar a linha do gráfico."
                  : "Seu progresso visual começará após os primeiros registros do seu diário e medidas."}
              </p>
            </div>

          </div>
        )}

        {/* 6. AÇÕES INFERIORES PREMIUM */}
        <div className="flex flex-col gap-4 animate-fade-in-up pb-8">
          
          <button onClick={() => setIsCheckinModalOpen(true)} disabled={!isPremium && !trialData.isActive} className={`p-5 rounded-[2rem] border transition-all duration-300 flex items-center justify-between active:scale-[0.98] ${(!isPremium && !trialData.isActive) ? 'bg-stone-50 border-stone-200 opacity-80 cursor-not-allowed' : 'bg-nutri-900 text-white shadow-md hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-1 hover:border-amber-500/50 border-nutri-800 group'}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${(!isPremium && !trialData.isActive) ? 'bg-stone-200 text-stone-500' : 'bg-white/20 text-white group-hover:bg-white/30 transition-colors'}`}>
                {(!isPremium && !trialData.isActive) ? <Lock size={22} /> : <PlusCircle size={22} />}
              </div>
              <div className="text-left">
                <h3 className="font-bold text-base md:text-lg tracking-tight group-hover:text-amber-300 transition-colors">Check-in e Medidas</h3>
                <p className={`text-xs md:text-sm font-medium mt-0.5 ${(!isPremium && !trialData.isActive) ? 'text-stone-400' : 'text-nutri-200 group-hover:text-amber-100/70 transition-colors'}`}>
                  {(!isPremium && !trialData.isActive) ? 'Acesso bloqueado' : isCheckinDoneThisWeek ? 'Relato enviado (Ver histórico)' : 'Adicione sua evolução semanal'}
                </p>
              </div>
            </div>
            <ChevronRight size={20} className={(!isPremium && !trialData.isActive) ? 'text-stone-300' : 'text-white/50 group-hover:text-amber-400 transition-colors group-hover:translate-x-1'} />
          </button>

          <Link href="/dashboard/meu-plano" className={`p-5 rounded-[2rem] border transition-all duration-300 flex items-center justify-between active:scale-[0.98] hover:-translate-y-1 group ${canAccessMealPlan ? 'bg-white shadow-md border-stone-100 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/20' : 'bg-stone-50 border-stone-200 shadow-sm'}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl transition-colors ${canAccessMealPlan ? 'bg-green-50 text-green-600 group-hover:bg-amber-50 group-hover:text-amber-600' : 'bg-stone-100 text-stone-400'}`}>
                {canAccessMealPlan ? <Utensils size={22} /> : <Lock size={22} />}
              </div>
              <div>
                <h3 className={`font-bold text-base md:text-lg tracking-tight leading-tight transition-colors ${canAccessMealPlan ? 'text-stone-900 group-hover:text-amber-700' : 'text-stone-500'}`}>Plano Alimentar</h3>
                <p className="text-xs md:text-sm text-stone-500 font-medium mt-0.5">{canAccessMealPlan ? (isMealPlanReady ? 'Ver cardápio liberado' : 'Em elaboração pela Nutri') : 'Desbloquear acesso'}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-stone-300 group-hover:translate-x-1 group-hover:text-amber-500 transition-all" />
          </Link>

          {/* 🔥 HOVER DOURADO CORRIGIDO NO TÍTULO DE ALERGIAS */}
          <Link href="/dashboard/completar-perfil" className="p-5 rounded-[2rem] border border-stone-100 transition-all duration-300 flex items-center justify-between active:scale-[0.98] bg-white shadow-md hover:shadow-xl hover:shadow-amber-500/20 hover:border-amber-300 hover:-translate-y-1 group">
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl transition-colors ${foodStatusConfig.bgClass}`}>
                {foodStatusConfig.icon}
              </div>
              <div>
                <h3 className={`font-bold text-base md:text-lg tracking-tight leading-tight transition-colors group-hover:text-amber-600 ${!hasFoodRestrictions ? 'text-stone-900' : 'text-amber-900'}`}>Alergias Alimentares</h3>
                <p className="text-xs md:text-sm text-stone-500 font-medium mt-0.5">
                  {!hasCompletedQFA ? 'Pendência (Preencha agora)' : foodStatusConfig.label}
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-stone-300 group-hover:translate-x-1 group-hover:text-amber-500 transition-all" />
          </Link>

          <Link href="/dashboard/agendamentos" className={`p-5 rounded-[2rem] border transition-all duration-300 flex items-center justify-between active:scale-[0.98] hover:-translate-y-1 group shadow-md hover:shadow-xl hover:shadow-amber-500/20 hover:border-amber-300 ${nextAppointment ? 'bg-nutri-50/30 border-nutri-100' : 'bg-white border-stone-100'}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl transition-colors ${nextAppointment ? 'bg-nutri-100 text-nutri-700' : 'bg-stone-50 text-stone-500 border border-stone-100 group-hover:bg-amber-50 group-hover:text-amber-600 group-hover:border-amber-100'}`}>
                <Calendar size={22} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 group-hover:text-amber-700 transition-colors text-base md:text-lg tracking-tight leading-tight">Agendamentos</h3>
                <p className="text-xs md:text-sm text-stone-500 font-medium mt-0.5">
                  {nextAppointment ? `Retorno: ${new Date(nextAppointment.appointment_date).toLocaleDateString('pt-BR')} às ${nextAppointment.appointment_time}` : 'Marcar nova consulta'}
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-stone-300 group-hover:translate-x-1 group-hover:text-amber-500 transition-all" />
          </Link>
        </div>

      </section>

      {/* MODAL DE CHECK-IN */}
      {isCheckinModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm sm:p-4 animate-fade-in transition-all">
          <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsCheckinModalOpen(false)} className="absolute top-5 right-5 bg-stone-100 text-stone-500 p-2.5 rounded-full z-10 hover:bg-stone-200 transition-colors">
              <X size={18} />
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

      {/* 🔥 MODAL / COMPONENTE DE CHAT FLUTUANTE */}
      <ChatAssistant role="patient" />
    </main>
  );
}