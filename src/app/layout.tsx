import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import NavigationWrapper from '../components/NavigationWrapper';
import { Toaster } from 'sonner';

// =========================================================================
// CONFIGURAÇÃO DE TIPOGRAFIA (PREMIUM)
// Plus Jakarta Sans transmite modernidade, clareza e elegância em apps de saúde
// =========================================================================
const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta', // Permite usar no Tailwind se necessário
  weight: ['300', '400', '500', '600', '700', '800'],
});

// =========================================================================
// CONFIGURAÇÃO DE VIEWPORT E PWA (APLICATIVO NATIVO)
// =========================================================================
export const viewport: Viewport = {
  themeColor: '#1A3B2B', // Cor principal (nutri-900) para a barra do navegador mobile
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Evita zoom acidental em inputs no iOS
  userScalable: false,
};

// =========================================================================
// CONFIGURAÇÃO DE METADADOS E SEO (OTIMIZADO PARA CONVERSÃO)
// =========================================================================
export const metadata: Metadata = {
  metadataBase: new URL('https://vanusazacariasnutri.com.br'), // Altere para seu domínio real
  title: {
    default: 'Vanusa Zacarias | Nutrição Clínica e Funcional',
    template: '%s | Vanusa Zacarias Nutrição'
  },
  description: 'Nutrição acolhedora, baseada em ciência e descomplicada. Descubra sua melhor versão através de uma alimentação consciente e personalizada.',
  keywords: ['Nutricionista', 'Nutrição Clínica', 'Emagrecimento', 'Saúde', 'Dieta', 'Reeducação Alimentar', 'Bem-estar'],
  authors: [{ name: 'Vanusa Zacarias' }],
  creator: 'Vanusa Zacarias',
  publisher: 'Vanusa Zacarias Nutrição',
  manifest: '/manifest.webmanifest',
  
  // Configurações para compartilhamento em Redes Sociais e WhatsApp
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://vanusazacariasnutri.com.br',
    siteName: 'Vanusa Zacarias Nutrição',
    title: 'Vanusa Zacarias | Nutrição Clínica e Funcional',
    description: 'Sua jornada para uma vida mais saudável através da nutrição consciente.',
    images: [
      {
        url: '/images/og-image.jpg', // Crie uma imagem 1200x630 e coloque na pasta public/images/
        width: 1200,
        height: 630,
        alt: 'Vanusa Zacarias - Nutrição Clínica',
      },
    ],
  },
  
  // Otimização para Twitter / X
  twitter: {
    card: 'summary_large_image',
    title: 'Vanusa Zacarias | Nutricionista',
    description: 'Sua parceira para uma vida mais saudável, equilibrada e feliz.',
    images: ['/images/og-image.jpg'],
  },

  // Configurações para PWA no iOS
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VanZ Nutri',
  },
  
  // Prevenção de bugs no iOS Safari
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
  
  // Diretrizes para Robôs do Google
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

// =========================================================================
// RENDERIZAÇÃO DO LAYOUT PRINCIPAL
// =========================================================================
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="pt-BR" 
      className="scroll-smooth"
      // suppressHydrationWarning impede erros causados por extensões do navegador (ex: Grammarly)
      suppressHydrationWarning
    >
      <body 
        className={`
          ${jakarta.className} 
          antialiased 
          text-stone-800 
          bg-stone-50 
          selection:bg-nutri-500 selection:text-white 
          flex flex-col min-h-[100dvh]
          overscroll-y-none
        `}
        style={{
          // Melhora absurdamente a renderização de fontes no Safari e Chrome
          textRendering: 'optimizeLegibility',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
      >
        <NavigationWrapper>
          {children}
        </NavigationWrapper>

        {/* 
            TOASTER GLOBAL (Sonner)
            Configurado com design premium para notificações de sucesso/erro em toda a aplicação
        */}
        <Toaster 
          position="top-center"
          toastOptions={{
            className: 'font-sans antialiased text-sm',
            style: {
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              color: '#1c1917',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
              borderRadius: '16px',
            },
          }}
        />
      </body>
    </html>
  );
}