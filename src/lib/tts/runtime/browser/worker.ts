/**
 * TTS-006 — Worker do runtime browser.
 *
 * Executa em contexto dedicado (Worker, `{ type: "module" }`). Responsável por:
 *   - carregar onnxruntime-web (WASM) com SIMD/threads conforme capability;
 *   - baixar assets (modelo ONNX, tokenizer.json, voz .bin) via fetch;
 *   - criar sessão WASM, sintetizar com o pipeline core compartilhado e
 *     devolver o AudioResult (Float32Array 24 kHz mono + WAV) ao main thread.
 *
 * NÃO toca React/DOM/Supabase/Vosk; erros públicos são TTSInputError/
 * TTSRuntimeError (nome serializado), sem expor internals do ORT.
 */

import * as ort from "onnxruntime-web";
import { TTSInputError, TTSRuntimeError } from "../../core/errors";
import { KOKORO_INFO, parseKokoroTokenizer } from "../../core/kokoro";
import { synthesizeKokoroPipeline } from "../../core/kokoro-pipeline";
import { vozzPhonemize } from "../../core/vozz-g2p";
import { BrowserAssetLoader } from "./asset-loader";
import type {
  BrowserInitPayload,
  BrowserModel,
  KokoroBrowserInfo,
  KokoroBrowserSynthResult,
  WorkerReadyPayload,
  WorkerRequest,
  WorkerResponse,
} from "./types";

function post(message: WorkerResponse, transfer?: readonly Transferable[]): void {
  const scope = globalThis as unknown as { postMessage(message: unknown, transfer?: unknown[]): void };
  if (transfer && transfer.length > 0) {
    scope.postMessage(message, [...transfer]);
  } else {
    scope.postMessage(message);
  }
}

interface WorkerScopeGlobals {
  crossOriginIsolated?: boolean;
  navigator?: { hardwareConcurrency?: number };
}

const globals = globalThis as unknown as WorkerScopeGlobals;

class BrowserWorker {
  private readonly loader = new BrowserAssetLoader();
  private session: ort.InferenceSession | null = null;
  private vocab: ReturnType<typeof parseKokoroTokenizer> | null = null;
  private styleRows: Float32Array | null = null;
  private normalizar = true;
  private model: BrowserModel = "q8";
  private voice: string = KOKORO_INFO.voiceId;
  private downloadedBytes = 0;
  private busy = false;

  async init(payload: BrowserInitPayload): Promise<void> {
    this.model = payload.model;
    this.voice = payload.voice;
    const crossOriginIsolated = globals.crossOriginIsolated === true;
    ort.env.wasm.wasmPaths = payload.wasmPaths ?? ort.env.wasm.wasmPaths;
    if (crossOriginIsolated && payload.numThreads && payload.numThreads > 1) {
      const cores = globals.navigator?.hardwareConcurrency ?? 1;
      ort.env.wasm.numThreads = Math.max(1, Math.min(Math.round(payload.numThreads), cores));
    }

    const [modelBytes, tokenizerText, voiceBytes] = await Promise.all([
      this.loader.fetchBytes(payload.assetUrls.modelUrl),
      this.loader.fetchText(payload.assetUrls.tokenizerUrl),
      this.loader.fetchBytes(payload.assetUrls.voiceUrl),
    ]);
    if (modelBytes.byteLength === 0 || voiceBytes.byteLength === 0) {
      throw new TTSRuntimeError("Asset vazio baixado (modelo ou voz).");
    }
    this.downloadedBytes =
      modelBytes.byteLength +
      voiceBytes.byteLength +
      new TextEncoder().encode(tokenizerText).byteLength;
    this.styleRows = new Float32Array(voiceBytes.buffer, voiceBytes.byteOffset, Math.floor(voiceBytes.byteLength / 4));
    if (this.styleRows.length === 0 || this.styleRows.length % 256 !== 0) {
      throw new TTSRuntimeError(`Arquivo de voz inválido (${voiceBytes.byteLength} bytes).`);
    }
    this.vocab = parseKokoroTokenizer(tokenizerText);
    this.normalizar = payload.normalizar;

    const session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    this.session = session;
  }

  async synth(text: string, speed: number | undefined): Promise<KokoroBrowserSynthResult> {
    if (this.busy) {
      throw new TTSRuntimeError("Já existe uma síntese em andamento neste worker.");
    }
    this.busy = true;
    try {
      const trimmed = String(text ?? "").trim();
      if (!trimmed) throw new TTSInputError("Texto vazio ou somente espaços não pode ser sintetizado.");
      const session = this.session;
      const vocab = this.vocab;
      const styleRows = this.styleRows;
      if (!session || !vocab || !styleRows) {
        throw new TTSRuntimeError("Runtime não carregado. Execute load() antes.");
      }
      const phonemes = vozzPhonemize(trimmed, { normalizar: this.normalizar });
      if (!phonemes.trim()) throw new TTSInputError(`Fonemização vazia para: ${trimmed}`);
      const result = await synthesizeKokoroPipeline({
        text: trimmed,
        phonemes,
        vocab: vocab.tokens,
        styleRows,
        speed: speed ?? 1,
        runChunk: {
          run: async (chunk) => {
            const inputs = {
              input_ids: new ort.Tensor("int64", chunk.paddedIds, [1, chunk.paddedIds.length]),
              style: new ort.Tensor("float32", chunk.style, [1, 256]),
              speed: new ort.Tensor("float32", chunk.speed, [1]),
            };
            const t0 = performance.now();
            const outputs = await session.run(inputs);
            const ortMs = performance.now() - t0;
            const waveform = outputs["waveform"] as ort.Tensor | undefined;
            if (!waveform) throw new TTSRuntimeError("Saída 'waveform' ausente.");
            const audio = Float32Array.from(waveform.data as Iterable<number>);
            return { audio, ortMs };
          },
        },
      });
      return {
        text: trimmed,
        audio: result.audio,
        sampleRate: result.sampleRate,
        durationSec: result.durationSec,
        wav: result.wav,
        phonemes: result.phonemes,
        ortMs: result.ortMs,
      };
    } finally {
      this.busy = false;
    }
  }

  async dispose(): Promise<void> {
    const session = this.session;
    this.session = null;
    this.vocab = null;
    this.styleRows = null;
    if (session) {
      await session.release().catch(() => undefined);
    }
  }

  readyPayload(): WorkerReadyPayload {
    const crossOriginIsolated = globals.crossOriginIsolated === true;
    const info: KokoroBrowserInfo = {
      name: "kokoro-browser",
      modelId: this.model,
      modelConfig: KOKORO_INFO.model,
      voiceId: this.voice,
      sampleRate: KOKORO_INFO.sampleRate,
      maxPhonemes: KOKORO_INFO.maxPhonemes,
      weightLicense: KOKORO_INFO.weightLicense,
      phonemizer: "vozz/g2p (Apache-2.0, JS puro, sem espeak-ng)",
      g2pLicense: "Apache-2.0",
      normalizer: "vozz/normalize (Apache-2.0)",
      onnxRuntime: ort.env.versions.common ?? "1.29.0",
      device: "wasm",
    };
    return {
      info,
      ortVersion: ort.env.versions.common ?? "1.29.0",
      downloadedBytes: this.downloadedBytes,
      threads: crossOriginIsolated,
      simd: ort.env.wasm.simd !== false,
      cores: globals.navigator?.hardwareConcurrency ?? 1,
    };
  }
}

const worker = new BrowserWorker();

(globalThis as unknown as { onmessage: (event: MessageEvent) => void }).onmessage = async (event: MessageEvent): Promise<void> => {
  const message = event.data as WorkerRequest;
  try {
    switch (message.kind) {
      case "init": {
        await worker.init(message.payload);
        post({ kind: "ready", id: message.id, payload: worker.readyPayload() });
        break;
      }
      case "synth": {
        const result = await worker.synth(message.payload.text, message.payload.speed);
        post(
          { kind: "synth-result", id: message.id, payload: result },
          [result.audio.buffer, result.wav.buffer],
        );
        break;
      }
      case "dispose": {
        await worker.dispose();
        post({ kind: "disposed", id: message.id });
        break;
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    post({ kind: "error", id: message.id, payload: { name: err.name, message: err.message } });
  }
};