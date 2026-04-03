'use client';

import React from 'react';
import { Flame, Zap, Info, TrendingUp, Target, AlertTriangle, ShieldAlert } from 'lucide-react';
import { FoodRestriction } from '@/types/patient';

interface Props {
  weight: number | null;
  height: number | null;
  age: number | null;
  gender?: string;
  bf?: number | null;
  leanMass?: number | null;
  dailyLogs: any[];
  weightTrend?: 'losing' | 'gaining' | 'stable' | null;
  // 🔥 Novas Props recebidas do Pai (Single Source of Truth)
  tmb: number;
  tmbMethod: string;
  getVal: number;
  avgActivityKcal: number;
  recommendation: {
    calories: number;
    goal: string;
    strategy: string;
    alert?: string;
  } | null;
  // 🔥 Restrições injetadas pelo perfil do paciente
  foodRestrictions?: FoodRestriction[];
}

export default function MetabolicSummary({
  weight,
  height,
  age,
  gender,
  bf,
  leanMass,
  dailyLogs = [],
  weightTrend,
  tmb,
  tmbMethod,
  getVal: get, // Renomeando localmente para 'get' para manter a interface visual
  avgActivityKcal,
  recommendation,
  foodRestrictions = []
}: Props) {

  // 🔥 1. BARRA VISUAL DO GET (Único cálculo que fica, pois é puramente visual)
  const tmbPercent = get > 0 ? Math.round(((tmb * 1.2) / get) * 100) : 0;
  const activityPercent = get > 0 ? 100 - tmbPercent : 0;

  // 🔥 SEPARAÇÃO DO PERFIL ALIMENTAR
  const allergies = foodRestrictions.filter(r => r.type === 'allergy');
  const intolerances = foodRestrictions.filter(r => r.type === 'intolerance');
  const restrictions = foodRestrictions.filter(r => r.type === 'restriction');
  const hasAnyRestriction = foodRestrictions.length > 0;

  // 🔥 2. FALLBACK
  if (!weight || !height || !age) {
    return (
      <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center h-full min-h-[320px]">
        <Flame size={40} className="text-stone-300 mb-4" />
        <p className="text-sm font-medium text-stone-500">
          Dados insuficientes para cálculo metabólico.
        </p>
        <p className="text-xs text-stone-400 mt-2">
          Verifique se o paciente possui <strong className="text-stone-500">Idade, Peso e Altura</strong>.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col hover:shadow-md transition-shadow h-full min-h-[320px] relative overflow-hidden group">

      <div className="absolute -right-16 -top-16 w-48 h-48 bg-gradient-to-br from-orange-50 to-rose-50 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col h-full">

        {/* HEADER */}
        <h2 className="text-lg md:text-xl font-bold mb-6 border-b border-stone-100 pb-4 text-stone-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Flame size={20} className="text-orange-500" /> Resumo Metabólico
          </span>

          {bf && bf > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest bg-stone-100 text-stone-500 px-3 py-1 rounded-lg">
              BF: {bf}%
            </span>
          )}
        </h2>

        <div className="space-y-5 flex-1 flex flex-col">

          {/* TMB */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest font-black flex items-center gap-1.5">
                Taxa Metabólica Basal
                <span title={`Calculado por: ${tmbMethod}`} className="cursor-help">
                  <Info size={12} className="text-stone-300 hover:text-stone-500" />
                </span>
              </p>
              <p className="font-extrabold text-stone-700 text-2xl tracking-tight mt-0.5">
                {tmb} <span className="text-sm font-bold text-stone-400">kcal</span>
              </p>
            </div>
          </div>

          {/* ATIVIDADE */}
          <div className="flex items-end justify-between border-l-2 border-emerald-400 pl-4">
            <div>
              <p className="text-[10px] text-emerald-600 uppercase tracking-widest font-black">
                Gasto Extra Médio (7 dias)
              </p>
              <p className="font-extrabold text-emerald-600 text-2xl tracking-tight mt-0.5 flex items-center gap-2">
                <TrendingUp size={18} strokeWidth={3} />
                +{avgActivityKcal} <span className="text-sm font-bold opacity-70">kcal</span>
              </p>
            </div>
          </div>

          {/* GET */}
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-stone-500 uppercase tracking-widest font-black flex items-center gap-1.5">
                <Zap size={14} className="text-amber-500" fill="currentColor" /> GET Atual Real
              </p>
              <p className="font-black text-stone-900 text-xl tracking-tight">
                {get} <span className="text-xs text-stone-500">kcal/dia</span>
              </p>
            </div>

            <div className="w-full bg-stone-200 rounded-full h-2 flex overflow-hidden shadow-inner">
              <div
                className="bg-stone-400 h-2"
                style={{ width: `${tmbPercent}%` }}
              />
              <div
                className="bg-emerald-400 h-2"
                style={{ width: `${activityPercent}%` }}
              />
            </div>
          </div>

          {/* PERFIL ALIMENTAR (NOVO) */}
          {hasAnyRestriction && (
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-100/80">
              <p className="text-[10px] text-stone-500 uppercase tracking-widest font-black flex items-center gap-1.5 mb-2.5">
                <ShieldAlert size={14} className="text-stone-400" /> Perfil Alimentar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allergies.map((r, index) => (
                  <span key={r.id || `allergy-${index}`} title="Alergia Grave (Risco de Bloqueio)" className="bg-red-50 text-red-600 border border-red-200/60 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-sm">
                    🔴 <span className="capitalize">{r.food || r.tag || r.foodId || 'Alergia'}</span>
                  </span>
                ))}
                {intolerances.map((r, index) => (
                  <span key={r.id || `intolerance-${index}`} title="Intolerância Alimentar" className="bg-amber-50 text-amber-700 border border-amber-200/60 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-sm">
                    🟡 <span className="capitalize">{r.food || r.tag || r.foodId || 'Intolerância'}</span>
                  </span>
                ))}
                {restrictions.map((r, index) => (
                  <span key={r.id || `restriction-${index}`} title="Restrição Comportamental" className="bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-sm">
                    🔵 <span className="capitalize">{r.food || r.tag || r.foodId || 'Restrição'}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* RECOMENDAÇÃO */}
          {recommendation && (
            <div className="mt-auto bg-gradient-to-br from-nutri-50 to-white p-4 rounded-2xl border border-nutri-100 shadow-sm">

              <div className="flex items-center gap-1.5 mb-2">
                <Target size={14} className="text-nutri-600" />
                <p className="text-[10px] font-black uppercase text-nutri-700 tracking-widest">
                  Prescrição Sugerida
                </p>
              </div>

              <p className="text-2xl font-black text-nutri-900">
                {recommendation.calories} <span className="text-sm">kcal</span>
              </p>

              <p className="text-xs font-bold text-nutri-800 mt-1 capitalize">
                Meta: {recommendation.goal}
              </p>

              <p className="text-[10px] text-nutri-600">
                {recommendation.strategy}
              </p>

              {recommendation.alert && (
                <div className="mt-3 pt-3 border-t border-nutri-100 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <p className="text-[10px] font-bold text-amber-700">
                    {recommendation.alert}
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </section>
  );
}