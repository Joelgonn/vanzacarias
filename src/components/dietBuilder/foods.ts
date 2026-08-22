// ============================================================================
// BANCO VISUAL DE ALIMENTOS RÁPIDOS (dietBuilder)
// Extraído de DietBuilder.tsx — sem mudança de conteúdo.
// ============================================================================
import { FOOD_REGISTRY } from '@/lib/foodRegistry';

export interface QuickFoodConfigItem {
  id: string;
  label: string;
}

export interface QuickFoodCategoryConfig {
  category: string;
  items: QuickFoodConfigItem[];
}

const QUICK_FOODS_CONFIG: QuickFoodCategoryConfig[] = [
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

const quickFoods: QuickFoodCategoryConfig[] = QUICK_FOODS_CONFIG.map(cat => {
  const validItems = cat.items.filter(uiItem => {
    const exists = FOOD_REGISTRY.some(f => f.id === uiItem.id);
    if (!exists) console.warn(`[DietBuilder UI Warning] Alimento não encontrado no Registry: ${uiItem.id}`);
    return exists;
  });
  return { ...cat, items: validItems };
}).filter(cat => cat.items.length > 0);

// Lista de busca = FOOD_REGISTRY INTEIRO (216 itens), não só as categorias visuais.
// Usa o label amigável da categoria quando existir; senão, o nome do registry
// (isto expõe os 23 alimentos que antes eram inacessíveis na UI).
const quickFoodLabelById = new Map(quickFoods.flatMap(cat => cat.items).map(item => [item.id, item.label]));

const flatFoodsList = FOOD_REGISTRY.map(food => ({
  id: food.id,
  label: quickFoodLabelById.get(food.id) || food.name
})).sort((a, b) => a.label.localeCompare(b.label));

export { quickFoods, flatFoodsList, quickFoodLabelById };
