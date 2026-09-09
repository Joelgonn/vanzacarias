/**
 * TTS-CAP-004 FASE 2 — Manifest versionado do pacote Kokoro Q8.
 *
 * Hashes calculados a partir dos arquivos reais de `voice-synthesis/models/kokoro`
 * (nenhum hash inventado). O manifest permite detectar arquivo incompleto/corrompido/versão incorreta.
 * Versão explícita `v1` faz parte da chave de armazenamento (`tts-model-v1`).
 */

export type ModelAsset = {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

export type ModelManifest = {
  readonly version: string
  readonly assets: {
    readonly model: ModelAsset
    readonly tokenizer: ModelAsset
    readonly voice: ModelAsset
  }
}

export const TTS_MODEL_VERSION = "v1" as const

/**
 * Manifest v1 — valores reais:
 * model_quantized.onnx: 92361116 bytes, fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478
 * tokenizer.json: 3497 bytes, 77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34
 * pf_dora.bin: 522240 bytes, 3da7b5b2d91847ebf5646f57631af6ececae3c29a89cd300f06edf9aa6cfe9ee
 */
export const DEFAULT_MANIFEST: ModelManifest = {
  version: TTS_MODEL_VERSION,
  assets: {
    model: {
      path: "model_quantized.onnx",
      bytes: 92_361_116,
      sha256: "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478",
    },
    tokenizer: {
      path: "tokenizer.json",
      bytes: 3_497,
      sha256: "77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34",
    },
    voice: {
      path: "voices/pf_dora.bin",
      bytes: 522_240,
      sha256: "3da7b5b2d91847ebf5646f57631af6ececae3c29a89cd300f06edf9aa6cfe9ee",
    },
  },
} as const

export function manifestAssetList(manifest: ModelManifest): readonly ModelAsset[] {
  return [manifest.assets.model, manifest.assets.tokenizer, manifest.assets.voice] as const
}
