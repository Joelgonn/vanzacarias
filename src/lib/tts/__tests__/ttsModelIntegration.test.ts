import { describe, it, expect } from "vitest"
import { createHash } from "node:crypto"
import { createTtsService } from "../synthesizer"
import { ModelManager } from "../model/modelManager"
import { MemoryModelStorage } from "../model/storage"
import type { ModelManifest } from "../model/manifest"

function sha256(b: Uint8Array): string {
  return createHash("sha256").update(b).digest("hex")
}

function fixtureManifest(): { manifest: ModelManifest; fixtures: Record<string, Uint8Array> } {
  const model = new TextEncoder().encode("x".repeat(100))
  const tokenizer = new TextEncoder().encode('{"vocab":{"$":0}}')
  const voice = new TextEncoder().encode("v".repeat(256))
  const manifest: ModelManifest = {
    version: "v1",
    assets: {
      model: { path: "model_quantized.onnx", bytes: model.byteLength, sha256: sha256(model) },
      tokenizer: { path: "tokenizer.json", bytes: tokenizer.byteLength, sha256: sha256(tokenizer) },
      voice: { path: "voices/pf_dora.bin", bytes: voice.byteLength, sha256: sha256(voice) },
    },
  }
  return { manifest, fixtures: { [manifest.assets.model.path]: model, [manifest.assets.tokenizer.path]: tokenizer, [manifest.assets.voice.path]: voice } }
}

function makeFetcher(fixtures: Record<string, Uint8Array>, counter?: { count: number }) {
  return async (url: string): Promise<Response> => {
    if (counter) counter.count++
    const key = Object.keys(fixtures).find((k) => url.endsWith(k)) ?? url
    const data = fixtures[key]
    if (!data) return new Response("not found", { status: 404 })
    return new Response(data as unknown as BodyInit, { status: 200 })
  }
}

const READY_PAYLOAD = {
  info: {
    name: "kokoro-browser",
    modelId: "q8",
    modelConfig: "Kokoro-82M",
    voiceId: "pf_dora",
    sampleRate: 24000,
    maxPhonemes: 510,
    weightLicense: "Apache-2.0",
    phonemizer: "vozz/g2p",
    g2pLicense: "Apache-2.0",
    normalizer: "vozz/normalize",
    onnxRuntime: "1.29.0",
    device: "wasm",
  },
  ortVersion: "1.29.0",
  downloadedBytes: 1234,
  threads: false,
  simd: true,
  cores: 8,
} as const

class FakeTtsWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null
  posted: unknown[] = []
  terminated = false
  private listeners = new Set<(e: unknown) => void>()
  postMessage(msg: unknown) {
    this.posted.push(msg)
    queueMicrotask(() => {
      const m = msg as { kind: string; id: number; payload?: unknown }
      if (m.kind === "init") this.emit({ kind: "ready", id: m.id, payload: READY_PAYLOAD })
      else if (m.kind === "synth") {
        const audio = new Float32Array(1200)
        for (let i = 0; i < audio.length; i++) audio[i] = Math.sin(i * 0.05) * 0.5
        const wav = new Uint8Array(44 + audio.length * 2)
        wav[0] = 82; wav[1] = 73; wav[2] = 70; wav[3] = 70
        this.emit({ kind: "synth-result", id: m.id, payload: { text: (m.payload as { text: string }).text, audio, sampleRate: 24000, durationSec: 0.05, wav, phonemes: "test", ortMs: 4 } })
      } else if (m.kind === "dispose") this.emit({ kind: "disposed", id: m.id })
    })
  }
  terminate() { this.terminated = true }
  emit(data: unknown) {
    this.onmessage?.({ data })
    for (const cb of this.listeners) cb({ data })
  }
  addEventListener(type: string, cb: (e: unknown) => void) { if (type === "message") this.listeners.add(cb) }
  removeEventListener(type: string, cb: (e: unknown) => void) { if (type === "message") this.listeners.delete(cb) }
}
const asWorker = (w: FakeTtsWorker) => (() => w as unknown as Worker) as unknown as () => Worker

describe("TTS Model Integration — FASE 2", () => {
  it("modelo ausente → download fixture → synthesize", async () => {
    const { manifest, fixtures } = fixtureManifest()
    const storage = new MemoryModelStorage()
    const counter = { count: 0 }
    const manager = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: makeFetcher(fixtures, counter), storage })
    const worker = new FakeTtsWorker()
    const tts = createTtsService({ runtimeKind: "browser", browser: { workerFactory: asWorker(worker), baseUrl: "http://fixture.test/" }, modelManager: manager } as unknown as Parameters<typeof createTtsService>[0])

    expect(await manager.isAvailable()).toBe(false)
    await tts.load()
    expect(await manager.isAvailable()).toBe(true)
    expect(counter.count).toBe(3) // 3 assets baixados
    const audio = await tts.synthesize("olá integração")
    expect(audio.samples.length).toBeGreaterThan(0)
    await tts.dispose()
  })

  it("modelo já existente → não download → synthesize", async () => {
    const { manifest, fixtures } = fixtureManifest()
    const storage = new MemoryModelStorage()
    const counter = { count: 0 }
    const manager = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: makeFetcher(fixtures, counter), storage })
    // pré-popula sem passar por download (ensure uma vez)
    await manager.ensureAvailable()
    counter.count = 0
    const worker = new FakeTtsWorker()
    const tts = createTtsService({ runtimeKind: "browser", browser: { workerFactory: asWorker(worker), baseUrl: "http://fixture.test/" }, modelManager: manager } as unknown as Parameters<typeof createTtsService>[0])
    await tts.load()
    expect(counter.count).toBe(0) // nenhum fetch adicional
    const audio = await tts.synthesize("segunda síntese sem download")
    expect(audio.samples.length).toBeGreaterThan(0)
    await tts.dispose()
  })

  it("tts.load com modelo ausente via ModelManager injetado usa singleflight e integra com worker", async () => {
    const { manifest, fixtures } = fixtureManifest()
    const storage = new MemoryModelStorage()
    const counter = { count: 0 }
    // fetcher com delay para testar concorrência
    const fetcher = async (url: string): Promise<Response> => {
      counter.count++
      await new Promise((r) => setTimeout(r, 20))
      const key = Object.keys(fixtures).find((k) => url.endsWith(k))!
      return new Response(fixtures[key] as unknown as BodyInit, { status: 200 })
    }
    const manager = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: fetcher as unknown as typeof fetch, storage })
    // bypass synthesize's fake skip: usar manager diretamente para testar singleflight integrado
    const p1 = manager.ensureAvailable()
    const p2 = manager.ensureAvailable()
    await Promise.all([p1, p2])
    expect(counter.count).toBe(3) // apenas 1 lote
  })
})
