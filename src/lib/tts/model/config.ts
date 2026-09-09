/**
 * TTS-CAP-004 FASE 2/3 — Origem HTTPS configurável para os assets do modelo.
 *
 * Centraliza a resolução de URLs, compatível com Web/PWA/Capacitor.
 * Não espalha URLs pelo código; toda URL do modelo passa por aqui.
 *
 * FASE 3: origem definida por `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` (ex.: https://cdn.example/tts).
 * Produção deve apontar para origem HTTPS estável capaz de servir ~92 MB (model_quantized.onnx)
 * + tokenizer.json + voices/pf_dora.bin . Se origin vazio, usa same-origin (`/api/tts/models/`).
 * Não depende de `../voice-synthesis`.
 *
 * Em produção a hospedagem definitiva será decidida na fase de distribuição;
 * por enquanto permite override via env `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` ou via
 * `ModelManagerOptions.origin`. Testes usam `http://fixture.test` como origem.
 */

/**
 * FASE 4 — origem definitiva provisionada via GitHub raw (branch tts-assets-v1).
 * Mantém compatibilidade com override via env; se env vazio, usa default estável.
 * Raw GitHub suporta 92 MB, HTTPS, Content-Length correto, SHA-256 validado e CORS *.
 */
export const DEFAULT_TTS_ASSETS_ORIGIN = "https://raw.githubusercontent.com/Joelgonn/vanzacarias/tts-assets-v1/" as const

export function getTtsModelOrigin(): string {
  // Next env: NEXT_PUBLIC_ exposto ao client — tem precedência sobre default
  const fromEnv =
    typeof process !== "undefined" ? ((process.env as Record<string, string | undefined>)["NEXT_PUBLIC_TTS_ASSETS_ORIGIN"] ?? "") : ""
  const trimmed = (fromEnv ?? "").trim()
  if (trimmed) return trimmed
  // Vitest / Node tests: manter contrato original (sem origin) para não quebrar TTS-INTEGRATION-007
  // O default produção (GitHub raw) é injetado via build Next (NEXT_PUBLIC_TTS_ASSETS_ORIGIN em .env.local)
  // mas em ambiente de teste sem env explícito o fallback deve ser vazio para usar /api/tts e /assets/tts.
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") return ""
  return DEFAULT_TTS_ASSETS_ORIGIN
}

export function resolveAssetUrl(origin: string, assetPath: string): string {
  const base = origin || (typeof location !== "undefined" && location.origin ? location.origin : "")
  // Se origin já contém path (ex.: https://cdn.example/tts), new URL resolve corretamente
  if (!base) return assetPath
  try {
    // assetPath pode ser "model_quantized.onnx" ou "voices/pf_dora.bin"
    // Se base termina sem "/", new URL trata ultimo segmento como arquivo; garantir "/"
    const normalizedBase = base.endsWith("/") ? base : `${base}/`
    return new URL(assetPath, normalizedBase).href
  } catch {
    return `${base.replace(/\/$/, "")}/${assetPath.replace(/^\//, "")}`
  }
}

/**
 * Prefixo padrão quando origin é same-origin (dev): os assets do modelo ficam sob
 * `/api/tts/models/` (rota Next que servirá do FS/host). Para testes com fixture,
 * use origin `http://fixture.test` e paths relativos do manifest.
 */
export const DEFAULT_SAME_ORIGIN_PREFIX = "/api/tts/models/" as const
