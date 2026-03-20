'use client';

import { useState, useMemo } from 'react';
import { Save, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// =========================================================================
// INTERFACES E TIPAGENS
// =========================================================================
interface QFAItem {
  id: string;
  label: string;
}

interface QFACategory {
  category: string;
  items: QFAItem[];
}

// =========================================================================
// DADOS DO QUESTIONÁRIO (QFA) - ESTRUTURA EXPANDIDA
// =========================================================================
const qfaData: QFACategory[] = [
  {
    category: "Leites e Derivados",
    items: [
      { id: "leite", label: "Leite (copo de requeijão)" },
      { id: "iogurte", label: "Iogurte natural ou adoçado (copinho)" },
      { id: "queijo", label: "Queijos (1 fatia média)" },
      { id: "requeijao", label: "Requeijão / Creme de ricota (1,5 colher sopa)" }
    ]
  },
  {
    category: "Carnes, Ovos e Leguminosas",
    items: [
      { id: "ovo", label: "Ovos (unidade)" },
      { id: "carne_vermelha", label: "Carnes vermelhas (bife/pedaço médio)" },
      { id: "carne_porco", label: "Carnes de Porco (fatia/pedaço)" },
      { id: "frango", label: "Frango (filé, sobrecoxa, peito)" },
      { id: "peixe", label: "Peixe fresco / Frutos do Mar" },
      { id: "feijao", label: "Feijões, lentilha ou grão-de-bico (1 concha)" }
    ]
  },
  {
    category: "Frutas, Verduras e Legumes",
    items: [
      { id: "fruta", label: "Frutas in natura (1 unidade/fatia média)" },
      { id: "suco_nat", label: "Suco de fruta natural (1 copo)" },
      { id: "folhosos", label: "Folhas cruas (alface, rúcula, couve)" },
      { id: "tuberculos", label: "Tubérculos (batatas, mandioca) (2 col. sopa)" },
      { id: "legumes", label: "Legumes cozidos (abóbora, cenoura) (2 col. sopa)" }
    ]
  },
  {
    category: "Cereais e Massas",
    items: [
      { id: "arroz", label: "Arroz branco ou integral (2 colheres sopa)" },
      { id: "pao_frances", label: "Pão francês (unidade)" },
      { id: "pao_forma", label: "Pão de forma integral/branco (2 fatias)" },
      { id: "macarrao", label: "Macarrão/Massas (1 escumadeira)" },
      { id: "aveia", label: "Aveia, granola ou cereais matinais" }
    ]
  },
  {
    category: "Gorduras, Doces e Ultraprocessados",
    items: [
      { id: "azeite", label: "Azeite de oliva ou óleo vegetal (1 colher sopa)" },
      { id: "manteiga", label: "Manteiga ou margarina (1 colher chá)" },
      { id: "castanhas", label: "Castanhas, nozes ou amendoim (punhado)" },
      { id: "doces", label: "Doces, chocolates ou sobremesas (porção)" },
      { id: "refri", label: "Refrigerante ou suco de caixinha (1 copo)" },
      { id: "fastfood", label: "Fast-food (hambúrguer, pizza, salgados)" }
    ]
  }
];

const frequencyOptions = ["0", "1-3", "4-6", "7-9", "10+"];

export default function FoodFrequencyForm() {
  // =========================================================================
  // ESTADOS
  // =========================================================================
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

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
    const toastId = toast.loading("Salvando suas respostas...");
    
    // Simulação de chamada ao Supabase (Substitua por seu insert real quando estiver pronto)
    // const { data: { session } } = await supabase.auth.getSession();
    // await supabase.from('qfa_answers').insert({ user_id: session?.user.id, respostas: answers });
    
    setTimeout(() => {
      toast.success("Avaliação de Frequência Alimentar salva com sucesso!", { id: toastId });
      setIsSaving(false);
    }, 1500);
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 lg:p-12 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-stone-100 relative">
      
      {/* CABEÇALHO */}
      <div className="mb-10 text-center md:text-left">
        <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight mb-3">
          Frequência Alimentar (QFA)
        </h2>
        <p className="text-stone-500 font-medium leading-relaxed max-w-2xl">
          Para que sua dieta seja perfeitamente ajustada, marque a quantidade média de <b className="text-nutri-800">porções que você consome semanalmente</b> de cada grupo alimentar listado abaixo.
        </p>
      </div>

      {/* BARRA DE PROGRESSO STICKY (Flutua no mobile ao rolar) */}
      <div className="sticky top-20 z-40 bg-white/80 backdrop-blur-md pt-2 pb-6 md:static md:bg-transparent md:pt-0 border-b border-stone-100 mb-10">
        <div className="bg-stone-50 p-5 rounded-3xl border border-stone-200/60 shadow-inner flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <div className="flex justify-between items-end mb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Progresso do Formulário</span>
              <span className={`text-lg font-black transition-colors ${isComplete ? 'text-emerald-500' : 'text-nutri-800'}`}>
                {progress}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full transition-all duration-700 ease-[0.22,1,0.36,1] ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-nutri-600 to-nutri-800'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          {isComplete && (
            <div className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 animate-fade-in">
              <CheckCircle2 size={16} /> Concluído
            </div>
          )}
        </div>
      </div>

      {/* LISTA DE PERGUNTAS DINÂMICA */}
      <div className="space-y-12">
        {qfaData.map((category, catIndex) => (
          <div key={catIndex} className="animate-fade-in-up" style={{ animationDelay: `${catIndex * 100}ms` }}>
            <h3 className="text-sm font-black text-stone-400 uppercase tracking-[0.15em] mb-5 flex items-center gap-3">
              <span className="bg-stone-50 border border-stone-200 w-8 h-8 rounded-full flex items-center justify-center text-[11px] text-nutri-800 shadow-sm">{catIndex + 1}</span>
              {category.category}
            </h3>
            
            <div className="space-y-4">
              {category.items.map((item) => {
                const hasAnswer = !!answers[item.id];
                
                return (
                  <div 
                    key={item.id} 
                    className={`bg-stone-50/50 p-5 md:p-6 rounded-3xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-5 group
                      ${hasAnswer ? 'border-nutri-200/50 shadow-sm bg-white' : 'border-stone-100 hover:border-stone-300'}
                    `}
                  >
                    <span className={`text-sm md:text-base font-bold w-full md:w-1/2 flex items-start gap-3 transition-colors ${hasAnswer ? 'text-stone-900' : 'text-stone-600'}`}>
                      {hasAnswer ? <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0 animate-fade-in" /> : <ChevronRight size={18} className="text-stone-300 mt-0.5 shrink-0 group-hover:translate-x-1 transition-transform" />}
                      {item.label}
                    </span>
                    
                    <div className="flex items-center gap-1.5 w-full md:w-auto bg-stone-100/50 p-1.5 rounded-2xl border border-stone-200/60 shadow-inner">
                      {frequencyOptions.map((opt) => {
                        const isSelected = answers[item.id] === opt;
                        // UX: Deixa os botões não selecionados mais opacos se a linha já tiver resposta
                        const notSelectedFaded = hasAnswer && !isSelected ? 'opacity-40 hover:opacity-100' : '';
                        
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelect(item.id, opt)}
                            className={`flex-1 md:flex-none md:min-w-[50px] py-2.5 px-1 text-xs font-extrabold rounded-xl transition-all duration-300 active:scale-90 ${notSelectedFaded} ${
                              isSelected 
                                ? 'bg-nutri-900 text-white shadow-md scale-105' 
                                : 'text-stone-500 hover:bg-white hover:text-stone-800 hover:shadow-sm'
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

      {/* BOTÃO SALVAR */}
      <div className="mt-12 pt-8 border-t border-stone-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest text-center md:text-left">
          {isComplete ? "Tudo pronto! Você pode salvar agora." : `Faltam responder ${totalQuestions - answeredCount} itens.`}
        </p>
        
        <button 
          onClick={handleSave}
          disabled={isSaving || !isComplete}
          className="w-full md:w-auto px-12 flex items-center justify-center gap-3 bg-nutri-900 text-white py-4.5 rounded-2xl font-bold text-base hover:bg-nutri-800 transition-all duration-300 disabled:opacity-50 disabled:bg-stone-300 disabled:text-stone-500 shadow-xl shadow-nutri-900/20 disabled:shadow-none active:scale-95"
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {isSaving ? "Finalizando..." : "Salvar Respostas do QFA"}
        </button>
      </div>

    </div>
  );
}