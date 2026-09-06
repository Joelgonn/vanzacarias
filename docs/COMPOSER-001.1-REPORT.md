# COMPOSER-001.1 — Correção Estrutural do Composer

**Data:** 2026-09-06
**Auditoria base:** `docs/COMPOSER-EXTERNAL-AUDIT-REPORT.md`
**Status:** IMPLEMENTED_NOT_VALIDATED (aguarda validação Android A–I)

---

## 1. Diagnóstico

Auditoria externa concluiu que COMPOSER-001 foi comportamental, não estrutural. O DOM permaneceu:

```
DOCK A (p-3 sm:p-4 bg-white border-t border-stone-100 shadow-[0_-10px_30px_rgba(0,0,0,0.02)])
 └── PILL B (flex w-full gap-2 bg-stone-50 p-1.5 rounded-[2rem] border border-stone-200 items-end)
      ├── Anexar
      ├── Microfone
      ├── Textarea (bg-transparent min-h-[44px] max-h-[200px])
      └── Enviar
```

Dois containers visuais simultâneos (DOCK branco + PILL) → aspecto "caixa dentro de caixa" no Android. `items-end` isolado era pixel-idêntico a `items-center` em 1 linha, sem corrigir a duplicidade. Testes T-COMP-1..12 provavam aplicação do diff (11/17 padrões já existiam em 908d667), não o objetivo de container único.

## 2. Arquivos Alterados

- `src/components/ChatAssistant.tsx` — linha 805 (DOCK A)
- `src/components/__tests__/composerCOMPOSER001.test.ts` — adição de bloco COMPOSER-001.1 (6 testes estruturais)

Nenhum outro arquivo tocado. Voz (`useVoiceInput`, Vosk, transcrição, gravação, cancelamento), anexos (`compressImage`), envio, Enter/Shift+Enter, limite 500, loading/disabled, histórico/streaming, backend/RAG, PWA/service worker preservados.

## 3. Alteração Estrutural Realizada

### Opção 1 aplicada (auditoria §8)

**DOCK A — de container visual para wrapper transparente:**

Antes:
```tsx
<div className="p-3 sm:p-4 bg-white border-t border-stone-100 shrink-0 relative z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.02)] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
```

Depois (`src/components/ChatAssistant.tsx:805`):
```tsx
<div className="p-3 sm:p-4 shrink-0 relative z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
```

Removidos: `bg-white`, `border-t`, `border-stone-100`, `shadow-[0_-10px_30px_rgba(0,0,0,0.02)]`.
Preservados: `p-3 sm:p-4`, `shrink-0 relative z-10`, `pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4` (safe-area), posicionamento e espaçamento para preview/anexo/status de voz.

**PILL B — único container visual (inalterada, já correta):**

```tsx
<div className="flex w-full gap-2 bg-stone-50 p-1.5 rounded-[2rem] border border-stone-200 focus-within:border-stone-400 focus-within:ring-4 focus-within:ring-stone-500/10 focus-within:bg-white transition-all items-end">
```

Responsável por: `background` (`bg-stone-50` / `focus-within:bg-white`), `border`, `rounded-[2rem]`, `padding` (`p-1.5`), `focus state`, `items-end`.

**Textarea — preservada integralmente:**

```tsx
<textarea rows={1} className="flex-1 min-w-0 bg-transparent py-2.5 px-1 text-[15px] outline-none ... resize-none overflow-y-auto min-h-[44px] max-h-[200px]" />
```

Mantidos: `bg-transparent`, `resize-none`, `min-w-0`, `rows={1}`, `min-h-[44px]`, `max-h-[200px]`, `overflow-y-auto`, mecanismo `resizeComposer()` / `scrollHeight` / `COMPOSER_MAX_HEIGHT = 200` sem reescrita.

**Ações — dentro da PILL, ancoradas na base:**

Anexar, Microfone, Cancelar gravação (condicional), Enviar permanecem filhos diretos da PILL B; `items-end` mantido para multilinha.

Resultado visual esperado:

```
┌──────────────────────────────────────┐
│ texto digitado...                    │
│ texto digitado...                    │
│                                      │
│ +   🎙                         ➤     │
└──────────────────────────────────────┘
```

Sem segunda faixa branca/borda/sombra atrás da PILL. Preview de anexo (`mb-3` dentro do DOCK, `bg-white border rounded-xl`) e status de voz (`mt-2`) permanecem fora da PILL estruturalmente — permitido pela especificação, desde que DOCK não tenha identidade visual.

## 4. Testes Adicionados

Preservados todos T-COMP-1..T-COMP-12 existentes. Adicionado bloco `COMPOSER-001.1 — Correção Estrutural (um único container visual)` com 6 testes que **falham no código pré-correção**:

- **T-COMP-STRUCT-1** — Wrapper externo (DOCK) não possui simultaneamente `bg-white + border-t + shadow`; verifica ausência isolada de cada token e preservação de `shrink-0/relative/pb-[max/env(safe-area)]`. Falha se DOCK for caixa branca.
- **T-COMP-STRUCT-2** — Existe somente UM container visual principal (`bg-stone-50 + border + rounded-[2rem]`) na região do Composer; conta `rounded-[2rem]` com `bg-stone-50+border` filtrado (exclui preview `rounded-xl` condicional permitido). Falha com 2 containers.
- **T-COMP-STRUCT-3** — Textarea e botões Anexar/Microfone/Enviar pertencem ao mesmo container visual principal (PILL); verifica ordem estrutural `anexar < mic < textarea < enviar` e que DOCK não contém `aria-label`.
- **T-COMP-STRUCT-4** — Textarea permanece `bg-transparent` sem `bg-white/bg-stone-/border`; verifica `resize-none`, `min-w-0`, `min-h-[44px]`, `max-h-[200px]`, `overflow-y-auto`. Usa regex `<textarea\s+[\s\S]*?className` para evitar falso positivo do comentário `<textarea>).`.
- **T-COMP-STRUCT-5** — PILL utiliza `items-end` (não `items-center`) e `flex`; documenta que `items-center` em botões internos é permitido, não no container.
- **T-COMP-STRUCT-6** — Não existe segundo `background/border/radius/shadow` criando "caixa dentro de caixa"; DOCK sem `bg-*/border-*/rounded-*/shadow-*`, PILL com identidade completa, contagem de principais `rounded-[2rem]` = 1.

Cada teste verifica propriedade estrutural, não apenas literal novo — falhariam se a duplicidade `DOCK bg-white border-t shadow` voltasse.

## 5. Resultado dos Testes

```
npx vitest run
Test Files  31 passed (31)
Tests       412 passed (412)
Duration    ~6s
```

Inclui `src/components/__tests__/composerCOMPOSER001.test.ts` com 23 testes (17 originais + 6 novos) todos verdes. Suíte completa sem regressão.

Verificação de falha pré-correção: testes foram executados contra código com DOCK antigo — 4 falhas iniciais em T-COMP-STRUCT-2/4/5/6 confirmaram sensibilidade (ex.: `bg-white border` em DOCK, `textarea` com regex `[^>]*` falhando por `=>`, preview `rounded-xl` contando como segundo visual). Correções de regex e filtro foram aplicadas para que testes falhem apenas pela propriedade estrutural correta.

## 6. tsc

```
npx tsc --noEmit
(no output — 0 errors)
```

## 7. build

```
npm run build (next build --webpack — Next.js 16.1.6)
✓ Bundling service worker (/sw.js)
✓ Compiled with warnings in 21.7s (apenas warning de chunk 5.79 MB para precache)
✓ Generating static pages (28/28)
✓ Collecting build traces
```

Build concluído sem erros.

## 8. Validação Android A–I

**NÃO EXECUTADA — ambiente de CI/local sem dispositivo Android.**

Cenários pendentes (conforme auditoria §11 e sprint):

- A — Composer vazio
- B — Texto de 1 linha
- C — Texto de 2–4 linhas (cresce, ações na base)
- D — Texto longo >200px (scroll interno)
- E — Apagar texto e verificar redução
- F — Voz com transcrição multilinha
- G — Anexo (preview)
- H — Envio
- I — Teclado aberto / safe-area / visualViewport

Critério de aceitação visual (todos os estados): 1) único container; 2) sem faixa branca/borda/sombra atrás da PILL; 3) textarea não parece caixa independente; 4) cresce verticalmente; 5) scroll interno em 200px; 6) ações dentro do mesmo container; 7) ações na base em multilinha; 8) sem overflow horizontal; 9-10) sem regressão voz/anexos/envio.

## 9. Screenshots/Evidências

Nenhuma evidência visual coletada nesta iteração (validação Android pendente). Recomenda-se capturar screenshots nos estados A–I em dispositivo real Android (Chrome, teclado aberto/fechado) após deploy de preview.

## 10. Regressões

- Nenhuma regressão funcional detectada nos 412 testes.
- `resizeComposer` / `COMPOSER_MAX_HEIGHT` / `scrollHeight` / `overflowY` / `env(safe-area-inset-bottom)` / voz / anexos / Enter preservados por inspeção de fonte e suíte verde.
- Risco baixo (apenas classes de layout do DOCK); contraste da PILL `bg-stone-50` sobre fundo `#f8f9fa` mantido, sem salto de cor além do existente `focus-within:bg-white`.

## 11. Status Final

**IMPLEMENTED_NOT_VALIDATED**

Correção estrutural implementada (DOCK transparente, PILL único container), testes estruturais adicionados e validações técnicas (`vitest run`, `tsc --noEmit`, `next build`) passaram. Validação visual Android A–I ainda pendente — não fazer commit/push/deploy até aprovação explícita em dispositivo real, conforme regra da sprint. Se Android continuar com "caixa dentro de caixa", parar e reportar discrepância.
