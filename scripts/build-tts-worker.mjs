import esbuild from "esbuild"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * TTS-INTEGRATION-007 (D05/D06) — Gera o bundle standalone do Worker do
 * Browser Runtime em `public/tts/worker.js`.
 *
 * O chunk roda em um `Worker({ type: "module" })` com onnxruntime-web
 * (variant extern-wasm) embutido — o main thread nunca importa onnxruntime-web.
 * Fonte: `voice-synthesis/src/runtime/browser/worker.ts` (file:../voice-synthesis).
 *
 * Executado via `predev`/`prebuild`.
 */
const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const vsRoot = path.join(appRoot, "node_modules", "voice-synthesis")
const outfile = path.join(appRoot, "public", "tts", "worker.js")

await esbuild.build({
  entryPoints: [path.join(vsRoot, "src", "runtime", "browser", "worker.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  conditions: ["onnxruntime-web-use-extern-wasm"],
  target: "es2020",
  logLevel: "warning",
})

console.log("TTS worker bundle ->", outfile)