// VOZ-004-R3 — Wrapper Moonshine para STTEngine (preservado, sem correção)
// Mantém runtime existente, apenas adapta para interface. Não corrige ESM/CDN.

import { getMoonshineRuntime } from '../moonshine';

export function getMoonshineEngine() {
  let runtime: any = null;
  return {
    id: 'moonshine-tiny',
    name: 'Moonshine Tiny',
    language: 'en (tiny base, sem pt-BR)',
    model: 'model/tiny (~30 MB)',
    async load() {
      // Usa Tiny (não streaming) para WAV local, conforme VOZ-004-R2 F1
      runtime = getMoonshineRuntime({ model: 'tiny', useStreaming: false });
      await runtime.load();
    },
    async transcribe(pcm: Float32Array, sampleRate: number) {
      if (!runtime) {
        runtime = getMoonshineRuntime({ model: 'tiny', useStreaming: false });
        await runtime.load();
      }
      // MoonshineModel.generate espera Float32Array 16k mono
      // Para manter interface STTEngine, usa MoonshineModel diretamente se disponível,
      // senão tenta via runtime (que é MicrophoneTranscriber, não ideal para WAV)
      // Nesta sprint, não corrigir Moonshine — apenas expor via wrapper
      // Se pcm não for 16k, assume já convertido (lab faz resample antes)
      const start = Date.now();
      // Tenta usar MoonshineModel se disponível globalmente (fallback)
      let text = '';
      try {
        // @ts-ignore — tenta CDN ESM global se existir
        const NS: any = (typeof window !== 'undefined' ? (window as any).Moonshine : null) || null;
        if (NS?.MoonshineModel) {
          const model = new NS.MoonshineModel('model/tiny');
          await model.loadModel();
          text = await model.generate(pcm);
        } else if (runtime) {
          // Fallback: não há API transcribe para PCM no MicrophoneTranscriber, retorna vazio
          // Mantém erro observável: não mascara
          throw new Error('Moonshine transcribe via PCM não implementado neste wrapper — usar F1 WAV existente');
        }
      } catch (e: any) {
        throw new Error(e?.message || String(e));
      }
      const inferenceMs = Date.now() - start;
      return { text, inferenceMs };
    },
    async dispose() {
      try { await runtime?.dispose(); } catch {}
      runtime = null;
    },
    isSupported() {
      return typeof WebAssembly !== 'undefined';
    },
  };
}
