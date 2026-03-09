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
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        fixed bottom-8 right-8 z-50
        bg-[#25D366] text-white p-4 rounded-full
        shadow-lg hover:shadow-xl
        transition-all duration-300 ease-out hover:-translate-y-1
        flex items-center justify-center
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}
      `}
      aria-label="Agende via WhatsApp"
    >
      <MessageCircle size={26} strokeWidth={1.5} />
    </a>
  );
}