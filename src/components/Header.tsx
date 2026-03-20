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
  ChevronRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';

// =========================================================================
// CONSTANTES E DADOS DE NAVEGAÇÃO
// =========================================================================
const MAIN_NAV_ITEMS = [
  { name: 'Home', href: '/' },
  { name: 'Sobre Mim', href: '/#sobre' },
  { name: 'Serviços', href: '/#como-funciona' },
  { name: 'Blog', href: '/blog' },
  { name: 'Contato', href: '/#contato' },
];

export default function Header() {
  // =========================================================================
  // ESTADOS E HOOKS
  // =========================================================================
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  // Bloqueia o scroll da página quando o menu mobile estiver aberto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMobileMenuOpen]);

  // Checa Sessão e Evento de Scroll
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setIsLoggedIn(!!data.session);
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      subscription.unsubscribe();
    };
  }, [supabase]);

  // =========================================================================
  // HANDLERS
  // =========================================================================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsMobileMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <>
      <header 
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          isScrolled 
            ? 'bg-white/90 backdrop-blur-md shadow-[0_4px_30px_-5px_rgba(0,0,0,0.05)] py-3' 
            : 'bg-gradient-to-b from-white/60 to-transparent py-5'
        }`}
      >
        <nav className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          
          {/* LOGOTIPO */}
          <Link href="/" className="flex items-center gap-3 group relative z-[60]" onClick={closeMenu}>
            <div className={`relative w-10 h-10 overflow-hidden transition-transform duration-500 ${isScrolled ? 'scale-90' : 'scale-100'}`}>
               <Image 
                 src="/images/logo-vanusa.png" 
                 alt="Logotipo Vanusa Zacarias Nutrição"
                 fill
                 sizes="40px"
                 className="object-contain" 
                 priority
               />
            </div>
            <div className="flex flex-col">
              <span className="text-xl md:text-2xl font-extrabold tracking-tight text-nutri-900 leading-none group-hover:text-nutri-800 transition-colors">
                Vanusa Zacarias
              </span>
              <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-stone-500">
                Nutrição Clínica
              </span>
            </div>
          </Link>

          {/* MENU DESKTOP */}
          <div className="hidden md:flex items-center space-x-2">
            {MAIN_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="group relative text-[11px] uppercase tracking-[0.15em] font-bold text-stone-600 hover:text-nutri-800 transition-colors px-4 py-2 rounded-full overflow-hidden"
                >
                  <span className="relative z-10">{item.name}</span>
                  {/* Linha animada de Hover */}
                  <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 bg-nutri-800 transition-all duration-300 ease-out ${isActive ? 'w-4' : 'w-0 group-hover:w-4'}`}></span>
                </Link>
              )
            })}

            {/* CTA DINÂMICO DESKTOP */}
            {!isLoadingAuth && (
              <Link
                href={isLoggedIn ? '/dashboard' : '/login'}
                className="text-[11px] uppercase tracking-[0.15em] font-bold transition-all duration-300 px-6 py-2.5 rounded-full bg-nutri-900 hover:bg-nutri-800 text-white ml-4 shadow-lg shadow-nutri-900/20 transform hover:-translate-y-0.5 active:scale-95 border border-transparent hover:border-nutri-700"
              >
                {isLoggedIn ? 'Meu Painel' : 'Agendar Consulta'}
              </Link>
            )}
          </div>

          {/* BOTÃO HAMBÚRGUER MOBILE */}
          <div className="md:hidden relative z-[60]">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-label="Abrir menu principal"
              className={`p-3 rounded-xl transition-all duration-300 active:scale-90 ${
                isMobileMenuOpen 
                  ? 'bg-stone-100 text-stone-900 border border-transparent' 
                  : isScrolled 
                    ? 'bg-stone-50 text-stone-900 border border-stone-100 shadow-sm' 
                    : 'bg-white/40 backdrop-blur-md border border-white/50 text-stone-900 shadow-sm'
              }`}
            >
              {isMobileMenuOpen ? <X size={22} strokeWidth={2.5} /> : <Menu size={22} strokeWidth={2.5} />}
            </button>
          </div>
        </nav>

        {/* =========================================================================
            OVERLAY E MENU MOBILE
            ========================================================================= */}
        {/* Overlay escuro de fundo (Foco no menu) */}
        <div 
          className={`fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[45] md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={closeMenu}
          aria-hidden="true"
        />

        {/* Painel lateral / Gaveta de Menu */}
        <div className={`
          fixed top-0 right-0 h-full w-[85vw] max-w-sm bg-white z-[50] md:hidden transition-transform duration-500 ease-[0.22,1,0.36,1] shadow-2xl
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="flex flex-col h-full pt-28 pb-8 px-6 overflow-y-auto scrollbar-hide">
            
            {/* FERRAMENTAS DO PACIENTE (Só para logados) */}
            {isLoggedIn && (
              <div className="mb-8 bg-stone-50/80 p-5 rounded-[2rem] border border-stone-100/80 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-5 text-center">Acesso Rápido</p>
                <div className="flex justify-between items-start px-1 gap-2">
                  <Link href="/dashboard" onClick={closeMenu} className="flex flex-col items-center gap-2 text-stone-500 hover:text-nutri-800 transition-colors group">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-100 group-hover:border-nutri-200 group-active:scale-90 transition-all"><LayoutDashboard size={20} className="group-hover:text-nutri-800"/></div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Painel</span>
                  </Link>
                  <Link href="/dashboard/meu-plano" onClick={closeMenu} className="flex flex-col items-center gap-2 text-stone-500 hover:text-nutri-800 transition-colors group">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-100 group-hover:border-nutri-200 group-active:scale-90 transition-all"><FileText size={20} className="group-hover:text-nutri-800"/></div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Dieta</span>
                  </Link>
                  <Link href="/dashboard/perfil" onClick={closeMenu} className="flex flex-col items-center gap-2 text-stone-500 hover:text-nutri-800 transition-colors group">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-100 group-hover:border-nutri-200 group-active:scale-90 transition-all"><User size={20} className="group-hover:text-nutri-800"/></div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Perfil</span>
                  </Link>
                  <button onClick={handleLogout} className="flex flex-col items-center gap-2 text-stone-500 hover:text-rose-600 transition-colors group">
                    <div className="p-3 bg-stone-100 rounded-2xl border border-stone-200 group-hover:bg-rose-50 group-hover:border-rose-100 group-active:scale-90 transition-all"><LogOut size={20} className="group-hover:text-rose-600"/></div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Sair</span>
                  </button>
                </div>
              </div>
            )}

            {/* LISTA DE NAVEGAÇÃO */}
            <nav className="flex-1 mt-4">
              <ul className="flex flex-col space-y-3">
                {MAIN_NAV_ITEMS.map((item, index) => (
                  <li key={item.name} style={{ transitionDelay: `${index * 50}ms` }} className={`transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                    <Link
                      href={item.href}
                      onClick={closeMenu}
                      className="flex items-center justify-between w-full p-4 rounded-2xl text-stone-700 font-extrabold text-lg hover:bg-stone-50 active:bg-stone-100 group transition-colors"
                    >
                      <span className="group-hover:translate-x-1 transition-transform">{item.name}</span>
                      <ChevronRight size={18} className="opacity-30 text-stone-400 group-active:translate-x-1 transition-all group-hover:text-nutri-800 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>

              {/* CTA MOBILE */}
              <div className={`mt-8 transition-all duration-500 delay-300 ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <Link
                  href={isLoggedIn ? '/dashboard' : '/login'}
                  onClick={closeMenu}
                  className="flex items-center justify-center w-full py-4 rounded-2xl bg-nutri-900 text-white font-extrabold text-base shadow-xl shadow-nutri-900/20 active:scale-95 transition-all"
                >
                  {isLoggedIn ? 'Acessar Meu Painel' : 'Agendar Consulta'}
                </Link>
              </div>
            </nav>

            {/* RODAPÉ DO MENU MOBILE */}
            <div className="mt-auto pt-8 border-t border-stone-100 text-center">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Vanusa Zacarias Nutrição © {new Date().getFullYear()}</p>
            </div>
            
          </div>
        </div>
      </header>
    </>
  );
}