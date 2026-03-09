'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ChevronLeft, TrendingUp, Calendar, Weight } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Historico() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchHistory() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

      if (data) setHistory(data);
      setLoading(false);
    }
    fetchHistory();
  }, [supabase, router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-8 md:p-12 font-sans text-stone-800">
      <div className="max-w-4xl mx-auto">
        
        {/* NAVEGAÇÃO PADRÃO */}
        <nav className="flex items-center justify-between mb-16 mt-12">
          <Link 
            href="/dashboard" 
            className="group flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1 rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          <div className="text-sm font-bold text-stone-900 tracking-tight">Vanusa Zacarias Nutrição</div>
        </nav>

        {/* GRÁFICO DE PESO */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 mb-10">
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-2 text-nutri-900">
            <TrendingUp className="text-nutri-800" /> Evolução do seu Peso
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="created_at" tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} />
                <YAxis domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="peso" stroke="#57534e" strokeWidth={3} dot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* TABELA DE REGISTROS */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
          <h2 className="text-2xl font-bold mb-6">Seus Registros</h2>
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border border-stone-100 rounded-xl bg-stone-50">
                <div>
                  <p className="text-xs text-stone-400 uppercase">Data</p>
                  <p className="font-semibold">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase">Peso</p>
                  <p className="font-semibold">{item.peso}kg</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase">Adesão</p>
                  <p className="font-semibold">{item.adesao_ao_plano}/5</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase">Humor</p>
                  <p className="font-semibold">{item.humor_semanal}/5</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}