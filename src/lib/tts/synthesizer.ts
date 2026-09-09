/**
 * TTS-INTEGRATION-001/007 — Consumer Boundary Adapter
 *
 * Camada consumidora que encapsula `voice-synthesis` sem expor seus internals.
 * Dependência: `vanzacariasnutri → voice-synthesis` (file:../voice-synthesis).
 * O engine não conhece ChatAssistant, Vosk, React, Supabase, etc.
 *
 * TTS-INTEGRATION-007 (D01/D02/D05/D06):
 *  - Seleção de runtime por ambiente: browser → `KokoroBrowserRuntime`
 *    (WORKER real + onnxruntime-web/WASM), Node → `KokoroVozzRuntime`
 *    (onnxruntime-node). NUNCA `onnxruntime-node` no bundle client.
 *  - O import do entry Node usa o comentário webpackIgnore no dynamic import
 *    para que o webpack do client não transforme o graph do engine Node em
 *    chunk (client sem onnxruntime-node / node:fs / bindings nativos — D04/D22).
 *  - O Chat nunca vê Worker/ONNX/Kokoro/vozz: apenas TtsService + AudioResult.
 *  - Assets do browser servidos pelo app (route handler) com defaults
 *    baseUrl="/api/tts/models/" e wasmPaths="/api/tts/wasm/", worker em
 *    "/tts/worker.js" (gerado no build). Sobrescrevíveis via options.browser.
 *
 * Lazy loading: `voice-synthesis` só é importado dentro de `load()` via dynamic
 * import, nunca no top-level, para evitar inclusão do modelo/ONNX no bundle SSR.
 *
 * Lifecycle: UNINITIALIZED → LOADING → READY → SYNTHESIZING → READY → DISPOSED
 * Concorrência: delegada ao engine (serialização interna); o adapter não cria fila.
 * Erros: preservados como TtsError sem conversão para erros de Chat/UI.
 */

import type { AudioResult, CreateTtsOptions, TtsRuntimeKind, TtsService, TtsState } from "./types"
import { TtsError } from "./types"

// Tipo interno do engine (não exposto ao consumidor)
type EngineInstance = {
  load(): Promise<void>
  synthesize(text: string, opts?: { speed?: number }): Promise<{
    text: string
    audio?: Float32Array
    samples?: Float32Array
    sampleRate: number
    durationSec: number
    wav: Uint8Array
  }>
  dispose(): Promise<void>
  readonly isLoaded: boolean
}

/**
 * TTS-INTEGRATION-007 — Detecção pura do runtime conforme o ambiente.
 * Browser exige: window + Worker + WebAssembly. Caso contrário → Node.
 * SSR (sem window e sem process) cai em "node"; `load()` em SSR não é invocado.
 */
export function detectRuntimeKind(): TtsRuntimeKind {
  const hasWindow = typeof window !== "undefined"
  const hasWorker = typeof Worker !== "undefined"
  const hasWasm = typeof WebAssembly !== "undefined"
  if (hasWindow && hasWorker && hasWasm) return "browser"
  return "node"
}

// Defaults dos assets do ambiente web do Chat (D05) — documentados no relatório.
// baseUrl precisa ser ABSOLUTA: o Browser Runtime resolve os assets com
// `new URL(path, base)` (contrato do engine), que exige base absoluta.
// wasmPaths/workerUrl são caminhos (não passam por new URL) e seguem relativos.
const BROWSER_ASSET_DEFAULTS = {
  baseUrl: "/api/tts/models/",
  wasmPaths: "/api/tts/wasm/",
  workerUrl: "/tts/worker.js",
} as const

// TTS-CAP-002 — Capacitor/Android: assets LOCAIS empacotados no APK sob
// /assets/tts/** (copiados no sync pelo scripts/prepare-tts-android-assets.mjs,
// gitignored → não vão ao deploy web). Web/PWA mantém os defaults acima.
const NATIVE_ASSET_DEFAULTS = {
  baseUrl: "/assets/tts/",
  wasmPaths: "/assets/tts/wasm/",
  workerUrl: "/assets/tts/worker.js",
} as const

type CapacitorLike = { isNativePlatform?: () => boolean; getPlatform?: () => string } | undefined

/** Detecção explícita de runtime nativo Capacitor (não por hostname). */
export function detectNativeCapacitor(): boolean {
  if (typeof window === "undefined") return false
  const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor
  if (!cap) return false
  if (typeof cap.isNativePlatform === "function") {
    try {
      if (cap.isNativePlatform() === true) return true
    } catch {}
  }
  const platform = typeof cap.getPlatform === "function" ? cap.getPlatform() : "web"
  return platform !== "web" && platform !== ""
}

function absoluteAssetBase(relBase: string | undefined): string {
  if (relBase) {
    try {
      // Garante base absoluta mesmo que o chamador passe caminho relativo.
      return new URL(relBase, typeof location !== "undefined" ? location.href : undefined).href
    } catch {
      return relBase
    }
  }
  const origin = typeof location !== "undefined" && location.origin ? location.origin : ""
  return `${origin}${BROWSER_ASSET_DEFAULTS.baseUrl}`
}

export function createTtsService(options: CreateTtsOptions = {}): TtsService {
  let state: TtsState = "UNINITIALIZED"
  let engine: EngineInstance | null = null
  let loadPromise: Promise<void> | null = null
  // Serialização delegada ao engine, mas guardamos promise para getState
  let synthPromise: Promise<AudioResult> | null = null

  const kind: TtsRuntimeKind | "auto" = options.runtimeKind ?? "auto"
  const useBrowser = kind === "browser" || (kind === "auto" && detectRuntimeKind() === "browser")

  const isSupported = (): boolean => {
    if (useBrowser) {
      // Worker injetado (testes) ⇒ capacidade assegurada pelo caller.
      if (options.browser?.workerFactory) return true
      return typeof Worker !== "undefined" && typeof WebAssembly !== "undefined"
    }
    // Node ≥18
    if (typeof process !== "undefined" && process.versions?.node) {
      const major = parseInt(process.versions.node.split(".")[0]!, 10)
      return major >= 18
    }
    if (typeof window !== "undefined" && typeof WebAssembly !== "undefined") return true
    // SSR: sem window/process → não suportado (evita carregar ONNX no servidor)
    if (typeof window === "undefined" && typeof process === "undefined") return false
    return true
  }

  const getState = (): TtsState => state

  const load = async (): Promise<void> => {
    if (state === "READY" || state === "SYNTHESIZING") return
    if (state === "LOADING" && loadPromise) return loadPromise
    if (state === "DISPOSED") {
      // Permite reload após dispose (on-demand)
      state = "UNINITIALIZED"
      engine = null
    }
    if (!isSupported()) {
      throw new TtsError("NOT_SUPPORTED", "TTS não suportado neste ambiente")
    }
    state = "LOADING"
    loadPromise = (async () => {
      try {
        if (useBrowser) {
          const brow = options.browser
          const mod = await import("voice-synthesis/dist/src/runtime/browser/index.js")
          const origin = typeof location !== "undefined" && location.origin ? location.origin : ""
          const native = detectNativeCapacitor()
          const defaults = native ? NATIVE_ASSET_DEFAULTS : BROWSER_ASSET_DEFAULTS
          const runtime = new mod.KokoroBrowserRuntime({
            model: options.model ?? "q8",
            voice: options.voice ?? "pf_dora",
            normalizar: true,
            baseUrl: brow?.baseUrl ?? (native ? `${origin}${NATIVE_ASSET_DEFAULTS.baseUrl}` : absoluteAssetBase(undefined)),
            wasmPaths: brow?.wasmPaths ?? defaults.wasmPaths,
            workerUrl: brow?.workerUrl ?? defaults.workerUrl,
            numThreads: brow?.numThreads,
            workerFactory: brow?.workerFactory,
          })
          engine = runtime as unknown as EngineInstance
          await runtime.load()
        } else {
          // webpackIgnore: no client, o webpack NÃO processa o graph do engine
          // Node (onnxruntime-node/node:fs). No Node (vitest/SSR) resolve o pacote real.
          const mod = await import(/* webpackIgnore: true */ "voice-synthesis/dist/src/index.js")
          const modelsDir =
            options.modelsDir ??
            // Heurística Node: tenta resolver a partir do cwd ou do pacote
            (typeof process !== "undefined" && process.cwd ? `${process.cwd()}/../voice-synthesis/models` : undefined) ??
            // Fallback para testes: tenta CWD/voice-synthesis/models e CWD/../voice-synthesis/models
            undefined
          const { KokoroVozzRuntime } = mod
          const RuntimeCtor = KokoroVozzRuntime as unknown as new (opts: {
            modelsDir: string
            model: string
            voice: string
          }) => EngineInstance
          const runtime = new RuntimeCtor({
            modelsDir: modelsDir ?? "C:/Users/joelg/Documents/Vanusa/voice-synthesis/models",
            model: options.model ?? "q8",
            voice: options.voice ?? "pf_dora",
          })
          engine = runtime
          await runtime.load()
        }
        state = "READY"
      } catch (e) {
        state = "UNINITIALIZED"
        engine = null
        const msg = e instanceof Error ? e.message : String(e)
        throw new TtsError("LOAD_FAILED", `Falha ao carregar TTS: ${msg}`, { cause: e })
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  }

  const synthesize = async (text: string): Promise<AudioResult> => {
    const trimmed = String(text ?? "").trim()
    if (!trimmed) throw new TtsError("INVALID_TEXT", "Texto vazio não pode ser sintetizado")
    if (state === "DISPOSED") throw new TtsError("DISPOSED", "TTS já foi descartado")
    if (state === "UNINITIALIZED" || state === "LOADING" || !engine) {
      throw new TtsError("NOT_READY", "TTS não está pronto. Chame load() antes de synthesize()")
    }
    // Serialização delegada ao engine: se já sintetizando, aguarda
    // (KokoroVozzRuntime serializa via OrtSession; KokoroBrowserRuntime via fila interna)
    state = "SYNTHESIZING"
    const p = (async (): Promise<AudioResult> => {
      try {
        const res = await engine!.synthesize(trimmed)
        const samples = res.audio ?? res.samples
        if (!samples) throw new TtsError("SYNTHESIS_FAILED", "Engine não devolveu samples")
        const result: AudioResult = {
          samples,
          sampleRate: res.sampleRate,
          channels: 1,
          durationSec: res.durationSec,
          wav: res.wav,
          text: res.text,
        }
        state = "READY"
        return result
      } catch (e) {
        // Preserva erros do engine sem converter para Chat/UI
        if (e instanceof Error && e.name === "TTSInputError") {
          state = "READY"
          throw new TtsError("INVALID_TEXT", e.message, { cause: e })
        }
        if (e instanceof Error && e.name === "TTSRuntimeError") {
          const msg = e.message
          if (msg.includes("não carregado") || msg.includes("NOT_READY")) {
            state = "READY"
            throw new TtsError("NOT_READY", msg, { cause: e })
          }
          state = "READY"
          throw new TtsError("SYNTHESIS_FAILED", `Falha na síntese: ${msg}`, { cause: e })
        }
        state = "READY"
        throw new TtsError("SYNTHESIS_FAILED", e instanceof Error ? e.message : String(e), { cause: e })
      } finally {
        synthPromise = null
        if (state === "SYNTHESIZING") state = "READY"
      }
    })()
    synthPromise = p
    return p
  }

  const dispose = async (): Promise<void> => {
    if (state === "DISPOSED") return
    if (synthPromise) {
      try {
        await synthPromise
      } catch {}
    }
    if (loadPromise) {
      try {
        await loadPromise
      } catch {}
    }
    if (engine) {
      try {
        await engine.dispose()
      } catch {}
      engine = null
    }
    state = "DISPOSED"
  }

  return { getState, isSupported, load, synthesize, dispose }
}

// Re-export para conveniência do consumidor
export type { AudioResult, TtsState } from "./types"