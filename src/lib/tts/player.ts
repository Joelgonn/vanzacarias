/**
 * TTS-INTEGRATION-002/003 — Audio Player Adapter
 *
 * Abstração de reprodução para `AudioResult` neutro.
 * Recebe apenas `AudioResult` (samples, sampleRate, wav), nunca Chat/STT.
 * Implementação Web: AudioContext + AudioBufferSourceNode (samples como fonte primária).
 *
 * TTS-INTEGRATION-003 (D10/D11/D22):
 *  - Pause/Resume: Resume continua do ponto exato da pausa (offset em segundos).
 *  - Replay: reinicia o áudio atual do início (sem re-sintetizar).
 *  - Sem timeout de pausa: o áudio permanece disponível até nova interação.
 *  - stop() resolve a sessão pendente (evita promise pendurada indevidamente).
 */

import type { AudioResult } from "./types"

/** Resultado do unlock do AudioContext (TTS-PROD-FIX-001). */
export interface AudioUnlockResult {
  /** true apenas quando o contexto está efetivamente `running`. */
  ok: boolean
  state: AudioContextState | "none"
  error?: string
}

export interface AudioPlayer {
  play(audio: AudioResult): Promise<void>
  pause(): void
  resume(): Promise<void>
  replay(): Promise<void>
  /** Desbloqueia/prepara o AudioContext (chamar dentro do gesto do usuário). */
  unlock(): Promise<AudioUnlockResult>
  stop(): void
  dispose(): void
  isPlaying(): boolean
  isPaused(): boolean
  getCurrentAudio(): AudioResult | null
}

export type AudioPlayerOptions = {
  // Injetáveis para teste (sem AudioContext real em Node)
  createAudioContext?: () => AudioContext
}

export function createAudioPlayer(options: AudioPlayerOptions = {}): AudioPlayer {
  let audioContext: AudioContext | null = null
  let currentAudio: AudioResult | null = null
  let currentSource: AudioBufferSourceNode | null = null

  // Transport (TTS-003): pausa/resume/replay
  let playing = false
  let paused = false
  let startedAt = 0 // ctx.currentTime no último start
  let startOffset = 0 // offset em segundos (resume exato)

  // Sessão: promise pendente de play() (resolve no fim natural)
  let sessionResolve: (() => void) | null = null
  let sessionReject: ((e: Error) => void) | null = null
  let sessionActive = false

  const getContext = (): AudioContext => {
    if (audioContext) return audioContext as AudioContext
    if (options.createAudioContext) {
      const ctx = options.createAudioContext()
      audioContext = ctx
      return ctx
    }
    if (typeof window !== "undefined" && "AudioContext" in window) {
      const ctx = new window.AudioContext()
      audioContext = ctx
      return ctx
    }
    if (typeof window !== "undefined" && "webkitAudioContext" in window) {
      const ctx = new (window as unknown as { webkitAudioContext: new () => AudioContext }).webkitAudioContext()
      audioContext = ctx
      return ctx
    }
    throw new Error("AudioContext não suportado neste ambiente")
  }

  const finishSession = (): void => {
    const resolve = sessionResolve
    sessionResolve = null
    sessionReject = null
    sessionActive = false
    if (resolve) resolve()
  }

  const rejectSession = (e: Error): void => {
    const reject = sessionReject
    sessionResolve = null
    sessionReject = null
    sessionActive = false
    if (reject) reject(e)
  }

  /**
   * TTS-PROD-FIX-001 — verifica/desbloqueia o AudioContext.
   * - Contexto já `running` → resultado SÍNCRONO (fast path, sem suspensão:
   *   preserva o comportamento determinístico do play/resume).
   * - Contexto `suspended` → tenta `resume()` e retorna o estado REAL após a
   *   promessa (nunca engole a falha).
   * - Nunca trata `source.start()` como "tocando" sem o contexto running.
   */
  const resolveUnlocked = (): AudioUnlockResult | Promise<AudioUnlockResult> => {
    let ctx: AudioContext
    try {
      ctx = getContext()
    } catch (e) {
      return { ok: false, state: "none", error: e instanceof Error ? e.message : String(e) }
    }
    if (ctx.state === "running") return { ok: true, state: "running" }
    if (ctx.state === "suspended") {
      return ctx
        .resume()
        .then((): AudioUnlockResult => {
          if (ctx.state === "running") return { ok: true, state: "running" }
          return {
            ok: false,
            state: ctx.state,
            error: `resume() não deixou o contexto running (estado: ${ctx.state})`,
          }
        })
        .catch((e: unknown): AudioUnlockResult => {
          return {
            ok: false,
            state: ctx.state,
            error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
          }
        })
    }
    return {
      ok: false,
      state: ctx.state,
      error: `AudioContext em estado não reproduzível: ${ctx.state}`,
    }
  }

  /** API pública de unlock: sempre Promise, idempotente. */
  const ensureUnlocked = async (): Promise<AudioUnlockResult> => {
    const r = resolveUnlocked()
    return r instanceof Promise ? r : r
  }

  const unlockError = (u: AudioUnlockResult): Error =>
    new Error(
      `AudioContext não está running (${u.state}${u.error ? `: ${u.error}` : ""}). Interaja com o app (toque/enviar) para desbloquear o áudio.`
    )

  const startSource = (audio: AudioResult, offsetSec: number): void => {
    const ctx = audioContext as AudioContext
    const buffer = ctx.createBuffer(1, audio.samples.length, audio.sampleRate)
    buffer.copyToChannel(audio.samples as unknown as Float32Array<ArrayBuffer>, 0)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    currentSource = source
    startedAt = ctx.currentTime
    startOffset = offsetSec
    playing = true
    paused = false

    source.onended = () => {
      if (currentSource === source) {
        currentSource = null
        playing = false
        paused = false
        finishSession()
      }
    }

    try {
      source.start(0, offsetSec)
    } catch (e) {
      playing = false
      paused = false
      currentSource = null
      rejectSession(e instanceof Error ? e : new Error(String(e)))
    }
  }

  const play = async (audio: AudioResult): Promise<void> => {
    // Interrompe reprodução anterior (política: novo speak interrompe anterior §11)
    stop()

    currentAudio = audio

    // TTS-PROD-FIX-001: só reproduz com AudioContext efetivamente running.
    // Se o resume() for bloqueado (autoplay sem gesto), NÃO inicia source no
    // silêncio: play() REJEITA com a falha real → estado de erro observável
    // (phase=error), sem falso PLAYING/ENDED.
    const unlocked = resolveUnlocked()
    if (unlocked instanceof Promise) {
      const result = await unlocked
      if (!result.ok) throw unlockError(result)
    } else if (!unlocked.ok) {
      throw unlockError(unlocked)
    }

    sessionActive = true
    return new Promise<void>((resolve, reject) => {
      sessionResolve = resolve
      sessionReject = reject
      startSource(audio, 0)
    })
  }

  const pause = (): void => {
    if (!playing || !currentSource || !currentAudio) return
    const ctx = audioContext
    const elapsed = ctx ? Math.max(0, ctx.currentTime - startedAt) : 0
    startOffset = Math.min(startOffset + elapsed, currentAudio.durationSec)
    try {
      currentSource.onended = null
      currentSource.stop()
    } catch {}
    try {
      currentSource.disconnect()
    } catch {}
    currentSource = null
    playing = false
    paused = true
  }

  const resume = async (): Promise<void> => {
    if (!paused || !currentAudio || !sessionActive) return
    // TTS-PROD-FIX-001: só continua do ponto pausado com contexto running.
    // Falha → mantém PAUSED (sem falso PLAYING, sem source no silêncio).
    const unlocked = resolveUnlocked()
    if (unlocked instanceof Promise) {
      const result = await unlocked
      if (!result.ok) return
    } else if (!unlocked.ok) {
      return
    }
    // A promise da sessão continua pendente; apenas recria o source no offset exato.
    startSource(currentAudio, startOffset)
  }

  const replay = async (): Promise<void> => {
    if (!currentAudio) return
    // Encerra a sessão atual (paused/ended) e reproduz do início.
    stop()
    await play(currentAudio)
  }

  const stop = (): void => {
    if (currentSource) {
      try {
        currentSource.onended = null
        currentSource.stop()
      } catch {}
      try {
        currentSource.disconnect()
      } catch {}
      currentSource = null
    }
    playing = false
    paused = false
    // Resolve a sessão pendente (quem aguarda play() não fica preso).
    finishSession()
  }

  const dispose = (): void => {
    stop()
    if (audioContext) {
      try {
        const ctx: AudioContext & { close?: () => Promise<void> } = audioContext
        if (typeof ctx.close === "function") ctx.close().catch(() => {})
      } catch {}
      audioContext = null
    }
    currentAudio = null
  }

  const isPlaying = (): boolean => playing
  const isPaused = (): boolean => paused
  const getCurrentAudio = (): AudioResult | null => currentAudio
  const unlock = (): Promise<AudioUnlockResult> => ensureUnlocked()

  return { play, pause, resume, replay, unlock, stop, dispose, isPlaying, isPaused, getCurrentAudio }
}

export type FakeAudioPlayer = AudioPlayer & {
  getPlayed(): AudioResult[]
  getSessionElapsedMs(): number
}

/**
 * Player fake para testes Node (sem AudioContext).
 * Modelo de transporte com relógio simulado:
 *  - play(audio): inicia sessão, simula duração (100ms por segundo de áudio);
 *  - pause(): congela no ponto atual (posição rastreável);
 *  - resume(): continua do ponto exato da pausa;
 *  - replay(): reinicia do zero;
 *  - stop(): end session de forma determinística.
 */
export function createFakeAudioPlayer(): FakeAudioPlayer {
  const played: AudioResult[] = []
  let currentAudio: AudioResult | null = null
  let playing = false
  let paused = false
  let elapsedMs = 0 // posição simulada na sessão atual
  let sessionStartWall = 0 // wall-clock do último start
  let timer: ReturnType<typeof setTimeout> | null = null
  let sessionActive = false
  let sessionTotalMs = 0
  // Sessão: UMA promise por ciclo (play/resume/replay retornam a mesma).
  let sessionPromise: Promise<void> | null = null
  let resolveSession: (() => void) | null = null

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  // Encerra a sessão atual de forma determinística (timer natural, stop, replay).
  const forceEnd = (): void => {
    clearTimer()
    playing = false
    paused = false
    sessionActive = false
    const r = resolveSession
    resolveSession = null
    sessionPromise = null
    if (r) {
      elapsedMs = sessionTotalMs
      r()
    }
  }

  const armTimer = (): void => {
    const remaining = Math.max(0, sessionTotalMs - elapsedMs)
    sessionStartWall = Date.now()
    timer = setTimeout(() => forceEnd(), remaining)
  }

  const startSession = (audio: AudioResult, fromMs: number): Promise<void> => {
    if (!sessionPromise) {
      sessionPromise = new Promise<void>((res) => {
        resolveSession = res
      })
    }
    currentAudio = audio
    sessionTotalMs = Math.max(10, audio.durationSec * 100)
    elapsedMs = fromMs
    sessionActive = true
    playing = true
    paused = false
    armTimer()
    return sessionPromise
  }

  const play = async (audio: AudioResult): Promise<void> => {
    forceEnd()
    played.push(audio)
    return startSession(audio, 0)
  }

  const pause = (): void => {
    if (!playing) return
    clearTimer()
    elapsedMs = Math.min(sessionTotalMs, elapsedMs + Math.max(0, Date.now() - sessionStartWall))
    paused = true
    playing = false
  }

  const resume = async (): Promise<void> => {
    if (!paused || !currentAudio || !sessionActive || !sessionPromise) return
    paused = false
    playing = true
    armTimer()
    return sessionPromise
  }

  const replay = async (): Promise<void> => {
    if (!currentAudio) return
    const audio = currentAudio
    forceEnd()
    return startSession(audio, 0)
  }

  const stop = (): void => {
    forceEnd()
    currentAudio = null
  }

  const dispose = (): void => {
    stop()
  }

  const isPlaying = () => playing
  const isPaused = () => paused
  const getCurrentAudio = (): AudioResult | null => currentAudio
  const getPlayed = () => [...played]
  const getSessionElapsedMs = () =>
    Math.min(sessionTotalMs, elapsedMs + (playing ? Math.max(0, Date.now() - sessionStartWall) : 0))
  const unlock = async (): Promise<AudioUnlockResult> => ({ ok: true, state: "running" })

  return { play, pause, resume, replay, unlock, stop, dispose, isPlaying, isPaused, getCurrentAudio, getPlayed, getSessionElapsedMs }
}