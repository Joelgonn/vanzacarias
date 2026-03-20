import Image from 'next/image';
import Link from 'next/link';
import { 
  Sparkles, Leaf, Zap, Brain, Scale, ArrowRight, 
  MessageCircle, LogIn, Instagram, Linkedin, Facebook 
} from 'lucide-react';

// ==========================================
// DADOS DA PÁGINA (Melhora a leitura do código)
// ==========================================

const challenges = [
  { icon: Sparkles, title: "Falta de Energia", desc: "Acorda cansado? Sente-se exausto antes do fim do dia? A nutrição certa é o seu combustível." },
  { icon: Scale, title: "Efeito Sanfona", desc: "Luta constante com o peso e dietas frustrantes? Vamos encontrar um caminho sustentável." },
  { icon: Leaf, title: "Relação com a Comida", desc: "Comer tornou-se uma obrigação ou fonte de culpa? Redescubra o prazer de se alimentar." },
  { icon: Brain, title: "Excesso de Informação", desc: "Perdido em meio a tantas 'dietas da moda'? Tenha clareza com orientação científica." },
  { icon: Zap, title: "Condições Específicas", desc: "Planos adaptados para diabetes, SOP, intolerâncias ou outras necessidades metabólicas." },
];

const steps = [
  { step: "01", title: "Avaliação Online", desc: "Responda um questionário rápido aqui no site para eu entender seu perfil." },
  { step: "02", title: "Cadastro & Agendamento", desc: "Crie sua conta no nosso portal e escolha o melhor horário para conversarmos." },
  { step: "03", title: "Consulta Completa", desc: "Um bate-papo profundo sobre sua rotina, gostos, exames e objetivos." },
  { step: "04", title: "Acesso ao Portal", desc: "Receba seu plano alimentar e acompanhe sua evolução direto pelo sistema." },
];

const socialLinks = [
  { name: "Instagram", url: "https://www.instagram.com/vanusazacarias/", icon: Instagram }, 
  { name: "LinkedIn", url: "#", icon: Linkedin },   // Substitua o "#" pelo link real do LinkedIn
  { name: "Facebook", url: "https://www.facebook.com/vanusa.zacarias", icon: Facebook }, 
  { name: "WhatsApp", url: "https://wa.me/5544999997275", icon: MessageCircle },
];

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-nutri-50 text-stone-800 selection:bg-nutri-800 selection:text-white">

      {/* 1. HERO SECTION */}
      <section id="hero" className="relative w-full overflow-hidden pt-28 pb-16 md:pt-40 md:pb-32 lg:pt-48 lg:pb-40">
        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col-reverse md:flex-row items-center justify-between gap-10 md:gap-12 px-6 lg:px-8">
          
          <div className="w-full md:w-1/2 text-center md:text-left animate-fade-in-up flex flex-col items-center md:items-start opacity-0" style={{ animationDelay: '0.2s' }}>
            <span className="text-nutri-800 text-xs md:text-sm font-bold tracking-[0.2em] uppercase mb-4 block bg-nutri-800/10 px-4 py-1.5 rounded-full md:bg-transparent md:px-0 md:py-0">
              Nutrição Clínica & Estilo de Vida
            </span>
            <h1 className="text-[2.5rem] leading-[1.1] md:text-6xl lg:text-7xl font-bold text-stone-900 tracking-tight mb-5 md:mb-6">
              Sua jornada para uma vida mais <span className="text-nutri-800 italic font-light">leve</span> e vibrante.
            </h1>
            <p className="text-base md:text-xl text-stone-500 mb-8 md:mb-10 max-w-lg font-light leading-relaxed px-2 md:px-0">
              Descubra o poder da nutrição descomplicada para transformar seu corpo, sua mente e elevar sua energia diária.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Link href="/avaliacao" className="w-full sm:w-auto justify-center group bg-nutri-900 hover:bg-nutri-800 text-white font-medium py-4 px-8 rounded-2xl md:rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 flex items-center gap-2 transform md:hover:-translate-y-1 active:scale-[0.98]">
                Iniciar Minha Avaliação
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link href="/login" className="w-full sm:w-auto justify-center flex items-center gap-2 text-stone-600 hover:text-nutri-900 bg-white md:bg-transparent border border-stone-200 md:border-transparent font-medium py-4 px-6 rounded-2xl md:rounded-full transition-all md:hover:translate-x-1 active:scale-[0.98]">
                <LogIn size={18} />
                Já sou paciente
              </Link>
            </div>
            <p className="mt-6 md:mt-5 text-[11px] md:text-xs font-medium text-stone-400 tracking-wider uppercase">
              * Descubra seu perfil em menos de 2 minutos
            </p>
          </div>

          <div className="w-full md:w-1/2 flex justify-center md:justify-end animate-fade-in-right opacity-0" style={{ animationDelay: '0.4s' }}>
            <div className="relative w-full max-w-[320px] md:max-w-lg aspect-[4/5] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl group bg-stone-200">
              <div className="absolute inset-0 bg-nutri-900/10 group-hover:bg-transparent transition-colors duration-500 z-10"></div>
              <Image
                src="/images/hero-image.jpg"
                alt="Nutricionista Vanusa Zacarias"
                width={800}
                height={1000}
                className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. PROBLEMAS / IDENTIFICAÇÃO */}
      <section id="servicos" className="w-full bg-white py-20 md:py-24 px-6 lg:px-8 border-t border-stone-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-stone-900 tracking-tight mb-4 md:mb-6">
              Você se identifica com algum destes <span className="text-nutri-800 font-light italic">desafios</span>?
            </h2>
            <p className="text-stone-500 text-base md:text-lg font-light leading-relaxed px-4 md:px-0">
              Muitas pessoas passam a vida acreditando que o cansaço e o desconforto são normais. Não precisam ser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 relative z-10">
            {challenges.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="bg-white border border-stone-100 p-8 md:p-10 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col items-start text-left md:items-start">
                  <div className="w-14 h-14 bg-nutri-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-nutri-800 transition-all duration-300">
                    <Icon className="text-nutri-800 group-hover:text-white transition-colors" size={28} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 mb-3 tracking-tight">{item.title}</h3>
                  <p className="text-stone-500 leading-relaxed font-light text-sm md:text-base">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-16 md:mt-20 flex justify-center w-full">
            <Link href="/avaliacao" className="w-full sm:w-auto text-center bg-transparent border-2 border-nutri-800 text-nutri-800 hover:bg-nutri-800 hover:text-white font-semibold py-4 px-10 rounded-2xl md:rounded-full transition-all duration-300 active:scale-[0.98]">
              Quero transformar minha rotina
            </Link>
          </div>
        </div>
      </section>

      {/* 3. SOBRE A NUTRI */}
      <section id="sobre" className="w-full bg-nutri-50 py-20 md:py-24 px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 md:gap-16">
          <div className="w-full lg:w-1/2 relative flex justify-center order-2 lg:order-1">
            <div className="relative w-full max-w-[300px] md:max-w-md aspect-[3/4] rounded-t-[10rem] rounded-b-[3rem] overflow-hidden shadow-2xl border-4 md:border-8 border-white">
              <Image
                src="/images/vanusa-sobre.jpg" 
                alt="Vanusa Zacarias - Nutricionista"
                width={600}
                height={800}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 md:-bottom-10 md:-right-10 w-32 h-32 md:w-48 md:h-48 bg-nutri-800/15 rounded-full blur-3xl -z-10"></div>
          </div>

          <div className="w-full lg:w-1/2 order-1 lg:order-2 text-center md:text-left">
            <span className="text-nutri-800 text-xs md:text-sm font-bold tracking-[0.2em] uppercase mb-4 block">
              Muito Prazer,
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-stone-900 tracking-tight mb-6">
              Sou Vanusa Zacarias
            </h2>
            <div className="space-y-4 text-stone-600 font-light leading-relaxed text-base md:text-lg">
              <p>Sou apaixonada por mostrar que ter uma alimentação saudável não precisa ser sinônimo de restrição, sofrimento ou dietas impossíveis de seguir.</p>
              <p>Minha missão é ajudar você a fazer as pazes com a comida, entendendo as necessidades do seu próprio corpo. Com uma abordagem baseada em evidências científicas e muito acolhimento, crio estratégias que se encaixam na <span className="text-stone-900 font-medium">sua realidade e rotina</span>.</p>
            </div>

            <div className="mt-10 flex items-center justify-center md:justify-start gap-8 bg-white md:bg-transparent p-6 md:p-0 rounded-3xl shadow-sm md:shadow-none border border-stone-100 md:border-transparent">
              <div className="flex flex-col items-center md:items-start">
                <span className="text-4xl md:text-5xl font-black text-nutri-800 tracking-tighter">+Saúde</span>
                <span className="text-[10px] md:text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">E Bem Estar</span>
              </div>
              <div className="w-px h-16 bg-stone-200"></div>
              <div className="flex flex-col items-center md:items-start">
                <span className="text-4xl md:text-5xl font-black text-nutri-800 tracking-tighter">+Vidas</span>
                <span className="text-[10px] md:text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">Transformadas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COMO FUNCIONA */}
      <section id="como-funciona" className="w-full bg-white py-20 md:py-24 px-6 lg:px-8 border-t border-stone-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-stone-900 tracking-tight mb-4">
              Como funciona o <span className="text-nutri-800 font-light italic">acompanhamento</span>?
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 relative">
            {/* Linha horizontal para Desktop */}
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-[2px] bg-stone-100 z-0"></div>
            
            {/* Linha vertical para Mobile */}
            <div className="md:hidden absolute top-0 bottom-0 left-[50%] w-[2px] bg-stone-100 z-0 transform -translate-x-1/2"></div>

            {steps.map((item, index) => (
              <div key={index} className="relative z-10 flex flex-col items-center text-center group bg-white md:bg-transparent py-4 md:py-0">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-nutri-50 rounded-full flex items-center justify-center border-4 border-white shadow-md mb-5 md:mb-6 group-hover:bg-nutri-800 transition-colors duration-300">
                  <span className="text-xl md:text-2xl font-black text-nutri-800 group-hover:text-white transition-colors tracking-tighter">{item.step}</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold text-stone-900 mb-2 md:mb-3">{item.title}</h3>
                <p className="text-stone-500 font-light text-sm md:text-base px-2 md:px-4 leading-relaxed bg-white/80 md:bg-transparent rounded-xl py-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CTA FINAL & CONTATO */}
      <section id="contato" className="w-full bg-nutri-900 py-20 md:py-24 px-6 lg:px-8 relative overflow-hidden">
        {/* Efeitos de Luz / Blur */}
        <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-nutri-800 rounded-full blur-[80px] md:blur-[100px] opacity-50 -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 md:w-96 md:h-96 bg-nutri-800 rounded-full blur-[80px] md:blur-[100px] opacity-50 translate-y-1/2 -translate-x-1/3"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-8 md:mb-10 leading-tight">
            Pronto para dar o primeiro passo?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/avaliacao" className="w-full sm:w-auto bg-white text-nutri-900 font-bold py-4 md:py-5 px-10 rounded-2xl md:rounded-full shadow-xl hover:bg-stone-100 transition-all active:scale-[0.98]">
              Começar minha Avaliação
            </Link>
          </div>

          <div className="border-t border-nutri-800/50 pt-10 md:pt-12">
            <p className="text-nutri-100 mb-6 font-semibold uppercase tracking-[0.2em] text-xs">
              Siga minhas redes e entre em contato
            </p>
            
            {/* Lista de Redes Sociais Refatorada */}
            <div className="flex justify-center gap-4 md:gap-8 text-white">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a 
                    key={social.name}
                    href={social.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    aria-label={`Acessar ${social.name} da Vanusa`}
                    className="p-3 bg-nutri-800/30 hover:bg-nutri-800 rounded-full transition-all hover:-translate-y-1 active:scale-95"
                  >
                    <Icon size={24} />
                  </a>
                );
              })}
            </div>

          </div>
        </div>
      </section>

    </main>
  );
}