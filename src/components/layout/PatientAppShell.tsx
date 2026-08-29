'use client';

import PatientSidebar from '@/components/patient/PatientSidebar';

// =========================================================================
// PatientAppShell — Moldura Única da área autenticada do paciente (VZ-007.1)
// -------------------------------------------------------------------------
// Responsabilidade ÚNICA: ORQUESTRAR A MOLDURA FÍSICA.
//   Desktop (≥1024): Sidebar fixa à esquerda + conteúdo à direita.
//   Mobile  (<1024): sem Sidebar — a navegação é o Drawer do Header.
//
// NÃO conhece negócio: sem check-in, premium, auth, queries, regras clínicas
// nem dados do paciente. A Sidebar é responsável pelo seu próprio estado.
//
// API mínima: <PatientAppShell>{children}</PatientAppShell> — sem props de
// negócio, sem context, sem provider, sem registry.
//
// A reserva de espaço para a Sidebar pertence à moldura (flex-row), jamais a
// `lg:pl-64` em cada página — as páginas continuam sem conhecer a Sidebar.
// =========================================================================

interface PatientAppShellProps {
  children: React.ReactNode;
}

export default function PatientAppShell({ children }: PatientAppShellProps) {
  return (
    <div className="flex-1 w-full min-w-0 flex">
      {/* SIDEBAR DESKTOP (≥1024) — a ÚNICA montagem da Sidebar na moldura */}
      <div className="hidden lg:flex shrink-0">
        <PatientSidebar />
      </div>

      {/* CONTEÚDO — reserva a coluna via flex (sem lg:pl-64 por página) */}
      <div className="flex-1 min-w-0 w-full">
        {children}
      </div>
    </div>
  );
}
