'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, Send, Scale, Smile, Target, MessageSquare, Ruler, CheckCircle2 
} from 'lucide-react';
import { toast } from 'sonner';

// =========================================================================
// INTERFACES E TIPAGENS
// =========================================================================
interface CheckinFormData {
  peso: string;
  altura: string;
  adesao: number;
  humor: number;
  comentarios: string;
}

interface CheckinFormProps {
  onSuccess: () => void;
  onFormChange: () => void;
}

export default function CheckinForm({ onSuccess, onFormChange }: CheckinFormProps) {
  // =========================================================================
  // ESTADOS
  // =========================================================================
  const [loading, setLoading] = useState(false);
  const [checkingHeight, setCheckingHeight] = useState(true);
  const [needsHeight, setNeedsHeight] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<CheckinFormData>({ 
    peso: '', 
    altura: '', 
    adesao: 0, 
    humor: 0, 
    comentarios: '' 
  });
  
  const supabase = createClient();

  // =========================================================================
  // EFEITOS (Verifica se é o primeiro check-in para pedir altura)
  // =========================================================================
  useEffect(() => {
    async function verifyHeightRequirement() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data, error } = await supabase
            .from('checkins')
            .select('altura')
            .eq('user_id', session.user.id)
            .not('altura', 'is', null)
            .limit(1);
          
          if (error) throw error;

          if (!data || data.length === 0) {
            setNeedsHeight(true);
          }
        }
      } catch (error) {
        console.error("Erro ao verificar necessidade de altura:", error);
      } finally {
        setCheckingHeight(false);
      }
    }
    
    verifyHeightRequirement();
  }, [supabase]);

  // =========================================================================
  // HANDLERS
  // =========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast.error("Sessão expirada. Você precisa estar logado para enviar!");
      setLoading(false);
      return;
    }

    // Validações Manuais Amigáveis
    if (!formData.peso || parseFloat(formData.peso) <= 0) {
      toast.warning("Por favor, informe um peso válido.");
      setLoading(false);
      return;
    }

    if (formData.adesao === 0 || formData.humor === 0) {
      toast.warning("Não esqueça de selecionar uma nota para Adesão e Humor!");
      setLoading(false);
      return;
    }

    if (needsHeight && (!formData.altura || parseFloat(formData.altura) <= 0)) {
      toast.warning("Como este é seu primeiro check-in com peso, precisamos da sua altura para calcular o IMC.");
      setLoading(false);
      return;
    }

    const toastId = toast.loading("Enviando seu check-in para a nutri...");

    try {
      const payload: any = { 
        user_id: session.user.id,
        peso: parseFloat(formData.peso.replace(',', '.')), 
        adesao_ao_plano: formData.adesao, 
        humor_semanal: formData.humor, 
        comentarios: formData.comentarios.trim() 
      };

      if (needsHeight && formData.altura) {
        payload.altura = parseFloat(formData.altura.replace(',', '.'));
      }

      const { error } = await supabase.from('checkins').insert([payload]);

      if (error) throw error;

      toast.success("Check-in enviado com sucesso! Ótimo trabalho.", { id: toastId });
      setSuccess(true);
      
      // Aguarda a animação de sucesso antes de fechar/limpar
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error: any) {
      console.error("Erro Supabase:", error);
      toast.error(error.message || "Erro ao enviar check-in. Tente novamente.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  if (checkingHeight) {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-stone-200/40 border border-stone-100 flex flex-col justify-center items-center min-h-[500px] animate-fade-in">
        <Loader2 className="animate-spin text-nutri-800 mb-4" size={40} strokeWidth={2.5} />
        <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Preparando seu formulário...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-stone-200/40 border border-stone-100 flex flex-col justify-center items-center min-h-[500px] animate-fade-in-up text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-100 shadow-inner">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h3 className="text-2xl font-extrabold text-stone-900 tracking-tight mb-2">Check-in Recebido!</h3>
        <p className="text-stone-500 font-medium">A Vanusa já recebeu seus dados. Continue focado no processo, você está indo muito bem!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-2xl shadow-stone-200/50 border border-stone-100 animate-fade-in-up relative overflow-hidden">
      
      {/* Detalhe de design no topo */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-nutri-400 via-nutri-800 to-nutri-900"></div>

      {/* HEADER */}
      <div className="mb-8 text-center mt-2">
        <div className="w-12 h-1.5 bg-stone-100 rounded-full mx-auto mb-4 md:hidden"></div>
        <h3 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight mb-1">Check-in Semanal</h3>
        <p className="text-stone-400 text-xs md:text-sm font-medium">Preencha seus dados para acompanharmos sua evolução.</p>
      </div>
      
      {/* CAMPOS: PESO E ALTURA */}
      <div className={`grid grid-cols-1 ${needsHeight ? 'md:grid-cols-2 gap-5' : ''} mb-8`}>
        
        {/* PESO */}
        <div className="group">
          <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-nutri-800 transition-colors">
            <Scale size={16} className="text-nutri-800" /> Peso Atual
          </label>
          <div className="relative">
            <input 
              type="number" 
              step="0.1" 
              placeholder="00.0"
              className="w-full p-4 md:p-5 border border-stone-200 rounded-2xl bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-2xl font-black text-center text-nutri-900 placeholder:text-stone-300 shadow-inner focus:shadow-sm" 
              onChange={(e) => { onFormChange(); setFormData({...formData, peso: e.target.value}); }} 
              required 
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-bold uppercase tracking-widest pointer-events-none">kg</span>
          </div>
        </div>

        {/* ALTURA */}
        {needsHeight && (
          <div className="group">
            <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-nutri-800 transition-colors">
              <Ruler size={16} className="text-nutri-800" /> Sua Altura
            </label>
            <div className="relative">
              <input 
                type="number" 
                step="0.01" 
                placeholder="1.70"
                className="w-full p-4 md:p-5 border border-stone-200 rounded-2xl bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-2xl font-black text-center text-nutri-900 placeholder:text-stone-300 shadow-inner focus:shadow-sm" 
                onChange={(e) => { onFormChange(); setFormData({...formData, altura: e.target.value}); }} 
                required={needsHeight} 
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-bold uppercase tracking-widest pointer-events-none">m</span>
            </div>
          </div>
        )}

      </div>
      
      {/* CAMPO: ADESÃO AO PLANO */}
      <div className="mb-8 bg-stone-50/50 p-5 rounded-3xl border border-stone-100">
        <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-4 ml-1">
          <Target size={16} className="text-nutri-800" /> Adesão à Dieta na Semana
        </label>
        <div className="flex justify-between gap-2 md:gap-3">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n} 
              type="button" 
              aria-pressed={formData.adesao === n}
              onClick={() => { onFormChange(); setFormData({...formData, adesao: n}); }} 
              className={`flex-1 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-lg md:text-xl transition-all duration-300 active:scale-90 ${
                formData.adesao === n 
                ? 'bg-nutri-900 text-white shadow-lg shadow-nutri-900/30 scale-[1.05] border border-nutri-800 z-10' 
                : 'bg-white text-stone-400 border border-stone-200 hover:border-nutri-300 hover:text-nutri-600 shadow-sm'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-3 px-2">
          <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Muito Difícil</span>
          <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Muito Fácil</span>
        </div>
      </div>

      {/* CAMPO: HUMOR E DISPOSIÇÃO */}
      <div className="mb-8 bg-stone-50/50 p-5 rounded-3xl border border-stone-100">
        <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-4 ml-1">
          <Smile size={16} className="text-nutri-800" /> Humor e Disposição Física
        </label>
        <div className="flex justify-between gap-2 md:gap-3">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n} 
              type="button"
              aria-pressed={formData.humor === n}
              onClick={() => { onFormChange(); setFormData({...formData, humor: n}); }} 
              className={`flex-1 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-lg md:text-xl transition-all duration-300 active:scale-90 ${
                formData.humor === n 
                ? 'bg-nutri-900 text-white shadow-lg shadow-nutri-900/30 scale-[1.05] border border-nutri-800 z-10' 
                : 'bg-white text-stone-400 border border-stone-200 hover:border-nutri-300 hover:text-nutri-600 shadow-sm'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-3 px-2">
          <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Péssimo</span>
          <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Excelente</span>
        </div>
      </div>

      {/* CAMPO: COMENTÁRIOS / RELATO LIVRE */}
      <div className="mb-8 group">
        <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-nutri-800 transition-colors">
          <MessageSquare size={16} className="text-nutri-800" /> Relato da Semana (Opcional)
        </label>
        <textarea 
          className="w-full p-5 border border-stone-200 rounded-3xl bg-stone-50 focus:bg-white focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none transition-all resize-none h-28 md:h-32 text-sm font-medium text-stone-700 placeholder:text-stone-300 shadow-inner focus:shadow-sm leading-relaxed" 
          placeholder="Conte para a nutri como foi sua semana. Quais foram as maiores vitórias ou dificuldades?" 
          onChange={(e) => { onFormChange(); setFormData({...formData, comentarios: e.target.value}); }} 
        />
      </div>
      
      {/* BOTÃO DE SUBMIT */}
      <button 
        type="submit" 
        disabled={loading} 
        className="w-full bg-nutri-900 text-white py-4 md:py-5 rounded-2xl font-extrabold text-sm md:text-base flex items-center justify-center gap-3 hover:bg-nutri-800 active:scale-[0.98] transition-all duration-300 shadow-xl shadow-nutri-900/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            <span>Processando...</span>
          </>
        ) : (
          <>
            <Send size={20} /> 
            <span>Enviar Check-in para Avaliação</span>
          </>
        )}
      </button>

    </form>
  );
}