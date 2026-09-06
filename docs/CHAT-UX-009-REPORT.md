# CHAT-UX-009 — Composer Intrínseco e Content-Sized (auditoria estrutural final)

**Sprint:** CHAT-UX-009 — ÚLTIMA tentativa da linha CHAT-UX (regra: não criar CHAT-UX-010).
**Status:** `FAIL/BLOCKED` — hipótese estrutural **não confirmada no código atual**; nenhuma alteração de código realizada nesta sprint (não havia restrição a remover). Sem commit/push/deploy.
**Base inspecionada:** `src/components/ChatAssistant.tsx` (HEAD de trabalho com CHAT-UX-006/007/008 aplicadas).

---

## 1. Investigação estrutural (evidência por camada)

Cadeia real inspecionada linha a linha:

| Camada | Linha | CSS efetivo | Restrição de altura? |
|---|---|---|---|
| Panel (chat) | ~768 | `flex flex-col overflow-hidden h-[85vh] h-[85dvh]` | Teto de **viewport** (deliberado, fora do Composer) |
| Conversation | ~? | `flex-1 min-h-0 overflow-y-auto` | Nenhuma fixa — **cede espaço** (min-h-0) |
| Dock | 954 | `p-2 sm:p-3 shrink-0 relative z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3` | **Nenhuma** (content-sized) |
| Pill (Composer) | 956 | `flex flex-col w-full bg-white p-2 rounded-3xl border … min-h-0` | **Nenhuma** (`height/min/max-height` ausentes) |
| Preview / Recording / Grid | 959/981/1014 | condicionais; grid `grid w-full min-w-0 items-center gap-x-1 gap-y-1.5` + `gridTemplateRows: auto`(idle) / `auto auto`(editando) | **Nenhuma** (linhas auto) |
| textarea | 1097–1112 | `[grid-area:input] w-full min-w-0 … min-h-[44px] max-h-[200px] overflow-y-auto`, altura inline = `autoGrowHeight(scrollHeight)` (pós-render) | Só o próprio teto `max-h-[200px]` (deliberado) |

**Conclusão da inspeção:** **não existe camada intermediária com `height`, `min-height`, `max-height`, `overflow` fixo, `grid-template-rows` fixo ou flex-sizing que determine a área de digitação entre o textarea e o Composer.** O textarea é filho direto do grid (sem wrapper "InputArea" intermediário); grid, pill e dock são todos **content-sized** (`height:auto`), e a hierarquia já é exatamente a pedida:

```
texto → textarea cresce (inline height pós-render) → grid row auto acompanha
→ pill acompanha → dock acompanha → conversation cede (min-h-0)
→ teto ~200px → scroll interno só no textarea (overflowY=auto)
```

A expansão por **foco** (declarativa: troca de `grid-template-areas`) e por **conteúdo** (medição `useLayoutEffect` pós-render + `requestAnimationFrame`, CHAT-UX-008) percorrem a mesma cadeia de layout content-sized — não há um ponto estático onde a segunda cadeia divergiria da primeira.

## 2. Por que a hipótese de "camada intermediária com altura determinada" NÃO se confirma

- Nenhum elemento entre textarea e Composer possui altura/piso/overflow intermediário (ver tabela).
- O Composer já é `height:auto`/content-sized; o teto `max-h-[200px]` está **no próprio textarea** (área de conteúdo), não no Composer inteiro — exatamente a arquitetura-alvo da sprint.
- A única capacidade de conter o Composer é o **Panel** (`85vh/dvh` + `overflow-hidden`), que é o último recurso do layout (conversation `flex-1 min-h-0` encolhe antes), não uma camada interna que trave o textarea em ~2 linhas.

Portanto, no código atual, **não há restrição estrutural a remover**, e qualquer comportamento de "~2 linhas com scroll cedo" **não é reproduzível por este DOM com teclado fechado** — restando, como causas plausíveis fora da estrutura do Composer: (a) teclado do Chrome Android sobrepondo o painel `fixed` (cenário "digitando"; viewport sem `interactive-widget=resizes-content`), e/ou (b) bundle/SW antigo no Realme. Ambas exigem medição no dispositivo (logs `[CHAT_DEBUG]` com build `NEXT_PUBLIC_CHAT_DEBUG=1`) — não são corrigíveis por reconstrução do Composer.

## 3. Decisão conforme a regra final da sprint

- Causa estrutural **não identificada de forma confiável** por inspeção estática (inexistente no código atual).
- Sem dispositivo físico neste ambiente, **não há evidência objetiva de crescimento** para declarar PASS (critério: evidência no aparelho + medições).
- Regra final: → **FAIL/BLOCKED**; linha CHAT-UX **encerrada**; **sem CHAT-UX-010**; sem novos ajustes cosméticos nem novas tentativas de `resizeComposer()`.

## 4. Estado do código

Nenhuma alteração nesta sprint (nada a remover). Permanecem no working tree, **sem commit**, as mudanças de CHAT-UX-006/007/008 (`ChatAssistant.tsx`, testes, `composerAutoGrow.ts`, relatórios).

Instrumentação `[CHAT_DEBUG]` segue ativa sob `NEXT_PUBLIC_CHAT_DEBUG` para a medição decisiva no aparelho (scrollHeight/clientHeight/offsetHeight/rect/styleHeightPx/contentClipped + Composer/Conversation/Panel + `visualViewport`), sem registrar conteúdo.

## 5. Recomendação pós-linha (fora da linha CHAT-UX)

Se o produto decidir investigar o sintoma "digitando com teclado" no Realme: rodar a medição e, confirmado o cenário H1, tratar no nível de viewport (`interactive-widget=resizes-content` ou painel acompanhando `visualViewport`) — decisão de produto/global, não do Composer.

---

**CHAT-UX-009**

Status: `FAIL/BLOCKED` (hipótese estrutural não confirmada no código atual; sem evidência física)
Causa raiz: **nenhuma camada intermediária com altura/piso/overflow fixo encontrada** entre textarea e Composer (arquitetura já é content-sized; teto `max-h-[200px]` no próprio textarea) → sintoma residual não é reproduzível por este DOM com teclado fechado; causas plausíveis externas: teclado sobre painel `fixed` (H1) e/ou bundle/SW antigo no Realme
Caminho focus: declarativo (troca de grid-template-areas) — verificado
Caminho input: conteúdo → textarea (altura inline pós-render, CHAT-UX-008) → grid/pill/dock content-sized acompanham → conversation cede → teto → scroll no textarea — verificado em código
Ponto de divergência: não localizado em código (sem restrição intermediária a remover)
Correção: NENHUMA aplicada nesta sprint (nada a remover; proibido novo ajuste cosmético)
scrollHeight / clientHeight / rect.height: (medição pendente no dispositivo)
Limite: `AUTO_GROW_MAX_HEIGHT = 200` no textarea (área de conteúdo)
Overflow: somente `scrollHeight > 200` → `overflow-y:auto` no textarea
Android: NÃO EXECUTADO (sem dispositivo)
Desktop: inspeção estrutural concluída; sem evidência visual automatizada
Testes: não alterados nesta sprint (estado anterior: 476/476)
TypeScript: não alterado nesta sprint
Build: não alterado nesta sprint
Commit: NÃO · Push: NÃO · Deploy: NÃO

---

## ADENDO — Causa raiz definitiva encontrada (log `[CHAT_DEBUG]` no aparelho)

Após o veredito acima, um log `[CHAT_DEBUG]` capturado **no aparelho** com o Composer em edição (focused=true, teclado fechado — `vvHeight = innerHeight = 695`) mostrou:

```json
{ focused: true, hasContent: false, isComposerIdle: false,
  textarea: null, composer: {height:112}, panel: {height:591}, ... }
```

**`textarea: null`** revelou a causa real: **`ref={textareaRef}` nunca foi anexado ao `<textarea>`** no JSX (a partir da reestruturação CHAT-UX-006). Como `resizeComposer()` guarda `if (!el) return` e lê `textareaRef.current`, ele **sempre retornava cedo** — o auto-grow **nunca aplicou altura nenhuma** em nenhum build CHAT-UX-006/007/008:

- `textareaRef.current` é sempre `null` → `style.height` nunca é definido;
- o textarea permanece no intrínseco de `rows={1}` (~44–48px) e, ao passar de ~2 linhas, o `overflow-y-auto` (classe) mostra scroll cedo;
- **foco expande** porque a troca de `grid-template-areas` é declarativa (CSS), independe do JS;
- comportamento idêntico em qualquer navegador/aparelho (não era Realme/teclado/Grid).

Ou seja, a auditoria estrutural estava correta (nenhuma camada intermediária bloqueia) — o que faltava era a **conexão do ref ao elemento**, invisível para testes de classe e para a inspeção estática que analisou o CSS.

### Correção aplicada (mínima)

- `src/components/ChatAssistant.tsx`: `ref={textareaRef}` adicionado ao `<textarea>` (primeiro atributo).
- `src/components/__tests__/composerCOMPOSER001.test.ts`: testes de regressão **T-CAUSA-01..03** garantem que o único `<textarea>` real possui `ref={textareaRef}` e que `resizeComposer`/debug usam o mesmo ref; helper `getTextareaClass` tolera o atributo extra.

### Validação técnica (após a correção)

```text
npx vitest run   → 32 arquivos, 479 testes, TODOS PASSAM (exit 0)
npx tsc --noEmit → 0 erros (exit 0)
npm run build    → sucesso, 28 rotas (exit 0)
```

### Pendência

Validação visual no Realme (1→2→3→4→5 linhas, limite ~200px, scroll só no teto, apagar reduz) com o novo build; agora o mecanismo de crescimento está de fato ativo (`[CHAT_DEBUG]` deve registrar `textarea` preenchido com `styleHeightPx` crescendo). Sem commit/push/deploy.
