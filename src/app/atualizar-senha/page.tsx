'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';

export default function AtualizarSenha() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleRecovery = async () => {
      // 1. Primeiro tenta pegar a sessão atual
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        setIsValidSession(true);
        setChecking(false);
        return;
      }

      // 2. Se não tem sessão, configura listener para o evento de recuperação
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth event:', event); // Debug: veja qual evento está chegando
          
          if (event === 'PASSWORD_RECOVERY') {
            setIsValidSession(true);
            setChecking(false);
            subscription.unsubscribe();
          } else if (event === 'SIGNED_IN' && session) {
            // Fallback: se entrou como signed_in mas é recovery
            setIsValidSession(true);
            setChecking(false);
            subscription.unsubscribe();
          }
        }
      );

      // 3. Força o Supabase a processar o hash da URL
      // Isso é crucial para o Next.js App Router
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        // O Supabase já processa automaticamente, mas vamos dar um tempo
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setIsValidSession(true);
            setChecking(false);
            subscription.unsubscribe();
          } else {
            // Se ainda não tem sessão, tenta recuperar manualmente
            await supabase.auth.getSession();
          }
        }, 1000);
      }

      // Timeout para evitar loading infinito
      const timeout = setTimeout(() => {
        if (!isValidSession) {
          console.error('Timeout: Nenhuma sessão de recuperação encontrada');
          router.push('/login?error=invalid_or_expired_recovery_link');
        }
        setChecking(false);
      }, 8000);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    };

    handleRecovery();
  }, [supabase, router, isValidSession]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Verifica se ainda tem sessão antes de atualizar
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      alert("Sessão expirada. Por favor, solicite um novo link de recuperação.");
      router.push('/login');
      setLoading(false);
      return;
    }
    
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('Erro detalhado:', error);
      alert("Erro ao atualizar senha: " + error.message);
    } else {
      alert("Senha atualizada com sucesso! Faça login com sua nova senha.");
      await supabase.auth.signOut();
      router.push('/login');
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
      </div>
    );
  }

  if (!isValidSession) {
    return null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-stone-100">
        <div className="w-20 h-20 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
          <ShieldCheck size={40} className="text-nutri-800" />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-stone-900 mb-3 tracking-tight">Definir Nova Senha</h2>
          <p className="text-stone-500 text-sm md:text-base leading-relaxed">
            Escolha uma senha forte para proteger sua conta.
          </p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="relative group">
            <Lock className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} strokeWidth={1.5} />
            <input 
              type="password" 
              required 
              placeholder="Digite sua nova senha" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all" 
              minLength={6}
            />
          </div>

          <button 
            disabled={loading} 
            className="w-full bg-nutri-900 text-white py-4 rounded-2xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              'Atualizar senha'
            )}
          </button>
        </form>
      </div>
    </main>
  );
}