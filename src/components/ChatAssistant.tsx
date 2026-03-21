'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [avatarMood, setAvatarMood] = useState<'neutra' | 'feliz' | 'seria'>('neutra');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const avatarImages = {
    neutra: '/avatars/nutri-neutra.png',
    feliz: '/avatars/nutri-feliz.png',
    seria: '/avatars/nutri-seria.png'
  };
  
  const numeroWhatsApp = "5511999999999"; 

  const checkTodayMood = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const todayStr = new Date().toLocaleDateString('en-CA');
      const { data: log } = await supabase
        .from('daily_logs')
        .select('mood')
        .eq('user_id', session.user.id)
        .eq('date', todayStr)
        .single();

      if (log?.mood === 'feliz') {
        setAvatarMood('feliz');
      } else if (log?.mood === 'dificil') {
        setAvatarMood('seria');
      } else {
        setAvatarMood('neutra');
      }
    } catch (error) {
      console.error("Erro ao buscar humor:", error);
      setAvatarMood('neutra'); 
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      checkTodayMood();
    }
  }, [isOpen]);

  useEffect(() => {
    checkTodayMood();
  }, []);

  const renderMessage = (text: string) => {
    const formatted = text
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-stone-900">$1</strong>')
      .replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    const updatedMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/nutri-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user?.id,
          message: userMessage,
          history: messages.slice(-6)
        })
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Ops, tive um probleminha técnico. Pode repetir?' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getAvatarAnimation = () => {
    if (avatarMood === 'feliz') return 'animate-bounce'; 
    if (avatarMood === 'seria') return 'hover:animate-pulse'; 
    return 'animate-[pulse_3s_ease-in-out_infinite]'; 
  };

  return (
    <>
      {/* BOTÃO FLUTUANTE (Fechado) */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
          <button 
            onClick={() => setIsOpen(true)} 
            className="relative group transition-all hover:scale-110 active:scale-95 flex flex-col items-end"
          >
            <span className="absolute top-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full z-10 animate-pulse"></span>
            
            <div className={`w-16 h-16 rounded-full overflow-hidden border-2 border-stone-800 shadow-2xl bg-nutri-100 flex items-end justify-center ${getAvatarAnimation()}`}>
               <img 
                 src={avatarImages[avatarMood]} 
                 alt="Nutri Avatar" 
                 className="w-[90%] h-[90%] object-cover object-top drop-shadow-md" 
               />
            </div>
            
            <div className="absolute right-20 top-1/2 -translate-y-1/2 bg-white text-stone-900 px-4 py-2 rounded-xl text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-stone-100 pointer-events-none">
              {avatarMood === 'seria' ? 'Vamos focar hoje? 🧐' : avatarMood === 'feliz' ? 'Você tá arrasando! 🎉' : 'Dúvidas sobre a dieta? 🍎'}
            </div>
          </button>
        </div>
      )}

      {/* JANELA DO CHAT (Aberta) */}
      {isOpen && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex justify-center sm:block pointer-events-none">
          <div className="w-full max-w-[400px] sm:w-[380px] h-[75vh] max-h-[550px] bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-stone-100 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 origin-bottom sm:origin-bottom-right pointer-events-auto">
            
            {/* Header com a nova identidade "Nutri Van" */}
            <div className="bg-stone-900 p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-white/20 shrink-0 bg-nutri-800 flex items-end justify-center ${getAvatarAnimation()}`}>
                  <img 
                    src={avatarImages[avatarMood]} 
                    alt="Avatar" 
                    className="w-[90%] h-[90%] object-cover object-top drop-shadow-md" 
                  />
                </div>
                <div className="flex flex-col">
                  <h4 className="font-bold text-sm leading-tight text-white">
                    Nutri <span className="text-green-400">Van</span>
                  </h4>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    <span className="text-[9px] text-stone-300 uppercase tracking-widest font-bold">
                      {avatarMood === 'seria' ? 'De olho em você' : 'Assistente Virtual'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <a 
                  href={`https://wa.me/${numeroWhatsApp}?text=Oi%20Nutri!%20Estou%20com%20uma%20dúvida%20aqui%20no%20app.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-full transition-colors group"
                  title="Falar com a Nutricionista"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">WhatsApp</span>
                </a>

                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            {/* Chat Body */}
            <div ref={scrollRef} className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-stone-50">
              {messages.length === 0 && (
                <div className="flex flex-col items-center text-center mt-6 space-y-4 px-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-nutri-100 flex items-end justify-center shadow-inner border border-stone-200 ${getAvatarAnimation()}`}>
                    <img 
                      src={avatarImages[avatarMood]} 
                      alt="Nutri Grande" 
                      className="w-[90%] h-[90%] object-cover object-top drop-shadow-xl" 
                    />
                  </div>
                  <div>
                    <p className="font-bold text-stone-800 text-sm">Olá!</p>
                    <p className="text-stone-500 text-xs mt-1 leading-relaxed">
                      Sou a <strong className="text-green-600">Nutri Van</strong>, sua assistente virtual. Posso te ajudar com dúvidas rápidas sobre seu cardápio, trocas ou motivação. Como posso ajudar hoje?
                    </p>
                  </div>
                </div>
              )}
              
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-stone-800 text-white rounded-tr-none shadow-md' 
                      : 'bg-white border border-stone-200 text-stone-700 rounded-tl-none shadow-sm'
                  }`}>
                    {m.role === 'assistant' ? renderMessage(m.content) : m.content}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-stone-200 p-4 rounded-3xl rounded-tl-none flex items-center gap-2 shadow-sm">
                    <Loader2 className="animate-spin text-stone-800" size={16}/>
                    <span className="text-xs text-stone-400 font-medium">Analisando...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 sm:p-4 bg-white border-t border-stone-100 shrink-0">
              <div className="flex gap-2 bg-stone-100 p-1 rounded-[1.5rem] border border-stone-200 focus-within:border-stone-400 transition-all shadow-inner">
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ex: O que substitui o frango?"
                  className="flex-1 bg-transparent px-4 py-3 text-sm outline-none text-stone-700 w-full"
                  disabled={isLoading}
                />
                <button 
                  onClick={handleSend} 
                  disabled={isLoading || !input.trim()} 
                  className={`p-3 rounded-2xl transition-all shadow-lg shrink-0 ${
                    isLoading || !input.trim() 
                      ? 'bg-stone-300 text-stone-500' 
                      : 'bg-stone-900 text-white hover:bg-stone-800'
                  }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}