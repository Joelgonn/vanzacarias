import Link from 'next/link';

// Simulação de dados (no futuro, você puxará isso do Supabase ou Headless CMS como Prismic/Sanity)
const posts = [
  { id: 1, title: '5 Dicas para começar sua rotina saudável', date: '10/03/2026', excerpt: 'Mudar hábitos não precisa ser um sacrifício. Confira estratégias simples...' },
  { id: 2, title: 'O poder da hidratação na performance', date: '05/03/2026', excerpt: 'Você sabia que a falta de água pode travar seu emagrecimento?' },
];

export default function Blog() {
  return (
    <main className="min-h-screen bg-stone-50 pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-stone-900 mb-12">Blog da Vanusa</h1>
        
        <div className="grid gap-8">
          {posts.map((post) => (
            <Link href={`/blog/${post.id}`} key={post.id} className="bg-white p-8 rounded-3xl border border-stone-100 hover:shadow-lg transition-all group">
              <span className="text-xs font-bold text-nutri-800 uppercase tracking-widest">{post.date}</span>
              <h2 className="text-2xl font-bold text-stone-900 mt-2 mb-4 group-hover:text-nutri-900">{post.title}</h2>
              <p className="text-stone-600 mb-4">{post.excerpt}</p>
              <span className="text-nutri-800 font-bold text-sm">Ler mais →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}