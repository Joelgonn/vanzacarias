/**
 * TTS-006 — Runtime Kokoro no browser (main thread).
 *
 * Proxy que fala com `worker.ts` via mensagens estruturadas e devolve o mesmo
 * contrato público do runtime Node (`TTSRuntime`): `load()` idempotente,
 * `synthesize()` serializada, `dispose()` seguro e reload pós-dispose.
 * O AudioResult sai do worker via structured clone + transfer list
 * (Float32Array 24 kHz mono + WAV PCM16).
 *
 * onnxruntime-web NUNCA é importado no main thread — só no worker, isolando
 * WASM/pesos da main thread.
 */

import { TTSInputError, TTSRuntimeError } from "../../core/errors";
import { KOKORO_INFO, kokoroModelFileFor } from "../../core/kokoro";
import type { TTSRuntimeInfo } from "../../engine/types";
import type {
  BrowserCapabilities,
  BrowserInitPayload,
  BrowserRuntimeState,
  KokoroBrowserInfo,
  KokoroBrowserRuntimeOptions,
  KokoroBrowserSynthResult,
  WorkerRequest,
  WorkerResponse,
} from "./types";

const DEFAULT_DEVICE = "wasm";

/** Capabilities observáveis no ambiente atual (antes do worker reportar). */
export function detectBrowserCapabilities(): BrowserCapabilities {
  const globals = globalThis as unknown as { crossOriginIsolated?: boolean; navigator?: { hardwareConcurrency?: number } };
  return {
    worker: typeof Worker !== "undefined",
    threads: globals.crossOriginIsolated === true,
    simd: typeof WebAssembly !== "undefined",
    cores: globals.navigator?.hardwareConcurrency ?? 1,
  };
}

function rehydrateError(name: string, message: string): Error {
  if (name === "TTSInputError") return new TTSInputError(message);
  return new TTSRuntimeError(message);
}

interface PendingSynth {
  readonly resolve: (result: KokoroBrowserSynthResult) => void;
  readonly reject: (error: unknown) => void;
}

export class KokoroBrowserRuntime {
  private readonly model: "fp32" | "q8";
  private readonly voice: string;
  private readonly normalizar: boolean;
  private readonly baseUrl: string | undefined;
  private readonly assetUrls: { readonly modelUrl: string; readonly tokenizerUrl: string; readonly voiceUrl: string };
  private readonly workerUrl: string | undefined;
  private readonly numThreads: number | undefined;
  private readonly wasmPaths: string | undefined;
  private readonly workerFactory: (() => Worker) | undefined;
  private readonly logger: (line: string) => void;

  private _state: BrowserRuntimeState = "UNINITIALIZED";
  private worker: Worker | null = null;
  private initPending: { readonly id: number; readonly resolve: () => void; readonly reject: (reason?: unknown) => void } | null = null;
  private initPromise: Promise<void> | null = null;
  private pending = new Map<number, PendingSynth>();
  private synthTail: Promise<unknown> = Promise.resolve();
  private infoCurrent: KokoroBrowserInfo;
  private capabilitiesCurrent: BrowserCapabilities;
  private nextId = 1;

  constructor(options: KokoroBrowserRuntimeOptions = {}) {
    this.model = options.model ?? "q8";
    this.voice = options.voice ?? KOKORO_INFO.voiceId;
    this.normalizar = options.normalizar ?? true;
    this.baseUrl = options.baseUrl;
    this.workerUrl = options.workerUrl;
    this.numThreads = options.numThreads;
    this.wasmPaths = options.wasmPaths;
    this.workerFactory = options.workerFactory;
    this.logger = options.logger ?? (() => undefined);

    const base = this.baseUrl;
    const resolveAsset = (path: string) => (base ? new URL(path, base).href : path);
    this.assetUrls = {
      modelUrl: options.assetUrls?.modelUrl ?? resolveAsset(kokoroModelFileFor(this.model)),
      tokenizerUrl: options.assetUrls?.tokenizerUrl ?? resolveAsset("tokenizer.json"),
      voiceUrl: options.assetUrls?.voiceUrl ?? resolveAsset(`voices/${this.voice}.bin`),
    };
    this.infoCurrent = {
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
      onnxRuntime: "n/a",
      device: DEFAULT_DEVICE,
    };
    this.capabilitiesCurrent = detectBrowserCapabilities();
  }

  get info(): TTSRuntimeInfo {
    return this.infoCurrent;
  }

  get state(): BrowserRuntimeState {
    return this._state;
  }

  get capabilities(): BrowserCapabilities {
    return this.capabilitiesCurrent;
  }

  get isLoaded(): boolean {
    return this._state === "READY";
  }

  static isSupported(): boolean {
    return typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
  }

  async load(): Promise<void> {
    if (this._state === "READY" || this._state === "SYNTHESIZING") return;
    if (this.initPromise) return this.initPromise;
    // DISPOSED não é terminal neste runtime: load() recria o worker (reload pós-dispose).

    const worker = this.createWorker();
    this.worker = worker;
    this._state = "LOADING";

    const id = this.nextId++;
    const initPromise = new Promise<void>((resolve, reject) => {
      this.initPending = { id, resolve, reject };
    });
    this.initPromise = initPromise;

    worker.onmessage = (event) => {
      this.handleMessage(event.data as WorkerResponse);
    };
    worker.onerror = (event) => {
      const init = this.initPending;
      this.initPending = null;
      this.initPromise = null;
      if (init && worker === this.worker) {
        this._state = "UNINITIALIZED";
        init.reject(new TTSRuntimeError(`Erro do worker: ${event.message ?? "desconhecido"}`));
      }
    };

    const payload: BrowserInitPayload = {
      model: this.model,
      voice: this.voice,
      normalizar: this.normalizar,
      assetUrls: this.assetUrls,
      wasmPaths: this.wasmPaths,
      numThreads: this.numThreads,
    };
    const request: WorkerRequest = { kind: "init", id, payload };
    worker.postMessage(request);
    return initPromise;
  }

  async synthesize(text: string, opts: { speed?: number } = {}): Promise<KokoroBrowserSynthResult> {
    if (this._state === "DISPOSED") {
      throw new TTSRuntimeError("Runtime descartado. Execute load() para recriar.");
    }
    await this.load();
    return this.enqueue({ text, speed: opts.speed ?? 1 });
  }

  async dispose(): Promise<void> {
    const worker = this.worker;
    this.worker = null;
    this._state = "DISPOSED";

    const init = this.initPending;
    this.initPending = null;
    this.initPromise = null;
    if (init) init.reject(new TTSRuntimeError("Runtime descartado durante o carregamento."));
    this.rejectPending(new TTSRuntimeError("Síntese cancelada pelo dispose."));

    if (!worker) return;

    const disposed = new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        windowClearTimeout(timer);
        worker.removeEventListener("message", onMessage as EventListener);
        worker.removeEventListener("error", onError);
        resolve();
      };
      const onMessage = (event: unknown) => {
        const data = (event as MessageEvent).data as WorkerResponse;
        if (data?.kind === "disposed") finish();
      };
      const onError = () => finish();
      const timer = windowSetTimeout(finish, 3000);
      worker.addEventListener("message", onMessage as EventListener);
      worker.addEventListener("error", onError);
      const request: WorkerRequest = { kind: "dispose", id: this.nextId++ };
      worker.postMessage(request);
    });
    await disposed;
    worker.terminate();
  }

  private createWorker(): Worker {
    if (this.workerFactory) return this.workerFactory();
    if (typeof Worker === "undefined") {
      throw new TTSRuntimeError("Worker não suportado neste ambiente. Browser Runtime indisponível.");
    }
    const url = this.workerUrl ?? "/tts/worker.js";
    return new Worker(url, { type: "module" });
  }

  private enqueue(request: { readonly text: string; readonly speed: number }): Promise<KokoroBrowserSynthResult> {
    const run = () => this.runSynthesis(request);
    const next = this.synthTail.then(run, run);
    this.synthTail = next.catch(() => undefined);
    return next;
  }

  private async runSynthesis(request: { readonly text: string; readonly speed: number }): Promise<KokoroBrowserSynthResult> {
    const worker = this.worker;
    if (!worker || this._state === "DISPOSED") {
      throw new TTSRuntimeError("Runtime não carregado. Execute load() antes.");
    }
    const id = this.nextId++;
    const promise = new Promise<KokoroBrowserSynthResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this._state = "SYNTHESIZING";
    const message: WorkerRequest = { kind: "synth", id, payload: request };
    try {
      worker.postMessage(message);
      const result = await promise;
      if (this._state === "SYNTHESIZING") this._state = "READY";
      return result;
    } catch (error) {
      if (this._state === "SYNTHESIZING") this._state = "READY";
      throw error;
    }
  }

  private handleMessage(message: WorkerResponse): void {
    switch (message.kind) {
      case "ready": {
        const init = this.initPending;
        this.initPending = null;
        this.initPromise = null;
        if (message.id === init?.id) {
          this.infoCurrent = message.payload.info;
          this.capabilitiesCurrent = {
            worker: true,
            threads: message.payload.threads,
            simd: message.payload.simd,
            cores: message.payload.cores,
          };
          this._state = "READY";
          this.logger(
            `[kokoro-browser] ready: ${message.payload.downloadedBytes} bytes, ort ${message.payload.ortVersion}, threads=${message.payload.threads}, simd=${message.payload.simd}`,
          );
          init.resolve();
        }
        break;
      }
      case "synth-result": {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.resolve(message.payload);
        }
        break;
      }
      case "error": {
        const error = rehydrateError(message.payload.name, message.payload.message);
        const init = this.initPending;
        if (message.id === init?.id) {
          this.initPending = null;
          this.initPromise = null;
          this._state = "UNINITIALIZED";
          init.reject(error);
          break;
        }
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.reject(error);
        }
        break;
      }
      case "disposed": {
        break;
      }
    }
  }

  private rejectPending(error: Error): void {
    for (const [, pending] of this.pending) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function windowSetTimeout(handler: TimerHandler, timeout?: number): number {
  return globalThis.setTimeout(handler, timeout) as unknown as number;
}

function windowClearTimeout(id: number): void {
  globalThis.clearTimeout(id);
}