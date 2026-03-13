'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function Cadastro() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Cria o usuário no sistema de Autenticação
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
      // 2. Resgata os dados temporários do funil (Navegador)
      const savedAnswers = localStorage.getItem('quiz_answers');
      const savedWhatsapp = localStorage.getItem('lead_whatsapp');

      // 3. Cria o Perfil Oficial (Já injetando o WhatsApp do Lead)
      const { error: profileError } = await supabase.from('profiles').insert([
        { 
          id: data.user.id, 
          full_name: name, 
          role: 'patient',
          phone: savedWhatsapp || null // Puxa o telefone que ele digitou no Passo 1 do Quiz
        }
      ]);
      
      if (profileError) console.error("Erro ao criar perfil:", profileError);

      // 4. Salva a Avaliação Oficial
      if (savedAnswers) {
        await supabase.from('evaluations').insert([
          { user_id: data.user.id, answers: JSON.parse(savedAnswers) }
        ]);
        localStorage.removeItem('quiz_answers');
      }

      // 5. Atualiza o Lead para "Convertido" para limpar a fila de prospecção da Nutri
      if (savedWhatsapp) {
        await supabase
          .from('leads_avaliacao')
          .update({ status: 'convertido' })
          .eq('whatsapp', savedWhatsapp);
          
        localStorage.removeItem('lead_whatsapp');
      }
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50 p-6 animate-fade-in">
        <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-stone-100 text-center">
          <div className="w-20 h-20 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
             <CheckCircle2 size={40} className="text-nutri-800" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-stone-900 mb-4 tracking-tight">Bem-vindo(a), {name.split(' ')[0]}!</h2>
          <p className="text-stone-500 mb-10 leading-relaxed text-sm md:text-base">Cadastro realizado com sucesso. A Vanusa já tem acesso aos seus dados de avaliação.</p>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="w-full bg-nutri-900 text-white py-4 rounded-2xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-lg hover:shadow-xl"
          >
            Acessar meu Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 p-5 md:p-12">
      <div className="max-w-lg w-full bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 animate-fade-in-up">
        
        <div className="mb-10 text-center sm:text-left">
          <h2 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight mb-2">Crie sua conta</h2>
          <p className="text-stone-500 text-sm md:text-base font-light">Junte-se à nossa comunidade de vida saudável.</p>
        </div>

        {error && (
          <div className="mb-6 text-red-600 bg-red-50 p-4 rounded-2xl text-sm border border-red-100 font-medium animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="relative group">
            <User className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} />
            <input type="text" placeholder="Nome Completo" required value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700" />
          </div>
          
          <div className="relative group">
            <Mail className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} />
            <input type="email" placeholder="E-mail" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700" />
          </div>
          
          <div className="relative group">
            <Lock className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} />
            <input type="password" placeholder="Senha" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700" />
          </div>
          
          <button 
            disabled={loading} 
            className="w-full bg-nutri-900 text-white py-4 rounded-2xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-md hover:shadow-lg disabled:opacity-70 mt-4 flex items-center justify-center"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Finalizar Cadastro'}
          </button>
        </form>
        
        <p className="mt-8 text-center text-sm text-stone-500">
          Já possui uma conta? <a href="/login" className="text-nutri-800 font-bold hover:underline">Entrar agora</a>
        </p>
      </div>
    </main>
  );
}