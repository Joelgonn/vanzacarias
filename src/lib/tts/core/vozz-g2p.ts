/**
 * TTS-006 — G2P vozz (Apache-2.0) — core puro, compartilhado por Node e browser.
 *
 * Movido de `engine/vozz-g2p.ts` para a camada core: dependência apenas de
 * `@pedrobef/vozz/g2p` (JS puro). `engine/vozz-g2p.ts` re-exporta daqui para
 * preservar o caminho público existente.
 *
 * Contrato: fonemiza texto PT-BR → IPA na convenção espeak-ng pt-br,
 * que é a mesma usada no treino do Kokoro-82M e validada pelo tokenizador
 * 115 tokens do onnx-community/Kokoro-82M-v1.0-ONNX.
 *
 * Inclui normalização embutida (números, unidades, horários, %)
 * via vozz/normalize.js. A normalização é aplicada por padrão.
 */

import { fonemizar as fonemizarVozz, normalizar as normalizarVozz } from "@pedrobef/vozz/g2p";

export interface VozzG2POptions {
  readonly normalizar?: boolean;
  readonly lexico?: Record<string, string> | null;
}

/**
 * Normaliza texto PT-BR (números, unidades, horários, %).
 * Exportada para testes e para camada de text normalization do sprint §6.
 *
 * TTS-007.1: adiciona normalização determinística de `kcal` → `quilocalorias`
 * antes de delegar ao vozz, pois vozz 0.2.7 não cobre `kcal` em ABREVIACOES.
 * A substituição é case-insensitive e cobre variações do sprint §2.
 */
export function normalizarTexto(texto: string, opts?: { expandirNumeros?: boolean; expandirSiglas?: boolean }): string {
  const pre = preNormalizarKcal(texto);
  return normalizarVozz(pre, opts);
}

/**
 * Pré-normalização determinística de kcal → quilocalorias.
 * Cobre: kcal, Kcal, KCAL, kcal., 500 kcal, 500kcal, 1.500 kcal, 2.133 kcal
 * Não usa LLM; regex pura, testável.
 */
function preNormalizarKcal(texto: string): string {
  let t = String(texto ?? "");
  t = t.replace(/(\d)\s*kcal\.?\b/gi, "$1 quilocalorias");
  t = t.replace(/\bkcal\.?\b/gi, "quilocalorias");
  return t;
}

/**
 * Fonemiza texto PT-BR para IPA compatível com Kokoro.
 * Wrapper fino sobre vozz/g2p com normalização opcional.
 * A camada kcal é aplicada antes da normalização vozz, independente de `normalizar`.
 */
export function vozzPhonemize(texto: string, opts: VozzG2POptions = {}): string {
  const { normalizar: usarNorm = true, lexico = null } = opts;
  const pre = preNormalizarKcal(texto);
  return fonemizarVozz(pre, { normalizar: usarNorm, lexico: lexico ?? undefined });
}

/**
 * Fonemização sem normalização — para comparação fonética pura (sem expansão).
 * TTS-007.1: ainda aplica kcal → quilocalorias mesmo em modo raw, para garantir
 * que a unidade seja sempre legível (kcal sem expansão gera "kkˈaʊ" ininteligível).
 */
export function vozzPhonemizeRaw(texto: string, lexico?: Record<string, string> | null): string {
  const pre = preNormalizarKcal(texto);
  return fonemizarVozz(pre, { normalizar: false, lexico: lexico ?? undefined });
}

/**
 * Verifica compatibilidade da saída vozz com o vocabulário Kokoro.
 * Retorna caracteres fora do vocabulário (deveriam ser vazios para 100% compatível).
 */
export function verificarCompatibilidade(
  fonemas: string,
  vocab: ReadonlyMap<string, number>,
): { compativel: boolean; foraVocab: string[] } {
  const fora = new Set<string>();
  for (const c of fonemas) {
    if (c === " " || c === "\n" || c === "\t") continue;
    if (!vocab.has(c) && c !== "$") fora.add(c);
  }
  return { compativel: fora.size === 0, foraVocab: [...fora] };
}