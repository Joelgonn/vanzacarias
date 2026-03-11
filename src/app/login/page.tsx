'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, LogIn, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Aqui preservamos a função de tratamento de erro que conecta com o questionário
      setError('Credenciais incorretas ou conta não encontrada.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    // Transformado em flex-col para mobile e flex-row para desktop
    <main className="min-h-screen flex flex-col lg:flex-row bg-stone-50 lg:bg-white font-sans text-stone-800">
      
      {/* LADO DIREITO: FORMULÁRIO DE LOGIN (Agora aparece primeiro no Mobile) */}
      <div className="order-1 lg:order-2 w-full lg:w-1/2 flex flex-col justify-center px-6 py-10 lg:px-12 xl:px-20 lg:py-12 bg-white rounded-b-[40px] lg:rounded-none shadow-sm lg:shadow-none z-10">
        <div className="max-w-md w-full mx-auto animate-fade-in-up">
          
          {/* Cabeçalho do Form - Ajustado para Premium */}
          <div className="mb-10 text-center lg:text-left">
            <div className="w-14 h-14 bg-nutri-50 rounded-2xl flex items-center justify-center mx-auto lg:mx-0 mb-6 lg:hidden">
              <LogIn size={24} className="text-nutri-800" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-stone-900">Acessar Conta</h2>
            <p className="text-stone-500 mt-2 lg:hidden">Bem-vindo de volta ao seu portal</p>
          </div>
          
          {error && (
            <div className="flex items-center gap-3 text-red-600 bg-red-50/80 p-4 rounded-2xl mb-6 text-sm border border-red-100 animate-fade-in-right">
              <AlertCircle size={20} className="shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Input E-mail Premium */}
            <div className="relative group">
              <Mail className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} />
              <input 
                type="email" 
                required 
                placeholder="E-mail"
                className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700 placeholder:text-stone-400"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Input Senha Premium */}
            <div className="relative group">
              <Lock className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} />
              <input 
                type="password" 
                required 
                placeholder="Senha"
                className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700 placeholder:text-stone-400"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div className="flex justify-end pt-1">
              <Link 
                href="/recuperar-senha" 
                className="text-sm font-semibold text-nutri-800 hover:text-nutri-900 transition-colors p-1"
              >
                Esqueceu sua senha?
              </Link>
            </div>

            {/* Botão Premium com feedback tátil no mobile */}
            <button 
              disabled={loading}
              className="w-full bg-nutri-900 text-white py-4 rounded-2xl font-semibold hover:bg-nutri-800 active:scale-[0.98] flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Entrar no Portal'}
            </button>
          </form>
        </div>
      </div>

      {/* LADO ESQUERDO: PAINEL DE CONTEXTO (Agora aparece embaixo no Mobile) */}
      <div className="order-2 lg:order-1 w-full lg:w-1/2 bg-stone-50 px-6 py-12 lg:p-12 relative flex flex-col items-center justify-center lg:border-r border-stone-200">
        <div className="max-w-md w-full animate-fade-in-up space-y-8 lg:space-y-12">
          
          {/* BLOCO DE LOGIN - BEM VINDO (Escondido no mobile pois já colocamos no topo) */}
          <div className="hidden lg:block text-center">
            <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
              <LogIn size={28} className="text-nutri-800" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900">Bem-vindo de volta!</h3>
            <p className="text-stone-500 mt-2">Acesse seu portal e veja seu plano alimentar.</p>
          </div>

          {/* BLOCO DE CONVITE - DESTAQUE VISUAL (Agora visível e lindo no mobile) */}
          <div className="bg-white p-6 lg:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-nutri-800"></div>
            <h4 className="text-xl font-bold text-stone-900 mb-3">Novo por aqui?</h4>
            <p className="text-stone-500 text-base mb-8 leading-relaxed">
              Para liberarmos seu acesso personalizado, precisamos entender seus objetivos e rotina. 
              <span className="block mt-3 font-semibold text-nutri-800 bg-nutri-50 w-fit px-3 py-1 rounded-lg">Leva apenas 2 minutos.</span>
            </p>
            <Link 
              href="/avaliacao" 
              className="w-full lg:w-auto inline-flex items-center justify-center gap-2 bg-nutri-800 text-white px-8 py-4 rounded-2xl text-sm font-bold hover:bg-nutri-900 active:scale-[0.98] transition-all shadow-md hover:shadow-lg"
            >
              Começar minha avaliação <ArrowRight size={18} />
            </Link>
          </div>

        </div>
      </div>

    </main>
  );
}