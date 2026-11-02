// =========================================================================
// SCHEMA CLÍNICO DO QFA — FONTE ÚNICA
// -------------------------------------------------------------------------
// Extraído de src/components/QFAForm.tsx para que a validação de conclusão
// do onboarding e o formulário usem exatamente a mesma lista de itens.
// Nenhuma regra clínica nova é criada aqui: o conteúdo é idêntico ao que já
// era renderizado e persistido pelo formulário.
// =========================================================================

export interface QFASchemaItem {
  id: string;
  label: string;
  foodId?: string;
  tag?: string;
  legacySearch?: string;
}

export interface QFASchemaCategory {
  category: string;
  items: QFASchemaItem[];
}

export interface QFARichAnswer {
  id: string;
  value: string;
  label: string;
  category: string;
  foodId?: string;
  tag?: string;
  legacySearch?: string;
}

/**
 * Opções de frequência aceitas pelo formulário. Também são a allowlist usada
 * para validar respostas persistidas — um valor fora desta lista é inválido.
 */
export const QFA_OPTIONS = ['0', '1-3', '4-6', '7-9', '10 +'] as const;

export type QFAOption = (typeof QFA_OPTIONS)[number];

export const QFA_SCHEMA: QFASchemaCategory[] = [
  {
    category: 'Leites e Derivados',
    items: [
      { id: 'leite', label: 'Leite (copo de requeijão)', tag: 'lactose', legacySearch: 'leite' },
      { id: 'iogurte', label: 'Iogurte natural (copo de requeijão)', tag: 'lactose', legacySearch: 'iogurte' },
      { id: 'queijos', label: 'Queijos (1/2 fatia)', tag: 'lactose', legacySearch: 'queijo' },
      { id: 'requeijao', label: 'Requeijão / Creme de ricota etc (1,5 colher de sopa)', tag: 'lactose', legacySearch: 'requeijão' },
    ],
  },
  {
    category: 'Carnes e Ovos',
    items: [
      { id: 'ovo', label: 'Ovo cozido / mexido (2 unidades)', legacySearch: 'ovo' },
      { id: 'carne_vermelha', label: 'Carnes vermelhas (1 unidade)', legacySearch: 'carne' },
      { id: 'carne_porco', label: 'Carnes de Porco (1 fatia)', legacySearch: 'porco' },
      { id: 'frango', label: 'Frango - filé, sobrecoxa, peito (1 unidade)', legacySearch: 'frango' },
      { id: 'peixe', label: 'Peixe fresco / Frutos do Mar (1 unidade)', legacySearch: 'peixe' },
    ],
  },
  {
    category: 'Óleos',
    items: [
      { id: 'azeite', label: 'Azeite (1 colher de sopa)', legacySearch: 'azeite' },
      { id: 'bacon', label: 'Bacon e toucinho / banha (1/2 fatia)', legacySearch: 'bacon' },
      { id: 'frituras', label: 'Frituras', tag: 'ultraprocessado', legacySearch: 'frito' },
      { id: 'manteiga', label: 'Manteiga / Margarina (1/2 colher de sopa)', legacySearch: 'manteiga' },
      { id: 'maionese', label: 'Maionese (1/2 colher de sopa)', legacySearch: 'maionese' },
      { id: 'oleos_veg', label: 'Óleos vegetais (1 colher de sopa)', legacySearch: 'óleo' },
    ],
  },
  {
    category: 'Cereais e Leguminosas',
    items: [
      { id: 'arroz', label: 'Arroz Branco / Integral (4 colheres de sopa)', legacySearch: 'arroz' },
      { id: 'aveia', label: 'Aveia (4 colheres de sopa)', legacySearch: 'aveia' },
      { id: 'pao', label: 'Pão francês / Integral / Forma (1 unidade)', legacySearch: 'pão' },
      { id: 'macarrao', label: 'Macarrão (3 colheres e 1/2 de sopa)', legacySearch: 'macarrão' },
      { id: 'bolos', label: 'Bolos caseiros (1 fatia pequena)', legacySearch: 'bolo' },
      { id: 'leguminosas', label: 'Leguminosas (1 concha)', legacySearch: 'feijão' },
      { id: 'soja', label: 'Soja (1 colher de servir)', legacySearch: 'soja' },
      { id: 'oleaginosas', label: 'Oleaginosas (castanha/nozes/amendoim) (1 colher de sopa)', legacySearch: 'castanha' },
    ],
  },
  {
    category: 'Frutas/Verduras/Legumes',
    items: [
      { id: 'fruta', label: 'Fruta in natura (1 unidade/fatia)', legacySearch: 'fruta' },
      { id: 'folhosos', label: 'Folhosos (10 folhas)', legacySearch: 'alface' },
      { id: 'tuberculos', label: 'Tubérculos (batatas/cenoura/beterraba) (2 colheres de sopa)', legacySearch: 'batata' },
      { id: 'legumes', label: 'Legumes (abobora/chuchu/tomate/pepino) (2 colheres de sopa)', legacySearch: 'cenoura' },
    ],
  },
  {
    category: 'Petiscos embutidos Enlatados',
    items: [
      { id: 'snacks', label: 'Snacks - salgadinhos, bolachas, pizza, amendoim (1 pacote)', tag: 'ultraprocessado', legacySearch: 'salgadinho' },
      { id: 'instantaneos', label: 'Macarrão instantâneo / lasanha / Nuggets (1 pacote)', tag: 'ultraprocessado', legacySearch: 'instantâneo' },
      { id: 'embutidos', label: 'Embutidos em geral (presunto, mortadela etc) (2 fatias)', tag: 'ultraprocessado', legacySearch: 'presunto' },
      { id: 'enlatados', label: 'Enlatados (milho, ervilha, palmito, azeitona) (2 colheres de sopa)', tag: 'ultraprocessado', legacySearch: 'milho' },
    ],
  },
  {
    category: 'Sobremesas e Doces',
    items: [
      { id: 'sorvete', label: 'Sorvete (1 unidade ou 2 bolas)', tag: 'ultraprocessado', legacySearch: 'sorvete' },
      { id: 'tortas', label: 'Tortas e Doces Elaborados (1 fatia)', legacySearch: 'doce' },
      { id: 'chocolates', label: 'Chocolates (1 unidade)', legacySearch: 'chocolate' },
      { id: 'balas', label: 'Balas (1 unidade)', legacySearch: 'bala' },
    ],
  },
  {
    category: 'Bebidas',
    items: [
      { id: 'agua', label: 'Água (1 garrafa 510 ml)', legacySearch: 'água' },
      { id: 'cafe_s_acucar', label: 'Café sem açúcar (1 xícara café)', legacySearch: 'café' },
      { id: 'suco_natural_s_acucar', label: 'Suco Natural / Chás sem açúcar (copo de requeijão)', legacySearch: 'suco' },
      { id: 'refrigerante', label: 'Refrigerante normal (copo de requeijao)', tag: 'ultraprocessado', legacySearch: 'refrigerante' },
      { id: 'cafe_c_acucar', label: 'Café / Chá com açúcar (1 xícara café)', legacySearch: 'café' },
      { id: 'suco_natural_c_acucar', label: 'Suco Natural Adoçado (copo de requeijao)', legacySearch: 'suco' },
      { id: 'suco_caixinha', label: 'Sucos de Caixinha (copo de requeijao)', tag: 'ultraprocessado', legacySearch: 'suco' },
    ],
  },
];

export const QFA_ITEM_IDS: readonly string[] = QFA_SCHEMA.flatMap((section) =>
  section.items.map((item) => item.id)
);

export const QFA_ITEM_COUNT = QFA_ITEM_IDS.length;

export function isQfaOption(value: unknown): value is QFAOption {
  return typeof value === 'string' && (QFA_OPTIONS as readonly string[]).includes(value);
}
