'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Menu,
  X,
  LogOut,
  ChevronRight,
  Lock,
  Crown,
  Check,
} from 'lucide-react';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { PATIENT_NAV_GROUPS, isPatientPathActive } from '@/lib/navigation';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';

// =========================================================================
// NAVEGAÇÃO PÚBLICA (uso EXCLUSIVO deste componente — sem duplicação)
// =========================================================================
const MAIN_NAV_ITEMS = [
  { name: 'Home', href: '/' },
  { name: 'Sobre a Nutri', href: '/#sobre' },
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

  // Dados do paciente exibidos no drawer/desktop (nome + premium + acesso ao plano)
  const [firstName, setFirstName] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [canAccessMealPlan, setCanAccessMealPlan] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  const { isDone: checkinDone } = useCheckinStatus(supabase, { enabled: isLoggedIn });

  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Bloqueia o scroll da página quando o menu mobile estiver aberto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Foco inicial: ao abrir o drawer, move o foco para o 1º elemento útil
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const id = window.setTimeout(() => {
      const focusable = drawerRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, reducedMotion ? 0 : 20);
    return () => window.clearTimeout(id);
  }, [isMobileMenuOpen, reducedMotion]);

  // Carrega dados do paciente (nome, premium, acesso ao plano) quando logado
  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, account_type, has_meal_plan_access')
        .eq('id', session.user.id)
        .single();
      if (!active || !profile) return;
      const p = profile as {
        full_name?: string | null;
        account_type?: string | null;
        has_meal_plan_access?: boolean | null;
      };
      setFirstName(p.full_name?.split(' ')[0] || '');
      setCanAccessMealPlan(p.account_type === 'premium' || !!p.has_meal_plan_access);
      setIsPremium(p.account_type === 'premium' || !!p.has_meal_plan_access);
    })();
    return () => {
      active = false;
    };
  }, [isLoggedIn, supabase]);

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
      if (!session) {
        setIsPremium(false);
        setCanAccessMealPlan(false);
        setFirstName('');
      }
    });

    const handleScroll = () => setIsScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Fecha o drawer e restaura o foco ao hambúrguer
  const closeMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  const handleCloseWithFocus = useCallback(() => {
    setIsMobileMenuOpen(false);
    setTimeout(() => hamburgerRef.current?.focus(), 0);
  }, []);

  // Fecha o drawer via tecla ESC e restaura o foco ao hambúrguer
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseWithFocus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen, handleCloseWithFocus]);

  // Focus trap: mantém o foco dentro do drawer enquanto estiver aberto
  const handleDrawerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    []
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCanAccessMealPlan(false);
    setIsPremium(false);
    setIsMobileMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  const handlePublicActive = useCallback(
    (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`)),
    [pathname]
  );

  const initialName = firstName ? firstName.charAt(0).toUpperCase() : 'V';

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ease-in-out ${
          isScrolled
            ? 'bg-white/85 backdrop-blur-xl border-b border-stone-200/60 shadow-[0_1px_0_rgba(28,25,23,0.04),0_8px_28px_-12px_rgba(28,25,23,0.10)] py-2.5 md:py-3'
            : 'bg-white/70 backdrop-blur-md border-b border-transparent py-3 md:py-4'
        }`}
      >
        <nav className="max-w-7xl mx-auto px-5 md:px-6 lg:px-8 flex items-center justify-between">

          {/* ==============================================================
              LOGOTIPO
          ============================================================== */}
          <Link href="/" className="flex items-center gap-2.5 md:gap-3.5 group relative z-[60] outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-nutri-500" onClick={closeMenu}>
            <div className={`relative flex items-center justify-center overflow-hidden transition-all duration-300 rounded-full ${isScrolled ? 'w-9 h-9 md:w-10 md:h-10 shadow-sm' : 'w-10 h-10 md:w-11 md:h-11 shadow-md'}`}>
              <Image
                src="/images/logo-vanusa.png"
                alt="Logotipo Vanusa Zacarias Nutrição"
                fill
                sizes="(max-width: 768px) 40px, 44px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[17px] md:text-[20px] font-extrabold tracking-tight text-stone-900 leading-none group-hover:text-nutri-800 transition-colors duration-300">
                Vanusa Zacarias
              </span>
              <span className="text-[8px] md:text-[9.5px] font-black uppercase tracking-[0.25em] text-nutri-600 mt-0.5 md:mt-1">
                Nutrição Clínica
              </span>
            </div>
          </Link>

          {/* ==============================================================
              MENU DESKTOP E AÇÕES DO USUÁRIO
          ============================================================== */}
          <div className="hidden md:flex items-center gap-6">

            {/* Navegação Pública */}
            <ul className="flex items-center gap-1">
              {MAIN_NAV_ITEMS.map((item) => {
                const isActive = handlePublicActive(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative text-[10.5px] uppercase tracking-[0.14em] font-bold px-3.5 py-2.5 rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-nutri-500 ${
                        isActive
                          ? 'text-nutri-900 bg-nutri-50/80'
                          : 'text-stone-500 hover:text-nutri-800 hover:bg-white'
                      }`}
                    >
                      <span className="relative z-10">{item.name}</span>
                      {isActive && (
                        <span className="absolute -bottom-px left-1/2 -translate-x-1/2 h-0.5 w-5 bg-nutri-800 rounded-full" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Ações do Usuário Desktop */}
            {!isLoadingAuth && (
              <div className="flex items-center gap-3 border-l border-stone-200 pl-6">
                {isLoggedIn ? (
                  <>
                    {/* Identidade compacta */}
                    <div className="flex items-center gap-2.5 pr-1" aria-label={`Paciente ${firstName || ''}`}>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-nutri-700 to-nutri-900 flex items-center justify-center text-white font-black text-sm ring-2 ring-white shrink-0">
                        {initialName}
                      </div>
                      <span className="max-w-[8rem] truncate text-[13px] font-bold text-stone-800">
                        {firstName || 'Paciente'}
                      </span>
                      {isPremium && <Crown size={14} className="text-amber-500 shrink-0" />}
                    </div>
                    {/* Ação principal → /dashboard */}
                    <Link
                      href="/dashboard"
                      className="text-[11px] uppercase tracking-[0.12em] font-bold transition-all duration-200 px-5 py-2.5 rounded-full bg-nutri-900 hover:bg-nutri-800 text-white shadow-sm shadow-nutri-900/20 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nutri-500"
                    >
                      Meu Painel
                    </Link>
                    {/* Ação secundária: logout */}
                    <button
                      onClick={handleLogout}
                      title="Sair da conta"
                      aria-label="Sair da conta"
                      className="p-3 rounded-full text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all duration-200 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <LogOut size={18} strokeWidth={2} />
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="text-[11px] uppercase tracking-[0.12em] font-bold transition-all duration-200 px-6 py-2.5 rounded-full bg-nutri-900 hover:bg-nutri-800 text-white shadow-sm shadow-nutri-900/20 active:scale-95 border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nutri-500"
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
              ref={hamburgerRef}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu-drawer"
              aria-label={isMobileMenuOpen ? "Fechar menu principal" : "Abrir menu principal"}
              className={`p-3 rounded-[0.85rem] w-11 h-11 flex items-center justify-center transition-all duration-300 active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-nutri-500 ${
                isMobileMenuOpen
                  ? 'bg-stone-100 text-stone-900 border border-transparent'
                  : isScrolled
                    ? 'bg-white text-stone-900 border border-stone-200 shadow-sm'
                    : 'bg-white/60 backdrop-blur-md border border-white/70 text-stone-900 shadow-sm'
              }`}
            >
              {isMobileMenuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
            </button>
          </div>
        </nav>

        {/* =========================================================================
            OVERLAY E GAVETA DO MENU MOBILE
        ========================================================================= */}
        <div
          className={`fixed inset-0 bg-stone-950/60 backdrop-blur-sm z-[70] md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={handleCloseWithFocus}
          aria-hidden="true"
        />

        <div
          id="mobile-menu-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
          aria-hidden={!isMobileMenuOpen}
          onKeyDown={handleDrawerKeyDown}
          style={{
            transition: reducedMotion
              ? 'none'
              : `transform 400ms cubic-bezier(0.32,0.72,0,1), visibility 0s ${isMobileMenuOpen ? '0s' : '400ms'}`,
          }}
          className={`
            fixed top-0 right-0 h-[100dvh] w-[88vw] max-w-sm bg-white z-[80] md:hidden shadow-2xl rounded-l-[1.5rem] border-l border-white/20 outline-none
            ${isMobileMenuOpen ? 'translate-x-0 visible' : 'translate-x-full invisible'}
          `}
        >
          <div className="flex flex-col h-full pt-[max(env(safe-area-inset-top),0.75rem)] pb-8 px-6 overflow-y-auto scrollbar-hide">

            {/* CABEÇALHO — identidade da marca + fechar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center overflow-hidden rounded-full w-10 h-10 shadow-sm">
                  <Image
                    src="/images/logo-vanusa.png"
                    alt="Logotipo Vanusa Zacarias Nutrição"
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-extrabold text-stone-900 leading-none">
                    Vanusa Zacarias
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.22em] text-nutri-600 mt-1">
                    Nutrição Clínica
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseWithFocus}
                aria-label="Fechar menu principal"
                className="p-2.5 rounded-full bg-stone-100 text-stone-900 hover:bg-stone-200 transition-colors active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-nutri-500"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            {/* ÁREA DO PACIENTE (autenticado) */}
            {isLoggedIn && (
              <div className="mb-7">
                {/* Identidade compacta */}
                <div className="flex items-center gap-3 px-1 pb-4 mb-2 border-b border-stone-100">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nutri-700 to-nutri-900 flex items-center justify-center text-white font-black text-sm ring-2 ring-white shrink-0">
                    {initialName}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-stone-900 truncate leading-none">
                      {firstName || 'Paciente'}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-nutri-600 mt-1">
                      Área do Paciente
                    </p>
                  </div>
                  {isPremium && <Crown size={16} className="text-amber-500 shrink-0" />}
                </div>

                {/* PATIENT_NAV_GROUPS (fonte única) */}
                <div className="space-y-5">
                  {PATIENT_NAV_GROUPS.map((group) => (
                    <div key={group.id}>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-400 mb-1.5 px-1">
                        {group.title}
                      </p>
                      <ul className="space-y-0.5">
                        {group.items.map((item) => {
                          const isActive = isPatientPathActive(pathname ?? '', item.href);
                          const Icon = item.icon;
                          const locked = !!item.premium && !canAccessMealPlan;
                          const isCheckinDone = item.id === 'checkin' && checkinDone && isLoggedIn;
                          const label = item.mobileLabel || item.label;

                          const inner = (
                            <>
                              <span className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`p-2 rounded-xl shrink-0 transition-colors duration-200 ${
                                    isCheckinDone
                                      ? 'bg-emerald-500 text-white shadow-sm'
                                      : isActive
                                        ? 'bg-nutri-600 text-white shadow-sm shadow-nutri-600/25'
                                        : locked
                                          ? 'bg-stone-100 text-stone-300'
                                          : 'bg-white text-stone-400 shadow-sm group-hover:bg-nutri-50 group-hover:text-nutri-600'
                                  }`}
                                >
                                  {isCheckinDone ? <Check size={17} strokeWidth={3} /> : <Icon size={17} strokeWidth={2.5} />}
                                </span>
                                <span className="truncate">{label}</span>
                              </span>
                              <span className="flex items-center gap-1.5 shrink-0">
                                {isCheckinDone ? null : (
                                  locked && <Lock size={13} className="text-amber-500" />
                                )}
                                <ChevronRight size={16} className={`transition-all duration-200 ${isActive ? 'text-nutri-600 opacity-100' : 'text-stone-300 opacity-0 group-hover:opacity-100'}`} />
                              </span>
                            </>
                          );

                          return (
                            <li key={item.id}>
                              {isCheckinDone ? (
                                <div
                                  aria-current={isActive ? 'page' : undefined}
                                  aria-label="Check-in semanal concluído esta semana"
                                  className={`flex items-center justify-between w-full p-3 rounded-2xl font-bold text-sm transition-all duration-200 group ${
                                    isActive
                                      ? 'bg-white text-nutri-900 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)] border border-stone-100'
                                      : 'bg-emerald-50/40 text-emerald-800 border border-emerald-100/60 opacity-95'
                                  }`}
                                >
                                  {inner}
                                </div>
                              ) : (
                                <Link
                                  href={item.href}
                                  onClick={closeMenu}
                                  aria-current={isActive ? 'page' : undefined}
                                  aria-label={locked ? `${label} (bloqueado)` : label}
                                  className={`flex items-center justify-between w-full p-3 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-[0.98] group ${
                                    isActive
                                      ? 'bg-white text-nutri-900 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)] border border-stone-100'
                                      : 'text-stone-600 hover:bg-white hover:text-stone-900 hover:shadow-sm hover:border-stone-100 border border-transparent'
                                  }`}
                                >
                                  {inner}
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NAVEGAÇÃO PÚBLICA */}
            <nav className={`flex-1 min-w-0 ${!isLoggedIn ? 'mt-4' : ''}`} aria-label="Navegação do site">
              <ul className="flex flex-col space-y-1">
                {MAIN_NAV_ITEMS.map((item, index) => {
                  const isActive = handlePublicActive(item.href);
                  const animateStyle = reducedMotion || !isMobileMenuOpen
                    ? undefined
                    : { transitionDelay: `${index * 50}ms` };
                  return (
                    <li
                      key={item.name}
                      style={animateStyle}
                      className={`transition-all duration-400 ease-out ${reducedMotion ? '' : isMobileMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`}
                    >
                      <Link
                        href={item.href}
                        onClick={closeMenu}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex items-center justify-between w-full p-4 rounded-2xl font-extrabold text-lg transition-all duration-300 active:scale-[0.98] group ${isActive ? 'bg-nutri-50 text-nutri-900' : 'text-stone-700 hover:bg-stone-50'}`}
                      >
                        <span className="group-hover:translate-x-2 transition-transform duration-300">{item.name}</span>
                        <ChevronRight size={20} className={`transition-all duration-300 ${isActive ? 'text-nutri-600 opacity-100' : 'text-stone-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0'}`} />
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* CTA visitante (autenticados NÃO veem CTA redundante p/ /dashboard) */}
              {!isLoggedIn && (
                <div
                  className={`mt-8 transition-all duration-400 ease-out ${reducedMotion ? '' : isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                  style={!reducedMotion && isMobileMenuOpen ? { transitionDelay: '300ms' } : undefined}
                >
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="flex items-center justify-center w-full py-3.5 rounded-xl bg-nutri-900 text-white font-extrabold text-[15px] shadow-[0_8px_30px_rgba(var(--nutri-900-rgb),0.3)] active:scale-95 transition-all duration-300"
                  >
                    Agendar Consulta
                  </Link>
                </div>
              )}
            </nav>

            {/* RODAPÉ */}
            <div className="mt-auto pt-8">
              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl text-rose-500 text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-colors group mb-5"
                >
                  <LogOut size={16} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                  Sair da Conta
                </button>
              )}
              <p className="text-center text-[10px] font-black text-stone-300 uppercase tracking-[0.25em]">
                Vanusa Zacarias Nutrição © {new Date().getFullYear()}
              </p>
            </div>

          </div>
        </div>
      </header>
    </>
  );
}
