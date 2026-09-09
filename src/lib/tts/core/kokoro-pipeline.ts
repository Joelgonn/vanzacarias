/**
 * TTS-006 — Pipeline compartilhado Kokoro (core puro).
 *
 * Extrai o loop de síntese idêntico do runtime Node (`kokoro-vozz-runtime`)
 * para ser usado também pelo runtime browser (worker). O executor do chunk
 * ONNX fica fora daqui (Node → onnxruntime-node; browser → onnxruntime-web),
 * garantindo o mesmo resultado: chunk ≤ maxPhonemes, padding 0n, token pad
 * ignorado, concat com pausa 0.12s, WAV 24 kHz PCM16 e duração calculada do WAV.
 */

import { TTSInputError } from "./errors";
import { KOKORO_INFO, chunkPhonemes, tokenizePhonemes } from "./kokoro";
import { concatSamples, encodeWav, wavInfo } from "../wav";

export interface KokoroChunkInputs {
  /** input_ids com padding (0n nas pontas) — pronto para tensor ort. */
  readonly paddedIds: BigInt64Array;
  readonly style: Float32Array;
  readonly speed: Float32Array;
}

export interface KokoroChunkRunner {
  run(chunk: KokoroChunkInputs): Promise<{ audio: Float32Array; ortMs: number }>;
}

export interface KokoroPipelineOptions {
  readonly text: string;
  readonly phonemes: string;
  readonly vocab: ReadonlyMap<string, number>;
  readonly styleRows: Float32Array;
  readonly maxPhonemes?: number;
  readonly speed?: number;
  readonly sampleRate?: number;
  readonly pauseSec?: number;
  readonly runChunk: KokoroChunkRunner;
}

export interface KokoroPipelineResult {
  readonly audio: Float32Array;
  readonly sampleRate: number;
  readonly durationSec: number;
  readonly wav: Uint8Array;
  readonly phonemes: string;
  readonly ortMs: number;
  readonly dropped: readonly string[];
  readonly chunkCount: number;
}

/** Monta os buffers de entrada de um chunk (style por tamanho, padding 0n). */
export function buildKokoroChunkInputs(
  ids: readonly number[],
  styleRows: Float32Array,
  speed: number,
): KokoroChunkInputs {
  const styleIdx = Math.min(ids.length, Math.floor(styleRows.length / 256) - 1);
  const style = new Float32Array(256);
  style.set(styleRows.subarray(styleIdx * 256, styleIdx * 256 + 256));
  const paddedIds = new BigInt64Array(ids.length + 2);
  paddedIds[0] = 0n;
  for (let i = 0; i < ids.length; i++) paddedIds[i + 1] = BigInt(ids[i]);
  paddedIds[ids.length + 1] = 0n;
  return { paddedIds, style, speed: new Float32Array([speed]) };
}

export async function synthesizeKokoroPipeline(
  options: KokoroPipelineOptions,
): Promise<KokoroPipelineResult> {
  const maxPhonemes = options.maxPhonemes ?? KOKORO_INFO.maxPhonemes;
  const speed = options.speed ?? 1;
  const sampleRate = options.sampleRate ?? KOKORO_INFO.sampleRate;
  const pauseSec = options.pauseSec ?? 0.12;

  const chunks = chunkPhonemes(options.phonemes, maxPhonemes);
  const parts: Float32Array[] = [];
  const dropped = new Set<string>();
  let ortMs = 0;

  for (const chunk of chunks) {
    const { ids, dropped: chunkDropped } = tokenizePhonemes(chunk, options.vocab);
    for (const char of chunkDropped) dropped.add(char);
    if (ids.length === 0) continue;
    const chunkInputs = buildKokoroChunkInputs(ids, options.styleRows, speed);
    const out = await options.runChunk.run(chunkInputs);
    ortMs += out.ortMs;
    parts.push(out.audio);
  }
  if (parts.length === 0) {
    throw new TTSInputError(`Nenhuma unidade válida fonetizada para: ${options.text}`);
  }

  const audio = concatSamples(parts, sampleRate, pauseSec);
  const wav = encodeWav(audio, sampleRate);
  const durationSec = wavInfo(wav).durationSec;
  return {
    audio,
    sampleRate,
    durationSec,
    wav,
    phonemes: options.phonemes.trim(),
    ortMs,
    dropped: [...dropped],
    chunkCount: chunks.length,
  };
}