import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Static validation: ensure no single acceptWaveformFloat(pcm) for whole audio and no setTimeout 100
const voskPath = path.join(process.cwd(), 'src/lib/voice/stt/vosk.ts');
const voskContent = fs.readFileSync(voskPath, 'utf8');

describe('VOZ-008.8 — Vosk chunked feeding', () => {
  it('PCM é dividido em chunks de no máximo 4096 samples', () => {
    expect(voskContent).toMatch(/const chunkSize = 4096/);
    expect(voskContent).toMatch(/for\s*\(let i = 0; i < processedPcm\.length; i \+= chunkSize\)/);
    expect(voskContent).toMatch(/processedPcm\.subarray\(i, Math\.min\(i \+ chunkSize/);
  });

  it('não existe acceptWaveformFloat(pcm) único para todo o áudio', () => {
    // Deve haver acceptWaveformFloat(chunk, sampleRate) dentro do loop, não acceptWaveformFloat(pcm, sampleRate) único
    const singleCall = /recognizer\.acceptWaveformFloat\(pcm,\s*sampleRate\)/g;
    const matches = voskContent.match(singleCall) || [];
    // No chunked version, should be 0 single whole-pcm calls
    expect(matches.length).toBe(0);
    expect(voskContent).toMatch(/recognizer\.acceptWaveformFloat\(chunk,\s*sampleRate\)/);
  });

  it('retrieveFinalResult ocorre somente depois de todos os chunks', () => {
    const acceptIndex = voskContent.indexOf('recognizer.acceptWaveformFloat(chunk');
    const retrieveIndex = voskContent.indexOf('recognizer.retrieveFinalResult()');
    expect(acceptIndex).toBeGreaterThan(-1);
    expect(retrieveIndex).toBeGreaterThan(-1);
    expect(retrieveIndex).toBeGreaterThan(acceptIndex);
    // Não deve haver setTimeout 100ms como mecanismo de finalização
    expect(voskContent).not.toMatch(/setTimeout\(\(\) => \{\s*afterRetrieve = true[\s\S]*?,\s*100\)/);
  });

  it('não existe setTimeout 100ms para finalização', () => {
    // O antigo `}, 100);` após retrieveFinalResult não deve existir
    expect(voskContent).not.toMatch(/\}, 100\)/);
  });

  it('F02 — guard proporcional (30s base + k×duração) substitui o timeout fixo de 30s', () => {
    // VOZ-012.3 — o guard agora é rede de segurança proporcional à duração do áudio,
    // nunca um corte arbitrário de uma inferência válida longa.
    expect(voskContent).toMatch(/const timeoutMs = computeInferenceGuardMs\(audioDurationMs\)/);
    expect(voskContent).toMatch(/setTimeout\(\(\) => finish\((true)?\), timeoutMs\)/);
    expect(voskContent).not.toMatch(/setTimeout\(\(\) => finish\(\), 30000\)/);
  });

  it('todos os samples são enviados (chunking cobre 0..length)', () => {
    // Verifica loop cobre todo processedPcm.length
    expect(voskContent).toMatch(/for\s*\(let i = 0; i < processedPcm\.length; i \+= chunkSize\)/);
  });

  it('último chunk pode ter tamanho menor que 4096 (via Math.min)', () => {
    expect(voskContent).toMatch(/Math\.min\(i \+ chunkSize, processedPcm\.length\)/);
  });
});

describe('VOZ-008.8 — Vosk chunked runtime', () => {
  it('PCM vazio é tratado sem erro (0 chunks)', async () => {
    const { transcribeWithVosk } = await import('../stt/vosk');
    const mockRemove = vi.fn();
    let resultCb: ((msg: any) => void) | null = null;
    let partialCb: ((msg: any) => void) | null = null;
    const mockOn = vi.fn((event: string, cb: any) => {
      if (event === 'result') resultCb = cb;
      if (event === 'partialresult') partialCb = cb;
    });
    const mockAccept = vi.fn();
    const mockRetrieve = vi.fn(() => {
      // retrieveFinalResult emite exatamente 1 evento 'result' (FinalResult)
      if (resultCb) resultCb({ result: { text: '' } });
    });
    const mockRecognizer = {
      on: mockOn,
      acceptWaveformFloat: mockAccept,
      retrieveFinalResult: mockRetrieve,
      remove: mockRemove,
    };
    const MockKaldiRecognizer = vi.fn(function() { return mockRecognizer; } as any);
    const mockModel: any = {
      KaldiRecognizer: MockKaldiRecognizer,
    };
    const pcm = new Float32Array(0);
    const result = await transcribeWithVosk(pcm, 16000, mockModel);
    expect(result).toBe('');
    expect(mockAccept).not.toHaveBeenCalled();
    expect(mockRetrieve).toHaveBeenCalledTimes(1);
  });

  it('PCM 110592 samples é dividido em 27 chunks e todos enviados', async () => {
    const { transcribeWithVosk } = await import('../stt/vosk');
    let resultCb: ((msg: any) => void) | null = null;
    let partialCb: ((msg: any) => void) | null = null;
    const mockOn = vi.fn((event: string, cb: any) => {
      if (event === 'result') resultCb = cb;
      if (event === 'partialresult') partialCb = cb;
    });
    const mockAccept = vi.fn(() => {
      // Cada acceptWaveformFloat → 1 evento (partialresult ou result)
      // Simulamos sem endpoint: acceptWaveform retorna false → partialresult
      if (partialCb) partialCb({ event: 'partialresult', result: { partial: 'olá teste' } });
    });
    const mockRetrieve = vi.fn(() => {
      // retrieveFinalResult → exatamente 1 result (FinalResult)
      if (resultCb) resultCb({ event: 'result', result: { text: 'olá teste' } });
    });
    const mockRecognizer = {
      on: mockOn,
      acceptWaveformFloat: mockAccept,
      retrieveFinalResult: mockRetrieve,
      remove: vi.fn(),
    };
    const MockKaldiRecognizer = vi.fn(function() { return mockRecognizer; } as any);
    const mockModel: any = {
      KaldiRecognizer: MockKaldiRecognizer,
    };
    const pcm = new Float32Array(110592);
    const result = await transcribeWithVosk(pcm, 16000, mockModel);
    expect(result).toBe('olá teste');
    expect(mockAccept).toHaveBeenCalledTimes(27);
    const totalSent = mockAccept.mock.calls.reduce((sum: number, call: any[]) => sum + (call[0] as Float32Array).length, 0);
    expect(totalSent).toBe(110592);
    const acceptCalls = mockAccept.mock.calls as Float32Array[][];
    const lastChunk = acceptCalls[acceptCalls.length - 1]?.[0];
    expect(lastChunk?.length).toBe(4096);
    expect(mockRetrieve).toHaveBeenCalledTimes(1);
    const acceptOrder = mockAccept.mock.invocationCallOrder[0];
    const retrieveOrder = (mockRetrieve as any).mock.invocationCallOrder[0];
    expect(retrieveOrder).toBeGreaterThan(acceptOrder);
  });
});
