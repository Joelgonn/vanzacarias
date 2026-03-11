'use client';

import { MessageCircle } from 'lucide-react';

// src/components/AgendarViaWhatsAppButton.tsx
export default function AgendarViaWhatsAppButton() {
  return (
    <a 
      href="https://wa.me/5544999997275" // Mantendo o padrão do número visto nos arquivos anteriores
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-3 bg-[#25D366] text-white px-8 py-4 rounded-2xl md:rounded-full font-bold text-base shadow-lg shadow-green-200 hover:bg-[#1ebd5b] active:scale-[0.98] transition-all w-full sm:w-auto group"
    >
      <MessageCircle size={22} className="group-hover:rotate-12 transition-transform" />
      <span>Agendar via WhatsApp</span>
    </a>
  );
}