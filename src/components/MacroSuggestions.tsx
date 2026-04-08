// components/nutrition/MacroSuggestions.tsx
'use client';

import { useState } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Suggestion, MacroAnalysis } from '@/lib/macroEngine'; // ✅ CORRIGIDO: caminho correto

interface MacroSuggestionsProps {
  suggestions: Suggestion[];
  analysis: MacroAnalysis;
  className?: string;
}

export function MacroSuggestions({ suggestions, analysis, className = '' }: MacroSuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedDetails, setExpandedDetails] = useState(false);

  if (suggestions.length === 0) {
    return (
      <div className={`bg-emerald-50 border border-emerald-200 rounded-2xl p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <CheckCircle size={20} className="text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-900">✅ Todos os macros estão dentro da meta!</p>
            <p className="text-xs text-emerald-700 mt-0.5">Cardápio balanceado. Continue assim.</p>
          </div>
        </div>
      </div>
    );
  }

  // 🔥 Agrupa sugestões por tipo de macro
  const criticalIssues = suggestions.filter(s => s.priority === 1);
  const otherIssues = suggestions.filter(s => s.priority > 1);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'low': return <TrendingDown size={14} className="text-red-500" />;
      case 'high': return <TrendingUp size={14} className="text-amber-500" />;
      default: return <CheckCircle size={14} className="text-emerald-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'low': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    }
  };

  return (
    <div className={`bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm ${className}`}>
      {/* Header com resumo */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-600" />
          <div className="text-left">
            <p className="text-sm font-black text-stone-900">
              ⚠️ {suggestions.length} ajuste{suggestions.length > 1 ? 's' : ''} necessário{suggestions.length > 1 ? 's' : ''}
            </p>
            <p className="text-[10px] font-medium text-stone-500 mt-0.5">
              Prioridade: {criticalIssues.length > 0 ? 'Alta' : 'Normal'}
            </p>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-stone-400" /> : <ChevronDown size={18} className="text-stone-400" />}
      </button>

      {isExpanded && (
        <div className="border-t border-stone-100 p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          
          {/* Status atual dos macros */}
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Status Atual</p>
            <div className="grid grid-cols-2 gap-2">
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${getStatusColor(analysis.status.kcal)}`}>
                <span className="text-xs font-bold">🔥 Calorias</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(analysis.status.kcal)}
                  <span className="text-[10px] font-bold">
                    {analysis.status.kcal === 'low' ? `${Math.abs(Math.round(analysis.diff.kcal))}kcal abaixo` :
                     analysis.status.kcal === 'high' ? `${Math.abs(Math.round(analysis.diff.kcal))}kcal acima` :
                     'OK'}
                  </span>
                </div>
              </div>
              
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${getStatusColor(analysis.status.protein)}`}>
                <span className="text-xs font-bold">💪 Proteína</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(analysis.status.protein)}
                  <span className="text-[10px] font-bold">
                    {analysis.status.protein === 'low' ? `${Math.abs(Math.round(analysis.diff.protein))}g abaixo` :
                     analysis.status.protein === 'high' ? `${Math.abs(Math.round(analysis.diff.protein))}g acima` :
                     'OK'}
                  </span>
                </div>
              </div>
              
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${getStatusColor(analysis.status.carbs)}`}>
                <span className="text-xs font-bold">🍚 Carboidrato</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(analysis.status.carbs)}
                  <span className="text-[10px] font-bold">
                    {analysis.status.carbs === 'low' ? `${Math.abs(Math.round(analysis.diff.carbs))}g abaixo` :
                     analysis.status.carbs === 'high' ? `${Math.abs(Math.round(analysis.diff.carbs))}g acima` :
                     'OK'}
                  </span>
                </div>
              </div>
              
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${getStatusColor(analysis.status.fat)}`}>
                <span className="text-xs font-bold">🧈 Gordura</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(analysis.status.fat)}
                  <span className="text-[10px] font-bold">
                    {analysis.status.fat === 'low' ? `${Math.abs(Math.round(analysis.diff.fat))}g abaixo` :
                     analysis.status.fat === 'high' ? `${Math.abs(Math.round(analysis.diff.fat))}g acima` :
                     'OK'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sugestões detalhadas */}
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Ações Recomendadas</p>
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => {
                const isUrgent = suggestion.priority === 1;
                const emoji = suggestion.action === 'increase' ? '➕' : '➖';
                const actionText = suggestion.action === 'increase' ? 'Aumentar' : 'Reduzir';
                
                return (
                  <div 
                    key={idx}
                    className={`p-3 rounded-xl border ${
                      isUrgent 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base">{emoji}</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-stone-900">
                          {suggestion.foodName}
                        </p>
                        <p className="text-xs text-stone-600 mt-0.5">
                          {actionText} de <span className="font-bold">{Math.round(suggestion.currentGrams)}g</span> para{' '}
                          <span className="font-bold">{Math.round(suggestion.newGrams)}g</span>
                        </p>
                        <p className="text-[10px] text-stone-500 mt-1">
                          {suggestion.reason}
                        </p>
                      </div>
                      {isUrgent && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-full uppercase">
                          Urgente
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detalhes expandidos (opcional) */}
          <button
            onClick={() => setExpandedDetails(!expandedDetails)}
            className="w-full flex items-center justify-center gap-1 text-[9px] font-bold text-stone-400 hover:text-stone-600 py-1"
          >
            {expandedDetails ? 'Menos detalhes' : 'Ver detalhes técnicos'}
            {expandedDetails ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {expandedDetails && (
            <div className="bg-stone-50 rounded-xl p-3 text-[9px] font-mono text-stone-500 space-y-1">
              {/* ✅ CORRIGIDO: analysis.priority substituído pela lógica baseada em criticalIssues */}
              <p>Prioridade: {criticalIssues.length > 0 ? 'Alta' : 'Normal'}</p>
              <p>Diff: Kcal {Math.round(analysis.diff.kcal)} | P {Math.round(analysis.diff.protein)}g | C {Math.round(analysis.diff.carbs)}g | G {Math.round(analysis.diff.fat)}g</p>
              <p>Status: {Object.entries(analysis.status).map(([k,v]) => `${k}:${v}`).join(' | ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}