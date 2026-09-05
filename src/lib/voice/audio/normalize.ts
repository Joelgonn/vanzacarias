// VOZ-010 — Normalização e trim de PCM para Vosk
// Objetivos: melhorar qualidade sem trocar modelo, sem AudioWorklet, sem resampling.
// - Normalização por pico (se pico <0.5) para aproveitar faixa dinâmica [-1,1]
// - Remoção de DC offset (média) para evitar bias
// - Trim de silêncio excessivo no início/fim (>500ms) sem remover pausas internas

export function normalizePcm(pcm: Float32Array): Float32Array {
  if (pcm.length === 0) return pcm;
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    sum += pcm[i];
    const abs = Math.abs(pcm[i]);
    if (abs > peak) peak = abs;
  }
  const mean = sum / pcm.length;
  // Remover DC offset e encontrar novo pico após remoção
  let newPeak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const abs = Math.abs(pcm[i] - mean);
    if (abs > newPeak) newPeak = abs;
  }
  // Se pico já alto (>=0.5) ou muito baixo (silêncio, <0.01), não normalizar
  if (newPeak >= 0.5 || newPeak < 0.01) {
    if (Math.abs(mean) < 1e-6) return pcm; // sem DC e pico ok -> sem cópia
    // Apenas remover DC
    const out = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] - mean;
    return out;
  }
  const targetPeak = 0.9;
  const gain = targetPeak / newPeak;
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    let v = (pcm[i] - mean) * gain;
    // Clamp para [-1, 1]
    if (v > 1) v = 1;
    if (v < -1) v = -1;
    out[i] = v;
  }
  return out;
}

export function trimSilence(
  pcm: Float32Array,
  sampleRate: number,
  threshold = 0.01,
  minSilenceMs = 500
): Float32Array {
  if (pcm.length === 0) return pcm;
  const windowMs = 100;
  const windowSamples = Math.max(1, Math.round((windowMs / 1000) * sampleRate));
  const totalWindows = Math.ceil(pcm.length / windowSamples);

  // Encontrar primeiro window ativo
  let firstActive = 0;
  for (let w = 0; w < totalWindows; w++) {
    const start = w * windowSamples;
    const end = Math.min(start + windowSamples, pcm.length);
    let peak = 0;
    for (let i = start; i < end; i++) {
      const abs = Math.abs(pcm[i]);
      if (abs > peak) peak = abs;
    }
    if (peak >= threshold) {
      firstActive = w;
      break;
    }
    // Se todo o início é silêncio, continua
    if (w === totalWindows - 1) return pcm; // todo silêncio -> não trim
  }

  // Encontrar último window ativo
  let lastActive = totalWindows - 1;
  for (let w = totalWindows - 1; w >= 0; w--) {
    const start = w * windowSamples;
    const end = Math.min(start + windowSamples, pcm.length);
    let peak = 0;
    for (let i = start; i < end; i++) {
      const abs = Math.abs(pcm[i]);
      if (abs > peak) peak = abs;
    }
    if (peak >= threshold) {
      lastActive = w;
      break;
    }
  }

  const leadingSilenceWindows = firstActive;
  const trailingSilenceWindows = totalWindows - 1 - lastActive;
  const leadingMs = leadingSilenceWindows * windowMs;
  const trailingMs = trailingSilenceWindows * windowMs;

  // Só trim se silêncio excede minSilenceMs (evitar remover pausas naturais curtas)
  let startSample = 0;
  let endSample = pcm.length;
  if (leadingMs > minSilenceMs) {
    // Manter 200ms de silêncio leading para contexto Vosk
    const keepWindows = Math.ceil(200 / windowMs);
    startSample = Math.max(0, (leadingSilenceWindows - keepWindows) * windowSamples);
  }
  if (trailingMs > minSilenceMs) {
    const keepWindows = Math.ceil(200 / windowMs);
    endSample = Math.min(pcm.length, (lastActive + 1 + keepWindows) * windowSamples);
  }

  if (startSample === 0 && endSample === pcm.length) return pcm;
  return pcm.subarray(startSample, endSample);
}
