# CHAT-SUG-001 — Auditoria e Plano Técnico: Smart Suggestions

**Projeto:** `vanzacariasnutri` — ChatAssistant / Nutri Van
**Tipo:** Auditoria + Especificação Técnica fechada (sem implementação)
**Base:** Código real `src/components/ChatAssistant.tsx:1-1158`, `src/lib/contextBuilder.ts:1-875`, `src/lib/userDataBuilder.ts:1-192`, `src/app/api/nutri-assistant/patient/route.ts:1-632`, `src/app/api/nutri-assistant/admin/route.ts:1-415`, `src/app/dashboard/page.tsx:1-979`, `src/app/admin/useAdminDashboard.ts:529-551`, `src/app/admin/dashboard/page.tsx:1272`, `src/lib/vz015/types.ts:1-75`, `src/lib/checkin.ts:1-31`, docs de UX prévias (`CHAT-UX-*`, `COMPOSER-*`).
**Data:** 2026-09-06
**Status:** `AUDIT_COMPLETE` — plano pronto para `CHAT-SUG-002 (Implementação)`
**Sprint:** Somente auditoria + planejamento. Nenhum arquivo da aplicação foi alterado (verificado via `git status` limpo no início e baseline de testes).

---

## 1. Executive Summary

O ChatAssistant já possui um sistema de **"ações rápidas" (quick actions)**: dois arrays estáticos e hardcoded — `QUICK_ACTIONS_FREE` e `QUICK_ACTIONS_PREMIUM` — definidos em `src/components/ChatAssistant.tsx:124-134`, cada um com **exatamente 3 sugestões**. Estas sugestões são renderizadas **apenas no estado vazio** (`messages.length === 0`), exibidas como pills clicáveis, e **desaparecem permanentemente** após a primeira mensagem (`ChatAssistant.tsx:869-907`). Não há seleção contextual, não há randomização, não há anti-repetição, não há recálculo após resposta.

A auditoria conclui que **a intenção do produto já validada ("exatamente 3 sugestões, use como atalho de conversa") está parcialmente implementada**, mas de forma estática e sem contexto. A direção correta é **evoluir** este mecanismo existente para **Smart Suggestions** preservando integralmente o Composer e o layout estrutural já encerrados.

**Recomendação de arquitetura:** **Motor determinístico 100% no frontend** (catálogo estruturado + função de seleção pura + contexto derivado de dados já presentes no frontend). **Não haverá IA, backend nem nova API nesta versão.** Isso entrega uma melhora perceptível de qualidade/contextualização com custo zero de LLM, latência zero, previsibilidade total e testabilidade máxima (funções puras), liberando IA para uma evolução futura (CHAT-SUG-XXX) sem custo de re-arquitetura.

> **Nota de nomenclatura:** esta solução **não é "híbrida"** no sentido tradicional (não há componente de backend/IA). É essencialmente **catálogo estruturado + motor determinístico no frontend + contexto do Dashboard**. Evitar o termo "híbrido" para não induzir a criação de uma API.

Validação do estado atual (baseline, sem alterações): **480 testes passando** (`vitest --run`), **`tsc --noEmit` limpo**, **`eslint` 0 erros** (apenas 5 warnings pré-existentes em `ChatAssistant.tsx`).

---

## 2. Current Suggestions Architecture

### 2.1 Componente responsável
`ChatAssistant` (`src/components/ChatAssistant.tsx`) — a seção de sugestões vive no **empty state** (bloco `state.messages.length === 0`), linhas **891-905**:

```tsx
{!isRoleAdmin && (
  <div className="w-full flex flex-wrap justify-center gap-2 pt-1" role="group" aria-label="Ações rápidas">
    {quickActions.map((qa) => (
      <button
        key={qa}
        type="button"
        onClick={() => handleAsk(qa)}
        disabled={state.isLoading}
        className="min-h-[44px] px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-nutri-200 hover:text-nutri-700 hover:bg-nutri-50 shadow-sm text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
      >
        {qa}
      </button>
    ))}
  </div>
)}
```

- O bloco é renderizado **somente para pacientes** (`!isRoleAdmin`). **Admin não tem sugestões.**
- Usa `role="group"` + `aria-label="Ações rápidas"`.

### 2.2 Origem das sugestões

```ts
// src/components/ChatAssistant.tsx:120-123 (comentário VZ-013/VZ-017)
const QUICK_ACTIONS_FREE = [
  'Como está minha evolução?',
  'Como posso melhorar minha alimentação?',
  'Registrar uma refeição'
];

const QUICK_ACTIONS_PREMIUM = [
  'Como está minha evolução?',
  'O que devo priorizar hoje?',
  'Analisar uma refeição'
];
```

Seleção no componente principal (linha **529**):

```ts
const quickActions = canAccessMealPlan ? QUICK_ACTIONS_PREMIUM : QUICK_ACTIONS_FREE;
```

### 2.3 Quantidade atual
- Free: **3** (fixo)
- Premium: **3** (fixo)
- Admin: **0** (nenhum bloco)

### 2.4 Lógica de seleção
**Não existe.** A seleção é um `if canAccessMealPlan ? PREMIUM : FREE` — estática, medida por um único sinal binário (acesso Premium). Não há contexto, intenção, aleatoriedade ou estado.

### 2.5 Estado utilizado
- `messages.length` (para decidir se mostra o empty state) — `ChatAssistant.tsx:869`.
- `state.isLoading` (para desabilitar os botões durante loading) — `ChatAssistant.tsx:898`.
- `canAccessMealPlan` (para escolher o array) — `ChatAssistant.tsx:529`.

### 2.6 Comportamento após clique
- `onClick={() => handleAsk(qa)}` → `handleAsk` (linha 676-680) → `patientLogic.ask(text)`.
- `ask` (linha 269-273): limpa o input e chama `runExchange(text, null, true)`.
- `runExchange` (289-422) envia para `/api/nutri-assistant/patient` no **mesmo fluxo de mensagem normal** (streaming NDJSON). **Não há resposta hardcoded** (comentário VZ-013 FASE D confirma). As sugestões são **atalhos**, exatamente como a intenção do produto define.

### 2.7 Comportamento após envio
Após o clique, `state.messages` deixa de ser vazio → o bloco `messages.length === 0` deixa de renderizar → **as sugestões somem para sempre** até reabrir o chat (`isOpen` não reseta `messages`, então reabrir não reexibe — `messages` persiste no hook `useChatState`).

### 2.8 Comportamento após resposta do assistente
Nenhuma mudança de sugestão: uma vez que a conversa começou, elas não reaparecem. Não há recálculo em `done`, nem em `error`, nem em streaming.

### 2.9 Randomização existente
**Nenhuma.** Os arrays são renderizados em ordem fixa.

---

## 3. Current Context Available

Contexto já disponível no **frontend** (sem nova infraestrutura), verificado no código real:

### 3.1 No próprio ChatAssistant (componente)
| Dado | Origem | Onde | Uso atual |
|------|--------|------|-----------|
| `role` (`'admin' \| 'patient'`) | prop | `ChatAssistant.tsx:527` | roteia lógica/handle |
| `canAccessMealPlan` | prop boolean | `ChatAssistant.tsx:528` | Free vs Premium quick actions |
| `adminContext` | prop | `ChatAssistant.tsx:527` | contexto admin passado (apenas admin) |
| `messages` | estado local | `ChatAssistant.tsx:192` | histórico rol (user/assistant) |
| `isLoading` | estado local | `ChatAssistant.tsx:194` | disable + spinner |
| `streamingText` | estado local | `ChatAssistant.tsx:198` | streaming progressivo |
| `avatarMood` (`feliz/neutra/seria`) | estado local | `ChatAssistant.tsx:195` | mood visual (derivado do daily_log.mood) |
| `input / selectedImage / voice` | estado local | `ChatAssistant.tsx:193,197` | composição |

**Importante:** `ChatAssistant` hoje **não recebe** dados clínicos/diários/progresso do paciente via props no modo paciente. O dashboard (`src/app/dashboard/page.tsx:976`) passa apenas `role` e `canAccessMealPlan`.

### 3.2 Disponíveis no `Dashboard` (página pai, `src/app/dashboard/page.tsx`) — **não repassados ao Chat**
Estes dados já são carregados/computados no frontend do dashboard e são candidatos a contexto para Smart Suggestions (sem novas queries):
- `profile` (linha 120): `full_name`, `meta_peso`, `account_type`, `meal_plan`, `food_restrictions`, `data_nascimento`, `sexo`, etc.
- `checkins` (122): peso/altura/cintura/adesão/humor histórico.
- `dailyLog` (141-147): `water_ml`, `meals_checked`, `mood`, `activities`, `activity_kcal`.
- `hasCompletedQFA`, `hasDailyLogToday`.
- Derivados: `waterGoal`, `isWaterGoalMet`, `isMealPlanReady`, `mealNames`, `completedMeals`, `totalMeals`, `isMealGoalMet` (327-343).
- `isCheckinDoneThisWeek` (464) — lib `checkin.ts`.
- `canAccessMealPlan` (481), `isPremium` (480).
- `focusResult` (545): `getFocus(focusInput)` → ações priorizadas do dia (checkin/refeições/hidratação/adesão/atividade).
- `recoveryResult` (550): `getRecovery(...)` → estado de recuperação.
- `weightProgressPercent`, `deltas`, `smartFeedback`, timeline.

### 3.3 `adminContext` (admin, `src/app/admin/useAdminDashboard.ts:529-551`)
- `patients` (com `composicaoCorporal` derivada), `leads`, `usageStats`, `todayTotalMessages`.

### 3.4 Contexto nutricional do backend (para referência — NÃO reutilizar para a v1, pois exigiria chamada de API)
O servidor (`patient/route.ts`) constrói `UserData` completo (objetivo, meta, restrições, cardápio, macros, comportamento, temporal, progresso, jornada). Esse contexto **não é exposto ao frontend** (fica no servidor, correto por PII). Qualquer uso exigiria nova API — fora de escopo da v1.

### 3.5 Registro do que É e NÃO é reprocessável no frontend sem custo
- **Pode** (derivar no frontend, custo zero, dados já no cliente): mensagens do chat; estado da conversa (vazia/em andamento/loading/streaming); acesso premium; QFA concluído; plano pronto; check-in da semana; hidratação; refeições feitas; humor de hoje; atividade; conjunto de foco/recovery; `avatarMood`.
- **Não deve** (exigiria nova query/API ou exponeria PII): macros por refeição, cardápio detalhado, composição corporal, restrições específicas (sensível), comportamento/score — permanecem no servidor.

---

## 4. Current UX Behavior

| Aspecto | Comportamento atual | Fonte |
|---------|--------------------|------|
| **Quando aparecem** | Só no empty state (`messages.length===0`), só paciente | `ChatAssistant.tsx:869,891` |
| **Quando mudam** | Nunca (estáticas) | — |
| **Mudam após cada mensagem** | Não | — |
| **Somem durante loading** | Botões ficam `disabled` mas visíveis | `ChatAssistant.tsx:898` |
| **Durante streaming** | Sem alteração | — |
| **Mobile** | `flex-wrap justify-center` — quebram em até 3 linhas; touch `min-h-[44px]` OK | `ChatAssistant.tsx:892,899` |
| **Desktop** | Idêntico (uma linha de até 3 pills centradas) | — |
| **Acessibilidade** | `role="group"` + `aria-label`; botões nativos `<button>` com `type="button"` | `ChatAssistant.tsx:892-893` |
| **Teclado** | Navegáveis por tab (botões); sem atalho dedicado; Enter ativa | botões nativos |
| **Feedback ao clicar** | `active:scale-95` (pressionado), depois mensagem é enviada normalmente (loading) | `ChatAssistant.tsx:899` |
| **Header** | Não polui (está no body do empty state) | — |
| **Composer** | Não interfere (está acima do composer, no scroll area) | — |

**Limitações-chave (auditadas):**
1. **Desaparecem após 1ª mensagem** e não voltam — sem "ativação" contextual.
2. Sem diferenciação de intenção/contexto (a única variável é Free vs Premium).
3. Sem anti-repetição (não se aplica hoje porque só aparecem uma vez).
4. Sem determinismo/ordenamento por prioridade.
5. Admin não tem sugestões.

---

## 5. Architecture Options

### Opção A — Frontend determinístico (puro)
Seleção 100% no cliente via função pura que recebe um contexto estruturado (mensagens, estado, flags do dashboard) e devolve 3 sugestões do catálogo.

- **Complexidade:** Baixa. Um módulo puro `smartSuggestions.ts` + um `useMemo` no componente.
- **Latência:** Zero (síncrono, sem rede).
- **Custo:** Zero (sem LLM, sem API).
- **Previsibilidade:** Alta. Mesma entrada → mesma saída (com seed controlável para anti-repetição/rotation).
- **Testabilidade:** Excelente. Funções puras, vitest em node (padrão do projeto).
- **Privacidade:** Máxima. Nada sai do navegador; só sinais não-sensíveis.
- **Dependências:** Nenhuma nova.
- **Risco de regressão:** Baixo. Não toca Composer/header/layout; só o bloco de sugestões + um novo hook puro.
- **Compatibilidade:** Total. Mantém `handleAsk`/`runExchange` (atalho de mensagem).
- **Limitação:** contexto restrito ao que o frontend já conhece (não inclui macros/cardápio/composição). Para a v1 isso é aceitável e desejável.

### Opção B — Backend/IA (LLM define sugestões)
Uma rota (ex.: `POST /api/nutri-assistant/suggestions`) envia contexto do servidor ao LLM; este devolve 3 sugestões.

- **Complexidade:** Média-alta (nova rota, schema, parsing de resposta, fallback, cache).
- **Latência:** Alta (múltiplos segundos, TTFB antes da UI).
- **Custo:** Alto e recorrente (cada sugestão = tokens; usuário pode abrir o chat várias vezes).
- **Previsibilidade:** Baixa-média (LLM pode repetir, variar, vazar dado sensível na sugestão, quebrar formato).
- **Testabilidade:** Média (mock de LLM + parsing frágil).
- **Privacidade:** Pior (contexto clínico iria para o provedor de IA a cada render de sugestão).
- **Dependências:** já existe `genAI`; mas novo custo/rota.
- **Risco de regressão:** Médio (guardrails/streaming intactos, mas nova superfície de erro).
- **Compatibilidade:** Requer expor contexto no cliente (viola S1/PII) OU decisão no servidor com king de latência na abertura do chat.
- **Veredito:** adiar para evolução futura. Custo/latência/privacidade não justificam o ganho para "atalhos" simples.

### Opção C — Motor determinístico 100% no frontend (RECOMENDADA)
Catálogo estruturado + seleção determinística no frontend, com **contexto** derivado de sinais já presentes no frontend (passado via prop opcional do `Dashboard`). **Sem backend, sem IA, sem API.** Arquitetura desenhada para, **no futuro**, trocar a fonte do contexto por uma decisão de IA sem refazer a UI (seleção permanece como função pura; a única mudança seria a origem dos sinais).

> Nota: esta opção **não é "híbrida"** no sentido tradicional — não há componente de servidor/IA. É **100% frontend determinístico**; a nomenclatura evita induzir à criação de API.

- **Complexidade:** Baixa-média (módulo puro + prop tipada opcional + integração no `Dashboard`).
- **Latência:** Zero.
- **Custo:** Zero.
- **Previsibilidade:** Alta (regras + rotação/seed determinísticos, sem relógio).
- **Testabilidade:** Excelente (funções puras).
- **Privacidade:** Alta (sinais não-sensíveis).
- **Dependências:** Nenhuma nova.
- **Risco de regressão:** Baixo (Composer/header/layout intocados; prop opcional não quebra o contrato atual).
- **Compatibilidade:** Total com o `handleAsk`/`runExchange` existente.

### Comparação resumida

| Critério | A (puro) | B (IA) | C (frontend determinístico) |
|----------|----------|--------|-------------|
| Complexidade | Baixa | Média-alta | Baixa-média |
| Latência | 0 | Alta | 0 |
| Custo | 0 | Alto | 0 |
| Previsibilidade | Alta | Baixa-média | Alta |
| Testabilidade | Excelente | Média | Excelente |
| Privacidade | Máxima | Pior | Alta |
| Dependências | Nenhuma | genAI extras | Nenhuma |
| Risco de regressão | Baixo | Médio | Baixo |
| Compatibilidade | Total | Parcial | Total |

---

## 6. Recommended Architecture

**Adotar a Opção C — motor determinístico 100% no frontend, com seleção determinística e contexto do Dashboard.**

Decisões fechadas:
1. **Seleção** = função pura `selectSuggestions(context, lastIndex)` em módulo novo `src/lib/smartSuggestions.ts` (testável em node, padrão do projeto).
2. **Catálogo** = constante `SUGGESTION_CATALOG` no mesmo módulo (estruturado por intenção e `priority`).
3. **Contexto** = objeto tipado `SmartSuggestContext` construído no `ChatAssistant` a partir do estado local + flags opcionais recebidas do `Dashboard` via nova prop opcional `smartContext` (não obrigatória — mantém compatibilidade com admin/testes).
4. **Sem LLM, sem API nova, sem localStorage/persistência** na v1 (anti-repetição via estado em memória do componente).
5. **Quando** as sugestões aparecem: no empty state **e** após a resposta do assistente (recálculo). Sempra exatamente 3. (Detalhe UX na seção 12.)
6. **Interface** com o envio: continua usando `handleAsk(text)` → `ask` → `runExchange` — **zero mudança no Composer/fluxo de envio.**

A arquitetura é extensível: `SmartSuggestContext` usa tipos alinhados aos já existentes (`FocusInput`, `messages`, flags do dashboard), então uma futura `Opção B` trocaria apenas *como* o contexto é povoado (ex.: um resolver servidor), mantendo `selectSuggestions` e a UI intactas.

---

## 7. Suggested Catalog

Catálogo inicial **inédito proposto** — 12 sugestões organizadas por intenção/contexto. **Não inventa dados clínicos.** Sinais de ativação usam apenas dados já presentes no frontend.

### Ativo (recomendado para v1)

| # | id | label (texto exibido/enviado) | intenção | ativação (condição) | prioridade |
|---|----|------------------------------|----------|--------------------|-----------|
| 1 | `evolucao` | "Como está minha evolução?" | progresso | sempre (fallback) | P1 |
| 2 | `prioridade_dia` | "O que devo priorizar hoje?" | acompanhamento | sempre | P1 |
| 3 | `analisar_refeicao` | "Analisar uma refeição" | alimentação | sempre | P2 |
| 4 | `melhorar_alimentacao` | "Como posso melhorar minha alimentação?" | hábitos | sempre | P2 |
| 5 | `beber_agua` | "Como me hidratar melhor hoje?" | hábitos | `waterProgress < 100` (ou dailyLog com água < meta) | P1 |
| 6 | `registrar_refeicao` | "Registrar uma refeição" | refeições | sempre | P2 |
| 7 | `dicas_dia_a_dia` | "Dicas para vencer as tentações no dia a dia" | dúvidas nutricionais | sempre | P3 |
| 8 | `substituicoes` | "Quais alimentos posso substituir?" | planejamento | sempre | P2 |
| 9 | `proximas_refeicoes` | "O que devo comer na próxima refeição?" | refeições | `isMealPlanReady && canAccessMealPlan` | P1 |
| 10 | `hidratacao_meta` | "Qual minha meta de água?" | contexto geral | `waterGoal` presente | P3 |
| 11 | `checkin_atrasado` | "Quero fazer meu check-in da semana" | acompanhamento | `!isCheckinDoneThisWeek` | P1 |
| 12 | `tempo_progresso` | "Estou no caminho certo? Me dê um feed" | motivação | `checkins.length > 0` | P2 |

**Nota:** O catálogo acima propõe 12 itens. A implementação pode ajustar rótulos finais (copy) junto ao produto, mas deve **manter** os **5 itens hoje validados como referência** (1, 2, 3, 4, 6 — `evolucao`, `melhorar_alimentacao`, `registrar_refeicao`, `prioridade_dia`, `analisar_refeicao`) — sinalizados acima.

### Preservados/Modificados/Substituídos (referência vs atual)
| Sugestão atual | Status | Justificativa |
|----------------|--------|---------------|
| `Como está minha evolução?` (FREE+PREMIUM) | **Mantida** (`evolucao`) | principal atalho de progresso |
| `Como posso melhorar minha alimentação?` (FREE) | **Mantida** (`melhorar_alimentacao`) | atalho de hábitos |
| `Registrar uma refeição` (FREE) | **Mantida** (`registrar_refeicao`) | atalho de refeições |
| `O que devo priorizar hoje?` (PREMIUM) | **Mantida** (`prioridade_dia`) | atalho de acompanhamento |
| `Analisar uma refeição` (PREMIUM) | **Mantida** (`analisar_refeicao`) | atalho de alimentação |
| (nenhum) | **Adicionadas** | 7 novas para completar pool de 12 |

**Critérios do catálogo (regra de design):**
- Cada sugestão tem `id`, `label`, `intencao`, `priority` (1-3), e `ativaSe?: (ctx) => boolean`.
- `ativaSe === undefined` = **sempre ativa** (fallback seguro).
- Labels são **frases de conversa** (atalho), nunca afirmativas clínicas.
- **Sem dados clínicos inventados** — sinais são apenas flags de presença/estado.

---

## 8. Context/Intent Model

### 8.1 Estrutura do contexto (`SmartSuggestContext`)
Tipado em `src/lib/smartSuggestions.ts`:

```ts
export type SmartSuggestContext = {
  // estado da conversa (sempre disponível no ChatAssistant)
  messagesCount: number;          // messages.length
  lastRole?: 'user' | 'assistant'; // última mensagem (para recálculo pós-resposta)
  isLoading: boolean;             // nunca selecionar durante loading
  // flags do dashboard (opcional, via prop smartContext)
  isPremium?: boolean;
  canAccessMealPlan?: boolean;
  isMealPlanReady?: boolean;
  isCheckinDoneThisWeek?: boolean;
  waterGoal?: number | null;
  waterProgress?: number;         // 0-100
  hasDailyLogToday?: boolean;
  totalMeals?: number | null;
  completedMeals?: number;
  checkinsCount?: number;
  hasCompletedQFA?: boolean;
};
```

### 8.2 Sinais a utilizar (prioridade)
1. **Estado da conversa** (sempre): `messagesCount`, `lastRole`, `isLoading` — decide *quando* recalcular.
2. **Jornada/engajamento** (do dashboard, quando disponível): `isCheckinDoneThisWeek`, `isMealPlanReady`, `hasCompletedQFA`, `checkinsCount`.
3. **Execução de hoje**: `waterProgress`, `completedMeals`/`totalMeals`, `hasDailyLogToday`.
4. **Plano/assinatura**: `canAccessMealPlan`, `isPremium`.

### 8.3 Intenções (enum)
```ts
export type SuggestionIntent =
  | 'progresso' | 'acompanhamento' | 'alimentacao' | 'habitos'
  | 'planejamento' | 'duvidas' | 'refeicoes' | 'motivacao' | 'geral';
```

### Reutilização
Não criar nova infraestrutura de contexto: usa-se o modelo de flags que o `Dashboard` **já computa** (`focusInput`, `dailyLog`, `isCheckinDoneThisWeek`, etc.). Nenhuma nova query, nenhum novo estado global, nenhuma persistência.

---

## 9. Selection Algorithm

### 9.1 Função pura única

```ts
export function selectSuggestions(ctx: SmartSuggestContext, opts?: {
  seed?: number;               // para anti-repetição/determinismo em testes
  lastIds?: string[];          // ids do último conjunto exibido
  count?: number;              // default 3
}): Suggestion[] {
  const targetCount = opts?.count ?? 3;
  const candidates = SUGGESTION_CATALOG
    .filter(s => s.ativaSe ? s.ativaSe(ctx) : true)      // respeita contexto
    .filter(s => !(opts?.lastIds ?? []).includes(s.id)); // anti-repetição imediata
  // ...priorização por (priority, seed) e seleção de targetCount
}
```

### 9.2 Passos
1. `candidates` = itens do catálogo cuja `ativaSe(ctx)` é verdadeira (ou sempre-ativos).
2. **Ordem por prioridade**: `P1 < P2 < P3`.
3. **Darwin dentro de grupos**: usar shuffle determinístico com `seed` (Fisher–Yates com PRNG multiplicativo `(seed = (seed*1103515245 + 12345) % 2^31)`) para variar dentro da mesma prioridade sem aleatoriedade não-testável.
4. Índice de rotação (`rotationIndex`): para grupos P1, avançar um offset a cada recálculo (anti-repetição por rotação, ver §10).
5. Pegar exatamente o primeiro `targetCount` dos candidatos ordenados.
6. **Garantia de 3:** se `candidates.length < 3` após filtro de anti-repetição, reinserir sugestões **sempre-ativas** (`ativaSe===undefined`) que foram excluídas apenas pelo `lastIds`, na ordem de prioridade. Se ainda assim não houver (catálogo < 3), o catálogo garante ≥ N sempre-ativos (invariante documentada — o pool tem 12, dos quais vários são sempre-ativos).
7. **Invariante de saída:** a função **nunca retorna** um array com tamanho ≠ `count` (default 3) quando `ctx` válido e catálogo suficiente. Lança `Error` em teste se o catálogo for inconsistente (fail-fast em dev/test).

### 9.3 Como identificar o contexto e priorizar
- Contexto = `SmartSuggestContext` (§8).
- Priorizar: primeiro por `priority` (P1 primeiro), depois por ordenação determinística com seed/rotação.
- Evitar 3 semelhantes: não agrupar duas sugestões da mesma `intencao` no topo 3 — o algoritmo inclui uma **regra de diversidade**: ao montar os 3, prefere intenções distintas; se as 3 melhores por prioridade colidirem em intenção, troca a 3ª pela próxima de intenção diferente que ainda seja ativa (se existir), senão mantém.

### 9.4 Fallback
- `candidates` vazias (ex.: flags ausentes / todas inativas): usar o subconjunto de **sempre-ativas** (`ativaSe===undefined`), prioridade 1 → 3.
- Se `ctx` não fornecer flags (admin/uso sem `smartContext`): o fallback vira o catálogo sempre-ativo (estático genérico) — **mantém o comportamento atual** de 3 sugestões para paciente e continua sem sugestões para admin (fície decidida, ver §12).

### 9.5 Quando recalculadas
A cada mudança relevante de estado → via `useMemo` no componente dependendo de `[messages, isLoading, streamingText, smartContext]`. Em particular:
- **Abertura do chat** (empty) → conjunto inicial (seed baseado em contagem de mensagens).
- **Após envio** (user message) → durante loading, manter (visível disabled) ou ocultar conforme decisão UX (§12).
- **Após resposta** (assistant message → `lastRole==='assistant'`) → **recalcular** (novo conjunto, garantida rotação).
- **Após erro** → manter últimos, sem spam.

---

## 10. Anti-Repetition Strategy

**Mecanismo escolhido: rotação determinística + memória do último conjunto**, em memória (estado do componente). Sem localStorage/Supabase.

1. **Memória do último conjunto**: estado `lastSuggestionIdsRef = useRef<string[]>` (ref, não causa re-render) ou estado `useState<string[]>` no componente com último conjunto exibido.
2. **No recálculo**, `selectSuggestions(ctx, { lastIds, seed })` exclui os ids do conjunto anterior e aplica seed/rotação para os demais.
3. **Rotação**: dentro do bloco de candidatos de mesma prioridade, o `rotationIndex` avança (módulo do tamanho do grupo) a cada recálculo, garantindo circulação mesmo que as prioridades P1 sejam as mesmas.
4. **Seed determinístico**: `seed` é um **contador de rotação em memória** (inteiro incremental fornecido/avançado pelo componente), **não o relógio** — `Date.now()` não entra no algoritmo. Isso preserva previsibilidade e permite reprodução em testes com `seed`/`rotationIndex` fixos.

**Regra de ouro:** o usuário **nunca vê imediatamente o mesmo conjunto de 3** após uma atualização de contexto. Com 12 itens e várias sempre-ativas, há conjuntos alternativos disponíveis na maioria dos recálculos.

**Simplicidade**: nada de histórico longo ou matriz de frequência — um único `lastIds` (3 ids) + rotação. Suficiente para o objetivo e barato.

---

## 11. Fallback Strategy

| Cenário | Comportamento |
|---------|---------------|
| Catálogo disponível e contexto suficiente | Seleção normal (3) |
| Contexto sem flags (admin / sem `smartContext`) | Subconjunto **sempre-ativo** (ex.: evolucao, prioridade_dia, analisar_refeicao) |
| Menos de 3 candidatos após anti-repetição | Reinserir sempre-ativos excluídos; se ainda < 3, preencher com sempre-ativos até 3 (invariante mantida) |
| Catálogo inconsistente (< 3 sempre-ativos) | **fail-fast** (throw em dev/test) — nunca renderizar menos de 3 silenciosamente |
| Loading/streaming | Segue regra §12 (ocultar/desabilitar) sem romper a invariante de contagem quando visíveis |

---

## 12. UX Specification

### 12.1 Posicionamento
Mantém o bloco atual no **corpo do chat** (área de scroll), **abaixo da última mensagem** (assistente) ou no empty state — **fora do Composer, fora do header**. Não altera o Composer nem o layout estrutural.

### 12.2 Estados de exibição (regra fundamental: sempre exatamente 3 quando visível)

| Estado | Comportamento |
|--------|---------------|
| **Chat vazio (aberto)** | Exibe 3 sugestões (conjunto inicial) |
| **Usuário digitou / focus Composer** | Manter sugestões visíveis (não interfere) |
| **Enviou mensagem (user, loading)** | Ocultar (evita cliques conflitantes durante processamento) — decisão: **ocultar durante loading** |
| **Streaming resposta** | Continuar oculto |
| **Resposta concluída (assistant)** | **Reexibir 3 novas** (recalculadas) abaixo da resposta |
| **Erro** | Manter estado anterior (sem recálculo, sem spam) |
| **Admin** | Sem sugestões (comportamento atual preservado) |

> Nota de decisão: ocultar durante loading/streaming evita que as sugestões fiquem obsoletas enquanto a IA responde; reexibi-las após `done` com um **conjunto novo** é o ganho central de "smart". Implementação deve garantir que, **sempre que o bloco estiver presente**, ele contenha exatamente 3.

### 12.3 Visual (preservar validações CHAT-UX)
- Pills compactas: seguir o padrão visual já validado do empty state (`rounded-full bg-white border border-stone-200 text-stone-700 hover:border-nutri-200 hover:text-nutri-700 hover:bg-nutri-50 shadow-sm text-[13px] font-semibold active:scale-95`).
- `min-h-[44px]` (touch), `flex-wrap` com `justify-start`/`justify-center` responsivo.
- **Sem poluir o header**, sem alterar o Composer, sem reabrir problemas encerrados.

### 12.4 Mobile vs Desktop
- **Mobile**: `flex-wrap`, pills quebram até 3 linhas sem overflow; `44px` de altura de toque; safe-area preservada (não alterada).
- **Desktop**: até 3 pills em uma linha (ou 2 linhas se os textos forem longos), centradas.

### 12.5 Acessibilidade
- `role="group"` + `aria-label` (ex.: "Sugestões de conversa").
- `<button type="button">` nativos → navegáveis por tab; Enter/Espaço ativam.
- `disabled` quando loading/oculto não presente — quando oculto, apenas não renderiza (sem aria vivo de mudança constante para não poluir leitores).
- Contraste: cores atuais OK (stone-700 sobre white). Manter `focus-visible` padrão dos botões do projeto.

### 12.6 Teclado
- Tab entre botões; Enter ativa (nativo). Sem conflito com Enter do Composer (que só cria nova linha — decisão CHAT-UX-006 preservada).

### 12.7 Feedback ao clicar
- `active:scale-95` (mantido); ao clicar, envia mensagem via `handleAsk` → `runExchange`, com loading padrão. Sem feedback custom adicional (preserva fluxo existente).

---

## 13. Performance Analysis

| Custo | Impacto |
|-------|---------|
| **Renderizações** | 1 bloco re-renderizado via `useMemo`; sem loops. Catálogo pequeno (12). Termina em O(n). |
| **Chamadas de API** | **Zero** (v1 puramente cliente). |
| **Latência** | Zero (síncrono). |
| **Custo de LLM** | Zero. |
| **Recomputação** | Um `useMemo` por mudança de `[messages, isLoading, streamingText, smartContext]`; barato. |
| **Tamanho do catálogo** | 12 itens — desprezível. |
| **Persistência de estado** | Só memória do componente (`lastIds` ref + seed counter). Sem storage/network. |

**Meta v1:** rápida + previsível + barata + testável. Confirmada: sem rede, sem LLM, sem persistência.

---

## 14. Accessibility Considerations
- Manter `role="group"` + `aria-label` (nome atualizar de "Ações rápidas" para algo neutro como "Sugestões").
- Botões nativos, `type="button"`, `44px` de alvo.
- Controle de `aria-live` para evitar leitura repetitiva a cada recálculo: usar `aria-live="polite"` apenas no **containter do grupo** quando houver mudança de conjunto, ou nenhum aria-live (sugestões são decorativas/atalhos; leitor já anuncia `<button>` focado). **Recomendação:** sem `aria-live` no grupo (evita ruído); foco manual segue o usuário.
- Não reordenar elementos enquanto o usuário navega (evita perda de foco): recálculo ocorre após `done`, quando o foco geralmente está no corpo.
- Contraste dos pills preserva as cores atuais aprovadas.

---

## 15. Testing Strategy

Local: `src/lib/__tests__/smartSuggestions.test.ts` (padrão vitest node do projeto) + testes de fonte para o ChatAssistant.

### Seleção
- `selectSuggestions` retorna **exatamente 3** em contexto vazio/válido.
- Retorna apenas sugestões **ativas** (respeita `ativaSe`).
- Prioridade P1 vem primeiro quando disponível.
- **Diversidade de intenção**: 3 selecionadas não têm 3 intenções idênticas quando há alternativas.
- Fallback: contexto sem flags → 3 sempre-ativas.
- Invariante: lança erro se catálogo < 3 (dev/test).

### Anti-repetição
- `selectSuggestions(ctx, {lastIds})` não retorna o conjunto anterior.
- Com `lastIds` bloqueando as sempre-ativas, ainda seleciona 3 se houver alternativas ativas.
- Rotação avança com seed diferente.

### Estado
- Conversa vazia (messagesCount=0) → conjunto inicial.
- Com mensagens (messagesCount>0, lastRole='assistant') → conjunto recalculado ≠ anterior.
- `isLoading=true` → bloco oculto (teste de fonte no ChatAssistant: condição de render).
- Após envio (lastRole='user') → oculto durante loading.
- Após resposta (lastRole='assistant') → reexibido.

### UX (fonte, padrão `composerCOMPOSER001.test.ts`)
- Clique de sugestão dispara `handleAsk`/`ask` com mesmo fluxo de envio (mensagem normal).
- Composer **permanece intacto** (mesmos invariantes COMPOSER-001/CHAT-UX-006).
- Mobile/Desktop intactos (sem mudança de classes estruturais).
- Exatamente 3 botões presentes quando o bloco é renderizado.

### Regressão
- Roda suíte completa (`vitest --run`) — 480 testes atuais devem continuar passando.
- `tsc --noEmit` limpo.
- `eslint` sem novos erros.

---

## 16. Implementation Plan (para CHAT-SUG-002)

1. **Criar** `src/lib/smartSuggestions.ts`:
   - `SuggestionIntent`, `SmartSuggestContext`, `Suggestion` types.
   - `SUGGESTION_CATALOG` (12 itens, conforme §7).
   - `selectSuggestions(ctx, opts)` puro + `createSeed()` PRNG + rotação.
2. **Criar** `src/lib/__tests__/smartSuggestions.test.ts` (seção §15).
3. **Integrar no ChatAssistant** (`src/components/ChatAssistant.tsx`):
   - Nova prop opcional `smartContext?: SmartSuggestContext-partial` no tipo `ChatAssistantProps` (paciente).
   - `const suggestions = useMemo(() => selectSuggestions(context, {lastIds}), [deps])`.
   - Estado/ref `lastSuggestionIds` + contador de seed.
   - Refatorar bloco de sugestões do empty state em um **sub-componente/helper reutilizável** (`renderSuggestions`) exibido também abaixo da última mensagem.
   - Condições de exibição conforme §12 (ocultar durante loading/streaming; reexibir após `done`).
   - Manter `handleAsk`/`runExchange` intocados.
4. **Integrar no Dashboard** (`src/app/dashboard/page.tsx:976`):
   - Passar `smartContext` derivado de `focusInput`, `dailyLog`, `waterProgress`, `isCheckinDoneThisWeek`, `isMealPlanReady`, `checkins`, etc.
5. **Adicionar testes de fonte** no ChatAssistant (estado/UX).
6. **Rodar**: `vitest --run`, `tsc --noEmit`, `eslint`.
7. **Build staging + teste manual mobile/desktop** (deploy posterior).

---

## 17. Files Expected to Change

Em `CHAT-SUG-002`:
- `src/lib/smartSuggestions.ts` — **novo** (catálogo + seleção + rotação).
- `src/lib/__tests__/smartSuggestions.test.ts` — **novo**.
- `src/components/ChatAssistant.tsx` — prop opcional `smartContext`, `useMemo` de seleção, bloco de sugestões reutilizável, condições de exibição. **Somente** no trecho de sugestões; nada no Composer/textarea/voz/header.
- `src/app/dashboard/page.tsx` — passar `smartContext` ao `<ChatAssistant>`. **Somente** a prop.
- Opcional: `src/components/__tests__/smartSuggestionsUX.test.ts` — **novo** (testes de fonte).

---

## 18. Files That Must Not Change

(Guardrails da sprint — preservar intactos)
- `src/components/composerAutoGrow.ts`
- `src/lib/voice/**` (voz/gravação/transcrição)
- `src/components/Header.tsx`, layout estrutural (`PatientAppShell`, `PatientPageShell`, painel/overlay/drag)
- `src/components/ChatAssistant.tsx` **nas regiões**: paint do Composer (`composerRef`/grid/textareas/botões attach-mic-send), waveform, voz, anexo, header, overlay/drag — **apenas o bloco de sugestões muda**.
- `src/app/api/nutri-assistant/patient/route.ts` e `admin/route.ts` (backend nutricional/RAG/modelo)
- `src/lib/contextBuilder.ts`, `userDataBuilder.ts`, `memorySummary.ts`, `embeddingService.ts`, `semanticSearch.ts` (RAG/memória)
- `src/lib/supabase/**`, schema Supabase, autenticação
- `package.json` (exceto se necessário para dev-tooling de teste — não é)
- Qualquer arquivo de build/config não relacionado

---

## 19. Risks

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Regressão no Composer/UX encerrada | Alto | Bloco de sugestões isolado; testes de fonte COMPOSER/CHAT-UX como rede de segurança; não tocar no composer |
| Invariante "exatamente 3" quebrada em estado raro | Médio | Função pura com garantia + fail-fast; testes de seleção |
| Componente cresce (complexidade no ChatAssistant) | Médio | Lógica isolada em `smartSuggestions.ts` (puro), componente só consome |
| Recálculo durante streaming causa flicker | Baixo | Ocultar durante loading/streaming; reexibir só no `done` |
| Flags do dashboard ausentes (admin/testes) | Baixo | Prop opcional + fallback para sempre-ativas (comportamento atual preservado) |
| Conjunto repetido por poucos ativos | Baixo | Rotação + seed; diversidade de intenção |

---

## 20. Out of Scope

- **Novo sistema de IA / agente / API** para seleção (adiado — Opção B futura).
- **Nova infraestrutura de contexto / localStorage / Supabase** para anti-repetição.
- **Alterações no Composer, textarea, voz, gravação, transcrição, header, overlay, drag, painel.**
- **Alterações no backend nutricional, RAG, memória, modelo principal, autenticação, schema.**
- **Refatorações oportunistas** e correções não relacionadas.
- **Admin suggestions** (mantém sem sugestões).
- **Melhorias visuais fora do bloco de sugestões.**

Problemas encontrados fora do escopo (documentados, **não corrigidos**):
- Lint warnings pré-existentes em `ChatAssistant.tsx:248,250,430,625,718` (exhaustive-deps + unused directive).
- `avatarMood` como único sinal de humor disponível no Chat (o daily mood real não é repassado ao chat).

---

## 21. Definition of Done

Para o `CHAT-SUG-002` (próxima sprint):
- [ ] `src/lib/smartSuggestions.ts` criado, puro, tipado.
- [ ] Catálogo de 12 sugestões, **5 originais preservadas**.
- [ ] `selectSuggestions` sempre retorna 3 (com fail-fast dev/test).
- [ ] Anti-repetição (lastIds + rotação/seed) implementado e testado.
- [ ] ChatAssistant integra sugestões reutilizáveis no empty state e pós-resposta; oculta durante loading/streaming.
- [ ] `smartContext` propagado do Dashboard (prop opcional) sem quebrar admin/testes.
- [ ] Composer/header/layout/backend **intocados** (verificável por git diff + testes).
- [ ] Novos testes de seleção + estado + UX + regressão; **suíte completa verde** (480+ novos).
- [ ] `tsc --noEmit` limpo; `eslint` sem novos erros.
- [ ] Validado em mobile e desktop.
- [ ] Documento `CHAT-SUG-002-REPORT.md` preenchido.

---

## 22. Final Recommendation

**Implementar Smart Suggestions na próxima sprint (CHAT-SUG-002) usando a Opção C — motor determinístico 100% no frontend (catálogo estruturado de 12 sugestões + função de seleção pura + contexto do Dashboard), com anti-repetição por rotação/seed em memória, sem LLM, sem backend e sem API nova.**

Essa escolha:
- preserva 100% os contratos encerrados (Composer, header, layout, backend);
- entrega valor perceptível (sugestões contextuais, recalculadas, sem repetição) com custo zero e latência zero;
- mantém o produto **rápido, previsível, barato e testável** (funções puras);
- e deixa **porta aberta** para uma futura seleção por IA sem re-arquitetura (basta trocar a origem do `SmartSuggestContext`).

Nenhum código da aplicação foi alterado nesta sprint (baseline: 480 testes verdes, `tsc` limpo, `eslint` 0 erros).

---

*Fim do relatório.*
