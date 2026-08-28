'use client';

import React from 'react';

// =========================================================================
// PatientPageShell — Geometria compartilhada do conteúdo do paciente
// -------------------------------------------------------------------------
// Responsabilidade ÚNICA: geometria (origem vertical, padding horizontal,
// max-width, Zona de Navegação e a relação Navigation → Header → Content).
//
// NÃO contém: Supabase, auth, premium, check-in, regras clínicas, negócio,
// Sidebar. Também NÃO emite <main> — o <main> global do NavigationWrapper
// permanece o único landmark primário.
//
// Garantia por construção: a origem vertical e o padding horizontal são
// classes separadas (ⓟⓧ horizontal / ⓟⓣ vertical). NUNCA se usa shorthand
// `p-*` aqui, portanto nenhum shorthand pode sobrescrever a origem vertical
// nos breakpoints maiores (a falha da VZ-003.4).
// =========================================================================

type Variant = 'standard' | 'compact';

// Token de origem vertical por variante (nunca combinado com shorthand p-*).
const ORIGIN: Record<Variant, string> = {
  standard: 'pt-24 md:pt-28', // 96 / 112 px
  compact: 'pt-16 md:pt-24',  // 64 / 96 px
};

// Padding HORIZONTAL compartilhado (nunca toca padding-top).
const H_PAD = 'px-4 sm:px-6 md:px-8 lg:px-12';

// Espaçamento entre zonas (Navigation → Header → Content).
const ZONE_GAP = 'mb-8 md:mb-10';

interface PatientPageShellProps {
  /** standard = páginas comuns; compact = onboarding (Completar Perfil) */
  variant?: Variant;
  /** Largura máxima do conteúdo (2xl | 3xl | 5xl | 6xl...) — por página. */
  maxWidth?: string;
  /** Classes extras (ex.: fundo específico da página). */
  className?: string;
  children: React.ReactNode;
}

export function PatientPageShell({
  variant = 'standard',
  maxWidth = 'max-w-3xl',
  className = '',
  children,
}: PatientPageShellProps) {
  return (
    <section
      className={`w-full flex-1 flex flex-col min-h-full font-sans ${ORIGIN[variant]} ${H_PAD} ${className}`}
    >
      <div className={`w-full ${maxWidth} mx-auto flex flex-col flex-1`}>
        {children}
      </div>
    </section>
  );
}

// =========================================================================
// ZONAS — relações de espaçamento consistentes entre trechos da página
// =========================================================================

/** Zona de Navegação — contém o BackButton e elementos de topo. */
export function PageNavigation({ children }: { children: React.ReactNode }) {
  return (
    <nav className={`flex items-start justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ${ZONE_GAP}`}>
      {children}
    </nav>
  );
}

/** Page Header / Hero — título, identidade ou hero da página. */
export function PageHeader({ children }: { children: React.ReactNode }) {
  return <div className={`animate-in fade-in slide-in-from-bottom-6 duration-700 ${ZONE_GAP}`}>{children}</div>;
}

/** Page Content — corpo da página. */
export function PageContent({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col">{children}</div>;
}
