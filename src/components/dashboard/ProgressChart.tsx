'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  TrendingDown, Lock, Star, Loader2, Scale, Layers, Activity as ActivityIcon,
  TrendingUp, CalendarRange,
} from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Scatter,
} from 'recharts';

// =========================================================================
// PROGRESS CHART — Evolução (experiência editorial)
// Mesmas props/datasets/Recharts/tooltip/regras premium da ETAPA 2.
// Mudou apenas composição, hierarquia, lentes e paywall integrados.
// =========================================================================

export type ActiveLens = 'medidas' | 'composicao' | 'metabolico';

export interface ProgressChartProps {
  timelineData: Record<string, unknown>[];
  activeLens: ActiveLens;
  setActiveLens: (lens: ActiveLens) => void;
  isPremium: boolean;
  trialActive: boolean;
  processingCheckout: boolean;
  handleUpgradeClick: (planType?: string) => void;
  isGoalMet: boolean | undefined;
  metaPeso?: string | null;
  validWeightsCount: number;
  validWaistsCount: number;
  weightProgressPercent: number;
}

const LENS_CONFIG: Record<ActiveLens, { label: string; icon: typeof Scale; premium: boolean }> = {
  medidas: { label: 'Medidas', icon: Scale, premium: false },
  composicao: { label: 'Dobras', icon: Layers, premium: true },
  metabolico: { label: 'Metabolismo', icon: ActivityIcon, premium: true },
};

export default function ProgressChart({
  timelineData,
  activeLens,
  setActiveLens,
  isPremium,
  trialActive,
  processingCheckout,
  handleUpgradeClick,
  isGoalMet,
  metaPeso,
  validWeightsCount,
  validWaistsCount,
  weightProgressPercent,
}: ProgressChartProps) {
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

  const lensLocked = !isPremium && !trialActive && LENS_CONFIG[activeLens].premium;

  // Resumo contextual derivado exclusivamente dos dados existentes nas props
  const hasData = timelineData.length > 0;
  const summary = hasData
    ? weightProgressPercent > 0
      ? `Você já avançou ${Math.round(weightProgressPercent)}% rumo à sua meta.`
      : validWeightsCount === 1
      ? 'Sua primeira medida foi registrada. Adicione mais check-ins para formar a linha.'
      : 'Sua evolução vai aparecer aqui conforme você registra seus dados.'
    : 'Aguardando o primeiro relato para desenhar sua evolução.';

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]"
    >
      <div className="relative z-10 p-5 sm:p-7 md:p-10">

        {/* ============ CABEÇALHO EDITORIAL ============ */}
        <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.05 }} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-nutri-700 text-white shadow-sm">
              <TrendingDown size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight text-stone-900 leading-tight">Evolução</h3>
              <p className="mt-0.5 text-sm font-medium text-stone-500">{summary}</p>
            </div>
          </div>

          {/* Contagem de registros (dado existente) */}
          {validWeightsCount > 0 && (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-stone-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400 sm:inline-flex">
              <CalendarRange size={12} aria-hidden="true" /> {validWeightsCount} registro{validWeightsCount > 1 ? 's' : ''}
            </span>
          )}
        </motion.div>

        {/* ============ LENTES (controle segmentado integrado) ============ */}
        <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.1 }} className="mt-6">
          <div
            className="flex w-full gap-1 rounded-2xl bg-stone-50 p-1.5"
            role="group"
            aria-label="Dimensão da evolução"
          >
            {(Object.keys(LENS_CONFIG) as ActiveLens[]).map((lens) => {
              const cfg = LENS_CONFIG[lens];
              const Icon = cfg.icon;
              const isActive = activeLens === lens;
              const locked = cfg.premium && !isPremium && !trialActive;
              return (
                <button
                  key={lens}
                  onClick={() => setActiveLens(lens)}
                  aria-pressed={isActive}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-bold transition-all duration-200 active:scale-[0.98] sm:px-3 sm:py-2.5 sm:text-xs ${
                    isActive
                      ? 'bg-white text-nutri-900 shadow-sm border border-stone-100'
                      : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{cfg.label}</span>
                  {locked && <Lock size={11} className="text-amber-500" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ============ VISUALIZAÇÃO (gráfico ou estado premium) ============ */}
        <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.15 }} className="mt-6">
          <AnimatePresence mode="wait" initial={false}>
            {lensLocked ? (
              <motion.div
                key={`locked-${activeLens}`}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex min-h-[320px] flex-col items-center justify-center rounded-[2rem] bg-gradient-to-br from-stone-50/80 to-white px-6 py-10 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-nutri-900 to-nutri-700 shadow-lg rotate-3">
                  <Lock className="text-white" size={24} aria-hidden="true" />
                </div>
                <h4 className="mt-5 text-lg font-black tracking-tight text-stone-900">
                  {activeLens === 'composicao' ? 'Dobras cutâneas' : 'Análise metabólica'}
                </h4>
                <p className="mt-1.5 max-w-sm text-sm font-medium text-stone-500">
                  Visualize uma leitura mais profunda da sua evolução corporal.
                </p>
                <button
                  onClick={() => handleUpgradeClick('premium')}
                  disabled={processingCheckout}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-nutri-900 px-7 py-3.5 text-sm font-black text-white transition-all shadow-md hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {processingCheckout ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
                  Desbloquear análise avançada
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={`chart-${activeLens}`}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-[2rem] bg-stone-50/40 p-3 sm:p-5"
              >
                <div className="h-72 w-full min-w-0 sm:h-80">
                  {timelineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={timelineData} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isGoalMet ? "#22c55e" : "#166534"} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={isGoalMet ? "#22c55e" : "#166534"} stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorAreaWaist" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                        <XAxis dataKey="date" tickFormatter={val => new Date(val as string).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />

                        <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#a8a29e" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                        <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#818cf8" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />

                        <RechartsTooltip
                          cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }}
                          contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const raw = payload[0].payload as Record<string, unknown>;
                              const data = {
                                date: String(raw.date ?? ''),
                                peso: raw.peso as string | undefined,
                                cintura: raw.cintura as string | undefined,
                                imc: raw.imc as string | undefined,
                                somatorio_dobras: raw.somatorio_dobras as string | undefined,
                                homair: raw.homair as string | undefined,
                              };
                              return (
                                <div className="bg-white/95 backdrop-blur-xl text-stone-800 p-4 rounded-[1.5rem] shadow-xl border border-stone-100 min-w-[160px]">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-100 pb-2">{new Date(data.date).toLocaleDateString('pt-BR')}</p>

                                  {activeLens === 'medidas' && (
                                    <div className="space-y-2">
                                      {data.peso && <p className="font-bold text-sm flex justify-between gap-4">Peso: <span className="text-emerald-600">{data.peso} kg</span></p>}
                                      {data.cintura && <p className="font-bold text-sm flex justify-between gap-4">Cintura: <span className="text-indigo-600">{data.cintura} cm</span></p>}
                                      {data.imc && <p className="font-bold text-sm flex justify-between gap-4">IMC: <span className="text-stone-600">{data.imc}</span></p>}
                                    </div>
                                  )}

                                  {activeLens === 'composicao' && (
                                    <div className="space-y-2">
                                      {data.peso && <p className="font-bold text-sm flex justify-between gap-4">Peso: <span className="text-emerald-600">{data.peso} kg</span></p>}
                                      {data.somatorio_dobras && <p className="font-bold text-sm flex justify-between gap-4">Dobras: <span className="text-pink-500">{data.somatorio_dobras} mm</span></p>}
                                    </div>
                                  )}

                                  {activeLens === 'metabolico' && (
                                    <div className="space-y-2">
                                      {data.cintura && <p className="font-bold text-sm flex justify-between gap-4">Cintura: <span className="text-indigo-600">{data.cintura} cm</span></p>}
                                      {data.homair && <p className="font-bold text-sm flex justify-between gap-4">HOMA-IR: <span className="text-amber-500">{data.homair}</span></p>}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />

                        {/* 🔥 RENDERIZAÇÃO MELHORADA DAS LINHAS (Com fallback para ponto único) */}
                        {activeLens === 'medidas' && (
                          <>
                            {metaPeso && <ReferenceLine y={parseFloat(metaPeso)} yAxisId="left" stroke={isGoalMet ? "#22c55e" : "#cbd5e1"} strokeDasharray="5 5" label={{ value: 'Meta', position: 'insideTopLeft', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />}

                            {validWeightsCount > 1 ? (
                              <Area type="monotone" yAxisId="left" dataKey="peso" stroke={isGoalMet ? "#16a34a" : "#166534"} strokeWidth={4} fillOpacity={1} fill="url(#colorArea)" connectNulls activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: isGoalMet ? "#22c55e" : "#166534" }} />
                            ) : (
                              <Scatter yAxisId="left" dataKey="peso" fill="#166534" shape="circle" r={6} />
                            )}

                            {validWaistsCount > 1 ? (
                              <Line type="monotone" yAxisId="right" dataKey="cintura" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: "#818cf8" }} connectNulls />
                            ) : (
                              <Scatter yAxisId="right" dataKey="cintura" fill="#6366f1" shape="circle" r={6} />
                            )}
                          </>
                        )}

                        {activeLens === 'composicao' && (
                          <>
                            {metaPeso && <ReferenceLine y={parseFloat(metaPeso)} yAxisId="left" stroke={isGoalMet ? "#22c55e" : "#cbd5e1"} strokeDasharray="5 5" />}

                            {validWeightsCount > 1 ? (
                              <Area type="monotone" yAxisId="left" dataKey="peso" stroke={isGoalMet ? "#16a34a" : "#166534"} strokeWidth={4} fillOpacity={1} fill="url(#colorArea)" connectNulls activeDot={{ r: 8 }} />
                            ) : (
                              <Scatter yAxisId="left" dataKey="peso" fill="#166534" shape="circle" r={6} />
                            )}

                            {timelineData.filter(d => d.somatorio_dobras !== null).length > 1 ? (
                              <Line type="monotone" yAxisId="right" dataKey="somatorio_dobras" stroke="#ec4899" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 8 }} connectNulls />
                            ) : (
                              <Scatter yAxisId="right" dataKey="somatorio_dobras" fill="#ec4899" shape="circle" r={6} />
                            )}
                          </>
                        )}

                        {activeLens === 'metabolico' && (
                          <>
                            <ReferenceLine y={2.0} yAxisId="right" stroke="#ef4444" strokeDasharray="3 3" />

                            {validWaistsCount > 1 ? (
                              <Area type="monotone" yAxisId="left" dataKey="cintura" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorAreaWaist)" connectNulls activeDot={{ r: 8 }} />
                            ) : (
                              <Scatter yAxisId="left" dataKey="cintura" fill="#6366f1" shape="circle" r={6} />
                            )}

                            {timelineData.filter(d => d.homair !== null).length > 1 ? (
                              <Line type="monotone" yAxisId="right" dataKey="homair" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 8 }} connectNulls />
                            ) : (
                              <Scatter yAxisId="right" dataKey="homair" fill="#f59e0b" shape="circle" r={6} />
                            )}
                          </>
                        )}

                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-stone-300 rounded-3xl border border-dashed border-stone-200 bg-white/60">
                      <TrendingUp size={36} strokeWidth={1.5} aria-hidden="true" />
                      <p className="text-stone-500 mt-3 font-bold text-sm">Aguardando o primeiro relato.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ============ CONTEXTO DA PRÓXIMA ETAPA ============ */}
        {!lensLocked && (
          <motion.div {...fadeUp} transition={{ delay: reduceMotion ? 0 : 0.2 }} className="mt-5 flex items-center gap-3 rounded-2xl bg-nutri-50/60 px-5 py-4">
            <div className="shrink-0 rounded-xl bg-nutri-700 p-2 text-white shadow-sm">
              <TrendingUp size={16} aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold leading-snug text-stone-700">
              {weightProgressPercent > 0
                ? `Você já avançou ${Math.round(weightProgressPercent)}% rumo à sua meta. Continue firme!`
                : validWeightsCount === 1
                ? "Sua primeira medida foi registrada! Adicione mais check-ins para formar a linha do gráfico."
                : "Seu progresso visual começará após os primeiros registros do seu diário e medidas."}
            </p>
          </motion.div>
        )}

      </div>
    </motion.section>
  );
}
