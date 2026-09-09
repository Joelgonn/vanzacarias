/**
 * TTS-CAP-002 — copia para o bundle Capacitor os assets TTS mínimos necessários
 * ao WebView Android, sob /public/assets/tts/** (webDir do Capacitor → APK).
 *
 * - Pasta GITIGNORED (/public/assets/tts): nunca sobe ao git → não vai ao
 *   deploy web/Vercel → Web/PWA intocado.
 * - Roda apenas quando for sincronizar/empacotar o Android:
 *     node scripts/prepare-tts-android-assets.mjs && npx cap sync android
 * - Não empacota: FP32, laboratório, benchmarks, espeak, Python, onnxruntime-node.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const VS = join(ROOT, "..", "voice-synthesis");
const ORT_DIST = join(VS, "node_modules", "onnxruntime-web", "dist");
const DEST = join(ROOT, "public", "assets", "tts");

// Somente o que o runtime realmente usa (q8 + voz + tokenizer + worker + as duas
// variantes WASM observadas no WebView/Chromium: simd-threaded e jsep).
const FILES = [
  [join(VS, "models", "kokoro", "model_quantized.onnx"), join(DEST, "model_quantized.onnx")],
  [join(VS, "models", "kokoro", "tokenizer.json"), join(DEST, "tokenizer.json")],
  [join(VS, "models", "kokoro", "voices", "pf_dora.bin"), join(DEST, "voices", "pf_dora.bin")],
  [join(ROOT, "public", "tts", "worker.js"), join(DEST, "worker.js")],
  [join(ORT_DIST, "ort-wasm-simd-threaded.mjs"), join(DEST, "wasm", "ort-wasm-simd-threaded.mjs")],
  [join(ORT_DIST, "ort-wasm-simd-threaded.wasm"), join(DEST, "wasm", "ort-wasm-simd-threaded.wasm")],
  [join(ORT_DIST, "ort-wasm-simd-threaded.jsep.mjs"), join(DEST, "wasm", "ort-wasm-simd-threaded.jsep.mjs")],
  [join(ORT_DIST, "ort-wasm-simd-threaded.jsep.wasm"), join(DEST, "wasm", "ort-wasm-simd-threaded.jsep.wasm")],
];

await mkdir(join(DEST, "voices"), { recursive: true });
await mkdir(join(DEST, "wasm"), { recursive: true });
let total = 0;
for (const [src, dst] of FILES) {
  await copyFile(src, dst);
  const { stat } = await import("node:fs/promises");
  total += (await stat(dst)).size;
}
console.log(`assets TTS Android em ${DEST} — ${FILES.length} arquivos, ${(total / 1048576).toFixed(1)} MB`);
