# CHAT-UX-003 — Refinamento da UX Mobile e Interações do Chat

**Data:** 2026-09-06
**Base:** `CHAT-UX-002 IMPLEMENTED_NOT_VALIDATED` + validação Android
**Auditoria:** `docs/CHAT-UX-001-AUDIT.md`, `docs/CHAT-UX-002-REPORT.md`
**Status:** `IMPLEMENTED_NOT_VALIDATED` — aguarda validação Android A–V

---

## 1. Objetivo

Refinar o ChatAssistant com foco prioritário em **mobile/Android (Realme)**, corrigindo problemas concretos observados na validação: header poluído, 5 sugestões excessivas, composer percebido como duas caixas com textarea pequeno (~2 linhas), handle movendo conteúdo atrás, anexo restrito à câmera, voz poluindo interface. Não reabrir redesign completo; corrigir especificamente HEADER, SUGESTÕES, COMPOSER, DRAG, ANEXO e VOZ sem alterar Vosk/voiceController/backend/RAG.

## 2. Arquivos Alterados

- `src/components/ChatAssistant.tsx` — 7 áreas:
  - Header: `px-5 py-4 w-12 → px-4 py-3 w-10`, status `11px stone-300 → 10px white/60`, badge `10px → 9px` (`ChatAssistant.tsx:707-735`)
  - Sugestões: `QUICK_ACTIONS_PREMIUM 5 → 3` (`:108-112`)
  - Composer: `p-2 → p-3`, `min-h-0`, `leading-[1.6]`, `conversation min-h-0` (`:738,865,894,910`)
  - Composer ações: vertical single surface `border-t` integrada, touch `44px`, enviar `nutri-800` (`:914-958`)
  - Drag: `panelRef`, `isDragging/dragY/startYRef`, `handleTouchStart/Move/End` (`:596-622,695-705`)
  - Anexo: `showAttachMenu`, `cameraInputRef/fileGenericRef`, menu `Tirar foto/Galeria/Arquivo` (`:510-513,940-996`)
  - Voz: simplificação gravação `X Cancelar` + `■ Parar` + `Gravando` central (`:894-956`)
- `src/components/__tests__/composerCOMPOSER001.test.ts` — adaptado para CHAT-UX-003: `getPillRegion` suporta `p-3` e `p-2`, `T-COMP-1/3` voz flexível, `F-03` header 40px, `F-06` p-3, novos `R-01..R-07` (7 testes) para 3 sugestões, drag, anexo, voz simplificada, crescimento; total 36 testes no arquivo, 425 suíte
- Nenhum outro arquivo (sem `voiceController`, `useVoiceInput`, `compressImage`, `backend`, `globals`, `tailwind`, `layout`)

## 3. Header — Densidade Reduzida

**Antes (CHAT-UX-002):** `bg-nutri-900 px-5 py-4`, avatar `w-12 h-12 48px`, gap `3.5`, título `15px bold`, badge `10px`, status `11px stone-300`, altura ~56px + handle 32px = 88px header total, 6 elementos competindo (avatar, nome, Premium, online, ação WhatsApp, fechar).

**Depois (`ChatAssistant.tsx:707`):**
```tsx
<div className="bg-nutri-900 px-4 py-3 flex justify-between items-center">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-full border border-white/10 bg-nutri-800"> // 40px não 48px
    <h4 className="font-semibold text-[14px]"> // 14px semibold não 15px bold
      Nutri Van <span className="bg-amber-50 text-[9px]">Premium</span> // 9px não 10px
    <span className="text-[10px] text-white/60 tracking-widest font-medium">Online agora</span> // 10px secondary não 11px bold stone-300
```
- `px-4 py-3` (não 5/4), `gap-3` (não 3.5), avatar `40px` (não 48), título `14px semibold` (não 15px bold), badge `9px` (não 10px), status `10px white/60` (não 11px stone-300) torna `Online agora` terciário, dot `1.5px` (não 2px)
- Hierarquia: `[avatar 40] Nutri Van (14px) Premium 9px [WhatsApp ghost 44px] [X 44px]` na mesma linha, status segunda linha `10px` com `white/60` não compete
- Altura reduzida `py-4 32px → py-3 24px` + handle `bg-white border-b` (não `bg-stone-900` banda dupla) = header mais leve e premium

## 4. Sugestões — Exatamente 3

**Antes:** `QUICK_ACTIONS_PREMIUM` 5 itens (`Evolução`, `Priorizar`, `Rever plano`, `Analisar refeição`, `O que mudou`), `FREE` 3 itens — densidade alta, empty com 2 filas + 5 pills, competindo com Composer.

**Depois (`ChatAssistant.tsx:108`):**
```ts
const QUICK_ACTIONS_PREMIUM = [
  'Como está minha evolução?', // 1. evolução
  'O que devo priorizar hoje?', // 2. prioridade do dia
  'Analisar uma refeição',      // 3. análise/revisão nutricional
];
```
- Selecionadas 3 mais úteis/representativas das capacidades existentes (sem criar prompts novos, sem backend): evolução (RAG histórico), prioridade (plano do dia), análise (multimodal foto)
- Compactas, elegantes, secundárias ao Composer: `min-h 44px px-4 rounded-full 13px semibold hover nutri-50` mantidas, mas agora `gap-2 pt-1` com 3 pills = 1 fila em 390px (2 em 320px) não 2 filas
- Teste `R-01` valida exatamente 3 itens e ausência de `Quero rever meu plano`/`O que mudou`

## 5. Composer — Problema Principal (Single Surface + Crescimento)

**Problema validado:** Na captura Android, textarea parecia pequeno (~2 linhas), controles separados, área texto e ações dois blocos distintos. Investigação de `max-height 200px` não explicar visibilidade.

**Causa raiz encontrada:**
- `conversation` sem `min-h-0`: `flex-1 p-4` em `flex flex-col` sem `min-h-0` não encolhia quando composer crescia, limitando altura disponível do textarea (flex constraint)
- Pill `p-2` com `px-3 py-2.5` e `leading-relaxed 1.625` com `min-h 44px` + `border-t mt-2` fazia pill parecer dois blocos (texto 44px + ações 44px + bordas)
- Verificação: `max-h 200px` teoricamente permite 7 linhas `(200-20)/24.375`, mas `flex` constraint impedia crescimento além de ~2 linhas em `85vh` com header 56px + handle 32px

**Correção (`ChatAssistant.tsx:738,865-910`):**
- `conversation` → `flex-1 min-h-0 p-4 sm:p-5 space-y-4 bg-white` (adicionado `min-h-0` para flex shrinking)
- Pill → `flex flex-col w-full bg-white p-3 rounded-3xl border stone-200 shadow-sm focus-within:border-nutri-300 min-h-0` ( `p-2 → p-3` + `min-h-0` para permitir crescimento, `shadow-sm` single surface)
- Textarea → `w-full min-w-0 bg-transparent px-1 py-3 text-[15px] leading-[1.6] min-h-[44px] max-h-[200px]` (`px-3 py-2.5 leading-relaxed → px-1 py-3 leading 1.6` com `p-3` pill, texto ocupa toda largura acima da barra)
- Verifica: textarea agora `w-full` (não `flex-1`), `min-w-0` 320px sem overflow, cresce `scrollHeight` clamp 200, `overflow-y-auto` após limite, barra `flex justify-between pt-3 border-t stone-100 mt-3` integrada (não segunda caixa)
- Estrutura desejada atingida:
```
┌──────────────────────┐
│ Digite sua mensagem… │
│ texto adicional…     │
│ mais texto…          │
│ ──────────────────── │
│ +/📷   🎙      ➤    │
└──────────────────────┘
```
- Teste `R-03` e `R-07` validam `flex-col + min-h-0`, `leading 1.6`, `textarea w-full` antes de `border-t`

## 6. Composer — Ações Integradas

- **Visual:** `TEXTAREA ── border-t ── AÇÕES` (não `imagem|mic|[caixa]|enviar` horizontal). Pill `p-3` + `border-t pt-3 mt-3` une textarea e barra como mesma superfície
- **Touch:** todos `min-w-[44px] h-[44px] w-11 h-11` (`ImagePlus 18`, `Mic 20`, `Send 18`), enviar `bg-nutri-800 #2A5C43` primário destacado, secundárias `stone-500 hover nutri-700 bg-stone-100` (não emerald genérico)
- **Preservado:** `Enter` envia, `Shift+Enter` nova linha (`onKeyDown`), `MAX_LENGTH 500`, `disabled !hasContent`, `hasContent` `trim||image`, `compressImage` intacto

## 7. Gesto de Arrastar / Minimizar (Bottom Sheet)

**Problema:** Handle sugeria drag como bottom sheet, mas gesto movia conteúdo atrás (`document` scroll).

**Correção (`ChatAssistant.tsx:596-622,695-705`):**
- Estado: `panelRef`, `showAttachMenu`, `isDragging`, `dragY`, `startYRef`
- Handlers isolados no `ChatAssistant` (não `document`):
```ts
handleTouchStart: if (window.innerWidth>=640) return; startYRef = e.touches[0].clientY; setIsDragging(true)
handleTouchMove: if (!isDragging||>=640) return; delta = currentY-startY; if(delta>0) setDragY(delta); e.preventDefault()
handleTouchEnd: if(!isDragging) return; threshold 100px; if(dragY>100) setIsOpen(false); setDragY(0)
```
- Aplicado a `panel` e `handle` (`onTouchStart/Move/End`) com `style transform: translateY(dragY) transition: isDragging? none : 0.3s`
- Desktop `>=640` sem drag (painel lateral/overlay), mobile bottom-sheet
- Conteúdo atrás (`fixed inset-0 bg-stone-900/30`) não é movido — apenas `panel` translada
- Botão explícito `X` fechar preservado + `Esc` + `onClick` scrim
- Teste `R-04` valida handlers, `panelRef`, `translateY`, threshold 100, sem `document touchmove`

## 8. Anexo / Imagem

**Problema:** `capture="environment"` restringia à câmera, sem galeria/arquivo.

**Correção (`ChatAssistant.tsx:510-513,958-996`):**
- Inputs: `fileInputRef` `accept="image/*"` (galeria), `cameraInputRef` `accept="image/*" capture="environment"` (câmera), `fileGenericRef` `accept="*/*"` (arquivo)
- UI: botão `ImagePlus` com `aria-haspopup menu` → `setShowAttachMenu(!showAttachMenu)` exibe popover `absolute bottom-full mb-2 left-0 bg-white border stone-200 rounded-2xl shadow-lg p-2 w-56` com:
  - `Tirar foto` → `cameraInputRef.click()` (`Camera 18`)
  - `Escolher da galeria` → `fileInputRef.click()` (`ImagePlus 18`)
  - `Arquivo` → `fileGenericRef.click()` (`FileText 18`)
- `capture` não mais restritivo no input principal; menu respeita capacidades reais do browser/WebView (se plataforma não suportar `capture`, documentado, não finge)
- Preview compatível: `flex items-center gap-3 px-2 pb-3 mb-3 border-b` dentro pill `80px h-20 w-20` + `Imagem selecionada` + `X 44px`, não desconectado
- `compressImage` e `handleImageSelect` preservados, `showAttachMenu` fecha em `setTimeout document click` isolado
- Teste `R-05` valida 3 opções, `role menu`, `accept` variants

## 9. UX do Microfone — Simplificação

**Problema:** Ao tocar mic, muitos elementos (status, cronômetro, instrução longa, spinner, botões) poluíam interface.

**Correção (`ChatAssistant.tsx:894-986`):**
- **Normal:**
```
┌──────────────────────┐
│ mensagem...          │
│ 📷   🎙         ➤   │
└──────────────────────┘
```
- **Gravando (`voice.isRecording`):**
```
┌──────────────────────┐
│ 🔴 Gravando 00:07   │ // textarea substituído por div centralizada min-h 52px
│ X Cancelar   ■ Parar│ // anexo escondido, mic vira Square rose, cancel X, parar rose
└──────────────────────┘
```
- Implementação: `voice.isRecording ? <div>Gravando {formatElapsedMs}</div> : <textarea>`; ações `voice.isRecording ? (Cancelar + Parar) : (anexar menu + mic idle + enviar nutri)`
- Anexo desaparece durante gravação (`showAttachMenu` só em `!isRecording`), mic `bg-rose-600 Square` (`Parar gravação`), cancel `X Cancelar` `border stone-200` 44px claramente disponível, enviar escondido (não compete)
- Informações secundárias removidas: não mostra `Processando/Transcrevendo` durante gravação, apenas `Gravando 00:07`
- Teste `R-06` valida `Gravando {formatElapsedMs}`, `Cancelar gravação`, `Parar gravação`, `Falar mensagem` idle

## 10. Estados da Voz

Mantidos funcionais (`useVoiceInput`, `voiceController`): `IDLE` (Mic stone-500), `PREPARANDO` (Preparando...), `GRAVANDO` (🔴 Gravando 00:07), `PROCESSANDO` (Processando...), `TRANSCRIBINDO` (Transcrevendo...), `RESULTADO` (append `prev+trim`), `ERRO` (rose `userMessage`). Apenas apresentação reorganizada: `!isRecording && (isBusy||error)` mostra `Processando/Transcrevendo/Preparando` + `error` com `aria-live polite` abaixo da barra, não poluindo conversa.

## 11. Mobile First

Validação obrigatória 320/360/390/430 (Realme):
- 320px: `max-w [min(440px,calc(100vw-32px))]` = 288px, textarea `w-full min-w-0` sem overflow, pill `p-3` + `space-y-4` leitura, handle `touch-none`
- Teclado: `h-[85vh] h-[85dvh] sm:h-[min(600px,85dvh)]` + `pb safe-area` + `visualViewport` listeners preservados (sem debounce P1, mas `min-h-0` já corrige crescimento)
- Composer vazio/1/2/3/4/longo `200px scroll` testado via `resizeComposer` clamp, `overflow-y auto` após limite, barra permanece visível

## 12. Testes

- `npx vitest run` — 31 arquivos, 425 testes verdes (antes 418; +7 `R-01..R-07` CHAT-UX-003)
- `composerCOMPOSER001.test.ts` — 36 testes: preservados 17 `T-COMP`, 6 `STRUCT`, 6 `F` (atualizados para `p-3`, `w-10`, `10px`), 7 `R` novos:
  - `R-01` 3 sugestões
  - `R-02` header limpo
  - `R-03` single surface + `min-h-0` + `leading 1.6`
  - `R-04` drag isolado
  - `R-05` anexo menu 3 opções
  - `R-06` voz simplificada
  - `R-07` crescimento 200px + `min-h-0` fix
- Sem regex frágil apenas: `getPillRegion` 12000 slice verifica estrutura real, `QUICK_ACTIONS_PREMIUM.match` verifica array, drag verifica `panelRef` e `translateY` e threshold

## 13. Validação Técnica

- `npx tsc --noEmit` — 0 erros
- `npm run build` — Next.js 16.1.6 webpack, `✓ Compiled with warnings 31.7s` (precache 5.79MB), 28 rotas, `✓ Generating static pages 28/28`
- Imports: `Camera, FileText` adicionados a `lucide-react` (já dependência, sem instalar)

## 14. Validação Android A–V

**NÃO EXECUTADA — ambiente sem dispositivo Realme.** Cenários pendentes:
- A — Empty com 3 sugestões
- B — Header limpo
- C — Composer vazio
- D — 1 linha
- E — 2 linhas
- F — 3 linhas
- G — 4+ linhas
- H — >200px / scroll
- I — apagar / redução
- J — enviar
- K — abrir anexo (menu 3 opções)
- L — foto (camera capture)
- M — arquivo/galeria
- N — iniciar voz
- O — gravando (simplificado)
- P — cancelar voz
- Q — parar voz
- R — transcrição
- S — arrastar painel para baixo (threshold 100)
- T — drag insuficiente / retorno
- U — teclado aberto
- V — fechar (X, scrim, Esc, drag)

Critério visual: textarea não caixa independente, mostra 3-5 linhas antes de 200px, ações integradas `border-t`, sem segunda caixa, scroll funciona, voz simplificada, header leve, 3 sugestões, handle não move atrás.

## 15. Preservação

Não alterados: `Vosk`, `voiceController` (estados, `RECORDING_LIMIT_MS 60s`, `silenceThreshold`), `useVoiceInput` (onTranscript append `prevTrimmed + trim`), `compressImage 800 0.7 canvas`, `MAX_LENGTH 500`, `Enter/Shift+Enter`, `streaming NDJSON t:chunk/done`, `cleanHistory 6`, `RAG/backend/prompts`, `sanitizeInput`, `hasContent`, `getAvatarAnimation` (agora `pulse-soft` mas lógica mood preservada)

## 16. Fora de Escopo / Descobertas

- Chips persistentes após primeira mensagem (ainda `messages.length===0` apenas) — não implementado, ficará para P1 conforme auditoria E-03
- `visualViewport` debounce 100ms / throttle — especificado `CHAT-UX-001 P1-02` mas não implementado, mantido raw listeners (risco baixo)
- `max-h 200px` re-medição real device — mantido 200, mas `leading 1.6` e `p-3` aumentam percepção; medir em Realme se 220-240 seria melhor (não alterado)
- `isSupported` banner inline para HTTPS — não implementado, ainda `title` hover
- VU waveform real — não implementado, apenas timer
- `focus ring-nutri` migração completa — parcial (composer sim, restante stone)
- `btn-premium` amber controlado extra — não implementado

## 17. Screenshots/Evidências

Nenhuma evidência visual coletada (validação Android pendente). Recomenda capturar A–V em Realme Chrome 360/390 com teclado aberto/fechado.

## 18. Status

**IMPLEMENTED_NOT_VALIDATED**

Correções implementadas (header leve, 3 sugestões, composer single surface com `min-h-0` e `leading 1.6` e `p-3`, drag isolado `100px`, anexo menu 3 opções, voz simplificada `Cancelar/Parar`), testes 425 verdes, tsc/build ok. Validação visual Android A–V pendente — não fazer commit/push/deploy até aprovação explícita. Após todos os critérios: `VALIDATED` → commit/push/deploy.
