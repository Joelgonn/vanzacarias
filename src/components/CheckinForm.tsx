'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function CheckinForm({ onSuccess, onFormChange }: { onSuccess: () => void, onFormChange: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ peso: '', altura: '', adesao: 0, humor: 0, comentarios: '' });
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

    // 2. Inclua o user_id no insert
    const { error } = await supabase.from('checkins').insert([
      { 
        user_id: session.user.id, // <--- ISSO ESTAVA FALTANDO!
        peso: parseFloat(formData.peso), 
        altura: parseFloat(formData.altura),
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
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
      <h3 className="text-xl font-bold mb-6 text-stone-900">Check-in Semanal</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Peso (kg)</label>
          <input type="number" step="0.1" className="w-full p-4 border rounded-xl" onChange={(e) => { onFormChange(); setFormData({...formData, peso: e.target.value}); }} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Altura (m)</label>
          <input type="number" step="0.01" className="w-full p-4 border rounded-xl" onChange={(e) => { onFormChange(); setFormData({...formData, altura: e.target.value}); }} required />
        </div>
      </div>
      
      {/* ADESÃO COM TOOLTIPS */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-stone-700 mb-3">Adesão ao plano (1-5):</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" title={adesaoLabels[n-1]} onClick={() => { onFormChange(); setFormData({...formData, adesao: n}); }} className={`flex-1 p-3 rounded-lg font-bold ${formData.adesao === n ? 'bg-nutri-900 text-white' : 'bg-stone-100'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* HUMOR COM TOOLTIPS */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-stone-700 mb-3">Como está seu humor? (1-5):</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" title={humorLabels[n-1]} onClick={() => { onFormChange(); setFormData({...formData, humor: n}); }} className={`flex-1 p-3 rounded-lg font-bold ${formData.humor === n ? 'bg-nutri-900 text-white' : 'bg-stone-100'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <textarea className="w-full p-4 border rounded-xl mb-6" placeholder="Algum comentário para a Vanusa?" onChange={(e) => { onFormChange(); setFormData({...formData, comentarios: e.target.value}); }} />
      
      <button type="submit" disabled={loading} className="w-full bg-nutri-900 text-white py-4 rounded-xl font-bold">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Enviar Check-in'}
      </button>
    </form>
  );
}