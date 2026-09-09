/**
 * TTS-CAP-004 FASE 2 — Download com verificação de integridade.
 *
 * Ordem obrigatória: download → tamanho esperado → SHA-256 → armazenamento definitivo → AVAILABLE.
 * Nunca marca AVAILABLE antes da validação; arquivo parcial nunca é persistido como válido.
 */

import type { ModelAsset } from "./manifest"
import { ModelError } from "./errors"
import { resolveAssetUrl } from "./config"

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export async function sha256Hex(data: Uint8Array): Promise<string> {
  // Browser: SubtleCrypto; Node/tests: fallback para `crypto` de Node se disponível
  const bytes = data
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hash = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer)
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }
  // Node fallback (tests). Client bundle usa crypto.subtle; este import é ignorado pelo webpack.
  try {
    const { createHash } = await import(/* webpackIgnore: true */ "node:crypto")
    return createHash("sha256").update(bytes).digest("hex")
  } catch {
    throw new ModelError("MODEL_INTEGRITY_FAILED", "SHA-256 indisponível neste ambiente")
  }
}

export async function verifyAsset(data: Uint8Array, asset: ModelAsset): Promise<void> {
  if (data.byteLength !== asset.bytes) {
    throw new ModelError(
      "MODEL_INTEGRITY_FAILED",
      `Tamanho incorreto para ${asset.path}: esperado ${asset.bytes}, recebido ${data.byteLength}`,
    )
  }
  const hex = await sha256Hex(data)
  if (hex.toLowerCase() !== asset.sha256.toLowerCase()) {
    throw new ModelError(
      "MODEL_INTEGRITY_FAILED",
      `SHA-256 incorreto para ${asset.path}: esperado ${asset.sha256}, recebido ${hex}`,
    )
  }
}

export type DownloadOptions = {
  readonly origin: string
  readonly fetcher?: FetchLike
  readonly signal?: AbortSignal
}

/**
 * Baixa um único asset via HTTPS e valida tamanho + SHA-256.
 * Não persiste; apenas retorna bytes validados. Persistência é responsabilidade do ModelManager
 * para garantir atomicidade (só persiste após validar todos os assets do conjunto).
 */
export async function downloadAsset(asset: ModelAsset, options: DownloadOptions): Promise<Uint8Array> {
  const { origin, fetcher, signal } = options
  const url = resolveAssetUrl(origin, asset.path)

  // Aborto prévio
  if (signal?.aborted) throw new ModelError("MODEL_ABORTED", `Download abortado antes de iniciar: ${asset.path}`)

  const doFetch: FetchLike = fetcher ?? fetch
  let res: Response
  try {
    res = await doFetch(url, { signal })
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
      throw new ModelError("MODEL_ABORTED", `Download abortado: ${asset.path}`, { cause: e })
    }
    throw new ModelError("MODEL_DOWNLOAD_FAILED", `Falha ao baixar ${asset.path} (${url}): ${e instanceof Error ? e.message : String(e)}`, {
      cause: e,
    })
  }

  if (!res.ok) {
    throw new ModelError("MODEL_DOWNLOAD_FAILED", `HTTP ${res.status} ao baixar ${asset.path} (${url})`)
  }

  let bytes: Uint8Array
  try {
    const buf = await res.arrayBuffer()
    bytes = new Uint8Array(buf)
  } catch (e) {
    if (signal?.aborted) throw new ModelError("MODEL_ABORTED", `Download abortado durante leitura: ${asset.path}`, { cause: e })
    throw new ModelError("MODEL_DOWNLOAD_FAILED", `Falha ao ler bytes de ${asset.path}`, { cause: e })
  }

  if (signal?.aborted) throw new ModelError("MODEL_ABORTED", `Download abortado após baixar: ${asset.path}`)

  await verifyAsset(bytes, asset)
  return bytes
}
