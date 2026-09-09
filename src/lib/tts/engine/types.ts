export interface TTSRuntimeInfo {
  readonly name: string;
  readonly modelId: string;
  readonly sampleRate: number;
  readonly device: string;
  readonly onnxRuntime: string;
}

export interface TTSRuntimeOptions {
  speed?: number;
  noise?: number;
  noiseW?: number;
}

export interface SynthesisResult {
  readonly text: string;
  readonly audio: Float32Array;
  readonly sampleRate: number;
  readonly durationSec: number;
  readonly wav: Uint8Array;
}

export interface TTSRuntime {
  readonly info: TTSRuntimeInfo;
  readonly isLoaded: boolean;
  load(): Promise<void>;
  synthesize(text: string, opts?: TTSRuntimeOptions): Promise<SynthesisResult>;
  dispose(): Promise<void>;
}

export { TTSInputError, TTSRuntimeError } from "../core/errors";