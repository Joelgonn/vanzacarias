'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
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
    <main className="min-h-screen bg-[#F8F9FA] p-4 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-[88px] md:pt-24 pb-24 selection:bg-nutri-200">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        
        {/* NAVEGAÇÃO DE TOPO PREMIUM */}
        <nav className="flex items-center justify-between mb-8 md:mb-12 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Link 
            href="/dashboard" 
            onClick={handleBack}
            className="flex items-center justify-center gap-2 h-11 md:h-12 px-4 md:px-5 bg-white border border-stone-200/80 rounded-xl md:rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:border-nutri-300 hover:shadow-md active:scale-[0.98] transition-all duration-300 text-stone-600 hover:text-nutri-700 group shrink-0"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-bold text-sm">Voltar <span className="hidden sm:inline">ao App</span></span>
          </Link>
          
          <div className="text-right flex-1">
            <p className="text-[10px] md:text-xs text-stone-400 uppercase font-bold tracking-widest mb-0.5">Nutrição Clínica</p>
            <h1 className="text-sm md:text-lg font-extrabold text-stone-900 tracking-tight truncate">
              Vanusa Zacarias
            </h1>
          </div>
        </nav>

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
        
      </div>
    </main>
  );
}