import { describe, it, expect } from 'vitest';
import { engineStateReducer, INITIAL_ENGINE_STATE, canLoad, canTranscribe, isEngineReady } from '../stt/engineState';
import type { EngineState } from '../stt/engineState';

const ALL_STATES: EngineState[] = ['IDLE', 'LOADING', 'READY', 'TRANSCRIBING', 'RESULT', 'ERROR'];

describe('VOZ-004-R3.1 — Engine State Machine', () => {
  it('1. estado inicial = IDLE', () => {
    expect(INITIAL_ENGINE_STATE).toBe('IDLE');
  });

  it('2. Load inicia LOADING', () => {
    expect(engineStateReducer('IDLE', { type: 'LOAD_START' })).toBe('LOADING');
  });

  it('3. enquanto LOADING, Load não pode ser executado novamente', () => {
    expect(canLoad('LOADING')).toBe(false);
    expect(engineStateReducer('LOADING', { type: 'LOAD_START' })).toBe('LOADING');
  });

  it('4. Load sucesso → READY', () => {
    expect(engineStateReducer('LOADING', { type: 'LOAD_SUCCESS' })).toBe('READY');
  });

  it('5. Load falha → ERROR', () => {
    expect(engineStateReducer('LOADING', { type: 'LOAD_ERROR' })).toBe('ERROR');
  });

  it('6. ERROR após Load não habilita Transcribe', () => {
    const s = engineStateReducer('LOADING', { type: 'LOAD_ERROR' });
    expect(s).toBe('ERROR');
    expect(canTranscribe(s)).toBe(false);
    expect(isEngineReady(s)).toBe(false);
  });

  it('7. READY permite Transcribe', () => {
    expect(canTranscribe('READY')).toBe(true);
    expect(isEngineReady('READY')).toBe(true);
  });

  it('8. Transcribe → TRANSCRIBING', () => {
    expect(engineStateReducer('READY', { type: 'TRANSCRIBE_START' })).toBe('TRANSCRIBING');
  });

  it('9. TRANSCRIBING bloqueia segunda execução', () => {
    expect(canTranscribe('TRANSCRIBING')).toBe(false);
    expect(engineStateReducer('TRANSCRIBING', { type: 'TRANSCRIBE_START' })).toBe('TRANSCRIBING');
  });

  it('10. Transcribe sucesso → RESULT', () => {
    expect(engineStateReducer('TRANSCRIBING', { type: 'TRANSCRIBE_SUCCESS' })).toBe('RESULT');
  });

  it('11. Transcribe erro → ERROR', () => {
    expect(engineStateReducer('TRANSCRIBING', { type: 'TRANSCRIBE_ERROR' })).toBe('ERROR');
  });

  it('12. chamada de Transcribe fora de READY não executa engine', () => {
    for (const s of ALL_STATES) {
      if (s === 'READY' || s === 'RESULT') continue;
      expect(canTranscribe(s)).toBe(false);
      expect(isEngineReady(s)).toBe(false);
      // dispatch é no-op: estado preservado, nenhuma transição para TRANSCRIBING.
      expect(engineStateReducer(s, { type: 'TRANSCRIBE_START' })).toBe(s);
    }
  });

  it('13. troca de engine invalida READY anterior', () => {
    expect(engineStateReducer('READY', { type: 'ENGINE_CHANGE' })).toBe('IDLE');
    expect(engineStateReducer('RESULT', { type: 'ENGINE_CHANGE' })).toBe('IDLE');
    expect(canTranscribe(engineStateReducer('READY', { type: 'ENGINE_CHANGE' }))).toBe(false);
  });

  it('14. resultado anterior não é mantido como resultado da nova execução', () => {
    // Nova transcrição a partir de RESULT: abandona RESULT → TRANSCRIBING.
    expect(engineStateReducer('RESULT', { type: 'TRANSCRIBE_START' })).toBe('TRANSCRIBING');
    // Troca de engine também descarta RESULT (volta a IDLE).
    expect(engineStateReducer('RESULT', { type: 'ENGINE_CHANGE' })).toBe('IDLE');
  });

  it('bonus: READY/RESULT permitem reload (F habilitado) após sucesso', () => {
    expect(canLoad('READY')).toBe(true);
    expect(canLoad('RESULT')).toBe(true);
  });

  it('bonus: ERROR após load permite retry (F habilitado)', () => {
    expect(canLoad('ERROR')).toBe(true);
  });

  it('bonus: load bloqueado durante TRANSCRIBING', () => {
    expect(canLoad('TRANSCRIBING')).toBe(false);
    expect(engineStateReducer('TRANSCRIBING', { type: 'LOAD_START' })).toBe('TRANSCRIBING');
  });
});