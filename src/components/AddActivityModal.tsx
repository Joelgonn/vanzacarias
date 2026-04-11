'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!isOpen) {
      setType('');
      setIntensity('');
      setDuration('');
      setCalories('');
      setActiveDropdown(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedCategory = type ? ATIVIDADES_FISICAS_INTENCIONAIS[type] : null;

  const handleClose = () => {
    setActiveDropdown(null);
    onClose();
  };

  const handleSave = () => {
    const dur = Number(duration);
    if (!type || !intensity || isNaN(dur) || dur <= 0) return;

    const selectedCategory = ATIVIDADES_FISICAS_INTENCIONAIS[type];
    const validIntensity = selectedCategory?.intensidades.some((i) => i.id === intensity);
    if (!selectedCategory || !validIntensity) return;

    const newActivity: Activity = {
      id: crypto.randomUUID(),
      type,
      intensity,
      duration: dur,
      calories: calories ? Number(calories) : undefined
    };

    onSave(newActivity);
    onClose();
  };

  // Prepara a lista de atividades em ordem alfabética
  const activitiesList = Object.entries(ATIVIDADES_FISICAS_INTENCIONAIS).sort((a, b) =>
    a[1].nome.localeCompare(b[1].nome)
  );

  return (
    // Fundo escuro com blur. No mobile alinha no fundo, no desktop centraliza.
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-0 md:p-4 transition-all duration-300">
      
      {/* Container principal. Bottom Sheet no mobile, Modal arredondado no desktop. */}
      <div className="bg-white w-full max-w-md max-h-[90vh] flex flex-col rounded-t-[2.5rem] md:rounded-[2.5rem] relative shadow-2xl animate-fade-in-up md:animate-fade-in">
        
        {/* Barra de puxar (indicador visual mobile) */}
        <div className="w-full flex justify-center pt-4 pb-2 md:hidden">
          <div className="w-12 h-1.5 bg-stone-200 rounded-full" />
        </div>

        {/* HEADER */}
        <div className="px-6 pt-2 md:pt-8 pb-5 flex items-center justify-between shrink-0 border-b border-stone-50">
          <div className="flex items-center gap-4">
            <div className="bg-rose-50 text-rose-500 p-3.5 rounded-2xl shadow-sm border border-rose-100/50">
              <Flame size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900 tracking-tight leading-none mb-1.5">
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
        <div className="px-6 py-6 overflow-y-auto scrollbar-hide flex-1 space-y-6">
          
          {/* TIPO DE ATIVIDADE */}
          <div className="relative">
            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1 block mb-2">
              Qual foi a atividade?
            </label>
            
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'type' ? null : 'type')}
              className={`w-full px-5 py-4 flex items-center justify-between bg-stone-50 hover:bg-stone-100 rounded-2xl border transition-all duration-300 ${
                activeDropdown === 'type' ? 'border-rose-300 ring-4 ring-rose-500/10' : 'border-stone-200/60'
              }`}
            >
              <span className={`text-sm md:text-base font-bold ${type ? 'text-stone-900' : 'text-stone-400 font-medium'}`}>
                {type ? ATIVIDADES_FISICAS_INTENCIONAIS[type].nome : 'Selecione a atividade'}
              </span>
              <ChevronDown 
                size={20} 
                className={`text-stone-400 transition-transform duration-300 ${activeDropdown === 'type' ? 'rotate-180 text-rose-500' : ''}`} 
              />
            </button>

            {/* Lista Expandida de Atividades */}
            {activeDropdown === 'type' && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-100 rounded-[1.5rem] shadow-xl z-20 overflow-hidden animate-fade-in-up">
                <div className="max-h-60 overflow-y-auto scrollbar-hide py-2">
                  {activitiesList.map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setType(key);
                        setIntensity(''); 
                        setActiveDropdown(null);
                      }}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition-colors text-left"
                    >
                      <span className={`text-sm ${type === key ? 'font-bold text-rose-600' : 'font-medium text-stone-600'}`}>
                        {value.nome}
                      </span>
                      {type === key && <Check size={18} className="text-rose-500" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* INTENSIDADE */}
          {type && selectedCategory && (
            <div className="relative animate-fade-in">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1 block mb-2">
                Nível de Esforço
              </label>
              
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'intensity' ? null : 'intensity')}
                className={`w-full px-5 py-4 flex items-center justify-between bg-stone-50 hover:bg-stone-100 rounded-2xl border transition-all duration-300 ${
                  activeDropdown === 'intensity' ? 'border-rose-300 ring-4 ring-rose-500/10' : 'border-stone-200/60'
                }`}
              >
                <span className={`text-sm md:text-base font-bold ${intensity ? 'text-stone-900' : 'text-stone-400 font-medium'}`}>
                  {intensity 
                    ? selectedCategory.intensidades.find(i => i.id === intensity)?.nomeExibicao 
                    : 'Como foi o esforço?'}
                </span>
                <ChevronDown 
                  size={20} 
                  className={`text-stone-400 transition-transform duration-300 ${activeDropdown === 'intensity' ? 'rotate-180 text-rose-500' : ''}`} 
                />
              </button>

              {/* Lista de Intensidades */}
              {activeDropdown === 'intensity' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-100 rounded-[1.5rem] shadow-xl z-20 overflow-hidden animate-fade-in-up">
                  <div className="py-2">
                    {selectedCategory.intensidades.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => {
                          setIntensity(i.id);
                          setActiveDropdown(null);
                        }}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors text-left border-b border-stone-50 last:border-0"
                      >
                        <div>
                          <p className={`text-sm ${intensity === i.id ? 'font-bold text-rose-600' : 'font-medium text-stone-800'}`}>
                            {i.nomeExibicao}
                          </p>
                          <p className="text-[11px] text-stone-400 mt-1 line-clamp-1 font-medium">
                            {i.descricaoTooltip.split('|')[0]}
                          </p>
                        </div>
                        {intensity === i.id && <Check size={20} className="text-rose-500 shrink-0 ml-3" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TOOLTIP DE AJUDA PARA INTENSIDADE */}
              {intensity && !activeDropdown && (
                <div className="mt-4 bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50 animate-fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <ActivityIcon size={14} className="text-rose-400" />
                    <span className="text-[10px] font-black uppercase text-rose-500 tracking-[0.2em]">
                      Análise do Esforço
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedCategory.intensidades
                      .find((i) => i.id === intensity)
                      ?.descricaoTooltip.split('|')
                      .map((item, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white px-3.5 py-2.5 rounded-xl border border-stone-100 shadow-sm text-xs text-stone-600 font-medium flex items-center gap-2.5"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-300 shrink-0" />
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
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1 block mb-2">
                Tempo <span className="text-stone-300 lowercase font-medium">(min)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={duration}
                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-5 py-4 bg-stone-50 rounded-2xl border border-stone-200/60 text-stone-900 font-black text-xl md:text-2xl focus:outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all placeholder:text-stone-300 placeholder:font-medium placeholder:text-base text-center"
                placeholder="Ex: 45"
              />
            </div>

            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400 ml-1 block mb-2">
                Kcal <span className="text-stone-300 lowercase font-medium">(opcional)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={calories}
                onChange={(e) => setCalories(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-5 py-4 bg-stone-50 rounded-2xl border border-stone-200/60 text-stone-900 font-black text-xl md:text-2xl focus:outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all placeholder:text-stone-300 placeholder:font-medium placeholder:text-base text-center"
                placeholder="Smartwatch"
              />
            </div>
          </div>

        </div>

        {/* FOOTER / BOTÃO (Fixo embaixo) */}
        <div className="p-5 md:p-6 bg-white shrink-0 rounded-b-[2.5rem]">
          <button
            onClick={handleSave}
            disabled={!type || !intensity || !duration || Number(duration) <= 0}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-4 md:py-5 rounded-2xl text-sm md:text-base font-black text-white bg-gradient-to-r from-rose-500 to-rose-600 shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/35 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:grayscale disabled:pointer-events-none disabled:transform-none"
          >
            <Plus size={22} strokeWidth={2.5} /> Salvar Exercício
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