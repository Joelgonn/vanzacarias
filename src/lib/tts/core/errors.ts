/**
 * TTS-006 — Contrato de erros público (core puro, sem node/ort).
 *
 * Mantém as mesmas classes do runtime Node (`engine/types.ts` apenas
 * re-exporta daqui), para que Node e browser compartilhem contrato idêntico:
 *   - TTSInputError    → entrada inválida (texto vazio, fonemização vazia ...)
 *   - TTSRuntimeError  → falha interna/ambiente (assets, ONNX, worker ...)
 */

export class TTSInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TTSInputError";
  }
}

export class TTSRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TTSRuntimeError";
  }
}