'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Mail, Lock, User, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function Cadastro() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Criar usuário no Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, role: 'patient' } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // 2. Primeiro: Criar o perfil do usuário
      const { error: profileError } = await supabase.from('profiles').insert([
        { id: data.user.id, full_name: name, role: 'patient' }
      ]);
      
      if (profileError) console.error("Erro ao criar perfil:", profileError);

      // 3. Segundo: Salvar a avaliação (agora o user_id já existe na tabela profiles!)
      const savedAnswers = localStorage.getItem('quiz_answers');
      if (savedAnswers) {
        await supabase.from('evaluations').insert([
          { user_id: data.user.id, answers: JSON.parse(savedAnswers) }
        ]);
        localStorage.removeItem('quiz_answers');
      }
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl text-center">
          <CheckCircle2 size={40} className="text-nutri-800 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-stone-900 mb-4">Bem-vindo(a), {name.split(' ')[0]}!</h2>
          <p className="text-stone-500 mb-8">Cadastro realizado. A Vanusa já tem acesso aos seus dados.</p>
          <Link href="/login" className="w-full bg-nutri-900 text-white py-3.5 rounded-xl font-medium block">
            Acessar meu Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex bg-white">
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 lg:px-24 py-12">
        <h2 className="text-3xl font-bold mb-8">Crie sua conta</h2>
        {error && <p className="mb-4 text-red-500 bg-red-50 p-3 rounded-lg text-sm">{error}</p>}
        <form onSubmit={handleRegister} className="space-y-4">
          <input type="text" placeholder="Nome Completo" required value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 border rounded-xl" />
          <input type="email" placeholder="E-mail" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 border rounded-xl" />
          <input type="password" placeholder="Senha" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border rounded-xl" />
          <button disabled={loading} className="w-full bg-nutri-900 text-white p-3 rounded-xl">{loading ? <Loader2 className="animate-spin mx-auto" /> : 'Finalizar Cadastro'}</button>
        </form>
      </div>
      <div className="hidden lg:flex w-1/2 bg-nutri-900 items-center justify-center p-12 text-white">
        <h3 className="text-3xl font-bold">Nutrição feita para você.</h3>
      </div>
    </main>
  );
}