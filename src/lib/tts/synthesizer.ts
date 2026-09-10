/**
 * TTS-CAP-004 FASE 1 — Consumer Boundary Adapter (runtime vendado)
 *
 * Camada consumidora sem dependência de `voice-synthesis` (file:../voice-synthesis
 * removido). Runtime browser vendado em `src/lib/tts/runtime/browser/*` +
 * `src/lib/tts/core/*` + `src/lib/tts/wav.ts` + `src/lib/tts/engine/types.ts`
 * — fontes Apache-2.0 (Kokoro, vozz) preservadas.
 *
 * TTS-INTEGRATION-007 preservado (D01/D02/D05/D06) mas sem branch Node:
 *  - Browser → `KokoroBrowserRuntime` (Worker + onnxruntime-web/WASM).
 *  - Node/SSR → NOT_SUPPORTED (sem onnxruntime-node). `isSupported()` reflete
 *    apenas capacidade browser; testes Node usam `workerFactory` injetada.
 *  - O Chat nunca vê Worker/ONNX/Kokoro/vozz: apenas TtsService + AudioResult.
 *  - Assets do browser servidos pelo app com defaults
 *    baseUrl="/api/tts/models/" e wasmPaths="/api/tts/wasm/", worker
 *    "/tts/worker.js" (gerado no build). Sobrescrevíveis via options.browser.
 *
 * Lazy loading: runtime browser só é importado dentro de `load()` via dynamic
 * import, nunca no top-level, para evitar inclusão de onnxruntime-web no bundle SSR.
 *
 * Lifecycle: UNINITIALIZED → LOADING → READY → SYNTHESIZING → READY → DISPOSED
 * Concorrência: delegada ao engine (serialização interna); o adapter não cria fila.
 * Erros: preservados como TtsError sem conversão para erros de Chat/UI.
 */

import type { AudioResult, CreateTtsOptions, TtsRuntimeKind, TtsService, TtsState } from "./types"
import { TtsError } from "./types"
import { createModelManager, type ModelManager } from "./model/modelManager"
import { getTtsModelOrigin } from "./model/config"

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
  wasmPaths: "/tts/wasm/",
  workerUrl: "/tts/worker.js",
} as const

// TTS-CAP-002 — Capacitor/Android: assets LOCAIS empacotados no APK sob
// /assets/tts/** (copiados no sync pelo scripts/prepare-tts-android-assets.mjs,
// gitignored → não vão ao deploy web). Web/PWA mantém os defaults acima.
const NATIVE_ASSET_DEFAULTS = {
  baseUrl: "/assets/tts/",
  wasmPaths: "/tts/wasm/",
  workerUrl: "/tts/worker.js",
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

  // FASE 2: ModelManager injetado ou criado com origin configurável
  const modelManager: ModelManager =
    (options.modelManager as ModelManager | undefined) ??
    createModelManager({ origin: options.modelOrigin ?? getTtsModelOrigin() })

  const kind: TtsRuntimeKind | "auto" = options.runtimeKind ?? "auto"
  const useBrowser = kind === "browser" || (kind === "auto" && detectRuntimeKind() === "browser")

  const isSupported = (): boolean => {
    // FASE 1: apenas browser (Worker+WASM) é suportado em produção.
    // Node/SSR sem workerFactory → NOT_SUPPORTED (sem onnxruntime-node).
    if (options.browser?.workerFactory) return true
    if (useBrowser) {
      return typeof Worker !== "undefined" && typeof WebAssembly !== "undefined"
    }
    // runtimeKind auto em Node (vitest) sem workerFactory → não suportado (precisa fake)
    return false
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
        if (!useBrowser) {
          throw new TtsError("NOT_SUPPORTED", "TTS Node (onnxruntime-node) removido na FASE 1 — apenas browser é suportado")
        }
        // KO-000.0: restaura caminho PoC — assets locais no bundle, sem Filesystem/Base64.
        // No Android nativo (Capacitor), o modelo já está em /assets/tts/ (bundled APK),
        // portanto não há download nem Filesystem. No Web, mantém download sob demanda
        // mas apenas quando não for nativo e não for teste fake.
        const isNativeForTts = detectNativeCapacitor()
        const isTestFake = !!options.browser?.workerFactory && !options.modelManager
        // Bypass total do ModelManager quando houver assets locais (Android nativo)
        const shouldEnsureModel = !isNativeForTts && !isTestFake
        if (shouldEnsureModel) {
          try {
            await modelManager.ensureAvailable()
          } catch (e) {
            const code = (e as { code?: string })?.code
            if (code === "MODEL_ABORTED") throw new TtsError("CANCELLED", "Download do modelo cancelado", { cause: e })
            if (code === "MODEL_INTEGRITY_FAILED") throw new TtsError("LOAD_FAILED", `Integridade do modelo falhou: ${(e as Error).message}`, { cause: e })
            if (code === "MODEL_DOWNLOAD_FAILED" || code === "MODEL_NOT_FOUND" || code === "MODEL_STORAGE_FAILED")
              throw new TtsError("LOAD_FAILED", `Falha no modelo: ${(e as Error).message}`, { cause: e })
            throw e
          }
        } else if (isNativeForTts) {
          // Android local: nada a baixar — assets já no bundle (AC-01, AC-08)
        } else {
          // Teste fake sem ModelManager: considera disponível
        }

        const brow = options.browser
        const mod = await import("./runtime/browser/index")
        const origin = typeof location !== "undefined" && location.origin ? location.origin : ""
        const native = detectNativeCapacitor()
        const defaults = native ? NATIVE_ASSET_DEFAULTS : BROWSER_ASSET_DEFAULTS
        // Se modelManager tem origin configurada (ex.: http://fixture.test ou CDN), usa como base para o worker
        // KO-000.0: no Android nativo, bypass ModelManager/Filesystem (AC-01). O Worker faz fetch direto
        // do origin (GitHub raw por padrão), sem base64. localhost falhou com server.url remoto (Vercel),
        // então nativo também usa managerOrigin (GitHub raw 92MB, 200 OK) — sem Filesystem.
        const managerOrigin = (modelManager as unknown as { getOrigin?: () => string })?.getOrigin?.() ?? ""
        const effectiveBaseUrl =
          brow?.baseUrl ??
          (managerOrigin ? (managerOrigin.endsWith("/") ? managerOrigin : `${managerOrigin}/`) : native ? "https://localhost/assets/tts/" : absoluteAssetBase(undefined))
        const runtime = new mod.KokoroBrowserRuntime({
          model: options.model ?? "q8",
          voice: options.voice ?? "pf_dora",
          normalizar: true,
          baseUrl: effectiveBaseUrl,
          wasmPaths: brow?.wasmPaths ?? defaults.wasmPaths,
          workerUrl: brow?.workerUrl ?? defaults.workerUrl,
          numThreads: brow?.numThreads,
          workerFactory: brow?.workerFactory,
        })
        engine = runtime as unknown as EngineInstance
        await runtime.load()
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
    // FASE 2: cancela download em andamento se TTS for desativado durante fetch
    try {
      ;(modelManager as unknown as { abort?: () => void })?.abort?.()
    } catch {}
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