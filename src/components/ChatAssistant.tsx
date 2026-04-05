'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, ImagePlus, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ===============================
// 1. TIPAGEM E INTERFACES APRIMORADAS
// ===============================
export interface PatientData {
  id: string;
  full_name: string;
  meal_plan?: any[] | null;
  meta_peso?: string | number | null;
  isNew?: boolean | null;
  isLate?: boolean | null;
  todayLog?: { water_ml: number; mood: string } | null;
  evaluation?: { answers: Record<string, string> } | null;
}

export interface LeadData {
  id: string;
  nome: string;
  whatsapp: string;
  status: string;
}

export interface BodyComposition {
  percentualGordura: number | null;
  massaGorda: number | null;
  massaMagra: number | null;
  ultimaAvaliacao: string | null;
  evolucaoGordura?: string;
  evolucaoMassaMagra?: string;
}

export interface AdminContext {
  patients?: PatientData[];
  leads?: LeadData[];
  usageStats?: Record<string, number>;
  todayTotalMessages?: number;
  onSendDirectMessage?: (patientId: string, message: string) => Promise<void>;
  bodyComposition?: BodyComposition | null;
}

// 🔥 BLINDAGEM MÁXIMA (TypeScript Discriminated Union)
export type ChatAssistantProps =
  | { role: 'admin'; adminContext: AdminContext }
  | { role: 'patient'; adminContext?: never };

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ===============================
// 2. CONSTANTES E UTILITÁRIOS
// ===============================
const AVATAR_IMAGES = {
  neutra: '/avatars/nutri-neutra.png',
  feliz: '/avatars/nutri-feliz.png',
  seria: '/avatars/nutri-seria.png'
};

const WHATSAPP_NUMBER = "5511999999999"; 

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedBase64.split(',')[1]);
      };
    };
    reader.readAsDataURL(file);
  });
};

const renderMessage = (text: string) => {
  const formatted = text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-stone-900">$1</strong>')
    .replace(/\n/g, '<br />');
  return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
};

// ===============================
// 3. HOOKS DE NEGÓCIO ISOLADOS
// ===============================

function useChatState() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [avatarMood, setAvatarMood] = useState<'neutra' | 'feliz' | 'seria'>('neutra');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setSelectedImage(compressed);
  };

  return {
    isOpen, setIsOpen,
    messages, setMessages,
    input, setInput,
    isLoading, setIsLoading,
    avatarMood, setAvatarMood,
    selectedImage, setSelectedImage,
    fileInputRef, scrollRef, handleImageSelect
  };
}

function useChatPatient(state: ReturnType<typeof useChatState>, isActive: boolean) {
  const checkTodayMood = async () => {
    if (!isActive) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) return;

      const todayStr = new Date().toLocaleDateString('en-CA');
      const { data: log } = await supabase
        .from('daily_logs')
        .select('mood')
        .eq('user_id', session.user.id)
        .eq('date', todayStr)
        .limit(1);

      const mood = log?.[0]?.mood;
      if (mood === 'feliz') state.setAvatarMood('feliz');
      else if (mood === 'dificil') state.setAvatarMood('seria');
      else state.setAvatarMood('neutra');
    } catch (error) {
      state.setAvatarMood('neutra'); 
    }
  };

  useEffect(() => {
    if (state.isOpen) checkTodayMood();
  }, [state.isOpen]);

  useEffect(() => { checkTodayMood(); }, []);

  const handleSend = async () => {
    if ((!state.input.trim() && !state.selectedImage) || state.isLoading) return;

    const userMessage = state.input.trim() || "Analise esse prato";
    const history = state.messages.slice(-6);
    
    state.setInput('');
    state.setIsLoading(true);
    state.setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const supabase = createClient();
      
      // 🔥 CORREÇÃO CRÍTICA APLICADA: Usando getSession para garantir extração no Client
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        state.setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sessão expirada. Faça login novamente.' }
        ]);
        throw new Error('Usuário não autenticado'); // Dispara erro forçado como instruído
      }

      const userId = session.user.id;

      // 🧪 DEBUG RÁPIDO (Olhe o console do navegador ao enviar mensagem como Paciente)
      console.log("🧪 DEBUG PAYLOAD PACIENTE:", {
        userId: userId,
        message: userMessage,
        history: history
      });
      
      // Enviando com o payload perfeitamente estruturado
      const res = await fetch('/api/nutri-assistant/patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId, // 🔥 ESSENCIAL GARANTIDO AQUI
          message: userMessage,
          history: history,
          image: state.selectedImage
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.reply || 'Ops, tive um probleminha técnico.');
      }
      
      if (data.reply) {
        state.setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (error: any) {
      console.error("ERRO NO ENVIO (PACIENTE):", error);
      state.setMessages(prev => [...prev, { role: 'assistant', content: error.message || 'Ops, tive um probleminha técnico. Pode repetir?' }]);
    } finally {
      state.setIsLoading(false);
      state.setSelectedImage(null); 
    }
  };

  return { handleSend };
}

function useChatAdmin(state: ReturnType<typeof useChatState>, adminContext: AdminContext | undefined, isActive: boolean) {
  useEffect(() => {
    if (isActive) state.setAvatarMood('feliz');
  }, [isActive]);

  const handleSend = async () => {
    if ((!state.input.trim() && !state.selectedImage) || state.isLoading) return;

    if (!adminContext) {
      console.error("adminContext ausente. Requisição abortada para evitar erro 400 do Zod.");
      state.setMessages(prev => [...prev, { role: 'assistant', content: 'Ops, não consegui carregar o contexto administrativo. Tente recarregar a página.' }]);
      return;
    }

    const userMessage = state.input.trim() || "Analise essa imagem";
    state.setInput('');
    state.setIsLoading(true);
    state.setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const supabase = createClient();
      
      // Por segurança, unifiquei para usar getSession no Admin também.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        state.setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sessão expirada. Faça login novamente.' }
        ]);
        return;
      }

      console.log("ADMIN PAYLOAD:", {
        userId,
        message: userMessage,
        history: state.messages.slice(-6),
        adminData: adminContext
      });

      const res = await fetch('/api/nutri-assistant/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message: userMessage,
          history: state.messages.slice(-6),
          image: state.selectedImage,
          adminData: adminContext 
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.reply || 'Ops, erro ao consultar os dados administrativos.');
      }
      
      if (data.reply) {
        state.setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (error: any) {
      state.setMessages(prev => [...prev, { role: 'assistant', content: error.message || 'Ops, erro ao consultar os dados administrativos.' }]);
    } finally {
      state.setIsLoading(false);
      state.setSelectedImage(null); 
    }
  };

  return { handleSend };
}

// ===============================
// 4. COMPONENTE PRINCIPAL (UI)
// ===============================

export default function ChatAssistant(props: ChatAssistantProps) {
  const { role, adminContext } = props;
  const isRoleAdmin = role === 'admin';
  
  const state = useChatState();
  const patientLogic = useChatPatient(state, !isRoleAdmin);
  const adminLogic = useChatAdmin(state, adminContext, isRoleAdmin);

  const handleSend = () => {
    if (role === 'admin') {
      return adminLogic.handleSend();
    }
    if (role === 'patient') {
      return patientLogic.handleSend();
    }
  };

  const getAvatarAnimation = () => {
    if (state.avatarMood === 'feliz') return 'animate-bounce'; 
    if (state.avatarMood === 'seria') return 'hover:animate-pulse'; 
    return 'animate-[pulse_3s_ease-in-out_infinite]'; 
  };

  const hasContent = state.input.trim().length > 0 || state.selectedImage !== null;

  return (
    <>
      {!state.isOpen && (
        <div className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50">
          <button 
            onClick={() => state.setIsOpen(true)} 
            className="relative group transition-all duration-300 hover:scale-110 active:scale-95 flex flex-col items-end"
            aria-label="Abrir assistente virtual"
          >
            <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full z-10 animate-pulse ring-4 ring-emerald-500/20"></span>
            
            <div className={`w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-full overflow-hidden border-[3px] border-stone-900 shadow-[0_12px_30px_rgba(0,0,0,0.2)] bg-gradient-to-b from-stone-50 to-stone-200 flex items-end justify-center ${getAvatarAnimation()}`}>
               <img 
                 src={AVATAR_IMAGES[state.avatarMood]} 
                 alt="Nutri Avatar" 
                 className="w-[90%] h-[90%] object-cover object-top drop-shadow-md" 
               />
            </div>
            
            <div className="absolute right-[85px] sm:right-[90px] top-1/2 -translate-y-1/2 bg-stone-900 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 whitespace-nowrap pointer-events-none">
              {isRoleAdmin 
                ? 'Pronta para te ajudar com os pacientes! 🚀' 
                : state.avatarMood === 'seria' 
                  ? 'Vamos focar hoje? 🧐' 
                  : state.avatarMood === 'feliz' 
                    ? 'Você tá arrasando! 🎉' 
                    : 'Dúvidas sobre a dieta? 🍎'}
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-stone-900 rotate-45 rounded-sm"></div>
            </div>
          </button>
        </div>
      )}

      {state.isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-8 sm:right-8 z-50 flex items-end sm:items-end justify-center pointer-events-none bg-stone-900/20 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none transition-all duration-300">
          
          <div className="w-full sm:w-[400px] h-[85vh] sm:h-[600px] max-h-[800px] bg-[#f8f9fa] rounded-t-[2rem] sm:rounded-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-stone-200/50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 pointer-events-auto">
            
            <div className="w-full flex justify-center pt-3 pb-2 sm:hidden bg-stone-900 shrink-0">
              <div className="w-12 h-1.5 bg-stone-700 rounded-full" />
            </div>

            <div className="bg-stone-900 px-5 pt-2 pb-5 sm:py-5 text-white flex justify-between items-center shrink-0 shadow-sm relative z-10">
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white/10 shrink-0 bg-gradient-to-b from-stone-700 to-stone-800 flex items-end justify-center shadow-inner ${getAvatarAnimation()}`}>
                  <img 
                    src={AVATAR_IMAGES[state.avatarMood]} 
                    alt="Avatar" 
                    className="w-[90%] h-[90%] object-cover object-top drop-shadow-md" 
                  />
                </div>
                <div className="flex flex-col">
                  <h4 className="font-bold text-[15px] leading-tight text-white tracking-tight">
                    Nutri <span className="text-emerald-400">Van</span>
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] text-stone-300 uppercase tracking-widest font-bold">
                      {isRoleAdmin 
                        ? 'Assistente IA da Nutri' 
                        : state.avatarMood === 'seria' 
                          ? 'De olho em você' 
                          : 'Online agora'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!isRoleAdmin && (
                  <a 
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=Oi%20Nutri!%20Estou%20com%20uma%20dúvida%20aqui%20no%20app.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
                    title="Falar com a Nutricionista"
                  >
                    <MessageCircle size={16} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">WhatsApp</span>
                  </a>
                )}
                <button 
                  onClick={() => state.setIsOpen(false)} 
                  className="p-2.5 bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white rounded-xl transition-all active:scale-95 shrink-0"
                  aria-label="Fechar chat"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            
            <div ref={state.scrollRef} className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-5 bg-[#f8f9fa] scrollbar-hide">
              
              {state.messages.length === 0 && (
                <div className="flex flex-col items-center text-center mt-8 space-y-4 px-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 flex items-end justify-center shadow-[0_8px_30px_rgba(0,0,0,0.08)] border-4 border-white ${getAvatarAnimation()}`}>
                    <img 
                      src={AVATAR_IMAGES[state.avatarMood]} 
                      alt="Nutri Grande" 
                      className="w-[90%] h-[90%] object-cover object-top drop-shadow-xl" 
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="font-black text-stone-800 text-lg tracking-tight">
                      {isRoleAdmin ? 'Olá, Vanusa!' : 'Olá!'}
                    </p>
                    <p className="text-stone-500 text-sm leading-relaxed font-medium">
                      {isRoleAdmin 
                        ? 'Estou conectada aos dados dos seus pacientes e leads ativos. Você pode me pedir resumos, relatórios de humor, ou checar quem ainda não tem dieta. Como posso te ajudar hoje?'
                        : 'Sou a Nutri Van, sua assistente virtual. Posso te ajudar com dúvidas sobre seu cardápio, analisar fotos de pratos ou te dar motivação.'}
                    </p>
                  </div>
                </div>
              )}
              
              {state.messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[85%] px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-stone-900 text-white rounded-2xl rounded-tr-sm font-medium' 
                      : 'bg-white border border-stone-200/60 text-stone-700 rounded-2xl rounded-tl-sm font-medium'
                  }`}>
                    {m.role === 'assistant' ? renderMessage(m.content) : m.content}
                  </div>
                </div>
              ))}
              
              {state.isLoading && (
                <div className="flex justify-start animate-in fade-in">
                  <div className="bg-white border border-stone-200/60 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2.5">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 bg-white border-t border-stone-100 shrink-0 relative z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
              
              {state.selectedImage && (
                <div className="relative mb-3 inline-block animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-1 bg-white border border-stone-200 rounded-xl shadow-sm">
                    <img 
                      src={`data:image/jpeg;base64,${state.selectedImage}`} 
                      className="h-16 w-16 rounded-lg object-cover" 
                      alt="Preview do anexo"
                    />
                  </div>
                  <button 
                    onClick={() => state.setSelectedImage(null)} 
                    className="absolute -top-2 -right-2 bg-stone-800 text-white rounded-full p-1 shadow-md hover:bg-rose-500 hover:scale-110 transition-all active:scale-95"
                    aria-label="Remover imagem"
                  >
                     <X size={14} strokeWidth={3} />
                  </button>
                </div>
              )}

              <div className="flex gap-2 bg-stone-50 p-1.5 rounded-[2rem] border border-stone-200 focus-within:border-stone-400 focus-within:ring-4 focus-within:ring-stone-500/10 focus-within:bg-white transition-all items-center">
                
                <button
                  onClick={() => state.fileInputRef.current?.click()}
                  className="p-2.5 text-stone-400 hover:text-stone-800 hover:bg-stone-200 rounded-full transition-all shrink-0 ml-1 active:scale-95"
                  disabled={state.isLoading}
                  title="Anexar foto"
                  aria-label="Anexar foto"
                >
                  <ImagePlus size={22} strokeWidth={2.5} />
                </button>
                
                <input
                  type="file"
                  accept="image/*"
                  ref={state.fileInputRef}
                  className="hidden"
                  onChange={state.handleImageSelect}
                />

                <input 
                  value={state.input}
                  onChange={(e) => state.setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isRoleAdmin ? "Pesquise por pacientes..." : "Digite sua dúvida..."}
                  className="flex-1 bg-transparent py-2.5 px-1 text-[15px] outline-none text-stone-800 w-full placeholder:text-stone-400 font-medium"
                  disabled={state.isLoading}
                />

                <button 
                  onClick={handleSend} 
                  disabled={state.isLoading || !hasContent} 
                  className={`p-3 rounded-full transition-all shrink-0 mr-0.5 ${
                    state.isLoading || !hasContent
                      ? 'bg-stone-200 text-stone-400' 
                      : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md hover:shadow-lg active:scale-95'
                  }`}
                  aria-label="Enviar mensagem"
                >
                  {state.isLoading ? (
                    <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
                  ) : (
                    <Send size={18} strokeWidth={2.5} className="ml-0.5" />
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}