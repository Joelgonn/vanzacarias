// =========================================================================
// TIPOS
// =========================================================================

export type ActivityIntensity = {
  id: string;
  nomeExibicao: string;
  metValue: number;
  descricaoTooltip: string;
};

export type ActivityCategory = {
  nome: string;
  intensidades: ActivityIntensity[];
};

export interface Activity {
  id: string;
  type: string; // ex: caminhada_troc
  intensity: string; // ex: caminhada_moderada
  duration: number; // minutos
  calories?: number; // opcional (smartwatch)
}

// =========================================================================
// BASE DE ATIVIDADES (SEU MODELO COM TOOLTIPS PROFISSIONAIS)
// =========================================================================

export const ATIVIDADES_FISICAS_INTENCIONAIS: Record<string, ActivityCategory> = {
  caminhada_troc: {
    nome: "Caminhada & Trote",
    intensidades: [
      { id: "caminhada_lenta", nomeExibicao: "Caminhada Lenta", metValue: 2.2, descricaoTooltip: "💨 Respiração: normal | 🗣 Fala: conversa livre e até cantar | 🔥 Sensação: passeio relaxante, sem esforço." },
      { id: "caminhada_moderada", nomeExibicao: "Caminhada Moderada", metValue: 3.5, descricaoTooltip: "💨 Respiração: levemente acelerada | 🗣 Fala: frases completas com leve esforço | 🔥 Sensação: ativo, mas confortável." },
      { id: "caminhada_rapida", nomeExibicao: "Caminhada Rápida/Intensa", metValue: 5.0, descricaoTooltip: "💨 Respiração: acelerada | 🗣 Fala: frases curtas | 🔥 Sensação: esforço claro, já suando." },
      { id: "caminhada_subida", nomeExibicao: "Caminhada em Subida", metValue: 6.0, descricaoTooltip: "💨 Respiração: pesada | 🗣 Fala: difícil manter conversa | 🔥 Sensação: esforço alto, pernas exigidas." },
      { id: "troc_leve", nomeExibicao: "Trote/Corrida Leve", metValue: 6.5, descricaoTooltip: "💨 Respiração: acelerada constante | 🗣 Fala: frases curtas com pausas | 🔥 Sensação: corrida leve e controlada." }
    ]
  },

  corrida: {
    nome: "Corrida",
    intensidades: [
      { id: "corrida_moderada", nomeExibicao: "Corrida Moderada", metValue: 8.5, descricaoTooltip: "💨 Respiração: forte | 🗣 Fala: apenas frases curtas | 🔥 Sensação: esforço contínuo e moderado-alto." },
      { id: "corrida_intensa", nomeExibicao: "Corrida Intensa", metValue: 10.5, descricaoTooltip: "💨 Respiração: ofegante | 🗣 Fala: palavras isoladas | 🔥 Sensação: esforço máximo ou próximo disso." }
    ]
  },

  ciclismo: {
    nome: "Ciclismo",
    intensidades: [
      { id: "ciclismo_lazer", nomeExibicao: "Ciclismo Leve", metValue: 4.5, descricaoTooltip: "💨 Respiração: leve | 🗣 Fala: conversa tranquila | 🔥 Sensação: passeio confortável." },
      { id: "ciclismo_moderado", nomeExibicao: "Ciclismo Moderado", metValue: 6.5, descricaoTooltip: "💨 Respiração: moderada | 🗣 Fala: frases completas com leve esforço | 🔥 Sensação: ritmo constante." },
      { id: "ciclismo_intenso", nomeExibicao: "Ciclismo Intenso", metValue: 9.0, descricaoTooltip: "💨 Respiração: forte | 🗣 Fala: frases curtas | 🔥 Sensação: esforço alto, pernas queimando." }
    ]
  },

  natacao: {
    nome: "Natação",
    intensidades: [
      { id: "nado_lazer", nomeExibicao: "Nado Leve", metValue: 4.0, descricaoTooltip: "💨 Respiração: controlada | 🗣 Fala: normal fora da água | 🔥 Sensação: leve e relaxante." },
      { id: "nado_moderado", nomeExibicao: "Nado Moderado", metValue: 7.0, descricaoTooltip: "💨 Respiração: mais rápida entre braçadas | 🗣 Fala: leve esforço | 🔥 Sensação: ritmo constante." },
      { id: "nado_intenso", nomeExibicao: "Nado Intenso", metValue: 10.0, descricaoTooltip: "💨 Respiração: difícil de controlar | 🗣 Fala: esforço alto | 🔥 Sensação: exaustivo." }
    ]
  },

  forca_condicionamento: {
    nome: "Força & Condicionamento",
    intensidades: [
      { id: "musculacao_leve", nomeExibicao: "Musculação Leve", metValue: 3.0, descricaoTooltip: "💨 Respiração: leve | 🗣 Fala: normal | 🔥 Sensação: treino fácil, foco em técnica." },
      { id: "musculacao_moderada", nomeExibicao: "Musculação Moderada", metValue: 5.0, descricaoTooltip: "💨 Respiração: moderada | 🗣 Fala: frases completas com pausa | 🔥 Sensação: esforço controlado." },
      { id: "musculacao_intensa", nomeExibicao: "Musculação Intensa", metValue: 7.0, descricaoTooltip: "💨 Respiração: forte | 🗣 Fala: difícil entre séries | 🔥 Sensação: carga pesada, esforço alto." },
      { id: "funcional_intenso", nomeExibicao: "Funcional/HIIT", metValue: 9.0, descricaoTooltip: "💨 Respiração: intensa | 🗣 Fala: difícil | 🔥 Sensação: treino explosivo, muito desgaste." }
    ]
  },

  crossfit: {
    nome: "Crossfit",
    intensidades: [
      { id: "crossfit_moderado", nomeExibicao: "Treino Moderado", metValue: 6.0, descricaoTooltip: "💨 Respiração: moderada | 🗣 Fala: frases curtas | 🔥 Sensação: treino técnico ou ritmo controlado." },
      { id: "crossfit_intenso", nomeExibicao: "Treino Intenso", metValue: 8.5, descricaoTooltip: "💨 Respiração: ofegante | 🗣 Fala: quase impossível | 🔥 Sensação: intensidade máxima (WOD pesado)." }
    ]
  },

  pilates_yoga: {
    nome: "Pilates & Yoga",
    intensidades: [
      { id: "yoga_leve", nomeExibicao: "Yoga / Alongamento", metValue: 2.5, descricaoTooltip: "💨 Respiração: profunda e controlada | 🗣 Fala: normal | 🔥 Sensação: relaxamento e alongamento." },
      { id: "pilates_aparelho", nomeExibicao: "Pilates Aparelhos", metValue: 3.0, descricaoTooltip: "💨 Respiração: controlada | 🗣 Fala: normal | 🔥 Sensação: esforço leve com resistência." },
      { id: "pilates_solo", nomeExibicao: "Pilates Solo / Power Yoga", metValue: 4.0, descricaoTooltip: "💨 Respiração: moderada | 🗣 Fala: leve esforço | 🔥 Sensação: prática dinâmica e exigente." }
    ]
  },

  beach_tennis: {
    nome: "Beach Tennis & Tênis",
    intensidades: [
      { id: "tenis_aula", nomeExibicao: "Aula / Recreativo", metValue: 5.0, descricaoTooltip: "💨 Respiração: leve | 🗣 Fala: normal | 🔥 Sensação: jogo recreativo." },
      { id: "tenis_jogo", nomeExibicao: "Partida Intensa", metValue: 8.0, descricaoTooltip: "💨 Respiração: forte | 🗣 Fala: frases curtas | 🔥 Sensação: jogo intenso com muita movimentação." }
    ]
  },

  lutas: {
    nome: "Lutas & Artes Marciais",
    intensidades: [
      { id: "luta_tecnica", nomeExibicao: "Treino Técnico", metValue: 5.3, descricaoTooltip: "💨 Respiração: moderada | 🗣 Fala: possível entre pausas | 🔥 Sensação: treino técnico." },
      { id: "luta_combate", nomeExibicao: "Sparring / Combate", metValue: 10.3, descricaoTooltip: "💨 Respiração: ofegante | 🗣 Fala: difícil | 🔥 Sensação: combate intenso." }
    ]
  },

  danca: {
    nome: "Dança & Ritmos",
    intensidades: [
      { id: "danca_leve", nomeExibicao: "Ritmos Leves", metValue: 4.5, descricaoTooltip: "💨 Respiração: leve a moderada | 🗣 Fala: normal | 🔥 Sensação: ritmo leve e contínuo." },
      { id: "danca_intensa", nomeExibicao: "FitDance / Aeróbica", metValue: 7.3, descricaoTooltip: "💨 Respiração: acelerada | 🗣 Fala: frases curtas | 🔥 Sensação: aula intensa e energética." }
    ]
  },

  futebol: {
    nome: "Futebol",
    intensidades: [
      { id: "futebol_recreativo", nomeExibicao: "Pelada com Amigos", metValue: 7.0, descricaoTooltip: "💨 Respiração: moderada | 🗣 Fala: frases completas | 🔥 Sensação: jogo recreativo com pausas." },
      { id: "futebol_competitivo", nomeExibicao: "Partida Competitiva", metValue: 10.0, descricaoTooltip: "💨 Respiração: forte | 🗣 Fala: difícil | 🔥 Sensação: jogo competitivo e intenso." }
    ]
  }
};

// =========================================================================
// HELPERS
// =========================================================================

export function getMETValue(type: string, intensityId: string): number {
  const category = ATIVIDADES_FISICAS_INTENCIONAIS[type];
  if (!category) return 0;

  const intensity = category.intensidades.find(i => i.id === intensityId);
  if (!intensity) return 0;

  return intensity.metValue;
}

// =========================================================================
// CÁLCULO DE CALORIAS (MET)
// =========================================================================

export function calculateActivityKcal(activity: Activity, weight: number): number {
  // prioridade: valor do smartwatch
  if (activity.calories && activity.calories > 0) {
    return activity.calories;
  }

  const met = getMETValue(activity.type, activity.intensity);
  if (!met) return 0;

  const hours = activity.duration / 60;

  return met * weight * hours;
}

// =========================================================================
// TOTAL DO DIA
// =========================================================================

export function getTotalActivityKcal(
  activities: Activity[],
  weight: number
): number {
  if (!activities || activities.length === 0) return 0;

  return activities.reduce((total, activity) => {
    return total + calculateActivityKcal(activity, weight);
  }, 0);
}