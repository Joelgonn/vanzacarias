import {
  LayoutDashboard,
  Utensils,
  ClipboardList,
  CalendarDays,
  CheckCircle2,
  History,
  UserCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// =========================================================================
// FONTE ÚNICA DE VERDADE DA NAVEGAÇÃO DO PACIENTE
// Compartilhada pela Sidebar desktop (PatientSidebar) e pelo drawer mobile
// (Header). Evita a duplicação de labels, rotas, ícones e estados premium
// entre as duas superfícies.
// =========================================================================

export interface PatientNavItem {
  /** Identificador único estável (usado como key reativa) */
  id: string;
  /** Label canônico (sidebar desktop) */
  label: string;
  /** Label curto opcional (drawer mobile, quando espaço é limitado) */
  mobileLabel?: string;
  /** Subtítulo descritivo exibido na sidebar desktop */
  description?: string;
  /** Rota de destino (NUNCA alterar — contrato de rotas) */
  href: string;
  /** Ícone lucide */
  icon: LucideIcon;
  /** true = item exige acesso ao Meu Plano (exibe lock quando bloqueado) */
  premium?: boolean;
}

export interface PatientNavGroup {
  id: string;
  title: string;
  items: PatientNavItem[];
}

export const PATIENT_NAV_GROUPS: PatientNavGroup[] = [
  {
    id: 'principal',
    title: 'Principal',
    items: [
      {
        id: 'painel',
        label: 'Painel Geral',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'Visão geral do seu dia',
      },
      {
        id: 'plano',
        label: 'Meu Plano',
        mobileLabel: 'Plano',
        href: '/dashboard/meu-plano',
        icon: Utensils,
        premium: true,
        description: 'Seu plano alimentar',
      },
    ],
  },
  {
    id: 'jornada',
    title: 'Sua Jornada',
    items: [
      {
        id: 'avaliacao',
        label: 'Avaliação (QFA)',
        mobileLabel: 'Avaliação',
        href: '/paciente/avaliacao',
        icon: ClipboardList,
        description: 'Raio-X alimentar',
      },
      {
        id: 'checkin',
        label: 'Check-in Semanal',
        mobileLabel: 'Check-in',
        href: '/dashboard/checkin',
        icon: CheckCircle2,
      },
      {
        id: 'agendamentos',
        label: 'Agendamentos',
        mobileLabel: 'Agendar',
        href: '/dashboard/agendamentos',
        icon: CalendarDays,
      },
      {
        id: 'historico',
        label: 'Histórico Clínico',
        mobileLabel: 'Histórico',
        href: '/dashboard/historico',
        icon: History,
      },
    ],
  },
  {
    id: 'conta',
    title: 'Conta',
    items: [
      {
        id: 'perfil',
        label: 'Meu Perfil',
        mobileLabel: 'Perfil',
        href: '/dashboard/perfil',
        icon: UserCircle,
      },
    ],
  },
];

/**
 * Determina se uma rota deve ser considerada "ativa".
 * - Correspondência exata para a raiz '/dashboard'.
 * - Prefixo para rotas filhas (ex.: '/dashboard/meu-plano' ativa '/dashboard'?
 *   Não — apenas itens cuja href é prefixo do pathname são ativos, exceto a
 *   raiz '/dashboard' que só ativa na correspondência exata).
 */
export function isPatientPathActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
