'use client';

import { useId, useSyncExternalStore, useState } from 'react';
import type { RecoveryResult } from '@/lib/vz020/types';
import { ChevronDown, ClipboardCheck, FileText, Target, RefreshCw } from 'lucide-react';

interface Props {
  patientName: string;
  result: RecoveryResult;
  onAction: (type: string) => void;
}

const META: Record<string, { icon: typeof ClipboardCheck; label: string }> = {
  checkin: { icon: ClipboardCheck, label: 'Check-in pendente' },
  daily_log: { icon: FileText, label: 'Sem registro hoje' },
  adherence: { icon: Target, label: 'Adesão registrada baixa' },
  return: { icon: RefreshCw, label: 'Retomou os registros' },
};

// Desktop inicia expandido (preserva a experiência atual); mobile inicia recolhido.
// useSyncExternalStore com getServerSnapshot=false mantém SSR/hydration consistentes:
// o snapshot "desktop" só é aplicado após a hidratação, sem mismatch e sem flash.
const subscribeToDesktop = (onChange: () => void) => {
  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
const getDesktopSnapshot = () => window.matchMedia('(min-width: 768px)').matches;
const getServerDesktopSnapshot = () => false;

export default function VZ020RecoveryList({ patientName, result, onAction }: Props) {
  const panelId = useId();
  const isDesktop = useSyncExternalStore(subscribeToDesktop, getDesktopSnapshot, getServerDesktopSnapshot);
  const [openForced, setOpenForced] = useState<boolean | null>(null);
  const open = openForced ?? isDesktop;

  const toggle = () => setOpenForced((prev) => (prev === null ? !isDesktop : !prev));

  if (result.state === 'NO_DATA') return null;

  const pendingCount = result.actions.length;
  const summary = result.actions
    .map((a) => META[a.type]?.label ?? a.title)
    .join(' · ');

  return (
    <div
      className="max-w-full overflow-hidden rounded-2xl border border-stone-100 bg-white"
      aria-label={`Recuperação ${patientName}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-stone-800">{patientName}</span>
          <span className="mt-0.5 block truncate text-xs text-stone-500">
            {pendingCount === 1 ? '1 pendência' : `${pendingCount} pendências`}
            {!open && summary ? ` · ${summary}` : ''}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
          {pendingCount}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul id={panelId} className="space-y-2 border-t border-stone-100 p-4">
          {result.actions.map((a) => {
            const Icon = META[a.type]?.icon ?? Target;
            return (
              <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-stone-100 px-3 py-2 md:flex-row md:items-center md:justify-between md:gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-50 text-stone-600">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-800 truncate">{a.title}</p>
                    <p className="text-xs text-stone-500 truncate">{a.reason}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAction(a.type)}
                  className="min-h-[44px] w-full shrink-0 whitespace-nowrap rounded-xl bg-stone-900 px-3 text-white text-xs font-black hover:bg-stone-800 md:w-auto"
                  aria-label={a.cta}
                >
                  {a.cta}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}