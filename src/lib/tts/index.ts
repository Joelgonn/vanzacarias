/**
 * TTS-INTEGRATION-001/002/003 — Public boundary
 *
 * Exporta apenas contratos estáveis. O motor `voice-synthesis` permanece
 * independente e não conhece Chat, Vosk, React, etc.
 */

export { createTtsService, detectRuntimeKind } from "./synthesizer"
export type { TtsService, AudioResult, TtsState, TtsErrorCode, CreateTtsOptions, TtsBrowserRuntimeOptions, TtsRuntimeKind } from "./types"
export { TtsError } from "./types"

export { createAudioPlayer, createFakeAudioPlayer } from "./player"
export type { AudioPlayer, AudioPlayerOptions } from "./player"

export { createTtsOrchestrator } from "./orchestrator"
export type { TtsOrchestrator, TtsOrchestratorState, TtsTransport, CreateOrchestratorOptions } from "./orchestrator"

export {
  prepareSpeakableText,
  countSpeakableWords,
  isSpeakableEligible,
  buildSpeakable,
  MIN_WORDS,
} from "./speakable"
export type { SpeakableResult } from "./speakable"

export {
  getTtsEnabled,
  setTtsEnabled,
  setTtsUser,
  subscribeTts,
  getTtsSnapshot,
  getTtsStorageKey,
} from "./preference"

export { createChatTtsController } from "./chatTtsController"
export type { ChatTtsController, ChatTtsUiState, ChatTtsPhase, CreateChatTtsOptions } from "./chatTtsController"