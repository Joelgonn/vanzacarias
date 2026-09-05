// VOZ-004-R3 — Abstração mínima STT (lab neutro)
// Não é framework, apenas interface pragmática para desacoplar engine da UI

export type STTEngineId = string;

export type STTResult = {
  text: string;
  inferenceMs?: number;
  modelLoadMs?: number;
  metadata?: Record<string, unknown>;
};

export type STTEngine = {
  id: STTEngineId;
  name: string;
  language: string; // ex: "pt-BR", "en"
  model: string; // ex: "vosk-model-small-pt-0.3" ou "model/tiny"
  load: () => Promise<void>;
  transcribe: (pcm: Float32Array, sampleRate: number) => Promise<STTResult>;
  dispose?: () => Promise<void>;
  isSupported?: () => boolean;
};

// Registry — ponto único para engines registráveis
// VOZ-004-R3: Vosk PT-BR deve continuar registrado; Moonshine preservado se já encapsulado
import { getVoskEngine } from './engines/vosk';
import { getMoonshineEngine } from './engines/moonshine';

export const STT_ENGINES: Record<string, STTEngine> = {
  'vosk-pt-br': getVoskEngine(),
  'moonshine-tiny': getMoonshineEngine(),
};

export function getEngine(id: string): STTEngine | undefined {
  return STT_ENGINES[id];
}

export function listEngines(): STTEngine[] {
  return Object.values(STT_ENGINES);
}
