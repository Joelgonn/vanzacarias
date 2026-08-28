'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/ui/BackButton';
import { PatientPageShell, PageNavigation, PageContent } from '@/components/layout/PatientPageShell';
import CheckinForm from '@/components/CheckinForm';
import { toast } from 'sonner';

export default function CheckinPage() {
  const router = useRouter();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Função para lidar com a saída da página com alerta
  const handleBack = (e: React.MouseEvent) => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("Você tem alterações não salvas. Tem certeza que deseja sair?");
      if (!confirmLeave) {
        e.preventDefault();
      }
    }
  };

  return (
    <PatientPageShell maxWidth="max-w-3xl" className="bg-[#F8F9FA] pb-24 selection:bg-nutri-200">
      <PageNavigation>
        <BackButton href="/dashboard" label="Voltar ao Painel" onClick={handleBack} />
          
        <div className="text-right flex-1">
            <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-0.5">Nutrição Clínica</p>
            <h1 className="text-sm md:text-lg font-extrabold text-stone-900 tracking-tight truncate">
              Vanusa Zacarias
            </h1>
          </div>
        </PageNavigation>

        <PageContent>
        {/* ÁREA DO FORMULÁRIO */}
        <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">
          <div className="mb-6 md:mb-8 text-center sm:text-left animate-in fade-in slide-in-from-bottom-6 duration-700 delay-75">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-stone-900 mb-2 md:mb-3 tracking-tight">
              Check-in Semanal
            </h1>
            <p className="text-stone-500 text-sm md:text-base font-medium leading-relaxed">
              Como foi sua semana? Vamos registrar seu progresso para alinhar os próximos passos.
            </p>
          </div>
          
          {/* Caixa delimitadora (Sempre Card Branco, mesmo no Mobile) */}
          <div className="bg-white p-6 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-sm border border-stone-100 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 w-full mb-10">
            <CheckinForm 
              onFormChange={() => setHasUnsavedChanges(true)}
              onSuccess={() => {
                setHasUnsavedChanges(false);
                toast.success("Check-in enviado com sucesso! Muito obrigado pelo relato.");
                router.push('/dashboard');
              }} 
            />
          </div>
        </div>
        </PageContent>
    </PatientPageShell>
  );
}