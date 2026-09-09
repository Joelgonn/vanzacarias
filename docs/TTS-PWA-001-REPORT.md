# TTS-PWA-001 REPORT

> Período: 2026-09-08 · App: `vanzacariasnutri` (Next.js 16.1.6 · PWA Serwist · um único service worker) · Engine: `voice-synthesis` (intacto) · Chrome 152 headless (real) · Evidência: CONFIRMADO / INFERIDO / NÃO VERIFICADO / BLOCKED

## Objective

Permitir o fluxo `PWA → offline → TTS Consumer → Browser Runtime → Worker → onnxruntime-web/WASM → Kokoro Q8 + pf_dora → AudioResult → Player` **sem servidor durante a síntese**, uma vez que os assets TTS estejam disponíveis localmente — integrando apenas o necessário ao PWA Serwist existente, sem tocar no `voice-synthesis`/Browser Runtime/Worker/vozz/player/ChatAssistant e sem precache ingênuo dos ~92 MB.

## Current PWA Architecture

- Único Service Worker (`src/sw.ts`, Serwist): precache de build (`__SW_MANIFEST`, limite 5 MB via `next.config.ts`), `defaultCache` (serwist/next) e **uma regra CacheFirst dedicada pré-existente** para o modelo Vosk (32 MB, `vosk-model`) registrada antes do `defaultCache` (first-match wins).
- Assets TTS servidos por: `/api/tts/models/*` (route handler → `voice-synthesis/models/kokoro`), `/api/tts/wasm/*` (→ `onnxruntime-web/dist`) e `/tts/worker.js` (estático, gerado no build, **já entra no precache do build** — 493 KB < 5 MB).
- O fetch dos assets é feito pelo **Worker do Browser Runtime** durante o load on-demand (nada no main thread); a API route usa `Cache-Control: no-store`.

## TTS Assets

Inventário (D01) — unidade TTS do Browser Runtime:

| Asset | URL (app) | Bytes | Origem | Precisa cache? | Versionado por |
| --- | --- | ---: | --- | --- | --- |
| Modelo Kokoro Q8 | `/api/tts/models/model_quantized.onnx` | 92 361 116 | `voice-synthesis/models/kokoro` | **sim (92 MB)** | unidade `tts-assets-v1` |
| Tokenizer | `/api/tts/models/tokenizer.json` | 3 497 | idem | sim | idem |
| Voz `pf_dora` | `/api/tts/models/voices/pf_dora.bin` | 522 240 | idem | sim | idem |
| WASM ort-web (proxies `.mjs`) | `/api/tts/wasm/*.mjs` | ~0,05–0,05 MB | `onnxruntime-web/dist` | sim (necessários offline) | idem |
| WASM ort-web (binário usado) | `/api/tts/wasm/*.wasm` | ~14–28 MB (variante do ambiente) | idem | sim | idem |
| Worker | `/tts/worker.js` | 493 679 | `public/tts/` (build) | sim (precache do build; reforçado pela regra) | precache com revision |

Dependências: o worker precisa do par **modelo+tokenizer+voz** coerentes e do **WASM correspondente à variante escolhida pelo ort-web** no load. NÃO é suficiente cachear só o modelo. Não há asset de servidor em runtime além destes (fonemização vozz é JS puro embutido no worker).

## Storage Strategy

Comparação (D02):

| Critério | Cache Storage (SW) | IndexedDB | Precache Serwist | Runtime caching genérico | Híbrido |
| --- | --- | --- | --- | --- | --- |
| 92 MB | ✅ ok (um entry) | ⚠️ overhead por chunk | ❌ limite 5 MB / instalação lenta | ✅ | ✅ |
| Offline | ✅ (SW serve) | ✅ mas exige ponte | ✅ | ✅ | ✅ |
| Download inicial | ✅ sob demanda (1ª fetch) | duplicaria fetch | no install (ruim) | ✅ | ✅ |
| Atualização | ✅ nome de cache versionado | manual | regen do SW | versão única | ✅ |
| Versionamento | ✅ `tts-assets-v1` | manual | revision | fraco | ✅ |
| Rollback | ✅ versão anterior mantida | manual | ❌ (substitui) | fraco | ✅ |
| Expiração | ✅ ExpirationPlugin | manual | — | ✅ | ✅ |
| Compatibilidade PWA | ✅ nativa | ✅ | ✅ | ✅ | ✅ |
| Browser support | Chromium/Safari/Firefox (Cache API) | ✅ | ✅ | ✅ | ✅ |
| Complexidade | baixa (padrão já usado no Vosk) | alta (ponte p/ worker) | média (bump de SW p/ cada asset) | baixa | média |

**Escolha (uma): Cache Storage versionado servido pelo Service Worker existente** (`CacheFirst`, cache `tts-assets-v1`) — mesma mecânica já aprovada do cache do Vosk, sem duplicar downloads e sem ponte IndexedDB→Worker.

## Precache Decision

Decisão (D03): **B — download sob demanda com runtime caching** (NÃO entrar no precache tradicional).

Justificativa (não por conveniência):
- **Tamanho/instalação:** 92 MB + variante WASM (~14–28 MB) no precache dobraria a instalação do PWA e o `maximumFileSizeToCacheInBytes` atual é 5 MB (precache atual não comporta e não deve comportar);
- **Atualização:** assets de modelo/voz/worker mudam em unidade própria; acoplar ao precache (regenerado a cada build) tornaria cada deploy um re-download de 92 MB;
- **UX:** baixar no primeiro uso (primeira fala) com cache progressivo é mais aceitável que segurar a instalação;
- **Experiência:** primeiro uso online baixa via SW; usos seguintes (mesma sessão, reload e offline) saem do cache;
- **Exceção justificada:** `/tts/worker.js` (493 KB) já está no precache do build (revisionado) — pequeno, muda com o deploy e é necessário até para o caminho online; a regra TTS reforça sem duplicar (precache responde primeiro).
- **Híbrido (C) rejeitado nesta sprint:** sem necessidade de precache antecipado; pré-aquecimento/UX de progresso é melhoria futura (D05), não requisito de correção.

## First Use

Comportamento (D04), sem alterar API pública:

```
usuário ativa TTS → resposta completa → orchestrator.speak → load (1ª vez)
→ Worker inicia → fetch de cada asset → SW: miss → rede (200) → CacheFirst grava em 'tts-assets-v1'
→ sessão criada → síntese → áudio
```

- A primeira síntese **online** nunca falha por ausência de cache: o próprio fetch do load popula o cache antes de a síntese começar (é o mesmo caminho da TTS-007).
- Estado "TTS assets loading" = estados existentes do orchestrator (`LOADING`/`SYNTHESIZING` no botão único) — nenhuma mudança de contrato; documento apenas (sem nova UX, D05).
- Offline **sem** cache: load falha → erro isolado no controller (fase `error`/mensagem), Chat continua (D13) — sem fallback TTS.

## Download

- O download real (~92 MB + variantes) ocorre **uma única vez**, na primeira síntese online, e é **servido pelo SW** nas demais vezes (sem segundo download — D11; CacheFirst do SW responde ao próprio worker).
- Medições registradas em Offline Validation / Performance.
- Requisito de indicação (D05) **documentado**: um download de ~92 MB deve, em sprint de UX, expor progresso/estado ("baixando voz para funcionar offline…") sem quebrar o ciclo atual; não criado nesta sprint (sem nova UI).

## Cache Versioning

- Versão explícita: cache **`tts-assets-v1`** (`TTS_CACHE_NAME`, constante única em `src/lib/tts/pwa/modelCache.ts`).
- Atualização de modelo/voice/tokenizer/worker/wasm = **troca da constante** junto com os artefatos (unidade de deploy coerente; nunca editar asset no mesmo pathname com o mesmo nome de cache).
- `ExpirationPlugin`: `maxEntries 16`, `maxAgeSeconds 365d`, `maxAgeFrom "last-used"` (a troca de versão é o mecanismo primário de invalidação).
- Worker versionado pelo precache do build (revision) — compatível porque o deploy novo traz o worker novo com o mesmo `tts-assets-vN`.

## Atomic Updates

- Unidade atômica = **toda a pasta `tts-assets-vN`**: um deploy novo usa cache name novo; assets antigos nunca se misturam com novos.
- Falha parcial de download: o SW só grava resposta **200 completa**; um download interrompido **não** cria entrada parcial; a versão anterior (`tts-assets-v<N-1>`) permanece **utilizável** até a nova estar completa (`pruneOldTtsCaches` mantém a atual + 1 anterior no `activate`).
- Sem estado `modelo novo + tokenizer antigo`: tudo no mesmo cache name ou tudo no anterior.

## Storage Quota

- Estimativa de uso: modelo 92,36 MB + voz 0,52 MB + tokenizer 3,5 KB + worker 0,49 MB + variante WASM usada (~14–28 MB) ≈ **110–122 MB**.
- `QuotaExceededError`: tratada no `cachePut` da estratégia (serwist expurga caches de runtime antigos ao falhar); em falha o load do worker falha → erro isolado (D13).
- Eviction: caches **não marcados persistentes podem ser evictados** sob pressão de storage — recomendação **documentada**: solicitar `navigator.storage.persist()` quando o usuário ativar TTS (não implementado nesta sprint — requer ponto de UX; manter como trabalho futuro listado em Deferred Work).
- Não foi assumido que 92 MB em disco ⇒ 92 MB garantidos; o CacheFirst grava quando o navegador permite e falha limpa em quota.

## Service Worker

- **Nenhum segundo SW**: tudo continua no único `src/sw.ts` (Serwist). Adicionada a regra `TTS_ASSETS_RUNTIME_CACHING` (CacheFirst, `tts-assets-v1`) na lista `runtimeCaching`, **antes** do `defaultCache` (first-match wins), no mesmo padrão da regra Vosk.
- `activate`: `pruneOldTtsCaches(2)` remove caches `tts-assets-*` mais antigos mantendo a versão atual + 1 anterior.
- `public/sw.js` regenerado no build de produção contém a regra (auditado no bundle/SW final). Nota de auditoria: a string `model_quantized` presente no SW é a **constante de metadados** (`TTS_CORE_ASSETS`, lista de integridade) embutida pelo bundler — **não** é entry do precache (o manifest de precache não contém `/api/tts/*`; o modelo de 92 MB não é precacheado).

## Worker Integration

- Caminho confirmado compatível com a arquitetura (D11): **`Worker → fetch (mesma origem) → Service Worker → Cache Storage`**. O SW intercepta o fetch do worker (client controlado), servindo do cache quando presente e gravando na rede quando ausente — **uma única transferência de rede por asset**, sem download duplicado no main thread (o AssetLoader/Browser Runtime não foram alterados).

## Offline Validation

Execução em **Chromium 152 headless real** (harness temporário, removido ao final) com o SW de origem servindo os arquivos reais e a cadeia real `createTtsService → KokoroBrowserRuntime → Worker → ort-web/WASM → Q8 + pf_dora → AudioResult → AudioContext`. "Offline" = **assets inacessíveis (HTTP 503 simulado no servidor)** — não apenas `navigator.onLine` — com **reload (worker/sessão novos)** para obrigar o fetch real dos assets. Evidência bruta: `docs/TTS-PWA-001-CHROMIUM-EVIDENCE.json`.

| Cenário D12 | O que validou | Resultado |
| --- | --- | --- |
| **A** — primeiro acesso online | download dos assets (1ª fetch) + load + synth; cache `tts-assets-v1` populado | ✅ PASS — P1 `ended` em 21,4 s; cache `ready` com model 92 361 116 B + tokenizer 3 497 + voz 522 240 + wasm (jsep.mjs 46 676 + jsep.wasm 27 797 172) + worker (~121 MB); 57 600 samples |
| **B** — TTS online (2ª fala) | synth reutilizando cache/sessão | ✅ PASS — P2 `ended` (17,5 s), 94 800 samples |
| **C** — reload online | cache persiste entre reloads; 2º load | ✅ PASS — assets persistem; P1 `ended` (12,7 s) |
| **D** — offline após assets | **reload + worker novo com assets em 503** → tudo servido pelo Cache Storage do SW | ✅ PASS — P2 `ended` (24,6 s), 94 800 samples, sem rede p/ assets |
| **E** — offline novo chat/resposta | nova resposta sintetizada offline | ✅ PASS — P3 `ended` (22,6 s), 97 800 samples |
| **F** — offline replay | replay sem nova síntese | ✅ PASS — 4,1 s, delta síntese 0, 97 800 samples |
| **G** — offline nova resposta | outra síntese offline | ✅ PASS — P1 `ended` (11,8 s), 57 600 samples |
| **H** — offline TTS OFF/ON | OFF → `off`; ON → fala do alvo atual | ✅ PASS — `offPhase=off`; replay 2,6 s, 57 600 samples |

**Conclusão:** o fluxo `PWA → offline → TTS Consumer → Browser Runtime → Worker → onnxruntime-web/WASM → Kokoro Q8 + pf_dora → AudioResult → Player` funciona **sem rede para os assets** depois que o cache está populado — inclusive com worker recém-criado (fetch servido pelo SW).

## Failure Scenarios

| Cenário D13 | Resultado |
| --- | --- |
| Modelo/tokenizer/voz/wasm ausentes (cache removido) + offline (503) + reload (worker novo) | ✅ Esperado: **falha isolada** — `speak` retorna `ok=false`, fase `error` ("Falha ao carregar TTS"), **sem crash** e **sem fallback TTS** |
| Chat permanece funcional | ✅ página responde (avaliação viva) após o erro |
| Recuperação online | ✅ assets voltam (200), `speak` P3 `ended` (24,4 s) e **cache repovoado** (`ready: true`) |
| Quota insuficiente | NÃO VERIFICADO fisicamente (sem limite artificial); tratativa documentada (serwist expurga caches de runtime em `QuotaExceededError`; erro isolado no load) |
| Download interrompido | INFERIDO: CacheFirst só grava resposta 200 **completa**; interrupção não cria entrada parcial; versão anterior permanece (teste offline D13 sem cache não deixa entradas parciais — `entries: []` após drop) |

## Performance

| Medida | Valor (Chromium, máquina local) | Nota |
| --- | ---: | --- |
| Primeiro uso (A: download 92 MB + load + synth P1) | 21,4 s | inclui 1ª obtenção dos assets pela rede |
| Uso após cache — reload online (C, P1) | 12,7 s | load do modelo do cache + synth |
| Uso após cache — offline fresh-load (D, P2) | 24,6 s | leitura 92 MB do Cache Storage + init + synth (P2 mais longa que P1) |
| Síntese isolada (ordem de grandeza, mesma máquina) | ~10–17 s p/ 2,4–4 s de áudio | RTF não otimizado (fora do escopo D14) |
| 2º uso na mesma sessão (B, P2) | 17,5 s | synth apenas (sessão viva) |
| Replay offline (F) | 4,1 s | sem síntese |
| Cache total após primeiro uso | ~121,2 MB | model+tokenizer+voz+variante wasm+worker |

Comparação primeiro uso × pós-cache: o custo de **rede é zerado** após a primeira obtenção (D/E/G sem rede); o custo dominante passa a ser leitura/init do modelo + synth — não otimizado nesta sprint.

## Browser Compatibility

- **Chromium desktop: CONFIRMADO** (validação acima, real).
- Safari/iOS, Firefox e demais: **NÃO VERIFICADO** — não foi declarada compatibilidade universal. Requisitos conhecidos para os demais: Cache API + SW + WASM SIMD/threads (Safari sem crossOriginIsolated roda single-thread; Cache API suportada).

## Mobile Considerations

- **Capacitor/Android não implementado** (D16). A estratégia é reutilizável: o mesmo Cache Storage + Service Worker vale para o WebView/PWA do app; o caminho nativo (onnxruntime-android + assets PAD) é decisão futura — documentada, sem ação.

## Production Requirements

Registro (D17), sem validar domínio de produção:
- Servir os assets TTS com **MIME correto** (`model .onnx`/`.bin` octet-stream; `.json`; `.wasm` application/wasm; `.mjs`/`.js` text/javascript) — exigência do import dinâmico de módulos WASM no ort-web.
- **HTTPS + mesmos cabeçalhos** (COOP/COEP opcional; CORP não obrigatório) para threads WASM onde disponível.
- **Cabeçalhos de cache coerentes** com o SW (CacheFirst ignora Cache-Control do origin, mas o HTTP cache do browser não deve expirar os assets antes da troca de versão).
- `/tts/worker.js` e assets sob `/api/tts/*` servidos na **mesma origem** do SW.
- Tamanho total esperado em produção: ~110–122 MB de storage adicional do usuário.

## Regression Tests

Estado final, após todas as mudanças (regra SW + módulo + correção do controller):

**`vanzacariasnutri`**: `npm run typecheck` **PASS** · `npm test` → **571 passed (571), 39 arquivos** (inclui `pwaModelCache.test.ts` 11 testes e `T32`) · `npm run build` **PASS** (worker + `public/sw.js` regenerados com a regra).

**`voice-synthesis`**: `npm run typecheck` **PASS** · `npm run typecheck:tests` **PASS** · `npm run build` **PASS** · `npm test` → **59 passed | 2 skipped (61)** — engine intocado, sem regressões.

## Files Changed

- `src/lib/tts/pwa/modelCache.ts` — ponto único (nova): cache `tts-assets-v1`, matcher, núcleo mínimo, introspecção, prune.
- `src/sw.ts` — regra `TTS_ASSETS_RUNTIME_CACHING` (CacheFirst) + activate `pruneOldTtsCaches(2)`; nenhum segundo SW.
- `src/lib/tts/__tests__/pwaModelCache.test.ts` — testes (novos) da unidade/matcher/regra.
- `src/lib/tts/chatTtsController.ts` — correção de robustez descoberta na validação: `notify()` reseta `cachedKey` (snapshot nunca `null`).
- `src/lib/tts/__tests__/chatTtsController.test.ts` — teste `T32` (regressão do snapshot nulo).
- `public/sw.js` — regenerado no build (contém a regra, minificado).
- `docs/TTS-PWA-001-REPORT.md` — este relatório.
- `docs/TTS-PWA-001-CHROMIUM-EVIDENCE.json` — evidência bruta do teste offline em Chromium.

## Files Not Changed

- `voice-synthesis` (engine inteiro: Browser Runtime, Worker, AssetLoader, Kokoro Q8, `pf_dora`, vozz, AudioResult) — **intocado**.
- `voice-transcription`, Vosk, Gemini, RAG, Supabase/schema, Capacitor/Android, iOS, produção/domínio, ChatAssistant, regras D01–D37/interrupção/autoplay/replay, `player.ts`, WebGPU, server bridge.

## Risks

1. **Quota/eviction:** ~110–122 MB podem ser evictados sem `persist()`; documentado (Deferred Work) — sem ação nesta sprint.
2. **Safari/iOS não validado**; threads WASM exigem COI (senão single-thread, mais lento).
3. **Troca de versão offline:** usuário que atualiza o app enquanto offline pode ficar sem assets até o próximo acesso online (por design; versão anterior permanece só até o deploy novo ativar — mitigação `prune` mantém 2 versões, mas o SW novo usa o cache novo).
4. **Download de 92 MB no primeiro uso** sem indicador de progresso (D05 documentado).
5. **Variantes WASM do ort-web:** o cache guarda a variante que o ambiente realmente usou online; se um mesmo device alternar (ex.: WebGPU ligado/desligado), baixará a outra variante na primeira vez online — sem duplicação persistente (maxEntries).

## Deferred Work

- UX de progresso/estado do primeiro download ("TTS assets loading/baixando…") com `navigator.storage.persist()` no primeiro uso.
- Pré-aquecimento (download antes do primeiro toggle) e expiração proativa.
- Validação Safari/iOS e produção/CDN; Capacitor/Android.
- Política de atualização automática dos assets (hash manifest) quando houver deploy de modelos versionados.

## Final Verdict

**GATE: PASS** — com a estratégia implementada, o TTS funciona **online** e, após os assets terem sido obtidos, funciona **offline em Chromium real** (assets 503 + reload com worker novo) através do **mesmo Browser Runtime, Worker, Kokoro Q8, pf_dora e AudioResult** já aprovados. A estratégia de cache é **versionada e coerente** (`tts-assets-v1`, unidade atômica, `prune` no activate) e **não quebra o PWA existente** (um único SW, regra antes do `defaultCache`, precache do build intacto).

Classificação de evidências:

- **CONFIRMADO**: inventário e cache dos assets; CacheFirst versionado servindo offline (cenários D12 A–H no Chromium); falha isolada sem cache offline com Chat vivo e recuperação online repovoando o cache (D13); bundle/SW final contém a regra; regressões verdes (D18); sem assets duplicados, sem segundo SW, sem `onnxruntime-node` no client, Browser Runtime/Chat preservados (D19).
- **INFERIDO**: download interrompido não cria entrada parcial (CacheFirst só grava 200 completa); equivalência com outros dispositivos.
- **NÃO VERIFICADO**: Safari/iOS/Firefox; quota insuficiente física; produção/CDN.
- **BLOCKED**: validação física/audível da saída sonora (mesma limitação de ambiente documentada nas sprints anteriores — não é requisito de falha desta estratégia; a reprodução no grafo de áudio real foi observada — `ended` com `copyToChannel` 57 600–97 800 samples por fala).

**Nota de bug encontrado e corrigido durante a validação:** o harness expôs que `chatTtsController.notify()` invalidava o snapshot cacheado sem resetar a chave → `getUiState()`/`getUiSnapshot()` podiam devolver `null` após um `setTtsEnabled` com o mesmo valor (set/emit sem mudança). Corrigido (reset de `cachedKey` no `notify`) com teste de regressão `T32`. Sem impacto nas regras de interação.

**Veredito:** sprint **PASS** para as validações executáveis do GATE; itens não verificáveis neste ambiente permanecem explícitos (Safari/iOS, produção, validação física audível).
