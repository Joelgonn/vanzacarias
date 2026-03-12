import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { client } from '@/sanity/lib/client';
import { urlFor } from '@/sanity/lib/image'; 
import { ArrowRight, Calendar, SearchX } from 'lucide-react';

// ==========================================
// METADADOS SEO (Para o Google e Redes Sociais)
// ==========================================
export const metadata: Metadata = {
  title: 'Blog | Vanusa Zacarias Nutrição',
  description: 'Conteúdos práticos, baseados em ciência e feitos para transformar sua rotina com saúde e equilíbrio.',
  openGraph: {
    title: 'Blog | Vanusa Zacarias Nutrição',
    description: 'Dicas de saúde, alimentação e bem-estar para o seu dia a dia.',
  }
};

// ==========================================
// FUNÇÃO DE BUSCA NO SANITY
// ==========================================
async function getPosts() {
  return await client.fetch(`*[_type == "post"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    mainImage
  }`);
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================
export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <main className="min-h-screen bg-stone-50 pt-32 pb-24 px-6 font-sans text-stone-800 relative overflow-hidden">
      
      {/* ELEMENTO DECORATIVO PREMIUM (Apenas um brilho sutil ao fundo) */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-nutri-800/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* HEADER DO BLOG */}
        <div className="mb-16 text-center md:text-left animate-fade-in-up">
          <span className="text-nutri-800 font-bold tracking-widest uppercase text-xs mb-3 block">
            Artigos & Dicas
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-stone-900 mb-6 tracking-tight">
            Blog da Vanusa
          </h1>
          <p className="text-lg md:text-xl text-stone-500 max-w-2xl font-light leading-relaxed">
            Conteúdos práticos, baseados em ciência e feitos para transformar sua rotina de forma leve.
          </p>
        </div>

        {/* GRID DE POSTS */}
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post: any) => (
              <Link 
                href={`/blog/${post.slug.current}`} 
                key={post._id} 
                className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden hover:shadow-xl transition-all duration-500 group flex flex-col h-full transform hover:-translate-y-1"
              >
                {/* IMAGEM DO POST */}
                {post.mainImage ? (
                  <div className="relative h-60 w-full overflow-hidden bg-stone-100">
                    <Image 
                      src={urlFor(post.mainImage).url()} 
                      alt={post.title} 
                      fill 
                      className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // OTIMIZAÇÃO PARA MOBILE
                    />
                  </div>
                ) : (
                  <div className="relative h-60 w-full bg-stone-100 flex items-center justify-center">
                    <span className="text-stone-300 font-medium">Sem imagem</span>
                  </div>
                )}
                
                {/* CONTEÚDO DO CARD */}
                <div className="p-8 flex flex-col flex-grow">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-nutri-800 uppercase tracking-widest mb-4">
                    <Calendar size={14} />
                    {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
                  </div>
                  
                  <h2 className="text-xl font-bold text-stone-900 mb-4 group-hover:text-nutri-800 transition-colors leading-snug">
                    {post.title}
                  </h2>
                  
                  <p className="text-stone-500 text-sm mb-8 line-clamp-3 leading-relaxed flex-grow">
                    {post.excerpt || 'Clique para ler o artigo completo.'}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-stone-100">
                    <span className="inline-flex items-center gap-2 text-nutri-900 font-bold text-sm group-hover:gap-3 transition-all">
                      Ler artigo <ArrowRight size={16} className="text-nutri-800" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* EMPTY STATE PREMIUM */
          <div className="text-center py-32 bg-white rounded-[3rem] border border-stone-100 shadow-sm flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6">
              <SearchX size={32} className="text-stone-300" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 mb-2">Nenhum artigo publicado</h3>
            <p className="text-stone-500 max-w-sm mx-auto">
              A Vanusa está preparando conteúdos incríveis para você. Volte em breve!
            </p>
          </div>
        )}
      </div>
    </main>
  );
}