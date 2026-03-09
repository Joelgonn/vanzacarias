'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import WhatsAppButton from './WhatsAppButton';
import Footer from './Footer';

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Define rotas que NÃO devem exibir Header, Footer e WhatsApp
  // No NavigationWrapper.tsx
  const isPanel =          
                  pathname.startsWith('/avaliacao');

  return (
    <>
      {!isPanel && <Header />}
      
      <main className="min-h-screen">
        {children}
      </main>

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