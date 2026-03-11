'use client';

import Link from 'next/link';
import Image from 'next/image'; // Import necessário
import { Menu, X, ArrowRight, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
    });

    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      subscription.unsubscribe();
    };
  }, [supabase]);

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Sobre Mim', href: '/#sobre' },
    { name: 'Serviços', href: '/#como-funciona' },
    { name: 'Blog', href: '/blog' },
    { name: 'Contato', href: '/#contato' },
    { 
      name: 'Agendar Consulta', 
      href: isLoggedIn ? '/dashboard/agendamentos' : '/login', 
      cta: true 
    },
  ];

  return (
    <header 
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-white/80 backdrop-blur-lg shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] py-3 md:py-4' 
          : 'bg-transparent py-6 md:py-8'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
        
        {/* LOGO + NOME */}
        <Link href="/" className="flex items-center gap-3 group relative z-[60]">
          <div className={`relative w-10 h-10 md:w-11 md:h-11 overflow-hidden transition-transform duration-500 ${isScrolled ? 'scale-90' : 'scale-100'}`}>
             <Image 
               src="/images/logo-vanusa.png" // Mantenha o caminho do seu arquivo
               alt="Logo Vanusa Zacarias"
               fill
               className="object-contain" // object-contain garante que a logo original não seja cortada
               priority
             />
          </div>
          <div className="flex flex-col">
            <span className={`text-lg md:text-xl font-bold tracking-tighter transition-colors duration-300 ${isScrolled ? 'text-nutri-900' : 'text-nutri-900'}`}>
              Vanusa Zacarias
            </span>
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-stone-500 -mt-1">
              Nutrição Clínica
            </span>
          </div>
        </Link>

        {/* Menu Desktop */}
        <div className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`
                text-[11px] uppercase tracking-[0.15em] font-bold transition-all duration-300 px-4 py-2 rounded-full
                ${item.cta 
                  ? 'bg-nutri-900 hover:bg-nutri-800 text-white ml-4 shadow-lg shadow-nutri-900/20 transform hover:-translate-y-0.5 active:scale-95' 
                  : 'text-stone-600 hover:text-nutri-800 hover:bg-stone-50'
                }
              `}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Botão Mobile */}
        <div className="md:hidden relative z-[60]">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`p-2.5 rounded-2xl transition-all duration-300 active:scale-90 ${
              isMobileMenuOpen 
                ? 'bg-stone-100 text-stone-900' 
                : isScrolled ? 'bg-stone-100 text-stone-900' : 'bg-white/20 backdrop-blur-md text-stone-900 border border-white/30'
            }`}
          >
            {isMobileMenuOpen ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={2} />}
          </button>
        </div>
      </nav>

      {/* Menu Mobile - Refatorado para ser um "Full Screen Overlay" Premium */}
      <div className={`
        fixed inset-0 bg-white z-[50] md:hidden transition-all duration-500 ease-in-out
        ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none translate-y-[-10px]'}
      `}>
        <div className="flex flex-col h-full pt-32 pb-10 px-8">
          <ul className="flex flex-col space-y-2">
            {navItems.map((item, index) => (
              <li 
                key={item.name}
                className={`transition-all duration-500 delay-[${index * 50}ms] ${isMobileMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
              >
                <Link
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center justify-between w-full text-xl tracking-tight font-bold p-4 rounded-2xl transition-all active:bg-stone-50
                    ${item.cta 
                      ? 'bg-nutri-900 text-white shadow-xl shadow-nutri-900/10 mt-6 active:scale-[0.98]' 
                      : 'text-stone-800 hover:text-nutri-800'
                    }
                  `}
                >
                  <span>{item.name}</span>
                  {item.cta ? <ArrowRight size={20} /> : <div className="w-1.5 h-1.5 rounded-full bg-stone-200"></div>}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-auto border-t border-stone-100 pt-8 flex flex-col gap-4">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest text-center">Atendimento Exclusivo</p>
            <div className="flex justify-center gap-4">
               <div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center text-nutri-800">
                  <User size={20} />
               </div>
               <div className="flex flex-col">
                  <span className="text-sm font-bold text-stone-900">Portal do Paciente</span>
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="text-xs text-nutri-800 font-bold">Acessar minha conta</Link>
               </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}