import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceInputController } from '../voiceController';
import type { PcmRecorder } from '../audio/capture';
import type { STTEngine } from '../stt/registry';

function makeEngine(): STTEngine {
  return {
    id: 'vosk-pt-br',
    name: 'Vosk PT-BR',
    language: 'pt-BR',
    model: 'vosk-model-small-pt-0.3',
    load: vi.fn().mockResolvedValue(undefined),
    transcribe: vi.fn().mockResolvedValue({ text: 'transcrição teste' }),
    dispose: vi.fn().mockResolvedValue(undefined),
    isSupported: vi.fn().mockReturnValue(true),
  };
}

function makeCapture() {
  return {
    stream: { getTracks: () => [] } as any,
    audioContext: { sampleRate: 16000, state: 'running', resume: vi.fn().mockResolvedValue(undefined) } as any,
    actualSettings: {},
    sampleRate: 16000,
    cleanup: vi.fn(),
  };
}

describe('VOZ-012 — Ciclo de vida / Robustez', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transição imediata de estado: start() mostra recording antes de carregar engine', async () => {
    let resolveLoad!: () => void;
    const engine = makeEngine();
    engine.load = vi.fn(() => new Promise<void>((res) => { resolveLoad = res; }));
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const statuses: string[] = [];
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
      onStatusChange: (s) => statuses.push(s),
    });
    const startPromise = ctrl.start();
    // Deixa a captura (already-resolved) concluir: gravação inicia antes do load do engine
    await Promise.resolve();
    // Imediatamente: 'recording' (sem esperar load do engine)
    expect(ctrl.getStatus()).toBe('recording');
    expect(recorder.start).toHaveBeenCalled();
    expect(statuses).toContain('recording');
    resolveLoad();
    await startPromise;
  });

  it('gravação única: GRAVAR → PARAR → resultado sem acúmulo', async () => {
    const engine = makeEngine();
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1, 0.2])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
    });
    await ctrl.start();
    expect(ctrl.getStatus()).toBe('recording');
    await ctrl.stop();
    expect(ctrl.getStatus()).toBe('result');
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    // Nenhum recurso deve permanecer ativo
    expect((ctrl as any).recorder).toBeNull();
    expect((ctrl as any).capture).toBeNull();
  });

  it('segunda gravação: GRAVAR → PARAR → GRAVAR NOVAMENTE → PARAR (sem reload)', async () => {
    const engine = makeEngine();
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const recorder1: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const recorder2: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.2])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    let callCount = 0;
    const factory = vi.fn(() => (callCount++ === 0 ? recorder1 : recorder2));
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: factory as any,
      checkSupport: false,
    });
    await ctrl.start();
    await ctrl.stop();
    expect(engine.load).toHaveBeenCalledTimes(1);
    await ctrl.start();
    await ctrl.stop();
    // Segunda gravação deve reutilizar engine READY (load não repetido)
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(factory.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(['result', 'ready'].includes(ctrl.getStatus())).toBe(true);
  });

  it('terceira gravação consecutiva sem acúmulo', async () => {
    const engine = makeEngine();
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const mkRecorder = () => ({
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    } as PcmRecorder);
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: mkRecorder as any,
      checkSupport: false,
    });
    for (let i = 0; i < 3; i++) {
      await ctrl.start();
      await ctrl.stop();
      expect(ctrl.getStatus()).toBe('result');
    }
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(3);
  });

  it('cancelamento: GRAVAR → CANCELAR → nenhuma transcrição, estado idle, nova gravação funciona', async () => {
    const engine = makeEngine();
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const transcripts: string[] = [];
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
      onTranscript: (t) => transcripts.push(t),
    });
    await ctrl.start();
    ctrl.cancel();
    expect(recorder.cancel).toHaveBeenCalled();
    expect(transcripts).toEqual([]);
    expect(['idle', 'ready', 'result'].includes(ctrl.getStatus())).toBe(true);
    // Nova gravação após cancel
    const recorder2: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.3])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    (ctrl as any).opts.recorderFactory = () => recorder2;
    await ctrl.start();
    expect(ctrl.getStatus()).toBe('recording');
    await ctrl.stop();
    expect(transcripts).toEqual(['transcrição teste']);
  });

  it('cleanup libera MediaStream, AudioContext, ScriptProcessor, recognizer, timers', async () => {
    const engine = makeEngine();
    const cleanup = vi.fn();
    const captureResult = { ...makeCapture(), cleanup };
    const capture = vi.fn().mockResolvedValue(captureResult);
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
    });
    await ctrl.start();
    await ctrl.stop();
    // Após stop, capture e recorder devem ser nulled
    expect((ctrl as any).capture).toBeNull();
    expect((ctrl as any).recorder).toBeNull();
    expect(cleanup).toHaveBeenCalled();
    // Após dispose, engine dispose chamado
    await ctrl.dispose();
    expect(engine.dispose).toHaveBeenCalled();
    expect(ctrl.getStatus()).toBe('idle');
  });

  it('permissão negada não deixa estado preso', async () => {
    const { CaptureError } = await import('../audio/capture');
    const capture = vi.fn().mockRejectedValue(new CaptureError('permission_denied', 'negada'));
    const errors: any[] = [];
    const ctrl = new VoiceInputController({
      getEngine: () => makeEngine(),
      capture: capture as any,
      checkSupport: false,
      onError: (e) => errors.push(e),
    });
    await ctrl.start();
    expect(errors[0].code).toBe('permission_denied');
    expect(ctrl.getStatus()).toBe('error');
    // Botão deve voltar a utilizável (idle após reset)
    ctrl.reset();
    expect(ctrl.getStatus()).not.toBe('recording');
  });

  it('STOP durante load em background: aguarda engine e transcreve sem corrida', async () => {
    let resolveLoad!: () => void;
    const engine = makeEngine();
    engine.load = vi.fn(() => new Promise<void>((res) => { resolveLoad = res; }));
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1, 0.2, 0.3])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const transcripts: string[] = [];
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
      onTranscript: (t) => transcripts.push(t),
    });
    const startPromise = ctrl.start();
    // Deixa a captura (already-resolved) concluir: gravação inicia antes do load do engine
    await Promise.resolve();
    // start() já iniciou a gravação antes de carregar engine
    expect(ctrl.getStatus()).toBe('recording');
    expect(engine.load).toHaveBeenCalledTimes(1);
    // Usuário pressiona PARAR enquanto o load ainda está em voo
    const stopPromise = ctrl.stop();
    // Ainda não pode transcrever (load pendente)…
    await Promise.resolve();
    expect(engine.transcribe).not.toHaveBeenCalled();
    // Load conclui → stop() retoma e transcreve exatamente uma vez
    resolveLoad();
    await startPromise;
    await stopPromise;
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(engine.transcribe).toHaveBeenCalledTimes(1);
    expect(transcripts).toEqual(['transcrição teste']);
    expect(ctrl.getStatus()).toBe('result');
  });

  it('CANCEL durante load em background: descarta, nada transcreve e nova gravação funciona', async () => {
    let resolveLoad!: () => void;
    const engine = makeEngine();
    const loadSpy = vi.fn(() => new Promise<void>((res) => { resolveLoad = res; }));
    engine.load = loadSpy;
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const transcripts: string[] = [];
    const errors: any[] = [];
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
      onTranscript: (t) => transcripts.push(t),
      onError: (e) => errors.push(e),
    });
    const startPromise = ctrl.start();
    await Promise.resolve();
    expect(ctrl.getStatus()).toBe('recording');
    ctrl.cancel();
    expect(recorder.cancel).toHaveBeenCalled();
    expect(transcripts).toEqual([]);
    resolveLoad();
    await startPromise;
    // Não deve haver erro nem estado preso
    expect(errors).toEqual([]);
    expect(ctrl.getStatus()).not.toBe('recording');
    expect(ctrl.getStatus()).not.toBe('transcribing');
    // Nova gravação reutiliza engine (modelo já carregado no background) e funciona
    engine.load = vi.fn().mockResolvedValue(undefined);
    const recorder2: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.5])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    (ctrl as any).opts.recorderFactory = () => recorder2;
    await ctrl.start();
    expect(ctrl.getStatus()).toBe('recording');
    await ctrl.stop();
    expect(transcripts).toEqual(['transcrição teste']);
  });

  it('LOAD falha após START: erro claro, nenhum recurso preso, próxima tentativa funciona', async () => {
    const engine = makeEngine();
    const firstLoad = vi.fn().mockRejectedValue(new Error('Vosk MODEL_LOAD_FAILED'));
    engine.load = firstLoad;
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.5])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const errors: any[] = [];
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
      onError: (e) => errors.push(e),
    });
    await ctrl.start();
    expect(ctrl.getStatus()).toBe('error');
    expect(errors[0]?.code).toBe('load_failed');
    expect(recorder.cancel).toHaveBeenCalled();
    expect((ctrl as any).capture).toBeNull();
    expect((ctrl as any).recorder).toBeNull();
    // Retry: engine volta a carregar de ERROR
    const retryLoad = vi.fn().mockResolvedValue(undefined);
    engine.load = retryLoad;
    await ctrl.start();
    expect(ctrl.getStatus()).toBe('recording');
    await ctrl.stop();
    expect(firstLoad).toHaveBeenCalledTimes(1);
    expect(retryLoad).toHaveBeenCalledTimes(1);
  });
});
