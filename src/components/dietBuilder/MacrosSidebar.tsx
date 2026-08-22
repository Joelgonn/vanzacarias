'use client';

import { ArrowDown, ArrowUp, CheckCircle2, Target } from 'lucide-react';
import type { MacroAnalysis } from '@/types/macroEngine';

interface MacrosSidebarProps {
  totals: { kcal: number; p: number; c: number; g: number };
  targets: { kcal: number; protein: number; carbs: number; fat: number };
  analysis?: MacroAnalysis;
}

export function MacrosSidebar({ totals, targets, analysis }: MacrosSidebarProps) {
  const getPercentage = (current: number, target: number) => {
    if (!target) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    switch (status) {
      case 'low':
        return <ArrowDown size={10} className="ml-1 text-red-500" strokeWidth={3} />;
      case 'high':
        return <ArrowUp size={10} className="ml-1 text-amber-500" strokeWidth={3} />;
      default:
        return <CheckCircle2 size={10} className="ml-1 text-emerald-500" strokeWidth={3} />;
    }
  };

  const rows = [
    {
      key: 'kcal',
      label: 'Kcal',
      current: Math.round(totals.kcal),
      target: targets.kcal,
      display: `${Math.round(totals.kcal)} / ${targets.kcal}`,
      tone: 'text-stone-800',
      track: 'bg-stone-100',
      fill: 'bg-stone-800',
      chip: 'bg-stone-900 text-white',
      status: analysis?.status.kcal,
    },
    {
      key: 'protein',
      label: 'Proteina',
      current: Math.round(totals.p),
      target: targets.protein,
      display: `${Math.round(totals.p)}g / ${targets.protein}g`,
      tone: 'text-red-600',
      track: 'bg-red-100',
      fill: 'bg-red-500',
      chip: 'border border-red-100 bg-red-50 text-red-700',
      status: analysis?.status.protein,
    },
    {
      key: 'carbs',
      label: 'Carboidrato',
      current: Math.round(totals.c),
      target: targets.carbs,
      display: `${Math.round(totals.c)}g / ${targets.carbs}g`,
      tone: 'text-amber-600',
      track: 'bg-amber-100',
      fill: 'bg-amber-500',
      chip: 'border border-amber-100 bg-amber-50 text-amber-700',
      status: analysis?.status.carbs,
    },
    {
      key: 'fat',
      label: 'Gordura',
      current: Math.round(totals.g),
      target: targets.fat,
      display: `${Math.round(totals.g)}g / ${targets.fat}g`,
      tone: 'text-blue-600',
      track: 'bg-blue-100',
      fill: 'bg-blue-500',
      chip: 'border border-blue-100 bg-blue-50 text-blue-700',
      status: analysis?.status.fat,
    },
  ];

  return (
    <div className="space-y-3.5 rounded-[1.7rem] border border-stone-200/90 bg-[radial-gradient(circle_at_top_left,rgba(214,211,209,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(250,250,249,0.98)_100%)] p-4 shadow-[0_14px_40px_-28px_rgba(28,25,23,0.32)]">
      <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 ring-1 ring-stone-200/80">
          <Target size={14} />
        </div>
        <div>
          <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Metas do Dia</span>
          <span className="block text-[11px] font-semibold text-stone-400">Comparativo ao vivo</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-[1.05rem] border border-stone-200/80 bg-white/80 px-3 py-2 shadow-[0_10px_24px_-22px_rgba(28,25,23,0.32)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center">
                  <span className={`text-[11px] font-black tracking-[0.01em] ${row.tone}`}>{row.label}</span>
                  {getStatusBadge(row.status)}
                </div>
                <p className="mt-0.5 text-[9px] font-medium text-stone-400">
                  Meta {row.target}{row.key === 'kcal' ? '' : 'g'}
                </p>
              </div>

              <div className={`shrink-0 rounded-full px-2.5 py-[0.3rem] text-[9px] font-black tracking-tight ${row.chip}`}>
                {row.display}
              </div>
            </div>

            <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${row.track}`}>
              <div
                className={`h-full rounded-full ${row.fill} transition-all duration-500`}
                style={{ width: `${getPercentage(row.current, row.target)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
