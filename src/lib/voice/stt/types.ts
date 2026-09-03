export type STTResult = {
  committed: string;
  partial?: string;
  durationMs: number;
  model: string;
  streaming: boolean;
};

export type BenchmarkSample = {
  id: string;
  groundTruth: string;
  category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
  audioPath?: string; // para dataset real, não usado em testes unitários
  durationSec?: number;
};

export type BenchmarkResult = {
  wer: number; // 0-1
  rtf: number; // transcription_duration / audio_duration
  memoryPeakMb?: number;
};
