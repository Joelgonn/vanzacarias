import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// COMPOSER-001 — Refatoração UX do Composer (ChatGPT-like):
// um único container (textarea + controles) que cresce verticalmente conforme o
// texto, com altura máxima + scroll interno e ações ancoradas na parte inferior.
// Os testes seguem o padrão do projeto (vitest em node, inspeção de fonte) e
// cobrem T-COMP-1..T-COMP-12.
// CHAT-UX-002 — Fundação: pill vertical bg-white rounded-3xl flex-col

const chatPath = path.join(process.cwd(), 'src/components/ChatAssistant.tsx');
const content = fs.readFileSync(chatPath, 'utf8');

// Pill atual CHAT-UX-004: flex flex-col w-full bg-white p-2.5 rounded-3xl (CHAT-UX-003 usava p-3, CHAT-UX-002 p-2)
// Fallback para código pré-002 (flex w-full gap-2 bg-stone-50 rounded-[2rem])
const getPillRegion = (): string => {
  // CHAT-UX-006: pill flex-col bg-white rounded-3xl (container visual único), p-2
  const idx6 = content.indexOf('flex flex-col w-full bg-white p-2 rounded-3xl');
  if (idx6 !== -1) return content.slice(idx6, idx6 + 12000);
  const idxNew = content.indexOf('flex flex-col w-full bg-white p-2.5 rounded-3xl');
  if (idxNew !== -1) return content.slice(idxNew, idxNew + 12000);
  const idx3 = content.indexOf('flex flex-col w-full bg-white p-3 rounded-3xl');
  if (idx3 !== -1) return content.slice(idx3, idx3 + 12000);
  const idx2 = content.indexOf('flex flex-col w-full bg-white p-2 rounded-3xl');
  if (idx2 !== -1) return content.slice(idx2, idx2 + 12000);
  const oldIdx = content.indexOf('flex w-full gap-2 bg-stone-50');
  if (oldIdx !== -1) return content.slice(content.lastIndexOf('<div className="', oldIdx), oldIdx + 12000);
  throw new Error('pill do Composer não encontrada');
};

const getPill = (): string => {
  return getPillRegion();
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
  return content.slice(start, start + 12000);
};

const getTextareaClass = (): string => {
  // Real textarea tem value + rows={1}, ignora comentário // <textarea>).
  const m = content.match(/<textarea\s+value[\s\S]*?rows=\{1\}[\s\S]*?className=\{?(?:"([^"]*)"|`([^`]*)`)\}?/);
  if (!m) throw new Error('textarea não encontrada');
  const raw = m[1] || m[2] || '';
  return raw.split('${')[0];
};

describe('COMPOSER-001 — Estrutura: um único Composer', () => {
  it('T-COMP-1 — vazio: altura mínima, compacto, controles visíveis', () => {
    expect(content).toMatch(/min-h-\[44px\]/);
    expect(content).toMatch(/rows=\{1\}/);
    expect(content).toMatch(/aria-label="Anexar foto"/);
    // CHAT-UX-003: voz simplificada — "Falar mensagem" idle, "Parar gravação" + "Cancelar gravação" quando gravando
    const hasVoiceLabel = content.includes('Falar mensagem') || content.includes('Parar e transcrever');
    expect(hasVoiceLabel).toBe(true);
    expect(content).toMatch(/aria-label="Enviar mensagem"/);
  });

  it('T-COMP-2 — uma linha: Composer permanece compacto', () => {
    // textarea de 1 linha + altura mínima de toque, sem altura fixa grande
    expect(content).toMatch(/rows=\{1\}/);
    expect(content).toMatch(/min-h-\[44px\]/);
    expect(content).not.toMatch(/min-h-\[132px\]/);
  });

  it('T-COMP-3 — texto em várias linhas: textarea e controles no MESMO container', () => {
    // Pill vertical (CHAT-UX-003) ou pill horizontal legada — contém attach, mic, textarea e enviar
    const pill = getPillRegion();
    // Verifica rounded e bg conforme fundação atual (rounded-3xl bg-white) ou legado (rounded-[2rem] bg-stone-50)
    const hasRounded = pill.includes('rounded-3xl') || pill.includes('rounded-[2rem]');
    expect(hasRounded).toBe(true);
    expect(pill.indexOf('<textarea')).toBeGreaterThan(0);
    expect(pill.indexOf('aria-label="Anexar foto"')).toBeGreaterThan(0);
    // CHAT-UX-003: voz simplificada — Falar mensagem (idle) e Parar/Cancelar gravação (recording)
    const hasMic = pill.includes('Falar mensagem') || pill.includes('Parar e transcrever');
    expect(hasMic).toBe(true);
    const hasParar = pill.includes('Parar gravação') || pill.includes('Parar e transcrever');
    expect(hasParar).toBe(true);
    expect(pill.indexOf('aria-label="Enviar mensagem"')).toBeGreaterThan(0);
    // Em CHAT-UX-002 vertical, textarea vem antes da barra de ações (border-t); enviar é último
    const textareaIdx = pill.indexOf('<textarea');
    const enviarIdx = pill.indexOf('aria-label="Enviar mensagem"');
    expect(enviarIdx).toBeGreaterThan(textareaIdx);
    // Nenhuma segunda caixa independente ao redor do textarea (só o elemento real)
    const textareas = content.match(/^\s*<textarea/mg) ?? [];
    expect(textareas.length).toBe(1);
  });

  it('T-COMP-4 — ultrapassou max-height: Composer não cresce, scroll interno aparece', () => {
    expect(content).toMatch(/const COMPOSER_MAX_HEIGHT = 200;/);
    expect(content).toMatch(/max-h-\[200px\]/);
    expect(content).toMatch(/autoGrowHeight\(el\.scrollHeight, COMPOSER_MAX_HEIGHT\)/);
    expect(content).toMatch(/el\.style\.overflowY = overflowY/);
    expect(content).toMatch(/overflow-y-auto/);
    expect(content).toMatch(/resize-none/);
  });
});

describe('COMPOSER-001 — Auto-grow', () => {
  it('T-COMP-5 — apagar texto: recalcula e reduz (reage a qualquer mudança de input)', () => {
    expect(content).toMatch(/\}, \[state\.input, isComposerFocused\]\)/);
    expect(content).toMatch(/state\.setInput\(e\.target\.value\)/);
    expect(content).toMatch(/resizeComposer\(\)/);
  });

  it('T-COMP-6 — colar texto longo: onChange só atualiza o value; auto-grow roda no useLayoutEffect pós-render', () => {
    expect(content).toMatch(/state\.setInput\(e\.target\.value\);/);
    expect(content).not.toMatch(/state\.setInput\(e\.target\.value\);\s+resizeComposer\(\)/);
    expect(content).toMatch(/useLayoutEffect/);
    expect(content).toMatch(/el\.style\.height = 'auto'/);
    expect(content).toMatch(/el\.style\.height = `\$\{heightPx\}px`/);
  });

  it('T-COMP-7 — transcrição de voz longa: recalcula e não perde texto', () => {
    expect(content).toMatch(/onTranscript: \(text\) =>/);
    expect(content).toMatch(/state\.setInput\(\(prev: string\) =>/);
    expect(content).toMatch(/\$\{prevTrimmed\} \$\{trimmed\}/); // preserva texto existente
    expect(content).toMatch(/\}, \[state\.input, isComposerFocused\]\)/); // efeito recalcula após inserção
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

  it('T-COMP-10 — Enter cria nova linha; Shift+Enter cria nova linha; só botão envia', () => {
    // CHAT-UX-004: Enter e Shift+Enter apenas criam nova linha, não enviam
    expect(content).not.toMatch(/e\.key === 'Enter' && !e\.shiftKey[^}]*handleSend/);
    expect(content).toMatch(/onFocus.*setIsComposerFocused/);
    expect(content).toMatch(/onBlur.*setIsComposerFocused/);
    expect(content).toMatch(/aria-label="Enviar mensagem"/);
  });
});

describe('COMPOSER-001 — Mobile e acessibilidade', () => {
  it('T-COMP-11 — sem overflow horizontal; botões com área de toque >= 44px', () => {
    expect(content).toMatch(/min-w-0/); // textarea pode encolher em 320px sem empurrar os botões
    expect(content).toMatch(/min-w-\[44px\]/);
    expect(content).toMatch(/h-\[44px\]/);
    expect(content).toMatch(/w-full/);
    // CHAT-UX-002: painel fluido 420-440px, não mais 400px fixo
    const hasFluid = content.includes('sm:w-[420px]') || content.includes('sm:w-[400px]');
    expect(hasFluid).toBe(true);
    expect(content).toMatch(/sm:items-end/); // painel segue ancorado embaixo no mobile (overlay)
  });

  it('composer respeita área segura inferior do aparelho (safe-area)', () => {
    expect(content).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(content).toMatch(/sm:pb-(3|4)/);
  });

  it('ações na linha inferior do Composer editando via grid (sem border-t, sem barra empilhada no idle)', () => {
    const pill = getPillRegion();
    // CHAT-UX-006: os controles são filhos diretos do mesmo grid do textarea
    // (áreas nomeadas) — não há barra de ações separada com border-t/pt-mt.
    expect(content).toMatch(/COMPOSER_IDLE_AREAS/);
    expect(content).toMatch(/COMPOSER_EDIT_AREAS/);
    expect(content).toMatch(/COMPOSER_GRID_COLUMNS/);
    expect(content).toMatch(/isComposerIdle/);
    expect(pill).toMatch(/grid w-full min-w-0 items-center gap-x-1 gap-y-1\.5/);
    expect(pill).toMatch(/\[grid-area:attach\]/);
    expect(pill).toMatch(/\[grid-area:mic\]/);
    expect(pill).toMatch(/\[grid-area:input\]/);
    expect(pill).toMatch(/\[grid-area:send\]/);
    expect(content).not.toMatch(/flex items-center justify-between pt-2 mt-2/);
    // Nenhuma segunda "linha de ações" empilhada no idle: idle é 1 linha do grid.
    expect(content).toMatch(/gridTemplateAreas: '"attach mic input send"'/);
    expect(content).toMatch(/gridTemplateAreas: '"input input input input" "attach mic \. send"'/);
  });

  it('controles continuam sendo <button>', () => {
    expect(content).toMatch(/<button[\s\S]*?aria-label="Anexar foto"/);
    // CHAT-UX-003: voz simplificada — Falar mensagem (idle) e Parar/Cancelar gravação
    const hasFalar = /<button[\s\S]*?aria-label="Falar mensagem"/.test(content);
    const hasParar = /<button[\s\S]*?aria-label="Parar gravação"/.test(content) || /Parar e transcrever/.test(content);
    expect(hasFalar || hasParar).toBe(true);
    expect(content).toMatch(/<button[\s\S]*?aria-label="Enviar mensagem"/);
  });
});

describe('COMPOSER-001 — Regressão', () => {
  it('T-COMP-12 — invariantes de voz (VOZ-012.x) permanecem intactas', () => {
    expect(content).toMatch(/useVoiceInput\(\{/);
    // CHAT-UX-003: voz simplificada sem texto "Gravando" — verifica timer e estados
    const hasGravando = content.includes('Gravando {formatElapsedMs') || content.includes('formatElapsedMs(voice.recordingElapsedMs)');
    expect(hasGravando).toBe(true);
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
// Atualizado CHAT-UX-002: PILL agora bg-white rounded-3xl flex-col
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
    // CHAT-UX-003: conta rounded-3xl (novo) ou rounded-[2rem] (legado) na região do Composer (DOCK+pill)
    const count3xl = (region.match(/rounded-3xl/g) || []).length;
    const count2rem = (region.match(/rounded-\[2rem\]/g) || []).length;
    // Deve haver exatamente 1 principal (pill) — panel tem rounded-3xl mas está fora da região DOCK
    const totalRounded = count3xl + count2rem;
    // Filtra apenas os que têm bg-white+border (pill)
    const hasPillNew = region.includes('rounded-3xl') && region.includes('bg-white') && region.includes('border border-stone-200');
    const hasPillOld = region.includes('rounded-[2rem]') && region.includes('bg-stone-50');
    expect(hasPillNew || hasPillOld).toBe(true);
    expect(totalRounded).toBe(1);
    const dockClass = getDockClass();
    expect(dockClass).not.toMatch(/rounded-\[/);
    expect(dockClass).not.toMatch(/rounded-3xl/);
    expect(dockClass).not.toMatch(/bg-white/);
  });

  it('T-COMP-STRUCT-3 — textarea e botões Anexar/Microfone/Enviar pertencem ao mesmo container visual principal (PILL)', () => {
    const pill = getPill();
    // Propriedade estrutural: todos os controles e o campo estão dentro da mesma pill
    expect(pill).toMatch(/<textarea/);
    expect(pill).toMatch(/aria-label="Anexar foto"/);
    // CHAT-UX-003: voz simplificada — Falar mensagem / Parar gravação / Cancelar gravação
    const hasMic = pill.includes('Falar mensagem') || pill.includes('Parar e transcrever');
    expect(hasMic).toBe(true);
    const hasParar = pill.includes('Parar gravação') || pill.includes('Parar e transcrever');
    expect(hasParar).toBe(true);
    expect(pill).toMatch(/aria-label="Enviar mensagem"/);
    // Ordem estrutural em CHAT-UX-002 vertical: textarea antes da barra border-t, enviar é último
    const textareaIdx = pill.indexOf('<textarea');
    const anexarIdx = pill.indexOf('aria-label="Anexar foto"');
    const micIdx = pill.indexOf('Falar mensagem') !== -1 ? pill.indexOf('Falar mensagem') : pill.indexOf('Parar e transcrever');
    const enviarIdx = pill.indexOf('aria-label="Enviar mensagem"');
    expect(anexarIdx).toBeGreaterThan(-1);
    expect(micIdx).toBeGreaterThan(-1);
    expect(textareaIdx).toBeGreaterThan(-1);
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
    expect(textareaClass).not.toMatch(/border-(?!0)/); // border-0 allowed for reset
    expect(textareaClass).toMatch(/resize-none/);
    expect(textareaClass).toMatch(/min-w-0/);
    expect(textareaClass).toMatch(/min-h-\[44px\]/);
    expect(textareaClass).toMatch(/max-h-\[200px\]/);
    expect(textareaClass).toMatch(/overflow-y-auto/);
  });

  it('T-COMP-STRUCT-5 — PILL utiliza estrutura vertical fundação (flex-col, superfície única)', () => {
    const pill = getPill();
    // CHAT-UX-003: vertical flex-col sem border-t interno (superfície única); legado usava items-end
    const isVertical = pill.includes('flex flex-col') && pill.includes('rounded-3xl');
    const isLegacy = pill.includes('items-end') && pill.includes('rounded-[2rem]');
    expect(isVertical || isLegacy).toBe(true);
    if (isVertical) {
      expect(pill).toMatch(/flex flex-col/);
      expect(pill).toMatch(/rounded-3xl/);
      expect(pill).toMatch(/bg-white/);
      // Verifica superfície única: não há border-t entre textarea e ações (separação por espaçamento)
      const textareaIdx = pill.indexOf('<textarea');
      const actionsIdx = pill.lastIndexOf('flex items-center justify-between pt-');
      if (textareaIdx !== -1 && actionsIdx !== -1) {
        const between = pill.slice(textareaIdx, actionsIdx);
        expect(between).not.toMatch(/border-t/);
      }
    } else {
      const opening = pill.slice(0, pill.indexOf('>'));
      expect(opening).toMatch(/items-end/);
    }
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
    expect(dockClass).not.toMatch(/rounded-3xl/);
    expect(dockClass).not.toMatch(/shadow-\[/);
    // PILL é o único com identidade visual completa (nova ou legada)
    const hasNewPill = pill.includes('bg-white') && pill.includes('border') && pill.includes('rounded-3xl');
    const hasOldPill = pill.includes('bg-stone-50') && pill.includes('border') && pill.includes('rounded-[2rem]');
    expect(hasNewPill || hasOldPill).toBe(true);
    // Verificação: apenas a PILL principal possui bg+border+rounded na região
    const region = getComposerRegion();
    const count3xl = (region.match(/rounded-3xl/g) || []).length;
    const count2rem = (region.match(/rounded-\[2rem\]/g) || []).length;
    expect(count3xl + count2rem).toBe(1);
    expect(region).toMatch(/border border-stone-200/);
  });
});

// =============================================================
// CHAT-UX-002 — Fundação (shell, header, conversation, empty, composer vertical)
// Valida nova fundação sem quebrar invariantes
// =============================================================
describe('CHAT-UX-002 — Fundação UX/UI', () => {
  it('F-01 — mobile full-width (sem max-w base); desktop 420-440 preservado via sm:max-w', () => {
    expect(content).toMatch(/sm:w-\[420px\]/);
    expect(content).toMatch(/lg:w-\[440px\]/);
    expect(content).toMatch(/sm:max-w-\[min\(440px,calc\(100vw-32px\)\)\]/);
    // Nenhuma ocorrência de max-w-[min(...)] SEM o prefixo sm: (causava 16px de
    // margem lateral em cada lado no mobile). Lookbehind: rejeita o prefixado.
    expect(content).not.toMatch(/(?<!sm:)max-w-\[min\(440px,calc\(100vw-32px\)\)\]/);
    expect(content).toMatch(/h-\[85dvh\]/);
    expect(content).toMatch(/sm:h-\[min\(600px,85dvh\)\]/);
    expect(content).toMatch(/bg-white/);
    expect(content).toMatch(/rounded-3xl/);
    expect(content).toMatch(/shadow-premium/);
    expect(content).toMatch(/border border-stone-100/);
  });

  it('F-02 — overlay com scrim e dismiss (z-[60], bg-stone-900/30, onClick, Esc)', () => {
    expect(content).toMatch(/z-\[60\]/);
    expect(content).toMatch(/bg-stone-900\/30/);
    expect(content).toMatch(/backdrop-blur-sm/);
    expect(content).toMatch(/onClick=\{\(\) => state\.setIsOpen\(false\)\}/);
    expect(content).toMatch(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
    expect(content).toMatch(/role="dialog"/);
    expect(content).toMatch(/aria-modal="true"/);
    expect(content).toMatch(/Escape/);
  });

  it('F-03 — header nutri em UMA linha: avatar 40 + nome com dot inline + badge + ações; sem linha de status', () => {
    expect(content).toMatch(/bg-nutri-900/);
    expect(content).toMatch(/bg-amber-50 text-amber-700 border border-amber-100/);
    // CHAT-UX-006: header 1 linha — avatar 40px, dot pulsante inline após "Van"
    expect(content).toMatch(/w-10 h-10/);
    expect(content).not.toMatch(/text-white\/60 tracking-widest/); // status removido
    expect(content).not.toMatch(/Online agora/);
    expect(content).not.toMatch(/De olho em voc/);
    expect(content).not.toMatch(/Assistente IA da Nutri/);
    expect(content).toMatch(/text-emerald-400">Van<\/span>/);
    expect(content).toMatch(/relative flex h-1\.5 w-1\.5 shrink-0/); // dot inline
    expect(content).toMatch(/min-w-\[44px\] min-h-\[44px\] w-11 h-11/);
    const hasAvatar = content.includes('w-10 h-10') || content.includes('w-12 h-12');
    expect(hasAvatar).toBe(true);
  });

  it('F-04 — conversation com role log e espaço reduzido', () => {
    expect(content).toMatch(/role="log"/);
    expect(content).toMatch(/aria-live="polite"/);
    expect(content).toMatch(/space-y-4/);
    expect(content).toMatch(/max-w-\[75%\]/);
    expect(content).toMatch(/bg-nutri-900/); // user bubble nutri
  });

  it('F-05 — empty state com hero 80px e headline 20px', () => {
    expect(content).toMatch(/w-20 h-20 sm:w-\[88px\] sm:h-\[88px\]/);
    expect(content).toMatch(/text-\[20px\] sm:text-\[22px\]/);
    expect(content).toMatch(/max-w-\[32ch\]/);
    expect(content).toMatch(/hover:border-nutri-200.*hover:text-nutri-700/);
  });

  it('F-06 — composer single surface com grid dual-mode e controles internos (sem border-t/barra)', () => {
    const pill = getPillRegion();
    const hasPill = pill.includes('flex flex-col w-full bg-white p-2 rounded-3xl') || pill.includes('flex flex-col w-full bg-white p-2.5 rounded-3xl') || pill.includes('flex flex-col w-full bg-white p-3 rounded-3xl') || pill.includes('flex flex-col w-full bg-white p-');
    expect(hasPill).toBe(true);
    // CHAT-UX-006: textarea e controles no MESMO grid (áreas nomeadas)
    expect(pill).toMatch(/w-full min-w-0 bg-transparent/);
    expect(pill).toMatch(/\[grid-area:input\]/);
    expect(pill).toMatch(/\[grid-area:attach\]/);
    expect(pill).toMatch(/\[grid-area:mic\]/);
    expect(pill).toMatch(/\[grid-area:send\]/);
    expect(content).toMatch(/COMPOSER_IDLE_AREAS/);
    expect(content).toMatch(/COMPOSER_EDIT_AREAS/);
    expect(content).not.toMatch(/flex items-center justify-between pt-2 mt-2/);
    expect(content).not.toMatch(/focus-within:ring/); // sem ring interno, superfície única
    expect(content).toMatch(/capture="environment"/); // camera affordance (Tirar foto)
    expect(content).toMatch(/bg-nutri-800/); // enviar nutri
    expect(content).toMatch(/accept="image\/\*"/);
  });
});

describe('CHAT-UX-003 — Refinamento Mobile (header, 3 sugestões, drag, anexo, voz simplificada)', () => {
  it('R-01 — exatamente 3 sugestões (evolução, prioridade, análise)', () => {
    const m = content.match(/const QUICK_ACTIONS_PREMIUM = \[([\s\S]*?)\];/);
    expect(m).not.toBeNull();
    const items = (m![1].match(/'[^']+'/g) || []);
    expect(items.length).toBe(3);
    expect(items.join(' ')).toMatch(/Como está minha evolução\?/);
    expect(items.join(' ')).toMatch(/O que devo priorizar hoje\?/);
    expect(items.join(' ')).toMatch(/Analisar uma refeição/);
    expect(m![1]).not.toMatch(/Quero rever meu plano/);
    expect(m![1]).not.toMatch(/O que mudou na minha jornada/);
    // Free também 3
    const mFree = content.match(/const QUICK_ACTIONS_FREE = \[([\s\S]*?)\];/);
    expect(mFree).not.toBeNull();
    const freeItems = (mFree![1].match(/'[^']+'/g) || []);
    expect(freeItems.length).toBe(3);
  });

  it('R-02 — header em 1 linha (avatar 40, py-3, dot inline, badge 9px, sem status)', () => {
    expect(content).toMatch(/w-10 h-10/); // avatar 40px
    expect(content).toMatch(/px-4 py-3/); // header py-3
    expect(content).toMatch(/text-\[9px\]/); // badge 9px
    expect(content).toMatch(/Premium/);
    expect(content).toMatch(/gap-3/);
    expect(content).not.toMatch(/text-\[10px\] text-white\/60/); // status removido
  });

  it('R-03 — composer single surface com grid dual-mode (idle 1 linha ↔ editando), sem border-t', () => {
    const pill = getPillRegion();
    expect(pill).toMatch(/flex flex-col w-full bg-white p-(2\.5|2|3) rounded-3xl/);
    expect(pill).toMatch(/min-h-0/);
    expect(content).toMatch(/flex-1 min-h-0 p-4/); // conversation min-h-0 p/ crescimento
    expect(content).toMatch(/leading-\[1\.6\]/);
    expect(content).toMatch(/min-h-\[44px\] max-h-\[200px\]/);
    // Grid único com áreas nomeadas: mesmos controles em idle (1 linha) e editando (2 linhas)
    expect(content).toMatch(/COMPOSER_IDLE_AREAS/);
    expect(content).toMatch(/COMPOSER_EDIT_AREAS/);
    expect(pill).toMatch(/grid w-full min-w-0 items-center/);
    expect(pill).toMatch(/\[grid-area:input\]/);
    expect(pill).toMatch(/\[grid-area:attach\]/);
    expect(pill).toMatch(/\[grid-area:mic\]/);
    expect(pill).toMatch(/\[grid-area:send\]/);
    expect(pill).not.toMatch(/flex items-center justify-between pt-2 mt-2/); // sem barra antiga
    // Sem piso artificial de foco (min-h-[120px]) — altura segue o conteúdo
    expect(content).not.toMatch(/min-h-\[120px\]/);
    expect(content).toMatch(/isComposerIdle/);
    expect(content).toMatch(/onFocus.*setIsComposerFocused\(true\)/);
    expect(content).toMatch(/onBlur.*setIsComposerFocused\(false\)/);
  });

  it('R-04 — drag bottom-sheet mobile isolado (touch handlers, threshold, não move atrás)', () => {
    expect(content).toMatch(/const handleTouchStart/);
    expect(content).toMatch(/const handleTouchMove/);
    expect(content).toMatch(/const handleTouchEnd/);
    expect(content).toMatch(/isDragging/);
    expect(content).toMatch(/dragY/);
    expect(content).toMatch(/panelRef/);
    expect(content).toMatch(/onTouchStart=\{handleTouchStart\}/);
    expect(content).toMatch(/onTouchMove=\{handleTouchMove\}/);
    expect(content).toMatch(/onTouchEnd=\{handleTouchEnd\}/);
    expect(content).toMatch(/translateY\(/);
    expect(content).toMatch(/threshold.*100/);
    // Verifica que não usa document drag global que move conteúdo atrás
    expect(content).not.toMatch(/document\.addEventListener\('touchmove'/);
  });

  it('R-05 — anexo com menu (Tirar foto, Galeria, Arquivo) sem capture restritivo', () => {
    expect(content).toMatch(/showAttachMenu/);
    expect(content).toMatch(/cameraInputRef/);
    expect(content).toMatch(/fileGenericRef/);
    expect(content).toMatch(/Tirar foto/);
    expect(content).toMatch(/Escolher da galeria/);
    expect(content).toMatch(/Arquivo/);
    expect(content).toMatch(/role="menu"/);
    expect(content).toMatch(/accept="image\/\*"/);
    expect(content).toMatch(/accept="\*\/\*"/);
    // Verifica que menu tem 3 opções e não apenas capture environment
    expect(content).toMatch(/Camera.*Tirar foto/);
    expect(content).toMatch(/FileText.*Arquivo/);
  });

  it('R-06 — voz simplificada durante gravação (× ● waveform timer ■ sem textos)', () => {
    // Verifica estrutura condicional voice.isRecording com novo padrão single line
    expect(content).toMatch(/\{voice\.isRecording \? \(/);
    expect(content).toMatch(/aria-label="Cancelar gravação"/);
    expect(content).toMatch(/aria-label="Parar gravação"/);
    expect(content).toMatch(/formatElapsedMs\(voice\.recordingElapsedMs\)/);
    expect(content).toMatch(/bg-rose-500 rounded-full animate-pulse/); // ponto pulsante
    expect(content).toMatch(/flex-1 max-w-\[3px\].*bg-rose.*animate-pulse/); // waveform flexível
    expect(content).toMatch(/WAVEFORM_BAR_HEIGHTS/);
    // Não deve mostrar "Gravando" como texto principal (apenas aria-label)
    expect(content).not.toMatch(/>Gravando \{formatElapsedMs/);
    const pill = getPillRegion();
    expect(pill).toMatch(/voice\.isRecording/);
    expect(content).toMatch(/Falar mensagem/);
  });

  it('R-07 — composer cresce até 200px com scroll interno (flex/grid constraints tratadas)', () => {
    expect(content).toMatch(/const COMPOSER_MAX_HEIGHT = 200/);
    expect(content).toMatch(/max-h-\[200px\]/);
    expect(content).toMatch(/autoGrowHeight\(el\.scrollHeight, COMPOSER_MAX_HEIGHT\)/);
    // Fix de constraints: min-h-0 na conversation e no pill
    expect(content).toMatch(/flex-1 min-h-0 p-4/);
    expect(content).toMatch(/flex flex-col w-full bg-white p-(2\.5|2|3).*min-h-0/);
  });
});

describe('CHAT-UX-003 — COMPOSER-UX e VOICE-UX refinados (validação visual)', () => {
  it('COMPOSER-UX-01 — idle compacto: 1 linha do grid, sem pisos artificiais (min-h-[68/120px])', () => {
    expect(content).toMatch(/const isComposerIdle/);
    expect(content).toMatch(/attach mic input send/); // idle = uma linha (grid areas)
    expect(content).not.toMatch(/min-h-\[120px\]/);
    expect(content).not.toMatch(/min-h-\[68px\]/);
    expect(content).not.toMatch(/min-h-\[72px\]/);
    expect(content).not.toMatch(/min-h-\[140px\]/);
  });
  it('COMPOSER-UX-02 — placeholder dentro do Composer (texto real, sem caixa; alinhamento padrão)', () => {
    expect(content).toMatch(/Digite sua dúvida/);
    expect(content).not.toMatch(/placeholder:text-center/);
    expect(content).not.toMatch(/text-center placeholder:text-center/);
    expect(content).toMatch(/placeholder:text-stone-400/);
  });
  it('COMPOSER-UX-03 — focus expande Composer (onFocus/onBlur → modo edição)', () => {
    expect(content).toMatch(/onFocus.*setIsComposerFocused\(true\)/);
    expect(content).toMatch(/onBlur.*setIsComposerFocused\(false\)/);
    expect(content).toMatch(/isComposerFocused/);
    expect(content).toMatch(/isComposerIdle/);
  });
  it('COMPOSER-UX-04 — blur vazio retorna ao idle compacto', () => {
    expect(content).toMatch(/!isComposerFocused && !hasContent/);
    expect(content).toMatch(/state\.selectedImage === null/);
    expect(content).not.toMatch(/text-center placeholder:text-center/);
  });
  it('COMPOSER-UX-05 — texto mantém Composer expandido (guarda idle inclui foco/conteúdo)', () => {
    expect(content).toMatch(/hasContent/);
    expect(content).toMatch(/!voice\.isRecording && state\.selectedImage === null/);
  });
  it('COMPOSER-UX-06 — textarea cresce além de duas linhas (flex, line-height)', () => {
    const pill = getPillRegion();
    expect(pill).toMatch(/leading-\[1\.6\]/);
    expect(content).toMatch(/min-h-\[44px\] max-h-\[200px\]/);
    expect(content).toMatch(/resize-none overflow-y-auto/);
  });
  it('COMPOSER-UX-07 — limite 200px', () => {
    expect(content).toMatch(/COMPOSER_MAX_HEIGHT = 200/);
    expect(content).toMatch(/max-h-\[200px\]/);
  });
  it('COMPOSER-UX-08 — scroll interno', () => {
    expect(content).toMatch(/el\.style\.overflowY = overflowY/);
    expect(content).toMatch(/autoGrowHeight\(el\.scrollHeight, COMPOSER_MAX_HEIGHT\)/);
    expect(content).toMatch(/overflow-y-auto/);
  });
  it('COMPOSER-UX-09 — superfície única: controles no mesmo grid do texto, sem border-t/barra empilhada', () => {
    const pill = getPillRegion();
    expect(pill).toMatch(/\[grid-area:attach\]/);
    expect(pill).toMatch(/\[grid-area:mic\]/);
    expect(pill).toMatch(/\[grid-area:input\]/);
    expect(pill).toMatch(/\[grid-area:send\]/);
    expect(pill).not.toMatch(/flex items-center justify-between pt-2 mt-2/);
    expect(pill).not.toMatch(/pt-2 mt-2/);
  });
  it('COMPOSER-UX-10 — ações continuam dentro do Composer', () => {
    const pill = getPillRegion();
    expect(pill).toMatch(/aria-label="Anexar foto"/);
    expect(pill).toMatch(/Falar mensagem/);
    expect(pill).toMatch(/aria-label="Enviar mensagem"/);
  });
  it('VOICE-UX-01 — recording não mostra "Gravando" como texto', () => {
    expect(content).not.toMatch(/>Gravando \{formatElapsedMs/);
    expect(content).toMatch(/aria-label="Gravando"/);
  });
  it('VOICE-UX-02 — waveform presente e flexível (sem largura fixa, sem w-0.5 fixo)', () => {
    expect(content).toMatch(/flex-1 max-w-\[3px\].*bg-rose.*animate-pulse/);
    expect(content).toMatch(/items-end[\s\S]*?gap-\[3px\][\s\S]*?h-4 flex-1 min-w-0 overflow-hidden/);
    expect(content).not.toMatch(/max-w-\[160px\]/);
    expect(content).not.toMatch(/w-0\.5 h-/);
  });
  it('VOICE-UX-03 — indicador vermelho pulsante presente', () => {
    expect(content).toMatch(/bg-rose-500 rounded-full animate-pulse/);
    expect(content).toMatch(/w-2 h-2 bg-rose-500/);
  });
  it('VOICE-UX-04 — timer presente', () => {
    expect(content).toMatch(/formatElapsedMs\(voice\.recordingElapsedMs\)/);
    expect(content).toMatch(/tabular-nums/);
  });
  it('VOICE-UX-05 — cancelar disponível (×)', () => {
    expect(content).toMatch(/aria-label="Cancelar gravação"/);
    expect(content).toMatch(/<X size=\{18\}/);
  });
  it('VOICE-UX-06 — parar disponível (■ verde compacto, sem vermelho no botão)', () => {
    expect(content).toMatch(/aria-label="Parar gravação"/);
    const idx = content.indexOf('aria-label="Parar gravação"');
    expect(idx).toBeGreaterThan(-1);
    const stopBtn = content.slice(idx, idx + 500);
    expect(stopBtn).toMatch(/bg-nutri-800 bg-\[#2A5C43\]/);
    expect(stopBtn).toMatch(/<Square size=\{11\}/);
    expect(stopBtn).not.toMatch(/bg-rose/);
    // Vermelho fica reservado ao ● de gravação
    expect(content).toMatch(/bg-rose-500 rounded-full animate-pulse/);
  });
  it('VOICE-UX-07 — imagem/anexo oculto durante gravação', () => {
    const pill = getPillRegion();
    // Quando isRecording, anexo não está no branch de gravação
    expect(pill).toMatch(/voice\.isRecording \? \(/);
    // Verifica que o branch de gravação não contém "Anexar foto"
    const recordingBranch = content.slice(content.indexOf('voice.isRecording ? ('), content.indexOf('voice.isRecording ? (') + 2000);
    expect(recordingBranch).not.toMatch(/Anexar foto/);
  });
  it('ATTACH-UX-01 — menu de adicionar disponível', () => {
    expect(content).toMatch(/showAttachMenu/);
    expect(content).toMatch(/role="menu"/);
  });
  it('ATTACH-UX-02 — câmera preservada', () => {
    expect(content).toMatch(/cameraInputRef/);
    expect(content).toMatch(/capture="environment"/);
    expect(content).toMatch(/Tirar foto/);
  });
  it('ATTACH-UX-03 — galeria disponível', () => {
    expect(content).toMatch(/Escolher da galeria/);
    expect(content).toMatch(/accept="image\/\*"/);
  });
  it('ATTACH-UX-04 — arquivo disponível', () => {
    expect(content).toMatch(/Arquivo/);
    expect(content).toMatch(/accept="\*\/\*"/);
    expect(content).toMatch(/FileText/);
  });
  it('DRAG-UX-01 — drag afeta somente ChatAssistant (panelRef, não document)', () => {
    expect(content).toMatch(/panelRef/);
    expect(content).toMatch(/handleTouchStart/);
    expect(content).not.toMatch(/document\.addEventListener\('touchmove'/);
  });
  it('DRAG-UX-02 — threshold fecha (100px)', () => {
    expect(content).toMatch(/threshold.*100/);
    expect(content).toMatch(/dragY > threshold/);
    expect(content).toMatch(/setIsOpen\(false\)/);
  });
  it('DRAG-UX-03 — drag insuficiente retorna (setDragY 0)', () => {
    expect(content).toMatch(/setDragY\(0\)/);
    expect(content).toMatch(/translateY/);
  });
});

// =============================================================
// CHAT-UX-006 — Composer compacto (idle ↔ editando), Full-Width Mobile,
// Parar verde, Header 1 linha, Enter só nova linha.
// Contrato: UM único textarea real, sem display:none, sem DOM duplicado.
// =============================================================
describe('CHAT-UX-006 — Composer compacto idle ↔ editando', () => {
  it('UX6-01 — um único textarea real (sem fake button, sem segundo textarea, sem display:none)', () => {
    // Conta somente o elemento real (linha começando em <textarea); comentários
    // contêm "<textarea" mas não iniciam a linha com o elemento.
    const textareas = content.match(/^\s*<textarea/mg) ?? [];
    expect(textareas.length).toBe(1);
    expect(content).not.toMatch(/role="button"[\s\S]*?Digite sua dúvida/); // sem botão fake
    // display:none nunca no textarea
    const mReal = /^\s*<textarea/m.exec(content);
    expect(mReal).not.toBeNull();
    const taChunk = content.slice(mReal!.index, mReal!.index + 900);
    expect(taChunk).not.toMatch(/display\s*:\s*none/);
  });

  it('UX6-02 — idle = linha única do grid: attach | mic | input | send', () => {
    expect(content).toMatch(/'"attach mic input send"'/);
    const pill = getPillRegion();
    expect(pill).toMatch(/COMPOSER_IDLE_AREAS/); // binding no style do grid
    // todos os controles presentes no idle (mesmo grid, sem segunda linha empilhada)
    expect(pill).toMatch(/aria-label="Anexar foto"/);
    expect(pill).toMatch(/aria-label="Falar mensagem"/);
    expect(pill).toMatch(/aria-label="Enviar mensagem"/);
    expect(pill).not.toMatch(/flex items-center justify-between pt-2 mt-2/);
  });

  it('UX6-03 — expande quando foco OU conteúdo OU imagem OU gravação (guarda isComposerIdle)', () => {
    expect(content).toMatch(/const isComposerIdle =/);
    expect(content).toMatch(/!isComposerFocused && !hasContent && !voice\.isRecording && state\.selectedImage === null/);
    // edição = textarea em linha cheia + ações na linha inferior (grid areas)
    expect(content).toMatch(/'"input input input input" "attach mic \. send"'/);
    expect(content).toMatch(/style=\{\{\s*\.\.\.COMPOSER_GRID_COLUMNS/);
    expect(content).toMatch(/\.\.\.\(isComposerIdle \? COMPOSER_IDLE_AREAS : COMPOSER_EDIT_AREAS\)/);
  });

  it('UX6-04 — altura segue conteúdo: sem piso min-h-[120px], auto-grow até 200 + scroll interno', () => {
    expect(content).not.toMatch(/min-h-\[120px\]/);
    expect(content).toMatch(/const COMPOSER_MAX_HEIGHT = 200/);
    expect(content).toMatch(/max-h-\[200px\]/);
    expect(content).toMatch(/autoGrowHeight\(el\.scrollHeight, COMPOSER_MAX_HEIGHT\)/);
    expect(content).toMatch(/overflow-y-auto/);
    expect(content).toMatch(/resize-none/);
    expect(content).toMatch(/min-h-0/);
  });

  it('UX6-05 — Enter e Shift+Enter criam nova linha; nenhum envia; só o botão Enviar envia', () => {
    expect(content).not.toMatch(/onKeyDown/);
    expect(content).not.toMatch(/e\.key === 'Enter'/);
    expect(content).not.toMatch(/shiftKey/);
    expect(content).toMatch(/onClick=\{handleSend\}/);
    expect(content).toMatch(/disabled=\{state\.isLoading \|\| !hasContent\}/);
  });

  it('UX6-06 — mobile full-width: max-w-[min(...)] somente com prefixo sm:', () => {
    expect(content).toMatch(/sm:max-w-\[min\(440px,calc\(100vw-32px\)\)\]/);
    expect(content).not.toMatch(/(?<!sm:)max-w-\[min\(440px,calc\(100vw-32px\)\)\]/);
  });

  it('UX6-07 — Parar: botão verde nutri compacto com ■ branco pequeno (touch 44px)', () => {
    const idx = content.indexOf('aria-label="Parar gravação"');
    expect(idx).toBeGreaterThan(-1);
    const stopBtn = content.slice(idx, idx + 500);
    expect(stopBtn).toMatch(/min-w-\[44px\] h-\[44px\]/);
    expect(stopBtn).toMatch(/bg-nutri-800 bg-\[#2A5C43\]/);
    expect(stopBtn).toMatch(/text-white/);
    expect(stopBtn).not.toMatch(/bg-rose/);
  });

  it('UX6-08 — header: 1 linha, dot inline após o nome, sem frases de status', () => {
    expect(content).not.toMatch(/De olho em voc/);
    expect(content).not.toMatch(/Online agora/);
    expect(content).not.toMatch(/Assistente IA da Nutri/);
    expect(content).toMatch(/relative flex h-1\.5 w-1\.5 shrink-0/);
    const nameIdx = content.indexOf('text-emerald-400">Van</span>');
    const dotIdx = content.indexOf('relative flex h-1.5 w-1.5 shrink-0');
    expect(nameIdx).toBeGreaterThan(-1);
    expect(dotIdx).toBeGreaterThan(nameIdx); // dot logo após o nome
  });

  it('UX6-09 — resposta da assistente em largura integral, sem card/borda/raio', () => {
    expect(content).toMatch(/w-full bg-transparent border-0 shadow-none rounded-none px-1 py-2/);
    // Nenhum max-w que limite a resposta a um card estreito
    const assistantMsg = content.slice(content.indexOf('m.role === \'assistant\' ?'), content.indexOf('m.role === \'assistant\' ?') + 900);
    expect(assistantMsg).not.toMatch(/max-w-\[75%\]/);
    expect(assistantMsg).not.toMatch(/border border-stone-200/);
  });

  it('UX6-10 — voz: X esquerda, ■ direita, waveform flexível central, timer M:SS', () => {
    const iCancel = content.indexOf('aria-label="Cancelar gravação"');
    const iStop = content.indexOf('aria-label="Parar gravação"');
    expect(iCancel).toBeGreaterThan(-1);
    expect(iStop).toBeGreaterThan(iCancel);
    const rec = content.slice(iCancel, iStop + 900);
    expect(rec).toMatch(/aria-label="Parar gravação"/);
    expect(rec).toMatch(/flex-1 flex items-center justify-center gap-2 min-w-0/);
    expect(rec).toMatch(/items-end[\s\S]*?gap-\[3px\][\s\S]*?h-4 flex-1 min-w-0 overflow-hidden/);
    expect(rec).toMatch(/WAVEFORM_BAR_HEIGHTS\.map/);
    expect(rec).not.toMatch(/max-w-\[160px\]/);
    expect(rec).not.toMatch(/w-0\.5 h-/);
    expect(rec).toMatch(/tabular-nums/);
    expect(rec).toMatch(/formatElapsedMs\(voice\.recordingElapsedMs\)/);
    // sem textos visíveis de gravação
    expect(rec).not.toMatch(/>Gravando </);
    expect(rec).not.toMatch(/>Cancelar</);
    expect(rec).not.toMatch(/>Parar</);
  });

  it('UX6-11 — instrumentação de crescimento é controlada por env (NEXT_PUBLIC_CHAT_DEBUG) e não loga texto', () => {
    expect(content).toMatch(/NEXT_PUBLIC_CHAT_DEBUG/);
    const diagIdx = content.indexOf('NEXT_PUBLIC_CHAT_DEBUG');
    const diag = content.slice(diagIdx, diagIdx + 6000);
    expect(diag).toMatch(/scrollHeight/);
    expect(diag).toMatch(/clientHeight/);
    expect(diag).toMatch(/visualViewport/);
    expect(diag).toMatch(/innerHeight/);
    expect(diag).not.toMatch(/transcription/);
    expect(diag).not.toMatch(/textPreview/);
  });
});

// =============================================================
// CHAT-UX-007 — Correção cirúrgica do auto-grow (2ª medição + grid rows
// explícitos + sem altura artificial) e expansão horizontal do waveform.
// =============================================================
describe('CHAT-UX-007 — Auto-grow real e waveform flexível', () => {
  it('UX7-01 — grid com linhas explícitas auto (idle 1 linha; editando row do texto + row de ações) — sem linhas implícitas fixas', () => {
    expect(content).toMatch(/gridTemplateRows: isComposerIdle \? 'auto' : 'auto auto'/);
    // Nenhuma altura artificial como solução para o crescimento
    expect(content).not.toMatch(/style\.height = '200px'/);
    expect(content).not.toMatch(/min-h-\[200px\]/);
    expect(content).not.toMatch(/min-h-\[120px\]/);
  });

  it('UX7-02 — auto-grow re-mede após reflow real (requestAnimationFrame) e reage à troca idle↔editando', () => {
    expect(content).toMatch(/requestAnimationFrame\(\(\) => resizeComposer\(\)\)/);
    expect(content).toMatch(/cancelAnimationFrame\(raf\)/);
    expect(content).toMatch(/\}, \[state\.input, isComposerFocused\]\)/);
  });

  it('UX7-03 — instrumentação registra contentClipped e estilo de altura (diagnóstico §25)', () => {
    expect(content).toMatch(/contentClipped: t\.scrollHeight > t\.clientHeight/);
    expect(content).toMatch(/styleHeightPx: t\.style\.height/);
    expect(content).toMatch(/recording: voice\.isRecording/);
    expect(content).toMatch(/selectedImage: !!state\.selectedImage/);
  });

  it('UX7-04 — textarea ocupa a largura disponível e permanece sem borda/outline/ring', () => {
    const pill = getPillRegion();
    expect(pill).toMatch(/\[grid-area:input\] w-full min-w-0 bg-transparent/);
    expect(pill).toMatch(/border-0 focus:border-0 focus:ring-0 focus:outline-none ring-0 outline-none shadow-none/);
    // textarea sem fundo próprio
    const tc = getTextareaClass();
    expect(tc).not.toMatch(/bg-white/);
    expect(tc).not.toMatch(/bg-stone/);
  });

  it('UX7-05 — waveform elástico: barras flex-1 max-w-[3px], sem largura fixa/artificial', () => {
    expect(content).toMatch(/const WAVEFORM_BAR_HEIGHTS = \[/);
    expect(content).toMatch(/flex-1 max-w-\[3px\]/);
    expect(content).toMatch(/flex items-end justify-center gap-\[3px\] h-4 flex-1 min-w-0 overflow-hidden/);
    expect(content).not.toMatch(/max-w-\[160px\]/);
    expect(content).not.toMatch(/width: 320px/);
    expect(content).not.toMatch(/w-0\.5 h-/);
    // X, timer e Parar continuam presentes na mesma linha
    expect(content).toMatch(/aria-label="Cancelar gravação"/);
    expect(content).toMatch(/aria-label="Parar gravação"/);
    expect(content).toMatch(/tabular-nums/);
  });

  it('UX7-06 — auto-grow SEM altura artificial: usa scrollHeight → autoGrowHeight → style.height', () => {
    expect(content).toMatch(/el\.style\.height = 'auto'/);
    expect(content).toMatch(/autoGrowHeight\(el\.scrollHeight, COMPOSER_MAX_HEIGHT\)/);
    expect(content).toMatch(/el\.style\.height = `\$\{heightPx\}px`/);
    expect(content).toMatch(/el\.style\.overflowY = overflowY/);
    expect(content).not.toMatch(/style\.height = '200px'/);
    expect(content).not.toMatch(/min-h-\[200px\]/);
  });
});
