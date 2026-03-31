'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, Save, ChevronLeft, UserCircle, 
  User, Phone, ChevronDown, Calendar 
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
      toast.error("Erro ao atualizar o perfil. Tente novamente.");
      console.error(error.message);
    } else {
      toast.success("Perfil atualizado com sucesso!");
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50/50">
      <div className="flex flex-col items-center gap-5">
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-stone-100">
          <Loader2 className="animate-spin text-nutri-700" size={36} />
        </div>
        <p className="text-stone-500 font-medium tracking-wide animate-pulse">Carregando seus dados...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#F8F9FA] p-4 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-[88px] md:pt-24 pb-24 selection:bg-nutri-200">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        
        {/* NAVEGAÇÃO DE TOPO PREMIUM */}
        <nav className="flex items-center justify-between mb-8 md:mb-12 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center gap-2 h-11 md:h-12 px-4 md:px-5 bg-white border border-stone-200/80 rounded-xl md:rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:border-nutri-300 hover:shadow-md active:scale-[0.98] transition-all duration-300 text-stone-600 hover:text-nutri-700 group shrink-0"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-bold text-sm">Voltar <span className="hidden sm:inline">ao App</span></span>
          </Link>
          
          <div className="text-right flex-1">
            <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-0.5">Nutrição Clínica</p>
            <h1 className="text-sm md:text-lg font-extrabold text-stone-900 tracking-tight truncate">
              Vanusa Zacarias
            </h1>
          </div>
        </nav>

        {/* CARD DO PERFIL */}
        <div className="bg-white p-6 sm:p-8 md:p-12 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-stone-100 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-8 md:mb-10 text-center sm:text-left border-b border-stone-100 pb-8">
            <div className="bg-nutri-50 p-4 rounded-[1.5rem] text-nutri-800 shadow-sm border border-nutri-100">
              <UserCircle size={40} strokeWidth={1.5} />
            </div>
            <div className="flex flex-col justify-center h-full pt-1 sm:pt-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight mb-1.5">Meu Perfil</h1>
              <p className="text-stone-500 text-sm md:text-base font-medium">Mantenha seus dados atualizados para cálculos precisos do sistema.</p>
            </div>
          </div>

          <form onSubmit={handleUpdate} className="space-y-5 max-w-xl mx-auto sm:mx-0">
            
            {/* Input Nome - Floating Label Style */}
            <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4 shadow-sm">
              <label className="text-[10px] md:text-[11px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                Nome Completo
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-0 text-stone-400 group-focus-within:text-nutri-600 transition-colors" size={20} strokeWidth={2} />
                <input 
                  type="text" 
                  value={profile?.full_name || ''} 
                  onChange={e => setProfile({...profile, full_name: e.target.value})} 
                  className="w-full pl-9 pr-2 py-1 bg-transparent outline-none text-stone-800 font-bold md:text-lg" 
                  placeholder="Seu nome"
                  required
                />
              </div>
            </div>

            {/* Input Telefone */}
            <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4 shadow-sm">
              <label className="text-[10px] md:text-[11px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                WhatsApp (Telefone)
              </label>
              <div className="relative flex items-center">
                <Phone className="absolute left-0 text-stone-400 group-focus-within:text-nutri-600 transition-colors" size={20} strokeWidth={2} />
                <input 
                  type="tel" 
                  value={profile?.phone || ''} 
                  onChange={e => setProfile({...profile, phone: e.target.value})} 
                  className="w-full pl-9 pr-2 py-1 bg-transparent outline-none text-stone-800 font-bold md:text-lg" 
                  placeholder="(00) 00000-0000" 
                  required
                />
              </div>
            </div>

            {/* Input Data de Nascimento */}
            <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4 shadow-sm">
              <label className="text-[10px] md:text-[11px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                Data de Nascimento
              </label>
              <div className="relative flex items-center">
                <Calendar className="absolute left-0 text-stone-400 group-focus-within:text-nutri-600 transition-colors" size={20} strokeWidth={2} />
                <input 
                  type="date" 
                  value={profile?.data_nascimento || ''} 
                  onChange={e => setProfile({...profile, data_nascimento: e.target.value})} 
                  className="w-full pl-9 pr-2 py-1 bg-transparent outline-none text-stone-800 font-bold md:text-lg" 
                  required
                />
              </div>
            </div>

            {/* Input Sexo */}
            <div className="relative group flex flex-col bg-stone-50/50 hover:bg-stone-50 focus-within:bg-white border border-stone-200 focus-within:border-nutri-400 focus-within:ring-4 focus-within:ring-nutri-50 rounded-2xl transition-all pt-2.5 pb-2 px-4 shadow-sm">
              <label className="text-[10px] md:text-[11px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 ml-8 mb-0.5 group-focus-within:text-nutri-600 transition-colors">
                Sexo Biológico
              </label>
              <div className="relative flex items-center">
                <UserCircle className="absolute left-0 text-stone-400 group-focus-within:text-nutri-600 transition-colors" size={20} strokeWidth={2} />
                <select 
                  value={profile?.sexo || ''} 
                  onChange={e => setProfile({...profile, sexo: e.target.value})} 
                  className="w-full pl-9 pr-8 py-1 bg-transparent outline-none text-stone-800 font-bold md:text-lg appearance-none cursor-pointer"
                  required
                >
                  <option value="" disabled>Selecione...</option>
                  {/* Corrigido: Letras maiúsculas para baterem com o banco de dados */}
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                </select>
                <ChevronDown className="absolute right-0 text-stone-400 pointer-events-none" size={20} strokeWidth={2} />
              </div>
            </div>
            
            <div className="pt-8">
              <button 
                type="submit"
                disabled={saving} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-stone-900 text-white px-10 h-14 rounded-2xl font-bold hover:bg-stone-800 active:scale-[0.98] transition-all shadow-lg shadow-stone-900/10 disabled:opacity-70 disabled:cursor-not-allowed text-base md:text-lg"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={22} />
                ) : (
                  <Save size={22} />
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