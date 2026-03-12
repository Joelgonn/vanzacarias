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
  CalendarCheck,
  BookOpen,
  Send,
  Trash2
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
  // Estados originais preservados
  const [history, setHistory] = useState<any[]>([]); // Check-ins
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [antroData, setAntroData] = useState<any[]>([]);
  const [skinfoldsData, setSkinfoldsData] = useState<any[]>([]);
  const [bioData, setBioData] = useState<any[]>([]);
  
  // Novos estados para Prontuário (Evolução Clínica)
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Estado de controle das Abas (Tabs) - Adicionado 'prontuario' como padrão ou opção
  const [activeTab, setActiveTab] = useState<'checkins' | 'antropometria' | 'dobras' | 'bioquimicos' | 'prontuario'>('prontuario');

  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const pacienteId = params.id as string;

  async function fetchData() {
    // 1. Validar Admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.email !== 'vankadosh@gmail.com') {
      router.push('/login');
      return;
    }

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

    // 4. Buscar Dados Técnicos (Admin)
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

    // 5. Buscar Notas do Prontuário (Evolução)
    const { data: notesData } = await supabase
      .from('clinical_notes')
      .select('*')
      .eq('user_id', pacienteId)
      .order('created_at', { ascending: false });

    // Atualiza os estados
    setProfile(profileData);
    setHistory(processedHistory);
    setAntroData(antro || []);
    setSkinfoldsData(skin || []);
    setBioData(bio || []);
    setNotes(notesData || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [supabase, router, pacienteId]);

  // FUNÇÕES PARA O PRONTUÁRIO
  const handleSaveNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { error } = await supabase
      .from('clinical_notes')
      .insert([{ user_id: pacienteId, content: newNote }]);
    
    if (!error) {
      setNewNote('');
      fetchData(); // Recarrega para mostrar na timeline
    } else {
      alert("Erro ao salvar nota.");
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Deseja excluir esta anotação do prontuário?")) return;
    await supabase.from('clinical_notes').delete().eq('id', id);
    fetchData();
  };

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
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 pt-28 md:pt-36 lg:pt-40 font-sans text-stone-800">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* NAVEGAÇÃO VOLTAR AO PAINEL ADMIN */}
        <nav className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between mb-8 md:mb-12 gap-6 sm:gap-0 animate-fade-in-up">
          <Link 
            href="/admin/dashboard" 
            className="group w-full sm:w-auto flex items-center justify-center sm:justify-start gap-3 bg-white px-6 py-4 sm:py-3 rounded-2xl sm:rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 active:scale-[0.98] transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1.5 sm:p-1 rounded-xl sm:rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel Admin</span>
          </Link>
          
          <div className="text-center sm:text-right w-full sm:w-auto">
            <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">Prontuário</p>
            <h1 className="text-xl md:text-2xl font-bold text-nutri-900 flex items-center gap-2 justify-center sm:justify-end tracking-tight">
              <User size={20} /> {profile?.full_name}
            </h1>
          </div>
        </nav>

        {/* PARTE SUPERIOR: RESUMO E GRÁFICO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-10 animate-fade-in-up">
          
          {/* CARD DE RESUMO DO PERFIL */}
          <section className="lg:col-span-1 bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 flex flex-col justify-between">
            <div>
              <h2 className="text-lg md:text-xl font-bold mb-6 border-b border-stone-100 pb-4 text-stone-900">Dados do Paciente</h2>
              <div className="space-y-6 md:space-y-5">
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Perfil Definido</p>
                  <p className="font-bold text-nutri-900 uppercase bg-nutri-50 inline-block px-3 py-1 rounded-lg text-sm">{profile?.tipo_perfil}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Meta de Peso</p>
                  <p className="font-bold text-stone-700 text-lg">{profile?.meta_peso ? `${profile.meta_peso} kg` : 'Não definida'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-1">Último Peso (Check-in)</p>
                  <p className="font-bold text-stone-700 text-lg">{history.length > 0 ? `${history[history.length - 1].peso} kg` : '---'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* GRÁFICO DE EVOLUÇÃO (Check-ins) */}
          <section className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100">
            <h2 className="text-lg md:text-xl font-bold mb-8 flex items-center gap-2 text-stone-900">
              <TrendingUp className="text-nutri-800" size={24} /> Evolução de IMC
            </h2>
            <div className="h-64 md:h-80 w-full -ml-3 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                  <ReferenceArea y1={range.min} y2={range.max} fill="#22c55e" fillOpacity={0.05} />
                  <XAxis 
                    dataKey="created_at" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} 
                    stroke="#a8a29e" 
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    stroke="#a8a29e" 
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="imc" name="IMC" stroke="#166534" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* PARTE INFERIOR: HISTÓRICOS DETALHADOS COM ABAS */}
        <section className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          
          {/* MENU DE ABAS COM PRONTUÁRIO INCLUSO */}
          <div className="flex overflow-x-auto border-b border-stone-100 bg-stone-50/50 px-4 pt-4 gap-1 scrollbar-hide">
            <button 
              onClick={() => setActiveTab('prontuario')} 
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'prontuario' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}
            >
              <BookOpen size={18} /> Prontuário / Evolução
            </button>
            <button 
              onClick={() => setActiveTab('checkins')} 
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'checkins' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}
            >
              <CalendarCheck size={18} /> Check-ins (Paciente)
            </button>
            <button 
              onClick={() => setActiveTab('antropometria')} 
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'antropometria' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}
            >
              <Ruler size={18} /> Antropometria
            </button>
            <button 
              onClick={() => setActiveTab('dobras')} 
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'dobras' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}
            >
              <Layers size={18} /> Dobras Cutâneas
            </button>
            <button 
              onClick={() => setActiveTab('bioquimicos')} 
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'bioquimicos' ? 'border-nutri-800 text-nutri-900 bg-white rounded-t-2xl shadow-sm' : 'border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/30 rounded-t-2xl'}`}
            >
              <Syringe size={18} /> Bioquímicos
            </button>
          </div>

          <div className="p-6 md:p-8">
            
            {/* ABA PRONTUÁRIO: LINHA DO TEMPO E ANOTAÇÕES */}
            {activeTab === 'prontuario' && (
              <div className="animate-fade-in max-w-4xl mx-auto">
                <h2 className="text-lg md:text-xl font-bold mb-8 text-stone-900 flex items-center gap-2">
                  <BookOpen className="text-nutri-800" /> Evolução Clínica e Conduta
                </h2>

                {/* CAMPO PARA NOVA ANOTAÇÃO */}
                <div className="mb-12 bg-stone-50/50 p-6 rounded-[2rem] border border-stone-100">
                  <textarea 
                    value={newNote} 
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Escreva aqui a evolução do paciente nesta consulta ou conduta técnica..."
                    className="w-full p-5 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-nutri-800 outline-none h-32 resize-none text-sm leading-relaxed bg-white"
                  />
                  <div className="flex justify-end mt-4">
                    <button 
                      onClick={handleSaveNote}
                      disabled={savingNote || !newNote.trim()}
                      className="bg-nutri-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-nutri-800 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      Salvar no Prontuário
                    </button>
                  </div>
                </div>

                {/* TIMELINE DE NOTAS */}
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-stone-200 before:to-transparent">
                  {notes.map((note) => (
                    <div key={note.id} className="relative flex items-start group">
                      <div className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-nutri-800 shadow-sm z-10">
                        <div className="w-2 h-2 bg-nutri-800 rounded-full"></div>
                      </div>
                      <div className="ml-14 flex-1 bg-white p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-black text-nutri-800 uppercase tracking-widest">
                            {new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button onClick={() => handleDeleteNote(note.id)} className="text-stone-300 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <p className="text-stone-600 leading-relaxed text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <div className="text-center py-10 text-stone-400 italic bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                      Nenhuma anotação registrada ainda.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 1: CHECK-INS */}
            {activeTab === 'checkins' && (
              <div className="animate-fade-in">
                <h2 className="text-lg md:text-xl font-bold mb-6 text-stone-900">Relatos Dominicais</h2>
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b-2 border-stone-100">
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Data</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Peso</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Adesão</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Humor</th>
                        <th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-bold tracking-widest">Relato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {history.slice().reverse().map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-4 px-2 font-bold text-stone-700 text-sm whitespace-nowrap">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-2 font-medium text-sm">{item.peso} kg</td>
                          <td className="py-4 px-2 text-sm">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${item.adesao_ao_plano >= 4 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                              {item.adesao_ao_plano}/5
                            </span>
                          </td>
                          <td className="py-4 px-2 font-bold text-sm text-stone-500">{item.humor_semanal}/5</td>
                          <td className="py-4 px-2 text-xs text-stone-600 leading-relaxed">{item.comentarios || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 2: ANTROPOMETRIA */}
            {activeTab === 'antropometria' && (
              <div className="animate-fade-in overflow-x-auto">
                <h2 className="text-lg md:text-xl font-bold mb-6 text-stone-900">Medidas de Circunferência</h2>
                <table className="w-full text-left min-w-[600px]">
                  <thead><tr className="border-b-2 border-stone-100"><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Data</th><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Peso</th><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Cintura</th><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Quadril</th></tr></thead>
                  <tbody className="divide-y divide-stone-50">{antroData.map(i => <tr key={i.id} className="hover:bg-stone-50/50"><td className="py-4 px-2 font-bold text-sm">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td><td className="py-4 px-2 text-sm">{i.weight}kg</td><td className="py-4 px-2 text-sm">{i.waist}cm</td><td className="py-4 px-2 text-sm">{i.hip}cm</td></tr>)}</tbody>
                </table>
              </div>
            )}

            {/* ABA 3: DOBRAS CUTÂNEAS */}
            {activeTab === 'dobras' && (
              <div className="animate-fade-in overflow-x-auto">
                <h2 className="text-lg md:text-xl font-bold mb-6 text-stone-900">Protocolo de Dobras (mm)</h2>
                <table className="w-full text-left min-w-[600px]">
                  <thead><tr className="border-b-2 border-stone-100"><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Data</th><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Abdominal</th><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Coxa</th><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Subescap.</th></tr></thead>
                  <tbody className="divide-y divide-stone-50">{skinfoldsData.map(i => <tr key={i.id} className="hover:bg-stone-50/50"><td className="py-4 px-2 font-bold text-sm">{new Date(i.measurement_date).toLocaleDateString('pt-BR')}</td><td className="py-4 px-2 text-sm">{i.abdominal}</td><td className="py-4 px-2 text-sm">{i.thigh}</td><td className="py-4 px-2 text-sm">{i.subscapular}</td></tr>)}</tbody>
                </table>
              </div>
            )}

            {/* ABA 4: BIOQUÍMICOS */}
            {activeTab === 'bioquimicos' && (
              <div className="animate-fade-in overflow-x-auto">
                <h2 className="text-lg md:text-xl font-bold mb-6 text-stone-900">Exames Laboratoriais</h2>
                <table className="w-full text-left min-w-[600px]">
                  <thead><tr className="border-b-2 border-stone-100"><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Data</th><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Glicose</th><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Colest T.</th><th className="py-4 px-2 text-[10px] text-stone-400 uppercase font-black">Vit D.</th></tr></thead>
                  <tbody className="divide-y divide-stone-50">{bioData.map(i => <tr key={i.id} className="hover:bg-stone-50/50"><td className="py-4 px-2 font-bold text-sm">{new Date(i.exam_date).toLocaleDateString('pt-BR')}</td><td className="py-4 px-2 text-sm">{i.glucose} mg/dL</td><td className="py-4 px-2 text-sm">{i.total_cholesterol}</td><td className="py-4 px-2 text-sm">{i.vitamin_d}</td></tr>)}</tbody>
                </table>
              </div>
            )}

          </div>
        </section>

      </div>
    </main>
  );
}