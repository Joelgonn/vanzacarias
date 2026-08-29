'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import PatientAppShell from './layout/PatientAppShell';
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
  // Rota real da Avaliação/QFA: /paciente/avaliacao (cobre também subrotas).
  const isPanel = pathname?.startsWith('/paciente/avaliacao');
  const isAdmin = pathname?.startsWith('/admin');

  // =========================================================================
  // VZ-007.1 — MOLDURA ÚNICA DO PACIENTE
  // Aplica a PatientAppShell (Sidebar desktop + coluna de conteúdo) em TODAS
  // as rotas da área autenticada do paciente, EXCETO o onboarding
  // (Completar Perfil), que permanece sem Sidebar.
  // A QFA (/paciente/avaliacao) já é isolada pelo isPanel, fora do /dashboard.
  // =========================================================================
  const isPatientFrame =
    !!pathname?.startsWith('/dashboard') &&
    !pathname?.startsWith('/dashboard/completar-perfil');

  // =========================================================================
  // VZ-008.3 FASE D — Footer de paciente (compacto)
  // O contexto autenticado do paciente (frame + onboarding) usa o footer
  // compacto; as rotas públicas mantêm o footer de marketing completo.
  // =========================================================================
  const isPatientFooter =
    isPatientFrame || !!pathname?.startsWith('/dashboard/completar-perfil');

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
        {isPatientFrame ? (
          <PatientAppShell>{children}</PatientAppShell>
        ) : (
          children
        )}
      </main>

      {/* 
          RODAPÉ
          Aparece se não for painel de avaliação.
          Variante compacta no contexto autenticado do paciente.
      */}
      {!isPanel && <Footer variant={isPatientFooter ? 'compact' : 'full'} />}

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