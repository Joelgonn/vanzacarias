# CHAT-UX-008 — Diagnóstico e Correção Definitiva do Auto-Grow do Composer

**Sprint:** CHAT-UX-008 — DIAGNÓSTICO + IMPLEMENTAÇÃO
**Base:** CHAT-UX-007 (`IMPLEMENTED_NOT_VALIDATED`).
**Status:** `IMPLEMENTED_NOT_VALIDATED` — validação física (Realme como primeiro aparelho, §25) **NÃO EXECUTADA neste ambiente** (sem dispositivo). Não é declarado `VALIDATED`; nenhum commit/push/deploy (§29).

---

## 1. Causa raiz (análise dos dois caminhos)

### Caminho A — foco (funciona)
```
onFocus → isComposerFocused=true → React render → grid areas trocam
("attach mic input send" → "input…/attach mic . send") → layout DECLARATIVO
→ Composer expande
```
A expansão por foco é **declarativa**: depende do React/CSS renderizar outro template de grid. Não há medição imperativa; o navegador simplesmente aplica o layout novo.

### Caminho B — novas linhas (falha observada)
```
onChange → state.setInput → resizeComposer() media scrollHeight NO MEIO DO EVENTO
→ style.height → ??? (não cresce visualmente; scroll aparece cedo)
```
A medição do caminho B acontecia **antes** de o React commitar o novo valor controlado (`state.input`) — ordem `medir → render`, com o `value` do DOM num estado intermediário da transação do React (evento batched). Qualquer engine que só estabilize o layout do valor controlado **após o commit** podia, na prática, manter o textarea na altura antiga (estilo aplicado sobre um estado que o render seguinte revalida) — enquanto `scrollHeight` (conteúdo) continua subindo. É exatamente o sintoma: "foco expande; conteúdo não expande".

### Ponto de divergência
**A medição ocorria na ordem errada relativa ao commit do React** (Caminho B media no meio do evento, antes do render; o Caminho A nem depende de medição). O grid não estava limitando: linhas eram/são `auto` (CHAT-UX-007) e nenhum ancestral limita abaixo de `max-h-[200px]` — o que travava era a aplicação do `style.height` sobre um estado de DOM/valor ainda não comitado em engines sensíveis à ordem.

## 2. Correção aplicada (agnóstica de dispositivo/navegador)

1. **Ordem garantida `render → medir → pintar`**: a medição saiu do `onChange` (meio do evento) e passou a ocorrer **sempre** num `useLayoutEffect` com deps `[state.input, isComposerFocused]` — depois do React commitar o novo valor, antes da pintura; mais uma 2ª medição em `requestAnimationFrame` (fonte/layout tardios). `onChange` agora só atualiza `state.input`.
2. **Lógica pura extraída** (`src/components/composerAutoGrow.ts`): `autoGrowHeight(scrollHeight, max=200)` → `{heightPx = min(scrollHeight, 200), overflowY = scrollHeight>200 ? 'auto' : 'hidden'}` — sem min-height artificial; o crescimento 1→5 linhas é consequência direta de aplicar `heightPx`.
3. **Grid com linhas `auto` explícitas** (mantido do CHAT-UX-007): linha do texto e linha de ações crescem por conteúdo; nenhuma linha implícita fixa.
4. **Instrumentação `[CHAT_DEBUG]`** mantida/estendida (scrollHeight/clientHeight/offsetHeight/rect/styleHeightPx/contentClipped + Composer/Conversation/Panel + viewport), atrás de `NEXT_PUBLIC_CHAT_DEBUG`, sem logar conteúdo.

## 3. scrollHeight / clientHeight / rect — evidência

**Sem dispositivo neste ambiente: valores reais ainda não coletados.** A instrumentação está pronta e o protocolo é o do §24/§27 do briefing: com build `NEXT_PUBLIC_CHAT_DEBUG=1`, registrar para 1/3/5 linhas e >200px (teclado fechado e aberto):

```text
1 linha:  scrollHeight=… clientHeight=… offsetHeight=… rect=…
3 linhas: scrollHeight=… clientHeight=… offsetHeight=… rect=…
5 linhas: scrollHeight=… clientHeight=… offsetHeight=… rect=…
>200px:   scrollHeight=… clientHeight=… offsetHeight=… rect=… overflow=auto
```

Contrato esperado (referência de comportamento): cada linha nova (≈24px + padding) eleva `scrollHeight` e `heightPx` juntos até o teto; `overflowY='auto'` **somente** quando `scrollHeight > 200`.

## 4. Limite / Overflow

`AUTO_GROW_MAX_HEIGHT = 200` (mesma constante aplicada no CSS `max-h-[200px]`); acima do teto → `clientHeight` trava em 200 e `scrollHeight > clientHeight` → `overflow-y: auto`. Nunca `min-height` inflado nem `max-height` reduzido.

## 5. Testes automatizados

- **Novos testes puros da lógica** (`src/components/__tests__/composerAutoGrow.test.ts`): **T-AUTOGROW-01..10** — vazio, 1..5 linhas (44/68/92/116/140), >200 (teto 200), overflow só acima do teto, apagar reduz, monotonia, NaN/negativo seguro, `estimateLines`.
- **Atualizados** (`composerCOMPOSER001.test.ts`, `textareaVOZ012.test.ts`): assertions que fixavam o mecanismo antigo (medição no `onChange`, `Math.min(scrollHeight,maxH)`, overflow inline) agora verificam o novo contrato (`autoGrowHeight`, `useLayoutEffect` pós-render, `style.height=${heightPx}px`, `overflowY=overflowY`).
- Limitação declarada: sem jsdom/RTL/Playwright com layout real, `scrollHeight` real não é testável em node — por isso a lógica foi extraída para função pura testada, e os valores reais ficam para o dispositivo (§22 do briefing).

## 6. Validação técnica

```text
npx vitest run   → 32 arquivos, 476 testes, TODOS PASSAM (exit 0)
npx tsc --noEmit → 0 erros (exit 0)
npm run build    → sucesso, 28 rotas (exit 0)
```

Arquivos alterados/criados:
- `src/components/composerAutoGrow.ts` (novo — lógica pura)
- `src/components/__tests__/composerAutoGrow.test.ts` (novo — T-AUTOGROW-01..10)
- `src/components/ChatAssistant.tsx` (auto-grow: useLayoutEffect pós-render + helper)
- `src/components/__tests__/composerCOMPOSER001.test.ts` (contrato atualizado)
- `src/lib/voice/__tests__/textareaVOZ012.test.ts` (contrato atualizado)

## 7. Android / Desktop / multiplataforma

Sem dispositivo neste ambiente. A correção é baseada em comportamento de DOM/ordem de render (não em UA/device): nenhum `if (Realme/Android/Chrome)`. Validação prevista: Realme como primeiro aparelho (§25) com teclado fechado e aberto (1→2→3→4→5→limite→scroll→apagar→idle) e, se disponível, outro ambiente físico.

---

**CHAT-UX-008**

Status: `IMPLEMENTED_NOT_VALIDATED`
Causa raiz: medição do auto-grow ocorria no `onChange`, **no meio do evento e antes do commit** do valor controlado pelo React (ordem `medir → render`); a expansão por foco é declarativa (grid areas) e não dependia de medição — daí "foco expande; conteúdo não expande". Nenhum ancestral limita o textarea abaixo de `max-h-[200px]` (linhas do grid são `auto`).
Caminho focus: onFocus → isComposerFocused → render → grid areas de edição → expansão (declarativa).
Caminho input: onChange → setInput → **commit do React** → useLayoutEffect mede (render → medir → pintar) → style.height/overflowY.
Ponto de divergência: ordem da medição em relação ao commit (corrigida) — a confirmar no dispositivo com os valores reais.
Correção: medição somente pós-render (`useLayoutEffect` + rAF, deps `[state.input, isComposerFocused]`); lógica pura `autoGrowHeight` (1→5 linhas progressivo, teto 200, overflow só no teto); `onChange` apenas atualiza o value.
scrollHeight: (pendente medição no dispositivo)
clientHeight: (pendente)
rect.height: (pendente)
Limite: AUTO_GROW_MAX_HEIGHT = 200
Overflow: somente `scrollHeight > 200` → `overflow-y:auto`
Android: NÃO EXECUTADO (sem dispositivo)
Desktop: NÃO EXECUTADO fisicamente (testes técnicos verdes)
Testes: 476/476 (32 arquivos)
TypeScript: PASS
Build: PASS
Commit: NÃO
Push: NÃO
Deploy: NÃO
