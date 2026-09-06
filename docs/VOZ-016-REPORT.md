# VOZ-016 — Limpeza Final do Laboratório de Voz

**Data:** 2026-09-06
**Sprint:** VOZ-016
**Predecessoras:** VOZ-013 (voice-transcription), VOZ-014 (primeira limpeza), VOZ-015 (validação física)
**Tipo:** Limpeza final — não remoção do comando de voz

---

## 1. Objetivo

Remover somente o **laboratório residual** criado para investigar o comando de voz, mantendo **intacto o comando de voz do ChatAssistant** no `vanzacariasnutri`.

Regra: comando de voz continua funcionando; laboratório sem função atual é removido.

## 2. Estado inicial

- **WORKSPACE** `C:\Users\joelg\Documents\Vanusa` → `vanzacariasnutri` + `voice-transcription` (irmão, 56 testes)
- **vanzacariasnutri** `On branch main, up to date with origin/main`, com 17 arquivos pendentes de VOZ-014 (não commitados) + `docs/VOZ-014-REPORT.md` untracked
- **Baseline VOZ-016 (pós VOZ-014):** `32 files, 484 testes, 484 passou`, `tsc 0`, `build` 28 rotas (com `/dev/voice-test`), `lint` baseline preexistente sem `gen-wav` (removido VOZ-014)
- **voice-transcription** intacto, independente, `dist/` buildado, `playwright` validado VOZ-015

## 3. Referência ao VOZ-014

VOZ-014 removeu 17 caminhos (629 linhas + 6 binários sine 1.3 MB):

- `src/lib/voice/{metrics,dataset/benchmark,split,stt/moonshine,engines/moonshine,types}`, `src/types/moonshine.d.ts`, `public/voice-benchmark/*×6`, `scripts/gen-wav.js`, `__tests__/metrics,voice`, `registry` edit (remove `moonshine-tiny`).

Classificação A-G, `git grep` antes de cada remoção, `484 testes` pós, `tsc 0`, `build` OK.

> Não recriar trabalho: VOZ-016 parte deste estado, não repete remoções VOZ-014. Relatório VOZ-014 é referência (§2).

## 4. Referência ao VOZ-015

VOZ-015 **não modificou** `vanzacariasnutri`; validou `voice-transcription` fisicamente:

- Browser `Chrome Headless 153` `isSecureContext true`, `WASM true`, `Worker true`, `getUserMedia true`
- Vosk `vosk-model-small-pt-0.3` load `3532ms`, `HCLr.fst/Gr.fst`, chunk `4096`, `retrieveFinalResult`, pipeline `mono 16kHz`
- Node `56 testes`, `tsc 0`, `build` OK; WAV sine → `""` (correto), microfone fake PASS, voz humana BLOCKED (limitação headless, não falha)

## 5. Inventário (resíduos VOZ-016)

Auditado `src/lib/voice/**`, `src/components/**`, `app/dev/**`, `public/**`, `scripts/**`, `__tests__/**`, `docs/**`, `package.json`, `next.config.*`, `sw.*` via `git grep` para `voice|vosk|speech|transcription|benchmark|dataset|fixture|debug|metrics|lab|test|experimental|recording|microphone|getUserMedia|AudioContext|Worker|WASM`.

| # | Artefato | Categoria | Referências | Decisão |
|---|----------|-----------|-------------|---------|
| 1 | `src/lib/voice/audio/capture.ts` | **PRODUÇÃO** | `voiceController:16` `captureAudio`, `ChatAssistant` via `useVoiceInput` | **PRESERVAR** |
| 2 | `src/lib/voice/audio/normalize.ts` | **PRODUÇÃO** | `stt/vosk:6` | **PRESERVAR** |
| 3 | `src/lib/voice/debug.ts` | **PRODUÇÃO (C)** | `ChatAssistant:8`, `voiceController:20`, `vosk:5`, `engines/vosk:23` | **PRESERVAR** — flag útil, sem custo |
| 4 | `src/lib/voice/pwa/modelCache.ts` | **PRODUÇÃO** | `vosk:7`, `sw:10`, `next.config:32` | **PRESERVAR** |
| 5 | `src/lib/voice/stt/vosk.ts` | **PRODUÇÃO** | `engines/vosk:1`, `voiceController` | **PRESERVAR** — pipeline Vosk |
| 6 | `src/lib/voice/stt/engines/vosk.ts` | **PRODUÇÃO** | `registry:26` | **PRESERVAR** |
| 7 | `src/lib/voice/stt/engineState.ts` | **PRODUÇÃO** | `voiceController:18` | **PRESERVAR** |
| 8 | `src/lib/voice/stt/registry.ts` | **PRODUÇÃO** | `voiceController:14`, `dev/voice-test:4` (removido) | **PRESERVAR** (vosk-only pós VOZ-014) |
| 9 | `src/lib/voice/useVoiceInput.ts` | **PRODUÇÃO** | `ChatAssistant:7` | **PRESERVAR** |
| 10 | `src/lib/voice/voiceController.ts` | **PRODUÇÃO** | `useVoiceInput:16` | **PRESERVAR** |
| 11 | `src/app/dev/voice-test/page.tsx` (45892 B) | **LABORATÓRIO** | `git grep voice-test -- src` → só `voiceLabSeparation:5` + si mesmo, `fetch /moonshire.wav` | **REMOVER** — Caso A: ferramenta dev lab independente, sem uso prod |
| 12 | `public/moonshire.wav` (2301962 B) | **LABORATÓRIO** | `dev/voice-test:227` fetch, `voiceLabSeparation` | **REMOVER** — fixture só para dev page |
| 13 | `src/lib/voice/__tests__/voiceLabSeparation.test.ts` (129 linhas) | **LABORATÓRIO** | `pagePath src/app/dev/voice-test/page.tsx` | **REMOVER** — testa separação mic vs fixture do lab |
| 14 | `src/lib/voice/__tests__/*` 15 restantes | **TESTE PRODUÇÃO** | `chatAssistantVoice`, `engineState`, `enginesVosk`, `modelCache`, `normalize`, `registry`, `textarea`, `voiceController×2`, `voiceLifecycle`, `voiceUX`, `voskAccumulation`, `voskChunk`, `voskConcurrency`, `voskTimeout` | **PRESERVAR** |
| 15 | `public/vosk-model-small-pt-0.3.tar.gz` | **PRODUÇÃO** | `vosk:7`, `sw` | **PRESERVAR** — modelo runtime |
| 16 | `public/voice-benchmark`, `dataset`, `metrics`, `moonshine` | — | Já removidos VOZ-014 | — |
| 17 | `package.json` `@moonshine-ai/moonshine-js@0.1.29` | **LABORATÓRIO órfã** | `git grep moonshine -- src` → 0 pós VOZ-014 | **REMOVER** — órfã comprovada |
| 18 | `src/sw.ts`, `next.config.ts` | **PRODUÇÃO** | `VOSK_MODEL_RUNTIME_CACHING` | **PRESERVAR** |
| 19 | `docs/VOZ-014-REPORT.md`, `VOZ-015-REPORT.md`, `VOZ-*.md` | **DOCUMENTAÇÃO HISTÓRICA** | Histórico auditável | **PRESERVAR** — nunca remover VOZ-014/015 |

## 6. Mapa do comando de voz de produção

```
microfone (getUserMedia channelCount1, sem echo/noise/AGC)
  ↓ captureAudio → AudioContext (latency interactive, resume suspended) + MediaStream
  ↓ createPcmRecorder (ScriptProcessor 4096, onaudioprocess push Float32)
  ↓ voiceController.start() → capture → AudioContext running → recorder.start() → recording 60s limite
  ↓ voiceController.stop() → recorder.stop() → PCM Float32 na taxa real (ex 48k) → resampleTo16k (linear) → 16kHz mono
  ↓ vosk.ts: trimSilence (100ms/0.01/500ms keep200ms) → normalizePcm (peak 0.9 DC)
  ↓ transcribeWithVosk: chunk 4096 → acceptWaveformFloat → retrieveFinalResult → segments[] join → remove()
  ↓ voiceController.onTranscript(text) → useVoiceInput → ChatAssistant setInput → textarea
  ↓ estados: recording → processing → transcribing → result → isBusy/error/recordingElapsedMs + formatElapsedMs
```

**Arquivos no caminho (PRODUÇÃO, não remover):**

`capture.ts`, `normalize.ts`, `vosk.ts`, `engines/vosk.ts`, `pwa/modelCache.ts`, `engineState.ts`, `registry.ts` (vosk-only), `voiceController.ts`, `useVoiceInput.ts`, `debug.ts`, `ChatAssistant.tsx`, `vosk-model.tar.gz`, `sw.ts`, `next.config.ts` header.

## 7. Artefatos preservados

- Produção acima (11 arquivos core + ChatAssistant + sw/next)
- 15 testes de produção (engineState, normalize, registry, voiceController×2, lifecycle, etc.)
- `debug.ts` (instrumentação controlada, 5 consumidores, sem PII)
- `public/vosk-model-small-pt-0.3.tar.gz` (32 MB, local-only)
- `docs/VOZ-*.md` (32 históricos + VOZ-014/015)

## 8. Artefatos identificados como laboratório

- `src/app/dev/voice-test/page.tsx` — lab neutro STT, 45k linhas, `VOICE / STT LAB — DEV ONLY — lab neutro`, compara engines, fixture vs mic, sem ChatAssistant, rota `/dev/voice-test` dev-only
- `public/moonshire.wav` — fixture 2.3 MB 48kHz stereo, inglês, `AUDIO FIXTURE public/moonshire.wav` só para dev page
- `src/lib/voice/__tests__/voiceLabSeparation.test.ts` — valida separação mic vs fixture dentro do lab (lê `page.tsx` via fs, regex)
- `package.json` `@moonshine-ai/moonshine-js` — resto órfão de VOZ-014 (37 pacotes, `onixruntime-web` etc.)

## 9. Artefatos removidos

| Caminho | Linhas/Bin | Categoria |
|---------|------------|-----------|
| `src/app/dev/voice-test/page.tsx` | 877 | LAB |
| `src/app/dev/voice-test/` (pasta) | — | LAB |
| `src/app/dev/` (pasta, vazia) | — | LAB |
| `public/moonshire.wav` | 2301962 B | LAB fixture |
| `src/lib/voice/__tests__/voiceLabSeparation.test.ts` | 129 | LAB teste |
| `package.json` `@moonshine-ai/moonshine-js` + `package-lock.json` | 344 linhas removidas, 37 pacotes | LAB órfã |

Total VOZ-016: **4 deletions + 1 pasta + 1 dep** (VOZ-014+016 combinados: 22 files, 1969 linhas + 7 bins 3.6 MB).

## 10. Justificativa individual

- **`dev/voice-test/page.tsx`:** `git grep voice-test -- src` → só `voiceLabSeparation` + si mesmo. Não importado por `ChatAssistant`, `dashboard`, `admin`. Rota dev, não prod. Criado para comparar Vosk vs Moonshine (Moonshine já removido). Com `voice-transcription` independente, validação pode ser feita lá. **Caso A → REMOVER**. Verificado: `next build` pós-remoção não lista `/dev/voice-test` (27 rotas).

- **`public/moonshire.wav`:** `git grep moonshire` → só `dev/voice-test` (8 hits) + `voiceLabSeparation`. Não usado por `ChatAssistant` (usa mic). Fixture lab. **Remover com dev page**.

- **`voiceLabSeparation.test.ts`:** Lê `src/app/dev/voice-test/page.tsx` via `fs`, testa `FALAR/PARAR/micPcmRef vs fixtureRef`. Sem dev page, teste quebra (lê arquivo inexistente). Laboratório puro. **Remover**.

- **`@moonshine-ai/moonshine-js`:** Pós VOZ-014 `git grep moonshine -- src` → 0 (só docs). `npm uninstall` remove 37 pacotes, `package-lock` 344 linhas. **Órfã comprovada → REMOVER** (adiada em VOZ-014 para evitar churn, agora final).

## 11. `dev/voice-test`

- **Localização:** `src/app/dev/voice-test/page.tsx` (ex-45k)
- **Classificação:** **Caso A — LABORATÓRIO** (ferramenta independente, lab neutro, sem ChatAssistant, sem `/api/stt`)
- **Decisão:** **REMOVER** (ver §10). Não tem função parcial útil que justifique manter parte; todo o arquivo é lab.

## 12. Debug / instrumentação

- **Auditado:** `src/lib/voice/debug.ts` (5084 B) → `isVoiceDebugEnabled` (`NEXT_PUBLIC_VOICE_DEBUG`), `voiceDebugLog`, `computePcmStats`, `computeWindowDistribution`
- **Consumidores:** `ChatAssistant:8`, `voiceController:20`, `vosk:5`, `engines/vosk:23`, `capture:4` — 5 arquivos produção
- **Classificação:** **Debug controlado útil** (não instrumentação temporária). Quando flag desativada (default), 0 custo runtime além de `if` check.
- **Decisão:** **PRESERVAR**. Não remover observabilidade útil (§7).

## 13. Fixtures / áudios

| Fixture | Runtime? | Decisão |
|---------|----------|---------|
| `public/vosk-model-small-pt-0.3.tar.gz` | SIM (Vosk) | **PRESERVAR** (§12) |
| `public/moonshire.wav` | NÃO (só dev/voice-test) | **REMOVER** |
| `public/voice-benchmark/*` | NÃO | Já removido VOZ-014 |
| `fixtures` externos | — | N/A |

## 14. Testes

| Teste | Protege | Decisão |
|-------|---------|---------|
| `chatAssistantVoice`, `engineState`, `enginesVosk`, `modelCache`, `normalize`, `registry`, `textarea`, `voiceController×2`, `voiceLifecycle`, `voiceUX`, `voskAccumulation`, `voskChunk`, `voskConcurrency`, `voskTimeout` (15) | Comando de voz prod | **PRESERVAR** |
| `voiceLabSeparation` | Lab dev/voice-test | **REMOVER** |
| `metrics`, `voice` | Lab benchmark/moonshine | Já removidos VOZ-014 |

Redução 484→472 explicada (§20).

## 15. Documentação

- **Produção:** `docs/VOZ-014-REPORT.md`, `voice-transcription/docs/VOZ-015-REPORT.md` — **PRESERVAR** (rastreabilidade, §10)
- **Histórica:** 30 `VOZ-00*.md` + `VOICE-EXTERNAL-AUDIT` — **PRESERVAR** (não apagar por idade)
- **Temporária lab:** Nenhuma restante (voice-benchmark docs já removidos)

## 16. Dependências

| Dep | Usada por prod? | Decisão |
|-----|-----------------|---------|
| `vosk-browser@0.0.8` | SIM (`stt/vosk.ts` `import('vosk-browser')`) | **PRESERVAR** (§11) |
| `@moonshine-ai/moonshine-js@0.1.29` | NÃO (`git grep` 0) | **REMOVER** (`npm uninstall`, 37 pacotes, -344 linhas lock) |
| Outras (`next`, `react`, `supabase`, `serwist`) | SIM | **PRESERVAR** |

## 17. Modelo Vosk

- **Auditado:** `public/vosk-model-small-pt-0.3.tar.gz` 32 MB, `VOSK_MODELS['small-pt-0.3'].url` `/vosk-model-small-pt-0.3.tar.gz?v=0.3`, Worker fetch same-origin, local-only
- **Ainda usado?** SIM — `vosk.ts` `new Vosk.Model(url)`, `sw.ts` CacheFirst, `next.config` immutable header
- **Decisão:** **PRESERVAR** (§12). Não remover só porque copy existe em `voice-transcription/models/` — Vanzacarias ainda depende dele até integração.

## 18. PWA / Service Worker

- **Auditado:** `src/sw.ts` `VOSK_MODEL_RUNTIME_CACHING` (CacheFirst `vosk-model`, maxEntries 2, maxAge 90d, matcher `isVoskModelRequest`), `next.config.ts` header `immutable`
- **Decisão:** **PRESERVAR** — ainda consumido pelo comando de voz (§13). Nenhuma referência lab órfã.

## 19. Busca de referências órfãs

Após limpeza:

```bash
git grep -l "moonshine|benchmark|dataset|voice-benchmark|gen-wav|metrics" -- src
# 0 hits (só ChatAssistant contém "voice" via useVoiceInput, não lab)
git grep "moonshire|voiceLabSeparation" -- src
# 0 (removidos)
git grep "moonshine" -- package.json
# 0 (removido)
```

Documentação histórica (`docs/VOZ-*.md`) ainda contém termos — **esperado**, não é órfã runtime.

**Imports quebrados:** `tsc --noEmit` 0, `build` OK — nenhum.

## 20. Testes antes/depois

| Comando | Antes (pós VOZ-014) | Depois VOZ-016 | Delta | Status |
|---------|---------------------|----------------|-------|--------|
| `npx vitest run` | 32 files, 484 testes | **31 files, 472 testes** | **-12** (1 arquivo `voiceLabSeparation` 12 testes) | **PASS** 0 falhas |
| `npx tsc --noEmit` | 0 erros | **0 erros** (após `rm .next`) | 0 | **PASS** |
| `npm run lint` | baseline preexistente (~130 any, sem gen-wav) | **mesma baseline, -0** (voice-test any removidos) | melhora | **PASS** (exit 1 preexistente, não novo) |
| `npm run build` | 28 rotas (com `/dev/voice-test`) | **27 rotas** (sem `/dev/voice-test`) | **-1 rota lab** | **PASS** |
| `voice-transcription npm test` | 56 | **56** | 0 | **PASS** (não modificado) |

Redução explicada: só teste lab removido, nenhum teste prod.

## 21. TypeScript

`npx tsc --noEmit` → `0 erros` após limpar `.next` cache (que ainda referenciava `dev/voice-test/page.js`).

## 22. Lint

`npm run lint` → mesmos warnings `react-hooks`, `no-explicit-any` em `vosk`/`voice` (preexistente), **sem** `gen-wav.js` (já removido) e **sem** `voice-test` any (removido) → melhora.

## 23. Build

`npm run build` → 19.0s, 27 rotas, `sw.js` bundled, sem `/dev/voice-test`, sem `Failed to compile`.

## 24. Validação do comando de voz

Não modificado nesta sprint (§15 proibido alterar UX), mas validado por **testes de produção** e **código preservado**:

```
ChatAssistant (useVoiceInput) → voiceController.start() → captureAudio → createPcmRecorder → stop() → resample → vosk → onTranscript → textarea
```

- `src/components/ChatAssistant.tsx:555` `const voice = useVoiceInput({onTranscript})` intacto
- `src/lib/voice/{voiceController,useVoiceInput,capture,normalize,vosk,registry,engineState,modelCache,debug}` intactos
- **Validação manual física:** `BLOCKED` — requer `getUserMedia` + fala humana em browser seguro; mesma limitação VOZ-015. Marcado `BLOCKED` não `PASS` (§15). **Não simulado.**

Testes que garantem comando:
- `chatAssistantVoice` (onTranscript preserva texto)
- `voiceController` (60 tests)
- `voiceLifecycle`, `voskChunk`, `voskAccumulation`, etc.

## 25. Git diff

```bash
git status
 M package-lock.json
 M package.json
 D public/moonshire.wav
 D public/voice-benchmark/PTBR-0*.wav (6, já VOZ-014)
 D scripts/gen-wav.js (VOZ-014)
 D src/app/dev/voice-test/page.tsx
 D src/lib/voice/__tests__/metrics.test.ts (VOZ-014)
 D src/lib/voice/__tests__/voice.test.ts (VOZ-014)
 D src/lib/voice/__tests__/voiceLabSeparation.test.ts
 D src/lib/voice/dataset/benchmark.ts (VOZ-014)
 D src/lib/voice/dataset/split.ts (VOZ-014)
 D src/lib/voice/metrics.ts (VOZ-014)
 D src/lib/voice/stt/engines/moonshine.ts (VOZ-014)
 D src/lib/voice/stt/moonshine.ts (VOZ-014)
 M src/lib/voice/stt/registry.ts (VOZ-014)
 D src/lib/voice/stt/types.ts (VOZ-014)
 D src/types/moonshine.d.ts (VOZ-014)

git diff --stat
 22 files changed, 14 insertions(+), 1969 deletions(-)
  - VOZ-014: 17 files, 629 linhas + 6 bins
  - VOZ-016: +5 files (dev page 877, moonshire 2.3MB, voiceLabSeparation 129, package 344)

git diff --name-status
 M  package-lock.json
 M  package.json
 D  public/moonshire.wav
 D  src/app/dev/voice-test/page.tsx
 D  src/lib/voice/__tests__/voiceLabSeparation.test.ts
 # ... + VOZ-014 deletions pendentes
```

Diff contém **somente limpeza lab** — 0 alterações em `ChatAssistant`, `voiceController`, `useVoiceInput`, `capture`, `normalize`, `vosk`, `engineState`.

## 26. Itens preservados por dúvida

| Item | Motivo |
|------|--------|
| `src/lib/voice/debug.ts` | Flag útil, 5 consumidores, dúvida → preservar |
| `docs/VOZ-*.md` (32) | Histórico, dúvida → preservar |
| `src/lib/voice/__tests__/*` 15 restantes | Todos B, dúvida → preservar |
| `voice-transcription` | Não modificado por design |

## 27. Pendências

| Pendência | Status |
|-----------|--------|
| Integrar `voice-transcription` ao Vanzacarias | **FORA DE ESCOPO** — sprint futura |
| Remover pipeline `src/lib/voice` após integração | **FUTURO** |
| Métricas WER em dataset real | **FUTURO** |

## 28. Fora do escopo

Não feito (§14): remover comando voz, `voiceController`, `useVoiceInput`, captura, Vosk, modelo, `ChatAssistant`, Composer, Smart Suggestions, RAG, backend, trocar engine, Moonshine, AudioWorklet, SaaS, etc.

## 29. DoD (§21)

- [x] VOZ-014 consultado (17 caminhos, 629 linhas)
- [x] VOZ-015 consultado (Vosk load 3532ms, chunk 4096, BLOCKED honesto)
- [x] baseline registrado (484 testes, tsc 0, build 28 rotas)
- [x] comando de voz mapeado (10 arquivos produção)
- [x] infraestrutura produção identificada
- [x] laboratório restante identificado (dev/voice-test, moonshire, voiceLabSeparation, moonshine dep)
- [x] `dev/voice-test` avaliado (Caso A → REMOVER)
- [x] debug avaliado (preservar)
- [x] fixtures avaliadas (moonshire → remover, modelo → preservar)
- [x] testes classificados (15 B preservar, 1 D remover)
- [x] documentação classificada (preservar)
- [x] dependências classificadas (vosk → preservar, moonshine → remover)
- [x] modelo Vosk classificado (preservar)
- [x] PWA/SW classificados (preservar)
- [x] somente lab comprovado removido (4 + dep)
- [x] comando de voz preservado (ChatAssistant:555 intacto)
- [x] ChatAssistant preservado
- [x] voiceController/useVoiceInput preservados
- [x] Vosk produção preservado
- [x] modelo produção preservado
- [x] referências órfãs eliminadas (0 hits moonshine/benchmark em src)
- [x] testes passando (472/472)
- [x] TypeScript passando (0)
- [x] lint passando (baseline preexistente)
- [x] build passando (27 rotas)
- [x] comando voz não sofreu alteração funcional
- [x] voice-transcription não foi modificado (56 testes)
- [x] diff auditado (22 files, 14+/1969-)
- [x] `VOZ-016-REPORT.md` criado (este arquivo)
- [x] nenhum commit/push/deploy

## 30. Conclusão

```
ANTES VOZ-016: vanzacariasnutri { produção (ChatAssistant+voiceController+useVoiceInput+Vosk) + lab residual (dev/voice-test, moonshire, voiceLabSeparation, moonshine dep) } + voice-transcription
DEPOIS:        vanzacariasnutri { produção intacta + 15 testes prod + docs + modelo + PWA } + voice-transcription { motor }
```

A limpeza final removeu os **últimos resíduos** de 3 sprints de investigação (877 linhas dev page + 2.3 MB wav + 129 linhas teste + 37 pacotes moonshine = 1969 linhas totais com VOZ-014), sem tocar no comando de voz. O VanzacariasNutri permanece com **mesmo fluxo** `microfone → captura → Vosk PT-BR 32 MB → transcrição → textarea`, validado por 472 testes e build 27 rotas. O laboratório foi **eliminado**, a produção **preservada**.

*Nenhum commit/push/deploy realizado sem autorização. Diff pronto para review.*
