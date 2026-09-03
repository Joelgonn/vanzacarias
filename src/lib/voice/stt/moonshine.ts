// VOZ-001.2 / 001.5 / 001.6 — Runtime Moonshine isolado
// - Execução local (sem /api/stt, sem envio ao backend)
// - Sem COOP/COEP (numThreads=1)
// - Suporta streaming (onTranscriptionUpdated vs committed) mas só committed vai para chatbot futuro

export type MoonshineModelId = 'tiny' | 'tiny-streaming' | 'base' | 'base-streaming' | 'small-streaming' | 'medium-streaming';

export type MoonshineConfig = {
  model: MoonshineModelId;
  useStreaming: boolean; // true = onTranscriptionUpdated, false = VAD committed only
};

export type TranscriptionCallbacks = {
  onPartial?: (text: string) => void; // streaming update (não enviar ao chatbot)
  onCommitted: (text: string) => void; // final (candidato a runExchange)
  onError?: (code: string, message: string) => void;
  onModelLoadStart?: () => void;
  onModelLoadEnd?: (durationMs: number, success: boolean) => void;
};

export type MoonshineRuntimeState = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

// Wrapper isolado — não importa ChatAssistant nem Supabase
let cachedRuntime: MoonshineRuntime | null = null;

class MoonshineRuntime {
  private state: MoonshineRuntimeState = 'idle';
  private loadPromise: Promise<void> | null = null;
  private transcriber: any = null; // Moonshine MicrophoneTranscriber
  private modelId: string;

  constructor(private config: MoonshineConfig) {
    this.modelId = `model/${config.model}`;
  }

  getState(): MoonshineRuntimeState {
    return this.state;
  }

  async load(callbacks?: Pick<TranscriptionCallbacks, 'onModelLoadStart' | 'onModelLoadEnd'>): Promise<void> {
    if (this.state === 'ready' || this.state === 'transcribing') return;
    if (this.loadPromise) return this.loadPromise;

    this.state = 'loading';
    callbacks?.onModelLoadStart?.();
    const start = Date.now();

    this.loadPromise = (async () => {
      try {
        // VOZ-002: carregamento via CDN em runtime para não quebrar build (evita bundling ort.wasm)
        // Em produção, o script é injetado sob demanda; em testes Node, simula pronto
        if (typeof window !== 'undefined' && !(window as any).Moonshine) {
          await new Promise<void>((resolve, reject) => {
            // Se já existe script, não injeta de novo
            if (document.querySelector('script[data-moonshine]')) {
              // Aguarda window.Moonshine aparecer
              const check = setInterval(() => {
                if ((window as any).Moonshine) { clearInterval(check); resolve(); }
              }, 200);
              setTimeout(() => { clearInterval(check); resolve(); }, 5000);
              return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-js@0.1.29/dist/moonshine.min.js';
            script.setAttribute('data-moonshine', 'true');
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar Moonshine CDN'));
            document.head.appendChild(script);
          });
        }
        // Garante single-thread sem COOP/COEP
        try {
          const ort = (window as any).ort;
          if (ort?.env?.wasm) ort.env.wasm.numThreads = 1;
        } catch {}

        this.state = 'ready';
        callbacks?.onModelLoadEnd?.(Date.now() - start, true);
      } catch (e: any) {
        this.state = 'error';
        callbacks?.onModelLoadEnd?.(Date.now() - start, false);
        throw new Error(e?.message || 'Falha ao carregar Moonshine');
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  async startTranscription(callbacks: TranscriptionCallbacks): Promise<{ stop: () => void; dispose: () => void }> {
    if (this.state !== 'ready') {
      await this.load(callbacks);
    }
    this.state = 'transcribing';

    // Usa global carregado via CDN (window.Moonshine) — sem bundling
    const Moonshine2: any = (typeof window !== 'undefined' ? (window as any).Moonshine : null);
    if (!Moonshine2) throw new Error('Moonshine não carregado — execute load() primeiro');

    // Decisão: usar MicrophoneTranscriber (VAD) para fala livre; streaming = !VAD
    const useVAD = !this.config.useStreaming;

    const transcriber = new Moonshine2.MicrophoneTranscriber(
      this.modelId,
      {
        onTranscriptionCommitted: (text: string | undefined) => {
          if (text && text.trim()) callbacks.onCommitted(text.trim());
        },
        onTranscriptionUpdated: this.config.useStreaming
          ? (text: string | undefined) => {
              if (text !== undefined && callbacks.onPartial) callbacks.onPartial(text);
            }
          : undefined,
        onModelLoadStarted: () => callbacks.onModelLoadStart?.(),
        onModelLoadEnd: (success: boolean) => callbacks.onModelLoadEnd?.(0, success),
      },
      useVAD
    );

    this.transcriber = transcriber;

    try {
      await transcriber.start();
    } catch (e: any) {
      const msg = e?.message || 'Falha ao iniciar transcrição';
      callbacks.onError?.('start_failed', msg);
      throw new Error(msg);
    }

    const stop = () => {
      try { transcriber.stop(); } catch {}
      this.state = 'ready';
    };
    const dispose = () => {
      try { transcriber.stop(); } catch {}
      try { transcriber.dispose?.(); } catch {}
      this.state = 'ready';
      this.transcriber = null;
    };

    return { stop, dispose };
  }

  async dispose(): Promise<void> {
    try { this.transcriber?.stop(); } catch {}
    this.transcriber = null;
    this.state = 'idle';
  }
}

export function getMoonshineRuntime(config: MoonshineConfig): MoonshineRuntime {
  // Singleton por modelo para cache
  if (cachedRuntime && (cachedRuntime as any).config?.model === config.model && (cachedRuntime as any).config?.useStreaming === config.useStreaming) {
    return cachedRuntime;
  }
  cachedRuntime = new MoonshineRuntime(config);
  return cachedRuntime;
}

// Helper para isolamento: audio → transcript sem chamar chatbot
// Usado em benchmark (VOZ-001.6) para medir WER isoladamente
export async function transcribeOnce(
  audio: Float32Array,
  sampleRate: number,
  config: MoonshineConfig = { model: 'tiny-streaming', useStreaming: false }
): Promise<string> {
  // Para teste isolado sem microfone, usa MoonshineModel diretamente (offline)
  // Fallback: se não houver modelo pt-BR, retorna vazio e registra
  throw new Error('transcribeOnce requer modelo carregado — usar MicrophoneTranscriber em browser; para testes unitários, mockar');
}

export function isMoonshineSupported(): { wasm: boolean; webgpu: boolean } {
  const wasm = typeof WebAssembly !== 'undefined';
  // WebGPU é opcional — Moonshine funciona em WASM
  const webgpu = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
  return { wasm, webgpu };
}
