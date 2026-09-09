# TTS-INTEGRATION-007 REPORT

> Período: 2026-09-08 · App: `vanzacariasnutri` (Next.js 16.1.6, webpack) · Engine: `voice-synthesis` (file:../voice-synthesis) · Chrome 152 headless (real) · Node v22.21.0 · Evidência classificada: CONFIRMADO / INFERIDO / NÃO VERIFICADO / BLOCKED

## Objective

Integrar o **Browser Runtime** validado na TTS-INTEGRATION-006 (`onnxruntime-web@1.29.0` + WASM + Web Worker + Kokoro Q8 `model_quantized.onnx` + voz `pf_dora` + G2P `vozz`) ao **consumer TTS existente** do `vanzacariasnutri` (`src/lib/tts/`), fazendo o botão **Ouvir** do Chat reproduzir áudio real no navegador — **sem redesign**: reutilizando `createTtsService()`, `player.ts`, `speakable`, preferência `tts_enabled:${userId}` e as regras de interação já aprovadas (streaming aguarda conclusão, nova interação interrompe, current response, Play/Pause/Resume/Replay, erros não quebram o Chat, on-demand).

Fluxo alvo:

```
ChatAssistant → useChatTts → TTS Controller → TTS Orchestrator → TTS Consumer
→ voice-synthesis Browser Runtime → Web Worker → onnxruntime-web → WASM
→ Kokoro Q8 + pf_dora + vozz → AudioResult → existing Audio Player → áudio
```

O `voice-synthesis` permanece independente do Chat (não conhece Chat/React/UI); a integração vive no consumer do app.

## Architecture

```
vanzacariasnutri/src/lib/tts/            (consumer — camadas de aplicação)
  preference.ts    fonte de verdade ON/OFF (localStorage tts_enabled:${userId})
  speakable.ts     unidades faláveis (inalterado)
  synthesizer.ts   createTtsService() + detectRuntimeKind()  ← boundary D01/D02
  orchestrator.ts  ciclo IDLE/LOADING/SYNTHESIZING/PLAYING/PAUSED/ENDED/…
  player.ts        AudioPlayer real (AudioContext) — reutilizado (D07)
  chatTtsController.ts  regras do Chat (noteResponse/invalidate/toggle/replay)
  useChatTts.ts    hook React fino (lazy orchestrator factory)
  stubs/empty.ts   stub do resolver onnxruntime-node (apenas client, D03)
src/app/api/tts/[...path]/route.ts   assets (models + wasm) — server route (D05)
public/tts/worker.js                 bundle do Worker (build do app, D06)
voice-synthesis/src/runtime/browser/  KokoroBrowserRuntime + AssetLoader + worker.ts
```

Seleção de runtime (D02): `detectRuntimeKind()` — `window+Worker+WebAssembly` → browser (`KokoroBrowserRuntime`, Worker + onnxruntime-web/WASM); caso contrário → node (`KokoroVozzRuntime`, onnxruntime-node). `createTtsService()` (browser) faz `dynamic import("voice-synthesis/dist/src/runtime/browser/index.js")` apenas em `load()` (lazy, D15); o entry Node usa `/* webpackIgnore: true */` para nunca entrar no bundle client (D04).

## Browser Runtime Integration

- CONFIRMADO (código + build): `voice-synthesis/src/runtime/browser/{index,types,worker,asset-loader}.ts` — proxy main-thread + protocolo `init|synth|dispose` ↔ `ready|synth-result|error|disposed`; `onnxruntime-web` importado **somente no Worker**; `wasmPaths` por `crossOriginIsolated`; serialização de sínteses; dispose/reload.
- CONFIRMADO (TTS-INTEGRATION-006, baseline aprovado — não reaberto): 82 200 samples, 24 kHz mono, Float32Array, sem NaN, Q8 + pf_dora reais.
- CONFIRMADO (nesta sprint): `scripts/build-tts-worker.mjs` (predev/prebuild) gera `public/tts/worker.js` (493 679 B) com onnxruntime-web embutido e **sem** onnxruntime-node; `.gitignore` exclui `/public/tts/`.

### Finding de integração (bug de contrato corrigido no consumer)

- **Observado no Chromium real:** `KokoroBrowserRuntime` resolve os assets com `new URL(path, baseUrl)` → **base relativa é inválida** (`Failed to construct 'URL': Invalid base URL`). O default anterior do consumer (`baseUrl: "/api/tts/models/"`) era relativo e falhava no browser real (a TTS-006 usara base absoluta no harness).
- **Correção (somente no consumer — o engine permanece intocado):** `synthesizer.ts` ganhou `absoluteAssetBase()`: quando há `location`, a base é resolvida para absoluta com `new URL(relBase, location.href)`; sem `location` (SSR/Node), usa `location.origin + "/api/tts/models/"` ou preserva a base informada se absoluta. Teste de regressão adicionado (`ttsIntegration007.test.ts`, teste 7): default → `https://app.exemplo/api/tts/models/model_quantized.onnx` etc.
- **Observado no Chromium real (2º finding):** o default dos assets (`model_quantized.onnx | tokenizer.json | voices/pf_dora.bin`) é resolvido **diretamente contra a baseUrl** — mas os arquivos vivem em `voice-synthesis/models/kokoro/`, não em `models/`. A rota `/api/tts/models/*` retornava 404 para o layout real.
- **Correção (rota do app):** `src/app/api/tts/[...path]/route.ts` passou a servir `voice-synthesis/models/kokoro` como raiz de `models` (contrato do runtime: os 3 nomes na raiz da base). O mesmo alinhamento foi aplicado ao harness.
- Resultado: o mesmo caminho roda no app (Next) e no harness com base absoluta.

## Consumer Boundary

- CONFIRMADO: o Chat (ChatAssistant) conhece apenas `useChatTts` → controller → `TtsService`/`AudioResult`. Kokoro/vozz/ONNX/Worker/WASM/Q8/pf_dora ficam dentro do consumer (`synthesizer.ts`) e do engine.
- CONFIRMADO: `createTtsService({model:'q8', voice:'pf_dora'})` continua sendo a fábrica pública (D01).
- CONFIRMADO: erros do engine são convertidos em `TtsError` (`LOAD_FAILED`/`SYNTHESIS_FAILED`/…) sem expor internals (teste `ttsConsumer.test.ts`: "não expõe internals do engine").

## Next.js Boundary

- CONFIRMADO: client sem `onnxruntime-node`/`node:fs`/bindings — auditoria do bundle de produção (§ Bundle Audit).
- CONFIRMADO: o runtime browser é importado só via dynamic import no chunk `tts-engine` (client) e o ONNX roda dentro do Worker (`/tts/worker.js`, estático, fora dos chunks do Next).
- CONFIRMADO (D03): `next.config.ts` — `serverExternalPackages: ["voice-synthesis","onnxruntime-node"]`; no client, alias apenas `onnxruntime-node → src/lib/tts/stubs/empty.ts`. Removidos os aliases/stubs que bloqueavam o subpath browser (evidência: bundle client carrega o Browser Runtime; ver Bundle Audit).

## Assets

- CONFIRMADO (D05): rota `src/app/api/tts/[...path]/route.ts` (server-only, `runtime="nodejs"`) serve:
  - `/api/tts/models/*` → `voice-synthesis/models` (`model_quantized.onnx`, `tokenizer.json`, `voices/pf_dora.bin`);
  - `/api/tts/wasm/*` → `voice-synthesis/node_modules/onnxruntime-web/dist` (`*.wasm`).
  - Defaults no consumer: `baseUrl="/api/tts/models/"`, `wasmPaths="/api/tts/wasm/"`, `workerUrl="/tts/worker.js"` (sobrescrevíveis por opção/teste).
- CONFIRMADO: nenhum artefato de modelo duplicado no app (92 MB continuam no pacote `voice-synthesis`, `file:../voice-synthesis`).
- PWA/offline e produção (URL pública/CDN): **NÃO implementado** (D23/D24 — sprint específica; registro abaixo).
- Caminho/base URL documentado nos defaults do consumer e nesta seção.

## Worker

- CONFIRMADO (D06): o Chat nunca instancia Worker — cadeia `Chat → TTS API → Browser Runtime → Worker`. `build-tts-worker.mjs` cria o bundle ESM do worker a partir de `voice-synthesis/src/runtime/browser/worker.ts`; o runtime browser injeta `workerUrl` (default `/tts/worker.js`).
- CONFIRMADO: `public/tts/worker.js` contém onnxruntime-web/wasm-path/vozz/pf_dora e **não** contém onnxruntime-node.

## Player

- CONFIRMADO (D07): `src/lib/tts/player.ts` (AudioContext + AudioBufferSourceNode) reutilizado; `AudioResult.samples` → `ctx.createBuffer/copyToChannel` → `source.start`. Play/Pause/Resume/Replay/stop/dispose existentes intactos (testes `player.test.ts`).
- Nenhum segundo mecanismo de reprodução criado.

## Autoplay

- CONFIRMADO (D08): no Chat, após conclusão da resposta (`frame.t==='done'` no streaming, ou `data.reply` em não-stream), `tts.noteResponse(finalReply)` é chamado apenas quando o texto **completo** existe; o controller fala se a preferência estiver ON. Nada é sintetizado durante streaming (o hook só é acionado no fim). Sem autoplay de respostas antigas (ver Current Response).

## Streaming

- CONFIRMADO (D11): chamadas de `noteResponse` ocorrem somente após o término do stream (ambos os fluxos patient/admin) — sem síntese parcial. Verificado também em Chromium real (cenário C) e por testes de unidade do controller.

## Current Response

- CONFIRMADO (D09): `chatTtsController` mantém `target` = último response concluído; `noteResponse` de um novo response substitui o anterior; `replay()` reproduz o alvo atual (nunca o antigo) — coberto em unidade e no cenário H (Chromium).

## Interruption

- CONFIRMADO (D10): nova interação do usuário chama `tts.invalidate()` no início de `handleSend`/`ask` (patient e admin) → `orchestrator.stop()` (gen++ invalida) → áudio para; sem debounce. Desligar TTS (`setEnabled(false)`) também para imediatamente (cenário I).

## Play/Pause/Resume/Replay

- CONFIRMADO (D13): ciclo do botão único — OFF → ON (+autoplay da resposta atual se houver) / PLAYING → PAUSE / PAUSED → RESUME / ENDED → Replay (sem nova síntese) / IDLE sem alvo → OFF. O botão nunca vira "stop permanente". Pause/Resume/Replay de `player.ts` intactos (unidade + Chromium E/F/G).

## Preference

- CONFIRMADO (D17): única preferência `tts_enabled:${userId}` em `preference.ts` (localStorage, external store); `setTtsUser(userId)` liga a chave do paciente em `ChatAssistant` e `Perfil`; Chat e Settings (Perfil) compartilham a mesma fonte de verdade via `useSyncExternalStore`. Nenhuma nova preferência criada. Fallback: chave genérica quando sem sessão.

## Error Handling

- CONFIRMADO (D14): falha de síntese/load vira `TtsError` no consumer e o controller apenas marca fase/`message` — **não desliga** a preferência nem quebra o Chat. `chatTtsController.speakPrepared` captura e ignora CANCELLED; demais erros ficam no estado do botão.

## Concurrency

- CONFIRMADO (D16): `gen` anti-race no orchestrator (novo speak/interação invalida resultado obsoleto: resultado de A não é reproduzido quando B virou current) + serialização interna no runtime (fila `synthTail` no browser; sessão única no Node). Sem concorrência de sínteses dentro do runtime.

## Browser Real Test

Execução em **Chromium 152 headless real** (harness temporário fora dos repositórios — removido ao final) com a cadeia real do consumer: `createTtsService(browser) → KokoroBrowserRuntime → Worker real (/tts/worker.js) → onnxruntime-web/WASM → Q8 + pf_dora → orchestrator → player real (AudioContext) → controller`. Evidência bruta: `docs/TTS-INTEGRATION-007-CHROMIUM-EVIDENCE.json`.

| Cenário | Descrição | Resultado |
| --- | --- | --- |
| Pré-checagem | assets (model 92 361 116 B, tokenizer 3 497 B, voz 522 240 B) servidos; Worker real `ready` (ort 1.29.0); módulos `.mjs`/`.wasm` importáveis | ✅ CONFIRMADO |
| **A** | TTS OFF → resposta não fala (0 workers/0 sínteses) | ✅ PASS |
| **B** | TTS ON → resposta completa sintetizada e reproduzida até o fim (`ended`); 1 síntese real; AudioContext criado; **57 600 samples** (`copyToChannel`) = 2,40 s @24 kHz; `source.start` executado | ✅ PASS |
| **C** | TTS ON "durante streaming" → **sem síntese** na janela; fala somente após concluir | ✅ PASS |
| **D** | Nova interação durante áudio → `invalidate` interrompe (fase `idle`, `source.stop`) | ✅ PASS |
| **E** | Pause real (fase `paused`, relógio congelado) | ✅ PASS |
| **F** | Resume → continua e chega a `ended` | ✅ PASS |
| **G** | Após `ended`, Replay reproduz a resposta atual **sem nova síntese** (delta 0) | ✅ PASS |
| **H** | Novo response (P3) → nova síntese (delta 1); Replay passa a apontar para a nova resposta | ✅ PASS |
| **I** | TTS OFF durante áudio → para imediatamente (fase `off`, `source.stop`) | ✅ PASS |
| Probe de inferência | `KokoroBrowserRuntime` isolado: init 4 756 ms; synth 10 666 ms (ort 10 620 ms); **57 600 samples** Float32Array 24 kHz mono; `noNaN=true`; `maxAbs=0.521`; WAV 115 244 B (idêntico à referência Node do mesmo texto) | ✅ PASS |

Resultado geral: **A–I TODOS PASS** (`pageErrors: []`; 10 workers reais, 10 init, 10 synth; AudioContext: 7 ctx, 904 200 samples copiados ao grafo, 10 `source.start`, 3 `source.stop`).

## Bundle Audit

- CONFIRMADO (D22): build de produção (`.next`, rodada final):
  - Chunk client `tts-engine.<hash>.js` contém o adapter do Browser Runtime (`KokoroBrowserRuntime`, `voice-synthesis`, `pf_dora`, defaults `api/tts/models` e `tts/worker.js`) e **não** contém `onnxruntime-node` nem `onnxruntime-web`.
  - Varredura de todos os chunks de `.next/static` (produção): **0 ocorrências** de `onnxruntime-node`, `onnxruntime_binding`, `napi-v6`, `node:fs`, `node:path`, `node:http`, `createRequire`.
  - `onnxruntime-web` só existe no Worker (`public/tts/worker.js`, fora dos chunks do Next).
  - Configuração: `serverExternalPackages` + alias client `onnxruntime-node → stub`; sem aliases bloqueando o subpath browser.
- Não foi aceito apenas "build PASS": a auditoria acima é baseada no artefato `.next/static` final.

## voice-synthesis Regression

Executado nesta rodada (estado final, engine intocado): `npm run typecheck` **PASS** · `npm run typecheck:tests` **PASS** · `npm run build` **PASS** · `npm test` → **59 passed | 2 skipped (61)** — 5 arquivos, 0 erros.

## vanzacariasnutri Regression

Executado nesta rodada (estado final com a integração): `npm run typecheck` **PASS** · `npm test` → **559 passed (559), 38 arquivos** · `npm run build` (incl. `prebuild` → worker) **PASS**.

## Physical Audio Validation

- **CONFIRMADO (grafo de áudio real):** no Chromium real o AudioContext foi criado, os 57 600 samples (P1, 2,40 s) foram copiados para `AudioBuffer.copyToChannel`, `AudioBufferSourceNode.start()` executou e o `onended` disparou ao fim da duração (transição `PLAYING → ENDED` no player real, sem player fake). Ciclos pause/resume/replay/interrupção observados no mesmo grafo (3 `source.stop`, pausa em ~`samplesCopied` parcial, resume até `ended`).
- **PLAYBACK PHYSICAL VALIDATION = BLOCKED:** não há neste ambiente captura de saída física (auto-falante/gravação de áudio) para comprovar o som audível por um observador humano. Não foi inventado resultado: a declaração precisa é **"AudioResult + reprodução no grafo AudioContext (render) CONFIRMADO; som físico audível NÃO VERIFICADO (BLOCKED)"** — igual postura da TTS-006, a ser fechado por validação humana em navegador com dispositivo de áudio.

## PWA

- **NÃO implementado** (D24): sem precache/offline dos 92 MB; `next.config.ts` mantém o serwist existente (SW do app) sem incluir os assets do Kokoro. Documentado para sprint posterior: estratégia PWA/offline do modelo é trabalho futuro; esta integração não impede a futura estratégia (assets servidos por URL estável em `/api/tts/models|wasm/*` e worker em `/tts/worker.js`, todos cacheáveis).

## Mobile

- **NÃO modificado** (D25): nenhuma alteração Android/Capacitor; compatibilidade iOS não declarada (não testada). Permanente para sprints posteriores.

## Production

- **NÃO considerado requisito** (D23): o ambiente de produção ainda não tem os assets necessários servidos (rota `/api/tts/...` + `public/tts/worker.js` são de dev/preview com a árvore local `file:../voice-synthesis`). Deploy/CDN dos 92 MB + `.wasm` + worker fica para sprint específica — **documentado, sem improviso**.

## Files Changed

App `vanzacariasnutri` (working tree, sem commit — regras de isolamento):
- `next.config.ts` — serverExternalPackages + alias client onnxruntime-node→stub (D03/D04).
- `package.json` — `voice-synthesis: file:../voice-synthesis`; `esbuild` (dev); scripts `predev`/`prebuild` (worker), `test`, `typecheck`.
- `.gitignore` — exclui `/public/tts/` (worker gerado).
- `src/lib/tts/**` — types, synthesizer (runtime selection/assets), orchestrator, player, chatTtsController, preference, speakable, useChatTts, stubs/empty.ts (consumer da integração; baseline das sprints 001–005).
- `src/app/api/tts/[...path]/route.ts` — assets do Browser Runtime (D05).
- `scripts/build-tts-worker.mjs` — bundle do Worker (D06).
- `src/components/ChatAssistant.tsx` — hook `useChatTts`; `noteResponse` no fim da resposta; `invalidate` na nova interação; `stop` ao fechar; botão Ouvir (ciclo único); `setTtsUser` por sessão.
- `src/app/dashboard/perfil/page.tsx` — toggle Settings usando a mesma preferência.
- `src/lib/tts/__tests__/*` — testes de integração (D18).
- `docs/TTS-INTEGRATION-007-REPORT.md` — este relatório.
- `docs/TTS-INTEGRATION-007-CHROMIUM-EVIDENCE.json` — evidência bruta do teste real em Chromium (cenários A–I + probe).

Engine `voice-synthesis`: **sem alterações nesta sprint** (nenhuma incompatibilidade objetiva de contrato encontrada — D04 "não alterar salvo incompatibilidade").

## Files Not Changed

- `voice-transcription` (intocado) · Vosk · Gemini · RAG · Supabase/schema · autenticação · PWA (serwist mantido) · Android/Capacitor · UI além do necessário (botão Ouvir + toggle Settings com o mesmo estado) · regras de interrupção/autoplay/speakable (inalteradas) · `vozz`/Kokoro/Q8/`pf_dora` (inalterados) · WebGPU/WebGL (não implementados) · server bridge (não criado) · Web Speech API/fallback (não criados).

## Known Risks

1. **Validação física do som** — dependente de ambiente com saída de áudio/gravação; nesta execução o grafo de áudio real (AudioContext) foi comprovado e a saída física audível permanece **BLOCKED** (ver Physical Audio Validation).
2. **Assets em dev** dependem da rota `/api/tts/**` + `file:../voice-synthesis`; produção/CDN pendente (D23).
3. **Threads WASM** exigem COOP/COEP (cross-origin isolated); sem eles o onnxruntime-web roda single-thread (mais lento) — não bloqueia.
4. **Primeiro load on-demand** baixa 92 MB + init (~segundos) na primeira fala; RTF não otimizado (WebGPU/otimização = fora do escopo).
5. **Admin chat**: `useChatTts` também é instanciado no modo admin (noteResponse em respostas admin); o botão Ouvir é exibido apenas no modo paciente — observação de UX, sem alteração nesta sprint (sem redesenho).

## Final Verdict

**GATE: PASS** (com ressalvas explícitas, sem mascaramento).

Evidência por classificação:

- **CONFIRMADO** (código + execução): Consumer conectado ao Browser Runtime real (`createTtsService` → `KokoroBrowserRuntime` → Worker `/tts/worker.js` → `onnxruntime-web@1.29.0`/WASM → Kokoro Q8 + `pf_dora` + vozz → AudioResult → player existente/AudioContext). Cadeia executada de ponta a ponta em **Chromium real** com os cenários A–I do briefing **todos PASS**; 57 600 samples reais (2,40 s @24 kHz) chegando ao grafo de áudio e reprodução concluída (`ended`); on-demand e reload preservados; erros do TTS não desligam a preferência nem quebram o Chat (testes + controller); preferência única `tts_enabled:${userId}` (Chat + Settings); bundle client sem `onnxruntime-node`/bindings/`node:*` (auditoria do `.next/static`); regressões verdes nos dois repositórios.
- **INFERIDO**: equivalência perceptual do áudio (não ouvida) e comportamento em dispositivos não testados.
- **NÃO VERIFICADO**: mobile/iOS, produção/CDN, dispositivos com WebGPU.
- **BLOCKED**: **PLAYBACK PHYSICAL VALIDATION** (saída sonora audível/gravação) — ambiente headless sem captura física; declarado conforme D20, sem inventar resultado.

Dois defeitos objetivos de integração foram encontrados no Chromium real e corrigidos **somente no app** (engine intocado): (1) baseUrl relativa → absoluta via `location.origin` (`synthesizer.ts` + teste 7); (2) rota `/api/tts/models/*` apontando para `models/kokoro` (contrato do runtime: nomes na raiz da base). Nenhum fallback/máscara foi criado.

**Veredito de qualidade do sprint (não confundir com a voz):** a integração está **funcional e comprovada** no ambiente web do Chat. O sprint é **PASS** para as validações executáveis; permanece **BLOCKED** apenas a confirmação física/audível do som (validação humana) e os itens de PWA/mobile/produção explicitamente fora de escopo (D23/D24/D25).

---
