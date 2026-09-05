// VOZ-006 — Camada de controle entre a UI do ChatAssistant e a engine STT.
// Regra arquitetural: o Vosk (e esta camada) NÃO conhece Gemini/OpenAI/Supabase/RAG/
// streaming/guardrails/backend — apenas recebe áudio e retorna texto.
//
// Responsabilidades:
// - adquirir microfone (reutiliza capture.ts);
// - garantir engine carregada (reutiliza engineState + registry);
// - gravar PCM contínuo (reutiliza createPcmRecorder de capture.ts);
// - transcrever via engine (vosk-pt-br) e entregar o texto via onTranscript;
// - liberar recursos e impedir execução concorrente.
//
// Independente de framework: testável em node com mocks injetáveis.

import { getEngine } from './stt/registry';
import type { STTEngine } from './stt/registry';
import { captureAudio, createPcmRecorder, resampleTo16k } from './audio/capture';
import type { CaptureResult, PcmRecorder } from './audio/capture';
import { engineStateReducer, INITIAL_ENGINE_STATE, isEngineReady } from './stt/engineState';
import type { EngineState } from './stt/engineState';

export type VoiceStatus = 'idle' | 'loading' | 'ready' | 'recording' | 'transcribing' | 'result' | 'error';

export type VoiceErrorCode =
  | 'unsupported'
  | 'insecure'
  | 'permission_denied'
  | 'not_found'
  | 'aborted'
  | 'load_failed'
  | 'transcribe_failed'
  | 'empty'
  | 'busy'
  | 'unknown';

export type VoiceInputError = {
  code: VoiceErrorCode;
  userMessage: string;
  detail?: string;
};

export type VoiceControllerOptions = {
  engineId?: string;
  // Injetáveis para teste (sem tocar em APIs reais do browser em node).
  getEngine?: (id: string) => STTEngine | undefined;
  capture?: typeof captureAudio;
  recorderFactory?: (stream: MediaStream, audioContext: AudioContext) => PcmRecorder;
  onTranscript?: (text: string) => void;
  onError?: (error: VoiceInputError) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  checkSupport?: boolean;
};

export type VoiceSupport = { secure: boolean; hasCapture: boolean; engineOk: boolean };

export class VoiceInputController {
  private readonly opts: VoiceControllerOptions;
  private readonly engine: STTEngine | undefined;
  private engineState: EngineState = INITIAL_ENGINE_STATE;
  private recording = false;
  private loading = false;
  private transcribing = false;
  // Token de geração: cancel()/dispose() invalidam conclusões assíncronas obsoletas.
  private gen = 0;
  private capture: CaptureResult | null = null;
  private recorder: PcmRecorder | null = null;

  constructor(options: VoiceControllerOptions = {}) {
    this.opts = options;
    const engineId = options.engineId ?? 'vosk-pt-br';
    this.engine = options.getEngine ? options.getEngine(engineId) : getEngine(engineId);
  }

  isSupported(): VoiceSupport {
    const secure =
      typeof window !== 'undefined' && window.isSecureContext === true;
    const hasCapture =
      typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const engineOk = (this.engine?.isSupported?.() ?? true) && !!this.engine;
    return { secure, hasCapture, engineOk };
  }

  getStatus(): VoiceStatus {
    if (this.loading) return 'loading';
    if (this.recording) return 'recording';
    if (this.transcribing) return 'transcribing';
    if (this.engineState === 'IDLE') return 'idle';
    if (this.engineState === 'READY') return 'ready';
    if (this.engineState === 'RESULT') return 'result';
    if (this.engineState === 'ERROR') return 'error';
    if (this.engineState === 'TRANSCRIBING') return 'transcribing';
    if (this.engineState === 'LOADING') return 'loading';
    return 'idle';
  }

  private setStatus(status: VoiceStatus): void {
    this.opts.onStatusChange?.(status);
  }

  private fail(error: VoiceInputError): void {
    this.opts.onError?.(error);
    this.setStatus(this.getStatus());
  }

  private failCapture(e: any): void {
    let code: VoiceErrorCode;
    let userMessage: string;
    const detail = e instanceof Error ? e.message : String(e);
    const capCode = (e as any)?.code;

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      code = 'insecure';
      userMessage = 'O microfone exige um contexto seguro (HTTPS ou localhost).';
    } else if (capCode === 'permission_denied') {
      code = 'permission_denied';
      userMessage = 'Permissão de microfone negada. Permita o acesso no navegador e tente novamente.';
    } else if (capCode === 'not-found') {
      code = 'not_found';
      userMessage = 'Nenhum microfone encontrado no dispositivo.';
    } else if (capCode === 'aborted') {
      code = 'aborted';
      userMessage = 'Microfone em uso por outro aplicativo. Feche o outro app e tente novamente.';
    } else if (capCode === 'not-supported') {
      code = 'unsupported';
      userMessage = 'Captura de áudio não é suportada neste navegador.';
    } else {
      code = 'unknown';
      userMessage = 'Não foi possível acessar o microfone. Tente novamente.';
    }
    // Falha de captura → estado de erro (retry volta a carregar engine na próxima start()).
    this.engineState = 'ERROR';
    this.fail({ code, userMessage, detail });
  }

  async start(): Promise<void> {
    // Execução concorrente: uma única gravação/load/transcrição por vez.
    if (this.loading || this.recording || this.transcribing) return;

    if (this.opts.checkSupport !== false) {
      const support = this.isSupported();
      const engineOk = !!this.engine && (this.engine?.isSupported?.() ?? true);
      if (!support.hasCapture || !support.secure) {
        this.fail({
          code: support.secure ? 'unsupported' : 'insecure',
          userMessage: support.secure
            ? 'Captura de áudio não é suportada neste navegador.'
            : 'O microfone exige um contexto seguro (HTTPS ou localhost).',
        });
        return;
      }
      if (!engineOk) {
        this.fail({
          code: 'unsupported',
          userMessage: 'Transcrição de voz não é suportada neste navegador (WebAssembly ou Worker indisponível).',
        });
        return;
      }
    }

    const gen = ++this.gen;
    this.loading = true;
    this.setStatus('loading');

    // 1. Microfone imediato (permissão no toque, conforme VOZ-006 §6).
    let cap: CaptureResult | null = null;
    try {
      cap = await this.captureFn();
    } catch (e: any) {
      this.loading = false;
      if (gen !== this.gen) return;
      this.failCapture(e);
      return;
    }
    if (gen !== this.gen) { try { cap.cleanup(); } catch {} return; }
    this.capture = cap;

    // 2. Engine: carrega apenas se ainda não estiver READY/RESULT.
    if (!isEngineReady(this.engineState) && this.engine) {
      this.engineState = engineStateReducer(this.engineState, { type: 'LOAD_START' });
      this.setStatus('loading');
      try {
        await this.engine.load();
      } catch (e: any) {
        this.loading = false;
        try { cap.cleanup(); } catch {}
        this.capture = null;
        if (gen !== this.gen) return;
        this.engineState = engineStateReducer(this.engineState, { type: 'LOAD_ERROR' });
        this.fail({
          code: 'load_failed',
          userMessage: 'Não foi possível carregar o modelo de voz. Tente novamente.',
          detail: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      if (gen !== this.gen) { try { cap.cleanup(); } catch {} this.capture = null; return; }
      this.engineState = engineStateReducer(this.engineState, { type: 'LOAD_SUCCESS' });
    }
    if (!this.engine) {
      this.loading = false;
      try { cap.cleanup(); } catch {} this.capture = null;
      this.engineState = 'ERROR';
      this.fail({ code: 'load_failed', userMessage: 'Engine de voz não encontrada no registro.' });
      return;
    }

    // 3. Gravação.
    this.loading = false;
    this.recorder = this.opts.recorderFactory
      ? this.opts.recorderFactory(cap.stream, cap.audioContext)
      : createPcmRecorder(cap.stream, cap.audioContext);
    this.recorder.start();
    this.recording = true;
    this.setStatus('recording');
  }

  async stop(): Promise<void> {
    // stop() só tem efeito durante a gravação; fora dela é no-op.
    if (!this.recording || !this.recorder || !this.capture) return;

    const gen = this.gen;
    // PCM é capturado na taxa real do AudioContext (ex: 48 kHz no dispositivo).
    const recordedRate = this.capture?.audioContext?.sampleRate || 16000;
    let pcm: Float32Array;
    try {
      pcm = this.recorder.stop();
    } finally {
      this.recorder = null;
      this.recording = false;
      if (this.capture) {
        try { this.capture.cleanup(); } catch {}
        this.capture = null;
      }
    }
    if (gen !== this.gen || !this.engine) return;

    const sampleRate = 16000;
    const pcm16k = recordedRate === sampleRate ? pcm : resampleTo16k(pcm, recordedRate, sampleRate);

    // Transcrição vazia (usuário parou sem falar) — não envia nada, mantém engine pronta.
    if (pcm16k.length === 0) {
      this.engineState = engineStateReducer(this.engineState, { type: 'TRANSCRIBE_SUCCESS' });
      this.setStatus('result');
      this.fail({ code: 'empty', userMessage: 'Nenhuma fala detectada. Aproxime-se do microfone e tente novamente.' });
      return;
    }

    this.transcribing = true;
    this.engineState = engineStateReducer(this.engineState, { type: 'TRANSCRIBE_START' });
    this.setStatus('transcribing');
    try {
      const res = await this.engine.transcribe(pcm16k, sampleRate);
      if (gen !== this.gen) return;
      const text = (res?.text || '').trim();
      this.transcribing = false;
      this.engineState = engineStateReducer(this.engineState, { type: 'TRANSCRIBE_SUCCESS' });
      this.setStatus('result');
      if (text) {
        this.opts.onTranscript?.(text);
      } else {
        this.fail({ code: 'empty', userMessage: 'Nenhuma fala detectada. Aproxime-se do microfone e tente novamente.' });
      }
    } catch (e: any) {
      if (gen !== this.gen) return;
      this.transcribing = false;
      this.engineState = engineStateReducer(this.engineState, { type: 'TRANSCRIBE_ERROR' });
      this.fail({
        code: 'transcribe_failed',
        userMessage: 'Erro ao transcrever o áudio. Tente novamente.',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  cancel(): void {
    // Aborta a sessão atual (gravação ou load em andamento) sem transcrever.
    this.gen++;
    if (this.recording) {
      try { this.recorder?.cancel(); } catch {}
      this.recorder = null;
    }
    if (this.capture) {
      try { this.capture.cleanup(); } catch {}
      this.capture = null;
    }
    this.recording = false;
    this.loading = false;
    if (this.engineState === 'LOADING') {
      // Load interrompido: encerra para um estado reiniciável.
      this.engineState = 'IDLE';
    }
    this.setStatus(this.getStatus());
  }

  reset(): void {
    // Força a re-emissão do estado atual (útil para limpar mensagens na UI).
    this.setStatus(this.getStatus());
  }

  async dispose(): Promise<void> {
    // Encerra tudo: mic, AudioContext, recorder e Worker/WASM do modelo.
    this.gen++;
    if (this.recording) {
      try { this.recorder?.cancel(); } catch {}
      this.recorder = null;
    }
    if (this.capture) {
      try { this.capture.cleanup(); } catch {}
      this.capture = null;
    }
    this.recording = false;
    this.loading = false;
    this.transcribing = false;
    try { await this.engine?.dispose?.(); } catch {}
    this.engineState = INITIAL_ENGINE_STATE;
    this.setStatus('idle');
  }

  private captureFn(): Promise<CaptureResult> {
    return this.opts.capture ? this.opts.capture(16000) : captureAudio(16000);
  }
}