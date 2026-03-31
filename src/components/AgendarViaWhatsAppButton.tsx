'use client';

import { MessageCircle } from 'lucide-react';

// src/components/AgendarViaWhatsAppButton.tsx
export default function AgendarViaWhatsAppButton() {
  return (
    <a 
      href="https://wa.me/5544999997275" 
      target="_blank" 
      rel="noopener noreferrer"
      className="group relative inline-flex items-center justify-center gap-3.5 px-8 py-4 rounded-2xl md:rounded-[2rem] font-bold text-base md:text-[17px] text-white w-full sm:w-auto transition-all duration-300 overflow-hidden active:scale-[0.97] bg-gradient-to-r from-[#1EBE5D] to-[#25D366] hover:from-[#1da753] hover:to-[#22c35e] shadow-[0_8px_25px_rgba(37,211,102,0.35)] hover:shadow-[0_12px_35px_rgba(37,211,102,0.45)] hover:-translate-y-0.5"
      aria-label="Agendar consulta via WhatsApp"
    >
      {/* Efeito de Vidro/Borda Interna Superior (Garante o visual premium 3D) */}
      <div className="absolute inset-0 rounded-2xl md:rounded-[2rem] border-t border-white/20 pointer-events-none" />

      {/* Efeito de Brilho Animado no Hover (Microinteração de conversão) */}
      <div className="absolute top-0 -left-[100%] w-[120%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out pointer-events-none skew-x-[-20deg]" />

      {/* Ícone com peso visual ajustado */}
      <MessageCircle 
        size={24} 
        strokeWidth={2.5} 
        className="relative z-10 group-hover:-rotate-12 group-hover:scale-110 transition-all duration-300 drop-shadow-sm" 
      />
      
      {/* Texto com tracking ajustado para melhor leitura */}
      <span className="relative z-10 tracking-tight drop-shadow-sm">
        Agendar via WhatsApp
      </span>
    </a>
  );
}