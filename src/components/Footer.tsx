import Link from 'next/link';
import { Instagram, Linkedin, Mail, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const contactEmail = "contato@vanusazacariasnutri.com.br";
  const rawPhoneNumber = "5544999997275";
  const displayPhoneNumber = "(44) 99999-7275";

  return (
    <footer className="bg-stone-950 text-stone-300 pt-20 pb-10 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8 border-b border-stone-800 pb-16 mb-8">

        <div className="md:col-span-12 lg:col-span-5">
          <Link href="/" className="text-2xl font-semibold text-white tracking-tight">
            Vanusa Zacarias <span className="font-light text-stone-400">Nutrição</span>
          </Link>
          <p className="mt-6 text-stone-400 max-w-sm font-light leading-relaxed">
            Sua parceira para uma vida mais saudável, equilibrada e feliz através da nutrição consciente e baseada em ciência.
          </p>
          
          <div className="flex space-x-4 mt-8">
            <a href="https://instagram.com/vanusazacariasnutri" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center hover:bg-nutri-800 hover:text-white transition-all duration-300">
              <Instagram size={18} strokeWidth={1.5} />
            </a>
            <a href="https://linkedin.com/in/vanusazacariasnutri" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center hover:bg-nutri-800 hover:text-white transition-all duration-300">
              <Linkedin size={18} strokeWidth={1.5} />
            </a>
          </div>
        </div>

        <div className="md:col-span-6 lg:col-span-3 lg:col-start-7">
          <h3 className="text-sm uppercase tracking-widest text-white font-medium mb-6">Navegação</h3>
          <ul className="space-y-4 font-light">
            {['Home', 'Sobre Mim', 'Serviços', 'Blog', 'Contato'].map((item) => (
              <li key={item}>
                <Link href={`/${item.toLowerCase().replace(' ', '-')}`} className="hover:text-white transition-colors">
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-6 lg:col-span-3">
          <h3 className="text-sm uppercase tracking-widest text-white font-medium mb-6">Atendimento</h3>
          <ul className="space-y-4 font-light text-stone-400">
            <li>
              <a href={`mailto:${contactEmail}`} className="hover:text-white transition-colors flex items-center gap-2 group">
                <Mail size={16} />
                <span>{contactEmail}</span>
              </a>
            </li>
            <li>
              <a href={`https://wa.me/${rawPhoneNumber}`} target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-2 group">
                <span>WhatsApp: {displayPhoneNumber}</span>
                <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center text-xs font-light text-stone-500 tracking-wide max-w-7xl mx-auto">
        <p>&copy; {currentYear} Vanusa Zacarias Nutrição. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}