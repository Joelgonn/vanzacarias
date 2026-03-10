'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Send, Scale, Smile, Target, MessageSquare } from 'lucide-react';

export default function CheckinForm({ onSuccess, onFormChange }: { onSuccess: () => void, onFormChange: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ peso: '', adesao: 0, humor: 0, comentarios: '' });
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Pegue a sessão atual para obter o user_id
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        alert("Você precisa estar logado!");
        setLoading(false);
        return;
    }

    // 2. Validação simples para garantir que ele clicou nas notas
    if (formData.adesao === 0 || formData.humor === 0) {
        alert("Por favor, selecione uma nota para Adesão e Humor.");
        setLoading(false);
        return;
    }

    // 3. Inclua o user_id no insert
    const { error } = await supabase.from('checkins').insert([
      { 
        user_id: session.user.id,
        peso: parseFloat(formData.peso), 
        adesao_ao_plano: formData.adesao, 
        humor_semanal: formData.humor, 
        comentarios: formData.comentarios 
      }
    ]);

    if (!error) {
      onSuccess();
    } else {
      console.error("Erro Supabase:", error);
      alert(`Erro ao enviar: ${error.message}`);
    }
    setLoading(false);
  };

  // Tooltips para os botões
  const adesaoLabels = ["Muito difícil", "Difícil", "Neutro", "Fácil", "Muito fácil"];
  const humorLabels = ["Muito mal", "Mal", "Neutro", "Bem", "Muito bem"];

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-stone-100 animate-fade-in-up">
      <div className="mb-8 text-center">
        <h3 className="text-2xl font-bold text-stone-900 tracking-tight">Check-in Semanal</h3>
        <p className="text-stone-500 mt-2 text-sm">Atualize a Vanusa sobre a sua evolução nesta semana.</p>
      </div>
      
      {/* CAMPO: PESO */}
      <div className="mb-8">
        <label className="flex items-center gap-2 text-sm font-bold text-stone-700 uppercase tracking-wider mb-3">
          <Scale size={16} className="text-nutri-800" /> Peso Atual (kg)
        </label>
        <input 
          type="number" 
          step="0.1" 
          placeholder="Ex: 72.5"
          className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50 focus:bg-white focus:ring-2 focus:ring-nutri-800 outline-none transition-all text-lg font-medium text-center" 
          onChange={(e) => { onFormChange(); setFormData({...formData, peso: e.target.value}); }} 
          required 
        />
      </div>
      
      {/* CAMPO: ADESÃO AO PLANO */}
      <div className="mb-8">
        <label className="flex items-center gap-2 text-sm font-bold text-stone-700 uppercase tracking-wider mb-4">
          <Target size={16} className="text-nutri-800" /> Adesão ao plano (1 a 5)
        </label>
        <div className="flex gap-2 sm:gap-4">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n} 
              type="button" 
              title={adesaoLabels[n-1]} 
              onClick={() => { onFormChange(); setFormData({...formData, adesao: n}); }} 
              className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 ${
                formData.adesao === n 
                ? 'bg-nutri-900 text-white shadow-md ring-2 ring-nutri-900 ring-offset-2' 
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-2 px-1">
          <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Muito Difícil</span>
          <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Muito Fácil</span>
        </div>
      </div>

      {/* CAMPO: HUMOR */}
      <div className="mb-8">
        <label className="flex items-center gap-2 text-sm font-bold text-stone-700 uppercase tracking-wider mb-4">
          <Smile size={16} className="text-nutri-800" /> Disposição e Humor (1 a 5)
        </label>
        <div className="flex gap-2 sm:gap-4">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n} 
              type="button" 
              title={humorLabels[n-1]} 
              onClick={() => { onFormChange(); setFormData({...formData, humor: n}); }} 
              className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 ${
                formData.humor === n 
                ? 'bg-nutri-900 text-white shadow-md ring-2 ring-nutri-900 ring-offset-2' 
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-2 px-1">
          <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Péssimo</span>
          <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Excelente</span>
        </div>
      </div>

      {/* CAMPO: COMENTÁRIOS */}
      <div className="mb-8">
        <label className="flex items-center gap-2 text-sm font-bold text-stone-700 uppercase tracking-wider mb-3">
          <MessageSquare size={16} className="text-nutri-800" /> Relato da Semana
        </label>
        <textarea 
          className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50 focus:bg-white focus:ring-2 focus:ring-nutri-800 outline-none transition-all resize-none h-32" 
          placeholder="Como foi sua semana? Teve alguma dificuldade? Como está o intestino e o sono? Anote aqui para a Vanusa..." 
          onChange={(e) => { onFormChange(); setFormData({...formData, comentarios: e.target.value}); }} 
        />
      </div>
      
      <button 
        type="submit" 
        disabled={loading} 
        className="w-full bg-nutri-900 text-white py-4 md:py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-nutri-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
      >
        {loading ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Enviar Check-in</>}
      </button>
    </form>
  );
}