import { describe, it, expect, vi } from 'vitest';
import { transcribeWithVosk } from '../stt/vosk';

/**
 * VOZ-012.1 — Testes de acúmulo de resultados finais (F01).
 *
 * O worker vosk-browser emite exatamente 1 evento (result ou partialresult) por
 * acceptWaveformFloat + 1 evento result do retrieveFinalResult. A contagem correta
 * dessas respostas determina o momento de finalização, sem hacks de timing.
 *
 * Referência do worker: vosk-worker.js processAudioChunk / retrieveFinalResult.
 */

type ResultMsg = { event: string; result: { text?: string; partial?: string } };

/**
 * Mock realista do KaldiRecognizer.
 * - Emite partialresult (AcceptWaveform false) para chunks sem endpoint.
 * - Emite result (AcceptWaveform true) para chunks com endpoint.
 * - Emite result final ao chamar retrieveFinalResult.
 *
 * @param opts.chunks - total de chunks (determina totalSamples)
 * @param opts.endpointAtChunks - índices (0-based) de chunks que emitem 'result' (endpoint)
 * @param opts.segmentTexts - texto de cada 'result' (intermediários + final).
 *                            Deve ter length === endpointAtChunks.length + 1.
 *                            O último é o texto do retrieveFinalResult.
 */
function buildRecognizerMock(opts: {
  chunks: number;
  endpointAtChunks?: number[];
  segmentTexts: string[];
}) {
  const { chunks, endpointAtChunks = [], segmentTexts } = opts;
  const intermediateTexts = segmentTexts.slice(0, -1);
  const finalText = segmentTexts[segmentTexts.length - 1] ?? '';
  let resultCb: ((msg: ResultMsg) => void) | null = null;
  let partialCb: ((msg: ResultMsg) => void) | null = null;

  const on = vi.fn((event: string, cb: any) => {
    if (event === 'result') resultCb = cb;
    if (event === 'partialresult') partialCb = cb;
  });

  // Cada endpoint (AcceptWaveform → true) emite UM 'result' com o texto do
  // segmento finalizado naquela hora (equivalente a Result() no Kaldi).
  // Índice do endpoint dentro da lista => texto correspondente.
  const targetChunks = [...endpointAtChunks].sort((a, b) => a - b);
  let processedChunks = 0;

  const acceptWaveformFloat = vi.fn((_chunk: Float32Array, _sampleRate: number) => {
    const chunkIndex = processedChunks;
    processedChunks++;
    const epIdx = targetChunks.indexOf(chunkIndex);
    if (epIdx !== -1) {
      resultCb?.({ event: 'result', result: { text: intermediateTexts[epIdx] ?? '' } });
    } else {
      partialCb?.({ event: 'partialresult', result: { partial: '' } });
    }
  });

  const retrieveFinalResult = vi.fn(() => {
    resultCb?.({ event: 'result', result: { text: finalText } });
  });

  const remove = vi.fn();

  return { on, acceptWaveformFloat, retrieveFinalResult, remove };
}

function makeMockModel(recognizer: ReturnType<typeof buildRecognizerMock>) {
  const MockKaldi = vi.fn(function (this: any, _sampleRate: number) {
    this.on = recognizer.on;
    this.acceptWaveformFloat = recognizer.acceptWaveformFloat;
    this.retrieveFinalResult = recognizer.retrieveFinalResult;
    this.remove = recognizer.remove;
    return recognizer;
  });
  return { KaldiRecognizer: MockKaldi } as any;
}

// ───────────────────────────────────────────────────────────────────────────────
// Teste A — múltiplos resultados (frase com pausa interna)
// ───────────────────────────────────────────────────────────────────────────────
describe('VOZ-012.1 — Teste A: múltiplos resultados', () => {
  it('concatena segmentos de endpoint intermediário + retrieve final, na ordem correta', async () => {
    // 5 chunks; endpoint no chunk 1 (palavras iniciais) e no retrieve (resto).
    // Em termos de Kaldi: Result() no endpoint → segmento A; FinalResult() → segmento B.
    const recognizer = buildRecognizerMock({
      chunks: 5,
      endpointAtChunks: [1],
      segmentTexts: [
        'quero alterar minha dieta',   // resultado do endpoint chunk 1
        'porque estou sentindo muita fome', // resultado do retrieveFinalResult
      ],
    });
    const pcm = new Float32Array(5 * 4096);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('quero alterar minha dieta porque estou sentindo muita fome');
    expect(recognizer.acceptWaveformFloat).toHaveBeenCalledTimes(5);
    expect(recognizer.retrieveFinalResult).toHaveBeenCalledTimes(1);
  });

  it('preserva segmentos quando há dois endpoints intermediários', async () => {
    const recognizer = buildRecognizerMock({
      chunks: 8,
      endpointAtChunks: [2, 5],
      segmentTexts: [
        'primeiro segmento',
        'segundo segmento',
        'terceiro segmento final',
      ],
    });
    const pcm = new Float32Array(8 * 4096);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('primeiro segmento segundo segmento terceiro segmento final');
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Teste B — partialresult não contamina o resultado final
// ───────────────────────────────────────────────────────────────────────────────
describe('VOZ-012.1 — Teste B: partialresult não contamina', () => {
  it('texto parcial não aparece na transcrição final', async () => {
    let resultCb: ((msg: ResultMsg) => void) | null = null;
    let partialCb: ((msg: ResultMsg) => void) | null = null;
    const on = vi.fn((event: string, cb: any) => {
      if (event === 'result') resultCb = cb;
      if (event === 'partialresult') partialCb = cb;
    });

    // 3 chunks: todos parciais, nenhum endpoint intermediário.
    const partialTexts: string[] = [];
    const acceptWaveformFloat = vi.fn(() => {
      partialCb?.({ event: 'partialresult', result: { partial: 'texto parcial intermediário' } });
    });

    const retrieveFinalResult = vi.fn(() => {
      resultCb?.({ event: 'result', result: { text: 'resultado final limpo' } });
    });

    const recognizer = { on, acceptWaveformFloat, retrieveFinalResult, remove: vi.fn() };
    const pcm = new Float32Array(3 * 4096);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    // Nenhum partial deve contaminar
    expect(result).not.toContain('parcial');
    expect(result).not.toContain('intermediário');
    expect(result).toBe('resultado final limpo');
  });

  it('parciais não duplicam texto quando há endpoint intermediário', async () => {
    // Endpoint no chunk 0 emite result; chunks 1-2 emitem partialresult com texto parcial.
    // O partial do chunk 2 pode conter texto similar ao resultado intermediário.
    const recognizer = buildRecognizerMock({
      chunks: 3,
      endpointAtChunks: [0],
      segmentTexts: ['fase um', 'fase dois'],
    });
    const pcm = new Float32Array(3 * 4096);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('fase um fase dois');
    // Não deve haver duplicação
    expect(result.split('fase um').length).toBe(2); // "fase um" aparece 1× (split = 2)
    expect(result.split('fase dois').length).toBe(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Teste C — resultado único (frase curta sem pausa interna)
// ───────────────────────────────────────────────────────────────────────────────
describe('VOZ-012.1 — Teste C: resultado único', () => {
  it('frase curta sem endpoint intermediário produz resultado único via retrieve', async () => {
    // 3 chunks; todos parciais; resultado final vem do retrieve.
    const recognizer = buildRecognizerMock({
      chunks: 3,
      endpointAtChunks: [],
      segmentTexts: ['olá tudo bem'], // único resultado (retrieve)
    });
    const pcm = new Float32Array(3 * 4096);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('olá tudo bem');
    expect(recognizer.acceptWaveformFloat).toHaveBeenCalledTimes(3);
    expect(recognizer.retrieveFinalResult).toHaveBeenCalledTimes(1);
  });

  it('PCM 110592 samples (27 chunks) mantém resultado idêntico ao baseline VOZ-008.8', async () => {
    let resultCb: ((msg: ResultMsg) => void) | null = null;
    let partialCb: ((msg: ResultMsg) => void) | null = null;
    const on = vi.fn((event: string, cb: any) => {
      if (event === 'result') resultCb = cb;
      if (event === 'partialresult') partialCb = cb;
    });
    const acceptWaveformFloat = vi.fn(() => {
      partialCb?.({ event: 'partialresult', result: { partial: '' } });
    });
    const retrieveFinalResult = vi.fn(() => {
      resultCb?.({ event: 'result', result: { text: 'olá teste' } });
    });
    const recognizer = { on, acceptWaveformFloat, retrieveFinalResult, remove: vi.fn() };
    const pcm = new Float32Array(110592);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('olá teste');
    expect(acceptWaveformFloat).toHaveBeenCalledTimes(27);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Teste D — resultado final vazio
// ───────────────────────────────────────────────────────────────────────────────
describe('VOZ-012.1 — Teste D: resultado vazio', () => {
  it('PCM vazio → resultado vazio, sem erro', async () => {
    const recognizer = buildRecognizerMock({
      chunks: 0,
      segmentTexts: [''],
    });
    const pcm = new Float32Array(0);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('');
    expect(recognizer.acceptWaveformFloat).not.toHaveBeenCalled();
    expect(recognizer.retrieveFinalResult).toHaveBeenCalledTimes(1);
  });

  it('retrieve retorna vazio com chunks existentes → resultado vazio', async () => {
    // 2 chunks parciais, retrieve retorna '' → resultado limpo.
    const recognizer = buildRecognizerMock({
      chunks: 2,
      endpointAtChunks: [],
      segmentTexts: [''],
    });
    const pcm = new Float32Array(2 * 4096);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('');
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Teste E — concatenação com espaços
// ───────────────────────────────────────────────────────────────────────────────
describe('VOZ-012.1 — Teste E: separação correta entre segmentos', () => {
  it('dois segmentos são unidos com um espaço, não sem espaço nem com múltiplos espaços', async () => {
    const recognizer = buildRecognizerMock({
      chunks: 4,
      endpointAtChunks: [1],
      segmentTexts: ['palavra1', 'palavra2'],
    });
    const pcm = new Float32Array(4 * 4096);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('palavra1 palavra2');
    // Nunca "palavra1palavra2" nem "palavra1  palavra2"
    expect(result).not.toBe('palavra1palavra2');
    expect(result).not.toContain('  ');
  });

  it('três segmentos com palavras múltiplas são unidos com espaço único', async () => {
    const recognizer = buildRecognizerMock({
      chunks: 6,
      endpointAtChunks: [1, 3],
      segmentTexts: ['quero alterar minha dieta', 'porque estou com fome', 'à noite'],
    });
    const pcm = new Float32Array(6 * 4096);
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('quero alterar minha dieta porque estou com fome à noite');
    expect(result).not.toContain('  ');
  });

  it('segmentos com espaços nas bordas são trimados corretamente', async () => {
    // Simula resultado do worker com espaços nas bordas (reais no vosk-browser)
    let resultCb: ((msg: ResultMsg) => void) | null = null;
    const on = vi.fn((event: string, cb: any) => {
      if (event === 'result') resultCb = cb;
    });
    const acceptWaveformFloat = vi.fn(() => {});
    const retrieveFinalResult = vi.fn(() => {
      resultCb?.({ event: 'result', result: { text: '  com espaço  ' } });
    });
    const recognizer = { on, acceptWaveformFloat, retrieveFinalResult, remove: vi.fn() };
    const pcm = new Float32Array(0); // 0 chunks → apenas o retrieve conta como resposta
    const result = await transcribeWithVosk(pcm, 16000, makeMockModel(recognizer));

    expect(result).toBe('com espaço');
    expect(result).not.toMatch(/^ /);
    expect(result).not.toMatch(/ $/);
  });
});
