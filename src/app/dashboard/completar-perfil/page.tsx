'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Sparkles, Phone, Calendar as CalendarIcon } from 'lucide-react';
import FoodRestrictionsForm from '@/components/FoodRestrictionsForm';
import { FoodRestriction } from '@/types/patient';

export default function CompletarPerfil() {
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [foodRestrictions, setFoodRestrictions] = useState<FoodRestriction[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [step, setStep] = useState(1); // 1 = Form, 2 = Boas-vindas
  
  const supabase = createClient();
  const router = useRouter();

  // Busca os dados do paciente caso ele já tenha preenchido algo antes
  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('phone, data_nascimento, food_restrictions')
          .eq('id', session.user.id)
          .single();

        if (data) {
          if (data.phone) setPhone(data.phone);
          if (data.data_nascimento) setBirthDate(data.data_nascimento);
          if (data.food_restrictions) setFoodRestrictions(data.food_restrictions);
        }
      }
      setFetching(false);
    }
    fetchProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        phone, 
        data_nascimento: birthDate,
        food_restrictions: foodRestrictions // Salvando as restrições
      })
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
    <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-stone-100 relative overflow-hidden group">
        
        {/* Fundo decorativo sutil */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 -z-10"></div>
        
        <div className="w-20 h-20 bg-nutri-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border-4 border-white animate-bounce" style={{ animationDuration: '2s' }}>
          <Sparkles size={36} className="text-nutri-800" strokeWidth={1.5} />
        </div>
        
        <h2 className="text-2xl md:text-3xl font-bold text-stone-900 mb-4 tracking-tight animate-fade-in-up">
          Perfil concluído!
        </h2>
        
        <p className="text-stone-500 text-sm md:text-base mb-10 leading-relaxed font-light px-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Estamos muito felizes em ter você aqui. Esta parceria será incrível e vamos transformar sua rotina juntos!
        </p>
        
        <button 
          onClick={() => router.push('/dashboard')} 
          className="w-full bg-nutri-900 text-white py-4 md:py-3.5 rounded-2xl md:rounded-xl font-bold hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-md hover:shadow-lg animate-fade-in-up"
          style={{ animationDelay: '0.2s' }}
        >
          Ir para o Dashboard
        </button>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-stone-50 p-6 md:p-12 flex flex-col items-center justify-center pt-24 md:pt-12">
      <div className="max-w-xl w-full bg-white p-8 md:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 animate-fade-in-up">
        
        {fetching ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-nutri-800" size={32} />
          </div>
        ) : (
          <>
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight text-stone-900">
                Completar Perfil
              </h2>
              <p className="text-stone-500 text-sm md:text-base leading-relaxed font-light">
                Precisamos de alguns dados para personalizar seu plano e garantirmos sua segurança alimentar.
              </p>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              
              <div className="relative group">
                <Phone className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} strokeWidth={1.5} />
                <input 
                  type="tel" 
                  placeholder="WhatsApp (DDD + Número)" 
                  required 
                  value={phone}
                  onChange={e => setPhone(e.target.value)} 
                  className="w-full pl-12 pr-4 py-4 md:py-3.5 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700 placeholder:text-stone-400" 
                />
              </div>

              <div className="relative group flex flex-col">
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1 ml-1">Data de Nascimento</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} strokeWidth={1.5} />
                  <input 
                    type="date" 
                    required 
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)} 
                    className="w-full pl-12 pr-4 py-4 md:py-3.5 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700" 
                  />
                </div>
              </div>

              {/* Formulário de Restrições */}
              <div className="pt-2">
                <FoodRestrictionsForm 
                  value={foodRestrictions}
                  onChange={setFoodRestrictions}
                />
              </div>

              <div className="pt-4 border-t border-stone-100">
                <button 
                  className="w-full bg-nutri-900 text-white py-4 md:py-3.5 rounded-2xl md:rounded-xl font-bold flex items-center justify-center hover:bg-nutri-800 active:scale-[0.98] transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    'Salvar e Acessar'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}