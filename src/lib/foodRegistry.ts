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
  },

  // ==========================================================
  // NOVOS ITENS ADICIONADOS PARA CORRIGIR WARNINGS DO REGISTRY
  // ==========================================================

  // --- CARNES VERMELHAS E AVES E OVOS ---
  { id: "beef_minced_lean", name: "Carne moída magra (100g)", baseUnit: "100g", aliases: ["carne", "patinho moído", "magra"], tags: ["carne_vermelha"], category: "Proteínas e Laticínios", kcal: 133, macros: { c: 0, p: 21, g: 5 } },
  { id: "beef_minced_5", name: "Carne moída 5% gordura (100g)", baseUnit: "100g", aliases: ["carne", "extramagra"], tags: ["carne_vermelha"], category: "Proteínas e Laticínios", kcal: 125, macros: { c: 0, p: 22, g: 4 } },
  { id: "filet_mignon", name: "Filé Mignon (100g)", baseUnit: "100g", aliases: ["file mignon", "carne"], tags: ["carne_vermelha"], category: "Proteínas e Laticínios", kcal: 143, macros: { c: 0, p: 22, g: 6 } },
  { id: "striploin", name: "Contrafilé grelhado (100g)", baseUnit: "100g", aliases: ["contra file", "bife"], tags: ["carne_vermelha"], category: "Proteínas e Laticínios", kcal: 198, macros: { c: 0, p: 23, g: 11 } },
  { id: "beef_knuckle_minced", name: "Patinho moído (100g)", baseUnit: "100g", aliases: ["patinho", "carne moida"], tags: ["carne_vermelha"], category: "Proteínas e Laticínios", kcal: 133, macros: { c: 0, p: 21, g: 5 } },
  { id: "rump_steak", name: "Alcatra grelhada (100g)", baseUnit: "100g", aliases: ["alcatra", "bife"], tags: ["carne_vermelha"], category: "Proteínas e Laticínios", kcal: 165, macros: { c: 0, p: 24, g: 7 } },
  { id: "tri_tip", name: "Maminha assada (100g)", baseUnit: "100g", aliases: ["maminha"], tags: ["carne_vermelha"], category: "Proteínas e Laticínios", kcal: 153, macros: { c: 0, p: 22, g: 7 } },
  { id: "pork_loin_grilled", name: "Lombo suíno grelhado (100g)", baseUnit: "100g", aliases: ["lombo", "porco"], tags: ["carne_vermelha"], category: "Proteínas e Laticínios", kcal: 160, macros: { c: 0, p: 25, g: 6 } },
  { id: "hamburger_homemade", name: "Hambúrguer caseiro (100g)", baseUnit: "100g", aliases: ["hamburguer", "burger"], tags: ["carne_vermelha"], category: "Proteínas e Laticínios", kcal: 200, macros: { c: 2, p: 20, g: 12 } },
  { id: "egg_poached", name: "Ovo pochê (1 un)", baseUnit: "1 unidade", aliases: ["ovo", "pochê"], tags: ["ovo", "vegetariano"], category: "Proteínas e Laticínios", kcal: 70, macros: { c: 0.5, p: 6, g: 5 } },
  { id: "chicken_breast_grilled", name: "Peito frango grelhado (100g)", baseUnit: "100g", aliases: ["frango", "peito"], tags: ["carne_branca"], category: "Proteínas e Laticínios", kcal: 165, macros: { c: 0, p: 31, g: 3 } },
  { id: "chicken_breast_roasted", name: "Peito frango assado (100g)", baseUnit: "100g", aliases: ["frango", "assado"], tags: ["carne_branca"], category: "Proteínas e Laticínios", kcal: 160, macros: { c: 0, p: 30, g: 3.5 } },
  { id: "chicken_thigh_roasted", name: "Sobrecoxa assada s/ pele (100g)", baseUnit: "100g", aliases: ["sobrecoxa", "frango"], tags: ["carne_branca"], category: "Proteínas e Laticínios", kcal: 177, macros: { c: 0, p: 24, g: 8 } },
  { id: "turkey_sliced", name: "Peito de peru (2 fatias 30g)", baseUnit: "30g", aliases: ["peito de peru", "embutido"], tags: ["carne_branca"], category: "Proteínas e Laticínios", kcal: 32, macros: { c: 1, p: 6, g: 0.5 } },

  // --- PEIXES E FRUTOS DO MAR ---
  { id: "fish_filet", name: "Filé de peixe grelhado (100g)", baseUnit: "100g", aliases: ["peixe", "file", "tilapia"], tags: ["peixe", "carne_branca"], category: "Proteínas e Laticínios", kcal: 110, macros: { c: 0, p: 20, g: 2 } },
  { id: "salmon_grilled", name: "Salmão grelhado (100g)", baseUnit: "100g", aliases: ["salmao", "peixe"], tags: ["peixe", "carne_branca"], category: "Proteínas e Laticínios", kcal: 206, macros: { c: 0, p: 22, g: 12 } },
  { id: "tuna_solid", name: "Atum sólido natural (1 lata 120g)", baseUnit: "120g", aliases: ["atum", "enlatado"], tags: ["peixe", "carne_branca"], category: "Proteínas e Laticínios", kcal: 112, macros: { c: 0, p: 25, g: 1 } },
  { id: "sardine_roasted", name: "Sardinha assada (100g)", baseUnit: "100g", aliases: ["sardinha", "peixe"], tags: ["peixe", "carne_branca"], category: "Proteínas e Laticínios", kcal: 164, macros: { c: 0, p: 24, g: 7 } },
  { id: "shrimp_grilled", name: "Camarão grelhado (100g)", baseUnit: "100g", aliases: ["camarao", "frutos do mar"], tags: ["frutos_do_mar", "carne_branca"], category: "Proteínas e Laticínios", kcal: 99, macros: { c: 1, p: 21, g: 1 } },

  // --- LATICÍNIOS E ALTERNATIVAS ---
  { id: "milk_lactose_free", name: "Leite zero lactose (200ml)", baseUnit: "200ml", aliases: ["leite", "sem lactose", "nolac"], tags: ["laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 110, macros: { c: 10, p: 6, g: 5 } },
  { id: "almond_milk", name: "Leite de amêndoas (200ml)", baseUnit: "200ml", aliases: ["leite vegetal", "amendoas"], tags: ["vegano", "vegetariano", "nuts"], category: "Proteínas e Laticínios", kcal: 35, macros: { c: 1, p: 1, g: 2.5 } },
  { id: "soy_milk", name: "Leite de soja (200ml)", baseUnit: "200ml", aliases: ["leite vegetal", "soja"], tags: ["vegano", "vegetariano", "soja"], category: "Proteínas e Laticínios", kcal: 80, macros: { c: 4, p: 7, g: 4 } },
  { id: "yogurt_greek", name: "Iogurte grego (1 pote 100g)", baseUnit: "100g", aliases: ["grego", "iogurte"], tags: ["lactose", "laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 110, macros: { c: 8, p: 7, g: 5 } },
  { id: "yogurt_protein", name: "Iogurte proteico (1 pote 250g)", baseUnit: "250g", aliases: ["yopro", "whey", "iogurte"], tags: ["lactose", "laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 140, macros: { c: 12, p: 15, g: 2 } },
  { id: "kefir", name: "Kefir de leite (200ml)", baseUnit: "200ml", aliases: ["kefir", "probiotico"], tags: ["lactose", "laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 100, macros: { c: 8, p: 6, g: 5 } },
  { id: "cheese_prato", name: "Queijo prato (1 fatia 30g)", baseUnit: "30g", aliases: ["queijo prato", "amarelo"], tags: ["lactose", "laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 105, macros: { c: 1, p: 7, g: 8 } },
  { id: "cheese_cottage", name: "Cottage (2 col. sopa 50g)", baseUnit: "50g", aliases: ["queijo cottage", "branco"], tags: ["lactose", "laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 45, macros: { c: 2, p: 6, g: 2 } },
  { id: "cheese_ricotta", name: "Ricota (1 fatia 50g)", baseUnit: "50g", aliases: ["ricota", "queijo"], tags: ["lactose", "laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 70, macros: { c: 2, p: 6, g: 4 } },
  { id: "cheese_parmesan", name: "Parmesão ralado (1 col. sopa 15g)", baseUnit: "15g", aliases: ["parmesao", "queijo ralado"], tags: ["lactose", "laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 65, macros: { c: 0.5, p: 6, g: 4.5 } },

  // --- FONTES VEGETAIS (PROTEÍNA/LEGUMINOSAS) ---
  { id: "tofu_grilled", name: "Tofu grelhado (100g)", baseUnit: "100g", aliases: ["tofu", "queijo de soja"], tags: ["vegano", "vegetariano", "soja"], category: "Proteínas e Laticínios", kcal: 85, macros: { c: 2, p: 9, g: 5 } },
  { id: "tempeh", name: "Tempeh (100g)", baseUnit: "100g", aliases: ["tempeh", "soja fermentada"], tags: ["vegano", "vegetariano", "soja"], category: "Proteínas e Laticínios", kcal: 193, macros: { c: 9, p: 19, g: 11 } },
  { id: "seitan", name: "Seitan (100g)", baseUnit: "100g", aliases: ["seitan", "carne de gluten"], tags: ["vegano", "vegetariano", "gluten", "trigo"], category: "Proteínas e Laticínios", kcal: 370, macros: { c: 14, p: 75, g: 2 } },
  { id: "black_beans_broth", name: "Feijão preto (só caldo 1 concha)", baseUnit: "1 concha", aliases: ["caldo preto"], tags: ["vegano", "vegetariano"], category: "Leguminosas", kcal: 80, macros: { c: 12, p: 5, g: 1 } },
  { id: "black_beans_grains", name: "Feijão preto (grãos 1 concha)", baseUnit: "1 concha", aliases: ["feijao preto"], tags: ["vegano", "vegetariano"], category: "Leguminosas", kcal: 130, macros: { c: 24, p: 9, g: 1 } },
  { id: "pinto_beans_broth", name: "Feijão carioca (só caldo 1 concha)", baseUnit: "1 concha", aliases: ["caldo carioca"], tags: ["vegano", "vegetariano"], category: "Leguminosas", kcal: 80, macros: { c: 12, p: 5, g: 1 } },
  { id: "white_beans", name: "Feijão branco (1 concha)", baseUnit: "1 concha", aliases: ["feijao branco"], tags: ["vegano", "vegetariano"], category: "Leguminosas", kcal: 140, macros: { c: 25, p: 9, g: 1 } },
  { id: "black_eyed_peas", name: "Feijão fradinho (1 concha)", baseUnit: "1 concha", aliases: ["feijao fradinho"], tags: ["vegano", "vegetariano"], category: "Leguminosas", kcal: 135, macros: { c: 23, p: 9, g: 1 } },
  { id: "lentils_cooked", name: "Lentilha cozida (1 concha)", baseUnit: "1 concha", aliases: ["lentilha"], tags: ["vegano", "vegetariano"], category: "Leguminosas", kcal: 115, macros: { c: 20, p: 9, g: 0.5 } },
  { id: "chickpeas_cooked", name: "Grão de bico cozido (100g)", baseUnit: "100g", aliases: ["grao de bico"], tags: ["vegano", "vegetariano"], category: "Leguminosas", kcal: 164, macros: { c: 27, p: 9, g: 2.5 } },
  { id: "peas_fresh", name: "Ervilha fresca (100g)", baseUnit: "100g", aliases: ["ervilha"], tags: ["vegano", "vegetariano"], category: "Leguminosas", kcal: 81, macros: { c: 14, p: 5, g: 0.4 } },
  { id: "soybeans_cooked", name: "Soja cozida (100g)", baseUnit: "100g", aliases: ["soja", "grao"], tags: ["vegano", "vegetariano", "soja"], category: "Leguminosas", kcal: 173, macros: { c: 10, p: 17, g: 9 } },
  { id: "edamame", name: "Edamame (100g)", baseUnit: "100g", aliases: ["edamame", "soja verde"], tags: ["vegano", "vegetariano", "soja"], category: "Leguminosas", kcal: 121, macros: { c: 9, p: 12, g: 5 } },

  // --- CARBOIDRATOS (Arroz, Massas, Pães, Raízes) ---
  { id: "rice_white_cooked", name: "Arroz branco coz. (100g)", baseUnit: "100g", aliases: ["arroz"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 130, macros: { c: 28, p: 2.5, g: 0.2 } },
  { id: "rice_brown_cooked", name: "Arroz integral coz. (100g)", baseUnit: "100g", aliases: ["arroz integral"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 112, macros: { c: 24, p: 2.5, g: 1 } },
  { id: "rice_parboiled", name: "Arroz parboilizado coz. (100g)", baseUnit: "100g", aliases: ["arroz parboilizado"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 123, macros: { c: 26, p: 2.5, g: 0.5 } },
  { id: "rice_7_grains", name: "Arroz 7 grãos (100g)", baseUnit: "100g", aliases: ["arroz graos", "multi graos"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 120, macros: { c: 23, p: 4, g: 1.5 } },
  { id: "pasta_whole", name: "Macarrão integral coz. (100g)", baseUnit: "100g", aliases: ["macarrao", "massa"], tags: ["vegano", "vegetariano", "gluten", "trigo"], category: "Carboidratos", kcal: 124, macros: { c: 26, p: 5, g: 1 } },
  { id: "pasta_regular", name: "Macarrão comum coz. (100g)", baseUnit: "100g", aliases: ["macarrao branco"], tags: ["vegano", "vegetariano", "gluten", "trigo"], category: "Carboidratos", kcal: 157, macros: { c: 31, p: 5, g: 1 } },
  { id: "pasta_rice", name: "Macarrão de arroz (100g)", baseUnit: "100g", aliases: ["macarrao sem gluten", "bifum"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 109, macros: { c: 24, p: 1, g: 0 } },
  { id: "quinoa_cooked", name: "Quinoa cozida (100g)", baseUnit: "100g", aliases: ["quinoa"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 120, macros: { c: 21, p: 4, g: 2 } },
  { id: "corn_couscous", name: "Cuscuz de milho (100g)", baseUnit: "100g", aliases: ["cuscuz", "milho"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 112, macros: { c: 24, p: 2, g: 0.5 } },
  { id: "corn_green", name: "Milho verde (1 espiga/100g)", baseUnit: "100g", aliases: ["milho", "espiga"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 108, macros: { c: 22, p: 3, g: 1 } },
  { id: "oats_flakes", name: "Aveia em flocos (30g)", baseUnit: "30g", aliases: ["aveia"], tags: ["vegano", "vegetariano", "gluten"], category: "Carboidratos", kcal: 118, macros: { c: 17, p: 4.5, g: 2.5 } },
  { id: "granola_sugar_free", name: "Granola s/ açúcar (30g)", baseUnit: "30g", aliases: ["granola diet"], tags: ["vegano", "vegetariano", "gluten", "nuts"], category: "Carboidratos", kcal: 130, macros: { c: 19, p: 4, g: 5 } },
  { id: "cereal_breakfast", name: "Cereal matinal (30g)", baseUnit: "30g", aliases: ["sucrilhos", "corn flakes"], tags: ["vegetariano"], category: "Carboidratos", kcal: 115, macros: { c: 26, p: 2, g: 0.5 } },
  { id: "bread_white", name: "Pão de forma branco (2 fatias)", baseUnit: "50g", aliases: ["pao branco", "pao de forma"], tags: ["vegetariano", "gluten", "trigo"], category: "Carboidratos", kcal: 135, macros: { c: 26, p: 4, g: 1 } },
  { id: "cheese_bread", name: "Pão de queijo (1 un média 50g)", baseUnit: "50g", aliases: ["pao de queijo"], tags: ["vegetariano", "lactose", "laticinio", "ovo"], category: "Carboidratos", kcal: 135, macros: { c: 15, p: 3, g: 7 } },
  { id: "crepioca", name: "Crepioca (1 ovo + 2 col. tapioca)", baseUnit: "1 un", aliases: ["crepioca"], tags: ["vegetariano", "ovo"], category: "Carboidratos", kcal: 155, macros: { c: 15, p: 7, g: 6 } },
  { id: "pancake_whole", name: "Panqueca integral (1 un)", baseUnit: "1 un", aliases: ["panqueca", "massa"], tags: ["vegetariano", "gluten", "trigo", "ovo"], category: "Carboidratos", kcal: 95, macros: { c: 12, p: 4, g: 3 } },
  { id: "sweet_potato_cooked", name: "Batata doce cozida (100g)", baseUnit: "100g", aliases: ["batata doce"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 86, macros: { c: 20, p: 1, g: 0.1 } },
  { id: "potato_cooked", name: "Batata inglesa cozida (100g)", baseUnit: "100g", aliases: ["batata"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 87, macros: { c: 20, p: 2, g: 0.1 } },
  { id: "potato_roasted", name: "Batata assada (100g)", baseUnit: "100g", aliases: ["batata rustica"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 93, macros: { c: 21, p: 2, g: 0.1 } },
  { id: "potato_saute", name: "Batata sautée (100g)", baseUnit: "100g", aliases: ["batata saute", "manteiga"], tags: ["vegetariano", "lactose", "laticinio"], category: "Carboidratos", kcal: 120, macros: { c: 19, p: 2, g: 4 } },
  { id: "potato_mash", name: "Purê de batata (100g)", baseUnit: "100g", aliases: ["pure"], tags: ["vegetariano", "lactose", "laticinio"], category: "Carboidratos", kcal: 110, macros: { c: 16, p: 2, g: 4 } },
  { id: "cassava_cooked", name: "Mandioca cozida (100g)", baseUnit: "100g", aliases: ["aipim", "macaxeira"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 125, macros: { c: 30, p: 1, g: 0 } },
  { id: "cassava_fried", name: "Mandioca frita (100g)", baseUnit: "100g", aliases: ["aipim frito"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 300, macros: { c: 35, p: 1, g: 15 } },
  { id: "yam_cooked", name: "Inhame cozido (100g)", baseUnit: "100g", aliases: ["inhame"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 118, macros: { c: 27, p: 1.5, g: 0.1 } },
  { id: "cara_cooked", name: "Cará cozido (100g)", baseUnit: "100g", aliases: ["cara"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 118, macros: { c: 27, p: 1.5, g: 0.1 } },
  { id: "arracacha_cooked", name: "Mandioquinha coz. (100g)", baseUnit: "100g", aliases: ["batata baroa"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 80, macros: { c: 18, p: 1, g: 0.2 } },

  // --- FRUTAS ---
  { id: "banana_prata", name: "Banana prata (1 un)", baseUnit: "1 un", aliases: ["banana"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 90, macros: { c: 23, p: 1, g: 0 } },
  { id: "banana_nanica", name: "Banana nanica (1 un)", baseUnit: "1 un", aliases: ["banana"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 105, macros: { c: 27, p: 1, g: 0 } },
  { id: "banana_maca", name: "Banana maçã (1 un)", baseUnit: "1 un", aliases: ["banana"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 87, macros: { c: 22, p: 1, g: 0 } },
  { id: "apple_green", name: "Maçã verde (1 un)", baseUnit: "1 un", aliases: ["maca verde"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 70, macros: { c: 16, p: 0.5, g: 0 } },
  { id: "pear", name: "Pera (1 un)", baseUnit: "1 un", aliases: ["pera"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 80, macros: { c: 20, p: 0.5, g: 0 } },
  { id: "orange", name: "Laranja (1 un)", baseUnit: "1 un", aliases: ["laranja", "fruta"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 60, macros: { c: 15, p: 1, g: 0 } },
  { id: "tangerine", name: "Tangerina (1 un)", baseUnit: "1 un", aliases: ["mexerica", "ponkan"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 50, macros: { c: 13, p: 1, g: 0 } },
  { id: "pineapple", name: "Abacaxi (1 fatia 100g)", baseUnit: "1 fatia", aliases: ["abacaxi"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 48, macros: { c: 12, p: 0.5, g: 0 } },
  { id: "watermelon", name: "Melancia (1 fatia 200g)", baseUnit: "1 fatia", aliases: ["melancia"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 60, macros: { c: 15, p: 1, g: 0 } },
  { id: "melon", name: "Melão (1 fatia 150g)", baseUnit: "1 fatia", aliases: ["melao"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 50, macros: { c: 12, p: 1, g: 0 } },
  { id: "mango", name: "Manga (1/2 un 100g)", baseUnit: "100g", aliases: ["manga"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 60, macros: { c: 15, p: 0.5, g: 0 } },
  { id: "grape", name: "Uva (1 cacho pego 100g)", baseUnit: "100g", aliases: ["uva"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 69, macros: { c: 18, p: 0.5, g: 0 } },
  { id: "kiwi", name: "Kiwi (1 un)", baseUnit: "1 un", aliases: ["kiwi"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 42, macros: { c: 10, p: 0.8, g: 0.4 } },
  { id: "coconut_fresh", name: "Coco fresco (50g)", baseUnit: "50g", aliases: ["coco polpa"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 177, macros: { c: 7, p: 1.5, g: 16 } },
  { id: "acai", name: "Açaí polpa pura (100g)", baseUnit: "100g", aliases: ["acai sem xarope"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 60, macros: { c: 6, p: 1, g: 4 } },

  // --- VEGETAIS (Saladas, legumes) ---
  { id: "salad_leaves", name: "Salada de folhas mistas", baseUnit: "à vontade", aliases: ["folhas"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 15, macros: { c: 2, p: 1, g: 0 } },
  { id: "lettuce_iceberg", name: "Alface americana", baseUnit: "à vontade", aliases: ["alface"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 10, macros: { c: 2, p: 1, g: 0 } },
  { id: "arugula", name: "Rúcula", baseUnit: "à vontade", aliases: ["rucula"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 10, macros: { c: 1, p: 1, g: 0 } },
  { id: "spinach_sauteed", name: "Espinafre refogado (2 col. sopa)", baseUnit: "2 col.", aliases: ["espinafre"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 30, macros: { c: 2, p: 2, g: 1.5 } },
  { id: "kale_sauteed", name: "Couve refogada (2 col. sopa)", baseUnit: "2 col.", aliases: ["couve", "manteiga"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 35, macros: { c: 3, p: 2, g: 1.5 } },
  { id: "broccoli_cooked", name: "Brócolis cozido (100g)", baseUnit: "100g", aliases: ["brocolis"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 35, macros: { c: 6, p: 3, g: 0.5 } },
  { id: "cauliflower_cooked", name: "Couve-flor cozida (100g)", baseUnit: "100g", aliases: ["couve flor"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 25, macros: { c: 5, p: 2, g: 0 } },
  { id: "zucchini_sauteed", name: "Abobrinha refogada (100g)", baseUnit: "100g", aliases: ["abobrinha"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 30, macros: { c: 4, p: 1, g: 1.5 } },
  { id: "eggplant_sauteed", name: "Berinjela refogada (100g)", baseUnit: "100g", aliases: ["berinjela"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 45, macros: { c: 6, p: 1, g: 2 } },
  { id: "chayote_sauteed", name: "Chuchu refogado (100g)", baseUnit: "100g", aliases: ["chuchu"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 30, macros: { c: 5, p: 0.5, g: 1 } },
  { id: "carrot_cooked", name: "Cenoura cozida (100g)", baseUnit: "100g", aliases: ["cenoura"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 35, macros: { c: 8, p: 1, g: 0 } },
  { id: "carrot_grated", name: "Cenoura ralada (100g)", baseUnit: "100g", aliases: ["cenoura crua"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 41, macros: { c: 9, p: 1, g: 0 } },
  { id: "beet_cooked", name: "Beterraba cozida (100g)", baseUnit: "100g", aliases: ["beterraba"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 44, macros: { c: 10, p: 1.5, g: 0 } },
  { id: "tomato", name: "Tomate (1 un)", baseUnit: "1 un", aliases: ["tomate cru"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 20, macros: { c: 4, p: 1, g: 0 } },
  { id: "cucumber", name: "Pepino (1/2 un)", baseUnit: "100g", aliases: ["pepino"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 15, macros: { c: 3, p: 0.5, g: 0 } },
  { id: "bell_pepper", name: "Pimentão (1/2 un)", baseUnit: "50g", aliases: ["pimentao"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 15, macros: { c: 3, p: 0.5, g: 0 } },
  { id: "green_beans", name: "Vagem (100g)", baseUnit: "100g", aliases: ["vagem"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 31, macros: { c: 7, p: 2, g: 0 } },
  { id: "asparagus_grilled", name: "Aspargos grelhados (100g)", baseUnit: "100g", aliases: ["aspargo"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 25, macros: { c: 4, p: 2.5, g: 0.5 } },
  { id: "heart_of_palm", name: "Palmito (100g)", baseUnit: "100g", aliases: ["palmito pupunha"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 28, macros: { c: 5, p: 2, g: 0 } },
  { id: "mushroom_sauteed", name: "Cogumelo refogado (100g)", baseUnit: "100g", aliases: ["champignon", "shimeji", "shitake"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 45, macros: { c: 4, p: 3, g: 2 } },

  // --- ÓLEOS, GORDURAS, CASTANHAS E SEMENTES ---
  { id: "coconut_oil", name: "Óleo de coco (1 col. sopa)", baseUnit: "1 col. sopa", aliases: ["oleo de coco"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 117, macros: { c: 0, p: 0, g: 13 } },
  { id: "sesame_oil", name: "Óleo de gergelim (1 col. sopa)", baseUnit: "1 col. sopa", aliases: ["oleo gergelim"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 120, macros: { c: 0, p: 0, g: 13.5 } },
  { id: "ghee_butter", name: "Manteiga Ghee (1 col. sopa)", baseUnit: "1 col. sopa", aliases: ["manteiga clarificada", "ghee"], tags: ["laticinio", "vegetariano"], category: "Gorduras/Extras", kcal: 112, macros: { c: 0, p: 0, g: 12.5 } },
  { id: "peanut_butter_whole", name: "Pasta de amendoim int. (1 col. sopa)", baseUnit: "15g", aliases: ["pasta amendoim"], tags: ["vegano", "vegetariano", "amendoim"], category: "Gorduras/Extras", kcal: 90, macros: { c: 3, p: 4, g: 8 } },
  { id: "cashew_butter", name: "Pasta de castanha (1 col. sopa)", baseUnit: "15g", aliases: ["pasta castanha", "caju"], tags: ["vegano", "vegetariano", "nuts"], category: "Gorduras/Extras", kcal: 95, macros: { c: 4, p: 3, g: 8 } },
  { id: "almond_butter", name: "Pasta de amêndoa (1 col. sopa)", baseUnit: "15g", aliases: ["pasta amendoa"], tags: ["vegano", "vegetariano", "nuts"], category: "Gorduras/Extras", kcal: 95, macros: { c: 3, p: 3, g: 9 } },
  { id: "cream_cheese", name: "Cream cheese (1 col. sopa)", baseUnit: "15g", aliases: ["queijo cremoso"], tags: ["lactose", "laticinio", "vegetariano"], category: "Gorduras/Extras", kcal: 50, macros: { c: 1, p: 1, g: 5 } },
  { id: "heavy_cream_light", name: "Creme de leite light (2 col. sopa)", baseUnit: "30g", aliases: ["creme de leite"], tags: ["lactose", "laticinio", "vegetariano"], category: "Gorduras/Extras", kcal: 45, macros: { c: 1.5, p: 1, g: 4 } },
  { id: "mayonnaise", name: "Maionese trad. (1 col. sopa)", baseUnit: "12g", aliases: ["maionese"], tags: ["vegetariano", "ovo", "soja"], category: "Gorduras/Extras", kcal: 40, macros: { c: 1, p: 0, g: 4 } },
  { id: "mayonnaise_light", name: "Maionese light (1 col. sopa)", baseUnit: "12g", aliases: ["maionese light"], tags: ["vegetariano", "ovo", "soja"], category: "Gorduras/Extras", kcal: 25, macros: { c: 2, p: 0, g: 2 } },
  { id: "brazil_nut", name: "Castanha do Pará (2 un)", baseUnit: "10g", aliases: ["castanha do brasil", "para"], tags: ["vegano", "vegetariano", "nuts"], category: "Gorduras/Extras", kcal: 65, macros: { c: 1, p: 1.5, g: 6.5 } },
  { id: "cashew_nut", name: "Castanha de Caju (15g)", baseUnit: "15g", aliases: ["caju"], tags: ["vegano", "vegetariano", "nuts"], category: "Gorduras/Extras", kcal: 85, macros: { c: 4, p: 2.5, g: 7 } },
  { id: "almonds", name: "Amêndoas (15g)", baseUnit: "15g", aliases: ["amendoa"], tags: ["vegano", "vegetariano", "nuts"], category: "Gorduras/Extras", kcal: 86, macros: { c: 3, p: 3, g: 7.5 } },
  { id: "walnuts", name: "Nozes (15g)", baseUnit: "15g", aliases: ["nozes", "noz"], tags: ["vegano", "vegetariano", "nuts"], category: "Gorduras/Extras", kcal: 100, macros: { c: 2, p: 2, g: 10 } },
  { id: "macadamia", name: "Macadâmia (15g)", baseUnit: "15g", aliases: ["macadamia"], tags: ["vegano", "vegetariano", "nuts"], category: "Gorduras/Extras", kcal: 110, macros: { c: 2, p: 1, g: 11 } },
  { id: "pistachio", name: "Pistache (15g)", baseUnit: "15g", aliases: ["pistache"], tags: ["vegano", "vegetariano", "nuts"], category: "Gorduras/Extras", kcal: 85, macros: { c: 4, p: 3, g: 6.5 } },
  { id: "peanut_roasted", name: "Amendoim torrado (15g)", baseUnit: "15g", aliases: ["amendoim"], tags: ["vegano", "vegetariano", "amendoim"], category: "Gorduras/Extras", kcal: 90, macros: { c: 3, p: 4, g: 7.5 } },
  { id: "pumpkin_seed", name: "Semente de abóbora (1 col. sopa)", baseUnit: "10g", aliases: ["pepita"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 55, macros: { c: 1.5, p: 3, g: 4.5 } },
  { id: "sunflower_seed", name: "Semente de girassol (1 col. sopa)", baseUnit: "10g", aliases: ["girassol"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 60, macros: { c: 2, p: 2, g: 5 } },
  { id: "chia_seed", name: "Chia em grãos (1 col. sopa)", baseUnit: "10g", aliases: ["chia"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 50, macros: { c: 4, p: 1.5, g: 3 } },
  { id: "flaxseed_golden", name: "Linhaça dourada (1 col. sopa)", baseUnit: "10g", aliases: ["linhaca", "dourada"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 55, macros: { c: 3, p: 2, g: 4 } },
  { id: "flaxseed_brown", name: "Linhaça marrom (1 col. sopa)", baseUnit: "10g", aliases: ["linhaca", "marrom"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 55, macros: { c: 3, p: 2, g: 4 } },
  { id: "sesame_seed", name: "Gergelim (1 col. sopa)", baseUnit: "10g", aliases: ["gergelim"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 60, macros: { c: 2, p: 2, g: 5 } },
  { id: "coconut_grated_dry", name: "Coco ralado seco (1 col. sopa)", baseUnit: "10g", aliases: ["coco seco"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 65, macros: { c: 2, p: 0.5, g: 6 } },
  { id: "coconut_grated_fresh", name: "Coco ralado fresco (1 col. sopa)", baseUnit: "15g", aliases: ["coco fresco"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 55, macros: { c: 2, p: 0.5, g: 5 } },

  // --- SUPLEMENTOS ---
  { id: "whey_isolate", name: "Whey Isolado (1 scoop 30g)", baseUnit: "30g", aliases: ["whey", "isolado", "proteina"], tags: ["laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 110, macros: { c: 1, p: 26, g: 0.5 } },
  { id: "whey_vegan", name: "Proteína Vegana (1 scoop 30g)", baseUnit: "30g", aliases: ["whey vegano", "plant", "proteina"], tags: ["vegano", "vegetariano", "soja"], category: "Proteínas e Laticínios", kcal: 120, macros: { c: 4, p: 22, g: 2 } },
  { id: "albumin", name: "Albumina (1 scoop 30g)", baseUnit: "30g", aliases: ["albumina", "clara", "ovo"], tags: ["ovo", "vegetariano"], category: "Proteínas e Laticínios", kcal: 115, macros: { c: 2, p: 24, g: 0 } },
  { id: "casein", name: "Caseína (1 scoop 30g)", baseUnit: "30g", aliases: ["caseina", "proteina lenta"], tags: ["lactose", "laticinio", "vegetariano"], category: "Proteínas e Laticínios", kcal: 120, macros: { c: 3, p: 24, g: 1 } },
  { id: "creatine", name: "Creatina (5g)", baseUnit: "5g", aliases: ["creatina"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 0, macros: { c: 0, p: 0, g: 0 } },
  { id: "bcaa", name: "BCAA em pó (5g)", baseUnit: "5g", aliases: ["bcaa", "aminoacido"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 20, macros: { c: 0, p: 5, g: 0 } },
  { id: "glutamine", name: "Glutamina (5g)", baseUnit: "5g", aliases: ["glutamina"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 20, macros: { c: 0, p: 5, g: 0 } },

  // --- BEBIDAS (Chás, Sucos, Cafés, Álcool) ---
  { id: "coffee_black", name: "Café preto s/ açúcar (1 xíc.)", baseUnit: "1 xicara", aliases: ["cafe preto", "puro"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 0, macros: { c: 0, p: 0, g: 0 } },
  { id: "coffee_milk", name: "Café c/ leite (1 xíc. 150ml)", baseUnit: "150ml", aliases: ["pingado", "media"], tags: ["lactose", "laticinio", "vegetariano"], category: "Gorduras/Extras", kcal: 60, macros: { c: 5, p: 3, g: 3 } },
  { id: "coffee_plant_milk", name: "Café c/ leite vegetal (150ml)", baseUnit: "150ml", aliases: ["cafe amendoas", "aveia"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 25, macros: { c: 1, p: 1, g: 2 } },
  { id: "green_tea", name: "Chá verde s/ açúcar (1 xíc.)", baseUnit: "1 xicara", aliases: ["cha verde"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 0, macros: { c: 0, p: 0, g: 0 } },
  { id: "mate_tea", name: "Chá mate s/ açúcar (1 xíc.)", baseUnit: "1 xicara", aliases: ["mate"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 0, macros: { c: 0, p: 0, g: 0 } },
  { id: "chamomile_tea", name: "Chá de camomila (1 xíc.)", baseUnit: "1 xicara", aliases: ["camomila"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 0, macros: { c: 0, p: 0, g: 0 } },
  { id: "orange_juice", name: "Suco de laranja nat. (200ml)", baseUnit: "200ml", aliases: ["suco laranja"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 90, macros: { c: 22, p: 1.5, g: 0 } },
  { id: "lemon_juice", name: "Suco de limão s/ açúcar (200ml)", baseUnit: "200ml", aliases: ["limonada"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 10, macros: { c: 3, p: 0.1, g: 0 } },
  { id: "green_juice", name: "Suco verde/detox (200ml)", baseUnit: "200ml", aliases: ["suco detox"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 65, macros: { c: 15, p: 1, g: 0 } },
  { id: "coconut_water", name: "Água de coco (200ml)", baseUnit: "200ml", aliases: ["agua de coco"], tags: ["vegano", "vegetariano"], category: "Vegetais e Frutas", kcal: 45, macros: { c: 11, p: 0, g: 0 } },
  { id: "beer", name: "Cerveja pilsen (1 lata 350ml)", baseUnit: "350ml", aliases: ["cerveja", "alcool"], tags: ["vegano", "vegetariano", "gluten"], category: "Carboidratos", kcal: 150, macros: { c: 12, p: 1, g: 0 } },
  { id: "wine_red", name: "Vinho tinto (1 taça 150ml)", baseUnit: "150ml", aliases: ["vinho tinto", "alcool"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 125, macros: { c: 4, p: 0.5, g: 0 } },
  { id: "wine_white", name: "Vinho branco (1 taça 150ml)", baseUnit: "150ml", aliases: ["vinho branco", "alcool"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 120, macros: { c: 4, p: 0.5, g: 0 } },
  { id: "distilled_spirits", name: "Destilado (1 dose 50ml)", baseUnit: "50ml", aliases: ["vodka", "gin", "whisky", "alcool"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 110, macros: { c: 0, p: 0, g: 0 } },

  // --- DOCES E AÇÚCARES ---
  { id: "honey", name: "Mel (1 col. sopa)", baseUnit: "15g", aliases: ["mel"], tags: ["vegetariano"], category: "Carboidratos", kcal: 46, macros: { c: 12, p: 0, g: 0 } },
  { id: "demerara_sugar", name: "Açúcar demerara (1 col. sopa)", baseUnit: "15g", aliases: ["acucar", "demerara"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 60, macros: { c: 15, p: 0, g: 0 } },
  { id: "coconut_sugar", name: "Açúcar de coco (1 col. sopa)", baseUnit: "15g", aliases: ["acucar de coco"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 55, macros: { c: 14, p: 0, g: 0 } },
  { id: "stevia", name: "Adoçante Stevia", baseUnit: "a gosto", aliases: ["stevia", "adocante"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 0, macros: { c: 0, p: 0, g: 0 } },
  { id: "xylitol", name: "Adoçante Xilitol (1 col. chá)", baseUnit: "5g", aliases: ["xilitol", "adocante"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 12, macros: { c: 5, p: 0, g: 0 } },
  { id: "erythritol", name: "Adoçante Eritritol (1 col. chá)", baseUnit: "5g", aliases: ["eritritol", "adocante"], tags: ["vegano", "vegetariano"], category: "Gorduras/Extras", kcal: 1, macros: { c: 5, p: 0, g: 0 } },
  { id: "diet_fruit_jelly", name: "Geleia diet (1 col. sopa)", baseUnit: "20g", aliases: ["geleia sem acucar"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 15, macros: { c: 4, p: 0, g: 0 } },
  { id: "dulce_de_leche", name: "Doce de leite (1 col. sopa)", baseUnit: "20g", aliases: ["doce de leite"], tags: ["lactose", "laticinio", "vegetariano"], category: "Carboidratos", kcal: 65, macros: { c: 12, p: 1.5, g: 1.5 } },
  { id: "nutella", name: "Creme de avelã (1 col. sopa)", baseUnit: "15g", aliases: ["nutella", "chocolate"], tags: ["lactose", "laticinio", "vegetariano", "nuts"], category: "Carboidratos", kcal: 80, macros: { c: 9, p: 1, g: 5 } },
  { id: "chocolate_70", name: "Chocolate 70% cacau (25g)", baseUnit: "25g", aliases: ["chocolate amargo", "cacau"], tags: ["vegetariano"], category: "Gorduras/Extras", kcal: 135, macros: { c: 11, p: 2, g: 10 } },
  { id: "chocolate_white", name: "Chocolate branco (25g)", baseUnit: "25g", aliases: ["chocolate branco"], tags: ["lactose", "laticinio", "vegetariano"], category: "Carboidratos", kcal: 135, macros: { c: 15, p: 1.5, g: 8 } },
  { id: "brigadeiro", name: "Brigadeiro trad. (1 un)", baseUnit: "15g", aliases: ["brigadeiro", "festa"], tags: ["lactose", "laticinio", "vegetariano"], category: "Carboidratos", kcal: 50, macros: { c: 8, p: 1, g: 2 } },
  { id: "beijinho", name: "Beijinho trad. (1 un)", baseUnit: "15g", aliases: ["beijinho", "festa", "coco"], tags: ["lactose", "laticinio", "vegetariano"], category: "Carboidratos", kcal: 55, macros: { c: 8, p: 1, g: 2.5 } },
  { id: "ice_cream_vanilla", name: "Sorvete creme (1 bola 60g)", baseUnit: "60g", aliases: ["sorvete"], tags: ["lactose", "laticinio", "vegetariano"], category: "Carboidratos", kcal: 125, macros: { c: 14, p: 2, g: 7 } },
  { id: "ice_cream_diet", name: "Sorvete diet/zero (1 bola 60g)", baseUnit: "60g", aliases: ["sorvete fit"], tags: ["lactose", "laticinio", "vegetariano"], category: "Carboidratos", kcal: 80, macros: { c: 10, p: 2, g: 3 } },
  { id: "fruit_popsicle", name: "Picolé de fruta d'água (1 un)", baseUnit: "1 un", aliases: ["picole", "fruta"], tags: ["vegano", "vegetariano"], category: "Carboidratos", kcal: 60, macros: { c: 15, p: 0, g: 0 } },
  { id: "cake_plain", name: "Bolo simples s/ recheio (1 fatia)", baseUnit: "60g", aliases: ["bolo caseiro"], tags: ["vegetariano", "lactose", "laticinio", "gluten", "trigo", "ovo"], category: "Carboidratos", kcal: 200, macros: { c: 30, p: 3, g: 8 } },
  { id: "cake_whole", name: "Bolo integral (1 fatia)", baseUnit: "60g", aliases: ["bolo aveia", "fit"], tags: ["vegetariano", "gluten", "trigo", "ovo"], category: "Carboidratos", kcal: 180, macros: { c: 25, p: 4, g: 7 } },
  { id: "cookie", name: "Biscoito tipo Cookie (1 un)", baseUnit: "20g", aliases: ["bolacha", "cookie"], tags: ["vegetariano", "lactose", "laticinio", "gluten", "trigo"], category: "Carboidratos", kcal: 100, macros: { c: 14, p: 1, g: 5 } },
  { id: "brownie", name: "Brownie de chocolate (1 pedaço)", baseUnit: "60g", aliases: ["brownie"], tags: ["vegetariano", "lactose", "laticinio", "gluten", "trigo", "ovo"], category: "Carboidratos", kcal: 250, macros: { c: 35, p: 3, g: 12 } },
  { id: "pancake_sweet", name: "Panqueca doce americana (1 un)", baseUnit: "40g", aliases: ["pancake"], tags: ["vegetariano", "lactose", "laticinio", "gluten", "trigo", "ovo"], category: "Carboidratos", kcal: 100, macros: { c: 15, p: 3, g: 3 } },
  { id: "waffle", name: "Waffle trad. (1 un)", baseUnit: "40g", aliases: ["waffle"], tags: ["vegetariano", "lactose", "laticinio", "gluten", "trigo", "ovo"], category: "Carboidratos", kcal: 120, macros: { c: 16, p: 3, g: 5 } }
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