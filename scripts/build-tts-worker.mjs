import esbuild from "esbuild"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * TTS-CAP-004 FASE 1 — Gera o bundle standalone do Worker do Browser Runtime
 * em `public/tts/worker.js`.
 *
 * O chunk roda em um `Worker({ type: "module" })` com onnxruntime-web
 * (variant extern-wasm) embutido — o main thread nunca importa onnxruntime-web.
 * Fonte: runtime vendado interno `src/lib/tts/runtime/browser/worker.ts`
 * (sem dependência de `voice-synthesis` / file:../voice-synthesis).
 *
 * Executado via `predev`/`prebuild`.
 */
const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outfile = path.join(appRoot, "public", "tts", "worker.js")

await esbuild.build({
  entryPoints: [path.join(appRoot, "src", "lib", "tts", "runtime", "browser", "worker.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  conditions: ["onnxruntime-web-use-extern-wasm"],
  target: "es2020",
  logLevel: "warning",
})

console.log("TTS worker bundle ->", outfile)

// KO-000.0: também disponibiliza WASM estático para Web (evita depender de /api/tts/wasm que 404 na Vercel)
// Copia os 4 arquivos wasm para public/tts/wasm (gitignored, mas gerado no prebuild da Vercel)
import { copyFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
const vsRoot = path.join(appRoot, "..", "voice-synthesis")
const ortDistVS = path.join(vsRoot, "node_modules", "onnxruntime-web", "dist")
const ortDistProj = path.join(appRoot, "node_modules", "onnxruntime-web", "dist")
const wasmSrcDir = existsSync(ortDistVS) ? ortDistVS : ortDistProj
const wasmDestDir = path.join(appRoot, "public", "tts", "wasm")
await mkdir(wasmDestDir, { recursive: true })
const wasmFiles = [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
]
for (const f of wasmFiles) {
  try { await copyFile(path.join(wasmSrcDir, f), path.join(wasmDestDir, f)) } catch {}
}
console.log("TTS wasm static ->", wasmDestDir)