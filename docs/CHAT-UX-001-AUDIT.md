# CHAT-UX-001 — Auditoria e Especificação de Redesign do ChatAssistant

**Projeto:** `vanzacariasnutri` — ChatAssistant / Nutri Van
**Tipo:** Auditoria + Design Spec (sem implementação)
**Base:** Código real `src/components/ChatAssistant.tsx:1-952` (HEAD pós-COMPOSER-001.1), `src/app/globals.css:1-457`, `tailwind.config.ts:1-125`, `src/app/layout.tsx:1-157`, docs `COMPOSER-EXTERNAL-AUDIT-REPORT.md`, `COMPOSER-001-REPORT.md`, `COMPOSER-001.1-REPORT.md`, `VOZ-012.5-REPORT.md`
**Data:** 2026-09-06
**Status:** `AUDIT_COMPLETE` — especificação pronta para CHAT-UX-002
**Decisões de produto incorporadas:** Paleta `nutri+amber` controlado (`globals.css` verdade), painel fluido `420-440px`, mobile first `dvh/svh` apenas especificado, classificação `atual/corrigido/parcial/futuro`.

---

## 1. Executive Summary

A experiência do ChatAssistant evoluiu de bug crítico de Composer para correção parcial. **COMPOSER-001.1 corrigiu o problema estrutural mais visível** (DOCK `bg-white border-t shadow` removido em `ChatAssistant.tsx:805`), transformando DOCK em wrapper transparente e PILL em único container visual — validado por 6 testes `T-COMP-STRUCT` que falhavam no código antigo e hoje passam (412 testes verdes).

O ChatAssistant, porém, ainda é percebido como “janela de chat genérica” e não como produto premium de nutrição com IA integrada. Causa raiz auditada:

- **Shell genérico:** `400px/600px` fixos, `rounded-[2rem]` 32px vs `card-premium rounded-3xl` 24px do sistema, `shadow 0.3` vs `shadow-premium 0.15`, `bg-[#f8f9fa]` vs `bg-white` do sistema, `z-50` colidindo com Header, scrim sem `onClick` dismiss.
- **Paleta descolada:** `stone-900/emerald-500` em vez de `nutri-800 #2A5C43 / 900 #1A3B2B` + `amber` Premium do `globals.css:392-457` (`btn-premium`, `btn-gold-effect`). História de voz/composer usou cores neutras por velocidade, perdendo identidade.
- **Hierarquia comprimida:** escala tipográfica 9→10→13→15→18px sem respiro; headline `font-black 18px` vs bubble `15px medium` vs chips `13px semibold` — 5px de amplitude, leitura plana.
- **Voz anexos loading ainda funcionais mas com fricção:** sem VU/countdown, cancel só em `recording`, attachment sem validação/camera, streaming sem caret/stop, `85vh` vs `dvh` + `visualViewport` sem debounce.

**Direção proposta:** Não copiar ChatGPT; usar como benchmark de *qualidade* (container único, crescimento até 200px + scroll, actions na base). Redesign próprio Nutri Van: **profissionalismo via espaçamento/consistência/tipografia, não gradientes**; superfícies `white` sobre `FAFAFA`, `rounded-3xl/2xl`, `shadow-premium`, `ring-nutri`, `amber` só em Premium/destaques; Composer como **superfície multimodal vertical**; voz com feedback previsível; mobile first com `dvh/svh` e `safe-area` já mapeados para futura implementação.

Nenhum código foi alterado nesta sprint — apenas especificação.

## 2. Estado Atual

### Shell / Container (`ChatAssistant.tsx:612-650`)

```
FAB fechado: fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50
  └─ botão 68px/72px rounded-full border-[3px] stone-900 shadow 0_12px_30px
     + dot emerald-500 ring + tooltip stone-900 (hover-only)

Aberto:
  overlay: fixed inset-0 sm:inset-auto sm:bottom-8 sm:right-8 z-50
           bg-stone-900/20 backdrop-blur-sm (mobile) / transparent (desktop)
           flex items-end justify-center pointer-events-none → pointer-events-auto no painel
           // sem onClick dismiss
  painel: w-full 85vh sm:w-[400px] sm:h-[600px] max-h-[800px]
          bg-[#f8f9fa] rounded-t-[2rem] sm:rounded-[2rem] border stone-200/50
          shadow 0_-10px_40px 0.1 (mobile) / 0_20px_60px 0.3 (desktop)
  handle mobile: w-full pt-3 pb-2 sm:hidden bg-stone-900 + pill 12x1.5 stone-700
  header: bg-stone-900 px-5 pt-2 pb-5 sm:py-5 shadow-sm
  conversa: flex-1 p-4 sm:p-5 overflow-y-auto space-y-5 scrollbar-hide
  composer dock: p-3 sm:p-4 shrink-0 pb-[max(0.75rem,env(safe-area))] // pós-001.1 transparente
    pill: flex w-full gap-2 bg-stone-50 p-1.5 rounded-[2rem] border stone-200 focus-within:bg-white items-end
```

**Problemas estruturais validados vs sistema:** `globals.css:217` `card-premium bg-white rounded-3xl border stone-100 shadow-sm → shadow-premium 0 20px 60px -15px 0.15` não é usado; painel usa hex `#f8f9fa` vs layout `bg-[#FAFAFA]` vs `body bg-stone-50` — três brancos diferentes visíveis na borda. `tailwind.config.ts:84` `shadow-premium 0.15` vs hard-coded `0.3` (2× mais escuro, menos refinado). `border stone-200/50` quase invisível sobre `#f8f9fa`.

### Header (`ChatAssistant.tsx:654-716`)
`stone-900`, avatar `11/12` com `border white/10 gradient stone-700→800` vs FAB `border 3px stone-900 gradient stone-50→200` — tratamentos inconsistentes; título `15px bold` + status `10px w-[2]` + badge `9px black uppercase` (`Premium emerald-500` vs `Gratuito white/10`) — 9-10px sub-AA, gradiente `emerald` genérico, WhatsApp `emerald` duplicado.

### Empty State (`ChatAssistant.tsx:718-758`)
Hero `24/28` rounded-full `border-4 white shadow 0_8px_30px 0.08 gradient stone-100→200` + `getAvatarAnimation() bounce/pulse 3s` duplicado no header; headline `18px black tracking-tight` + body `14px medium stone-500`; quick-actions `44px pill white border stone-200 13px semibold hover emerald-50` — 3 free vs 5 premium, somem após primeira mensagem.

### Conversação (`ChatAssistant.tsx:760-802`, `renderMessage:138-163`)
`max-w 85% px-4 py-3 15px leading-relaxed shadow-sm rounded-2xl rounded-tr/tl-sm` — user `stone-900 white` vs assistant `white border stone-200/60 stone-700`; `break-words`; erro `rose-50/60`; streaming `renderMessage(streamingText)` idêntico a estático; loading `1.5px dots bounce 0/150/300ms + 13px Pensando/Consultando`.

### Composer (`ChatAssistant.tsx:805-944`)
Pós-001.1: DOCK transparente, PILL único `bg-stone-50 → focus white` `items-end`, textarea `bg-transparent 44px→200px overflow-y-auto`, anexar/mic/cancel/enviar `44/48px`, status voz `mt-2 text-xs`. `resizeComposer:554-578` mede `scrollHeight` clamp 200, dispara `onChange` + `useEffect [input]` + `resize/orientation/visualViewport` sem debounce.

### Voz/Anexos/Loading
Voz `useVoiceInput:522-538` → `voiceController.ts: states idle/loading/ready/recording/processing/transcribing/error`, `micDisabled = isLoading || busy&&!recording`; anexo `compressImage 800px 0.7` sem validação, preview `64px`; loading `dots vs streamingText ? streaming : isLoading` mutually exclusive, sem `aria-live` nem stop.

## 3. Problemas Encontrados

Classificação: **CORRIGIDO** = resolvido por COMPOSER-001.1; **PARCIAL** = estrutura corrigida mas detalhe remanescente; **ATUAL** = presente no código pós-001.1; **FUTURO** = melhoria não-bug.

| # | Área | Problema | Severidade | Classificação | Evidência |
|---|------|----------|------------|---------------|-----------|
| S-01 | Shell | Painel `400px/600px` fixo, sem fluidez 420-440px, sem `max-w` tablet | ALTO | ATUAL | `ChatAssistant.tsx:648` vs `PatientAppShell` sidebar ~256px + `max-w-6xl` |
| S-02 | Shell | `rounded-[2rem] 32px` vs sistema `rounded-3xl 24px` | MÉDIO | ATUAL | `:648,828` vs `globals.css:218` |
| S-03 | Shell | Shadow `0.3` hard-coded vs `shadow-premium 0.15` | MÉDIO | ATUAL | `:648` vs `tailwind.config:84` |
| S-04 | Shell | `bg-[#f8f9fa]` vs `FAFAFA` vs `stone-50` — seam visível | MÉDIO | ATUAL | `:648` + `layout.tsx:120` |
| S-05 | Shell | `border stone-200/50` imperceptível | BAIXO | ATUAL | `:648` |
| S-06 | Shell | `z-50` colide Header/WhatsApp, sem `z-[60]` | ALTO | ATUAL | `:613,646` vs `Header.tsx:202` |
| S-07 | Shell | Overlay sem `onClick` dismiss, `pointer-events-none` | ALTO | ATUAL | `:646` |
| S-08 | Shell | `h-[85vh]` não `dvh/svh`, teclado sobrepõe | CRÍTICO | ATUAL | `:648` + `layout viewport maximumScale:1` |
| S-09 | Shell | `animate-in slide-in-from-bottom-8 zoom-in-95` sem plugin | MÉDIO | ATUAL | `:648` vs `tailwind.config:124 plugins:[]` |
| H-01 | Header | Handle `bg-stone-900` duplicado sobre header `stone-900` — banda dupla | MÉDIO | ATUAL | `:650-652` |
| H-02 | Header | Avatar FAB vs Header tratamentos divergentes | BAIXO | ATUAL | `:621 vs 656` |
| H-03 | Header | Tipografia `9/10px` badges invisível, `emerald` genérico | MÉDIO | ATUAL | `:669,684` |
| E-01 | Empty | Hero `96/112px` + dupla animação `bounce/pulse` — lúdico vs premium | MÉDIO | ATUAL | `:722,602` |
| E-02 | Empty | Headline `18px black` vs bubble `15px medium` — hierarquia plana 3px | MÉDIO | ATUAL | `:732 vs 762` |
| E-03 | Empty | Quick-actions somem após 1ª msg, sem recolocação | ALTO | ATUAL | `:742` `messages.length===0` |
| E-04 | Empty | Premium sem teaser (só badge header) | MÉDIO | ATUAL | `:668` |
| C-01 | Conv | `max-w 85%` largo em desktop 340px → 45ch, pouca personalização | BAIXO | ATUAL | `:762` |
| C-02 | Conv | `border stone-200/60` assistant quase invisível sobre `#f8f9fa` | MÉDIO | ATUAL | `:765` |
| C-03 | Conv | Streaming flash (streamingText → messages mesma estilização) sem caret | MÉDIO | ATUAL | `:783-789` |
| C-04 | Conv | Sem timestamps/separadores — blur temporal | BAIXO | FUTURO | `:760` |
| C-05 | Conv | `space-y-5 20px` + `p-4` densidade alta, vagas vs empty `mt-8` | BAIXO | ATUAL | `:718` |
| COMP-01 | Composer | **Duas caixas `bg-white border-t shadow` + `bg-stone-50`** | CRÍTICO | **CORRIGIDO 001.1** | `COMPOSER-EXTERNAL-AUDIT-REPORT:14` → `:805` agora transparente |
| COMP-02 | Composer | `bg-stone-50 → focus white` jump, baixo contraste vs `#f8f9fa` | ALTO | **PARCIAL** | `:828` audit recomenda `bg-white` estável |
| COMP-03 | Composer | Preview `bg-white rounded-xl` + status `mt-2` flutuando fora PILL | MÉDIO | PARCIAL | `:807,919` |
| COMP-04 | Composer | `resizeComposer` duplo trigger `onChange` + `[input]` sem debounce | MÉDIO | ATUAL | `:554,563,884` |
| COMP-05 | Composer | `visualViewport` sem throttle (10-20× por abertura teclado) | MÉDIO | ATUAL | `:572` |
| COMP-06 | Composer | `max-h 200px` legado VOZ-012 não re-medido, sem `scroll-padding` | MÉDIO | PARCIAL | `:96,897` |
| COMP-07 | Composer | `items-end` invisível em 1 linha (paridade com `center`) | BAIXO | PARCIAL | `EXTERNAL:40` |
| V-01 | Voz | Sem waveform/VU, só `Gravando 00:12` mesmo com silêncio 90% | ALTO | ATUAL | `:919-929` vs `voiceController: silenceThreshold 0.01` só debug |
| V-02 | Voz | Cancel só `isRecording`, bloqueado em `processing/transcribing` | CRÍTICO | ATUAL | `:869` vs `controller:532 cancel()` |
| V-03 | Voz | `isSupported` só `title` hover, sem banner inline | MÉDIO | ATUAL | `:852` |
| V-04 | Voz | Ícone busy único `Loader2` p/ `loading/processing/transcribing` | MÉDIO | ATUAL | `:865` |
| V-05 | Voz | Sem countdown 60s `RECORDING_LIMIT_MS` | MÉDIO | ATUAL | `controller:47,580` |
| V-06 | Voz | Append sem undo, `maxLength 500` pode truncar | MÉDIO | ATUAL | `:528,894` |
| A-01 | Anexo | Sem validação `size/type`, sem spinner `compressImage` | ALTO | ATUAL | `:116,180` |
| A-02 | Anexo | Sem `capture` camera, só galeria | MÉDIO | ATUAL | `:841` |
| A-03 | Anexo | Preview `64px` pequeno, remove `-top-2 -right-2` 22px vs `44px` | MÉDIO | ATUAL | `:810,819` |
| L-01 | Loading | `streamingText ? stream : isLoading` flicker, dots escondidos | MÉDIO | ATUAL | `:783` |
| L-02 | Loading | Sem `aria-live` em loading/stream, só voz tem `polite` | MÉDIO | ATUAL | `:790 vs 920` |
| L-03 | Loading | `bg-stone-200 text-stone-400` disabled baixo contraste | MÉDIO | ATUAL | `:905` |
| R-01 | Erro | Retry só `patient`, admin sem `isError` | MÉDIO | ATUAL | `:596,407` |
| ACC-01 | A11y | `focus:ring stone-500/10` vs global `ring-nutri-500` | MÉDIO | ATUAL | `:828` vs `globals.css:187` |
| DESKTOP-01 | Desktop | `w-[400px]` sem validação shell, não fluido 420-440px | ALTO | ATUAL | `:648` |

## 4. Evidências

- **DOCK corrigido:** `ChatAssistant.tsx:805` `p-3 sm:p-4 shrink-0 relative z-10 pb-[max(0.75rem,env(safe-area))] sm:pb-4` — sem `bg-white/border-t/shadow` (antes `p-3 sm:p-4 bg-white border-t border-stone-100 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]`).
- **PILL única:** `:828` `flex w-full gap-2 bg-stone-50 p-1.5 rounded-[2rem] border stone-200 focus-within:border-stone-400 focus-within:ring-4 focus-within:ring-stone-500/10 focus-within:bg-white items-end` — 6 testes `T-COMP-STRUCT` cobrem ausência `bg-white+border-t+shadow` no DOCK e `rounded-[2rem]` único.
- **Shell sem dismiss:** `:646` `fixed inset-0 ... pointer-events-none` + painel `pointer-events-auto` — sem `onClick={() => setIsOpen(false)}` (Header drawer tem).
- **Altura vh:** `:648` `h-[85vh]` vs `layout.tsx:122 min-h-[100dvh]` — não usa `dvh`.
- **Tipografia comprimida:** `:666 15px`, `:684 10px`, `:669 9px`, `:732 18px`, `:762 15px`, `:750 13px`.
- **Voz estados:** `voiceController.ts:47 RECORDING_LIMIT_MS 60000`, `:532 cancel`, `useVoiceInput.ts:53 tick 250ms`, `ChatAssistant.tsx:540 micDisabled`, `:869 cancel only if recording`.
- **Anexo:** `:116 compressImage MAX_WIDTH 800 canvas 0.7`, `:841 accept image/*` sem capture, `:810 64px`.

## 5. Benchmark

**ChatGPT (referência de qualidade, não de cópia):** container único `border+bg+radius+shadow+padding`, textarea transparente full-width, barra ações `border-t` interna ancorada `items-end`, `max-h` + scroll interno, caret streaming, `stop` durante geração, chips como follow-ups persistentes. Padrão aproveitado: *vertical Composer* (texto em cima, ações embaixo) e *container único estável* — por que: reduz “caixa dentro de caixa”, libera largura `min-w-0` em 320px, ações sempre na base em multilinha.

**Intercom/Zendesk (premium):** `card-premium`-like (`rounded-3xl 24px`, `shadow-premium 0.15`, `border stone-100`), header escuro com avatar + status *sem* badge colorido dominante, avatares só no header/empty, não por bubble. Aproveitar: `shadow-premium` e `rounded-3xl` já definidos em `globals.css:217-223`.

**Padrões mobile multimodal:** WhatsApp/Telegram — `capture` camera, preview `96px` com nome/tamanho, `dvh` + `interactive-widget=resizes-content`, `safe-area`. Aproveitar: `pb-[max(0.75rem,env(safe-area))]` já em `:805`, estender para `dvh`.

**O que NÃO copiar:** glassmorphism gratuito, gradientes `stone-50→200` em excesso, `emerald-500` genérico, `animate-bounce` lúdico.

## 6. Princípios do Novo UX

1. **Premium = hierarquia, espaçamento, consistência, tipografia, comportamento** — não sombras/glass. Superfícies `white` sobre `FAFAFA` com `border stone-100` sutil, `shadow-premium` controlado, `amber` só Premium.
2. **Simplicidade:** um único container Composer estável `bg-white`, sem jump `focus white`; DOCK transparente estrutural; preview/status ancorados visualmente, não flutuantes.
3. **Confiança:** voz com VU/countdown/cancel sempre; anexo com preview legível e validação; loading com `aria-live` e `stop`.
4. **Mobile first:** `dvh/svh`, `visualViewport` debounced, `44px` touch, `env(safe-area)` já mapeado.
5. **Identidade Nutri:** `Plus Jakarta Sans 300-800` (`layout.tsx:11`), `nutri-800/900`, `selection bg-nutri-200` (`globals.css:198`), `focus ring-nutri-500` (`:187`).

## 7. Arquitetura Proposta

```
Viewport (100dvh, overscroll-y-none)
└─ FAB fixed bottom-5 right-5 → 8 (z-[60])
   └─ Overlay fixed inset-0 z-[60] bg-stone-900/30 backdrop-blur-sm
      (mobile: inset-0; desktop: inset-auto bottom-8 right-8 + scrim 30% com onClick dismiss)
      └─ Panel card-premium
         w-full sm:w-[420px] lg:w-[440px] max-w-[min(440px,calc(100vw-32px))]
         h-[85dvh] sm:h-[min(600px,85dvh)] max-h-[800px]
         bg-white rounded-3xl (mobile: rounded-t-3xl) shadow-premium border stone-100
         flex flex-col overflow-hidden
         ├─ Handle (mobile only) bg-white border-b stone-100, pill stone-300 32×4
         ├─ Header bg-stone-900 px-5 py-4 shadow-sm (avatar 48px nutri, título 15px, status 11px, badge amber controlado, fechar 44px)
         ├─ Conversation flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar role=log aria-live=polite
         │  ├─ Empty State (centrado, mt-0, hero 80px, headline 20px, body 14px, chips 44px)
         │  └─ Messages (user stone-900, assistant white border stone-200 75% max, prose 65ch)
         └─ Composer Dock shrink-0 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area))] bg-transparent
            └─ Pill bg-white p-2 rounded-3xl border stone-200 shadow-sm flex flex-col
               ├─ Textarea flex-1 min-w-0 bg-transparent 15px min-h 44px max-h 200px resize-none
               ├─ Preview 96px dentro pill border-t stone-100 (quando há imagem)
               ├─ Status voz dentro pill border-t (quando ativo)
               └─ Barra ações flex items-center justify-between pt-2 border-t stone-100 (anexar 44px, mic 44px, cancel 44px, enviar 48px nutri)
```

Validação desktop: `PatientAppShell` sidebar ~256px + `main flex-1 max-w-6xl mx-auto px-4 lg:px-8` → `right-8` + `440px` não colide com sidebar em `≥1280px` (sidebar+content+gap ~320px livres à direita); em `768-1024px` (sem sidebar visível) `calc(100vw-32px)` garante margem.

## 8. Wireframes Textuais

**Empty / Primeira abertura (mobile 390px)**
```
┌─────────────────────────────┐
│ ▁▁▁  (handle stone-300)     │
│ Nutri Van  ● Online  [Premium amber]  ✕ │
├─────────────────────────────┤
│                             │
│        ○ avatar 80px        │
│        Olá! 20px black      │
│   Assistente virtual 14px   │
│   [Como está evolução?]     │
│   [Melhorar alimentação]    │
│   [Registrar refeição]      │
│                             │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Digite sua dúvida...    │ │
│ │ +  🎙               ➤  │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Composer vazio / 1 linha / multilinha / limite**
```
vazio:     │ Digite sua dúvida... │  (min-h 44px, pill white, ações na base invisível mas ígual)
1 linha:   │ Olá Nutri │  (mesmo, placeholder some)
multilinha:│ linha1                │
           │ linha2                │
           │ +  🎙            ➤  │  (items-end, barra border-t)
limite 200px:│ linha1 ... (scroll) │
             │ +  🎙          ➤  │  (scroll interno, barra fixa)
```

**Gravando voz / Processando / Transcrevendo**
```
┌─────────────────────────┐
│ texto ...               │
│ +  ■ 44px roxo  ✕        │  // barra: mic roxo bg-rose-600 + cancel 44px
│ ── Gravando 00:12 — toque para parar  (VU ▁▂▃) │
└─────────────────────────┘
Processando:  [Loader2] Processando... + cancel visível
Transcrevendo: [Loader2] Transcrevendo... + cancel
```

**Anexo selecionado**
```
┌─────────────────────────┐
│ [96px preview rounded-lg]  ✕ 14px→44px hit │
│ ─────────────────────── │
│ texto ...               │
│ +  🎙               ➤  │
└─────────────────────────┘
```

**IA respondendo / Streaming / Erro / Teclado aberto**
```
IA: ●●● Pensando... (dots 8px + aria-live, sem flicker)
Streaming: Olá! Como posso...▊ (caret, stop ⏹ ao lado enviar)
Erro: bubble rose-50 + ⚠ + [Tentar novamente 44px]
Teclado: painel h-dvh, composer pb safe-area, viewport debounced
```

## 9. Header Redesign

**Atual:** `ChatAssistant.tsx:654` `bg-stone-900 px-5 pt-2 pb-5 sm:py-5` com Avatar `11/12` gradient `stone-700→800` + badge `9px emerald/white/10` + WhatsApp `emerald`.

**Proposta implementável (só UI/CSS):**
- Remover `handle bg-stone-900` → handle `bg-white` + pill `w-8 h-1 stone-300` `pt-3 pb-2 border-b stone-100` para continuidade `rounded-t-3xl`.
- Header `px-5 py-4` simétrico (sem `pt-2`), `bg-nutri-900 #1A3B2B` (brand) em vez de `stone-900`, ou manter `stone-900` se contraste melhor — validar vs `themeColor #1A3B2B` (`layout.tsx:22`).
- Avatar `48px` `border-2 white/10` `bg-nutri-800` sólido (sem gradient `stone`), animação `pulse-soft` 2s em vez de `bounce`.
- Título `15px bold tracking-tight stone-50`, status `11px semibold stone-300` (não 10px) + dot `emerald-500`.
- Badge Premium `px-2.5 py-1 text-[10px] font-bold tracking-wider bg-amber-50 text-amber-700 border amber-100` (controlado, não `emerald-500` dominante); Gratuito `white/10 stone-300` mantido mas `10px`.
- Ações: WhatsApp `btn-ghost 44px rounded-xl border stone-700 text-stone-300 hover nutri` (não `emerald-500` sólido), Fechar `44px rounded-xl bg-white/5 hover white/10`.
- Risco: só CSS, zero lógica, usa `globals.css:186 focus ring-nutri`.

## 10. Empty State Redesign

**Atual:** `mt-8` hero `96/112` animado, headline `18px black` + body `14px`, chips `13px` somem.

**Proposta:**
- Container `flex-1 flex flex-col items-center justify-center text-center px-6 py-8 gap-4` (não `mt-8`), hero `80px sm:88px` `border-4 white shadow-sm` (menos 16px, mais premium), animação `animate-pulse-soft` ou estática.
- Headline `20px sm:22px font-bold tracking-tight stone-900`, body `14px leading-relaxed stone-600 max-w-[32ch] text-center`.
- Chips `min-h 44px px-4 rounded-full 13px semibold` migrar de `bg-white border stone-200 hover emerald` → `bg-white border stone-200 hover:bg-nutri-50 hover:border-nutri-200 hover:text-nutri-700` + Premium chips com `amber` dot 6px + `text-amber-700` hover controlado.
- **Persistência:** após primeira msg, chips não somem — movem para barra horizontal scroll `flex gap-2 overflow-x-auto scrollbar-hide snap-x` abaixo Composer (ou acima Composer dentro Pill `pt-2 border-t`), com título `Sugestões`.
- Admin vs patient: admin mantém copy 28 palavras mas com bullets `•` 13px.

## 11. Message Redesign

**Atual:** `max-w 85% rounded-2xl rounded-tr/tl-sm 15px medium`.

**Proposta:**
- `max-w-[75%] sm:max-w-[65ch]` (65ch leitura premium), `px-4 py-3 15px leading-relaxed`.
- User `bg-nutri-900 text-white rounded-2xl rounded-tr-sm shadow-sm` (brand, não stone-900 genérico), Assistant `bg-white border stone-200 text-stone-700 rounded-2xl rounded-tl-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]` (borda `stone-200` sem /60, visível sobre `white` painel).
- Tipografia: Assistant `font-normal 15px` com `strong font-semibold stone-900` (não `medium` uniforme), `prose-stone` para listas/links (`renderMessage` já faz `**` → `strong`).
- Espaçamento: `space-y-4` (não 5), separador temporal `text-[11px] stone-400` “Hoje” quando intervalo >1h.
- Erro: `border-amber-200 bg-amber-50` (controlado) + ícone `AlertCircle 16px` + retry `44px` integrado à bubble `mt-2`.
- Acessibilidade: `role=log aria-live=polite aria-relevant=additions`.

## 12. Composer Redesign

**Princípio auditado:** Superfície multimodal vertical, único container estável.

**Atual parcialmente corrigido:** DOCK transparente + PILL `bg-stone-50 → white` jump.

**Proposta (estrutural leve, só CSS):**
```tsx
// Dock: manter transparente pós-001.1
<div className="p-3 sm:p-4 shrink-0 pb-[max(0.75rem,env(safe-area))] sm:pb-4">
// Pill: único container estável
<div className="flex flex-col w-full bg-white p-2 rounded-3xl border border-stone-200 shadow-sm focus-within:border-nutri-300 focus-within:ring-4 focus-within:ring-nutri-50 transition-all">
// Preview/status DENTRO pill (não flutuante)
{selectedImage && <div className="px-2 pb-2 border-b border-stone-100"> 96px preview </div>}
{voiceStatus && <div className="px-3 py-2 border-b border-stone-100 text-xs"> Gravando... </div>}
// Textarea full-width
<textarea className="w-full min-h-[44px] max-h-[200px] bg-transparent px-3 py-2.5 text-[15px] placeholder:text-stone-400 resize-none overflow-y-auto focus:outline-none leading-relaxed" />
// Barra ações bottom
<div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-1">
  <div className="flex gap-1">
    <button className="w-9 h-9 sm:min-w-[44px] sm:h-[44px] rounded-full text-stone-500 hover:bg-stone-100">Anexar</button>
    <button className="w-9 h-9 sm:min-w-[44px] sm:h-[44px] rounded-full">Mic</button>
    {isRecording && <button className="w-9 h-9">✕ Cancel</button>}
  </div>
  <button className="min-w-[44px] h-[44px] rounded-full bg-nutri-800 text-white disabled:bg-stone-200">Enviar</button>
</div>
```

**Comportamento concreto:**
- Crescimento: `resizeComposer` mede `scrollHeight` clamp `200` → altura `min 44 → 200`, acima `overflow-y-auto` + `scroll-padding 8px`.
- Ações sempre na base via `flex-col` + `border-t` (não depende de `items-end` invisível em 1 linha).
- Largura: `w-full min-w-0` sem overflow 320px (já `min-w-0` pós-001).
- Estados vazio/digitando: placeholder `Digite sua dúvida...` `15px stone-400`, foco `ring-nutri` não `stone`.
- Touch: todos `44px` (anexar `ml-0` não `ml-1` para hit edge).

**Já corrigido vs parcial:** DOCK transparente = corrigido; `bg-stone-50→white` jump e preview fora = parcial → proposta corrige com `bg-white` estável.

## 13. Voice UX

**Estados:** `idle` (Mic stone-500), `loading` (Preparando), `recording` (Square rose-600 + timer), `processing` (Processando), `transcribing` (Transcrevendo), `error` (rose).

**Proposta:**
- `idle`: `Mic 22px stone-500 hover nutri-700 bg-stone-100` 44px.
- `recording`: `Square fill white bg-rose-600` + timer `tabular-nums` + VU `▁▂▃▅` (usar `analyser` já em `debug.ts: silenceThreshold` exposição controlada), texto `Gravando 00:12 — toque ■ para parar` 12px `rose-600`.
- `processing/transcribing/loading`: `Loader2 20px spin` + texto `Processando…` `stone-600` + **cancel visível** (`✕ Cancelar` 44px `rose-600` não só em `recording`) — `ChatAssistant.tsx:869` expandir para `if (isBusy || error)`.
- `error`: `AlertCircle 16px rose-600` + msg `text-xs rose-700` + `[Tentar novamente]` 44px.
- `isSupported false`: banner inline `text-xs amber-700 bg-amber-50 border amber-100 rounded-xl p-3` com link ajuda HTTPS, não só `title`.
- `60s limit`: countdown `00:50` amarelo + `vibrate` opcional, `controller:580` msg já existe.

## 14. Attachment UX

**Atual:** `ImagePlus 22px`, hidden `input file`, `64px` preview.

**Proposta:**
- Botão `Anexar foto` `44px` `ImagePlus 18px` `stone-500 hover nutri`, `accept image/* capture=environment` para camera iOS, `multiple false` (manter 1), validação `file.size >10MB → toast rose`, `type not image/* → amber`.
- Compressão: spinner `Loader2` sobre botão durante `compressImage` (FileReader+canvas), `MAX_WIDTH 800` mantido.
- Preview: `96px w-24 h-24 rounded-lg object-cover border stone-200` + metadata `nome 12px trunc + tamanho KB` abaixo, remove `44px` `bg-stone-800 hover rose` com `X 16px`.
- Integração: preview dentro Pill `border-b`, não flutuante DOCK; `hasContent` `image||text` mantém enviar `nutri-800` habilitado; `setSelectedImage(null)` só em success, em erro mantém preview + `retryCandidate`.

## 15. Loading/Streaming UX

**Atual:** `isLoading` dots `1.5px bounce` + `Pensando` 13px vs `streamingText` mesma bolha.

**Proposta:**
- Loading `Pensando…` com `role=status aria-live=polite` `bg-white border stone-200 rounded-2xl` + dots `2px bg-stone-400` (não 1.5) + `shimmer` opcional `globals.css:124`.
- Streaming: bolha `white border` + texto progressivo + **caret** `▊ animate-pulse` + botão `⏹ Parar` 32px ao lado `Enviar` (aborta `fetch` via `AbortController` — única lógica nova, opcional P1).
- Transição: em `done`, `streamingText` → `messages` sem flash (manter mesma DOM, só `isStreaming=false`).
- Admin vs patient: `Consultando dados…` vs `Pensando…` mantido, mas `13px semibold stone-600`.

## 16. Error UX

**Atual:** assistant `isError rose-50/60` + `Tentar novamente` só patient.

**Proposta:**
- Bolha erro `bg-amber-50 border amber-200 text-amber-900` (controlado) + ícone `AlertTriangle 16px amber-600` + `aria-live=assertive`.
- Ações: paciente `Tentar novamente 44px rose-600` (mantém) + `Copiar mensagem`; admin `Tentar novamente` também (unificar `useChatAdmin` para set `isError`).
- Voz erro: banner `rose-50` + `Tentar gravar novamente` + link `HTTPS` se `isSupported false`.
- Anexo erro: toast `sonner` `top-center` já em `layout.tsx:140` com `bg white/95 blur` — usar.

## 17. Mobile UX

**Prioridade 1ª classe.**
- **Dimensões:** `w-full h-[85dvh] max-h-[800px]` (não `vh`), `rounded-t-3xl` 24px, `safe-area` já em `:805` estender para `pb-[max(0.75rem,env(safe-area))]` no painel.
- **Teclado:** `visualViewport` debounced 100ms (não raw `:572`), `resize/orientationchange` throttled, medir `window.visualViewport.height` vs `window.innerHeight` para `85dvh` ajuste; `overscroll-y-none` (`layout.tsx:123`) mantido para evitar scroll chaining.
- **Toque:** todos `44px`, `scrollbar-hide` para conversa, mas manter `custom-scrollbar 6px` opcional desktop.
- **Viewport:** `maximumScale:1 userScalable:false` (`layout.tsx:25`) evita zoom input 15px (já `15px` evita iOS zoom 16px threshold — manter 15px ou subir para 16px).

## 18. Desktop UX

**Direção 420-440px fluido.**
- Painel `sm:w-[420px] lg:w-[440px] max-w-[min(440px,calc(100vw-32px))] sm:h-[min(600px,85dvh)]` — valida contra `PatientAppShell` sidebar `~256px` + `NavigationWrapper` `max-w-6xl mx-auto` + `sm:bottom-8 sm:right-8` gap 32px. Em `1280px` viewport, `440px` ocupa 34% sem colidir sidebar; em `768px` `calc` garante margem.
- Scrim desktop: `sm:bg-stone-900/20 sm:backdrop-blur-sm` (não `transparent`) com `onClick` dismiss + `Esc` — foco trap (adicionar com `focus-trap` leve, sem deps pesadas).
- Sombra: `shadow-premium 0.15` (não 0.3) para leveza premium; `border stone-100` (não 200/50).
- Posicionamento: `justify-end` não `justify-center` para `inset-auto`.

## 19. Accessibility

- **Alvos:** `44×44` mínimo já em todos botões (`ChatAssistant.tsx:832,858,872,904`); preview remove ampliar para `44px` hit (não 22px visual).
- **Contraste:** texto `stone-700` sobre `white` 4.5:1 ok; `stone-400` placeholder 3:1 limite — manter; `emerald` → `nutri-700` para 7:1; `amber-700` sobre `amber-50` 5:1.
- **Labels:** `aria-label Anexar/Mic/Enviar` ok; adicionar `aria-label Fechar`, `aria-label Preview anexo`.
- **Foco:** global `*:focus-visible ring-nutri-500 ring-offset-white` (`globals.css:187`) vs Composer `ring-stone-500/10` → migrar para `ring-nutri-50`.
- **Leitores:** `role=log aria-live=polite` em conversa, `role=status aria-live=polite` em voz/loading, `role=group aria-label=Ações rápidas`.
- **Teclado:** `Enter` envia, `Shift+Enter` nova linha (`ChatAssistant.tsx:889` já), `Esc` fecha painel.
- **Movimento:** respeitar `prefers-reduced-motion` — desabilitar `bounce/pulse` avatar.

## 20. Microinteractions

- **Abertura:** `animate-slide-in-bottom 0.4s cubic premium` (usar `globals.css:344` não `tailwindcss-animate` faltante), `fade-in 0.3s` overlay.
- **Envio:** `active:scale-[0.97]` já em `btn-primary:231`, aplicar a Enviar `active:scale-95`.
- **Expansão Composer:** `transition-all 200ms premium` altura (já `* transition-colors 200ms` global, ajustar para `height`).
- **Voz:** pulse `pulse-soft 2s` (não `ping` infinito), `Square` morph.
- **Anexo:** `fade-in slide-in-bottom-2` preview 300ms.
- **Loading:** `shimmer 1.5s` opcional.
- Evitar: `bounce` avatar contínuo, gradientes animados.

## 21. Design System

**Fonte verdade:** `globals.css` + `tailwind.config.ts` — não inventar identidade.

- **Cores superfície:** `white` (painel/pill/bubble assistant), `stone-50 #fafaf9` (fallback body), `#FAFAFA` (wrapper) → unificar para `white` painel sobre `FAFAFA` page; `stone-100 #f5f5f4` bordas.
- **Primária:** `nutri-800 #2A5C43` (botão enviar, links), `nutri-900 #1A3B2B` (header, user bubble), `nutri-700 #3a573a` hover, `nutri-50 #f4f6f4` ring/bg hover, `nutri-500 #5f875f` focus.
- **Texto:** `stone-900 #1c1917` headings, `stone-700 #44403c` body, `stone-500 #78716c` secundário, `stone-400 #a8a29e` placeholder.
- **Estados:** `emerald-500` legado → `nutri-600`; `rose-600 #dc2626` erro voz, `amber` só Premium (abaixo); `stone-200 #e7e5e4` bordas, `stone-300` handle.
- **Premium/amber controlado:** `amber-50 #fffbeb` bg, `amber-100 #fef3c7` border, `amber-500 #f59e0b` ícones, `amber-600/700` texto/border hover, usado em badge `Premium 10px bold` + hover chips Premium + ring `amber-400/50` só em `btn-premium` (`globals.css:410`). Não dominante.
- **Radius:** `3xl 24px` painel/pill, `2xl 16px` bubbles, `xl 12px` botões, `full 999` FAB/pills.
- **Sombra:** `premium 0 20px 60px -15px 0.15` painel, `sm 0 1px 2px 0.05` bubbles, `md` hover.
- **Tipografia:** `Plus Jakarta Sans 300-800` (`layout.tsx:11`), `15px` input/bubble, `14px` body empty, `13px` chips, `11px` status, `10px` badges — escalar headline para `20px`.
- **Espaçamento:** `4/8/12/16/20/24` sistema 4px; `p-4/5` conversa, `p-3/4` dock, `p-2` pill, `gap-2` chips, `space-y-4` mensagens.
- **Touch:** `44×44` mínimo, `48×48` enviar.
- **Ícones:** `lucide-react 16-22px stroke 2.5`.
- **Animações:** `premium cubic 0.22,1,0.36,1`, `400ms` abertura, `200ms` cores.

## 22. Estados Completos

| # | Estado | Header | Conversa | Composer | Voz | Anexo |
|---|--------|--------|----------|----------|-----|-------|
| 1 | Empty primeira abertura | Online + Premium amber 10px | Hero 80px + 20px + 3/5 chips | vazio `Digite...` 44px | idle Mic stone | — |
| 2 | Composer vazio | — | — | placeholder 15px | idle | — |
| 3 | 1 linha | — | — | 44px pill white | idle | — |
| 4 | Multilinha 2-4 | — | — | cresce 70→120px, barra border-t | idle | — |
| 5 | Limite 200px | — | scroll conversa | `overflow-y-auto` scroll interno, barra fixa | idle | — |
| 6 | Enviando | — | bubble user stone-900 | disabled `stone-200`, `Loader2` | — | — |
| 7 | IA respondendo | — | dots `Pensando` aria-live | disabled | — | — |
| 8 | Resposta completa | — | bubble white 65ch | habilitado | — | — |
| 9 | Gravando | — | — | pill rose-600 Square + timer | VU + `00:12` rose | — |
| 10 | Processando | — | — | Loader2 + `Processando` + cancel | processing | — |
| 11 | Transcrevendo | — | — | Loader2 + `Transcrevendo` + cancel | transcribing | — |
| 12 | Transcrição inserida | — | — | texto append `prev + trim`, foco | result | — |
| 13 | Anexo selecionado | — | — | preview 96px dentro pill border-b | idle | 800px 0.7 |
| 14 | Erro envio | — | rose/amber bubble + retry | habilitado | — | retry mantém imagem |
| 15 | Teclado mobile | Handle white | `dvh` ajustado | `pb safe-area` + `visualViewport` debounced | — | — |

Cada estado com wireframe §8 + props `hasContent`, `isLoading`, `isBusy`, `error`, `selectedImage`.

## 23. Priorização P0 / P1 / P2

**P0 — Essencial (fazer primeiro, risco baixo, só UI/CSS exceto cancel):**
- P0-01 Composer `bg-white` estável + preview/status dentro pill `border-t` (corrige parcial COMP-02/03) — **UI/CSS** — `ChatAssistant.tsx:828,807,919`
- P0-02 Shell `z-[60]` + scrim dismiss `onClick+Esc` (corrige S-06/07) — **UI/CSS** 1 linha
- P0-03 Voz cancel em `processing/transcribing/loading` (corrige V-02) — **estado** `if (isBusy||error)` — risco médio (exige expor `cancel` já existente `controller:532`)
- P0-04 Anexo validação `size/type` + spinner + `capture` (corrige A-01/02) — **UI/CSS** (validação JS leve)
- P0-05 Tipografia badges `9→10px`, status `10→11px`, erro `aria-live` (corrige H-03/L-02) — **UI/CSS**
- P0-06 Contraste disabled `stone-200→stone-300` (corrige L-03) — **UI/CSS**

**P1 — Importante (após P0):**
- P1-01 Desktop fluido `420-440px max 440px + calc` (corrige S-01/DESKTOP-01) — **UI/CSS**, validar `PatientAppShell`
- P1-02 `dvh/svh` + `visualViewport` debounce 100ms (corrige S-08/COMP-05) — **UI/CSS + throttle**, só spec agora
- P1-03 Empty hero `96→80px` + headline `18→20px` + chips persistentes `overflow-x-auto` (corrige E-01/02/03) — **UI/CSS**
- P1-04 Streaming caret + stop (corrige C-03/L-01) — **UI/CSS + AbortController** (lógica leve)
- P1-05 Sombra `0.3→0.15 premium` + `rounded 32→24` (corrige S-02/03) — **UI/CSS** usa `globals.css`
- P1-06 Voz `isSupported` banner + countdown 60s (corrige V-03/05) — **UI/CSS**
- P1-07 Mensagens `85%→75%/65ch` + `stone-200` sem /60 (corrige C-01/02) — **UI/CSS**

**P2 — Melhoria futura:**
- P2-01 VU waveform real (expor `analyser` de `debug.ts` controle), `pulse-soft` avatar (corrige V-01/H-02)
- P2-02 Timestamps/separadores, `smooth` scroll + “voltar ao fim” (C-04/L-03)
- P2-03 `btn-premium` amber controlado em upsell chips (E-04)
- P2-04 `focus ring-nutri` migração completa (ACC-01)
- P2-05 `animate-in` substituir por `animate-slide-in-bottom` local (S-09)

**NÃO fazer agora:** troca global `interactive-widget`, modelo Vosk, backend RAG, nova dependência `tailwindcss-animate`.

## 24. Impacto Técnico

| Recomendação | UI/CSS | Estrutural | Estado | Lógica | Backend | Risco regressão |
|--------------|--------|------------|--------|--------|---------|-----------------|
| PILL `bg-white` estável | ✓ | — | — | — | — | Baixo (só cor, teste `T-COMP-STRUCT-2` atualiza bg) |
| Preview dentro pill | ✓ flex-col | ✓ move div | — | — | — | Baixo (snapshot) |
| `z-[60]` + dismiss | ✓ | — | ✓ `setIsOpen` | — | — | Baixo |
| Voz cancel estendido | — | — | ✓ `isBusy` | ✓ `controller.cancel` já existe | — | Médio (expor botão) |
| Anexo `capture`+validação | ✓ | — | — | ✓ `file.size` | — | Baixo |
| `dvh` + debounce | ✓ | — | — | ✓ throttle 100ms | — | Médio (testar Android) |
| Chips persistentes | ✓ | ✓ `messages.length` | ✓ map | — | — | Médio (layout) |
| Streaming stop | — | — | ✓ `AbortController` | ✓ fetch abort | — | Médio |
| Desktop 420-440px | ✓ | — | — | — | — | Baixo |
| Sombra/radius | ✓ | — | — | — | — | Baixo |

Todas preservam `resizeComposer`, `COMPOSER_MAX_HEIGHT 200`, `useVoiceInput`, `compressImage`, `sanitizeInput 500`, `streaming NDJSON`.

## 25. Plano de Implementação Futuro

**Fase CHAT-UX-002 (P0, 1 sprint, só UI/CSS):** `ChatAssistant.tsx` 805/828/646/869/832 + `composerCOMPOSER001.test.ts` atualizar `bg-stone-50→white` em `T-COMP-STRUCT-2`; `tsc --noEmit`, `vitest run` (412 testes), `next build` 28 rotas, validação A–I Android + A–E voz.

**Fase CHAT-UX-003 (P1, 1 sprint):** dvh, 420-440px, empty/mensagens, streaming stop, `visualViewport` debounce.

**Fase CHAT-UX-004 (P2):** VU, timestamps, amber premium, docs.

Cada fase com `IMPLEMENTED_NOT_VALIDATED` até Android físico, sem commit antes.

## 26. Riscos

- **Contraste PILL `white` sobre `white` painel:** Resolver com `border stone-200 shadow-sm` + `FAFAFA` page vs `white` painel já em plano.
- **`animate-in` sem plugin:** Substituir por `animate-slide-in-bottom` local (`globals.css:343`) antes de P1.
- **`85dvh` + `env(safe-area)` duplo:** Testar iOS 16+ `safe-area` 0 em desktop; usar `max(0.75rem,env(...))` já validado.
- **Voz cancel em `processing`:** Pode abortar `Vosk transcribe` em curso (`controller:532` já faz `terminate` safe), testar `MODEL_LOAD_STALE` não vazar.
- **Preview dentro pill aumenta altura mínima Pill 44→ 96+44:** Validar `max-h 200px` ainda cabe em `SE 667px`.

## 27. O que NÃO Alterar

- **Voz:** `useVoiceInput`, `voiceController` estados, `vosk-browser`, `Vosk MODEL`, `RECORDING_LIMIT_MS 60000`, `silenceThreshold`, `formatElapsedMs` — só apresentação (VU/cancel/banner), não engine.
- **Composer lógica:** `resizeComposer` `scrollHeight` clamp 200, `COMPOSER_MAX_HEIGHT`, `min-w-0`, `onChange+useEffect`, `Enter/Shift+Enter` (`:889`), `maxLength 500`, `hasContent` `trim||image`.
- **Anexos:** `compressImage 800 0.7`, `setSelectedImage`, `Preview data:image`, `hasContent` image-only `Analise...`.
- **Envio/streaming:** `runExchange` `sanitizeInput`, `cleanHistory 6`, `fetch NDJSON t:chunk/done/error`, `streamingText` → `messages`.
- **Backend/RAG/prompts/globals/config/PWA/service worker** (`sw.js`).
- **Dependências:** não instalar `tailwindcss-animate`, não trocar `interactive-widget` global nesta auditoria.

## 28. Conclusão

Auditoria baseada em código real (`ChatAssistant.tsx:952`, `globals.css:457`, `tailwind.config:125`) e 4 relatórios históricos, com evidências `file:line` e classificação `corrigido/parcial/atual`. DOCK duplicidade é **corrigido (001.1)**; remanescentes são refinamentos de contraste, shell, voz e anexos — todos especificados de forma implementável (§§ 9-16 com classes exatas).

**Princípio validado:** Premium virá de `nutri+amber` controlado, `rounded-3xl/shadow-premium`, `20px` headline, container único estável — não de gradientes ou cópia ChatGPT.

**Próxima sprint:** `CHAT-UX-002` executa P0 (6 itens) validando desktop `420-440px` fluido contra `PatientAppShell` e mobile `dvh/safe-area` em device real.

**Status:** `AUDIT_COMPLETE` — documento completo, sem código alterado, pronto para revisão.

---

*Gerado sem alterar código/testes/configuração. Nenhum commit/push/deploy realizado.*
