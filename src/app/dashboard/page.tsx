'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import confetti from 'canvas-confetti';
import { 
  Loader2, X, AlertCircle, Star, Zap, ClipboardCheck, ShieldAlert, ShieldCheck,
  Trophy, Target, HeartPulse,
} from 'lucide-react';
import Link from 'next/link';
import CheckinForm from '@/components/CheckinForm';
import ChatAssistant from '@/components/ChatAssistant';
import AddActivityModal from '@/components/AddActivityModal';
import DashboardHero from '@/components/dashboard/DashboardHero';
import DailyJourney from '@/components/dashboard/DailyJourney';
import FocusTodayCard from '@/components/dashboard/FocusTodayCard';
import RecoveryTodayCard from '@/components/dashboard/RecoveryTodayCard';
import PremiumAccessCard from '@/components/dashboard/PremiumAccessCard';
import ProgressChart from '@/components/dashboard/ProgressChart';
import NextBestAction from '@/components/dashboard/NextBestAction';
import { getTotalActivityKcal } from '@/lib/activities';
import type { Activity } from '@/lib/activities';
import * as checkinLib from '@/lib/checkin';
import { getFocus } from '@/lib/vz015/focusEngine';
import { getRecovery } from '@/lib/vz015/recoveryEngine';
import type { FocusInput } from '@/lib/vz015/types';
import { toast } from 'sonner';

// =========================================================================
// 🔥 FUNÇÃO DE CÁLCULO DE COMPOSIÇÃO CORPORAL
// (Jackson & Pollock — centralizada em src/lib/nutrition/bodyComposition.ts)
// O dashboard usa a lib para evitar duplicação de motor com o admin.
// =========================================================================

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

const DAY_MS = 1000 * 60 * 60 * 24;

const getDaysSince = (dateString?: string | null) => {
  if (!dateString) return null;
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.floor(diff / DAY_MS));
};

// =========================================================================
// TIPOS DAS LINHAS DO SUPABASE USADAS NO DASHBOARD
// =========================================================================
interface ProfileRow {
  id?: string;
  full_name?: string | null;
  meta_peso?: string | null;
  account_type?: string | null;
  trial_ends_at?: string | null;
  created_at: string;
  has_meal_plan_access?: boolean | null;
  meal_plan?: Array<{ name: string }> | null;
  food_restrictions?: string[] | null;
  data_nascimento?: string | null;
  sexo?: string | null;
  role?: string | null;
}

interface CheckinRow {
  id: string;
  created_at: string;
  peso: string;
  altura: string;
  cintura: string;
  adesao_ao_plano: number;
  humor_semanal?: number | null;
}

interface AntroRow {
  weight: string;
  measurement_date: string;
  waist?: string;
}

interface SkinfoldRow {
  measurement_date: string;
  triceps?: string;
  biceps?: string;
  subscapular?: string;
  suprailiac?: string;
  abdominal?: string;
  thigh?: string;
  calf?: string;
}

interface BioRow {
  exam_date: string;
  glucose?: string;
  insulin?: string;
}

interface AppointmentRow {
  appointment_date: string;
  appointment_time: string;
}

export default function Dashboard() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [, setEvaluation] = useState<unknown>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [antroData, setAntroData] = useState<AntroRow[]>([]);
  const [skinfoldsData, setSkinfoldsData] = useState<SkinfoldRow[]>([]);
  const [bioData, setBioData] = useState<BioRow[]>([]);
  const [nextAppointment] = useState<AppointmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [hasCompletedQFA, setHasCompletedQFA] = useState<boolean>(true);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [hasDailyLogToday, setHasDailyLogToday] = useState(false);

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
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const userId = session.user.id;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, status, meta_peso, account_type, trial_ends_at, created_at, has_meal_plan_access, meal_plan, food_restrictions, data_nascimento, sexo, role')
        .eq('id', userId)
        .single();

      // Admin/nutricionista vai direto para o painel profissional
      if (profileData?.role === 'admin' || profileData?.role === 'nutricionista') {
        router.push('/admin/dashboard');
        return;
      }

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
        setHasDailyLogToday(true);
      } else {
        setDailyLog({
          water_ml: 0,
          meals_checked: [],
          mood: null,
          activities: [],
          activity_kcal: 0
        });
        setHasDailyLogToday(false);
      }

      setProfile(profileData);
      setEvaluation(evalData?.answers || null);
      setHasCompletedQFA(!!qfaData); 
      setCheckins(checkinData || []);
      setAntroData(antro || []);
      setSkinfoldsData(skin || []);
      setBioData(bio || []);

      checkPushSubscription();
    } catch (error) {
      console.error('Erro ao carregar dados do painel:', error);
      setLoadError('Não foi possível carregar seus dados. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
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

  const isMealPlanReady = !!profile?.meal_plan && Array.isArray(profile.meal_plan) && profile.meal_plan.length > 0;
  const mealNames = isMealPlanReady ? (profile?.meal_plan ?? []).map((meal) => meal.name) : [];
  
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

    // Fase A: verifica erro no upsert — antes falhava silenciosamente
    try {
      const { error } = await supabase
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

      if (error) {
        console.error('Erro ao salvar diário:', error);
        toast.error('Não foi possível salvar seu diário. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao salvar diário:', error);
      toast.error('Não foi possível salvar seu diário. Tente novamente.');
    }
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
    } catch {
      toast.error("Erro ao iniciar pagamento.");
      setProcessingCheckout(false);
    }
  };

  const isCheckinDoneThisWeek = useMemo(() => checkinLib.isCheckinDoneThisWeek(checkins), [checkins]);

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

  const isPremium = profile?.account_type === 'premium';
  const canAccessMealPlan = isPremium || profile?.has_meal_plan_access;
  const hasActualWeightSource = checkins.length > 0 || antroData.length > 0;

  const focusInput = useMemo<FocusInput>(() => {
    const lastCheckin = checkins.length > 0 ? checkins[checkins.length - 1] : null;
    const currentWeight = checkins.length > 0
      ? parseFloat(checkins[checkins.length - 1].peso)
      : antroData.length > 0
        ? parseFloat(antroData[0].weight)
        : null;

    return {
      dailyLog: {
        date: getLocalTodayString(),
        water_ml: dailyLog.water_ml,
        meals_checked: dailyLog.meals_checked,
        mood: dailyLog.mood as 'feliz' | 'neutro' | 'dificil' | null,
        activities: dailyLog.activities?.map((activity) => ({
          id: activity.id,
          name: `${activity.type} (${activity.intensity})`,
        })) || [],
        activity_kcal: dailyLog.activity_kcal,
      },
      checkin: lastCheckin ? {
        lastCheckinAt: lastCheckin.created_at,
        daysSinceLastCheckin: getDaysSince(lastCheckin.created_at),
        adesao_ao_plano: lastCheckin.adesao_ao_plano ?? null,
        humor_semanal: lastCheckin.humor_semanal ?? null,
      } : null,
      jornada: {
        isCheckinDoneThisWeek,
        hasMealPlan: isMealPlanReady,
        canAccessMealPlan: !!canAccessMealPlan,
      },
      meta: {
        meta_peso: profile?.meta_peso ? parseFloat(profile.meta_peso) : null,
        currentWeight,
        totalRecords: checkins.length,
      },
      access: {
        canAccessMealPlan: !!canAccessMealPlan,
      },
      totalMeals: totalMeals > 0 ? totalMeals : null,
      waterGoal: hasActualWeightSource ? waterGoal : null,
      latestWeightForWater: hasActualWeightSource ? latestWeightForWater : null,
    };
  }, [
    canAccessMealPlan,
    checkins,
    antroData,
    dailyLog.activities,
    dailyLog.activity_kcal,
    dailyLog.meals_checked,
    dailyLog.mood,
    dailyLog.water_ml,
    hasActualWeightSource,
    isCheckinDoneThisWeek,
    isMealPlanReady,
    latestWeightForWater,
    profile?.meta_peso,
    totalMeals,
    waterGoal,
  ]);

  const focusResult = useMemo(() => getFocus(focusInput), [focusInput]);
  const recoveryInput = useMemo<FocusInput>(() => ({
    ...focusInput,
    dailyLog: hasDailyLogToday ? focusInput.dailyLog : null,
  }), [focusInput, hasDailyLogToday]);
  const recoveryResult = useMemo(() => getRecovery(recoveryInput), [recoveryInput]);

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
        const s1 = parseFloat(skin.triceps || "0") + parseFloat(skin.biceps || "0") + parseFloat(skin.subscapular || "0") + parseFloat(skin.suprailiac || "0") + parseFloat(skin.abdominal || "0") + parseFloat(skin.thigh || "0") + parseFloat(skin.calf || "0");
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
        adesao: checkin?.adesao_ao_plano ?? null,
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

  const smartFeedback = useMemo(() => {
    if (checkins.length === 0) return null;
    const last = checkins[checkins.length - 1];

    // Adesão alta + progresso de peso positivo → sucesso
    if (last.adesao_ao_plano >= 4 && deltas.currentWeight !== null && deltas.initialWeight !== null && deltas.currentWeight < deltas.initialWeight) {
      return { type: 'success', title: 'Resultados chegando!', text: 'Sua adesão está alta e o peso está respondendo. Continue exatamente assim.', icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50/50', border: 'border-amber-200/50' };
    }

    // Adesão alta, mas sem movimento de peso → platô
    if (last.adesao_ao_plano >= 4) {
      return { type: 'success', title: 'Excelente foco!', text: 'Sua adesão ao plano foi ótima no último relato. A consistência vai trazer os resultados.', icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50/50', border: 'border-amber-200/50' };
    }

    // Adesão média → atenção
    if (last.adesao_ao_plano >= 2) {
      return { type: 'attention', title: 'Bom caminho, pode melhorar', text: 'Sua adesão foi razoável. Tente manter a rotina de refeições e hidratação nesta semana.', icon: Target, color: 'text-blue-500', bg: 'bg-blue-50/50', border: 'border-blue-200/50' };
    }

    // Adesão baixa → apoio
    return { type: 'support', title: 'Não desanime!', text: 'Semana difícil? Faz parte do processo. O importante é retomar o foco na próxima refeição.', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-50/50', border: 'border-rose-200/50' };
  }, [checkins, deltas]);

  const isGoalMet = !!(profile?.meta_peso && deltas.currentWeight && deltas.currentWeight <= parseFloat(profile.meta_peso));

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

  // VZ-017: insight sem score agregado — usa dados objetivos
  const smartInsight = useMemo(() => {
    if (!deltas.currentWeight || !deltas.initialWeight) return "Faça seu primeiro relato para destravar insights automáticos do seu corpo.";
    
    if (deltas.currentWeight < deltas.initialWeight) {
      if (dailyLog.mood === 'dificil') return "Seu humor caiu — isso pode impactar sua consistência logo mais. Ajuste leve recomendado.";
      if (waterProgress >= 80 && mealProgress >= 80) return "Você está evoluindo de forma consistente — excelente trabalho!";
      return "Sua evolução está em andamento. Consistência é o segredo agora.";
    }

    if (waterProgress < 50 && mealProgress < 50) return "Seu progresso deu uma pausada e a adesão diária está baixa. Retome o foco hoje com hidratação e metas simples.";
    return "Seu progresso está estável. Pequenos ajustes podem acelerar seus resultados.";
  }, [deltas, dailyLog.mood, waterProgress, mealProgress]);

  const foodRestrictions = profile?.food_restrictions || [];
  const hasFoodRestrictions = foodRestrictions.length > 0;
  const foodStatusConfig = hasFoodRestrictions 
    ? { icon: <ShieldAlert size={20} strokeWidth={2.5} />, bgClass: 'bg-amber-50 text-amber-600', textClass: 'text-amber-900', label: `${foodRestrictions.length} restrições cadastradas`, desc: 'Ativo e monitorado' }
    : { icon: <ShieldCheck size={20} strokeWidth={2.5} />, bgClass: 'bg-emerald-50 text-emerald-600', textClass: 'text-stone-900', label: 'Sem restrições', desc: 'Perfil atualizado' };

  const validWeightsCount = timelineData.filter(d => d.peso !== null).length;
  const validWaistsCount = timelineData.filter(d => d.cintura !== null).length;

  // VZ-019: revalidação determinística pós-checkout — sem confiar em ?payment=success
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (search.includes('payment=success')) {
      toast.success('Pagamento recebido! Seu acesso Premium será liberado em breve.');
      window.history.replaceState({}, '', '/dashboard');
      // Polling curto e limitado: verifica profiles a cada 2s, max 5 tentativas (10s)
      let attempts = 0;
      const maxAttempts = 5;
      const poll = async () => {
        attempts++;
        try {
          const supabasePoll = createClient();
          const { data: { session } } = await supabasePoll.auth.getSession();
          const uid = session?.user?.id;
          if (!uid) return;
          const { data: prof } = await supabasePoll
            .from('profiles')
            .select('account_type, has_meal_plan_access')
            .eq('id', uid)
            .single();
          const isPrem = prof?.account_type === 'premium' || !!prof?.has_meal_plan_access;
          if (isPrem) {
            toast.success('Premium ativado!');
            await loadData();
            return;
          }
        } catch {}
        if (attempts < maxAttempts) setTimeout(poll, 2000);
      };
      setTimeout(poll, 1500);
    } else if (search.includes('payment=failure')) {
      toast.error('Pagamento não concluído.');
      window.history.replaceState({}, '', '/dashboard');
    } else if (search.includes('payment=pending')) {
      toast('Pagamento pendente — avisaremos quando confirmar.');
      window.history.replaceState({}, '', '/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-nutri-800" size={40} strokeWidth={2.5} />
        <p className="text-stone-400 font-medium text-sm animate-pulse">Preparando seu painel...</p>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-6">
      <div className="bg-white rounded-3xl border border-stone-100 shadow-md p-8 max-w-md w-full text-center flex flex-col items-center gap-4">
        <AlertCircle size={40} className="text-rose-500" />
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Não foi possível carregar</h2>
          <p className="text-sm text-stone-500 font-medium mt-1">{loadError}</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:bg-stone-800 hover:shadow-md active:scale-[0.98]"
        >
          <Loader2 size={14} className={loading ? 'animate-spin' : ''} /> Tentar novamente
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex font-sans text-stone-800 pt-[72px] md:pt-20 pb-24 md:pb-0 selection:bg-nutri-200 selection:text-nutri-900">

      {/* ÁREA PRINCIPAL DO DASHBOARD */}
      {/* VZ-007.1: a Sidebar deixou de ser montada aqui — agora pertence à
          moldura única (PatientAppShell) fornecida pelo NavigationWrapper. */}
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
                  <p className="text-base md:text-lg font-bold tracking-tight leading-tight">Avaliação Pendente</p>
                  <p className="text-rose-100/90 text-xs md:text-sm mt-0.5 line-clamp-1 md:line-clamp-none">Preencha seu Raio-X alimentar. Assim a Nutri Vanusa poderá criar um plano personalizado para você.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href="/paciente/avaliacao" className="bg-white text-rose-600 px-4 min-h-[44px] inline-flex items-center justify-center py-2 rounded-lg font-bold text-xs hover:bg-stone-50 transition-all shadow-sm">Avaliação</Link>
                  <Link href="/dashboard/completar-perfil" className={`px-4 min-h-[44px] inline-flex items-center justify-center py-2 rounded-lg font-bold text-xs transition-all shadow-sm ${hasFoodRestrictions ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'bg-yellow-500 text-white hover:bg-yellow-400'}`}>Perfil Alimentar</Link>
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

        {/* 1-3. MOMENTO ATUAL (Hero + Super Cards + Insights) */}
        <DashboardHero
          isGoalMet={isGoalMet}
          weightProgressPercent={weightProgressPercent}
          currentStreak={currentStreak}
          projection={projection}
          deltas={deltas}
          metaPeso={profile?.meta_peso}
          smartInsight={smartInsight}
          smartFeedback={smartFeedback}
        />

        {/* 4. DIÁRIO (MEU DIA) — VZ-017: ScoreRing removido, dados objetivos */}
        {canAccessMealPlan && (
          <DailyJourney
            dailyLog={dailyLog}
            waterGoal={waterGoal}
            waterProgress={waterProgress}
            isWaterGoalMet={isWaterGoalMet}
            mealNames={mealNames}
            totalMeals={totalMeals}
            completedMeals={completedMeals}
            mealProgress={mealProgress}
            isMealGoalMet={isMealGoalMet}
            isMealPlanReady={isMealPlanReady}
            latestWeightForWater={latestWeightForWater}
            isPushSubscribed={isPushSubscribed}
            isSubscribingPush={isSubscribingPush}
            handleAddWater={handleAddWater}
            handleToggleMeal={handleToggleMeal}
            handleUpdateDailyLog={handleUpdateDailyLog}
            handleRemoveActivity={handleRemoveActivity}
            onOpenActivityModal={() => setIsActivityModalOpen(true)}
            subscribeToPush={subscribeToPush}
          />
        )}

        <FocusTodayCard
          result={focusResult}
          onCheckin={() => setIsCheckinModalOpen(true)}
          onMeals={() => router.push('/dashboard/meu-plano')}
          onHydration={handleAddWater}
          onAdherence={() => setIsCheckinModalOpen(true)}
        />

        <RecoveryTodayCard
          result={recoveryResult}
          onCheckin={() => setIsCheckinModalOpen(true)}
          onDailyLog={() => router.push('/dashboard/meu-plano')}
          onAdherence={() => setIsCheckinModalOpen(true)}
        />

        {/* VZ-018: Acesso comercial */}
        <PremiumAccessCard isPremium={!!isPremium} dailyLimit={isPremium ? 80 : 25} />

        {/* 5. GRÁFICO E EVOLUÇÃO (Medidas livre; Dobras/Metabolismo premium) */}
        <ProgressChart
          timelineData={timelineData}
          activeLens={activeLens}
          setActiveLens={setActiveLens}
          isPremium={isPremium}
          trialActive={trialData.isActive}
          processingCheckout={processingCheckout}
          handleUpgradeClick={handleUpgradeClick}
          isGoalMet={isGoalMet}
          metaPeso={profile?.meta_peso}
          validWeightsCount={validWeightsCount}
          validWaistsCount={validWaistsCount}
          weightProgressPercent={weightProgressPercent}
        />

        {/* 6. AÇÕES INFERIORES (PRÓXIMO PASSO) */}
        <NextBestAction
          isPremium={isPremium}
          trialActive={trialData.isActive}
          isCheckinDoneThisWeek={isCheckinDoneThisWeek}
          canAccessMealPlan={canAccessMealPlan}
          isMealPlanReady={isMealPlanReady}
          hasCompletedQFA={hasCompletedQFA}
          hasFoodRestrictions={hasFoodRestrictions}
          foodStatusConfig={foodStatusConfig}
          nextAppointment={nextAppointment}
          onOpenCheckin={() => setIsCheckinModalOpen(true)}
        />


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

      {/* CHAT-SUG-002 — chat flutuante: smartContext alimenta o catálogo
          determinístico de sugestões (sem nova query, sem PII no backend) */}
      <ChatAssistant
        role="patient"
        canAccessMealPlan={!!canAccessMealPlan}
        smartContext={{
          isPremium: !!isPremium,
          canAccessMealPlan: !!canAccessMealPlan,
          isMealPlanReady,
          isCheckinDoneThisWeek,
          waterGoal,
          waterProgress,
          hasDailyLogToday,
          totalMeals,
          completedMeals,
          checkinsCount: checkins.length,
          hasCompletedQFA,
        }}
      />
    </div>
  );
}
