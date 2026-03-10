import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Post({ params }: { params: { slug: string } }) {
  // Aqui você buscaria o post pelo ID/slug no banco
  return (
    <main className="min-h-screen bg-white pt-32 pb-20 px-6">
      <article className="max-w-2xl mx-auto">
        <Link href="/blog" className="text-stone-400 hover:text-nutri-800 flex items-center gap-2 mb-8">
          <ArrowLeft size={16} /> Voltar ao Blog
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-6">Título do Post Aqui</h1>
        <div className="prose prose-stone prose-lg max-w-none">
          <p>Conteúdo do post vai aqui. Use componentes MDX ou renderize o texto do banco de dados.</p>
        </div>

        {/* CTA FINAL DO POST */}
        <div className="mt-16 p-8 bg-nutri-50 rounded-3xl text-center">
          <h3 className="text-xl font-bold mb-4">Gostou dessas dicas?</h3>
          <p className="text-stone-600 mb-6">Vamos aplicar essas estratégias na sua rotina?</p>
          <Link href="/avaliacao" className="bg-nutri-900 text-white px-8 py-3 rounded-full font-bold">
            Começar minha avaliação
          </Link>
        </div>
      </article>
    </main>
  );
}