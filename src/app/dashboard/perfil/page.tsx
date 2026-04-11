'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, Save, ChevronLeft, UserCircle, 
  User, Phone, ChevronDown, Calendar, ShieldCheck 
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

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
      toast.error("Erro ao atualizar o perfil. Tente novamente.");
      console.error(error.message);
    } else {
      toast.success("Perfil atualizado com sucesso!");
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center">
          <Loader2 className="animate-spin text-nutri-700" size={32} strokeWidth={2.5} />
        </div>
        <p className="text-stone-400 font-bold tracking-widest uppercase text-xs">Carregando perfil</p>
      </div>
    </div>
  );

  return (
    // pt-32 (128px) no mobile e pt-40 (160px) no desktop garantem que o header global não cubra o conteúdo
    <main className="min-h-screen bg-[#FAFAFA] px-4 sm:px-6 flex flex-col pt-24 md:pt-30 pb-24 selection:bg-nutri-200 font-sans">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        
        {/* NAVEGAÇÃO DE TOPO */}
        <nav className="flex items-center justify-between mb-8 md:mb-10 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center gap-2 h-12 px-5 bg-white border border-stone-200 rounded-2xl shadow-sm hover:border-nutri-300 hover:text-nutri-700 hover:shadow-md active:scale-[0.98] transition-all duration-300 text-stone-600 font-bold text-sm group shrink-0"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline">Voltar ao App</span>
            <span className="sm:hidden">Voltar</span>
          </Link>
          
          <div className="text-right flex-1">
            <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mb-0.5">Nutrição Clínica</p>
            <h1 className="text-sm md:text-base font-black text-stone-900 tracking-tight truncate">
              Vanusa Zacarias
            </h1>
          </div>
        </nav>

        {/* CARD PRINCIPAL DO PERFIL */}
        <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-stone-100 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 relative overflow-hidden">
          
          {/* Efeito visual sutil de fundo no topo do card */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-stone-50/80 to-transparent pointer-events-none" />

          {/* CABEÇALHO DO FORMULÁRIO */}
          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 mb-10 text-center sm:text-left border-b border-stone-100 pb-8">
            <div className="bg-gradient-to-br from-nutri-50 to-stone-50 p-4 rounded-[1.5rem] text-nutri-700 shadow-sm border border-stone-100 shrink-0">
              <UserCircle size={44} strokeWidth={1.5} />
            </div>
            <div className="flex flex-col justify-center h-full pt-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">Meu Perfil</h1>
                <span className="bg-stone-100 text-stone-600 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md">Paciente</span>
              </div>
              <p className="text-stone-500 text-sm md:text-base font-medium max-w-md">
                Mantenha seus dados atualizados para garantirmos a precisão do seu plano alimentar.
              </p>
            </div>
          </div>

          {/* FORMULÁRIO */}
          <form onSubmit={handleUpdate} className="space-y-5 max-w-2xl mx-auto sm:mx-0 relative">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nome Completo */}
              <div className="md:col-span-2 relative group flex flex-col bg-stone-50 border border-transparent hover:border-stone-200 focus-within:bg-white focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-12 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                  Nome Completo
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm border border-stone-100 text-stone-400 group-focus-within:text-nutri-600 group-focus-within:border-nutri-200 transition-colors">
                    <User size={16} strokeWidth={2.5} />
                  </div>
                  <input 
                    type="text" 
                    value={profile?.full_name || ''} 
                    onChange={e => setProfile({...profile, full_name: e.target.value})} 
                    className="w-full pl-12 pr-2 py-1.5 bg-transparent outline-none text-stone-800 font-bold md:text-lg" 
                    placeholder="Como prefere ser chamado?"
                    required
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="relative group flex flex-col bg-stone-50 border border-transparent hover:border-stone-200 focus-within:bg-white focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-12 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                  WhatsApp
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm border border-stone-100 text-stone-400 group-focus-within:text-nutri-600 group-focus-within:border-nutri-200 transition-colors">
                    <Phone size={16} strokeWidth={2.5} />
                  </div>
                  <input 
                    type="tel" 
                    value={profile?.phone || ''} 
                    onChange={e => setProfile({...profile, phone: e.target.value})} 
                    className="w-full pl-12 pr-2 py-1.5 bg-transparent outline-none text-stone-800 font-bold md:text-lg" 
                    placeholder="(00) 00000-0000" 
                    required
                  />
                </div>
              </div>

              {/* Data de Nascimento */}
              <div className="relative group flex flex-col bg-stone-50 border border-transparent hover:border-stone-200 focus-within:bg-white focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-12 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                  Nascimento
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm border border-stone-100 text-stone-400 group-focus-within:text-nutri-600 group-focus-within:border-nutri-200 transition-colors">
                    <Calendar size={16} strokeWidth={2.5} />
                  </div>
                  <input 
                    type="date" 
                    value={profile?.data_nascimento || ''} 
                    onChange={e => setProfile({...profile, data_nascimento: e.target.value})} 
                    className="w-full pl-12 pr-2 py-1.5 bg-transparent outline-none text-stone-800 font-bold md:text-lg" 
                    required
                  />
                </div>
              </div>

              {/* Sexo Biológico */}
              <div className="md:col-span-2 relative group flex flex-col bg-stone-50 border border-transparent hover:border-stone-200 focus-within:bg-white focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-12 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                  Sexo Biológico
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm border border-stone-100 text-stone-400 group-focus-within:text-nutri-600 group-focus-within:border-nutri-200 transition-colors">
                    <UserCircle size={16} strokeWidth={2.5} />
                  </div>
                  <select 
                    value={profile?.sexo || ''} 
                    onChange={e => setProfile({...profile, sexo: e.target.value})} 
                    className="w-full pl-12 pr-10 py-1.5 bg-transparent outline-none text-stone-800 font-bold md:text-lg appearance-none cursor-pointer"
                    required
                  >
                    <option value="" disabled>Selecione...</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Masculino">Masculino</option>
                  </select>
                  <ChevronDown className="absolute right-2 text-stone-400 pointer-events-none" size={20} strokeWidth={2.5} />
                </div>
              </div>
            </div>
            
            {/* ÁREA DE SALVAMENTO */}
            <div className="pt-8 mt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
              
              <div className="flex items-center gap-2 text-stone-400 order-2 sm:order-1">
                <ShieldCheck size={16} />
                <span className="text-[11px] font-medium uppercase tracking-wider">Dados protegidos</span>
              </div>

              <button 
                type="submit"
                disabled={saving} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-stone-900 text-white px-8 h-14 rounded-2xl font-bold hover:bg-stone-800 hover:shadow-lg hover:shadow-stone-900/10 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed text-base order-1 sm:order-2 group"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Save size={20} className="group-hover:scale-110 transition-transform" />
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