import { createReadStream, statSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { Readable } from "node:stream"
import type { NextRequest } from "next/server"

/**
 * TTS-INTEGRATION-007 — Assets do Browser Runtime (D05).
 *
 * Serve SOMENTE para o ambiente web do Chat (dev/preview):
 *  - /api/tts/models/<f>  → voice-synthesis/models/kokoro
 *    (model_quantized.onnx, tokenizer.json, voices/pf_dora.bin — o Browser
 *    Runtime resolve estes três nomes DIRETAMENTE contra a baseUrl, por isso a
 *    raiz "models" da rota é o diretório kokoro do pacote)
 *  - /api/tts/wasm/<f>    → onnxruntime-web/dist    (*.wasm)
 *
 * NÃO copia nenhum artefato para o repo (sem duplicação de 92 MB); os pesos
 * continuam no pacote `voice-synthesis` (file:../voice-synthesis). PWA/offline
 * e produção são trabalho futuro (TTS-INTEGRATION-007 — D23/D24).
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

/**
 * Root do pacote `voice-synthesis` no SERVIDOR (roda em runtime, nunca no
 * bundle client). Em build-time, `require.resolve` do webpack devolve um id
 * numérico de módulo — por isso a verificação `typeof string` e, como caminho
 * preferencial, `process.cwd()/node_modules/voice-synthesis` (file:).
 */
function voiceSynthesisRoot(): string {
  const fromCwd = path.join(process.cwd(), "node_modules", "voice-synthesis")
  try {
    if (statSync(path.join(fromCwd, "package.json")).isFile()) return fromCwd
  } catch {}
  try {
    const resolved = createRequire(import.meta.url).resolve("voice-synthesis/package.json")
    if (typeof resolved === "string") return path.dirname(resolved)
  } catch {}
  return path.join(process.cwd(), "..", "voice-synthesis")
}

const ROOTS: Record<string, () => string> = {
  // O Browser Runtime resolve model_quantized.onnx | tokenizer.json |
  // voices/pf_dora.bin DIRETAMENTE contra a baseUrl → raiz = models/kokoro.
  models: () => path.join(voiceSynthesisRoot(), "models", "kokoro"),
  wasm: () => path.join(voiceSynthesisRoot(), "node_modules", "onnxruntime-web", "dist"),
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