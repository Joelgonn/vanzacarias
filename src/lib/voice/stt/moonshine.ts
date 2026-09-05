// VOZ-001.2 / 001.5 / 001.6 — Runtime Moonshine isolado (VOZ-002-R1 fix: ESM)
// - Execução local (sem /api/stt, sem envio ao backend)
// - Sem COOP/COEP (numThreads=1)
// - Suporta streaming (onTranscriptionUpdated vs committed) mas só committed vai para chatbot futuro

export type MoonshineModelId = 'tiny' | 'tiny-streaming' | 'base' | 'base-streaming' | 'small-streaming' | 'medium-streaming';

export type MoonshineConfig = {
  model: MoonshineModelId;
  useStreaming: boolean;
};

export type TranscriptionCallbacks = {
  onPartial?: (text: string) => void;
  onCommitted: (text: string) => void;
  onError?: (code: string, message: string) => void;
  onModelLoadStart?: () => void;
  onModelLoadEnd?: (durationMs: number, success: boolean) => void;
};

export type MoonshineRuntimeState = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

let cachedRuntime: MoonshineRuntime | null = null;
let cachedKey: string | null = null;

class MoonshineRuntime {
  private state: MoonshineRuntimeState = 'idle';
  private loadPromise: Promise<void> | null = null;
  private transcriber: any = null;
  private modelId: string;
  private MoonshineNS: any = null;

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
        let Moonshine: any = null;
        if (typeof window === 'undefined') {
          Moonshine = { MicrophoneTranscriber: class { constructor(a: any, b: any, c: any) {} async start() {} stop() {} } };
        } else {
          try {
            Moonshine = await (0, eval)('import("https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-js@0.1.29/dist/moonshine.min.js")');
            Moonshine = (Moonshine as any).default || Moonshine;
          } catch {
            Moonshine = await (0, eval)('import("@moonshine-ai/moonshine-js")');
            Moonshine = (Moonshine as any).default || Moonshine;
          }
        }
        if (!Moonshine?.MicrophoneTranscriber) {
          throw new Error('MicrophoneTranscriber não encontrado no pacote @moonshine-ai/moonshine-js (ESM)');
        }
        this.MoonshineNS = Moonshine;
        try {
          const ort = (Moonshine as any).ort || (typeof window !== 'undefined' ? (window as any).ort : null);
          if (ort?.env?.wasm) ort.env.wasm.numThreads = 1;
        } catch {}
        this.state = 'ready';
        callbacks?.onModelLoadEnd?.(Date.now() - start, true);
      } catch (e: any) {
        this.state = 'error';
        const msg = e?.message || String(e);
        callbacks?.onModelLoadEnd?.(Date.now() - start, false);
        throw new Error(`Falha ao carregar Moonshine: ${msg}`);
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
    if (!this.MoonshineNS?.MicrophoneTranscriber) {
      throw new Error('Moonshine não carregado — execute load() primeiro');
    }
    this.state = 'transcribing';
    const useVAD = !this.config.useStreaming;
    const transcriber = new this.MoonshineNS.MicrophoneTranscriber(
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
      this.state = 'error';
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
  const key = `${config.model}:${config.useStreaming}`;
  if (cachedRuntime && cachedKey === key) {
    return cachedRuntime;
  }
  cachedRuntime = new MoonshineRuntime(config);
  cachedKey = key;
  return cachedRuntime;
}

export async function transcribeOnce(
  audio: Float32Array,
  sampleRate: number,
  config: MoonshineConfig = { model: 'tiny-streaming', useStreaming: false }
): Promise<string> {
  throw new Error('transcribeOnce requer modelo carregado — usar MicrophoneTranscriber em browser; para testes unitários, mockar');
}

export function isMoonshineSupported(): { wasm: boolean; webgpu: boolean } {
  const wasm = typeof WebAssembly !== 'undefined';
  const webgpu = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
  return { wasm, webgpu };
}
