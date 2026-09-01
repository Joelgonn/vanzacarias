'use client';

import type { RecoveryResult } from '@/lib/vz020/types';
import { ClipboardCheck, FileText, Target, RefreshCw } from 'lucide-react';

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

export default function VZ020RecoveryList({ patientName, result, onAction }: Props) {
  if (result.state === 'NO_DATA') return null;
  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-4" aria-label={`Recuperação ${patientName}`}>
      <p className="text-xs font-black uppercase tracking-widest text-stone-400">Para acompanhar • {patientName}</p>
      <ul className="mt-3 space-y-2">
        {result.actions.map((a) => {
          const Icon = META[a.type]?.icon ?? Target;
          return (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 px-3 py-2">
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
                className="shrink-0 min-h-[44px] px-3 rounded-xl bg-stone-900 text-white text-xs font-black hover:bg-stone-800"
                aria-label={a.cta}
              >
                {a.cta}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
