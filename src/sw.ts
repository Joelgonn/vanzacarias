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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [VOSK_MODEL_RUNTIME_CACHING, ...defaultCache],
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