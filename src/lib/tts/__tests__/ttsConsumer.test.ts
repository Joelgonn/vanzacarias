import { describe, it, expect } from "vitest"
import { createTtsService } from "../synthesizer"

/**
 * TTS-CAP-004 FASE 1 — Consumer Boundary vendado (browser-only).
 * Branch Node (onnxruntime-node) removida; testes agora usam FakeTtsWorker
 * via `runtimeKind: "browser"` + `workerFactory`, preservando contrato
 * createTtsService → AudioResult → WAV sem depender de `voice-synthesis`.
 */

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

type FakeMsg = { kind: string; id: number; payload?: unknown }
class FakeTtsWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null
  posted: FakeMsg[] = []
  terminated = false
  private messageListeners = new Set<(e: unknown) => void>()
  private errorListeners = new Set<(e: unknown) => void>()
  postMessage(msg: unknown) {
    const m = msg as FakeMsg
    this.posted.push(m)
    queueMicrotask(() => {
      if (m.kind === "init") this.emit({ kind: "ready", id: m.id, payload: READY_PAYLOAD })
      else if (m.kind === "synth") {
        const durationSec = 0.05
        const audio = new Float32Array(Math.floor(durationSec * 24000))
        for (let i = 0; i < audio.length; i++) audio[i] = Math.sin(i * 0.05) * 0.5
        const wav = new Uint8Array(44 + audio.length * 2)
        // Header RIFF minimal for test (real worker uses encodeWav)
        wav[0] = 82; wav[1] = 73; wav[2] = 70; wav[3] = 70
        this.emit({
          kind: "synth-result",
          id: m.id,
          payload: {
            text: (m.payload as { text: string }).text,
            audio,
            sampleRate: 24000,
            durationSec,
            wav,
            phonemes: "kaeiˈteɪst",
            ortMs: 4,
          },
        })
      } else if (m.kind === "dispose") this.emit({ kind: "disposed", id: m.id })
    })
  }
  terminate() { this.terminated = true }
  emit(data: unknown) {
    this.onmessage?.({ data })
    for (const cb of this.messageListeners) cb({ data })
  }
  addEventListener(type: string, cb: (e: unknown) => void) {
    if (type === "message") this.messageListeners.add(cb)
    if (type === "error") this.errorListeners.add(cb)
  }
  removeEventListener(type: string, cb: (e: unknown) => void) {
    if (type === "message") this.messageListeners.delete(cb)
    if (type === "error") this.errorListeners.delete(cb)
  }
}
const asWorker = (w: FakeTtsWorker) => (() => w as unknown as Worker) as unknown as () => Worker
function browserTts(worker: FakeTtsWorker) {
  return createTtsService({ runtimeKind: "browser", browser: { workerFactory: asWorker(worker), baseUrl: "http://tts.test/models/" } })
}

describe("TTS Consumer Boundary — TTS-INTEGRATION-001 (FASE 1 vendado)", () => {
  it("isSupported() true com workerFactory (browser fake) e UNINITIALIZED inicial", () => {
    const tts = browserTts(new FakeTtsWorker())
    expect(tts.isSupported()).toBe(true)
    expect(tts.getState()).toBe("UNINITIALIZED")
  })

  it("synthesize antes de load rejeita NOT_READY", async () => {
    const tts = browserTts(new FakeTtsWorker())
    await expect(tts.synthesize("olá")).rejects.toMatchObject({ code: "NOT_READY" })
  })

  it("lifecycle completo: load → synthesize → dispose → reload", async () => {
    const tts = browserTts(new FakeTtsWorker())
    expect(tts.getState()).toBe("UNINITIALIZED")
    await tts.load()
    expect(tts.getState()).toBe("READY")

    const audio = await tts.synthesize("Olá, este é um teste de síntese em português.")
    expect(audio.samples).toBeInstanceOf(Float32Array)
    expect(audio.samples.length).toBeGreaterThan(0)
    expect(audio.sampleRate).toBe(24000)
    expect(audio.channels).toBe(1)
    expect(audio.durationSec).toBeGreaterThan(0)
    expect(audio.wav).toBeInstanceOf(Uint8Array)
    expect(audio.wav.length).toBeGreaterThan(44)
    // WAV header RIFF
    expect(String.fromCharCode(audio.wav[0]!, audio.wav[1]!, audio.wav[2]!, audio.wav[3]!)).toBe("RIFF")
    expect(audio.text).toBe("Olá, este é um teste de síntese em português.")

    expect(tts.getState()).toBe("READY")

    await tts.dispose()
    expect(tts.getState()).toBe("DISPOSED")

    // reload após dispose (on-demand)
    await tts.load()
    expect(tts.getState()).toBe("READY")
    const audio2 = await tts.synthesize("Segunda síntese após reload.")
    expect(audio2.samples.length).toBeGreaterThan(0)
    await tts.dispose()
  }, 30000)

  it("INVALID_TEXT para string vazia", async () => {
    const tts = browserTts(new FakeTtsWorker())
    await tts.load()
    await expect(tts.synthesize("   ")).rejects.toMatchObject({ code: "INVALID_TEXT" })
    await tts.dispose()
  }, 30000)

  it("não expõe internals do engine", async () => {
    const tts = browserTts(new FakeTtsWorker())
    // O consumidor só vê TtsService, não Kokoro internals
    expect(Object.keys(tts).sort()).toEqual(["dispose", "getState", "isSupported", "load", "synthesize"].sort())
    await tts.load()
    // synthesize não deve exigir tokenizer/voicepack
    const audio = await tts.synthesize("Teste de isolamento")
    expect(audio.samples).toBeDefined()
    await tts.dispose()
  }, 30000)
})
