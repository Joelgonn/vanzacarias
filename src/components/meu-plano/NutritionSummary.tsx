'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import {
  Activity, Flame, Beef, Wheat, Droplets, ChevronRight,
  Plus, Minus, Cookie, Trash2, AlertCircle,
} from 'lucide-react';
import type { BeliscoItem, BeliscosTotals } from '@/lib/beliscoUtils';
import type { MacroPorRefeicao } from '@/components/meu-plano/MacroCard';

// =========================================================================
// NUTRITION SUMMARY — Nutrição do Dia (unificada)
// MacroCard + WaterTracker + BeliscoCard em superfície contínua.
// Padrão JourneyStep (dividers sutis, sem cards independentes).
// =========================================================================

type NutritionSummaryProps = {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  consumedKcal: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  macrosPorRefeicao?: MacroPorRefeicao[];
  waterCount: number;
  onUpdateWater: (increment: number) => void;
  beliscos: BeliscosTotals;
  beliscoItems: BeliscoItem[];
  beliscoTotalKcal: number;
  onOpenBeliscoModal: () => void;
  onRemoveBeliscoItem: (id: string) => void;
  readOnly?: boolean;
};

function calcPercent(consumed: number, total: number) {
  return Math.min(Math.round((consumed / (total || 1)) * 100), 100);
}

// ThinBar — barra de progresso fina com role="progressbar"
function ThinBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

// JourneyStep — seção contínua (padrão DailyJourney)
function JourneyStep({ icon, iconClass = 'text-nutri-700', title, right, children }: {
  icon: React.ReactNode;
  iconClass?: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-stone-100 py-6 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
            {icon}
          </span>
          <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-700">{title}</h4>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function NutritionSummary({
  totalKcal, totalProtein, totalCarbs, totalFat,
  consumedKcal, consumedProtein, consumedCarbs, consumedFat,
  macrosPorRefeicao = [],
  waterCount, onUpdateWater,
  beliscos, beliscoItems, beliscoTotalKcal, onOpenBeliscoModal, onRemoveBeliscoItem,
  readOnly = false,
}: NutritionSummaryProps) {
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
  const [expandedMacros, setExpandedMacros] = useState(false);
  const [expandedBeliscos, setExpandedBeliscos] = useState(false);

  const safeBeliscos = beliscos || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const safeBeliscoItems = beliscoItems || [];
  const safeBeliscoTotalKcal = beliscoTotalKcal || 1;
  const beliscoPercent = safeBeliscoTotalKcal > 0 ? (safeBeliscos.kcal / safeBeliscoTotalKcal) * 100 : 0;
  const beliscoBarPercent = Math.min(beliscoPercent, 100);

  const getBeliscoBarColor = () => {
    if (beliscoPercent <= 15) return '#10b981';
    if (beliscoPercent <= 25) return '#f59e0b';
    return '#ef4444';
  };

  const getBeliscoStatus = () => {
    if (beliscoPercent <= 10) return { text: 'Controle excelente', color: 'text-emerald-600' };
    if (beliscoPercent <= 20) return { text: 'Dentro do esperado', color: 'text-emerald-600' };
    if (beliscoPercent <= 30) return { text: 'Atenção', color: 'text-amber-600' };
    return { text: 'Muitos beliscos', color: 'text-red-600' };
  };

  const beliscoStatus = getBeliscoStatus();

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]"
    >
      <div className="relative z-10 p-5 sm:p-7 md:p-10">

        {/* ============ CABEÇALHO ============ */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-nutri-700 text-white shadow-sm">
            <Activity size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">Nutrição do Dia</h3>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mt-0.5">Meta: {Math.round(totalKcal)} kcal</p>
          </div>
        </div>

        {/* ============ KCAL (etapa principal) ============ */}
        <JourneyStep
          icon={<Flame size={16} className="text-orange-500" aria-hidden="true" />}
          iconClass="bg-orange-50 text-orange-600"
          title="Calorias"
          right={
            <span className="text-sm font-black text-stone-800 tabular-nums">
              {Math.round(consumedKcal)}<span className="text-xs font-bold text-stone-400"> / {Math.round(totalKcal)} kcal</span>
            </span>
          }
        >
          <ThinBar value={calcPercent(consumedKcal, totalKcal)} color="#f97316" />
        </JourneyStep>

        {/* ============ MACROS (etapa) ============ */}
        <JourneyStep
          icon={<Activity size={16} className="text-nutri-600" aria-hidden="true" />}
          iconClass="bg-nutri-50 text-nutri-700"
          title="Macronutrientes"
        >
          <div className="space-y-3">
            {/* Proteínas */}
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                <span className="text-stone-500 flex items-center gap-1">
                  <Beef size={11} className="text-red-500" aria-hidden="true" /> Proteínas
                </span>
                <span className="text-stone-800 tabular-nums">
                  {Math.round(consumedProtein)}g <span className="text-stone-400">/ {Math.round(totalProtein)}g</span>
                </span>
              </div>
              <ThinBar value={calcPercent(consumedProtein, totalProtein)} color="#ef4444" />
            </div>
            {/* Carboidratos */}
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                <span className="text-stone-500 flex items-center gap-1">
                  <Wheat size={11} className="text-amber-500" aria-hidden="true" /> Carboidratos
                </span>
                <span className="text-stone-800 tabular-nums">
                  {Math.round(consumedCarbs)}g <span className="text-stone-400">/ {Math.round(totalCarbs)}g</span>
                </span>
              </div>
              <ThinBar value={calcPercent(consumedCarbs, totalCarbs)} color="#f59e0b" />
            </div>
            {/* Gorduras */}
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                <span className="text-stone-500 flex items-center gap-1">
                  <Droplets size={11} className="text-blue-500" aria-hidden="true" /> Gorduras
                </span>
                <span className="text-stone-800 tabular-nums">
                  {Math.round(consumedFat)}g <span className="text-stone-400">/ {Math.round(totalFat)}g</span>
                </span>
              </div>
              <ThinBar value={calcPercent(consumedFat, totalFat)} color="#3b82f6" />
            </div>
          </div>

          {/* Detalhamento por refeição (expandível) */}
          {macrosPorRefeicao.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setExpandedMacros(!expandedMacros)}
                aria-expanded={expandedMacros}
                className="w-full flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest font-bold text-stone-400 hover:text-nutri-700 py-2 rounded-xl hover:bg-stone-50 transition-all"
              >
                <span>Por refeição</span>
                <ChevronRight size={14} aria-hidden="true" className={`transition-transform ${expandedMacros ? 'rotate-90' : ''}`} />
              </button>
              {expandedMacros && (
                <div className="mt-3 space-y-2">
                  {macrosPorRefeicao.map((ref) => (
                    <div key={`${ref.nome}-${ref.horario}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm gap-2">
                      <div>
                        <p className="font-bold text-stone-700 text-xs">{ref.nome}</p>
                        <p className="text-[10px] text-stone-400 font-bold uppercase">{ref.horario}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-black">
                        <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{Math.round(ref.kcal)} kcal</span>
                        <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{Math.round(ref.protein)}g P</span>
                        <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{Math.round(ref.carbs)}g C</span>
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{Math.round(ref.fat)}g G</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </JourneyStep>

        {/* ============ HIDRATAÇÃO (etapa) ============ */}
        <JourneyStep
          icon={<Droplets size={16} className="text-blue-500" aria-hidden="true" />}
          iconClass="bg-blue-50 text-blue-600"
          title="Hidratação"
          right={
            <span className="text-sm font-black text-blue-600 tabular-nums">
              {waterCount * 250}<span className="text-xs font-bold text-stone-400"> ml</span>
            </span>
          }
        >
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs font-medium text-stone-500 mb-2">
                {waterCount} copo{waterCount !== 1 ? 's' : ''} de 250 ml
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateWater(-1)}
                aria-label="Remover copo de água"
                disabled={readOnly}
                className="w-11 h-11 rounded-xl bg-white border border-stone-200 text-stone-400 flex items-center justify-center hover:bg-stone-100 hover:text-stone-600 transition-colors shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Minus size={18} aria-hidden="true" />
              </button>
              <button
                onClick={() => onUpdateWater(1)}
                aria-label="Adicionar copo de água"
                disabled={readOnly}
                className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </JourneyStep>

        {/* ============ BELISCOS (etapa) ============ */}
        <JourneyStep
          icon={<Cookie size={16} className="text-amber-500" aria-hidden="true" />}
          iconClass="bg-amber-50 text-amber-600"
          title="Beliscos"
          right={
            <button
              onClick={onOpenBeliscoModal}
              disabled={readOnly}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={14} aria-hidden="true" /> Registrar
            </button>
          }
        >
          {/* Barra de beliscos */}
          <div className="mb-3">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-medium text-stone-500">Consumo extra</span>
              <span className={`text-sm font-black tabular-nums ${beliscoStatus.color}`}>
                {Math.round(safeBeliscos.kcal)}<span className="text-xs font-bold text-stone-400"> kcal</span>
              </span>
            </div>
            <ThinBar value={beliscoBarPercent} color={getBeliscoBarColor()} />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-bold text-stone-400">0%</span>
              <span className={`text-[10px] font-bold ${beliscoStatus.color}`}>{beliscoStatus.text}</span>
            </div>
          </div>

          {/* Resumo de macros do belisco */}
          {(safeBeliscos.protein > 0 || safeBeliscos.carbs > 0 || safeBeliscos.fat > 0) && (
            <div className="flex gap-2 mb-3">
              {safeBeliscos.protein > 0 && (
                <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">P: {Math.round(safeBeliscos.protein)}g</span>
              )}
              {safeBeliscos.carbs > 0 && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">C: {Math.round(safeBeliscos.carbs)}g</span>
              )}
              {safeBeliscos.fat > 0 && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">G: {Math.round(safeBeliscos.fat)}g</span>
              )}
            </div>
          )}

          {/* Lista de itens */}
          {safeBeliscoItems.length > 0 && (
            <div>
              <button
                onClick={() => setExpandedBeliscos(!expandedBeliscos)}
                aria-expanded={expandedBeliscos}
                className="w-full flex items-center justify-between text-left text-[10px] font-bold uppercase text-stone-400 tracking-widest py-1 hover:text-stone-600 transition-colors"
              >
                <span>Histórico ({safeBeliscoItems.length})</span>
                <span>{expandedBeliscos ? '▲' : '▼'}</span>
              </button>
              {expandedBeliscos && (
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {safeBeliscoItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-100 group hover:border-stone-200 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-700 truncate">{item.name || 'Manual'}</span>
                          {item.grams && <span className="text-[10px] font-bold text-stone-400 shrink-0">{Math.round(item.grams)}g</span>}
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-amber-600">{Math.round(item.kcal)} kcal</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemoveBeliscoItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-500 transition-all shrink-0"
                        aria-label={`Remover ${item.name || 'item'}`}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Estado vazio */}
          {safeBeliscoItems.length === 0 && (
            <p className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
              <AlertCircle size={12} aria-hidden="true" /> Nenhum belisco registrado. Continue assim!
            </p>
          )}

          {/* Alerta de excesso */}
          {beliscoPercent > 30 && (
            <div className="mt-3 flex items-center gap-2 p-2.5 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle size={12} className="text-red-500 shrink-0" aria-hidden="true" />
              <p className="text-[11px] font-medium text-red-700">
                Beliscos representam {Math.round(beliscoPercent)}% das calorias diárias.
              </p>
            </div>
          )}
        </JourneyStep>

      </div>
    </motion.section>
  );
}
