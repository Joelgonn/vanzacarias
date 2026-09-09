/**
 * TTS-PROD-FIX-001 — helper de teste: AudioContext falso com estado/resume
 * controláveis para simular a política de autoplay do navegador.
 */

export type MockSource = {
  buffer: unknown
  startCalls: number[]
  stopped: boolean
  connected: boolean
  onended: (() => void) | null
  stop: () => void
  connect: () => void
  disconnect: () => void
  start: (when: number, offset?: number) => void
}

export type MockCtxInit = {
  state?: "running" | "suspended" | "closed"
  /** Comportamento de ctx.resume(): "ok" (padrão) vira running; "reject" lança; "stay-suspended" não muda nada. */
  resumeMode?: "ok" | "reject" | "stay-suspended"
}

export function createMockDomAudio(init: MockCtxInit = {}) {
  const sources: MockSource[] = []
  const state: { currentTime: number; value: string } = {
    currentTime: 0,
    value: init.state ?? "running",
  }
  let resumeMode: MockCtxInit["resumeMode"] = init.resumeMode ?? "ok"
  const resumeCalls: number[] = []

  const ctx = {
    get currentTime() {
      return state.currentTime
    },
    get state() {
      return state.value
    },
    destination: {},
    createBuffer: () => ({ copyToChannel: () => {} }),
    createBufferSource: () => {
      const s: MockSource = {
        buffer: null,
        startCalls: [] as number[],
        stopped: false,
        connected: false,
        onended: null,
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
      resumeCalls.push(1)
      if (resumeMode === "reject") {
        throw new DOMException(
          "The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page.",
          "NotAllowedError"
        )
      }
      if (resumeMode === "stay-suspended") return
      state.value = "running"
    },
  }

  return {
    ctx: ctx as unknown as AudioContext,
    sources,
    resumeCalls,
    setState: (v: string) => {
      state.value = v
    },
    getState: () => state.value,
    setResumeMode: (m: MockCtxInit["resumeMode"]) => {
      resumeMode = m
    },
    setTime: (t: number) => {
      state.currentTime = t
    },
  }
}
