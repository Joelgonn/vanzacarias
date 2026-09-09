import { describe, it, expect } from "vitest"
import { createAudioPlayer, createFakeAudioPlayer } from "../player"
import type { AudioResult } from "../types"

function fakeAudio(durationSec = 1): AudioResult {
  const samples = new Float32Array(Math.floor(durationSec * 24000))
  return { samples, sampleRate: 24000, channels: 1, durationSec, wav: new Uint8Array(44), text: "x" }
}

function mockDomAudio() {
  const sources: Array<{
    startCalls: number[]
    stopped: boolean
    connected: boolean
    onended: (() => void) | null
    stop: () => void
    connect: () => void
    disconnect: () => void
    start: (when: number, offset?: number) => void
  }> = []
  const audio: { currentTime: number; state: string } = { currentTime: 0, state: "running" }
  const ctx = {
    get currentTime() {
      return audio.currentTime
    },
    get state() {
      return audio.state
    },
    set state(v: string) {
      audio.state = v
    },
    destination: {},
    createBuffer: () => ({ copyToChannel: () => {} }),
    createBufferSource: () => {
      const s = {
        buffer: null,
        startCalls: [] as number[],
        stopped: false,
        connected: false,
        onended: null as (() => void) | null,
        connect: () => {
          s.connected = true
        },
        disconnect: () => {
          s.connected = false
        },
        start: (_when: number, offset = 0) => {
          s.startCalls.push(offset)
        },
        stop: () => {
          s.stopped = true
        },
      }
      sources.push(s)
      return s
    },
    resume: async () => {
      audio.state = "running"
    },
  }
  return { ctx: ctx as unknown as AudioContext, sources, setTime: (t: number) => (audio.currentTime = t) }
}

describe("Audio Player — transporte TTS-INTEGRATION-003", () => {
  describe("createAudioPlayer (Web Audio)", () => {
    it("reproduz a partir do offset 0 e resolve ao terminar naturalmente", async () => {
      const dom = mockDomAudio()
      const player = createAudioPlayer({ createAudioContext: () => dom.ctx })
      const p = player.play(fakeAudio(2))
      expect(player.isPlaying()).toBe(true)
      expect(dom.sources.length).toBe(1)
      expect(dom.sources[0]!.startCalls[0]).toBe(0)
      dom.sources[0]!.onended?.()
      await p
      expect(player.isPlaying()).toBe(false)
      expect(player.isPaused()).toBe(false)
    })

    it("pause/resume: resume continua do ponto exato da pausa (D11/D22)", async () => {
      const dom = mockDomAudio()
      const player = createAudioPlayer({ createAudioContext: () => dom.ctx })
      const p = player.play(fakeAudio(10))
      dom.sources[0]!.onended = () => {}
      dom.setTime(1.5)
      player.pause()
      expect(player.isPlaying()).toBe(false)
      expect(player.isPaused()).toBe(true)
      expect(dom.sources[0]!.stopped).toBe(true)

      // resume cria novo source no offset exato (1.5s), NÃO do zero
      const resumeP = player.resume()
      expect(dom.sources.length).toBe(2)
      expect(dom.sources[1]!.startCalls[0]).toBe(1.5)
      expect(player.isPlaying()).toBe(true)
      expect(player.isPaused()).toBe(false)

      dom.setTime(2)
      dom.sources[1]!.onended?.()
      await p
      await resumeP
      expect(player.isPlaying()).toBe(false)
    })

    it("sem timeout de pausa: áudio permanece disponível pausado (D22)", () => {
      const dom = mockDomAudio()
      const player = createAudioPlayer({ createAudioContext: () => dom.ctx })
      void player.play(fakeAudio(5))
      dom.setTime(1)
      player.pause()
      dom.setTime(1000) // pausa "indefinida"
      expect(player.isPaused()).toBe(true)
      expect(player.getCurrentAudio()).not.toBeNull()
      // pause repetida não quebra nem muda offset
      player.pause()
      expect(player.isPaused()).toBe(true)
      const resumeP = player.resume()
      expect(dom.sources[1].startCalls[0]).toBe(1)
      void resumeP
      player.stop()
    })

    it("stop resolve a sessão pendente (sem promise pendurada)", async () => {
      const dom = mockDomAudio()
      const player = createAudioPlayer({ createAudioContext: () => dom.ctx })
      let settled = false
      const p = player.play(fakeAudio(10)).then(() => {
        settled = true
      })
      await new Promise((r) => setTimeout(r, 5))
      player.stop()
      await p
      expect(settled).toBe(true)
      expect(player.isPlaying()).toBe(false)
      expect(player.isPaused()).toBe(false)
    })

    it("replay reinicia o áudio atual do início sem nova play de origem", async () => {
      const dom = mockDomAudio()
      const player = createAudioPlayer({ createAudioContext: () => dom.ctx })
      const p = player.play(fakeAudio(8))
      dom.sources[0]!.onended = () => {}
      dom.setTime(3)
      const replayP = player.replay()
      dom.sources[0]!.stopped = true
      expect(dom.sources.length).toBe(2)
      expect(dom.sources[1]!.startCalls[0]).toBe(0)
      expect(player.isPlaying()).toBe(true)
      dom.sources[1]!.onended?.()
      await p
      await replayP
      expect(player.isPlaying()).toBe(false)
    })
  })

  describe("createFakeAudioPlayer (tests Node)", () => {
    it("play → pause → resume preserva posição (não reinicia)", async () => {
      const player = createFakeAudioPlayer()
      const p = player.play(fakeAudio(5)) // 500ms simulado
      await new Promise((r) => setTimeout(r, 40))
      player.pause()
      const pausedAt = player.getSessionElapsedMs()
      expect(player.isPaused()).toBe(true)
      expect(pausedAt).toBeGreaterThan(0)
      await new Promise((r) => setTimeout(r, 60))
      expect(player.getSessionElapsedMs()).toBe(pausedAt) // congelado
      const resumeP = player.resume()
      expect(player.isPlaying()).toBe(true)
      await p
      await resumeP
      expect(player.getSessionElapsedMs()).toBeGreaterThanOrEqual(pausedAt)
    })

    it("replay reseta a posição de execução", async () => {
      const player = createFakeAudioPlayer()
      await player.play(fakeAudio(5))
      const total = player.getSessionElapsedMs()
      const replayP = player.replay()
      expect(player.getSessionElapsedMs()).toBeLessThanOrEqual(10) // do zero
      await replayP
      expect(player.getSessionElapsedMs()).toBe(total)
    })

    it("stop resolve sessão pendente e limpa áudio atual", async () => {
      const player = createFakeAudioPlayer()
      const p = player.play(fakeAudio(10))
      let settled = false
      p.then(() => (settled = true))
      player.stop()
      await p
      expect(settled).toBe(true)
      expect(player.getCurrentAudio()).toBeNull()
    })

    it("controle de chamadas para o orchestrator (getPlayed)", async () => {
      const player = createFakeAudioPlayer()
      const a = fakeAudio(0.1)
      const b = fakeAudio(0.2)
      await player.play(a)
      const r = player.replay()
      await player.play(b)
      void r
      expect(player.getPlayed().map((x) => x.text)).toEqual([a.text, b.text])
    })

    it("fake não possui ÁudioContext (Node-safe)", () => {
      const player = createFakeAudioPlayer()
      player.dispose()
      expect(player.isPlaying()).toBe(false)
    })
  })
})