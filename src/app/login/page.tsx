'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Loader2, ArrowRight, AlertCircle, Fingerprint } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  // =========================================================================
  // ESTADOS E HOOKS
  // =========================================================================
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  // =========================================================================
  // HANDLERS
  // =========================================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Preservando a lógica original de erro
      setError('Credenciais incorretas ou conta não encontrada.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <main className="min-h-[100dvh] flex flex-col lg:flex-row bg-stone-50 font-sans text-stone-800 selection:bg-nutri-500 selection:text-white">
      
      {/* 
          LADO ESQUERDO: PAINEL DE CONTEXTO E CONVITE 
          No mobile, desce para o final. No desktop, fica à esquerda com fundo cinza.
      */}
      <div className="order-2 lg:order-1 w-full lg:w-5/12 xl:w-1/2 px-6 py-12 lg:p-16 xl:p-24 flex flex-col justify-center relative overflow-hidden">
        
        {/* Efeito visual sutil de fundo */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-stone-100 to-transparent pointer-events-none"></div>
        
        <div className="max-w-md w-full mx-auto relative z-10 space-y-10 lg:space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* Título da área institucional (Visível apenas Desktop) */}
          <div className="hidden lg:block space-y-4">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center mb-8">
              <Fingerprint size={24} className="text-nutri-700" strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl xl:text-4xl font-extrabold text-stone-900 tracking-tight leading-tight">
              Seu portal exclusivo de saúde e bem-estar.
            </h1>
            <p className="text-stone-500 text-lg font-light leading-relaxed">
              Acesse seu plano alimentar, acompanhe sua evolução e mantenha o foco nos seus objetivos com praticidade.
            </p>
          </div>

          {/* CARD DE AVALIAÇÃO (Premium Call to Action) */}
          <div className="bg-white p-8 rounded-[2rem] border border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.03)] group transition-all duration-300 hover:shadow-[0_8px_40px_rgb(0,0,0,0.06)] hover:border-nutri-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nutri-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-nutri-500"></span>
              </span>
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-nutri-700">Novo por aqui?</h4>
            </div>
            
            <h3 className="text-xl font-bold text-stone-900 mb-2">Ainda não tem acesso?</h3>
            <p className="text-stone-500 text-sm mb-8 leading-relaxed font-light">
              Para liberarmos seu portal personalizado, precisamos entender sua rotina e objetivos através de uma rápida avaliação clínica.
            </p>
            
            <Link 
              href="/avaliacao" 
              className="w-full inline-flex items-center justify-between bg-stone-50 group-hover:bg-nutri-50 text-stone-700 group-hover:text-nutri-900 px-6 py-5 rounded-2xl text-sm font-bold transition-colors duration-300 border border-stone-100 group-hover:border-nutri-200 active:scale-[0.98]"
            >
              Começar minha avaliação 
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:bg-nutri-900 group-hover:text-white transition-colors">
                <ArrowRight size={16} />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* 
          LADO DIREITO: FORMULÁRIO DE LOGIN 
          No mobile aparece primeiro. Adicionado pt-24 (Padding Top) para compensar o Header Fixo!
      */}
      <div className="order-1 lg:order-2 w-full lg:w-7/12 xl:w-1/2 flex flex-col justify-center px-6 pt-24 pb-12 md:pt-40 md:pb-16 lg:pt-16 lg:px-16 xl:px-24 bg-white lg:rounded-l-[3rem] shadow-[0_0_0_1px_rgba(0,0,0,0.02)] lg:shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.03)] z-10 relative">
        <div className="max-w-md w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
          
          {/* Cabeçalho do Form */}
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900 mb-3">
              Acessar Conta
            </h2>
            <p className="text-stone-500 text-sm md:text-base font-light">
              Insira suas credenciais para acessar seu painel nutricional.
            </p>
          </div>
          
          {/* Alerta de Erro Elegante */}
          {error && (
            <div className="flex items-start gap-3 text-rose-600 bg-rose-50 p-4 rounded-2xl mb-8 border border-rose-100/50 animate-in fade-in zoom-in-95 duration-300">
              <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-500" />
              <p className="font-medium text-sm leading-snug">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Input E-mail Premium (Mais alto - py-5) */}
            <div className="relative group">
              <div className="absolute left-5 top-0 bottom-0 flex items-center pointer-events-none">
                <Mail className="text-stone-400 group-focus-within:text-nutri-600 transition-colors duration-300" size={20} strokeWidth={2} />
              </div>
              <input 
                type="email" 
                required 
                placeholder="Seu endereço de e-mail"
                className="w-full pl-14 pr-5 py-5 border border-stone-200/60 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-500/10 focus:border-nutri-500 outline-none transition-all duration-300 text-stone-800 placeholder:text-stone-400 font-medium text-[15px]"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Input Senha Premium (Mais alto - py-5) */}
            <div className="relative group">
              <div className="absolute left-5 top-0 bottom-0 flex items-center pointer-events-none">
                <Lock className="text-stone-400 group-focus-within:text-nutri-600 transition-colors duration-300" size={20} strokeWidth={2} />
              </div>
              <input 
                type="password" 
                required 
                placeholder="Sua senha"
                className="w-full pl-14 pr-5 py-5 border border-stone-200/60 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-500/10 focus:border-nutri-500 outline-none transition-all duration-300 text-stone-800 placeholder:text-stone-400 font-medium text-[15px]"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            {/* Link de Recuperação */}
            <div className="flex justify-end pt-2 pb-4">
              <Link 
                href="/recuperar-senha" 
                className="text-[14px] font-bold text-stone-500 hover:text-nutri-700 transition-colors duration-300 relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-px after:-bottom-0.5 after:left-0 after:bg-nutri-600 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
              >
                Esqueceu sua senha?
              </Link>
            </div>

            {/* Botão de Submit Premium (Mais alto - min-h-[64px] e fonte um pouco maior) */}
            <button 
              disabled={loading}
              className="w-full relative overflow-hidden group bg-stone-900 text-white min-h-[64px] rounded-2xl font-bold text-base hover:bg-nutri-900 transition-all duration-300 active:scale-[0.98] shadow-[0_8px_30px_-5px_rgba(0,0,0,0.15)] hover:shadow-[0_15px_40px_-10px_rgba(var(--nutri-900-rgb),0.4)] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-stone-900 disabled:active:scale-100 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Portal</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform duration-300 opacity-80 group-hover:opacity-100" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

    </main>
  );
}