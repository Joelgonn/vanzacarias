'use client';

import { useState, useEffect } from 'react';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';
import { type FoodRestriction, type FoodTag } from '@/types/patient';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search } from 'lucide-react';

// =========================================================================
// CONFIG
// =========================================================================
const TYPE_OPTIONS = [
  {
    label: 'Alergia',
    value: 'allergy' as const,
    emoji: '🚫',
    description: 'Reação imune que pode ser grave'
  },
  {
    label: 'Intolerância',
    value: 'intolerance' as const,
    emoji: '⚠️',
    description: 'Dificuldade de digestão'
  },
  {
    label: 'Restrição',
    value: 'restriction' as const,
    emoji: '📋',
    description: 'Preferência ou escolha alimentar'
  }
];

const TAG_OPTIONS: Array<{ label: string; value: FoodTag; emoji: string }> = [
  { label: 'Lactose', value: 'lactose', emoji: '🥛' },
  { label: 'Glúten', value: 'gluten', emoji: '🌾' },
  { label: 'Açúcar', value: 'sugar', emoji: '🍬' },
  { label: 'Oleaginosas', value: 'nuts', emoji: '🥜' }
];

// =========================================================================
// COMPONENT
// =========================================================================
export default function FoodRestrictionsForm({
  value,
  onChange
}: {
  value: FoodRestriction[];
  onChange: (value: FoodRestriction[]) => void;
}) {
  const [step, setStep] = useState<'type' | 'search'>('type');
  const [type, setType] = useState<FoodRestriction['type']>('allergy');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<typeof FOOD_REGISTRY>([]);

  // 🔍 busca
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const filtered = FOOD_REGISTRY
      .filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);

    setResults(filtered);
  }, [query]);

  // ➕ add direto (sem botão)
  const handleAdd = (food: any) => {
    const exists = value.some(
      r => r.foodId === food.id && r.type === type
    );
    if (exists) return;

    onChange([
      ...value,
      {
        type,
        foodId: food.id,
        food: food.name
      }
    ]);

    setQuery('');
  };

  const handleAddTag = (tag: FoodTag) => {
    const exists = value.some(
      r => r.tag === tag && r.type === type
    );
    if (exists) return;

    onChange([
      ...value,
      {
        type,
        tag
      }
    ]);
  };

  const remove = (i: number) => {
    const copy = [...value];
    copy.splice(i, 1);
    onChange(copy);
  };

  // =========================================================================
  // UI
  // =========================================================================
  return (
    <div className="space-y-8">
      {/* HERO */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-black text-stone-900">
          Seu corpo tem limites.
        </h1>
        <p className="text-sm text-stone-500 max-w-[280px] mx-auto">
          Vamos respeitar isso para criar um plano seguro e personalizado.
        </p>
      </div>

      {/* CHIPS ATIVOS (Lista do usuário) */}
      <div className="min-h-[40px]">
        <AnimatePresence>
          {value.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap gap-2 justify-center"
            >
              {value.map((r, i) => (
                <motion.div
                  key={`${r.type}-${r.foodId || r.tag}-${i}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  layout
                  className="flex items-center gap-1 bg-white border border-stone-200 pl-3 pr-1 py-1.5 rounded-full text-sm font-medium text-stone-700 shadow-sm"
                >
                  <span className="text-base mr-1">
                    {r.type === 'allergy' && '🚫'}
                    {r.type === 'intolerance' && '⚠️'}
                    {r.type === 'restriction' && '📋'}
                  </span>
                  <span className="capitalize">{r.food || r.tag}</span>
                  {/* Área de toque maior (hitbox) para mobile */}
                  <button 
                    onClick={() => remove(i)}
                    className="p-1.5 ml-1 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    aria-label="Remover"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1 - TYPE */}
        {step === 'type' && (
          <motion.div
            key="type"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-bold text-center text-stone-800">
              Você possui alguma restrição?
            </h2>

            <div className="space-y-3">
              {TYPE_OPTIONS.map(opt => (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  key={opt.value}
                  onClick={() => {
                    setType(opt.value);
                    setStep('search');
                  }}
                  className="w-full text-left p-5 rounded-2xl border border-stone-200 bg-white hover:border-nutri-300 hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-stone-50 flex items-center justify-center text-2xl group-hover:bg-nutri-50 transition-colors">
                      {opt.emoji}
                    </div>
                    <div>
                      <p className="font-bold text-stone-800 text-base">{opt.label}</p>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 2 - SEARCH */}
        {step === 'search' && (
          <motion.div
            key="search"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <p className="text-sm font-medium text-stone-500 text-center flex items-center justify-center gap-2">
                Buscando: <span className="text-stone-800 font-bold bg-stone-100 px-2 py-0.5 rounded-md">{TYPE_OPTIONS.find(t => t.value === type)?.label}</span>
              </p>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input
                  autoFocus
                  placeholder="Ex: leite, pão, amendoim..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 text-base md:text-lg rounded-2xl border border-stone-200 bg-white shadow-sm focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all placeholder:text-stone-400"
                />
                {query && (
                  <button 
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-stone-600 rounded-full bg-stone-50"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* RESULTADOS DA BUSCA */}
            {results.length > 0 && (
              <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
                {results.map(food => (
                  <button
                    key={food.id}
                    onClick={() => handleAdd(food)}
                    className="w-full text-left py-4 px-5 text-base text-stone-700 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors flex items-center justify-between"
                  >
                    <span>{food.name}</span>
                    <span className="text-xs font-bold text-nutri-600 bg-nutri-50 px-2 py-1 rounded-md">Adicionar</span>
                  </button>
                ))}
              </div>
            )}

            {/* TAGS RÁPIDAS (Com Scroll Horizontal Mobile-First) */}
            {!query && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest pl-1">
                  Adição Rápida
                </p>
                <div className="flex overflow-x-auto pb-2 -mx-4 px-4 gap-2 hide-scrollbar">
                  {TAG_OPTIONS.map(tag => (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      key={tag.value}
                      onClick={() => handleAddTag(tag.value)}
                      className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-sm font-medium text-stone-700 transition-colors"
                    >
                      <span className="text-lg">{tag.emoji}</span>
                      {tag.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* VOLTAR */}
            <div className="pt-4 flex justify-center">
              <button
                onClick={() => {
                  setStep('type');
                  setQuery('');
                }}
                className="text-sm font-medium text-stone-400 hover:text-stone-600 px-4 py-2 rounded-full hover:bg-stone-100 transition-all"
              >
                ← Escolher outro tipo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EMPTY STATE */}
      {value.length === 0 && step === 'type' && (
        <div className="text-center text-xs text-stone-400">
          Nenhuma restrição informada. <br/>Seu plano será livre.
        </div>
      )}

      {/* Estilos globais injetados para o hide-scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}