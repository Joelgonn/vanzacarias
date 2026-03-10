'use client';

import { Calendar, MessageCircle, ChevronLeft, Clock } from 'lucide-react';
import Link from 'next/link';

export default function Agendamentos() {
  return (
    <main className="min-h-screen bg-stone-50 p-8 md:p-12 font-sans text-stone-800">
      <div className="max-w-3xl mx-auto">
        
        {/* NAVEGAÇÃO DE TOPO PADRONIZADA (Respiro pb-16 e mt-12) */}
        <nav className="flex items-center justify-between pb-16 mt-12">
          <Link 
            href="/dashboard" 
            className="group flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1 rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          
          <div className="text-sm font-bold text-stone-900 tracking-tight">
            Vanusa Zacarias Nutrição
          </div>
        </nav>
        
        {/* CARD CENTRAL DE AGENDAMENTO */}
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-stone-100 text-center">
          <div className="w-24 h-24 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <Calendar className="text-nutri-800" size={48} />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-6 tracking-tight">
            Agendar Consulta
          </h1>
          
          <p className="text-stone-500 text-lg mb-12 max-w-md mx-auto leading-relaxed">
            Deseja marcar seu retorno ou tirar uma dúvida técnica? A Vanusa reserva horários exclusivos para cada paciente.
          </p>
          
          <div className="flex flex-col gap-6 items-center">
            <a 
              href="https://wa.me/5544999997275?text=Olá%20Vanusa,%20gostaria%20de%20agendar%20minha%20próxima%20consulta!" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 bg-green-600 text-white px-10 py-4 rounded-full font-bold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 w-full sm:w-auto"
            >
              <MessageCircle size={22} /> Agendar via WhatsApp
            </a>
            
            <div className="flex items-center justify-center gap-2 text-stone-400 text-sm mt-4">
              <Clock size={16} /> Horário de atendimento: Seg a Sex, 08h às 18h
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}