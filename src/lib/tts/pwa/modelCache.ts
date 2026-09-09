// TTS-PWA-001 — Cache/offline dos assets do TTS Browser Runtime.
//
// Ponto único de verdade para os recursos do TTS e a estratégia de cache,
// espelhando o padrão do modelo Vosk (src/lib/voice/pwa/modelCache.ts):
//
// 1. src/sw.ts (service worker / serwist) — regra CacheFirst dedicada, ANTES do
//    defaultCache (first-match wins), para TODAS as URLs do TTS browser:
//      /api/tts/models/*   (model_quantized.onnx, tokenizer.json, voices/pf_dora.bin)
//      /api/tts/wasm/*     (proxies .mjs e binários .wasm que o ort-web solicita)
//      /tts/worker.js      (bundle do Worker)
// 2. primeira obtenção — na primeira fetch bem-sucedida (200) de cada recurso
//    (feita pelo próprio Worker durante o load on-demand) → entra no cache;
// 3. reutilização — CacheFirst serve sempre do cache local (offline incluso);
// 4. versionamento — cache key é o cache NAME versionado ('tts-assets-v1'):
//    uma atualização de modelo/voice/tokenizer/worker/wasm troca a constante de
//    versão junto com os artefatos (unidade de deploy coerente); o SW limpa
//    caches antigos preservando a versão anterior utilizável (D07/D08).
//
// NÃO altera o Browser Runtime/Worker/AssetLoader (voice-synthesis intacto):
// o cache age na camada do service worker, na mesma URL que o worker já usa.
//
// OBS: URLs NÃO são versionadas por query (?v=...) como no Vosk porque o Worker
// do runtime resolve nomes FIXOS (model_quantized.onnx etc.) contra a baseUrl.
// O particionamento entre versões é feito pelo nome do cache (Cache Storage).

export const TTS_CACHE_PREFIX = "tts-assets";
/** Versão da unidade de assets TTS (modelo + voz + tokenizer + worker + wasm). */
export const TTS_CACHE_VERSION = "v1";
/** Nome do cache ativo. Trocar TTS_CACHE_VERSION invalida a unidade inteira. */
export const TTS_CACHE_NAME = `${TTS_CACHE_PREFIX}-${TTS_CACHE_VERSION}`;
/** Limite de entries (modelo + voz + tokenizer + worker + variantes wasm do ort). */
export const TTS_CACHE_MAX_ENTRIES = 16;
/** Idade máxima razoável (365 dias; a troca de versão é o mecanismo primário). */
export const TTS_CACHE_MAX_AGE_S = 365 * 24 * 60 * 60;

/** Caminhos FIXOS que o Browser Runtime (Worker) solicita (nomes na raiz da baseUrl). */
export const TTS_MODEL_PATH = "/api/tts/models/model_quantized.onnx";
export const TTS_TOKENIZER_PATH = "/api/tts/models/tokenizer.json";
export const TTS_VOICE_PATH = "/api/tts/models/voices/pf_dora.bin";
export const TTS_WORKER_PATH = "/tts/worker.js";

/** Prefixos que o runtime pode solicitar (assets + variantes wasm do ort-web). */
export const TTS_ASSET_PREFIXES: readonly string[] = [
  "/api/tts/models/",
  "/api/tts/wasm/",
  "/tts/worker.js",
];

/** Matcher usado pelo service worker: só os caminhos/pastas do TTS browser. */
export function isTtsAssetRequest(url: URL): boolean {
  if (url.pathname === TTS_WORKER_PATH) return true;
  return TTS_ASSET_PREFIXES.some((prefix) => prefix !== TTS_WORKER_PATH && url.pathname.startsWith(prefix));
}

/** Núcleo mínimo exigido para o TTS funcionar offline (verificação de integridade). */
export const TTS_CORE_ASSETS = [
  { path: TTS_MODEL_PATH, bytes: 92_361_116 },
  { path: TTS_TOKENIZER_PATH, bytes: 3_497 },
  { path: TTS_VOICE_PATH, bytes: 522_240 },
  { path: TTS_WORKER_PATH, bytes: 493_679 },
] as const;

/** Soma dos assets núcleo (~92,4 MB + ~1 MB de apoio), para relatório/UX. */
export const TTS_CORE_ASSETS_BYTES: number = TTS_CORE_ASSETS.reduce((sum, a) => sum + a.bytes, 0);

export function ttsAssetRequestUrl(path: string): string {
  const base = typeof location !== "undefined" && location.origin ? location.origin : "";
  return `${base}${path}`;
}

/**
 * Lista o que está realmente no cache TTS ativo (introspecção p/ testes/harness).
 * Browser-only; em SSR retorna lista vazia.
 */
export async function cachedTtsAssets(cacheName: string = TTS_CACHE_NAME): Promise<
  { path: string; bytes: number }[]
> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const out: { path: string; bytes: number }[] = [];
  for (const key of keys) {
    const res = await cache.match(key);
    if (!res) continue;
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    let bytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0;
    if (bytes === 0) {
      try {
        bytes = (await res.clone().arrayBuffer()).byteLength;
      } catch {
        bytes = 0;
      }
    }
    out.push({ path: new URL(key.url).pathname, bytes });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Prune de caches antigos do TTS. Mantém a versão ATUAL e UMA anterior
 * utilizável (D08: falha de upgrade não remove a versão válida anterior).
 * Chamado no evento `activate` do service worker.
 */
export async function pruneOldTtsCaches(keepCount = 2): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  const names = (await caches.keys()).filter((name) => name.startsWith(`${TTS_CACHE_PREFIX}-`));
  const removable = names.sort().slice(0, Math.max(0, names.length - keepCount));
  await Promise.all(removable.map((name) => caches.delete(name).catch(() => false)));
  return removable;
}

/** O cache está pronto (assets núcleo presentes)? Útil para primeiro uso/relatório. */
export async function isTtsCacheReady(cacheName: string = TTS_CACHE_NAME): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  const cache = await caches.open(cacheName).catch(() => null);
  if (!cache) return false;
  for (const asset of TTS_CORE_ASSETS) {
    const hit = await cache.match(ttsAssetRequestUrl(asset.path)).catch(() => null);
    if (!hit) return false;
  }
  return true;
}
