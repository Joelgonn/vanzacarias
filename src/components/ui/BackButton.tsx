'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
  /** Destino real da navegação de retorno */
  href: string;
  /** Rótulo visível (padrão: "Voltar ao Painel") */
  label?: string;
  /** Classe extra para adaptação de layout pontual */
  className?: string;
  /** Handler opcional (ex.: confirmação de alterações não salvas) */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

/**
 * Botão de retorno unificado para a navegação de retorno ao painel do paciente.
 *
 * - Link real (navegação, nunca button).
 * - Linguagem visual única: pill, superfície clara, hairline, sombra leve.
 * - "Gravidade": leve elevação no normal; no active/press o botão desce
 *   minimamente e perde parte da elevação (sensação de contato), via CSS
 *   puro (Tailwind) — sem JS, sem timers, sem listeners.
 * - Respeita prefers-reduced-motion (motion-reduce:transition-none).
 */
export default function BackButton({
  href,
  label = 'Voltar ao Painel',
  className = '',
  onClick,
}: BackButtonProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group inline-flex items-center justify-center gap-2 h-12 min-w-12 px-5 rounded-full bg-white border border-stone-200 shadow-sm text-stone-600 font-bold text-sm hover:border-nutri-300 hover:text-nutri-700 hover:shadow-md active:translate-y-[1.5px] active:scale-[0.98] active:shadow-none transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:shadow-sm motion-reduce:active:translate-y-0 motion-reduce:active:scale-100 outline-none focus-visible:ring-2 focus-visible:ring-nutri-500 focus-visible:ring-offset-2 ${className}`}
    >
      <ChevronLeft
        size={20}
        strokeWidth={2.5}
        className="shrink-0 transition-transform duration-200 motion-reduce:transition-none group-hover:-translate-x-0.5 motion-reduce:group-hover:translate-x-0"
      />
      <span>{label}</span>
    </Link>
  );
}
