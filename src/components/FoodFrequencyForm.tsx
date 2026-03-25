'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, CheckCircle2, ChevronRight, Loader2, Info, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// =========================================================================
// INTERFACES E TIPAGENS
// =========================================================================
interface QFAItem {
  id: string;
  label: string;
  description?: string;
}

interface QFACategory {
  category: string;
  description?: string;
  items: QFAItem[];
}

// =========================================================================
// DADOS DO QUESTIONÁRIO (QFA) - PADRÃO OURO CLÍNICO
// =========================================================================
const qfaData: QFACategory[] = [
  {
    category: "Cereais, Raízes e Pães",
    description: "Alimentos ricos em carboidratos, que são a principal fonte de energia do corpo.",
    items: [
      { id: "arroz_branco", label: "Arroz branco ou macarrão tradicional", description: "Versões normais (refinadas), sem ser integral." },
      { id: "arroz_integral", label: "Arroz integral, macarrão integral ou quinoa", description: "Versões ricas em fibras (grãos escuros)." },
      { id: "batatas_raizes", label: "Batata doce, batata inglesa, mandioca ou inhame", description: "Tubérculos e raízes cozidos, assados ou em purê." },
      { id: "tapioca_cuscuz", label: "Tapioca ou Cuscuz de milho", description: "Preparações comuns de café da manhã." },
      { id: "pao_branco", label: "Pão francês ou pão de forma branco", description: "Pães tradicionais de padaria ou mercado." },
      { id: "pao_integral", label: "Pão 100% integral", description: "Pães escuros com grãos e sementes visíveis." },
      { id: "aveia_granola", label: "Aveia em flocos, granola ou cereais matinais", description: "Geralmente consumidos com frutas ou leite." }
    ]
  },
  {
    category: "Carnes, Ovos e Leguminosas",
    description: "Principais fontes de proteínas para construção muscular. As 'Leguminosas' são os grãos que dão em vagens.",
    items: [
      { id: "ovos", label: "Ovos de galinha", description: "Cozidos, mexidos, fritos ou usados em receitas." },
      { id: "frango", label: "Frango ou aves", description: "Peito de frango, sobrecoxa, desfiado ou em pedaços." },
      { id: "peixes", label: "Peixes e Frutos do Mar", description: "Tilápia, atum, sardinha, salmão ou camarão." },
      { id: "carne_magra", label: "Carne vermelha magra", description: "Patinho, músculo, filé mignon ou lagarto (sem capa de gordura)." },
      { id: "carne_gorda", label: "Carne vermelha gorda", description: "Picanha, costela, cupim, contrafilé com gordura ou acém." },
      { id: "carne_porco", label: "Carne de porco", description: "Lombo, pernil, bisteca ou costelinha." },
      { id: "feijoes", label: "Leguminosas (Feijões)", description: "Feijão carioca/preto, lentilha, grão-de-bico, ervilha ou soja." }
    ]
  },
  {
    category: "Laticínios e Proteínas Vegetais",
    description: "Derivados do leite (ricos em cálcio) e alternativas vegetarianas.",
    items: [
      { id: "leite_integral", label: "Leite integral (vaca)", description: "Leite de caixinha ou pó com teor normal de gordura." },
      { id: "leite_desnatado", label: "Leite desnatado ou leites vegetais", description: "Leite sem gordura ou leite de amêndoa, aveia, coco." },
      { id: "queijo_branco", label: "Queijos brancos e leves", description: "Queijo minas frescal, ricota, cottage ou requeijão light." },
      { id: "queijo_amarelo", label: "Queijos amarelos e curados", description: "Mussarela, prato, parmesão, provolone ou cheddar." },
      { id: "iogurte", label: "Iogurte natural ou proteico", description: "Iogurtes sem açúcar, coalhada ou bebidas com whey." },
      { id: "tofu_soja", label: "Tofu e Soja", description: "Queijo de soja (tofu), PTS (carne de soja) ou hambúrguer vegetal." }
    ]
  },
  {
    category: "Frutas e Vegetais",
    description: "Alimentos indispensáveis para fornecer vitaminas, minerais e imunidade.",
    items: [
      { id: "frutas_frescas", label: "Frutas in natura", description: "Banana, maçã, mamão, laranja, melancia, etc." },
      { id: "suco_natural", label: "Suco de fruta natural", description: "Suco feito da própria fruta (mesmo se não colocar açúcar)." },
      { id: "folhas_cruas", label: "Folhas cruas (Salada)", description: "Alface, rúcula, couve, espinafre, repolho." },
      { id: "legumes_cozidos", label: "Legumes cozidos ou assados", description: "Cenoura, abobrinha, brócolis, couve-flor, chuchu." }
    ]
  },
  {
    category: "Gorduras e Oleaginosas",
    description: "Fontes de lipídios. As 'Oleaginosas' são castanhas e sementes ricas em gorduras boas.",
    items: [
      { id: "azeite", label: "Azeite de oliva extra virgem", description: "Usado na salada ou para finalizar pratos." },
      { id: "manteiga", label: "Manteiga ou Ghee", description: "Origem animal (não confundir com margarina)." },
      { id: "margarina_oleo", label: "Margarina ou Óleos de cozinha", description: "Óleo de soja, milho, girassol ou canola." },
      { id: "castanhas_amendoim", label: "Oleaginosas (Castanhas)", description: "Castanha do caju/pará, nozes, amendoim ou pasta de amendoim." },
      { id: "abacate_coco", label: "Abacate ou Coco", description: "Frutas ricas em gorduras naturais." },
      { id: "sementes", label: "Sementes", description: "Sementes de chia, linhaça, gergelim ou abóbora." }
    ]
  },
  {
    category: "Hidratação e Suplementos",
    description: "Bebidas do dia a dia e complementos nutricionais.",
    items: [
      { id: "agua_meta", label: "Água pura", description: "Marque com que frequência você bebe MAIS de 2 litros no dia." },
      { id: "cafe_puro", label: "Café puro ou chás (Sem adoçar)", description: "Totalmente puro, sem açúcar e sem adoçante." },
      { id: "cafe_adocicado", label: "Café ou chás (Adoçados)", description: "Com açúcar mascavo, demerara, branco ou adoçantes (sucralose, stevia)." },
      { id: "whey_protein", label: "Whey Protein ou Proteína Vegetal", description: "Suplemento em pó batido com água ou leite." },
      { id: "creatina_pretreino", label: "Creatina ou Pré-treino", description: "Termogênicos ou suplementos para performance." }
    ]
  },
  {
    category: "Industrializados, Doces e Bebidas",
    description: "Alimentos ultraprocessados, geralmente ricos em açúcares, sódio ou gorduras artificiais.",
    items: [
      { id: "doces_chocolates", label: "Doces e Sobremesas", description: "Chocolates, sorvetes, bolos recheados, pudins, balas." },
      { id: "biscoitos_salgadinhos", label: "Biscoitos e Salgadinhos de pacote", description: "Bolachas recheadas, Doritos, Ruffles, biscoito de água e sal." },
      { id: "frituras", label: "Frituras de imersão", description: "Batata frita, pastel, coxinha, empanados." },
      { id: "embutidos", label: "Embutidos e Defumados", description: "Salsicha, linguiça, presunto, mortadela, peito de peru, bacon." },
      { id: "refri_sucos_box", label: "Refrigerantes e Sucos de Caixa", description: "Refrigerantes (normais ou zero/diet) e sucos de pozinho ou caixinha." },
      { id: "fastfood", label: "Fast-food e Lanches", description: "Hambúrguer, pizza, hot-dog, esfihas." },
      { id: "alcool", label: "Bebidas alcoólicas", description: "Cerveja, chopp, vinho, caipirinha, vodka ou whisky." }
    ]
  }
];

const frequencyOptions = ["Nunca", "Raramente", "2-3x Sem", "4-5x Sem", "Todo Dia"];

export default function FoodFrequencyForm() {
  // =========================================================================
  // ESTADOS
  // =========================================================================
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  // =========================================================================
  // HANDLERS E CÁLCULOS
  // =========================================================================
  const handleSelect = (itemId: string, option: string) => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: option
    }));
  };

  const totalQuestions = useMemo(() => qfaData.reduce((acc, cat) => acc + cat.items.length, 0), []);
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / totalQuestions) * 100);
  const isComplete = answeredCount === totalQuestions;

  const handleSave = async () => {
    if (!isComplete) {
      toast.warning("Por favor, responda todas as perguntas antes de finalizar.");
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("Salvando e analisando suas respostas...");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Usuário não autenticado. Faça login novamente.", { id: toastId });
        setIsSaving(false);
        router.push('/login');
        return;
      }

      const { error } = await supabase
        .from('qfa_responses')
        .upsert({ 
          user_id: session.user.id, 
          respostas: answers,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success("Raio-X Alimentar concluído com sucesso!", { id: toastId });
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error) {
      console.error("Erro ao salvar QFA:", error);
      toast.error("Ocorreu um erro ao salvar. Tente novamente.", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto bg-white/70 backdrop-blur-xl p-6 md:p-10 lg:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white relative mt-8 mb-24">
      
      {/* CABEÇALHO */}
      <div className="mb-10 text-center md:text-left">
        <h2 className="text-3xl md:text-[2.5rem] font-bold text-stone-900 tracking-tight mb-3">
          Raio-X Alimentar
        </h2>
        <p className="text-stone-500 font-medium leading-relaxed max-w-2xl text-sm md:text-base">
          Para que o cardápio fique perfeito para você, indique a <b className="text-stone-800">frequência real</b> que você consome os alimentos abaixo. Não existe resposta certa ou errada, seja honesto!
        </p>
      </div>

      {/* BARRA DE PROGRESSO STICKY PREMIUM */}
      <div className="sticky top-20 z-40 bg-transparent pt-2 pb-6 mb-8 transition-all">
        <div className="bg-white/90 backdrop-blur-xl p-5 md:px-6 rounded-3xl border border-stone-200/50 shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <div className="flex justify-between items-end mb-2.5">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Progresso da Avaliação</span>
              <span className={`text-xl font-bold tracking-tight transition-colors ${isComplete ? 'text-emerald-500' : 'text-stone-800'}`}>
                {progress}%
              </span>
            </div>
            <div className="w-full h-2 bg-stone-100/80 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all duration-700 ease-out ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-stone-400 to-stone-800'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          {isComplete && (
            <div className="hidden md:flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-100/50 animate-fade-in">
              <CheckCircle2 size={16} /> Finalizado
            </div>
          )}
        </div>
      </div>

      {/* AVISO DIDÁTICO */}
      <div className="bg-amber-50/50 border border-amber-100/50 p-5 rounded-2xl flex items-start gap-4 mb-10 shadow-sm backdrop-blur-sm">
        <div className="bg-amber-100/50 text-amber-600 p-2.5 rounded-xl shrink-0"><Info size={18} /></div>
        <p className="text-xs md:text-sm font-medium text-amber-800/80 leading-relaxed mt-0.5">
          <strong className="text-amber-900 block mb-1">Como preencher:</strong>
          Se consome apenas aos finais de semana, marque <b>"2-3x Sem"</b>. Se consome todos os dias de segunda a sexta, marque <b>"4-5x Sem"</b>.
        </p>
      </div>

      {/* LISTA DE PERGUNTAS DINÂMICA (Estilo Cards Premium) */}
      <div className="space-y-16">
        {qfaData.map((category, catIndex) => (
          <div key={catIndex} className="animate-fade-in-up" style={{ animationDelay: `${catIndex * 100}ms` }}>
            
            {/* Título da Categoria com Descrição */}
            <div className="mb-6 px-2">
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-3">
                <span className="bg-white border border-stone-200/60 shadow-sm w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-stone-500">{catIndex + 1}</span>
                {category.category}
              </h3>
              {category.description && (
                <p className="text-xs font-medium text-stone-500 ml-10">
                  {category.description}
                </p>
              )}
            </div>
            
            <div className="space-y-4">
              {category.items.map((item) => {
                const hasAnswer = !!answers[item.id];
                
                return (
                  <div 
                    key={item.id} 
                    className={`bg-white/50 p-5 md:p-6 rounded-[1.5rem] border transition-all duration-300 flex flex-col xl:flex-row xl:items-center justify-between gap-6 group backdrop-blur-sm
                      ${hasAnswer ? 'border-emerald-100/50 shadow-[0_2px_15px_rgba(16,185,129,0.03)] bg-white/80 scale-[0.99]' : 'border-stone-100/80 hover:border-stone-200 hover:shadow-sm'}
                    `}
                  >
                    {/* Bloco de Texto do Item (Label + Descrição Sutil) */}
                    <div className="w-full xl:w-5/12 flex items-start gap-3.5">
                      {hasAnswer ? (
                        <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0 animate-fade-in" strokeWidth={2.5} /> 
                      ) : (
                        <ChevronRight size={18} className="text-stone-300 mt-0.5 shrink-0 group-hover:translate-x-1 group-hover:text-stone-400 transition-all" />
                      )}
                      
                      <div className="flex flex-col">
                        <span className={`text-sm md:text-base font-bold transition-colors ${hasAnswer ? 'text-stone-400' : 'text-stone-800'}`}>
                          {item.label}
                        </span>
                        {item.description && (
                          <span className={`text-[11px] font-medium leading-snug mt-1 flex items-start gap-1.5 transition-colors ${hasAnswer ? 'text-stone-300' : 'text-stone-500'}`}>
                            <HelpCircle size={12} className="shrink-0 mt-[1px] opacity-40" />
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Botões de Frequência - Segmented Control Premium */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 w-full xl:w-auto bg-stone-50/80 p-1.5 rounded-2xl border border-stone-100 shadow-inner">
                      {frequencyOptions.map((opt) => {
                        const isSelected = answers[item.id] === opt;
                        // Apaga as opções não selecionadas APENAS se a pergunta já foi respondida
                        const notSelectedFaded = hasAnswer && !isSelected ? 'opacity-40 hover:opacity-100 scale-95' : '';
                        
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelect(item.id, opt)}
                            className={`flex-1 sm:flex-none sm:min-w-[80px] py-3 sm:py-2.5 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all duration-300 active:scale-90 ${notSelectedFaded} ${
                              isSelected 
                                ? 'bg-white text-stone-800 shadow-[0_2px_10px_rgba(0,0,0,0.08)] scale-100 border border-stone-100/50' 
                                : 'text-stone-500 hover:bg-white hover:text-stone-700 hover:shadow-sm border border-transparent'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* BOTÃO SALVAR PREMIUM */}
      <div className="mt-14 pt-8 border-t border-stone-200/50 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-[11px] text-stone-400 font-bold uppercase tracking-[0.15em] text-center md:text-left">
          {isComplete ? "Tudo pronto! Você pode enviar sua avaliação." : `Faltam responder ${totalQuestions - answeredCount} itens.`}
        </p>
        
        <button 
          onClick={handleSave}
          disabled={isSaving || !isComplete}
          className="w-full md:w-auto px-10 flex items-center justify-center gap-3 bg-stone-900 text-white py-4 md:py-5 rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all duration-300 disabled:opacity-50 disabled:bg-stone-200 disabled:text-stone-400 shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] disabled:shadow-none active:scale-95"
        >
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {isSaving ? "Analisando Perfil..." : "Enviar Raio-X Alimentar"}
        </button>
      </div>

    </div>
  );
}