'use client';

import { useState } from 'react';
import { Crown, Check, Sparkles, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PremiumAccessCardProps {
  isPremium: boolean;
  dailyLimit: number; // 25 or 80
  onPremiumViewed?: () => void;
}

export default function PremiumAccessCard({ isPremium, dailyLimit }: PremiumAccessCardProps) {
  const [loading, setLoading] = useState(false);

  const handleActivatePremium = async () => {
    setLoading(true);
    try {
      // Métrica: cta clicked (sem conteúdo clínico)
      try { console.log('[COMMERCE] premium_cta_clicked'); } catch {}
      
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType: 'premium', name: 'Paciente' }),
      });
      const data = await res.json();
      if (data.init_point) {
        try { console.log('[COMMERCE] checkout_started'); } catch {}
        window.location.href = data.init_point;
      } else {
        toast.error(data.error || 'Não foi possível iniciar o checkout.');
      }
    } catch {
      toast.error('Erro ao conectar ao checkout.');
    } finally {
      setLoading(false);
    }
  };

  if (isPremium) {
    return (
      <section
        className="relative overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(16,185,129,0.15)]"
        aria-labelledby="premium-access-title"
      >
        <div className="relative z-10 p-5 sm:p-7 md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <Crown size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="premium-access-title" className="text-2xl font-black tracking-tight text-stone-900 leading-tight">
                Seu acesso Premium
              </h2>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mt-0.5">Ativo • {dailyLimit} mensagens/dia</p>
            </div>
          </div>
          <ul className="mt-6 grid gap-2 text-sm font-medium text-stone-700 sm:grid-cols-2">
            <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Contexto ampliado</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Memória e RAG ampliados</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Plano alimentar autorizado</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Macros detalhados</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Ações personalizadas</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500" /> Maior limite de uso</li>
          </ul>
          <p className="mt-4 text-xs font-semibold text-stone-500">Mais contexto para orientar sua jornada.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-[2.5rem] border border-stone-100 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_16px_48px_-24px_rgba(28,25,23,0.18)]"
      aria-labelledby="premium-access-title-free"
    >
      <div className="relative z-10 p-5 sm:p-7 md:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-sm">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="premium-access-title-free" className="text-2xl font-black tracking-tight text-stone-900 leading-tight">Seu acesso</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mt-0.5">Plano atual: Gratuito • {dailyLimit} mensagens/dia</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500 mb-3">Inclui hoje</p>
            <ul className="space-y-2 text-sm font-medium text-stone-600">
              <li className="flex items-center gap-2"><Sparkles size={16} className="text-stone-400" /> Orientação básica</li>
              <li className="flex items-center gap-2"><Sparkles size={16} className="text-stone-400" /> Chatbot com streaming</li>
              <li className="flex items-center gap-2"><Sparkles size={16} className="text-stone-400" /> Foco diário</li>
              <li className="flex items-center gap-2"><Sparkles size={16} className="text-stone-400" /> Recuperação</li>
            </ul>
          </div>
          <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50/60 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-700 mb-2 flex items-center gap-2"><Crown size={14} /> Premium acrescenta</p>
            <ul className="space-y-1.5 text-sm font-medium text-stone-700">
              <li>• Contexto ampliado</li>
              <li>• Memória e RAG ampliados (5 vs 2)</li>
              <li>• Plano e macros autorizados</li>
              <li>• Ações personalizadas</li>
              <li>• 80 mensagens/dia</li>
            </ul>
            <p className="mt-3 text-xs font-semibold text-stone-500">Com Premium, você pode receber orientações usando seu plano alimentar, macros e contexto ampliado.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleActivatePremium}
          disabled={loading}
          aria-label="Ativar Premium"
          className="mt-6 inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-stone-900 px-6 py-3 text-sm font-black text-white transition-all hover:bg-stone-800 hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
          {loading ? 'Redirecionando...' : 'Ativar Premium'}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <p className="mt-3 text-[11px] font-medium text-stone-400">Pagamento seguro via Mercado Pago. Upgrade validado server-side via webhook.</p>
      </div>
    </section>
  );
}
