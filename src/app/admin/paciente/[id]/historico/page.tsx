'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ChevronLeft, TrendingUp, ClipboardList, User } from 'lucide-react';
import Link from 'next/link';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceArea 
} from 'recharts';

export default function PacienteHistoricoAdmin() {
  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      // Validar Admin
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== 'vankadosh@gmail.com') {
        router.push('/login');
        return;
      }

      const pacienteId = params.id;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', pacienteId)
        .single();

      const { data: checkinData } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', pacienteId)
        .order('created_at', { ascending: true });

      const processedHistory = checkinData?.map(item => ({
        ...item,
        imc: item.peso / (item.altura * item.altura)
      })) || [];

      setProfile(profileData);
      setHistory(processedHistory);
      setLoading(false);
    }
    fetchData();
  }, [supabase, router, params.id]);

  const getReferenceRange = (perfil: string) => {
    if (perfil === 'idoso') return { min: 22, max: 27 };
    if (perfil === 'crianca') return { min: 14, max: 19 };
    return { min: 18.5, max: 24.9 };
  };

  const range = getReferenceRange(profile?.tipo_perfil || 'adulto');

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    // pt-32 garante que o conteúdo comece bem abaixo do Header fixo
    <main className="min-h-screen bg-stone-50 p-8 md:p-12 pt-32 font-sans text-stone-800">
      <div className="max-w-5xl mx-auto">
        
        {/* NAVEGAÇÃO VOLTAR AO PAINEL ADMIN COM RESPIRO EXTRA */}
        <nav className="flex items-center justify-between mb-16 mt-6">
          <Link 
            href="/admin/dashboard" 
            className="group flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1 rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel Admin</span>
          </Link>
          
          <div className="text-right">
            <p className="text-xs text-stone-400 uppercase font-bold tracking-widest">Visualizando Paciente</p>
            <h1 className="text-xl font-bold text-nutri-900 flex items-center gap-2 justify-end">
              <User size={20} /> {profile?.full_name}
            </h1>
          </div>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* CARD DE RESUMO DO PERFIL */}
          <section className="lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-stone-100 h-fit">
            <h2 className="text-lg font-bold mb-4 border-b pb-2">Dados Técnicos</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider">Perfil Definido</p>
                <p className="font-bold text-nutri-900 uppercase">{profile?.tipo_perfil}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider">Meta de Peso</p>
                <p className="font-bold text-nutri-900">{profile?.meta_peso ? `${profile.meta_peso} kg` : 'Não definida'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider">Último Peso</p>
                <p className="font-bold text-nutri-900">{history.length > 0 ? `${history[history.length - 1].peso} kg` : '---'}</p>
              </div>
            </div>
          </section>

          {/* GRÁFICO DE EVOLUÇÃO */}
          <section className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
              <TrendingUp className="text-nutri-800" /> Evolução do IMC
            </h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <ReferenceArea y1={range.min} y2={range.max} fill="green" fillOpacity={0.1} label="Meta Saúde" />
                  <XAxis dataKey="created_at" tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} />
                  <Line type="monotone" dataKey="imc" name="IMC" stroke="#166534" strokeWidth={3} dot={{ r: 6 }} />
                  {profile?.meta_peso && history.length > 0 && (
                    <Line 
                      type="step" 
                      dataKey={() => (profile.meta_peso / (history[0].altura * history[0].altura))} 
                      name="Meta Planejada" 
                      stroke="#e11d48" 
                      strokeDasharray="5 5" 
                      dot={false} 
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* TABELA DE REGISTROS DETALHADOS */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <ClipboardList className="text-nutri-800" /> Histórico de Check-ins
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="py-4 text-xs text-stone-400 uppercase">Data</th>
                  <th className="py-4 text-xs text-stone-400 uppercase">Peso</th>
                  <th className="py-4 text-xs text-stone-400 uppercase">IMC</th>
                  <th className="py-4 text-xs text-stone-400 uppercase">Adesão</th>
                  <th className="py-4 text-xs text-stone-400 uppercase">Humor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {history.slice().reverse().map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-4 font-medium">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="py-4">{item.peso}kg</td>
                    <td className="py-4">{item.imc.toFixed(1)}</td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.adesao_ao_plano >= 4 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.adesao_ao_plano}/5
                      </span>
                    </td>
                    <td className="py-4 font-medium text-stone-500">{item.humor_semanal}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}