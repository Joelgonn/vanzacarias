import { createReadStream, statSync } from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import type { NextRequest } from "next/server"

/**
 * TTS-CAP-004 FASE 1 — Assets do Browser Runtime.
 *
 * Serve SOMENTE para o ambiente web do Chat (dev/preview):
 *  - /api/tts/models/<f>  → public/tts-assets/models (futuro; FASE 2+)
 *    + fallback dev local `voice-synthesis/models/kokoro` se existir (compat),
 *    mas SEM exigir `file:../voice-synthesis` para build/Vercel.
 *  - /api/tts/wasm/<f>    → node_modules/onnxruntime-web/dist (*.wasm)
 *
 * FASE 1 não implementa download/hospedagem do modelo (FASE 2/3). A rota é
 * preservada para não quebrar Web/PWA/WebView, porém sem dependência de
 * `../voice-synthesis`. Se o asset não existir, retorna 404 — build não falha.
 * O bundle do Worker não passa por aqui: `/tts/worker.js` é estático (public).
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MIME: Record<string, string> = {
  ".onnx": "application/octet-stream",
  ".bin": "application/octet-stream",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".mjs": "text/javascript; charset=utf-8",
}

function modelsRoot(): string {
  // Preferência FASE 2+: public/tts-assets/models (sem 92 MB no repo por enquanto).
  // Fallback dev: se `voice-synthesis` ainda existir localmente, reaproveita
  // sem quebrar build/Vercel (verificação síncrona coberta por try/catch).
  const preferred = path.join(process.cwd(), "public", "tts-assets", "models")
  try {
    if (statSync(preferred).isDirectory()) return preferred
  } catch {}
  const legacyLocal = path.join(process.cwd(), "..", "voice-synthesis", "models", "kokoro")
  try {
    if (statSync(legacyLocal).isDirectory()) return legacyLocal
  } catch {}
  const legacyNodeModules = path.join(process.cwd(), "node_modules", "voice-synthesis", "models", "kokoro")
  try {
    if (statSync(legacyNodeModules).isDirectory()) return legacyNodeModules
  } catch {}
  return preferred
}

const ROOTS: Record<string, () => string> = {
  // O Browser Runtime resolve model_quantized.onnx | tokenizer.json |
  // voices/pf_dora.bin DIRETAMENTE contra a baseUrl → raiz = models/kokoro.
  models: () => modelsRoot(),
  wasm: () => path.join(process.cwd(), "node_modules", "onnxruntime-web", "dist"),
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const segments = (await ctx.params).path ?? []
  const [rootKey, ...rest] = segments
  const rootFactory = rootKey ? ROOTS[rootKey] : undefined
  if (!rootFactory || rest.length === 0) return new Response("not found", { status: 404 })
  const root = rootFactory()

  const rel = rest.join("/")
  const file = path.resolve(root, rel)
  const base = path.resolve(root) + path.sep
  if (!file.startsWith(base)) return new Response("forbidden", { status: 403 })

  let stat
  try {
    stat = statSync(file)
  } catch {
    return new Response("not found", { status: 404 })
  }
  if (!stat.isFile()) return new Response("not found", { status: 404 })

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>
  return new Response(stream, {
    headers: {
      "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": String(stat.size),
      "Cache-Control": "no-store",
    },
  })
}