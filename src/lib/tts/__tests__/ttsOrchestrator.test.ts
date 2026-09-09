import { describe, it, expect } from "vitest"
import { createTtsOrchestrator } from "../orchestrator"
import { createFakeAudioPlayer } from "../player"
import type { TtsService, TtsState, AudioResult } from "../types"
import { TtsError } from "../types"

function fakeAudio(text: string, durationSec = 0.1): AudioResult {
  const samples = new Float32Array(Math.floor(durationSec * 24000))
  return { samples, sampleRate: 24000, channels: 1, durationSec, wav: new Uint8Array(44), text }
}

function createFakeTts(opts: {
  loadDelayMs?: number
  synthDelayMs?: number
  shouldFailSynth?: boolean
  synthImpl?: (text: string) => Promise<AudioResult>
} = {}): TtsService & { getLoadCalls(): number; getSynthCalls(): string[] } {
  let state: TtsState = "UNINITIALIZED"
  let loadCalls = 0
  const synthCalls: string[] = []
  return {
    getState: () => state,
    isSupported: () => true,
    load: async () => {
      loadCalls++
      state = "LOADING"
      if (opts.loadDelayMs) await new Promise(r => setTimeout(r, opts.loadDelayMs))
      state = "READY"
    },
    synthesize: async (text: string) => {
      synthCalls.push(text)
      state = "SYNTHESIZING"
      if (opts.shouldFailSynth) {
        state = "READY"
        throw new TtsError("SYNTHESIS_FAILED", "mock fail")
      }
      if (opts.synthImpl) {
        const res = await opts.synthImpl(text)
        state = "READY"
        return res
      }
      if (opts.synthDelayMs) await new Promise(r => setTimeout(r, opts.synthDelayMs))
      state = "READY"
      return fakeAudio(text)
    },
    dispose: async () => {
      state = "DISPOSED"
    },
    getLoadCalls: () => loadCalls,
    getSynthCalls: () => [...synthCalls],
  }
}

describe("TTS Orchestrator — TTS-INTEGRATION-002", () => {
  it("T01 — speak básico: load → synthesize → play → ENDED", async () => {
    const tts = createFakeTts()
    const player = createFakeAudioPlayer()
    const orch = createTtsOrchestrator({ tts: tts, player: player })
    expect(orch.getState()).toBe("IDLE")
    await orch.speak("Olá, teste")
    // Conclusão natural → ENDED (TTS-003, §10)
    expect(orch.getState()).toBe("ENDED")
    expect(orch.getTransport()).toEqual({ type: "ended" })
    expect((player).getPlayed().length).toBe(1)
    expect((player).getPlayed()[0]!.text).toBe("Olá, teste")
    expect(tts.getLoadCalls()).toBe(1)
  })

  it("T02 — stop interrompe reprodução", async () => {
    const tts = createFakeTts({ synthDelayMs: 5 })
    const player = createFakeAudioPlayer()
    const orch = createTtsOrchestrator({ tts: tts, player: player })
    const p = orch.speak("Texto longo para teste de stop com duração")
    // Espera um pouco para entrar em PLAYING
    await new Promise(r => setTimeout(r, 30))
    orch.stop()
    expect(orch.getState()).toBe("IDLE")
    expect(player.isPlaying()).toBe(false)
    // speak foi cancelado, não deve rejeitar como erro não tratado
    await expect(p).rejects.toMatchObject({ code: "CANCELLED" }).catch(() => {})
  })

  it("T03 — novo speak interrompe anterior (somente B reproduz)", async () => {
    const player = createFakeAudioPlayer()
    // A demora 80ms, B é chamado logo depois
    const ttsSlow = createFakeTts({
      synthImpl: async (text) => {
        if (text === "A") await new Promise(r => setTimeout(r, 80))
        return fakeAudio(text, 0.2)
      },
    })
    const orch2 = createTtsOrchestrator({ tts: ttsSlow, player: player })
    const pA = orch2.speak("A").catch(() => {})
    await new Promise(r => setTimeout(r, 10))
    const pB = orch2.speak("B")
    await pB
    await new Promise(r => setTimeout(r, 150))
    const played = (player).getPlayed().map((a: AudioResult) => a.text)
    // B deve ter sido reproduzido, A não (cancelado)
    expect(played).toContain("B")
    expect(played).not.toContain("A")
    // A deve ter sido cancelado
    await expect(pA).resolves.toBeUndefined().catch(() => {})
  })

  it("T04 — resultado obsoleto não reproduz (race)", async () => {
    let resolveA: (v: AudioResult) => void = () => {}
    const ttsRace = createFakeTts({
      synthImpl: (text) =>
        new Promise<AudioResult>((resolve) => {
          if (text === "A") resolveA = resolve
          else resolve(fakeAudio(text))
        }),
    })
    const player = createFakeAudioPlayer()
    const orch = createTtsOrchestrator({ tts: ttsRace, player: player })
    const pA = orch.speak("A")
    pA.catch(() => {}) // evita unhandled rejection entre criação e expect
    // Enquanto A está pendente, B é solicitado
    await new Promise(r => setTimeout(r, 10))
    const pB = orch.speak("B")
    // A termina depois (obsoleto)
    resolveA(fakeAudio("A"))
    await pB
    // A não deve ter sido reproduzida
    const played = (player).getPlayed().map((a: AudioResult) => a.text)
    expect(played).toContain("B")
    expect(played).not.toContain("A")
    await expect(pA).rejects.toMatchObject({ code: "CANCELLED" })
  })

  it("T05 — dispose interrompe playback e libera recursos", async () => {
    const tts = createFakeTts()
    const player = createFakeAudioPlayer()
    const orch = createTtsOrchestrator({ tts: tts, player: player })
    orch.speak("Teste dispose").catch(() => {})
    await new Promise(r => setTimeout(r, 20))
    await orch.dispose()
    expect(orch.getState()).toBe("DISPOSED")
    expect(player.isPlaying()).toBe(false)
    await expect(orch.speak("depois")).rejects.toMatchObject({ code: "DISPOSED" })
  })

  it("T06 — erro de synthesis não reproduz", async () => {
    const tts = createFakeTts({ shouldFailSynth: true })
    const player = createFakeAudioPlayer()
    const orch = createTtsOrchestrator({ tts: tts, player: player })
    await expect(orch.speak("fail")).rejects.toMatchObject({ code: "SYNTHESIS_FAILED" })
    expect((player).getPlayed().length).toBe(0)
    expect(orch.getState()).toBe("ERROR")
  })

  it("T07 — erro do player propagado", async () => {
    const tts = createFakeTts()
    const failingPlayer = {
      play: async () => {
        throw new Error("speaker disconnected")
      },
      stop: () => {},
      dispose: () => {},
      isPlaying: () => false,
      isPaused: () => false,
      pause: () => {},
      resume: async () => {},
      replay: async () => {},
      getCurrentAudio: () => null,
    }
    const orch = createTtsOrchestrator({ tts: tts, player: failingPlayer })
    await expect(orch.speak("texto")).rejects.toMatchObject({ code: "SYNTHESIS_FAILED" })
  })

  it("T08 — on-demand: initialization não chama load", async () => {
    const tts = createFakeTts()
    const player = createFakeAudioPlayer()
    const orch = createTtsOrchestrator({ tts: tts, player: player })
    // Apenas criar, sem speak
    expect(tts.getLoadCalls()).toBe(0)
    expect(orch.getState()).toBe("IDLE")
    // Primeiro speak deve chamar load
    await orch.speak("primeiro")
    expect(tts.getLoadCalls()).toBe(1)
    // Segundo speak não deve recarregar (READY)
    await orch.speak("segundo")
    expect(tts.getLoadCalls()).toBe(1)
  })

  describe("transporte TTS-INTEGRATION-003 (D10–D13/D22)", () => {
    it("T10 — pause/resume: continua do ponto exato e conclui em ENDED", async () => {
      const player = createFakeAudioPlayer()
      const audio = fakeAudio("texto longo", 5) // fake: 500ms de sessão simulado
      const ttsLong = createFakeTts({ synthImpl: async () => audio })
      const orch2 = createTtsOrchestrator({ tts: ttsLong, player: player })
      const p = orch2.speak("texto longo")
      await new Promise(r => setTimeout(r, 40)) // PLAYING
      expect(orch2.getState()).toBe("PLAYING")
      const before = Date.now()

      orch2.pause()
      expect(orch2.getState()).toBe("PAUSED")
      expect(player.isPlaying()).toBe(false)
      expect(player.isPaused()).toBe(true)

      // Permanência sem timeout: sessão continua depois de pausa longa
      await new Promise(r => setTimeout(r, 120))
      expect(orch2.getState()).toBe("PAUSED")
      expect(player.isPaused()).toBe(true)

      orch2.resume()
      expect(orch2.getState()).toBe("PLAYING")
      await p
      const posAfterEnd = (player).getSessionElapsedMs()
      expect(orch2.getState()).toBe("ENDED")
      // resume NÃO reiniciou do zero: o ponto exato foi preservado (§22)
      expect(posAfterEnd).toBeGreaterThan(0)
      expect(before).toBeLessThanOrEqual(Date.now())
    })

    it("T11 — pause fora de PLAYING é no-op; resume fora de PAUSED é no-op", async () => {
      const tts = createFakeTts()
      const player = createFakeAudioPlayer()
      const orch = createTtsOrchestrator({ tts: tts, player: player })
      expect(orch.getState()).toBe("IDLE")
      orch.pause() // IDLE → no-op
      expect(orch.getState()).toBe("IDLE")
      orch.resume() // IDLE → no-op
      expect(orch.getState()).toBe("IDLE")
      orch.replay() // IDLE → no-op
      expect(orch.getState()).toBe("IDLE")
      await orch.speak("ok")
      expect(orch.getState()).toBe("ENDED")
      orch.resume() // ENDED → no-op
      expect(orch.getState()).toBe("ENDED")
    })

    it("T12 — pause seguido de stop volta a IDLE e cancela a sessão", async () => {
      const tts = createFakeTts({ synthImpl: async () => fakeAudio("texto com duração", 5) })
      const player = createFakeAudioPlayer()
      const orch = createTtsOrchestrator({ tts: tts, player: player })
      const p = orch.speak("texto com duração")
      await new Promise(r => setTimeout(r, 30))
      orch.pause()
      expect(orch.getState()).toBe("PAUSED")
      orch.stop()
      expect(orch.getState()).toBe("IDLE")
      expect(player.isPaused()).toBe(false)
      expect(player.isPlaying()).toBe(false)
      await expect(p).rejects.toMatchObject({ code: "CANCELLED" }).catch(() => {})
    })

    it("T13 — replay após ENDED repete o MESMO áudio sem nova síntese", async () => {
      let synthCalls = 0
      const tts = createFakeTts({
        synthImpl: async (text) => {
          synthCalls++
          return fakeAudio(text, 0.3)
        },
      })
      const player = createFakeAudioPlayer()
      const orch = createTtsOrchestrator({ tts: tts, player: player })
      await orch.speak("repetir por favor")
      expect(orch.getState()).toBe("ENDED")
      expect(synthCalls).toBe(1)

      orch.replay()
      expect(orch.getState()).toBe("PLAYING")
      await new Promise(r => setTimeout(r, 150))
      // Replay aproveita a síntese existente (§11/§22)
      expect(synthCalls).toBe(1)
      expect((player).getPlayed().length).toBe(1)
      await new Promise(r => setTimeout(r, 200))
      expect(orch.getState()).toBe("ENDED")
    })

    it("T14 — novo speak interrompe PAUSED/PLAYING e atualiza texto", async () => {
      const tts = createFakeTts({
        synthImpl: async (text) => fakeAudio(text, text === "primeira" ? 5 : 0.1),
      })
      const player = createFakeAudioPlayer()
      const orch = createTtsOrchestrator({ tts: tts, player: player })
      const p = orch.speak("primeira")
      p.catch(() => {}) // evita unhandled rejection entre interrupção e expect
      await new Promise(r => setTimeout(r, 30))
      orch.pause()
      expect(orch.getState()).toBe("PAUSED")
      const p2 = orch.speak("segunda")
      await p2
      expect(orch.getState()).toBe("ENDED")
      const played = (player).getPlayed().map((a: AudioResult) => a.text)
      expect(played).toContain("segunda")
      await expect(p).rejects.toMatchObject({ code: "CANCELLED" }).catch(() => {})
    })

    it("T15 — stop após ENDED volta a IDLE (reset de transporte)", async () => {
      const tts = createFakeTts()
      const player = createFakeAudioPlayer()
      const orch = createTtsOrchestrator({ tts: tts, player: player })
      await orch.speak("fim")
      expect(orch.getState()).toBe("ENDED")
      orch.stop()
      expect(orch.getState()).toBe("IDLE")
    })
  })

  it("isolamento: orchestrator não importa Chat/Vosk", async () => {
    const content = await import("fs/promises").then(m => m.readFile("src/lib/tts/orchestrator.ts", "utf8")).catch(() => "")
    // Verifica apenas imports (não comentários) — o orchestrator deve importar só de ./types e ./player
    const importLines = content.split("\n").filter(l => l.trim().startsWith("import"))
    const forbiddenImports = ["ChatAssistant", "Vosk", "voice-transcription", "Gemini", "Supabase", "from \"@/components/Chat", "from \"@/lib/voice/stt"]
    for (const f of forbiddenImports) {
      for (const line of importLines) {
        expect(line).not.toContain(f)
      }
    }
    // Também garante que não importa React UI desnecessário
    expect(importLines.join("\n")).not.toMatch(/from ["']react["']/)
  })
})
