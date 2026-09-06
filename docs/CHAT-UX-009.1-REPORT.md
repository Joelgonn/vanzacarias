# CHAT-UX-009.1 — Acabamento Final do Composer (borda interna + scrollbar)

**Sprint:** CHAT-UX-009.1 — acabamento visual final (última alteração do Composer; sem CHAT-UX-010).
**Status:** `IMPLEMENTED_NOT_VALIDATED` — alteração puramente visual/CSS; suíte técnica verde; confirmação visual (desktop/mobile) pendente em navegador real (sem ambiente de browser/dispositivo aqui).
**Escopo respeitado:** não foram alterados arquitetura, comportamento, `textareaRef`, `resizeComposer`, auto-grow, Grid/Flex, teclado, voz, header, sugestões etc.

---

## 1. Mudança aplicada

1. **`src/components/ChatAssistant.tsx`** — adicionada a classe utilitária **`composer-textarea`** ao `<textarea>` (apenas class name; nenhuma outra alteração no elemento ou na cadeia).
2. **`src/app/globals.css`** — bloco dedicado `.composer-textarea`:
   - `appearance:none` (e `-webkit-appearance:none`), `border:none`, `outline:none`, `box-shadow:none`, `background:transparent`, `border-radius:0` — reforço para eliminar qualquer decoração nativa do campo que produza a impressão de uma segunda caixa/linha interna (as classes Tailwind `border-0 ring-0 outline-none shadow-none bg-transparent` já existiam; a classe CSS cobre aparência/estados de foco de forma determinística).
   - `:focus` / `:focus-visible` sem `outline`/`box-shadow`.
   - **Scrollbar interna discreta** (sobrepõe a global `*::-webkit-scrollbar`): `scrollbar-width:thin`, cor neutra translúcida, track transparente, `::-webkit-scrollbar` 6px e thumb arredondado — funcional (`overflow-y-auto` intacto) mas sem criar uma "linha/caixa" lateral; sem hacks específicos de navegador além do padrão WebKit/scrollbar-color.

A borda externa do **Composer/Pill** (`rounded-3xl border border-stone-200`) permanece como única superfície visual.

## 2. Testes

- `composerCOMPOSER001.test.ts`: `UX7-04` estendido (classe `composer-textarea` presente; ausência de `bg`/`border-stone`/`shadow` além de `shadow-none`) e **`UX7-07`** novo — valida em `globals.css` o bloco `.composer-textarea` (appearance/border/outline/scrollbar dedicada) sem reintroduzir `border:1px`.
- Nenhum teste existente alterado além dessas extensões; nenhum teste frágil baseado em detalhe irrelevante de Tailwind foi criado.

## 3. Validação técnica

```text
npx vitest run   → 32 arquivos, 480 testes, TODOS PASSAM (exit 0)
npx tsc --noEmit → 0 erros (exit 0)
npm run build    → sucesso, 28 rotas (exit 0)
```

Arquivos alterados: `src/app/globals.css`, `src/components/ChatAssistant.tsx`, `src/components/__tests__/composerCOMPOSER001.test.ts`. Sem commit/push/deploy.

## 4. Validação visual pendente (critérios PASS)

Desktop: textarea integrado à superfície (sem linha/borda interna, sem contorno/ring); Composer mantém borda externa; scrollbar discreta após o teto (~200px); auto-grow 1→5 linhas segue funcional. Mobile: idle compacto e sem regressão visual/funcional. Se surgir problema não relacionado a borda/scrollbar: **documentar, não corrigir** (regra §8).

---

**CHAT-UX-009.1**

Status: `IMPLEMENTED_NOT_VALIDATED`
Alterações: classe `composer-textarea` + CSS dedicado (integração visual e scrollbar discreta); borda externa da pill preservada
Testes: 480/480 (32 arquivos)
TypeScript: PASS
Build: PASS
Validação visual (desktop/mobile): PENDENTE (sem navegador/dispositivo neste ambiente)
Commit: NÃO · Push: NÃO · Deploy: NÃO
Linha CHAT-UX: encerrada após validação visual — sem CHAT-UX-010
