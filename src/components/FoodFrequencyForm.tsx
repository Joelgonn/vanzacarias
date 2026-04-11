'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, CheckCircle2, ChevronRight, Loader2, Info, HelpCircle, Activity } from 'lucide-react';
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
const frequencyMap: Record<string, number> = {
  Nunca: 0,
  Raramente: 1,
  "2-3x Sem": 2,
  "4-5x Sem": 3,
  "Todo Dia": 4
};

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

    const hasOnlyValidAnswers = Object.values(answers).every((answer) => frequencyOptions.includes(answer));
    if (!hasOnlyValidAnswers) {
      toast.error("Existe uma resposta invalida. Revise o questionario antes de enviar.");
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
          respostas: Object.fromEntries(
            Object.entries(answers).map(([key, value]) => [key, frequencyMap[value]])
          ),
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
    <div className="max-w-4xl mx-auto bg-white/70 backdrop-blur-3xl p-5 md:p-10 lg:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white relative mt-8 mb-24 transition-all">
      
      {/* CABEÇALHO */}
      <div className="mb-8 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-[2.5rem] font-black text-stone-900 tracking-tight mb-3 flex items-center justify-center md:justify-start gap-3">
            <Activity className="text-stone-400" size={32} strokeWidth={2.5} />
            Raio-X Alimentar
          </h2>
          <p className="text-stone-500 font-medium leading-relaxed max-w-2xl text-sm md:text-base">
            Para que o cardápio fique perfeito para você, indique a <b className="text-stone-800">frequência real</b> que você consome os alimentos abaixo. Não existe resposta certa ou errada, seja honesto!
          </p>
        </div>
      </div>

      {/* BARRA DE PROGRESSO STICKY PREMIUM */}
      <div className="sticky top-4 md:top-6 z-50 mb-10 animate-fade-in-up">
        <div className="bg-white/95 backdrop-blur-xl p-4 md:p-5 rounded-[2rem] border border-stone-200/60 shadow-[0_12px_40px_rgba(0,0,0,0.08)] flex items-center justify-between gap-4 md:gap-6 transition-all duration-500">
          <div className="flex-1 w-full">
            <div className="flex justify-between items-end mb-2.5">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Progresso</span>
              <span className={`text-lg md:text-xl font-black tracking-tight transition-colors duration-500 ${isComplete ? 'text-emerald-500' : 'text-stone-800'}`}>
                {progress}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all duration-1000 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-stone-400 to-stone-800'}`} 
                style={{ width: `${progress}%` }}
              >
                {/* Efeito de Brilho Dinâmico */}
                <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-r from-transparent to-white/30" />
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex shrink-0">
            {isComplete ? (
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100/50 animate-in zoom-in duration-300">
                <CheckCircle2 size={16} strokeWidth={2.5} /> Finalizado
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-50 px-4 py-3 rounded-xl border border-stone-200/50">
                <Loader2 size={14} className="animate-spin" strokeWidth={2.5} /> Avaliando
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AVISO DIDÁTICO */}
      <div className="bg-amber-50/80 border border-amber-100/80 p-5 rounded-[1.5rem] flex flex-col sm:flex-row sm:items-center gap-4 mb-12 shadow-sm backdrop-blur-md">
        <div className="bg-white text-amber-500 p-3 rounded-xl shrink-0 shadow-sm border border-amber-100/50 self-start sm:self-auto">
          <Info size={20} strokeWidth={2.5} />
        </div>
        <p className="text-xs md:text-sm font-medium text-amber-800/80 leading-relaxed">
          <strong className="text-amber-900 block sm:inline sm:mr-1 mb-1 sm:mb-0">Como preencher:</strong>
          Se consome apenas aos finais de semana, marque <b>&quot;2-3x Sem&quot;</b>. Se consome todos os dias de segunda a sexta, marque <b>&quot;4-5x Sem&quot;</b>.
        </p>
      </div>

      {/* LISTA DE PERGUNTAS DINÂMICA (Estilo Cards Premium) */}
      <div className="space-y-16">
        {qfaData.map((category, catIndex) => (
          <div key={catIndex} className="animate-fade-in-up" style={{ animationDelay: `${catIndex * 100}ms` }}>
            
            {/* Título da Categoria com Descrição */}
            <div className="mb-6 px-2">
              <h3 className="text-[11px] md:text-xs font-black text-stone-400 uppercase tracking-[0.2em] mb-2.5 flex items-center gap-3">
                <span className="bg-white border border-stone-200/80 shadow-sm w-8 h-8 rounded-full flex items-center justify-center text-[11px] text-stone-500 shrink-0">
                  {catIndex + 1}
                </span>
                {category.category}
              </h3>
              {category.description && (
                <p className="text-xs font-medium text-stone-500 ml-11 md:ml-12">
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
                    className={`p-5 md:p-6 rounded-[2rem] border transition-all duration-500 flex flex-col xl:flex-row xl:items-center justify-between gap-6 group relative overflow-hidden
                      ${hasAnswer 
                        ? 'bg-stone-50/40 border-emerald-100 shadow-[0_4px_20px_rgba(16,185,129,0.04)] scale-[0.99] xl:scale-100' 
                        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-md'
                      }
                    `}
                  >
                    {/* Borda verde lateral indicando sucesso (Microinteração) */}
                    {hasAnswer && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400 transition-all duration-500 rounded-l-[2rem]" />
                    )}
                    
                    {/* Bloco de Texto do Item */}
                    <div className="w-full xl:w-5/12 flex items-start gap-3.5 sm:pl-2">
                      {hasAnswer ? (
                        <CheckCircle2 size={20} className="text-emerald-500 mt-0.5 shrink-0 animate-in zoom-in duration-300" strokeWidth={2.5} /> 
                      ) : (
                        <ChevronRight size={20} className="text-stone-300 mt-0.5 shrink-0 group-hover:translate-x-1 group-hover:text-stone-400 transition-all" strokeWidth={2.5} />
                      )}
                      
                      <div className="flex flex-col">
                        <span className={`text-sm md:text-[15px] font-extrabold transition-colors duration-300 tracking-tight ${hasAnswer ? 'text-stone-400' : 'text-stone-800'}`}>
                          {item.label}
                        </span>
                        {item.description && (
                          <span className={`text-[11px] font-medium leading-snug mt-1.5 flex items-start gap-1.5 transition-colors duration-300 ${hasAnswer ? 'text-stone-300' : 'text-stone-500'}`}>
                            <HelpCircle size={14} className="shrink-0 mt-[1px] opacity-40" />
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Botões de Frequência - Segmented Control Premium */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 w-full xl:w-auto bg-stone-50/80 p-1.5 rounded-2xl border border-stone-200/50 shadow-inner">
                      {frequencyOptions.map((opt) => {
                        const isSelected = answers[item.id] === opt;
                        // Apaga as opções não selecionadas APENAS se a pergunta já foi respondida
                        const notSelectedFaded = hasAnswer && !isSelected ? 'opacity-30 hover:opacity-100 scale-95' : '';
                        
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelect(item.id, opt)}
                            className={`h-12 sm:h-11 px-3 flex-1 sm:flex-none flex items-center justify-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 active:scale-90 ${notSelectedFaded} ${
                              isSelected 
                                ? 'bg-white text-stone-800 shadow-[0_4px_15px_rgba(0,0,0,0.08)] scale-100 border border-stone-100/80' 
                                : 'text-stone-500 hover:bg-white hover:text-stone-800 hover:shadow-sm border border-transparent'
                            }`}
                          >
                            <span className="truncate">{opt}</span>
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
      <div className="mt-16 pt-8 border-t border-stone-200/80 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        <p className="text-[11px] text-stone-400 font-black uppercase tracking-[0.15em] text-center md:text-left flex items-center gap-2">
          {isComplete ? (
            <><CheckCircle2 size={16} className="text-emerald-500" /> Tudo pronto! Você pode enviar sua avaliação.</>
          ) : (
            <><Loader2 size={16} className="animate-spin text-stone-300" /> Faltam responder {totalQuestions - answeredCount} itens.</>
          )}
        </p>
        
        <button 
          onClick={handleSave}
          disabled={isSaving || !isComplete}
          className="w-full md:w-auto px-10 flex items-center justify-center gap-3 bg-stone-900 text-white py-4 md:py-5 rounded-2xl font-bold text-sm hover:bg-stone-800 transition-all duration-300 disabled:opacity-40 disabled:bg-stone-200 disabled:text-stone-400 shadow-[0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.2)] disabled:shadow-none active:scale-[0.98]"
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} strokeWidth={2.5} /> : <Save size={20} strokeWidth={2.5} />}
          {isSaving ? "Analisando Perfil..." : "Enviar Raio-X Alimentar"}
        </button>
      </div>

    </div>
  );
}
