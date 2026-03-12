import { ArrowLeft, Calendar, ArrowRight, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { client } from '@/sanity/lib/client';
import { urlFor } from '@/sanity/lib/image';
import { notFound } from 'next/navigation';
import { PortableText } from '@portabletext/react';
import type { Metadata } from 'next';

// ==========================================
// FUNÇÃO DE BUSCA NO SANITY
// ==========================================
async function getPostBySlug(slug: string) {
  const query = `*[_type == "post" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    mainImage,
    body,
    author->{name, image, bio},
    categories[]->{title, slug}
  }`;
  
  const post = await client.fetch(query, { slug });
  return post;
}

// ==========================================
// SEO DINÂMICO (Google, WhatsApp, Instagram)
// ==========================================
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const post = await getPostBySlug(resolvedParams.slug);

  if (!post) {
    return { title: 'Post não encontrado | Vanusa Zacarias Nutrição' };
  }

  return {
    title: `${post.title} | Vanusa Zacarias Nutrição`,
    description: post.excerpt || 'Leia este artigo completo no blog da Vanusa Zacarias.',
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.mainImage ? [urlFor(post.mainImage).width(1200).height(630).url()] : [],
    },
  };
}

// ==========================================
// CONFIGURAÇÃO DO RENDERIZADOR OFICIAL (Textos e Imagens)
// ==========================================
const portableTextComponents = {
  types: {
    image: ({ value }: { value: any }) => {
      if (!value?.asset?._ref) return null;
      return (
        <div className="my-10 relative h-[300px] md:h-[400px] w-full overflow-hidden rounded-2xl shadow-md border border-stone-100">
          <Image 
            src={urlFor(value).url()} 
            alt={value.alt || 'Imagem ilustrativa do artigo'} 
            fill 
            className="object-cover"
          />
        </div>
      );
    },
  },
};

// ==========================================
// COMPONENTE PRINCIPAL DA PÁGINA
// ==========================================
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const post = await getPostBySlug(slug);

  if (!post || !post.body) {
    notFound(); 
  }

  return (
    <main className="min-h-screen bg-white pt-32 pb-20 px-6 font-sans text-stone-800">
      <article className="max-w-3xl mx-auto">
        
        {/* NAVEGAÇÃO SUPERIOR */}
        <nav className="flex items-center justify-between mb-16">
          <Link 
            href="/blog" 
            className="group flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1.5 rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={16} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Blog</span>
          </Link>
        </nav>

        {/* CABEÇALHO DO ARTIGO */}
        <header className="mb-12 text-center md:text-left">
          <div className="text-xs font-bold text-nutri-800 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2 mb-6">
            <Calendar size={14} /> {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
            {post.categories && post.categories.length > 0 && (
              <>
                <span className="text-stone-300">•</span>
                <span className="text-xs font-medium text-stone-500 bg-stone-100 px-3 py-1 rounded-full">
                  {post.categories[0].title}
                </span>
              </>
            )}
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-stone-900 leading-[1.1] tracking-tight mb-6">
            {post.title}
          </h1>
          
          {post.excerpt && (
            <p className="text-xl text-stone-500 leading-relaxed max-w-2xl font-light">
              {post.excerpt}
            </p>
          )}
        </header>

        {/* IMAGEM DE CAPA (HERO IMAGE) */}
        {post.mainImage && (
          <div className="my-14 relative h-[300px] md:h-[500px] w-full overflow-hidden rounded-3xl shadow-xl border border-stone-100">
            <Image 
              src={urlFor(post.mainImage).url()} 
              alt={post.alt || post.title} 
              fill 
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 800px" 
              priority
            />
          </div>
        )}

        {/* CONTEÚDO DO POST (PORTABLE TEXT OFICIAL) */}
        <div className="prose prose-stone prose-lg max-w-none prose-headings:text-stone-900 prose-p:text-stone-600 prose-a:text-nutri-800 prose-li:text-stone-600 prose-strong:text-stone-900">
          <PortableText value={post.body} components={portableTextComponents} />
        </div>

        {/* AUTOR DO POST */}
        {post.author && (
          <div className="mt-16 pt-8 border-t border-stone-100 flex items-center gap-4">
            {post.author.image ? (
              <div className="relative w-16 h-16 rounded-full overflow-hidden border border-stone-200">
                <Image src={urlFor(post.author.image).url()} alt={post.author.name} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center border border-stone-200">
                <span className="text-stone-400 font-bold text-xl">{post.author.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-1">Escrito por</p>
              <p className="text-lg font-bold text-stone-900">{post.author.name}</p>
            </div>
          </div>
        )}

        {/* CTA FINAL DO FUNIL DE CONVERSÃO (Otimizado para Mobile e Desktop) */}
        <div className="mt-16 p-8 md:p-12 bg-nutri-50 rounded-[2.5rem] border border-nutri-100 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/40 rounded-full blur-3xl"></div>
          
          <h3 className="text-2xl md:text-3xl font-bold mb-4 text-nutri-900 relative z-10">
            Pronto para transformar sua rotina?
          </h3>
          <p className="text-stone-600 mb-8 max-w-md mx-auto text-base md:text-lg relative z-10">
            A teoria você acabou de ler. Que tal aplicarmos isso com um protocolo feito sob medida para o seu corpo?
          </p>
          <Link 
            href="/avaliacao" 
            className="inline-flex w-full sm:w-auto justify-center items-center gap-3 bg-nutri-900 text-white px-8 md:px-10 py-4 md:py-5 rounded-full font-bold hover:bg-nutri-800 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 relative z-10"
          >
            Começar minha avaliação <ArrowRight size={20} />
          </Link>
        </div>

      </article>
    </main>
  );
}