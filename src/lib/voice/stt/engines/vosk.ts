// VOZ-004-R4 — Wrapper Vosk para STTEngine (runtime corrigido)
// VOZ-006 — dispose() completo: encerra Worker/WASM via Model.terminate()
// VOZ-012.4 — F05: dispose() vira SOFT/PARK (sem matar worker) + keep-warm TTL.
// Mantém implementação em src/lib/voice/stt/vosk.ts, apenas adapta para interface STTEngine.
//
// Estratégia F05 (relativo ao fluxo real):
// - O modelo the Vosk (cached no module-scope de vosk.ts: cachedModel + cachedModelId)
//   JÁ é reutilizado entre gravações dentro da mesma montagem (engineState RESULT/READY
//   evita load() repetido) e entre remontagens (o cache module-level persiste).
// - O problema era o unmount: `controller.dispose()` → `engine.dispose()` →
//   `disposeVoskModel()` (terminate do Worker/WASM + limpeza do cache). Navegar para
//   fora do dashboard e voltar custa um reload COMPLETO (~32MB + worker).
// - Correção mínima: o dispose do engine NÃO termina o modelo imediatamente. Ele vira
//   "park" (solta a referência local e deixa o modelo no cache module-level). Um
//   remount imediato reutiliza worker+WASM já baixados e decompactados (load quase zero).
// - Para não reter o modelo em memória indefinidamente, um TTL de inatividade
//   (KEEP_WARM_MS, 10min) dispara o dispose HARD (disposeVoskModel / terminate) quando
//   não há uso recente. O terminate() é PRESERVADO (regra da sprint: não manter o modelo
//   permanentemente).
// - Proteção durante inferência: TTL (10min) >> guard máximo do F02 (~270s), e o timer
//   é rearmado a cada load/transcrição, então nunca dispara sobre uma transcrição em voo.
import { loadVoskModel, transcribeWithVosk, disposeVoskModel, getVoskModelStats } from '../vosk';
import { isVoiceDebugEnabled, voiceDebugLog } from '../../debug';

// VOZ-012.4 — F05: janela de reutilização do modelo após a última atividade.
// - Acima do guard máximo F02 (30s + 4×60s = 270s) para nunca matar transcrição em voo.
// - Acima das navegações típicas (voltar ao dashboard em segundos/minutos).
// - Baixo o bastante para não reter ~32MB de WASM+worker indevidamente.
export const VOSK_ENGINE_KEEP_WARM_MS = 10 * 60_000;

export function getVoskEngine() {
  let cachedModel: any = null;
  let warmTimer: ReturnType<typeof setTimeout> | null = null;

  // Rearma o keep-warm a cada atividade de carga/transcrição. Quando expira, faz o
  // dispose HARD do modelo (terminate do worker) mesmo com a UI desmontada — memória
  // é liberada, o worker nunca fica órfão indefinidamente.
  const armWarm = (): void => {
    if (warmTimer) clearTimeout(warmTimer);
    warmTimer = setTimeout(() => {
      warmTimer = null;
      try { disposeVoskModel(); } catch {}
    }, VOSK_ENGINE_KEEP_WARM_MS);
  };

  return {
    id: 'vosk-pt-br',
    name: 'Vosk PT-BR',
    language: 'pt-BR',
    model: 'vosk-model-small-pt-0.3 (31M, Apache 2.0)',
    async load() {
      const loadStart = Date.now();
      const before = getVoskModelStats();
      // O cache module-level de vosk.ts reutiliza o modelo (warm) OU a promise em voo
      // (in-flight dedupe) — nunca cria worker/modelo duplicado.
      cachedModel = await loadVoskModel('small-pt-0.3');
      const after = getVoskModelStats();
      armWarm();
      if (isVoiceDebugEnabled()) {
        voiceDebugLog('VOICE_ENGINE_LOAD', {
          durationMs: Date.now() - loadStart,
          wasWarmHit: after.warmHitCount > before.warmHitCount,
          sharedInflight: after.inFlightSharedCount > before.inFlightSharedCount,
          totalLoads: after.loadCount,
          warmHits: after.warmHitCount,
        });
      }
    },
    async transcribe(pcm: Float32Array, sampleRate: number) {
      if (!cachedModel) {
        // Tenta carregar se ainda não carregado (para lab que chama transcribe direto)
        cachedModel = await loadVoskModel('small-pt-0.3');
      }
      // Atividade recente rearma o keep-warm antes de uma inferência potencialmente
      // longa (guarda máxima ~270s no F02 é << KEEP_WARM 600s).
      armWarm();
      const start = Date.now();
      const text = await transcribeWithVosk(pcm, sampleRate, cachedModel);
      const inferenceMs = Date.now() - start;
      return { text, inferenceMs, metadata: { sampleRate } };
    },
    // VOZ-012.4 — F05: dispose SOFT ("park").
    // Solta apenas a referência local do engine. O modelo continua no cache module-level
    // de vosk.ts (warm) para reuso imediato em remontagem/navegação de volta; o TTL
    // keep-warm (armado) fará o dispose HARD (terminate) quando a inatividade exceder.
    async dispose() {
      cachedModel = null;
    },
    isSupported() {
      return typeof WebAssembly !== 'undefined' && typeof Worker !== 'undefined';
    },
  };
}