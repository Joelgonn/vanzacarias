/**
 * TTS-CAP-004 FASE 2 — Erros distinguíveis do ModelManager.
 * Adaptado ao sistema TtsError existente (types.ts), mas com códigos específicos do modelo.
 */

export type ModelErrorCode =
  | "MODEL_NOT_FOUND"
  | "MODEL_DOWNLOAD_FAILED"
  | "MODEL_INTEGRITY_FAILED"
  | "MODEL_STORAGE_FAILED"
  | "MODEL_ABORTED"
  | "MODEL_VERSION_UNSUPPORTED"

export class ModelError extends Error {
  public readonly code: ModelErrorCode
  constructor(code: ModelErrorCode, message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = "ModelError"
    this.code = code
    if (options?.cause) (this as unknown as { cause: unknown }).cause = options.cause
  }
}
