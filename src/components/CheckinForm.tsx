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
    <form onSubmit={handleSubmit} className="bg-white p-5 md:p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-stone-100 animate-fade-in-up">
      
      {/* HEADER COMPACTO NO MOBILE */}
      <div className="mb-6 md:mb-10 text-center">
        <div className="w-12 h-1 bg-stone-100 rounded-full mx-auto mb-4 md:hidden"></div>
        <h3 className="text-xl md:text-3xl font-bold text-stone-900 tracking-tight">Check-in Semanal</h3>
        <p className="text-stone-500 mt-1 text-xs md:text-base font-light italic">Envie sua evolução para a Vanusa</p>
      </div>
      
      {/* CAMPO: PESO (MOVIDO PARA O TOPO E COMPACTADO) */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-2 ml-1">
          <Scale size={14} className="text-nutri-800" /> Peso Atual (kg)
        </label>
        <div className="relative group">
          <input 
            type="number" 
            step="0.1" 
            placeholder="00.0"
            className="w-full p-3 md:p-6 border border-stone-200 rounded-2xl bg-stone-50/50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-xl font-black text-center text-nutri-900 placeholder:text-stone-200" 
            onChange={(e) => { onFormChange(); setFormData({...formData, peso: e.target.value}); }} 
            required 
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-300 text-sm font-bold">kg</span>
        </div>
      </div>
      
      {/* CAMPO: ADESÃO AO PLANO (BOTÕES MENORES NO MOBILE) */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-3 ml-1">
          <Target size={14} className="text-nutri-800" /> Adesão ao plano
        </label>
        <div className="flex justify-between gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n} 
              type="button" 
              onClick={() => { onFormChange(); setFormData({...formData, adesao: n}); }} 
              className={`flex-1 py-3 md:py-5 rounded-xl md:rounded-2xl font-black text-base md:text-xl transition-all active:scale-[0.92] ${
                formData.adesao === n 
                ? 'bg-nutri-900 text-white shadow-lg scale-[1.05] z-10' 
                : 'bg-stone-50 text-stone-400 border border-stone-50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-2 px-1">
          <span className="text-[9px] text-stone-300 font-bold uppercase tracking-widest">Difícil</span>
          <span className="text-[9px] text-stone-300 font-bold uppercase tracking-widest">Fácil</span>
        </div>
      </div>

      {/* CAMPO: HUMOR (BOTÕES MENORES NO MOBILE) */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-3 ml-1">
          <Smile size={14} className="text-nutri-800" /> Humor e Disposição
        </label>
        <div className="flex justify-between gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n} 
              type="button" 
              onClick={() => { onFormChange(); setFormData({...formData, humor: n}); }} 
              className={`flex-1 py-3 md:py-5 rounded-xl md:rounded-2xl font-black text-base md:text-xl transition-all active:scale-[0.92] ${
                formData.humor === n 
                ? 'bg-nutri-900 text-white shadow-lg scale-[1.05] z-10' 
                : 'bg-stone-50 text-stone-400 border border-stone-50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-2 px-1">
          <span className="text-[9px] text-stone-300 font-bold uppercase tracking-widest">Baixo</span>
          <span className="text-[9px] text-stone-300 font-bold uppercase tracking-widest">Excelente</span>
        </div>
      </div>

      {/* CAMPO: COMENTÁRIOS (ALTURA REDUZIDA NO MOBILE) */}
      <div className="mb-8">
        <label className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-3 ml-1">
          <MessageSquare size={14} className="text-nutri-800" /> Relato da Semana
        </label>
        <textarea 
          className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50/50 focus:bg-white focus:border-nutri-800 outline-none transition-all resize-none h-24 md:h-40 text-sm font-light" 
          placeholder="Conte para a Vanusa..." 
          onChange={(e) => { onFormChange(); setFormData({...formData, comentarios: e.target.value}); }} 
        />
      </div>
      
      <button 
        type="submit" 
        disabled={loading} 
        className="w-full bg-nutri-900 text-white py-4 md:py-5 rounded-2xl font-bold text-base flex items-center justify-center gap-3 hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-xl shadow-nutri-900/10 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <>
            <Send size={18} /> 
            <span>Enviar Check-in</span>
          </>
        )}
      </button>
    </form>
  );
}