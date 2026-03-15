'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import QFAForm from '@/components/QFAForm';
import { ChevronLeft, Apple, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AvaliacaoPaciente() {
  const [alreadyAnswered, setAlreadyAnswered] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkExistingResponse() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Verifica se já existe um registro para este usuário
      const { data } = await supabase
        .from('qfa_responses')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (data) {
        setAlreadyAnswered(true);
      }
      setLoading(false);
    }

    checkExistingResponse();
  }, [router, supabase]);

  const handleSuccess = () => {
    router.push('/dashboard?qfa_success=true');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 pt-48 md:pt-60 font-sans text-stone-800">
      <div className="max-w-2xl mx-auto flex flex-col gap-10">
        
        <div className="flex items-center justify-between animate-fade-in-up relative z-10">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 text-stone-500 hover:text-nutri-900 transition-all font-bold text-sm bg-white px-5 py-3 rounded-full border border-stone-200 shadow-sm active:scale-95"
          >
            <ChevronLeft size={18} /> Voltar ao Painel
          </Link>
          <div className="bg-white p-3 rounded-2xl text-nutri-800 border border-stone-100 shadow-sm">
            <Apple size={24} />
          </div>
        </div>

        {alreadyAnswered ? (
          /* TELA DE BLOQUEIO: Já respondeu */
          <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-stone-100 text-center animate-fade-in-up">
            <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
              <CheckCircle2 size={40} />
            </div>
            <h1 className="text-3xl font-black text-stone-900 mb-4 tracking-tight">Avaliação Concluída!</h1>
            <p className="text-stone-500 leading-relaxed mb-10">
              Você já enviou seu Raio-X Alimentar. Os dados já estão com a <b>Nutri Vanusa</b> para a elaboração do seu cardápio.
            </p>
            <Link 
              href="/dashboard" 
              className="inline-block bg-nutri-900 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-nutri-800 transition-all"
            >
              Voltar para o Início
            </Link>
          </div>
        ) : (
          /* TELA NORMAL: Ainda não respondeu */
          <>
            <header className="animate-fade-in-up relative z-10" style={{ animationDelay: '0.1s' }}>
              <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight mb-4 leading-tight">
                Raio-X Alimentar
              </h1>
              <p className="text-stone-500 text-sm md:text-lg leading-relaxed font-medium">
                Marque a quantidade de porções que você consome <b>semanalmente</b>, em média, de cada categoria abaixo. Atente-se à quantidade indicada em cada item. Seja o mais sincero possível!
              </p>
            </header>

            <div className="animate-fade-in-up relative z-10" style={{ animationDelay: '0.2s' }}>
              <QFAForm onSuccess={handleSuccess} />
            </div>
          </>
        )}

      </div>
    </main>
  );
}