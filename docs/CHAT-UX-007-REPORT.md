# CHAT-UX-007 — Correção Definitiva do Auto-Grow e Expansão do Waveform

**Sprint:** CHAT-UX-007 — IMPLEMENTATION (cirúrgica)
**Base:** CHAT-UX-006 (`IMPLEMENTED_NOT_VALIDATED`).
**Status:** `IMPLEMENTED_NOT_VALIDATED` — validação física Android (Realme, §22 A–W) **NÃO EXECUTADA neste ambiente** (sem dispositivo). Não é declarado `VALIDATED`; nenhum commit/push/deploy (§27).

---

## 1. Diagnóstico (obrigatório, antes da alteração)

Inspeção estática da cadeia completa `Panel → Conversation → Dock → Pill → Grid → textarea` no código atual:

- **Panel**: `flex flex-col overflow-hidden h-[85vh] h-[85dvh]` — sem `max-height` do Composer; conversa `flex-1 min-h-0 overflow-y-auto` (pode encolher).
- **Dock**: `shrink-0` + padding/safe-area — sem `max-height`/`overflow`.
- **Pill**: `flex flex-col … p-2 … min-h-0` — sem `height`/`max-height` fixa.
- **Grid**: `grid … gap-y-1.5` com linhas **implícitas** (sem `grid-template-rows`) → `auto`; célula `input` na linha do texto.
- **textarea**: `min-h-[44px] max-h-[200px] overflow-y-auto`, altura inline = `min(scrollHeight, 200)` via JS.

**Conclusão do diagnóstico estático:** **não há cap estrutural de ~2 linhas no DOM/CSS atual** — nenhum ancestral limita a altura do textarea abaixo de `max-h-[200px]`, e `scrollHeight` continuaria crescendo. Portanto, a divergência observada no Realme não é explicável por uma regra CSS presente; permanecem como hipóteses (a confirmar no dispositivo com os logs `[CHAT_DEBUG]`):

1. **H1 — teclado sobre o painel `fixed`** (viewport sem `interactive-widget=resizes-content`): no cenário "digitando com teclado aberto", a porção visível do textarea acima do teclado comporta ~2 linhas; o restante cresce atrás do teclado. Distinguível por: teclado aberto = não cresce visualmente; teclado fechado = cresce.
2. **H2 — bundle/SW antigo no Realme** (precache stale documentado nas sprints VOZ-008.x): o dispositivo pode estar executando o layout pré-CHAT-UX-006/007.
3. **H3 — 1º keystroke com `scrollHeight` desatualizado** no Chrome Android (fonte/layout ainda em progresso) — **mitigado nesta sprint** pela 2ª medição no próximo frame (§2).

Não foi aplicada correção especulativa de teclado (`interactive-widget`) — exige o diagnóstico A–W no Realme (teclado aberto × fechado).

## 2. Correção aplicada (auto-grow real, sem altura artificial)

1. **Grid com linhas explícitas `auto`**: `gridTemplateRows: isComposerIdle ? 'auto' : 'auto auto'` — linha do texto e linha de ações com altura por conteúdo (nenhuma linha implícita/fixa comprimindo o textarea).
2. **2ª medição pós-reflow**: o efeito de auto-grow agora roda `resizeComposer()` e agenda `requestAnimationFrame(resizeComposer)` (com cleanup), reagindo a `[state.input, isComposerFocused]` — corrige `scrollHeight` desatualizado no 1º keystroke e a troca de largura idle↔editando (re-wrap muda o nº de linhas).
3. **Sem altura artificial**: mantido `height = min(scrollHeight, COMPOSER_MAX_HEIGHT=200)` e `overflow-y auto/hidden`; nenhum `min-height`/`height` fixo novo; pisos `min-h-[68/72/120/140px]` seguem removidos.
4. **Instrumentação de diagnóstico ampliada** (`NEXT_PUBLIC_CHAT_DEBUG==='1'`, sem conteúdo digitado): agora registra também `styleHeightPx`, `contentClipped` (`scrollHeight > clientHeight`), `recording`, `selectedImage`, além de `scrollHeight/clientHeight/offsetHeight/rect` (textarea/composer/conversation/panel) e viewport (`innerHeight`, `documentElement.clientHeight`, `visualViewport.height/offsetTop`) — exatamente os números exigidos no §25 para identificar o elemento que impediria o crescimento, caso persista.

## 3. Waveform expansivo (sem largura fixa)

- Substituídas as 9 barras fixas (`w-0.5`, container `max-w-[160px]`) por **21 barras geradas** (`WAVEFORM_BAR_HEIGHTS`), cada uma `flex-1 max-w-[3px]` dentro de `flex items-end justify-center gap-[3px] h-4 flex-1 min-w-0 overflow-hidden`.
- Resultado: o waveform **ocupa o espaço central disponível** (dobro ou mais da largura anterior quando há espaço), encolhe em telas estreitas **sem overflow** (`flex-1` + `min-w-0` + `overflow-hidden`), e não empurra `×`, `●`, timer ou `■` (todos `shrink-0`/largura controlada).
- Conceito visual preservado (barras `bg-rose-400/500 animate-pulse`, delays escalonados); timer `M:SS` (`0:00–0:59`) e botão Parar verde inalterados (§11–15).

## 4. Não alterado (preservação)

Idle compacto 1 linha, single surface, header 1 linha, 3 sugestões, anexos, drag, Enter = nova linha (envio só pelo botão), resposta full-width, mobile full-width, voz core (`useVoiceInput`/`voiceController`/Vosk/STT), backend/RAG/prompts/histórico.

## 5. Validação técnica

```text
npx vitest run   → 31 arquivos, 466 testes, TODOS PASSAM (exit 0)
npx tsc --noEmit → 0 erros (exit 0)
npm run build    → sucesso, 28 rotas (exit 0)
```

Arquivos alterados:
- `src/components/ChatAssistant.tsx`
- `src/components/__tests__/composerCOMPOSER001.test.ts` (+ testes UX7-01..06)
- `src/lib/voice/__tests__/textareaVOZ012.test.ts` (deps do efeito atualizadas)

## 6. Validação Realme — pendente (§22 A–W)

Sem dispositivo neste ambiente. Protocolo de validação (com build `NEXT_PUBLIC_CHAT_DEBUG=1`):
- A–L: idle → tocar → 1..6+ linhas (teclado fechado e aberto), limite → scroll interno → apagar → idle.
- M–P: teclado fechado × aberto; comparar `textarea.rect` com `visualViewport.height/offsetTop` (H1).
- Q–W: gravação — waveform ocupando espaço ampliado sem empurrar/overflow; timer/X/Parar visíveis.
- Se o auto-grow falhar de novo: registrar os números `[CHAT_DEBUG]` (§25) e identificar o elemento exato — sem nova sprint cosmética.

## 7. Capturas

Nenhuma (sem dispositivo). Anexar na validação: idle; 3 linhas; 5 linhas; limite; scroll interno; gravação (waveform); waveform ampliado.

---

**CHAT-UX-007**

Status: `IMPLEMENTED_NOT_VALIDATED`
Auto-grow: IMPLEMENTADO (sem cap estático encontrado; 2ª medição pós-reflow + rows `auto` explícitas; sem altura artificial) — validação visual pendente
Causa raiz: não confirmável por inspeção estática — nenhum ancestral limita o textarea abaixo de 200px; hipóteses H1 (teclado sobre painel fixed, sem `interactive-widget`), H2 (bundle/SW antigo no Realme), H3 (scrollHeight do 1º keystroke — mitigado); discriminação exige logs `[CHAT_DEBUG]` no Realme
Correção: grid rows `auto` explícitas; re-medição via `requestAnimationFrame` com deps `[state.input, isComposerFocused]`; instrumentação ampliada (`styleHeightPx`, `contentClipped`, `recording`, `selectedImage`)
Waveform: IMPLEMENTADO — 21 barras `flex-1 max-w-[3px]` (elásticas, sem largura fixa, sem overflow)
Android Realme: NÃO EXECUTADO (sem dispositivo neste ambiente)
Capturas: pendentes (A–W)
Testes: 466/466 (31 arquivos)
TypeScript: PASS
Build: PASS
Commit: NÃO
Push: NÃO
Deploy: NÃO
