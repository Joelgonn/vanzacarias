'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import WhatsAppButton from './WhatsAppButton';
import Footer from './Footer';

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Define rotas que NÃO devem exibir Header, Footer e WhatsApp
  // No NavigationWrapper.tsx
  // Mantendo a lógica e o espaçamento exato do seu arquivo original
  const isPanel =          
                  pathname.startsWith('/avaliacao');

  return (
    <>
      {/* O Header só é renderizado se não estivermos na rota definida em isPanel */}
      {!isPanel && <Header />}
      
      {/* 
          Container principal: 
          Adicionamos flex-col e min-h-screen para garantir que o Footer 
          fique sempre no final da página, mesmo em telas mobile longas.
      */}
      <main className="min-h-screen flex flex-col relative">
        {children}
      </main>

      {/* 
          Footer e Botão de WhatsApp:
          Só aparecem se não for uma rota de "painel" (avaliação).
          Isso evita poluição visual no mobile durante o preenchimento do quiz.
      */}
      {!isPanel && (
        <>
          <Footer />
          <WhatsAppButton
            phoneNumber="5544999997275"
            message="Olá Vanusa, gostaria de mais informações sobre seus serviços!"
          />
        </>
      )}
    </>
  );
}