'use client';

import Link from 'next/link';
import { Instagram, Linkedin, Mail, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const contactEmail = "contato@vanusazacariasnutri.com.br";
  const rawPhoneNumber = "5544999997275";
  const displayPhoneNumber = "(44) 99999-7275";

  return (
    <footer className="bg-stone-950 text-stone-300 pt-20 pb-12 px-6 lg:px-8 border-t border-stone-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-16 lg:gap-8 border-b border-stone-800/60 pb-16 mb-10">

        {/* LOGO E DESCRIÇÃO */}
        <div className="md:col-span-12 lg:col-span-5 flex flex-col items-start text-left">
          <Link href="/" className="text-2xl md:text-3xl font-bold text-white tracking-tight group">
            Vanusa Zacarias <span className="font-light text-stone-400 group-hover:text-nutri-800 transition-colors">Nutrição</span>
          </Link>
          <p className="mt-6 text-stone-400 max-w-sm font-light leading-relaxed text-base md:text-lg">
            Sua parceira para uma vida mais saudável, equilibrada e feliz através da nutrição consciente e baseada em ciência.
          </p>
          
          <div className="flex space-x-5 mt-8">
            <a 
              href="https://instagram.com/vanusazacariasnutri" 
              target="_blank" 
              rel="noreferrer" 
              className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center hover:bg-nutri-800 hover:text-white transition-all duration-300 shadow-lg active:scale-90"
            >
              <Instagram size={20} strokeWidth={1.5} />
            </a>
            <a 
              href="https://linkedin.com/in/vanusazacariasnutri" 
              target="_blank" 
              rel="noreferrer" 
              className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center hover:bg-nutri-800 hover:text-white transition-all duration-300 shadow-lg active:scale-90"
            >
              <Linkedin size={20} strokeWidth={1.5} />
            </a>
          </div>
        </div>

        {/* NAVEGAÇÃO */}
        <div className="md:col-span-6 lg:col-span-3 lg:col-start-7">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white font-black mb-8 border-l-2 border-nutri-800 pl-3">
            Navegação
          </h3>
          <ul className="space-y-5 font-light">
            {['Home', 'Sobre Mim', 'Serviços', 'Blog', 'Contato'].map((item) => (
              <li key={item}>
                <Link 
                  href={`/${item.toLowerCase().replace(' ', '-')}`} 
                  className="hover:text-white transition-all duration-300 text-sm md:text-base flex items-center group py-1"
                >
                  <span className="w-0 group-hover:w-4 h-px bg-nutri-800 mr-0 group-hover:mr-3 transition-all duration-300"></span>
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ATENDIMENTO */}
        <div className="md:col-span-6 lg:col-span-3">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white font-black mb-8 border-l-2 border-nutri-800 pl-3">
            Atendimento
          </h3>
          <ul className="space-y-6 font-light text-stone-400">
            <li>
              <a 
                href={`mailto:${contactEmail}`} 
                className="hover:text-white transition-colors flex flex-col gap-1 group py-1"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-widest">
                  <Mail size={14} className="text-nutri-800" /> E-mail
                </div>
                <span className="text-sm md:text-base break-all">{contactEmail}</span>
              </a>
            </li>
            <li>
              <a 
                href={`https://wa.me/${rawPhoneNumber}`} 
                target="_blank" 
                rel="noreferrer" 
                className="hover:text-white transition-colors flex flex-col gap-1 group py-1"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> WhatsApp
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm md:text-base font-medium">{displayPhoneNumber}</span>
                  <ArrowUpRight size={14} className="text-nutri-800 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* RODAPÉ INFERIOR */}
      <div className="flex flex-col md:flex-row justify-between items-center text-[10px] md:text-xs font-medium text-stone-600 tracking-[0.1em] uppercase max-w-7xl mx-auto gap-4 text-center md:text-left">
        <p>&copy; {currentYear} Vanusa Zacarias Nutrição. Todos os direitos reservados.</p>
        <div className="flex items-center gap-6">
          <Link href="/privacidade" className="hover:text-stone-400 transition-colors">Privacidade</Link>
          <Link href="/termos" className="hover:text-stone-400 transition-colors">Termos</Link>
        </div>
      </div>
    </footer>
  );
}