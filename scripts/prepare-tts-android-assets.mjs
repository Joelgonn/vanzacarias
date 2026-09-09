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

// FASE 3: somente runtime (sem modelo). WASM + worker são obrigatórios no APK.
const FILES = [
  [join(ROOT, "public", "tts", "worker.js"), join(DEST, "worker.js")],
  [join(WASM_SRC_DIR, "ort-wasm-simd-threaded.mjs"), join(DEST, "wasm", "ort-wasm-simd-threaded.mjs")],
  [join(WASM_SRC_DIR, "ort-wasm-simd-threaded.wasm"), join(DEST, "wasm", "ort-wasm-simd-threaded.wasm")],
  [join(WASM_SRC_DIR, "ort-wasm-simd-threaded.jsep.mjs"), join(DEST, "wasm", "ort-wasm-simd-threaded.jsep.mjs")],
  [join(WASM_SRC_DIR, "ort-wasm-simd-threaded.jsep.wasm"), join(DEST, "wasm", "ort-wasm-simd-threaded.jsep.wasm")],
];

// Remove legados grandes do APK (se migrando de FASE 2)
const LEGACY_LARGE = [
  join(DEST, "model_quantized.onnx"),
  join(DEST, "model.onnx"),
  join(DEST, "tokenizer.json"),
  join(DEST, "voices", "pf_dora.bin"),
];
for (const p of LEGACY_LARGE) {
  await rm(p, { force: true }).catch(() => undefined);
}
// Limpa voices se vazio
try {
  const { readdir } = await import("node:fs/promises");
  const voicesDir = join(DEST, "voices");
  const entries = await readdir(voicesDir).catch(() => []);
  if (entries.length === 0) await rm(voicesDir, { recursive: true, force: true }).catch(() => undefined);
} catch {}

await mkdir(join(DEST, "wasm"), { recursive: true });
let total = 0;
for (const [src, dst] of FILES) {
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(src, dst);
  total += (await stat(dst)).size;
}
console.log(`[TTS-CAP-004 FASE 3] assets TTS Android em ${DEST} — ${FILES.length} arquivos (somente runtime, sem modelo), ${(total / 1048576).toFixed(1)} MB`);
console.log(`Modelo (92 MB) NÃO está no APK — será baixado sob demanda via ModelManager (HTTPS → Filesystem Directory.Data)`);
