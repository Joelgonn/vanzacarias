'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ChevronLeft, TrendingUp, ClipboardList } from 'lucide-react';
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
    return { min: 18.5, max: 24.9 }; // Padrão adulto
  };

  const range = getReferenceRange(profile?.tipo_perfil);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-nutri-800" size={48} /></div>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-8 md:p-12 font-sans text-stone-800 pt-28">
      <div className="max-w-4xl mx-auto">
        
        {/* NAVEGAÇÃO PADRÃO */}
        <nav className="flex items-center justify-between mb-16">
          <Link href="/dashboard" className="group flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all">
            <div className="bg-nutri-50 p-1 rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600">Voltar ao Painel</span>
          </Link>
          <div className="text-sm font-bold text-stone-900 tracking-tight uppercase">Perfil: {profile?.tipo_perfil}</div>
        </nav>

        {/* GRÁFICO */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 mb-10">
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
            <TrendingUp className="text-nutri-800" /> Evolução do IMC ({profile?.tipo_perfil})
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="created_at" tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} />
                <YAxis domain={[15, 35]} />
                <Tooltip />
                
                {/* Faixa de Normalidade (Verde de fundo) */}
                <ReferenceArea y1={range.min} y2={range.max} fill="green" fillOpacity={0.05} />
                
                {/* Linha do IMC Atual do paciente */}
                <Line type="monotone" dataKey="imc" name="IMC Atual" stroke="#166534" strokeWidth={3} dot={{ r: 6 }} />
                
                {/* Linha da Meta (Se existir no perfil) */}
                {profile?.meta_peso && (
                  <Line 
                    type="step" 
                    dataKey={() => (profile.meta_peso / (history[0]?.altura ** 2))} 
                    name="Meta de IMC" 
                    stroke="#e11d48" 
                    strokeDasharray="5 5" 
                    dot={false} 
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* LISTA DE REGISTROS */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <ClipboardList className="text-nutri-800" /> Histórico de Check-ins
          </h2>
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border border-stone-100 rounded-xl bg-stone-50">
                <div><p className="text-xs text-stone-400">Data</p><p className="font-semibold">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p></div>
                <div><p className="text-xs text-stone-400">Peso</p><p className="font-semibold">{item.peso}kg</p></div>
                <div><p className="text-xs text-stone-400">IMC</p><p className="font-semibold">{item.imc.toFixed(1)}</p></div>
                <div><p className="text-xs text-stone-400">Adesão</p><p className="font-semibold">{item.adesao_ao_plano}/5</p></div>
                <div><p className="text-xs text-stone-400">Humor</p><p className="font-semibold">{item.humor_semanal}/5</p></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}