'use client';

import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface WhatsAppButtonProps {
  phoneNumber: string;
  message?: string;
}

export default function WhatsAppButton({ phoneNumber, message }: WhatsAppButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => setIsVisible(window.scrollY > 150);
    window.addEventListener('scroll', toggleVisibility);
    const initialTimer = setTimeout(() => setIsVisible(true), 2000);

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
      clearTimeout(initialTimer);
    };
  }, []);

  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message || "Olá Vanusa, gostaria de agendar uma consulta!")}`;

  return (
    <div className={`
      fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 transition-all duration-500
      ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-0 pointer-events-none'}
    `}>
      {/* Efeito de Ondulação (Pulse) Premium */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-25"></span>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="
          relative
          bg-[#25D366] text-white p-4 md:p-5 rounded-full
          shadow-[0_10px_25px_-5px_rgba(37,211,102,0.4)]
          hover:shadow-[0_15px_30px_-5px_rgba(37,211,102,0.6)]
          transition-all duration-300 ease-out 
          hover:-translate-y-2 active:scale-90
          flex items-center justify-center
          group
        "
        aria-label="Agende via WhatsApp"
      >
        <MessageCircle 
          size={28} 
          strokeWidth={1.5} 
          className="group-hover:rotate-12 transition-transform duration-300" 
        />
        
        {/* Tooltip Mobile Friendly (Apenas surge no hover longo ou desktop) */}
        <span className="absolute right-full mr-4 bg-stone-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden md:block">
          Falar com Vanusa
        </span>
      </a>
    </div>
  );
}