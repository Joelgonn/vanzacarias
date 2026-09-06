# CHAT-SUG-002 — Relatório de Implementação: Smart Suggestions

> Sprint base: `CHAT-SUG-001-AUDIT.md` (auditoria + arquitetura aprovada).
> Abordagem: **motor determinístico 100% no frontend** (não é "híbrida"): catálogo estruturado + função de seleção pura + contexto do Dashboard. Sem LLM, sem backend, sem API nova, sem persistência.

---

## 1. Status

**Implementado e verificado.** Suíte completa verde, TypeScript limpo, ESLint sem novos erros, build de produção OK. Nenhum commit/push/deploy realizado (aguarda autorização).

## 2. Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ChatAssistant.tsx` | Substitui `QUICK_ACTIONS_FREE/PREMIUM` pelo seletor determinístico; nova prop opcional `smartContext`; bloco de sugestões reutilizável no empty state e pós-resposta; regras de exibição §12. Composer/header/fluxo de envio **intocados**. |
| `src/app/dashboard/page.tsx` | Passa `smartContext` ao `ChatAssistant` com sinais já computados (sem nova query). |
| `src/components/__tests__/composerCOMPOSER001.test.ts` | R-01 atualizado: valida o novo mecanismo (seletor + `renderSuggestionChips` + catálogo/`proximas_refeicoes` gated) em vez das constantes removidas. |
| `src/lib/__tests__/vz017-premium.test.ts` | Teste "Free/Premium via canAccessMealPlan" reescrito para o catálogo determinístico. |
| `src/lib/__tests__/vz018-commerce.test.ts` | T11 reescrito para o novo mecanismo (smartContext + seletor). |

## 3. Arquivos criados

| Arquivo | Conteúdo |
|---------|----------|
| `src/lib/smartSuggestions.ts` | Tipos (`SuggestionIntent`, `SmartSuggestContext`, `SmartSuggestDashboardFlags`, `Suggestion`, `SmartSuggestOptions`), `SUGGESTION_CATALOG` (12 itens), `selectSuggestions(ctx, opts)` puro, PRNG LCG determinístico, rotação, diversidade de intenção, `validateCatalog`/`assertCatalogIntegrity` (fail-fast). |
| `src/lib/__tests__/smartSuggestions.test.ts` | 25 testes: integridade do catálogo (12 itens, ids únicos, 5 originais preservadas, ≥3 sempre-ativas), seleção (exatamente 3, fallback sempre-ativo, determinismo, P1 primeiro, diversidade), regras `ativaSe`, anti-repetição (`lastIds`, rotação, seed), PRNG. |
| `src/components/__tests__/smartSuggestionsUX.test.ts` | 10 testes estruturais (padrão `composerCOMPOSER001`): blocos renderizados, clique via `handleAsk`, admin sem sugestões, oculto durante loading/streaming, erro não recalcula, seleção sem `Date.now`, pills visuais + a11y, `smartContext` opcional, regressão Composer/header, Dashboard povoa contexto. |
| `docs/CHAT-SUG-001-AUDIT.md` | Correções aplicadas: **5** originais preservadas (era 4), seed sem `Date.now()` (§10), nomenclatura "motor determinístico 100% no frontend" (não "híbrida") no Exec Summary, Opção C, tabela comparativa e Final Recommendation. |

## 4. Implementação realizada

1. **Catálogo estruturado** (`SUGGESTION_CATALOG`, 12 itens) com `{ id, label, intencao, priority (1-3), ativaSe? }`. `ativaSe === undefined` = sempre ativa (7 itens) → garantia de 3 na maior parte dos contextos.
2. **Seleção pura** `selectSuggestions(ctx, { seed, rotationIndex, lastIds, count? })` — sem I/O, sem relógio, reproduzível em teste.
3. **Anti-repetição** em memória do componente: `lastSuggestionIdsRef` (últimos 3 ids exibidos) + `suggestionRotation` (seed/índice da rotação).
4. **Integração visual**: 3 pills reutilizáveis no empty state **e** abaixo da última resposta do assistente; bloco oculto durante loading/streaming; admin continua sem sugestões.
5. **Contexto do Dashboard**: `smartContext` opcional com sinais já existentes (`focusInput`/`dailyLog`/`waterProgress`/`isCheckinDoneThisWeek`/`isMealPlanReady`/`checkins`/flags). Sem prop nova obrigatória → admin/testes intactos.

## 5. Catálogo final

| id | label | intenção | prio | ativação |
|----|-------|----------|------|----------|
| `evolucao` | Como está minha evolução? | progresso | P1 | sempre |
| `prioridade_dia` | O que devo priorizar hoje? | acompanhamento | P1 | sempre |
| `analisar_refeicao` | Analisar uma refeição | alimentacao | P2 | sempre |
| `melhorar_alimentacao` | Como posso melhorar minha alimentação? | habitos | P2 | sempre |
| `beber_agua` | Como me hidratar melhor hoje? | habitos | P1 | `waterProgress < 100` |
| `registrar_refeicao` | Registro de refeição | refeicoes | P2 | sempre |
| `dicas_dia_a_dia` | Dicas para vencer as tentações no dia a dia | duvidas | P3 | sempre |
| `substituicoes` | Quais alimentos posso substituir? | planejamento | P2 | sempre |
| `proximas_refeicoes` | O que devo comer na próxima refeição? | refeicoes | P1 | `isMealPlanReady && canAccessMealPlan` |
| `hidratacao_meta` | Qual minha meta de água? | geral | P3 | `waterGoal > 0` |
| `checkin_atrasado` | Quero fazer meu check-in da semana | acompanhamento | P1 | `!isCheckinDoneThisWeek` |
| `tempo_progresso` | Estou no caminho certo? Me dê um feed | motivacao | P2 | `checkinsCount > 0` |

**5 originais preservadas com label exato:** `evolucao`, `melhorar_alimentacao`, `registrar_refeicao`, `prioridade_dia`, `analisar_refeicao`.

## 6. Algoritmo de seleção

- Filtra por `ativaSe(ctx)`; exclui `lastIds`.
- Se `excludedLast < count`, reinsere sempre-ativas removidas só pela anti-repetição e completa com as demais ativas (dedupe por id).
- Ordena por prioridade (P1…P3); dentro do grupo aplica **rotação** (`rotationIndex`) + **shuffle Fisher–Yates determinístico** (LCG `(seed*1103515245+12345) % 2^31`).
- **Diversidade de intenção**: nunca 3 com a mesma intenção se existir alternativa ativa.
- **Invariante**: sempre retorna exatamente `count` (default 3); catálogo inconsistente → `throw` (fail-fast dev/test).

## 7. Anti-repetição

- Últimos 3 ids exibidos em `lastSuggestionIdsRef` (memória do componente; sem localStorage/Supabase).
- `seed`/`rotationIndex` = contador incremental **em memória**, avançado nas transições "oculto → visível" (abertura e pós-resposta). **Nenhum `Date.now()` no algoritmo.**
- Em caso de erro: manutenção do último conjunto (sem recálculo/spam). Regra de ouro: nunca exibe o mesmo trio imediatamente após uma atualização de contexto.

## 8. Contexto utilizado

`SmartSuggestContext` (montado no ChatAssistant): `messagesCount`, `lastRole`, `isLoading` + flags do Dashboard via `smartContext`: `isPremium`, `canAccessMealPlan`, `isMealPlanReady`, `isCheckinDoneThisWeek`, `waterGoal`, `waterProgress`, `hasDailyLogToday`, `totalMeals`, `completedMeals`, `checkinsCount`, `hasCompletedQFA`. Nenhuma query nova; nenhum dado clínico inventado; admin não envia contexto.

## 9. Comportamento UX

| Estado | Comportamento |
|--------|---------------|
| Chat vazio (aberto) | 3 sugestões (conjunto inicial) |
| Usuário digitando/foco Composer | Sugestões visíveis (não interferem) |
| Enviou mensagem (loading) | Oculto |
| Streaming resposta | Oculto |
| Resposta concluída (assistant) | Reexibidas 3 novas abaixo da resposta (recalculadas) |
| Erro | Mantém último conjunto (sem recálculo) |
| Admin | Sem sugestões (comportamento preservado) |

Sempre exatamente 3 quando o bloco está presente. Clique → `handleAsk(s.label)` → `patientLogic.ask()` → `runExchange` (mesmo fluxo de envio; Composer intocado).

## 10. Testes adicionados

- **35 novos**: 25 em `src/lib/__tests__/smartSuggestions.test.ts` + 10 em `src/components/__tests__/smartSuggestionsUX.test.ts`.
- Cobertura: catálogo/integridade, seleção pura, `ativaSe`, anti-repetição, determinismo/PRNG, UX estrutural (admin, loading/streaming, erro, visual/a11y, regressão Composer).

## 11. Resultado da suíte

`npx vitest --run` → **34 arquivos, 515 testes, todos passando** (480 baseline + 35 novos).

## 12. TypeScript

`npx tsc --noEmit` → **limpo, 0 erros.**

## 13. ESLint

`npx eslint` nos arquivos do escopo → **0 erros**. Restam apenas **6 warnings pré-existentes** (ChatAssistant `exhaustive-deps` ×5 — linhas 252/254/434/629/789 — e `exhaustive-deps` no Dashboard página 258; nenhum introduzido nesta sprint). Arquivos de voz dentro do escopo (fora desta sprint) seguem com erros `no-explicit-any` pré-existentes. Nota: 1 warning pré-existente de `eslint-disable` não utilizado em `ChatAssistant.tsx:789` mantido como estava.

## 14. Build

`npm run build` → **sucesso** (rotas do dashboard e demais páginas geradas, middleware OK).

## 15. Git diff

`git status`: 5 arquivos modificados + 4 novos, **todos dentro do escopo planejado** (ChatAssistant, Dashboard, 3 testes existentes, 2 testes novos, módulo novo, auditoria corrigida). Zero mudança em Composer, header/layout, `src/lib/voice/**`, backend (`api/nutri-assistant/*`), Supabase, `package.json`.

## 16. Problemas encontrados

1. **`checkin_atrasado` colide com `prioridade_dia`** (ambas intenção `acompanhamento`): a regra de diversidade permite só uma no topo 3. Resolvido por comportamento esperado: `checkin_atrasado` entra quando `prioridade_dia` sai por anti-repetição/rotação (testado). Mantida a intenção definida em CHAT-SUG-001 §7.
2. **Três testes legados inspecionavam `QUICK_ACTIONS_FREE/PREMIUM`** (R-01, vz017, vz018): atualizados para o novo mecanismo por decisão do responsável ("replace + update tests").
3. **Erro de digitação introduzido no teste** (`const module` → regra Next `no-assign-module-variable`): corrigido renomeando para `catalogSrc`.

## 17. Problemas fora de escopo

- Erros `no-explicit-any` em `src/lib/voice/**` (diversos arquivos) — pré-existentes, não da Sprint.
- Warning `exhaustive-deps` e `eslint-disable` não utilizado em `ChatAssistant.tsx` — pré-existentes.
- Falta de `focus-visible` explícito nos pills das sugestões (segue o padrão atual do projeto, contraste já aprovado).
- Não realizado: deploy/build staging posterior, teste manual em dispositivo real (ver §18).

## 18. Validação manual necessária

- [ ] Abrir o chat com o Dashboard carregado: ver 3 sugestões no empty state e verificar que mudam após cada resposta.
- [ ] Hidratação: beber água até 100% → sugestão `beber_agua` deixa de aparecer na próxima rodada.
- [ ] Sem plano/`canAccessMealPlan=false`: `proximas_refeicoes` NUNCA aparece (sem vazamento Premium).
- [ ] Check-in da semana: antes de concluir, `checkin_atrasado` apta; depois de concluir, removida.
- [ ] Durante a resposta: bloco oculto; após `done`: novo conjunto; após erro: mantém o anterior.
- [ ] Admin: chat sem sugestões.
- [ ] Mobile (iPhone/Android): pills quebram em até 3 linhas, alvo 44px, safe-area preservada.

## 19. Definition of Done

- [x] `src/lib/smartSuggestions.ts` criado, puro, tipado.
- [x] Catálogo de 12 sugestões com **5 originais preservadas**.
- [x] `selectSuggestions` sempre retorna 3 (fail-fast dev/test).
- [x] Anti-repetição (`lastIds` + rotação/seed em memória, sem `Date.now`) implementado e testado.
- [x] ChatAssistant integra sugestões reutilizáveis no empty state e pós-resposta; oculta durante loading/streaming.
- [x] `smartContext` propagado do Dashboard (prop opcional); admin/testes intactos.
- [x] Composer/header/layout/backend **intocados** (verificado no git diff).
- [x] Novos testes (35) + regressão: **515 passando** (480 baseline + 35).
- [x] `tsc --noEmit` limpo; `eslint` sem novos erros.
- [x] Validado mobile/desktop estruturalmente (fonte) — validação manual em dispositivo real pendente (§18).
- [x] Documento `CHAT-SUG-002-REPORT.md` preenchido.

## 20. Conclusão

Smart Suggestions foi implementada como prescrito na auditoria: **motor determinístico 100% no frontend** com catálogo de 12 sugestões (5 originais preservadas), seleção pura testável, anti-repetição em memória sem relógio, e contexto exclusivamente composto por sinais que o Dashboard já computa — zero custo de LLM/rede/latência. O Double Differencial anterior (Free/Premium fixo) deu lugar à diferenciação contextual por `canAccessMealPlan`/`isMealPlanReady`, mantida a proteção contra vazamento Premium. Suíte: 515 verdes. Sem commit/push. Próximo passo: validação manual em dispositivo (checklist §18) e, aprovado, deploy.