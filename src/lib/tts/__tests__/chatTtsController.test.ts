import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createChatTtsController } from "../chatTtsController"
import { createTtsOrchestrator } from "../orchestrator"
import { createAudioPlayer, createFakeAudioPlayer } from "../player"
import { createMockDomAudio } from "./helpers/mockAudioContext"
import type { TtsService, TtsState, AudioResult } from "../types"
import { ttsPreferenceDebugReset } from "../preference"

function fakeAudio(text: string, durationSec = 0.1): AudioResult {
  const samples = new Float32Array(Math.floor(durationSec * 24000))
  return { samples, sampleRate: 24000, channels: 1, durationSec, wav: new Uint8Array(44), text }
}

function createFakeTts(): TtsService & { getSynthCalls(): string[] } {
  const synthCalls: string[] = []
  let state: TtsState = "UNINITIALIZED"
  return {
    getState: () => state,
    isSupported: () => true,
    load: async () => {
      state = "LOADING"
      await new Promise((r) => setTimeout(r, 1))
      state = "READY"
    },
    synthesize: async (text: string) => {
      synthCalls.push(text)
      state = "SYNTHESIZING"
      await new Promise((r) => setTimeout(r, 2))
      state = "READY"
      return fakeAudio(text, 5)
    },
    dispose: async () => {
      state = "DISPOSED"
    },
    getSynthCalls: () => [...synthCalls],
  }
}

function storageMock() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  }
}

async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timeout")
    await new Promise((r) => setTimeout(r, 5))
  }
}

function makeEnv() {
  const tts = createFakeTts()
  const player = createFakeAudioPlayer()
  const orch = createTtsOrchestrator({ tts: tts as unknown as TtsService, player })
  const controller = createChatTtsController({ orchestrator: orch })
  return { tts, player, orch, controller }
}

/** Ambiente com player real (AudioContext falso) bloqueado pela política de autoplay. */
function makeBlockedEnv() {
  const dom = createMockDomAudio({ state: "suspended", resumeMode: "reject" })
  const tts = createFakeTts()
  const player = createAudioPlayer({ createAudioContext: () => dom.ctx })
  const orch = createTtsOrchestrator({ tts: tts as unknown as TtsService, player })
  const controller = createChatTtsController({ orchestrator: orch })
  return { tts, player, orch, controller, dom }
}

const GOOD_RESPONSE = "## Plano de hoje\n\n- Beba água\n- Caminhe 30 min\n\nFonte: ver https://exemplo.com/dieta"

describe("Chat TTS Controller — TTS-INTEGRATION-003", () => {
  beforeEach(() => {
    ;(globalThis as unknown as { window?: unknown }).window = { localStorage: storageMock() }
    ttsPreferenceDebugReset()
  })

  afterEach(() => {
    ttsPreferenceDebugReset()
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it("T20 — TTS OFF: noteResponse não fala e fase é 'off'", async () => {
    const { controller, tts } = makeEnv()
    controller.noteResponse(GOOD_RESPONSE)
    await new Promise((r) => setTimeout(r, 20))
    expect(tts.getSynthCalls().length).toBe(0)
    const ui = controller.getUiState()
    expect(ui.enabled).toBe(false)
    expect(ui.phase).toBe("off")
    expect(ui.hasTarget).toBe(true) // resposta concluída disponível para falar
  })

  it("T21 — toggleAction OFF→ON ativa e autoplay a resposta atual (D26)", async () => {
    const { controller, player, tts } = makeEnv()
    controller.noteResponse(GOOD_RESPONSE)
    controller.toggleAction()
    expect(controller.getUiState().enabled).toBe(true)
    await waitFor(() => controller.getUiState().phase === "ended")
    expect(tts.getSynthCalls().join("\n")).toContain("Plano de hoje. Beba água. Caminhe 30 min.")
    expect(player.getPlayed().length).toBe(1)
  })

  it("T22 — ciclo do botão único: Play→Pause→Resume→ENDED", async () => {
    const { controller, orch } = makeEnv()
    controller.noteResponse(GOOD_RESPONSE)
    controller.toggleAction() // ON + autoplay
    await waitFor(() => orch.getState() === "PLAYING")
    controller.toggleAction() // pause
    expect(controller.getUiState().phase).toBe("paused")
    expect(orch.getState()).toBe("PAUSED")
    controller.toggleAction() // resume
    expect(controller.getUiState().phase).toBe("playing")
    await waitFor(() => orch.getState() === "ENDED")
  })

  it("T23 — resposta concluída: replay usa o MESMO áudio, sem nova síntese (D11/D22)", async () => {
    const { controller, player, tts } = makeEnv()
    controller.noteResponse(GOOD_RESPONSE)
    controller.toggleAction() // ON + autoplay
    await waitFor(() => controller.getUiState().phase === "ended")
    const synthAfterFirst = tts.getSynthCalls().length
    expect(synthAfterFirst).toBe(1)
    const playedAfterFirst = player.getPlayed().length

    controller.toggleAction() // ended → replay
    await waitFor(() => controller.getUiState().phase === "ended")
    expect(tts.getSynthCalls().length).toBe(synthAfterFirst) // sem re-síntese
    expect(player.getPlayed().length).toBe(playedAfterFirst) // replay interno
  })

  it("T24 — invalidate (nova interação) interrompe o TTS atual (D08/D11)", async () => {
    const { controller, orch } = makeEnv()
    controller.noteResponse(GOOD_RESPONSE)
    controller.toggleAction()
    await waitFor(() => orch.getState() === "PLAYING")
    controller.invalidate()
    expect(orch.getState()).toBe("IDLE")
    expect(controller.getUiState().enabled).toBe(true) // preferência mantida
  })

  it("T25 — gate: resposta não elegível não fala e hasTarget=false (D18)", async () => {
    const { controller, tts } = makeEnv()
    controller.noteResponse("Beba água 🥤")
    await new Promise((r) => setTimeout(r, 20))
    expect(tts.getSynthCalls().length).toBe(0)
    expect(controller.getUiState().hasTarget).toBe(false)
  })

  it("T26 — erro de síntese NÃO desativa o TTS (D19/§19)", async () => {
    const ttsBad = createFakeTts()
    ;(ttsBad as unknown as { synthesize: (t: string) => Promise<AudioResult> }).synthesize = async () => {
      throw new Error("ort falhou")
    }
    const player = createFakeAudioPlayer()
    const orch = createTtsOrchestrator({ tts: ttsBad, player })
    const controller = createChatTtsController({ orchestrator: orch })
    controller.setEnabled(true)
    controller.noteResponse(GOOD_RESPONSE)
    await waitFor(() => controller.getUiState().phase === "error")
    const ui = controller.getUiState()
    expect(ui.enabled).toBe(true) // continua ativado
    expect(ui.phase).toBe("error")
    expect(ui.message).toBeTruthy()
  })

  it("T27 — setEnabled(false) interrompe imediatamente (D09/destivação)", async () => {
    const { controller, orch } = makeEnv()
    controller.setEnabled(true)
    controller.noteResponse(GOOD_RESPONSE)
    await waitFor(() => orch.getState() === "PLAYING")
    controller.setEnabled(false)
    expect(orch.getState()).toBe("IDLE")
    expect(controller.getUiState().enabled).toBe(false)
    expect(controller.getUiState().phase).toBe("off")
  })

  it("T28 — toggleAction sem alvo falável desliga", async () => {
    const { controller } = makeEnv()
    controller.setEnabled(true)
    expect(controller.getUiState().enabled).toBe(true)
    controller.toggleAction() // ON, sem alvo → OFF
    expect(controller.getUiState().enabled).toBe(false)
  })

  it("T29 — snapshot estável + subscribe notifica mudanças", async () => {
    const { controller, orch } = makeEnv()
    const events: string[] = []
    controller.subscribe(() => events.push(controller.getUiState().phase))
    const s1 = controller.getUiSnapshot()
    expect(controller.getUiSnapshot()).toBe(s1) // estável sem mudanças

    controller.setEnabled(true)
    controller.noteResponse(GOOD_RESPONSE)
    await waitFor(() => orch.getState() === "PLAYING")
    expect(events.length).toBeGreaterThan(0)
    const s2 = controller.getUiSnapshot()
    expect(s2).not.toBe(s1)
    expect(s2.enabled).toBe(true)
  })

  it("T30 — nova resposta substitui o alvo (autoplay do texto atual)", async () => {
    const { controller, player, tts } = makeEnv()
    controller.setEnabled(true)
    controller.noteResponse(GOOD_RESPONSE)
    const second = "## Nova orientação\n\n- Coma fruta\n- Durma cedo\n- Hidrate-se"
    await waitFor(() => player.getPlayed().length === 1)
    controller.noteResponse(second)
    await waitFor(() => player.getPlayed().length === 2)
    const synths = tts.getSynthCalls()
    expect(synths.at(-1)).toContain("Nova orientação")
  })

  it("T31 — dispose interrompe reprodução em andamento", async () => {
    const { controller, orch } = makeEnv()
    controller.setEnabled(true)
    controller.noteResponse(GOOD_RESPONSE)
    await waitFor(() => orch.getState() === "PLAYING")
    await controller.dispose()
    // orchestrator injetado não é destruído pelo controller, mas deve parar
    expect(orch.getState()).toBe("IDLE")
    // pós-dispose: ações são no-ops (preferência permanece intocada)
    controller.toggleAction()
    expect(orch.getState()).toBe("IDLE")
  })

  it("T32 — snapshot nunca é null após notify sem mudança de estado (regressão TTS-PWA-001)", async () => {
    const { controller } = makeEnv()
    controller.setEnabled(true)
    controller.noteResponse(GOOD_RESPONSE)
    await waitFor(() => controller.getUiState().phase === "ended")
    // Notify repetido com o MESMO valor de preferência (ex.: setEnabled(true) duas vezes)
    controller.setEnabled(true)
    const s = controller.getUiState()
    expect(s).not.toBeNull()
    expect(s.phase).toBe("ended")
    const snap = controller.getUiSnapshot()
    expect(snap).not.toBeNull()
    expect(snap.enabled).toBe(true)
  })

  describe("unlock TTS-PROD-FIX-001 (controller/integração)", () => {
    it("FIX-C1 — unlock no gesto independe da resposta e habilita autoplay posterior", async () => {
      const { controller, player } = makeEnv()
      // Gesto do usuário: unlock ANTES de a resposta chegar (sem depender dela)
      const r = await controller.unlock()
      expect(r).toEqual({ ok: true, state: "running" })
      // Resposta chega depois → autoplay funciona
      controller.setEnabled(true)
      controller.noteResponse(GOOD_RESPONSE)
      await waitFor(() => controller.getUiState().phase === "ended")
      expect(player.getPlayed().length).toBe(1)
    })

    it("FIX-C2 — contexto bloqueado: unlock reporta a falha real e o Chat segue funcional (observável)", async () => {
      const { controller, orch } = makeBlockedEnv()
      const r = await controller.unlock()
      expect(r).not.toBeNull()
      expect(r!.ok).toBe(false)
      expect(r!.state).toBe("suspended")
      expect(r!.error).toContain("NotAllowedError")

      // Autoplay sem gesto → falha controlada: phase=error, TTS NÃO desativa
      controller.setEnabled(true)
      controller.noteResponse(GOOD_RESPONSE)
      await waitFor(() => controller.getUiState().phase === "error")
      const ui = controller.getUiState()
      expect(ui.enabled).toBe(true) // chat/TTS continuam utilizáveis
      expect(ui.phase).toBe("error")
      expect(ui.message).toContain("AudioContext não está running")
      // Orchestrator em ERROR (não falso PLAYING/ENDED)
      expect(orch.getState()).toBe("ERROR")
    })

    it("FIX-C3 — após desbloquear no gesto, a leitura retoma (recuperação observável)", async () => {
      const { controller, orch, dom } = makeBlockedEnv()
      // Primeiro autoplay sem gesto → erro observável
      controller.setEnabled(true)
      controller.noteResponse(GOOD_RESPONSE)
      await waitFor(() => controller.getUiState().phase === "error")
      expect(orch.getState()).toBe("ERROR")

      // Gesto do usuário chega: resume agora é permitido → unlock ok
      dom.setResumeMode("ok")
      dom.setState("suspended")
      const r = await controller.unlock()
      expect(r).toEqual({ ok: true, state: "running" })

      // Ouvir novamente (replay do alvo) agora reproduz de verdade
      controller.replay()
      await waitFor(() => orch.getState() === "PLAYING")
      // Source realmente iniciado (nada de silêncio)
      expect(dom.sources.length).toBeGreaterThanOrEqual(1)
      // Fim natural do áudio → ENDED (erro anterior limpo)
      dom.sources[dom.sources.length - 1]!.onended?.()
      await waitFor(() => orch.getState() === "ENDED")
      const ui = controller.getUiState()
      expect(ui.phase).toBe("ended")
      expect(ui.enabled).toBe(true)
    })
  })
})