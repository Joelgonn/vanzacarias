import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vanusa Zacarias Nutri',
    short_name: 'VZ Nutri',
    description: 'Sua Jornada para uma Vida Saudável',
    start_url: '/',
    display: 'standalone', // Faz abrir como App (sem barra de navegação)
    background_color: '#fafaf9', // Cor do bg-stone-50 (sua cor de fundo principal)
    theme_color: '#1A3B2B', // Cor nutri-900 (sua cor principal)
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}