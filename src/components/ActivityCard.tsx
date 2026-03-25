'use client';

import { Flame, Plus, Trash2, Activity as ActivityIcon } from 'lucide-react';
import { Activity, calculateActivityKcal } from '@/lib/activities';

interface Props {
  activities?: Activity[]; // Transformado em opcional para evitar quebras
  weight: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export default function ActivityCard({
  activities = [], // FALLBACK DE SEGURANÇA AQUI
  weight,
  onAdd,
  onRemove
}: Props) {
  
  // Como garantimos que activities é um array acima, o reduce nunca vai quebrar
  const totalKcal = activities.reduce((total, act) => {
    return total + calculateActivityKcal(act, weight);
  }, 0);

  // Meta imaginária de queima para gerar a barra de progresso (ex: 1000kcal)
  const activityGoal = 1000;
  const progressPercent = Math.min((totalKcal / activityGoal) * 100, 100);

  return (
    <div className="relative p-6 md:p-8 rounded-[2rem] border overflow-hidden flex flex-col justify-between min-h-[220px] transition-all duration-500 bg-gradient-to-br from-white to-rose-50/30 border-rose-100 shadow-sm">
      
      {/* Elemento decorativo de fundo (combinando com o de Água) */}
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-rose-200/40 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

      {/* HEADER */}
      <div className="z-10 flex justify-between items-start mb-6">
        <div>
          <h4 className="text-[11px] font-black uppercase tracking-[0.15em] mb-1.5 text-rose-400">
            Movimento
          </h4>
          <p className="text-xs font-bold text-stone-400">Calorias Queimadas</p>
        </div>
        <div className="p-2.5 rounded-xl bg-rose-50 text-rose-500 backdrop-blur-md">
          <ActivityIcon size={20} />
        </div>
      </div>

      {/* PROGRESSO VISUAL E TOTAL */}
      <div className="z-10 mb-6">
        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-5xl font-black tracking-tight text-stone-800">
            {Math.round(totalKcal)}
          </span>
          <span className="text-lg font-bold text-rose-400">kcal</span>
        </div>

        <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden shadow-inner">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* LISTA DE ATIVIDADES */}
      <div className="z-10 flex-1 flex flex-col">
        {activities.length > 0 ? (
          <div className="space-y-2.5 mb-6">
            {activities.map((act) => {
              const kcal = calculateActivityKcal(act, weight);

              return (
                <div
                  key={act.id}
                  className="group flex items-center justify-between bg-white/60 backdrop-blur-sm p-3.5 rounded-2xl border border-stone-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md hover:bg-white transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-400 shrink-0">
                      <Flame size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-700 capitalize">
                        {act.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[11px] font-medium text-stone-400">
                        {act.duration} min
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-rose-500">
                      {Math.round(kcal)} <span className="text-[10px] font-bold">kcal</span>
                    </span>

                    <button
                      onClick={() => onRemove(act.id)}
                      className="text-stone-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center mb-6 bg-white/40 backdrop-blur-sm rounded-2xl border border-dashed border-stone-200/60 p-4">
            <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider text-center">
              Nenhum exercício<br/>registrado hoje
            </p>
          </div>
        )}

        {/* BOTÃO ADICIONAR */}
        <button
          onClick={onAdd}
          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 bg-white border border-rose-100 text-rose-500 shadow-sm hover:bg-rose-50 hover:border-rose-200 mt-auto"
        >
          <Plus size={18} /> Adicionar Exercício
        </button>
      </div>
    </div>
  );
}