'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import QFAForm from '@/components/QFAForm';
import { Apple, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import BackButton from '@/components/ui/BackButton';
import { PatientPageShell, PageNavigation, PageHeader, PageContent } from '@/components/layout/PatientPageShell';
import { isQfaResponseComplete } from '@/lib/patientJourney';
import { resolveNextOnboardingRoute } from '@/lib/onboarding/loadOnboardingState';
import OnboardingStepIntro from '@/components/onboarding/OnboardingStepIntro';
import { useOnboardingStepIntro } from '@/hooks/useOnboardingStepIntro';

export default function AvaliacaoPaciente() {
  const [alreadyAnswered, setAlreadyAnswered] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  const intro = useOnboardingStepIntro({
    step: 'raioX',
    supabase,
    enabled: !loading && !loadError && !alreadyAnswered,
  });

  useEffect(() => {
    async function checkExistingResponse() {
      setLoading(true);
      setLoadError(null);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Um registro só bloqueia a reentrada se estiver COMPLETO. Registro
      // incompleto deve poder ser corrigido, não virar um beco sem saída.
      const { data, error } = await supabase
        .from('qfa_responses')
        .select('answers')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao consultar respostas do QFA:', error.message);
        setLoadError('Não foi possível verificar sua avaliação agora. Tente novamente.');
        setLoading(false);
        return;
      }

      setAlreadyAnswered(isQfaResponseComplete(data?.answers));
      setLoading(false);
    }

    checkExistingResponse();
  }, [router, supabase, retryCount]);

  const handleSuccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const next = await resolveNextOnboardingRoute(supabase, session.user.id);
    if (next.unavailable) {
      toast.error('Avaliação salva, mas não foi possível verificar a próxima etapa agora.');
      router.push('/dashboard');
      return;
    }

    // Evita recarregar a própria etapa caso a persistência não tenha sido
    // reconhecida como completa — melhor manter o paciente no formulário.
    if (next.route === '/paciente/avaliacao') {
      toast.error('Não foi possível confirmar a conclusão da avaliação. Tente novamente.');
      return;
    }

    router.push(next.route ?? '/dashboard?qfa_success=true');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-rose-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle size={28} />
          </div>
          <h1 className="text-lg font-black text-stone-900">Não foi possível abrir a avaliação</h1>
          <p className="mt-2 text-sm font-medium text-stone-500">{loadError}</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-stone-800"
          >
            Tentar novamente
          </button>
        </div>
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
              <h1
                id="qfa-title"
                tabIndex={-1}
                className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight mb-4 leading-tight outline-none"
              >
                Raio-X Alimentar
              </h1>
              <p className="text-stone-500 text-sm md:text-lg leading-relaxed font-medium">
                Marque a quantidade de porções que você consome <b>semanalmente</b>, em média, de cada categoria abaixo. Atente-se à quantidade indicada em cada item. Seja o mais sincero possível!
              </p>
            </header>
            </PageHeader>

            <PageContent>
              <QFAForm
                onSuccess={handleSuccess}
                onboardingIntro={
                  <OnboardingStepIntro
                    stepKey="raioX"
                    open={intro.show}
                    completedCount={intro.snapshot?.completedCount ?? 0}
                    totalSteps={intro.snapshot?.totalSteps ?? 4}
                    onStart={intro.dismiss}
                    onDismiss={intro.dismiss}
                    focusTargetSelector="#qfa-title"
                  />
                }
              />
            </PageContent>
          </>
        )}
    </PatientPageShell>
  );
}