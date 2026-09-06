# CHAT-UX-002 — Fundação UX/UI do ChatAssistant

**Data:** 2026-09-06
**Auditoria base:** `docs/CHAT-UX-001-AUDIT.md`
**Status:** `IMPLEMENTED_NOT_VALIDATED` — aguarda validação Android A–O
**Princípio:** Estabelecer fundação visual coerente para SHELL+HEADER+CONVERSATION+EMPTY+COMPOSER sem quebrar voz/anexo/envio.

---

## 1. Objetivo

Implementar a primeira etapa do redesign (P0 da auditoria), fazendo o ChatAssistant evoluir de “janela de chat genérica” para “assistente nutricional premium integrado”. Foco em hierarquia, consistência, profissionalismo e mobile first, usando `globals.css` como verdade para `nutri` e `amber` controlado, sem reescrever engine de voz, Vosk, backend ou RAG.

## 2. Arquivos Alterados

- `src/components/ChatAssistant.tsx` — única alteração de UI/estrutura (shell, header, conversation, empty, composer, overlay, dvh, fluid width)
- `src/components/__tests__/composerCOMPOSER001.test.ts` — adaptado para CHAT-UX-002: `getPill` flex-col bg-white rounded-3xl, `T-COMP-11` fluido 420-440, `T-COMP-STRUCT` vertical, novos `F-01..F-06` fundação; preservados 17 invariantes T-COMP-1..12
- Nenhum outro arquivo tocado (sem `globals.css`, `tailwind.config`, `layout.tsx`, `voiceController`, `useVoiceInput`, `compressImage`, `backend`, `prompts`)

## 3. Shell

**Antes (`ChatAssistant.tsx:646-648`):** `fixed inset-0 sm:inset-auto sm:bottom-8 sm:right-8 z-50 ... bg-stone-900/20 sm:bg-transparent`, painel `w-full sm:w-[400px] h-[85vh] sm:h-[600px] bg-[#f8f9fa] rounded-t-[2rem] shadow 0.3 border stone-200/50`, handle `bg-stone-900` banda dupla, `z-50` colidindo Header.

**Depois:**
```tsx
// FAB
<div className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-[60]">

// Overlay
<div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-end sm:justify-end sm:p-8 bg-stone-900/30 backdrop-blur-sm"
     onClick={() => setIsOpen(false)}>
  <div className="w-full sm:w-[420px] lg:w-[440px] max-w-[min(440px,calc(100vw-32px))] h-[85dvh] h-[85vh] sm:h-[min(600px,85dvh)] max-h-[800px] bg-white rounded-t-3xl sm:rounded-3xl shadow-premium border border-stone-100 ... animate-slide-in-bottom"
       onClick={(e)=>e.stopPropagation()} role="dialog" aria-modal="true">
    <div className="w-full flex justify-center pt-3 pb-2 sm:hidden bg-white border-b border-stone-100">
      <div className="w-8 h-1 bg-stone-300 rounded-full" />
    </div>
```
- `dvh` + fallback `vh` para teclado dinâmico; `85dvh` não corta com `env(safe-area)` (dock mantém `pb-[max(0.75rem,env(safe-area))]`)
- Fluido `420→440` com `max-w calc(100vw-32px)` valida contra `PatientAppShell` sidebar 256px + `max-w-6xl` + `right-8` gap — 440px em ≥1280px ocupa 34% sem colisão; 768px `calc` garante margem 16px cada lado
- `z-[60]` acima Header `z-50` e WhatsApp `z-50`; scrim `30%` desktop com `backdrop-blur-sm`, dismiss `onClick` + `Esc` via `useEffect keydown Escape` (`ChatAssistant.tsx:581-590`)
- `shadow-premium 0.15` e `border stone-100` do sistema (`globals.css:217`), `rounded-3xl 24px` não 32px, `animate-slide-in-bottom` local (não `tailwindcss-animate` faltante)

## 4. Header

**Antes:** `bg-stone-900 px-5 pt-2 pb-5 sm:py-5` handle banda dupla, avatar `11/12` gradient `stone-700→800 bounce`, badge `emerald-500 9px black`, status `10px`, close `p-2.5`.

**Depois (`ChatAssistant.tsx:664-736`):**
- `bg-nutri-900 bg-[#1A3B2B] px-5 py-4` simétrico (valida `themeColor #1A3B2B` `layout.tsx:22`), sem banda dupla
- Avatar `w-12 h-12 48px` `bg-nutri-800` sólido, `animate-pulse-soft` (não `bounce`), `border white/10`
- Badge Premium `bg-amber-50 text-amber-700 border amber-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wider` controlado (não `emerald-500` dominante); Gratuito `white/10 10px`
- Status `text-[11px]` (não 10px) `stone-300`, dot emerald mantido
- Ações: WhatsApp `bg-white/10 border white/10 hover 15% min-h-[44px]` (ghost, não sólido emerald), Fechar `min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center bg-white/5 hover white/10 rounded-xl`
- `getAvatarAnimation` migrado `bounce → pulse-soft` para premium

## 5. Empty State

**Antes:** `mt-8 space-y-4 px-6 animate-in slide-in-from-bottom-4` hero `w-24 h-24 sm:w-28 sm:h-28 96/112px`, headline `font-black text-lg 18px`, body `stone-500 medium`, chips `hover emerald-50`.

**Depois (`ChatAssistant.tsx:738-778`):**
- Container `flex flex-1 flex-col items-center justify-center px-6 py-8 gap-4 animate-fade-in-up` (não `mt-8`), centralizado com `flex-1`
- Hero `w-20 h-20 sm:w-[88px] sm:h-[88px] 80/88px` `shadow-sm` (menos 16-24px, premium, `globals.css:344`), `drop-shadow-md`
- Headline `font-bold text-[20px] sm:text-[22px] tracking-tight leading-tight stone-900`, body `stone-600 text-sm max-w-[32ch] text-center` `leading-relaxed` (hierarquia +4px vs 18→22)
- Chips `bg-white border stone-200 text-stone-700 hover:border-nutri-200 hover:text-nutri-700 hover:bg-nutri-50 shadow-sm 13px semibold 44px` (não emerald), preservados 3/5 via `quickActions`, `role=group`
- Persistência futura não implementada nesta P0 (chips ainda `messages.length===0` apenas) — documentado como fora de escopo P1

## 6. Conversation

**Antes:** `flex-1 p-4 sm:p-5 space-y-5 bg-[#f8f9fa] scrollbar-hide`, `max-w-[85%]` user `stone-900` assistant `white border stone-200/60 medium`, `space-y-5 20px`, erro `rose-50`, streaming idêntico, loading `1.5px dots`.

**Depois (`ChatAssistant.tsx:738,780-822`):**
- `flex-1 p-4 sm:p-5 space-y-4 bg-white scrollbar-hide role=log aria-live=polite aria-relevant=additions` — `space-y-4 16px` (não 20), `bg-white` unificado painel (white sobre `FAFAFA` page), `log` para leitores
- User `max-w-[75%] bg-nutri-900 bg-[#1A3B2B] text-white rounded-2xl rounded-tr-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)]` (brand, não stone-900 genérico, limite não ocupa largura excessiva)
- Assistant `max-w-[75%] sm:max-w-[65ch] bg-white border border-stone-200 text-stone-700 rounded-2xl rounded-tl-sm` (65ch leitura, borda `stone-200` sem /60 visível sobre white, `shadow 0 1px 2px`)
- Erro `border-amber-200 bg-amber-50 text-amber-900` controlado (amber, não rose genérico)
- Loading `role=status aria-live=polite` dots `w-2 h-2 8px total` (não 1.5px) `stone-600 13px`, streaming `max-w 75%/65ch` mesma borda, sem `items-end` antigo

## 7. Composer

**Princípio:** Container único vertical — textarea full-width + barra ações `border-t`.

**Antes:** `p-3 sm:p-4` DOCK transparente + `flex w-full gap-2 bg-stone-50 p-1.5 rounded-[2rem] border stone-200 items-end` horizontal (anexar|mic|cancel|textarea|enviar), preview `mb-3 64px` flutuante, voz `mt-2` flutuante, enviar `emerald-500`, `min-w 48px`.

**Depois (`ChatAssistant.tsx:825-965`):**
```tsx
<div className="p-3 sm:p-4 shrink-0 pb-[max(0.75rem,env(safe-area))] sm:pb-4">
  <div className="flex flex-col w-full bg-white p-2 rounded-3xl border border-stone-200 shadow-sm focus-within:border-nutri-300 focus-within:ring-4 focus-within:ring-nutri-50 transition-all">
    {selectedImage && <div className="flex items-center gap-3 px-2 pb-2 mb-2 border-b border-stone-100"> 80px preview + Imagem selecionada + 44px remove </div>}
    <textarea className="w-full min-w-0 bg-transparent px-3 py-2.5 text-[15px] min-h-[44px] max-h-[200px] placeholder:text-stone-400 resize-none overflow-y-auto" rows={1} />
    <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-2">
      <div className="flex items-center gap-1">
        <button aria-label="Anexar foto" className="min-w-[44px] h-[44px] w-11 h-11 text-stone-500 hover:text-nutri-700 hover:bg-stone-100 rounded-full"><ImagePlus 18 /></button>
        <input type="file" accept="image/*" capture="environment" className="hidden" />
        <button aria-label="Falar mensagem" className="min-w-[44px] h-[44px] w-11 h-11 rounded-full"><Mic 20 /></button>
        {isRecording && <button aria-label="Cancelar gravação" className="min-w-[44px] h-[44px] w-11 h-11"><X 16 /></button>}
      </div>
      <button aria-label="Enviar mensagem" className="min-w-[44px] h-[44px] w-11 h-11 rounded-full bg-nutri-800 bg-[#2A5C43] hover:bg-[#1A3B2B]"><Send 18 /></button>
    </div>
    {voiceStatus && <div className="mt-2 pt-2 border-t border-stone-100 px-2 text-xs"> Gravando 00:12 ... </div>}
  </div>
</div>
```
- **Largura:** `w-full min-w-0` (sem `flex-1` horizontal), ocupa toda largura pill, `px-3` (não `px-1`), `min-w-0` preserva 320px sem overflow
- **Crescimento:** `rows=1`, `min-h 44px`, `max-h 200px`, `resize-none overflow-y-auto`, `resizeComposer()` mede `scrollHeight` clamp 200, triggers `onChange` + `useEffect [input]` + `resize/orientation/visualViewport` intactos
- **Ações:** não competem horizontalmente; `flex-col` + `border-t pt-2 mt-2` ancora na base; valida 1-4+ linhas até limite com scroll interno
- **Cores:** `bg-white` estável (não `bg-stone-50 → white` jump), `focus-within:border-nutri-300 ring-nutri-50` (não `stone-500/10`), enviar `nutri-800 #2A5C43` (não emerald)
- **Anexo:** preview `80px h-20 w-20` (não 64px) dentro pill `border-b`, remove `44px w-11 h-11` (não 22px visual), texto `Imagem selecionada`, `capture=environment` para iOS camera
- **Voz:** status dentro pill `border-t` (`mt-2 pt-2`), `text-stone-600` (não 500), `rose-600` para gravando, lógica intacta (`micDisabled`, `onTranscript append`, `cancel`, `formatElapsedMs`)

## 8. Mobile

- **320/360/390/430px:** `max-w-[min(440px,calc(100vw-32px))]` garante 16px margem lateral em 320px (320-32=288px usable); textarea `w-full min-w-0` + `space-y-4` não estoura; botões `44px` mantidos; conversa `75%` não 85% melhora leitura 320px (240px max)
- **Teclado:** `h-[85dvh] h-[85vh] sm:h-[min(600px,85dvh)]` + `pb safe-area` já cobre `env(safe-area)`; `visualViewport` listeners preservados (sem debounce nesta P0, especificado para P1)
- **Safe-area:** `pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4` no DOCK + `h-[85dvh]` no painel; handle `bg-white border-b stone-100` não corta gesto
- **Toque:** todos `44px` (`min-w-[44px] h-[44px] w-11 h-11`), preview remove `44px` (não 22px), sem overflow horizontal

## 9. Desktop

- **Largura 420-440px:** `sm:w-[420px] lg:w-[440px] max-w-[min(440px,calc(100vw-32px))] sm:h-[min(600px,85dvh)]` — valida contra `PatientAppShell` sidebar `~256px` + `main flex-1 max-w-6xl mx-auto` — 440px em 1280px não colide (right-8 32px gap); `sm:p-8` overlay `justify-end` alinha bottom-right coerente
- **Sombra/radius:** `rounded-3xl 24px` e `shadow-premium 0.15` (`tailwind.config:84`) vs hard-coded 0.3 anterior; `border stone-100` (não 200/50)
- **Altura/leitura:** `65ch` assistant mejora leitura longa; user `75%` não ocupa largura excessiva; `sm:p-5` preserva

## 10. Acessibilidade

- Touch targets `≥44px` em anexar/mic/cancel/enviar/fechar/remove (todos `44px w-11 h-11`), hero remove ampliado
- `aria-label="Anexar foto"`, `"Parar e transcrever"/"Falar mensagem"`, `"Enviar mensagem"`, `"Fechar chat"`, `"Remover imagem"` preservados
- `role="dialog" aria-modal="true" aria-label="Assistente Nutri Van"` no painel; `role="log" aria-live="polite"` na conversa; `role="status" aria-live="polite"` em voz e loading; `role="group" aria-label="Ações rápidas"`
- Foco visível `focus-within:ring-nutri-50 border-nutri-300` e global `ring-nutri-500` (`globals.css:187`), contraste `stone-600/700` sobre `white` 7:1, `amber-700` sobre `amber-50` 5:1, disabled `stone-400` sobre `stone-200` ainda limite mas melhor que anterior
- Ordem lógica: FAB → overlay (Esc fecha) → header → log → textarea → ações → enviar; `Enter` envia, `Shift+Enter` nova linha, `Esc` fecha
- `aria-hidden` no overlay quando fechado, `stopPropagation` no painel

## 11. Testes

- `npx vitest run` — 31 arquivos, 418 testes verdes (antes 31/412; +6 `F-01..F-06` fundação)
- `composerCOMPOSER001.test.ts` — 29 testes (17 T-COMP +6 STRUCT +6 F) todos verdes; `getPillRegion` suporta `flex-col bg-white rounded-3xl` e legado `flex w-full bg-stone-50 rounded-[2rem]` para migração; `T-COMP-11` agora verifica fluido `420/440` não 400 fixo; `T-COMP-STRUCT-5` verifica `flex-col + border-t` vertical
- Suíte completa sem regressão voz/anexo/envio/streaming

## 12. tsc

```
npx tsc --noEmit
(no output — 0 errors)
```

## 13. build

```
npm run build — Next.js 16.1.6 webpack
✓ Bundling service worker /sw.js
✓ Compiled with warnings in 26.7s (precache 5.79MB aviso pré-existente)
✓ Generating static pages 28/28
Route (app) 28 rotas
```

## 14. Android A–O

**NÃO EXECUTADA — ambiente CI/local sem dispositivo Android.**

Cenários pendentes (mínimos especificados):
- A — abertura (overlay scrim 30% + z-[60] + Esc)
- B — empty (hero 80px, 20px headline, chips nutri hover)
- C — Composer vazio (pill white rounded-3xl, textarea w-full)
- D — 1 linha (44px, ações border-t)
- E — 2–4 linhas (cresce 70→120, sem compressão horizontal)
- F — texto longo / 200px / scroll (overflow-y-auto interno, barra fixa)
- G — apagar (recalcular reduz)
- H — voz (Mic 20px, Square rose, Loader2 busy, cancel visível)
- I — transcrição (append prev + trim, sem truncar 500)
- J — anexo (preview 80px dentro pill, capture camera, remove 44px)
- K — envio (nutri-800 habilitado, disabled stone-200, Enter/Shift+Enter)
- L — teclado aberto (dvh, safe-area, visualViewport)
- M — fechamento (click scrim, Esc, X 44px)
- N — múltiplas mensagens (75%/65ch, space-y-4, log)
- O — resposta longa (65ch leitura, border stone-200, shadow 1px)

Critérios: 1) hierarquia premium visível 2) header leve 3) empty equilibrado 4) leitura confortável 5) composer único vertical 6) textarea full-width 7) sem compressão horizontal 8) crescimento natural 9) scroll limite 10-12) voz/anexo/envio intactos 13) teclado não destrói 14) sem overflow 15) desktop 420-440 sem colisão sidebar 16) touch 44px.

## 15. Regressões

- Nenhuma regressão em 418 testes
- `resizeComposer` / `COMPOSER_MAX_HEIGHT 200` / `scrollHeight` / `visualViewport` / `useVoiceInput` / `voiceController` / `compressImage 800 0.7` / `sanitizeInput 500` / `streaming NDJSON t:chunk/done` / `cleanHistory 6` preservados
- Preview reposicionado de `mb-3` flutuante para `border-b` dentro pill — teste `T-COMP-8` verifica `Preview do anexo` ainda presente, mas posição mudou (intencional fundação)
- Enviar cor `emerald-500 → nutri-800` — teste `F-06` valida novo token, mas lógica `disabled !hasContent` intacta

## 16. Fora de Escopo / Descobertas

- Chips persistentes após primeira mensagem (`overflow-x-auto` barra) — não implementado, fica para P1 (auditoria E-03)
- `visualViewport` debounce 100ms / `throttle` — especificado mas não implementado (COMP-05)
- `max-h 200px` re-medição real device (COMP-06)
- VU waveform `analyser` + countdown 60s `RECORDING_LIMIT_MS` (V-05)
- Validação `file.size/type` + spinner `compressImage` (A-01) — apenas `capture` adicionado
- `isSupported` banner inline (V-03) — não implementado
- Streaming `stop` AbortController (L-01/P1-04) — não implementado
- `focus ring-nutri` migração completa (ACC-01) — parcial (composer sim, restante stone)
- `PatientAppShell` não alterado conforme regra (desktop validado via `calc` sem mudar shell global)

## 17. Screenshots/Evidências

Nenhuma evidência visual coletada (validação Android pendente). Recomenda capturar A–O em Android Chrome (320/390/430) e desktop 1280px com sidebar.

## 18. Status

**IMPLEMENTED_NOT_VALIDATED**

Fundação implementada (shell dvh fluido 420-440, header nutri/amber, conversation 75%/65ch, empty 80px/20px, composer vertical w-full + border-t) com testes/tsc/build verdes. Validação visual Android A–O pendente — não fazer commit/push/deploy até aprovação explícita em dispositivo real. Após validação explícita: `VALIDATED` → commit/push/deploy.
