import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, Leaf, Zap, Brain, Scale, ArrowRight, MessageCircle, LogIn } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-nutri-50 text-stone-800 selection:bg-nutri-800 selection:text-white">

      {/* 1. HERO SECTION */}
      <section id="hero" className="relative w-full overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32 lg:pt-48 lg:pb-40">
        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col-reverse md:flex-row items-center justify-between gap-12 px-6 lg:px-8">
          
          <div className="md:w-1/2 text-center md:text-left animate-fade-in-up flex flex-col items-center md:items-start opacity-0" style={{ animationDelay: '0.2s' }}>
            <span className="text-nutri-800 text-sm font-semibold tracking-widest uppercase mb-4 block">
              Nutrição Clínica & Estilo de Vida
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-stone-900 leading-[1.1] tracking-tight mb-6">
              Sua jornada para uma vida mais <span className="text-nutri-800 italic font-light">leve</span> e vibrante.
            </h1>
            <p className="text-lg md:text-xl text-stone-500 mb-10 max-w-lg font-light leading-relaxed">
              Descubra o poder da nutrição descomplicada para transformar seu corpo, sua mente e elevar sua energia diária.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/avaliacao" className="group bg-nutri-900 hover:bg-nutri-800 text-white font-medium py-4 px-8 rounded-full shadow-lg transition-all duration-300 flex items-center gap-2 transform hover:-translate-y-1">
                Iniciar Minha Avaliação
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link href="/login" className="flex items-center gap-2 text-stone-600 hover:text-nutri-900 font-medium py-4 px-6 transition-all hover:translate-x-1">
                <LogIn size={18} />
                Já sou paciente
              </Link>
            </div>
            <p className="mt-5 text-xs font-medium text-stone-400 tracking-wide uppercase">
              * Descubra seu perfil em menos de 2 minutos
            </p>
          </div>

          <div className="md:w-1/2 flex justify-center md:justify-end animate-fade-in-right opacity-0 w-full" style={{ animationDelay: '0.4s' }}>
            <div className="relative w-full max-w-lg aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl group bg-stone-200">
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
      <section id="problemas" className="w-full bg-white py-24 px-6 lg:px-8 border-t border-stone-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-stone-900 tracking-tight mb-6">
              Você se identifica com algum destes <span className="text-nutri-800 font-light italic">desafios</span>?
            </h2>
            <p className="text-stone-500 text-lg font-light">
              Muitas pessoas passam a vida acreditando que o cansaço e o desconforto são normais. Não precisam ser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
            {[
              { icon: Sparkles, title: "Falta de Energia", desc: "Acorda cansado? Sente-se exausto antes do fim do dia? A nutrição certa é o seu combustível." },
              { icon: Scale, title: "Efeito Sanfona", desc: "Luta constante com o peso e dietas frustrantes? Vamos encontrar um caminho sustentável." },
              { icon: Leaf, title: "Relação com a Comida", desc: "Comer tornou-se uma obrigação ou fonte de culpa? Redescubra o prazer de se alimentar." },
              { icon: Brain, title: "Excesso de Informação", desc: "Perdido em meio a tantas 'dietas da moda'? Tenha clareza com orientação científica." },
              { icon: Zap, title: "Condições Específicas", desc: "Planos adaptados para diabetes, SOP, intolerâncias ou outras necessidades metabólicas." },
            ].map((item, index) => (
              <div key={index} className="bg-stone-50/50 border border-stone-100 p-10 rounded-3xl hover:bg-white hover:shadow-xl transition-all duration-300 group">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="text-nutri-800" size={28} strokeWidth={1.2} />
                </div>
                <h3 className="text-xl font-semibold text-stone-900 mb-3">{item.title}</h3>
                <p className="text-stone-500 leading-relaxed font-light">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-20 flex justify-center">
            <Link href="/avaliacao" className="bg-transparent border-2 border-nutri-800 text-nutri-800 hover:bg-nutri-800 hover:text-white font-medium py-4 px-10 rounded-full transition-all duration-300">
              Quero transformar minha rotina
            </Link>
          </div>
        </div>
      </section>

      {/* 3. SOBRE A NUTRI */}
      <section id="sobre" className="w-full bg-nutri-50 py-24 px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 relative w-full flex justify-center">
            <div className="relative w-full max-w-md aspect-[3/4] rounded-t-full rounded-b-[3rem] overflow-hidden shadow-2xl border-8 border-white">
              <Image
                src="/images/vanusa-sobre.jpg" 
                alt="Vanusa Zacarias - Nutricionista"
                width={600}
                height={800}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-nutri-800/10 rounded-full blur-3xl -z-10"></div>
          </div>

          <div className="lg:w-1/2">
            <span className="text-nutri-800 text-sm font-semibold tracking-widest uppercase mb-4 block">
              Muito Prazer,
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-stone-900 tracking-tight mb-6">
              Sou Vanusa Zacarias
            </h2>
            <div className="space-y-4 text-stone-500 font-light leading-relaxed text-lg">
              <p>Sou apaixonada por mostrar que ter uma alimentação saudável não precisa ser sinônimo de restrição, sofrimento ou dietas impossíveis de seguir.</p>
              <p>Minha missão é ajudar você a fazer as pazes com a comida, entendendo as necessidades do seu próprio corpo. Com uma abordagem baseada em evidências científicas e muito acolhimento, crio estratégias que se encaixam na <span className="text-stone-800 font-medium">sua realidade e rotina</span>.</p>
            </div>

            <div className="mt-10 flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-4xl font-bold text-nutri-800">+500</span>
                <span className="text-xs text-stone-500 uppercase tracking-widest mt-1">Vidas Transformadas</span>
              </div>
              <div className="w-px h-12 bg-stone-300"></div>
              <div className="flex flex-col">
                <span className="text-4xl font-bold text-nutri-800">10</span>
                <span className="text-xs text-stone-500 uppercase tracking-widest mt-1">Anos de Experiência</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COMO FUNCIONA */}
      <section id="como-funciona" className="w-full bg-white py-24 px-6 lg:px-8 border-t border-stone-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-stone-900 tracking-tight mb-6">
              Como funciona o <span className="text-nutri-800 font-light italic">acompanhamento</span>?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 relative">
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-[2px] bg-stone-100 z-0"></div>
            {[
              { step: "01", title: "Avaliação Online", desc: "Responda um questionário rápido aqui no site para eu entender seu perfil." },
              { step: "02", title: "Cadastro & Agendamento", desc: "Crie sua conta no nosso portal e escolha o melhor horário para conversarmos." },
              { step: "03", title: "Consulta Completa", desc: "Um bate-papo profundo sobre sua rotina, gostos, exames e objetivos." },
              { step: "04", title: "Acesso ao Portal", desc: "Receba seu plano alimentar e acompanhe sua evolução direto pelo sistema." },
            ].map((item, index) => (
              <div key={index} className="relative z-10 flex flex-col items-center text-center group">
                <div className="w-24 h-24 bg-nutri-50 rounded-full flex items-center justify-center border-4 border-white shadow-lg mb-6 group-hover:bg-nutri-800 transition-colors duration-300">
                  <span className="text-2xl font-bold text-nutri-800 group-hover:text-white transition-colors">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold text-stone-900 mb-3">{item.title}</h3>
                <p className="text-stone-500 font-light text-sm px-4 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CTA FINAL */}
      <section className="w-full bg-nutri-900 py-24 px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-nutri-800 rounded-full blur-[100px] opacity-60 -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-nutri-800 rounded-full blur-[100px] opacity-60 translate-y-1/2 -translate-x-1/3"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-8">
            Pronto para dar o primeiro passo?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/avaliacao" className="bg-white text-nutri-900 font-medium py-4 px-10 rounded-full shadow-xl">Começar minha Avaliação</Link>
            <a 
              href="https://wa.me/5544999997275?text=Olá%20Vanusa,%20estou%20no%20seu%20site%20e%20gostaria%20de%20tirar%20uma%20dúvida!" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-transparent border border-stone-500 text-stone-300 hover:text-white hover:border-white font-medium py-4 px-10 rounded-full transition-all flex items-center gap-2"
            >
              <MessageCircle size={20} />
              Tirar dúvida no WhatsApp
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}