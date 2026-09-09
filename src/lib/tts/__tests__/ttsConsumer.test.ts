import { describe, it, expect } from "vitest"
import { createTtsService } from "../synthesizer"

const MODELS_DIR = "C:/Users/joelg/Documents/Vanusa/voice-synthesis/models"

describe("TTS Consumer Boundary — TTS-INTEGRATION-001", () => {
  it("isSupported() true no Node ≥18", () => {
    const tts = createTtsService({ modelsDir: MODELS_DIR })
    expect(tts.isSupported()).toBe(true)
    expect(tts.getState()).toBe("UNINITIALIZED")
  })

  it("synthesize antes de load rejeita NOT_READY", async () => {
    const tts = createTtsService({ modelsDir: MODELS_DIR })
    await expect(tts.synthesize("olá")).rejects.toMatchObject({ code: "NOT_READY" })
  })

  it("lifecycle completo: load → synthesize → dispose → reload", async () => {
    const tts = createTtsService({ modelsDir: MODELS_DIR })
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
  }, 120000)

  it("INVALID_TEXT para string vazia", async () => {
    const tts = createTtsService({ modelsDir: MODELS_DIR })
    await tts.load()
    await expect(tts.synthesize("   ")).rejects.toMatchObject({ code: "INVALID_TEXT" })
    await tts.dispose()
  }, 30000)

  it("não expõe internals do engine", async () => {
    const tts = createTtsService({ modelsDir: MODELS_DIR })
    // O consumidor só vê TtsService, não Kokoro internals
    expect(Object.keys(tts).sort()).toEqual(["dispose", "getState", "isSupported", "load", "synthesize"].sort())
    await tts.load()
    // synthesize não deve exigir tokenizer/voicepack
    const audio = await tts.synthesize("Teste de isolamento")
    expect(audio.samples).toBeDefined()
    await tts.dispose()
  }, 30000)
})
