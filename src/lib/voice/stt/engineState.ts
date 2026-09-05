// VOZ-004-R3.1 — Engine State Hardening
// Máquina de estados mínima da engine entre F (Load) e G (Transcribe).
// Lógica pura e testável: a UI consulta canLoad/canTranscribe para habilitar/desabilitar
// e a lógica de callbacks também consulta antes de executar (proteção além do disabled).

export type EngineState = 'IDLE' | 'LOADING' | 'READY' | 'TRANSCRIBING' | 'RESULT' | 'ERROR';

export type EngineAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS' }
  | { type: 'LOAD_ERROR' }
  | { type: 'TRANSCRIBE_START' }
  | { type: 'TRANSCRIBE_SUCCESS' }
  | { type: 'TRANSCRIBE_ERROR' }
  | { type: 'ENGINE_CHANGE' }
  | { type: 'RESET' };

export const INITIAL_ENGINE_STATE: EngineState = 'IDLE';

// Fluxo:
// IDLE → LOADING → READY → TRANSCRIBING → RESULT
//   │        │                       │
//   │        ▼                       ▼
//   └─ ERROR ←─┘ (LOAD)       ERROR (TRANSCRIBE)
export function engineStateReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case 'LOAD_START':
      // IDLE (primeiro load), ERROR (retry) ou RESULT (reload) → LOADING.
      // Durante LOADING/TRANSCRIBING é no-op: nenhuma segunda chamada de load.
      return state === 'IDLE' || state === 'ERROR' || state === 'RESULT' ? 'LOADING' : state;
    case 'LOAD_SUCCESS':
      return state === 'LOADING' ? 'READY' : state;
    case 'LOAD_ERROR':
      // Preserva ERROR apenas se originado de LOADING (não sobrescreve estado válido).
      return state === 'LOADING' ? 'ERROR' : state;
    case 'TRANSCRIBE_START':
      // READY (primeira) ou RESULT (nova execução) → TRANSCRIBING.
      // Qualquer outro estado é no-op: transcrever fora de READY é bloqueado.
      return state === 'READY' || state === 'RESULT' ? 'TRANSCRIBING' : state;
    case 'TRANSCRIBE_SUCCESS':
      return state === 'TRANSCRIBING' ? 'RESULT' : state;
    case 'TRANSCRIBE_ERROR':
      return state === 'TRANSCRIBING' ? 'ERROR' : state;
    case 'ENGINE_CHANGE':
    case 'RESET':
      // Troca de engine invalida READY/RESULT anteriores (nova engine começa não carregada).
      return 'IDLE';
  }
}

// F — Load: habilitado em IDLE (inicial), ERROR (retry) e READY/RESULT (reload permitido).
// Bloqueado durante LOADING e TRANSCRIBING.
export function canLoad(state: EngineState): boolean {
  return state === 'IDLE' || state === 'ERROR' || state === 'READY' || state === 'RESULT';
}

// G — Transcribe: habilitado SOMENTE quando a engine está READY (ou RESULT, para nova execução).
// Bloqueado em IDLE, LOADING, TRANSCRIBING e ERROR.
export function canTranscribe(state: EngineState): boolean {
  return state === 'READY' || state === 'RESULT';
}

// Proteção lógica usada antes de qualquer chamada de transcribe (independente do disabled da UI).
export function isEngineReady(state: EngineState): boolean {
  return canTranscribe(state);
}