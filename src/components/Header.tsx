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
import { useMemo, useState, useEffect } from 'react';
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
  
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();

  // Bloqueia o scroll da página quando o menu mobile estiver aberto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
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

    const handleScroll = () => setIsScrolled(window.scrollY > 15);
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
        className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-500 ease-in-out ${
          isScrolled 
            ? 'bg-white/85 backdrop-blur-xl border-b border-stone-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] py-2 md:py-3' 
            : 'bg-gradient-to-b from-white/90 via-white/50 to-transparent py-3 md:py-5'
        }`}
      >
        <nav className="max-w-7xl mx-auto px-5 md:px-6 lg:px-8 flex items-center justify-between">
          
          {/* ==============================================================
              LOGOTIPO
          ============================================================== */}
          <Link href="/" className="flex items-center gap-2.5 md:gap-3.5 group relative z-[60] outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-nutri-500" onClick={closeMenu}>
            <div className={`relative flex items-center justify-center overflow-hidden transition-all duration-500 rounded-full ${isScrolled ? 'w-8 h-8 md:w-10 md:h-10 shadow-sm' : 'w-9 h-9 md:w-12 md:h-12 shadow-md'}`}>
               <Image 
                 src="/images/logo-vanusa.png" 
                 alt="Logotipo Vanusa Zacarias Nutrição"
                 fill
                 sizes="(max-width: 768px) 36px, 48px"
                 className="object-cover transition-transform duration-500 group-hover:scale-105" 
                 priority
               />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[17px] md:text-[22px] font-extrabold tracking-tight text-stone-900 leading-none group-hover:text-nutri-800 transition-colors duration-300">
                Vanusa Zacarias
              </span>
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.25em] text-nutri-600 mt-0.5 md:mt-1">
                Nutrição Clínica
              </span>
            </div>
          </Link>

          {/* ==============================================================
              MENU DESKTOP E AÇÕES DO USUÁRIO
          ============================================================== */}
          <div className="hidden md:flex items-center gap-8">
            
            {/* Navegação de Páginas */}
            <ul className="flex items-center space-x-1">
              {MAIN_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`group relative text-[11px] uppercase tracking-[0.15em] font-bold px-4 py-2.5 rounded-full overflow-hidden transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-nutri-500 ${isActive ? 'text-nutri-900' : 'text-stone-500 hover:text-nutri-800'}`}
                    >
                      <span className="relative z-10">{item.name}</span>
                      <span className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 h-0.5 bg-nutri-800 transition-all duration-300 ease-out rounded-full ${isActive ? 'w-5' : 'w-0 group-hover:w-5'}`}></span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* Divisor Visual + CTA/Auth Dinâmico Desktop */}
            {!isLoadingAuth && (
              <div className="flex items-center gap-4 border-l border-stone-200 pl-8">
                {isLoggedIn ? (
                  <div className="flex items-center gap-3">
                    <Link
                      href="/dashboard"
                      className="text-[11px] uppercase tracking-[0.15em] font-bold transition-all duration-300 px-6 py-2.5 rounded-full bg-nutri-900 hover:bg-nutri-800 text-white shadow-lg shadow-nutri-900/20 transform hover:-translate-y-0.5 active:scale-95 border border-transparent hover:border-nutri-700 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nutri-500"
                    >
                      Meu Painel
                    </Link>
                    <button 
                      onClick={handleLogout}
                      title="Sair da conta"
                      className="p-2.5 rounded-full text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all duration-300 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <LogOut size={18} strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="text-[11px] uppercase tracking-[0.15em] font-bold transition-all duration-300 px-6 py-2.5 rounded-full bg-nutri-900 hover:bg-nutri-800 text-white shadow-lg shadow-nutri-900/20 transform hover:-translate-y-0.5 active:scale-95 border border-transparent hover:border-nutri-700 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nutri-500"
                  >
                    Agendar Consulta
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* ==============================================================
              BOTÃO HAMBÚRGUER MOBILE
          ============================================================== */}
          <div className="md:hidden relative z-[60]">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Fechar menu principal" : "Abrir menu principal"}
              className={`p-2 rounded-[0.85rem] transition-all duration-300 active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-nutri-500 ${
                isMobileMenuOpen 
                  ? 'bg-stone-100 text-stone-900 border border-transparent' 
                  : isScrolled 
                    ? 'bg-white text-stone-900 border border-stone-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]' 
                    : 'bg-white/50 backdrop-blur-md border border-white/60 text-stone-900 shadow-sm'
              }`}
            >
              {isMobileMenuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
            </button>
          </div>
        </nav>

        {/* =========================================================================
            OVERLAY E GAVETA DO MENU MOBILE
        ========================================================================= */}
        {/* Overlay escuro de fundo */}
        <div 
          className={`fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-[45] md:hidden transition-opacity duration-500 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={closeMenu}
          aria-hidden="true"
        />

        {/* Painel lateral (Gaveta com borda arredondada estilo iOS) */}
        <div className={`
          fixed top-0 right-0 h-[100dvh] w-[88vw] max-w-sm bg-white z-[50] md:hidden transition-transform duration-500 ease-[0.32,0.72,0,1] shadow-2xl rounded-l-[2rem] border-l border-white/20
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="flex flex-col h-full pt-20 pb-8 px-6 overflow-y-auto scrollbar-hide">
            
            {/* FERRAMENTAS DO PACIENTE (Só para logados) */}
            {isLoggedIn && (
              <div className="mb-8 bg-stone-50/80 p-5 rounded-[1.5rem] border border-stone-100 shadow-sm mt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-nutri-700 mb-5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Área do Paciente
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <Link href="/dashboard" onClick={closeMenu} className="flex flex-col items-center gap-2 text-stone-500 hover:text-nutri-800 transition-colors group">
                    <div className="w-11 h-11 flex items-center justify-center bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-stone-100 group-hover:border-nutri-300 group-active:scale-95 transition-all duration-300">
                      <LayoutDashboard size={18} className="group-hover:text-nutri-800 transition-colors"/>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Painel</span>
                  </Link>
                  <Link href="/dashboard/meu-plano" onClick={closeMenu} className="flex flex-col items-center gap-2 text-stone-500 hover:text-nutri-800 transition-colors group">
                    <div className="w-11 h-11 flex items-center justify-center bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-stone-100 group-hover:border-nutri-300 group-active:scale-95 transition-all duration-300">
                      <FileText size={18} className="group-hover:text-nutri-800 transition-colors"/>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Dieta</span>
                  </Link>
                  <Link href="/dashboard/perfil" onClick={closeMenu} className="flex flex-col items-center gap-2 text-stone-500 hover:text-nutri-800 transition-colors group">
                    <div className="w-11 h-11 flex items-center justify-center bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-stone-100 group-hover:border-nutri-300 group-active:scale-95 transition-all duration-300">
                      <User size={18} className="group-hover:text-nutri-800 transition-colors"/>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Perfil</span>
                  </Link>
                  <button onClick={handleLogout} className="flex flex-col items-center gap-2 text-stone-500 hover:text-rose-600 transition-colors group">
                    <div className="w-11 h-11 flex items-center justify-center bg-rose-50 rounded-2xl border border-rose-100 group-hover:bg-rose-100 group-hover:border-rose-200 group-active:scale-95 transition-all duration-300">
                      <LogOut size={18} className="text-rose-500 group-hover:text-rose-600 transition-colors"/>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight text-rose-500">Sair</span>
                  </button>
                </div>
              </div>
            )}

            {/* LISTA DE NAVEGAÇÃO MOBILE */}
            <nav className={`flex-1 ${!isLoggedIn ? 'mt-6' : ''}`}>
              <ul className="flex flex-col space-y-1">
                {MAIN_NAV_ITEMS.map((item, index) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
                  return (
                    <li 
                      key={item.name} 
                      style={{ transitionDelay: `${index * 60}ms` }} 
                      className={`transition-all duration-500 ease-out ${isMobileMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
                    >
                      <Link
                        href={item.href}
                        onClick={closeMenu}
                        className={`flex items-center justify-between w-full p-4 rounded-2xl font-extrabold text-xl transition-all duration-300 active:scale-[0.98] group ${isActive ? 'bg-nutri-50 text-nutri-900' : 'text-stone-700 hover:bg-stone-50'}`}
                      >
                        <span className="group-hover:translate-x-2 transition-transform duration-300">{item.name}</span>
                        <ChevronRight size={20} className={`transition-all duration-300 ${isActive ? 'text-nutri-600 opacity-100' : 'text-stone-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0'}`} />
                      </Link>
                    </li>
                  )
                })}
              </ul>

              {/* CTA MOBILE */}
              <div className={`mt-10 transition-all duration-500 ease-out delay-[300ms] ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <Link
                  href={isLoggedIn ? '/dashboard' : '/login'}
                  onClick={closeMenu}
                  className="flex items-center justify-center w-full py-3.5 rounded-xl bg-nutri-900 text-white font-extrabold text-[15px] shadow-[0_8px_30px_rgba(var(--nutri-900-rgb),0.3)] active:scale-95 transition-all duration-300"
                >
                  {isLoggedIn ? 'Acessar Meu Painel' : 'Agendar Consulta'}
                </Link>
              </div>
            </nav>

            {/* RODAPÉ DO MENU MOBILE */}
            <div className="mt-auto pt-8 text-center">
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.25em]">
                Vanusa Zacarias Nutrição © {new Date().getFullYear()}
              </p>
            </div>
            
          </div>
        </div>
      </header>
    </>
  );
}
