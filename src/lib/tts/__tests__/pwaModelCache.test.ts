import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// TTS-PWA-001 — cache/offline dos assets do TTS Browser Runtime.
// Cobrem: constantes, matcher dos caminhos reais, integridade do núcleo,
// guards de SSR (node sem `caches`) e a presença/ordem da regra no SW.
import {
  TTS_CACHE_PREFIX,
  TTS_CACHE_VERSION,
  TTS_CACHE_NAME,
  TTS_CACHE_MAX_ENTRIES,
  TTS_CACHE_MAX_AGE_S,
  TTS_MODEL_PATH,
  TTS_TOKENIZER_PATH,
  TTS_VOICE_PATH,
  TTS_WORKER_PATH,
  TTS_CORE_ASSETS,
  TTS_CORE_ASSETS_BYTES,
  isTtsAssetRequest,
  ttsAssetRequestUrl,
  cachedTtsAssets,
  isTtsCacheReady,
  pruneOldTtsCaches,
} from '../pwa/modelCache';

const swPath = path.join(process.cwd(), 'src/sw.ts');
const swContent = fs.readFileSync(swPath, 'utf8');

describe('TTS-PWA-001 — helpers de cache dos assets', () => {
  it('constantes: cache versionado "tts-assets-v1" e limites', () => {
    expect(TTS_CACHE_PREFIX).toBe('tts-assets');
    expect(TTS_CACHE_VERSION).toBe('v1');
    expect(TTS_CACHE_NAME).toBe('tts-assets-v1');
    expect(TTS_CACHE_MAX_ENTRIES).toBe(16);
    expect(TTS_CACHE_MAX_AGE_S).toBe(365 * 24 * 60 * 60);
  });

  it('caminhos dos assets do Browser Runtime (nomes fixos na raiz da baseUrl)', () => {
    expect(TTS_MODEL_PATH).toBe('/api/tts/models/model_quantized.onnx');
    expect(TTS_TOKENIZER_PATH).toBe('/api/tts/models/tokenizer.json');
    expect(TTS_VOICE_PATH).toBe('/api/tts/models/voices/pf_dora.bin');
    expect(TTS_WORKER_PATH).toBe('/tts/worker.js');
  });

  it('matcher casa os caminhos reais (models, wasm e worker)', () => {
    for (const url of [
      'https://app.local/api/tts/models/model_quantized.onnx',
      'https://app.local/api/tts/models/tokenizer.json',
      'https://app.local/api/tts/models/voices/pf_dora.bin',
      'https://app.local/api/tts/wasm/ort-wasm-simd-threaded.jsep.mjs',
      'https://app.local/api/tts/wasm/ort-wasm-simd-threaded.jsep.wasm',
      'https://app.local/tts/worker.js',
    ]) {
      expect(isTtsAssetRequest(new URL(url))).toBe(true);
    }
  });

  it('matcher NÃO casa outros pathnames (fora da unidade TTS)', () => {
    // O matcher do módulo é agnóstico a ORIGEM (pathname); o SW compõe com
    // `sameOrigin && isTtsAssetRequest(url)` (coberto abaixo) — por isso os
    // casos negativos aqui são pathnames same-origin fora da unidade.
    for (const url of [
      'https://app.local/api/tts',
      'https://app.local/api/tts/outros',
      'https://app.local/api/tts/models2/model.onnx',
      'https://app.local/tts/worker.js.map',
      'https://app.local/api/chat',
    ]) {
      expect(isTtsAssetRequest(new URL(url)), url).toBe(false);
    }
  });

  it('núcleo mínimo: ~92,4 MB (modelo) + apoio; soma coerente', () => {
    expect(TTS_CORE_ASSETS).toHaveLength(4);
    expect(TTS_CORE_ASSETS[0]!.path).toBe(TTS_MODEL_PATH);
    expect(TTS_CORE_ASSETS[0]!.bytes).toBe(92_361_116);
    expect(TTS_CORE_ASSETS_BYTES).toBe(92_361_116 + 3_497 + 522_240 + 493_679);
  });

  it('guards de SSR/node: sem `caches` não lança e reporta indisponível', async () => {
    await expect(cachedTtsAssets('qualquer')).resolves.toEqual([]);
    await expect(isTtsCacheReady('qualquer')).resolves.toBe(false);
    await expect(pruneOldTtsCaches()).resolves.toEqual([]);
    expect(ttsAssetRequestUrl(TTS_MODEL_PATH)).toContain(TTS_MODEL_PATH);
  });
});

describe('TTS-PWA-001 — regra no service worker (src/sw.ts)', () => {
  const ruleStart = swContent.indexOf('TTS_ASSETS_RUNTIME_CACHING');

  it('existe regra específica de runtime caching para os assets TTS', () => {
    expect(ruleStart).toBeGreaterThan(-1);
  });

  it('usa CacheFirst com cacheName dedicado "tts-assets-v1" e ExpirationPlugin', () => {
    expect(swContent).toMatch(/new CacheFirst/);
    expect(swContent).toMatch(/cacheName:\s*TTS_CACHE_NAME|cacheName:\s*"tts-assets-v1"/);
    expect(swContent).toMatch(/new ExpirationPlugin/);
    expect(swContent).toMatch(/maxAgeFrom:\s*"last-used"/);
    expect(swContent).toMatch(/TTS_CACHE_MAX_ENTRIES/);
  });

  it('matcher restrito aos caminhos TTS via isTtsAssetRequest', () => {
    expect(swContent).toMatch(/sameOrigin\s*&&\s*isTtsAssetRequest\(url\)/);
    expect(swContent).toMatch(/import[^;]*isTtsAssetRequest/);
  });

  it('regra GET ANTES do defaultCache (first-match wins) e sem segundo SW', () => {
    const defaultCacheIndex = swContent.indexOf('...defaultCache');
    expect(defaultCacheIndex).toBeGreaterThan(-1);
    expect(ruleStart).toBeLessThan(defaultCacheIndex);
    expect(swContent).toMatch(/method: "GET"/);
    // único Serwist e um único addEventListeners
    expect(swContent.match(/new Serwist\(/g)?.length).toBe(1);
  });

  it('activate limpa caches antigos preservando versões utilizáveis (prune)', () => {
    expect(swContent).toMatch(/pruneOldTtsCaches\(2\)/);
    expect(swContent).toMatch(/addEventListener\("activate"/);
  });
});
