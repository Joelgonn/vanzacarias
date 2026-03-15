'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, Loader2 } from 'lucide-react';

const qfaSchema = [
  {
    category: "Leites e Derivados",
    items: [
      { id: "leite", label: "Leite (copo de requeijão)" },
      { id: "iogurte", label: "Iogurte natural (copo de requeijão)" },
      { id: "queijos", label: "Queijos (1/2 fatia)" },
      { id: "requeijao", label: "Requeijão / Crême de ricota etc (1,5 colher de sopa)" }
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
      { id: "instantaneos", label: "Macarrão instantâneo / lazanha / Nuggets (1 pacote)" },
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

export default function QFAForm({ onSuccess }: { onSuccess: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSelect = (itemId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [itemId]: val }));
  };

  const totalItems = qfaSchema.reduce((acc, cat) => acc + cat.items.length, 0);
  const progress = Math.round((Object.keys(answers).length / totalItems) * 100);

  const handleSave = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
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

      if (!error) {
        onSuccess();
      } else {
        // ISSO AQUI VAI TE SALVAR: Vai mostrar o erro no console e na tela!
        console.error("DETALHES DO ERRO:", error);
        alert(`Erro do banco de dados: ${error.message}`); 
      }
    } else {
      alert("Sessão expirada. Faça login novamente.");
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-12 pb-24">
      {/* Barra de Progresso */}
      <div className="sticky top-28 z-30 bg-stone-50/95 backdrop-blur-md py-6 border-b border-stone-200">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] font-black uppercase text-nutri-800 tracking-widest">SEU PERFIL ALIMENTAR</span>
          <span className="text-xs font-bold text-stone-500">{progress}% concluído</span>
        </div>
        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-full bg-nutri-800 transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {qfaSchema.map((section, sIdx) => (
        <div key={sIdx} className="space-y-6">
          <h3 className="text-sm font-black text-stone-900 uppercase tracking-[0.2em] flex items-center gap-3">
             <div className="w-1.5 h-4 bg-nutri-800 rounded-full"></div>
             {section.category}
          </h3>

          <div className="space-y-4">
            {section.items.map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
                <p className="text-stone-700 font-bold mb-4 text-sm md:text-base">{item.label}</p>
                <div className="flex items-center gap-1 bg-stone-50 p-1.5 rounded-2xl border border-stone-100">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSelect(item.id, opt)}
                      className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${
                        answers[item.id] === opt 
                        ? 'bg-nutri-800 text-white shadow-lg' 
                        : 'text-stone-400 hover:bg-white hover:text-stone-600'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={loading || progress < 100}
        className="w-full bg-nutri-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] shadow-xl shadow-nutri-900/20 hover:bg-nutri-800 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
      >
        {loading ? <Loader2 className="animate-spin" /> : "FINALIZAR E SALVAR"}
      </button>
    </div>
  );
}