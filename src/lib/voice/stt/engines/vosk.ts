// VOZ-004-R4 — Wrapper Vosk para STTEngine (runtime corrigido)
// VOZ-006 — dispose() completo: encerra Worker/WASM via Model.terminate()
// Mantém implementação em src/lib/voice/stt/vosk.ts, apenas adapta para interface STTEngine
import { loadVoskModel, transcribeWithVosk, disposeVoskModel } from '../vosk';

export function getVoskEngine() {
  let cachedModel: any = null;
  return {
    id: 'vosk-pt-br',
    name: 'Vosk PT-BR',
    language: 'pt-BR',
    model: 'vosk-model-small-pt-0.3 (31M, Apache 2.0)',
    async load() {
      // Carrega modelo small-pt-0.3 local (tar.gz) via vosk-browser
      cachedModel = await loadVoskModel('small-pt-0.3');
    },
    async transcribe(pcm: Float32Array, sampleRate: number) {
      if (!cachedModel) {
        // Tenta carregar se ainda não carregado (para lab que chama transcribe direto)
        cachedModel = await loadVoskModel('small-pt-0.3');
      }
      const start = Date.now();
      const text = await transcribeWithVosk(pcm, sampleRate, cachedModel);
      const inferenceMs = Date.now() - start;
      return { text, inferenceMs, metadata: { sampleRate } };
    },
    async dispose() {
      // Encerra Worker/WASM (API pública Model.terminate) e limpa as caches
      // module-level do vosk.ts — próximo load() recria tudo.
      cachedModel = null;
      disposeVoskModel();
    },
    isSupported() {
      return typeof WebAssembly !== 'undefined' && typeof Worker !== 'undefined';
    },
  };
}
