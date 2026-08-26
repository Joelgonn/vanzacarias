export interface MacrosItem {
  carbo: number;
  proteina: number;
  gordura: number;
  kcal: number;
}

export interface SubstituicaoItem {
  nome: string;
  medida: string;
  macros?: MacrosItem;
}

export interface SubstituicaoGrupo {
  categoria: string;
  referencia?: {
    descricao: string;
    carbo?: number;
    proteina?: number;
    gordura?: number;
  };
  itens: SubstituicaoItem[];
}

export const SUBSTITUICOES_PADRAO: SubstituicaoGrupo[] = [
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
