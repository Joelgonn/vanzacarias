'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Sparkles } from 'lucide-react';

export default function CompletarPerfil() {
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = Form, 2 = Boas-vindas
  const supabase = createClient();
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    const { error } = await supabase
      .from('profiles')
      .update({ phone, data_nascimento: birthDate })
      .eq('id', session?.user.id);

    if (error) {
      console.error("Erro no update:", error);
      alert("Erro ao salvar dados. Tente novamente.");
    } else {
      setStep(2); // Muda para a tela de parabéns
    }
    setLoading(false);
  };

  if (step === 2) return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-center">
      <div className="max-w-md bg-white p-10 rounded-3xl shadow-xl">
        <Sparkles size={48} className="text-nutri-800 mx-auto mb-6" />
        <h2 className="text-3xl font-bold text-stone-900 mb-4">Perfil concluído!</h2>
        <p className="text-stone-600 mb-8 leading-relaxed">
          Estamos muito felizes em ter você aqui. Esta parceria será incrível e vamos transformar sua rotina juntos!
        </p>
        <button onClick={() => router.push('/dashboard')} className="w-full bg-nutri-900 text-white py-3.5 rounded-xl font-bold">
          Ir para o Dashboard
        </button>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-12 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
        <h2 className="text-2xl font-bold mb-2">Completar Perfil</h2>
        <p className="text-stone-500 mb-6 text-sm">Precisamos de alguns dados para personalizar seu plano, e para te contactar.</p>
        <form onSubmit={handleUpdate} className="space-y-4">
          <input type="tel" placeholder="WhatsApp (DDD+Número)" required onChange={e => setPhone(e.target.value)} className="w-full p-3 border rounded-xl" />
          <input type="date" required onChange={e => setBirthDate(e.target.value)} className="w-full p-3 border rounded-xl" />
          <button className="w-full bg-nutri-900 text-white py-3 rounded-xl font-bold flex items-center justify-center">
            {loading ? <Loader2 className="animate-spin" /> : 'Salvar e Acessar'}
          </button>
        </form>
      </div>
    </main>
  );
}