'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// =========================================================================
// SCHEMA CLÍNICO REAL (QFA)
// =========================================================================
const qfaSchema = [
  {
    category: "Leites e Derivados",
    items: [
      { id: "leite", label: "Leite (copo de requeijão)" },
      { id: "iogurte", label: "Iogurte natural (copo de requeijão)" },
      { id: "queijos", label: "Queijos (1/2 fatia)" },
      { id: "requeijao", label: "Requeijão / Creme de ricota etc (1,5 colher de sopa)" }
    ]
  },
  {
    category: "Carnes e Ovos",
    items: [
      { id: "ovo", label: "Ovo cozido / mexido (2 unidades)" },
      { id: "carne_vermelha", label: "Carnes vermelhas (1 unidade)" },
      { id: "carne_porco", label: "Carnes de Porco (1 fatia)" },
      { id: "frango", label: "Frango - filé, sobrecoxa, peito (1 unidade)" },
      { id: "peixe", label: "Peixe fresco / Frutos do Mar (1 unidade)" }
    ]
  },
  {
    category: "Óleos",
    items: [
      { id: "azeite", label: "Azeite (1 colher de sopa)" },
      { id: "bacon", label: "Bacon e toucinho / banha (1/2 fatia)" },
      { id: "frituras", label: "Frituras" },
      { id: "manteiga", label: "Manteiga / Margarina (1/2 colher de sopa)" },
      { id: "maionese", label: "Maionese (1/2 colher de sopa)" },
      { id: "oleos_veg", label: "Óleos vegetais (1 colher de sopa)" }
    ]
  },
  {
    category: "Cereais e Leguminosas",
    items: [
      { id: "arroz", label: "Arroz Branco / Integral (4 colheres de sopa)" },
      { id: "aveia", label: "Aveia (4 colheres de sopa)" },
      { id: "pao", label: "Pão francês / Integral / Forma (1 unidade)" },
      { id: "macarrao", label: "Macarrão (3 colheres e 1/2 de sopa)" },
      { id: "bolos", label: "Bolos caseiros (1 fatia pequena)" },
      { id: "leguminosas", label: "Leguminosas (1 concha)" },
      { id: "soja", label: "Soja (1 colher de servir)" },
      { id: "oleaginosas", label: "Oleaginosas (castanha/nozes/amendoim) (1 colher de sopa)" }
    ]
  },
  {
    category: "Frutas/Verduras/Legumes",
    items: [
      { id: "fruta", label: "Fruta in natura (1 unidade/fatia)" },
      { id: "folhosos", label: "Folhosos (10 folhas)" },
      { id: "tuberculos", label: "Tubérculos (batatas/cenoura/beterraba) (2 colheres de sopa)" },
      { id: "legumes", label: "Legumes (abobora/chuchu/tomate/pepino) (2 colheres de sopa)" }
    ]
  },
  {
    category: "Petiscos embutidos Enlatados",
    items: [
      { id: "snacks", label: "Snacks - salgadinhos, bolachas, pizza, amendoim (1 pacote)" },
      { id: "instantaneos", label: "Macarrão instantâneo / lasanha / Nuggets (1 pacote)" },
      { id: "embutidos", label: "Embutidos em geral (presunto, mortadela etc) (2 fatias)" },
      { id: "enlatados", label: "Enlatados (milho, ervilha, palmito, azeitona) (2 colheres de sopa)" }
    ]
  },
  {
    category: "Sobremesas e Doces",
    items: [
      { id: "sorvete", label: "Sorvete (1 unidade ou 2 bolas)" },
      { id: "tortas", label: "Tortas e Doces Elaborados (1 fatia)" },
      { id: "chocolates", label: "Chocolates (1 unidade)" },
      { id: "balas", label: "Balas (1 unidade)" }
    ]
  },
  {
    category: "Bebidas",
    items: [
      { id: "agua", label: "Água (1 garrafa 510 ml)" },
      { id: "cafe_s_acucar", label: "Café sem açúcar (1 xícara café)" },
      { id: "suco_natural_s_acucar", label: "Suco Natural / Chás sem açúcar (copo de requeijão)" },
      { id: "refrigerante", label: "Refrigerante normal (copo de requeijao)" },
      { id: "cafe_c_acucar", label: "Café / Chá com açúcar (1 xícara café)" },
      { id: "suco_natural_c_acucar", label: "Suco Natural Adoçado (copo de requeijao)" },
      { id: "suco_caixinha", label: "Sucos de Caixinha (copo de requeijao)" }
    ]
  }
];

const options = ["0", "1-3", "4-6", "7-9", "10 +"];

interface QFAFormProps {
  onSuccess: () => void;
}

export default function QFAForm({ onSuccess }: QFAFormProps) {
  // =========================================================================
  // ESTADOS
  // =========================================================================
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  // =========================================================================
  // CÁLCULOS E HANDLERS
  // =========================================================================
  const handleSelect = (itemId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [itemId]: val }));
  };

  const totalItems = qfaSchema.reduce((acc, cat) => acc + cat.items.length, 0);
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / totalItems) * 100);
  const isComplete = progress === 100;

  const handleSave = async () => {
    setLoading(true);
    const toastId = toast.loading("Salvando suas respostas...");

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error("Sessão expirada. Por favor, faça login novamente.");
      }

      const { error } = await supabase
        .from('qfa_responses')
        .upsert(
          { 
            user_id: session.user.id, 
            answers: answers, 
            updated_at: new Date().toISOString() 
          }, 
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      toast.success("Questionário salvo com sucesso!", { id: toastId });
      setTimeout(() => onSuccess(), 1000);

    } catch (error: any) {
      console.error("DETALHES DO ERRO:", error);
      toast.error(error.message || "Ocorreu um erro ao salvar. Tente novamente.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <div className="space-y-12 pb-24 max-w-4xl mx-auto">
      
      {/* Barra de Progresso (Sticky Header com Glassmorphism) */}
      <div className="sticky top-0 md:top-20 z-40 bg-white/80 backdrop-blur-md pt-4 pb-6 md:pt-6 border-b border-stone-100 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] mb-8 px-4 md:px-0">
        <div className="flex justify-between items-end mb-3">
          <span className="text-[10px] font-black uppercase text-nutri-800 tracking-[0.2em] flex items-center gap-2">
            Seu Perfil Alimentar
          </span>
          <span className={`text-xs font-black transition-colors ${isComplete ? 'text-emerald-500 flex items-center gap-1' : 'text-stone-400'}`}>
            {isComplete && <CheckCircle2 size={14} />} {progress}% concluído
          </span>
        </div>
        <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden shadow-inner">
          <div 
            className={`h-full transition-all duration-700 ease-[0.22,1,0.36,1] ${isComplete ? 'bg-emerald-500' : 'bg-nutri-800'}`} 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="px-4 md:px-0 space-y-12">
        {qfaSchema.map((section, sIdx) => (
          <div key={sIdx} className="space-y-6 animate-fade-in-up" style={{ animationDelay: `${sIdx * 50}ms` }}>
            <h3 className="text-sm font-black text-stone-900 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
               <div className="w-1.5 h-4 bg-nutri-800 rounded-full shadow-sm"></div>
               {section.category}
            </h3>

            <div className="space-y-4">
              {section.items.map((item) => {
                const hasAnswer = !!answers[item.id];

                return (
                  <div 
                    key={item.id} 
                    className={`bg-white p-5 md:p-6 rounded-3xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-5
                      ${hasAnswer ? 'border-nutri-200/50 shadow-sm' : 'border-stone-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-stone-300'}
                    `}
                  >
                    <p className={`font-bold text-sm md:text-base transition-colors w-full md:w-1/2 ${hasAnswer ? 'text-stone-900' : 'text-stone-600'}`}>
                      {item.label}
                    </p>
                    
                    <div className="flex items-center gap-1 bg-stone-50 p-1.5 rounded-2xl border border-stone-100 shadow-inner w-full md:w-auto overflow-x-auto scrollbar-hide">
                      {options.map((opt) => {
                        const isSelected = answers[item.id] === opt;
                        const notSelectedFaded = hasAnswer && !isSelected ? 'opacity-40 hover:opacity-100' : '';

                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelect(item.id, opt)}
                            className={`flex-1 md:flex-none min-w-[50px] py-3 text-xs font-black rounded-xl transition-all duration-300 active:scale-90 whitespace-nowrap px-2 ${notSelectedFaded} ${
                              isSelected 
                              ? 'bg-nutri-900 text-white shadow-md scale-105' 
                              : 'text-stone-400 hover:bg-white hover:text-stone-700 hover:shadow-sm'
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

        <div className="pt-8 border-t border-stone-100">
          <button
            onClick={handleSave}
            disabled={loading || !isComplete}
            className="w-full bg-nutri-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-nutri-900/20 hover:bg-nutri-800 transition-all duration-300 disabled:opacity-50 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {loading ? "SALVANDO..." : "FINALIZAR E SALVAR AVALIAÇÃO"}
          </button>
          {!isComplete && (
            <p className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-4">
              Faltam responder {totalItems - answeredCount} itens para habilitar o salvamento.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}