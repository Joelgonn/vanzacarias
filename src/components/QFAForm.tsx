'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { FoodRestriction } from '@/types/patient';
import { FOOD_REGISTRY, FoodEntity } from '@/lib/foodRegistry';
import { useRouter } from 'next/navigation';

// =========================================================================
// 🧠 HELPERS DE RESOLUÇÃO (QFA → FOOD REGISTRY)
// =========================================================================

function resolveQFAItemToFoods(qfaId: string): FoodEntity[] {
  const normalized = qfaId.toLowerCase();

  return FOOD_REGISTRY.filter(food =>
    food.aliases.some(alias =>
      alias.toLowerCase().includes(normalized) ||
      normalized.includes(alias.toLowerCase())
    ) ||
    food.tags.some(tag =>
      tag.toLowerCase().includes(normalized)
    )
  );
}

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
  const [restrictions, setRestrictions] = useState<FoodRestriction[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  // =========================================================================
  // INTELIGÊNCIA CLÍNICA: MATCH DE RESTRIÇÕES 
  // (Movida para cima para ser acessível nos useEffects)
  // =========================================================================
  const getRestrictionForItem = (itemId: string, itemLabel: string, currentRestrictions: FoodRestriction[]): FoodRestriction | null => {
    if (!currentRestrictions.length) return null;

    const matchedFoods = resolveQFAItemToFoods(itemId);
    const triggeredRestrictions: FoodRestriction[] = [];
    
    currentRestrictions.forEach(r => {
      let isMatch = false;

      if (r.foodId && matchedFoods.some(f => f.id === r.foodId)) {
        isMatch = true;
      }
      else if (r.tag && matchedFoods.some(f => f.tags.includes(r.tag as any))) {
        isMatch = true;
      }
      else if (r.food) {
        const legacyMatch = 
          matchedFoods.some(f => f.aliases.some(alias => alias.toLowerCase().includes(r.food.toLowerCase()))) ||
          itemId.toLowerCase().includes(r.food.toLowerCase()) || 
          itemLabel.toLowerCase().includes(r.food.toLowerCase()) ||
          r.food.toLowerCase().includes(itemId.toLowerCase());
          
        if (legacyMatch) isMatch = true;
      }

      if (isMatch) triggeredRestrictions.push(r);
    });

    if (triggeredRestrictions.length === 0) return null;

    const allergy = triggeredRestrictions.find(r => r.type === 'allergy');
    return allergy || triggeredRestrictions[0];
  };

  // =========================================================================
  // CARREGAR DADOS INICIAIS
  // =========================================================================
  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const [profileRes, qfaRes] = await Promise.all([
          supabase.from('profiles').select('food_restrictions').eq('id', session.user.id).single(),
          supabase.from('qfa_responses').select('answers').eq('user_id', session.user.id).single()
        ]);

        if (profileRes.data?.food_restrictions) {
          setRestrictions(profileRes.data.food_restrictions);
        }
        
        if (qfaRes.data?.answers) {
          setAnswers(qfaRes.data.answers);
        }
      }
      setFetchingData(false);
    }
    loadData();
  }, [supabase]);

  // =========================================================================
  // ✅ CORREÇÃO ARQUITETURAL: AUTO-FILL DE ALERGIAS VIA EFFECT
  // =========================================================================
  useEffect(() => {
    if (!restrictions.length) return;

    // Usando a callback form de setState para garantir que não dependemos 
    // do objeto answers no array de dependências (evitando infinitos loops)
    setAnswers(prev => {
      const updatedAnswers: Record<string, string> = { ...prev };
      let changed = false;

      qfaSchema.forEach(section => {
        section.items.forEach(item => {
          // Passamos a restrição atual para a função
          const restriction = getRestrictionForItem(item.id, item.label, restrictions);

          if (restriction?.type === 'allergy') {
            if (updatedAnswers[item.id] !== "0") {
              updatedAnswers[item.id] = "0";
              changed = true;
            }
          }
        });
      });

      // Se nada mudou, retorna o estado anterior para evitar re-render inútil
      return changed ? updatedAnswers : prev;
    });

  }, [restrictions]);

  // =========================================================================
  // CÁLCULOS E HANDLERS (COM PROGRESÃO INTELIGENTE)
  // =========================================================================
  const handleSelect = (itemId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [itemId]: val }));
  };

  const totalItems = qfaSchema.reduce((acc, cat) => acc + cat.items.length, 0);
  
  // 🔥 NOVO: Cálculo inteligente de progresso que não infla com alergias
  let allergyCount = 0;
  qfaSchema.forEach(section => {
    section.items.forEach(item => {
      const restriction = getRestrictionForItem(item.id, item.label, restrictions);
      if (restriction?.type === 'allergy') allergyCount++;
    });
  });

  const actionableItems = totalItems - allergyCount;
  const totalAnswers = Object.keys(answers).length;
  // Subtraímos as alergias auto-preenchidas para saber quantas ações manuais o usuário tomou
  const manualAnswersCount = Math.max(0, totalAnswers - allergyCount);

  // Progresso baseado apenas no que o usuário de fato precisa responder
  const progress = actionableItems === 0 ? 100 : Math.round((manualAnswersCount / actionableItems) * 100);
  const isComplete = manualAnswersCount >= actionableItems;

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

      if (!restrictions.length) {
        setShowRestrictionModal(true);
      } else {
        setTimeout(() => onSuccess(), 1000);
      }

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
  if (fetchingData) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="animate-spin text-nutri-800" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24 max-w-4xl mx-auto">
      
      {/* Barra de Progresso */}
      <div className="sticky top-0 md:top-20 z-40 bg-white/80 backdrop-blur-md pt-4 pb-6 md:pt-6 border-b border-stone-100 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] mb-8 px-4 md:px-0">
        <div className="flex justify-between items-end mb-3">
          <span className="text-[10px] font-black uppercase text-nutri-800 tracking-[0.2em] flex items-center gap-2">
            Seu Perfil Alimentar
          </span>
          <span className={`text-xs font-black transition-colors ${isComplete ? 'text-emerald-500 flex items-center gap-1' : 'text-stone-400'}`}>
            {isComplete && <CheckCircle2 size={14} />} {progress > 100 ? 100 : progress}% concluído
          </span>
        </div>
        <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden shadow-inner">
          <div 
            className={`h-full transition-all duration-700 ease-[0.22,1,0.36,1] ${isComplete ? 'bg-emerald-500' : 'bg-nutri-800'}`} 
            style={{ width: `${progress > 100 ? 100 : progress}%` }}
          ></div>
        </div>
      </div>

      <div className="px-4 md:px-0 space-y-12">

        {restrictions.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm md:text-base text-amber-900 font-bold">
                  Possui alergias ou restrições alimentares?
                </p>
                <p className="text-xs text-amber-700/80 mt-1 font-medium">
                  Deixe seu perfil alimentar completo para garantirmos prescrições seguras.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/completar-perfil')}
              className="w-full md:w-auto text-xs font-bold uppercase tracking-wider bg-amber-600 text-white px-5 py-3 rounded-xl hover:bg-amber-700 transition-colors shrink-0 shadow-sm"
            >
              Cadastrar agora
            </button>
          </div>
        )}

        {qfaSchema.map((section, sIdx) => (
          <div key={sIdx} className="space-y-6 animate-fade-in-up" style={{ animationDelay: `${sIdx * 50}ms` }}>
            <h3 className="text-sm font-black text-stone-900 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
               <div className="w-1.5 h-4 bg-nutri-800 rounded-full shadow-sm"></div>
               {section.category}
            </h3>

            <div className="space-y-4">
              {section.items.map((item) => {
                const restriction = getRestrictionForItem(item.id, item.label, restrictions);
                const isAllergy = restriction?.type === 'allergy';
                const isIntoleranceOrRestriction = restriction?.type === 'intolerance' || restriction?.type === 'restriction';
                
                const currentAnswer = answers[item.id];
                const hasAnswer = currentAnswer !== undefined;

                // ❌ O SETTIMEOUT FOI COMPLETAMENTE REMOVIDO DAQUI

                return (
                  <div 
                    key={item.id} 
                    className={`bg-white p-5 md:p-6 rounded-3xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-5
                      ${isAllergy ? 'border-red-200 bg-red-50/30 opacity-75' : hasAnswer ? 'border-nutri-200/50 shadow-sm' : 'border-stone-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-stone-300'}
                    `}
                  >
                    <div className="w-full md:w-1/2 flex flex-col gap-1">
                      <p className={`font-bold text-sm md:text-base transition-colors ${hasAnswer && !isAllergy ? 'text-stone-900' : 'text-stone-600'}`}>
                        {item.label}
                      </p>
                      
                      {isAllergy && (
                        <div className="flex items-center gap-1.5 text-red-600 text-xs font-semibold mt-1">
                          <AlertTriangle size={14} /> Detectamos alergia a este item (Bloqueado)
                        </div>
                      )}
                      {isIntoleranceOrRestriction && (
                        <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium mt-1">
                          <Info size={14} /> Você possui {restriction.type === 'intolerance' ? 'intolerância' : 'restrição'} a este grupo.
                        </div>
                      )}
                    </div>
                    
                    <div className={`flex items-center gap-1 p-1.5 rounded-2xl border shadow-inner w-full md:w-auto overflow-x-auto scrollbar-hide
                      ${isAllergy ? 'bg-red-50 border-red-100' : 'bg-stone-50 border-stone-100'}
                    `}>
                      {options.map((opt) => {
                        const isSelected = currentAnswer === opt;
                        const notSelectedFaded = hasAnswer && !isSelected ? 'opacity-40 hover:opacity-100' : '';

                        return (
                          <button
                            key={opt}
                            onClick={() => !isAllergy && handleSelect(item.id, opt)}
                            disabled={isAllergy}
                            className={`flex-1 md:flex-none min-w-[50px] py-3 text-xs font-black rounded-xl transition-all duration-300 whitespace-nowrap px-2 
                              ${isAllergy ? (isSelected ? 'bg-red-600 text-white shadow-md' : 'text-red-300 cursor-not-allowed') : ''}
                              ${!isAllergy && notSelectedFaded} 
                              ${!isAllergy && isSelected ? 'bg-nutri-900 text-white shadow-md scale-105' : ''}
                              ${!isAllergy && !isSelected ? 'text-stone-400 hover:bg-white hover:text-stone-700 hover:shadow-sm active:scale-90' : ''}
                            `}
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
              Faltam responder {actionableItems - manualAnswersCount} itens para habilitar o salvamento.
            </p>
          )}
        </div>
      </div>

      {showRestrictionModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white p-6 md:p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-300">
            
            <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 flex items-center justify-center rounded-full mb-5 shadow-inner border border-amber-200">
              <AlertTriangle size={32} />
            </div>
            
            <h2 className="font-black text-xl mb-2 text-stone-900 tracking-tight">
              Você possui restrições alimentares?
            </h2>
            
            <p className="text-sm text-stone-500 mb-8 font-medium leading-relaxed">
              Precisamos dessa confirmação para garantir sua segurança e excluir da sua prescrição qualquer alimento que possa lhe fazer mal.
            </p>

            <div className="flex flex-col gap-3 justify-center">
              <button
                onClick={() => {
                  router.push('/completar-perfil?from=qfa');
                }}
                className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold tracking-wide rounded-xl transition-colors shadow-md active:scale-[0.98]"
              >
                Sim, tenho restrições
              </button>

              <button
                onClick={() => {
                  setShowRestrictionModal(false);
                  onSuccess();
                }}
                className="w-full py-4 bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm font-bold tracking-wide rounded-xl transition-colors active:scale-[0.98]"
              >
                Não, como de tudo
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}