import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavigationWrapper from '../components/NavigationWrapper';

const inter = Inter({ subsets: ['latin'] });

// Define a cor da barra do navegador no celular (status bar) para parecer um App nativo
export const viewport: Viewport = {
  themeColor: '#1A3B2B', // Cor nutri-900
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Vanusa Zacarias Nutri - Sua Jornada para uma Vida Saudável',
  description: 'Nutrição personalizada e descomplicada para você alcançar seus objetivos de bem-estar.',
  manifest: '/manifest.webmanifest', // Linka o manifesto que criamos
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VZ Nutri',
    // startupImage: [] <-- Se quiser, no futuro pode adicionar imagens de splash screen do iPhone aqui
  },
  formatDetection: {
    telephone: false, // Evita que o iOS transforme números aleatórios na tela em links de telefone
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      {/* Adicionado 'antialiased' para fontes mais nítidas e 'selection' para cor da marca ao grifar texto */}
      <body className={`${inter.className} antialiased text-stone-800 selection:bg-nutri-800 selection:text-white flex min-h-screen flex-col bg-stone-50`}>
        <NavigationWrapper>
          {children}
        </NavigationWrapper>
      </body>
    </html>
  );
}