/**
 * TTS-CAP-004 FASE 3.6 — assets TTS para bundle Capacitor Android.
 *
 * FASE 2 (CAP-002) copiava o modelo Kokoro Q8 (92 MB) para /public/assets/tts → APK.
 * FASE 3 REMOVE definitivamente os assets grandes do APK (modelo/fora do APK):
 *   - NÃO copia: model_quantized.onnx (~92 MB), tokenizer.json, voices/pf_dora.bin
 *   - Copia apenas: worker.js + WASM (ort-wasm-simd-threaded*), necessários ao runtime
 *
 * O modelo passa a ser baixado sob demanda via ModelManager → HTTPS → Filesystem
 * Directory.Data (CapacitorStorage), validado por SHA-256/tamanho do manifesto.
 *
 * Roda ao sincronizar/empacotar Android:
 *   npm run android:tts:assets && npx cap sync android
 * Remove arquivos legados grandes se existirem (migração de APKs antigos).
 */
import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const VS = join(ROOT, "..", "voice-synthesis");
const ORT_DIST = join(VS, "node_modules", "onnxruntime-web", "dist");
// Fallback: quando voice-synthesis não existe (CI/Vercel), usa node_modules/onnxruntime-web do projeto
import { existsSync } from "node:fs";
const ORT_DIST_PROJECT = join(ROOT, "node_modules", "onnxruntime-web", "dist");
const WASM_SRC_DIR = existsSync(ORT_DIST) ? ORT_DIST : ORT_DIST_PROJECT;
const DEST = join(ROOT, "public", "assets", "tts");

// KO-000.0: restaura PoC — assets locais completos (modelo + voz + tokenizer + worker + wasm)
// Elimina caminho Base64/Filesystem. Modelo ~92 MB volta ao APK (evidência PoC 12/12 OK RMX3461).
const MODEL_SRC = join(VS, "models", "kokoro");
const FILES = [
  [join(MODEL_SRC, "model_quantized.onnx"), join(DEST, "model_quantized.onnx")],
  [join(MODEL_SRC, "tokenizer.json"), join(DEST, "tokenizer.json")],
  [join(MODEL_SRC, "voices", "pf_dora.bin"), join(DEST, "voices", "pf_dora.bin")],
  [join(ROOT, "public", "tts", "worker.js"), join(DEST, "worker.js")],
  [join(WASM_SRC_DIR, "ort-wasm-simd-threaded.mjs"), join(DEST, "wasm", "ort-wasm-simd-threaded.mjs")],
  [join(WASM_SRC_DIR, "ort-wasm-simd-threaded.wasm"), join(DEST, "wasm", "ort-wasm-simd-threaded.wasm")],
  [join(WASM_SRC_DIR, "ort-wasm-simd-threaded.jsep.mjs"), join(DEST, "wasm", "ort-wasm-simd-threaded.jsep.mjs")],
  [join(WASM_SRC_DIR, "ort-wasm-simd-threaded.jsep.wasm"), join(DEST, "wasm", "ort-wasm-simd-threaded.jsep.wasm")],
];

await mkdir(join(DEST, "wasm"), { recursive: true });
let total = 0;
for (const [src, dst] of FILES) {
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(src, dst);
  total += (await stat(dst)).size;
}
console.log(`[KO-000.0] assets TTS Android em ${DEST} — ${FILES.length} arquivos (INCLUI modelo local PoC), ${(total / 1048576).toFixed(1)} MB`);
console.log(`Modelo Kokoro Q8 local: ${DEST}/model_quantized.onnx — sem Base64/Filesystem`);
