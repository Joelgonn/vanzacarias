import Link from 'next/link';
import { client } from '@/sanity/lib/client'; // Importando o client configurado pelo Sanity
import { ArrowRight, Calendar } from 'lucide-react';
import Image from 'next/image';
import { urlFor } from '@/sanity/lib/image'; // Helper para exibir imagens do Sanity

// Esta função busca todos os posts no Sanity
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

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <main className="min-h-screen bg-stone-50 pt-32 pb-20 px-6 font-sans text-stone-800">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER DO BLOG */}
        <div className="mb-16 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-6">Blog da Vanusa</h1>
          <p className="text-lg text-stone-500 max-w-2xl">
            Conteúdos práticos, baseados em ciência e feitos para transformar sua rotina.
          </p>
        </div>

        {/* GRID DE POSTS */}
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post: any) => (
              <Link 
                href={`/blog/${post.slug.current}`} 
                key={post._id} 
                className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 group"
              >
                {/* IMAGEM DO POST */}
                {post.mainImage && (
                  <div className="relative h-56 w-full overflow-hidden bg-stone-200">
                    <Image 
                      src={urlFor(post.mainImage).url()} 
                      alt={post.title} 
                      fill 
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-nutri-800 uppercase tracking-widest mb-3">
                    <Calendar size={14} />
                    {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
                  </div>
                  <h2 className="text-xl font-bold text-stone-900 mb-3 group-hover:text-nutri-900 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-stone-500 text-sm mb-6 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <span className="inline-flex items-center gap-2 text-nutri-800 font-bold text-sm group-hover:gap-3 transition-all">
                    Ler artigo <ArrowRight size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-100">
            <p className="text-stone-400">Ainda não há posts publicados.</p>
          </div>
        )}
      </div>
    </main>
  );
}