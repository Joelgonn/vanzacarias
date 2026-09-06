import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// COMPOSER-001 — Refatoração UX do Composer (ChatGPT-like):
// um único container (textarea + controles) que cresce verticalmente conforme o
// texto, com altura máxima + scroll interno e ações ancoradas na parte inferior.
// Os testes seguem o padrão do projeto (vitest em node, inspeção de fonte) e
// cobrem T-COMP-1..T-COMP-12.

const chatPath = path.join(process.cwd(), 'src/components/ChatAssistant.tsx');
const content = fs.readFileSync(chatPath, 'utf8');

// A caixa única do Composer (pill) — contém attach, microfone, textarea e enviar.
const getPill = (): string => {
  const m = content.match(/<div\s+className="flex w-full gap-2 bg-stone-50 p-1\.5 rounded-\[2rem\][\s\S]*?<\/div>/);
  if (!m) throw new Error('pill do Composer não encontrada');
  return m[0];
};

// Helpers estruturais COMPOSER-001.1 — identificam DOCK e região do Composer
const getDockClass = (): string => {
  // DOCK A: wrapper externo do Composer (shrink-0 relative z-10 + safe-area)
  const m = content.match(/<div className="([^"]*shrink-0[^"]*relative z-10[^"]*pb-\[max[^"]*)">/);
  if (!m) throw new Error('DOCK do Composer não encontrado');
  return m[1];
};

const getComposerRegion = (): string => {
  const dockIdx = content.indexOf('shrink-0 relative z-10');
  if (dockIdx === -1) throw new Error('região do Composer não encontrada');
  // Volta até o início da div do DOCK
  const start = content.lastIndexOf('<div className="', dockIdx);
  // Região suficientemente grande para conter DOCK + pill + textarea + ações + status
  return content.slice(start, start + 8000);
};

const getTextareaClass = (): string => {
  const m = content.match(/<textarea\s+[\s\S]*?className="([^"]*)"/);
  if (!m) throw new Error('textarea não encontrada');
  return m[1];
};

describe('COMPOSER-001 — Estrutura: um único Composer', () => {
  it('T-COMP-1 — vazio: altura mínima, compacto, controles visíveis', () => {
    expect(content).toMatch(/min-h-\[44px\]/);
    expect(content).toMatch(/rows=\{1\}/);
    expect(content).toMatch(/aria-label="Anexar foto"/);
    expect(content).toMatch(/aria-label=\{voice\.isRecording \? 'Parar e transcrever' : 'Falar mensagem'\}/);
    expect(content).toMatch(/aria-label="Enviar mensagem"/);
  });

  it('T-COMP-2 — uma linha: Composer permanece compacto', () => {
    // textarea de 1 linha + altura mínima de toque, sem altura fixa grande
    expect(content).toMatch(/rows=\{1\}/);
    expect(content).toMatch(/min-h-\[44px\]/);
    expect(content).not.toMatch(/min-h-\[132px\]/);
  });

  it('T-COMP-3 — texto em várias linhas: textarea e controles no MESMO container', () => {
    // Existe UMA única caixa (pill) com rounded-[2rem] que contém attach,
    // microfone, textarea e enviar — sem "caixa de texto" separada.
    const pill = getPill();
    expect(pill.indexOf('rounded-[2rem]')).toBeGreaterThanOrEqual(0);
    expect(pill.indexOf('<textarea')).toBeGreaterThan(0);
    expect(pill.indexOf('aria-label="Anexar foto"')).toBeGreaterThan(0);
    expect(pill.indexOf("aria-label={voice.isRecording ? 'Parar e transcrever' : 'Falar mensagem'}")).toBeGreaterThan(0);
    expect(pill.indexOf('aria-label="Enviar mensagem"')).toBeGreaterThan(0);
    // Ações vêm antes do textarea; enviar vem depois (ordem estrutural da referência)
    expect(pill.indexOf('aria-label="Enviar mensagem"')).toBeGreaterThan(pill.indexOf('<textarea'));
    // Nenhuma segunda caixa independente ao redor do textarea (só o elemento real)
    const textareas = content.match(/^\s*<textarea/mg) ?? [];
    expect(textareas.length).toBe(1);
  });

  it('T-COMP-4 — ultrapassou max-height: Composer não cresce, scroll interno aparece', () => {
    expect(content).toMatch(/const COMPOSER_MAX_HEIGHT = 200;/);
    expect(content).toMatch(/max-h-\[200px\]/);
    expect(content).toMatch(/Math\.min\(textareaRef\.current\.scrollHeight, maxH\)/);
    expect(content).toMatch(/overflowY = textareaRef\.current\.scrollHeight > maxH \? 'auto' : 'hidden'/);
    expect(content).toMatch(/overflow-y-auto/);
    expect(content).toMatch(/resize-none/);
  });
});

describe('COMPOSER-001 — Auto-grow', () => {
  it('T-COMP-5 — apagar texto: recalcula e reduz (reage a qualquer mudança de input)', () => {
    expect(content).toMatch(/}, \[state\.input\]\)/);
    expect(content).toMatch(/state\.setInput\(e\.target\.value\)/);
    expect(content).toMatch(/resizeComposer\(\)/);
  });

  it('T-COMP-6 — colar texto longo: onChange (valor novo) dispara o auto-grow', () => {
    expect(content).toMatch(/onChange=\{\(e\) => \{\s+state\.setInput\(e\.target\.value\);\s+resizeComposer\(\);\s+\}\}/);
    expect(content).toMatch(/style\.height = 'auto'/);
    expect(content).toMatch(/style\.height = Math\.min\(textareaRef\.current\.scrollHeight, maxH\) \+ 'px'/);
  });

  it('T-COMP-7 — transcrição de voz longa: recalcula e não perde texto', () => {
    expect(content).toMatch(/onTranscript: \(text\) =>/);
    expect(content).toMatch(/state\.setInput\(\(prev: string\) =>/);
    expect(content).toMatch(/\$\{prevTrimmed\} \$\{trimmed\}/); // preserva texto existente
    expect(content).toMatch(/}, \[state\.input\]\)/); // efeito recalcula após inserção
  });

  it('recalcula após mudança de largura/orientação e teclado (visualViewport)', () => {
    expect(content).toMatch(/window\.addEventListener\('resize', recompute\)/);
    expect(content).toMatch(/window\.addEventListener\('orientationchange', recompute\)/);
    expect(content).toMatch(/window\.visualViewport\?\.addEventListener\('resize', recompute\)/);
    expect(content).toMatch(/window\.removeEventListener\('resize', recompute\)/);
  });
});

describe('COMPOSER-001 — Funcionalidades preservadas', () => {
  it('T-COMP-8 — anexo: seleção, preview e remoção intactos', () => {
    expect(content).toMatch(/type="file"/);
    expect(content).toMatch(/accept="image\/\*"/);
    expect(content).toMatch(/fileInputRef\.current\?\.click\(\)/);
    expect(content).toMatch(/onChange=\{state\.handleImageSelect\}/);
    expect(content).toMatch(/Preview do anexo/);
    expect(content).toMatch(/aria-label="Remover imagem"/);
  });

  it('T-COMP-9 — enviar: botão, disabled, loading e Enter intactos', () => {
    expect(content).toMatch(/onClick=\{handleSend\}/);
    expect(content).toMatch(/disabled=\{state\.isLoading \|\| !hasContent\}/);
    expect(content).toMatch(/state\.isLoading \?/);
    expect(content).toMatch(/aria-label="Enviar mensagem"/);
  });

  it('T-COMP-10 — Enter envia; Shift+Enter não envia', () => {
    expect(content).toMatch(/e\.key === 'Enter' && !e\.shiftKey/);
    expect(content).toMatch(/e\.preventDefault\(\);/);
    expect(content).toMatch(/handleSend\(\);/);
  });
});

describe('COMPOSER-001 — Mobile e acessibilidade', () => {
  it('T-COMP-11 — sem overflow horizontal; botões com área de toque >= 44px', () => {
    expect(content).toMatch(/min-w-0/); // textarea pode encolher em 320px sem empurrar os botões
    expect(content).toMatch(/min-w-\[44px\]/);
    expect(content).toMatch(/h-\[44px\]/);
    expect(content).toMatch(/min-w-\[48px\]/);
    expect(content).toMatch(/w-full/);
    expect(content).toMatch(/sm:w-\[400px\]/); // variantes responsivas preservadas
    expect(content).toMatch(/sm:items-end/); // painel segue ancorado embaixo no mobile
  });

  it('composer respeita área segura inferior do aparelho (safe-area)', () => {
    expect(content).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(content).toMatch(/sm:pb-4/);
  });

  it('ações ancoradas na parte inferior do Composer (items-end)', () => {
    const pill = getPill();
    const opening = pill.slice(0, pill.indexOf('>'));
    expect(opening).toMatch(/rounded-\[2rem\]/);
    expect(opening).toMatch(/items-end/);
    expect(opening).not.toMatch(/items-center/);
  });

  it('controles continuam sendo <button>', () => {
    expect(content).toMatch(/<button[\s\S]*?aria-label="Anexar foto"/);
    expect(content).toMatch(/<button[\s\S]*?aria-label=\{voice\.isRecording \? 'Parar e transcrever' : 'Falar mensagem'\}/);
    expect(content).toMatch(/<button[\s\S]*?aria-label="Enviar mensagem"/);
  });
});

describe('COMPOSER-001 — Regressão', () => {
  it('T-COMP-12 — invariantes de voz (VOZ-012.x) permanecem intactas', () => {
    expect(content).toMatch(/useVoiceInput\(\{/);
    expect(content).toMatch(/Gravando \{formatElapsedMs\(voice\.recordingElapsedMs\)\}/);
    expect(content).toMatch(/voice\.status === 'processing'/);
    expect(content).toMatch(/voice\.status === 'transcribing'/);
    expect(content).toMatch(/onClick=\{voice\.cancel\}/);
  });

  it('T-COMP-12 — anexo/upload continua separado do texto (sem mistura de lógica)', () => {
    expect(content).toMatch(/compressImage/);
    expect(content).toMatch(/setSelectedImage\(null\)/);
    expect(content).toMatch(/state\.input\.trim\(\)\.length > 0 \|\| state\.selectedImage !== null/);
  });
});

// =============================================================
// COMPOSER-001.1 — Correção Estrutural: UM ÚNICO container visual
// Auditoria: remover identidade visual do DOCK A (bg-white/border-t/shadow)
// e garantir que a PILL B seja o único container com bg+border+rounded.
// Estes testes FALHAM no código pré-correção (DOCK com bg-white+border-t+shadow)
// e PASSAM apenas após a correção estrutural.
// =============================================================
describe('COMPOSER-001.1 — Correção Estrutural (um único container visual)', () => {
  it('T-COMP-STRUCT-1 — wrapper externo (DOCK) não possui identidade visual de caixa (bg-white + border-t + shadow simultâneos)', () => {
    const dockClass = getDockClass();
    const hasBgWhite = dockClass.includes('bg-white');
    const hasBorderT = dockClass.includes('border-t');
    const hasShadow = dockClass.includes('shadow-');
    // Falha se o DOCK ainda for uma caixa branca com borda e sombra (caixa dentro de caixa)
    expect(hasBgWhite && hasBorderT && hasShadow).toBe(false);
    // Garantia adicional: nenhum dos marcadores visuais isolados deve estar no DOCK
    expect(hasBgWhite).toBe(false);
    expect(hasBorderT).toBe(false);
    expect(dockClass.includes('shadow-[0_-10px')).toBe(false);
    // DOCK deve permanecer estrutural: shrink-0, relative, z-10 e safe-area
    expect(dockClass).toMatch(/shrink-0/);
    expect(dockClass).toMatch(/relative/);
    expect(dockClass).toMatch(/pb-\[max/);
    expect(dockClass).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it('T-COMP-STRUCT-2 — existe somente UM container visual principal (bg + border + rounded) na região do Composer', () => {
    const region = getComposerRegion();
    // PILL é o único container com rounded-[2rem] + bg-stone-50 + border
    const allRounded = region.match(/<div className="[^"]*rounded-\[2rem\][^"]*"/g) ?? [];
    const visualContainers = allRounded.filter((c) => /bg-stone-50/.test(c) && /border/.test(c));
    expect(visualContainers.length).toBe(1);
    expect(visualContainers[0]).toMatch(/rounded-\[2rem\]/);
    expect(visualContainers[0]).toMatch(/bg-stone-50/);
    // DOCK não deve ser um container visual
    const dockClass = getDockClass();
    expect(dockClass).not.toMatch(/rounded-\[/);
    expect(dockClass).not.toMatch(/bg-white/);
  });

  it('T-COMP-STRUCT-3 — textarea e botões Anexar/Microfone/Enviar pertencem ao mesmo container visual principal (PILL)', () => {
    const pill = getPill();
    // Propriedade estrutural: todos os controles e o campo estão dentro da mesma pill
    expect(pill).toMatch(/<textarea/);
    expect(pill).toMatch(/aria-label="Anexar foto"/);
    expect(pill).toMatch(/aria-label=\{voice\.isRecording \? 'Parar e transcrever' : 'Falar mensagem'\}/);
    expect(pill).toMatch(/aria-label="Enviar mensagem"/);
    // Ordem estrutural: ações antes do textarea, enviar depois
    const textareaIdx = pill.indexOf('<textarea');
    const anexarIdx = pill.indexOf('aria-label="Anexar foto"');
    const micIdx = pill.indexOf("aria-label={voice.isRecording ? 'Parar e transcrever'");
    const enviarIdx = pill.indexOf('aria-label="Enviar mensagem"');
    expect(anexarIdx).toBeGreaterThan(-1);
    expect(micIdx).toBeGreaterThan(-1);
    expect(textareaIdx).toBeGreaterThan(anexarIdx);
    expect(textareaIdx).toBeGreaterThan(micIdx);
    expect(enviarIdx).toBeGreaterThan(textareaIdx);
    // DOCK não deve conter diretamente os botões — eles estão na PILL
    const dockClass = getDockClass();
    expect(dockClass).not.toMatch(/aria-label/);
  });

  it('T-COMP-STRUCT-4 — textarea permanece transparente (sem fundo/borda próprios)', () => {
    const textareaClass = getTextareaClass();
    expect(textareaClass).toMatch(/bg-transparent/);
    expect(textareaClass).not.toMatch(/bg-white/);
    expect(textareaClass).not.toMatch(/bg-stone-/);
    expect(textareaClass).not.toMatch(/border/);
    expect(textareaClass).toMatch(/resize-none/);
    expect(textareaClass).toMatch(/min-w-0/);
    expect(textareaClass).toMatch(/min-h-\[44px\]/);
    expect(textareaClass).toMatch(/max-h-\[200px\]/);
    expect(textareaClass).toMatch(/overflow-y-auto/);
  });

  it('T-COMP-STRUCT-5 — PILL utiliza items-end (ações ancoradas na base em multilinha)', () => {
    const pill = getPill();
    const opening = pill.slice(0, pill.indexOf('>'));
    expect(opening).toMatch(/items-end/);
    expect(opening).not.toMatch(/items-center/);
    expect(opening).toMatch(/flex/);
    // Verifica que a pill não usa items-center como alinhamento principal —
    // items-center em botões internos (flex items-center justify-center) é permitido
  });

  it('T-COMP-STRUCT-6 — não existe segundo background/border/radius criando "caixa dentro de caixa"', () => {
    const dockClass = getDockClass();
    const pill = getPill();
    // DOCK transparente: sem bg/border/radius visuais
    expect(dockClass).not.toMatch(/bg-white/);
    expect(dockClass).not.toMatch(/bg-stone-/);
    expect(dockClass).not.toMatch(/border-t/);
    expect(dockClass).not.toMatch(/border-stone-/);
    expect(dockClass).not.toMatch(/rounded-\[/);
    expect(dockClass).not.toMatch(/shadow-\[/);
    // PILL é o único com identidade visual completa
    expect(pill).toMatch(/bg-stone-50/);
    expect(pill).toMatch(/border/);
    expect(pill).toMatch(/rounded-\[2rem\]/);
    // Verificação: apenas a PILL (rounded-[2rem]) possui bg+border+rounded principal na região
    const region = getComposerRegion();
    const allRounded = region.match(/<div className="[^"]*rounded-\[2rem\][^"]*"/g) ?? [];
    const principalVisuals = allRounded.filter((c) => /bg-stone-50/.test(c) && /border/.test(c));
    expect(principalVisuals.length).toBe(1);
  });
});
