# COMPOSER — AUDITORIA EXTERNA (COMPOSER-001)

**Projeto:** `vanzacariasnutri` — Composer de mensagens do ChatAssistant
**Escopo:** auditoria independente do Composer (UX vs referência ChatGPT). **Nenhum código, teste, configuração ou documentação existente foi alterado.**
**Base de verificação:** HEAD `8dfcade feat: COMPOSER-001` (working tree limpo); `src/components/ChatAssistant.tsx`; `src/components/__tests__/composerCOMPOSER001.test.ts`; `docs/COMPOSER-001-REPORT.md`; `docs/VOZ-012.5-REPORT.md`; diff `8dfcade` vs `908d667`; comparação empírica (regex em memória) de padrões dos testes contra o fonte antigo e o atual.
**Data:** auditoria pós-COMPOSER-001.

---

## 1. Diagnóstico do DOM atual

Árvore real (rodapé do painel do chat):

```
div … "p-3 sm:p-4 bg-white border-t border-stone-100 shrink-0 relative z-10
        shadow-[0_-10px_30px_rgba(0,0,0,0.02)] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4"   ← DOCK A
│  bg branco · border-top · sombra p/ cima · padding 12px
│
├─ [condicional] preview de anexo (mb-3; botão remover)                    ← fora da pill, dentro de A
├─ div "flex w-full gap-2 bg-stone-50 p-1.5 rounded-[2rem] border border-stone-200
│       focus-within:border-stone-400 focus-within:ring-4 focus-within:ring-stone-500/10
│       focus-within:bg-white transition-all items-end"                     ← PILL B
│   │  bg stone-50 · border 1px · radius 32px · padding 6px · flex row · items-end
│   ├─ button Anexar      (min-w-[44px] h-[44px] shrink-0 ml-1)
│   ├─ input[type=file]   (hidden)
│   ├─ button Microfone   (min-w-[44px] h-[44px] shrink-0; Square/Loader/Mic)
│   ├─ [condicional] button Cancelar gravação
│   ├─ textarea rows={1} value maxLength=500 disabled=isLoading
│   │     "flex-1 min-w-0 bg-transparent py-2.5 px-1 … outline-none resize-none overflow-y-auto
│   │      min-h-[44px] max-h-[200px]" + altura/overflowY via JS (resizeComposer)
│   └─ button Enviar      (min-w-[48px] h-[48px] shrink-0 mr-0.5)
└─ [condicional] linha de status de voz (mt-2; Gravando/cronômetro/Processando/Transcrevendo/erro)      ← fora da pill, dentro de A
```

**Respostas às perguntas do briefing:**

1. **Existe apenas um container visual? NÃO.** Há dois boxes: DOCK A (barra branca `border-t`+shadow+padding) e PILL B (`bg-stone-50`+`border`+`rounded-[2rem]`) aninhada em A. O textarea **não** é uma segunda caixa (`bg-transparent`, integrado em B).
2. **Botões são descendentes do mesmo container do textarea? SIM** — anexar/mic/cancelar/enviar são filhos diretos da PILL B (linhas ~828–917).
3. **Wrapper externo que faz os botões parecerem fora?** Não "fora da pill", mas o DOCK A cria uma **segunda faixa visual** (fundo branco + borda superior + sombra) emoldurando a pill → aspecto "campo dentro de uma barra".
4. **`items-end` resolve o requisito?** Não sozinho: alinha os botões à base de B apenas quando B fica mais alto que os botões (2+ linhas). **Em 1 linha é pixel-idêntico a `items-center`** — por isso o estado de repouso não mostra diferença. Não trata a duplicidade A+B.
5. **Textarea parece caixa independente? NÃO** — `bg-transparent`, sem borda/fundo; recebe apenas `max-h-[200px]` + scroll interno via JS.

## 2. Estrutura visual atual

DOCK A (barra branca, `border-t`, sombra, `p-3`) → PILL B (`bg-stone-50`, `border`, `rounded-[2rem]`, `p-1.5`, `items-end`) contendo `[Anexar][Mic][textarea transparente flex-1][Enviar]`. Preview de anexo e status de voz ficam fora da pill (em A). Auto-grow `resizeComposer()` com `COMPOSER_MAX_HEIGHT = 200`, `max-h-[200px]`, `overflow-y` auto/hidden, recálculo em `onChange`/`[state.input]`/resize/orientação/visualViewport; safe-area no rodapé de A.

## 3. Estrutura visual desejada (referência ChatGPT — comportamento/composição)

Um único container visual dono de `border + background + radius + shadow + padding`; textarea transparente que cresce até `max-height` e então rola internamente; ações (anexar/mic/enviar) ancoradas na base do mesmo container; preview/status dentro do mesmo bloco; sem segunda barra/fundo por trás.

## 4. Diferenças encontradas

| Característica | ChatGPT (ref.) | Vanzacarias atual | Correto? |
|---|---|---|---|
| Container único | sim | **não** (DOCK A + PILL B) | ✗ |
| Textarea integrado (sem caixa própria) | sim | sim (`bg-transparent`) | ✓ |
| Border única | sim | **2 borders** (border-t de A + border de B) | ✗ |
| Background único | sim | **2 fundos** (bg-white A + bg-stone-50 B) | ✗ |
| Texto multilinha | sim | sim | ✓ |
| Auto-grow | sim | sim (`resizeComposer`, scrollHeight) | ✓ |
| Max-height | sim | sim (200px) | ✓ |
| Scroll interno | sim | sim (overflow-y auto após 200px) | ✓ |
| Ações internas | sim | sim (na pill) | ✓ |
| Ações no bottom | sim | sim **apenas com 2+ linhas** (`items-end`; invisível em 1 linha) | ~ |
| Anexo interno | sim | sim (na pill) | ✓ |
| Microfone interno | sim | sim (na pill) | ✓ |
| Enviar interno | sim | sim (na pill) | ✓ |
| Sem segunda barra/fundo por trás | sim | **não** (DOCK A visível) | ✗ |

## 5. Causa raiz da discrepância

1. **O COMPOSER-001 nunca alterou a composição visual.** O diff real do commit em `ChatAssistant.tsx` é apenas: adiciona `COMPOSER_MAX_HEIGHT`; extrai `resizeComposer()` (+ listeners de resize/orientação/visualViewport); `items-center→items-end` na pill; `flex→flex w-full`; `min-w-0` no textarea; `pb-[max(…,env(safe-area-inset-bottom))]`. O próprio `docs/COMPOSER-001-REPORT.md` §3 afirma: "Estrutura anterior: Já existia uma 'pill' única". **É um commit comportamental/refino, não estrutural** → "visualmente igual ao anterior" é o resultado esperado.
2. **O alvo "container único" nunca foi implementado**: DOCK A (branco, `border-t`, sombra) + PILL B persistem como dois boxes.
3. **Testes insuficientes — provam a aplicação do diff, não o objetivo.** T-COMP-1..12 são regex sobre o fonte. Verificação empírica: **11/17 padrões centrais já davam `True` no código anterior** (`908d667`); os 6 restantes casam exatamente com os literais adicionados pelo commit (`flex w-full`, `items-end`, `min-w-0`, safe-area pb, `resizeComposer()`, `const COMPOSER_MAX_HEIGHT`). Ex.: T-COMP-3 ("sem segunda caixa") só conta `(<textarea>` == 1) — nunca distingue o DOCK A.
4. **Sem teste de render/layout** (sem jsdom/RTL/Playwright) e **validação Android pendente** no próprio relatório (§15 Testes A–I, §21). O "406/406 verdes" nunca incluiu checagem visual.
5. Sem evidência de CSS sobrescrito, componente diferente do testado ou deploy divergente (componente único `ChatAssistant.tsx`, HEAD confere).

## 6. Análise dos testes T-COMP-1..12

| Teste | O que realmente verifica | Falharia no código pré-COMPOSER-001? | Lacuna |
|---|---|---|---|
| T-COMP-1/2 | `rows={1}`, `min-h-[44px]`, aria-labels | Não (padrões pré-existentes) | Nada estrutural |
| T-COMP-3 | pill `flex w-full … rounded-[2rem]` contém textarea+aria; `<textarea`==1 | Parcial (exige `w-full` novo) | Não detecta DOCK A; contagem trivial |
| T-COMP-4 | const 200, `max-h-[200px]`, `Math.min(scrollHeight)`, overflowY, resize-none | Não (clamp/classes pré-existentes desde VOZ-012) | Não prova scroll real |
| T-COMP-5/6/7 | `[state.input]`, `setInput`+`resizeComposer`, `onTranscript` | Parcial (exige `resizeComposer()`) | Não prova crescimento em browser |
| T-COMP-8/9/10 | anexo/envio/Enter (invariantes) | Não | Regressão funcional ok |
| T-COMP-11 | `min-w-0`, toques ≥44/48, `w-full`, `sm:*` | Parcial (só `min-w-0` novo) | Não prova overflow em 320px |
| safe-area / items-end | `env(safe-area…)`; pill `items-end` | Sim (strings novas) | Prova aplicação do diff, não composição |
| T-COMP-12 | invariantes de voz/anexo | Não | Regressão funcional ok |

Nenhum teste verifica: ausência de segundo container visual; um único dono de `border+bg+radius`; relação visual textarea↔ações renderizada; auto-grow/max-height/scroll em runtime.

## 7. Arquivos que realmente precisam de alteração (iteração futura)

1. `src/components/ChatAssistant.tsx` — única mudança estrutural/CSS (região ~805–917).
2. `src/components/__tests__/composerCOMPOSER001.test.ts` — corrigir/adicionar testes estruturais.
3. Nada mais (não há componente Composer separado; não tocar voz/anexos/envio/backend/RAG/prompts/globals/config).

## 8. CSS/estrutura a modificar (correção mínima)

Princípio: **eliminar o segundo box; um único elemento vira o container visual** (textarea continua transparente; ações permanecem dentro).

- **Opção 1 (recomendada): a PILL B vira o único container; DOCK A perde identidade visual.** Em A remover `bg-white border-t border-stone-100 shadow-[…]` → wrapper transparente de espaçamento (`shrink-0 relative z-10 px-3 pt-2 pb-[max(…)] sm:px-4 sm:pb-4`). Em B, garantir contraste único sobre a área de mensagens (`bg-[#f8f9fa]`), ex.: `bg-white` estável (evita salto no foco `focus-within:bg-white`), `border`, `rounded-[2rem]`/`rounded-[1.5rem]`, `shadow-sm` opcional. Resultado: 1 border/fundo/radius; `resizeComposer`, `max-h-[200px]`, overflow interno, `min-w-0`, safe-area e `items-end` permanecem.
- **Opção 2 (alternativa): A vira o container e B vira row transparente interno** (remove identidade de B; A emolduraria também preview/status — mais fiel com anexo, maior delta/risco).

## 9. Funcionalidades que devem permanecer intactas

Voz (`useVoiceInput`, gravação/stop/cancelar, cronômetro, estados Processando/Transcrevendo/Preparando, transcrição → append + auto-grow), anexo (file input, compressImage, preview, remover), envio (botão, disabled `isLoading||!hasContent`, spinner, Enter/Shift+Enter, limite 500), histórico/streaming, safe-area, acessibilidade (aria-labels, alvos ≥44/48px). Mudança restrita a classes de layout dos wrappers A/B.

## 10. Testes a corrigir/adicionar (iteração futura)

- **Novos T-COMP estruturais (regex-fonte) que falhariam no código atual/pré-fix:** (a) wrapper externo da área de input **sem** `bg-white`+`border-t`+`shadow` quando há pill única (ou o inverso, conforme opção); (b) exatamente **um** elemento com `border`+`bg-*`+`rounded-*` na região do Composer; (c) textarea e botões (aria Anexar/Mic/Enviar) no mesmo bloco do container único; (d) ausência de `items-center` na pill.
- **Testes de runtime (novos):** jsdom/RTL ou Playwright smoke (desktop fake-mic) para auto-grow real, clamp 200px + `overflow-y:auto`, ações visíveis na base, sem overflow horizontal em 320px. (jsdom não calcula `scrollHeight`/layout — auto-grow real exige browser/Playwright.)
- Manter T-COMP-8/9/10/12 e a suíte de voz sem alteração.

## 11. Plano de implementação recomendado (iteração futura)

1. Aplicar Opção 1 em `ChatAssistant.tsx`.
2. Atualizar `composerCOMPOSER001.test.ts` com os novos T-COMP estruturais; rodar `vitest run`, `tsc --noEmit`, `npm run build`.
3. Validação Android real (Testes A–I do relatório): vazio/1 linha; 2–4 linhas (cresce, ações na base); longo (200px + scroll); apagar recua; voz multi-linha; anexo; envio; teclado (safe-area/visualViewport). Critério: **um único container visível** na entrada.
4. Ajustar apenas constantes/classes (`COMPOSER_MAX_HEIGHT`, radius, padding) se a medição Android indicar.

## 12. Riscos

- Baixo (classes de layout), com atenção a: contraste da pill sobre `#f8f9fa` com A transparente; salto de cor no foco; preview/status fora do container podem "flutuar" se A perder fundo (Opção 1 os mantém fora, sem regressão).
- Não fazer nada ⇒ divergência visual com a referência persiste e o descolamento teste↔visual continua.
- Fora de escopo: teclado sobre painel `fixed` (`interactive-widget`) — pré-existente/global; segundo textarea do `CheckinForm`.

## 13. Conclusão objetiva

**Por que o COMPOSER-001 passou nos testes mas visualmente continuou igual no Android:** o commit foi **comportamental, não estrutural** (`items-end`, `resizeComposer`, `min-w-0`, safe-area, constante) sem tocar a composição; em 1 linha `items-end`≡`items-center`, logo a renderização ficou idêntica. Os testes T-COMP-1..12 são regex de fonte que comprovam a **aplicação do diff** (maioria dos padrões já existia no código antigo — 11/17 verificados) e não verificam o **objetivo** (um único container, sem DOCK A duplicado, ações na base); a validação visual Android estava pendente no relatório da sprint.

**Menor alteração correta:** remover o segundo container visual (DOCK A perde `bg-white/border-t/shadow`; PILL B vira o único container dono de border/fundo/radius/padding, textarea transparente, ações internas na base) + testes estruturais que falham se a duplicidade voltar. Sem tocar em voz, anexos, envio ou lógica.
