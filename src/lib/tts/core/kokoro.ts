/**
 * TTS-006 — Núcleo puro Kokoro (core, sem node/onnxruntime).
 *
 * Constantes, tipagem e funções de tokenização/chunk permanecem idênticas ao
 * que era exportado por `engine/kokoro.ts` — o engine agora re-exporta daqui,
 * preservando a API pública (tests, dist/src/index.js, scripts).
 *
 * O único acesso a filesystem (`loadKokoroTokenizer`) fica no engine (Node);
 * aqui está o parser puro `parseKokoroTokenizer(json)` usado também pelo
 * browser (worker lê tokenizer.json via fetch).
 */

export const KOKORO_INFO = {
  model: "Kokoro-82M",
  modelId: "hexgrad/Kokoro-82M",
  modelVersion: "v1.0",
  onnxRepository: "onnx-community/Kokoro-82M-v1.0-ONNX",
  architecture: "StyleTTS2-like (82M params)",
  sampleRate: 24000,
  maxContext: 512,
  maxPhonemes: 510,
  voiceId: "pf_dora",
  voiceLanguage: "pt-br",
  weightLicense: "Apache-2.0",
  phonemizer: "vozz/g2p (Apache-2.0) via engine/browser runtime",
  phonemeFormat: "IPA com acentos de stress e pontuação preservada",
} as const;

export interface TokenizerVocab {
  readonly padToken: string;
  readonly tokens: ReadonlyMap<string, number>;
}

/** Nome do arquivo ONNX conforme a variante do modelo. */
export function kokoroModelFileFor(model: "fp32" | "q8"): string {
  return model === "q8" ? "model_quantized.onnx" : "model.onnx";
}

/** Interpreta o conteúdo de `tokenizer.json` (onnx-community Kokoro-82M). */
export function parseKokoroTokenizer(raw: string): TokenizerVocab {
  const tokenizer = JSON.parse(raw) as {
    model?: { vocab?: Record<string, number>; entities?: string[] };
    added_tokens?: Record<string, { id: number }>;
  };
  const tokens = new Map<string, number>();
  const entities = tokenizer.model?.entities ?? tokenizer.model?.vocab;
  if (!entities) {
    throw new Error("tokenizer.json sem vocabulário ('model.entities').");
  }
  for (const [char, id] of Object.entries(entities)) {
    tokens.set(char, id);
  }
  const padToken =
    Object.keys(tokens).find(
      (token) => token.startsWith("$") || token.startsWith("[PAD]") || token === "<pad>",
    ) ?? "$";
  return { padToken, tokens };
}

export function tokenizePhonemes(
  phonemes: string,
  vocab: ReadonlyMap<string, number>,
): { ids: number[]; dropped: string[] } {
  const ids: number[] = [];
  const dropped = new Set<string>();
  const padId = vocab.get("$");
  for (const char of phonemes) {
    const id = vocab.get(char);
    if (id === undefined || id === padId) {
      if (id === undefined) dropped.add(char);
      continue;
    }
    ids.push(id);
  }
  return { ids, dropped: [...dropped] };
}

export function chunkPhonemes(
  phonemes: string,
  maxPhonemes: number,
): string[] {
  const words = phonemes.split(/\s+/).filter((word) => word.length > 0);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if ([...candidate].length > maxPhonemes && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}