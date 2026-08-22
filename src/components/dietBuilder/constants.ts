// ============================================================================
// CONSTANTES DO CONSTRUTOR DE CARDÁPIO (dietBuilder)
// ============================================================================

export const ORDERED_DAYS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo"
];

export const MEAL_TYPES = [
  "Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde",
  "Jantar", "Ceia", "Pré-treino", "Pós-treino", "Refeição Livre"
];

export const MEAL_TIMES: Record<string, string[]> = {
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
