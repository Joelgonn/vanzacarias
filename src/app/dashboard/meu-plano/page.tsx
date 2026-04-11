'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, FileText, Download, ChevronLeft, Lock, Star, 
  Clock, Utensils, ChevronRight, Info, Filter, ShoppingCart, 
  X, CalendarDays, Copy, CheckCheck, ArrowLeftRight,
  Droplets, CheckCircle2, Circle, Flame, Plus, Minus, Search,
  Beef, Wheat, TrendingUp, Zap, Target, Activity, Trophy
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

// =========================================================================
// FUNÇÃO AUXILIAR DE NORMALIZAÇÃO PARA EVITAR DUPLICAÇÃO NO MARKET
// =========================================================================
const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// =========================================================================
// FUNÇÃO PARA ARREDONDAMENTO SEGURO
// =========================================================================
const safeAdd = (a: number, b: number): number => {
  return parseFloat((a + b).toFixed(2));
};

// =========================================================================
// ÍCONE CUSTOMIZADO DO WHATSAPP
// =========================================================================
const WhatsAppIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);

// =========================================================================
// COMPONENTE DE MACROS PREMIUM
// =========================================================================
interface MacroPorRefeicao {
  nome: string;
  horario: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

function MacroCard({ 
  totalKcal, 
  totalProtein, 
  totalCarbs, 
  totalFat,
  consumedKcal,
  consumedProtein,
  consumedCarbs,
  consumedFat,
  macrosPorRefeicao = [] 
}: { 
  totalKcal: number; 
  totalProtein: number; 
  totalCarbs: number; 
  totalFat: number;
  consumedKcal: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  macrosPorRefeicao?: MacroPorRefeicao[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (totalKcal === 0 && totalProtein === 0 && totalCarbs === 0 && totalFat === 0) {
    return null;
  }

  const calcPercent = (consumed: number, total: number) => {
    return Math.min(Math.round((consumed / (total || 1)) * 100), 100);
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-stone-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-stone-800 uppercase tracking-widest flex items-center gap-2">
          <Activity size={18} className="text-nutri-600" />
          Dashboard Metabólico
        </h3>
        <span className="text-xs font-bold text-stone-400">Meta: {Math.round(totalKcal)} kcal</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-2">
        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex flex-col justify-center">
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1">
              <Flame size={14} className="text-orange-500"/> Consumo Atual
            </span>
            <span className="text-xl font-black text-stone-800">
              {Math.round(consumedKcal)} <span className="text-xs font-bold text-stone-400 uppercase">/ {Math.round(totalKcal)} kcal</span>
            </span>
          </div>
          <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden w-full">
            <div 
              className="h-full bg-orange-500 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${calcPercent(consumedKcal, totalKcal)}%` }} 
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3">
          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
              <span className="text-stone-500 flex items-center gap-1">
                <Beef size={12} className="text-red-500"/> Proteínas
              </span>
              <span className="text-stone-800">
                {Math.round(consumedProtein)}g <span className="text-stone-400">/ {Math.round(totalProtein)}g</span>
              </span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full transition-all duration-1000" 
                style={{ width: `${calcPercent(consumedProtein, totalProtein)}%` }} 
              />
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
              <span className="text-stone-500 flex items-center gap-1">
                <Wheat size={12} className="text-amber-500"/> Carboidratos
              </span>
              <span className="text-stone-800">
                {Math.round(consumedCarbs)}g <span className="text-stone-400">/ {Math.round(totalCarbs)}g</span>
              </span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-1000" 
                style={{ width: `${calcPercent(consumedCarbs, totalCarbs)}%` }} 
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
              <span className="text-stone-500 flex items-center gap-1">
                <Droplets size={12} className="text-blue-500"/> Gorduras
              </span>
              <span className="text-stone-800">
                {Math.round(consumedFat)}g <span className="text-stone-400">/ {Math.round(totalFat)}g</span>
              </span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                style={{ width: `${calcPercent(consumedFat, totalFat)}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {macrosPorRefeicao.length > 0 && (
        <div className="mt-4">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest font-bold text-stone-400 hover:text-nutri-700 py-3 rounded-xl hover:bg-stone-50 transition-all border border-transparent hover:border-stone-100"
          >
            <span>Detalhamento por refeição</span>
            <ChevronRight size={14} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
          
          {expanded && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fade-in">
              {macrosPorRefeicao.map((ref) => (
                <div key={`${ref.nome}-${ref.horario}`} className="flex items-center justify-between p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm">
                  <div>
                    <p className="font-bold text-stone-700 text-xs">{ref.nome}</p>
                    <p className="text-[10px] text-stone-400 font-bold uppercase">{ref.horario}</p>
                  </div>
                  <div className="flex gap-2 text-[10px] font-black">
                    <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                      {Math.round(ref.kcal)} kcal
                    </span>
                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                      {Math.round(ref.protein)}g P
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// TIPAGEM PARA A TABELA DE SUBSTITUIÇÕES
// =========================================================================
interface MacrosItem {
  carbo: number;
  proteina: number;
  gordura: number;
  kcal: number;
}

interface SubstituicaoItem {
  nome: string;
  medida: string;
  macros?: MacrosItem; 
}

interface SubstituicaoGrupo {
  categoria: string;
  referencia?: {
    descricao: string;
    carbo?: number;
    proteina?: number;
    gordura?: number;
  };
  itens: SubstituicaoItem[];
}

// =========================================================================
// BANCO DE ALIMENTOS E CONSTANTES
// =========================================================================
const SUBSTITUICOES_PADRAO: SubstituicaoGrupo[] = [
  { 
    categoria: "Proteínas e Laticínios", 
    referencia: { descricao: "Referência: ~25g de proteína (100g de frango)", proteina: 25 },
    itens: [
      { nome: "Ovo mexido (2 un)", medida: "2 unidades", macros: { carbo: 1, proteina: 12, gordura: 11, kcal: 156 } },
      { nome: "Ovo cozido (2 un)", medida: "2 unidades", macros: { carbo: 1, proteina: 12, gordura: 10, kcal: 140 } },
      { nome: "Frango grelhado", medida: "100g", macros: { carbo: 0, proteina: 31, gordura: 3, kcal: 165 } },
      { nome: "Frango desfiado", medida: "3 colheres sopa", macros: { carbo: 0, proteina: 20, gordura: 2, kcal: 105 } },
      { nome: "Carne moída magra", medida: "100g", macros: { carbo: 0, proteina: 21, gordura: 5, kcal: 133 } },
      { nome: "Filé de peixe", medida: "100g", macros: { carbo: 0, proteina: 20, gordura: 2, kcal: 110 } },
      { nome: "Whey Protein", medida: "1 scoop 30g", macros: { carbo: 3, proteina: 24, gordura: 1.5, kcal: 120 } },
      { nome: "Leite Integral", medida: "1 copo 200ml", macros: { carbo: 10, proteina: 6, gordura: 6, kcal: 120 } },
      { nome: "Leite Desnatado", medida: "1 copo 200ml", macros: { carbo: 10, proteina: 6, gordura: 0, kcal: 70 } },
      { nome: "Iogurte Natural", medida: "1 pote 170g", macros: { carbo: 9, proteina: 7, gordura: 0, kcal: 70 } },
      { nome: "Queijo branco/Minas", medida: "1 fatia 30g", macros: { carbo: 1, proteina: 5, gordura: 4, kcal: 66 } },
      { nome: "Queijo Mussarela", medida: "2 fatias 30g", macros: { carbo: 1, proteina: 7, gordura: 7, kcal: 96 } }
    ] 
  },
  { 
    categoria: "Carboidratos", 
    referencia: { descricao: "Referência: ~25g de carboidrato (100g de arroz cozido)", carbo: 25 },
    itens: [
      { nome: "Arroz branco cozido", medida: "100g", macros: { carbo: 28, proteina: 2.5, gordura: 0.2, kcal: 130 } },
      { nome: "Arroz integral cozido", medida: "100g", macros: { carbo: 24, proteina: 2.5, gordura: 1, kcal: 112 } },
      { nome: "Mandioca/Macaxeira cozida", medida: "100g", macros: { carbo: 30, proteina: 1, gordura: 0, kcal: 125 } },
      { nome: "Tapioca", medida: "3 colheres sopa 50g", macros: { carbo: 30, proteina: 0, gordura: 0, kcal: 120 } },
      { nome: "Pão francês", medida: "1 un", macros: { carbo: 28, proteina: 4, gordura: 0, kcal: 135 } },
      { nome: "Pão de forma int.", medida: "2 fatias", macros: { carbo: 20, proteina: 5, gordura: 1.5, kcal: 115 } },
      { nome: "Batata doce cozida", medida: "100g", macros: { carbo: 20, proteina: 1, gordura: 0.1, kcal: 86 } },
      { nome: "Batata inglesa cozida", medida: "150g", macros: { carbo: 26, proteina: 2, gordura: 0.1, kcal: 110 } },
      { nome: "Aveia em flocos", medida: "30g", macros: { carbo: 17, proteina: 4.5, gordura: 2.5, kcal: 118 } },
      { nome: "Granola s/ açúcar", medida: "3 colheres sopa", macros: { carbo: 20, proteina: 4, gordura: 5, kcal: 140 } },
      { nome: "Macarrão cozido", medida: "100g", macros: { carbo: 31, proteina: 5, gordura: 1, kcal: 157 } },
      { nome: "Cuscuz de milho", medida: "100g", macros: { carbo: 25, proteina: 2, gordura: 1, kcal: 120 } }
    ] 
  },
  { 
    categoria: "Leguminosas", 
    referencia: { descricao: "Referência: Fibras e carboidratos de baixo índice glicêmico" },
    itens: [
      { nome: "Feijão caldo", medida: "1 concha", macros: { carbo: 14, proteina: 7, gordura: 0.5, kcal: 106 } },
      { nome: "Feijão em grãos", medida: "1 escumadeira", macros: { carbo: 20, proteina: 9, gordura: 1, kcal: 140 } },
      { nome: "Lentilha", medida: "1 escumadeira", macros: { carbo: 20, proteina: 9, gordura: 0.5, kcal: 115 } },
      { nome: "Grão de bico", medida: "3 colheres sopa", macros: { carbo: 22, proteina: 7, gordura: 2, kcal: 130 } },
      { nome: "Ervilha fresca", medida: "3 colheres sopa", macros: { carbo: 10, proteina: 5, gordura: 0.5, kcal: 70 } }
    ] 
  },
  { 
    categoria: "Vegetais e Saladas", 
    referencia: { descricao: "Consumo livre (ricos em fibras e baixo em calorias)" },
    itens: [
      { nome: "Salada de Folhas", medida: "à vontade", macros: { carbo: 2, proteina: 1, gordura: 0, kcal: 15 } },
      { nome: "Tomate e Pepino", medida: "1 porção", macros: { carbo: 5, proteina: 1, gordura: 0, kcal: 25 } },
      { nome: "Brócolis cozido", medida: "3 ramos", macros: { carbo: 4, proteina: 2, gordura: 0, kcal: 25 } },
      { nome: "Cenoura ralada", medida: "2 colheres sopa", macros: { carbo: 4, proteina: 0.5, gordura: 0, kcal: 20 } },
      { nome: "Abóbora cozida", medida: "100g", macros: { carbo: 9, proteina: 1, gordura: 0, kcal: 40 } },
      { nome: "Abobrinha/Chuchu", medida: "1 pires", macros: { carbo: 6, proteina: 1, gordura: 0, kcal: 30 } },
      { nome: "Beterraba", medida: "2 fatias", macros: { carbo: 8, proteina: 1, gordura: 0, kcal: 35 } }
    ] 
  },
  { 
    categoria: "Frutas", 
    referencia: { descricao: "Referência: ~15g de carboidrato (porção média)" },
    itens: [
      { nome: "Banana prata", medida: "1 un média", macros: { carbo: 23, proteina: 1, gordura: 0, kcal: 90 } },
      { nome: "Maçã", medida: "1 un média", macros: { carbo: 15, proteina: 0.3, gordura: 0, kcal: 70 } },
      { nome: "Laranja", medida: "1 un média", macros: { carbo: 15, proteina: 1, gordura: 0, kcal: 60 } },
      { nome: "Melancia", medida: "1 fatia grande 200g", macros: { carbo: 14, proteina: 1, gordura: 0, kcal: 60 } },
      { nome: "Mamão", medida: "1 fatia média", macros: { carbo: 11, proteina: 0.5, gordura: 0, kcal: 45 } },
      { nome: "Uva sem semente", medida: "1 cacho peq.", macros: { carbo: 17, proteina: 0.5, gordura: 0, kcal: 70 } },
      { nome: "Abacaxi", medida: "1 fatia grossa", macros: { carbo: 13, proteina: 0.5, gordura: 0, kcal: 50 } },
      { nome: "Morangos", medida: "10 un", macros: { carbo: 7, proteina: 0.6, gordura: 0.3, kcal: 32 } },
      { nome: "Abacate", medida: "2 colheres sopa", macros: { carbo: 5, proteina: 1, gordura: 10, kcal: 110 } }
    ] 
  },
  { 
    categoria: "Gorduras/Extras", 
    referencia: { descricao: "Atenção às calorias (alimentos densos)" },
    itens: [
      { nome: "Azeite de oliva", medida: "1 col. sopa", macros: { carbo: 0, proteina: 0, gordura: 12, kcal: 108 } },
      { nome: "Pasta de amendoim", medida: "1 col. sopa", macros: { carbo: 3, proteina: 4, gordura: 8, kcal: 90 } },
      { nome: "Manteiga", medida: "1 colher chá 10g", macros: { carbo: 0, proteina: 0, gordura: 8, kcal: 70 } },
      { nome: "Requeijão light", medida: "1 col. sopa", macros: { carbo: 1, proteina: 3, gordura: 4, kcal: 50 } },
      { nome: "Castanhas", medida: "Mix 30g", macros: { carbo: 9, proteina: 4, gordura: 15, kcal: 170 } },
      { nome: "Chia/Linhaça", medida: "1 col. sopa", macros: { carbo: 4, proteina: 2, gordura: 4, kcal: 55 } },
      { nome: "Chocolate 70% Cacau", medida: "2 quadradinhos", macros: { carbo: 9, proteina: 2, gordura: 9, kcal: 120 } }
    ] 
  }
];

// =========================================================================
// SINGLE-PASS RENDERIZADOR DE TEXTO INTELIGENTE
// =========================================================================
interface Rule {
  match: RegExp;
  category: string;
}

const TOOLTIP_RULES: Rule[] = [
  { match: /\b(batata doce|arroz branco|arroz integral|arroz|batata inglesa|macarr[ãa]o|aveia|p[ãa]o franc[êe]s|p[ãa]o|cuscuz|tapioca|mandioca|macaxeira|granola)\b/gi, category: "Carboidratos" },
  { match: /\b(peito de frango|frango|carne bovina|carne|til[áa]pia|peixe|lombo|ovos?|atum|whey|leite|iogurte|queijo)\b/gi, category: "Proteínas e Laticínios" },
  { match: /\b(feij[ãa]o|lentilha|gr[ãa]o de bico|ervilha)\b/gi, category: "Leguminosas" },
  { match: /\b(azeite|castanhas?|pasta de amendoim|amendoim|abacate|chia|linha[çc]a|manteiga|requeij[ãa]o|chocolate|cacau)\b/gi, category: "Gorduras/Extras" },
  { match: /\b(ma[çc][ãa]|banana|mam[ãa]o|morangos?|abacaxi|laranja|melancia|uvas?|frutas?)\b/gi, category: "Frutas" },
  { match: /\b(alface|tomate|br[óo]colis|cenoura|ab[óo]bora|abobrinha|chuchu|beterraba|legumes|verduras|salada)\b/gi, category: "Vegetais e Saladas" }
];

const COMBINED_RULE = (() => {
  const patterns = TOOLTIP_RULES.map(rule => `(${rule.match.source})`).join('|');
  return new RegExp(patterns, 'gi');
})();

const renderDescriptionWithTooltips = (text: string, onWordClick: (categoria: string) => void) => {
  if (!text) return text;
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let globalKeyCounter = 0;
  
  COMBINED_RULE.lastIndex = 0;
  
  let match: RegExpExecArray | null;
  
  while ((match = COMBINED_RULE.exec(text)) !== null) {
    const matchedText = match[0];
    const matchStart = match.index;
    const matchEnd = matchStart + matchedText.length;
    
    if (matchStart > lastIndex) {
      elements.push(text.substring(lastIndex, matchStart));
    }
    
    let category = '';
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        const ruleIndex = i - 1;
        if (ruleIndex < TOOLTIP_RULES.length) {
          category = TOOLTIP_RULES[ruleIndex].category;
        }
        break;
      }
    }
    
    elements.push(
      <button 
        key={`tooltip-${globalKeyCounter++}`}
        onClick={() => onWordClick(category)}
        className="border-b-2 border-dashed border-orange-400 text-orange-700 font-bold cursor-pointer transition-colors hover:bg-orange-100 rounded-sm px-[2px] active:scale-95"
        title={`Ver substituições inteligentes para ${category}`}
      >
        {matchedText}
      </button>
    );
    
    lastIndex = matchEnd;
  }
  
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  
  return elements;
};

// =========================================================================
// FUNÇÕES AUXILIARES
// =========================================================================
const getLocalTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseMarketDescription = (description: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  
  for (let i = 0; i < description.length; i++) {
    const char = description[i];
    
    if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (char === '+' && parenDepth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  return parts;
};

const buildDescriptionFromFoods = (option: any) => {
  if (option?.description && (!option?.foodItems || option.foodItems.length === 0)) {
    return option.description;
  }
  if (!option?.foodItems || !Array.isArray(option.foodItems) || option.foodItems.length === 0) {
    return 'Refeição não definida';
  }
  return option.foodItems
    .map((food: any) => food.name || '')
    .filter(Boolean)
    .join(' + ');
};

const calcularMacrosDoCardapio = (mealPlan: any[]) => {
  if (!mealPlan || !Array.isArray(mealPlan) || mealPlan.length === 0) {
    return {
      totalKcal: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      macrosPorRefeicao: []
    };
  }

  const macrosPorRefeicao: MacroPorRefeicao[] = [];
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const meal of mealPlan) {
    const option = meal.options?.[0] ?? null;
    if (option) {
      const kcal = option.kcal || 0;
      const protein = option.macros?.p || 0;
      const carbs = option.macros?.c || 0;
      const fat = option.macros?.g || 0;

      totalKcal = safeAdd(totalKcal, kcal);
      totalProtein = safeAdd(totalProtein, protein);
      totalCarbs = safeAdd(totalCarbs, carbs);
      totalFat = safeAdd(totalFat, fat);

      macrosPorRefeicao.push({
        nome: meal.name || 'Refeição',
        horario: meal.time || '--:--',
        kcal,
        protein,
        carbs,
        fat
      });
    }
  }

  return {
    totalKcal,
    totalProtein,
    totalCarbs,
    totalFat,
    macrosPorRefeicao
  };
};

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function MeuPlano() {
  const [planoPDF, setPlanoPDF] = useState<any>(null);
  const [mealPlanJSON, setMealPlanJSON] = useState<any[] | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [canAccess, setCanAccess] = useState<boolean>(false);
  const [prices, setPrices] = useState({ premium: 297.00, mealPlan: 147.00 });
  const [processingCheckout, setProcessingCheckout] = useState<string | null>(null);
  
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('Todos');

  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [marketMultiplier, setMarketMultiplier] = useState<number>(7); 
  const [isCopied, setIsCopied] = useState(false);

  const [isSubstitutionsModalOpen, setIsSubstitutionsModalOpen] = useState(false);
  const [contextualCategory, setContextualCategory] = useState<string | null>(null);

  const [completedMeals, setCompletedMeals] = useState<string[]>([]);
  const [waterCount, setWaterCount] = useState<number>(0);
  const [currentMood, setCurrentMood] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  // =========================================================================
  // LOAD DATA COM CANCELAMENTO
  // =========================================================================
  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        
        if (!session) {
          setError("Usuário não autenticado.");
          setLoading(false);
          return;
        }

        const { data: settings } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', 1)
          .single();

        if (!isMounted) return;
        
        if (settings) {
          setPrices({
            premium: settings.premium_price || 297.00,
            mealPlan: settings.meal_plan_price || 147.00
          });
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!isMounted) return;
        
        if (profileError) throw profileError;

        setProfile(profileData);
        
        const hasAccess = profileData?.account_type === 'premium' || profileData?.has_meal_plan_access === true;
        setCanAccess(hasAccess);

        if (hasAccess) {
          if (profileData?.meal_plan && Array.isArray(profileData.meal_plan)) {
            setMealPlanJSON(profileData.meal_plan);
          }

          if (profileData?.meal_plan_pdf_url) {
            setPlanoPDF(profileData.meal_plan_pdf_url);
          }

          const today = getLocalTodayString();
          const { data: logs } = await supabase
            .from('daily_logs')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('date', today)
            .maybeSingle();

          if (!isMounted) return;

          if (logs) {
            setCompletedMeals(logs.meals_checked || []);
            setWaterCount(logs.water_ml ? logs.water_ml / 250 : 0);
            setCurrentMood(logs.mood || null);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Erro no fetchData:", err);
        setError("Erro ao carregar seus dados.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // =========================================================================
  // MEMOS & CÁLCULOS PREMIUM
  // =========================================================================
  const filterTabs = useMemo(() => {
    if (!mealPlanJSON) return [];
    const days = new Set<string>();
    mealPlanJSON.forEach(meal => {
      meal.options?.forEach((opt: any) => {
        const d = opt.day?.trim();
        if (d && d.toLowerCase() !== 'todos os dias') days.add(d);
      });
    });
    return Array.from(days);
  }, [mealPlanJSON]);

  const filteredMeals = useMemo(() => {
    if (!mealPlanJSON) return [];
    if (selectedDayFilter === 'Todos') return mealPlanJSON;

    return mealPlanJSON.map(meal => {
      const filteredOptions = meal.options?.filter((opt: any) => {
        const optDay = opt.day?.trim();
        return optDay?.toLowerCase() === 'todos os dias' || optDay === selectedDayFilter;
      }) || [];
      return { ...meal, options: filteredOptions };
    }).filter(meal => meal.options.length > 0); 
  }, [mealPlanJSON, selectedDayFilter]);

  const macros = useMemo(() => {
    return calcularMacrosDoCardapio(filteredMeals);
  }, [filteredMeals]);

  const consumedStats = useMemo(() => {
    let p = 0, c = 0, g = 0, kcal = 0;
    filteredMeals.forEach(meal => {
      if (completedMeals.includes(meal.name) && meal.options?.[0]) {
        kcal = safeAdd(kcal, meal.options[0].kcal || 0);
        p = safeAdd(p, meal.options[0].macros?.p || 0);
        c = safeAdd(c, meal.options[0].macros?.c || 0);
        g = safeAdd(g, meal.options[0].macros?.g || 0);
      }
    });
    return { kcal, p, c, g };
  }, [filteredMeals, completedMeals]);

  const totalMealsCount = filteredMeals.length;
  const completedCount = filteredMeals.filter(m => completedMeals.includes(m.name)).length;
  const adherencePercent = totalMealsCount > 0 
    ? Math.round((completedCount / totalMealsCount) * 100) 
    : 0;
  
  const getLevelInfo = (adh: number) => {
    if (adh >= 100) return { label: "Elite", icon: "🏆", color: "text-amber-500", bg: "bg-gradient-to-r from-amber-400 to-yellow-500" };
    if (adh >= 70) return { label: "Focado", icon: "🔥", color: "text-orange-500", bg: "bg-gradient-to-r from-orange-400 to-red-500" };
    if (adh >= 40) return { label: "Consistente", icon: "⚡", color: "text-emerald-500", bg: "bg-gradient-to-r from-emerald-400 to-teal-500" };
    return { label: "Iniciante", icon: "🌱", color: "text-blue-500", bg: "bg-gradient-to-r from-blue-400 to-indigo-500" };
  };
  const currentLevel = getLevelInfo(adherencePercent);

  const insights = useMemo(() => {
    const list = [];
    
    if (waterCount < 4) {
      list.push({ text: "Atenção à hidratação! Beba um copo de água agora.", bg: "bg-blue-50", textCol: "text-blue-800", icon: <Droplets size={16} className="text-blue-500"/> });
    } else if (waterCount >= 8 && waterCount < 12) {
      list.push({ text: "Hidratação excelente! Continue assim.", bg: "bg-emerald-50", textCol: "text-emerald-800", icon: <Droplets size={16} className="text-emerald-500"/> });
    }
    
    if (completedCount === totalMealsCount && totalMealsCount > 0) {
      list.push({ text: "Dia perfeito! Todas as refeições do protocolo concluídas.", bg: "bg-amber-50", textCol: "text-amber-800", icon: <Star size={16} className="text-amber-500"/> });
    } else if (completedCount > 0 && completedCount < totalMealsCount) {
      list.push({ text: "Mantenha o foco! Faltam poucas refeições para completar a meta.", bg: "bg-orange-50", textCol: "text-orange-800", icon: <TrendingUp size={16} className="text-orange-500"/> });
    }
    
    if (consumedStats.p > 0 && consumedStats.p < (macros.totalProtein * 0.4) && completedCount >= (totalMealsCount / 2)) {
      list.push({ text: "Seu consumo de proteína está baixo hoje. Capriche na próxima refeição!", bg: "bg-red-50", textCol: "text-red-800", icon: <Beef size={16} className="text-red-500"/> });
    }

    return list.slice(0, 3);
  }, [waterCount, completedCount, totalMealsCount, consumedStats, macros]);

  // =========================================================================
  // LOGICA DO MERCADO COM NORMALIZAÇÃO
  // =========================================================================
  const marketList = useMemo(() => {
    if (!mealPlanJSON) return { measured: [], others: [] };
    
    const map = new Map<string, { name: string; qty: number; unit: string; originalName: string }>();
    const textItems = new Set<string>();

    mealPlanJSON.forEach(meal => {
      if (meal.options && meal.options.length > 0) {
        const opt = meal.options[0] ?? null; 
        if (!opt) return;

        let localMultiplier = marketMultiplier;
        const dayStr = opt.day?.trim().toLowerCase();
        
        if (dayStr && dayStr !== 'todos os dias' && dayStr !== 'opção') {
          if (marketMultiplier === 7) localMultiplier = 1;
          else if (marketMultiplier === 15) localMultiplier = 2;
          else if (marketMultiplier === 30) localMultiplier = 4;
          else if (marketMultiplier === 1) localMultiplier = 1 / 7;
        }

        const description = buildDescriptionFromFoods(opt);
        const parts = parseMarketDescription(description);
        
        parts.forEach((part: string) => {
          const match = part.match(/^(.*?)(?:\s*\((.*?)\))?$/);
          if (match) {
            const name = match[1].trim();
            const qtyUnit = match[2] ? match[2].trim() : '';
            
            if (qtyUnit && !qtyUnit.toLowerCase().includes('vontade')) {
              const numMatch = qtyUnit.match(/^([\d.,]+)\s*(.*)$/);
              if (numMatch) {
                const qty = parseFloat(numMatch[1].replace(',', '.'));
                const unit = numMatch[2].trim();
                const normalizedKey = `${normalizeString(name)}|${normalizeString(unit)}`;
                
                if (map.has(normalizedKey)) {
                  const existing = map.get(normalizedKey)!;
                  existing.qty = parseFloat((existing.qty + (qty * localMultiplier)).toFixed(2));
                } else {
                  map.set(normalizedKey, { 
                    name, 
                    qty: parseFloat((qty * localMultiplier).toFixed(2)), 
                    unit,
                    originalName: name 
                  });
                }
              } else {
                textItems.add(part);
              }
            } else {
              textItems.add(part);
            }
          } else {
            textItems.add(part);
          }
        });
      }
    });

    return {
      measured: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)),
      others: Array.from(textItems)
    };
  }, [mealPlanJSON, marketMultiplier]);

  // =========================================================================
  // FUNÇÕES DE AÇÃO
  // =========================================================================
  const handleUpgradeClick = async (planType: string) => {
    setProcessingCheckout(planType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          email: session.user.email,
          name: profile?.full_name || 'Paciente Vanusa Nutri',
          planType: planType 
        }),
      });

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point; 
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error("Erro ao processar pagamento.");
      setProcessingCheckout(null);
    }
  };

  const toggleMealCompletion = async (mealName: string) => {
    const isCompleted = completedMeals.includes(mealName);
    const newList = isCompleted 
      ? completedMeals.filter(m => m !== mealName)
      : [...completedMeals, mealName];
    
    setCompletedMeals(newList);
    
    const { data: { session } } = await supabase.auth.getSession();
    const today = getLocalTodayString();
    
    await supabase.from('daily_logs').upsert({
      user_id: session?.user.id,
      date: today,
      meals_checked: newList,
      water_ml: waterCount * 250,
      mood: currentMood
    }, { onConflict: 'user_id, date' });

    if (!isCompleted) {
      toast.success(`Excelente! Refeição registrada. 🔥`);
    }
  };

  const updateWater = async (increment: number) => {
    const newValue = Math.max(0, waterCount + increment);
    setWaterCount(newValue);
    
    const { data: { session } } = await supabase.auth.getSession();
    const today = getLocalTodayString();
    
    await supabase.from('daily_logs').upsert({
      user_id: session?.user.id,
      date: today,
      water_ml: newValue * 250,
      meals_checked: completedMeals,
      mood: currentMood
    }, { onConflict: 'user_id, date' });
  };

  const generateMarketText = () => {
    let periodText = 'Diário';
    if (marketMultiplier === 7) periodText = '7 Dias (Semanal)';
    if (marketMultiplier === 15) periodText = '15 Dias (Quinzenal)';
    if (marketMultiplier === 30) periodText = '30 Dias (Mensal)';

    const lines = [];
    lines.push(`🛒 *Lista de Compras Inteligente*`);
    lines.push(`👤 *Paciente:* ${profile?.full_name || 'Paciente'}`);
    lines.push(`📅 *Período:* ${periodText}`);
    lines.push('');

    if (marketList.measured.length > 0) {
      lines.push(`📊 *ITENS COM MEDIDA:*`);
      marketList.measured.forEach(item => {
        const qty = Number.isInteger(item.qty) ? item.qty : parseFloat(item.qty.toFixed(2));
        lines.push(`✅ ${qty} ${item.unit} - ${item.name}`);
      });
      lines.push('');
    }

    if (marketList.others.length > 0) {
      lines.push(`🟢 *CONSUMO LIVRE / OUTROS:*`);
      marketList.others.forEach(item => {
        lines.push(`✅ ${item}`);
      });
      lines.push('');
    }

    lines.push(`_Gerado pelo App Meu Plano Alimentar - Vanusa Nutri_`);

    return lines.join('\n');
  };

  const handleShareWhatsApp = () => {
    const text = generateMarketText();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const baseUrl = isMobile 
      ? 'https://api.whatsapp.com/send?text=' 
      : 'https://web.whatsapp.com/send?text=';

    const url = `${baseUrl}${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyToClipboard = async () => {
    try {
      const text = generateMarketText();
      await navigator.clipboard.writeText(text);
      
      toast.success("Lista copiada com sucesso!");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
      toast.error("Falha ao copiar lista.");
    }
  };

  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = error => reject(error);
      img.src = imageUrl;
    });
  };

  const handleGenerateDynamicPDF = async () => {
    if (!mealPlanJSON) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    const macrosData = calcularMacrosDoCardapio(mealPlanJSON);
    const totalKcal = macrosData.totalKcal;
    const totalProtein = macrosData.totalProtein;
    const totalCarbs = macrosData.totalCarbs;
    const totalFat = macrosData.totalFat;

    const daysMap = new Map<string, any[]>();
    mealPlanJSON.forEach(meal => {
      meal.options.forEach((opt: any) => {
        const dayName = opt.day?.trim() || "Opção";
        if (!daysMap.has(dayName)) daysMap.set(dayName, []);
        daysMap.get(dayName)!.push({
          mealName: meal.name,
          time: meal.time,
          description: buildDescriptionFromFoods(opt),
          kcal: opt.kcal,
          macros: opt.macros || { p: 0, c: 0, g: 0 }
        });
      });
    });

    const dayOrder = ["Todos os dias", "Segunda a Sexta", "Finais de Semana", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
    const sortedDays = Array.from(daysMap.keys()).sort((a, b) => {
      let idxA = dayOrder.indexOf(a);
      let idxB = dayOrder.indexOf(b);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    let logoBase64: string | null = null;
    try {
      logoBase64 = await getBase64ImageFromUrl('/images/logo-vanusa.png');
    } catch (error) {
      console.warn("Logo não encontrada");
    }

    const printHeaderAndFooter = () => {
      let currentY = 20;
      
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, currentY - 6, 16, 16); 
      }
      
      const textStartX = logoBase64 ? margin + 20 : margin;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(26, 58, 42); 
      doc.text("Vanusa Zacarias", textStartX, currentY + 2);
      
      doc.setFontSize(10);
      doc.setTextColor(139, 131, 120); 
      doc.text("NUTRIÇÃO CLÍNICA", textStartX, currentY + 8, { charSpace: 1.5 });
      
      doc.setFontSize(12);
      doc.setTextColor(200, 200, 200);
      doc.text("PLANO ALIMENTAR", pageWidth - margin, currentY + 8, { align: "right" });

      currentY += 18;
      
      doc.setDrawColor(26, 58, 42);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      
      currentY += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("PACIENTE:", margin, currentY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(profile?.full_name || "Paciente", margin + 20, currentY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("DATA:", margin + 85, currentY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(new Date().toLocaleDateString('pt-BR'), margin + 98, currentY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("BASE DIÁRIA:", pageWidth - margin - 52, currentY);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(234, 88, 12);
      doc.text(`~${Math.round(totalKcal)} kcal`, pageWidth - margin, currentY, { align: "right" });
      
      currentY += 5;
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const macroText = `P: ${Math.round(totalProtein)}g | C: ${Math.round(totalCarbs)}g | G: ${Math.round(totalFat)}g`;
      doc.text(macroText, pageWidth - margin - doc.getTextWidth(macroText), currentY);

      currentY += 6;
      
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      
      currentY += 12;

      doc.setDrawColor(220, 220, 220);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text("Plano alimentar individual e intransferível elaborado por Vanusa Zacarias - Nutrição Clínica.", pageWidth / 2, pageHeight - 10, { align: "center" });

      return currentY;
    };

    sortedDays.forEach((day, index) => {
      if (index > 0) {
        doc.addPage();
      }
      let y = printHeaderAndFooter();

      doc.setFillColor(26, 58, 42); 
      doc.rect(margin, y, pageWidth - (margin * 2), 12, 'F');
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255); 
      
      const titleText = day.toUpperCase() === 'TODOS OS DIAS' 
        ? 'CARDÁPIO PADRÃO (TODOS OS DIAS)' 
        : `CARDÁPIO: ${day.toUpperCase()}`;
        
      doc.text(titleText, pageWidth / 2, y + 8, { align: "center", charSpace: 1 });
      
      y += 20;

      const mealsForDay = daysMap.get(day) || [];
      
      mealsForDay.forEach(meal => {
        if (y > pageHeight - 50) { 
          doc.addPage(); 
          y = printHeaderAndFooter();
          
          doc.setFillColor(26, 58, 42); 
          doc.rect(margin, y, pageWidth - (margin * 2), 12, 'F');
          doc.text(titleText, pageWidth / 2, y + 8, { align: "center", charSpace: 1 });
          y += 20;
        }

        doc.setFillColor(245, 248, 246); 
        doc.rect(margin, y - 6, pageWidth - (margin * 2), 12, 'F');
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 58, 42);
        doc.text(`${meal.mealName.toUpperCase()} - ${meal.time}`, margin + 3, y + 1);
        
        const macroX = pageWidth - margin - 70;
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`${Math.round(meal.kcal || 0)} kcal | P: ${Math.round(meal.macros?.p || 0)}g | C: ${Math.round(meal.macros?.c || 0)}g | G: ${Math.round(meal.macros?.g || 0)}g`, macroX, y + 1);
        
        y += 12;

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        
        const maxWidth = pageWidth - (margin * 2);
        const splitDesc = doc.splitTextToSize(meal.description, maxWidth);
        
        doc.text(splitDesc, margin + 3, y);
        
        y += (splitDesc.length * 5) + 6; 
      });
    });

    doc.save(`Plano_Alimentar_${profile?.full_name?.split(' ')[0] || 'Paciente'}.pdf`);
  };

  // =========================================================================
  // RENDER PRINCIPAL
  // =========================================================================
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 flex-col gap-4">
      <Loader2 className="animate-spin text-nutri-800" size={48} />
      <p className="text-stone-400 font-bold animate-pulse text-xs uppercase tracking-widest">Carregando seu protocolo...</p>
    </div>
  );

  const hasAnyPlan = (mealPlanJSON && mealPlanJSON.length > 0) || !!planoPDF;
  const finalPdfUrl = typeof planoPDF === 'string' 
    ? planoPDF 
    : (planoPDF?.publicUrl || planoPDF?.file_url || planoPDF?.meal_plan_pdf_url || '#');
    
  const selectedContextualGroup = SUBSTITUICOES_PADRAO.find(g => g.categoria === contextualCategory);

  return (
    <main className="min-h-screen bg-stone-50 md:bg-stone-100 p-4 md:p-8 lg:p-12 font-sans text-stone-800 flex flex-col pt-24 md:pt-32 relative selection:bg-nutri-200 selection:text-nutri-900">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        
        <nav className="flex items-center justify-between mb-8 mt-4 md:mt-10 animate-fade-in-up">
          <Link href="/dashboard" className="flex items-center gap-2 text-stone-500 hover:text-nutri-900 transition-colors font-bold text-sm bg-white px-5 py-2.5 rounded-[1.5rem] border border-stone-200 shadow-sm hover:shadow-md active:scale-95">
            <ChevronLeft size={18} /> Voltar ao Painel
          </Link>
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-[1.5rem] border border-stone-200 shadow-sm">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">Acompanhamento Ativo</span>
          </div>
        </nav>

        {!canAccess ? (
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 text-center animate-fade-in-up">
            <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="text-stone-300" size={32} />
            </div>
            <h1 className="text-2xl font-black text-stone-900 mb-4 tracking-tight">Protocolo Restrito</h1>
            <p className="text-stone-500 text-sm mb-10 leading-relaxed max-w-sm mx-auto">Seu planejamento estratégico está pronto. Desbloqueie para acessar metas, acompanhamento diário e substituições inteligentes.</p>
            
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => handleUpgradeClick('premium')} 
                disabled={!!processingCheckout} 
                className="w-full bg-gradient-to-r from-nutri-900 to-nutri-800 text-white p-5 rounded-2xl font-bold flex flex-col items-center gap-1 hover:shadow-lg transition-all active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Star size={18} fill="currentColor" className="text-amber-400"/> Acesso Premium Completo
                </span>
                <span className="text-xs font-medium opacity-80">Desbloqueia App + Inteligência por R${prices.premium.toFixed(2)}</span>
              </button>
              
              <button 
                onClick={() => handleUpgradeClick('meal_plan')} 
                disabled={!!processingCheckout} 
                className="w-full bg-white border-2 border-stone-100 text-stone-500 p-5 rounded-2xl font-bold hover:border-nutri-800 hover:text-nutri-800 transition-all active:scale-[0.98]"
              >
                Apenas Protocolo Interativo (R${prices.mealPlan.toFixed(2)})
              </button>
            </div>
            
            <div className="mt-8 pt-8 border-t border-stone-100 text-left">
              <p className="text-[10px] uppercase font-black tracking-widest text-stone-400 mb-4">O que você recebe:</p>
              <ul className="text-sm text-stone-500 space-y-3 font-medium">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500"/> Cardápio flexível e adaptável</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500"/> Lista de mercado automática</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500"/> Acompanhamento diário de metas</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-24">
            
            <div className="bg-gradient-to-br from-nutri-900 via-nutri-800 to-stone-900 rounded-[2.5rem] p-8 md:p-10 shadow-[0_15px_40px_rgba(26,58,42,0.15)] text-white relative overflow-hidden animate-fade-in-up">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-[0.03] rounded-full blur-3xl -mr-20 -mt-20"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-nutri-200 mb-3 opacity-80">Estratégia Diária</p>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none mb-2">
                    {profile?.full_name?.split(' ')[0] || 'Paciente'}
                  </h1>
                  <p className="text-sm font-medium text-nutri-100 opacity-90 max-w-sm">
                    {profile?.goal || 'Protocolo de otimização metabólica e reeducação alimentar.'}
                  </p>
                </div>

                <div className={`bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center gap-4 shrink-0`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner ${currentLevel.bg}`}>
                    {currentLevel.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-nutri-200 opacity-80">Nível Atual</p>
                    <p className="font-bold text-lg leading-tight">{currentLevel.label}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 relative z-10">
                <div className="flex justify-between items-end mb-2">
                  <span className="font-bold text-sm text-nutri-100">Progresso de Hoje</span>
                  <span className="font-black text-2xl tracking-tighter">{adherencePercent}%</span>
                </div>
                <div className="h-3 bg-black/20 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out relative ${currentLevel.bg}`} 
                    style={{ width: `${adherencePercent}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>

            {hasAnyPlan && insights.length > 0 && (
              <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                {insights.map((insight, idx) => (
                  <div key={idx} className={`${insight.bg} border border-white/50 p-4 rounded-2xl flex items-start gap-3 shadow-sm`}>
                    <div className="mt-0.5">{insight.icon}</div>
                    <p className={`text-sm font-bold ${insight.textCol} leading-snug`}>{insight.text}</p>
                  </div>
                ))}
              </div>
            )}

            {hasAnyPlan && filterTabs.length > 0 && (
              <>
                <section className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <MacroCard 
                    totalKcal={macros.totalKcal} 
                    totalProtein={macros.totalProtein} 
                    totalCarbs={macros.totalCarbs} 
                    totalFat={macros.totalFat}
                    consumedKcal={consumedStats.kcal} 
                    consumedProtein={consumedStats.p} 
                    consumedCarbs={consumedStats.c} 
                    consumedFat={consumedStats.g}
                    macrosPorRefeicao={macros.macrosPorRefeicao}
                  />
                </section>

                <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-500/30">
                        <Droplets size={24} fill="currentColor" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-0.5">Hidratação Estratégica</p>
                        <h3 className="font-black text-stone-900 text-2xl leading-none">
                          {waterCount * 250} <span className="text-sm text-stone-400">ml consumidos</span>
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-stone-50 p-2 rounded-2xl border border-stone-100">
                      <button 
                        onClick={() => updateWater(-1)} 
                        className="w-12 h-12 rounded-xl bg-white border border-stone-200 text-stone-400 flex items-center justify-center font-bold hover:bg-stone-100 hover:text-stone-600 transition-colors shadow-sm active:scale-95"
                      >
                        <Minus size={20} />
                      </button>
                      <div className="flex flex-col items-center justify-center px-2">
                        <span className="text-xs font-black text-stone-800">{waterCount}</span>
                        <span className="text-[10px] font-bold text-stone-400 uppercase">Copos</span>
                      </div>
                      <button 
                        onClick={() => updateWater(1)} 
                        className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 active:scale-95"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide pb-2 pt-2 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                  <button
                    onClick={() => setSelectedDayFilter('Todos')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                      selectedDayFilter === 'Todos' 
                        ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20' 
                        : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Filter size={16} /> Visão Geral
                  </button>
                  
                  {filterTabs.map(day => (
                    <button
                      key={day}
                      onClick={() => setSelectedDayFilter(day)}
                      className={`px-6 py-3 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                        selectedDayFilter === day 
                          ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20' 
                          : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </>
            )}

            {!hasAnyPlan ? (
              <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-stone-100 text-center animate-fade-in-up">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Utensils className="text-stone-300" size={24} />
                </div>
                <h3 className="font-bold text-stone-900">Protocolo em Elaboração</h3>
                <p className="text-stone-500 text-sm mt-2">Nossa equipe de nutrição está montando sua estratégia personalizada. Avisaremos em breve!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                  <button 
                    onClick={() => {
                      if (planoPDF && finalPdfUrl !== '#') {
                        window.open(finalPdfUrl, '_blank');
                      } else {
                        handleGenerateDynamicPDF();
                      }
                    }}
                    className="w-full text-left bg-white p-5 rounded-[2rem] border border-stone-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-stone-200 transition-all group active:scale-[0.98] flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start w-full mb-4">
                      <div className="bg-stone-50 p-3 rounded-2xl text-stone-700 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                        <FileText size={20} />
                      </div>
                      <div className="text-stone-300 group-hover:text-stone-900 transition-colors">
                        <Download size={18} />
                      </div>
                    </div>
                    <div>
                      <p className="font-black text-stone-800 text-base mb-1 tracking-tight">Baixar Protocolo</p>
                      <p className="text-xs text-stone-500 font-medium">Versão em PDF</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setIsMarketModalOpen(true)}
                    className="w-full text-left bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 rounded-[2rem] shadow-lg shadow-emerald-700/20 hover:shadow-xl hover:shadow-emerald-700/30 transition-all group active:scale-[0.98] flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start w-full mb-4">
                      <div className="bg-white/20 p-3 rounded-2xl text-white backdrop-blur-sm">
                        <ShoppingCart size={20} />
                      </div>
                      <div className="text-emerald-200 group-hover:translate-x-1 transition-transform">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                    <div>
                      <p className="font-black text-white text-base mb-1 tracking-tight">Compras Inteligentes</p>
                      <p className="text-xs text-emerald-100 font-medium">Lista automática gerada</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setIsSubstitutionsModalOpen(true)}
                    className="w-full text-left bg-gradient-to-br from-orange-500 to-orange-600 text-white p-5 rounded-[2rem] shadow-lg shadow-orange-600/20 hover:shadow-xl hover:shadow-orange-600/30 transition-all group active:scale-[0.98] flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start w-full mb-4">
                      <div className="bg-white/20 p-3 rounded-2xl text-white backdrop-blur-sm">
                        <ArrowLeftRight size={20} />
                      </div>
                      <div className="text-orange-200 group-hover:translate-x-1 transition-transform">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                    <div>
                      <p className="font-black text-white text-base mb-1 tracking-tight">Substituições</p>
                      <p className="text-xs text-orange-100 font-medium">Trocas estratégicas</p>
                    </div>
                  </button>
                </div>

                {filteredMeals && filteredMeals.length > 0 && (
                  <div className="relative pl-6 sm:pl-8 ml-2 sm:ml-4 border-l-2 border-stone-200/60 space-y-8 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                    {filteredMeals.map((refeicao: any) => {
                      const isCompleted = completedMeals.includes(refeicao.name);
                      const option = refeicao.options?.[0] ?? null;

                      return (
                        <div key={refeicao.id || `${refeicao.name}-${refeicao.time}`} className="relative group">
                          <button 
                            onClick={() => toggleMealCompletion(refeicao.name)}
                            className={`absolute -left-[45px] sm:-left-[53px] top-6 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-4 border-stone-50 transition-all duration-300 z-10 
                              ${isCompleted 
                                ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110' 
                                : 'bg-white text-stone-300 hover:text-nutri-600 hover:border-nutri-100 shadow-sm'}`}
                          >
                            {isCompleted ? <CheckCheck size={20} /> : <Circle size={20} />}
                          </button>

                          <div className={`bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border transition-all duration-500 overflow-hidden ${isCompleted ? 'border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30' : 'border-stone-100 hover:border-stone-200'}`}>
                            <div className="p-6 sm:p-8">
                              
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-stone-50 pb-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Clock size={12} className={isCompleted ? "text-emerald-500" : "text-stone-400"} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-600' : 'text-stone-500'}`}>
                                      {refeicao.time}
                                    </span>
                                  </div>
                                  <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${isCompleted ? 'text-emerald-900 line-through opacity-80' : 'text-stone-900'}`}>
                                    {refeicao.name}
                                  </h3>
                                </div>
                                
                                {option && (
                                  <div className="flex gap-1.5 flex-wrap">
                                    {option.kcal > 0 && (
                                      <span className="bg-stone-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide shadow-sm">
                                        ~{option.kcal} kcal
                                      </span>
                                    )}
                                    {option.macros && (
                                      <>
                                        <span className="bg-stone-50 border border-stone-100 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">
                                          P: {option.macros.p}g
                                        </span>
                                        <span className="bg-stone-50 border border-stone-100 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">
                                          C: {option.macros.c}g
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>

                              {!isCompleted && (
                                <div className="space-y-4">
                                  {refeicao.options.map((opcao: any, oIdx: number) => (
                                    <div key={opcao.id || oIdx} className="bg-stone-50/50 p-5 rounded-2xl border border-stone-100/50 relative">
                                      
                                      {opcao.day && opcao.day.toLowerCase() !== 'todos os dias' && (
                                        <span className="inline-block text-[9px] bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-md font-black uppercase tracking-widest shadow-sm mb-3">
                                          {opcao.day}
                                        </span>
                                      )}
                                      
                                      <div className="text-stone-700 leading-relaxed text-sm md:text-base font-medium whitespace-pre-wrap">
                                        {opcao.foodItems && Array.isArray(opcao.foodItems) && opcao.foodItems.length > 0 ? (
                                          <ul className="space-y-2">
                                            {opcao.foodItems.map((food: any, fIdx: number) => (
                                              <li key={fIdx} className="flex items-start gap-2">
                                                <span className="text-nutri-500 mt-1 flex-shrink-0"><Activity size={14}/></span>
                                                <span>
                                                  {renderDescriptionWithTooltips(food.name, setContextualCategory)} 
                                                  {food.kcal ? <span className="text-stone-400 text-xs ml-1 font-normal">({food.kcal} kcal)</span> : ''}
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p>{renderDescriptionWithTooltips(buildDescriptionFromFoods(opcao), setContextualCategory)}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {isCompleted && (
                                <p className="text-sm font-bold text-emerald-600 flex items-center gap-2">
                                  <CheckCircle2 size={16}/> Concluído com sucesso!
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {filteredMeals && filteredMeals.length === 0 && selectedDayFilter !== 'Todos' && (
                   <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 text-center">
                     <p className="text-stone-500 font-medium">Nenhuma refeição específica configurada para <b>{selectedDayFilter}</b>.</p>
                     <button onClick={() => setSelectedDayFilter('Todos')} className="mt-4 text-nutri-800 font-bold text-sm hover:underline">
                       Ver cardápio completo
                     </button>
                   </div>
                )}

                <div className="bg-stone-900 p-6 sm:p-8 rounded-[2.5rem] text-white flex flex-col sm:flex-row gap-5 items-start sm:items-center shadow-xl mt-12 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
                  <div className="bg-white/10 p-4 rounded-2xl shrink-0"><Zap size={24} className="text-amber-400" /></div>
                  <div>
                    <p className="font-black text-lg mb-1 tracking-tight">O segredo é a constância</p>
                    <p className="text-sm text-stone-400 leading-relaxed max-w-lg">Clique nas palavras <span className="text-orange-400 font-bold underline decoration-dashed">destacadas em laranja</span> no seu protocolo para ver opções de substituição sem furar a dieta.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL DA LISTA DE MERCADO */}
      {isMarketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-md p-0 sm:p-4 md:p-8 animate-fade-in">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] md:max-h-[90vh]">
            
            <div className="p-6 md:p-8 bg-emerald-700 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><ShoppingCart size={24} /></div>
                <div>
                  <h3 className="font-black text-2xl tracking-tight leading-tight">Compras da Semana</h3>
                  <p className="text-xs text-emerald-100 font-medium opacity-90">Calculado automaticamente</p>
                </div>
              </div>
              <button onClick={() => setIsMarketModalOpen(false)} className="bg-black/10 hover:bg-black/20 p-2.5 rounded-full transition-colors relative z-10"><X size={20} /></button>
            </div>

            <div className="bg-stone-50 border-b border-stone-200 p-5">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-2"><CalendarDays size={14} /> Selecione o Período</label>
              <div className="flex bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm p-1">
                {[
                  { label: 'Dia', val: 1 }, 
                  { label: '7 Dias', val: 7 }, 
                  { label: '15 Dias', val: 15 }, 
                  { label: 'Mês', val: 30 }
                ].map(tab => (
                  <button key={tab.val} onClick={() => setMarketMultiplier(tab.val)} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${marketMultiplier === tab.val ? 'bg-emerald-700 text-white shadow-md' : 'text-stone-500 hover:bg-stone-50'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto bg-white flex-1 space-y-8">
              {marketList.measured.length === 0 && marketList.others.length === 0 ? (
                <div className="text-center py-10 text-stone-400 flex flex-col items-center gap-3">
                  <ShoppingCart size={40} className="opacity-20"/>
                  <p className="font-medium">Nenhum item quantificável encontrado no protocolo.</p>
                </div>
              ) : (
                <>
                  {marketList.measured.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-stone-400 tracking-widest mb-4 flex items-center gap-2"><Activity size={14}/> Itens com Medida Exata</h4>
                      <ul className="space-y-3">
                        {marketList.measured.map((item, i) => (
                          <li key={i} className="flex justify-between items-center bg-stone-50 p-3 rounded-2xl border border-stone-100">
                            <span className="font-bold text-stone-700 text-sm">{item.name}</span>
                            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg text-xs font-black shadow-sm">{Number.isInteger(item.qty) ? item.qty : parseFloat(item.qty.toFixed(2))} {item.unit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {marketList.others.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-stone-400 tracking-widest mb-4 flex items-center gap-2"><Target size={14}/> Consumo Livre / Outros</h4>
                      <ul className="space-y-2 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                        {marketList.others.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-stone-600 font-medium"><span className="text-emerald-500 mt-0.5">•</span> {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {(marketList.measured.length > 0 || marketList.others.length > 0) && (
              <div className="p-5 border-t border-stone-100 bg-white flex gap-3 pb-8 sm:pb-5">
                <button onClick={handleShareWhatsApp} className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white py-4 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#25D366]/20 active:scale-[0.98]">
                  <WhatsAppIcon size={20} /><span>Enviar para WhatsApp</span>
                </button>
                <button onClick={handleCopyToClipboard} className={`px-6 rounded-2xl font-bold flex items-center justify-center transition-all border ${isCopied ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'}`} title="Copiar lista">
                  {isCopied ? <CheckCheck size={20} /> : <Copy size={20} />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DA LISTA GERAL DE SUBSTITUIÇÕES */}
      {isSubstitutionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-md p-0 sm:p-4 md:p-8 animate-fade-in">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[90vh]">
            
            <div className="p-6 md:p-8 bg-orange-600 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><ArrowLeftRight size={24} /></div>
                <div>
                  <h3 className="font-black text-2xl tracking-tight leading-tight">Substituições</h3>
                  <p className="text-xs text-orange-100 font-medium opacity-90">Troque alimentos de forma inteligente</p>
                </div>
              </div>
              <button onClick={() => setIsSubstitutionsModalOpen(false)} className="bg-black/10 hover:bg-black/20 p-2.5 rounded-full transition-colors relative z-10"><X size={20} /></button>
            </div>

            <div className="bg-orange-50 p-4 border-b border-orange-100">
              <p className="text-xs text-orange-800 font-bold text-center flex items-center justify-center gap-2"><Info size={16} /> Alimentos do mesmo bloco são nutricionalmente equivalentes.</p>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto bg-stone-50 flex-1 space-y-8">
              {SUBSTITUICOES_PADRAO.map((grupo, gIndex) => (
                <div key={gIndex} className="bg-white border border-stone-200/60 rounded-[2rem] p-5 shadow-sm">
                  <div className="mb-5 border-b border-stone-50 pb-4">
                    <h4 className="text-lg font-black text-stone-800 flex items-center gap-2 tracking-tight"><Flame size={20} className="text-orange-500" /> {grupo.categoria}</h4>
                    {grupo.referencia && <p className="text-[11px] text-stone-400 font-bold uppercase tracking-widest mt-2">{grupo.referencia.descricao}</p>}
                  </div>
                  
                  <ul className="space-y-3">
                    {grupo.itens.map((item, iIndex) => (
                      <li key={iIndex} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:border-orange-200 transition-colors">
                        <div className="flex flex-col">
                          <span className="font-bold text-stone-800 text-sm">{item.nome}</span>
                          <span className="text-orange-600 font-black text-xs mt-1">{item.medida}</span>
                        </div>
                        {item.macros && (
                          <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                            <span className="bg-orange-100 text-orange-800 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide shadow-sm">{item.macros.kcal} kcal</span>
                            <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">C: {item.macros.carbo}g</span>
                            <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">P: {item.macros.proteina}g</span>
                            <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">G: {item.macros.gordura}g</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SUBSTITUIÇÃO CONTEXTUAL */}
      {contextualCategory && selectedContextualGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-md p-0 sm:p-4 md:p-8 animate-fade-in">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] md:max-h-[90vh] animate-slide-up">
            
            <div className="p-6 bg-stone-900 text-white flex justify-between items-center relative">
              <div className="flex items-center gap-4 relative z-10">
                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm"><Activity size={24} className="text-orange-400" /></div>
                <div>
                  <h3 className="font-black text-xl tracking-tight leading-tight">Troca Equivalente</h3>
                  <p className="text-xs text-stone-400 font-medium">Categoria: <span className="text-white font-bold">{selectedContextualGroup.categoria}</span></p>
                </div>
              </div>
              <button onClick={() => setContextualCategory(null)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-colors relative z-10"><X size={20} /></button>
            </div>

            <div className="bg-stone-50 border-b border-stone-200 p-4">
              <p className="text-xs text-stone-500 font-bold text-center flex items-center justify-center gap-2"><Info size={14}/> {selectedContextualGroup.referencia?.descricao || 'Esses itens se equivalem na dieta'}</p>
            </div>

            <div className="p-6 overflow-y-auto bg-white flex-1 space-y-3">
              {selectedContextualGroup.itens.map((item, iIndex) => (
                <div key={iIndex} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:border-orange-200 transition-colors">
                  <div className="flex flex-col">
                    <span className="font-bold text-stone-800 text-sm">{item.nome}</span>
                    <span className="text-orange-600 font-black text-xs mt-1">{item.medida}</span>
                  </div>
                  {item.macros && (
                    <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
                      <span className="bg-orange-100 text-orange-800 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide shadow-sm">{item.macros.kcal} kcal</span>
                      <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">C: {item.macros.carbo}g</span>
                      <span className="bg-white border border-stone-200 text-stone-600 px-2 py-1 rounded-lg text-[10px] font-bold">P: {item.macros.proteina}g</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-5 border-t border-stone-100 bg-white pb-8 sm:pb-5">
              <button onClick={() => setContextualCategory(null)} className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black tracking-wide hover:bg-stone-800 transition-colors shadow-lg active:scale-[0.98]">
                Entendido, voltar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}