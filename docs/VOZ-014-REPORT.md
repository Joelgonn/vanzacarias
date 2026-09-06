# VOZ-014 — Auditoria e Limpeza do Laboratório de Voz

**Data:** 2026-09-06
**Sprint:** VOZ-014
**Predecessora:** VOZ-013 (criação do `voice-transcription` irmão)
**Tipo:** Limpeza cirúrgica — não refatoração, não integração

---

## 1. Ambiente

| Item | Caminho absoluto | Verificação |
|------|------------------|-------------|
| WORKSPACE | `C:\Users\joelg\Documents\Vanusa` | `Get-ChildItem` lista 2 entradas |
| vanzacariasnutri | `C:\Users\joelg\Documents\Vanusa\vanzacariasnutri` | `git status` clean antes |
| voice-transcription | `C:\Users\joelg\Documents\Vanusa\voice-transcription` | `Test-Path package.json` True, `docs/VOZ-013-REPORT.md` existe |
| Branch | `main` | `git log --oneline -5` mostra `db44a70` CHAT-SUG-002 |
| Node | `v22+` | `vitest 4.1.10` |

Estado inicial fotografado antes de qualquer alteração: `git status` = `nothing to commit, working tree clean`. VOZ-013 já havia criado o projeto irmão com `56 testes` passando, `dist/` buildado, `README` + `VOZ-013-REPORT`.

---

## 2. Baseline (antes da limpeza)

Executado em `vanzacariasnutri` antes de qualquer remoção:

| Comando | Resultado |
|---------|-----------|
| `npx vitest run` | **34 arquivos, 515 testes, 515 passaram** (6.63s) |
| `npx tsc --noEmit` | **0 erros** (`exit 0`) |
| `npm run lint` (`eslint`) | Erros preexistentes: `src/lib/voice/debug`/`vosk` `no-explicit-any` (~90), `voice-test` `any` (~40), `gen-wav.js` `no-require-imports` ×2, warnings `react-hooks` (~15). Sem novos erros introduzidos pela sprint. Build não bloqueia lint (preexistente baseline). |
| `npm run build` (`next build --webpack`) | **Sucesso**. 28 rotas, `9cb48f3a` 5.79 MB não precacheado (aviso esperado), `TypeScript` OK, `Generating static pages 28/28` em 20.2s. Rota `/dev/voice-test` presente. |

Baseline documentado para comparação pós-limpeza (§16 da spec).

---

## 3. Inventário

Tabela completa de artefatos de voz encontrados em `vanzacariasnutri`:

| # | Artefato | Categoria | Referências verificadas | Decisão | Justificativa |
|---|----------|-----------|--------------------------|---------|---------------|
| 1 | `src/lib/voice/audio/capture.ts` (10717 B) | **A — PRODUÇÃO** | `voiceController.ts:16` `captureAudio`, `useVoiceInput` via controller, 0.5s-60s PCM | **PRESERVAR** | Captura `getUserMedia` mono 16k usada pelo `ChatAssistant` via `useVoiceInput` |
| 2 | `src/lib/voice/audio/normalize.ts` (3693 B) | **A — PRODUÇÃO** | `stt/vosk.ts:6` `normalizePcm` + `trimSilence` | **PRESERVAR** | Trim/normalização VOZ-010 do pipeline Vosk |
| 3 | `src/lib/voice/debug.ts` (5084 B) | **C — FERRAMENTA ÚTIL** | `ChatAssistant.tsx:8`, `voiceController.ts:20`, `stt/vosk.ts:5`, `stt/engines/vosk.ts:23`, `audio/capture.ts:4` | **PRESERVAR** | `isVoiceDebugEnabled` + `computePcmStats` atrás de flag `NEXT_PUBLIC_VOICE_DEBUG`, útil, sem PII |
| 4 | `src/lib/voice/metrics.ts` (2426 B) | **D — LABORATÓRIO** | `git grep metrics` → só `__tests__/metrics.test.ts:2` | **REMOVER** | WER/CER/RTF duplicado de `dataset/benchmark.ts`, sem uso em produção |
| 5 | `src/lib/voice/dataset/benchmark.ts` (6490 B) | **D — LABORATÓRIO** | `dataset/split.ts:2`, `__tests__/voice.test.ts:3` | **REMOVER** | 40 amostras sintéticas A-I, sem PII, usado só para WER em teste lab |
| 6 | `src/lib/voice/dataset/split.ts` (1041 B) | **D — LABORATÓRIO** | `__tests__/voice.test.ts:7` | **REMOVER** | Split train/val/test sem vazamento, só para `voice.test` |
| 7 | `src/lib/voice/pwa/modelCache.ts` (2321 B) | **A — PRODUÇÃO** | `stt/vosk.ts:7`, `sw.ts:10`, `next.config.ts:32` header, `__tests__/modelCacheVOZ0124` | **PRESERVAR** | URL versionada `?v=0.3`, CacheFirst `vosk-model`, header `immutable` |
| 8 | `src/lib/voice/stt/vosk.ts` (20449 B) | **A — PRODUÇÃO** | `stt/engines/vosk.ts:1`, `voiceController` via registry | **PRESERVAR** | Pipeline Vosk PT-BR validado (chunk 4096, retrieveFinalResult, guard proporcional) |
| 9 | `src/lib/voice/stt/moonshine.ts` (5844 B) | **D — LABORATÓRIO** | `stt/engines/moonshine.ts:4`, `__tests__/voice.test.ts:4` | **REMOVER** | Runtime Moonshine ESM/CDN, inglês tiny, sem pt-BR, descartado VOZ-004 |
| 10 | `src/lib/voice/stt/registry.ts` (1212 B) | **A — PRODUÇÃO** | `voiceController.ts:14`, `app/dev/voice-test/page.tsx:4` | **PRESERVAR (editar)** | Registry mínimo; moonshine entry removida (ver #10b) |
| 10b | `registry.ts` entry `moonshine-tiny` | **F — LEGADO** | `registry.ts:31` único uso, `ChatAssistant` fixa `vosk-pt-br` | **REMOVER entry** | Legado lab, não usado em produção |
| 11 | `src/lib/voice/stt/engineState.ts` (2934 B) | **A — PRODUÇÃO** | `voiceController.ts:18`, `dev/voice-test`, 3 testes | **PRESERVAR** | Máquina `IDLE→LOADING→READY→TRANSCRIBING→RESULT` |
| 12 | `src/lib/voice/stt/types.ts` (510 B) | **F — DUPLICADO** | `git grep stt/types` → 0 hits | **REMOVER** | `STTResult` duplicado de `registry.ts`, nunca importado |
| 13 | `src/lib/voice/stt/engines/vosk.ts` (5695 B) | **A — PRODUÇÃO** | `stt/registry.ts:26` | **PRESERVAR** | Engine Vosk com keep-warm 10min |
| 14 | `src/lib/voice/stt/engines/moonshine.ts` (2350 B) | **D — LABORATÓRIO** | `stt/registry.ts:27` (removida) | **REMOVER** | Wrapper lab sem correção ESM |
| 15 | `src/lib/voice/useVoiceInput.ts` (4127 B) | **A — PRODUÇÃO** | `ChatAssistant.tsx:7` | **PRESERVAR** | Hook `useVoiceInput` usado pelo ChatAssistant |
| 16 | `src/lib/voice/voiceController.ts` (25996 B) | **A — PRODUÇÃO** | `useVoiceInput.ts:16` | **PRESERVAR** | Controller start/stop, engine load, resample, transcrição |
| 17 | `src/lib/voice/__tests__/chatAssistantVoice.test.ts` (4336 B) | **B — TESTE PERMANENTE** | Testa `onTranscript` preserva texto existente | **PRESERVAR** | Protege integração ChatAssistant+voz |
| 18 | `__tests__/engineState.test.ts` | **B** | Máquina de estados | **PRESERVAR** |
| 19 | `__tests__/enginesVoskVOZ0124.test.ts` | **B** | Cache + warm | **PRESERVAR** |
| 20 | `__tests__/metrics.test.ts` (2073 B) | **D — LABORATÓRIO** | Só testa `metrics.ts` (removido) | **REMOVER** | Sem produção |
| 21 | `__tests__/modelCacheVOZ0124.test.ts` | **B** | ModelCache PWA | **PRESERVAR** |
| 22 | `__tests__/normalize.test.ts` | **B** | normalize/trim | **PRESERVAR** |
| 23 | `__tests__/registry.test.ts` | **B** | Registry vosk | **PRESERVAR** |
| 24 | `__tests__/textareaVOZ012.test.ts` | **B** | Textarea preserva cursor | **PRESERVAR** |
| 25 | `__tests__/voice.test.ts` (3909 B) | **D — LABORATÓRIO** | `dataset/benchmark`, `moonshine`, `split` | **REMOVER** | Lab MOONSHINE + benchmark sintético |
| 26 | `__tests__/voiceController.test.ts` | **B** | Controller | **PRESERVAR** |
| 27 | `__tests__/voiceControllerVOZ0122.test.ts` | **B** | Controller 60s limite | **PRESERVAR** |
| 28 | `__tests__/voiceLabSeparation.test.ts` | **B/C** | Separação mic vs fixture no dev page | **PRESERVAR** | Útil para garantir lab não contamina prod |
| 29 | `__tests__/voiceLifecycleVOZ012.test.ts` | **B** | Lifecycle | **PRESERVAR** |
| 30 | `__tests__/voiceUXVOZ0122.test.ts` | **B** | UX voz | **PRESERVAR** |
| 31 | `__tests__/voskAccumulation.test.ts` | **B** | Acumulação F01 | **PRESERVAR** |
| 32 | `__tests__/voskChunk.test.ts` | **B** | Chunk 4096 F02 | **PRESERVAR** |
| 33 | `__tests__/voskConcurrencyVOZ0125.test.ts` | **B** | Dedup load | **PRESERVAR** |
| 34 | `__tests__/voskTimeoutVOZ0123.test.ts` | **B** | Guard proporcional | **PRESERVAR** |
| 35 | `src/app/dev/voice-test/page.tsx` (45892 B) | **C — FERRAMENTA ÚTIL** | Rota `/dev/voice-test`, import registry, dev-only | **PRESERVAR** | Lab neutro útil para validação manual, sem impacto prod |
| 36 | `public/vosk-model-small-pt-0.3.tar.gz` (32405987 B) | **A — PRODUÇÃO** | `stt/vosk.ts` `VOSK_MODELS` URL, `sw.ts` cache | **PRESERVAR** | Modelo Vosk PT-BR produção (não remover porque copy existe em voice-transcription) |
| 37 | `public/moonshire.wav` (2301962 B) | **C — FERRAMENTA** | `dev/voice-test` fetch `/moonshire.wav` | **PRESERVAR** | Fixture WAV dev page, 2.3 MB stereo 48k |
| 38 | `public/voice-benchmark/PTBR-0*.wav` ×6 (1.3 MB total) | **E — ARTEFATO TEMPORÁRIO** | `git grep voice-benchmark` → só `scripts/gen-wav.js` | **REMOVER** | Sine 440Hz gerados por `gen-wav.js`, não fala real, sem ground-truth |
| 39 | `scripts/gen-wav.js` (2053 B) | **E — ARTEFATO TEMPORÁRIO** | Gera voice-benchmark | **REMOVER** | Script temporário VOZ-001, não usado em build |
| 40 | `src/types/moonshine.d.ts` (1 linha) | **D — LABORATÓRIO** | `declare module '@moonshine-ai/moonshine-js'` | **REMOVER** | Tipos só para moonshine removido |
| 41 | `docs/VOICE-EXTERNAL-AUDIT-REPORT.md` + 32 `VOZ-*.md` | **A/C — HISTÓRICO** | Documentam decisões arquiteturais | **PRESERVAR** | Não apagar histórico (auditoria §10) |
| 42 | `src/sw.ts` (Serwist) | **A — PRODUÇÃO** | `VOSK_MODEL_RUNTIME_CACHING` CacheFirst | **PRESERVAR** | PWA cache modelo |
| 43 | `next.config.ts` header | **A — PRODUÇÃO** | `Cache-Control immutable` para tar.gz | **PRESERVAR** | HTTP cache antes do SW |
| 44 | `package.json` dep `@moonshine-ai/moonshine-js` | **D — LABORATÓRIO (órfã)** | Após remoções, `git grep moonshine` em `src` → 0 | **PRESERVAR nesta sprint (documentar)** | Órfã comprovada, mas remoção adiada para evitar churn `package-lock` nesta limpeza cirúrgica; Futura sprint |

---

## 4. Produção preservada

Tudo que continua necessário ao Vanzacarias:

- `src/lib/voice/audio/{capture,normalize}` — pipeline PCM
- `src/lib/voice/{debug,useVoiceInput,voiceController}` — controller + hook
- `src/lib/voice/stt/{vosk,registry,engineState}` + `engines/vosk` + `pwa/modelCache` — STT Vosk PT-BR
- `src/lib/voice/__tests__` — 30 arquivos B (engineState, normalize, registry, voiceController×2, lifecycle, UX, accumulation, chunk, concurrency, timeout, etc.)
- `src/components/ChatAssistant.tsx` voz — `useVoiceInput({onTranscript})`, `formatElapsedMs`, `isVoiceDebugEnabled`
- `src/app/dev/voice-test/page.tsx` — ferramenta dev (preservada)
- `public/vosk-model-small-pt-0.3.tar.gz` + `public/moonshire.wav` — modelo + fixture dev
- `src/sw.ts` + `next.config.ts` — PWA/Cache headers

---

## 5. Laboratório identificado

Exclusivamente experimentação, sem função atual:

- Moonshine (`stt/moonshine.ts`, `engines/moonshine.ts`, `types/moonshine.d.ts`) — investigação inglesa descartada §4 VOZ-013
- Dataset sintético (`dataset/benchmark.ts`, `split.ts`) — 40 frases sem PII, sem áudio real
- Métricas (`metrics.ts`) — WER/CER duplicado
- `stt/types.ts` — tipos órfãos duplicados
- `public/voice-benchmark` — 6 wavs sine 440Hz gerados por `gen-wav.js`
- `scripts/gen-wav.js` — gerador temporário
- `__tests__/voice.test.ts` + `metrics.test.ts` — testes desses labs

---

## 6. Remoções realizadas

| Caminho | Categoria | Referências verificadas | Motivo |
|---------|-----------|--------------------------|--------|
| `src/lib/voice/stt/types.ts` | F | `git grep stt/types` → 0 | Tipos duplicados nunca importados |
| `src/lib/voice/metrics.ts` | D | `git grep metrics` → só `metrics.test.ts` | WER duplicado sem uso prod |
| `src/lib/voice/dataset/benchmark.ts` | D | `split.ts` + `voice.test.ts` | Benchmark sintético lab |
| `src/lib/voice/dataset/split.ts` | D | `voice.test.ts` | Split lab |
| `src/lib/voice/dataset/` (pasta) | D | vazia após acima | Removida |
| `src/lib/voice/stt/moonshine.ts` | D | `engines/moonshine` + `voice.test` | Moonshine inglês descartado |
| `src/lib/voice/stt/engines/moonshine.ts` | D | `registry.ts` | Wrapper lab |
| `src/types/moonshine.d.ts` | D | `declare module` | Tipos moonshine |
| `src/lib/voice/stt/registry.ts` (edit) | F | `moonshine-tiny` entry | Removida entry legada, mantido Vosk |
| `public/voice-benchmark/PTBR-01.wav` .. `PTBR-06.wav` | E | `git grep voice-benchmark` → só `gen-wav.js` | Sine 440Hz, sem fala real |
| `public/voice-benchmark/` (pasta) | E | vazia | Removida |
| `scripts/gen-wav.js` | E | Gera voice-benchmark | Script temporário |
| `src/lib/voice/__tests__/voice.test.ts` | D | Testa benchmark/moonshine | Sem prod, depende dos removidos |
| `src/lib/voice/__tests__/metrics.test.ts` | D | Testa metrics | Sem prod |

Total: **17 caminhos** (16 deletions + 1 edit), `git diff --stat` = `3 insertions, 629 deletions`, 6 binários removidos (1.3 MB).

Cada remoção seguiu: arquivo → `git grep` → classificação → justificativa → `Remove-Item` — sem remoção em bloco de `src/lib/voice`.

---

## 7. Itens preservados por dúvida

Princípio “se houver dúvida, preservar”:

| Item | Motivo para preservar apesar de aparência lab |
|------|-----------------------------------------------|
| `src/app/dev/voice-test/page.tsx` | Ferramenta dev útil (C) — valida pipeline Vosk integrado sem deploy do motor novo; espec §7 proíbe remoção automática |
| `public/moonshire.wav` | Necessário ao `dev/voice-test` (fetch), não é voz do ChatAssistant mas é fixture dev |
| `src/lib/voice/__tests__/voiceLabSeparation.test.ts` | Protege separação mic vs fixture — valor dev |
| `src/lib/voice/debug.ts` | Instrumentação atrás de flag, usada em 5 arquivos prod, mantém sem custo |
| `src/lib/voice/pwa/modelCache.ts` + `sw.ts` + `next.config.ts` header | Produção PWA, não remover só porque voice-transcription tem copy |
| `docs/VOZ-*.md` (32 arquivos) | Histórico arquitetural, não apagar por idade (§10) |
| `package.json` `@moonshine-ai/moonshine-js` | Órfã comprovada mas remoção adiada para próxima sprint (evitar lockfile churn nesta limpeza cirúrgica) |
| `src/lib/voice/stt/vosk.ts` etc. | Pipeline produção — jamais tocado nesta sprint |

---

## 8. Dependências removidas

**Nenhuma dependência npm removida nesta sprint.**

- Auditada: `@moonshine-ai/moonshine-js@0.1.29` — após remoções, `git grep moonshine -- src` → 0 hits em `src` (só docs históricos). Comprovadamente órfã de código prod. Decisão: **preservar nesta sprint**, documentar como órfã para remoção na sprint de integração (evita `package-lock.json` churn e risco de quebrar `npm install` em CI sem necessidade). Ver §17 FUTURO.

Se removida no futuro: `npm uninstall @moonshine-ai/moonshine-js` + `src/types/moonshine.d.ts` já removido → build/lint seguem ok.

---

## 9. PWA / Cache

- **Auditado:** `src/sw.ts` (Serwist) contém `VOSK_MODEL_RUNTIME_CACHING` → `CacheFirst` `vosk-model` com `ExpirationPlugin` (maxEntries 2, maxAge 90d), matcher `sameOrigin && isVoskModelRequest(url)`. Consumido pelo Vosk Worker (`fetch /vosk-model-small-pt-0.3.tar.gz?v=0.3`).
- **next.config.ts:** header `Cache-Control: public, max-age=31536000, immutable` para `/vosk-model-*.tar.gz`.
- **Decisão:** **PRESERVAR**. Ainda consumido pelo Vanzacarias produção. A existência de `voice-transcription/models/` não implica remoção do cache do Vanzacarias (§8, §12).

---

## 10. Modelos / Fixtures

| Artefato | Classificação | Decisão | Justificativa |
|----------|---------------|---------|---------------|
| `public/vosk-model-small-pt-0.3.tar.gz` 32 MB | **A — PRODUÇÃO** | **PRESERVAR** | Modelo Vosk PT-BR produção, local-only, sem fallback remoto. Não remover só porque copy existe em `voice-transcription/models/` (§8) |
| `public/moonshire.wav` 2.3 MB | **C — FERRAMENTA** | **PRESERVAR** | Usado por `/dev/voice-test` (fetch), não é produção mas é dev útil |
| `public/voice-benchmark/PTBR-0*.wav` ×6 | **E — ARTEFATO** | **REMOVER** | Sine 440Hz sintético, sem fala, gerado por `gen-wav.js`, sem referência em `src` produtiva |
| `voice-transcription/models/vosk-model-small-pt-0.3.tar.gz` (irmão) | — | **N/A** (fora do vanzacarias) | Copy de referência, `.gitignore` no motor |

---

## 11. /dev/voice-test

- **Localização:** `src/app/dev/voice-test/page.tsx` (45892 B, rota `/dev/voice-test`, dev-only, lab neutro)
- **Depende de:** `listEngines/getEngine` (`registry`), `engineStateReducer`, `ChatAssistant` não é importado (lab neutro sem ChatAssistant, conforme VOICE-EXTERNAL-AUDIT)
- **Classificação:** **C — FERRAMENTA DE DESENVOLVIMENTO ÚTIL** (não D)
- **Decisão:** **PRESERVAR**. Ainda útil para validação manual do pipeline Vosk atual sem integrar o novo motor. Spec §7: não remover automaticamente. Serve como “ground truth” até a integração futura.
- **Observação:** Usa `fetch('/moonshire.wav')` — por isso `moonshire.wav` preservado.

---

## 12. ChatAssistant

- **Dependências de voz:** `src/components/ChatAssistant.tsx:7` `import { useVoiceInput, formatElapsedMs } from '@/lib/voice/useVoiceInput'` + `isVoiceDebugEnabled`
- **Uso:** `const voice = useVoiceInput({onTranscript: ...})` → `voice.start()/stop()/cancel()`, `voice.isRecording/isBusy/status/error/recordingElapsedMs`, `formatElapsedMs`
- **Alterações nesta sprint:** **Nenhuma** (§6: não transformar em refatoração do ChatAssistant)
- **Decisão:** **PRESERVAR** todo código de voz de produção. Nenhum import obsoleto (registry moonshine não era usado pelo ChatAssistant — sempre `vosk-pt-br`).

---

## 13. Testes pós-limpeza

| Comando | Antes | Depois | Delta |
|---------|-------|--------|-------|
| `npx vitest run` | 34 files, 515 testes | **32 files, 484 testes** | **-31 testes** (2 arquivos D removidos: `voice.test.ts` ~17, `metrics.test.ts` ~14) — 0 falhas |
| `npx tsc --noEmit` | 0 erros | **0 erros** | sem regressão |
| `npm run lint` | baseline preexistente (2 erros `gen-wav.js` require + ~130 any/warnings) | **mesma baseline menos 2 erros `gen-wav.js`** (removido) → restante idêntico, sem novos erros | melhora |
| `npm run build` | Sucesso 28 rotas | **Sucesso 28 rotas** (incluindo `/dev/voice-test`) | sem regressão |
| `voice-transcription` | 56 testes | **56 testes** | intacto, independente |

Todos os testes passam; nenhum teste de produção removido (só labs D).

---

## 14. Git diff

```
git status
  deleted: public/voice-benchmark/PTBR-01..06.wav
  deleted: scripts/gen-wav.js
  deleted: src/lib/voice/__tests__/metrics.test.ts
  deleted: src/lib/voice/__tests__/voice.test.ts
  deleted: src/lib/voice/dataset/benchmark.ts
  deleted: src/lib/voice/dataset/split.ts
  deleted: src/lib/voice/metrics.ts
  deleted: src/lib/voice/stt/engines/moonshine.ts
  deleted: src/lib/voice/stt/moonshine.ts
  deleted: src/lib/voice/stt/types.ts
  deleted: src/types/moonshine.d.ts
  modified: src/lib/voice/stt/registry.ts

git diff --stat
 17 files changed, 3 insertions(+), 629 deletions(-)
  Bin 160044..288044 -> 0 (6 wavs)

Contagem: 0 arquivos de produção removidos por inferência. Diff facilmente explicável:
  REMOVIDO → laboratório/temporário/duplicado comprovado (D/E/F)
  PRESERVADO → produção/teste/ferramenta/doc (A/B/C/G)
```

Não houve alteração em `voice-transcription` (projeto irmão permanece `X`).

---

## 15. Riscos

| Risco | Mitigação |
|-------|-----------|
| Remover Moonshine quebra build se algum import esquecido | `git grep moonshine -- src` antes → 0 após edição registry; `tsc` + `vitest` + `build` pós-remoção OK |
| Remover dataset quebra teste que valida guardrails via voz | `voice.test.ts` testava `leites vegetais` via `simulateVoicePipeline` — mas guardrail real é testado em `src/lib/__tests__/guardrail*` não removidos; sem risco prod |
| Remover voice-benchmark quebra `/dev/voice-test` | `voice-benchmark` nunca usado por `voice-test` (usa `moonshire.wav`); `gen-wav.js` só gerava sine |
| `public/voice-benchmark` era cache PWA? | Não, só `vosk-model` é cacheado; sine wavs não têm regra SW |

---

## 16. Pendências

| Pendência | Status |
|-----------|--------|
| Remover dep `@moonshine-ai/moonshine-js` do `package.json` + `package-lock` | **ADIADA** — órfã comprovada, mas lockfile churn adiado para sprint de integração |
| Integrar `voice-transcription` ao Vanzacarias | **FORA DE ESCOPO** (§14 proibido nesta sprint) |
| Remover pipeline antigo `src/lib/voice` após integração | **FUTURO** — só após motor novo comprovado em produção |

---

## 17. FUTURO / NÃO IMPLEMENTADO

- AudioWorklet em vez de ScriptProcessorNode
- VAD dedicado / novo resampling / troca de modelo (1.6 GB pt-fb) / Moonshine pt-BR — não reabrir investigação Moonshine nesta sprint (VOZ-013 §4)
- Remoção de `vosk-model-small-pt-0.3.tar.gz` do Vanzacarias após integração
- Publicação `voice-transcription` no npm
- Service Worker warm-up/preload do modelo entre navegações
- Métricas WER em dataset real (não sine)

---

## 18. Definition of Done (§21)

- [x] baseline registrada (515 testes, tsc 0, lint baseline, build 28 rotas)
- [x] ecossistema de voz auditado (44 artefatos listados)
- [x] `src/lib/voice/**` analisado arquivo a arquivo (16 arquivos + 18 testes)
- [x] ChatAssistant auditado quanto a voz (1 import, 0 alterações)
- [x] `/dev/voice-test` auditado (C, preservado)
- [x] modelos auditados (tar.gz A, voice-benchmark E)
- [x] fixtures auditados (moonshire C, voice-benchmark E)
- [x] debug/instrumentação auditados (C, preservado)
- [x] documentação auditada (32 VOZ-*.md preservados)
- [x] dependências auditadas (moonshine-js órfã documentada, não removida nesta sprint)
- [x] PWA/Service Worker/cache auditados (A, preservados)
- [x] cada artefato classificado A-G
- [x] referências verificadas via `git grep` antes das exclusões
- [x] somente laboratório comprovado removido (17 caminhos, F/D/E)
- [x] nenhum código de produção removido por inferência (regra G)
- [x] `voice-transcription` permanece independente (56 testes, `X` com vanza)
- [x] Vanzacarias sem depender de `voice-transcription` (sem `file:`, sem monorepo)
- [x] testes pós-limpeza passando (484/484)
- [x] typecheck passando (0)
- [x] lint sem novos erros (melhora -2)
- [x] build passando (28 rotas)
- [x] git diff auditado (3+/629-)
- [x] `docs/VOZ-014-REPORT.md` criado (este arquivo)

---

## 19. Conclusão

A auditoria comprovou que o `vanzacariasnutri` acumulou, ao longo de 14 sprints de voz, um pipeline Vosk PT-BR de produção sólido (Validado fisicamente no Android, VOZ-009/010) misturado a artefatos de investigação (Moonshine inglês, dataset sintético, métricas duplicadas, sine fixtures).

A limpeza removeu **somente** o laboratório comprovado (629 linhas + 6 binários, 31 testes lab) sem tocar em `ChatAssistant`, pipeline Vosk, PWA/cache, modelo, `dev/voice-test` ou 484 testes de produção. O projeto permanece **funcionalmente idêntico** para o usuário (build idêntico, 28 rotas), mas com superfície de voz reduzida ao essencial.

```
ANTES: vanzacariasnutri { produção + lab + sine + moonshine } + voice-transcription { motor }
DEPOIS: vanzacariasnutri { produção + testes úteis + ferramentas + histórico } + voice-transcription { motor }
```

Próximo passo: integração do motor independente (fora desta sprint), quando então o pipeline antigo poderá ser substituído e a dependência `moonshine-js` removida.

*Relatório gerado conforme §20 da spec VOZ-014. Nenhum commit/push realizado sem autorização.*
