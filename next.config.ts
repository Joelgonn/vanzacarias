import path from "node:path";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Configuração do PWA
const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts", 
  swDest: "public/sw.js", 
  disable: process.env.NODE_ENV !== "production", 
  // Aumenta o limite de cache para 5MB (5 * 1024 * 1024) para suportar os gráficos e PDF
  maximumFileSizeToCacheInBytes: 5242880, 
});

// Sua configuração original do Next
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        port: '',
        pathname: '/**', 
      },
    ],
  },
  // VOZ-012.4 — F06: cache do modelo Vosk no browser (same-origin).
  // Reforço do CacheFirst do service worker: a primeira fetch do worker (antes de o
  // SW assumir controle) também fica no HTTP cache local e reutilizável offline.
  // Restrito EXCLUSIVAMENTE ao tar.gz do modelo; versionado por URL (?v=...).
  async headers() {
    return [
      {
        source: '/vosk-model-small-pt-0.3.tar.gz',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  // TTS-INTEGRATION-007: o Browser Runtime real (`voice-synthesis` subpath
  // `dist/src/runtime/browser/index.js`) é importado SOMENTE no bundle client,
  // dentro de um Worker dedicado (onnxruntime-web/WASM isolados da main thread).
  // No APP Server o pacote `voice-synthesis` segue EXTERNO (serverExternalPackages)
  // para preservar o engine Node real (onnxruntime-node) caso usado no servidor.
  // As proteções do TTS-003 foram reduzidas ao essencial: apenas o resolver
  // `onnxruntime-node` → stub no bundle CLIENT, para que nenhum chunk client
  // contenha backend nativo. Removidos os aliases `voice-synthesis*` → stub,
  // que bloqueavam o subpath browser (D03/D04 — remoção com evidência: o client
  // não importa mais o entry Node; ver docs/TTS-INTEGRATION-007-REPORT.md).
  serverExternalPackages: ["voice-synthesis", "onnxruntime-node"],
  webpack(config, { isServer }) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};
    if (!isServer) {
      const stub = path.resolve(__dirname, "src/lib/tts/stubs/empty.ts");
      config.resolve.alias["onnxruntime-node"] = stub;
    }
    return config;
  },
};

export default withSerwist(nextConfig);