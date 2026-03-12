import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io', // Autoriza as imagens do Sanity
        port: '',
        pathname: '/**', // Autoriza qualquer caminho de imagem vindo deste domínio
      },
    ],
  },
};

export default nextConfig;