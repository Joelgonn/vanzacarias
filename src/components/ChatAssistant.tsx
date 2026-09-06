'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Send, Loader2, ImagePlus, MessageCircle, Mic, Square, Camera, FileText } from 'lucide-react';
import NextImage from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useVoiceInput, formatElapsedMs } from '@/lib/voice/useVoiceInput';
import { isVoiceDebugEnabled, voiceDebugLog } from '@/lib/voice/debug';
import { autoGrowHeight } from './composerAutoGrow';

// ===============================
// 1. TIPAGEM E INTERFACES APRIMORADAS
// ===============================

// Formato mínimo de um item do meal_plan (JSON salvo no Supabase, coluna
// meal_plan da tabela profiles).
export interface MealPlanRow {
  name: string;
  time?: string;
  options?: Array<{
    name?: string;
    description?: string;
    kcal?: number;
    macros?: { p: number; c: number; g: number };
  }>;
}

export interface PatientData {
  id: string;
  full_name: string;
  meal_plan?: MealPlanRow[] | null;
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

// 🔥 BLINDAGEM MÁXIMA (TypeScript Discriminated Union) — VZ-017: canAccessMealPlan para quick actions premium
export type ChatAssistantProps =
  | { role: 'admin'; adminContext: AdminContext }
  | { role: 'patient'; adminContext?: never; canAccessMealPlan?: boolean };

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
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

// 🔥 NOVO: Sanitização de input para evitar injection básico
const sanitizeInput = (text: string): string => {
  return text.replace(/</g, '').replace(/>/g, '');
};

const MAX_MESSAGE_LENGTH = 500;

// COMPOSER-001 — crescimento vertical controlado do Composer: o textarea cresce
// com o texto (linhas reais via scrollHeight) até este limite; além dele passa
// a usar scroll interno e o Composer pára de crescer (mesmo acorde do
// max-h-[200px] aplicado no <textarea>).
const COMPOSER_MAX_HEIGHT = 200;

// CHAT-UX-006 — Composer em dois modos com UM ÚNICO <textarea> e UM ÚNICO
// conjunto de controles (sem duplicação de DOM, sem display:none no textarea):
// a mesma grade (grid) troca apenas o template de áreas:
//   idle     → uma linha:  attach | mic | input (placeholder flex) | send
//   editando → textarea em linha cheia no topo; ações na linha inferior.
// Colunas constantes: auto auto minmax(0,1fr) auto (input é a coluna elástica).
const COMPOSER_IDLE_AREAS = { gridTemplateAreas: '"attach mic input send"' };
const COMPOSER_EDIT_AREAS = { gridTemplateAreas: '"input input input input" "attach mic . send"' };
// Colunas: attach | mic | input (elástica) | send
const COMPOSER_GRID_COLUMNS = { gridTemplateColumns: 'auto auto minmax(0, 1fr) auto' };

// CHAT-UX-007 — waveform responsivo (sem largura fixa): barras flexíveis
// (flex-1, máx. 3px) ocupam o espaço central disponível e encolhem em telas
// estreitas sem overflow; a sequência de alturas/delays apenas repete o padrão
// visual anterior em mais barras, dobrando a largura ocupada quando há espaço.
const WAVEFORM_BAR_HEIGHTS = [
  'h-2', 'h-3', 'h-4', 'h-3', 'h-2', 'h-4', 'h-3', 'h-2', 'h-4',
  'h-3', 'h-2', 'h-4', 'h-3', 'h-2', 'h-3', 'h-4', 'h-3', 'h-2',
  'h-4', 'h-3', 'h-2',
];

// VZ-013 FASE D: ações rápidas — apenas enviam uma pergunta normal ao
// chatbot (mesmo handleSend/submit). Não criam resposta hardcoded, não
// duplicam regras clínicas e não expõem conteúdo Premium no botão.
// VZ-017: diferenciação Free (3) vs Premium (5) — premium contextualizadas
const QUICK_ACTIONS_FREE = [
  'Como está minha evolução?',
  'Como posso melhorar minha alimentação?',
  'Registrar uma refeição'
];

const QUICK_ACTIONS_PREMIUM = [
  'Como está minha evolução?',
  'O que devo priorizar hoje?',
  'Analisar uma refeição',
];

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
  const lines = text.split('\n');

  return (
    <div>
      {lines.map((line, lineIndex) => {
        const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);

        return (
          <span key={`line-${lineIndex}`}>
            {parts.map((part, partIndex) => {
              const isBold = part.startsWith('**') && part.endsWith('**') && part.length > 4;
              return isBold ? (
                <strong key={`part-${lineIndex}-${partIndex}`} className="font-bold text-stone-900">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <span key={`part-${lineIndex}-${partIndex}`}>{part}</span>
              );
            })}
            {lineIndex < lines.length - 1 && <br />}
          </span>
        );
      })}
    </div>
  );
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
  const [retryCandidate, setRetryCandidate] = useState<{ question: string; image: string | null } | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');

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
    handleImageSelect,
    retryCandidate, setRetryCandidate,
    streamingText, setStreamingText
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
    } catch {
      state.setAvatarMood('neutra'); 
    }
  };

  useEffect(() => {
    if (state.isOpen) checkTodayMood();
  }, [state.isOpen]);

  useEffect(() => { checkTodayMood(); }, []);

  const handleSend = async () => {
    if ((!state.input.trim() && !state.selectedImage) || state.isLoading) return;

    const rawMessage = state.input.trim();
    const finalMessage = rawMessage.length > 0
      ? rawMessage
      : state.selectedImage
        ? "Analise este prato da imagem"
        : "";

    if (!finalMessage) return;

    await runExchange(finalMessage, state.selectedImage, true);
  };

  // VZ-013 FASE D: ações rápidas enviam uma pergunta normal ao chatbot pelo
  // mesmo fluxo do envio manual (runExchange). Não há resposta hardcoded.
  const ask = async (text: string) => {
    if (!text?.trim() || state.isLoading) return;
    state.setInput('');
    await runExchange(text, null, true);
  };

  // VZ-013 FASE G: repete a pergunta original sem duplicar a mensagem do
  // usuário (que já está exibida). Remove apenas o balão de erro.
  const retry = async () => {
    const candidate = state.retryCandidate;
    if (!candidate || state.isLoading) return;
    state.setMessages(prev => {
      const next = [...prev];
      while (next.length && next[next.length - 1].isError) next.pop();
      return next;
    });
    state.setRetryCandidate(null);
    await runExchange(candidate.question, candidate.image, false);
  };

  async function runExchange(question: string, image: string | null, appendUser: boolean) {
    // 🔥 PATCH 2: Sanitizar input
    const sanitizedMessage = sanitizeInput(question);

    if (sanitizedMessage.length > MAX_MESSAGE_LENGTH) {
      state.setMessages(prev => [...prev, { role: 'assistant', content: 'Mensagem muito longa. Envie em partes menores, por favor.' }]);
      return;
    }

    // 🔥 PATCH 3: History limpa (sem HTML). Balões de erro (isError) nunca
    // entram no histórico enviado ao Gemini (consistência do histórico).
    const cleanHistory = state.messages
      .filter(m => !m.isError)
      .slice(-6)
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    if (appendUser) {
      state.setInput('');
      state.setMessages(prev => [...prev, { role: 'user', content: sanitizedMessage }]);
    }
    state.setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        state.setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sessão expirada. Faça login novamente.' }
        ]);
        throw new Error('Usuário não autenticado');
      }

      const userId = session.user.id;

      // 🔥 PATCH 4: Debug melhorado
      if (process.env.NODE_ENV === 'development') {
        console.log("CHAT PAYLOAD (PACIENTE):", {
          role: 'patient',
          userId,
          messageLength: sanitizedMessage.length,
          historyLength: cleanHistory.length,
          hasImage: !!image
        });
      }

      state.setStreamingText('');

      const res = await fetch('/api/nutri-assistant/patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message: sanitizedMessage,
          history: cleanHistory,
          image: image
        })
      });

      const isStream = res.headers
        .get('content-type')
        ?.toLowerCase()
        .includes('application/x-ndjson');

      // Caminho streaming (VZ-013-S): consome NDJSON via ReadableStream.
      if (isStream) {
        if (!res.body) throw new Error('Ops, tive um probleminha técnico.');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            let frame: { t?: string; d?: string; reply?: string } = {};
            try { frame = JSON.parse(line); } catch { continue; }

            if (frame.t === 'chunk' && typeof frame.d === 'string') {
              state.setStreamingText(prev => prev + frame.d!);
            } else if (frame.t === 'done') {
              receivedDone = true;
              const finalReply = typeof frame.reply === 'string' && frame.reply.length > 0
                ? frame.reply
                : 'Pode repetir?';
              state.setStreamingText('');
              state.setMessages(prev => [...prev, { role: 'assistant', content: finalReply }]);
              state.setRetryCandidate(null);
              break;
            } else if (frame.t === 'error') {
              receivedDone = true;
              throw new Error(frame.reply || 'Ops, tive um probleminha técnico.');
            }
          }
          if (receivedDone) break;
        }

        if (!receivedDone) {
          throw new Error('Ops, tive um probleminha técnico.');
        }
      } else {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.reply || 'Ops, tive um probleminha técnico.');
        }

        if (data.reply) {
          state.setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        }
      }
    } catch (error) {
      console.error("ERRO NO ENVIO (PACIENTE):", error);
      state.setStreamingText('');
      const errorMessage = (error as { message?: string }).message || 'Ops, tive um probleminha técnico. Pode repetir?';
      state.setMessages(prev => [...prev, { role: 'assistant', content: errorMessage, isError: true }]);
      state.setRetryCandidate({ question: sanitizedMessage, image });
    } finally {
      state.setIsLoading(false);
      state.setStreamingText('');
      state.setSelectedImage(null);
    }
  }

  return { handleSend, ask, retry };
}

function useChatAdmin(state: ReturnType<typeof useChatState>, adminContext: AdminContext | undefined, isActive: boolean) {
  useEffect(() => {
    if (isActive) state.setAvatarMood('feliz');
  }, [isActive]);

  const handleSend = async () => {
    if ((!state.input.trim() && !state.selectedImage) || state.isLoading) return;

    // 🔒 S1: o contexto administrativo é montado 100% no servidor.
    // O cliente envia apenas mensagem/histórico/imagem — NENHUM dado de
    // paciente/lead (PII) é transportado pelo navegador até a rota.

    // 🔥 PATCH 1: Normalizar mensagem (Admin)
    const rawMessage = state.input.trim();
    const finalMessage = rawMessage.length > 0
      ? rawMessage
      : state.selectedImage
        ? "Analise esta imagem"
        : "";
    
    if (!finalMessage) return;

    // 🔥 PATCH 2: Sanitizar input
    const sanitizedMessage = sanitizeInput(finalMessage);

    if (sanitizedMessage.length > MAX_MESSAGE_LENGTH) {
      state.setMessages(prev => [...prev, { role: 'assistant', content: 'Mensagem muito longa. Envie em partes menores, por favor.' }]);
      return;
    }
    
    // 🔥 PATCH 3: History limpa (sem HTML)
    const cleanHistory = state.messages.slice(-6).map(m => ({
      role: m.role,
      content: m.content
    }));
    
    state.setInput('');
    state.setIsLoading(true);
    state.setMessages(prev => [...prev, { role: 'user', content: sanitizedMessage }]);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        state.setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sessão expirada. Faça login novamente.' }
        ]);
        return;
      }

      // 🔥 PATCH 4: Debug melhorado
      if (process.env.NODE_ENV === 'development') {
        console.log("CHAT PAYLOAD (ADMIN):", {
          role: 'admin',
          messageLength: sanitizedMessage.length,
          historyLength: cleanHistory.length,
          hasImage: !!state.selectedImage,
          adminContextReceived: !!adminContext
        });
      }

      const res = await fetch('/api/nutri-assistant/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: sanitizedMessage,
          history: cleanHistory,
          image: state.selectedImage
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.reply || 'Ops, erro ao consultar os dados administrativos.');
      }
      
      if (data.reply) {
        state.setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (error) {
      const errorMessage = (error as { message?: string }).message || 'Ops, erro ao consultar os dados administrativos.';
      state.setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
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
  const { role, adminContext } = props as ChatAssistantProps & { canAccessMealPlan?: boolean };
  const canAccessMealPlan = (props as { canAccessMealPlan?: boolean }).canAccessMealPlan === true;
  const quickActions = canAccessMealPlan ? QUICK_ACTIONS_PREMIUM : QUICK_ACTIONS_FREE;
  const isRoleAdmin = role === 'admin';
  
  const state = useChatState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileGenericRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const patientLogic = useChatPatient(state, !isRoleAdmin);
  const adminLogic = useChatAdmin(state, adminContext, isRoleAdmin);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number>(0);
  const [isComposerFocused, setIsComposerFocused] = useState(false);

  // VOZ-006 — Entrada por voz: Vosk PT-BR → texto → input normal.
  // A voz NÃO envia automaticamente: a transcrição aparece no campo de texto
  // para revisão e o envio usa o fluxo textual existente.
  const voice = useVoiceInput({
    onTranscript: (text) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      if (isVoiceDebugEnabled()) voiceDebugLog('VOICE_TRANSCRIPT', { transcriptionLength: trimmed.length, wordCount: trimmed.split(/\s+/).filter(Boolean).length });
      // VOZ-009 — preservar texto existente: adiciona transcrição com espaço, não sobrescreve
      state.setInput((prev: string) => {
        const prevTrimmed = prev.trim();
        if (!prevTrimmed) return trimmed;
        return `${prevTrimmed} ${trimmed}`;
      });
      if (isVoiceDebugEnabled()) {
        // VOICE_UI_UPDATED após atualização do estado React (próximo tick)
        setTimeout(() => voiceDebugLog('VOICE_UI_UPDATED', { ts: Date.now() }), 0);
      }
    },
  });

  const micDisabled = state.isLoading || (voice.isBusy && !voice.isRecording);

  // Mantém o scroll do chat no fim da conversa (inclui geração em streaming)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, state.isLoading, state.streamingText]);

  // VOZ-012 + COMPOSER-001 — auto-grow do textarea dentro do Composer:
  // mede as linhas reais renderizadas (scrollHeight), cresce até o limite e só
  // então ativa scroll interno (overflow-y:auto). Recalcula a cada mudança de
  // texto — digitar, apagar, colar e transcrição de voz ([state.input]) — e em
  // resize/orientação/visualViewport (teclado, redimensionar janela).
  // CHAT-UX-008 — medir SOMENTE após o commit do React e ANTES da pintura
  // (useLayoutEffect). Ordem garantida: render(com o novo value) → medir → pintar.
  // Isso remove qualquer medição no meio do evento (antes do valor controlado
  // ser comitado) e qualquer dependência da ordem onChange/setState. A 2ª
  // medição em requestAnimationFrame cobre fonte/layout que terminam depois.
  const resizeComposer = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const { heightPx, overflowY } = autoGrowHeight(el.scrollHeight, COMPOSER_MAX_HEIGHT);
    el.style.height = `${heightPx}px`;
    el.style.overflowY = overflowY;
  };

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    resizeComposer();
    const raf = requestAnimationFrame(() => resizeComposer());
    return () => cancelAnimationFrame(raf);
  }, [state.input, isComposerFocused]);

  useEffect(() => {
    const recompute = () => resizeComposer();
    window.addEventListener('resize', recompute);
    window.addEventListener('orientationchange', recompute);
    window.visualViewport?.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('orientationchange', recompute);
      window.visualViewport?.removeEventListener('resize', recompute);
    };
  }, []);

  // Fechar com Esc (overlay)
  useEffect(() => {
    if (!state.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') state.setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.isOpen]);

  // Drag bottom-sheet mobile isolado (não move conteúdo atrás)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 640) return; // desktop sem drag
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || window.innerWidth >= 640) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - startYRef.current;
    if (delta > 0) {
      setDragY(delta);
      // isolar gesto: não propagar para scroll da página
      if (e.cancelable) e.preventDefault();
    }
  };
  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = 100;
    if (dragY > threshold) {
      state.setIsOpen(false);
      setDragY(0);
    } else {
      setDragY(0);
    }
  };

  // Fechar menu anexo ao clicar fora
  useEffect(() => {
    if (!showAttachMenu) return;
    const onDocClick = () => setShowAttachMenu(false);
    // delay para não fechar imediatamente no mesmo clique que abriu
    const id = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', onDocClick);
    };
  }, [showAttachMenu]);

  const handleSend = () => {
    if (role === 'admin') {
      return adminLogic.handleSend();
    }
    if (role === 'patient') {
      return patientLogic.handleSend();
    }
  };

  const handleAsk = async (text: string) => {
    if (role === 'patient' && patientLogic.ask) {
      await patientLogic.ask(text);
    }
  };

  const handleRetry = () => {
    if (role === 'patient') {
      return patientLogic.retry?.();
    }
  };

  const getAvatarAnimation = () => {
    if (state.avatarMood === 'feliz') return 'animate-pulse-soft';
    if (state.avatarMood === 'seria') return 'hover:animate-pulse';
    return 'animate-pulse-soft';
  };

  const hasContent = state.input.trim().length > 0 || state.selectedImage !== null;

  // CHAT-UX-006 — idle compacto (uma linha) somente quando o Composer está
  // realmente vazio e sem interação; qualquer texto/foco/imagem/gravação
  // mantém o modo de edição (textarea + linha de ações).
  const isComposerIdle =
    !isComposerFocused && !hasContent && !voice.isRecording && state.selectedImage === null;

  // CHAT-UX-006 §5 — Instrumentação temporária de crescimento (somente debug).
  // Registra as alturas reais (textarea/Composer/Conversation/Panel/viewport)
  // a cada mudança de texto/foco. Ativa apenas com NEXT_PUBLIC_CHAT_DEBUG==='1'
  // no build; não registra conteúdo digitado, apenas métricas.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_CHAT_DEBUG !== '1') return;
    const t = textareaRef.current;
    const p = composerRef.current;
    const conv = scrollRef.current;
    const panel = panelRef.current;
    const h = (el: Element | null | undefined): number | null =>
      el ? Math.round(el.getBoundingClientRect().height) : null;
    const rect = (el: Element | null | undefined): { top: number; bottom: number } | null =>
      el
        ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom) }
        : null;
    // eslint-disable-next-line no-console
    console.info('[CHAT_DEBUG] composer metrics', {
      focused: isComposerFocused,
      hasContent,
      isComposerIdle,
      recording: voice.isRecording,
      selectedImage: !!state.selectedImage,
      textarea: t
        ? {
            scrollHeight: t.scrollHeight,
            clientHeight: t.clientHeight,
            offsetHeight: t.offsetHeight,
            height: h(t),
            rect: rect(t),
            styleHeightPx: t.style.height,
            contentClipped: t.scrollHeight > t.clientHeight, // conteúdo > caixa visível
            approxLines: Math.round((t.scrollHeight - 20) / 24),
          }
        : null,
      composer: p ? { height: h(p), rect: rect(p) } : null,
      conversation: conv ? { height: h(conv), rect: rect(conv) } : null,
      panel: panel ? { height: h(panel), rect: rect(panel) } : null,
      viewport: {
        innerHeight: window.innerHeight,
        docClientHeight: document.documentElement.clientHeight,
        vvHeight: window.visualViewport ? Math.round(window.visualViewport.height) : null,
        vvOffsetTop: window.visualViewport ? Math.round(window.visualViewport.offsetTop) : null,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.input, isComposerFocused, hasContent, isComposerIdle]);

  return (
    <>
      {!state.isOpen && (
        <div className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-[60]">
          <button 
            onClick={() => state.setIsOpen(true)} 
            className="relative group transition-all duration-300 hover:scale-110 active:scale-95 flex flex-col items-end"
            aria-label="Abrir assistente virtual"
          >
            <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full z-10 animate-pulse ring-4 ring-emerald-500/20"></span>
            
            <div className={`w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-full overflow-hidden border-[3px] border-stone-900 shadow-[0_12px_30px_rgba(0,0,0,0.2)] bg-gradient-to-b from-stone-50 to-stone-200 flex items-end justify-center ${getAvatarAnimation()}`}>
               <NextImage 
                 src={AVATAR_IMAGES[state.avatarMood]} 
                 alt="Nutri Avatar" 
                 width={149}
                 height={121}
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
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-end sm:justify-end sm:p-8 bg-stone-900/30 backdrop-blur-sm transition-all duration-300"
          onClick={() => state.setIsOpen(false)}
          aria-hidden={!state.isOpen}
        >
          
          <div
            ref={panelRef}
            className="w-full sm:w-[420px] lg:w-[440px] sm:max-w-[min(440px,calc(100vw-32px))] h-[85vh] h-[85dvh] sm:h-[min(600px,85dvh)] max-h-[800px] bg-white rounded-t-3xl sm:rounded-3xl shadow-premium border border-stone-100 flex flex-col overflow-hidden animate-slide-in-bottom duration-300 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Assistente Nutri Van"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.22,1,0.36,1)' }}
          >
            
            <div
              className="w-full flex justify-center pt-3 pb-2 sm:hidden bg-white border-b border-stone-100 shrink-0 touch-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-8 h-1 bg-stone-300 rounded-full" />
            </div>

            <div className="bg-nutri-900 bg-[#1A3B2B] px-4 py-3 text-white flex justify-between items-center shrink-0 shadow-sm relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0 bg-nutri-800 flex items-end justify-center shadow-inner ${getAvatarAnimation()}`}>
                  <NextImage 
                    src={AVATAR_IMAGES[state.avatarMood]} 
                    alt="Avatar" 
                    width={149}
                    height={121}
                    className="w-[90%] h-[90%] object-cover object-top drop-shadow-md" 
                  />
                </div>
                <h4 className="font-semibold text-[14px] leading-tight text-white tracking-tight flex items-center gap-1.5">
                  Nutri <span className="text-emerald-400">Van</span>
                  <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  {!isRoleAdmin && canAccessMealPlan && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 text-[9px] font-bold tracking-wider">
                      Premium
                    </span>
                  )}
                  {!isRoleAdmin && !canAccessMealPlan && (
                    <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white/70">
                      Gratuito
                    </span>
                  )}
                </h4>
              </div>
              
              <div className="flex items-center gap-2">
                {!isRoleAdmin && (
                  <a 
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=Oi%20Nutri!%20Estou%20com%20uma%20dúvida%20aqui%20no%20app.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition-all active:scale-95 shadow-sm min-h-[44px]"
                    title="Falar com a Nutricionista"
                  >
                    <MessageCircle size={16} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">WhatsApp</span>
                  </a>
                )}
                <button 
                  onClick={() => state.setIsOpen(false)} 
                  className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white rounded-xl transition-all active:scale-95 shrink-0"
                  aria-label="Fechar chat"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            
            <div ref={scrollRef} className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto space-y-4 bg-white scrollbar-hide" role="log" aria-live="polite" aria-relevant="additions">
              
              {state.messages.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center text-center px-6 py-8 gap-4 animate-fade-in-up">
                  <div className={`w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-full overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 flex items-end justify-center shadow-sm border-4 border-white ${getAvatarAnimation()}`}>
                    <NextImage 
                      src={AVATAR_IMAGES[state.avatarMood]} 
                      alt="Nutri Grande" 
                      width={149}
                      height={121}
                      className="w-[90%] h-[90%] object-cover object-top drop-shadow-md" 
                    />
                  </div>
                  <div className="space-y-2 max-w-[32ch]">
                    <p className="font-bold text-stone-900 text-[20px] sm:text-[22px] tracking-tight leading-tight">
                      {isRoleAdmin ? 'Olá, Vanusa!' : 'Olá!'}
                    </p>
                    <p className="text-stone-600 text-sm leading-relaxed">
                      {isRoleAdmin 
                        ? 'Estou conectada aos dados dos seus pacientes e leads ativos. Você pode me pedir resumos, relatórios de humor, ou checar quem ainda não tem dieta. Como posso te ajudar hoje?'
                        : 'Sou a Nutri Van, sua assistente virtual. Posso te ajudar com dúvidas sobre seu cardápio, analisar fotos de pratos ou te dar motivação.'}
                    </p>
                  </div>

                  {!isRoleAdmin && (
                    <div className="w-full flex flex-wrap justify-center gap-2 pt-1" role="group" aria-label="Ações rápidas">
                      {quickActions.map((qa) => (
                        <button
                          key={qa}
                          type="button"
                          onClick={() => handleAsk(qa)}
                          disabled={state.isLoading}
                          className="min-h-[44px] px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-nutri-200 hover:text-nutri-700 hover:bg-nutri-50 shadow-sm text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {qa}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {state.messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                  <div className={`text-[15px] leading-relaxed break-words [overflow-wrap:break-word] ${
                    m.role === 'user' 
                      ? 'max-w-[75%] bg-nutri-900 bg-[#1A3B2B] text-white rounded-2xl rounded-tr-sm font-medium px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' 
                      : 'w-full bg-transparent border-0 shadow-none rounded-none px-1 py-2 text-stone-800 text-left'
                  } ${m.isError ? 'border border-amber-200 bg-amber-50 text-amber-900 rounded-2xl px-4 py-3' : ''}`}>
                    {m.role === 'assistant' ? renderMessage(m.content) : m.content}
                  </div>
                  {m.isError && !state.isLoading && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={state.isLoading}
                      className="mt-1.5 inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-full text-[13px] font-semibold text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 bg-white shadow-sm transition-all active:scale-95"
                      aria-label="Tentar novamente"
                    >
                      Tentar novamente
                    </button>
                  )}
                </div>
              ))}
              
              {state.streamingText ? (
                <div className="flex justify-start animate-fade-in">
                  <div className="w-full bg-transparent border-0 shadow-none rounded-none px-1 py-2 text-[15px] leading-relaxed break-words [overflow-wrap:break-word] text-stone-800 text-left">
                    {renderMessage(state.streamingText)}
                  </div>
                </div>
              ) : state.isLoading && (
                <div className="flex justify-start animate-fade-in" role="status" aria-live="polite">
                  <div className="bg-white border border-stone-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-stone-600 text-[13px] font-semibold">
                      {isRoleAdmin ? 'Consultando dados...' : 'Pensando...'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-2 sm:p-3 shrink-0 relative z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
              
              <div ref={composerRef} className="flex flex-col w-full bg-white p-2 rounded-3xl border border-stone-200 shadow-sm transition-colors min-h-0">
                
                {state.selectedImage && (
                  <div className="flex items-center gap-3 px-2 pb-3 mb-3 border-b border-stone-100 animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-1 bg-white border border-stone-200 rounded-xl shadow-sm shrink-0">
                      <NextImage 
                        src={`data:image/jpeg;base64,${state.selectedImage}`} 
                        width={80}
                        height={80}
                        className="h-20 w-20 rounded-lg object-cover" 
                        alt="Preview do anexo"
                      />
                    </div>
                    <div className="flex-1 min-w-0 text-xs text-stone-500 truncate">Imagem selecionada</div>
                    <button 
                      onClick={() => state.setSelectedImage(null)} 
                      className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center bg-stone-800 text-white rounded-full shadow-md hover:bg-rose-500 hover:scale-110 transition-all active:scale-95 shrink-0"
                      aria-label="Remover imagem"
                    >
                       <X size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                {voice.isRecording ? (
                  <div className="w-full flex items-center gap-1 py-0.5" aria-live="polite" aria-label="Gravando">
                    <button
                      type="button"
                      onClick={voice.cancel}
                      aria-label="Cancelar gravação"
                      className="min-w-[44px] h-[44px] w-11 h-11 flex items-center justify-center text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-all shrink-0 active:scale-95"
                    >
                      <X size={18} strokeWidth={2.5} />
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-2 min-w-0 px-1">
                      <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0" aria-hidden="true"></span>
                      <div className="flex items-end justify-center gap-[3px] h-4 flex-1 min-w-0 overflow-hidden" aria-hidden="true">
                        {WAVEFORM_BAR_HEIGHTS.map((h, i) => (
                          <span
                            key={i}
                            className={`flex-1 max-w-[3px] ${h} ${i % 5 === 2 ? 'bg-rose-500' : 'bg-rose-400'} rounded-full animate-pulse`}
                            style={{ animationDelay: `${(i * 90) % 1260}ms` }}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-mono font-medium text-stone-700 tabular-nums shrink-0">{formatElapsedMs(voice.recordingElapsedMs)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => voice.stop()}
                      aria-label="Parar gravação"
                      className="min-w-[44px] h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-nutri-800 bg-[#2A5C43] text-white hover:bg-nutri-900 hover:bg-[#1A3B2B] shadow-sm transition-all shrink-0 active:scale-95"
                    >
                      <Square size={11} strokeWidth={2.5} fill="currentColor" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="grid w-full min-w-0 items-center gap-x-1 gap-y-1.5"
                    style={{
                      ...COMPOSER_GRID_COLUMNS,
                      gridTemplateRows: isComposerIdle ? 'auto' : 'auto auto',
                      ...(isComposerIdle ? COMPOSER_IDLE_AREAS : COMPOSER_EDIT_AREAS),
                    }}
                  >
                    <div className="relative [grid-area:attach]">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); }}
                        className="min-w-[44px] h-[44px] w-11 h-11 flex items-center justify-center text-stone-500 hover:text-nutri-700 hover:bg-stone-100 rounded-full transition-all shrink-0 active:scale-95"
                        disabled={state.isLoading}
                        title="Anexar"
                        aria-label="Anexar foto"
                        aria-expanded={showAttachMenu}
                        aria-haspopup="menu"
                      >
                        <ImagePlus size={18} strokeWidth={2.5} />
                      </button>
                      {showAttachMenu && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white border border-stone-200 rounded-2xl shadow-lg p-2 flex flex-col gap-1 w-56 z-20" role="menu" onClick={(e)=>e.stopPropagation()}>
                          <button
                            onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 text-left text-sm font-medium text-stone-700 transition-colors"
                            role="menuitem"
                          >
                            <Camera size={18} strokeWidth={2} /> Tirar foto
                          </button>
                          <button
                            onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 text-left text-sm font-medium text-stone-700 transition-colors"
                            role="menuitem"
                          >
                            <ImagePlus size={18} strokeWidth={2} /> Escolher da galeria
                          </button>
                          <button
                            onClick={() => { fileGenericRef.current?.click(); setShowAttachMenu(false); }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 text-left text-sm font-medium text-stone-700 transition-colors"
                            role="menuitem"
                          >
                            <FileText size={18} strokeWidth={2} /> Arquivo
                          </button>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={state.handleImageSelect}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={cameraInputRef}
                        className="hidden"
                        onChange={state.handleImageSelect}
                      />
                      <input
                        type="file"
                        accept="*/*"
                        ref={fileGenericRef}
                        className="hidden"
                        onChange={state.handleImageSelect}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void voice.start()}
                      disabled={micDisabled}
                      title={!voice.isSupported
                        ? 'Transcrição de voz não suportada neste navegador (exige HTTPS e microfone).'
                        : 'Falar mensagem'}
                      aria-label="Falar mensagem"
                      className="[grid-area:mic] min-w-[44px] h-[44px] w-11 h-11 flex items-center justify-center rounded-full text-stone-500 hover:text-nutri-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 active:scale-95"
                    >
                      {voice.isBusy
                        ? <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
                        : <Mic size={20} strokeWidth={2.5} />}
                    </button>

                    <textarea
                      value={state.input}
                      rows={1}
                      onFocus={() => setIsComposerFocused(true)}
                      onBlur={() => setIsComposerFocused(false)}
                      onChange={(e) => {
                        // CHAT-UX-008: medição NÃO ocorre aqui (antes do commit);
                        // o useLayoutEffect mede após o React renderizar o novo value.
                        state.setInput(e.target.value);
                      }}
                      maxLength={MAX_MESSAGE_LENGTH}
                      placeholder={isRoleAdmin ? "Pesquise por pacientes..." : "Digite sua dúvida..."}
                      aria-label={isRoleAdmin ? "Mensagem para o assistente" : "Digite sua dúvida para a assistente"}
                      className="[grid-area:input] w-full min-w-0 bg-transparent border-0 focus:border-0 focus:ring-0 focus:outline-none ring-0 outline-none shadow-none px-2 py-2 text-[15px] leading-[1.6] text-stone-800 placeholder:text-stone-400 font-medium resize-none overflow-y-auto min-h-[44px] max-h-[200px] disabled:opacity-60"
                      disabled={state.isLoading}
                    />

                    <button 
                      onClick={handleSend} 
                      disabled={state.isLoading || !hasContent} 
                      className={`[grid-area:send] min-w-[44px] h-[44px] w-11 h-11 rounded-full transition-all shrink-0 flex items-center justify-center ${
                        state.isLoading || !hasContent
                          ? 'bg-stone-200 text-stone-400' 
                          : 'bg-nutri-800 bg-[#2A5C43] text-white hover:bg-nutri-700 hover:bg-[#1A3B2B] shadow-md hover:shadow-lg active:scale-95'
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
                )}

                {!voice.isRecording && (voice.isBusy || voice.error) ? (
                  <div className="mt-2 px-2 flex items-center gap-2 text-xs" role="status" aria-live="polite">
                    {voice.status === 'processing' && (
                      <span className="text-stone-600 font-medium">Processando...</span>
                    )}
                    {voice.status === 'transcribing' && (
                      <span className="text-stone-600 font-medium">Transcrevendo...</span>
                    )}
                    {voice.status === 'loading' && (
                      <span className="text-stone-600 font-medium">Preparando...</span>
                    )}
                    {voice.error && (
                      <span className="text-rose-600 font-medium">{voice.error.userMessage}</span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
