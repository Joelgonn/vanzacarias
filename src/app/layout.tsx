import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavigationWrapper from '../components/NavigationWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vanusa Zacarias Nutri - Sua Jornada para uma Vida Saudável',
  description: 'Nutrição personalizada e descomplicada para você alcançar seus objetivos de bem-estar.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className={inter.className}>
        <NavigationWrapper>
          {children}
        </NavigationWrapper>
      </body>
    </html>
  );
}