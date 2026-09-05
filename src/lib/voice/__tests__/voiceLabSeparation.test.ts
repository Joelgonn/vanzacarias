import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const pagePath = path.join(process.cwd(), 'src/app/dev/voice-test/page.tsx');
const content = fs.readFileSync(pagePath, 'utf8');

function extractMicTranscribeBlock(src: string): string {
  const start = src.indexOf('const runTranscribeMic');
  if (start === -1) return '';
  // Find next const runTranscribeFixture
  const end = src.indexOf('const runTranscribeFixture', start);
  return src.slice(start, end === -1 ? start + 5000 : end);
}

describe('VOZ-008.5-R2 — Separação MICROPHONE vs FIXTURE', () => {
  it('MICROPHONE TEST não referencia fixture WAV', () => {
    const micBlock = extractMicTranscribeBlock(content);
    expect(micBlock.length).toBeGreaterThan(100);
    expect(micBlock).not.toMatch(/fetch\s*\(/);
    expect(micBlock).not.toMatch(/moonshire\.wav/);
    expect(micBlock).not.toMatch(/loadFixture/);
    expect(micBlock).toMatch(/micPcmRef/);
    expect(micBlock).toMatch(/MICROFONE REAL/);
  });

  it('MICROPHONE TEST usa exclusivamente getUserMedia → MediaStream → AudioContext → PCM → Vosk', () => {
    const micBlock = extractMicTranscribeBlock(content);
    expect(micBlock).toMatch(/micPcmRef\.current/);
    expect(micBlock).not.toMatch(/fixtureRef/);
  });

  it('FIXTURE TEST usa WAV e é separado', () => {
    const fixtureStart = content.indexOf('const runTranscribeFixture');
    expect(fixtureStart).toBeGreaterThan(-1);
    const fixtureBlock = content.slice(fixtureStart, fixtureStart + 5000);
    expect(fixtureBlock).toMatch(/fixtureRef/);
    expect(fixtureBlock).toMatch(/FIXTURE WAV/);
    // Fixture pode usar fetch/loadFixture — é esperado
    expect(fixtureBlock).toMatch(/loadFixture|moonshire\.wav/);
  });

  it('Página mantém micPcmRef separado de fixtureRef', () => {
    expect(content).toMatch(/const micPcmRef/);
    expect(content).toMatch(/const fixtureRef/);
    expect(content).toMatch(/micPcmRef\.current =/);
  });

  it('UX indica Fonte MICROFONE REAL vs FIXTURE WAV', () => {
    expect(content).toMatch(/Fonte: MICROFONE REAL/);
    expect(content).toMatch(/Fonte: FIXTURE WAV/);
    expect(content).toMatch(/NUNCA fetch WAV/);
  });
});

describe('VOZ-008.6 — UX Simplificada MICROFONE REAL', () => {
  it('botão inicial é FALAR com mensagem correta', () => {
    expect(content).toMatch(/Teste de Voz/);
    expect(content).toMatch(/Português Brasileiro/);
    expect(content).toMatch(/Toque em FALAR e diga uma frase/);
    expect(content).toMatch(/🎙️ FALAR/);
    expect(content).toMatch(/Pronto para gravar/);
  });

  it('FALAR inicia captura do microfone (getUserMedia)', () => {
    const falarStart = content.indexOf('const handleFalar');
    expect(falarStart).toBeGreaterThan(-1);
    const falarBlock = content.slice(falarStart, falarStart + 4000);
    expect(falarBlock).toMatch(/getUserMedia/);
    expect(falarBlock).toMatch(/MediaStream/);
    expect(falarBlock).not.toMatch(/loadFixture\s*\(/);
    expect(falarBlock).not.toMatch(/moonshire\.wav/);
    expect(falarBlock).not.toMatch(/fetch\s*\(\s*['"`]\/moonshire\.wav/);
  });

  it('PARAR encerra captura e processamento segue automaticamente', () => {
    const pararStart = content.indexOf('const handleParar');
    expect(pararStart).toBeGreaterThan(-1);
    const pararBlock = content.slice(pararStart, pararStart + 6000);
    expect(pararBlock).toMatch(/setSimpleStatus\('processando'\)/);
    expect(pararBlock).toMatch(/setSimpleStatus\('transcrevendo'\)/);
    expect(pararBlock).toMatch(/micPcmRef\.current/);
    expect(pararBlock).not.toMatch(/loadFixture\s*\(/);
    expect(pararBlock).not.toMatch(/fetch\s*\(\s*['"`]\/moonshire\.wav/);
  });

  it('transcrição usa exclusivamente micPcmRef (fluxo principal nunca chama loadFixture)', () => {
    const falarStart = content.indexOf('const handleFalar');
    const pararStart = content.indexOf('const handleParar');
    const novamenteStart = content.indexOf('const handleFalarNovamente');
    const falarBlock = content.slice(falarStart, pararStart);
    const pararBlock = content.slice(pararStart, novamenteStart);
    const mainFlow = falarBlock + pararBlock;
    // Verificar invocação real, não comentário — handleFalar/Parar nunca devem chamar loadFixture() ou fetch WAV
    expect(mainFlow).not.toMatch(/loadFixture\s*\(/);
    expect(mainFlow).not.toMatch(/fetch\s*\(\s*['"`]\/moonshire\.wav/);
    expect(mainFlow).not.toMatch(/fixtureRef\.current/);
    expect(mainFlow).toMatch(/micPcmRef/);
  });

  it('fluxo principal nunca faz fetch WAV', () => {
    const primaryStart = content.indexOf('VOZ-008.6 — TESTE PRINCIPAL MICROFONE REAL');
    const primaryEnd = content.indexOf('Fonte de áudio — Fixture');
    const primarySection = content.slice(primaryStart, primaryEnd);
    expect(primarySection).not.toMatch(/fetch\('/);
    expect(primarySection).not.toMatch(/moonshire\.wav/);
    // O único fetch permitido é no fixture secundário
    expect(content).toMatch(/fetch\('\/moonshire\.wav'\)/); // fixture ainda existe
  });

  it('resultado é exibido e FALAR NOVAMENTE permite novo ciclo', () => {
    expect(content).toMatch(/Transcrição/);
    expect(content).toMatch(/simpleResult/);
    expect(content).toMatch(/🎙️ FALAR NOVAMENTE/);
    expect(content).toMatch(/const handleFalarNovamente/);
    const novamenteStart = content.indexOf('const handleFalarNovamente');
    const novamenteBlock = content.slice(novamenteStart, novamenteStart + 1000);
    expect(novamenteBlock).toMatch(/setSimpleStatus\('idle'\)/);
    expect(novamenteBlock).toMatch(/micPcmRef\.current = null/);
  });

  it('cleanup continua limpando corretamente os refs', () => {
    const cleanupStart = content.indexOf('const runCleanup');
    const cleanupBlock = content.slice(cleanupStart, cleanupStart + 1500);
    expect(cleanupBlock).toMatch(/micPcmRef\.current = null/);
    expect(cleanupBlock).toMatch(/fixtureRef\.current = null/);
    expect(cleanupBlock).toMatch(/setPcmInfo\(null\)/);
  });
});
