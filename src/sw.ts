/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, ExpirationPlugin } from "serwist";
import {
  VOSK_MODEL_CACHE_NAME,
  VOSK_MODEL_CACHE_MAX_AGE_S,
  VOSK_MODEL_CACHE_MAX_ENTRIES,
  isVoskModelRequest,
} from "./lib/voice/pwa/modelCache";
import {
  TTS_CACHE_MAX_AGE_S,
  TTS_CACHE_MAX_ENTRIES,
  TTS_CACHE_NAME,
  isTtsAssetRequest,
  pruneOldTtsCaches,
} from "./lib/tts/pwa/modelCache";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// VOZ-012.4 — F06: cache dedicado do modelo Vosk (32MB tar.gz local).
// Razão: o defaultCache trata o tar.gz como recurso "others" com NetworkFirst
// (misturado no mesmo cacheName, expurgo em 24h) → downloads repetidos. Aqui o
// modelo vira CacheFirst restrito EXATAMENTE ao pathname do modelo:
// - primeira obtenção: fetch ok (status 200) → entra em 'vosk-model';
// - segunda obtenção: servida do cache local (offline incluso);
// - versão nova do modelo: URL versionada (?v=...) → entry nova, a antiga é
//   expurgada (maxEntries) — nunca editar o tar.gz no MESMO pathname/versão.
// Regra ANTES do defaultCache (first-match wins no Serwist).
const VOSK_MODEL_RUNTIME_CACHING = {
  matcher: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
    sameOrigin && isVoskModelRequest(url),
  method: "GET",
  handler: new CacheFirst({
    cacheName: VOSK_MODEL_CACHE_NAME,
    plugins: [
      new ExpirationPlugin({
        maxEntries: VOSK_MODEL_CACHE_MAX_ENTRIES,
        maxAgeSeconds: VOSK_MODEL_CACHE_MAX_AGE_S,
        maxAgeFrom: "last-used",
      }),
    ],
  }),
} as const;

// TTS-PWA-001 (D02/D03/D07/D10/D11) — CacheFirst dedicado para TODOS os assets
// do TTS Browser Runtime (modelo Q8 ~92 MB + tokenizer + voz + worker + WASM do
// onnxruntime-web). Regra ANTES do defaultCache (first-match wins). Decisão:
// runtime cache sob demanda (NÃO precache) — ver docs/TTS-PWA-001-REPORT.md.
// O próprio Worker baixa os assets no primeiro load on-demand; cada resposta
// 200 completa entra neste cache versionado e passa a ser servida localmente
// (offline incluso). Versão nova → TTS_CACHE_VERSION novo → cache novo;
// activate() remove caches antigos preservando a versão anterior utilizável.
const TTS_ASSETS_RUNTIME_CACHING = {
  matcher: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
    sameOrigin && isTtsAssetRequest(url),
  method: "GET",
  handler: new CacheFirst({
    cacheName: TTS_CACHE_NAME,
    plugins: [
      new ExpirationPlugin({
        maxEntries: TTS_CACHE_MAX_ENTRIES,
        maxAgeSeconds: TTS_CACHE_MAX_AGE_S,
        maxAgeFrom: "last-used",
      }),
    ],
  }),
} as const;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [VOSK_MODEL_RUNTIME_CACHING, TTS_ASSETS_RUNTIME_CACHING, ...defaultCache],
});

// 1. Ouvinte para receber a Notificação Push
self.addEventListener("push", (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: "2",
        },
      };
      event.waitUntil(self.registration.showNotification(data.title, options));
    } catch (e) {
      console.error("Erro ao processar push data:", e);
    }
  }
});

// 2. Ouvinte para quando o usuário clica na notificação
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return self.clients.openWindow("/");
    })
  );
});

serwist.addEventListeners();

// TTS-PWA-001 — limpeza de caches antigos do TTS no activate (mantém a versão
// atual + uma anterior utilizável — D08). Não cria segundo service worker.
self.addEventListener("activate", (event) => {
  event.waitUntil(pruneOldTtsCaches(2));
});