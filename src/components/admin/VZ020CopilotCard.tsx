'use client';

import type { CopilotResult, PreConsultResult } from '@/lib/vz020/types';

interface Props {
  copilot: CopilotResult;
  preConsult?: PreConsultResult | null;
  onOpenPatient?: () => void;
  onOpenHistory?: () => void;
}

const TITLE_ICON: Record<string, string> = {
  Resumo: '📋',
  Evolução: '📈',
  Adesão: '✅',
  Rotina: '🕒',
  Humor: '💬',
  Recuperação: '🔄',
  'Pré-consulta': '🩺',
  'Pontos para conversar': '💡',
};

export default function VZ020CopilotCard({ copilot, preConsult, onOpenPatient, onOpenHistory }: Props) {
  return (
    <section
      className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 sm:p-5"
      aria-labelledby="copilot-title"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 id="copilot-title" className="text-sm sm:text-base font-black tracking-tight text-stone-900 dark:text-white">
            Copiloto • {copilot.patientName}
          </h2>
          <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400 mt-0.5">
            Camada de contexto — não substitui Perfil, Avaliação ou QFA
          </p>
        </div>
        {(onOpenPatient || onOpenHistory) && (
          <div className="flex gap-2 shrink-0">
            {onOpenPatient && (
              <button
                type="button"
                onClick={onOpenPatient}
                className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-xs font-black hover:opacity-90 transition-opacity"
              >
                Abrir paciente
              </button>
            )}
            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="min-h-[44px] min-w-[44px] px-4 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-black text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Histórico
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {copilot.sections.map((s) => (
          <div
            key={s.title}
            className={`rounded-xl border p-3 sm:p-4 ${
              s.title === 'Pontos para conversar'
                ? 'sm:col-span-2 bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30'
                : s.title === 'Pré-consulta'
                ? 'sm:col-span-2 bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30'
                : 'bg-stone-50/50 dark:bg-stone-800/30 border-stone-100 dark:border-stone-800'
            }`}
          >
            <h3 className="text-[11px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <span aria-hidden="true">{TITLE_ICON[s.title] ?? '•'}</span> {s.title}
            </h3>
            <ul className="mt-2 space-y-1">
              {s.lines.map((l, i) => (
                <li key={i} className="text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300 leading-relaxed break-words">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {preConsult && (
        <div className="mt-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 p-3 sm:p-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">{preConsult.title}</h3>
          <ul className="mt-2 space-y-1">
            {preConsult.items.map((it, i) => (
              <li key={i} className="text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300">
                • {it}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
