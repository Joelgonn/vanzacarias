'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, TrendingUp, ClipboardList, 
  Activity, Lock, Star, CheckCircle2, Brain, Target 
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { PatientPageShell, PageNavigation, PageContent } from '@/components/layout/PatientPageShell';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceArea 
} from 'recharts';

// --- COMPONENTES AUXILIARES DE UI PREMIUM ---
interface MetricCardProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  subtext?: string;
  icon?: LucideIcon;
}

function MetricCard({ label, value, highlight, subtext, icon: Icon }: MetricCardProps) {
  return (
    <div className="bg-white p-5 md:p-6 rounded-3xl border border-stone-100 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest">{label}</p>
        {Icon && <Icon size={16} className={highlight ? "text-nutri-600" : "text-stone-300"} />}
      </div>
      <div>
        <p className={`text-2xl md:text-3xl font-bold tracking-tight ${highlight ? 'text-nutri-800' : 'text-stone-900'}`}>
          {value}
        </p>
        {subtext && (
          <p className={`text-xs mt-1 font-medium ${subtext.includes('↓') || subtext.includes('↑') ? 'text-nutri-600' : 'text-stone-500'}`}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

interface HistoryCheckin {
  id: string;
  created_at: string;
  peso: number;
  altura: number;
  adesao_ao_plano: number;
  humor_semanal: number;
  imc: number;
  comentarios?: string | null;
}

interface ProfileRow {
  full_name?: string | null;
  tipo_perfil?: string | null;
  meta_peso?: number;
  has_meal_plan_access?: boolean;
}

export default function Historico() {
  const [history, setHistory] = useState<HistoryCheckin[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (profileError) {
        console.error("Erro ao buscar perfil:", profileError);
        setLoading(false);
        return;
      }

      // Mesma regra funcional do Meu Plano: premium OU acesso ao plano alimentar.
      const isUserPremium = profileData?.account_type === 'premium' || profileData?.has_meal_plan_access === true;
      setIsPremium(isUserPremium);
      setProfile(profileData);

      if (isUserPremium) {
        const { data: checkinData } = await supabase
          .from('checkins')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true });

        // IMC usa a altura conhecida mais recente: a altura só é gravada no 1º
        // check-in (os demais vêm com altura NULL) — memso padrão do Dashboard/Admin.
        let knownAltura: number | null = null;
        const processedHistory = checkinData?.map(item => {
          if (item.altura) knownAltura = item.altura;
          return {
            ...item,
            imc: knownAltura ? Number((item.peso / (knownAltura * knownAltura)).toFixed(2)) : 0,
          };
        }) || [];

        setHistory(processedHistory);
      }
      
      setLoading(false);
    }
    fetchData();
  }, [supabase, router]);

  const handleUpgradeClick = async () => {
    setProcessingCheckout(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          email: session.user.email,
          name: profile?.full_name || 'Paciente Vanusa Nutri',
        }),
      });

      const data = await response.json();

      if (data.init_point) {
        window.location.href = data.init_point; 
      } else {
        throw new Error(data.error || 'Erro ao gerar link de pagamento');
      }
    } catch (error) {
      console.error(error);
      alert("Não foi possível iniciar o pagamento. Tente novamente mais tarde.");
      setProcessingCheckout(false);
    }
  };

  const getReferenceRange = (perfil: string) => {
    if (perfil === 'idoso') return { min: 22, max: 27 };
    if (perfil === 'crianca') return { min: 14, max: 19 };
    return { min: 18.5, max: 24.9 }; 
  };

  const range = getReferenceRange(profile?.tipo_perfil || 'adulto');

  // Altura efetiva (última altura conhecida na série) para IMC e meta — altura só
  // é gravada no 1º check-in (demais são NULL), então carregamos adiante.
  const effectiveAltura = history.reduce<number | null>((acc, h) => (h.altura ? h.altura : acc), null);

  // --- CÁLCULOS PREMIUM (INSIGHTS BASEADOS NOS DADOS) ---
  const lastCheckin = history.length > 0 ? history[history.length - 1] : null;
  const prevCheckin = history.length > 1 ? history[history.length - 2] : null;

  // Variável de tendência: delta numérico + seta (sempre, quando houver 2+ pontos)
  let imcDiffStr = '';
  if (lastCheckin && prevCheckin) {
    const diff = lastCheckin.imc - prevCheckin.imc;
    const absDiff = Math.abs(diff).toFixed(1);
    imcDiffStr = diff < -0.1 ? `${absDiff} ↓` : diff > 0.1 ? `+${absDiff} ↑` : 'Estável';
  }

  // Frase interpretativa SOMENTE com >= 3 registros (evolução temporal), sempre neutra.
  // Com poucos dados, a ausência de frase comunica que ainda não há histórico suficiente.
  let trendMsg = '';
  if (lastCheckin && prevCheckin && history.length >= 3) {
    const diff = lastCheckin.imc - prevCheckin.imc;
    const firstImc = history[0].imc;
    const overallDiff = lastCheckin.imc - firstImc;
    if (overallDiff < -0.1) {
      trendMsg = 'Você registrou uma redução de IMC desde o primeiro registro.';
    } else if (overallDiff > 0.1) {
      trendMsg = 'Você registrou um aumento de IMC desde o primeiro registro.';
    } else if (diff < -0.1) {
      trendMsg = 'Sua tendência recente é de leve redução de IMC.';
    } else if (diff > 0.1) {
      trendMsg = 'Sua tendência recente é de leve aumento de IMC.';
    } else {
      trendMsg = 'Seu IMC se manteve estável nos últimos registros.';
    }
  }

  // Rótulos neutros por check-in (Nível C — só thresholds objetivos, sem linguagem clínica)
  const adhesionLabel = (a: number) => (a >= 4 ? 'Alta' : a === 3 ? 'Moderada' : 'Baixa');
  const adhesionTone = (a: number) => (a >= 4 ? 'bg-green-500' : a === 3 ? 'bg-amber-500' : 'bg-stone-400');
  const moodLabel = (h: number) => (h <= 2 ? 'Baixo' : h === 3 ? 'Neutro' : 'Positivo');
  const moodTone = (h: number) => (h >= 4 ? 'bg-green-500' : h === 3 ? 'bg-amber-500' : 'bg-stone-400');

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <PatientPageShell maxWidth="max-w-5xl" className="bg-[#FAFAFA]">
      <PageNavigation>
        <BackButton href="/dashboard" label="Voltar ao Painel" />
        
        <div className="flex flex-col items-end text-right">
          <span className="text-[10px] md:text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Perfil Clínico</span>
          <div className="text-sm md:text-base font-bold text-nutri-900 tracking-tight capitalize bg-nutri-50 px-4 py-2 rounded-full border border-nutri-100/50">
            {profile?.tipo_perfil || 'Adulto'}
          </div>
        </div>
      </PageNavigation>

      <PageContent>
        {!isPremium ? (
          /* =========================================
             PAYWALL QUE CONVERTE (NÍVEL PRODUTO REAL)
             ========================================= */
          <section className="bg-white p-8 md:p-16 lg:p-20 rounded-[2.5rem] shadow-sm border border-stone-100 text-center animate-fade-in flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 hover:shadow-xl">
            
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-nutri-50 to-amber-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 -z-10 opacity-60"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-stone-100 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 -z-10 opacity-50"></div>

            <div className="relative w-20 h-20 md:w-24 md:h-24 bg-gradient-to-tr from-nutri-900 to-nutri-700 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg rotate-3 transform transition-transform hover:rotate-0 duration-300">
              <Lock className="text-white" size={32} strokeWidth={2} />
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-stone-900 mb-4 tracking-tight leading-tight">
              Veja sua evolução real <br className="hidden md:block" /> e não apenas números
            </h1>
            
            <p className="text-stone-500 text-base md:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
              Descubra padrões, progresso e ajustes ideais com gráficos inteligentes, histórico ilimitado e análise automática do seu corpo.
            </p>

            <ul className="text-left space-y-4 mb-10 w-full max-w-sm mx-auto">
              {[
                'Gráfico completo e dinâmico de evolução',
                'Insights automáticos sobre sua saúde',
                'Acompanhamento profissional contínuo',
                'Histórico ilimitado de check-ins e humor'
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-3 text-stone-700 font-medium">
                  <CheckCircle2 className="text-nutri-600 shrink-0" size={20} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={handleUpgradeClick}
              disabled={processingCheckout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-nutri-900 text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-nutri-800 active:scale-[0.98] transition-all duration-300 shadow-xl hover:shadow-nutri-900/30 transform md:hover:-translate-y-1 disabled:opacity-70 group"
            >
              {processingCheckout ? <Loader2 size={24} className="animate-spin" /> : <Star size={24} className="group-hover:rotate-12 transition-transform" />}
              Desbloquear minha evolução
            </button>

            <p className="text-xs text-stone-400 mt-6 font-medium">
              ✨ Usuários Premium têm 3x mais consistência nos resultados
            </p>
          </section>

        ) : (
          /* =========================================
             DASHBOARD PREMIUM
             ========================================= */
          <div className="space-y-8 animate-fade-in-up">
            
            {/* INSIGHT DE TOPO (baseado nos dados) */}
            <div className="mb-2">
              <p className="text-sm text-stone-500 font-medium uppercase tracking-widest mb-2">Seu status atual</p>
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
                {lastCheckin ? 'Veja sua evolução registrada' : 'Registre seu primeiro check-in'}
              </h1>
              {trendMsg ? (
                <p className="text-stone-500 mt-2 max-w-lg text-lg">{trendMsg}</p>
              ) : (
                <p className="text-stone-500 mt-2 max-w-lg text-lg">
                  {history.length > 1
                    ? 'Com mais registros, você terá uma leitura de tendência da sua evolução.'
                    : 'Continue registrando para acompanhar sua evolução ao longo do tempo.'}
                </p>
              )}
            </div>

            {/* CARDS DE MÉTRICAS (GRID PREMIUM) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <MetricCard 
                label="IMC Atual" 
                value={lastCheckin?.imc?.toFixed(1) || '--'} 
                highlight 
                subtext={imcDiffStr ? `Variação: ${imcDiffStr}` : 'Primeiro registro'}
                icon={Target}
              />
              <MetricCard 
                label="Peso Atual" 
                value={lastCheckin ? `${lastCheckin.peso} kg` : '--'} 
                icon={Activity}
              />
              <MetricCard 
                label="Adesão + Humor" 
                value={lastCheckin ? `${lastCheckin.adesao_ao_plano} / ${lastCheckin.humor_semanal}` : '--'}
                highlight
                subtext="Escala 1–5 (adesão · humor)"
                icon={Brain}
              />
              <MetricCard 
                label="Adesão à Plano" 
                value={lastCheckin ? `${lastCheckin.adesao_ao_plano}/5` : '--'} 
                icon={CheckCircle2}
              />
            </div>

            {/* GRÁFICO INTELIGENTE */}
            <section className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-stone-100 overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-3 mb-2">
                    <div className="p-2 bg-nutri-50 rounded-xl text-nutri-800">
                      <TrendingUp size={24} />
                    </div>
                    Curva de Transformação
                  </h2>
                  <p className="text-sm text-stone-500">
                    Sua meta visual: manter a linha dentro da faixa verde ({range.min} a {range.max})
                  </p>
                </div>
              </div>

              <div className="h-72 md:h-96 w-full -ml-4 sm:ml-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                    <XAxis 
                      dataKey="created_at" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} 
                      stroke="#a8a29e"
                      fontSize={12}
                      tickMargin={15}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={['dataMin - 1', 'dataMax + 1']} 
                      stroke="#a8a29e"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                    />
                    <Tooltip 
                      labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} 
                      formatter={(value) => [Number(value).toFixed(1), 'IMC']}
                      contentStyle={{ borderRadius: '24px', border: '1px solid #f5f5f4', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                    />
                    
                    <ReferenceArea y1={range.min} y2={range.max} fill="#2A5C43" fillOpacity={0.04} />
                    
                    <Line 
                      type="monotone" 
                      dataKey="imc" 
                      name="IMC Atual" 
                      stroke="#166534" 
                      strokeWidth={4} 
                      dot={false}
                      activeDot={{ r: 8, fill: '#166534', stroke: '#fff', strokeWidth: 3 }} 
                      animationDuration={1500}
                    />
                    
                    {profile?.meta_peso && history.length > 0 && effectiveAltura && (
                      <Line 
                        type="step" 
                        dataKey={() => (profile.meta_peso! / (effectiveAltura * effectiveAltura))} 
                        name="Sua Meta" 
                        stroke="#d97706" 
                        strokeWidth={2}
                        strokeDasharray="6 6" 
                        dot={false} 
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* HISTÓRICO COM INTERPRETAÇÃO */}
            <section className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-stone-100">
              
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <div className="p-2 bg-stone-50 rounded-xl text-stone-700">
                  <ClipboardList size={24} /> 
                </div>
                Detalhamento dos Check-ins
              </h2>
              
              <div className="space-y-4">
                {history.length > 0 ? (
                  history.slice().reverse().map((item) => (
                    <div 
                      key={item.id} 
                      className="flex flex-col md:grid md:grid-cols-5 gap-4 p-5 md:p-6 border border-stone-100 rounded-3xl bg-stone-50/30 hover:bg-white hover:shadow-md transition-all duration-300 hover:scale-[1.01]"
                    >
                      <div className="flex justify-between items-center md:block border-b border-stone-100 md:border-none pb-4 md:pb-0">
                        <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-1">Data</p>
                        <p className="font-bold text-stone-900 text-sm md:text-base">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6 md:contents">
                        <div>
                          <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-1">Peso</p>
                          <p className="font-semibold text-stone-700 text-sm md:text-base">{item.peso} kg</p>
                        </div>
                        <div>
                          <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-1">IMC</p>
                          <p className="font-bold text-nutri-800 text-sm md:text-base">{item.imc.toFixed(1)}</p>
                        </div>
                        
                        {/* Nova área: Dados objetivos + comentário do check-in */}
                        <div className="col-span-2 md:col-span-2 flex flex-col justify-center">
                          <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-1">Avaliação (neutra)</p>
                          <div className="space-y-1">
                            <p className="text-xs md:text-sm font-medium text-stone-700 flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${adhesionTone(item.adesao_ao_plano)}`}></span>
                              Adesão: {adhesionLabel(item.adesao_ao_plano)} ({item.adesao_ao_plano}/5)
                            </p>
                            <p className="text-xs md:text-sm font-medium text-stone-700 flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${moodTone(item.humor_semanal)}`}></span>
                              Humor: {moodLabel(item.humor_semanal)} ({item.humor_semanal}/5)
                            </p>
                            {item.comentarios && (
                              <p className="text-xs md:text-sm text-stone-500 italic mt-2">“{item.comentarios}”</p>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-16 flex flex-col items-center justify-center text-center bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                    <Activity size={40} className="text-stone-300 mb-4" />
                    <p className="text-stone-600 font-medium text-lg">Nenhum check-in registrado.</p>
                    <p className="text-sm text-stone-400 mt-2">Seus dados de evolução e inteligência de análise aparecerão aqui.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
        </PageContent>
    </PatientPageShell>
  );
}