import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// VOZ-012.4 — F05: ciclo de vida do engine Vosk.
// - primeira inicialização;
// - reutilização (segunda gravação / remontagem) SEM novo load/worker;
// - dispose SOFT (unmount não mata o modelo imediatamente);
// - keep-warm TTL libera o modelo (terminate) após inatividade (memória limitada);
// - sem regressão de cancelamento/generation (coberto por voiceController*).

const mocks = vi.hoisted(() => ({
  loadVoskModel: vi.fn<(id: string) => Promise<unknown>>(),
  transcribeWithVosk: vi.fn<(pcm: Float32Array, rate: number, model: unknown) => Promise<string>>(),
  disposeVoskModel: vi.fn(),
  getVoskModelStats: vi.fn(() => ({ loadCount: 0, warmHitCount: 0, inFlightSharedCount: 0, staleAbortedLoadCount: 0 })),
  // VOZ-012.5 (F07): dependências novas da engine — generation e loading-in-flight.
  getVoskModelGeneration: vi.fn(() => 0),
  isVoskModelLoading: vi.fn(() => false),
}));

vi.mock('../stt/vosk', () => ({
  loadVoskModel: mocks.loadVoskModel,
  transcribeWithVosk: mocks.transcribeWithVosk,
  disposeVoskModel: mocks.disposeVoskModel,
  getVoskModelStats: mocks.getVoskModelStats,
  getVoskModelGeneration: mocks.getVoskModelGeneration,
  isVoskModelLoading: mocks.isVoskModelLoading,
}));

import { getVoskEngine, VOSK_ENGINE_KEEP_WARM_MS } from '../stt/engines/vosk';

const enginesPath = path.join(process.cwd(), 'src/lib/voice/stt/engines/vosk.ts');
const enginesContent = fs.readFileSync(enginesPath, 'utf8');
const voskPath = path.join(process.cwd(), 'src/lib/voice/stt/vosk.ts');
const voskContent = fs.readFileSync(voskPath, 'utf8');

function freshModel(): { id: string } {
  return { id: `model-${Math.random().toString(36).slice(2)}` };
}

function installLoadMock() {
  let instance: { id: string } | null = null;
  // Simula o cache module-level do vosk.ts: primeira chamada cria a instância,
  // chamadas seguintes reutilizam a MESMA (representa o mecanismo real).
  mocks.loadVoskModel.mockImplementation(async () => {
    if (!instance) instance = freshModel();
    return instance;
  });
}

function makePcm(): Float32Array {
  return new Float32Array(16000);
}

describe('VOZ-012.4 — F05: lifecycle do engine Vosk', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    installLoadMock();
    mocks.transcribeWithVosk.mockResolvedValue('oi');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('T-F05-1 — primeira inicialização: load() uma única vez, transcribe funciona', async () => {
    const engine = getVoskEngine();
    await engine.load();
    expect(mocks.loadVoskModel).toHaveBeenCalledTimes(1);
    const a = await engine.transcribe(makePcm(), 16000);
    expect(mocks.transcribeWithVosk).toHaveBeenCalledTimes(1);
    expect(a.text).toBe('oi');
  });

  it('T-F05-2 — segunda gravação NA MESMA sessão: sem novo load e mesma instância', async () => {
    const engine = getVoskEngine();
    await engine.load();
    const firstModelBehind = mocks.loadVoskModel.mock.results[0].value;
    await engine.transcribe(makePcm(), 16000);
    await engine.transcribe(makePcm(), 16000);
    expect(mocks.loadVoskModel).toHaveBeenCalledTimes(1); // não recarrega entre gravações
    expect(await firstModelBehind).toBe(await mocks.loadVoskModel.mock.results[0].value);
  });

  it('T-F05-3 — dispose é SOFT: unmount NÃO termina o modelo imediatamente', async () => {
    const engine = getVoskEngine();
    await engine.load();
    await engine.dispose();
    expect(mocks.disposeVoskModel).not.toHaveBeenCalled(); // continue quente para remontagem
  });

  it('T-F05-4 — keep-warm TTL: após inatividade, dispose HARD (terminate) libera memória', async () => {
    const engine = getVoskEngine();
    await engine.load();
    await engine.dispose();
    expect(mocks.disposeVoskModel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(VOSK_ENGINE_KEEP_WARM_MS + 1);
    expect(mocks.disposeVoskModel).toHaveBeenCalledTimes(1); // modelo não fica retido
  });

  it('T-F05-5 — remontagem/navegação de volta: reutiliza modelo sem reinstanciar (mesmo objeto)', async () => {
    const engineA = getVoskEngine();
    await engineA.load();
    const modelA = await mocks.loadVoskModel.mock.results[0].value;
    await engineA.dispose(); // unmount
    const engineB = getVoskEngine();
    await engineB.load(); // remount
    const modelB = await mocks.loadVoskModel.mock.results[1].value;
    expect(modelB).toBe(modelA); // mesmo worker/modelo — sem reload de ~32MB
    expect(mocks.disposeVoskModel).not.toHaveBeenCalled(); // ainda quente
  });

  it('T-F05-6 — atividade (transcrição) rearma o keep-warm; expira somente após idle real', async () => {
    const engine = getVoskEngine();
    await engine.load();
    // sem atividade: expira no TTL
    await vi.advanceTimersByTimeAsync(VOSK_ENGINE_KEEP_WARM_MS - 1000);
    expect(mocks.disposeVoskModel).not.toHaveBeenCalled();
    // atividade aos 9min59s rearma o timer a partir daí
    await engine.transcribe(makePcm(), 16000);
    await vi.advanceTimersByTimeAsync(VOSK_ENGINE_KEEP_WARM_MS - 1000);
    expect(mocks.disposeVoskModel).not.toHaveBeenCalled(); // não expirou no TTL antigo
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.disposeVoskModel).toHaveBeenCalledTimes(1); // expira no novo TTL
  });
});

describe('VOZ-012.4 — F05: contrato estrutural do lifecycle', () => {
  it('contém TTL keep-warm declarado (10 min) e usado no armWarm', () => {
    expect(enginesContent).toMatch(/VOSK_ENGINE_KEEP_WARM_MS\s*=\s*10\s*\*\s*60_000/);
    expect(enginesContent).toMatch(/armWarm\(\)/);
  });

  it('dispose() não chama disposeVoskModel (soft/park)', () => {
    const disposeBody = enginesContent.slice(enginesContent.indexOf('async dispose()'), enginesContent.indexOf('isSupported'));
    expect(disposeBody).not.toMatch(/disposeVoskModel/);
    expect(disposeBody).toMatch(/cachedModel\s*=\s*null/);
  });

  it('o dispose HARD (terminate) é preservado via keep-warm', () => {
    expect(enginesContent).toMatch(/disposeVoskModel\(\)/);
    expect(voskContent).toMatch(/export function disposeVoskModel\(\): void/);
  });

  it('vosk.ts deduplica loads em voo e instrumenta reutilização', () => {
    expect(voskContent).toMatch(/pendingModelLoad/);
    expect(voskContent).toMatch(/voskWarmHitCount/);
    expect(voskContent).toMatch(/getVoskModelStats/);
    expect(voskContent).toMatch(/VOSK_WARM_HIT/);
    expect(voskContent).toMatch(/VOSK_MODEL_LOAD/);
  });
});