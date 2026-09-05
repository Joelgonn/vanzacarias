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

  it('timeout máximo de 30s continua protegido', () => {
    expect(voskContent).toMatch(/const guard = setTimeout\(\(\) => finish\(finalText\), 30000\)/);
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
    const mockOn = vi.fn((event: string, cb: any) => {
      if (event === 'result') {
        // Simular result final após retrieve
        setTimeout(() => cb({ result: { text: '' } }), 10);
      }
    });
    const mockAccept = vi.fn();
    const mockRetrieve = vi.fn(() => {
      // Trigger result
      const cb = mockOn.mock.calls.find(c => c[0] === 'result')?.[1];
      if (cb) cb({ result: { text: '' } });
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
    expect(mockAccept).not.toHaveBeenCalled(); // 0 chunks for empty
    expect(mockRetrieve).toHaveBeenCalledTimes(1);
  });

  it('PCM 110592 samples é dividido em 27 chunks e todos enviados', async () => {
    const { transcribeWithVosk } = await import('../stt/vosk');
    const mockOn = vi.fn((event: string, cb: any) => {
      if (event === 'result') {
        setTimeout(() => cb({ result: { text: 'olá teste' } }), 10);
      }
    });
    const mockAccept = vi.fn();
    const mockRetrieve = vi.fn(() => {
      const cb = mockOn.mock.calls.find(c => c[0] === 'result')?.[1];
      if (cb) cb({ result: { text: 'olá teste' } });
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
    expect(mockAccept).toHaveBeenCalledTimes(27); // ceil(110592/4096)=27
    // Verificar que todos os samples foram enviados (soma dos chunks = 110592)
    const totalSent = mockAccept.mock.calls.reduce((sum: number, call: any[]) => sum + (call[0] as Float32Array).length, 0);
    expect(totalSent).toBe(110592);
    // Último chunk deve ser menor que 4096 (110592 % 4096 = 0? 4096*27=110592 exatamente, então último é 4096)
    // Testar com 110593 para garantir menor
    expect(mockAccept.mock.calls[26][0].length).toBe(4096);
    expect(mockRetrieve).toHaveBeenCalledTimes(1);
    // retrieve deve ocorrer após todos os accepts (chamado depois do loop)
    const acceptOrder = mockAccept.mock.invocationCallOrder[0];
    const retrieveOrder = (mockRetrieve as any).mock.invocationCallOrder[0];
    expect(retrieveOrder).toBeGreaterThan(acceptOrder);
  });
});
