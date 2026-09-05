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
import { isVoiceDebugEnabled, voiceDebugLog, computePcmStats, computeWindowDistribution } from './debug';

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
  // VOZ-008 — instrumentação wall time (sem áudio)
  private recordingStartMs: number | null = null;

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

    // 3. Gravação — VOZ-008.5: garantir AudioContext running antes do PCM
    // Ordem exigida: AudioContext → resume() → running → criação PCM
    const stateBeforeCtrl: string = (cap.audioContext.state as string) ?? 'unknown';
    let resumeAttemptedCtrl = false;
    const needsResumeCtrl = typeof cap.audioContext.state === 'string' && (cap.audioContext.state as string) !== 'running' && (cap.audioContext.state as string) !== 'closed';
    if (needsResumeCtrl) {
      resumeAttemptedCtrl = true;
      if (typeof cap.audioContext.resume === 'function') {
        try {
          await cap.audioContext.resume();
        } catch {}
      }
    }
    const stateAfterCtrl: string = (cap.audioContext.state as string) ?? 'unknown';
    const resumeSucceededCtrl = stateAfterCtrl === 'running';
    if (isVoiceDebugEnabled()) {
      voiceDebugLog('AUDIOCONTEXT_RESUME_CONTROLLER', {
        stateBefore: stateBeforeCtrl,
        resumeAttempted: resumeAttemptedCtrl,
        stateAfter: stateAfterCtrl,
        resumeSucceeded: resumeSucceededCtrl,
      });
    }
    if (needsResumeCtrl && stateAfterCtrl !== 'running') {
      this.loading = false;
      try { cap.cleanup(); } catch {}
      this.capture = null;
      this.engineState = 'ERROR';
      this.fail({
        code: 'unknown',
        userMessage: `AudioContext não está em running (estado: ${stateAfterCtrl})`,
        detail: `stateBefore=${stateBeforeCtrl} resumeAttempted=${resumeAttemptedCtrl}`,
      });
      return;
    }

    this.loading = false;
    this.recorder = this.opts.recorderFactory
      ? this.opts.recorderFactory(cap.stream, cap.audioContext)
      : createPcmRecorder(cap.stream, cap.audioContext);
    this.recordingStartMs = Date.now();
    this.recorder.start();
    this.recording = true;
    this.setStatus('recording');
    if (isVoiceDebugEnabled()) {
      const s: any = cap.actualSettings as any;
      voiceDebugLog('CAPTURE_START', {
        engineId: this.engine?.id ?? 'vosk-pt-br',
        engineState: this.engineState,
        gen: this.gen,
        audioContextSampleRate: cap.audioContext.sampleRate,
        audioContextState: cap.audioContext.state,
        trackSettings: {
          sampleRate: s?.sampleRate ?? null,
          channelCount: s?.channelCount ?? null,
          echoCancellation: s?.echoCancellation ?? null,
          noiseSuppression: s?.noiseSuppression ?? null,
          autoGainControl: s?.autoGainControl ?? null,
          deviceId: undefined,
          groupId: undefined,
        },
        recordedRate: cap.audioContext.sampleRate,
        actualSettingsRaw: {
          sampleRate: s?.sampleRate ?? null,
          channelCount: s?.channelCount ?? null,
        },
      });
    }
  }

  async stop(): Promise<void> {
    // stop() só tem efeito durante a gravação; fora dela é no-op.
    if (!this.recording || !this.recorder || !this.capture) return;

    const gen = this.gen;
    const stopWallMs = Date.now();
    const recordingWallTimeMs = this.recordingStartMs != null ? stopWallMs - this.recordingStartMs : 0;
    // Capturar estados antes de cleanup para diagnóstico
    const preCleanupState = this.capture?.audioContext?.state ?? 'unknown';
    const preCleanupRate = this.capture?.audioContext?.sampleRate ?? 16000;
    const preSettings: any = (this.capture?.actualSettings as any) ?? {};
    const chunksEst = 0; // não exposto pelo recorder; derivado de pcm.length
    // PCM é capturado na taxa real do AudioContext (ex: 48 kHz no dispositivo).
    const recordedRate = this.capture?.audioContext?.sampleRate || 16000;
    let pcm: Float32Array;
    let postCleanupState: string = 'unknown';
    try {
      pcm = this.recorder.stop();
    } finally {
      this.recorder = null;
      this.recording = false;
      this.recordingStartMs = null;
      if (this.capture) {
        try { this.capture.cleanup(); } catch {}
        try { postCleanupState = (this.capture as any)?.audioContext?.state ?? 'closed'; } catch { postCleanupState = 'closed'; }
        this.capture = null;
      }
    }
    if (isVoiceDebugEnabled()) {
      const expectedSamples = Math.round((recordingWallTimeMs * recordedRate) / 1000);
      const actualSamples = pcm.length;
      const sampleCoverageRatio = expectedSamples > 0 ? Number((actualSamples / expectedSamples).toFixed(3)) : 0;
      const pcmDurationMs = recordedRate > 0 ? Math.round((actualSamples / recordedRate) * 1000) : 0;
      const pcmStats = computePcmStats(pcm, recordedRate);
      const distribution = computeWindowDistribution(pcm, recordedRate);
      voiceDebugLog('CAPTURE_STOP', {
        gen,
        engineState: this.engineState,
        recordingWallTimeMs,
        audioContextStateBefore: preCleanupState,
        audioContextStateAfter: postCleanupState,
        audioContextSampleRate: preCleanupRate,
        trackSettings: {
          sampleRate: preSettings?.sampleRate ?? null,
          channelCount: preSettings?.channelCount ?? null,
          echoCancellation: preSettings?.echoCancellation ?? null,
          noiseSuppression: preSettings?.noiseSuppression ?? null,
          autoGainControl: preSettings?.autoGainControl ?? null,
        },
        chunksLengthEstimated: Math.ceil(actualSamples / 4096),
        chunksEst,
        totalPcmSamples: actualSamples,
        recordedRate,
        pcmDurationMs,
        expectedSamples,
        actualSamples,
        sampleCoverageRatio,
        pcmDurationOverWall: recordingWallTimeMs > 0 ? Number((pcmDurationMs / recordingWallTimeMs).toFixed(3)) : 0,
        pcmStats,
        windowDistribution: distribution,
      });
    }
    if (gen !== this.gen || !this.engine) {
      if (isVoiceDebugEnabled()) {
        voiceDebugLog('LIFECYCLE_ABORT', {
          reason: !this.engine ? 'no-engine' : 'gen-changed',
          genBefore: gen,
          genAfter: this.gen,
          engineState: this.engineState,
        });
      }
      return;
    }

    const sampleRate = 16000;
    const pcm16k = recordedRate === sampleRate ? pcm : resampleTo16k(pcm, recordedRate, sampleRate);
    if (isVoiceDebugEnabled()) {
      const pcmStats16 = computePcmStats(pcm16k, sampleRate);
      voiceDebugLog('PCM_16K', {
        gen,
        inputSamples: pcm.length,
        inputRate: recordedRate,
        inputDurationMs: recordedRate > 0 ? Math.round((pcm.length / recordedRate) * 1000) : 0,
        outputSamples: pcm16k.length,
        outputRate: sampleRate,
        outputDurationMs: Math.round((pcm16k.length / sampleRate) * 1000),
        pcmStats16,
      });
    }

    // Transcrição vazia (usuário parou sem falar) — não envia nada, mantém engine pronta.
    if (pcm16k.length === 0) {
      if (isVoiceDebugEnabled()) {
        voiceDebugLog('LIFECYCLE_EMPTY', { gen, engineState: this.engineState, pcm16kLength: pcm16k.length });
      }
      this.engineState = engineStateReducer(this.engineState, { type: 'TRANSCRIBE_SUCCESS' });
      this.setStatus('result');
      this.fail({ code: 'empty', userMessage: 'Nenhuma fala detectada. Aproxime-se do microfone e tente novamente.' });
      return;
    }

    this.transcribing = true;
    this.engineState = engineStateReducer(this.engineState, { type: 'TRANSCRIBE_START' });
    this.setStatus('transcribing');
    if (isVoiceDebugEnabled()) {
      voiceDebugLog('TRANSCRIBE_START', {
        gen,
        engineId: this.engine?.id ?? 'vosk-pt-br',
        engineState: this.engineState,
        pcm16kSamples: pcm16k.length,
        pcm16kDurationMs: Math.round((pcm16k.length / sampleRate) * 1000),
        sampleRate,
      });
    }
    const transcribeStartMs = Date.now();
    try {
      const res = await this.engine.transcribe(pcm16k, sampleRate);
      const transcribeEndMs = Date.now();
      if (gen !== this.gen) {
        if (isVoiceDebugEnabled()) {
          voiceDebugLog('LIFECYCLE_DISCARD', {
            reason: 'gen-changed-after-transcribe',
            genBefore: gen,
            genAfter: this.gen,
            inferenceMs: transcribeEndMs - transcribeStartMs,
            engineState: this.engineState,
          });
        }
        return;
      }
      const text = (res?.text || '').trim();
      const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
      if (isVoiceDebugEnabled()) {
        voiceDebugLog('TRANSCRIBE_END', {
          gen,
          engineState: this.engineState,
          inferenceMs: transcribeEndMs - transcribeStartMs,
          transcriptionLength: text.length,
          wordCount,
          empty: text.length === 0,
          // texto só em debug local, nunca enviado
          textPreview: text.slice(0, 80),
        });
      }
      this.transcribing = false;
      this.engineState = engineStateReducer(this.engineState, { type: 'TRANSCRIBE_SUCCESS' });
      this.setStatus('result');
      if (text) {
        this.opts.onTranscript?.(text);
        if (isVoiceDebugEnabled()) voiceDebugLog('LIFECYCLE_DELIVERED', { gen, wordCount, engineState: this.engineState });
      } else {
        this.fail({ code: 'empty', userMessage: 'Nenhuma fala detectada. Aproxime-se do microfone e tente novamente.' });
      }
    } catch (e: any) {
      if (gen !== this.gen) {
        if (isVoiceDebugEnabled()) {
          voiceDebugLog('LIFECYCLE_DISCARD', {
            reason: 'gen-changed-on-error',
            genBefore: gen,
            genAfter: this.gen,
            engineState: this.engineState,
          });
        }
        return;
      }
      this.transcribing = false;
      this.engineState = engineStateReducer(this.engineState, { type: 'TRANSCRIBE_ERROR' });
      if (isVoiceDebugEnabled()) {
        voiceDebugLog('TRANSCRIBE_ERROR', {
          gen,
          engineState: this.engineState,
          detail: e instanceof Error ? e.message : String(e),
        });
      }
      this.fail({
        code: 'transcribe_failed',
        userMessage: 'Erro ao transcrever o áudio. Tente novamente.',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  cancel(): void {
    // Aborta a sessão atual (gravação ou load em andamento) sem transcrever.
    const prevGen = this.gen;
    this.gen++;
    if (isVoiceDebugEnabled()) {
      voiceDebugLog('LIFECYCLE_CANCEL', {
        prevGen,
        newGen: this.gen,
        engineState: this.engineState,
        wasRecording: this.recording,
        wasLoading: this.loading,
      });
    }
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
    this.recordingStartMs = null;
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
    const prevGen = this.gen;
    this.gen++;
    if (isVoiceDebugEnabled()) {
      voiceDebugLog('LIFECYCLE_DISPOSE', {
        prevGen,
        newGen: this.gen,
        engineState: this.engineState,
        wasRecording: this.recording,
        wasTranscribing: this.transcribing,
      });
    }
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
    this.recordingStartMs = null;
    try { await this.engine?.dispose?.(); } catch {}
    this.engineState = INITIAL_ENGINE_STATE;
    this.setStatus('idle');
  }

  private captureFn(): Promise<CaptureResult> {
    return this.opts.capture ? this.opts.capture(16000) : captureAudio(16000);
  }
}