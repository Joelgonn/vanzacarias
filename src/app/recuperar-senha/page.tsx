'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
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
      <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl border border-stone-100">
        <Link href="/login" className="flex items-center gap-2 text-stone-500 hover:text-nutri-800 mb-6 text-sm font-medium">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Recuperar senha</h2>
        <p className="text-stone-500 mb-8 text-sm">Enviaremos um link de acesso ao seu e-mail.</p>
        
        {message ? (
          <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm">{message}</div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-stone-400" size={18} />
              <input type="email" required placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 py-3 border rounded-xl bg-stone-50" />
            </div>
            <button disabled={loading} className="w-full bg-nutri-900 text-white py-3.5 rounded-xl font-medium hover:bg-nutri-800 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : 'Enviar link de recuperação'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}