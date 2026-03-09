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
    <main className="min-h-screen bg-stone-50 p-8 md:p-12 font-sans text-stone-800">
      <div className="max-w-3xl mx-auto">
        
        {/* NAVEGAÇÃO PADRÃO (Mesmo estilo de "Meu Plano") */}
        <nav className="flex items-center justify-between mb-16 mt-12">
          <Link 
            href="/dashboard" 
            onClick={handleBack}
            className="group flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1 rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          
          <div className="text-sm font-bold text-stone-900 tracking-tight">
            Vanusa Zacarias Nutrição
          </div>
        </nav>

        {/* ÁREA DO FORMULÁRIO */}
        <div className="max-w-xl mx-auto">
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-3xl font-bold text-stone-900 mb-2">Check-in Semanal</h1>
            <p className="text-stone-500">Como foi sua semana? Vamos registrar seu progresso.</p>
          </div>
          
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
    </main>
  );
}