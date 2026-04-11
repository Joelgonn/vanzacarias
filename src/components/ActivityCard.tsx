'use client';

import { useMemo } from 'react';
import { Flame, Plus, Trash2, Activity as ActivityIcon } from 'lucide-react';
import { Activity, calculateActivityKcal } from '@/lib/activities';

interface Props {
  activities?: Activity[];
  weight: number;
  activityGoal?: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export default function ActivityCard({
  activities = [],
  weight,
  activityGoal = 500,
  onAdd,
  onRemove
}: Props) {
  
  const totalKcal = useMemo(() => activities.reduce((total, act) => {
    return total + calculateActivityKcal(act, weight);
  }, 0), [activities, weight]);

  const progressPercent = activityGoal > 0
    ? Math.min((totalKcal / activityGoal) * 100, 100)
    : 0;

  return (
    <div className="relative p-6 md:p-8 rounded-[2rem] border overflow-hidden flex flex-col justify-between h-full min-h-[220px] transition-all duration-500 bg-gradient-to-br from-white via-white to-rose-50/40 border-stone-100 shadow-sm hover:shadow-md">
      
      {/* Elemento decorativo de fundo (Premium Glow) */}
      <div className="absolute -top-12 -right-12 w-56 h-56 bg-gradient-to-br from-rose-200/40 to-rose-100/10 rounded-full blur-3xl pointer-events-none transition-all duration-700" />

      {/* HEADER */}
      <div className="relative z-10 flex justify-between items-start mb-6">
        <div>
          <h4 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-1.5 text-rose-500 flex items-center gap-1.5">
            Atividades <Flame size={12} strokeWidth={3} />
          </h4>
          <p className="text-xs md:text-sm font-medium text-stone-500">Calorias Queimadas</p>
        </div>
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100/50 shadow-sm text-rose-500">
          <ActivityIcon size={20} strokeWidth={2.5} />
        </div>
      </div>

      {/* PROGRESSO VISUAL E TOTAL */}
      <div className="relative z-10 mb-8">
        <div className="flex items-baseline gap-1.5 mb-4">
          <span className="text-5xl md:text-6xl font-black tracking-tighter text-stone-900">
            {Math.round(totalKcal)}
          </span>
          <span className="text-sm md:text-lg font-bold text-rose-400">kcal</span>
        </div>

        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-300 via-rose-400 to-rose-500 transition-all duration-1000 ease-out relative"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Brilho interno na barra para dar volume */}
            <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-r from-transparent to-white/30" />
          </div>
        </div>
      </div>

      {/* LISTA DE ATIVIDADES */}
      <div className="relative z-10 flex-1 flex flex-col">
        {activities.length > 0 ? (
          <div className="space-y-3 mb-6">
            {activities.map((act) => {
              const kcal = calculateActivityKcal(act, weight);

              return (
                <div
                  key={act.id}
                  className="group flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md hover:border-rose-100 transition-all duration-300"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0 border border-rose-100/50">
                      <Flame size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-800 capitalize leading-tight">
                        {act.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs font-medium text-stone-400 mt-0.5">
                        {act.duration} min
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-stone-900 leading-tight">
                        {Math.round(kcal)}
                      </span>
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                        kcal
                      </span>
                    </div>

                    <button
                      onClick={() => onRemove(act.id)}
                      className="text-stone-300 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all duration-200 opacity-100 md:opacity-0 md:group-hover:opacity-100 active:scale-90"
                      title="Remover exercício"
                      aria-label="Remover exercício"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center mb-6 bg-stone-50 rounded-2xl border border-dashed border-stone-200 p-6 transition-all">
            <div className="w-10 h-10 rounded-xl bg-white border border-stone-100 shadow-sm flex items-center justify-center text-stone-300 mb-3">
              <ActivityIcon size={18} strokeWidth={2} />
            </div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest text-center leading-relaxed">
              Nenhuma atividade <br className="hidden md:block" /> registrada hoje
            </p>
          </div>
        )}

        {/* BOTÃO ADICIONAR */}
        <button
          onClick={onAdd}
          className="w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] bg-white border border-stone-200 text-rose-500 shadow-sm hover:shadow-md hover:border-rose-200 mt-auto"
        >
          <Plus size={18} strokeWidth={2.5} />
          Adicionar Exercício
        </button>
      </div>
    </div>
  );
}