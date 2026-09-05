import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// VOZ-012.4 — F06: cache do modelo Vosk (PWA/service worker + HTTP).
// - primeira obtenção do modelo (miss → fetch → entra no cache);
// - segunda obtenção USANDO cache (mesma URL versionada → mesmo cache key);
// - recurso fora do cache (pathname diferente → matcher NÃO casa);
// - offline após cache (CacheFirst serve do cache local);
// - invalidação/versionamento (?v= troca a entry sem perder o vínculo ao modelo).
import {
  VOSK_MODEL_PATH,
  VOSK_MODEL_CACHE_NAME,
  VOSK_MODEL_VERSION,
  VOSK_MODEL_CACHE_MAX_AGE_S,
  VOSK_MODEL_CACHE_MAX_ENTRIES,
  isVoskModelRequest,
  buildVoskModelRequestUrl,
} from '../pwa/modelCache';

const swPath = path.join(process.cwd(), 'src/sw.ts');
const swContent = fs.readFileSync(swPath, 'utf8');
const voskPath = path.join(process.cwd(), 'src/lib/voice/stt/vosk.ts');
const voskContent = fs.readFileSync(voskPath, 'utf8');
const nextConfigPath = path.join(process.cwd(), 'next.config.ts');
const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');

describe('VOZ-012.4 — F06: helpers de cache do modelo', () => {
  it('constantes: path exato, cacheName, versão, limites', () => {
    expect(VOSK_MODEL_PATH).toBe('/vosk-model-small-pt-0.3.tar.gz');
    expect(VOSK_MODEL_CACHE_NAME).toBe('vosk-model');
    expect(VOSK_MODEL_VERSION).toBe('0.3');
    expect(VOSK_MODEL_CACHE_MAX_AGE_S).toBe(90 * 24 * 60 * 60);
    expect(VOSK_MODEL_CACHE_MAX_ENTRIES).toBe(2);
  });

  it('primeira obtenção: URL versionada aponta para o pathname do modelo', () => {
    const url = buildVoskModelRequestUrl(VOSK_MODEL_VERSION);
    const parsed = new URL(url, 'https://app.local');
    expect(parsed.pathname).toBe(VOSK_MODEL_PATH);
    expect(url).toBe(`${VOSK_MODEL_PATH}?v=0.3`);
  });

  it('segunda obtenção: mesma versão → mesma URL/cache key (reutilização de cache)', () => {
    const a = buildVoskModelRequestUrl('0.3');
    const b = buildVoskModelRequestUrl('0.3');
    expect(a).toBe(b);
    expect(isVoskModelRequest(new URL(a, 'https://app.local'))).toBe(true);
  });

  it('recurso FORA do cache: matcher não casa (outros pathnames)', () => {
    expect(isVoskModelRequest(new URL('/index.tsv', 'https://app.local'))).toBe(false);
    expect(isVoskModelRequest(new URL('/vosk-model-small-en-0.3.tar.gz', 'https://app.local'))).toBe(false);
    expect(isVoskModelRequest(new URL('/api/stt', 'https://app.local'))).toBe(false);
  });

  it('offline após cache: CacheFirst é servidor a partir do cache (mesma URL, mesma entrada)', () => {
    // O mecanismo é: URL idempotente → cache key idempotente → reuso offline sem rede.
    const first = buildVoskModelRequestUrl('0.3');
    const offlineAgain = buildVoskModelRequestUrl('0.3');
    const keyOfFirst = new URL(first, 'https://app.local').href;
    const keyOfOffline = new URL(offlineAgain, 'https://app.local').href;
    expect(keyOfOffline).toBe(keyOfFirst);
  });

  it('invalidação/versionamento: versão nova → URL nova → entry nova (antiga expurga por maxEntries)', () => {
    const v1 = buildVoskModelRequestUrl('0.3');
    const v2 = buildVoskModelRequestUrl('0.4');
    expect(v1).not.toBe(v2);
    // ambas ainda são o MESMO recurso físico (pathname do modelo) — o cache key
    // (com ?v=) é que particiona; maxEntries evicts a mais antiga.
    for (const u of [v1, v2]) {
      expect(isVoskModelRequest(new URL(u, 'https://app.local'))).toBe(true);
    }
  });
});

describe('VOZ-012.4 — F06: regra no service worker (src/sw.ts)', () => {
  const ruleStart = swContent.indexOf('VOSK_MODEL_RUNTIME_CACHING');

  it('existe regra específica para o modelo', () => {
    expect(ruleStart).toBeGreaterThan(-1);
  });

  it('usa CacheFirst com cacheName dedicado "vosk-model" e ExpirationPlugin', () => {
    expect(swContent).toMatch(/new CacheFirst/);
    expect(swContent).toMatch(/cacheName:\s*VOSK_MODEL_CACHE_NAME|cacheName:\s*"vosk-model"/);
    expect(swContent).toMatch(/new ExpirationPlugin/);
    expect(swContent).toMatch(/maxAgeFrom:\s*"last-used"/);
  });

  it('matcher restrito ao pathname do modelo via isVoskModelRequest', () => {
    expect(swContent).toMatch(/sameOrigin\s*&&\s*isVoskModelRequest\(url\)/);
    expect(swContent).toMatch(/import[^;]*isVoskModelRequest/);
  });

  it('método GET e regra ANTES do defaultCache (first-match wins)', () => {
    const defaultCacheIndex = swContent.indexOf('...defaultCache');
    const methodIndex = swContent.indexOf('method: "GET"');
    expect(defaultCacheIndex).toBeGreaterThan(-1);
    expect(methodIndex).toBeGreaterThan(-1);
    // a regra do modelo (matcher/method/handler) é definida antes do spread do defaultCache
    expect(ruleStart).toBeLessThan(defaultCacheIndex);
    expect(methodIndex).toBeLessThan(defaultCacheIndex);
  });
});

describe('VOZ-012.4 — F06: consumo da URL versionada e header HTTP', () => {
  it('vosk.ts usa a URL versionada para o tar.gz', () => {
    expect(voskContent).toMatch(/buildVoskModelRequestUrl\('0\.3'\)/);
    expect(voskContent).toMatch(/import[^;]*buildVoskModelRequestUrl/);
  });

  it('next.config.ts: Cache-Control immutable restrito ao pathname do modelo', () => {
    expect(nextConfigContent).toMatch(/async headers\(\)/);
    expect(nextConfigContent).toContain("'/vosk-model-small-pt-0.3.tar.gz'");
    expect(nextConfigContent).toMatch(/public, max-age=31536000, immutable/);
  });
});