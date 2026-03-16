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
};

export default withSerwist(nextConfig);