/**
 * TTS-INTEGRATION-001 — Consumer Boundary types
 *
 * Contratos locais do consumidor. Não duplicam desnecessariamente tipos do engine;
 * quando possível, reexportam tipos públicos de `voice-synthesis` via `import type`.
 * Mantêm o motor desacoplado: o consumidor conhece apenas `TtsService` e `AudioResult`.
 */

// Reexporta AudioResult como tipo público do engine quando usado como tipo (sem runtime).
// O import é type-only e não gera dependência de runtime; o adapter faz dynamic import.
export type AudioResult = {
  readonly samples: Float32Array
  readonly sampleRate: number
  readonly channels: number
  readonly durationSec: number
  readonly wav: Uint8Array
  readonly text: string
}

export type TtsState = "UNINITIALIZED" | "LOADING" | "READY" | "SYNTHESIZING" | "DISPOSED"

export type TtsErrorCode =
  | "NOT_SUPPORTED"
  | "NOT_READY"
  | "LOAD_FAILED"
  | "SYNTHESIS_FAILED"
  | "INVALID_TEXT"
  | "CANCELLED"
  | "DISPOSED"
  | "BUSY"

export class TtsError extends Error {
  public readonly code: TtsErrorCode
  constructor(code: TtsErrorCode, message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = "TtsError"
    this.code = code
    if (options?.cause) this.cause = options.cause
  }
}

export interface TtsService {
  /** Estado atual — leitura síncrona */
  getState(): TtsState
  /** True se o ambiente suporta TTS (Node ≥18 ou Browser com Audio) */
  isSupported(): boolean
  /** Carrega tokenizer, voicepack, ORT session. Idempotente. */
  load(): Promise<void>
  /** Texto → AudioResult. Rejeita se NOT_READY/DISPOSED. */
  synthesize(text: string): Promise<AudioResult>
  /** Libera ORT session. Idempotente; permite load() novamente. */
  dispose(): Promise<void>
}

export interface CreateTtsOptions {
  readonly model?: "q8" | "fp32"
  readonly voice?: string
  // Node: caminho para modelsDir; Browser: ignorado (assets/PAD)
  readonly modelsDir?: string
  /** Seleção explícita de runtime (testes). Padrão: "auto" por ambiente. */
  readonly runtimeKind?: "browser" | "node"
  /** Passthrough para KokoroBrowserRuntime quando o runtime é o browser. */
  readonly browser?: TtsBrowserRuntimeOptions
  /** ModelManager injetado (testes); se omitido, cria default com origin configurável. */
  readonly modelManager?: unknown
  /** Origem HTTPS do pacote do modelo (ex.: https://cdn.example/tts); se omitido usa NEXT_PUBLIC_TTS_ASSETS_ORIGIN ou same-origin. */
  readonly modelOrigin?: string
}

/**
 * TTS-INTEGRATION-007 — Options do runtime browser consumidas pelo adapter.
 * Mapeiam 1:1 para `KokoroBrowserRuntimeOptions` (voice-synthesis), com
 * DEFAULTs relativos ao app para servir os assets no ambiente do Chat:
 *  - baseUrl:  "/api/tts/models/"  (model_quantized.onnx, tokenizer.json, voices/*.bin)
 *  - wasmPaths:"/api/tts/wasm/"    (.wasm do onnxruntime-web)
 *  - workerUrl:"/tts/worker.js"    (bundle do worker gerado no build do app)
 * Sobrescrevíveis por ambiente/testes (ex.: workerFactory fake).
 */
export interface TtsBrowserRuntimeOptions {
  readonly baseUrl?: string
  readonly wasmPaths?: string
  readonly workerUrl?: string
  readonly numThreads?: number
  readonly workerFactory?: (() => Worker) | undefined
}

export type TtsRuntimeKind = "browser" | "node"
