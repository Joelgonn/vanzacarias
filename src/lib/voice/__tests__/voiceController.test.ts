import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceInputController } from '../voiceController';
import type { VoiceStatus, VoiceInputError } from '../voiceController';
import { CaptureError } from '../audio/capture';
import type { PcmRecorder } from '../audio/capture';
import type { STTEngine } from '../stt/registry';

function makeEngine(overrides: Partial<STTEngine> = {}): STTEngine {
  return {
    id: 'vosk-pt-br',
    name: 'Vosk PT-BR',
    language: 'pt-BR',
    model: 'vosk-model-small-pt-0.3',
    load: vi.fn().mockResolvedValue(undefined),
    transcribe: vi.fn().mockResolvedValue({ text: 'oi tudo bem' }),
    dispose: vi.fn().mockResolvedValue(undefined),
    isSupported: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

function makeCapture(overrides: Record<string, any> = {}) {
  return {
    stream: { getTracks: () => [] } as any,
    audioContext: { sampleRate: 16000 } as any,
    actualSettings: {},
    sampleRate: 16000,
    cleanup: vi.fn(),
    ...overrides,
  };
}

function setup(options: {
  engine?: STTEngine;
  pcm?: Float32Array;
  captureError?: Error;
  checkSupport?: boolean;
} = {}) {
  const engine = options.engine ?? makeEngine();
  const capture = vi.fn();
  const capturedResult = makeCapture();
  if (options.captureError) capture.mockRejectedValue(options.captureError);
  else capture.mockResolvedValue(capturedResult);

  const recorder: PcmRecorder = {
    start: vi.fn(),
    stop: vi.fn().mockReturnValue(options.pcm ?? new Float32Array([0.1, 0.2, 0.3])),
    cancel: vi.fn(),
    cleanup: vi.fn(),
  };
  const recorderFactory = vi.fn().mockReturnValue(recorder);

  const statuses: VoiceStatus[] = [];
  const transcripts: string[] = [];
  const errors: VoiceInputError[] = [];
  const ctrl = new VoiceInputController({
    engineId: 'vosk-pt-br',
    getEngine: () => engine,
    capture: capture as any,
    recorderFactory,
    checkSupport: options.checkSupport ?? false,
    onStatusChange: (s) => statuses.push(s),
    onTranscript: (t) => transcripts.push(t),
    onError: (e) => errors.push(e),
  });
  return { engine, capture, capturedResult, recorder, recorderFactory, ctrl, statuses, transcripts, errors };
}

describe('VOZ-006 — VoiceInputController', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('1. idle → recording: start adquire mic, carrega engine e inicia gravação', async () => {
    const { ctrl, engine, capture, recorder, statuses } = setup();
    const status0 = ctrl.getStatus();
    await ctrl.start();
    expect(status0).toBe('idle');
    expect(capture).toHaveBeenCalledWith(16000);
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(ctrl.getStatus()).toBe('recording');
    expect(statuses).toContain('recording');
  });

  it('2. recording → transcribing → result: stop transcreve e entrega texto', async () => {
    const { ctrl, engine, recorder, transcripts } = setup();
    await ctrl.start();
    await ctrl.stop();
    // PCM foi capturado em 16000 (sem resample) e enviado como Float32Array.
    expect(engine.transcribe).toHaveBeenCalledWith(expect.any(Float32Array), 16000);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(ctrl.getStatus()).toBe('result');
    expect(transcripts).toEqual(['oi tudo bem']);
  });

  it('3. cancel: descarta sem transcrever e libera mic', async () => {
    const { ctrl, engine, recorder, capture, transcripts } = setup();
    await ctrl.start();
    ctrl.cancel();
    expect(recorder.cancel).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(engine.transcribe).not.toHaveBeenCalled();
    expect(transcripts).toEqual([]);
  });

  it('4. cancel após gravação: stop() posterior é no-op e não transcreve', async () => {
    const { ctrl, engine } = setup();
    await ctrl.start();
    ctrl.cancel();
    await ctrl.stop();
    expect(engine.transcribe).not.toHaveBeenCalled();
  });

  it('5. erro de permissão: capture rejeitado mapeado para permission_denied', async () => {
    const { ctrl, errors } = setup({
      captureError: new CaptureError('permission_denied', 'negada'),
    });
    await ctrl.start();
    expect(ctrl.getStatus()).toBe('error');
    expect(errors[0]?.code).toBe('permission_denied');
    expect(errors[0]?.userMessage).toContain('Permissão');
  });

  it('6. erro de ausência de microfone: not_found', async () => {
    const { ctrl, errors } = setup({
      captureError: new CaptureError('not-found', 'sem dispositivo'),
    });
    await ctrl.start();
    expect(errors[0]?.code).toBe('not_found');
  });

  it('7. duplicate start: segunda chamada não duplica load nem gravação', async () => {
    const { ctrl, engine, recorder } = setup();
    await ctrl.start();
    // Sem await: dupla execução concorrente.
    void ctrl.start();
    void ctrl.start();
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(recorder.start).toHaveBeenCalledTimes(1);
  });

  it('8. cleanup/dispose: libera mic, recorder e engine', async () => {
    const { ctrl, engine, recorder, capturedResult } = setup();
    await ctrl.start();
    await ctrl.dispose();
    expect(recorder.cancel).toHaveBeenCalledTimes(1);
    expect(capturedResult.cleanup).toHaveBeenCalledTimes(1);
    expect(engine.dispose).toHaveBeenCalledTimes(1);
    expect(ctrl.getStatus()).toBe('idle');
  });

  it('9. transcript chega via callback (ChatAssistant injeta no input) — sem auto-send', async () => {
    const { ctrl, engine, transcripts, errors } = setup();
    await ctrl.start();
    await ctrl.stop();
    expect(transcripts).toEqual(['oi tudo bem']);
    // Sem nenhuma chamada de rede/API do chat nesta camada.
    expect(engine.transcribe).toHaveBeenCalledTimes(1);
    expect(errors).toEqual([]);
  });

  it('10. transcrição vazia: erro do tipo empty e nenhum transcript', async () => {
    const { ctrl, engine, transcripts, errors } = setup({
      pcm: new Float32Array(0),
    });
    await ctrl.start();
    await ctrl.stop();
    expect(engine.transcribe).not.toHaveBeenCalled();
    expect(transcripts).toEqual([]);
    expect(errors[0]?.code).toBe('empty');
  });

  it('11. PCM capturado a 48 kHz é reamostrado para 16 kHz antes de transcrever', async () => {
    // Se capture devolver audioContext.sampleRate 48000, o resample deve ocorrer.
    const engine = makeEngine();
    const capture = vi.fn().mockResolvedValue(makeCapture({ audioContext: { sampleRate: 48000 }, sampleRate: 48000 }));
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array(48000).fill(0.5)),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const ctrl = new VoiceInputController({
      engineId: 'vosk-pt-br',
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
    });
    await ctrl.start();
    await ctrl.stop();
    const [pcm, rate] = (engine.transcribe as ReturnType<typeof vi.fn>).mock.calls[0] as [Float32Array, number];
    expect(rate).toBe(16000);
    // 48000 amostras a 48k → 16000 amostras a 16k.
    expect(pcm.length).toBe(16000);
  });

  it('12. segunda transcrição reutiliza engine READY (load não é repetido)', async () => {
    const { ctrl, engine, recorder } = setup();
    await ctrl.start();
    await ctrl.stop();
    await ctrl.start();
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(recorder.start).toHaveBeenCalledTimes(2);
  });

  it('13. erro de engine: transcribe rejeitado → transcribe_failed e estado error', async () => {
    const engine = makeEngine({
      transcribe: vi.fn().mockRejectedValue(new Error('Vosk INFERENCE_ERROR')),
    });
    const { ctrl, errors } = setup({ engine });
    await ctrl.start();
    await ctrl.stop();
    expect(ctrl.getStatus()).toBe('error');
    expect(errors[0]?.code).toBe('transcribe_failed');
  });

  it('14. engine não encontrada no registry → load_failed', async () => {
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const ctrl = new VoiceInputController({
      engineId: 'inexistente',
      getEngine: () => undefined,
      capture: capture as any,
      checkSupport: false,
    });
    await ctrl.start();
    expect(ctrl.getStatus()).toBe('error');
  });

  it('15. unsupported: checkSupport ligado e engine sem isSupported → erro', async () => {
    const engine = makeEngine({ isSupported: () => false });
    const capture = vi.fn().mockResolvedValue(makeCapture());
    const ctrl = new VoiceInputController({
      engineId: 'vosk-pt-br',
      getEngine: () => engine,
      capture: capture as any,
      checkSupport: true,
    });
    await ctrl.start();
    expect(capture).not.toHaveBeenCalled();
  });

  // VOZ-008.5 — AudioContext resume
  it('16. AudioContext já running: não chama resume e captura normalmente', async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    const audioContext = { sampleRate: 16000, state: 'running', resume } as any;
    const cap = makeCapture({ audioContext, sampleRate: 16000 });
    const capture = vi.fn().mockResolvedValue(cap);
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1, 0.2])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const engine = makeEngine();
    const ctrl = new VoiceInputController({
      engineId: 'vosk-pt-br',
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
    });
    await ctrl.start();
    expect(resume).not.toHaveBeenCalled();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(ctrl.getStatus()).toBe('recording');
  });

  it('17. AudioContext suspended: resume é chamado e captura continua quando passa a running', async () => {
    const resume = vi.fn().mockImplementation(async function (this: any) {
      this.state = 'running';
    });
    const audioContext: any = { sampleRate: 16000, state: 'suspended', resume };
    // bind this para que resume altere state
    audioContext.resume = resume.bind(audioContext);
    const cap = makeCapture({ audioContext, sampleRate: 16000 });
    const capture = vi.fn().mockResolvedValue(cap);
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1, 0.2])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const engine = makeEngine();
    const ctrl = new VoiceInputController({
      engineId: 'vosk-pt-br',
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
    });
    await ctrl.start();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(ctrl.getStatus()).toBe('recording');
  });

  it('18. AudioContext suspended e resume falha: captura falha sem enviar áudio ao Vosk', async () => {
    const resume = vi.fn().mockRejectedValue(new Error('resume failed'));
    const audioContext = { sampleRate: 16000, state: 'suspended', resume } as any;
    const cap = makeCapture({ audioContext, sampleRate: 16000, cleanup: vi.fn() });
    const capture = vi.fn().mockResolvedValue(cap);
    const recorder: PcmRecorder = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValue(new Float32Array([0.1])),
      cancel: vi.fn(),
      cleanup: vi.fn(),
    };
    const engine = makeEngine();
    const errors: VoiceInputError[] = [];
    const ctrl = new VoiceInputController({
      engineId: 'vosk-pt-br',
      getEngine: () => engine,
      capture: capture as any,
      recorderFactory: () => recorder,
      checkSupport: false,
      onError: (e) => errors.push(e),
    });
    await ctrl.start();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(recorder.start).not.toHaveBeenCalled();
    expect(engine.transcribe).not.toHaveBeenCalled();
    expect(ctrl.getStatus()).toBe('error');
    expect(errors.length).toBe(1);
  });
});