'use client';

import Link from 'next/link';
import { Instagram, Linkedin, Mail, ArrowUpRight, ArrowRight } from 'lucide-react';

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
    <footer className="relative bg-stone-950 text-stone-300 pt-24 pb-12 px-6 lg:px-8 overflow-hidden selection:bg-nutri-500 selection:text-white">
      {/* =========================================================================
          EFEITOS DE FUNDO PREMIUM (DEPTH & LIGHTING)
      ========================================================================= */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-stone-800 to-transparent opacity-50"></div>
      <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-nutri-900/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-stone-800/20 rounded-full blur-[100px] pointer-events-none"></div>

      {/* =========================================================================
          CONTEÚDO PRINCIPAL
      ========================================================================= */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-16 lg:gap-12 border-b border-stone-800/50 pb-20 mb-10 relative z-10">
        
        {/* COLUNA 1: LOGO E DESCRIÇÃO (Ocupa 4 colunas no Desktop) */}
        <div className="lg:col-span-4 flex flex-col items-start text-left">
          <Link href="/" className="group inline-flex flex-col">
            <span className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-stone-400 group-hover:to-white transition-all duration-500">
              Vanusa Zacarias
            </span>
            <span className="text-sm md:text-base font-light tracking-[0.2em] text-nutri-500 uppercase mt-1 group-hover:text-nutri-400 transition-colors duration-500">
              Nutrição Clı́nica
            </span>
          </Link>
          <p className="mt-6 text-stone-400 max-w-sm font-light leading-relaxed text-sm md:text-base">
            Sua parceira para uma vida mais saudável, equilibrada e feliz através de uma nutrição consciente, acolhedora e baseada em ciência.
          </p>
          
          {/* REDES SOCIAIS PREMIUM (Glassmorphism sutil) */}
          <div className="flex space-x-4 mt-10">
            <a 
              href={CONTACT_INFO.instagram} 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="Instagram da Vanusa"
              className="w-11 h-11 rounded-full bg-stone-900/50 backdrop-blur-sm border border-stone-800/60 flex items-center justify-center hover:bg-nutri-900/80 hover:border-nutri-500/50 hover:text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(var(--nutri-500-rgb),0.2)] active:scale-95 group"
            >
              <Instagram size={18} strokeWidth={1.5} className="group-hover:scale-110 transition-transform duration-300" />
            </a>
            <a 
              href={CONTACT_INFO.linkedin} 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="LinkedIn da Vanusa"
              className="w-11 h-11 rounded-full bg-stone-900/50 backdrop-blur-sm border border-stone-800/60 flex items-center justify-center hover:bg-blue-900/30 hover:border-blue-500/50 hover:text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] active:scale-95 group"
            >
              <Linkedin size={18} strokeWidth={1.5} className="group-hover:scale-110 transition-transform duration-300" />
            </a>
          </div>
        </div>

        {/* COLUNA 2: NAVEGAÇÃO (Ocupa 2 colunas no Desktop) */}
        <nav className="lg:col-span-2 lg:col-start-6">
          <h3 className="text-[11px] uppercase tracking-[0.25em] text-stone-100 font-bold mb-8 flex items-center gap-3 opacity-90">
            <span className="w-3 h-px bg-nutri-600 inline-block"></span>
            Menu
          </h3>
          <ul className="space-y-4">
            {NAV_LINKS.map((item) => (
              <li key={item.label}>
                <Link 
                  href={item.href} 
                  className="inline-flex items-center text-stone-400 hover:text-white transition-all duration-300 text-sm md:text-base font-light group py-1"
                >
                  <span className="w-0 group-hover:w-4 h-px bg-nutri-500 mr-0 group-hover:mr-3 transition-all duration-300 ease-out opacity-0 group-hover:opacity-100"></span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* COLUNA 3: ATENDIMENTO (Ocupa 3 colunas no Desktop) */}
        <address className="lg:col-span-3 not-italic">
          <h3 className="text-[11px] uppercase tracking-[0.25em] text-stone-100 font-bold mb-8 flex items-center gap-3 opacity-90">
            <span className="w-3 h-px bg-nutri-600 inline-block"></span>
            Contato
          </h3>
          <ul className="space-y-6">
            <li>
              <a 
                href={`mailto:${CONTACT_INFO.email}`} 
                className="group flex flex-col gap-2 py-1 items-start"
              >
                <div className="flex items-center gap-2 text-[10px] md:text-xs font-semibold text-stone-500 uppercase tracking-widest group-hover:text-nutri-400 transition-colors duration-300">
                  <Mail size={14} /> E-mail
                </div>
                <span className="text-sm md:text-base break-all font-light text-stone-300 group-hover:text-white transition-colors duration-300 relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-px after:bottom-0 after:left-0 after:bg-nutri-500 after:origin-bottom-right after:transition-transform after:duration-300 group-hover:after:scale-x-100 group-hover:after:origin-bottom-left">
                  {CONTACT_INFO.email}
                </span>
              </a>
            </li>
            <li>
              <a 
                href={`https://wa.me/${CONTACT_INFO.phoneRaw}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex flex-col gap-2 py-1 items-start"
              >
                <div className="flex items-center gap-2 text-[10px] md:text-xs font-semibold text-stone-500 uppercase tracking-widest group-hover:text-emerald-400 transition-colors duration-300">
                  <span className="relative flex h-2 w-2 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  WhatsApp
                </div>
                <div className="flex items-center gap-2 text-stone-300 group-hover:text-white transition-colors duration-300">
                  <span className="text-sm md:text-base font-light relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-px after:bottom-0 after:left-0 after:bg-emerald-500 after:origin-bottom-right after:transition-transform after:duration-300 group-hover:after:scale-x-100 group-hover:after:origin-bottom-left">
                    {CONTACT_INFO.phoneDisplay}
                  </span>
                  <ArrowUpRight size={16} className="text-stone-600 group-hover:text-emerald-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" />
                </div>
              </a>
            </li>
          </ul>
        </address>

        {/* COLUNA 4: AGREGANDO VALOR (NEWSLETTER / LEAD GEN) - Nova inserção estratégica */}
        <div className="lg:col-span-3">
          <h3 className="text-[11px] uppercase tracking-[0.25em] text-stone-100 font-bold mb-8 flex items-center gap-3 opacity-90">
            <span className="w-3 h-px bg-nutri-600 inline-block"></span>
            Dicas Semanais
          </h3>
          <p className="text-sm font-light text-stone-400 mb-6 leading-relaxed">
            Receba conteúdos exclusivos sobre saúde, receitas e bem-estar diretamente no seu e-mail.
          </p>
          <form className="relative flex items-center" onSubmit={(e) => e.preventDefault()}>
            <input 
              type="email" 
              placeholder="Seu melhor e-mail" 
              className="w-full bg-stone-900/50 border border-stone-800 rounded-full py-3.5 pl-5 pr-12 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-nutri-500 focus:ring-1 focus:ring-nutri-500 transition-all duration-300"
              required
            />
            <button 
              type="submit" 
              aria-label="Inscrever-se"
              className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-nutri-600 hover:bg-nutri-500 text-white rounded-full flex items-center justify-center transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-950 focus:ring-nutri-500 group"
            >
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>
        </div>
      </div>

      {/* =========================================================================
          RODAPÉ INFERIOR / LEGAL E COPYRIGHT
      ========================================================================= */}
      <div className="flex flex-col md:flex-row justify-between items-center text-[10px] md:text-xs font-medium text-stone-500 tracking-wider max-w-7xl mx-auto gap-6 text-center md:text-left relative z-10">
        <p className="font-light">
          &copy; {currentYear} Vanusa Zacarias Nutrição. <span className="hidden md:inline">Todos os direitos reservados.</span>
        </p>
        <div className="flex items-center gap-6">
          {LEGAL_LINKS.map(link => (
            <Link 
              key={link.label}
              href={link.href} 
              className="uppercase hover:text-stone-300 transition-colors duration-300 relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-px after:-bottom-1 after:left-0 after:bg-stone-400 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}