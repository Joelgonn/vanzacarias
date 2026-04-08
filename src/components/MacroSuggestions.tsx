'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Flame,
  Beef,
  Wheat,
  Droplets,
} from 'lucide-react';
import { Suggestion, MacroAnalysis } from '@/lib/macroEngine';

interface MacroSuggestionsProps {
  suggestions: Suggestion[];
  analysis: MacroAnalysis;
  className?: string;
}

type MacroStatus = 'low' | 'high' | 'ok';

export function MacroSuggestions({ suggestions, analysis, className = '' }: MacroSuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedDetails, setExpandedDetails] = useState(false);

  if (suggestions.length === 0) {
    return (
      <div className={`rounded-2xl border border-emerald-200 bg-emerald-50 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <CheckCircle size={20} className="shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-900">Todos os macros estao dentro da meta.</p>
            <p className="mt-0.5 text-xs text-emerald-700">Cardapio balanceado. Continue assim.</p>
          </div>
        </div>
      </div>
    );
  }

  const criticalIssues = suggestions.filter((suggestion) => suggestion.priority === 1);

  const getStatusCardClasses = (status: MacroStatus) => {
    switch (status) {
      case 'low':
        return 'border-red-200/80 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.12),transparent_42%),linear-gradient(180deg,rgba(254,242,242,0.98)_0%,rgba(255,255,255,1)_100%)] shadow-[0_16px_30px_-24px_rgba(220,38,38,0.55)]';
      case 'high':
        return 'border-amber-200/80 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_42%),linear-gradient(180deg,rgba(255,251,235,0.98)_0%,rgba(255,255,255,1)_100%)] shadow-[0_16px_30px_-24px_rgba(217,119,6,0.52)]';
      default:
        return 'border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.12),transparent_42%),linear-gradient(180deg,rgba(236,253,245,0.98)_0%,rgba(255,255,255,1)_100%)] shadow-[0_16px_30px_-24px_rgba(5,150,105,0.46)]';
    }
  };

  const getStatusAccent = (status: MacroStatus) => {
    switch (status) {
      case 'low':
        return 'bg-red-500';
      case 'high':
        return 'bg-amber-500';
      default:
        return 'bg-emerald-500';
    }
  };

  const getStatusTextTone = (status: MacroStatus) => {
    switch (status) {
      case 'low':
        return 'text-red-600';
      case 'high':
        return 'text-amber-600';
      default:
        return 'text-emerald-600';
    }
  };

  const formatStatusText = (value: number, status: MacroStatus, unit: string) => {
    if (status === 'ok') {
      return { value: 'Na meta', unit: '', direction: 'alinhado' };
    }

    return {
      value: `${Math.abs(Math.round(value))}`,
      unit,
      direction: status === 'low' ? 'abaixo' : 'acima',
    };
  };

  const statusCards = [
    {
      key: 'kcal',
      label: 'Calorias',
      unit: 'kcal',
      status: analysis.status.kcal as MacroStatus,
      diff: analysis.diff.kcal,
      icon: Flame,
    },
    {
      key: 'protein',
      label: 'Proteina',
      unit: 'g',
      status: analysis.status.protein as MacroStatus,
      diff: analysis.diff.protein,
      icon: Beef,
    },
    {
      key: 'carbs',
      label: 'Carboidrato',
      unit: 'g',
      status: analysis.status.carbs as MacroStatus,
      diff: analysis.diff.carbs,
      icon: Wheat,
    },
    {
      key: 'fat',
      label: 'Gordura',
      unit: 'g',
      status: analysis.status.fat as MacroStatus,
      diff: analysis.diff.fat,
      icon: Droplets,
    },
  ];

  return (
    <div className={`overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 transition-colors hover:bg-stone-50"
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-600" />
          <div className="text-left">
            <p className="text-sm font-black text-stone-900">
              {suggestions.length} ajuste{suggestions.length > 1 ? 's' : ''} necessario{suggestions.length > 1 ? 's' : ''}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-stone-500">
              Prioridade: {criticalIssues.length > 0 ? 'Alta' : 'Normal'}
            </p>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-stone-400" /> : <ChevronDown size={18} className="text-stone-400" />}
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t border-stone-100 p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Status Atual</p>
            <div className="grid grid-cols-2 gap-2">
              {statusCards.map((item) => {
                const statusText = formatStatusText(item.diff, item.status, item.unit);
                const MacroIcon = item.icon;

                return (
                  <div
                    key={item.key}
                    className={`relative min-h-[86px] overflow-hidden rounded-[1.1rem] border px-2.5 py-2.5 sm:min-h-[92px] sm:px-2.5 sm:py-2.5 ${getStatusCardClasses(item.status)}`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-px opacity-70 ${getStatusAccent(item.status)}`}></div>
                    <div className="pointer-events-none absolute right-2 top-2 opacity-[0.04]">
                      <MacroIcon size={20} strokeWidth={1.35} className="text-stone-900" />
                    </div>

                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5 pr-1">
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90 ring-1 ring-black/5 shadow-[0_4px_12px_-10px_rgba(0,0,0,0.35)] backdrop-blur-sm ${getStatusTextTone(item.status)}`}>
                            <MacroIcon size={10} strokeWidth={2.2} />
                          </div>
                          <span className="text-[8px] font-black leading-none tracking-[-0.01em] text-stone-700">
                            {item.label}
                          </span>
                        </div>

                        <div className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-1 py-1 ring-1 ring-black/5 shadow-[0_4px_12px_-10px_rgba(0,0,0,0.3)] backdrop-blur-sm">
                          <span className={`h-1.5 w-1.5 rounded-full ${getStatusAccent(item.status)}`}></span>
                          <span className="sr-only">{statusText.direction}</span>
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <div className="flex items-end gap-0.5 leading-none">
                          <p className="text-[0.8rem] font-black tracking-[-0.03em] text-stone-900 sm:text-[0.86rem]">
                            {statusText.value}
                          </p>
                          {statusText.unit ? (
                            <span className="pb-[1px] text-[0.5rem] font-bold uppercase tracking-[0.04em] text-stone-500">
                              {statusText.unit}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[6px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                          diferenca atual
                        </p>
                      </div>

                      <div className="mt-auto pt-2">
                        <span className={`inline-flex items-center rounded-full border border-current/10 bg-white/85 px-1.5 py-[0.2rem] text-[6px] font-black uppercase tracking-[0.14em] shadow-[0_4px_12px_-10px_rgba(0,0,0,0.28)] backdrop-blur-sm ${getStatusTextTone(item.status)}`}>
                          {statusText.direction}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Acoes Recomendadas</p>
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => {
                const isUrgent = suggestion.priority === 1;
                const actionText = suggestion.action === 'increase' ? 'Aumentar' : 'Reduzir';
                const symbol = suggestion.action === 'increase' ? '+' : '-';
                const accentTone = suggestion.action === 'increase'
                  ? 'border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.12),transparent_40%),linear-gradient(180deg,rgba(240,253,244,0.95)_0%,rgba(255,255,255,1)_100%)]'
                  : 'border-rose-200/80 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.12),transparent_40%),linear-gradient(180deg,rgba(255,241,242,0.95)_0%,rgba(255,255,255,1)_100%)]';
                const symbolTone = suggestion.action === 'increase'
                  ? 'bg-emerald-500/12 text-emerald-700 ring-emerald-100'
                  : 'bg-rose-500/12 text-rose-700 ring-rose-100';
                const metaTone = suggestion.action === 'increase' ? 'text-emerald-700' : 'text-rose-700';

                return (
                  <div
                    key={idx}
                    className={`rounded-[1.25rem] border p-3.5 shadow-[0_14px_28px_-24px_rgba(28,25,23,0.35)] ${
                      isUrgent ? `${accentTone} ring-1 ring-amber-100/70` : `${accentTone}`
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${symbolTone}`}>
                        <span className="text-[12px] font-black">{symbol}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[12px] font-black tracking-tight text-stone-900">{suggestion.foodName}</p>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                              {actionText} por porcao
                            </p>
                          </div>
                          {isUrgent && (
                            <span className="shrink-0 rounded-full border border-amber-200 bg-white/80 px-2 py-[0.3rem] text-[7px] font-black uppercase tracking-[0.14em] text-amber-800">
                              Urgente
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="rounded-full bg-white/80 px-2 py-[0.32rem] text-[9px] font-black text-stone-500 ring-1 ring-stone-200/70">
                            {Math.round(suggestion.currentGrams)}g
                          </span>
                          <span className="text-[9px] font-bold text-stone-300">→</span>
                          <span className={`rounded-full px-2 py-[0.32rem] text-[9px] font-black ring-1 ring-current/10 bg-white/85 ${metaTone}`}>
                            {Math.round(suggestion.newGrams)}g
                          </span>
                        </div>

                        <p className="mt-1.5 text-[9px] leading-relaxed text-stone-500">
                          {suggestion.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setExpandedDetails(!expandedDetails)}
            className="flex w-full items-center justify-center gap-1 py-1 text-[9px] font-bold text-stone-400 hover:text-stone-600"
          >
            {expandedDetails ? 'Menos detalhes' : 'Ver detalhes tecnicos'}
            {expandedDetails ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {expandedDetails && (
            <div className="space-y-1 rounded-xl bg-stone-50 p-3 font-mono text-[9px] text-stone-500">
              <p>Prioridade: {criticalIssues.length > 0 ? 'Alta' : 'Normal'}</p>
              <p>
                Diff: Kcal {Math.round(analysis.diff.kcal)} | P {Math.round(analysis.diff.protein)}g | C{' '}
                {Math.round(analysis.diff.carbs)}g | G {Math.round(analysis.diff.fat)}g
              </p>
              <p>Status: {Object.entries(analysis.status).map(([key, value]) => `${key}:${value}`).join(' | ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
