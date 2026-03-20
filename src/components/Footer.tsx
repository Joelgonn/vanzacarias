'use client';

import Link from 'next/link';
import { Instagram, Linkedin, Mail, ArrowUpRight } from 'lucide-react';

// =========================================================================
// CONSTANTES E DADOS
// =========================================================================
const CONTACT_INFO = {
  email: "contato@vanusazacariasnutri.com.br",
  phoneRaw: "5544999997275",
  phoneDisplay: "(44) 99999-7275",
  instagram: "https://instagram.com/vanusazacariasnutri",
  linkedin: "https://linkedin.com/in/vanusazacariasnutri",
};

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Sobre Mim', href: '/#sobre' },
  { label: 'Serviços', href: '/#como-funciona' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contato', href: '/#contato' },
];

const LEGAL_LINKS = [
  { label: 'Privacidade', href: '/privacidade' },
  { label: 'Termos de Uso', href: '/termos' },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-stone-950 text-stone-300 pt-20 pb-12 px-6 lg:px-8 border-t border-stone-900 overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-16 lg:gap-8 border-b border-stone-800/60 pb-16 mb-10 relative">

        {/* EFEITO DE LUZ DE FUNDO SUTIL */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-nutri-900/10 rounded-full blur-[100px] -translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        {/* LOGO E DESCRIÇÃO */}
        <div className="md:col-span-12 lg:col-span-5 flex flex-col items-start text-left relative z-10">
          <Link href="/" className="text-2xl md:text-3xl font-extrabold text-white tracking-tight group">
            Vanusa Zacarias <span className="font-light text-stone-400 group-hover:text-nutri-500 transition-colors duration-500">Nutrição</span>
          </Link>
          <p className="mt-6 text-stone-400 max-w-sm font-light leading-relaxed text-base md:text-lg">
            Sua parceira para uma vida mais saudável, equilibrada e feliz através da nutrição consciente e baseada em ciência.
          </p>
          
          <div className="flex space-x-4 mt-8">
            <a 
              href={CONTACT_INFO.instagram} 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="Instagram da Vanusa"
              className="w-12 h-12 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-center hover:bg-nutri-900 hover:border-nutri-700 hover:text-white transition-all duration-300 shadow-lg active:scale-90 group"
            >
              <Instagram size={20} strokeWidth={1.5} className="group-hover:scale-110 transition-transform duration-300" />
            </a>
            <a 
              href={CONTACT_INFO.linkedin} 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="LinkedIn da Vanusa"
              className="w-12 h-12 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-center hover:bg-blue-900 hover:border-blue-700 hover:text-white transition-all duration-300 shadow-lg active:scale-90 group"
            >
              <Linkedin size={20} strokeWidth={1.5} className="group-hover:scale-110 transition-transform duration-300" />
            </a>
          </div>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <nav className="md:col-span-6 lg:col-span-3 lg:col-start-7 relative z-10">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-stone-100 font-black mb-8 border-l-2 border-nutri-800 pl-4">
            Navegação
          </h3>
          <ul className="space-y-4 font-light">
            {NAV_LINKS.map((item) => (
              <li key={item.label}>
                <Link 
                  href={item.href} 
                  className="inline-flex items-center text-stone-400 hover:text-white transition-colors duration-300 text-sm md:text-base group py-1 relative"
                >
                  <span className="w-0 group-hover:w-3 h-px bg-nutri-500 mr-0 group-hover:mr-3 transition-all duration-300 ease-out"></span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ATENDIMENTO E CONTATO */}
        <address className="md:col-span-6 lg:col-span-3 not-italic relative z-10">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-stone-100 font-black mb-8 border-l-2 border-nutri-800 pl-4">
            Atendimento
          </h3>
          <ul className="space-y-6 font-light text-stone-400">
            <li>
              <a 
                href={`mailto:${CONTACT_INFO.email}`} 
                className="hover:text-white transition-colors flex flex-col gap-1.5 group py-1"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-widest">
                  <Mail size={14} className="text-nutri-600 group-hover:text-nutri-500 transition-colors" /> E-mail
                </div>
                <span className="text-sm md:text-base break-all font-medium text-stone-300">{CONTACT_INFO.email}</span>
              </a>
            </li>
            <li>
              <a 
                href={`https://wa.me/${CONTACT_INFO.phoneRaw}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-white transition-colors flex flex-col gap-1.5 group py-1"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-widest">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  WhatsApp
                </div>
                <div className="flex items-center gap-2 text-stone-300">
                  <span className="text-sm md:text-base font-medium">{CONTACT_INFO.phoneDisplay}</span>
                  <ArrowUpRight size={16} className="text-nutri-600 group-hover:text-nutri-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                </div>
              </a>
            </li>
          </ul>
        </address>
      </div>

      {/* RODAPÉ INFERIOR / LEGAL */}
      <div className="flex flex-col md:flex-row justify-between items-center text-[10px] md:text-xs font-medium text-stone-500 tracking-[0.1em] uppercase max-w-7xl mx-auto gap-6 text-center md:text-left relative z-10">
        <p>&copy; {currentYear} Vanusa Zacarias Nutrição. Todos os direitos reservados.</p>
        <div className="flex items-center gap-6">
          {LEGAL_LINKS.map(link => (
            <Link 
              key={link.label}
              href={link.href} 
              className="hover:text-stone-300 transition-colors duration-300"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}