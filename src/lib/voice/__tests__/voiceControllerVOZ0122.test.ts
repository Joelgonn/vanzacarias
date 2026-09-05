import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceInputController } from '../voiceController';
import type { PcmRecorder } from '../audio/capture';
import type { STTEngine } from '../stt/registry';

// VOZ-012.2 — Fluidez da gravação: cronômetro (limite), estados e gravações
// consecutivas testados na camada do controller (testável em node, sem DOM).

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

function makeRecorder(): PcmRecorder {
  return {
    start: vi.fn(),
    stop: vi.fn().mockReturnValue(new Float32Array([0.1, 0.2, 0.3])),
    cancel: vi.fn(),
    cleanup: vi.fn(),
  };
}

async function flush(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

describe('VOZ-012.2 — Controller: estados e cronômetro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('T1 — FALAR inicia GRAVANDO e arma o timer do limite (somente ao gravar)', async () => {
    const engine = makeEngine();
    const statuses: string[] = [];
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: vi.fn().mockResolvedValue(makeCapture()) as any,
      recorderFactory: () => makeRecorder() as any,
      checkSupport: false,
      onStatusChange: (s) => statuses.push(s),
    });
    const startPromise = ctrl.start();
    await flush();
    expect(ctrl.getStatus()).toBe('recording');
    expect(statuses).toContain('recording');
    expect((ctrl as any).recordingLimitTimer).not.toBeNull();
    await startPromise;
  });

  it('T3/T5 — PARAR encerra e emite PROCESSANDO → TRANSCRIBENDO (não conta fora de recording)', async () => {
    const engine = makeEngine();
    const statuses: string[] = [];
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: vi.fn().mockResolvedValue(makeCapture()) as any,
      recorderFactory: () => makeRecorder() as any,
      checkSupport: false,
      onStatusChange: (s) => statuses.push(s),
    });
    await ctrl.start();
    expect(ctrl.getStatus()).toBe('recording');
    expect((ctrl as any).recordingLimitTimer).not.toBeNull();

    const p = ctrl.stop();
    await flush();
    await p;

    const procIdx = statuses.indexOf('processing');
    const transIdx = statuses.indexOf('transcribing');
    expect(procIdx).toBeGreaterThanOrEqual(0);
    expect(transIdx).toBeGreaterThan(procIdx);
    expect(statuses[statuses.length - 1]).toBe('result');
    // PARAR limpa o timer imediatamente
    expect((ctrl as any).recordingLimitTimer).toBeNull();
    expect(engine.transcribe).toHaveBeenCalledTimes(1);
  });

  it('T4 — CANCELAR encerra o cronômetro e não produz transcrição', async () => {
    const engine = makeEngine();
    const transcripts: string[] = [];
    const recorder = makeRecorder();
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: vi.fn().mockResolvedValue(makeCapture()) as any,
      recorderFactory: () => recorder as any,
      checkSupport: false,
      onTranscript: (t) => transcripts.push(t),
    });
    await ctrl.start();
    expect((ctrl as any).recordingLimitTimer).not.toBeNull();
    ctrl.cancel();
    expect((ctrl as any).recordingLimitTimer).toBeNull();
    expect(recorder.cancel).toHaveBeenCalled();
    expect(transcripts).toEqual([]);
    expect(engine.transcribe).not.toHaveBeenCalled();
    expect(['idle', 'ready', 'result'].includes(ctrl.getStatus())).toBe(true);
  });

  it('T6 — gravações consecutivas: cada nova sessão rearma o cronômetro do zero', async () => {
    const engine = makeEngine();
    const factory = vi.fn(() => makeRecorder());
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: vi.fn().mockResolvedValue(makeCapture()) as any,
      recorderFactory: factory as any,
      checkSupport: false,
    });
    for (let i = 0; i < 3; i++) {
      await ctrl.start();
      expect(ctrl.getStatus()).toBe('recording');
      expect((ctrl as any).recordingLimitTimer).not.toBeNull();
      await ctrl.stop();
      expect((ctrl as any).recordingLimitTimer).toBeNull();
      expect(ctrl.getStatus()).toBe('result');
    }
    expect(engine.load).toHaveBeenCalledTimes(1);
  });

  it('T7 — limite de 60s: encerra gravação, processa o áudio, informa e não duplica', async () => {
    const engine = makeEngine();
    const transcripts: string[] = [];
    const errors: any[] = [];
    const ctrl = new VoiceInputController({
      getEngine: () => engine,
      capture: vi.fn().mockResolvedValue(makeCapture()) as any,
      recorderFactory: () => makeRecorder() as any,
      checkSupport: false,
      onTranscript: (t) => transcripts.push(t),
      onError: (e) => errors.push(e),
    });
    const startPromise = ctrl.start();
    await flush();
    expect(ctrl.getStatus()).toBe('recording');
    expect((ctrl as any).recordingLimitTimer).not.toBeNull();

    // 45s: ainda gravando (sem efeito)
    await vi.advanceTimersByTimeAsync(45_000);
    expect(ctrl.getStatus()).toBe('recording');
    expect(engine.transcribe).not.toHaveBeenCalled();

    // 60s: o timer do limite dispara → stop() processa o áudio
    await vi.advanceTimersByTimeAsync(15_001);
    await flush();

    // áudio não descartado: transcrito exatamente 1× (sem duplicação)
    expect(engine.transcribe).toHaveBeenCalledTimes(1);
    expect(transcripts).toEqual(['transcrição teste']);
    // usuário informado
    expect(errors.some((e) => e.code === 'limit_reached')).toBe(true);
    // recursos liberados e estado final 'result'
    expect((ctrl as any).recordingLimitTimer).toBeNull();
    expect((ctrl as any).recorder).toBeNull();
    expect(ctrl.getStatus()).toBe('result');
    await startPromise;
  });
});