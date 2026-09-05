// VOZ-004 / VOZ-004-R4 — Vosk PT-BR PoC isolado (não integra ChatAssistant)
// - Local/offline, sem /api/stt, sem upload, sem Supabase
//

import { isVoiceDebugEnabled, voiceDebugLog, computePcmStats } from '../debug';
import { normalizePcm, trimSilence } from '../audio/normalize';
import { buildVoskModelRequestUrl, isVoskModelRequest } from '../pwa/modelCache';
// VOZ-004-R4 — Runtime/Bundling Fix:
// - Causa do erro "Failed to resolve module specifier 'vosk-browser'": o import
//   dinâmico era executado via `eval`, escondendo o specifier "vosk-browser" do
//   webpack; o browser não resolve não-module specifiers em runtime e lançava o erro.
// - Correção: `import('vosk-browser')` explícito (resolvido por webpack). O pacote
//   vosk-browser@0.0.8 é UMD autocontido (dist/vosk.js), sem require/process/window
//   top-level; o Worker é clássico (base64 inline + Blob URL), sem imports externos;
//   o WASM do Kaldi é embutido no Worker. Funciona como bundled module.

export type VoskModelId = 'small-pt-0.3';
export const VOSK_MODELS = {
  'small-pt-0.3': {
    name: 'vosk-model-small-pt-0.3',
    version: '0.3',
    language: 'pt-BR',
    // VOZ-012.4 — F06: URL versionada (?v=0.3) para o cache PWA/HTTP. A versão
    // faz parte do cache key do service worker (ver pwa/modelCache.ts). NUNCA
    // editar o tar.gz no mesmo pathname mantendo a mesma versão.
    url: buildVoskModelRequestUrl('0.3'),
    // Remoto NUNCA usado em runtime (R4: privacidade local-only). Mantido apenas
    // como referência da conversão original (zip -> tar.gz local na etapa VOZ-004).
    altUrl: 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip',
    size: '31M (zip) / 32.4M tar.gz local',
    license: 'Apache 2.0',
    format: 'tar.gz (convertido de zip para vosk-browser)',
    runtime: 'vosk-browser (WASM Web Worker)',
    originalSha256: '6e1ce909032e1afa7a88e68a3d628ecafff302bdf195befab308826c395e93b7',
    convertedSha256: '4eb5ac3fca5fb6dea2befff011abe2b093cb834772d91f4fed0615105cfd8428',
    originalSize: 32453112,
    convertedSize: 32405987,
    conversionMethod: 'Expand-Archive zip → tar -czf (bsdtar 3.7.7)',
  },
} as const;

export type VoskState = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

// Namespace tipado do vosk-browser (d.ts público: Model + createModel).
type VoskNamespace = typeof import('vosk-browser');

let cachedNS: VoskNamespace | null = null;

// Helper para carregar Vosk (vosk-browser) no browser
async function loadVoskBrowser(): Promise<VoskNamespace> {
  // Evita execução no servidor (SSR/prerender): engine só roda no browser.
  if (typeof window === 'undefined') throw new Error('Vosk só funciona no browser');
  if (cachedNS) return cachedNS;
  // Import dinâmico explícito — resolvido pelo bundler (webpack) para um chunk.
  // O UMD seta `__esModule` e exporta Model/createModel; normalizamos default/namespace.
  const mod: any = await import('vosk-browser');
  const picked: any = (mod && mod.createModel && mod) || (mod && mod.default && mod.default.createModel && mod.default);
  if (!picked?.createModel) throw new Error("Vosk BUNDLE_ERROR: namespace sem createModel");
  const ns = picked as VoskNamespace;
  cachedNS = ns;
  return ns;
}

let cachedModel: any = null;
let cachedModelId: string | null = null;

// VOZ-012.4 — F05/F06: instrumentação do ciclo de carga do modelo.
// - loadCount: construções reais de `new Vosk.Model` (download+worker únicos).
// - warmHitCount: vezes em que loadVoskModel reutilizou o modelo já em memória.
// - inFlightSharedCount: vezes em que uma chamada concorrente reutilizou o load em voo.
// - staleAbortedLoadCount: carregamentos cuja geração foi invalidada por um
//   dispose HARD ocorrido durante a carga (F07) — descartados e terminados sem
//   instalar instância obsoleta.
// Contadores monotônicos por sessão de página (sem áudio/PII).
let voskModelLoadCount = 0;
let voskWarmHitCount = 0;
let voskInFlightSharedCount = 0;
let voskStaleAbortedLoadCount = 0;

export function getVoskModelStats(): {
  loadCount: number;
  warmHitCount: number;
  inFlightSharedCount: number;
  staleAbortedLoadCount: number;
} {
  return {
    loadCount: voskModelLoadCount,
    warmHitCount: voskWarmHitCount,
    inFlightSharedCount: voskInFlightSharedCount,
    staleAbortedLoadCount: voskStaleAbortedLoadCount,
  };
}

// Cache em voo: deduplica loadVoskModel concorrentes (duas chamadas simultâneas
// não criam 2 workers/modelos). A mesma promise é compartilhada entre chamadores.
// VOZ-012.5 (F07): o despacho é atômico (check-and-set totalmente síncrono, sem
// await entre as instruções), então qualquer número de chamadas concorrentes
// cai na MESMA promise. O `finally` limpa por IDENTIDADE (não por id) para que
// um chamador de uma geração anterior nunca apague o pendingModelLoad de uma
// geração nova (limpeza concorrente).
let pendingModelLoad: Promise<any> | null = null;
let pendingModelLoadId: string | null = null;

export async function loadVoskModel(modelId: VoskModelId = 'small-pt-0.3', onProgress?: (p: number) => void): Promise<any> {
  if (cachedModel && cachedModelId === modelId) {
    // F05 — reutilização: modelo ainda em memória (sessão ou keep-warm do VOZ-012.4).
    voskWarmHitCount++;
    if (isVoiceDebugEnabled()) {
      const stats = getVoskModelStats();
      voiceDebugLog('VOSK_WARM_HIT', { modelId, loadCount: stats.loadCount, warmHitCount: stats.warmHitCount, inFlightSharedCount: stats.inFlightSharedCount, reuse: true });
    }
    return cachedModel;
  }
  if (pendingModelLoad && pendingModelLoadId === modelId) {
    voskInFlightSharedCount++;
    return pendingModelLoad;
  }
  const loadPromise = doLoadVoskModel(modelId, onProgress);
  pendingModelLoad = loadPromise;
  pendingModelLoadId = modelId;
  try {
    return await loadPromise;
  } finally {
    if (pendingModelLoad === loadPromise) {
      pendingModelLoad = null;
      pendingModelLoadId = null;
    }
  }
}

// VOZ-012.5 (F07) — geração do modelo em memória. `modelGeneration` só aumenta em
// dispose HARD. Uma carga iniciada antes do dispose (gen antiga) que terminar depois:
// (a) não instala a instância (não substitui uma geração nova) — §5;
// (b) é terminada para não virar worker órfão — §4;
// (c) os chamadores da geração antiga recebem erro controlado (MODEL_LOAD_STALE).
let modelGeneration = 0;

export function getVoskModelGeneration(): number {
  return modelGeneration;
}

// F07 (§6) — o keep-warm e demais decisões de hard dispose consultam esta função:
// enquanto houver carregamento válido em andamento, o hard dispose NÃO deve
// executar (o load que está em voo instalará/armará seu próprio keep-warm).
export function isVoskModelLoading(): boolean {
  return pendingModelLoad !== null;
}

async function doLoadVoskModel(modelId: VoskModelId, onProgress?: (p: number) => void): Promise<any> {
  const loadStart = Date.now();
  const genAtStart = modelGeneration;
  const Vosk = await loadVoskBrowser();
  const modelInfo = VOSK_MODELS[modelId];
  const isModelRequest = isVoskModelRequest(new URL(modelInfo.url, typeof location !== 'undefined' ? location.href : 'https://app.local/'));
  // Modelo local exclusivamente (privacy/local-only R4): GET /vosk-model-small-pt-0.3.tar.gz
  // é fetado pelo Worker (mesma origem). Nenhum fallback remoto.
  const model = new Vosk.Model(modelInfo.url);
  try {
    const modelRef = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Vosk MODEL_LOAD_TIMEOUT')), 120000);
      model.on('load', (msg: any) => {
        clearTimeout(timer);
        if (msg?.result) resolve(model);
        else reject(new Error(`Vosk MODEL_LOAD_FAILED: ${modelInfo.url}`));
      });
      model.on('error', (msg: any) => {
        clearTimeout(timer);
        reject(new Error(`Vosk MODEL_LOAD_ERROR: ${msg?.error || 'unknown'}`));
      });
    });
    // F07 (§5/§6) — se um dispose HARD ocorreu durante a carga, esta instância
    // pertence à geração anterior: não instala e termina o worker (sem órfão).
    if (genAtStart !== modelGeneration) {
      voskStaleAbortedLoadCount++;
      throw new Error('Vosk MODEL_LOAD_STALE: instância obsoleta descartada (dispose durante carregamento)');
    }
    voskModelLoadCount++;
    if (isVoiceDebugEnabled()) {
      voiceDebugLog('VOSK_MODEL_LOAD', {
        modelId,
        durationMs: Date.now() - loadStart,
        version: modelInfo.version,
        loadedUrl: modelInfo.url,
        isModelRequest,
        sha256: modelInfo.convertedSha256,
      });
    }
    cachedModel = modelRef;
    cachedModelId = modelId;
    return modelRef;
  } catch (err) {
    // F07 (§4) — nenhum worker órfão: falha/timeout/stale termina o worker recém-criado.
    try { (model as any).terminate?.(); } catch {}
    throw err;
  }
}

// VOZ-012.3 — F02: guard de inferência PROPORCIONAL à duração real do áudio.
// Antes: o guard era `setTimeout(guardFn, 30000)` — 30s fixos para qualquer áudio.
// Para áudio longo (RTF > 1 do WASM worker em Android), o worker pode legitimamente
// levar >30s para processar; o guard fixo disparava o término com texto
// parcial/vazio — CORTANDO uma inferência válida, e não apenas protegendo contra
// worker travado.
//
// Fórmula (recomendada pela auditoria externa):
//   timeoutMs = base + k × audioDurationMs
//
// Parâmetros:
// - base 30s (mesma margem do guard anterior): absorve latência por-chunk, setup
//   do wasm/worker e a janela até o primeiro resultado — independente do tamanho.
// - k = 4 (dentro da faixa recomendada 3–5): para RTF típico 1–3× em dispositivo
//   mid-range, garante folga ~1–3× sobre o processamento esperado. k<3 arriscava
//   timeout falso em gravação longa; k>5 alongava espera em caso de trava real.
// - sem teto explícito: a duração máxima é limitada pelos 60s de gravação
//   (VOZ-012.2) → timeout max ≈ 30s + 4×60s = 270s. O guard NUNCA corta uma
//   inferência válida; só resolve quando o worker realmente não responde.
const INFERENCE_GUARD_BASE_MS = 30_000;
const INFERENCE_GUARD_FACTOR = 4;

export function computeInferenceGuardMs(
  audioDurationMs: number,
  baseMs: number = INFERENCE_GUARD_BASE_MS,
  factor: number = INFERENCE_GUARD_FACTOR
): number {
  // Durações inválidas/negativas/NaN têm comportamento seguro e determinístico.
  const safeMs = Number.isFinite(audioDurationMs) && audioDurationMs > 0 ? audioDurationMs : 0;
  return baseMs + factor * safeMs;
}

export async function transcribeWithVosk(
  pcm: Float32Array,
  sampleRate: number,
  model: any
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // VOZ-008 — métricas antes de accept (sem áudio)
      const voskDebug = isVoiceDebugEnabled();
      const preStats = voskDebug ? computePcmStats(pcm, sampleRate) : null;
      const acceptStart = Date.now();
      if (voskDebug) {
        voiceDebugLog('VOSK_INPUT', {
          samples: pcm.length,
          sampleRate,
          durationMs: Math.round((pcm.length / sampleRate) * 1000),
          rms: preStats?.rms ?? 0,
          peak: preStats?.peak ?? 0,
          min: preStats?.min ?? 0,
          max: preStats?.max ?? 0,
          silenceRatio: preStats?.silenceRatio ?? 0,
        });
      }

      // VOZ-010 — pré-processamento: trim silêncio excessivo + normalização por pico
      let processedPcm: Float32Array = pcm;
      const trimmed = trimSilence(processedPcm, sampleRate);
      if (trimmed.length !== processedPcm.length && voskDebug) {
        voiceDebugLog('VOSK_TRIM', {
          originalSamples: pcm.length,
          trimmedSamples: trimmed.length,
          trimmedMs: Math.round(((pcm.length - trimmed.length) / sampleRate) * 1000),
        });
      }
      processedPcm = trimmed;
      const normalized = normalizePcm(processedPcm);
      if (normalized !== processedPcm && voskDebug) {
        const normStats = computePcmStats(normalized, sampleRate);
        voiceDebugLog('VOSK_NORMALIZE', {
          originalPeak: preStats?.peak ?? 0,
          normalizedPeak: normStats.peak,
          originalRms: preStats?.rms ?? 0,
          normalizedRms: normStats.rms,
          silenceRatio: normStats.silenceRatio,
        });
      }
      processedPcm = normalized;

      // KaldiRecognizer aceita sampleRate; acceptWaveformFloat é o caminho oficial
      // para Float32Array (o worker recebe o PCM via audioChunk + sampleRate).
      const recognizer = new model.KaldiRecognizer(sampleRate);
      // VOZ-012.1 — F01: o worker (vosk.js) emite UM evento `result` ou `partialresult`
      // para CADA acceptWaveformFloat (exatamente 1 resposta por chunk — ver vosk-worker.js
      // processAudioChunk) e EXATAMENTE UM evento `result` final ao processar retrieveFinalResult
      // (ver retrieveFinalResult no worker). Antes, `finalText = msg.result.text` sobrescrevia
      // resultados anteriores — perda de palavras em frases com pausas internas.
      //
      // Correção: acumulamos segmentos finais em ordem. Sabemos quando parar porque o worker
      // emite exatamente `totalChunks + 1` respostas (1 por audioChunk + 1 do retrieveFinalResult).
      // Quando todas as respostas foram recebidas, finalizamos. `partialresult` é contabilizado
      // mas o texto não é usado como definitivo (Teste B — parcial não contamina resultado).
      const chunkSize = 4096;
      const totalChunks = processedPcm.length > 0 ? Math.ceil(processedPcm.length / chunkSize) : 0;
      const expectedResponses = totalChunks + 1; // 1 resultado por chunk + 1 retrieveFinalResult
      const segments: string[] = [];
      let responsesReceived = 0;
      let done = false;
      let acceptEnd = 0;
      let retrieveStart = 0;
      let resultReceivedAt = 0;

      const joinSegments = (): string => segments.filter(Boolean).join(' ');

      const cleanup = (): void => {
        try { recognizer.remove(); } catch {}
      };

      // F02 — o guard só decide se o worker travou; aceita o flag `isTimeout`.
      // Em resultado normal (finish() sem argumento) resolve com o texto acumulado.
      // Em timeout (guard) REJEITA com erro controlado e libera recursos — nunca
      // resolve com texto parcial/truncado como se fosse uma inferência válida.
      const finish = (isTimeout = false) => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        if (isTimeout) {
          if (voskDebug) {
            voiceDebugLog('VOSK_TIMEOUT', {
              samples: processedPcm.length,
              originalSamples: pcm.length,
              sampleRate,
              audioDurationMs: Math.round((processedPcm.length / sampleRate) * 1000),
              acceptStart,
              resultReceivedAt,
              inferenceMs: Date.now() - acceptStart,
              timeoutMs,
              segmentsReceived: segments.length,
            });
          }
          cleanup();
          reject(new Error(`Vosk INFERENCE_TIMEOUT (guard ${timeoutMs}ms para ${Math.round((processedPcm.length / sampleRate) * 1000)}ms de áudio)`));
          return;
        }
        const inferenceEnd = Date.now();
        const text = joinSegments();
        if (voskDebug) {
          const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
          voiceDebugLog('VOSK_RESULT', {
            samples: processedPcm.length,
            originalSamples: pcm.length,
            sampleRate,
            audioDurationMs: Math.round((processedPcm.length / sampleRate) * 1000),
            acceptStart,
            acceptEnd,
            retrieveStart,
            resultReceivedAt,
            inferenceEnd,
            acceptWaveformMs: acceptEnd > 0 ? acceptEnd - acceptStart : 0,
            acceptToRetrieveMs: resultReceivedAt > 0 && acceptEnd > 0 ? resultReceivedAt - acceptEnd : 0,
            inferenceMs: inferenceEnd - acceptStart,
            timeoutMs,
            transcriptionLength: text.length,
            wordCount,
            empty: text.trim().length === 0,
            textPreview: text.slice(0, 80),
          });
        }
        cleanup();
        resolve(text);
      };

      recognizer.on('result', (msg: any) => {
        if (voskDebug && resultReceivedAt === 0) resultReceivedAt = Date.now();
        const seg = msg?.result?.text;
        if (typeof seg === 'string') {
          const trimmed = seg.trim();
          if (trimmed && trimmed !== segments[segments.length - 1]) segments.push(trimmed);
        }
        responsesReceived++;
        if (responsesReceived >= expectedResponses) finish();
      });

      recognizer.on('partialresult', () => {
        responsesReceived++;
        if (responsesReceived >= expectedResponses) finish();
      });

      recognizer.on('error', (msg: any) => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        if (voskDebug) {
          voiceDebugLog('VOSK_ERROR', {
            samples: pcm.length,
            sampleRate,
            error: msg?.error || 'unknown',
            inferenceMs: Date.now() - acceptStart,
          });
        }
        try { recognizer.remove(); } catch {}
        reject(new Error(`Vosk INFERENCE_ERROR: ${msg?.error || 'unknown'}`));
      });

      // VOZ-012.3 — F02: guard proporcional ao áudio efetivamente enviado
      // (pós trim/normalize). `timeoutMs` é rede de segurança: só dispara quando
      // o worker realmente trava; nunca controla o fluxo normal da transcrição.
      const audioDurationMs = (processedPcm.length / sampleRate) * 1000;
      const timeoutMs = computeInferenceGuardMs(audioDurationMs);
      const guard = setTimeout(() => finish(true), timeoutMs);

      for (let i = 0; i < processedPcm.length; i += chunkSize) {
        const chunk = processedPcm.subarray(i, Math.min(i + chunkSize, processedPcm.length));
        recognizer.acceptWaveformFloat(chunk, sampleRate);
      }
      acceptEnd = Date.now();
      retrieveStart = Date.now();
      if (voskDebug) {
        voiceDebugLog('VOSK_RETRIEVE', {
          samples: processedPcm.length,
          sampleRate,
          audioDurationMs: Math.round((processedPcm.length / sampleRate) * 1000),
          acceptEnd,
          retrieveStart,
          acceptToRetrieveMs: retrieveStart - acceptEnd,
          timeoutMs,
          chunks: processedPcm.length > 0 ? Math.ceil(processedPcm.length / chunkSize) : 0,
          originalSamples: pcm.length,
        });
      }
      try { recognizer.retrieveFinalResult(); } catch {}
    } catch (e: any) {
      if (isVoiceDebugEnabled()) {
        voiceDebugLog('VOSK_EXCEPTION', { error: e?.message || String(e) });
      }
      reject(new Error(`Vosk INFERENCE_ERROR: ${e?.message || e}`));
    }
  });
}

// VOZ-006 / VOZ-012.4 / VOZ-012.5 — Dispose HARD (término definitivo) do modelo Vosk.
// API pública real do vosk-browser (model.d.ts:17 / vosk.js:705):
// Model.terminate() envia {action:"terminate"} ao Worker, encerrando Worker/WASM.
// Só é seguro chamar quando nenhum KaldiRecognizer está em uso.
//
// VOZ-012.4 (F05): quem invoca este dispose é o keep-warm do engine (TTL de
// inatividade) — NÃO o dispose() do controller no unmount (que é soft/park).
// Assim o modelo não fica retido indefinidamente e o terminate() é preservado.
//
// VOZ-012.5 (F07): o dispose abre uma NOVA geração e invalida o cache em voo.
// - `modelGeneration++`: cargas iniciadas antes do dispose (em voo) tornam-se
//   obsoletas e não instalaram instância após este dispose (§5).
// - `pendingModelLoad = null`: um load que venha DEPOIS do dispose começa uma
//   carga nova/limpa (não reaviva a promise da geração anterior).
// A coordenação com o keep-warm fica no engine (isVoskModelLoading): o timer
// não executa este dispose enquanto houver carregamento em andamento (§6).
export function disposeVoskModel(): void {
  modelGeneration++;
  if (cachedModel) {
    try {
      (cachedModel as any).terminate?.();
    } catch {}
  }
  cachedModel = null;
  cachedModelId = null;
  pendingModelLoad = null;
  pendingModelLoadId = null;
}

export function isVoskSupported(): { wasm: boolean; worker: boolean } {
  return {
    wasm: typeof WebAssembly !== 'undefined',
    worker: typeof Worker !== 'undefined',
  };
}