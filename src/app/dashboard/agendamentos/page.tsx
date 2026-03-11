'use client';

import { Calendar, MessageCircle, ChevronLeft, Clock } from 'lucide-react';
import Link from 'next/link';

export default function Agendamentos() {
  return (
    <main className="min-h-screen bg-stone-50 p-5 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-[88px] md:pt-20">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        
        {/* NAVEGAÇÃO DE TOPO PADRONIZADA */}
        <nav className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between pb-8 md:pb-16 mt-4 md:mt-12 gap-6 sm:gap-0 animate-fade-in-up">
          <Link 
            href="/dashboard" 
            className="group w-full sm:w-auto flex items-center justify-center sm:justify-start gap-3 bg-white px-6 py-4 sm:py-3 rounded-2xl sm:rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 active:scale-[0.98] transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1.5 sm:p-1 rounded-xl sm:rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          
          <div className="w-full sm:w-auto text-center sm:text-right text-xs md:text-sm font-bold text-stone-400 md:text-stone-900 uppercase md:normal-case tracking-widest md:tracking-tight">
            Vanusa Zacarias Nutrição
          </div>
        </nav>
        
        {/* CARD CENTRAL DE AGENDAMENTO */}
        <div className="flex-1 flex flex-col justify-center pb-10 md:pb-0">
          <div className="bg-white p-8 md:p-12 lg:p-16 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 text-center animate-fade-in-up relative overflow-hidden group" style={{ animationDelay: '0.1s' }}>
            
            {/* Efeito visual de fundo sutil */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-nutri-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 -z-10 group-hover:bg-green-50/50 transition-colors duration-700"></div>

            <div className="relative w-20 h-20 md:w-24 md:h-24 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 border-4 border-white shadow-sm group-hover:scale-105 transition-transform duration-500">
              <Calendar className="text-nutri-800" size={36} strokeWidth={1.5} />
              <div className="absolute inset-0 border border-nutri-100 rounded-full animate-ping opacity-20"></div>
            </div>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-4 md:mb-6 tracking-tight">
              Agendar Consulta
            </h1>
            
            <p className="text-stone-500 text-base md:text-lg mb-10 md:mb-12 max-w-md mx-auto leading-relaxed px-2 md:px-0">
              Deseja marcar seu retorno ou tirar uma dúvida técnica? A Vanusa reserva horários exclusivos para cada paciente.
            </p>
            
            <div className="flex flex-col gap-6 items-center">
              <a 
                href="https://wa.me/5544999997275?text=Olá%20Vanusa,%20gostaria%20de%20agendar%20minha%20próxima%20consulta!" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#25D366] text-white px-8 md:px-10 py-4 rounded-2xl md:rounded-full font-bold hover:bg-[#1ebd5b] active:scale-[0.98] transition-all shadow-lg hover:shadow-[#25D366]/30 transform md:hover:-translate-y-1"
              >
                <MessageCircle size={22} /> Agendar via WhatsApp
              </a>
              
              <div className="flex items-center justify-center gap-2 text-stone-400 text-xs md:text-sm mt-2 md:mt-4 bg-stone-50 md:bg-transparent py-2 px-4 rounded-lg md:rounded-none">
                <Clock size={16} className="shrink-0" /> 
                <span>Horário de atendimento: Seg a Sex, 08h às 18h</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}