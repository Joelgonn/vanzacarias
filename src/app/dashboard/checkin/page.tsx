'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import CheckinForm from '@/components/CheckinForm';

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
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-[88px] md:pt-20 pb-24">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        
        {/* NAVEGAÇÃO DE TOPO PADRONIZADA */}
        <nav className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between mb-8 md:mb-16 mt-4 md:mt-12 gap-6 sm:gap-0 animate-fade-in-up">
          <Link 
            href="/dashboard" 
            onClick={handleBack}
            className="group w-full sm:w-auto flex items-center justify-center sm:justify-start gap-3 bg-white px-6 py-4 sm:py-3 rounded-2xl sm:rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 active:scale-[0.98] transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1.5 sm:p-1 rounded-xl sm:rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          
          <div className="w-full sm:w-auto text-center sm:text-right text-xs md:text-sm font-bold text-stone-400 md:text-stone-900 uppercase md:normal-case tracking-widest md:tracking-tight">
            Vanusa Zacarias Nutrição
          </div>
        </nav>

        {/* ÁREA DO FORMULÁRIO */}
        <div className="max-w-xl mx-auto w-full flex-1">
          <div className="mb-6 md:mb-10 text-center sm:text-left px-4 sm:px-0 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-3 md:mb-2 tracking-tight">
              Check-in Semanal
            </h1>
            <p className="text-stone-500 text-sm md:text-base leading-relaxed">
              Como foi sua semana? Vamos registrar seu progresso.
            </p>
          </div>
          
          {/* Caixa delimitadora que envolve o formulário no desktop, e se mistura com o fundo no mobile */}
          <div className="bg-white sm:bg-white sm:p-8 md:p-10 sm:rounded-[2rem] sm:shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:border border-stone-100 animate-fade-in-up w-full" style={{ animationDelay: '0.2s' }}>
            <CheckinForm 
              onFormChange={() => setHasUnsavedChanges(true)}
              onSuccess={() => {
                setHasUnsavedChanges(false);
                alert("Check-in realizado com sucesso!");
                router.push('/dashboard');
              }} 
            />
          </div>
        </div>
        
      </div>
    </main>
  );
}