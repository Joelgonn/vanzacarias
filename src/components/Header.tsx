'use client';

import Link from 'next/link';
import Image from 'next/image';
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  LayoutDashboard, 
  FileText, 
  Calendar,
  ChevronRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const supabase = createClient();
  const router = useRouter();

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsMobileMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  return (
    <header 
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-white/80 backdrop-blur-lg shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] py-3' 
          : 'bg-transparent py-5'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
        
        {/* LOGO + NOME */}
        <Link href="/" className="flex items-center gap-3 group relative z-[60]">
          <div className={`relative w-10 h-10 overflow-hidden transition-transform duration-500 ${isScrolled ? 'scale-90' : 'scale-100'}`}>
             <Image 
               src="/images/logo-vanusa.png" 
               alt="Logo Vanusa Zacarias"
               fill
               className="object-contain" 
               priority
             />
          </div>
          <div className="flex flex-col">
            <span className="text-xl md:text-2xl font-bold tracking-tighter text-nutri-900 leading-none">
              Vanusa Zacarias
            </span>
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
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
                  ? 'bg-nutri-900 hover:bg-nutri-800 text-white ml-4 shadow-lg shadow-nutri-900/20 transform hover:-translate-y-0.5' 
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
            className={`p-3 rounded-xl transition-all duration-300 active:scale-95 ${
              isMobileMenuOpen 
                ? 'bg-stone-100 text-stone-900' 
                : isScrolled ? 'bg-stone-100 text-stone-900' : 'bg-white/20 backdrop-blur-md border border-white/30 text-stone-900'
            }`}
          >
            {isMobileMenuOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
        </div>
      </nav>

      {/* MENU MOBILE (Refatorado para Proporção e Elegância) */}
      <div className={`
        fixed inset-0 bg-white z-[50] md:hidden transition-all duration-500 ease-in-out
        ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}
      `}>
        <div className="flex flex-col h-full pt-28 pb-8 px-6 overflow-y-auto">
          
          {/* BARRA DE FERRAMENTAS DO PACIENTE (Proporcional e Delicada) */}
          {isLoggedIn && (
            <div className="mb-10 bg-stone-50/80 p-4 rounded-3xl border border-stone-100">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-4 text-center">Acesso Rápido</p>
              <div className="flex justify-between items-center px-2">
                <Link 
                  href="/dashboard" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1.5 text-stone-600 hover:text-nutri-800 transition-colors"
                >
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-stone-100"><LayoutDashboard size={18} /></div>
                  <span className="text-[9px] font-bold uppercase tracking-wider">Painel</span>
                </Link>
                <Link 
                  href="/dashboard/meu-plano" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1.5 text-stone-600 hover:text-nutri-800 transition-colors"
                >
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-stone-100"><FileText size={18} /></div>
                  <span className="text-[9px] font-bold uppercase tracking-wider">Plano</span>
                </Link>
                <Link 
                  href="/dashboard/perfil" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1.5 text-stone-600 hover:text-nutri-800 transition-colors"
                >
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-stone-100"><User size={18} /></div>
                  <span className="text-[9px] font-bold uppercase tracking-wider">Perfil</span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="flex flex-col items-center gap-1.5 text-red-500 hover:text-red-700 transition-colors"
                >
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100"><LogOut size={18} /></div>
                  <span className="text-[9px] font-bold uppercase tracking-wider">Sair</span>
                </button>
              </div>
            </div>
          )}

          {/* LISTA DE NAVEGAÇÃO DO SITE */}
          <div className="flex-1">
            <ul className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center justify-between w-full p-4 rounded-2xl transition-all active:bg-stone-50 group
                      ${item.cta 
                        ? 'bg-nutri-900 text-white mt-6 font-bold shadow-lg shadow-nutri-900/20' 
                        : 'text-stone-800 font-semibold text-lg'
                      }
                    `}
                  >
                    <span>{item.name}</span>
                    {/* ChevronRight é mais sutil e elegante para listas do que o ArrowRight */}
                    <ChevronRight size={18} className={`${item.cta ? 'opacity-100' : 'opacity-30 text-stone-400 group-active:translate-x-1 transition-transform'}`} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* RODAPÉ DO MENU MOBILE */}
          <div className="mt-8 pt-6 border-t border-stone-100 text-center">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em]">Vanusa Zacarias Nutrição © {new Date().getFullYear()}</p>
          </div>
          
        </div>
      </div>
    </header>
  );
}