'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Loader2 } from 'lucide-react';

export default function AtualizarSenha() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // 1. Tenta capturar a sessão vinda do link do e-mail
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionLoading(false);
      }
    });
    setSessionLoading(false);
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Agora o Supabase reconhece que você veio pelo link de recuperação
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      alert("Erro ao atualizar senha: " + error.message);
    } else {
      alert("Senha atualizada com sucesso!");
      router.push('/dashboard');
    }
    setLoading(false);
  };

  if (sessionLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl border border-stone-100">
        <h2 className="text-2xl font-bold text-stone-900 mb-6">Definir Nova Senha</h2>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 text-stone-400" size={18} />
            <input 
              type="password" 
              required 
              placeholder="Digite sua nova senha" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full pl-11 py-3 border rounded-xl bg-stone-50 focus:ring-2 focus:ring-nutri-800 outline-none" 
            />
          </div>
          <button disabled={loading} className="w-full bg-nutri-900 text-white py-3.5 rounded-xl font-medium hover:bg-nutri-800 transition-all">
            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Atualizar senha'}
          </button>
        </form>
      </div>
    </main>
  );
}