'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import WhatsAppButton from './WhatsAppButton';
import Footer from './Footer';

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Define rotas que NÃO devem exibir Header, Footer e WhatsApp
  // Mantendo a lógica original e adicionando a verificação do Admin
  const isPanel = pathname?.startsWith('/avaliacao');
  const isAdmin = pathname?.startsWith('/admin');

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
          Footer: Aparece se não for painel de avaliação.
      */}
      {!isPanel && <Footer />}

      {/* 
          Botão de WhatsApp:
          Não aparece na avaliação (para não poluir o quiz)
          E NÃO aparece no Admin (conforme solicitado).
      */}
      {!isPanel && !isAdmin && (
        <WhatsAppButton
          phoneNumber="5544999997275"
          message="Olá Vanusa, gostaria de mais informações sobre seus serviços!"
        />
      )}
    </>
  );
}