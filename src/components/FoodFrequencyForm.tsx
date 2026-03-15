'use client';

import { useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';

// 1. O JEITO PROFISSIONAL: Estruturamos os dados em JSON (Schema)
const qfaData = [
  {
    category: "Leites e Derivados",
    items: [
      { id: "leite", label: "Leite (copo de requeijão)" },
      { id: "iogurte", label: "Iogurte natural (copo de requeijão)" },
      { id: "queijo", label: "Queijos (1/2 fatia)" },
      { id: "requeijao", label: "Requeijão / Creme de ricota (1,5 colher sopa)" }
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
    category: "Frutas, Verduras e Legumes",
    items: [
      { id: "fruta", label: "Fruta in natura (1 unidade/fatia)" },
      { id: "folhosos", label: "Folhosos (10 folhas)" },
      { id: "tuberculos", label: "Tubérculos (batatas/cenoura/beterraba) (2 col. sopa)" },
      { id: "legumes", label: "Legumes (abóbora/chuchu/tomate) (2 col. sopa)" }
    ]
  },
  // Você pode adicionar as outras categorias aqui depois copiando o padrão!
];

const frequencyOptions = ["0", "1-3", "4-6", "7-9", "10+"];

export default function FoodFrequencyForm() {
  // Estado que guarda TODAS as respostas em um único objeto dinâmico
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Função para marcar a opção
  const handleSelect = (itemId: string, option: string) => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: option
    }));
  };

  // Função de salvar no banco de dados
  const handleSave = async () => {
    setIsSaving(true);
    
    console.log("JSON pronto para ir pro Supabase:", answers);
    // Aqui no futuro faremos: supabase.from('qfa_answers').insert({ user_id: ID, respostas: answers })
    
    setTimeout(() => {
      alert("Avaliação salva com sucesso!");
      setIsSaving(false);
    }, 1000);
  };

  // Calcula quantas perguntas já foram respondidas
  const totalQuestions = qfaData.reduce((acc, cat) => acc + cat.items.length, 0);
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-stone-100">
      
      {/* CABEÇALHO E PROGRESSO */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Frequência Alimentar</h2>
        <p className="text-stone-500 text-sm mb-6">
          Marque a quantidade de porções que você consome <b>semanalmente</b>, em média, de cada alimento.
        </p>
        
        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] font-bold uppercase text-stone-400 mb-2">
              <span>Progresso</span>
              <span className="text-nutri-800">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-nutri-800 transition-all duration-500 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          {progress === 100 && <CheckCircle2 className="text-green-500" size={24} />}
        </div>
      </div>

      {/* RENDERIZAÇÃO DINÂMICA DAS PERGUNTAS */}
      <div className="space-y-10">
        {qfaData.map((category, catIndex) => (
          <div key={catIndex} className="animate-fade-in-up" style={{ animationDelay: `${catIndex * 100}ms` }}>
            <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="bg-stone-100 w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-stone-500">{catIndex + 1}</span>
              {category.category}
            </h3>
            
            <div className="space-y-4">
              {category.items.map((item) => (
                <div key={item.id} className="bg-stone-50 p-4 md:p-5 rounded-2xl border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-stone-700 w-full md:w-1/2">
                    {item.label}
                  </span>
                  
                  <div className="flex items-center gap-1 w-full md:w-auto bg-white p-1 rounded-xl border border-stone-200">
                    {frequencyOptions.map((opt) => {
                      const isSelected = answers[item.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => handleSelect(item.id, opt)}
                          className={`flex-1 md:flex-none md:w-12 py-2 text-xs font-bold rounded-lg transition-all ${
                            isSelected 
                              ? 'bg-nutri-800 text-white shadow-md' 
                              : 'text-stone-500 hover:bg-stone-50'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* BOTÃO SALVAR */}
      <div className="mt-10 pt-8 border-t border-stone-100">
        <button 
          onClick={handleSave}
          disabled={isSaving || progress < 100}
          className="w-full flex items-center justify-center gap-2 bg-nutri-900 text-white py-4 rounded-2xl font-bold hover:bg-nutri-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-nutri-900/20"
        >
          {isSaving ? "Salvando..." : <><Save size={20} /> Finalizar e Salvar</>}
        </button>
      </div>

    </div>
  );
}