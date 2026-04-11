'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, Sparkles, Phone, 
  ChevronRight, ChevronLeft, CheckCircle2, Shield, 
  Target, Heart, Gift, ArrowRight, ChevronDown, X, Plus, Search, Info
} from 'lucide-react';
import { type FoodRestriction, type FoodTag } from '@/types/patient';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';

// =========================================================================
// CUSTOM SELECT PREMIUM
// =========================================================================
interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function CustomSelect({ options, value, onChange, placeholder = 'Selecionar', className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.custom-select-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative custom-select-container ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-4 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 transition-all text-stone-700 shadow-sm"
      >
        <span className={!selectedOption ? 'text-stone-400' : 'text-stone-700 font-medium'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={18} className={`text-stone-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 mt-2 w-full bg-white border border-stone-100 rounded-2xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-4 text-sm md:py-3 hover:bg-stone-50 transition-colors ${
                  value === opt.value ? 'bg-nutri-50 text-nutri-800 font-medium' : 'text-stone-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =========================================================================
// FOOD RESTRICTIONS FORM (COM CORES SEMÂNTICAS)
// =========================================================================
const TAG_OPTIONS: Array<{ label: string; value: FoodTag; icon: string }> = [
  { label: 'Lactose', value: 'lactose', icon: '🥛' },
  { label: 'Glúten', value: 'gluten', icon: '🌾' },
  { label: 'Açúcar', value: 'sugar', icon: '🍬' },
  { label: 'Oleaginosas', value: 'nuts', icon: '🥜' }
];

// Mapeamento de cores semânticas para não depender do Tailwind dinâmico que pode ser expurgado
const getTypeColors = (type: string) => {
  switch (type) {
    case 'allergy':
      return { activeBg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', iconBg: 'bg-red-100', leftBorder: 'border-l-red-500' };
    case 'intolerance':
      return { activeBg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', iconBg: 'bg-amber-100', leftBorder: 'border-l-amber-400' };
    case 'restriction':
      return { activeBg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100', leftBorder: 'border-l-blue-500' };
    default:
      return { activeBg: 'bg-white', border: 'border-stone-200', text: 'text-stone-700', iconBg: 'bg-stone-50', leftBorder: 'border-l-stone-200' };
  }
};

function FoodRestrictionsForm({ value, onChange }: { value: FoodRestriction[]; onChange: (value: FoodRestriction[]) => void }) {
  const [type, setType] = useState<FoodRestriction['type']>('allergy');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<typeof FOOD_REGISTRY>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const filtered = FOOD_REGISTRY
        .filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8);
      setResults(filtered);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const showTemporaryFeedback = (message: string) => {
    setFeedbackMessage(message);
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 2000);
  };

  const handleAddFood = (food: any) => {
    const exists = value.some(r => r.foodId === food.id && r.type === type);
    if (exists) {
      showTemporaryFeedback('⚠️ Este alimento já foi adicionado');
      return;
    }
    onChange([...value, { type, foodId: food.id, food: food.name }]);
    setQuery('');
    setResults([]);
    showTemporaryFeedback(`✓ ${food.name} adicionado`);
  };

  const handleAddTag = (tag: FoodTag) => {
    const exists = value.some(r => r.tag === tag && r.type === type);
    if (exists) {
      showTemporaryFeedback('⚠️ Esta restrição já foi adicionada');
      return;
    }
    onChange([...value, { type, tag }]);
    const tagLabel = TAG_OPTIONS.find(t => t.value === tag)?.label;
    showTemporaryFeedback(`✓ ${tagLabel} adicionado`);
  };

  const handleRemove = (index: number) => {
    const updated = [...value];
    updated.splice(index, 1);
    onChange(updated);
    showTemporaryFeedback(`🗑️ Removido com sucesso`);
  };

  const typeConfig = [
    { label: 'Alergia', value: 'allergy', icon: '🚫', desc: 'Reação imune severa ao alimento.' },
    { label: 'Intolerância', value: 'intolerance', icon: '⚠️', desc: 'Desconforto ou dificuldade de digestão.' },
    { label: 'Restrição', value: 'restriction', icon: '📋', desc: 'Escolha alimentar (dieta, religião, etc).' }
  ];

  const activeTypeInfo = typeConfig.find(t => t.value === type);
  const activeColors = getTypeColors(type);

  const getTagLabel = (tagValue: string) => TAG_OPTIONS.find(t => t.value === tagValue)?.label || tagValue;

  return (
    <div className="space-y-7">
      
      {/* 1. TIPO DE RESTRIÇÃO */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">
          1. Tipo de Restrição
        </label>
        <div className="relative flex bg-stone-100/70 p-1.5 rounded-2xl">
          {typeConfig.map(opt => {
            const isActive = type === opt.value;
            const optColors = getTypeColors(opt.value);
            
            return (
              <button
                key={opt.value}
                onClick={() => setType(opt.value as any)}
                className={`relative flex-1 py-3.5 text-sm font-semibold z-10 transition-colors duration-200 flex items-center justify-center gap-2 ${
                  isActive ? optColors.text : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className={`absolute inset-0 rounded-xl shadow-sm border ${optColors.activeBg} ${optColors.border}`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-20 flex items-center gap-1.5">
                  <span className="text-base">{opt.icon}</span> 
                  <span>{opt.label}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-start gap-1.5 px-2">
          <Info size={14} className={`mt-0.5 shrink-0 ${activeColors.text}`} />
          <p className="text-xs text-stone-500 leading-relaxed">{activeTypeInfo?.desc}</p>
        </div>
      </div>

      {/* 2. ADIÇÃO RÁPIDA */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">
          2. Adição Rápida
        </label>
        <div className="flex overflow-x-auto pb-2 -mx-2 px-2 gap-3 hide-scrollbar">
          {TAG_OPTIONS.map(tag => (
            <motion.button
              key={tag.value}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAddTag(tag.value)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-stone-200 text-stone-700 hover:border-nutri-300 hover:text-nutri-700 hover:shadow-md transition-all group"
            >
              <span className="text-lg">{tag.icon}</span>
              {tag.label}
              <Plus size={14} className="text-stone-300 group-hover:text-nutri-500 ml-1 transition-colors" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* 3. BUSCA */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">
          Ou busque alimentos
        </label>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-nutri-700 transition-colors" size={20} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Amendoim, Morango, Camarão..."
            className="w-full pl-12 pr-12 py-4 rounded-2xl border border-stone-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] focus:shadow-md focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-700 outline-none transition-all text-stone-800 placeholder:text-stone-400 font-medium"
          />
          
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-stone-600 bg-stone-50 rounded-full transition-colors"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          )}

          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute z-30 mt-2 w-full bg-white border border-stone-100 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden"
              >
                {results.map(food => (
                  <button
                    key={food.id}
                    onClick={() => handleAddFood(food)}
                    className="w-full text-left px-5 py-4 hover:bg-stone-50 text-stone-700 transition-colors flex items-center justify-between border-b border-stone-50 last:border-0 group"
                  >
                    <span className="font-semibold text-sm md:text-base group-hover:text-nutri-800 transition-colors">{food.name}</span>
                    <div className="bg-stone-100 text-stone-400 group-hover:bg-nutri-100 group-hover:text-nutri-700 p-1.5 rounded-lg transition-colors">
                      <Plus size={16} strokeWidth={2.5} />
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MINHA LISTA */}
      <div className="pt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-black text-stone-800 flex items-center gap-2">
            Minha Lista
            {value.length > 0 && (
              <span className="bg-stone-800 text-white py-0.5 px-2.5 rounded-full text-xs font-bold shadow-sm">
                {value.length}
              </span>
            )}
          </h3>
          {value.length > 0 && (
            <button 
              onClick={() => onChange([])}
              className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors px-2 py-1 bg-red-50 hover:bg-red-100 rounded-lg"
            >
              Limpar tudo
            </button>
          )}
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {value.map((r, index) => {
              const itemTypeConfig = typeConfig.find(t => t.value === r.type);
              const itemColors = getTypeColors(r.type);
              
              return (
                <motion.div
                  key={`${r.type}-${r.foodId || r.tag}-${index}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  layout
                  className={`flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border-y border-r border-y-stone-200 border-r-stone-200 border-l-4 ${itemColors.leftBorder}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${itemColors.iconBg}`}>
                      {itemTypeConfig?.icon}
                    </div>
                    <div>
                      <p className="text-stone-800 font-bold capitalize text-sm md:text-base leading-tight">
                        {r.food || getTagLabel(r.tag || '')}
                      </p>
                      <p className={`text-xs font-semibold mt-0.5 ${itemColors.text}`}>
                        {itemTypeConfig?.label}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleRemove(index)}
                    className="p-2.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    aria-label="Remover item"
                  >
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {value.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-10 text-center px-4 bg-stone-50/50 rounded-3xl border-2 border-stone-100 border-dashed"
            >
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-stone-300 mb-3 shadow-sm border border-stone-100">
                <CheckCircle2 size={28} strokeWidth={1.5} />
              </div>
              <p className="text-stone-700 font-bold text-sm">Nenhuma restrição</p>
              <p className="text-stone-400 text-xs mt-1 max-w-[200px]">Você pode comer de tudo livremente no seu plano.</p>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-stone-900 text-white px-5 py-3.5 rounded-2xl text-sm font-medium shadow-2xl z-50 text-center flex items-center justify-center gap-2"
          >
            {feedbackMessage}
          </motion.div>
        )}
      </AnimatePresence>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}

// =========================================================================
// PROGRESS TRACKER
// =========================================================================
function ProgressTracker({ step, totalSteps }: { step: number; totalSteps: number }) {
  const progress = (step / totalSteps) * 100;
  
  return (
    <div className="mb-8">
      <div className="relative">
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-nutri-800 via-nutri-700 to-nutri-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <motion.div 
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-nutri-800 rounded-full shadow-md"
          initial={{ left: 0 }}
          animate={{ left: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="flex justify-between mt-3">
        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Etapa {step} de {totalSteps}</p>
        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
          {step === 1 && 'Boas-vindas'}{step === 2 && 'Dados básicos'}{step === 3 && 'Restrições'}{step === 4 && 'Confirmação'}
        </p>
      </div>
    </div>
  );
}

// =========================================================================
// STEPS
// =========================================================================
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="text-center space-y-6">
      <motion.div className="w-20 h-20 bg-nutri-50 rounded-full flex items-center justify-center mx-auto shadow-inner" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 200 }}>
        <Sparkles className="text-nutri-800" size={36} strokeWidth={1.5} />
      </motion.div>
      <div>
        <motion.p className="text-xs uppercase tracking-widest text-nutri-600 font-bold mb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>Jornada Personalizada</motion.p>
        <motion.h1 className="text-3xl md:text-4xl font-black text-stone-900 mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>Vamos cuidar de você</motion.h1>
        <motion.p className="text-stone-500 text-sm md:text-base leading-relaxed max-w-xs mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Para montarmos um plano alimentar seguro e adaptado às suas necessidades. Responda as perguntas a seguir.</motion.p>
      </div>
      <motion.div className="pt-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <button onClick={onNext} className="w-full bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.98] transition-all group">Começar agora <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></button>
      </motion.div>
      <div className="flex justify-center gap-6 pt-4 text-xs text-stone-400">
        <span className="flex items-center gap-1"><Shield size={12} /> Seguro</span>
        <span className="flex items-center gap-1"><Target size={12} /> Personalizado</span>
        <span className="flex items-center gap-1"><Heart size={12} /> Gratuito</span>
      </div>
    </motion.div>
  );
}

function StepBasic({ phone, setPhone, birthDate, setBirthDate, onNext, onBack }: { phone: string; setPhone: (v: string) => void; birthDate: string; setBirthDate: (v: string) => void; onNext: () => void; onBack: () => void }) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    if (birthDate && birthDate.includes('-')) {
      const [y, m, d] = birthDate.split('-');
      if (y) setYear(y);
      if (m) setMonth(m);
      if (d) setDay(d);
    }
  }, [birthDate]);

  useEffect(() => {
    if (year && month && day) {
      const formattedDate = `${year}-${month}-${day}`;
      if (formattedDate !== birthDate) setBirthDate(formattedDate);
    }
  }, [day, month, year, birthDate, setBirthDate]);

  const isValid = phone.trim() !== '' && year && month && day;
  const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: String(i + 1) }));
  const monthOptions = [
    { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
  ];
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div><h2 className="text-xl md:text-2xl font-black text-stone-900 mb-2">Seus dados</h2><p className="text-stone-500 text-sm">Fique tranquilo, suas informações estão seguras e criptografadas.</p></div>
      <div className="bg-nutri-50/50 p-4 rounded-2xl border border-nutri-100"><p className="text-xs text-nutri-800 font-bold mb-1 flex items-center gap-1"><Shield size={14}/> Por que pedimos isso?</p><p className="text-xs text-stone-600 leading-relaxed">Usamos sua idade e contato para adaptar seu plano com precisão e segurança.</p></div>
      <div className="space-y-4">
        <div className="relative group"><Phone className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-700 transition-colors" size={20} strokeWidth={2} /><input type="tel" placeholder="WhatsApp (DDD + Número)" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-white shadow-sm focus:shadow-md focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-700 outline-none transition-all text-stone-800 font-medium placeholder:text-stone-400 placeholder:font-normal" /></div>
        <div><label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block ml-1">Data de nascimento</label><div className="grid grid-cols-3 gap-2"><CustomSelect options={dayOptions} value={day} onChange={setDay} placeholder="Dia" /><CustomSelect options={monthOptions} value={month} onChange={setMonth} placeholder="Mês" /><CustomSelect options={yearOptions} value={year} onChange={setYear} placeholder="Ano" /></div></div>
      </div>
      <div className="flex gap-3 pt-4"><button onClick={onBack} className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 active:scale-[0.98] transition-all"><ChevronLeft size={18} /> Voltar</button><button onClick={onNext} disabled={!isValid} className="flex-1 bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98] transition-all">Continuar <ChevronRight size={18} /></button></div>
    </motion.div>
  );
}

function StepRestrictions({ foodRestrictions, setFoodRestrictions, onNext, onBack }: { foodRestrictions: FoodRestriction[]; setFoodRestrictions: (v: FoodRestriction[]) => void; onNext: () => void; onBack: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="space-y-6 flex flex-col min-h-full">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-stone-900 mb-2">Preferências e restrições</h2>
        <p className="text-stone-500 text-sm">Isso nos ajuda a adaptar seu plano com segurança e inteligência.</p>
      </div>
      <div className="flex-1">
        <FoodRestrictionsForm value={foodRestrictions} onChange={setFoodRestrictions} />
      </div>
      <div className="flex gap-3 pt-6 mt-auto">
        <button onClick={onBack} className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 active:scale-[0.98] transition-all">
          <ChevronLeft size={18} /> Voltar
        </button>
        <button onClick={onNext} className="flex-1 bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.98] transition-all">
          Continuar <ChevronRight size={18} />
        </button>
      </div>
    </motion.div>
  );
}

function StepConfirm({ phone, birthDate, foodRestrictions, onConfirm, onBack, loading }: { phone: string; birthDate: string; foodRestrictions: FoodRestriction[]; onConfirm: () => void; onBack: () => void; loading: boolean }) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Não informado';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="text-center"><motion.div className="w-16 h-16 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-4" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}><CheckCircle2 className="text-nutri-600" size={28} strokeWidth={2} /></motion.div><h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-2">Revise seus dados</h2><p className="text-stone-500 text-sm">Confirme se as informações estão corretas antes de salvar.</p></div>
      <div className="bg-white rounded-2xl p-5 space-y-4 border border-stone-200 shadow-sm"><div className="flex justify-between items-center border-b border-stone-100 pb-3"><span className="text-sm font-medium text-stone-500">WhatsApp</span><span className="font-bold text-stone-800">{phone || '—'}</span></div><div className="flex justify-between items-center border-b border-stone-100 pb-3"><span className="text-sm font-medium text-stone-500">Nascimento</span><span className="font-bold text-stone-800">{formatDate(birthDate)}</span></div><div className="flex justify-between items-center"><span className="text-sm font-medium text-stone-500">Restrições</span><span className={`font-bold px-2.5 py-1 rounded-lg text-xs ${foodRestrictions.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{foodRestrictions.length > 0 ? `${foodRestrictions.length} selecionadas` : 'Nenhuma (Livre)'}</span></div></div>
      <div className="text-xs text-stone-400 text-center flex items-center justify-center gap-1"><Shield size={14}/> Seus dados estão criptografados e seguros.</div>
      <div className="flex gap-3 pt-4"><button onClick={onBack} className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 active:scale-[0.98] transition-all"><ChevronLeft size={18} /> Voltar</button><button onClick={onConfirm} disabled={loading} className="flex-1 bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98] transition-all group">{loading ? <Loader2 className="animate-spin" size={18} /> : <>Finalizar <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" /></>}</button></div>
    </motion.div>
  );
}

function StepSuccess({ onDashboard }: { onDashboard: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, type: "spring" }} className="text-center space-y-6">
      <motion.div className="w-24 h-24 bg-gradient-to-br from-nutri-400 to-nutri-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-nutri-500/20" animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 0.6, delay: 0.2 }}><Gift size={40} className="text-white" strokeWidth={1.5} /></motion.div>
      <div><h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-3">Perfil salvo! 🎉</h2><p className="text-stone-500 text-sm md:text-base leading-relaxed max-w-xs mx-auto">Estamos muito felizes em ter você aqui. A partir de agora, tudo será pensado para você.</p></div>
      <motion.button onClick={onDashboard} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-xl transition-all mt-8">Ir para o meu Plano <ArrowRight size={18} /></motion.button>
    </motion.div>
  );
}

// =========================================================================
// MAIN COMPONENT
// =========================================================================
export default function CompletarPerfil() {
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [foodRestrictions, setFoodRestrictions] = useState<FoodRestriction[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [step, setStep] = useState(1);
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('phone, data_nascimento, food_restrictions').eq('id', session.user.id).single();
        if (data) {
          if (data.phone) setPhone(data.phone);
          if (data.data_nascimento) setBirthDate(data.data_nascimento);
          if (data.food_restrictions) setFoodRestrictions(data.food_restrictions);
        }
      }
      setFetching(false);
    }
    fetchProfile();
  }, [supabase]);

  const handleSubmit = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('profiles').update({ phone, data_nascimento: birthDate, food_restrictions: foodRestrictions }).eq('id', session?.user.id);
    if (error) { 
      console.error("Erro no update:", error.message); 
      alert(`Erro ao salvar dados: ${error.message || 'Tente novamente.'}`); 
      setLoading(false); 
    } else { 
      setStep(5); 
      setLoading(false); 
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));
  const goToDashboard = () => router.push('/dashboard');

  if (fetching) return <main className="min-h-screen bg-[#FAFAFA] flex items-center justify-center"><Loader2 className="animate-spin text-nutri-800" size={48} /></main>;
  if (step === 5) return <main className="min-h-screen bg-[#FAFAFA] pt-24 pb-12 px-4"><div className="w-full max-w-md mx-auto"><StepSuccess onDashboard={goToDashboard} /></div></main>;

  return (
    <main className="min-h-screen bg-[#FAFAFA] pt-16 md:pt-24 pb-12 px-4">
      <div className="w-full max-w-lg mx-auto bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 md:p-8 relative overflow-hidden">
        <ProgressTracker step={step} totalSteps={4} />
        <AnimatePresence mode="wait">
          {step === 1 && <StepWelcome key="step1" onNext={nextStep} />}
          {step === 2 && <StepBasic key="step2" phone={phone} setPhone={setPhone} birthDate={birthDate} setBirthDate={setBirthDate} onNext={nextStep} onBack={prevStep} />}
          {step === 3 && <StepRestrictions key="step3" foodRestrictions={foodRestrictions} setFoodRestrictions={setFoodRestrictions} onNext={nextStep} onBack={prevStep} />}
          {step === 4 && <StepConfirm key="step4" phone={phone} birthDate={birthDate} foodRestrictions={foodRestrictions} onConfirm={handleSubmit} onBack={prevStep} loading={loading} />}
        </AnimatePresence>
      </div>
    </main>
  );
}