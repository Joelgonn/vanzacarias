// VOZ-012.4 — F06: cache do modelo Vosk (PWA/service worker + HTTP).
//
// Ponto único de verdade para o recurso do modelo e a estratégia de cache.
// Usado por três lados:
// 1. vosk.ts (engine) — monta a URL versionada que o worker do vosk-browser baixa;
// 2. src/sw.ts (service worker / serwist) — regra CacheFirst restrita ao pathname;
// 3. next.config.ts — cabeçalho Cache-Control immutable para o mesmo pathname.
//
// Estratégia:
// - Recurso cacheado: SOMENTE o tar.gz do modelo Vosk PT-BR (32MB, mesma origem).
// - Quando entra no cache: na primeira fetch bem-sucedida (status 200) do worker.
// - Quando é reutilizado: CacheFirst serve sempre do cache local (offline incluso)
//   até o limite de idade; nunca volta à rede enquanto a entrada for válida.
// - Versionamento: o request usa `?v=<modelVersion>` (cache key versionado). Para
//   substituir o modelo numa futura atualização, basta mudar a versão/caminho —
//   gera uma nova entry no cache 'vosk-model' e a mais antiga é expurgada
//   (ExpirationPlugin maxEntries). Nunca editar o arquivo no mesmo pathname
//   mantendo a mesma versão (caches serviriam conteúdo antigo).

export const VOSK_MODEL_PATH = '/vosk-model-small-pt-0.3.tar.gz';
export const VOSK_MODEL_CACHE_NAME = 'vosk-model';
export const VOSK_MODEL_VERSION = '0.3';
// 90 dias: folga ampla para a janela de atualização; o expurgo por versão é o
// mecanismo primário de troca (maxEntries evicts a entry mais antiga).
export const VOSK_MODEL_CACHE_MAX_AGE_S = 90 * 24 * 60 * 60;
export const VOSK_MODEL_CACHE_MAX_ENTRIES = 2;

// Matcher usado pelo service worker: restrito ao pathname exato do modelo.
// O query string (`?v=...`) é intencionalmente mantido no cache key (não usamos
// ignoreSearch), tornando versões do modelo partições distintas do mesmo cache.
export function isVoskModelRequest(url: URL): boolean {
  return url.pathname === VOSK_MODEL_PATH;
}

// URL versionada que o vosk-browser realmente baixa. Idêntica por versão →
// reaproveita cache local (SW + HTTP browser). Versão nova → URL nova → cache
// novo e substituição limpa da entry anterior.
export function buildVoskModelRequestUrl(modelVersion: string = VOSK_MODEL_VERSION): string {
  return `${VOSK_MODEL_PATH}?v=${encodeURIComponent(modelVersion)}`;
}