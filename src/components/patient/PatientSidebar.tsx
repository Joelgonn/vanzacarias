'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Compass, LayoutDashboard, ClipboardList, Utensils, CalendarDays, UserCircle, LogOut, Lock } from 'lucide-react';

interface PatientSidebarProps {
  /** Se o usuário pode acessar o plano alimentar (controla o cadeado no menu) */
  canAccessMealPlan?: boolean | null;
}

/**
 * Sidebar de navegação do paciente (desktop).
 * Extraída do dashboard para ser reutilizada pelas subpáginas — mesmo JSX,
 * sem mudança de comportamento. Item ativo fixo em "/dashboard".
 */
export default function PatientSidebar({ canAccessMealPlan = false }: PatientSidebarProps) {
  const router = useRouter();
  const supabase = createClient();
  const hasPlanAccess = canAccessMealPlan === true;

  return (
    <aside className="w-64 bg-white/60 backdrop-blur-xl border-r border-stone-200/50 hidden md:flex flex-col p-8 sticky top-20 h-[calc(100vh-80px)] z-10 shadow-[4px_0_24px_rgba(0,0,0,0.01)]">
      <h2 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em] mb-8 flex items-center gap-2">
        <Compass size={14} /> Navegação
      </h2>

      <nav className="flex-1 space-y-2">
        {/* MENU ATIVO */}
        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3.5 bg-white text-nutri-900 font-bold text-sm rounded-2xl shadow-[0_4px_20px_rgba(28,25,23,0.05)] border border-stone-100 transition-all group">
          <div className="p-2 bg-nutri-50 rounded-xl text-nutri-600 group-hover:scale-110 transition-transform">
            <LayoutDashboard size={18} strokeWidth={2.5} />
          </div>
          Painel Geral
        </Link>

        {/* MENUS INATIVOS (Com Glow Dourado no Hover) */}
        <Link href="/paciente/avaliacao" className="flex items-center gap-3 px-4 py-3.5 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm font-semibold text-sm rounded-2xl transition-all border border-transparent hover:border-stone-100 group">
          <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
            <ClipboardList size={18} strokeWidth={2.5} />
          </div>
          Avaliação (QFA)
        </Link>

        <Link href="/dashboard/meu-plano" className="flex items-center justify-between px-4 py-3.5 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm font-semibold text-sm rounded-2xl transition-all border border-transparent hover:border-stone-100 group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
              <Utensils size={18} strokeWidth={2.5} />
            </div>
            Meu Plano
          </div>
          {!hasPlanAccess && <Lock size={14} className="text-stone-300" />}
        </Link>

        <Link href="/dashboard/agendamentos" className="flex items-center gap-3 px-4 py-3.5 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm font-semibold text-sm rounded-2xl transition-all border border-transparent hover:border-stone-100 group">
          <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
            <CalendarDays size={18} strokeWidth={2.5} />
          </div>
          Agendamentos
        </Link>

        <Link href="/dashboard/perfil" className="flex items-center gap-3 px-4 py-3.5 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm font-semibold text-sm rounded-2xl transition-all border border-transparent hover:border-stone-100 group">
          <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
            <UserCircle size={18} strokeWidth={2.5} />
          </div>
          Meu Perfil
        </Link>
      </nav>

      <button
        onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
        className="text-stone-400 text-xs font-bold uppercase tracking-wider hover:text-red-500 transition-colors mt-auto pt-8 border-t border-stone-200/60 w-full text-left flex items-center gap-3 group"
      >
        <div className="p-2 bg-stone-50 rounded-xl text-stone-400 group-hover:bg-red-50 group-hover:text-red-500 transition-colors">
          <LogOut size={16} strokeWidth={2.5} />
        </div>
        Sair da Conta
      </button>
    </aside>
  );
}
