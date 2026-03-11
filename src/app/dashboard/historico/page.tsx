'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ChevronLeft, TrendingUp, ClipboardList, Activity } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

export default function Historico() {
  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // Busca perfil e histórico de checkins
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      const { data: checkinData } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

      // Calcula IMC para cada registro
      const processedHistory = checkinData?.map(item => ({
        ...item,
        imc: item.peso / (item.altura * item.altura)
      })) || [];

      setProfile(profileData);
      setHistory(processedHistory);
      setLoading(false);
    }
    fetchData();
  }, [supabase, router]);

  // Define as faixas de normalidade baseadas no tipo_perfil
  const getReferenceRange = (perfil: string) => {
    if (perfil === 'idoso') return { min: 22, max: 27 };
    if (perfil === 'crianca') return { min: 14, max: 19 };
    return { min: 18.5, max: 24.9 }; // Padrão adulto
  };

  const range = getReferenceRange(profile?.tipo_perfil);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    // pt-28 no mobile e pt-32 no desktop para garantir respiro abaixo do header fixo
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 pt-[104px] md:pt-32">
      <div className="max-w-4xl mx-auto w-full">
        
        {/* NAVEGAÇÃO DE TOPO PADRONIZADA */}
        <nav className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between mb-8 md:mb-12 gap-6 sm:gap-0 animate-fade-in-up">
          <Link 
            href="/dashboard" 
            className="group w-full sm:w-auto flex items-center justify-center sm:justify-start gap-3 bg-white px-6 py-4 sm:py-3 rounded-2xl sm:rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 active:scale-[0.98] transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1.5 sm:p-1 rounded-xl sm:rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          
          <div className="w-full sm:w-auto text-center sm:text-right flex flex-col sm:items-end">
            <span className="text-[10px] md:text-xs font-bold text-stone-400 uppercase tracking-widest">Perfil Clínico</span>
            <div className="text-sm md:text-base font-bold text-stone-900 tracking-tight capitalize bg-white sm:bg-transparent py-2 rounded-xl border border-stone-100 sm:border-transparent mt-2 sm:mt-0">
              {profile?.tipo_perfil || 'Adulto'}
            </div>
          </div>
        </nav>

        {/* GRÁFICO */}
        <section className="bg-white p-5 md:p-8 lg:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 mb-8 md:mb-10 animate-fade-in-up w-full overflow-hidden" style={{ animationDelay: '0.1s' }}>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 border-b border-stone-100 pb-5 gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-stone-900 flex items-center gap-2 mb-1">
                <TrendingUp className="text-nutri-800" size={24} /> 
                Evolução do IMC
              </h2>
              <p className="text-xs md:text-sm text-stone-500">Faixa de normalidade em verde ({range.min} a {range.max})</p>
            </div>
          </div>

          <div className="h-64 md:h-80 w-full -ml-3 sm:ml-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                <XAxis 
                  dataKey="created_at" 
                  tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} 
                  stroke="#a8a29e"
                  fontSize={11}
                  tickMargin={10}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  domain={['dataMin - 1', 'dataMax + 1']} 
                  stroke="#a8a29e"
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} 
                  formatter={(value: any) => [Number(value).toFixed(1), 'IMC']}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                
                {/* Faixa de Normalidade (Verde de fundo) */}
                <ReferenceArea y1={range.min} y2={range.max} fill="#2A5C43" fillOpacity={0.05} />
                
                {/* Linha do IMC Atual do paciente */}
                <Line 
                  type="monotone" 
                  dataKey="imc" 
                  name="IMC Atual" 
                  stroke="#166534" 
                  strokeWidth={4} 
                  dot={{ r: 5, fill: '#166534', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }} 
                  animationDuration={1500}
                />
                
                {/* Linha da Meta (Se existir no perfil) */}
                {profile?.meta_peso && history.length > 0 && (
                  <Line 
                    type="step" 
                    dataKey={() => (profile.meta_peso / (history[0].altura * history[0].altura))} 
                    name="Meta de IMC" 
                    stroke="#e11d48" 
                    strokeWidth={2}
                    strokeDasharray="5 5" 
                    dot={false} 
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* LISTA DE REGISTROS */}
        <section className="bg-white p-5 md:p-8 lg:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          
          <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2 border-b border-stone-100 pb-5">
            <ClipboardList className="text-nutri-800" size={24} /> 
            Histórico de Check-ins
          </h2>
          
          <div className="space-y-4">
            {history.length > 0 ? (
              history.slice().reverse().map((item) => (
                <div 
                  key={item.id} 
                  className="flex flex-col md:grid md:grid-cols-5 gap-3 md:gap-4 p-5 md:p-4 border border-stone-100 rounded-2xl bg-stone-50/50 hover:bg-white hover:shadow-md transition-all duration-300"
                >
                  {/* Cabeçalho do Card no Mobile */}
                  <div className="flex justify-between items-center md:block border-b border-stone-100 md:border-none pb-3 md:pb-0 mb-2 md:mb-0">
                    <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest">Data</p>
                    <p className="font-bold md:font-semibold text-stone-800 text-sm md:text-base">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  
                  {/* Grid de Dados Interno no Mobile */}
                  <div className="grid grid-cols-2 gap-4 md:contents">
                    <div>
                      <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-1 md:mb-0">Peso</p>
                      <p className="font-semibold text-stone-700 text-sm md:text-base">{item.peso} kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-1 md:mb-0">IMC</p>
                      <p className="font-bold text-nutri-800 text-sm md:text-base">{item.imc.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-1 md:mb-0">Adesão</p>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <p className="font-semibold text-stone-700 text-sm md:text-base">{item.adesao_ao_plano}/5</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-1 md:mb-0">Humor</p>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <p className="font-semibold text-stone-700 text-sm md:text-base">{item.humor_semanal}/5</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <Activity size={32} className="text-stone-300 mb-3" />
                <p className="text-stone-500 font-medium">Nenhum check-in registrado.</p>
                <p className="text-xs text-stone-400 mt-1">Seus dados de evolução aparecerão aqui.</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}