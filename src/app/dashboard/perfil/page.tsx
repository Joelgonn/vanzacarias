'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Save, ChevronLeft, UserCircle, User, Phone, ChevronDown, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function PerfilPaciente() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      setProfile(data);
      setLoading(false);
    }
    loadProfile();
  }, [supabase, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Atualiza os dados no banco de dados, agora incluindo sexo e data_nascimento
    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: profile.full_name,
        phone: profile.phone,
        sexo: profile.sexo, 
        data_nascimento: profile.data_nascimento 
      })
      .eq('id', profile.id);
    
    if (error) {
      alert("Erro ao atualizar perfil: " + error.message);
    } else {
      alert("Perfil atualizado com sucesso!");
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
    </div>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-[88px] md:pt-20 pb-24">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        
        {/* NAVEGAÇÃO DE TOPO PADRONIZADA */}
        <nav className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between pb-8 md:pb-16 mt-4 md:mt-12 gap-6 sm:gap-0 animate-fade-in-up">
          <Link 
            href="/dashboard" 
            className="group w-full sm:w-auto flex items-center justify-center sm:justify-start gap-3 bg-white px-6 py-4 sm:py-3 rounded-2xl sm:rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 active:scale-[0.98] transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1.5 sm:p-1 rounded-xl sm:rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          
          <div className="w-full sm:w-auto text-center sm:text-right text-xs md:text-sm font-bold text-stone-400 md:text-stone-900 uppercase md:normal-case tracking-widest md:tracking-tight">
            Vanusa Zacarias Nutrição
          </div>
        </nav>

        {/* CARD DO PERFIL */}
        <div className="bg-white p-6 sm:p-8 md:p-12 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-8 md:mb-10 text-center sm:text-left border-b border-stone-100 pb-8">
            <div className="bg-nutri-50 p-4 rounded-[1.5rem] text-nutri-800 shadow-sm border border-white">
              <UserCircle size={36} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight mb-1">Meu Perfil</h1>
              <p className="text-stone-500 text-sm md:text-base font-light">Mantenha seus dados atualizados para cálculos precisos do sistema.</p>
            </div>
          </div>

          <form onSubmit={handleUpdate} className="space-y-6 max-w-xl mx-auto sm:mx-0">
            
            {/* Input Nome - Premium Mobile Feel */}
            <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-800 focus-within:ring-4 focus-within:ring-nutri-800/10 rounded-2xl transition-all pt-2.5 pb-2 px-4">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5">
                Nome Completo
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-0 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} strokeWidth={1.5} />
                <input 
                  type="text" 
                  value={profile?.full_name || ''} 
                  onChange={e => setProfile({...profile, full_name: e.target.value})} 
                  className="w-full pl-8 pr-2 py-1 bg-transparent outline-none text-stone-800 font-medium md:text-lg" 
                  placeholder="Seu nome"
                  required
                />
              </div>
            </div>

            {/* Input Telefone - Premium Mobile Feel */}
            <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-800 focus-within:ring-4 focus-within:ring-nutri-800/10 rounded-2xl transition-all pt-2.5 pb-2 px-4">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5">
                WhatsApp (Telefone)
              </label>
              <div className="relative flex items-center">
                <Phone className="absolute left-0 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} strokeWidth={1.5} />
                <input 
                  type="tel" 
                  value={profile?.phone || ''} 
                  onChange={e => setProfile({...profile, phone: e.target.value})} 
                  className="w-full pl-8 pr-2 py-1 bg-transparent outline-none text-stone-800 font-medium md:text-lg" 
                  placeholder="(00) 00000-0000" 
                  required
                />
              </div>
            </div>

            {/* Input Data de Nascimento - Premium Mobile Feel */}
            <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-800 focus-within:ring-4 focus-within:ring-nutri-800/10 rounded-2xl transition-all pt-2.5 pb-2 px-4">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5">
                Data de Nascimento
              </label>
              <div className="relative flex items-center">
                <Calendar className="absolute left-0 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} strokeWidth={1.5} />
                <input 
                  type="date" 
                  value={profile?.data_nascimento || ''} 
                  onChange={e => setProfile({...profile, data_nascimento: e.target.value})} 
                  className="w-full pl-8 pr-2 py-1 bg-transparent outline-none text-stone-800 font-medium md:text-lg" 
                  required
                />
              </div>
            </div>

            {/* Input Sexo - Premium Mobile Feel */}
            <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-800 focus-within:ring-4 focus-within:ring-nutri-800/10 rounded-2xl transition-all pt-2.5 pb-2 px-4">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5">
                Sexo Biológico
              </label>
              <div className="relative flex items-center">
                <UserCircle className="absolute left-0 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} strokeWidth={1.5} />
                <select 
                  value={profile?.sexo || ''} 
                  onChange={e => setProfile({...profile, sexo: e.target.value})} 
                  className="w-full pl-8 pr-8 py-1 bg-transparent outline-none text-stone-800 font-medium md:text-lg appearance-none cursor-pointer"
                  required
                >
                  <option value="" disabled>Selecione...</option>
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                </select>
                <ChevronDown className="absolute right-0 text-stone-400 pointer-events-none" size={20} />
              </div>
            </div>
            
            <div className="pt-6">
              <button 
                type="submit"
                disabled={saving} 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-nutri-900 text-white px-10 py-4 rounded-2xl sm:rounded-full font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-lg hover:shadow-nutri-900/30 transform md:hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Save size={20} />
                )} 
                Salvar Alterações
              </button>
            </div>
          </form>

        </div>
      </div>
    </main>
  );
}