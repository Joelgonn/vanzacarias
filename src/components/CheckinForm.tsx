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

interface CheckinPayload {
  user_id: string;
  peso: number;
  adesao_ao_plano: number;
  humor_semanal: number;
  comentarios: string;
  altura?: number;
}

const parseNumber = (value: string) => parseFloat(value.replace(',', '.'));

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
            .order('created_at', { ascending: false })
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
    const peso = parseNumber(formData.peso);
    const altura = parseNumber(formData.altura);

    if (!formData.peso || Number.isNaN(peso) || peso <= 0) {
      toast.warning("Por favor, informe um peso válido.");
      setLoading(false);
      return;
    }

    if (formData.adesao === 0 || formData.humor === 0) {
      toast.warning("Não esqueça de selecionar uma nota para Adesão e Humor!");
      setLoading(false);
      return;
    }

    if (needsHeight && (!formData.altura || Number.isNaN(altura) || altura <= 0)) {
      toast.warning("Como este é seu primeiro check-in com peso, precisamos da sua altura para calcular o IMC.");
      setLoading(false);
      return;
    }

    const toastId = toast.loading("Enviando seu check-in para a nutri...");

    try {
      const payload: CheckinPayload = { 
        user_id: session.user.id,
        peso, 
        adesao_ao_plano: formData.adesao, 
        humor_semanal: formData.humor, 
        comentarios: formData.comentarios.trim() 
      };

      if (needsHeight && formData.altura) {
        payload.altura = altura;
      }

      const { error } = await supabase.from('checkins').insert([payload]);

      if (error) throw error;

      toast.success("Check-in enviado com sucesso! Ótimo trabalho.", { id: toastId });
      setSuccess(true);
      
      // Aguarda a animação de sucesso antes de fechar/limpar
      setTimeout(() => {
        onSuccess();
      }, 1800);

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
      <div className="bg-white p-6 rounded-[2.5rem] flex flex-col justify-center items-center min-h-[400px] animate-fade-in">
        <Loader2 className="animate-spin text-nutri-800 mb-5" size={40} strokeWidth={2.5} />
        <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Preparando seu formulário...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] flex flex-col justify-center items-center min-h-[400px] animate-fade-in-up text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border border-emerald-100 shadow-sm">
          <CheckCircle2 size={40} className="text-emerald-500" strokeWidth={2.5} />
        </div>
        <h3 className="text-2xl font-black text-stone-900 tracking-tight mb-2">Check-in Recebido!</h3>
        <p className="text-stone-500 font-medium">Seus dados foram salvos na sua linha do tempo. Continue focado no processo!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[2.5rem] animate-fade-in-up relative overflow-hidden w-full mx-auto">
      
      {/* Detalhe de design no topo (Barra de status visual) */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-nutri-400 via-nutri-800 to-nutri-900"></div>

      {/* Barra de puxar mobile */}
      <div className="w-full flex justify-center pt-2 pb-4 md:hidden">
        <div className="w-12 h-1.5 bg-stone-200 rounded-full" />
      </div>

      {/* HEADER */}
      <div className="mb-8 md:mt-2">
        <h3 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight mb-1.5">Seu Relato</h3>
        <p className="text-stone-400 text-sm font-medium">Preencha com sinceridade para acompanharmos sua evolução real.</p>
      </div>
      
      {/* CAMPOS: PESO E ALTURA */}
      <div className={`grid grid-cols-1 ${needsHeight ? 'md:grid-cols-2 gap-5' : ''} mb-6`}>
        
        {/* PESO */}
        <div className="group">
          <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2.5 ml-1 group-focus-within:text-nutri-800 transition-colors">
            <Scale size={16} className="text-nutri-800" /> Peso Atual
          </label>
          <div className="relative">
            <input 
              type="number" 
              step="0.1" 
              min="0"
              max="500"
              placeholder="00.0"
              className="w-full p-4 border border-stone-200/80 rounded-2xl bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-600 outline-none transition-all text-2xl font-black text-center text-stone-900 placeholder:text-stone-300" 
              onChange={(e) => { onFormChange(); setFormData({...formData, peso: e.target.value}); }} 
              required 
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-300 text-xs font-bold uppercase tracking-widest pointer-events-none">kg</span>
          </div>
        </div>

        {/* ALTURA */}
        {needsHeight && (
          <div className="group">
            <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2.5 ml-1 group-focus-within:text-nutri-800 transition-colors">
              <Ruler size={16} className="text-nutri-800" /> Sua Altura
            </label>
            <div className="relative">
              <input 
                type="number" 
                step="0.01" 
                min="0"
                max="3"
                placeholder="1.70"
                className="w-full p-4 border border-stone-200/80 rounded-2xl bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-600 outline-none transition-all text-2xl font-black text-center text-stone-900 placeholder:text-stone-300" 
                onChange={(e) => { onFormChange(); setFormData({...formData, altura: e.target.value}); }} 
                required={needsHeight} 
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-300 text-xs font-bold uppercase tracking-widest pointer-events-none">m</span>
            </div>
          </div>
        )}

      </div>
      
      {/* CAMPO: ADESÃO AO PLANO */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-1">
          <Target size={16} className="text-nutri-800" /> Adesão à Dieta
        </label>
        <div className="bg-stone-50 p-1.5 rounded-2xl border border-stone-100 flex justify-between gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n} 
              type="button" 
              aria-pressed={formData.adesao === n}
              onClick={() => { onFormChange(); setFormData({...formData, adesao: n}); }} 
              className={`flex-1 py-3 md:py-3.5 rounded-xl font-black text-lg transition-all duration-300 active:scale-95 ${
                formData.adesao === n 
                ? 'bg-white text-nutri-900 shadow-sm border border-stone-200 scale-105 z-10' 
                : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100/50 border border-transparent'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-2 px-2">
          <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Difícil</span>
          <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Fácil</span>
        </div>
      </div>

      {/* CAMPO: HUMOR E DISPOSIÇÃO */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-1">
          <Smile size={16} className="text-nutri-800" /> Humor e Disposição
        </label>
        <div className="bg-stone-50 p-1.5 rounded-2xl border border-stone-100 flex justify-between gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n} 
              type="button"
              aria-pressed={formData.humor === n}
              onClick={() => { onFormChange(); setFormData({...formData, humor: n}); }} 
              className={`flex-1 py-3 md:py-3.5 rounded-xl font-black text-lg transition-all duration-300 active:scale-95 ${
                formData.humor === n 
                ? 'bg-white text-nutri-900 shadow-sm border border-stone-200 scale-105 z-10' 
                : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100/50 border border-transparent'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-2 px-2">
          <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Péssimo</span>
          <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">Ótimo</span>
        </div>
      </div>

      {/* CAMPO: COMENTÁRIOS / RELATO LIVRE */}
      <div className="mb-8 group">
        <label className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-nutri-800 transition-colors">
          <MessageSquare size={16} className="text-nutri-800" /> Relato da Semana (Opcional)
        </label>
        <textarea 
          className="w-full p-4 border border-stone-200/80 rounded-2xl bg-stone-50 focus:bg-white focus:border-nutri-600 focus:ring-4 focus:ring-nutri-800/10 outline-none transition-all resize-none h-28 text-sm font-medium text-stone-800 placeholder:text-stone-400 leading-relaxed" 
          placeholder="Como foi sua semana? Conseguiu treinar? Sentiu fome?" 
          onChange={(e) => { onFormChange(); setFormData({...formData, comentarios: e.target.value}); }} 
        />
      </div>
      
      {/* BOTÃO DE SUBMIT */}
      <button 
        type="submit" 
        disabled={loading} 
        className="w-full bg-nutri-900 text-white py-4 md:py-5 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 hover:bg-nutri-800 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-nutri-900/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed hover:-translate-y-0.5"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            <span>Processando...</span>
          </>
        ) : (
          <>
            <Send size={20} /> 
            <span>Enviar Relato</span>
          </>
        )}
      </button>

    </form>
  );
}