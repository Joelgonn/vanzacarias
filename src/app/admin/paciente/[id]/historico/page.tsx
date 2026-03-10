'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, 
  ChevronLeft, 
  TrendingUp, 
  ClipboardList, 
  User, 
  Ruler, 
  Layers, 
  Syringe,
  CalendarCheck
} from 'lucide-react';
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
  // Estados originais
  const [history, setHistory] = useState<any[]>([]); // Check-ins
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Novos estados para os Dados Clínicos
  const [antroData, setAntroData] = useState<any[]>([]);
  const [skinfoldsData, setSkinfoldsData] = useState<any[]>([]);
  const [bioData, setBioData] = useState<any[]>([]);
  
  // Estado de controle das Abas (Tabs) na visualização
  const [activeTab, setActiveTab] = useState<'checkins' | 'antropometria' | 'dobras' | 'bioquimicos'>('checkins');

  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      // 1. Validar Admin
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== 'vankadosh@gmail.com') {
        router.push('/login');
        return;
      }

      const pacienteId = params.id as string;

      // 2. Buscar Perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', pacienteId)
        .single();

      // 3. Buscar Check-ins semanais (Paciente)
      const { data: checkinData } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', pacienteId)
        .order('created_at', { ascending: true });

      const processedHistory = checkinData?.map(item => ({
        ...item,
        imc: item.altura ? (item.peso / (item.altura * item.altura)) : 0
      })) || [];

      // 4. Buscar Dados Clínicos (Admin)
      const { data: antro } = await supabase
        .from('anthropometry')
        .select('*')
        .eq('user_id', pacienteId)
        .order('measurement_date', { ascending: false });

      const { data: skin } = await supabase
        .from('skinfolds')
        .select('*')
        .eq('user_id', pacienteId)
        .order('measurement_date', { ascending: false });

      const { data: bio } = await supabase
        .from('biochemicals')
        .select('*')
        .eq('user_id', pacienteId)
        .order('exam_date', { ascending: false });

      // Atualiza os estados
      setProfile(profileData);
      setHistory(processedHistory);
      setAntroData(antro || []);
      setSkinfoldsData(skin || []);
      setBioData(bio || []);
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
    <main className="min-h-screen bg-stone-50 p-8 md:p-12 pt-36 lg:pt-40 font-sans text-stone-800">
      <div className="max-w-6xl mx-auto">
        
        {/* NAVEGAÇÃO VOLTAR AO PAINEL ADMIN */}
        <nav className="flex items-center justify-between mb-12">
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
            <p className="text-xs text-stone-400 uppercase font-bold tracking-widest">Prontuário</p>
            <h1 className="text-2xl font-bold text-nutri-900 flex items-center gap-2 justify-end tracking-tight">
              <User size={24} /> {profile?.full_name}
            </h1>
          </div>
        </nav>

        {/* PARTE SUPERIOR: RESUMO E GRÁFICO (Preservados do seu código) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          
          {/* CARD DE RESUMO DO PERFIL */}
          <section className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-sm border border-stone-100 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold mb-6 border-b border-stone-100 pb-4 text-stone-900">Dados do Paciente</h2>
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-bold mb-1">Perfil Definido</p>
                  <p className="font-bold text-nutri-900 uppercase bg-nutri-50 inline-block px-3 py-1 rounded-lg">{profile?.tipo_perfil}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-bold mb-1">Meta de Peso</p>
                  <p className="font-bold text-stone-700 text-lg">{profile?.meta_peso ? `${profile.meta_peso} kg` : 'Não definida'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-bold mb-1">Último Peso (Check-in)</p>
                  <p className="font-bold text-stone-700 text-lg">{history.length > 0 ? `${history[history.length - 1].peso} kg` : '---'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* GRÁFICO DE EVOLUÇÃO (Check-ins) */}
          <section className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-2 text-stone-900">
              <TrendingUp className="text-nutri-800" /> Evolução de IMC (Auto-relatada)
            </h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <ReferenceArea y1={range.min} y2={range.max} fill="#22c55e" fillOpacity={0.05} label="Faixa Saudável" />
                  <XAxis dataKey="created_at" tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} stroke="#a8a29e" />
                  <YAxis domain={['auto', 'auto']} stroke="#a8a29e" />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="imc" name="IMC" stroke="#166534" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                  {profile?.meta_peso && history.length > 0 && history[0].altura && (
                    <Line 
                      type="step" 
                      dataKey={() => (profile.meta_peso / (history[0].altura * history[0].altura))} 
                      name="Meta IMC" 
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

        {/* PARTE INFERIOR: HISTÓRICOS DETALHADOS COM ABAS */}
        <section className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
          
          {/* MENU DE ABAS */}
          <div className="flex overflow-x-auto border-b border-stone-100 bg-stone-50 px-6 pt-4 gap-2 scrollbar-hide">
            <button onClick={() => setActiveTab('checkins')} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'checkins' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-xl' : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 rounded-t-xl'}`}>
              <CalendarCheck size={18} /> Check-ins (Paciente)
            </button>
            <button onClick={() => setActiveTab('antropometria')} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'antropometria' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-xl' : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 rounded-t-xl'}`}>
              <Ruler size={18} /> Antropometria (Admin)
            </button>
            <button onClick={() => setActiveTab('dobras')} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'dobras' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-xl' : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 rounded-t-xl'}`}>
              <Layers size={18} /> Dobras Cutâneas (Admin)
            </button>
            <button onClick={() => setActiveTab('bioquimicos')} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'bioquimicos' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-xl' : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 rounded-t-xl'}`}>
              <Syringe size={18} /> Bioquímicos (Admin)
            </button>
          </div>

          <div className="p-8">
            
            {/* ABA 1: CHECK-INS */}
            {activeTab === 'checkins' && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-bold mb-6 text-stone-900">Relatos Dominicais</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-stone-100">
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Data</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Peso</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">IMC</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Adesão</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Humor</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Comentário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {history.slice().reverse().map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                          <td className="py-4 px-2 font-semibold text-stone-700">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-2 font-medium">{item.peso} kg</td>
                          <td className="py-4 px-2">{item.imc > 0 ? item.imc.toFixed(1) : '-'}</td>
                          <td className="py-4 px-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.adesao_ao_plano >= 4 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              {item.adesao_ao_plano}/5
                            </span>
                          </td>
                          <td className="py-4 px-2 font-medium text-stone-500">{item.humor_semanal}/5</td>
                          <td className="py-4 px-2 text-sm text-stone-600 max-w-xs truncate" title={item.comentarios}>{item.comentarios || '-'}</td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-stone-500 italic">Nenhum check-in registrado ainda.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 2: ANTROPOMETRIA */}
            {activeTab === 'antropometria' && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-bold mb-6 text-stone-900">Medidas de Circunferência</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-stone-100">
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Data</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Peso</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Cintura</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Quadril</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Braço</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Pantu.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {antroData.map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                          <td className="py-4 px-2 font-semibold text-stone-700">{new Date(item.measurement_date).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-2 font-medium">{item.weight ? `${item.weight} kg` : '-'}</td>
                          <td className="py-4 px-2">{item.waist ? `${item.waist} cm` : '-'}</td>
                          <td className="py-4 px-2">{item.hip ? `${item.hip} cm` : '-'}</td>
                          <td className="py-4 px-2">{item.arm ? `${item.arm} cm` : '-'}</td>
                          <td className="py-4 px-2">{item.calf ? `${item.calf} cm` : '-'}</td>
                        </tr>
                      ))}
                      {antroData.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-stone-500 italic">Nenhuma medida registrada no painel.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 3: DOBRAS CUTÂNEAS */}
            {activeTab === 'dobras' && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-bold mb-6 text-stone-900">Protocolo de Dobras (mm)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-stone-100">
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Data</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Tricipital</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Subescap.</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Suprailíaca</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Abdominal</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Coxa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {skinfoldsData.map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                          <td className="py-4 px-2 font-semibold text-stone-700">{new Date(item.measurement_date).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-2">{item.triceps || '-'}</td>
                          <td className="py-4 px-2">{item.subscapular || '-'}</td>
                          <td className="py-4 px-2">{item.suprailiac || '-'}</td>
                          <td className="py-4 px-2">{item.abdominal || '-'}</td>
                          <td className="py-4 px-2">{item.thigh || '-'}</td>
                        </tr>
                      ))}
                      {skinfoldsData.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-stone-500 italic">Nenhuma dobra registrada.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 4: BIOQUÍMICOS */}
            {activeTab === 'bioquimicos' && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-bold mb-6 text-stone-900">Painel de Exames Laboratoriais</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-stone-100">
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Data Exame</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Glicose</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Colesterol T.</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Triglicerídeos</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Vit D</th>
                        <th className="py-4 px-2 text-xs text-stone-400 uppercase font-bold tracking-wider">Ferro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {bioData.map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                          <td className="py-4 px-2 font-semibold text-stone-700">{new Date(item.exam_date).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-2 font-medium">{item.glucose ? `${item.glucose} mg/dL` : '-'}</td>
                          <td className="py-4 px-2">{item.total_cholesterol || '-'}</td>
                          <td className="py-4 px-2">{item.triglycerides || '-'}</td>
                          <td className="py-4 px-2">{item.vitamin_d || '-'}</td>
                          <td className="py-4 px-2">{item.iron || '-'}</td>
                        </tr>
                      ))}
                      {bioData.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-stone-500 italic">Nenhum exame cadastrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </section>

      </div>
    </main>
  );
}