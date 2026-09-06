import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { formatElapsedMs } from '../useVoiceInput';

// VOZ-012.2 — Fluidez da gravação: formatação do cronômetro (teste unitário) e
// invariantes estruturais do hook/chat (cronômetro só conta durante 'recording',
// estado PROCESSANDO explícito, mensagens curtas por estado).

const chatPath = path.join(process.cwd(), 'src/components/ChatAssistant.tsx');
const hookPath = path.join(process.cwd(), 'src/lib/voice/useVoiceInput.ts');
const chatContent = fs.readFileSync(chatPath, 'utf8');
const hookContent = fs.readFileSync(hookPath, 'utf8');

describe('VOZ-012.2 — Formatador do cronômetro', () => {
  it('00:00 no início de uma gravação', () => {
    expect(formatElapsedMs(0)).toBe('00:00');
  });

  it('T2 — o tempo aumenta: 7s vira 00:07, 59s vira 00:59', () => {
    expect(formatElapsedMs(7_000)).toBe('00:07');
    expect(formatElapsedMs(59_000)).toBe('00:59');
    expect(formatElapsedMs(59_999)).toBe('00:59');
  });

  it('passa de 1 minuto corretamente (61s → 01:01)', () => {
    expect(formatElapsedMs(61_000)).toBe('01:01');
    expect(formatElapsedMs(60_000)).toBe('01:00');
  });

  it('valores inválidos/negativos tratados como 00:00', () => {
    expect(formatElapsedMs(-500)).toBe('00:00');
    expect(formatElapsedMs(Number.NaN)).toBe('00:00');
    expect(formatElapsedMs(Number.POSITIVE_INFINITY)).toBe('00:00');
  });
});

describe('VOZ-012.2 — Hook: cronômetro roda apenas durante a gravação', () => {
  it('useEffect cria o intervalo apenas quando status === recording e zera ao sair', () => {
    // inicia com 00:00 (T1) — setRecordingElapsedMs(0) no início do bloco
    expect(hookContent).toMatch(/status === 'recording'/);
    expect(hookContent).toMatch(/setInterval/);
    expect(hookContent).toMatch(/clearInterval/);
    expect(hookContent).toMatch(/setRecordingElapsedMs\(0\)/);
    // contagem via tempo de parede (Date.now - início), nunca duração estimada de áudio
    expect(hookContent).toMatch(/Date\.now\(\)\s*-\s*startedAtRef\.current/);
  });

  it('dependente de [status]: o intervalo não persiste em PROCESSANDO/TRANSCRIBENDO', () => {
    expect(hookContent).toMatch(/}, \[status\]\)/);
  });

  it('isBusy agora inclui "processing" (PROCESSANDO visível e bloqueia FALAR)', () => {
    expect(hookContent).toMatch(/status === 'loading' \|\| status === 'recording' \|\| status === 'processing' \|\| status === 'transcribing'/);
  });

  it('expõe recordingElapsedMs para a UI', () => {
    expect(hookContent).toMatch(/recordingElapsedMs/);
  });
});

describe('VOZ-012.2 — Chat: indicação visual e mensagens por estado', () => {
  it('importa formatElapsedMs do hook', () => {
    expect(chatContent).toMatch(/import \{ useVoiceInput, formatElapsedMs \} from '@\/lib\/voice\/useVoiceInput'/);
  });

  it('GRAVANDO com cronômetro em tempo real (formato 00:00)', () => {
    // CHAT-UX-003: voz simplificada — timer com waveform, sem texto "Gravando" principal, mas com aria-label e ponto pulsante
    expect(chatContent).toMatch(/formatElapsedMs\(voice\.recordingElapsedMs\)/);
    expect(chatContent).toMatch(/aria-label="Gravando"/);
    expect(chatContent).toMatch(/bg-rose-500 rounded-full animate-pulse/);
  });

  it('diferenciação visual: quadrado (parar) ao gravar, spinner ao processar/transcrever', () => {
    // botão PARAR (Square) apenas enquanto grava
    expect(chatContent).toMatch(/voice\.isRecording/);
    expect(chatContent).toMatch(/<Square/);
    expect(chatContent).toMatch(/<Loader2/);
  });

  it('mensagens curtas e objetivas: Processando..., Transcrevendo..., Preparando...', () => {
    expect(chatContent).toMatch(/Processando\.\.\./);
    expect(chatContent).toMatch(/Transcrevendo\.\.\./);
    expect(chatContent).toMatch(/Preparando\.\.\./);
  });

  it('status bar distingue PROCESSANDO de TRANSCRIBENDO (não usa mais isBusy genérico)', () => {
    expect(chatContent).toMatch(/voice\.status === 'processing'/);
    expect(chatContent).toMatch(/voice\.status === 'transcribing'/);
  });

  it('botão cancelar (X) disponível durante a gravação para CANCELAR', () => {
    expect(chatContent).toMatch(/onClick=\{voice\.cancel\}/);
  });
});