'use client';

import { MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// =========================================================================
// INTERFACES
// =========================================================================
interface WhatsAppButtonProps {
  phoneNumber: string;
  message?: string;
}

const PRIVATE_ROUTES = ['/dashboard', '/paciente', '/admin'];

export default function WhatsAppButton({ phoneNumber, message }: WhatsAppButtonProps) {
  // =========================================================================
  // ESTADOS E HOOKS
  // =========================================================================
  const [isVisible, setIsVisible] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('wa_interacted') === 'true';
  });
  const pathname = usePathname();

  // VERIFICAÇÃO INTELIGENTE (Mantida do original)
  // Evita renderizar em áreas logadas para não conflitar com IA ou dashboards.
  const isPrivateArea = PRIVATE_ROUTES.some(route => pathname?.startsWith(route));

  // Lógica de Visibilidade e Temporizadores
  useEffect(() => {
    if (isPrivateArea) return;

    // Função de exibição baseada no scroll
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY > 100) setIsVisible(true);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Fallback: se o usuário não rolar, mostra após 3 segundos
    const initialTimer = setTimeout(() => setIsVisible(true), 3000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(initialTimer);
    };
  }, [isPrivateArea]);

  // Lógica do Balão de Boas-Vindas Dinâmico
  useEffect(() => {
    let greetingTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;

    if (isVisible && !hasInteracted) {
      // Mostra o balão 1.5s após o botão de WhatsApp aparecer
      greetingTimer = setTimeout(() => setShowGreeting(true), 1500);
      
      // Oculta o balão automaticamente após 8 segundos para não poluir a tela
      hideTimer = setTimeout(() => setShowGreeting(false), 9500);
    }

    return () => {
      clearTimeout(greetingTimer);
      clearTimeout(hideTimer);
    };
  }, [isVisible, hasInteracted]);

  // =========================================================================
  // HANDLERS
  // =========================================================================
  const track = (event: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TRACK]', event);
    }
  };

  const persistInteraction = () => {
    setHasInteracted(true);
    localStorage.setItem('wa_interacted', 'true');
  };

  const dismissGreeting = (e: React.MouseEvent) => {
    e.preventDefault(); // Evita abrir o link do WhatsApp ao clicar no X
    setShowGreeting(false);
    persistInteraction();
  };

  const handleWhatsAppClick = () => {
    track('whatsapp_click');
    setShowGreeting(false);
    persistInteraction();
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  if (isPrivateArea) {
    return null; 
  }

  const defaultMessage = `Ola Vanusa, vim pelo site e gostaria de agendar uma consulta. (${pathname || '/'})`;
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message || defaultMessage)}`;

  return (
    <div className={`
      fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-3
      transition-all duration-700 ease-[0.32,0.72,0,1]
      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}
    `}>
      
      {/* 
          BALÃO DE SAUDAÇÃO (CHAT BUBBLE)
          Estratégia de alta conversão para mobile e desktop
      */}
      <div 
        className={`
          relative bg-white text-stone-800 p-4 rounded-2xl rounded-br-sm shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-stone-100 max-w-[220px] md:max-w-[250px]
          transition-all duration-500 origin-bottom-right
          ${showGreeting ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4 pointer-events-none'}
        `}
      >
        <button 
          onClick={dismissGreeting}
          className="absolute top-2 right-2 p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
          aria-label="Fechar mensagem"
        >
          <X size={12} strokeWidth={3} />
        </button>
        <p className="text-sm font-medium leading-snug pr-4">
          Olá! Precisa de ajuda para agendar sua consulta? 👋
        </p>
      </div>

      {/* 
          BOTÃO PRINCIPAL DO WHATSAPP
      */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleWhatsAppClick}
        className="relative group flex items-center justify-center outline-none focus-visible:ring-4 focus-visible:ring-green-500/50 rounded-full"
        aria-label="Agende sua consulta via WhatsApp"
      >
        {/* Animação sutil de pulso de fundo */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20 duration-1000"></span>

        {/* Botão Físico */}
        <div className="
          relative w-14 h-14 md:w-16 md:h-16 bg-gradient-to-b from-[#25D366] to-[#128C7E] text-white rounded-full
          shadow-[0_8px_25px_-5px_rgba(37,211,102,0.5)] border border-white/20
          hover:shadow-[0_15px_35px_-5px_rgba(37,211,102,0.6)]
          transition-all duration-300 ease-out 
          group-hover:-translate-y-1.5 group-active:scale-95 group-active:translate-y-0
          flex items-center justify-center
        ">
          <MessageCircle 
            size={28} 
            strokeWidth={2} 
            className="group-hover:scale-110 transition-transform duration-300 fill-white/10" 
          />
          
          {/* 
              BADGE DE NOTIFICAÇÃO (Gatilho Psicológico)
              Fica visível apenas se o usuário ainda não clicou no botão
          */}
          {!hasInteracted && (
            <span className="absolute top-0 -right-1 flex h-4 w-4 md:h-5 md:w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 md:h-5 md:w-5 bg-rose-500 border-2 border-white items-center justify-center text-[8px] md:text-[9px] font-bold text-white leading-none">
                1
              </span>
            </span>
          )}
        </div>

        {/* 
            TOOLTIP SECUNDÁRIO (Apenas Desktop - no Hover longo)
            Aparece quando o balão principal já sumiu e o usuário passa o mouse
        */}
        {!showGreeting && (
          <span className="absolute right-full mr-4 bg-stone-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden md:block shadow-lg">
            Falar com Vanusa
          </span>
        )}
      </a>
    </div>
  );
}
