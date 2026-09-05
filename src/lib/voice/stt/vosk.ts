// VOZ-004 / VOZ-004-R4 — Vosk PT-BR PoC isolado (não integra ChatAssistant)
// - Local/offline, sem /api/stt, sem upload, sem Supabase
//

import { isVoiceDebugEnabled, voiceDebugLog, computePcmStats } from '../debug';
import { normalizePcm, trimSilence } from '../audio/normalize';
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
    url: '/vosk-model-small-pt-0.3.tar.gz',
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

export async function loadVoskModel(modelId: VoskModelId = 'small-pt-0.3', onProgress?: (p: number) => void): Promise<any> {
  if (cachedModel && cachedModelId === modelId) return cachedModel;
  const Vosk = await loadVoskBrowser();
  const modelInfo = VOSK_MODELS[modelId];
  // Modelo local exclusivamente (privacy/local-only R4): GET /vosk-model-small-pt-0.3.tar.gz
  // é fetado pelo Worker (mesma origem). Nenhum fallback remoto.
  const model = new Vosk.Model(modelInfo.url);
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
  cachedModel = modelRef;
  cachedModelId = modelId;
  return modelRef;
}

let cachedModel: any = null;
let cachedModelId: string | null = null;

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

      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        const inferenceEnd = Date.now();
        const text = joinSegments();
        if (voskDebug) {
          const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
          voiceDebugLog('VOSK_RESULT', {
            samples: processedPcm.length,
            originalSamples: pcm.length,
            sampleRate,
            acceptStart,
            acceptEnd,
            retrieveStart,
            resultReceivedAt,
            inferenceEnd,
            acceptWaveformMs: acceptEnd > 0 ? acceptEnd - acceptStart : 0,
            acceptToRetrieveMs: retrieveStart > 0 && acceptEnd > 0 ? retrieveStart - acceptEnd : 0,
            inferenceMs: inferenceEnd - acceptStart,
            transcriptionLength: text.length,
            wordCount,
            empty: text.trim().length === 0,
            textPreview: text.slice(0, 80),
          });
        }
        try { recognizer.remove(); } catch {}
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

      // Segurança: nunca pendura por mais de 30s.
      const guard = setTimeout(() => finish(), 30000);

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
          acceptEnd,
          retrieveStart,
          acceptToRetrieveMs: retrieveStart - acceptEnd,
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

// VOZ-006 — Dispose completo do modelo Vosk.
// API pública real do vosk-browser (model.d.ts:17 / vosk.js:705):
// Model.terminate() envia {action:"terminate"} ao Worker, encerrando Worker/WASM.
// Só é seguro chamar quando nenhum KaldiRecognizer está em uso.
export function disposeVoskModel(): void {
  if (cachedModel) {
    try {
      (cachedModel as any).terminate?.();
    } catch {}
  }
  cachedModel = null;
  cachedModelId = null;
}

export function isVoskSupported(): { wasm: boolean; worker: boolean } {
  return {
    wasm: typeof WebAssembly !== 'undefined',
    worker: typeof Worker !== 'undefined',
  };
}