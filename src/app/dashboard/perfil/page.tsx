'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Save, ChevronLeft, UserCircle } from 'lucide-react';
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
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: profile.full_name,
        phone: profile.phone 
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
    <main className="min-h-screen bg-stone-50 p-8 md:p-12 font-sans text-stone-800">
      <div className="max-w-3xl mx-auto">
        
        {/* NAVEGAÇÃO DE TOPO - Mesma estrutura do "Meu Plano" para consistência */}
        <nav className="flex items-center justify-between pb-12 mt-12">
          <Link 
            href="/dashboard" 
            className="group flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1 rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          
          <div className="text-sm font-bold text-stone-900 tracking-tight">
            Vanusa Barros Nutrição
          </div>
        </nav>

        {/* CARD DO PERFIL */}
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-stone-100">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-nutri-50 p-3 rounded-2xl text-nutri-800">
              <UserCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-stone-900">Meu Perfil</h1>
          </div>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Nome Completo</label>
              <input 
                type="text" 
                value={profile?.full_name || ''} 
                onChange={e => setProfile({...profile, full_name: e.target.value})} 
                className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50 focus:bg-white focus:ring-2 focus:ring-nutri-800 outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">WhatsApp (Telefone)</label>
              <input 
                type="text" 
                value={profile?.phone || ''} 
                onChange={e => setProfile({...profile, phone: e.target.value})} 
                className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50 focus:bg-white focus:ring-2 focus:ring-nutri-800 outline-none transition-all" 
                placeholder="(00) 00000-0000" 
              />
            </div>
            
            <div className="pt-4">
              <button 
                disabled={saving} 
                className="inline-flex items-center gap-2 bg-nutri-900 text-white px-8 py-4 rounded-full font-bold hover:bg-nutri-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}