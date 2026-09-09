/**
 * TTS-INTEGRATION-003 — Chat TTS Controller
 *
 * Controlador da aplicação (framework-agnóstico, padrão `voiceController`):
 * o Chat e o Settings usam a MESMA fonte de verdade (D04):
 *   - preferência persistida:`preference.ts` (localStorage por usuário);
 *   - transporte: `orchestrator.ts` (engine voice-synthesis + player).
 *
 * Responsabilidades do Chat (D07):
 *  - noteResponse: resposta concluída → se ON e elegível, fala (autoplay §10);
 *    recebe via Stream/String, tokeniza semanticamente com buildSpeakable;
 *    MESMO texto já concluído → replay (não re-sintetiza §11).
 *  - invalidate: nova interação inicia → interrompe TTS atual (§11/§13).
 *  - toggleAction: UNIQUE botão do Chat (D23–D27):
 *      OFF   → ON + autoplay da resposta atual se houver;
 *      PLAY   → pause;
 *      PAUSED → resume;
 *      ENDED  → replay;
 *      IDLE   → OFF (desativa).
 *  - stop: ao sair do chat (§12) e ao desmontar (§14).
 *
 * §19: erros NÃO desativam o TTS — mantém o Chat utilizável e o estado de erro
 * aparece apenas na superfície do botão.
 *
 * Arquitetura de bundling:
 *  Este módulo NÃO importa `synthesizer` diretamente — evita que o webpack
 *  bundle os binários nativos do onnxruntime-node no cliente. A criação
 *  lazy do orchestrator é delegada a um factory injetado pelo hook React
 *  (`useChatTts`), que faz `import("./synthesizer")` em runtime.
 */

import type { TtsOrchestrator, TtsOrchestratorState } from "./orchestrator"
import { buildSpeakable } from "./speakable"
import { getTtsEnabled, setTtsEnabled, subscribeTts } from "./preference"

export type ChatTtsPhase =
  | "off"
  | "loading"
  | "synthesizing"
  | "playing"
  | "paused"
  | "ended"
  | "idle"
  | "error"

export type ChatTtsUiState = {
  readonly enabled: boolean
  readonly phase: ChatTtsPhase
  /** Existe resposta atual elegível (habilita Play/Replay). */
  readonly hasTarget: boolean
  readonly message: string | null
}

export interface ChatTtsController {
  /** Fonte de verdade para o hook/UI (useSyncExternalStore). */
  getUiState(): ChatTtsUiState
  getUiSnapshot(): ChatTtsUiState
  subscribe(listener: () => void): () => void
  /** Resposta concluída no Chat (Stream/done/reply). */
  noteResponse(markdown: string): void
  /** Nova interação do usuário iniciou — interrompe TTS. */
  invalidate(): void
  /** Ação do controle único do Chat (ciclo OFF→ON→Play→Pause→Resume→Replay→OFF). */
  toggleAction(): void
  /** Ação explícita de replay (acessível fora do ciclo). */
  replay(): void
  /** Para a reprodução (sair do chat / desmontar). */
  stop(): void
  setEnabled(enabled: boolean): void
  dispose(): Promise<void>
}

/**
 * Factory assíncrono: retorna o orchestrator quando chamado.
 * O consumidor (hook React) injeta esta função para manter o dynamic import
 * do synthesizer fora do bundle do controller (webpack code-split seguro).
 */
export type OrchestratorFactory = () => Promise<TtsOrchestrator>

export type CreateChatTtsOptions = {
  /** Orchestrator pré-criado (testes / uso direto). */
  orchestrator?: TtsOrchestrator
  /** Factory assíncrono chamado na primeira operação (lazy loading). */
  createOrchestrator?: OrchestratorFactory
}

type Target = { prepared: string; eligible: boolean; markdown: string }

type PhaseFromState = Exclude<TtsOrchestratorState, "DISPOSED"> | "off"

function phaseFromState(state: PhaseFromState): ChatTtsPhase {
  switch (state) {
    case "LOADING":
      return "loading"
    case "SYNTHESIZING":
      return "synthesizing"
    case "PLAYING":
      return "playing"
    case "PAUSED":
      return "paused"
    case "ENDED":
      return "ended"
    case "ERROR":
      return "error"
    default:
      return "idle"
  }
}

export function createChatTtsController(options: CreateChatTtsOptions = {}): ChatTtsController {
  const injected = options.orchestrator ?? null
  const factory = options.createOrchestrator ?? null

  let orch: TtsOrchestrator | null = injected
  let disposed = false

  let target: Target | null = null
  let lastSpokenPrepared: string | null = null
  let currentError: string | null = null

  const listeners = new Set<() => void>()
  let cached: ChatTtsUiState | null = null
  let cachedKey = ""

  const notify = (): void => {
    cached = null
    cachedKey = ""
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const buildUiState = (): ChatTtsUiState => {
    const enabled = getTtsEnabled()
    const s = orch ? orch.getState() : "IDLE"
    let phase: ChatTtsPhase
    if (!enabled) {
      phase = "off"
    } else if (s === "LOADING" || s === "SYNTHESIZING") {
      phase = phaseFromState(s)
    } else if (s === "DISPOSED") {
      phase = "idle"
    } else if (currentError && s === "ERROR") {
      phase = "error"
    } else {
      phase = phaseFromState(s)
    }
    const hasTarget = !!target && target.eligible
    const message = currentError
    const key = `${enabled}|${phase}|${hasTarget}|${message}`
    if (cachedKey === key) {
      return cached!
    }
    const ui: ChatTtsUiState = { enabled, phase, hasTarget, message }
    cached = ui
    cachedKey = key
    return ui
  }

  const getUiState = (): ChatTtsUiState => buildUiState()
  const getUiSnapshot = (): ChatTtsUiState => buildUiState()

  let unsubscribeOrch: (() => void) | null = null
  const unsubscribePref = subscribeTts(() => notify())

  if (injected) {
    unsubscribeOrch = orch!.subscribe(() => notify())
  }

  const ensureOrch = async (): Promise<TtsOrchestrator> => {
    if (orch) return orch
    if (!factory) throw new Error("Nenhum orchestrator injetado e factory não fornecido")
    const o = await factory()
    orch = o
    unsubscribeOrch = o.subscribe(() => notify())
    notify()
    return o
  }

  const speakPrepared = async (text: string): Promise<void> => {
    const o = await ensureOrch()
    try {
      currentError = null
      await o.speak(text)
    } catch (e) {
      // Erro NÃO desativa o TTS (§19); apenas reflete no estado.
      if (!(e instanceof Error && e.message.includes("CANCELLED"))) {
        currentError = e instanceof Error ? e.message : String(e)
      }
      notify()
    }
  }

  const noteResponse = (markdown: string): void => {
    if (disposed) return
    const built = buildSpeakable(markdown)
    target = { prepared: built.prepared, eligible: built.eligible, markdown: String(markdown ?? "") }
    if (!built.eligible) {
      notify()
      return
    }
    const enabled = getTtsEnabled()
    if (!enabled) {
      notify()
      return
    }
    // §11: mesmo texto da resposta já concluída → replay, sem nova síntese.
    if (built.prepared === lastSpokenPrepared && orch && (orch.getState() === "ENDED" || orch.getState() === "PAUSED")) {
      replay()
    } else {
      lastSpokenPrepared = built.prepared
      void speakPrepared(built.prepared)
    }
  }

  const invalidate = (): void => {
    if (disposed) return
    try {
      orch?.stop()
    } catch {}
  }

  const replay = (): void => {
    if (disposed) return
    if (!target?.eligible) return
    if (!orch) {
      return
    }
    const state = orch.getState()
    if (state === "PLAYING" || state === "PAUSED" || state === "ENDED") {
      currentError = null
      void orch.replay().catch((e) => {
        if (!(e instanceof Error && e.message.includes("CANCELLED"))) {
          currentError = e instanceof Error ? e.message : String(e)
        }
        notify()
      })
      return
    }
    void speakPrepared(target.prepared)
  }

  const toggleAction = (): void => {
    if (disposed) return
    const enabled = getTtsEnabled()
    if (!enabled) {
      setTtsEnabled(true)
      if (target?.eligible) noteResponse(target.markdown)
      return
    }
    const state = orch ? orch.getState() : "IDLE"
    switch (state) {
      case "PLAYING":
        orch!.pause()
        break
      case "PAUSED":
        orch!.resume()
        break
      case "ENDED":
        replay()
        break
      case "SYNTHESIZING":
      case "LOADING":
        break
      case "ERROR":
      case "IDLE":
      case "DISPOSED":
      default:
        if (target?.eligible) {
          replay()
        } else {
          setTtsEnabled(false)
        }
    }
  }

  const stop = (): void => {
    try {
      orch?.stop()
    } catch {}
  }

  const setEnabled = (enabled: boolean): void => {
    if (disposed) return
    if (!enabled) {
      try {
        orch?.stop()
      } catch {}
    }
    setTtsEnabled(enabled)
  }

  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    unsubscribeOrch?.()
    unsubscribePref()
    listeners.clear()
    try {
      orch?.stop()
    } catch {}
    if (orch && !injected) {
      try {
        await orch.dispose()
      } catch {}
    }
    orch = null
    target = null
    cached = null
    cachedKey = ""
  }

  return {
    getUiState,
    getUiSnapshot,
    subscribe,
    noteResponse,
    invalidate,
    toggleAction,
    replay,
    stop,
    setEnabled,
    dispose,
  }
}