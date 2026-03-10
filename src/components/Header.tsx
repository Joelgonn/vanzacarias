'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Verifica sessão inicial
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data.session);
    };
    checkSession();

    // Listener para mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
    });

    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      subscription.unsubscribe();
    };
  }, [supabase]);

  // A lógica dos links agora fica aqui dentro para ser re-renderizada quando o estado mudar
  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Sobre Mim', href: '/#sobre' },
    { name: 'Serviços', href: '/#como-funciona' },
    { name: 'Blog', href: '/blog' },
    { name: 'Contato', href: '/#contato' },
    { 
      name: isLoggedIn ? 'Agendar Consulta' : 'Agendar Consulta', 
      href: isLoggedIn ? '/dashboard/agendamentos' : '/login', 
      cta: true 
    },
  ];

  return (
    <header 
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 group">
          <span className="text-xl md:text-2xl font-semibold tracking-tight text-nutri-900 group-hover:text-nutri-800 transition-colors">
            Vanusa Zacarias <span className="font-light text-stone-500">Nutrição</span>
          </span>
        </Link>

        {/* Menu Desktop */}
        <div className="hidden md:flex items-center space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`
                text-sm uppercase tracking-wider font-medium transition-all duration-300
                ${item.cta 
                  ? 'bg-nutri-900 hover:bg-nutri-800 text-white py-2.5 px-6 rounded-full shadow-md hover:shadow-lg transform hover:-translate-y-0.5' 
                  : 'text-stone-600 hover:text-nutri-800'
                }
              `}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Botão Mobile */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-stone-800 hover:text-nutri-800 focus:outline-none transition-colors"
          >
            {isMobileMenuOpen ? <X size={28} strokeWidth={1.5} /> : <Menu size={28} strokeWidth={1.5} />}
          </button>
        </div>
      </nav>

      {/* Menu Mobile */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute w-full bg-white shadow-xl border-t border-stone-100 animate-fade-in">
          <ul className="flex flex-col px-6 py-4 space-y-2">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    block text-base tracking-wide font-medium px-4 py-3 rounded-lg transition-colors
                    ${item.cta ? 'bg-nutri-900 text-white text-center mt-4' : 'text-stone-600 hover:bg-nutri-50 hover:text-nutri-800'}
                  `}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}