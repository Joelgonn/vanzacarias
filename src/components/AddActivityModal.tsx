'use client';

import { useState } from 'react';
import { X, Plus, Flame } from 'lucide-react';
import {
  ATIVIDADES_FISICAS_INTENCIONAIS,
  Activity
} from '@/lib/activities';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: Activity) => void;
}

export default function AddActivityModal({
  isOpen,
  onClose,
  onSave
}: Props) {
  const [type, setType] = useState<string>('');
  const [intensity, setIntensity] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [calories, setCalories] = useState<number | null>(null);

  if (!isOpen) return null;

  const selectedCategory = ATIVIDADES_FISICAS_INTENCIONAIS[type];

  const handleSave = () => {
    if (!type || !intensity || duration <= 0) return;

    const newActivity: Activity = {
      id: crypto.randomUUID(),
      type,
      intensity,
      duration,
      calories: calories || undefined
    };

    onSave(newActivity);

    // reset
    setType('');
    setIntensity('');
    setDuration(0);
    setCalories(null);

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-md p-4 animate-fade-in transition-all">
      
      {/* Container com max-h e overflow para garantir que NUNCA quebre na tela */}
      <div className="bg-white/95 backdrop-blur-xl w-full max-w-md max-h-[95vh] overflow-y-auto scrollbar-hide rounded-[2rem] p-5 md:p-6 relative shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-white/50">
        
        {/* FECHAR */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-stone-100/50 text-stone-400 hover:text-stone-800 hover:bg-stone-200 p-2 rounded-full transition-colors shadow-sm"
        >
          <X size={18} />
        </button>

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-rose-50 text-rose-500 p-2.5 rounded-xl border border-rose-100/50 shadow-sm">
            <Flame size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight leading-none">
              Novo Exercício
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-1">Registre seu movimento do dia.</p>
          </div>
        </div>

        {/* FORM */}
        <div className="space-y-4">
          
          {/* TIPO */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1">
              Tipo de atividade
            </label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setIntensity('');
              }}
              className="w-full mt-1 px-3 py-2.5 bg-stone-50/50 rounded-xl border border-stone-200/60 text-sm text-stone-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all appearance-none"
            >
              <option value="">Selecione a atividade</option>
              {Object.entries(ATIVIDADES_FISICAS_INTENCIONAIS)
                .sort((a, b) => a[1].nome.localeCompare(b[1].nome))
                .map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.nome}
                  </option>
                )
              )}
            </select>
          </div>

          {/* INTENSIDADE */}
          {type && (
            <div className="animate-fade-in-up">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1">
                Intensidade
              </label>
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-stone-50/50 rounded-xl border border-stone-200/60 text-sm text-stone-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all appearance-none"
              >
                <option value="">Selecione o esforço</option>
                {selectedCategory.intensidades.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nomeExibicao}
                  </option>
                ))}
              </select>

              {/* TOOLTIP PREMIUM COMPACTO */}
              {intensity && (
                <div className="mt-2.5 bg-stone-50/80 p-2.5 rounded-xl border border-stone-100 flex flex-col gap-1.5 animate-fade-in-up">
                  <span className="text-[9px] font-black uppercase text-stone-400 tracking-[0.15em] mb-0.5 ml-1">
                    Análise do Esforço
                  </span>
                  <div className="flex flex-col gap-1">
                    {selectedCategory.intensidades
                      .find((i) => i.id === intensity)
                      ?.descricaoTooltip.split('|')
                      .map((item, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white px-2.5 py-1.5 rounded-lg border border-stone-100/80 shadow-[0_2px_4px_rgba(0,0,0,0.01)] text-[10px] text-stone-600 font-medium flex items-center"
                        >
                          {item.trim()}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TEMPO E CALORIAS LADO A LADO PARA POUPAR ESPAÇO */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1">
                Tempo <span className="text-stone-300">(min)</span>
              </label>
              <input
                type="number"
                value={duration || ''}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2.5 bg-stone-50/50 rounded-xl border border-stone-200/60 text-stone-700 font-bold text-base focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all placeholder:text-stone-300 placeholder:font-medium placeholder:text-sm"
                placeholder="Ex: 45"
              />
            </div>

            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1">
                Kcal <span className="text-stone-300">(opcional)</span>
              </label>
              <input
                type="number"
                value={calories || ''}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2.5 bg-stone-50/50 rounded-xl border border-stone-200/60 text-stone-700 font-bold text-base focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all placeholder:text-stone-300 placeholder:font-medium placeholder:text-sm"
                placeholder="Apple Watch"
              />
            </div>
          </div>

        </div>

        {/* BOTÃO */}
        <button
          onClick={handleSave}
          disabled={!type || !intensity || duration <= 0}
          className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 shadow-[0_4px_14px_rgba(244,63,94,0.3)] hover:shadow-[0_6px_20px_rgba(244,63,94,0.4)] hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus size={18} /> Salvar Atividade
        </button>
      </div>
    </div>
  );
}