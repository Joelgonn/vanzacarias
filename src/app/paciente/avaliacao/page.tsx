'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import QFAForm from '@/components/QFAForm';
import { Apple, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import BackButton from '@/components/ui/BackButton';
import { PatientPageShell, PageNavigation, PageHeader, PageContent } from '@/components/layout/PatientPageShell';

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
    <PatientPageShell maxWidth="max-w-2xl" className="bg-stone-50 relative">
      <PageNavigation>
        <BackButton href="/dashboard" label="Voltar ao Painel" />
        <div className="bg-white p-3 rounded-2xl text-nutri-800 border border-stone-100 shadow-sm">
          <Apple size={24} />
        </div>
      </PageNavigation>

        {alreadyAnswered ? (
          /* TELA DE BLOQUEIO: Já respondeu */
          <PageContent>
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
          </PageContent>
        ) : (
          /* TELA NORMAL: Ainda não respondeu */
          <>
            <PageHeader>
            <header style={{ animationDelay: '0.1s' }}>
              <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight mb-4 leading-tight">
                Raio-X Alimentar
              </h1>
              <p className="text-stone-500 text-sm md:text-lg leading-relaxed font-medium">
                Marque a quantidade de porções que você consome <b>semanalmente</b>, em média, de cada categoria abaixo. Atente-se à quantidade indicada em cada item. Seja o mais sincero possível!
              </p>
            </header>
            </PageHeader>

            <PageContent>
              <QFAForm onSuccess={handleSuccess} />
            </PageContent>
          </>
        )}
    </PatientPageShell>
  );
}