'use client';

import { useState } from 'react';
import { type FoodRestriction, type FoodTag } from '@/types/patient';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';
import { X, Plus } from 'lucide-react';

// 🔥 TAGS PADRÃO
const TAG_OPTIONS: Array<{ label: string; value: FoodTag }> = [
  { label: 'Lactose', value: 'lactose' },
  { label: 'Glúten', value: 'gluten' },
  { label: 'Açúcar', value: 'sugar' },
  { label: 'Oleaginosas', value: 'nuts' }
];

interface Props {
  value: FoodRestriction[];
  onChange: (value: FoodRestriction[]) => void;
}

export default function FoodRestrictionsForm({ value, onChange }: Props) {
  const [type, setType] = useState<FoodRestriction['type']>('allergy');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [selectedTag, setSelectedTag] = useState<FoodTag | ''>('');

  // =========================================================================
  // ADD RESTRICTION
  // =========================================================================
  const handleAdd = () => {
    if (!selectedFoodId && !selectedTag) return;

    // PREVENÇÃO DE DUPLICATAS
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

    // 🔥 CORREÇÃO TYPESCRIPT: 
    // Mantemos undefined para diferenciar restricao especifica de categoria.
    const newRestriction: FoodRestriction = {
      type,
      foodId: selectedFoodId || undefined,
      tag: selectedTag || undefined,
      food: selectedFoodId
        ? FOOD_REGISTRY.find(f => f.id === selectedFoodId)?.name || ''
        : ''
    };

    onChange([...value, newRestriction]);

    // reset
    setSelectedFoodId('');
    setSelectedTag('');
  };

  // =========================================================================
  // REMOVE
  // =========================================================================
  const handleRemove = (index: number) => {
    const updated = [...value];
    updated.splice(index, 1);
    onChange(updated);
  };

  // Função auxiliar para exibir o nome bonito da Tag na lista
  const getTagLabel = (tagValue: string) => {
    return TAG_OPTIONS.find(t => t.value === tagValue)?.label || tagValue;
  };

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div>
        <h3 className="font-bold text-sm text-stone-800">
          Restrições Alimentares
        </h3>
        <p className="text-xs text-stone-500">
          Adicione alergias, intolerâncias ou restrições
        </p>
      </div>

      {/* SELECT TYPE */}
      <select
        value={type}
        onChange={(e) => setType(e.target.value as FoodRestriction['type'])}
        className="w-full border p-2 rounded-lg text-sm"
      >
        <option value="allergy">🚫 Alergia</option>
        <option value="intolerance">⚠️ Intolerância</option>
        <option value="restriction">📋 Restrição</option>
      </select>

      {/* SELECT FOOD */}
      <select
        value={selectedFoodId}
        onChange={(e) => {
          setSelectedFoodId(e.target.value);
          setSelectedTag('');
        }}
        className="w-full border p-2 rounded-lg text-sm"
      >
        <option value="">Selecionar alimento</option>
        {FOOD_REGISTRY.map(food => (
          <option key={food.id} value={food.id}>
            {food.name}
          </option>
        ))}
      </select>

      {/* SELECT TAG */}
      <select
        value={selectedTag}
        onChange={(e) => {
          setSelectedTag(e.target.value as FoodTag | '');
          setSelectedFoodId('');
        }}
        className="w-full border p-2 rounded-lg text-sm"
      >
        <option value="">Ou selecionar categoria</option>
        {TAG_OPTIONS.map(tag => (
          <option key={tag.value} value={tag.value}>
            {tag.label}
          </option>
        ))}
      </select>

      {/* ADD BUTTON */}
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-2 bg-nutri-900 text-white px-4 py-2 rounded-lg text-xs"
      >
        <Plus size={14} />
        Adicionar restrição
      </button>

      {/* LIST */}
      <div className="space-y-2">
        {value.map((r, index) => (
          <div
            key={`${r.type}-${r.foodId || 'food'}-${r.tag || 'tag'}`}
            className="flex items-center justify-between bg-stone-100 px-3 py-2 rounded-lg text-xs"
          >
            <span>
              {r.type === 'allergy' && '🚫 '}
              {r.type === 'intolerance' && '⚠️ '}
              {r.type === 'restriction' && '📋 '}
              
              {/* Renderização mais limpa com fallback para string vazia */}
              {r.food || (r.tag ? getTagLabel(r.tag) : r.foodId)}
            </span>

            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="text-red-500 hover:text-red-700 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
