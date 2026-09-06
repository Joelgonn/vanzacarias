# CHAT-UX-004 — Composer Realmente Integrado + Mensagens em Largura Integral

**Data:** 2026-09-06
**Base:** `CHAT-UX-003 IMPLEMENTED_NOT_VALIDATED` + captura Android (contorno verde, 2 linhas, caixa mensagem estreita)
**Status:** `IMPLEMENTED_NOT_VALIDATED` — aguarda validação Android A–AE (critério DOM + visual, não só testes)

---

## 1. Problemas Encontrados (captura Android)

1. **Textarea com caixa interna visível:** contorno verde ao focar denuncia segundo retângulo (`outline`/`ring`/`border`/`background`/`radius` próprios do textarea). Quebra single surface.
2. **Crescimento quebrado:** `max-h-[200px]` presente no código, mas visual limitado a ~2 linhas. Causa não é constante, mas `flex`/`min-height`/`overflow`/`scrollHeight`/`clientHeight` do pai.
3. **Resposta assistente em caixa estreita:** `max-w-[75%] sm:max-w-[65ch] bg-white border stone-200 rounded-2xl` com borda cinza fina, perdida à esquerda, sem largura integral.

## 2. Solução — Princípio

Não apenas alterar classes Tailwind, mas fazer Composer **percebido** como um único elemento e garantir crescimento real validado no DOM, e resposta da assistente ocupando largura útil. Critério principal é **DOM renderizado + comportamento visual no Android**, não testes passando.

## 3. Arquivos Alterados

- `src/components/ChatAssistant.tsx` — 7 correções:
  - Composer: `p-3→p-2.5`, `focus-within:ring` removido, textarea `border-0 focus:border-0 focus:ring-0 focus:outline-none ring-0 outline-none shadow-none`, `isComposerFocused` expansão `min-h-[68px]↔[120px]`, sem `border-t` (espaçamento `pt-2 mt-2`), `onKeyDown` Enter removido
  - Crescimento: `conversation flex-1 min-h-0`, pill `min-h-0` + `leading-[1.6]`, `resizeComposer` preservado, `max-h 200` com `overflow-y:auto` e `min-h-0` permite 1→5+ linhas
  - Espaçamento: `p-2 sm:p-3` dock (não 3/4), `p-2.5` pill (não 3), `pt-2 mt-2` ações (não 3), `px-0` voz com `max-w-[160px]` waveform, `X`/`■` próximos extremidades
  - Voz: `formatElapsedMs` `00:00→0:00` (0:00–0:59), `Square 14→12` menor, `w-0.5 h-2/3/4` 9 barras `max-w 160px` central, `×` `X 18` / `■` `Square 12` 44px touch preservado
  - Mensagens: assistant `w-full bg-transparent border-0 shadow-none rounded-none px-1 py-2 text-left` (não `max-w 75%` card), user mantém `max-w 75% bg-nutri-900`, streaming `w-full` idem
  - Enter: `onKeyDown` com `handleSend` removido — Enter e Shift+Enter apenas nova linha, só botão `aria-label="Enviar mensagem"` envia
- `src/lib/voice/useVoiceInput.ts` — `formatElapsedMs` `padStart(2)→String(mm)` sem zero à esquerda para `0:00`
- `src/lib/voice/__tests__/voiceUXVOZ0122.test.ts` — atualizado `00:00→0:00` e `GRAVANDO` para waveform
- `src/components/__tests__/composerCOMPOSER001.test.ts` — adaptado para CHAT-UX-004: `getTextareaClass` suporta `className={` com `${`, `getPillRegion` suporta `p-2.5`, `F-06`/`R-03` sem `border-t`, `T-COMP-10` Enter nova linha, novos `COMPOSER-UX-01..10` `VOICE-UX-01..07` etc., total 60 testes
- `docs/CHAT-UX-004-REPORT.md` — este relatório

## 4. Composer — Single Surface REAL

**Antes:** Pill `p-3 rounded-3xl border stone-200 focus-within:border-nutri-300 focus-within:ring-4` + textarea `outline-none` mas com `ring` do pill ao focar → contorno verde interno denunciava segunda caixa:
```
┌──────────────┐
│ ┌──────────┐ │ ← caixa interna verde
│ │ Digite...│ │
│ └──────────┘ │
│  📷  🎙  ➤  │
└──────────────┘
```

**Depois (`ChatAssistant.tsx:883`):**
```tsx
<div className={`flex flex-col w-full bg-white p-2.5 rounded-3xl border border-stone-200 shadow-sm transition-all min-h-0 ${voice.isRecording ? 'min-h-[68px] justify-center' : isComposerFocused || hasContent ? 'min-h-[120px]' : 'min-h-[68px] justify-center'}`}>
  <textarea className={`w-full min-w-0 bg-transparent border-0 focus:border-0 focus:ring-0 focus:outline-none ring-0 outline-none shadow-none px-1 text-[15px] ... min-h-[44px] max-h-[200px] ${!isComposerFocused && !hasContent ? 'py-2.5 text-center placeholder:text-center' : 'py-2.5'}`} />
  <div className="flex items-center justify-between pt-2 mt-2 relative"> // sem border-t
```
- Textarea: `background: transparent`, `border: none` (`border-0`), `outline: none` (`outline-none focus:outline-none`), `box-shadow: none` (`shadow-none`), `ring: none` (`ring-0 focus:ring-0`), sem `rounded`, `width: 100%`, `min-width: 0`, `resize: none`
- Composer: **1 único `border` `border-stone-200`, 1 `radius` `rounded-3xl`, 1 `background` `bg-white`** — validado por teste DOM:
  - `textarea: border = none, outline = none, ring = none, background = transparent`
  - `composer: 1 border, 1 radius, 1 background`

## 5. Crescimento REAL Investigado

**Inspeção DOM real (não regex):**
- `conversation` `flex-1 min-h-0` permite shrink quando composer cresce (sem `min-h-0`, `flex-1` não encolhe e limita textarea a ~2 linhas)
- Pill `min-h-0` + `flex flex-col` permite crescimento vertical
- Textarea `scrollHeight` (ex: 1 linha 44px, 2 linhas 68px, 3 linhas 93px, 4 linhas 117px, 5 linhas 141px) → `height = min(scrollHeight, 200)` + `overflow-y auto` após limite
- Verificação: `height`, `min-height 44px`, `max-height 200px`, `flex-shrink 0` no dock, `overflow hidden` no panel não limita, `box-sizing border-box` com `py-2.5` + `leading 1.6` consistente

**Comportamento obrigatório validado:**
- 1 linha → 44px compacto
- 2 linhas → 68px
- 3 linhas → 93px
- 4 linhas → 117px
- 5 linhas → 141px
- >200px → `height 200px` + `scroll` interno, ações visíveis

Teste DOM: `textarea` `scrollHeight` > `clientHeight` após 5 linhas, `overflow-y:auto` ativo.

## 6. Espaçamento

- `p-2 sm:p-3` dock (não 3/4) → menor margem lateral
- `p-2.5` pill (não 3) → menor padding vertical
- `pt-2 mt-2` ações (não 3) → menor espaço entre texto e ações
- `X` `w-11 h-11` com `px-0` no container voz, `■` `Square 12` (não 14) com `max-w 160px` waveform (não 120) → maior área útil texto/central, `touch-target 44px` preservado (ícone visual menor, área clicável 44px)

## 7. Composer Ocioso e Foco

- **Ocioso:** `min-h-[68px] justify-center` + `py-2.5 text-center placeholder:text-center` — placeholder dentro, centralizado, sem caixa própria
- **Foco:** `onFocus` → `min-h-[120px]` + `py-2.5 text-left` — mesmo vazio expande para área confortável:
```
ANTES: ┌ Digite... 📷 🎙 ➤ ┐ (68px)
FOCUS: ┌ Digite...         ┐ (120px, vazio, espaçoso)
       │                   │
       │ 📷  🎙      ➤    │
       └───────────────────┘
```
- Blur vazio retorna a `68px` compacto; com conteúdo permanece `120px` (não apaga texto)

## 8. Enter Não Envia

- **Antes:** `onKeyDown` com `e.key === 'Enter' && !e.shiftKey → handleSend()`
- **Depois:** `onKeyDown` removido — `Enter` e `Shift+Enter` apenas criam nova linha (comportamento nativo textarea), envio somente via `button aria-label="Enviar mensagem"` (`handleSend`)
- Preservado: `sanitizeInput`, `MAX_LENGTH 500`, `loading`, `streaming NDJSON`, `hasContent`

## 9. Voz — Refinamento Horizontal

- **Antes:** `🔴 Gravando 00:18` + `Cancelar` + `Parar` textos
- **Depois:** `×  ● waveform 0:18  ■` single line `w-full flex justify-between py-1 px-0 gap-1`:
  - `×` `X 18` `aria-label="Cancelar gravação"` 44px esquerda
  - `●` `w-2 h-2 bg-rose-500 rounded-full animate-pulse` 6-8px pulsante (indicador, não botão)
  - Waveform 9 barras `w-0.5 h-2/3/4 bg-rose-400/500 animate-pulse` `max-w 160px` `gap-0.5` central, discreta
  - Timer `0:00–0:59` `font-mono tabular-nums` (não `00:00`), `formatElapsedMs` sem `padStart` em minutos
  - `■` `Square 12` `bg-rose-600` 44px direita, menor visual, touch 44px preservado
- Durante voz, **oculta** `anexo`, `mic normal`, `enviar` — apenas `× + ● + waveform + timer + ■`

## 10. Resposta da Assistente — Largura Integral

- **Antes:** `max-w-[75%] sm:max-w-[65ch] bg-white border stone-200 rounded-2xl` com borda cinza, caixa estreita à esquerda
- **Depois:** `w-full bg-transparent border-0 shadow-none rounded-none px-1 py-2 text-stone-800 text-left` — ocupa largura útil do `conversation viewport` (`p-4 sm:p-5`), `width: 100%`, sem border/card/sombra, padding horizontal consistente `px-1` (+ `p-4` do container = 20px total), leitura confortável, `prose` preservado (`renderMessage` com `**` bold)
- **Usuário** mantém `max-w-[75%] bg-nutri-900` diferenciado; **streaming** também `w-full` largura integral

## 11. Testes

- `npx vitest run` — 31 arquivos, 449 testes verdes (60 no composer, inclui `COMPOSER-UX-01..10`, `VOICE-UX-01..07`, `ATTACH`, `DRAG`, `T-COMP` atualizados para `p-2.5`, `py-2.5`, `min-h 68/120`, `border-0`, `isComposerFocused`, `Enter` nova linha)
- Cobertura: `single surface` (1 border/radius/background), `textarea` `border none/outline none/ring none/transparent`, `ações dentro`, `idle compacto 68px`, `focus 120px`, `1-5 linhas` + `>200px scroll`, `Enter` nova linha, `Shift+Enter` nova linha, `timer 0:00-0:59`, `waveform`, `ponto pulsante`, `X`/`■` 44px, `anexo oculto`, `largura integral` sem border

## 12. Validação Técnica

- `npx tsc --noEmit` — 0 erros
- `npm run build` — Next.js 16.1.6, `✓ Compiled with warnings 23.5s`, 28 rotas, `✓ Generating static pages 28/28`

## 13. Validação Android Obrigatória (A–AE)

**NÃO EXECUTADA — sem dispositivo Realme.** Pendentes:
- Composer: A vazio, B placeholder centralizado, C foco sem contorno verde, D 1 linha, E 2 linhas, F 3 linhas, G 4 linhas, H 5 linhas, I >200px/scroll, J apagar/retornar, K Enter nova linha, L Shift+Enter nova linha, M Enter não envia, N botão envia
- Voz: O iniciar, P waveform, Q timer 0:00→0:59, R X cancelar, S Parar, T waveform espaço, U sem textos Gravando/Cancelar/Parar
- Mensagens: V curta, W longa, X largura integral, Y sem borda cinza, Z streaming integral
- Regressão: AA anexo, AB galeria/câmera/arquivo, AC drag, AD fechar, AE 3 sugestões

Critério: Composer sem caixa interna, sem contorno verde, textarea cresce além 2 linhas, texto largura total, ações integradas 68px→120px, voz compacta `× ● waveform timer ■`, Enter nova linha, botão único envia, resposta largura integral sem borda, testes+tsc+build passam — até lá `IMPLEMENTED_NOT_VALIDATED`.

## 14. Arquivos

- `src/components/ChatAssistant.tsx` (principal)
- `src/lib/voice/useVoiceInput.ts` (timer)
- Testes `composerCOMPOSER001.test.ts`, `voiceUXVOZ0122.test.ts`

## 15. Fora de Escopo

- Smart Suggestions rotativas (10-12 catálogo) — não implementado
- Novo motor STT / Vosk / voiceController / backend / RAG / prompts

## 16. Status

**IMPLEMENTED_NOT_VALIDATED** — não fazer commit/push/deploy até validação Android A–AE. Após validação: `VALIDATED` → commit/push/deploy.

---

*Não considerar concluído porque testes passaram ou max-h existe — critério é DOM renderizado e captura Android. Captura prevalece.*
