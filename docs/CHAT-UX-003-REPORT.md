# CHAT-UX-003 — Refinamento do Composer e UX de Voz

**Data:** 2026-09-06 (refinamento 2)
**Base:** `CHAT-UX-002 IMPLEMENTED_NOT_VALIDATED` + validação visual Realme
**Auditoria:** `docs/CHAT-UX-001-AUDIT.md`, `docs/CHAT-UX-002-REPORT.md`
**Status:** `IMPLEMENTED_NOT_VALIDATED` — aguarda validação Android A–AB

---

## 1. Problemas Encontrados (validação visual)

- **Estado ocioso ocupando espaço demais:** Pill `p-3` com `min-h 52px` + `border-t` fazia composer parecer grande mesmo vazio, com linha divisória entre textarea e ações percebida como "campo + barra".
- **Crescimento limitado a ~2 linhas:** `conversation` sem `min-h-0` não encolhia, `flex` constraint impedia textarea de atingir 200px (investigação: `min-h-0` ausente, `leading-relaxed` + `py-2.5` + `p-2`).
- **Voz poluída:** Durante gravação mostrava `🔴 Gravando 00:18` + `Cancelar` + `Parar` como textos, ícone mic gigante, instrução longa, status + timer + spinner simultâneos.
- **Anexo restrito:** `capture="environment"` limitava à câmera, sem galeria/arquivo.
- **Header/drag/sugestões** já corrigidos em CHAT-UX-003 (1), mas validação pediu confirmação de single surface e foco expansível.

## 2. Solução

### Composer — Estado Ocioso Compacto
- **Idle:** `min-h-[72px] justify-center` no pill (`ChatAssistant.tsx:881`), textarea `py-3 text-center placeholder:text-center` (`:958`), ocupando mínimo espaço:
```
┌──────────────────────┐
│     Digite...        │ // centralizado verticalmente, sem caixa própria
│  📷  🎙        ➤    │
└──────────────────────┘
```
- **Placeholder** dentro do próprio Composer, sem caixa/border/background/shadow própria — `bg-transparent` + `placeholder:text-stone-400` com `text-center` apenas quando `!isFocused && !hasContent`.

### Expansão no Foco
- Novo estado `isComposerFocused` (`useState(false)`, `onFocus`/`onBlur` no textarea `:952-953`), pill `min-h-[140px]` quando `isComposerFocused || hasContent` (`:881`), senão `min-h-[72px]`:
```
ANTES:  ┌ Digite... ┐  (72px)  → Tocou: ┌ Digite... (140px, espaçoso) ┐
```
- Texto mantém expansão: `hasContent` (`state.input.trim() || selectedImage`) preserva `140px` mesmo sem foco, não apaga texto ao perder foco.

### Textarea — Largura Total e Sem Border
- `w-full min-w-0 bg-transparent px-1 py-3 text-[15px] leading-[1.6] min-h-[44px] max-h-[200px] resize-none overflow-y-auto` (`:958`)
- **Removido `border-t`** entre textarea e ações: ações agora `flex items-center justify-between pt-3 mt-3 relative` sem `border-t` (`:962,981`), separação por `pt-3 mt-3` espaçamento, não linha — cérebro percebe um único objeto `┌ texto...  📷 🎙 ➤ ┐`.
- Estrutura `CONTAINER ÚNICO ├── área texto (w-full) └── área ações (flex)` sem segunda caixa.

### Crescimento Vertical Investigado
- **Causa real:** `flex-1 p-4` sem `min-h-0` em `flex flex-col` impedia shrink; `p-2` pequeno + `leading-relaxed` + `py-2.5` limitava; `border-t` criava percepção de 2 blocos.
- **Correção:** `conversation` → `flex-1 min-h-0 p-4` (`:738`), pill `p-3` (não 2) + `min-h-0` + `leading-[1.6]` + `py-3`, `resizeComposer` mede `scrollHeight` clamp 200, `min-h-0` permite pill crescer até 200px e scroll interno após limite, ações permanecem visíveis.
- Suporta 1–5+ linhas até 200px, depois `overflow-y:auto` com `■` e `📷 🎙 ➤` visíveis.

### Botões
- `ImagePlus 18`, `Mic 20`, `Send 18` dentro mesmo container, `min-w 44px h-44px w-11 h-11`, enviar `bg-nutri-800 #2A5C43` primário, secundárias `stone-500 hover nutri-700`.

### Imagem/Anexos
- Menu `showAttachMenu` com `Tirar foto` (`cameraInputRef` `capture="environment"`), `Escolher da galeria` (`fileInputRef` `accept="image/*"` sem capture), `Arquivo` (`fileGenericRef` `accept="*/*"`) — 3 opções, sem assumir suporte, preserva `compressImage`.
- Preview `80px` dentro pill `border-b` compatível.

### UX Voz — Novo Padrão Compacto
- **Antes:** `🔴 Gravando 00:18` + `Cancelar` + `Parar` textos + mic gigante
- **Depois:** `×  ● waveform timer  ■` single line `w-full flex items-center justify-between py-2 px-1 gap-2` (`:907-930`):
```
┌──────────────────────────────────┐
│ ×   ● ▂▅▇▅▃▂▆▇▃▅▂  00:18   ■    │
└──────────────────────────────────┘
```
  - `×` `aria-label="Cancelar gravação"` 44px `stone-500 hover rose`
  - `●` `w-2 h-2 bg-rose-500 rounded-full animate-pulse` 6-8px indicador (não botão)
  - Waveform 7 barras `w-0.5 h-2/3/4 bg-rose-400/500 animate-pulse` com `animationDelay 0-900ms`, `max-w 120px`, discreta, indica captura ativa (sem VU real, animação baseada no estado)
  - Timer `00:18` `text-sm font-mono tabular-nums stone-700`
  - `■` `aria-label="Parar gravação"` `w-11 h-11 bg-rose-600 Square 14` à direita (substitui enviar)
- Durante voz, **oculta** `anexo`, `mic normal`, `enviar` — apenas `× + ● + waveform + timer + ■` (reduz carga cognitiva), sem `Gravando`, `Cancelar`, `Parar` textuais, sem mic ícone ao lado waveform.
- Estados `IDLE` (composer normal), `GRAVANDO` (waveform), `PROCESSANDO`/`TRANSCRIBINDO` (compacto `Processando...` abaixo), `RESULTADO` (texto no composer), `ERRO` (rose) — sem múltiplas mensagens redundantes.

### Header/Sugestões/Drag — Preservados
- Header `w-10 h-10 40px`, `px-4 py-3`, `9px Premium amber`, `10px white/60` secundário — já limpo, não adicionado.
- Sugestões exatamente 3 (`Evolução`, `Priorizar hoje`, `Analisar refeição`) — já corrigido.
- Drag `panelRef` `isDragging/dragY/startYRef` `handleTouchStart/Move/End` com `threshold 100`, `translateY`, `touch-none` no handle, isolado no ChatAssistant, desktop sem drag.

## 3. Arquivos Alterados

- `src/components/ChatAssistant.tsx` — composer ocioso/foco (`isComposerFocused`, `min-h 72/140`, `text-center`, sem `border-t`), voz waveform (`× ● waveform timer ■`), `Camera/FileText` imports
- `src/components/__tests__/composerCOMPOSER001.test.ts` — novos `COMPOSER-UX-01..10`, `VOICE-UX-01..07`, `ATTACH`, `DRAG` (24 testes), adaptado para `p-3`, `min-h-0`, `isComposerFocused`, sem `border-t`
- `src/lib/voice/__tests__/voiceUXVOZ0122.test.ts` — atualizado `GRAVANDO` para waveform sem "Gravando" texto

## 4. Composer — Detalhe Técnico

- **Idle compacto:** `min-h-[72px] justify-center` + `py-3 text-center placeholder:text-center` — placeholder dentro, sem caixa própria.
- **Focus expande:** `onFocus` → `min-h-[140px]` com `py-3` textarea `leading 1.6`, oferece área confortável mesmo vazio.
- **Blur vazio retorna:** `!isComposerFocused && !hasContent` → `72px` compacto; com conteúdo permanece `140px`.
- **Crescimento:** `resizeComposer` `scrollHeight` clamp 200, `min-h 44` → 200, `overflow-y auto` após limite, `flex-1 min-h-0` conversa permite crescimento até 5+ linhas.
- **Single surface:** pill `p-3 rounded-3xl border stone-200 shadow-sm` único, `flex flex-col`, textarea `w-full` acima, ações `pt-3 mt-3` abaixo sem `border-t` — espaçamento, não linha.

## 5. Voz — Detalhe

- `×` cancela (`voice.cancel`), `●` pulsante `animate-pulse`, waveform 7 barras `w-0.5 h-2/3/4 bg-rose-400/500 animate-pulse` com delays, `timer` `formatElapsedMs`, `■` para (`voice.stop`) — todos `44px`, sem textos.

## 6. Testes

- `npx vitest run` — 31 arquivos, 449 testes verdes (antes 425; +24 COMPOSER/VOICE/ATTACH/DRAG)
- Novos: `COMPOSER-UX-01` compacto, `02` placeholder, `03` focus, `04` blur, `05` conteúdo, `06` >2 linhas, `07` 200px, `08` scroll, `09` sem border-t, `10` ações dentro, `VOICE-UX-01..07`, `ATTACH-UX-01..04`, `DRAG-UX-01..03`
- `composerCOMPOSER001.test.ts` 60 testes (antes 36) — verifica `isComposerFocused`, `min-h-[140px]`, `text-center`, `border-t` ausência, `× ● waveform timer ■`

## 7. tsc / build

- `npx tsc --noEmit` — 0 erros
- `npm run build` — Next.js 16.1.6, `✓ Compiled with warnings 23.5s`, 28 rotas, `✓ Generating static pages 28/28`

## 8. Android A–AB

**NÃO EXECUTADA** — sem dispositivo Realme. Pendentes:
- A Empty, B 3 sugestões, C compacto, D placeholder centralizado, E toque/focus, F expandido, G 1 linha, H 2 linhas, I 3 linhas, J 4 linhas, K 5 linhas, L >200px/scroll, M apagar/reduzir, N enviar, O adicionar, P foto, Q galeria, R arquivo, S iniciar voz, T waveform, U timer, V cancelar, W parar, X transcrição, Y drag baixo, Z drag insuficiente, AA teclado, AB fechar

Critério: ocioso compacto, placeholder dentro sem caixa, sem linha divisória, focus expande, textarea 5 linhas até 200px, scroll funciona, `× ● waveform timer ■` sem textos, anexo 3 opções, header simples, 3 sugestões, drag move painel apenas.

## 9. Regressões

- Nenhuma (449 testes). `Vosk/voiceController/useVoiceInput` lógica intacta, `compressImage`, `MAX_LENGTH 500`, `Enter/Shift+Enter`, `streaming NDJSON`, `hasContent` preservados.

## 10. Fora de Escopo

- Smart Suggestions 10-12 com rotação contextual — registrado como evolução futura
- VU meter real (volume) — waveform animada baseada no estado, não volume real
- Redesign restante app, backend, novo motor voz

## 11. Status

**IMPLEMENTED_NOT_VALIDATED** — não fazer commit/push/deploy até validação Android A–AB. Após validação: `VALIDATED` → commit/push/deploy.

---

*Princípio: REMOVER COMPLEXIDADE — ocioso compacto, foco expande, texto ocupa espaço, ações integradas, voz waveform + ponto + timer + mínimos, anexo multimodal, drag move ChatAssistant, header simples, 3 sugestões.*
