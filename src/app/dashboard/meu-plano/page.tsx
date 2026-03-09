'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, FileText, Download, ArrowLeft, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function MeuPlano() {
  const [plano, setPlano] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    async function fetchPlano() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Usuário não autenticado.");
          setLoading(false);
          return;
        }

        // Busca o plano mais recente do usuário logado
        const { data, error: fetchError } = await supabase
          .from('plans')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw new Error("Erro ao buscar plano no banco de dados.");
        }

        if (data && data.length > 0) {
          setPlano(data[0]);
        } else {
          setError("Nenhum plano disponível no momento.");
        }
      } catch (err: any) {
        console.error("Erro no fetchPlano:", err);
        setError(err.message || "Erro inesperado ao carregar o plano.");
      } finally {
        setLoading(false);
      }
    }

    fetchPlano();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-nutri-800" size={48} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 p-8 md:p-12 font-sans text-stone-800">
      <div className="max-w-3xl mx-auto">
        
        {/* Navegação de Topo - Estilo App */}
        <nav className="flex items-center justify-between mb-16 mt-12">
          <Link 
            href="/dashboard" 
            className="group flex items-center gap-3 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-sm hover:border-nutri-800 transition-all duration-300"
          >
            <div className="bg-nutri-50 p-1 rounded-full group-hover:bg-nutri-800 transition-colors">
              <ChevronLeft size={18} className="text-nutri-800 group-hover:text-white" />
            </div>
            <span className="text-sm font-semibold text-stone-600 group-hover:text-nutri-900">Voltar ao Painel</span>
          </Link>
          
          <div className="text-sm font-bold text-stone-900 tracking-tight">
            Vanusa Zacarias Nutrição
          </div>
        </nav>

        {/* Card de Conteúdo Principal */}
        <div className="bg-white p-8 md:p-16 rounded-3xl shadow-xl border border-stone-100 text-center">
          <div className="w-24 h-24 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <FileText className="text-nutri-800" size={48} />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-6 tracking-tight">
            Seu Plano Alimentar
          </h1>
          
          <p className="text-stone-500 text-lg mb-12 max-w-md mx-auto leading-relaxed">
            O plano preparado pela Vanusa Zacarias está pronto. Você pode visualizar o arquivo abaixo ou fazer o download para consultar offline.
          </p>

          {error ? (
            <div className="bg-amber-50 text-amber-800 p-6 rounded-2xl border border-amber-100 max-w-sm mx-auto">
              <p className="font-medium">{error}</p>
            </div>
          ) : plano ? (
            <div className="flex flex-col gap-4 items-center">
              <a 
                href={plano.file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-nutri-900 text-white px-10 py-4 rounded-full font-medium hover:bg-nutri-800 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 w-full sm:w-auto justify-center"
              >
                <Download size={22} />
                Baixar/Visualizar PDF
              </a>
              <p className="text-xs text-stone-400 mt-6">
                Última atualização: {new Date(plano.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}