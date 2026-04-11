/** @type {import('tailwindcss').Config} */
module.exports = {
  // 🔥 ADICIONE darkMode: 'class' para suporte ao Dark Mode
  darkMode: 'class',
  
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./ui/**/*.{js,ts,jsx,tsx,mdx}", // 🔥 ADICIONADO: para o UI system
  ],
  
  theme: {
    extend: {
      colors: {
        nutri: {
          50: '#f4f6f4', 
          100: '#e0e8e0',
          200: '#c0d0c0',
          300: '#9fb89f',
          400: '#7f9f7f',
          500: '#5f875f',
          600: '#4a6f4a',
          700: '#3a573a',
          800: '#2A5C43', 
          900: '#1A3B2B',
        }
      },
      
      animation: {
        // Animações existentes
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in-right': 'fadeInRight 0.8s ease-out forwards',
        
        // 🔥 NOVAS ANIMAÇÕES para o Ripple Effect e melhorias
        'ripple': 'ripple 0.6s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInRight: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        
        // 🔥 KEYFRAMES PARA RIPPLE EFFECT
        ripple: {
          '0%': { 
            transform: 'scale(0)', 
            opacity: '0.6' 
          },
          '100%': { 
            transform: 'scale(4)', 
            opacity: '0' 
          },
        },
        
        // 🔥 KEYFRAMES PARA SHIMMER (efeito de brilho)
        shimmer: {
          '0%': { 
            backgroundPosition: '-200% 0' 
          },
          '100%': { 
            backgroundPosition: '200% 0' 
          },
        },
      },
      
      // 🔥 BACKGROUND SIZE para o efeito shimmer
      backgroundSize: {
        'shimmer': '200% 100%',
      },
      
      // 🔥 NOVOS BOX SHADOWS para efeitos premium
      boxShadow: {
        'premium': '0 20px 60px -15px rgba(0, 0, 0, 0.15)',
        'premium-dark': '0 20px 60px -15px rgba(0, 0, 0, 0.4)',
        'inner-light': 'inset 0 1px 2px 0 rgba(255, 255, 255, 0.05)',
        'glow': '0 0 15px rgba(42, 92, 67, 0.3)',
        'glow-amber': '0 0 15px rgba(245, 158, 11, 0.2)',
      },
      
      // 🔥 TRANSITION TIMING FUNCTIONS premium
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'bounce-soft': 'cubic-bezier(0.34, 1.2, 0.64, 1)',
      },
      
      // 🔥 DURAÇÕES DE TRANSIÇÃO
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      
      // 🔥 OPACIDADES personalizadas
      opacity: {
        '2': '0.02',
        '4': '0.04',
        '8': '0.08',
        '12': '0.12',
        '15': '0.15',
      },
      
      // 🔥 SCALE personalizados
      scale: {
        '101': '1.01',
        '102': '1.02',
        '103': '1.03',
        '98': '0.98',
        '95': '0.95',
      },
    },
  },
  
  plugins: [],
};