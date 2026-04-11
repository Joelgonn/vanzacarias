'use client';

import { useState } from 'react';
import { type FoodRestriction, type FoodTag } from '@/types/patient';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';
import { X, Plus, ChevronDown, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// =========================================================================
// TAGS PADRÃO
// =========================================================================
const TAG_OPTIONS: Array<{ label: string; value: FoodTag; emoji: string }> = [
  { label: 'Lactose', value: 'lactose', emoji: '🥛' },
  { label: 'Glúten', value: 'gluten', emoji: '🌾' },
  { label: 'Açúcar', value: 'sugar', emoji: '🍬' },
  { label: 'Oleaginosas', value: 'nuts', emoji: '🥜' }
];

// =========================================================================
// TIPOS DE RESTRIÇÃO
// =========================================================================
const TYPE_OPTIONS = [
  { label: 'Alergia', value: 'allergy' as const, emoji: '🚫' },
  { label: 'Intolerância', value: 'intolerance' as const, emoji: '⚠️' },
  { label: 'Restrição', value: 'restriction' as const, emoji: '📋' },
];

// =========================================================================
// DROPDOWN PREMIUM COM BUSCA
// =========================================================================
interface PremiumDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; emoji?: string }>;
  placeholder: string;
  searchable?: boolean;
}

function PremiumDropdown({ value, onChange, options, placeholder, searchable = false }: PremiumDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find(opt => opt.value === value);

  const filteredOptions = searchable && search
    ? options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-4 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 transition-all"
      >
        <span className="flex items-center gap-2">
          {selected?.emoji && <span>{selected.emoji}</span>}
          <span className={!selected ? 'text-stone-400' : 'text-stone-700'}>
            {selected?.label || placeholder}
          </span>
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
            className="absolute z-20 mt-2 w-full bg-white border border-stone-100 rounded-2xl shadow-xl overflow-hidden"
          >
            {searchable && (
              <div className="p-3 border-b border-stone-100">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-xl focus:ring-2 focus:ring-nutri-800/20 focus:border-nutri-800 outline-none transition-all"
                  />
                </div>
              </div>
            )}
            
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-stone-400 text-sm">Nenhum item encontrado</div>
              ) : (
                filteredOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { onChange(opt.value); setIsOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-stone-50 transition-colors ${
                      value === opt.value ? 'bg-nutri-50 text-nutri-800 font-medium' : 'text-stone-600'
                    }`}
                  >
                    {opt.emoji && <span>{opt.emoji}</span>}
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
interface Props {
  value: FoodRestriction[];
  onChange: (value: FoodRestriction[]) => void;
}

export default function FoodRestrictionsForm({ value, onChange }: Props) {
  const [type, setType] = useState<FoodRestriction['type']>('allergy');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [selectedTag, setSelectedTag] = useState<FoodTag | ''>('');

  // CORREÇÃO: uso de (food as any).emoji para evitar erro de tipagem
  const foodOptions = FOOD_REGISTRY.map(food => ({
    value: food.id,
    label: food.name,
    emoji: (food as any).emoji || '🍽️'
  }));

  const tagOptions = TAG_OPTIONS.map(tag => ({
    value: tag.value,
    label: tag.label,
    emoji: tag.emoji
  }));

  const handleAdd = () => {
    if (!selectedFoodId && !selectedTag) return;

    const exists = value.some(r => 
      r.type === type && 
      r.foodId === (selectedFoodId || undefined) && 
      r.tag === (selectedTag || undefined)
    );

    if (exists) {
      setSelectedFoodId('');
      setSelectedTag('');
      return;
    }

    const newRestriction: FoodRestriction = {
      type,
      foodId: selectedFoodId || undefined,
      tag: selectedTag || undefined,
      food: selectedFoodId
        ? FOOD_REGISTRY.find(f => f.id === selectedFoodId)?.name || ''
        : ''
    };

    onChange([...value, newRestriction]);
    setSelectedFoodId('');
    setSelectedTag('');
  };

  const handleRemove = (index: number) => {
    const updated = [...value];
    updated.splice(index, 1);
    onChange(updated);
  };

  const getTagLabel = (tagValue: string) => {
    return TAG_OPTIONS.find(t => t.value === tagValue)?.label || tagValue;
  };

  const getTagEmoji = (tagValue: string) => {
    return TAG_OPTIONS.find(t => t.value === tagValue)?.emoji || '🏷️';
  };

  const getTypeEmoji = (typeValue: string) => {
    return TYPE_OPTIONS.find(t => t.value === typeValue)?.emoji || '📌';
  };

  return (
    <div className="space-y-5">
      
      <div>
        <h3 className="font-bold text-sm text-stone-800">Restrições Alimentares</h3>
        <p className="text-xs text-stone-500">Adicione alergias, intolerâncias ou restrições</p>
      </div>

      {/* TYPE - CHIPS PREMIUM */}
      <div className="flex gap-2">
        {TYPE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setType(opt.value)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
              type === opt.value
                ? 'bg-nutri-900 text-white shadow-md'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            <span>{opt.emoji}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* FOOD - DROPDOWN PREMIUM COM BUSCA */}
      <PremiumDropdown
        options={foodOptions}
        value={selectedFoodId}
        onChange={(val) => { setSelectedFoodId(val); setSelectedTag(''); }}
        placeholder="Selecione um alimento"
        searchable
      />

      {/* OU DIVIDER */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200"></div></div>
        <div className="relative flex justify-center text-xs"><span className="px-3 bg-white text-stone-400">ou</span></div>
      </div>

      {/* CATEGORY - DROPDOWN PREMIUM */}
      <PremiumDropdown
        options={tagOptions}
        value={selectedTag}
        onChange={(val) => { setSelectedTag(val as FoodTag); setSelectedFoodId(''); }}
        placeholder="Selecione uma categoria"
      />

      {/* ADD BUTTON */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={!selectedFoodId && !selectedTag}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-3 rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        <Plus size={16} /> Adicionar restrição
      </button>

      {/* LISTA DE RESTRIÇÕES - CHIPS */}
      {value.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3 block">
            Suas restrições ({value.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {value.map((r, index) => (
              <motion.div
                key={`${r.type}-${r.foodId || r.tag}-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 bg-nutri-50 text-nutri-800 px-3 py-2 rounded-full text-xs font-medium border border-nutri-100 shadow-sm"
              >
                <span>{getTypeEmoji(r.type)}</span>
                <span className="max-w-[150px] truncate">
                  {r.food || (r.tag ? `${getTagEmoji(r.tag)} ${getTagLabel(r.tag)}` : r.foodId)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="ml-1 p-0.5 rounded-full hover:bg-nutri-100 transition-colors"
                >
                  <X size={12} className="text-nutri-600" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {value.length === 0 && (
        <div className="text-center py-6 bg-stone-50 rounded-2xl border border-stone-100 border-dashed">
          <p className="text-xs text-stone-400">Nenhuma restrição adicionada ainda</p>
          <p className="text-[10px] text-stone-300 mt-1">Adicione acima para personalizar seu plano</p>
        </div>
      )}
    </div>
  );
}