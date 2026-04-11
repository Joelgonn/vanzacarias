'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { 
  Loader2, Sparkles, Phone, 
  ChevronRight, ChevronLeft, CheckCircle2, Shield, 
  Target, Heart, Gift, Zap, ArrowRight, ChevronDown, X, Plus
} from 'lucide-react';
import { type FoodRestriction, type FoodTag } from '@/types/patient';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';

// =========================================================================
// CUSTOM SELECT PREMIUM (COMPONENTE REUTILIZÁVEL)
// =========================================================================
interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function CustomSelect({ options, value, onChange, placeholder = 'Selecionar', className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.custom-select-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative custom-select-container ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-4 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 transition-all text-stone-700"
      >
        <span className={!selectedOption ? 'text-stone-400' : 'text-stone-700'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={18} className={`text-stone-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 mt-2 w-full bg-white border border-stone-100 rounded-2xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-stone-50 transition-colors ${
                  value === opt.value ? 'bg-nutri-50 text-nutri-800 font-medium' : 'text-stone-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =========================================================================
// FOOD RESTRICTIONS FORM (VERSÃO ORIGINAL - FUNCIONA)
// =========================================================================
const TAG_OPTIONS: Array<{ label: string; value: FoodTag }> = [
  { label: 'Lactose', value: 'lactose' },
  { label: 'Glúten', value: 'gluten' },
  { label: 'Açúcar', value: 'sugar' },
  { label: 'Oleaginosas', value: 'nuts' }
];

function FoodRestrictionsForm({ value, onChange }: { value: FoodRestriction[]; onChange: (value: FoodRestriction[]) => void }) {
  const [type, setType] = useState<FoodRestriction['type']>('allergy');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [selectedTag, setSelectedTag] = useState<FoodTag | ''>('');

  const handleAdd = () => {
    if (!selectedFoodId && !selectedTag) return;

    const exists = value.some(r => 
      r.type === type && 
      r.foodId === (selectedFoodId || undefined) && 
      r.tag === (selectedTag || undefined)
    );

    if (exists) {
      setSelectedFoodId('');
      setSelectedTag('');
      return;
    }

    const newRestriction: FoodRestriction = {
      type,
      foodId: selectedFoodId || undefined,
      tag: selectedTag || undefined,
      food: selectedFoodId
        ? FOOD_REGISTRY.find(f => f.id === selectedFoodId)?.name || ''
        : ''
    };

    onChange([...value, newRestriction]);
    setSelectedFoodId('');
    setSelectedTag('');
  };

  const handleRemove = (index: number) => {
    const updated = [...value];
    updated.splice(index, 1);
    onChange(updated);
  };

  const getTagLabel = (tagValue: string) => {
    return TAG_OPTIONS.find(t => t.value === tagValue)?.label || tagValue;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-sm text-stone-800">Restrições Alimentares</h3>
        <p className="text-xs text-stone-500">Adicione alergias, intolerâncias ou restrições</p>
      </div>

      <select
        value={type}
        onChange={(e) => setType(e.target.value as FoodRestriction['type'])}
        className="w-full border border-stone-200 rounded-2xl px-4 py-4 bg-stone-50/50 text-sm focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all"
      >
        <option value="allergy">🚫 Alergia</option>
        <option value="intolerance">⚠️ Intolerância</option>
        <option value="restriction">📋 Restrição</option>
      </select>

      <select
        value={selectedFoodId}
        onChange={(e) => {
          setSelectedFoodId(e.target.value);
          setSelectedTag('');
        }}
        className="w-full border border-stone-200 rounded-2xl px-4 py-4 bg-stone-50/50 text-sm focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all"
      >
        <option value="">Selecionar alimento</option>
        {FOOD_REGISTRY.map(food => (
          <option key={food.id} value={food.id}>{food.name}</option>
        ))}
      </select>

      <select
        value={selectedTag}
        onChange={(e) => {
          setSelectedTag(e.target.value as FoodTag | '');
          setSelectedFoodId('');
        }}
        className="w-full border border-stone-200 rounded-2xl px-4 py-4 bg-stone-50/50 text-sm focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all"
      >
        <option value="">Ou selecionar categoria</option>
        {TAG_OPTIONS.map(tag => (
          <option key={tag.value} value={tag.value}>{tag.label}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-3 rounded-2xl font-bold text-sm hover:shadow-lg transition-all active:scale-[0.98]"
      >
        <Plus size={16} /> Adicionar restrição
      </button>

      <div className="space-y-2">
        {value.map((r, index) => (
          <div key={`${r.type}-${r.foodId || 'food'}-${r.tag || 'tag'}`} className="flex items-center justify-between bg-stone-50 px-4 py-3 rounded-xl text-sm border border-stone-100">
            <span>
              {r.type === 'allergy' && '🚫 '}
              {r.type === 'intolerance' && '⚠️ '}
              {r.type === 'restriction' && '📋 '}
              {r.food || (r.tag ? getTagLabel(r.tag) : r.foodId)}
            </span>
            <button type="button" onClick={() => handleRemove(index)} className="text-red-500 hover:text-red-700 transition-colors">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// PROGRESS TRACKER PREMIUM
// =========================================================================
function ProgressTracker({ step, totalSteps }: { step: number; totalSteps: number }) {
  const progress = (step / totalSteps) * 100;
  
  return (
    <div className="mb-8">
      <div className="relative">
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-nutri-800 via-nutri-700 to-nutri-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <motion.div 
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-nutri-800 rounded-full shadow-md"
          initial={{ left: 0 }}
          animate={{ left: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="flex justify-between mt-3">
        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Etapa {step} de {totalSteps}</p>
        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
          {step === 1 && 'Boas-vindas'}{step === 2 && 'Dados básicos'}{step === 3 && 'Restrições'}{step === 4 && 'Confirmação'}
        </p>
      </div>
    </div>
  );
}

// =========================================================================
// STEP 1 - BOAS-VINDAS
// =========================================================================
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="text-center space-y-6">
      <motion.div className="w-20 h-20 bg-nutri-50 rounded-full flex items-center justify-center mx-auto shadow-inner" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 200 }}>
        <Sparkles className="text-nutri-800" size={36} strokeWidth={1.5} />
      </motion.div>
      <div>
        <motion.p className="text-xs uppercase tracking-widest text-nutri-600 font-bold mb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>Jornada Personalizada</motion.p>
        <motion.h1 className="text-3xl md:text-4xl font-black text-stone-900 mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>Vamos cuidar de você</motion.h1>
        <motion.p className="text-stone-500 text-sm md:text-base leading-relaxed max-w-xs mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Em poucos passos, vamos montar um plano alimentar totalmente adaptado ao seu estilo de vida.</motion.p>
      </div>
      <motion.div className="pt-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <button onClick={onNext} className="w-full bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.98] transition-all group">Começar agora <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></button>
      </motion.div>
      <div className="flex justify-center gap-6 pt-4 text-xs text-stone-400">
        <span className="flex items-center gap-1"><Shield size={12} /> Seguro</span>
        <span className="flex items-center gap-1"><Target size={12} /> Personalizado</span>
        <span className="flex items-center gap-1"><Heart size={12} /> Gratuito</span>
      </div>
    </motion.div>
  );
}

// =========================================================================
// STEP 2 - DADOS BÁSICOS COM DATE SELECTOR PREMIUM
// =========================================================================
function StepBasic({ phone, setPhone, birthDate, setBirthDate, onNext, onBack }: { phone: string; setPhone: (v: string) => void; birthDate: string; setBirthDate: (v: string) => void; onNext: () => void; onBack: () => void }) {
  
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    if (birthDate && birthDate.includes('-')) {
      const [y, m, d] = birthDate.split('-');
      if (y) setYear(y);
      if (m) setMonth(m);
      if (d) setDay(d);
    }
  }, [birthDate]);

  useEffect(() => {
    if (year && month && day) {
      const formattedDate = `${year}-${month}-${day}`;
      if (formattedDate !== birthDate) {
        setBirthDate(formattedDate);
      }
    }
  }, [day, month, year, birthDate, setBirthDate]);

  const isValid = phone.trim() !== '' && year && month && day;

  const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: String(i + 1) }));
  const monthOptions = [
    { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
  ];
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div><h2 className="text-xl md:text-2xl font-black text-stone-900 mb-2">Seus dados</h2><p className="text-stone-500 text-sm">Vamos precisar dessas informações para personalizar seu plano.</p></div>
      <div className="bg-nutri-50/40 p-4 rounded-2xl border border-nutri-100"><p className="text-xs text-nutri-700 font-medium mb-1">🔒 Por que pedimos isso?</p><p className="text-xs text-stone-500 leading-relaxed">Usamos sua idade e contato para adaptar seu plano com precisão e segurança.</p></div>
      <div className="space-y-4">
        <div className="relative group"><Phone className="absolute left-4 top-4 text-stone-400 group-focus-within:text-nutri-800 transition-colors" size={20} strokeWidth={1.5} /><input type="tel" placeholder="WhatsApp (DDD + Número)" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-12 pr-4 py-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none transition-all text-stone-700 placeholder:text-stone-400" /></div>
        <div><label className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2 block ml-1">Data de nascimento</label><div className="grid grid-cols-3 gap-2"><CustomSelect options={dayOptions} value={day} onChange={setDay} placeholder="Dia" /><CustomSelect options={monthOptions} value={month} onChange={setMonth} placeholder="Mês" /><CustomSelect options={yearOptions} value={year} onChange={setYear} placeholder="Ano" /></div><p className="text-[10px] text-stone-400 mt-2 ml-1">Usamos para calcular sua faixa etária e necessidades nutricionais</p></div>
      </div>
      <div className="flex gap-3 pt-4"><button onClick={onBack} className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 active:scale-[0.98] transition-all"><ChevronLeft size={18} /> Voltar</button><button onClick={onNext} disabled={!isValid} className="flex-1 bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98] transition-all">Continuar <ChevronRight size={18} /></button></div>
    </motion.div>
  );
}

// =========================================================================
// STEP 3 - RESTRIÇÕES ALIMENTARES
// =========================================================================
function StepRestrictions({ foodRestrictions, setFoodRestrictions, onNext, onBack }: { foodRestrictions: FoodRestriction[]; setFoodRestrictions: (v: FoodRestriction[]) => void; onNext: () => void; onBack: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div><h2 className="text-xl md:text-2xl font-black text-stone-900 mb-2">Preferências e restrições</h2><p className="text-stone-500 text-sm">Isso nos ajuda a adaptar seu plano com segurança e inteligência.</p></div>
      <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100"><p className="text-xs text-amber-700 font-medium mb-1">🧠 Por que isso importa?</p><p className="text-xs text-stone-500 leading-relaxed">Respeitamos suas escolhas e restrições alimentares para garantir um plano seguro, prazeroso e eficaz.</p></div>
      <FoodRestrictionsForm value={foodRestrictions} onChange={setFoodRestrictions} />
      <div className="flex gap-3 pt-4"><button onClick={onBack} className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 active:scale-[0.98] transition-all"><ChevronLeft size={18} /> Voltar</button><button onClick={onNext} className="flex-1 bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.98] transition-all">Continuar <ChevronRight size={18} /></button></div>
    </motion.div>
  );
}

// =========================================================================
// STEP 4 - CONFIRMAÇÃO (SEM OBJECTIVE)
// =========================================================================
function StepConfirm({ phone, birthDate, foodRestrictions, onConfirm, onBack, loading }: { phone: string; birthDate: string; foodRestrictions: FoodRestriction[]; onConfirm: () => void; onBack: () => void; loading: boolean }) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Não informado';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="text-center"><motion.div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}><CheckCircle2 className="text-emerald-600" size={28} /></motion.div><h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-2">Revise seus dados</h2><p className="text-stone-500 text-sm">Confirme se as informações estão corretas antes de salvar.</p></div>
      <div className="bg-stone-50 rounded-2xl p-4 space-y-3 border border-stone-100"><div className="flex justify-between text-sm"><span className="text-stone-500">WhatsApp</span><span className="font-medium text-stone-800">{phone || '—'}</span></div><div className="flex justify-between text-sm"><span className="text-stone-500">Data de nascimento</span><span className="font-medium text-stone-800">{formatDate(birthDate)}</span></div><div className="flex justify-between text-sm"><span className="text-stone-500">Restrições</span><span className="font-medium text-stone-800">{foodRestrictions.length > 0 ? `${foodRestrictions.length} selecionadas` : 'Nenhuma'}</span></div></div>
      <div className="bg-nutri-50 p-4 rounded-xl text-sm text-nutri-800 text-center space-y-2"><p>✔ Perfil personalizado</p><p>✔ Preferências salvas</p><p>✔ Base para seu plano alimentar</p></div>
      <div className="text-xs text-stone-400 text-center">📋 Seus dados serão salvos para personalizar sua experiência</div>
      <div className="flex gap-3 pt-4"><button onClick={onBack} className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 active:scale-[0.98] transition-all"><ChevronLeft size={18} /> Voltar</button><button onClick={onConfirm} disabled={loading} className="flex-1 bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98] transition-all group">{loading ? <Loader2 className="animate-spin" size={18} /> : <>Salvar e continuar <CheckCircle2 size={16} className="group-hover:scale-110 transition-transform" /></>}</button></div>
    </motion.div>
  );
}

// =========================================================================
// STEP 5 - SUCESSO
// =========================================================================
function StepSuccess({ onDashboard }: { onDashboard: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, type: "spring" }} className="text-center space-y-6">
      <motion.div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto" animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 0.6, delay: 0.2 }}><Gift size={36} className="text-emerald-600" strokeWidth={1.5} /></motion.div>
      <div><h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-3">Perfil salvo! 🎉</h2><p className="text-stone-500 text-sm md:text-base leading-relaxed max-w-xs mx-auto">Estamos muito felizes em ter você aqui. Esta parceria será incrível!</p></div>
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-800 text-center space-y-1"><p className="font-bold">✅ Seu perfil foi salvo com sucesso</p><p className="text-xs opacity-75">Agora vamos preparar seu plano alimentar personalizado</p></div>
      <motion.button onClick={onDashboard} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full bg-gradient-to-r from-nutri-900 to-nutri-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all">Ir para o Dashboard <ChevronRight size={18} /></motion.button>
      <p className="text-[10px] text-stone-400">🔒 Seus dados estão seguros e serão usados apenas para seu plano</p>
    </motion.div>
  );
}

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function CompletarPerfil() {
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [foodRestrictions, setFoodRestrictions] = useState<FoodRestriction[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [step, setStep] = useState(1);
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('phone, data_nascimento, food_restrictions').eq('id', session.user.id).single();
        if (data) {
          if (data.phone) setPhone(data.phone);
          if (data.data_nascimento) setBirthDate(data.data_nascimento);
          if (data.food_restrictions) setFoodRestrictions(data.food_restrictions);
        }
      }
      setFetching(false);
    }
    fetchProfile();
  }, [supabase]);

  const handleSubmit = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('profiles').update({ phone, data_nascimento: birthDate, food_restrictions: foodRestrictions }).eq('id', session?.user.id);
    if (error) { 
      console.error("Erro no update:", error.message); 
      alert(`Erro ao salvar dados: ${error.message || 'Tente novamente.'}`); 
      setLoading(false); 
    } else { 
      setStep(5); 
      setLoading(false); 
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));
  const goToDashboard = () => router.push('/dashboard');

  if (fetching) return <main className="min-h-screen bg-gradient-to-br from-stone-50 to-white flex items-center justify-center"><Loader2 className="animate-spin text-nutri-800" size={48} /></main>;
  if (step === 5) return <main className="min-h-screen bg-gradient-to-br from-stone-50 to-white pt-24 pb-12 px-4"><div className="w-full max-w-md mx-auto"><StepSuccess onDashboard={goToDashboard} /></div></main>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-50 to-white pt-24 pb-12 px-4">
      <div className="w-full max-w-lg mx-auto bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-6 md:p-8 relative overflow-hidden">
        <ProgressTracker step={step} totalSteps={4} />
        <AnimatePresence mode="wait">
          {step === 1 && <StepWelcome key="step1" onNext={nextStep} />}
          {step === 2 && <StepBasic key="step2" phone={phone} setPhone={setPhone} birthDate={birthDate} setBirthDate={setBirthDate} onNext={nextStep} onBack={prevStep} />}
          {step === 3 && <StepRestrictions key="step3" foodRestrictions={foodRestrictions} setFoodRestrictions={setFoodRestrictions} onNext={nextStep} onBack={prevStep} />}
          {step === 4 && <StepConfirm key="step4" phone={phone} birthDate={birthDate} foodRestrictions={foodRestrictions} onConfirm={handleSubmit} onBack={prevStep} loading={loading} />}
        </AnimatePresence>
      </div>
    </main>
  );
}