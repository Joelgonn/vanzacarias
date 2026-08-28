'use client';

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Lock, Crown, Check, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { PATIENT_NAV_GROUPS, isPatientPathActive } from '@/lib/navigation';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';

interface PatientSidebarProps {
  /** Se o usuário pode acessar o plano alimentar (controla o cadeado no menu) */
  canAccessMealPlan?: boolean | null;
}

/**
 * Sidebar de navegação do paciente (desktop).
 *
 * História (VZ-003.1 / VZ-003.2 / VZ-003.2.1):
 * - Consome PATIENT_NAV_GROUPS (fonte única) — rótulos, rotas e ícones
 *   compartilhados com o drawer mobile.
 * - Route-aware: usa usePathname() para destacar a rota ativa real e emite
 *   aria-current="page".
 * - Estado do Check-in Semanal sincronizado pela FONTE ÚNICA
 *   (src/lib/checkin · isCheckinDoneThisWeek) via useCheckinStatus.
 *
 * CONTRATO PRESERVADO: a prop `canAccessMealPlan` e a assinatura do componente
 * não mudam — o consumidor (dashboard/page.tsx) permanece intacto.
 */
export default function PatientSidebar({ canAccessMealPlan = false }: PatientSidebarProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const supabase = useMemo(() => createClient(), []);
  const reducedMotion = useReducedMotion();
  const hasPlanAccess = canAccessMealPlan === true;

  const [firstName, setFirstName] = useState<string>('');
  const [isPremium, setIsPremium] = useState(false);

  const { isDone: checkinDone } = useCheckinStatus(supabase);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, account_type')
        .eq('id', data.session.user.id)
        .single();
      if (!active || !profile) return;
      setFirstName((profile as { full_name?: string | null }).full_name?.split(' ')[0] || '');
      setIsPremium((profile as { account_type?: string | null }).account_type === 'premium');
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const rowMotion = reducedMotion
    ? undefined
    : {
        initial: { opacity: 0, x: -8 },
        animate: { opacity: 1, x: 0 },
        transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
      };

  return (
    <aside
      className="w-64 bg-white/60 backdrop-blur-xl border-r border-stone-200/50 hidden md:flex flex-col p-6 sticky top-20 h-[calc(100vh-80px)] z-10"
      aria-label="Navegação do paciente"
    >
      {/* MARCA */}
      <div className="px-2 mb-7">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-nutri-300 to-nutri-600 opacity-40" aria-hidden="true" />
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-nutri-700 to-nutri-900 flex items-center justify-center text-white font-black text-sm shadow-inner-light ring-2 ring-white">
              {firstName ? firstName.charAt(0).toUpperCase() : 'V'}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-stone-900 truncate leading-none tracking-tight">
              {firstName || 'Vanusa Nutrição'}
            </p>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-nutri-600 mt-1.5">
              Nutrição Clínica
            </p>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO AGRUPADA */}
      <nav className="flex-1 flex flex-col gap-7 overflow-y-auto scrollbar-hide" aria-label="Menu principal">
        {PATIENT_NAV_GROUPS.map((group) => (
          <div key={group.id}>
            <div className="flex items-center gap-2 px-3 mb-2.5">
              <span className="h-3.5 w-[3px] rounded-full bg-gradient-to-b from-nutri-500 to-nutri-700" aria-hidden="true" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400">
                {group.title}
              </p>
            </div>
            <ul className="space-y-1">
              {group.items.map((item, index) => {
                const isActive = isPatientPathActive(pathname, item.href);
                const Icon = item.icon;
                const locked = !!item.premium && !hasPlanAccess;
                // Sincroniza com a regra única do check-in semanal
                const isCheckinDone = item.id === 'checkin' && checkinDone;

                const iconTile = (
                  <span
                    className={`p-2 rounded-xl transition-colors duration-200 ${
                      isCheckinDone
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : isActive
                          ? 'bg-nutri-600 text-white shadow-sm shadow-nutri-600/25'
                          : locked
                            ? 'bg-stone-100 text-stone-300 group-hover:bg-amber-50 group-hover:text-amber-600'
                            : 'bg-stone-50 text-stone-400 group-hover:bg-nutri-50 group-hover:text-nutri-600'
                    }`}
                  >
                    {isCheckinDone ? (
                      <Check size={18} strokeWidth={3} />
                    ) : (
                      <Icon size={18} strokeWidth={2.5} />
                    )}
                  </span>
                );

                const labelBlock = (
                  <span className="flex-1 min-w-0">
                    <span className="block truncate leading-tight">{item.label}</span>
                    {item.description && !isCheckinDone && (
                      <span className="block text-[10px] font-medium text-stone-400 truncate mt-0.5">
                        {item.description}
                      </span>
                    )}
                  </span>
                );

                const statusBlock = isCheckinDone ? null : locked ? (
                  <span className="shrink-0">
                    <Lock size={13} className="text-amber-500" />
                  </span>
                ) : isActive ? (
                  <ChevronRight size={15} className="text-nutri-600 shrink-0" />
                ) : null;

                const inner = (
                  <>
                    {iconTile}
                    {labelBlock}
                    {statusBlock}
                  </>
                );

                const rowClass = `group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm outline-none transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? 'bg-white text-nutri-900 font-bold shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)] border border-stone-100'
                    : isCheckinDone
                      ? 'bg-emerald-50/50 text-emerald-800 font-semibold border border-emerald-100/60 opacity-95'
                      : 'text-stone-500 font-semibold border border-transparent hover:bg-white hover:text-stone-900 hover:shadow-sm hover:border-stone-100 focus-visible:ring-2 focus-visible:ring-nutri-500'
                }`;

                const itemContent = (
                  <>
                    {isActive && !isCheckinDone && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-full bg-nutri-700"
                        aria-hidden="true"
                      />
                    )}
                    {inner}
                  </>
                );

                return (
                  <motion.li
                    key={item.id}
                    layout={reducedMotion ? false : undefined}
                    className="relative"
                    {...rowMotion}
                    style={{ transitionDelay: reducedMotion ? undefined : `${index * 30}ms` }}
                  >
                    {isCheckinDone ? (
                      <div
                        aria-current={isActive ? 'page' : undefined}
                        aria-label="Check-in semanal concluído esta semana"
                        className={rowClass}
                      >
                        {itemContent}
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={locked ? `${item.label} (bloqueado)` : item.label}
                        className={rowClass}
                      >
                        {itemContent}
                      </Link>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* RODAPÉ — CONTA */}
      <div className="mt-5 border-t border-stone-200/60 pt-4">
        {isPremium && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <span className="p-1 rounded-lg bg-amber-50 text-amber-500">
              <Crown size={14} strokeWidth={2.5} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-600">
              Plano Premium
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-stone-400 text-xs font-bold uppercase tracking-wider hover:text-rose-500 hover:bg-rose-50/60 transition-all duration-200 group active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <span className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-red-50 group-hover:text-red-500 transition-colors duration-200">
            <LogOut size={16} strokeWidth={2.5} />
          </span>
          Sair da Conta
        </button>
      </div>
    </aside>
  );
}
