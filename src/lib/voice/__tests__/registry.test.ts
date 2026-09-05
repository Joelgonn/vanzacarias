import { describe, it, expect } from 'vitest';
import { listEngines, getEngine, STT_ENGINES } from '../stt/registry';
import type { STTEngine, STTResult } from '../stt/registry';

describe('VOZ-004-R3 — STT Engine Registry', () => {
  it('registra Vosk PT-BR como engine selecionável', () => {
    const engines = listEngines();
    const ids = engines.map(e => e.id);
    expect(ids).toContain('vosk-pt-br');
  });

  it('getEngine("vosk-pt-br") retorna engine com metadados', () => {
    const engine = getEngine('vosk-pt-br');
    expect(engine).toBeDefined();
    expect(engine!.name).toBe('Vosk PT-BR');
    expect(engine!.language).toBe('pt-BR');
    expect(engine!.model).toContain('vosk-model-small-pt-0.3');
  });

  it('engine disponibiliza load/transcribe/dispose (interface mínima)', () => {
    const engine = getEngine('vosk-pt-br')!;
    expect(typeof engine.load).toBe('function');
    expect(typeof engine.transcribe).toBe('function');
    expect(typeof engine.dispose).toBe('function');
    expect(typeof engine.isSupported).toBe('function');
  });

  it('STTResult pode carregar texto + métricas opcionais', () => {
    const r: STTResult = { text: 'oi', inferenceMs: 10, metadata: { x: 1 } };
    expect(r.text).toBe('oi');
    expect(r.inferenceMs).toBe(10);
    const r2: STTResult = { text: 'apenas texto' };
    expect(r2.text).toBe('apenas texto');
  });

  it('getEngine com id desconhecido retorna undefined', () => {
    expect(getEngine('engine-inexistente')).toBeUndefined();
  });

  it('STT_ENGINES é o ponto único de registro', () => {
    expect(Object.keys(STT_ENGINES)).toContain('vosk-pt-br');
    // A seleção da engine deve vir do registry, não hardcoded no layout da página.
    const vosk: STTEngine = STT_ENGINES['vosk-pt-br'];
    const json = JSON.stringify({ name: vosk.name, language: vosk.language, model: vosk.model });
    expect(json).not.toMatch(/Moonshine/);
  });
});
