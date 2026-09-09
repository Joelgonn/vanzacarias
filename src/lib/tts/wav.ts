export interface WavInfo {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly dataBytes: number;
  readonly durationSec: number;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const count = samples.length;
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, count * 2, true);
  let offset = 44;
  for (let i = 0; i < count; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

export function concatSamples(
  chunks: readonly Float32Array[],
  sampleRate: number,
  pauseSec: number,
): Float32Array {
  const pause = Math.round(pauseSec * sampleRate);
  const total = chunks.reduce((sum, c) => sum + c.length, 0) + pause * (chunks.length - 1);
  const result = new Float32Array(total);
  let offset = 0;
  chunks.forEach((chunk, index) => {
    result.set(chunk, offset);
    offset += chunk.length;
    if (index < chunks.length - 1) offset += pause;
  });
  return result;
}

export function wavInfo(wav: Uint8Array): WavInfo {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const fourCC = (offset: number) =>
    String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
  if (fourCC(0) !== "RIFF" || fourCC(8) !== "WAVE") {
    throw new Error("Dados não representam um arquivo WAV RIFF/WAVE válido.");
  }
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  const dataBytes = view.getUint32(40, true);
  const durationSec = dataBytes / (sampleRate * channels * (bitsPerSample / 8));
  return { sampleRate, channels, bitsPerSample, dataBytes, durationSec };
}

export interface DecodedWav {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: number;
}

export function decodeWav(wav: Uint8Array): DecodedWav {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const fourCC = (offset: number) =>
    String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
  if (fourCC(0) !== "RIFF" || fourCC(8) !== "WAVE") {
    throw new Error("Dados não representam um arquivo WAV RIFF/WAVE válido.");
  }
  let format = 0;
  let channels = 1;
  let sampleRate = 22050;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataBytes = 0;
  let offset = 12;
  while (offset + 8 <= wav.byteLength) {
    const chunk = fourCC(offset);
    const size = view.getUint32(offset + 4, true);
    if (chunk === "fmt ") {
      format = view.getUint16(offset + 8, true);
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunk === "data") {
      dataOffset = offset + 8;
      dataBytes = size;
    }
    offset += 8 + size + (size % 2);
  }
  if (format !== 1 || bitsPerSample !== 16) {
    throw new Error("Somente WAV PCM 16-bit é suportado para decodificação.");
  }
  if (dataOffset < 0) {
    throw new Error("Chunk de dados não encontrado no arquivo WAV.");
  }
  const sampleCount = Math.floor(dataBytes / 2);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const value = view.getInt16(dataOffset + i * 2, true);
    samples[i] = value < 0 ? value / 0x8000 : value / 0x7fff;
  }
  return { samples, sampleRate, channels, bitsPerSample };
}

export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return samples;
  const outLength = Math.round((samples.length * toRate) / fromRate);
  const out = new Float32Array(outLength);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const current = samples[index] ?? 0;
    const next = samples[index + 1] ?? current;
    out[i] = current + (next - current) * fraction;
  }
  return out;
}