'use client'; 

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ArrowRight, ChevronLeft, Calendar, MessageCircle, TrendingUp, User, LogOut, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { client } from '@/sanity/lib/client'; // Importa o cliente
import { urlFor } from '@/sanity/lib/image';    // Importa o urlFor de outro arquivo

// Importando o component da página de agendamento para usar no CTA
import AgendarViaWhatsAppButton from '@/components/AgendarViaWhatsAppButton'; 

// Simulação de um Post (você vai buscar isso no Sanity)
// const post = {
//   _id: '1',
//   title: '5 Dicas para começar sua rotina saudável',
//   slug: { current: '5-dicas-para-comecar-sua-rotina-saudavel' },
//   publishedAt: '2026-03-10T12:00:00Z',
//   excerpt: 'Mudar hábitos não precisa ser um sacrifício. Confira estratégias simples...',
//   mainImage: { asset: { _ref: 'image-f7b6e73e609364119087c3a1a378e11d0a1c5131-1000x1000-png' } }, // Exemplo de URL
//   body: [
//     { _type: 'block', children: [{_type: 'span', text: 'Este é o corpo do post. '}]},
//     { _type: 'block', children: [{_type: 'span', text: 'Aqui tem um parágrafo.', marks: ['strong']}]},
//     { _type: 'image', asset: { _ref: 'image-f7b6e73e609364119087c3a1a378e11d0a1c5131-1000x1000-png' }}
//   ]
// };


// Função para buscar um post específico pelo slug
async function getPostBySlug(slug: string) {
  const query = `*[_type == "post" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    mainImage,
    body, // <<< PEGANDO O CORPO DO POST
    author->{name, image, bio},
    categories[]->{title, slug}
  }`;
  const post = await client.fetch(query, { slug });
  return post;
}

// Componente para renderizar o conteúdo do Sanity (Portable Text)
const PortableTextRenderer = ({ blocks }: { blocks: any[] }) => {
  if (!blocks || !Array.isArray(blocks)) return null;

  return (
    <>
      {blocks.map((block: any, index: number) => {
        if (block._type === 'block') {
          if (block.style === 'h1') return <h1 key={index} className="text-4xl font-bold mb-6">{block.children[0].text}</h1>;
          if (block.style === 'h2') return <h2 key={index} className="text-3xl font-bold mb-4">{block.children[0].text}</h2>;
          if (block.style === 'h3') return <h3 key={index} className="text-2xl font-semibold mb-3">{block.children[0].text}</h3>;
          if (block.style === 'h4') return <h4 key={index} className="text-xl font-semibold mb-2">{block.children[0].text}</h4>;
          if (block.style === 'blockquote') return <blockquote key={index} className="border-l-4 border-nutri-800 pl-4 italic text-stone-600">{block.children[0].text}</blockquote>;
          
          return <p key={index} className="text-base text-stone-600 leading-relaxed mb-5">{block.children[0].text}</p>;
        }
        if (block._type === 'image') {
          return (
            <div key={index} className="my-8 relative h-64 w-full overflow-hidden rounded-xl shadow-md">
              <Image 
                src={urlFor(block.asset).url()} 
                alt={block.alt || 'Imagem do post'} 
                fill 
                className="object-cover"
              />
            </div>
          );
        }
        return null;
      })}
    </>
  );
};

export default function PostPage({ params }: { params: { slug: string } }) {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPost() {
      try {
        const fetchedPost = await getPostBySlug(params.slug);
        if (!fetchedPost || !fetchedPost.body) { // Verifica se tem corpo para não dar erro
          setError('Post não encontrado ou sem conteúdo.');
          setLoading(false);
          return;
        }
        setPost(fetchedPost);
      } catch (err: any) {
        console.error("Erro ao buscar post:", err);
        setError(err.message || "Erro ao carregar post.");
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [params.slug]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center p-8 bg-amber-50 border border-amber-100 rounded-3xl max-w-md">
          <p className="text-amber-800 font-medium">{error}</p>
          <Link href="/blog" className="inline-flex items-center gap-2 bg-nutri-800 text-white px-6 py-3 rounded-full font-bold mt-6">
            <ArrowLeft size={18} /> Voltar ao Blog
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pt-32 pb-20 px-6">
      <article className="max-w-2xl mx-auto">
        
        <nav className="flex items-center justify-between mb-12">
          <Link 
            href="/blog" 
            className="group flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1 rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Blog</span>
          </Link>
        </nav>

        <header className="mb-10 text-center">
          <div className="text-xs font-bold text-nutri-800 uppercase tracking-widest flex items-center gap-2 justify-center mb-4">
            <Calendar size={14} /> {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
            {post.categories && post.categories.length > 0 && (
              <span className="text-xs font-medium text-nutri-600"> - {post.categories[0].title}</span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 leading-tight">{post.title}</h1>
          {post.excerpt && <p className="text-lg text-stone-500 mt-4 max-w-2xl mx-auto">{post.excerpt}</p>}
        </header>

        {post.mainImage && (
          <div className="my-12 relative h-72 w-full overflow-hidden rounded-3xl shadow-xl">
            <Image 
              src={urlFor(post.mainImage).url()} 
              alt={post.alt || post.title} 
              fill 
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Para responsividade
            />
          </div>
        )}

        {/* CONTEÚDO DO POST */}
        <div className="prose prose-stone prose-lg max-w-none">
          <PortableTextRenderer blocks={post.body} />
        </div>

        {/* CTA FINAL DO POST */}
        <div className="mt-16 p-8 bg-nutri-50 rounded-3xl text-center">
          <h3 className="text-xl font-bold mb-4 text-nutri-900">Gostou destas dicas?</h3>
          <p className="text-stone-600 mb-6 max-w-md mx-auto">Vamos aplicar essas estratégias na sua rotina e transformar sua saúde. Agende sua consulta!</p>
          <Link href="/avaliacao" className="inline-flex items-center gap-2 bg-nutri-900 text-white px-8 py-4 rounded-full font-bold hover:bg-nutri-800 transition-all shadow-lg hover:shadow-lg transform hover:-translate-y-1">
            Começar minha avaliação <ArrowRight size={18} />
          </Link>
        </div>
      </article>
    </main>
  );
}