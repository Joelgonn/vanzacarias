'use client';

import { useState } from 'react';
import { X, Plus, Flame, ChevronDown, Check, Activity as ActivityIcon } from 'lucide-react';
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
  const [duration, setDuration] = useState<number | ''>('');
  const [calories, setCalories] = useState<number | ''>('');

  // Controle de interface para os dropdowns customizados
  const [activeDropdown, setActiveDropdown] = useState<'type' | 'intensity' | null>(null);

  if (!isOpen) return null;

  const selectedCategory = type ? ATIVIDADES_FISICAS_INTENCIONAIS[type] : null;

  const handleClose = () => {
    setActiveDropdown(null);
    onClose();
  };

  const handleSave = () => {
    const dur = Number(duration);
    if (!type || !intensity || isNaN(dur) || dur <= 0) return;

    const newActivity: Activity = {
      id: crypto.randomUUID(),
      type,
      intensity,
      duration: dur,
      calories: calories ? Number(calories) : undefined
    };

    onSave(newActivity);

    // reset
    setType('');
    setIntensity('');
    setDuration('');
    setCalories('');
    setActiveDropdown(null);

    onClose();
  };

  // Prepara a lista de atividades em ordem alfabética
  const activitiesList = Object.entries(ATIVIDADES_FISICAS_INTENCIONAIS).sort((a, b) =>
    a[1].nome.localeCompare(b[1].nome)
  );

  return (
    // Fundo escuro com blur. No mobile alinha no fundo (items-end), no desktop centraliza (md:items-center)
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-0 md:p-4 transition-all duration-300">
      
      {/* Container principal. No mobile: Bottom Sheet (cantos arredondados só em cima). No desktop: Modal (cantos arredondados normais) */}
      <div className="bg-white w-full max-w-md max-h-[90vh] flex flex-col rounded-t-[2rem] md:rounded-[2rem] relative shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-fade-in-up md:animate-fade-in">
        
        {/* Barra de puxar (indicador visual apenas para mobile) */}
        <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-12 h-1.5 bg-stone-200 rounded-full" />
        </div>

        {/* HEADER */}
        <div className="px-6 pt-4 md:pt-8 pb-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="bg-rose-50 text-rose-500 p-3 rounded-2xl border border-rose-100/50 shadow-sm">
              <Flame size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-800 tracking-tight leading-none mb-1">
                Novo Exercício
              </h2>
              <p className="text-xs text-stone-500 font-medium">Registre seu movimento do dia</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="bg-stone-50 text-stone-400 hover:text-stone-700 hover:bg-stone-100 p-2.5 rounded-full transition-all active:scale-95"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO (Scrollable) */}
        <div className="px-6 pb-6 overflow-y-auto scrollbar-hide flex-1 space-y-5">
          
          {/* TIPO DE ATIVIDADE (Dropdown Customizado) */}
          <div className="relative">
            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1 block mb-1.5">
              Atividade
            </label>
            
            {/* Botão que simula o select */}
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'type' ? null : 'type')}
              className={`w-full px-4 py-3.5 flex items-center justify-between bg-stone-50 hover:bg-stone-100 rounded-2xl border transition-all ${
                activeDropdown === 'type' ? 'border-rose-300 ring-4 ring-rose-500/10' : 'border-stone-200/80'
              }`}
            >
              <span className={`text-sm font-bold ${type ? 'text-stone-800' : 'text-stone-400 font-medium'}`}>
                {type ? ATIVIDADES_FISICAS_INTENCIONAIS[type].nome : 'Selecione a atividade'}
              </span>
              <ChevronDown 
                size={18} 
                className={`text-stone-400 transition-transform duration-300 ${activeDropdown === 'type' ? 'rotate-180 text-rose-500' : ''}`} 
              />
            </button>

            {/* Lista de Opções Expandida */}
            {activeDropdown === 'type' && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-100 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] z-20 overflow-hidden animate-fade-in-up">
                <div className="max-h-60 overflow-y-auto scrollbar-hide py-2">
                  {activitiesList.map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setType(key);
                        setIntensity(''); // Reseta intensidade ao trocar o tipo
                        setActiveDropdown(null);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors text-left"
                    >
                      <span className={`text-sm ${type === key ? 'font-bold text-rose-600' : 'font-medium text-stone-600'}`}>
                        {value.nome}
                      </span>
                      {type === key && <Check size={16} className="text-rose-500" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* INTENSIDADE (Dropdown Customizado) */}
          {type && selectedCategory && (
            <div className="relative animate-fade-in">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1 block mb-1.5">
                Intensidade
              </label>
              
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'intensity' ? null : 'intensity')}
                className={`w-full px-4 py-3.5 flex items-center justify-between bg-stone-50 hover:bg-stone-100 rounded-2xl border transition-all ${
                  activeDropdown === 'intensity' ? 'border-rose-300 ring-4 ring-rose-500/10' : 'border-stone-200/80'
                }`}
              >
                <span className={`text-sm font-bold ${intensity ? 'text-stone-800' : 'text-stone-400 font-medium'}`}>
                  {intensity 
                    ? selectedCategory.intensidades.find(i => i.id === intensity)?.nomeExibicao 
                    : 'Selecione o esforço'}
                </span>
                <ChevronDown 
                  size={18} 
                  className={`text-stone-400 transition-transform duration-300 ${activeDropdown === 'intensity' ? 'rotate-180 text-rose-500' : ''}`} 
                />
              </button>

              {/* Lista de Intensidades */}
              {activeDropdown === 'intensity' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-100 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] z-20 overflow-hidden animate-fade-in-up">
                  <div className="py-2">
                    {selectedCategory.intensidades.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => {
                          setIntensity(i.id);
                          setActiveDropdown(null);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-stone-50 transition-colors text-left border-b border-stone-50 last:border-0"
                      >
                        <div>
                          <p className={`text-sm ${intensity === i.id ? 'font-bold text-rose-600' : 'font-medium text-stone-700'}`}>
                            {i.nomeExibicao}
                          </p>
                          {/* Mini descrição na própria lista para facilitar a escolha */}
                          <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">
                            {i.descricaoTooltip.split('|')[0]}
                          </p>
                        </div>
                        {intensity === i.id && <Check size={18} className="text-rose-500 shrink-0 ml-3" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TOOLTIP PREMIUM (Exibido após selecionar) */}
              {intensity && !activeDropdown && (
                <div className="mt-3 bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2.5">
                    <ActivityIcon size={14} className="text-rose-400" />
                    <span className="text-[10px] font-black uppercase text-rose-500 tracking-[0.15em]">
                      Análise do Esforço
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {selectedCategory.intensidades
                      .find((i) => i.id === intensity)
                      ?.descricaoTooltip.split('|')
                      .map((item, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white px-3 py-2 rounded-xl border border-stone-100 shadow-sm text-xs text-stone-600 font-medium flex items-center gap-2"
                        >
                          <div className="w-1 h-1 rounded-full bg-rose-300" />
                          {item.trim()}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TEMPO E CALORIAS */}
          <div className="flex gap-4 pt-2">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1 block mb-1.5">
                Tempo <span className="text-stone-300 lowercase font-medium">(min)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={duration}
                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 text-stone-800 font-bold text-lg focus:outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all placeholder:text-stone-300 placeholder:font-medium placeholder:text-sm"
                placeholder="Ex: 45"
              />
            </div>

            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1 block mb-1.5">
                Kcal <span className="text-stone-300 lowercase font-medium">(opcional)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={calories}
                onChange={(e) => setCalories(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 text-stone-800 font-bold text-lg focus:outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all placeholder:text-stone-300 placeholder:font-medium placeholder:text-sm"
                placeholder="Watch"
              />
            </div>
          </div>

        </div>

        {/* FOOTER / BOTÃO (Fixo na parte inferior do modal) */}
        <div className="p-4 md:p-6 bg-white/80 backdrop-blur-md border-t border-stone-100 shrink-0 md:rounded-b-[2rem]">
          <button
            onClick={handleSave}
            disabled={!type || !intensity || !duration || Number(duration) <= 0}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-rose-500 hover:from-rose-600 to-rose-600 hover:to-rose-700 shadow-[0_8px_20px_rgba(244,63,94,0.25)] hover:shadow-[0_10px_25px_rgba(244,63,94,0.35)] transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:grayscale disabled:pointer-events-none"
          >
            <Plus size={20} strokeWidth={2.5} /> Salvar Atividade
          </button>
        </div>

        {/* Overlay invisível para fechar os dropdowns ao clicar fora */}
        {activeDropdown && (
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setActiveDropdown(null)}
            aria-hidden="true"
          />
        )}

      </div>
    </div>
  );
}