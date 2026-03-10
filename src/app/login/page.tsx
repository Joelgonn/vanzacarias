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
    <main className="min-h-screen flex bg-white font-sans text-stone-800">
      
      {/* LADO ESQUERDO: PAINEL DE CONTEXTO */}
      <div className="hidden lg:flex w-1/2 bg-stone-50 p-12 relative items-center justify-center border-r border-stone-200">
        <div className="max-w-md w-full animate-fade-in-up space-y-12">
          
          {/* BLOCO DE LOGIN - BEM VINDO */}
          <div className="text-center">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6">
              <LogIn size={28} className="text-nutri-800" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900">Bem-vindo de volta!</h3>
            <p className="text-stone-500 mt-2">Acesse seu portal e veja seu plano alimentar.</p>
          </div>

          {/* BLOCO DE CONVITE - DESTAQUE VISUAL */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-nutri-100 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-nutri-800"></div>
            <h4 className="text-lg font-bold text-stone-900 mb-2">Novo por aqui?</h4>
            <p className="text-stone-500 text-sm mb-6 leading-relaxed">
              Para liberarmos seu acesso personalizado, precisamos entender seus objetivos e rotina. 
              <span className="block mt-2 font-medium text-nutri-800">O processo leva apenas 2 minutos.</span>
            </p>
            <Link 
              href="/avaliacao" 
              className="inline-flex items-center gap-2 bg-nutri-800 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-nutri-900 transition-all shadow-md hover:shadow-lg"
            >
              Começar minha avaliação <ArrowRight size={16} />
            </Link>
          </div>

        </div>
      </div>

      {/* LADO DIREITO: FORMULÁRIO DE LOGIN */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 py-12">
        <div className="max-w-md w-full mx-auto">
          <h2 className="text-3xl font-bold mb-8">Acessar Conta</h2>
          
          {error && (
            <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-xl mb-6 text-sm border border-red-100">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-stone-400" size={18} />
              <input 
                type="email" 
                required 
                placeholder="E-mail"
                className="w-full pl-11 py-3 border rounded-xl bg-stone-50 focus:ring-2 focus:ring-nutri-800 outline-none transition-all"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-stone-400" size={18} />
              <input 
                type="password" 
                required 
                placeholder="Senha"
                className="w-full pl-11 py-3 border rounded-xl bg-stone-50 focus:ring-2 focus:ring-nutri-800 outline-none transition-all"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {/* ADICIONE ESTA LINHA ABAIXO DO CAMPO DE SENHA */}
            <div className="flex justify-end">
              <Link 
                href="/recuperar-senha" 
                className="text-xs font-semibold text-nutri-800 hover:text-nutri-900 transition-colors"
              >
                Esqueceu sua senha?
              </Link>
            </div>

            <button 
              disabled={loading}
              className="w-full bg-nutri-900 text-white py-3.5 rounded-xl font-medium hover:bg-nutri-800 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Entrar no Portal'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}