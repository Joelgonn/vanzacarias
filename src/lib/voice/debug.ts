// VOZ-008 — Instrumentação diagnóstica temporária (feature flag)
// NÃO funcional: apenas métricas numéricas, sem áudio, sem PII.

export function isVoiceDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VOICE_DEBUG === '1';
}

export function voiceDebugLog(group: string, data: Record<string, unknown>): void {
  if (!isVoiceDebugEnabled()) return;
  // Agrupado por [VOICE_DEBUG] para filtragem em console
  // eslint-disable-next-line no-console
  console.info(`[VOICE_DEBUG] ${group}`, data);
}

export function voiceDebugInfo(group: string, data: Record<string, unknown>): void {
  if (!isVoiceDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(`[VOICE_DEBUG] ${group}`, data);
}

// Estatísticas numéricas do PCM — sem conteúdo
export type PcmStats = {
  samples: number;
  durationMs: number;
  rms: number;
  peak: number;
  min: number;
  max: number;
  silenceRatio: number; // 0-1, threshold documentado
  activeAudioMs: number;
  activeAudioRatio: number;
  leadingSilenceMs: number;
  trailingSilenceMs: number;
};

const SILENCE_THRESHOLD = 0.01;
const WINDOW_MS = 100;

export function computePcmStats(pcm: Float32Array, sampleRate: number): PcmStats {
  const samples = pcm.length;
  const durationMs = sampleRate > 0 ? (samples / sampleRate) * 1000 : 0;
  if (samples === 0) {
    return {
      samples: 0,
      durationMs: 0,
      rms: 0,
      peak: 0,
      min: 0,
      max: 0,
      silenceRatio: 1,
      activeAudioMs: 0,
      activeAudioRatio: 0,
      leadingSilenceMs: durationMs,
      trailingSilenceMs: durationMs,
    };
  }
  let sumSq = 0;
  let peak = 0;
  let min = Infinity;
  let max = -Infinity;
  let silentSamples = 0;
  for (let i = 0; i < samples; i++) {
    const v = pcm[i];
    sumSq += v * v;
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
    if (v < min) min = v;
    if (v > max) max = v;
    if (abs < SILENCE_THRESHOLD) silentSamples++;
  }
  const rms = Math.sqrt(sumSq / samples);
  const silenceRatio = silentSamples / samples;

  // Janelas ~100ms para activeAudio e leading/trailing silence
  const windowSamples = Math.max(1, Math.round((WINDOW_MS / 1000) * sampleRate));
  let activeWindows = 0;
  const totalWindows = Math.ceil(samples / windowSamples);
  for (let w = 0; w < totalWindows; w++) {
    const start = w * windowSamples;
    const end = Math.min(start + windowSamples, samples);
    let winPeak = 0;
    for (let i = start; i < end; i++) {
      const abs = Math.abs(pcm[i]);
      if (abs > winPeak) winPeak = abs;
    }
    if (winPeak >= SILENCE_THRESHOLD) activeWindows++;
  }
  const activeAudioMs = activeWindows * WINDOW_MS;
  const activeAudioRatio = totalWindows > 0 ? activeWindows / totalWindows : 0;

  // Leading silence: janelas iniciais silenciosas consecutivas
  let leadingWindows = 0;
  for (let w = 0; w < totalWindows; w++) {
    const start = w * windowSamples;
    const end = Math.min(start + windowSamples, samples);
    let winPeak = 0;
    for (let i = start; i < end; i++) {
      const abs = Math.abs(pcm[i]);
      if (abs > winPeak) winPeak = abs;
    }
    if (winPeak < SILENCE_THRESHOLD) leadingWindows++;
    else break;
  }
  // Trailing silence: janelas finais silenciosas consecutivas
  let trailingWindows = 0;
  for (let w = totalWindows - 1; w >= 0; w--) {
    const start = w * windowSamples;
    const end = Math.min(start + windowSamples, samples);
    let winPeak = 0;
    for (let i = start; i < end; i++) {
      const abs = Math.abs(pcm[i]);
      if (abs > winPeak) winPeak = abs;
    }
    if (winPeak < SILENCE_THRESHOLD) trailingWindows++;
    else break;
  }
  return {
    samples,
    durationMs: Math.round(durationMs),
    rms: Number(rms.toFixed(4)),
    peak: Number(peak.toFixed(4)),
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    silenceRatio: Number(silenceRatio.toFixed(3)),
    activeAudioMs,
    activeAudioRatio: Number(activeAudioRatio.toFixed(3)),
    leadingSilenceMs: leadingWindows * WINDOW_MS,
    trailingSilenceMs: trailingWindows * WINDOW_MS,
  };
}

export type WindowDistribution = Array<{ windowIndex: number; rms: number; peak: number; active: boolean }>;

export function computeWindowDistribution(pcm: Float32Array, sampleRate: number): WindowDistribution {
  const windowSamples = Math.max(1, Math.round((WINDOW_MS / 1000) * sampleRate));
  const totalWindows = Math.ceil(pcm.length / windowSamples);
  const out: WindowDistribution = [];
  for (let w = 0; w < totalWindows; w++) {
    const start = w * windowSamples;
    const end = Math.min(start + windowSamples, pcm.length);
    let sumSq = 0;
    let peak = 0;
    for (let i = start; i < end; i++) {
      const v = pcm[i];
      sumSq += v * v;
      const abs = Math.abs(v);
      if (abs > peak) peak = abs;
    }
    const len = end - start;
    const rms = len > 0 ? Math.sqrt(sumSq / len) : 0;
    out.push({
      windowIndex: w,
      rms: Number(rms.toFixed(4)),
      peak: Number(peak.toFixed(4)),
      active: peak >= SILENCE_THRESHOLD,
    });
  }
  return out;
}
