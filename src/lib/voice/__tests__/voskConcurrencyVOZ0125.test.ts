import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// VOZ-012.5 — F07: concorrência de carregamento da engine/modelo Vosk.
// - O teste roda o CÓDIGO REAL de vosk.ts/engines/vosk.ts (não mocka o módulo),
//   mockando apenas o pacote `vosk-browser` (download+worker) com um FakeModel
//   cujo evento `load` é controlado pelo teste (deferred) — cenários de race.
// - Garantias: 1 carregamento efetivo por vez, instância compartilhada, nenhum
//   worker órfão, nenhum swap de instância entre gerações, keep-warm nunca mata
//   um load válido, nova carga após hard dispose funciona.

const modelClass = vi.hoisted(() => {
  type Handler = (msg?: any) => void;
  class FakeRecognizer {
    handlers: Record<string, Handler[]> = {};
    on(e: string, fn: Handler) {
      (this.handlers[e] ??= []).push(fn);
    }
    emit(e: string, msg?: any) {
      for (const fn of this.handlers[e] ?? []) fn(msg);
    }
    acceptWaveformFloat() {
      this.emit('result', { result: { text: '' } });
    }
    retrieveFinalResult() {
      this.emit('result', { result: { text: 'oi' } });
    }
    remove() {
      this.handlers = {};
    }
  }
  class FakeModel {
    static instances: FakeModel[] = [];
    url: string;
    KaldiRecognizer = FakeRecognizer;
    handlers: Record<string, Handler[]> = {};
    terminate: ReturnType<typeof vi.fn>;
    constructor(url: string) {
      this.url = url;
      this.terminate = vi.fn();
      FakeModel.instances.push(this);
    }
    on(e: string, fn: Handler) {
      (this.handlers[e] ??= []).push(fn);
    }
    fire(e: string, msg?: any) {
      for (const fn of this.handlers[e] ?? []) fn(msg);
    }
  }
  return { FakeModel };
});

vi.mock('vosk-browser', () => ({
  createModel: vi.fn(),
  Model: modelClass.FakeModel,
}));

import { loadVoskModel, disposeVoskModel, getVoskModelStats, isVoskModelLoading } from '../stt/vosk';
import { getVoskEngine, VOSK_ENGINE_KEEP_WARM_MS } from '../stt/engines/vosk';

const findLast = () => modelClass.FakeModel.instances[modelClass.FakeModel.instances.length - 1];

async function flush(minInstances = 1, rounds = 2000): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    if (modelClass.FakeModel.instances.length >= minInstances) return;
    await Promise.resolve();
  }
}

describe('VOZ-012.5 — F07: concorrência de carga (código real)', () => {
  beforeEach(() => {
    (globalThis as any).window = {};
    modelClass.FakeModel.instances.length = 0;
    // Estado module-level limpo por teste (cache + pending + geração).
    disposeVoskModel();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('T-F07-1 — loads simultâneos (2): 1 carregamento real, mesma instância', async () => {
    const before = getVoskModelStats();
    const engine = getVoskEngine();
    const p1 = engine.load();
    const p2 = engine.load();
    await flush(); // deixa o doLoadVoskModel construir o modelo (1ª microtask)
    expect(modelClass.FakeModel.instances.length).toBe(1); // dedupe no pendingModelLoad
    findLast().fire('load', { result: true });
    await Promise.all([p1, p2]);
    const after = getVoskModelStats();
    expect(after.loadCount - before.loadCount).toBe(1); // apenas 1 new Vosk.Model
    expect(after.inFlightSharedCount - before.inFlightSharedCount).toBe(1);
    expect(modelClass.FakeModel.instances[0].terminate).not.toHaveBeenCalled();
  });

  it('T-F07-2 — concorrência elevada (8, 2 engines): 1 modelo/worker, nenhum erro', async () => {
    const before = getVoskModelStats();
    const engines = [getVoskEngine(), getVoskEngine()];
    const all: Promise<void>[] = [];
    for (let i = 0; i < 8; i++) all.push(engines[i % 2].load());
    await flush(); // todas caem na MESMA promise antes de qualquer construção
    expect(modelClass.FakeModel.instances.length).toBe(1); // sem worker duplicado
    findLast().fire('load', { result: true });
    await Promise.all(all);
    const after = getVoskModelStats();
    expect(after.loadCount - before.loadCount).toBe(1);
    expect(after.inFlightSharedCount - before.inFlightSharedCount).toBe(7);
    expect(after.staleAbortedLoadCount - before.staleAbortedLoadCount).toBe(0);
  });

  it('T-F07-3 — load JÁ em andamento: reutiliza pendingModelLoad (sem 2º fetch/spawn)', async () => {
    const before = getVoskModelStats();
    const p1 = loadVoskModel('small-pt-0.3');
    await flush();
    expect(modelClass.FakeModel.instances.length).toBe(1);
    expect(isVoskModelLoading()).toBe(true);
    const p2 = loadVoskModel('small-pt-0.3'); // compartilha a promise em voo
    await flush();
    expect(modelClass.FakeModel.instances.length).toBe(1); // nenhum segundo worker
    findLast().fire('load', { result: true });
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe(b);
    expect(getVoskModelStats().inFlightSharedCount - before.inFlightSharedCount).toBe(1);
  });

  it('T-F07-4 — modelo quente: cargas e transcrição reutilizam SEM nova carga', async () => {
    const lp = loadVoskModel('small-pt-0.3');
    await flush();
    findLast().fire('load', { result: true });
    await lp;
    const before = getVoskModelStats();
    const engine = getVoskEngine();
    await engine.load(); // warm hit
    const res = await engine.transcribe(new Float32Array(16000), 16000);
    expect(res.text).toBe('oi');
    const after = getVoskModelStats();
    expect(after.loadCount - before.loadCount).toBe(0); // nenhuma carga nova
    expect(after.warmHitCount - before.warmHitCount).toBe(1); // apenas o engine.load
    expect(modelClass.FakeModel.instances.length).toBe(1);
  });

  it('T-F07-5 — dispose durante carga: sem swap de geração, sem worker órfão, pending consistente', async () => {
    const before = getVoskModelStats();
    const pOld = loadVoskModel('small-pt-0.3'); // geração A pendente
    await flush();
    expect(modelClass.FakeModel.instances.length).toBe(1);
    disposeVoskModel(); // hard dispose abre geração B + limpa pending
    const pNew = loadVoskModel('small-pt-0.3'); // geração B (instância nova)
    await flush(2);
    expect(modelClass.FakeModel.instances.length).toBe(2);
    // A geração A (obsoleta) termina PRIMEIRO — sua promise é descartada,
    // mas NÃO pode limpar o pendingModelLoad da geração B (finally por identidade).
    modelClass.FakeModel.instances[0].fire('load', { result: true });
    await expect(pOld).rejects.toThrow(/MODEL_LOAD_STALE/);
    expect(isVoskModelLoading()).toBe(true); // pending da geração B segue vivo
    expect(modelClass.FakeModel.instances[0].terminate).toHaveBeenCalledTimes(1); // sem worker órfão
    // Geração B conclui e instala normalmente
    modelClass.FakeModel.instances[1].fire('load', { result: true });
    await expect(pNew).resolves.toBe(modelClass.FakeModel.instances[1]);
    expect(modelClass.FakeModel.instances[1].terminate).not.toHaveBeenCalled();
    // Cache final = instância da geração NOVA (a antiga não substituiu)
    const warm = await loadVoskModel('small-pt-0.3');
    expect(warm).toBe(modelClass.FakeModel.instances[1]);
    expect(modelClass.FakeModel.instances[0].terminate).toHaveBeenCalledTimes(1);
    expect(getVoskModelStats().staleAbortedLoadCount - before.staleAbortedLoadCount).toBe(1);
  });

  it('T-F07-6 — keep-warm (§6): não hard-dispose durante load; hard dispose após idle; novo load ok', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const engine = getVoskEngine();
    // 1) carga inicial completa → warm cache + keep-warm (fogo em +600s)
    const p0 = engine.load();
    await flush();
    expect(modelClass.FakeModel.instances.length).toBe(1);
    modelClass.FakeModel.instances[0].fire('load', { result: true });
    await p0;
    await flush();
    expect(modelClass.FakeModel.instances[0].terminate).not.toHaveBeenCalled();

    // 2) +490s: hard dispose externo; novo load fica PENDENTE quando o keep-warm velho
    //    (armado no passo 1, fogo em 600s) ainda está ativo.
    vi.setSystemTime(490_000);
    disposeVoskModel();
    expect(modelClass.FakeModel.instances[0].terminate).toHaveBeenCalledTimes(1);
    const p2 = engine.load(); // FM2 pendente; timeout próprio em 610s
    await flush(2);
    expect(modelClass.FakeModel.instances.length).toBe(2);

    // 3) avança até o fogo do keep-warm antigo (600s) DURANTE o load válido
    await vi.advanceTimersByTimeAsync(110_000);
    expect(modelClass.FakeModel.instances[1].terminate).not.toHaveBeenCalled(); // §6 cumprido
    expect(isVoskModelLoading()).toBe(true); // load segue vivo

    // 4) load conclui → engine rearma o keep-warm
    modelClass.FakeModel.instances[1].fire('load', { result: true });
    await p2;
    await flush();

    // 5) idle → hard dispose ocorre normalmente após o novo TTL
    await vi.advanceTimersByTimeAsync(VOSK_ENGINE_KEEP_WARM_MS + 1);
    expect(modelClass.FakeModel.instances[1].terminate).toHaveBeenCalledTimes(1);

    // 6) novo load pós-dispose (T-F07-7) — instância nova, sem ref à antiga
    const p3 = engine.load();
    await flush(3);
    expect(modelClass.FakeModel.instances.length).toBe(3);
    modelClass.FakeModel.instances[2].fire('load', { result: true });
    await p3;
    expect(modelClass.FakeModel.instances[2].terminate).not.toHaveBeenCalled();
  });

  it('T-F07-7 — transcribe após hard dispose: engine recarrega e NÃO usa a instância terminada', async () => {
    const engine = getVoskEngine();
    const lp = engine.load();
    await flush();
    modelClass.FakeModel.instances[0].fire('load', { result: true });
    await lp;
    const before = getVoskModelStats();
    // hard dispose externo (equivalente ao keep-warm do VOZ-012.4)
    disposeVoskModel();
    expect(modelClass.FakeModel.instances[0].terminate).toHaveBeenCalledTimes(1);
    // engine ainda "montada": seu cachedModel local aponta para a instância terminada;
    // o guard de geração FORÇA recarga em vez de usar o worker morto.
    const tr = engine.transcribe(new Float32Array(16000), 16000);
    await flush(2);
    expect(modelClass.FakeModel.instances.length).toBe(2); // recarregou
    modelClass.FakeModel.instances[1].fire('load', { result: true });
    const res = await tr;
    expect(res.text).toBe('oi');
    expect(modelClass.FakeModel.instances[1].terminate).not.toHaveBeenCalled();
    expect(getVoskModelStats().loadCount - before.loadCount).toBe(1);
  });
});

describe('VOZ-012.5 — F07: contrato estrutural (estático)', () => {
  const voskPath = path.join(process.cwd(), 'src/lib/voice/stt/vosk.ts');
  const voskContent = fs.readFileSync(voskPath, 'utf8');
  const engPath = path.join(process.cwd(), 'src/lib/voice/stt/engines/vosk.ts');
  const engContent = fs.readFileSync(engPath, 'utf8');

  it('vosk.ts: geração + carga em voo com finally por IDENTIDADE + stale guard', () => {
    expect(voskContent).toMatch(/let modelGeneration = 0/);
    expect(voskContent).toMatch(/export function getVoskModelGeneration\(\)/);
    expect(voskContent).toMatch(/export function isVoskModelLoading\(\)/);
    expect(voskContent).toMatch(/pendingModelLoad === loadPromise/);
    expect(voskContent).toMatch(/genAtStart !== modelGeneration/);
    expect(voskContent).toMatch(/new Promise<any>\(/);
    expect(voskContent).toMatch(/try { \(model as any\)\.terminate\?\.\(\); } catch {}/);
  });

  it('vosk.ts: disposeVoskModel abre geração nova e invalida o pending', () => {
    const body = voskContent.slice(voskContent.indexOf('export function disposeVoskModel'), voskContent.indexOf('export function isVoskSupported'));
    expect(body).toMatch(/modelGeneration\+\+/);
    expect(body).toMatch(/pendingModelLoad = null/);
    expect(body).toMatch(/export function disposeVoskModel\(\): void/);
  });

  it('engine: keep-warm consulta isVoskModelLoading antes de hard dispose', () => {
    const arm = engContent.slice(engContent.indexOf('const armWarm'), engContent.indexOf('return {'));
    expect(arm).toMatch(/if \(isVoskModelLoading\(\)\) return;/);
    expect(arm).toMatch(/disposeVoskModel\(\)/);
  });

  it('engine: transcribe recarrega quando a geração da instância está obsoleta', () => {
    const transcribeBody = engContent.slice(engContent.indexOf('async transcribe'), engContent.indexOf('async dispose'));
    expect(transcribeBody).toMatch(/loadedGeneration !== getVoskModelGeneration\(\)/);
    expect(transcribeBody).toMatch(/cachedModel = await loadVoskModel\('small-pt-0.3'\)/);
  });

  it('controller: guard de não-concorrência (start() no-op quando ocupado) não foi removido', () => {
    const ctrlPath = path.join(process.cwd(), 'src/lib/voice/voiceController.ts');
    const ctrlContent = fs.readFileSync(ctrlPath, 'utf8');
    expect(ctrlContent).toMatch(/if \(this\.loading \|\| this\.recording \|\| this\.processing \|\| this\.transcribing\) return;/);
    expect(ctrlContent).toMatch(/private pendingEngineLoad: Promise<void> \| null = null;/);
  });
});