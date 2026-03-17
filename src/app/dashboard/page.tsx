'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, CheckCircle2, TrendingDown, PlusCircle, X,
  Flame, Trophy, AlertCircle, Ruler, ArrowRight, HeartPulse, 
  Lock, Star, Zap, Utensils, ClipboardCheck, Droplets, Check,
  Smile, Frown, Meh, BellRing
} from 'lucide-react';
import Link from 'next/link';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import CheckinForm from '@/components/CheckinForm';

// Função auxiliar para converter a chave VAPID base64
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
  const [loading, setLoading] = useState(true);
  
  const [hasCompletedQFA, setHasCompletedQFA] = useState<boolean>(true);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);

  // NOVO: Controle de Notificações
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(true); // Começa true para não piscar
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);

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

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, status, meta_peso, account_type, trial_ends_at, created_at, has_meal_plan_access, meal_plan')
      .eq('id', session.user.id)
      .single();

    const { data: evalData } = await supabase
      .from('evaluations')
      .select('answers')
      .eq('user_id', session.user.id)
      .single();

    const { data: qfaData } = await supabase
      .from('qfa_responses')
      .select('id')
      .eq('user_id', session.user.id)
      .single();

    const { data: checkinData } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    const { data: antro } = await supabase
      .from('anthropometry')
      .select('*')
      .eq('user_id', session.user.id)
      .order('measurement_date', { ascending: false });

    const todayStr = getTodayString();
    const { data: dailyData } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', todayStr)
      .single();

    if (dailyData) {
      setDailyLog({
        water_ml: dailyData.water_ml || 0,
        meals_checked: dailyData.meals_checked || [],
        mood: dailyData.mood || null
      });
    }

    setProfile(profileData);
    setEvaluation(evalData?.answers || null);
    setHasCompletedQFA(!!qfaData); 
    setCheckins(checkinData || []);
    setAntroData(antro || []);
    
    // NOVO: Verifica se o dispositivo atual já permite notificações
    checkPushSubscription();

    setLoading(false);
  }

  useEffect(() => { loadData(); }, [router, supabase]);

  // NOVO: Funções de Notificação
  const checkPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsPushSubscribed(true); // Se não suporta, esconde o botão
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setIsPushSubscribed(!!subscription);
  };

  const subscribeToPush = async () => {
    setIsSubscribingPush(true);
    try {
      if (Notification.permission === 'denied') {
        alert('Você bloqueou as notificações. Libere nas configurações do seu navegador/celular.');
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
    handleUpdateDailyLog({ water_ml: dailyLog.water_ml + 250 });
  };

  const handleToggleMeal = (mealName: string) => {
    const current = dailyLog.meals_checked;
    const isChecked = current.includes(mealName);
    const newMeals = isChecked 
      ? current.filter(m => m !== mealName) 
      : [...current, mealName];
    
    handleUpdateDailyLog({ meals_checked: newMeals });
  };

  const handleCheckinSuccess = () => {
    setIsCheckinModalOpen(false);
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
  
  const isMealPlanReady = profile?.meal_plan && Array.isArray(profile.meal_plan) && profile.meal_plan.length > 0;
  const mealNames = isMealPlanReady ? profile.meal_plan.map((meal: any) => meal.name) : [];

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 flex font-sans text-stone-800 pt-[72px] md:pt-20">
      
      {/* SIDEBAR */}
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

      <section className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto w-full">
        
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
            <Link href="/paciente/avaliacao" className="w-full md:w-auto bg-white text-rose-600 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-100 transition-all text-center">
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
              <div className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-50 text-green-700 px-6 py-4 rounded-2xl font-bold border border-green-100"><CheckCircle2 size={20} /> Relato Semanal Feito!</div>
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
              
              <div className="md:col-span-2 bg-stone-50 p-6 rounded-3xl border border-stone-100">
                <h4 className="text-xs font-black uppercase text-stone-400 tracking-widest mb-4 flex items-center gap-2">
                  <Utensils size={14} /> Refeições
                </h4>
                {isMealPlanReady ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mealNames.map((mealName: string, i: number) => {
                      const isChecked = dailyLog.meals_checked.includes(mealName);
                      return (
                        <button 
                          key={i}
                          onClick={() => handleToggleMeal(mealName)}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                            isChecked 
                              ? 'bg-nutri-50 border-nutri-200 text-nutri-900 shadow-sm' 
                              : 'bg-white border-stone-200 text-stone-600 hover:border-nutri-200 hover:bg-white'
                          }`}
                        >
                          <span className={`text-sm font-bold ${isChecked ? 'line-through opacity-70' : ''}`}>{mealName}</span>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                            isChecked ? 'bg-nutri-600 border-nutri-600 text-white' : 'bg-stone-50 border-stone-300'
                          }`}>
                            {isChecked && <Check size={14} strokeWidth={3} />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-stone-500 italic bg-white p-4 rounded-2xl border border-stone-200 text-center">
                    Seu cardápio ainda está sendo elaborado.
                  </p>
                )}
              </div>

              <div className="space-y-6">
                
                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex flex-col items-center justify-center relative overflow-hidden group">
                  <h4 className="text-xs font-black uppercase text-blue-400 tracking-widest mb-3 z-10 w-full text-center">Água Consumida</h4>
                  <div className="flex items-baseline gap-1 mb-4 z-10">
                    <span className="text-3xl font-black text-blue-900">{dailyLog.water_ml}</span>
                    <span className="text-sm font-bold text-blue-600">ml</span>
                  </div>
                  <button 
                    onClick={handleAddWater}
                    className="bg-white border-2 border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm z-10 active:scale-95"
                  >
                    <Droplets size={16} fill="currentColor" className={dailyLog.water_ml > 0 ? "text-blue-400 group-hover:text-white" : ""} /> + 250ml
                  </button>

                  {/* NOVO: Botão de Ativar Lembretes (Push Notifications) */}
                  {!isPushSubscribed && (
                    <button 
                      onClick={subscribeToPush}
                      disabled={isSubscribingPush}
                      className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg z-10 hover:bg-blue-200 transition-colors"
                    >
                      {isSubscribingPush ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />}
                      Ativar Lembretes
                    </button>
                  )}

                  <Droplets size={120} className="absolute -bottom-6 -right-6 text-blue-500 opacity-5 rotate-12" />
                </div>

                <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                  <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-3 text-center">Como foi o dia?</h4>
                  <div className="flex justify-center gap-3">
                    <button 
                      onClick={() => handleUpdateDailyLog({ mood: 'feliz' })}
                      className={`p-3 rounded-full transition-all border-2 ${dailyLog.mood === 'feliz' ? 'bg-green-100 border-green-500 text-green-600 scale-110 shadow-sm' : 'bg-white border-transparent text-stone-400 hover:bg-stone-100'}`}
                    >
                      <Smile size={28} />
                    </button>
                    <button 
                      onClick={() => handleUpdateDailyLog({ mood: 'neutro' })}
                      className={`p-3 rounded-full transition-all border-2 ${dailyLog.mood === 'neutro' ? 'bg-amber-100 border-amber-500 text-amber-600 scale-110 shadow-sm' : 'bg-white border-transparent text-stone-400 hover:bg-stone-100'}`}
                    >
                      <Meh size={28} />
                    </button>
                    <button 
                      onClick={() => handleUpdateDailyLog({ mood: 'dificil' })}
                      className={`p-3 rounded-full transition-all border-2 ${dailyLog.mood === 'dificil' ? 'bg-rose-100 border-rose-500 text-rose-600 scale-110 shadow-sm' : 'bg-white border-transparent text-stone-400 hover:bg-stone-100'}`}
                    >
                      <Frown size={28} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

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

        <div className="mb-10 bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-stone-100 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 border-b border-stone-50 pb-6 gap-6">
            <div><h3 className="text-xl md:text-2xl font-bold text-stone-900 flex items-center gap-3"><TrendingDown className="text-nutri-800" size={24} /> Minha Balança</h3></div>
            {profile?.meta_peso && <div className="text-left sm:text-right bg-stone-50 px-5 py-3 rounded-2xl border border-stone-100"><span className="text-[10px] font-bold uppercase text-stone-400 tracking-[0.2em]">Meta</span><p className="text-2xl font-black text-nutri-900 tracking-tighter">{profile.meta_peso} kg</p></div>}
          </div>
          <div className="h-64 w-full">
            {checkins.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={checkins} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                  <XAxis dataKey="created_at" tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} stroke="#d6d3d1" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#d6d3d1" fontSize={11} tickFormatter={(val) => `${val}kg`} axisLine={false} tickLine={false} />
                  <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} formatter={(value) => [`${value} kg`, 'Peso']} />
                  <Line type="monotone" dataKey="peso" stroke="#166534" strokeWidth={4} dot={{ r: 5, fill: '#166534', strokeWidth: 2, stroke: '#fff' }} animationDuration={1500} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex flex-col items-center justify-center text-stone-200"><TrendingDown size={40} /><p className="text-stone-500 mt-4">Aguardando check-ins.</p></div>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
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

          <Link href="/paciente/avaliacao" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:border-nutri-200 transition-all group">
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Minha Rotina</h4>
            <h3 className="font-bold text-stone-900 text-lg mb-4">Raio-X Alimentar</h3>
            <p className="text-sm text-nutri-800 font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
              {hasCompletedQFA ? 'Ver minhas respostas' : 'Preencher agora'} <ArrowRight size={14} />
            </p>
          </Link>

          <Link href="/dashboard/agendamentos" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100 hover:border-nutri-200 transition-all group">
            <h4 className="font-black text-stone-400 uppercase text-[10px] tracking-[0.2em] mb-3">Consultas</h4>
            <h3 className="font-bold text-stone-900 text-lg mb-4">Agendamento</h3>
            <p className="text-sm text-nutri-800 font-bold flex items-center gap-1 group-hover:gap-2 transition-all">Ver horários <ArrowRight size={14} /></p>
          </Link>
        </div>

      </section>

      {isCheckinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm sm:p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-white sm:bg-transparent rounded-t-[2.5rem] sm:rounded-none">
            <button onClick={() => setIsCheckinModalOpen(false)} className="absolute top-4 right-4 sm:-top-4 sm:-right-4 md:-right-12 bg-stone-100 sm:bg-white text-stone-500 p-2.5 rounded-full z-10">
              <X size={20} />
            </button>
            <CheckinForm onSuccess={handleCheckinSuccess} onFormChange={() => {}} />
          </div>
        </div>
      )}
    </main>
  );
}