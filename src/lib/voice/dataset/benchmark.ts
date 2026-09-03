// VOZ-001.9-10 — Dataset de benchmark sem PII (sintético, derivado de FOOD_REGISTRY)
// Categorias: A fala cotidiana, B nutrição, C alimentos, D restrições, E quantidades, F números, G plurais, H frases compostas, I espontânea

export type SampleCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export interface BenchmarkSample {
  id: string;
  groundTruth: string;
  category: SampleCategory;
  description: string;
}

export const BENCHMARK_SAMPLES: BenchmarkSample[] = [
  // A — fala cotidiana (5)
  { id: 'A01', groundTruth: 'Oi, tudo bem?', category: 'A', description: 'saudação curta' },
  { id: 'A02', groundTruth: 'Estou com fome', category: 'A', description: 'frase curta' },
  { id: 'A03', groundTruth: 'Não consegui seguir a dieta hoje', category: 'A', description: 'frase longa espontânea' },
  { id: 'A04', groundTruth: 'Tô me sentindo ansiosa', category: 'A', description: 'contração coloquial' },
  { id: 'A05', groundTruth: 'Você pode me ajudar?', category: 'A', description: 'pergunta' },

  // B — nutrição (5)
  { id: 'B01', groundTruth: 'Quero trocar arroz por batata doce', category: 'B', description: 'substituição' },
  { id: 'B02', groundTruth: 'Como está minha evolução?', category: 'B', description: 'quick action' },
  { id: 'B03', groundTruth: 'Posso comer pão integral?', category: 'B', description: 'pergunta alimento' },
  { id: 'B04', groundTruth: 'Qual meu peso atual?', category: 'B', description: 'factual peso' },
  { id: 'B05', groundTruth: 'O que devo priorizar hoje?', category: 'B', description: 'premium action' },

  // C — alimentos (5)
  { id: 'C01', groundTruth: 'frango grelhado', category: 'C', description: 'proteína' },
  { id: 'C02', groundTruth: 'arroz branco', category: 'C', description: 'carboidrato' },
  { id: 'C03', groundTruth: 'iogurte natural', category: 'C', description: 'laticínio' },
  { id: 'C04', groundTruth: 'pasta de amendoim', category: 'C', description: 'alias com amendoim' },
  { id: 'C05', groundTruth: 'leite de aveia', category: 'C', description: 'alias vegetal' },

  // D — restrições (4)
  { id: 'D01', groundTruth: 'tenho alergia a leite', category: 'D', description: 'restrição lactose' },
  { id: 'D02', groundTruth: 'sou intolerante a glúten', category: 'D', description: 'glúten' },
  { id: 'D03', groundTruth: 'não posso comer açúcar', category: 'D', description: 'sugar tag' },
  { id: 'D04', groundTruth: 'posso comer leites vegetais?', category: 'D', description: 'SAFE_PHRASES plural' },

  // E — quantidades (4)
  { id: 'E01', groundTruth: 'cem gramas de frango', category: 'E', description: '100g' },
  { id: 'E02', groundTruth: 'duzentos mililitros de leite', category: 'E', description: '200ml' },
  { id: 'E03', groundTruth: 'uma colher de sopa de azeite', category: 'E', description: 'medida' },
  { id: 'E04', groundTruth: 'duas fatias de pão', category: 'E', description: 'fatia' },

  // F — números (7)
  { id: 'F01', groundTruth: 'um', category: 'F', description: '1' },
  { id: 'F02', groundTruth: 'dois', category: 'F', description: '2' },
  { id: 'F03', groundTruth: 'dez', category: 'F', description: '10' },
  { id: 'F04', groundTruth: 'cem', category: 'F', description: '100' },
  { id: 'F05', groundTruth: 'cento e cinquenta', category: 'F', description: '150' },
  { id: 'F06', groundTruth: 'duzentos', category: 'F', description: '200' },
  { id: 'F07', groundTruth: 'quinhentos', category: 'F', description: '500' },

  // G — plurais críticos para guardrail (6)
  { id: 'G01', groundTruth: 'leites', category: 'G', description: 'leite plural' },
  { id: 'G02', groundTruth: 'pães', category: 'G', description: 'pão plural' },
  { id: 'G03', groundTruth: 'iogurtes', category: 'G', description: 'iogurte plural' },
  { id: 'G04', groundTruth: 'açúcares', category: 'G', description: 'açúcar plural' },
  { id: 'G05', groundTruth: 'ovos', category: 'G', description: 'ovo plural' },
  { id: 'G06', groundTruth: 'carnes', category: 'G', description: 'carne plural' },

  // H — frases compostas (4)
  { id: 'H01', groundTruth: 'quero trocar dois pães por tapioca', category: 'H', description: 'quantidade + plural + substituição' },
  { id: 'H02', groundTruth: 'posso comer leites vegetais no café da manhã?', category: 'H', description: 'SAFE_PHRASES + plural + pergunta' },
  { id: 'H03', groundTruth: 'comi cem gramas de peixe e dois ovos', category: 'H', description: 'quantidades múltiplas' },
  { id: 'H04', groundTruth: 'meu peso é setenta quilos e minha altura é um e setenta', category: 'H', description: 'factual números' },

  // I — espontânea (4)
  { id: 'I01', groundTruth: 'ah, eu comi muito ontem, tipo, não sei', category: 'I', description: 'hesitação' },
  { id: 'I02', groundTruth: 'tô comendo muito pão, sabe?', category: 'I', description: 'coloquial + pão' },
  { id: 'I03', groundTruth: 'tipo, posso comer queijo vegano?', category: 'I', description: 'filler + SAFE_PHRASES' },
  { id: 'I04', groundTruth: 'sei lá, acho que exagerei nos beliscos', category: 'I', description: 'espontânea belisco' },
];

// Util para WER (Word Error Rate) — Levenshtein em palavras
export function computeWER(reference: string, hypothesis: string): number {
  const ref = reference.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const hyp = hypothesis.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
  const dp: number[][] = Array(ref.length + 1).fill(0).map(() => Array(hyp.length + 1).fill(0));
  for (let i = 0; i <= ref.length; i++) dp[i][0] = i;
  for (let j = 0; j <= hyp.length; j++) dp[0][j] = j;
  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      if (ref[i - 1] === hyp[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[ref.length][hyp.length] / ref.length;
}

// Teste de integração voz→pipeline (não mede só WER, mas guardrail)
export function simulateVoicePipeline(transcript: string): { sanitized: string; withinLimit: boolean; wouldPassGuardrail: boolean } {
  const sanitized = transcript.replace(/</g, '').replace(/>/g, '');
  const withinLimit = sanitized.length <= 500;
  // wouldPassGuardrail seria verificado via guardrailHelpers.extractFoodIdsFromText no teste de integração
  return { sanitized, withinLimit, wouldPassGuardrail: withinLimit };
}
