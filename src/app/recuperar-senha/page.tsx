'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // O redirectTo deve ser a rota da sua página de criar nova senha
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/atualizar-senha`,
    });

    if (error) {
      alert("Erro ao enviar e-mail: " + error.message);
    } else {
      setMessage("Verifique seu e-mail! Enviamos um link para você redefinir sua senha.");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-stone-100 animate-fade-in-up">
        
        {/* Link Voltar Estilizado */}
        <Link href="/login" className="inline-flex items-center gap-2 text-stone-400 hover:text-nutri-800 mb-8 text-sm font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft size={16} /> Voltar
        </Link>
        
        <h2 className="text-2xl md:text-3xl font-bold text-stone-900 mb-3 tracking-tight">Recuperar senha</h2>
        <p className="text-stone-500 mb-8 text-sm md:text-base leading-relaxed">
          Enviaremos um link de acesso ao seu e-mail cadastrado.
        </p>
        
        {message ? (
          <div className="bg-green-50 border border-green-100 p-6 rounded-2xl text-green-800 text-sm md:text-base text-center animate-fade-in flex flex-col items-center">
            <CheckCircle2 size={40} className="text-green-500 mb-4" />
            <p className="font-medium">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-5">
            <div className="relative group">
              <Mail className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} />
              <input 
                type="email" 
                required 
                placeholder="Seu e-mail" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all" 
              />
            </div>
            
            <button 
              disabled={loading} 
              className="w-full bg-nutri-900 text-white py-4 rounded-2xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Enviar link de recuperação'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}