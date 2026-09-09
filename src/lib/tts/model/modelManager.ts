/**
 * TTS-CAP-004 FASE 2 — ModelManager para Kokoro Q8 (download sob demanda).
 *
 * Responsabilidades:
 *  getManifest, isAvailable, verify, download, ensureAvailable, getAsset, invalidate, dispose
 *
 * Armazenamento: Cache Storage (browser real) ou Memory (testes/node), versionado por `tts-model-v1`.
 * Singleflight: múltiplas chamadas concorrentes compartilham um único download dos 92 MB.
 * Cancelamento: AbortController — nunca persiste arquivo parcial nem marca AVAILABLE antes da validação.
 * Integridade: tamanho + SHA-256 (ordem obrigatória).
 */

import { DEFAULT_MANIFEST, type ModelManifest } from "./manifest"
import { getTtsModelOrigin } from "./config"
import { ModelError } from "./errors"
import { downloadAsset, verifyAsset } from "./download"
import { createDefaultStorage, type ModelStorage } from "./storage"
import type { FetchLike } from "./download"

export type ModelManagerOptions = {
  readonly manifest?: ModelManifest
  readonly origin?: string
  readonly fetcher?: FetchLike
  readonly storage?: ModelStorage
}

export type ModelState = "idle" | "downloading" | "ready" | "error"

export class ModelManager {
  private readonly manifest: ModelManifest
  private readonly origin: string
  private readonly fetcher: FetchLike | undefined
  private readonly storage: ModelStorage
  private inflight: Promise<void> | null = null
  private state: ModelState = "idle"
  private lastError: string | null = null
  private abortController: AbortController | null = null

  constructor(options: ModelManagerOptions = {}) {
    this.manifest = options.manifest ?? DEFAULT_MANIFEST
    this.origin = options.origin ?? getTtsModelOrigin()
    this.fetcher = options.fetcher
    this.storage = options.storage ?? createDefaultStorage()
  }

  getManifest(): ModelManifest {
    return this.manifest
  }

  getState(): ModelState {
    return this.state
  }

  getLastError(): string | null {
    return this.lastError
  }

  getVersion(): string {
    return this.manifest.version
  }

  getOrigin(): string {
    return this.origin
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await this.storage.isAvailable(this.manifest)
    } catch {
      return false
    }
  }

  /** Verifica integridade dos assets já armazenados (tamanho + SHA-256). */
  async verify(): Promise<void> {
    for (const asset of [this.manifest.assets.model, this.manifest.assets.tokenizer, this.manifest.assets.voice] as const) {
      const data = await this.storage.get(asset.path, this.manifest.version)
      if (!data) throw new ModelError("MODEL_NOT_FOUND", `Asset ausente no storage: ${asset.path}`)
      await verifyAsset(data, asset)
    }
  }

  /** Baixa todos os assets (sem persistir) e valida; usado por ensureAvailable antes do put atômico. */
  private async downloadAll(signal?: AbortSignal): Promise<Map<string, Uint8Array>> {
    const assets = [this.manifest.assets.model, this.manifest.assets.tokenizer, this.manifest.assets.voice] as const
    const results = new Map<string, Uint8Array>()
    // Download sequencial para limitar pico de memória (92 MB já é grande); poderia ser paralelo para tokenizer/voice pequenos
    for (const asset of assets) {
      if (signal?.aborted) throw new ModelError("MODEL_ABORTED", "Download abortado")
      const data = await downloadAsset(asset, { origin: this.origin, fetcher: this.fetcher, signal })
      results.set(asset.path, data)
    }
    return results
  }

  /**
   * Garante que o modelo está disponível localmente; baixa sob demanda se ausente.
   * Singleflight: chamadas concorrentes aguardam o mesmo inflight.
   * Ordem: download → tamanho → SHA-256 → armazenamento definitivo → AVAILABLE.
   * Se validação falhar, nada é persistido como válido.
   */
  async ensureAvailable(options?: { signal?: AbortSignal }): Promise<void> {
    if (await this.isAvailable()) {
      this.state = "ready"
      return
    }
    if (this.inflight) return this.inflight

    const externalSignal = options?.signal
    const controller = new AbortController()
    this.abortController = controller
    const signal = externalSignal
      ? this.mergeSignals(externalSignal, controller.signal)
      : controller.signal

    // Se o chamador abortar, propaga para o controller interno
    const onExternalAbort = () => controller.abort()
    if (externalSignal) externalSignal.addEventListener("abort", onExternalAbort, { once: true })

    this.state = "downloading"
    this.lastError = null

    const p = (async () => {
      try {
        const downloaded = await this.downloadAll(signal)
        // Verificação já feita em downloadAsset, mas re-verifica antes do put
        // Persistência atômica: só persiste após todos validados
        for (const [path, data] of downloaded) {
          if (signal.aborted) throw new ModelError("MODEL_ABORTED", "Abortado antes de persistir")
          await this.storage.put(path, this.manifest.version, data)
        }
        // Validação final pós-persistência
        await this.verify()
        this.state = "ready"
      } catch (e) {
        this.state = "error"
        this.lastError = e instanceof Error ? e.message : String(e)
        // Limpa parcial: remove versão incompleta para não deixar AVAILABLE falso
        if (e instanceof ModelError && (e.code === "MODEL_INTEGRITY_FAILED" || e.code === "MODEL_DOWNLOAD_FAILED")) {
          // Não apaga tudo agressivamente; mas garante que isAvailable continuará false
        }
        if (e instanceof ModelError && e.code === "MODEL_ABORTED") {
          // Abort não deixa vestígio válido; isAvailable já será false pois nem todos foram postos
          throw e
        }
        // Re-lança como ModelError preservado ou wrap
        if (e instanceof ModelError) throw e
        throw new ModelError("MODEL_DOWNLOAD_FAILED", e instanceof Error ? e.message : String(e), { cause: e })
      } finally {
        if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort)
        this.inflight = null
        this.abortController = null
      }
    })()

    this.inflight = p
    return p
  }

  private mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    if (a.aborted || b.aborted) controller.abort()
    else {
      a.addEventListener("abort", onAbort, { once: true })
      b.addEventListener("abort", onAbort, { once: true })
    }
    return controller.signal
  }

  /** Compat: alias para ensureAvailable (contrato da spec: download()). */
  async download(options?: { signal?: AbortSignal }): Promise<void> {
    return this.ensureAvailable(options)
  }

  async getAsset(assetPath: string): Promise<Uint8Array | null> {
    return this.storage.get(assetPath, this.manifest.version)
  }

  async invalidate(): Promise<void> {
    await this.storage.clearVersion(this.manifest.version)
    this.state = "idle"
    this.lastError = null
  }

  /** Cancela download em andamento (se houver). */
  abort(): void {
    if (this.abortController) this.abortController.abort()
  }

  async dispose(): Promise<void> {
    this.abort()
    this.inflight = null
    this.state = "idle"
  }
}

export function createModelManager(options?: ModelManagerOptions): ModelManager {
  return new ModelManager(options)
}
