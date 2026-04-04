'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Save, Utensils, Check, 
  ChevronDown, ChevronUp, 
  Copy, CheckCircle2, AlertCircle, CalendarRange, Loader2,
  Beef, Wheat, Droplet, Target, X, Clock, ChevronRight, Search
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// 🔥 IMPORTS DO DOMÍNIO DE NUTRIÇÃO
import { FoodRestriction } from '@/types/patient';
import { FOOD_REGISTRY, FoodEntity } from '@/lib/foodRegistry';

// 🔥 IMPORTS DO CORE DE RESTRIÇÕES (SINGLE SOURCE OF TRUTH)
import { 
  getRestrictionInfo, 
  getRestrictionsSummary,
  expandRestrictions,
  resolveRestriction
} from '@/lib/nutrition/restrictions';

// 🔥 ADAPTADOR (REGISTRY → UI)
function mapToFoodItem(food: FoodEntity): FoodItem {
  return {
    id: food.id,
    name: food.name,
    kcal: food.kcal,
    macros: {
      p: food.macros.p,
      c: food.macros.c,
      g: food.macros.g
    }
  };
}

// =========================================================================
// INTERFACES E TIPAGENS
// =========================================================================

interface TargetRecommendation {
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface DietBuilderProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
  targetRecommendation: TargetRecommendation | null;
  foodRestrictions?: FoodRestriction[]; 
}

interface FoodItem {
  id: string;
  name: string;
  kcal: number;
  macros: {
    p: number;
    c: number;
    g: number;
  };
}

export interface Option {
  id: string;
  day: string;
  foodItems: FoodItem[];
  kcal: number;
  macros: { 
    p: number;
    c: number;
    g: number;
  };
}

export interface Meal {
  id: string;
  time: string;
  name: string;
  options: Option[];
}

// =========================================================================
// COMPONENTE DE SELETOR DE HORÁRIO COMPACTO PREMIUM
// =========================================================================

interface TimeSelectorProps {
  value: string;
  onChange: (time: string) => void;
  mealType: string;
  className?: string;
}

function TimeSelector({ value, onChange, mealType, className = '' }: TimeSelectorProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customTime, setCustomTime] = useState('');
  
  const suggestedTimes = MEAL_TIMES[mealType] || ["08:00", "12:00", "19:00"];
  const hasSuggested = suggestedTimes.includes(value);
  
  const handleCustomTimeSubmit = () => {
    if (customTime && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(customTime)) {
      onChange(customTime);
      setShowCustomInput(false);
      setCustomTime('');
    } else if (customTime) {
      toast.error('Formato de horário inválido. Use HH:MM (ex: 14:30)');
    }
  };
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {suggestedTimes.slice(0, 4).map(time => (
          <button
            key={time}
            onClick={() => {
              onChange(time);
              setShowCustomInput(false);
            }}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all duration-300 active:scale-95 ${
              value === time && !showCustomInput
                ? 'bg-stone-800 text-white shadow-md shadow-stone-800/20'
                : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-800'
            }`}
          >
            {time}
          </button>
        ))}
        
        {!showCustomInput && (
          <button
            onClick={() => {
              setShowCustomInput(true);
              if (!hasSuggested) setCustomTime(value);
            }}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all duration-300 active:scale-95 ${
              !hasSuggested && value && !showCustomInput
                ? 'bg-stone-800 text-white shadow-md shadow-stone-800/20'
                : 'bg-stone-50 border border-stone-200 border-dashed text-stone-500 hover:border-stone-400 hover:text-stone-800'
            }`}
          >
            {!hasSuggested && value ? value : 'Outro'}
          </button>
        )}
      </div>
      
      {showCustomInput && (
        <div className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2">
          <div className="relative">
            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="HH:MM"
              value={customTime || (value && !hasSuggested ? value : '')}
              onChange={(e) => setCustomTime(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCustomTimeSubmit()}
              className="w-24 pl-8 pr-3 py-2 rounded-xl border border-stone-200 font-bold text-stone-800 outline-none focus:border-nutri-500 focus:ring-4 focus:ring-nutri-500/10 bg-white text-sm transition-all"
              autoFocus
            />
          </div>
          <button
            onClick={handleCustomTimeSubmit}
            className="px-4 py-2 bg-stone-800 text-white rounded-xl text-xs font-bold hover:bg-stone-700 transition-colors shadow-sm"
          >
            OK
          </button>
          <button
            onClick={() => {
              setShowCustomInput(false);
              setCustomTime('');
            }}
            className="px-3 py-2 bg-stone-100 text-stone-500 hover:text-stone-700 rounded-xl transition-colors"
            title="Cancelar"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 🧠 BANCO VISUAL CONECTADO AO DOMÍNIO (VIEW ADAPTER)
// =========================================================================

interface QuickFoodConfigItem {
  id: string; // 🔥 SSOT: Deve obrigatoriamente existir no FOOD_REGISTRY
  label: string; // Label visual apenas para UI (ex: com porções)
}

interface QuickFoodCategoryConfig {
  category: string;
  items: QuickFoodConfigItem[];
}

// A configuração agora é estática e declarativa, agindo apenas como mapeamento.
const QUICK_FOODS_CONFIG: QuickFoodCategoryConfig[] =[
  { 
    category: "🥩 Proteínas (Carnes e Ovos)", 
    items:[
      { id: "egg_scrambled", label: "Ovo mexido (2 un)" }, 
      { id: "egg_boiled", label: "Ovo cozido (2 un)" }, 
      { id: "egg_poached", label: "Ovo pochê (2 un)" },
      { id: "chicken_breast_grilled", label: "Frango grelhado (100g)" }, 
      { id: "chicken_shredded", label: "Frango desfiado (3 col)" }, 
      { id: "chicken_breast_roasted", label: "Peito de frango assado (100g)" },
      { id: "chicken_thigh_roasted", label: "Sobrecoxa frango assada (100g)" }, 
      { id: "beef_minced_lean", label: "Carne moída magra (100g)" }, 
      { id: "beef_minced_5", label: "Carne moída 5% (100g)" },
      { id: "filet_mignon", label: "Filé mignon grelhado (100g)" }, 
      { id: "striploin", label: "Contra-filé grelhado (100g)" }, 
      { id: "beef_knuckle_minced", label: "Patinho moído (100g)" },
      { id: "rump_steak", label: "Alcatra grelhada (100g)" }, 
      { id: "tri_tip", label: "Maminha assada (100g)" }, 
      { id: "fish_filet", label: "Filé de peixe (100g)" },
      { id: "salmon_grilled", label: "Salmão grelhado (100g)" }, 
      { id: "tuna_solid", label: "Atum sólido (1 lata)" }, 
      { id: "sardine_roasted", label: "Sardinha assada (100g)" },
      { id: "shrimp_grilled", label: "Camarão grelhado (100g)" }, 
      { id: "pork_loin_grilled", label: "Lombo de porco grelhado (100g)" }, 
      { id: "turkey_sliced", label: "Peru fatiado (3 fatias)" },
      { id: "hamburger_homemade", label: "Hambúrguer caseiro (100g)" }
    ] 
  },
  { 
    category: "🥛 Laticínios e Proteínas Vegetais", 
    items:[
      { id: "milk_whole", label: "Leite Integral (1 copo 200ml)" }, 
      { id: "milk_skim", label: "Leite Desnatado (1 copo 200ml)" }, 
      { id: "milk_lactose_free", label: "Leite Sem lactose (1 copo 200ml)" },
      { id: "almond_milk", label: "Leite de amêndoas (200ml)" }, 
      { id: "soy_milk", label: "Leite de soja (200ml)" }, 
      { id: "yogurt_natural", label: "Iogurte Natural (1 pote 170g)" },
      { id: "yogurt_greek", label: "Iogurte Grego (170g)" }, 
      { id: "yogurt_protein", label: "Iogurte Proteico (170g)" }, 
      { id: "kefir", label: "Kefir (200ml)" },
      { id: "cheese_minas", label: "Queijo Minas (1 fatia 30g)" }, 
      { id: "cheese_mozzarella", label: "Queijo Mussarela (2 fatias 30g)" }, 
      { id: "cheese_prato", label: "Queijo Prato (1 fatia 30g)" },
      { id: "cheese_cottage", label: "Queijo Cottage (2 col 50g)" }, 
      { id: "cheese_ricotta", label: "Queijo Ricota (2 col 50g)" }, 
      { id: "cheese_parmesan", label: "Queijo Parmesão (1 col 10g)" },
      { id: "tofu_grilled", label: "Tofu grelhado (100g)" }, 
      { id: "chickpeas_cooked", label: "Grão de bico cozido (3 col)" }, 
      { id: "lentils_cooked", label: "Lentilha cozida (3 col)" },
      { id: "peas_fresh", label: "Ervilha fresca (3 col)" }, 
      { id: "tempeh", label: "Tempeh (100g)" }, 
      { id: "seitan", label: "Seitan (100g)" }
    ] 
  },
  { 
    category: "🍚 Carboidratos (Grãos e Cereais)", 
    items:[
      { id: "rice_white_cooked", label: "Arroz branco cozido (100g)" }, 
      { id: "rice_brown_cooked", label: "Arroz integral cozido (100g)" }, 
      { id: "rice_parboiled", label: "Arroz parboilizado (100g)" },
      { id: "rice_7_grains", label: "Arroz 7 grãos (100g)" }, 
      { id: "pasta_whole", label: "Macarrão integral (100g)" }, 
      { id: "pasta_regular", label: "Macarrão comum (100g)" },
      { id: "pasta_rice", label: "Macarrão de arroz (100g)" }, 
      { id: "quinoa_cooked", label: "Quinoa cozida (100g)" }, 
      { id: "corn_couscous", label: "Cuscuz de milho (100g)" },
      { id: "corn_green", label: "Milho verde (3 col)" }, 
      { id: "oats_flakes", label: "Aveia em flocos (30g)" }, 
      { id: "granola_sugar_free", label: "Granola s/ açúcar (3 col)" },
      { id: "cereal_breakfast", label: "Cereal matinal (30g)" }, 
      { id: "bread_french", label: "Pão francês (1 un)" }, 
      { id: "bread_whole", label: "Pão integral (2 fatias)" },
      { id: "bread_white", label: "Pão de forma branco (2 fatias)" }, 
      { id: "cheese_bread", label: "Pão de queijo (1 un)" }, 
      { id: "tapioca", label: "Tapioca (3 col sopa 50g)" },
      { id: "crepioca", label: "Crepioca (1 un)" }, 
      { id: "pancake_whole", label: "Panqueca integral (1 un)" }
    ] 
  },
  { 
    category: "🥔 Tubérculos e Raízes", 
    items:[
      { id: "sweet_potato_cooked", label: "Batata doce cozida (100g)" }, 
      { id: "potato_cooked", label: "Batata inglesa cozida (150g)" }, 
      { id: "potato_roasted", label: "Batata assada (150g)" },
      { id: "potato_saute", label: "Batata sauté (150g)" }, 
      { id: "potato_mash", label: "Purê de batata (3 col)" }, 
      { id: "cassava_cooked", label: "Mandioca cozida (100g)" },
      { id: "cassava_fried", label: "Mandioca frita (100g)" }, 
      { id: "yam_cooked", label: "Inhame cozido (100g)" }, 
      { id: "cara_cooked", label: "Cará cozido (100g)" },
      { id: "arracacha_cooked", label: "Batata baroa (100g)" }
    ] 
  },
  { 
    category: "🍌 Frutas", 
    items:[
      { id: "banana_prata", label: "Banana prata (1 un)" }, 
      { id: "banana_nanica", label: "Banana nanica (1 un)" }, 
      { id: "banana_maca", label: "Banana maçã (1 un)" },
      { id: "apple", label: "Maçã (1 un média)" }, 
      { id: "apple_green", label: "Maçã verde (1 un)" }, 
      { id: "pear", label: "Pera (1 un)" },
      { id: "papaya", label: "Mamão (1 fatia média)" }, 
      { id: "orange", label: "Laranja (1 un)" }, 
      { id: "tangerine", label: "Mexerica (1 un)" },
      { id: "pineapple", label: "Abacaxi (1 fatia)" }, 
      { id: "watermelon", label: "Melancia (1 fatia)" }, 
      { id: "melon", label: "Melão (1 fatia)" },
      { id: "mango", label: "Manga (1 un pequena)" }, 
      { id: "strawberry", label: "Morango (10 un)" }, 
      { id: "grape", label: "Uva (15 un)" },
      { id: "kiwi", label: "Kiwi (1 un)" }, 
      { id: "avocado", label: "Abacate (2 col sopa)" }, 
      { id: "coconut_fresh", label: "Coco fresco (1 fatia)" },
      { id: "acai", label: "Açaí (100g s/ xarope)" }
    ] 
  },
  { 
    category: "🥬 Verduras e Legumes", 
    items:[
      { id: "salad_leaves", label: "Salada de folhas (à vontade)" }, 
      { id: "lettuce_iceberg", label: "Alface americana (5 folhas)" }, 
      { id: "arugula", label: "Rúcula (1 prato)" },
      { id: "spinach_sauteed", label: "Espinafre refogado (3 col)" }, 
      { id: "kale_sauteed", label: "Couve refogada (3 col)" }, 
      { id: "broccoli_cooked", label: "Brócolis cozido (3 ramos)" },
      { id: "cauliflower_cooked", label: "Couve-flor cozida (3 col)" }, 
      { id: "zucchini_sauteed", label: "Abobrinha refogada (3 col)" }, 
      { id: "eggplant_sauteed", label: "Berinjela refogada (3 col)" },
      { id: "chayote_sauteed", label: "Chuchu refogado (3 col)" }, 
      { id: "carrot_cooked", label: "Cenoura cozida (3 col)" }, 
      { id: "carrot_grated", label: "Cenoura ralada (3 col)" },
      { id: "beet_cooked", label: "Beterraba cozida (3 col)" }, 
      { id: "tomato", label: "Tomate (1 un)" }, 
      { id: "cucumber", label: "Pepino (1/2 un)" },
      { id: "bell_pepper", label: "Pimentão (1/2 un)" }, 
      { id: "green_beans", label: "Vagem cozida (3 col)" }, 
      { id: "asparagus_grilled", label: "Aspargo grelhado (5 un)" },
      { id: "heart_of_palm", label: "Palmito (3 talos)" }, 
      { id: "mushroom_sauteed", label: "Cogumelo refogado (3 col)" }
    ] 
  },
  { 
    category: "🍲 Leguminosas (Feijões e Grãos)", 
    items:[
      { id: "black_beans_broth", label: "Feijão preto caldo (1 concha)" }, 
      { id: "black_beans_grains", label: "Feijão preto grãos (1 escumadeira)" }, 
      { id: "pinto_beans_broth", label: "Feijão carioca caldo (1 concha)" },
      { id: "white_beans", label: "Feijão branco (3 col)" }, 
      { id: "black_eyed_peas", label: "Feijão fradinho (3 col)" }, 
      { id: "lentils_cooked", label: "Lentilha (1 escumadeira)" },
      { id: "chickpeas_cooked", label: "Grão de bico (3 col)" }, 
      { id: "peas_fresh", label: "Ervilha fresca (3 col)" }, 
      { id: "soybeans_cooked", label: "Soja cozida (3 col)" },
      { id: "edamame", label: "Edamame (100g)" }
    ] 
  },
  { 
    category: "🧈 Gorduras e Óleos", 
    items:[
      { id: "olive_oil", label: "Azeite de oliva (1 col sopa)" }, 
      { id: "coconut_oil", label: "Óleo de coco (1 col sopa)" }, 
      { id: "sesame_oil", label: "Óleo de gergelim (1 col sopa)" },
      { id: "butter", label: "Manteiga (1 col chá 10g)" }, 
      { id: "ghee_butter", label: "Manteiga ghee (1 col chá)" }, 
      { id: "peanut_butter", label: "Pasta de amendoim (1 col sopa)" },
      { id: "peanut_butter_whole", label: "Pasta de amendoim integral (1 col)" }, 
      { id: "cashew_butter", label: "Pasta de castanha (1 col sopa)" }, 
      { id: "almond_butter", label: "Pasta de amêndoas (1 col sopa)" },
      { id: "cream_cheese_light", label: "Requeijão light (1 col sopa)" }, 
      { id: "cream_cheese", label: "Requeijão cremoso (1 col sopa)" }, 
      { id: "heavy_cream_light", label: "Creme de leite light (1 col sopa)" },
      { id: "mayonnaise", label: "Maionese (1 col sopa)" }, 
      { id: "mayonnaise_light", label: "Maionese light (1 col sopa)" }
    ] 
  },
  { 
    category: "🥜 Oleaginosas e Sementes", 
    items:[
      { id: "brazil_nut", label: "Castanha do Pará (3 un)" }, 
      { id: "cashew_nut", label: "Castanha de caju (10 un)" }, 
      { id: "almonds", label: "Amêndoas (10 un)" },
      { id: "walnuts", label: "Nozes (3 un)" }, 
      { id: "macadamia", label: "Macadâmia (5 un)" }, 
      { id: "pistachio", label: "Pistache (15 un)" },
      { id: "peanut_roasted", label: "Amendoim torrado (30g)" }, 
      { id: "mixed_nuts", label: "Mix de castanhas (30g)" }, 
      { id: "pumpkin_seed", label: "Semente de abóbora (1 col sopa)" },
      { id: "sunflower_seed", label: "Semente de girassol (1 col sopa)" }, 
      { id: "chia_seed", label: "Chia (1 col sopa)" }, 
      { id: "flaxseed_golden", label: "Linhaça dourada (1 col sopa)" },
      { id: "flaxseed_brown", label: "Linhaça marrom (1 col sopa)" }, 
      { id: "sesame_seed", label: "Gergelim (1 col sopa)" }, 
      { id: "coconut_grated_dry", label: "Coco ralado seco (1 col sopa)" },
      { id: "coconut_grated_fresh", label: "Coco ralado fresco (1 col sopa)" }
    ] 
  },
  { 
    category: "🥤 Bebidas e Suplementos", 
    items:[
      { id: "whey_protein", label: "Whey Protein (1 scoop 30g)" }, 
      { id: "whey_isolate", label: "Whey Isolado (1 scoop)" }, 
      { id: "whey_vegan", label: "Whey Vegano (1 scoop)" },
      { id: "albumin", label: "Albumina (1 scoop)" }, 
      { id: "casein", label: "Caseína (1 scoop)" }, 
      { id: "creatine", label: "Creatina (5g)" },
      { id: "bcaa", label: "BCAA (5g)" }, 
      { id: "glutamine", label: "Glutamina (5g)" }, 
      { id: "coffee_black", label: "Café preto (1 xícara)" },
      { id: "coffee_milk", label: "Café com leite (1 xícara)" }, 
      { id: "coffee_plant_milk", label: "Café com leite vegetal (1 xíc)" }, 
      { id: "green_tea", label: "Chá verde (1 xícara)" },
      { id: "mate_tea", label: "Chá mate (1 xícara)" }, 
      { id: "chamomile_tea", label: "Chá de camomila (1 xícara)" }, 
      { id: "orange_juice", label: "Suco de laranja natural (1 copo)" },
      { id: "lemon_juice", label: "Suco de limão (1 copo)" }, 
      { id: "green_juice", label: "Suco verde (1 copo 300ml)" }, 
      { id: "coconut_water", label: "Água de coco (300ml)" },
      { id: "beer", label: "Cerveja (1 lata 350ml)" }, 
      { id: "wine_red", label: "Vinho tinto (1 taça 150ml)" }, 
      { id: "wine_white", label: "Vinho branco (1 taça 150ml)" },
      { id: "distilled_spirits", label: "Destilados (1 dose 50ml)" }
    ] 
  },
  { 
    category: "🍰 Doces e Extras", 
    items:[
      { id: "honey", label: "Mel (1 col sopa)" }, 
      { id: "demerara_sugar", label: "Açúcar demerara (1 col chá)" }, 
      { id: "coconut_sugar", label: "Açúcar de coco (1 col chá)" },
      { id: "stevia", label: "Stévia (líquido)" }, 
      { id: "xylitol", label: "Xilitol (1 col chá)" }, 
      { id: "erythritol", label: "Eritritol (1 col chá)" },
      { id: "diet_fruit_jelly", label: "Geleia de fruta diet (1 col sopa)" }, 
      { id: "dulce_de_leche", label: "Doce de leite (1 col sopa)" }, 
      { id: "nutella", label: "Nutella (1 col sopa)" },
      { id: "chocolate_70", label: "Chocolate 70% (1 quadrado)" }, 
      { id: "chocolate_white", label: "Chocolate branco (1 quadrado)" }, 
      { id: "brigadeiro", label: "Brigadeiro (1 un)" },
      { id: "beijinho", label: "Beijinho (1 un)" }, 
      { id: "ice_cream_vanilla", label: "Sorvete de creme (1 bola)" }, 
      { id: "ice_cream_diet", label: "Sorvete diet (1 bola)" },
      { id: "fruit_popsicle", label: "Picolé de fruta (1 un)" }, 
      { id: "cake_plain", label: "Bolo simples (1 fatia)" }, 
      { id: "cake_whole", label: "Bolo integral (1 fatia)" },
      { id: "cookie", label: "Cookie (1 un)" }, 
      { id: "brownie", label: "Brownie (1 un)" }, 
      { id: "pancake_sweet", label: "Panqueca doce (1 un)" },
      { id: "waffle", label: "Waffle (1 un)" }
    ] 
  }
];

// 🔥 GERADOR DINÂMICO 10/10: Filtra a configuração estática validando contra a SSOT
// Isso garante que NENHUM alimento quebre a UI se for removido/alterado no banco.
const quickFoods: QuickFoodCategoryConfig[] = QUICK_FOODS_CONFIG.map(cat => {
  const validItems = cat.items.filter(uiItem => {
    const exists = FOOD_REGISTRY.some(f => f.id === uiItem.id);
    if (!exists) console.warn(`[DietBuilder UI Warning] Alimento não encontrado no Registry: ${uiItem.id}`);
    return exists;
  });
  return { ...cat, items: validItems };
}).filter(cat => cat.items.length > 0);

const MEAL_TYPES =[
  "Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", 
  "Jantar", "Ceia", "Pré-treino", "Pós-treino", "Refeição Livre"
];

const MEAL_TIMES: Record<string, string[]> = {
  "Café da Manhã": ["07:00", "07:30", "08:00", "08:30"],
  "Lanche da Manhã": ["09:30", "10:00", "10:30"],
  "Almoço": ["11:30", "12:00", "12:30", "13:00"],
  "Lanche da Tarde": ["15:00", "15:30", "16:00"],
  "Jantar": ["18:30", "19:00", "19:30", "20:00"],
  "Ceia": ["21:00", "21:30", "22:00"],
  "Pré-treino": ["Antes do treino", "06:00", "07:00", "16:00"],
  "Pós-treino": ["Após o treino", "08:00", "09:00", "18:00"],
  "Refeição Livre": ["Quando desejar", "12:00", "19:00"]
};

const SINGLE_DAYS =["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const GROUP_DAYS = ["Todos os dias", "Segunda a Sexta", "Finais de Semana"];
const ALL_DAYS = [...GROUP_DAYS, ...SINGLE_DAYS];

// =========================================================================
// FUNÇÕES DE FEEDBACK VISUAL (HUD)
// =========================================================================
const getMetricFeedback = (current: number, target: number, isKcal = false) => {
  if (!target) return { statusText: "Sem Meta", statusColorClass: "text-stone-400", barColorClass: "bg-stone-200" };
  
  const ratio = current / target;
  let statusColorClass = "text-emerald-500";
  let barColorClass = "bg-gradient-to-r from-emerald-400 to-emerald-500";
  let statusText = "Na Meta ✓";

  if (ratio < 0.90) {
    statusColorClass = "text-amber-500";
    barColorClass = "bg-gradient-to-r from-amber-300 to-amber-400";
    statusText = `Falta ${Math.round(target - current)}${isKcal ? '' : 'g'}`;
  } else if (ratio > 1.10) {
    statusColorClass = "text-rose-500";
    barColorClass = "bg-gradient-to-r from-rose-400 to-rose-500";
    statusText = `Passou ${Math.round(current - target)}${isKcal ? '' : 'g'}`;
  }

  return { statusText, statusColorClass, barColorClass };
};

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function DietBuilder({ patientId, patientName, targetRecommendation, onClose, foodRestrictions = [] }: DietBuilderProps) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  // 🔥 ESTADO DA BUSCA VIVA NO REGISTRY
  const [searchTerm, setSearchTerm] = useState('');

  const supabase = createClient();

  // 🔥 SSOT: PROCESSAMENTO DOS ALIMENTOS BLOQUEADOS VIA DOMÍNIO (O(1) Lookup)
  const blockedFoodIds = expandRestrictions(foodRestrictions);
  
  // 🔥 RESUMO DAS RESTRIÇÕES PARA ALERTA GLOBAL
  const restrictionsSummary = getRestrictionsSummary(foodRestrictions);

  // =========================================================================
  // FUNÇÕES DE MIGRAÇÃO
  // =========================================================================
  const migrateExistingOption = (option: any): Option => {
    if (option.foodItems && Array.isArray(option.foodItems)) return option;
    
    if (option.description && typeof option.description === 'string') {
      const lines = option.description.split('\n').filter((line: string) => line.trim().startsWith('- ') || line.trim().startsWith('+ '));
      const foodItems: FoodItem[] = lines.map((line: string, idx: number) => ({
        id: `food-${Date.now()}-${idx}-${Math.random()}`,
        name: line.replace(/^[-+]\s*/, '').trim(),
        kcal: 0,
        macros: { p: 0, c: 0, g: 0 }
      }));
      
      if (foodItems.length === 0 && option.description.trim()) {
        foodItems.push({
          id: `food-${Date.now()}-${Math.random()}`,
          name: option.description,
          kcal: option.kcal || 0,
          macros: option.macros || { p: 0, c: 0, g: 0 }
        });
      }
      return {
        id: option.id, day: option.day || "Todos os dias", foodItems,
        kcal: option.kcal || 0, macros: option.macros || { p: 0, c: 0, g: 0 }
      };
    }
    return {
      id: option.id, day: option.day || "Todos os dias", foodItems: [],
      kcal: option.kcal || 0, macros: option.macros || { p: 0, c: 0, g: 0 }
    };
  };

  // =========================================================================
  // MANIPULAÇÃO DE DADOS (COM TRAVA DE SEGURANÇA BLINDADA)
  // =========================================================================
  
  // 🛡️ NOVO addFoodItem BLINDADO: Só aceita ID do FOOD_REGISTRY
  const addFoodItem = (mealId: string, optId: string, foodId: string) => {
    // 1. Busca sempre na Fonte da Verdade (Registry)
    const registryFood = FOOD_REGISTRY.find(f => f.id === foodId);

    if (!registryFood) {
      toast.error("Erro estrutural: Alimento não encontrado no banco de dados.");
      return;
    }

    // 2. Trava de Segurança Absoluta (Ignora UI e valida direto no Set do domínio)
    if (blockedFoodIds.has(registryFood.id)) {
      const restrictionType = resolveRestriction(registryFood.id, foodRestrictions);
      if (restrictionType === 'allergy') {
        toast.error(`❌ Bloqueado: Risco de alergia grave ao adicionar ${registryFood.name}.`);
      } else {
        toast.error(`❌ Bloqueado: ${registryFood.name} fere uma restrição clínica.`);
      }
      return;
    }

    // 3. Converte para o padrão da UI e insere
    const mappedFood = mapToFoodItem(registryFood);

    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id === optId) {
            const updatedFoodItems = [...(o.foodItems || []), mappedFood];
            const newKcal = updatedFoodItems.reduce((sum, item) => sum + item.kcal, 0);
            const newMacros = updatedFoodItems.reduce((acc, item) => ({
              p: acc.p + item.macros.p, c: acc.c + item.macros.c, g: acc.g + item.macros.g
            }), { p: 0, c: 0, g: 0 });
            return { ...o, foodItems: updatedFoodItems, kcal: newKcal, macros: newMacros };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  const removeFoodItem = (mealId: string, optId: string, foodItemId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id === optId) {
            const itemToRemove = o.foodItems?.find(item => item.id === foodItemId);
            if (!itemToRemove) return o;
            const updatedFoodItems = o.foodItems.filter(item => item.id !== foodItemId);
            const newKcal = Math.max(0, (o.kcal || 0) - itemToRemove.kcal);
            const newMacros = {
              p: Math.max(0, (o.macros?.p || 0) - itemToRemove.macros.p),
              c: Math.max(0, (o.macros?.c || 0) - itemToRemove.macros.c),
              g: Math.max(0, (o.macros?.g || 0) - itemToRemove.macros.g)
            };
            return { ...o, foodItems: updatedFoodItems, kcal: newKcal, macros: newMacros };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  const addMeal = () => {
    let nextMealName = MEAL_TYPES[0];
    if (meals.length > 0) {
      const lastMealName = meals[meals.length - 1].name;
      const lastIndex = MEAL_TYPES.indexOf(lastMealName);
      if (lastIndex >= 0 && lastIndex < MEAL_TYPES.length - 1) {
        nextMealName = MEAL_TYPES[lastIndex + 1];
      }
    }
    const newMeal: Meal = { 
      id: `meal-${Date.now()}`, 
      time: MEAL_TIMES[nextMealName]?.[0] || "08:00",
      name: nextMealName, 
      options: [{ id: `opt-${Date.now()}`, day: 'Todos os dias', foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }] 
    };
    setMeals([...meals, newMeal]);
    setExpandedMealId(newMeal.id); 
  };

  const removeMeal = (mealId: string) => {
    setMeals(meals.filter(m => m.id !== mealId));
    if (expandedMealId === mealId) setExpandedMealId(null);
  };

  const updateMealTime = (mealId: string, time: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, time } : m));
  const updateMealName = (mealId: string, name: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, name } : m));

  const addOption = (mealId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const lastOptionDay = m.options[m.options.length - 1].day;
        let nextDay = "Terça-feira"; 
        if (lastOptionDay === "Segunda a Sexta") nextDay = "Finais de Semana";
        else {
          const dayIndex = SINGLE_DAYS.indexOf(lastOptionDay);
          if (dayIndex >= 0 && dayIndex < SINGLE_DAYS.length - 1) nextDay = SINGLE_DAYS[dayIndex + 1]; 
          else nextDay = "Segunda-feira"; 
        }
        return { 
          ...m, 
          options: [...m.options, { id: `opt-${Date.now()}`, day: nextDay, foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }] 
        };
      }
      return m;
    }));
  };

  const splitIntoFullWeek = (mealId: string) => {
    setMeals(meals.map(m => {
      if (m.id === mealId && m.options.length > 0) {
        const baseOption = m.options[0];
        const newOptions = SINGLE_DAYS.map((day, idx) => ({
          id: `opt-${Date.now()}-${idx}`, day: day, foodItems: [...baseOption.foodItems],
          kcal: baseOption.kcal, macros: { ...baseOption.macros }
        }));
        return { ...m, options: newOptions };
      }
      return m;
    }));
    toast.success("Dias separados com sucesso!");
  };

  const duplicateToEmptyDays = (mealId: string, sourceOption: Option) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id !== sourceOption.id && o.foodItems.length === 0) {
            return { ...o, foodItems: [...sourceOption.foodItems], kcal: sourceOption.kcal, macros: { ...sourceOption.macros } };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
    toast.success('Prato copiado!');
  };

  const removeOption = (mealId: string, optionId: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, options: m.options.filter(o => o.id !== optionId) } : m));
  const updateOptionDay = (mealId: string, optionId: string, day: string) => setMeals(meals.map(m => m.id === mealId ? { ...m, options: m.options.map(o => o.id === optionId ? { ...o, day } : o) } : m));

  const updateMacro = (mealId: string, optionId: string, macro: 'p' | 'c' | 'g', value: number) => {
    setMeals(meals.map(m => {
      if (m.id === mealId) {
        const newOptions = m.options.map(o => {
          if (o.id === optionId) {
            const newMacros = { ...o.macros, [macro]: value };
            const newKcal = (newMacros.p * 4) + (newMacros.c * 4) + (newMacros.g * 9);
            return { ...o, macros: newMacros, kcal: newKcal };
          }
          return o;
        });
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  const updateKcal = (mealId: string, optionId: string, kcal: number) => setMeals(meals.map(m => m.id === mealId ? { ...m, options: m.options.map(o => o.id === optionId ? { ...o, kcal } : o) } : m));

  // =========================================================================
  // INIT & LOAD
  // =========================================================================
  useEffect(() => {
    async function fetchExistingDiet() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('meal_plan').eq('id', patientId).single();
        if (error) throw error;

        if (data?.meal_plan && Array.isArray(data.meal_plan) && data.meal_plan.length > 0) {
          const formattedPlan: Meal[] = data.meal_plan.map((m: any) => ({
            id: m.id || `meal-${Date.now()}`, time: m.time || "", name: m.name || "Refeição",
            options: m.options.map((o: any) => migrateExistingOption({ ...o, day: o.day || "Todos os dias", kcal: o.kcal || 0, macros: o.macros || { p: 0, c: 0, g: 0 } }))
          }));
          setMeals(formattedPlan);
          if (formattedPlan.length > 0) setExpandedMealId(formattedPlan[0].id);
        } else {
          const newMealId = `meal-${Date.now()}`;
          setMeals([{ 
            id: newMealId, time: "08:00", name: 'Café da Manhã', 
            options: [{ id: `opt-${Date.now()}`, day: 'Todos os dias', foodItems: [], kcal: 0, macros: { p: 0, c: 0, g: 0 } }] 
          }]);
          setExpandedMealId(newMealId);
        }
      } catch (error) {
        console.error(error);
        toast.error("Falha ao carregar o cardápio existente.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchExistingDiet();
  }, [patientId, supabase]);

  if (!targetRecommendation || isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4">
        <div className="bg-white p-10 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[400px] shadow-2xl animate-in zoom-in-95">
          <Loader2 className="animate-spin text-stone-800 mb-5" size={48} strokeWidth={2} />
          <p className="text-stone-500 font-bold text-lg">Carregando laboratório da dieta...</p>
        </div>
      </div>
    );
  }

  const { calories: kcalTarget, macros: { protein: proteinTarget, carbs: carbsTarget, fat: fatTarget } } = targetRecommendation;

  const liveTotals = meals.reduce((acc, meal) => {
    const relevantOption = meal.options[0];
    if (!relevantOption) return acc;
    return {
      kcal: acc.kcal + (relevantOption.kcal || 0), p: acc.p + (relevantOption.macros?.p || 0),
      c: acc.c + (relevantOption.macros?.c || 0), g: acc.g + (relevantOption.macros?.g || 0),
    };
  }, { kcal: 0, p: 0, c: 0, g: 0 });

  const isMealComplete = (meal: Meal) => meal.options.length > 0 && meal.time !== '' && meal.options.some(opt => opt.foodItems.length > 0);

  const kcalStatus = getMetricFeedback(liveTotals.kcal, kcalTarget, true);
  const pStatus = getMetricFeedback(liveTotals.p, proteinTarget);
  const cStatus = getMetricFeedback(liveTotals.c, carbsTarget);
  const gStatus = getMetricFeedback(liveTotals.g, fatTarget);

  const handleSave = async () => {
    setIsSaving(true);
    setExpandedMealId(null);
    const cleanedMeals = meals.map(m => ({ ...m, options: m.options.filter(o => o.foodItems.length > 0) })).filter(m => m.options.length > 0);
    
    if (cleanedMeals.length === 0) {
      toast.warning("Não há nenhuma refeição preenchida para salvar.");
      setIsSaving(false); return;
    }
    
    try {
      const { error } = await supabase.from('profiles').update({ meal_plan: cleanedMeals, status: 'plano_liberado' }).eq('id', patientId);
      if (error) throw error;
      setSaved(true);
      toast.success("Cardápio salvo e liberado para o paciente!");
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (error) {
      toast.error("Erro ao salvar cardápio. Verifique sua conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-stone-900/60 backdrop-blur-sm sm:p-4 transition-all duration-300">
      
      {/* CONTAINER PRINCIPAL */}
      <div className="bg-[#fcfcfc] w-full max-w-4xl h-full sm:h-[95vh] mt-auto sm:mt-0 rounded-t-[2rem] sm:rounded-[2.5rem] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-8 sm:zoom-in-95 overflow-hidden relative">
        
        {/* HEADER (Sticky) */}
        <div className="bg-white px-5 sm:px-8 pt-5 pb-4 border-b border-stone-100 shrink-0 z-20 flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <div>
            <div className="w-12 h-1.5 bg-stone-200 rounded-full mb-4 sm:hidden mx-auto" />
            <div className="flex items-center gap-3">
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/60 text-stone-800 hidden sm:block">
                <Utensils size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight leading-none mb-1">
                  Montar Cardápio
                </h2>
                <p className="text-xs text-stone-500 font-medium">Paciente: <b className="text-stone-800">{patientName}</b></p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-stone-50 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-all active:scale-95">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* 🔥 ALERTA GLOBAL DE RESTRIÇÕES (NOVO) */}
        {restrictionsSummary.hasRestrictions && (
          <div className="mx-5 sm:mx-8 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-800">
                  ⚠️ Este paciente possui restrições alimentares ativas
                </p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  {restrictionsSummary.allergies > 0 && `🚫 ${restrictionsSummary.allergies} alergia(s) `}
                  {restrictionsSummary.intolerances > 0 && `⚠️ ${restrictionsSummary.intolerances} intolerância(s) `}
                  {restrictionsSummary.restrictions > 0 && `📋 ${restrictionsSummary.restrictions} restrição(ões)`}
                  {' '}- Alimentos bloqueados aparecem com estilo cortado e não podem ser adicionados.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* HUD DE MACROS HORIZONTAL */}
        <div className="bg-white border-b border-stone-100 shrink-0 z-10 relative shadow-sm mt-4">
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden z-10" />
          
          <div className="flex overflow-x-auto scrollbar-hide snap-x gap-3 px-5 sm:px-8 py-4 md:grid md:grid-cols-4">
            
            {/* KCAL */}
            <div className="min-w-[140px] flex-1 bg-stone-50/80 border border-stone-200/60 rounded-2xl p-3.5 flex flex-col snap-center shadow-inner relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-stone-500 mb-1">
                 <Target size={14} strokeWidth={2.5} />
                 <p className="text-[9px] font-black uppercase tracking-widest">Kcal</p>
              </div>
              <p className="text-xl font-black text-stone-800 tracking-tight leading-none mb-1">
                {Math.round(liveTotals.kcal)} <span className="text-xs text-stone-400 font-bold opacity-60">/ {kcalTarget}</span>
              </p>
              <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${kcalStatus.statusColorClass}`}>{kcalStatus.statusText}</p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-200/50">
                <div className={`h-full transition-all duration-1000 ease-out ${kcalStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.kcal / kcalTarget) * 100, 100)}%` }} />
              </div>
            </div>

            {/* PROTEINA */}
            <div className="min-w-[140px] flex-1 bg-stone-50/80 border border-stone-200/60 rounded-2xl p-3.5 flex flex-col snap-center shadow-inner relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-red-500 mb-1">
                 <Beef size={14} strokeWidth={2.5} />
                 <p className="text-[9px] font-black uppercase tracking-widest">Proteína</p>
              </div>
              <p className="text-xl font-black text-stone-800 tracking-tight leading-none mb-1">
                {Math.round(liveTotals.p)}g <span className="text-xs text-stone-400 font-bold opacity-60">/ {proteinTarget}g</span>
              </p>
              <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${pStatus.statusColorClass}`}>{pStatus.statusText}</p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-200/50">
                <div className={`h-full transition-all duration-1000 ease-out ${pStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.p / proteinTarget) * 100, 100)}%` }} />
              </div>
            </div>

            {/* CARBO */}
            <div className="min-w-[140px] flex-1 bg-stone-50/80 border border-stone-200/60 rounded-2xl p-3.5 flex flex-col snap-center shadow-inner relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                 <Wheat size={14} strokeWidth={2.5} />
                 <p className="text-[9px] font-black uppercase tracking-widest">Carbo</p>
              </div>
              <p className="text-xl font-black text-stone-800 tracking-tight leading-none mb-1">
                {Math.round(liveTotals.c)}g <span className="text-xs text-stone-400 font-bold opacity-60">/ {carbsTarget}g</span>
              </p>
              <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${cStatus.statusColorClass}`}>{cStatus.statusText}</p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-200/50">
                <div className={`h-full transition-all duration-1000 ease-out ${cStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.c / carbsTarget) * 100, 100)}%` }} />
              </div>
            </div>

            {/* GORDURA */}
            <div className="min-w-[140px] flex-1 bg-stone-50/80 border border-stone-200/60 rounded-2xl p-3.5 flex flex-col snap-center shadow-inner relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-blue-500 mb-1">
                 <Droplet size={14} strokeWidth={2.5} />
                 <p className="text-[9px] font-black uppercase tracking-widest">Gordura</p>
              </div>
              <p className="text-xl font-black text-stone-800 tracking-tight leading-none mb-1">
                {Math.round(liveTotals.g)}g <span className="text-xs text-stone-400 font-bold opacity-60">/ {fatTarget}g</span>
              </p>
              <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${gStatus.statusColorClass}`}>{gStatus.statusText}</p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-200/50">
                <div className={`h-full transition-all duration-1000 ease-out ${gStatus.barColorClass}`} style={{ width: `${Math.min((liveTotals.g / fatTarget) * 100, 100)}%` }} />
              </div>
            </div>

          </div>
        </div>

        {/* ÁREA DE ROLAGEM: LISTA DE REFEIÇÕES */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 scrollbar-thin scrollbar-thumb-stone-200 pb-28">
          {meals.map((meal) => {
            const isExpanded = expandedMealId === meal.id;
            const isComplete = isMealComplete(meal);

            return (
              <div 
                key={meal.id} 
                className={`rounded-[2rem] transition-all duration-300 relative group overflow-hidden ${
                  isExpanded 
                    ? 'bg-white border-2 border-stone-800 shadow-[0_20px_40px_rgba(0,0,0,0.06)] scale-[1.01]' 
                    : isComplete 
                      ? 'bg-emerald-50/50 border border-emerald-100 hover:border-emerald-300 cursor-pointer shadow-sm' 
                      : 'bg-white border border-stone-200 hover:border-stone-300 cursor-pointer shadow-sm'
                }`}
              >
                {/* Botão Flutuante de Excluir Refeição (Visível no Hover) */}
                <button 
                  onClick={(e) => { e.stopPropagation(); removeMeal(meal.id); }} 
                  title="Excluir Refeição"
                  className="absolute top-4 right-4 bg-white border border-stone-200 p-2.5 rounded-full shadow-sm text-stone-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-all z-20 active:scale-90"
                >
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>

                {/* CARD RETRAÍDO (RESUMO) */}
                <div 
                  onClick={() => setExpandedMealId(isExpanded ? null : meal.id)}
                  className={`p-5 sm:p-6 flex items-center justify-between relative z-10 ${isExpanded ? 'border-b border-stone-100 bg-stone-50/50' : ''}`}
                >
                  <div className="flex items-center gap-4 w-full pr-12">
                    <div className={`p-3.5 rounded-2xl shrink-0 transition-colors shadow-sm border ${
                      isComplete 
                        ? 'bg-emerald-100 border-emerald-200 text-emerald-600' 
                        : isExpanded 
                          ? 'bg-stone-800 border-stone-800 text-white'
                          : 'bg-stone-50 border-stone-200 text-stone-400'
                    }`}>
                      {isComplete ? <CheckCircle2 size={22} strokeWidth={2.5} /> : <Clock size={22} strokeWidth={2.5} />}
                    </div>
                    
                    <div className="w-full">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {!isExpanded && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 bg-stone-100 px-2.5 py-1 rounded-md">
                            {meal.time || '--:--'}
                          </span>
                        )}
                        {meal.options[0]?.kcal > 0 && !isExpanded && (
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider hidden sm:flex">
                             <span className="text-stone-500 bg-stone-100 px-2 py-1 rounded-md">{meal.options[0]?.kcal} kcal</span>
                             <span className="text-red-500 bg-red-50 px-2 py-1 rounded-md">P {Math.round(meal.options[0]?.macros?.p || 0)}g</span>
                             <span className="text-amber-500 bg-amber-50 px-2 py-1 rounded-md">C {Math.round(meal.options[0]?.macros?.c || 0)}g</span>
                             <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded-md">G {Math.round(meal.options[0]?.macros?.g || 0)}g</span>
                          </div>
                        )}
                      </div>
                      <h3 className={`text-lg sm:text-xl font-extrabold tracking-tight ${isComplete && !isExpanded ? 'text-emerald-900' : 'text-stone-900'}`}>
                        {meal.name}
                      </h3>
                    </div>
                  </div>
                  
                  <div className={`shrink-0 transition-transform duration-300 bg-white shadow-sm border border-stone-100 rounded-full p-1.5 ${isExpanded ? 'text-stone-800 rotate-180' : 'text-stone-400'}`}>
                    <ChevronDown size={20} strokeWidth={2.5} />
                  </div>
                </div>

                {/* CARD EXPANDIDO (CONTEÚDO) */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 bg-stone-50/50 animate-in fade-in slide-in-from-top-4 duration-300">
                    
                    {/* LINHA 1: NOME E HORÁRIO */}
                    <div className="flex flex-col sm:flex-row gap-5 mb-8 bg-white p-5 rounded-[1.5rem] border border-stone-200 shadow-sm">
                      <div className="flex-1">
                        <label className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400 mb-2 block ml-1">
                          Refeição
                        </label>
                        <div className="relative">
                          <select 
                            value={meal.name}
                            onChange={(e) => updateMealName(meal.id, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 font-extrabold text-stone-800 outline-none focus:border-stone-800 focus:ring-4 focus:ring-stone-800/10 bg-stone-50 appearance-none transition-all cursor-pointer text-sm"
                          >
                            {MEAL_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="flex-[2]">
                        <label className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400 mb-2 block ml-1">
                          Horário Previsto
                        </label>
                        <TimeSelector
                          value={meal.time}
                          onChange={(time) => updateMealTime(meal.id, time)}
                          mealType={meal.name}
                        />
                      </div>
                    </div>

                    {/* OPÇÕES (DIAS) */}
                    <div className="space-y-6">
                      {meal.options.map((option) => (
                        <div key={option.id} className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-stone-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative transition-all">
                          
                          {/* Dia Header */}
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-5 border-b border-stone-100">
                            
                            <div className="relative inline-block w-full sm:w-auto">
                              <select 
                                value={option.day}
                                onChange={(e) => updateOptionDay(meal.id, option.id, e.target.value)}
                                className={`w-full sm:w-auto pl-4 pr-10 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-[0.15em] outline-none transition-all cursor-pointer shadow-sm appearance-none ${
                                  option.day === 'Todos os dias' 
                                    ? 'bg-stone-900 text-white border-stone-900' 
                                    : 'bg-stone-100 text-stone-700 border-stone-200'
                                }`}
                              >
                                {ALL_DAYS.map(day => (
                                  <option key={day} value={day}>{day}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${option.day === 'Todos os dias' ? 'text-white/50' : 'text-stone-400'}`} />
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              
                              {/* BARRA DE MACROS UNIFICADA */}
                              <div className="flex items-center bg-stone-50 rounded-xl border border-stone-200 p-1 shadow-inner overflow-hidden">
                                 <div className="flex items-center pl-3 pr-2 py-1 border-r border-stone-200/60 group focus-within:bg-red-50 transition-colors">
                                    <span className="text-[9px] font-black uppercase text-stone-400 mr-2">P</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.p || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'p', Number(e.target.value))} className="w-8 bg-transparent text-sm font-bold text-red-600 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                 </div>
                                 <div className="flex items-center px-2 py-1 border-r border-stone-200/60 group focus-within:bg-amber-50 transition-colors">
                                    <span className="text-[9px] font-black uppercase text-stone-400 mr-2">C</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.c || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'c', Number(e.target.value))} className="w-8 bg-transparent text-sm font-bold text-amber-600 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                 </div>
                                 <div className="flex items-center px-2 py-1 group focus-within:bg-blue-50 transition-colors">
                                    <span className="text-[9px] font-black uppercase text-stone-400 mr-2">G</span>
                                    <input type="number" inputMode="decimal" value={Math.round(option.macros?.g || 0)} onChange={(e) => updateMacro(meal.id, option.id, 'g', Number(e.target.value))} className="w-8 bg-transparent text-sm font-bold text-blue-600 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                 </div>
                                 <div className="flex items-center pl-2 pr-1 py-1 bg-stone-800 rounded-lg shadow-sm ml-1">
                                    <input type="number" inputMode="decimal" value={Math.round(option.kcal || 0)} onChange={(e) => updateKcal(meal.id, option.id, Number(e.target.value))} className="w-10 bg-transparent text-sm font-black text-white outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <span className="text-[8px] font-black uppercase text-stone-400 ml-1">Kcal</span>
                                 </div>
                              </div>

                              {meal.options.length > 1 && option.foodItems.length > 0 && (
                                <button 
                                  onClick={() => duplicateToEmptyDays(meal.id, option)} 
                                  title="Copiar para dias vazios"
                                  className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors active:scale-95"
                                >
                                  <Copy size={16} strokeWidth={2.5} />
                                </button>
                              )}

                              {meal.options.length > 1 && (
                                <button 
                                  onClick={() => removeOption(meal.id, option.id)} 
                                  className="p-2.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors rounded-xl border border-stone-200 active:scale-95"
                                  title="Remover dia"
                                >
                                  <Trash2 size={16} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* ALIMENTOS SELECIONADOS */}
                          <div className="mb-6">
                            <label className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400 mb-2.5 block ml-1">
                              Prato Montado
                            </label>
                            <div className="flex flex-wrap gap-2 min-h-[56px] p-2 sm:p-3 bg-stone-50/80 rounded-2xl border border-stone-200 border-dashed">
                              {option.foodItems && option.foodItems.length > 0 ? (
                                option.foodItems.map((foodItem) => (
                                  <div 
                                    key={foodItem.id}
                                    className="group/food flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl pl-3 pr-1 py-1.5 shadow-sm hover:border-stone-300 transition-all animate-in zoom-in-95 duration-200"
                                  >
                                    <span className="text-sm font-bold text-stone-700">
                                      {foodItem.name}
                                    </span>
                                    <button
                                      onClick={() => removeFoodItem(meal.id, option.id, foodItem.id)}
                                      className="text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-1 transition-all"
                                    >
                                      <X size={14} strokeWidth={3} />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div className="w-full flex items-center justify-center p-2">
                                  <p className="text-xs text-stone-400 font-medium">Prato vazio. Adicione alimentos abaixo.</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ================================================================ */}
                          {/* BUSCA E CATEGORIAS BLINDADAS */}
                          {/* ================================================================ */}
                          <div>
                            <div className="flex items-center gap-2 mb-3 ml-1">
                              <Plus size={12} className="text-stone-400" strokeWidth={3} />
                              <p className="text-[9px] font-black text-stone-400 uppercase tracking-[0.15em]">Adicionar Alimentos</p>
                            </div>

                            {/* 🔥 CAMPO DE BUSCA RÁPIDA (PESQUISA DIRETO NO REGISTRY) */}
                            <div className="relative mb-4">
                              <input
                                type="text"
                                placeholder="Buscar alimento em todo o banco..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 pl-8 text-sm border border-stone-200 rounded-xl focus:border-stone-400 focus:ring-2 focus:ring-stone-100 outline-none transition-all bg-white"
                              />
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            </div>

                            {searchTerm.length > 0 ? (
                              /* RESULTADOS DA BUSCA (DIRETO DA FONTE DA VERDADE) */
                              <div className="flex flex-wrap gap-1.5 p-3 bg-stone-50 border border-stone-200 rounded-xl max-h-[300px] overflow-y-auto">
                                {FOOD_REGISTRY.filter(f => 
                                  f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  f.aliases.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()))
                                ).map(food => {
                                  const isBlocked = blockedFoodIds.has(food.id);
                                  const restrictionInfo = getRestrictionInfo(food.id, foodRestrictions);
                                  
                                  let btnClass = "px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm border ";
                                  let tooltipText = "Adicionar ao Prato";
                                  
                                  if (isBlocked) {
                                    if (restrictionInfo?.type === 'allergy') {
                                      btnClass += "bg-red-50 border-red-300 text-red-600 line-through cursor-not-allowed opacity-80";
                                      tooltipText = "🚫 PROIBIDO - Alergia grave";
                                    } else if (restrictionInfo?.type === 'intolerance') {
                                      btnClass += "bg-amber-50 border-amber-300 text-amber-700 line-through cursor-not-allowed opacity-80";
                                      tooltipText = "⚠️ CUIDADO - Intolerância alimentar";
                                    } else {
                                      btnClass += "bg-blue-50 border-blue-300 text-blue-700 line-through cursor-not-allowed opacity-80";
                                      tooltipText = "📋 EVITAR - Restrição alimentar";
                                    }
                                  } else {
                                    btnClass += "bg-white border-stone-200 text-stone-500 hover:border-stone-800 hover:text-stone-800 active:scale-95";
                                  }

                                  return (
                                    <button
                                      key={food.id}
                                      onClick={() => addFoodItem(meal.id, option.id, food.id)}
                                      disabled={isBlocked}
                                      title={tooltipText}
                                      className={btnClass}
                                    >
                                      {food.name}
                                      {isBlocked && restrictionInfo?.type === 'allergy' && <span className="text-red-500 text-[8px] ml-0.5">🚫</span>}
                                      {isBlocked && restrictionInfo?.type === 'intolerance' && <span className="text-amber-500 text-[8px] ml-0.5">⚠️</span>}
                                      {isBlocked && restrictionInfo?.type === 'restriction' && <span className="text-blue-500 text-[8px] ml-0.5">📋</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              /* 🔥 CATEGORIAS EXPANSÍVEIS (MAPA VISUAL SEGURO POR ID) */
                              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-200">
                                {quickFoods.map((cat) => {
                                  const isExpanded = expandedCategories[`${meal.id}-${option.id}-${cat.category}`] || false;
                                  
                                  return (
                                    <div key={cat.category} className="border border-stone-200 rounded-xl overflow-hidden bg-white">
                                      <button
                                        onClick={() => setExpandedCategories(prev => ({
                                          ...prev,
                                          [`${meal.id}-${option.id}-${cat.category}`]: !prev[`${meal.id}-${option.id}-${cat.category}`]
                                        }))}
                                        className="w-full flex items-center justify-between px-3 py-2.5 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
                                      >
                                        <div className="flex items-center gap-2">
                                          <ChevronRight size={14} className={`text-stone-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                          <span className="text-[11px] font-extrabold text-stone-700 uppercase tracking-wider">{cat.category}</span>
                                        </div>
                                      </button>

                                      {isExpanded && (
                                        <div className="p-3 pt-2 border-t border-stone-100 animate-in fade-in slide-in-from-top-2 duration-200">
                                          <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto">
                                            {cat.items.map(foodUI => {
                                              // 🛡️ OBRIGATÓRIO: Match EXATO por ID (Fim do string match frágil)
                                              const registryMatch = FOOD_REGISTRY.find(f => f.id === foodUI.id);
                                              
                                              if (!registryMatch) return null;

                                              const isBlocked = blockedFoodIds.has(registryMatch.id);
                                              const restrictionInfo = getRestrictionInfo(registryMatch.id, foodRestrictions);
                                              
                                              let btnClass = "px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-bold text-stone-500 hover:border-stone-800 hover:text-stone-800 transition-all active:scale-95 shadow-sm";
                                              let tooltipText = "Adicionar ao Prato";
                                              
                                              if (isBlocked) {
                                                if (restrictionInfo?.type === 'allergy') {
                                                  btnClass = "px-2.5 py-1.5 bg-red-50 border border-red-300 rounded-lg text-[10px] font-bold text-red-600 line-through cursor-not-allowed opacity-80";
                                                  tooltipText = "🚫 PROIBIDO - Alergia grave";
                                                } else if (restrictionInfo?.type === 'intolerance') {
                                                  btnClass = "px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-[10px] font-bold text-amber-700 line-through cursor-not-allowed opacity-80";
                                                  tooltipText = "⚠️ CUIDADO - Intolerância alimentar";
                                                } else {
                                                  btnClass = "px-2.5 py-1.5 bg-blue-50 border border-blue-300 rounded-lg text-[10px] font-bold text-blue-700 line-through cursor-not-allowed opacity-80";
                                                  tooltipText = "📋 EVITAR - Restrição alimentar";
                                                }
                                              }

                                              return (
                                                <button
                                                  key={registryMatch.id}
                                                  onClick={() => addFoodItem(meal.id, option.id, registryMatch.id)}
                                                  disabled={isBlocked}
                                                  title={tooltipText}
                                                  className={btnClass}
                                                >
                                                  {foodUI.label}
                                                  {isBlocked && restrictionInfo?.type === 'allergy' && <span className="text-red-500 text-[8px] ml-0.5">🚫</span>}
                                                  {isBlocked && restrictionInfo?.type === 'intolerance' && <span className="text-amber-500 text-[8px] ml-0.5">⚠️</span>}
                                                  {isBlocked && restrictionInfo?.type === 'restriction' && <span className="text-blue-500 text-[8px] ml-0.5">📋</span>}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                          </div>
                        </div>
                      ))}
                      
                      {/* AÇÕES DE VARIAÇÃO DE DIAS */}
                      <div className="flex flex-wrap gap-3 pt-2">
                        {!meal.options.some(opt => opt.day === "Todos os dias") && meal.options.length < 7 && (
                          <button 
                            onClick={() => addOption(meal.id)} 
                            className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-600 bg-white shadow-sm border border-stone-200 hover:border-stone-800 hover:text-stone-800 px-5 py-3 rounded-xl transition-all active:scale-95"
                          >
                            <Plus size={16} strokeWidth={2.5} /> Adicionar Variação
                          </button>
                        )}

                        {meal.options.length === 1 && meal.options[0].day === "Todos os dias" && (
                          <button 
                            onClick={() => splitIntoFullWeek(meal.id)} 
                            className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-800 bg-stone-100 border border-stone-200 hover:bg-stone-200 px-5 py-3 rounded-xl transition-all active:scale-95 shadow-sm"
                          >
                            <CalendarRange size={16} strokeWidth={2.5} /> Separar Seg a Dom
                          </button>
                        )}
                      </div>
                    </div>

                    {/* FECHAR ABA */}
                    <div className="mt-8 flex justify-center">
                       <button 
                         onClick={() => setExpandedMealId(null)}
                         className="flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-800 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm transition-all active:scale-95"
                       >
                         <ChevronUp size={16} strokeWidth={3} /> {isComplete ? "Pronto, Fechar Aba" : "Fechar Aba"}
                       </button>
                    </div>

                  </div>
                )}
              </div>
            );
          })}

          {/* ADICIONAR NOVA REFEIÇÃO */}
          <button 
            onClick={addMeal} 
            className="w-full border-2 border-dashed border-stone-200/80 rounded-[2rem] py-12 flex flex-col items-center justify-center text-stone-400 hover:border-stone-400 hover:text-stone-800 hover:bg-stone-50/50 transition-all group mt-6 active:scale-[0.98]"
          >
            <div className="bg-white p-3.5 rounded-2xl shadow-sm mb-3 group-hover:scale-110 group-hover:bg-stone-800 group-hover:text-white transition-all duration-300 border border-stone-100 group-hover:border-stone-800">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <span className="font-black uppercase tracking-[0.15em] text-[11px]">Adicionar Refeição</span>
          </button>
        </div>

        {/* FOOTER FIXO (Bottom Sheet Premium) */}
        <div className="absolute bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-stone-100 p-4 sm:p-6 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl mx-auto flex flex-row items-center gap-2.5 sm:gap-3">
            <button 
              onClick={onClose} 
              className="px-5 sm:px-6 py-4 font-bold text-stone-500 hover:text-stone-800 bg-stone-50 hover:bg-stone-100 rounded-2xl transition-all active:scale-[0.98] shrink-0 text-[13px] sm:text-base"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className={`flex-1 flex items-center justify-center gap-2 px-4 sm:px-8 py-4 rounded-2xl font-bold text-white transition-all duration-300 shadow-[0_8px_25px_rgba(0,0,0,0.15)] active:scale-[0.98] text-[13px] sm:text-base truncate ${
                saved 
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' 
                  : 'bg-stone-900 hover:bg-stone-800'
              }`}
            >
              {isSaving ? (
                <><Loader2 size={18} strokeWidth={2.5} className="animate-spin shrink-0"/> <span className="truncate">Salvando...</span></>
              ) : saved ? (
                <><CheckCircle2 size={18} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Salvo!</span></>
              ) : (
                <><Save size={18} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Liberar Cardápio</span></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}