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
};

export default withSerwist(nextConfig);