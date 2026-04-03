// =========================================================================
// DOMÍNIO CORE DE ALIMENTOS (SINGLE SOURCE OF TRUTH)
// =========================================================================

export type MacroProfile = {
  p: number; // Proteína (g)
  c: number; // Carboidrato (g)
  g: number; // Gordura (g)
};

export type FoodTag = 
  | 'lactose' | 'laticinio' | 'gluten' | 'trigo' | 'amendoim' 
  | 'nuts' | 'ovo' | 'carne_branca' | 'carne_vermelha' | 'peixe' 
  | 'frutos_do_mar' | 'vegano' | 'vegetariano' | 'soja';

export interface FoodEntity {
  id: string;
  name: string;             // Nome de exibição principal (ex: "Leite Int. (1 copo 200ml)")
  baseUnit: string;         // Unidade base (ex: "100g", "1 copo")
  aliases: string[];        // Para o "Matcher" (ex: ["leite", "leite integral", "milk"])
  tags: FoodTag[];          // Para as "Rules" (ex: ["lactose", "laticinio", "vegetariano"])
  category: string;
  kcal: number;
  macros: MacroProfile;
}

// O Banco de Dados em Memória (Pode virar tabela do DB no futuro)
export const FOOD_REGISTRY: FoodEntity[] = [
  // ================= PROTEÍNAS E LATICÍNIOS =================
  {
    id: "egg_scrambled",
    name: "Ovo mexido (2 un)",
    baseUnit: "2 unidades",
    aliases: ["ovo", "ovos", "ovo mexido", "ovos mexidos"],
    tags: ["ovo", "vegetariano"],
    category: "Proteínas e Laticínios",
    kcal: 156,
    macros: { c: 1, p: 12, g: 11 }
  },
  {
    id: "egg_boiled",
    name: "Ovo cozido (2 un)",
    baseUnit: "2 unidades",
    aliases: ["ovo", "ovos", "ovo cozido", "ovos cozidos"],
    tags: ["ovo", "vegetariano"],
    category: "Proteínas e Laticínios",
    kcal: 140,
    macros: { c: 1, p: 12, g: 10 }
  },
  {
    id: "chicken_breast",
    name: "Frango grelhado (100g)",
    baseUnit: "100g",
    aliases: ["frango", "peito de frango", "frango grelhado"],
    tags: ["carne_branca"],
    category: "Proteínas e Laticínios",
    kcal: 165,
    macros: { c: 0, p: 31, g: 3 }
  },
  {
    id: "chicken_shredded",
    name: "Frango desfiado (3 col)",
    baseUnit: "3 colheres",
    aliases: ["frango", "frango desfiado"],
    tags: ["carne_branca"],
    category: "Proteínas e Laticínios",
    kcal: 105,
    macros: { c: 0, p: 20, g: 2 }
  },
  {
    id: "beef_ground",
    name: "Carne moída magra (100g)",
    baseUnit: "100g",
    aliases: ["carne", "carne moída", "patinho", "boi"],
    tags: ["carne_vermelha"],
    category: "Proteínas e Laticínios",
    kcal: 133,
    macros: { c: 0, p: 21, g: 5 }
  },
  {
    id: "fish_fillet",
    name: "Filé de peixe (100g)",
    baseUnit: "100g",
    aliases: ["peixe", "filé de peixe", "tilápia", "merluza"],
    tags: ["peixe", "carne_branca"],
    category: "Proteínas e Laticínios",
    kcal: 110,
    macros: { c: 0, p: 20, g: 2 }
  },
  {
    id: "whey_protein",
    name: "Whey Protein (1 scp 30g)",
    baseUnit: "30g",
    aliases: ["whey", "whey protein", "proteina em po"],
    tags: ["lactose", "laticinio", "vegetariano"],
    category: "Proteínas e Laticínios",
    kcal: 120,
    macros: { c: 3, p: 24, g: 1.5 }
  },
  {
    id: "milk_whole",
    name: "Leite Int. (1 copo 200ml)",
    baseUnit: "200ml",
    aliases: ["leite", "leite integral"],
    tags: ["lactose", "laticinio", "vegetariano"],
    category: "Proteínas e Laticínios",
    kcal: 120,
    macros: { c: 10, p: 6, g: 6 }
  },
  {
    id: "milk_skim",
    name: "Leite Desn. (1 copo 200ml)",
    baseUnit: "200ml",
    aliases: ["leite desnatado", "leite magro"],
    tags: ["lactose", "laticinio", "vegetariano"],
    category: "Proteínas e Laticínios",
    kcal: 70,
    macros: { c: 10, p: 6, g: 0 }
  },
  {
    id: "yogurt_natural",
    name: "Iogurte Nat. (1 pote 170g)",
    baseUnit: "170g",
    aliases: ["iogurte", "iogurte natural", "yogurt"],
    tags: ["lactose", "laticinio", "vegetariano"],
    category: "Proteínas e Laticínios",
    kcal: 70,
    macros: { c: 9, p: 7, g: 0 }
  },
  {
    id: "cheese_minas",
    name: "Queijo Minas (1 fatia 30g)",
    baseUnit: "30g",
    aliases: ["queijo", "queijo minas", "queijo branco"],
    tags: ["lactose", "laticinio", "vegetariano"],
    category: "Proteínas e Laticínios",
    kcal: 66,
    macros: { c: 1, p: 5, g: 4 }
  },
  {
    id: "cheese_mozzarella",
    name: "Mussarela (2 fatias 30g)",
    baseUnit: "30g",
    aliases: ["queijo", "mussarela", "muçarela", "queijo amarelo"],
    tags: ["lactose", "laticinio", "vegetariano"],
    category: "Proteínas e Laticínios",
    kcal: 96,
    macros: { c: 1, p: 7, g: 7 }
  },

  // ================= CARBOIDRATOS =================
  {
    id: "rice_white",
    name: "Arroz branco coz. (100g)",
    baseUnit: "100g",
    aliases: ["arroz", "arroz branco"],
    tags: ["vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 130,
    macros: { c: 28, p: 2.5, g: 0.2 }
  },
  {
    id: "rice_brown",
    name: "Arroz integral coz. (100g)",
    baseUnit: "100g",
    aliases: ["arroz integral"],
    tags: ["vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 112,
    macros: { c: 24, p: 2.5, g: 1 }
  },
  {
    id: "cassava",
    name: "Mandioca cozida (100g)",
    baseUnit: "100g",
    aliases: ["mandioca", "aipim", "macaxeira"],
    tags: ["vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 125,
    macros: { c: 30, p: 1, g: 0 }
  },
  {
    id: "tapioca",
    name: "Tapioca (3 col sopa 50g)",
    baseUnit: "50g",
    aliases: ["tapioca", "goma"],
    tags: ["vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 120,
    macros: { c: 30, p: 0, g: 0 }
  },
  {
    id: "bread_french",
    name: "Pão francês (1 un)",
    baseUnit: "1 unidade",
    aliases: ["pão", "pão francês", "pão de sal"],
    tags: ["gluten", "trigo", "vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 135,
    macros: { c: 28, p: 4, g: 0 }
  },
  {
    id: "bread_whole",
    name: "Pão forma int. (2 fatias)",
    baseUnit: "2 fatias",
    aliases: ["pão integral", "pão de forma"],
    tags: ["gluten", "trigo", "vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 115,
    macros: { c: 20, p: 5, g: 1.5 }
  },
  {
    id: "sweet_potato",
    name: "Batata doce coz. (100g)",
    baseUnit: "100g",
    aliases: ["batata doce"],
    tags: ["vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 86,
    macros: { c: 20, p: 1, g: 0.1 }
  },
  {
    id: "potato_english",
    name: "Batata inglesa coz. (150g)",
    baseUnit: "150g",
    aliases: ["batata", "batata inglesa"],
    tags: ["vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 110,
    macros: { c: 26, p: 2, g: 0.1 }
  },
  {
    id: "oats",
    name: "Aveia em flocos (30g)",
    baseUnit: "30g",
    aliases: ["aveia", "flocos de aveia", "mingau"],
    tags: ["gluten", "vegano", "vegetariano"], 
    category: "Carboidratos",
    kcal: 118,
    macros: { c: 17, p: 4.5, g: 2.5 }
  },
  {
    id: "granola",
    name: "Granola s/ açúc. (3 col)",
    baseUnit: "3 colheres",
    aliases: ["granola"],
    tags: ["gluten", "nuts", "vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 140,
    macros: { c: 20, p: 4, g: 5 }
  },
  {
    id: "pasta",
    name: "Macarrão cozido (100g)",
    baseUnit: "100g",
    aliases: ["macarrão", "massa"],
    tags: ["gluten", "trigo", "vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 157,
    macros: { c: 31, p: 5, g: 1 }
  },
  {
    id: "couscous",
    name: "Cuscuz de milho (100g)",
    baseUnit: "100g",
    aliases: ["cuscuz", "flocão"],
    tags: ["vegano", "vegetariano"],
    category: "Carboidratos",
    kcal: 120,
    macros: { c: 25, p: 2, g: 1 }
  },

  // ================= LEGUMINOSAS =================
  {
    id: "beans_broth",
    name: "Feijão caldo (1 concha)",
    baseUnit: "1 concha",
    aliases: ["feijão", "caldo de feijão"],
    tags: ["vegano", "vegetariano"],
    category: "Leguminosas",
    kcal: 106,
    macros: { c: 14, p: 7, g: 0.5 }
  },
  {
    id: "beans_grains",
    name: "Feijão grãos (1 escumad.)",
    baseUnit: "1 escumadeira",
    aliases: ["feijão", "grão de feijão"],
    tags: ["vegano", "vegetariano"],
    category: "Leguminosas",
    kcal: 140,
    macros: { c: 20, p: 9, g: 1 }
  },
  {
    id: "lentils",
    name: "Lentilha (1 escumadeira)",
    baseUnit: "1 escumadeira",
    aliases: ["lentilha"],
    tags: ["vegano", "vegetariano"],
    category: "Leguminosas",
    kcal: 115,
    macros: { c: 20, p: 9, g: 0.5 }
  },
  {
    id: "chickpeas",
    name: "Grão de bico (3 col)",
    baseUnit: "3 colheres",
    aliases: ["grão de bico", "grao de bico", "hummus"],
    tags: ["vegano", "vegetariano"],
    category: "Leguminosas",
    kcal: 130,
    macros: { c: 22, p: 7, g: 2 }
  },
  {
    id: "peas",
    name: "Ervilha fresca (3 col)",
    baseUnit: "3 colheres",
    aliases: ["ervilha", "ervilhas"],
    tags: ["vegano", "vegetariano"],
    category: "Leguminosas",
    kcal: 70,
    macros: { c: 10, p: 5, g: 0.5 }
  },

  // ================= VEGETAIS E FRUTAS =================
  {
    id: "salad_greens",
    name: "Salada de Folhas (à vont.)",
    baseUnit: "à vontade",
    aliases: ["salada", "folhas", "alface", "rúcula", "couve"],
    tags: ["vegano", "vegetariano"],
    category: "Vegetais e Frutas",
    kcal: 15,
    macros: { c: 2, p: 1, g: 0 }
  },
  {
    id: "tomato_cucumber",
    name: "Tomate/Pepino (1 porção)",
    baseUnit: "1 porção",
    aliases: ["tomate", "pepino"],
    tags: ["vegano", "vegetariano"],
    category: "Vegetais e Frutas",
    kcal: 25,
    macros: { c: 5, p: 1, g: 0 }
  },
  {
    id: "broccoli",
    name: "Brócolis coz. (3 ramos)",
    baseUnit: "3 ramos",
    aliases: ["brócolis", "brocolis"],
    tags: ["vegano", "vegetariano"],
    category: "Vegetais e Frutas",
    kcal: 25,
    macros: { c: 4, p: 2, g: 0 }
  },
  {
    id: "banana",
    name: "Banana prata (1 un)",
    baseUnit: "1 unidade",
    aliases: ["banana", "banana prata"],
    tags: ["vegano", "vegetariano"],
    category: "Vegetais e Frutas",
    kcal: 90,
    macros: { c: 23, p: 1, g: 0 }
  },
  {
    id: "apple",
    name: "Maçã (1 un média)",
    baseUnit: "1 unidade",
    aliases: ["maçã", "maca"],
    tags: ["vegano", "vegetariano"],
    category: "Vegetais e Frutas",
    kcal: 70,
    macros: { c: 15, p: 0.3, g: 0 }
  },
  {
    id: "papaya",
    name: "Mamão (1 fatia média)",
    baseUnit: "1 fatia",
    aliases: ["mamão", "mamao", "papaya"],
    tags: ["vegano", "vegetariano"],
    category: "Vegetais e Frutas",
    kcal: 45,
    macros: { c: 11, p: 0.5, g: 0 }
  },
  {
    id: "strawberry",
    name: "Morangos (10 un)",
    baseUnit: "10 unidades",
    aliases: ["morango", "morangos"],
    tags: ["vegano", "vegetariano"],
    category: "Vegetais e Frutas",
    kcal: 32,
    macros: { c: 7, p: 0.6, g: 0.3 }
  },
  {
    id: "avocado",
    name: "Abacate (2 col sopa)",
    baseUnit: "2 colheres",
    aliases: ["abacate", "avocado"],
    tags: ["vegano", "vegetariano"],
    category: "Vegetais e Frutas",
    kcal: 110,
    macros: { c: 5, p: 1, g: 10 }
  },

  // ================= GORDURAS E EXTRAS =================
  {
    id: "olive_oil",
    name: "Azeite oliva (1 col. sp)",
    baseUnit: "1 colher de sopa",
    aliases: ["azeite", "azeite de oliva", "óleo"],
    tags: ["vegano", "vegetariano"],
    category: "Gorduras/Extras",
    kcal: 108,
    macros: { c: 0, p: 0, g: 12 }
  },
  {
    id: "peanut_butter",
    name: "Pasta amendoim (1 col. sp)",
    baseUnit: "1 colher de sopa",
    aliases: ["pasta de amendoim", "manteiga de amendoim", "amendoim"],
    tags: ["amendoim", "nuts", "vegano", "vegetariano"],
    category: "Gorduras/Extras",
    kcal: 90,
    macros: { c: 3, p: 4, g: 8 }
  },
  {
    id: "butter",
    name: "Manteiga (1 col chá 10g)",
    baseUnit: "10g",
    aliases: ["manteiga"],
    tags: ["lactose", "laticinio", "vegetariano"],
    category: "Gorduras/Extras",
    kcal: 70,
    macros: { c: 0, p: 0, g: 8 }
  },
  {
    id: "cream_cheese_light",
    name: "Requeijão light (1 col. sp)",
    baseUnit: "1 colher de sopa",
    aliases: ["requeijão", "requeijão light", "cream cheese"],
    tags: ["lactose", "laticinio", "vegetariano"],
    category: "Gorduras/Extras",
    kcal: 50,
    macros: { c: 1, p: 3, g: 4 }
  },
  {
    id: "mixed_nuts",
    name: "Castanhas (Mix 30g)",
    baseUnit: "30g",
    aliases: ["castanha", "castanhas", "mix de castanhas", "noz", "nozes"],
    tags: ["nuts", "vegano", "vegetariano"],
    category: "Gorduras/Extras",
    kcal: 170,
    macros: { c: 9, p: 4, g: 15 }
  },
  {
    id: "chia_flaxseed",
    name: "Chia/Linhaça (1 col. sp)",
    baseUnit: "1 colher de sopa",
    aliases: ["chia", "linhaça", "semente"],
    tags: ["vegano", "vegetariano"],
    category: "Gorduras/Extras",
    kcal: 55,
    macros: { c: 4, p: 2, g: 4 }
  },
  {
    id: "coffee",
    name: "Café s/ açúcar (1 xícara)",
    baseUnit: "1 xícara",
    aliases: ["café", "cafe"],
    tags: ["vegano", "vegetariano"],
    category: "Gorduras/Extras",
    kcal: 0,
    macros: { c: 0, p: 0, g: 0 }
  }
];

// =========================================================================
// FUNÇÕES UTILITÁRIAS DO DOMÍNIO
// =========================================================================

export const getFoodById = (id: string): FoodEntity | undefined => {
  return FOOD_REGISTRY.find(f => f.id === id);
};

export const getFoodsByCategory = (): Record<string, FoodEntity[]> => {
  return FOOD_REGISTRY.reduce((acc, food) => {
    if (!acc[food.category]) acc[food.category] = [];
    acc[food.category].push(food);
    return acc;
  }, {} as Record<string, FoodEntity[]>);
};

export const searchFoods = (query: string): FoodEntity[] => {
  if (!query) return [];
  const normalizedQuery = query.toLowerCase().trim();
  
  return FOOD_REGISTRY.filter(food => {
    if (food.name.toLowerCase().includes(normalizedQuery)) return true;
    if (food.aliases.some(alias => alias.toLowerCase().includes(normalizedQuery))) return true;
    return false;
  });
};