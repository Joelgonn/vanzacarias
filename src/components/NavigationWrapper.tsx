'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import WhatsAppButton from './WhatsAppButton';
import Footer from './Footer';

// =========================================================================
// INTERFACES
// =========================================================================
interface NavigationWrapperProps {
  children: React.ReactNode;
}

export default function NavigationWrapper({ children }: NavigationWrapperProps) {
  // =========================================================================
  // HOOKS E REGRAS DE ROTA
  // =========================================================================
  const pathname = usePathname();
  
  // Define rotas que NÃO devem exibir Header, Footer e WhatsApp
  // Mantendo a lógica original e adicionando a verificação do Admin
  const isPanel = pathname?.startsWith('/avaliacao');
  const isAdmin = pathname?.startsWith('/admin');

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#FAFAFA] text-stone-900 selection:bg-nutri-500 selection:text-white overflow-x-hidden">
      
      {/* 
          CABEÇALHO
          O Header só é renderizado se não estivermos na rota definida em isPanel 
      */}
      {!isPanel && <Header />}
      
      {/* 
          CONTAINER PRINCIPAL (CONTEÚDO DA PÁGINA)
          - flex-1: Garante que o main cresça e empurre o Footer para o fundo (Sticky Footer)
          - animate-in fade-in: Cria uma transição de entrada suave entre as páginas (App-like feel)
          - w-full: Garante que não haverá quebra horizontal no mobile
      */}
      <main className="flex-1 flex flex-col relative w-full animate-in fade-in duration-700 ease-in-out">
        {children}
      </main>

      {/* 
          RODAPÉ
          Aparece se não for painel de avaliação.
      */}
      {!isPanel && <Footer />}

      {/* 
          BOTÃO DE WHATSAPP (FLUTUANTE)
          Não aparece na avaliação (para não poluir o quiz com distrações)
          Não aparece no Admin (conforme solicitado).
      */}
      {!isPanel && !isAdmin && (
        <WhatsAppButton
          phoneNumber="5544999997275"
          message="Olá Vanusa, gostaria de mais informações sobre seus serviços!"
        />
      )}
      
    </div>
  );
}