/**
 * TTS-INTEGRATION-002/003 — TTS Orchestrator
 *
 * Camada de aplicação que orquestra `TTS Consumer (voice-synthesis)` e `Audio Player`.
 * Conhece ambos os lados; o engine não conhece a aplicação.
 *
 * Arquitetura (§5):
 *   Application → Orchestrator → TTS Consumer → voice-synthesis → AudioResult → Player
 *
 * Sem dependências de Chat, Vosk, Gemini, Supabase, React UI.
 *
 * TTS-INTEGRATION-003 — transporte (D10–D13, D22):
 *  - Estados IDLE | LOADING | SYNTHESIZING | PLAYING | PAUSED | ENDED | DISPOSED | ERROR
 *  - speak() concluído naturalmente → ENDED (não volta a IDLE).
 *  - pause()/resume(): resume continua do ponto exato (player) — sem timeout (§22).
 *  - replay(): repete o áudio atual SEM re-sintetizar (§11, §22).
 *  - Antir-race preservado via `gen` (novo speak/cada interação interrompe §11/§13).
 *  - subscribe(): UI reativa ao estado sem acoplamento (controller usa isso).
 */

import type { AudioResult, TtsService } from "./types"
import { TtsError } from "./types"
import type { AudioPlayer, AudioUnlockResult } from "./player"

export type TtsOrchestratorState =
  | "IDLE"
  | "LOADING"
  | "SYNTHESIZING"
  | "PLAYING"
  | "PAUSED"
  | "ENDED"
  | "DISPOSED"
  | "ERROR"

export type TtsTransport =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "synthesizing" }
  | { type: "playing" }
  | { type: "paused" }
  | { type: "ended" }
  | { type: "error"; message: string }
  | { type: "disposed" }

export interface TtsOrchestrator {
  getState(): TtsOrchestratorState
  getTransport(): TtsTransport
  speak(text: string): Promise<void>
  pause(): void
  resume(): void
  replay(): Promise<void>
  /**
   * TTS-PROD-FIX-001: desbloqueia o AudioContext dentro do gesto do usuário.
   * Idempotente; resolve quando o contexto estiver running.
   */
  unlock(): Promise<AudioUnlockResult>
  stop(): void
  subscribe(listener: () => void): () => void
  dispose(): Promise<void>
}

export type CreateOrchestratorOptions = {
  tts: TtsService
  player: AudioPlayer
}

export function createTtsOrchestrator(options: CreateOrchestratorOptions): TtsOrchestrator {
  const { tts, player } = options
  let state: TtsOrchestratorState = "IDLE"
  let lastError: string | null = null
  let gen = 0
  let disposed = false
  const listeners = new Set<() => void>()

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  const setState = (next: TtsOrchestratorState): void => {
    state = next
    notify()
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const getState = (): TtsOrchestratorState => state

  /** TTS-PROD-FIX-001: delega ao player (idempotente, não engole falha). */
  const unlock = async (): Promise<AudioUnlockResult> => {
    if (disposed || state === "DISPOSED") {
      return { ok: false, state: "none", error: "Orchestrator descartado" }
    }
    try {
      return await player.unlock()
    } catch (e) {
      return {
        ok: false,
        state: "none",
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  const getTransport = (): TtsTransport => {
    switch (state) {
      case "IDLE":
        return { type: "idle" }
      case "LOADING":
        return { type: "loading" }
      case "SYNTHESIZING":
        return { type: "synthesizing" }
      case "PLAYING":
        return { type: "playing" }
      case "PAUSED":
        return { type: "paused" }
      case "ENDED":
        return { type: "ended" }
      case "DISPOSED":
        return { type: "disposed" }
      case "ERROR":
      default:
        return { type: "error", message: lastError ?? "erro desconhecido" }
    }
  }

  const stop = (): void => {
    gen++
    if (disposed || state === "DISPOSED") return
    // Interrompe reprodução (player) — determinístico §10
    try {
      player.stop()
    } catch {}
    // Se transportando (ou finalizado), volta a base
    if (state === "SYNTHESIZING" || state === "PLAYING" || state === "PAUSED" || state === "LOADING" || state === "ENDED") {
      setState("IDLE")
    }
  }

  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    gen++
    setState("DISPOSED")
    try {
      player.stop()
    } catch {}
    try {
      player.dispose()
    } catch {}
    try {
      await tts.dispose()
    } catch {}
    listeners.clear()
  }

  const pause = (): void => {
    if (disposed || state === "DISPOSED") return
    if (state !== "PLAYING") return
    try {
      player.pause()
    } catch {}
    setState("PAUSED")
  }

  const resume = (): void => {
    if (disposed || state === "DISPOSED") return
    if (state !== "PAUSED") return
    try {
      player.resume()
    } catch {}
    setState("PLAYING")
  }

  const replay = async (): Promise<void> => {
    if (disposed || state === "DISPOSED") return
    // Replay sem re-sintetizar (§11/§22): repete o áudio atual do início.
    if (state !== "ENDED" && state !== "PAUSED") return
    const myGen = gen
    setState("PLAYING")
    try {
      await player.replay()
      if (myGen !== gen) {
        if (getState() === "PLAYING") setState("IDLE")
        throw new TtsError("CANCELLED", "Replay interrompido")
      }
      // Conclusão natural do replay → ENDED
      setState("ENDED")
    } catch (e) {
      if (myGen !== gen) {
        if (getState() === "PLAYING") setState("IDLE")
        throw new TtsError("CANCELLED", "Replay interrompido")
      }
      setState("ERROR")
      lastError = e instanceof Error ? e.message : String(e)
      if (e instanceof Error) throw new TtsError("SYNTHESIS_FAILED", `Player falhou: ${e.message}`, { cause: e })
      throw e
    }
  }

  const speak = async (text: string): Promise<void> => {
    const trimmed = String(text ?? "").trim()
    if (!trimmed) throw new TtsError("INVALID_TEXT", "Texto vazio")
    if (disposed || state === "DISPOSED") throw new TtsError("DISPOSED", "Orchestrator descartado")
    if (!tts.isSupported()) throw new TtsError("NOT_SUPPORTED", "TTS não suportado")

    // Política §11: novo speak interrompe anterior (aceita novo texto)
    const myGen = ++gen
    // Stop anterior (player + invalida synth anterior via gen)
    try {
      player.stop()
    } catch {}

    // On-demand: load se necessário (§15)
    if (tts.getState() === "UNINITIALIZED" || tts.getState() === "DISPOSED") {
      setState("LOADING")
      try {
        await tts.load()
        if (myGen !== gen) {
          // Foi interrompido durante load
          throw new TtsError("CANCELLED", "Cancelado durante load")
        }
      } catch (e) {
        if (myGen !== gen) throw new TtsError("CANCELLED", "Cancelado")
        setState("ERROR")
        lastError = e instanceof Error ? e.message : String(e)
        if (e instanceof TtsError) throw e
        throw new TtsError("LOAD_FAILED", e instanceof Error ? e.message : String(e), { cause: e })
      }
    } else if (tts.getState() === "LOADING") {
      setState("LOADING")
      try {
        await tts.load()
        if (myGen !== gen) throw new TtsError("CANCELLED", "Cancelado durante load")
      } catch (e) {
        if (myGen !== gen) throw new TtsError("CANCELLED", "Cancelado")
        setState("ERROR")
        lastError = e instanceof Error ? e.message : String(e)
        throw e
      }
    }

    if (myGen !== gen) throw new TtsError("CANCELLED", "Cancelado antes de sintetizar")
    if (disposed) throw new TtsError("DISPOSED", "Descartado")

    setState("SYNTHESIZING")
    let audio: AudioResult
    try {
      const p = tts.synthesize(trimmed)
      audio = await p
    } catch (e) {
      if (myGen !== gen) throw new TtsError("CANCELLED", "Cancelado durante síntese")
      setState("ERROR")
      lastError = e instanceof Error ? e.message : String(e)
      if (e instanceof TtsError) throw e
      throw new TtsError("SYNTHESIS_FAILED", e instanceof Error ? e.message : String(e), { cause: e })
    }

    // Race §13: se B tornou-se atual enquanto A sintetizava, A não reproduz
    if (myGen !== gen) {
      // Resultado obsoleto — descarta sem tocar
      throw new TtsError("CANCELLED", "Resultado obsoleto descartado")
    }
    if (disposed) throw new TtsError("DISPOSED", "Descartado antes de reproduzir")

    setState("PLAYING")
    try {
      await player.play(audio)
      if (myGen !== gen) {
        // Foi interrompido durante play (stop chamado)
        if (getState() === "PLAYING" || getState() === "PAUSED") setState("IDLE")
        throw new TtsError("CANCELLED", "Reprodução interrompida")
      }
      // Conclusão natural §10: resposta falada → ENDED
      setState("ENDED")
    } catch (e) {
      // Player error vs cancellation
      if (myGen !== gen) {
        if (getState() === "PLAYING" || getState() === "PAUSED") setState("IDLE")
        throw new TtsError("CANCELLED", "Cancelado durante reprodução")
      }
      if (e instanceof TtsError && e.code === "CANCELLED") {
        if (getState() === "PLAYING" || getState() === "PAUSED") setState("IDLE")
        throw e
      }
      setState("ERROR")
      lastError = e instanceof Error ? e.message : String(e)
      // Erro do player — propaga sem mascarar como TTS error
      if (e instanceof Error) throw new TtsError("SYNTHESIS_FAILED", `Player falhou: ${e.message}`, { cause: e })
      throw e
    }
  }

  return { getState, getTransport, speak, pause, resume, replay, unlock, stop, subscribe, dispose }
}