# TTS-INTEGRATION-004 — Diagnóstico: por que o botão "Ouvir" não produz áudio no navegador

> Status: **DIAGNÓSTICO CONCLUÍDO — ROOT CAUSE IDENTIFICADA** · Data: 2026-09-08 · Projeto: `vanzacariasnutri` (Next.js 16.1.6, `next build --webpack`) + `voice-synthesis` (engine, **UNCHANGED**)
> Objetivo: identificar o **primeiro ponto exato** da cadeia onde o fluxo real falha. **Nenhuma correção foi feita nesta sprint.**

---

## 1. Objetivo

O botão **"Ouvir"** do Chat (TTS-003) não produz áudio no navegador apesar de typecheck/test/build verdes. Esta sprint é **diagnóstica** (não corrigir): reproduzir o problema, rastrear cada camada da cadeia e apontar, com evidência, o primeiro ponto de falha real — para a próxima sprint decidir a correção a partir da causa.

## 2. Ambiente

| Item | Valor |
|---|---|
| SO | Windows (win32), PowerShell 5.1 |
| App | `vanzacariasnutri`, Next.js 16.1.6, `next build --webpack` (build script próprio) |
| Engine | `voice-synthesis` (file:../voice-synthesis), `KokoroVozzRuntime` Q8 `pf_dora`, vozz G2P, `onnxruntime-node` ^1.29.0 |
| Bundle config | `next.config.ts`: `serverExternalPackages: ["voice-synthesis","onnxruntime-node"]` + webpack `resolve.alias` → `src/lib/tts/stubs/empty.ts` |
| Browser test | Chromium headless real (Chrome 132, CDP), console real, building/loading os chunks produzidos por `npm run build` |
| Build | `.next` produzido em 2026-09-08 (BUILD_ID 09/08/2026 15:12:23); re-build de validação exit 0 |

## 3. Reprodução

Reproduzida por **três vias independentes**, todas convergindo ao mesmo erro:

1. **Análise estática dos chunks produzidos** (`npm run build`):
   - Chunk **cliente** `tts-engine.9cf9829fec13c254.js` e **servidor** `.next/server/chunks/tts-engine.js` contêm o `load()` compilado do `synthesizer.ts` com o import do engine substituído por um placeholder que **lança incondicionalmente**:
     ```js
     let n = await Promise.resolve().then(function () {
       var e = Error("Cannot find module 'voice-synthesis/dist/src/index.js'");
       throw e.code = "MODULE_NOT_FOUND", e
     })
     ```
   - A string do stub (`TTS engine unavailable in browser client bundle`) **não existe em nenhum arquivo do `.next`** (`grep` em todos os chunks). O stub `empty.ts` **não está em nenhum bundle**.
   - Nenhum chunk cliente contém código do engine real (`InferenceSession`, `KokoroVozzRuntime`, `pf_dora`, `onnxruntime` → ausentes dos bundles cliente; apenas referência à string no próprio chunk falho).

2. **Execução do chunk real em harness webpack (Node)**: carregando `tts-engine.9cf9829fec13c254.js` com runtime mínimo (polyfill `process` de browser) e chamando `createTtsService().load()`:
   ```
   isSupported(): true
   FAIL: load() rejected after 2ms
     name: TtsError  code: LOAD_FAILED
     message: Falha ao carregar TTS: Cannot find module 'voice-synthesis/dist/src/index.js'
     cause.code: MODULE_NOT_FOUND
   ```

3. **Reprodução em Chromium real (CDP)**: o mesmo chunk real é avaliado dentro de um navegador Chromium headless. Resultado idêntico. Em seguida, a **cadeia completa** (orchestrator + player + synthesizer compilados) foi executada no browser:
   ```
   player module found: true (id 14776)
   orchestrator module found: true (id 19009)
   state before speak: IDLE
   speak REJECTED state=ERROR
     name=TtsError code=LOAD_FAILED
     message=Falha ao carregar TTS: Cannot find module 'voice-synthesis/dist/src/index.js'
     cause=MODULE_NOT_FOUND | Cannot find module 'voice-synthesis/dist/src/index.js'
   ```

**Problema reproduzido com falha objetiva e determinística (2 ms após `speak()`).** Nenhuma alteração permanente foi feita; os harnesses usaram apenas leitura dos chunks e execução isolada (artefatos temporários removidos).

## 4. Cadeia executada (evidência por camada)

```
Botão "Ouvir" (ChatAssistant.tsx:1006 onClick={toggle})
  → controller.toggleAction()            (chatTtsController.ts)
      → setTtsEnabled(true); noteResponse(target.markdown)   [gate OK]
      → speakPrepared(built.prepared)     → ensureOrch()
  → lazyCreateOrchestrator()              (useChatTts.ts — dynamic import ./synthesizer, ./player, ./orchestrator)
      → createTtsService / createAudioPlayer / createTtsOrchestrator   [OK — chunks carregam]
  → orchestrator.speak(text)              (orchestrator.ts)
      → setState(LOADING)
      → tts.load()                        (synthesizer.ts:66)
          → await import("voice-synthesis/dist/src/index.js")   ← ⚠ PRIMEIRA FALHA
              → webpack placeholder LANÇA "Cannot find module ... MODULE_NOT_FOUND"
      → catch → TtsError(LOAD_FAILED, "Falha ao carregar TTS: ...")   (synthesizer.ts:99)
  → orchestrator setState(ERROR); rethrow LOAD_FAILED          (orchestrator.ts:210-211)
  → controller.currentError set; notify()                      (chatTtsController.ts:191-194)
  → UI phase="error" (sem áudio)
```

O fluxo **nunca avança** para `synthesize()` → `AudioResult` → `player.play()` → `AudioContext`.

## 5. Evidências

| # | Evidência | Valor |
|---|---|---|
| E1 | `next.config.ts:46-54` | `serverExternalPackages: ["voice-synthesis","onnxruntime-node"]` + aliases para `empty.ts` |
| E2 | `synthesizer.ts:70` | `await import("voice-synthesis/dist/src/index.js" as string)` (dynamic import) |
| E3 | chunk cliente `tts-engine.9cf9829fec13c254.js` | import do engine compilado como placeholder que lança `Error("Cannot find module 'voice-synthesis/dist/src/index.js'")` / `MODULE_NOT_FOUND` |
| E4 | chunk servidor `tts-engine.js` | idêntico placeholder `MODULE_NOT_FOUND` |
| E5 | `stubs/empty.ts` | não possui export `KokoroVozzRuntime`; string "TTS engine unavailable..." ausente de TODO o `.next` → **stub nunca bundleado** |
| E6 | Harness Chromium (cadeia completa) | `IDLE → LOADING → ERROR(LOAD_FAILED/MODULE_NOT_FOUND)` reproduzido, 2 ms |
| E7 | Engine (diagnóstico) | `kokoro-vozz-runtime.ts:19 import * as ort from "onnxruntime-node"` + `node:fs/promises`, `node:module`, `node:path`; `onnxruntime-node` 1.29.0 com binários nativos `bin/napi-v6/*/onnxruntime_binding.node` |
| E8 | Probe webpack (isolado, diagnóstico) | com `externals:["voice-synthesis","onnxruntime-node"]` + aliases → `Module not found ... MODULE_NOT_FOUND`; **sem** externals → alias resolve para o stub (prova a precedência externals > alias) |

### Por que o alias NÃO é aplicado (mecanismo, comprovado por probe):
Em webpack, quando o módulo casado por `externals` é atingido por um `import()` com especificador de string, o **externals tem precedência sobre `resolve.alias`** — o módulo não é resolvido nem bundleado; em vez disso, gera-se um placeholder que lança `MODULE_NOT_FOUND` em runtime. `Next serverExternalPackages` adiciona `voice-synthesis`/`onnxruntime-node` aos externals **por padrão também na compilação cliente** (Next 16), o que torna o alias (configurado no `webpack()` do `next.config.ts`) inócuo para este `import()` específico. Resultado: no browser o módulo `voice-synthesis/dist/src/index.js` **não existe no bundle** e `load()` lança incondicionalmente.

## 6. Tabela D01–D14

| Diagnóstico | Ponto | Resultado |
|---|---|---|
| D02 | Botão click (onClick→toggle) | **PASS** — `ChatAssistant.tsx:1006` `onClick={toggle}`, wiring do hook confirmado; unidade (T20–T31) + cadeia real |
| D02 | `toggle()` | **PASS** — chama `setTtsEnabled(true)` + `noteResponse`; estados do controller cobertos por 12 testes |
| D03 | Controller → `speakPrepared` | **PASS até o orchestrator** — `noteResponse` → `ensureOrch()`; alvo elegível |
| D03 | `buildSpeakable()` / gate ≥4 | **PASS** — 28 testes speakable; resposta típica do assistente satisfaz gate (ex.: 13 palavras) |
| D04 | `orchestrator.speak(text)` | **PASS (executa)** — comprovado no Chromium: `state before speak: IDLE`; atinge `LOADING` |
| D05 | Dynamic import (`./synthesizer` etc.) | **PASS** — chunks `synthesizer`/`player`/`orchestrator` carregam no browser (ids 78101/14776/19009 encontrados) |
| D05 | Dynamic import do **engine** (`voice-synthesis/dist/src/index.js`) | **FAIL — PRIMEIRA FALHA** — placeholder `MODULE_NOT_FOUND` lançado; módulo real ausente do bundle |
| D06 | Stub `empty.ts` | **FAIL/INÓCUO** — stub **não está em nenhum bundle**; alias ignorado por precedência de externals; e se aplicado, o stub não exporta `KokoroVozzRuntime` (falharia em `new (KokoroVozzRuntime)()`) |
| D07 | `onnxruntime-node` executável no browser? | **NÃO** — binários nativos `napi-v6/*.node` + imports `node:*`; browser não executa runtime nativo. (Limitação secundária; nem se chega a ela: o módulo nem é carregado) |
| D08 | Serialização do caso | **CASO A** — `texto → TTS ✗` antes de produzir `AudioResult` |
| D09 | `AudioContext` | **N/A (nunca alcançado)** — `player.play()` não é chamado; nenhum `AudioBufferSourceNode` criado |
| D10 | Áudio efetivamente produzido | **FAIL** — nada além de `LOAD_FAILED`; promise de `speak()` rejeita (não resolve) |
| D11 | Após interação do usuário (autoplay) | **N/A** — irrelevante: falha ocorre na síntese/import, antes de qualquer `AudioContext`; política de autoplay não aplicável |
| D12 | FakeAudioPlayer vs player real (testes) | **PASS/consistente** — suíte TTS passa com fake (80 testes, incl. orchestration 15 + controller 12 + player 10); o player real (AudioContext) não é exercitado porque nunca recebe `AudioResult` |
| D13 | Produção | **BLOCKED — ambiente indisponível** (sem credenciais/URL de produção). Porém o artefato é idêntico ao local: mesmo `.next` (build exit 0); comportamento em produção será o mesmo (placeholder no bundle) |
| D14 | Build verde ≠ runtime verde | **CONFIRMADO** — `npm run build` exit 0, mas o runtime browser falha deterministicamente (E3/E4/E6) |

## 7. ROOT CAUSE

```
ROOT CAUSE:
O primeiro ponto de falha da cadeia real é o dynamic import do engine em
src/lib/tts/synthesizer.ts:70 — await import("voice-synthesis/dist/src/index.js").
No bundle do browser (e também no servidor), o webpack compilou esse import como
um placeholder que LANÇA incondicionalmente:
    Error("Cannot find module 'voice-synthesis/dist/src/index.js'") [code MODULE_NOT_FOUND]
porque `voice-synthesis` está em `serverExternalPackages` (externals) e, no webpack,
externals têm precedência sobre resolve.alias — o alias para `stubs/empty.ts`
nunca é aplicado a esse import() e o módulo real não é bundleado.

EVIDÊNCIA:
- chunk cliente .next/static/chunks/tts-engine.9cf9829fec13c254.js e chunk servidor
  .next/server/chunks/tts-engine.js: `{let n=await Promise.resolve().then(function(){var e=Error("Cannot find module 'voice-synthesis/dist/src/index.js'");throw e.code="MODULE_NOT_FOUND",e})...}`
- Reprodução Chromium (cadeia completa): speak REJECTED state=ERROR,
  TtsError LOAD_FAILED «Falha ao carregar TTS: Cannot find module 'voice-synthesis/dist/src/index.js'»,
  cause MODULE_NOT_FOUND — 2 ms.
- Stub ausente de todo o .next (grep: string "TTS engine unavailable..." não ocorre).
- Probe webpack isolado: externals + alias → MODULE_NOT_FOUND; sem externals → alias→stub
  (precedência externals > alias provada).

PRIMEIRA CAMADA AFETADA:
src/lib/tts/synthesizer.ts → createTtsService().load() (linha 54-105; import na linha 70).
`load()` é chamado por orchestrator.ts:200-203 (on-demand) durante speak().

CAMADAS POSTERIORES:
- orchestrator.ts: setState(ERROR) e rethrow LOAD_FAILED (linhas 206-212) — não executadas além do LOADING.
- synthesize() NUNCA roda → AudioResult NUNCA é produzido (Caso A).
- player.ts / AudioContext: NUNCA alcançados (nada reproduturado).
- (Secundária, não atingida: mesmo que o import resolvesse, onnxruntime-node é nativo e
  não executa no browser — kokoro-vozz-runtime.ts:19 + bin/napi-v6/.node.)
```

**Conclusão:** a solução de bundle do TTS-003 (stub + `serverExternalPackages`) tornou o TTS **funcionalmente indisponível no browser**: o alias foi criado, mas é inócuo por precedência de externals, e o resultado é um `MODULE_NOT_FOUND` imediato — não o stub, não o engine. A falha é **determinística, imediata (2 ms), em `load()`**, antes de qualquer síntese.

## 8. Hipóteses descartadas

| Hipótese | Verdict | Evidência |
|---|---|---|
| Gate `buildSpeakable`/MIN_WORDS rejeitando a resposta | **DISCARTADA** — gate ≥4 passa; 28 testes speakable; 40 testes chain (speakable+controller) verdes | D03 |
| Controller nunca chama o orchestrator | **DISCARTADA** — orchestrator executa (`state before speak: IDLE` → `speak REJECTED`) | D04/E6 |
| Player/`AudioContext`/autoplay `NotAllowedError` | **DISCARTADA** — `player.play` nunca é chamado; falha antes | D08/D09/D10/D11 |
| Stub sendo acionado ("TTS engine unavailable in browser client bundle") | **DISCARTADA** — stub ausente de todo o bundle; string não ocorre em `.next` | E5/D06 |
| `isSupported()` retornando false (degrada para NOT_SUPPORTED) | **DISCARTADA** — `isSupported(): true` no browser (WebAssembly existe) | E6 |
| Engine real bundleado mas `onnxruntime-node` falhando no load | **DISCARTADA (secundária)** — nem o engine é bundleado; módulo inexistente no bundle é a causa primária | E3/E4 |
| Erros do usuário (sessão, resposta curta) | **DISCARTADA** — reproduzível isoladamente, sem Chat/sessão | E6/E8 |

## 9. Limitações

- **D13 (produção):** `BLOCKED — ambiente indisponível` (sem credenciais/URL publicada). Análise: builder produz o mesmo artefato; comportamento idêntico esperado.
- **Politica de autoplay / audição física:** não avaliável — a síntese não chega a ocorrer.
- **`serverExternalPackages` e servidor:** curiosamente o **servidor** também compilou o mesmo placeholder `MODULE_NOT_FOUND` (E4), sugerindo que mesmo síntese server-side não estaria operante com este build — fora do escopo (não corrigido).
- Nenhuma alteração de produção foi feita; artefatos de diagnóstico temporários removidos (`git status` limpo além das mudanças já aprovadas do TTS-003).

## 10. Recomendação para a próxima sprint

A causa raiz está na **estratégia de bundle/import do engine** (`next.config.ts` + `synthesizer.ts:70`). Direções possíveis a decidir na próxima sprint (fora do escopo desta):

1. **Bridge server-side (recomendada tecnicamente):** sintetizar no Node/API route (o engine funciona 100% em Node, validado em TTS-001/002 — mesmo o servidor precisará resolver o dynamic import corretamente, pois hoje compila o mesmo placeholder), e entregar `AudioResult`/WAV ao browser via endpoint — compatível com o runtime atual sem alterar o engine.
2. **Engine browser (onnxruntime-web):** exige modificação no `voice-synthesis` (novo runtime WASM + assets) — altera engine, maior esforço.
3. **Ajuste do bundle:** resolver o conflito externals×alias (ex.: remover `voice-synthesis` de `serverExternalPackages`, ou trocar o alias por um loader externo / `config.externals` custom) — porém, mesmo corrigindo o bundle, `onnxruntime-node` não executa no browser; é necessária a bridge do item 1 para áudio real.

**Pré-requisito da próxima sprint (não tocar nesta):** validar a audição física (gravador/dispositivo) — segue **BLOCKED**.

---

*Nenhuma alteração funcional foi feita nesta sprint. `npm run typecheck` PASS · `npm run test` PASS (37 files / 552 tests) · `npm run build` PASS (exit 0). Falha reproduzida em Chromium real com evidência bottom-up. ROOT CAUSE: import do engine compilado como `MODULE_NOT_FOUND` (externals precedem alias), primeira falha em `synthesizer.ts` `load()`.*