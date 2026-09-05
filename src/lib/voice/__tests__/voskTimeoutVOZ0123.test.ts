import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeInferenceGuardMs, transcribeWithVosk } from '../stt/vosk';

// VOZ-012.3 — F02: guard de inferência proporcional à duração do áudio.
// - Cálculo determinístico (T1/T2/T3/T6) via computeInferenceGuardMs.
// - Comportamento (T4/T5) do guard real em `transcribeWithVosk`.

const SAMPLE_RATE = 16000;
// para construirm Float32Array com N segundos: length = N * 16000
function sec(n: number): Float32Array {
  return new Float32Array(Math.round(n * SAMPLE_RATE));
}

// ── Regressões estáticas da acumulação F01 (VOZ-012.1) e do guard ──
// (estas já são cobertas por voskChunk.test.ts / voskAccumulation.test.ts;
//  mantemos aqui apenas referência pontual para a regressão da sprint.)

type Msg = { event: string; result: { text?: string; partial?: string } };

describe('VOZ-012.3 — T1/T2/T3: guard proporcional básico', () => {
  it('calcula o guard (30s base + k×duração) para 2s de áudio', () => {
    const g = computeInferenceGuardMs(2000);
    expect(g).toBe(30_000 + 4 * 2000); // 38000
    expect(g).toBeGreaterThan(30_000); // não reduzido abaixo da margem mínima
  });

  it('10s de áudio → crescimento proporcional (maior que 2s)', () => {
    const g2s = computeInferenceGuardMs(2000);
    const g10s = computeInferenceGuardMs(10_000);
    expect(g10s).toBe(30_000 + 4 * 10_000); // 70000
    expect(g10s).toBeGreaterThan(g2s);
    expect(g10s - g2s).toBe(4 * 8000); // delta = k×deltaDuration
  });

  it('30s de áudio → guard maior que de gravação curta', () => {
    const gShort = computeInferenceGuardMs(2000);
    const gLong = computeInferenceGuardMs(30_000);
    expect(gLong).toBe(30_000 + 4 * 30_000); // 150000
    expect(gLong).toBeGreaterThan(gShort);
    expect(gLong).toBeGreaterThan(150_000 - 1);
  });
});

describe('VOZ-012.3 — T6: duração inválida (comportamento seguro/determinístico)', () => {
  it('0 s → apenas a margem base (30s)', () => {
    expect(computeInferenceGuardMs(0)).toBe(30_000);
  });

  it('duração negativa → margem base (sem timeout negativo/zero)', () => {
    expect(computeInferenceGuardMs(-5000)).toBe(30_000);
    expect(computeInferenceGuardMs(-1)).toBe(30_000);
  });

  it('NaN → margem base', () => {
    expect(computeInferenceGuardMs(Number.NaN)).toBe(30_000);
  });

  it('Infinity → margem base (não Infinity)', () => {
    expect(computeInferenceGuardMs(Number.POSITIVE_INFINITY)).toBe(30_000);
  });

  it('valor ausente (undefined) → margem base', () => {
    expect(computeInferenceGuardMs(undefined as unknown as number)).toBe(30_000);
  });
});

// ── Helpers de mock reconhecedor ──
function buildRecognizerMock(opts: { chunks: number; respond: boolean }) {
  const { chunks, respond } = opts;
  let resultCb: ((m: Msg) => void) | null = null;
  let partialCb: ((m: Msg) => void) | null = null;
  let processed = 0;
  const on = vi.fn((ev: string, cb: any) => {
    if (ev === 'result') resultCb = cb;
    if (ev === 'partialresult') partialCb = cb;
  });
  const acceptWaveformFloat = vi.fn(() => {
    processed++;
    if (respond) partialCb?.({ event: 'partialresult', result: { partial: '' } });
  });
  const retrieveFinalResult = vi.fn(() => {
    if (respond) resultCb?.({ event: 'result', result: { text: 'frase teste' } });
    // se não responde: worker traveado — nada é emitido
  });
  const remove = vi.fn();
  return {
    on,
    acceptWaveformFloat,
    retrieveFinalResult,
    remove,
    get processed() {
      return processed;
    },
  };
}

function makeMockModel(recognizer: ReturnType<typeof buildRecognizerMock>) {
  const MockKaldi = vi.fn(function (this: any, _sr: number) {
    this.on = recognizer.on;
    this.acceptWaveformFloat = recognizer.acceptWaveformFloat;
    this.retrieveFinalResult = recognizer.retrieveFinalResult;
    this.remove = recognizer.remove;
    return recognizer;
  });
  return { KaldiRecognizer: MockKaldi } as any;
}

describe('VOZ-012.3 — T4: inferência dentro do limite responde normalmente', () => {
  it('worker responde antes do guard → resultado correto, sem erro de timeout', async () => {
    const recognizer = buildRecognizerMock({ chunks: Math.ceil(sec(2).length / 4096), respond: true });
    const result = await transcribeWithVosk(sec(2), SAMPLE_RATE, makeMockModel(recognizer));
    expect(result).toBe('frase teste');
    expect(recognizer.retrieveFinalResult).toHaveBeenCalledTimes(1);
  });
});

describe('VOZ-012.3 — T5: worker preso → timeout → erro controlado → cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('rejeita com erro de timeout, remapeia cleanup e não deixa promise pendente', async () => {
    // 10s de áudio → guard proporcional = 30s + 4×10s = 70s
    const recognizer = buildRecognizerMock({ chunks: Math.ceil(sec(10).length / 4096), respond: false });
    const promise = transcribeWithVosk(sec(10), SAMPLE_RATE, makeMockModel(recognizer));
    // anexa o handler ANTES de avançar os timers — evita janela de unhandled rejection
    const assertion = expect(promise).rejects.toThrow(/INFERENCE_TIMEOUT/);

    // avança além do guard proporcional (70s) → dispara
    await vi.advanceTimersByTimeAsync(70_001);
    await assertion;
    expect(recognizer.retrieveFinalResult).toHaveBeenCalledTimes(1); // janela enviada
    expect(recognizer.remove).toHaveBeenCalled(); // cleanup (remove() do recognizer)
  });

  it('não dispara antes do guard proporcional (10s → 70s)', async () => {
    const recognizer = buildRecognizerMock({ chunks: Math.ceil(sec(10).length / 4096), respond: false });
    let settled = false;
    const promise = transcribeWithVosk(sec(10), SAMPLE_RATE, makeMockModel(recognizer)).then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );
    await vi.advanceTimersByTimeAsync(69_000);
    expect(settled).toBe(false); // ainda dentro do limite proporcional
    // liberar para não deixar timers pendentes
    await vi.advanceTimersByTimeAsync(1_001);
    await promise;
  });
});