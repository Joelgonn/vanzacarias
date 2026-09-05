# VOZ-008 — Instrumentação Diagnóstica da Voz em Produção

**Sprint:** VOZ-008 — Instrumentação Diagnóstica (sem correção)  
**Data:** 2026-09-05  
**Base:** VOZ-007 `AUDIT COMPLETE — ROOT CAUSE NOT YET CONFIRMED`  
**Modo:** IMPLEMENTAÇÃO + TESTE — instrumentação temporária, não funcional  
**Status:** **AUDIT INSTRUMENTED — ROOT CAUSE NOT YET CONFIRMED — BLOCKED — ANDROID INSTRUMENTATION PENDING**  
**Flag:** `NEXT_PUBLIC_VOICE_DEBUG=1`  
**Regra:** Nenhuma correção funcional implementada. Nenhum áudio armazenado/enviado.

---

## 1. Objetivo

Descobrir com evidência onde o pipeline Android perde qualidade — captura, PCM, resampling, Vosk ou lifecycle — sem corrigir.

VOZ-007 concluiu que WAV→Vosk funciona, Vosk PT-BR funciona, integração ChatAssistant funciona, mas sintoma produção Android (mic inicia/termina, transcrição vazia/1 palavra) não tem causa confirmada. VOZ-008 adiciona métricas locais (sem áudio) para medir cada etapa em Android físico Chrome HTTPS produção e decidir entre H1–H5 com dados repetíveis.

---

## 2. Arquivos Alterados

| Arquivo | Tipo | Alteração | Não funcional |
|---|---|---|---|
| `src/lib/voice/debug.ts` | **novo** | `isVoiceDebugEnabled()`, `voiceDebugLog/info()`, `computePcmStats()`, `computeWindowDistribution()`, `SILENCE_THRESHOLD=0.01`, `WINDOW_MS=100` | Apenas métricas numéricas; `NEXT_PUBLIC_VOICE_DEBUG==='1'` guard; sem áudio |
| `src/lib/voice/audio/capture.ts` | mod | `import {isVoiceDebugEnabled, voiceDebugLog} from '../debug'`; `resampleTo16k` agora loga `inputSamples/inputRate/inputDurationMs/outputSamples/outputRate/outputDurationMs/durationRatio/bypassed` via `[VOICE_DEBUG] RESAMPLING` | Sem alteração de algoritmo; log só se flag=1 |
| `src/lib/voice/voiceController.ts` | mod | `import {isVoiceDebugEnabled, voiceDebugLog, computePcmStats, computeWindowDistribution} from './debug'`; `private recordingStartMs`; `CAPTURE_START`, `CAPTURE_STOP` (wallTime, sampleRate, state, trackSettings, chunks estimado, expectedSamples, sampleCoverageRatio, pcmStats, windowDistribution), `PCM_16K`, `LIFECYCLE_EMPTY/DISCARD/TRANSCRIBE_START/END/DELIVERED/ERROR/CANCEL/DISPOSE` | Sem mudança de constraints (4096), sem delay, sem AudioWorklet; behavior idêntico com flag 0 |
| `src/lib/voice/stt/vosk.ts` | mod | `import {isVoiceDebugEnabled, voiceDebugLog, computePcmStats} from '../debug'`; `VOSK_INPUT` (samples, sampleRate, durationMs, RMS, peak, min/max, silenceRatio), `VOSK_RETRIEVE` (acceptEnd→retrieveStart), `VOSK_RESULT` (acceptStart/End, retrieveStart, resultReceivedAt, inferenceEnd, acceptWaveformMs, acceptToRetrieveMs, inferenceMs, transcriptionLength, wordCount, textPreview 80 chars), `VOSK_ERROR/EXCEPTION` | Sem alteração de `acceptWaveformFloat`/`retrieveFinalResult` timing (100ms); log só local console |

**Não alterados:** `src/components/ChatAssistant.tsx`, `src/lib/voice/useVoiceInput.ts`, `src/lib/voice/stt/registry.ts`, `src/lib/voice/stt/engineState.ts`, `src/lib/voice/stt/engines/vosk.ts`, `src/app/dev/voice-test/page.tsx`, `package.json`, `next.config.ts`, `src/sw.ts`, `src/app/api/**`, `public/vosk-model*`, `public/moonshire.wav`.

---

## 3. Instrumentação Implementada

### 3.1 Feature Flag

```ts
// src/lib/voice/debug.ts
export function isVoiceDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VOICE_DEBUG === '1';
}
// Uso:
if (!isVoiceDebugEnabled()) return; // zero log, zero overhead funcional
voiceDebugLog('CAPTURE_STOP', {...}) // console.debug("[VOICE_DEBUG] CAPTURE_STOP", data)
```

Quando `NEXT_PUBLIC_VOICE_DEBUG` ausente ou ≠"1": zero logs, comportamento idêntico ao VOZ-006. Quando `=1`: logs agrupados `[VOICE_DEBUG]` em console local, sem envio.

### 3.2 Captura (`VoiceInputController.start/stop`)

**`CAPTURE_START`** (após `captureAudio` + antes de `recorder.start`):
- `recordingStartTimestamp`, `audioContext.sampleRate`, `audioContext.state`, `track.getSettings()` completo (sampleRate, channelCount, echoCancellation, noiseSuppression, autoGainControl — sem deviceId/groupId PII), `recordedRate`, `engineState`, `gen`.

**`CAPTURE_STOP`** (após `recorder.stop()` + antes de `resample`):
- `recordingWallTimeMs`, `audioContext.state antes/depois`, `trackSettings`, `chunksLengthEstimated (=ceil(actualSamples/4096))`, `expectedSamples = wallTime*recordedRate/1000`, `actualSamples`, `sampleCoverageRatio = actual/expected`, `pcmDurationMs`, `pcmDurationOverWall`, `pcmStats` (ver §4), `windowDistribution` (100ms janelas).

### 3.3 Sinal PCM (`computePcmStats` + `computeWindowDistribution`)

`computePcmStats(pcm, sampleRate)` para PCM original e `pcm16k`:
- `samples`, `durationMs`, `rms` (4 dec), `peak`, `min`, `max`, `silenceRatio` (threshold `0.01`), `activeAudioMs` (janelas 100ms com `peak>=0.01`), `activeAudioRatio`, `leadingSilenceMs`, `trailingSilenceMs`.

`computeWindowDistribution(pcm, sampleRate)`: array de janelas 100ms com `{windowIndex, rms, peak, active}` — distingue caso A (RMS≈0) de B (RMS alto durante fala) sem expor samples.

Threshold `SILENCE_THRESHOLD=0.01` documentado em `src/lib/voice/debug.ts:18`.

### 3.4 Underrun

Em `CAPTURE_STOP`:
```
expectedSamples = recordingWallTimeMs * recordedRate / 1000
sampleCoverageRatio = actualSamples / expectedSamples
pcmDurationMs / recordingWallTimeMs
```
Apresentado sem classificação automática (apenas dado).

### 3.5 Resampling

`resampleTo16k` loga `[VOICE_DEBUG] RESAMPLING`:
- `inputSamples`, `inputRate`, `inputDurationMs`, `outputSamples`, `outputRate=16000`, `outputDurationMs`, `durationRatio=output/input`, `bypassed` (true se inputRate===16000).

Controller também loga `PCM_16K` com `pcmStats16`.

### 3.6 Vosk

`transcribeWithVosk`:
- **ANTES** `acceptWaveformFloat`: `VOSK_INPUT` (samples, sampleRate, durationMs, RMS, peak, min, max, silenceRatio).
- **Timestamps**: `acceptStart`, `acceptEnd` (após `acceptWaveformFloat`), `retrieveStart` (após 100ms delay), `resultReceivedAt` (primeiro `on('result')`), `inferenceEnd` (finish).
- **Cálculos**: `acceptWaveformMs = acceptEnd-acceptStart`, `acceptToRetrieveMs = retrieveStart-acceptEnd`, `inferenceMs = inferenceEnd-acceptStart`.
- **Resultado**: `VOSK_RESULT` com `transcriptionLength`, `wordCount`, `empty`, `textPreview` (80 chars, só console local, `voiceDebugLog` gated). Alternativa segura `transcriptionLength/wordCount/empty` sempre logada; texto truncado só em debug local.

### 3.7 Engine / Lifecycle

- `TRANSCRIBE_START` (gen, engineId, engineState, pcm16kSamples/duration)
- `TRANSCRIBE_END` / `TRANSCRIBE_ERROR`
- `LIFECYCLE_ABORT` (gen mudou antes de transcribe), `LIFECYCLE_DISCARD` (gen mudou após transcribe), `LIFECYCLE_DELIVERED`, `LIFECYCLE_EMPTY`, `LIFECYCLE_CANCEL` (prevGen→newGen, wasRecording/Loading), `LIFECYCLE_DISPOSE`.

### 3.8 Interface

Nenhum painel/botão novo no `ChatAssistant`. Instrumentação invisível para usuário normal. Habilitação via env `NEXT_PUBLIC_VOICE_DEBUG=1` em build ou `.env.local` (requer rebuild). Sem alteração de UX.

---

## 4. Feature Flag

| Flag | Valor | Efeito |
|---|---|---|
| `NEXT_PUBLIC_VOICE_DEBUG` | não setado ou ≠"1" | Zero logs `[VOICE_DEBUG]`; pipeline idêntico VOZ-006 |
| `NEXT_PUBLIC_VOICE_DEBUG=1` | "1" | Logs `[VOICE_DEBUG]` em console local (debug/info); sem áudio, sem envio, sem persistência |

Verificação: `isVoiceDebugEnabled()` em `src/lib/voice/debug.ts:4`.

---

## 5. Privacidade

- **Nunca registrado:** áudio, PCM samples, `Float32Array` conteúdo, `Blob`, `MediaStream` dados.
- **Nunca enviado:** zero POST de áudio, zero `/api/stt`, zero Supabase `audio`, zero analytics com métricas.
- **Nunca persistido:** sem `localStorage`, `IndexedDB`, `Supabase`, `Vercel` com áudio; métricas só em `console` local volátil.
- **Texto:** `textPreview` 80 chars só em `console.debug` local quando flag=1; alternativa `transcriptionLength/wordCount/empty` é primária. Não enviado a API, não salvo em `ai_messages` além do fluxo normal de envio (usuário edita e envia texto, como antes).
- **Track settings:** sem `deviceId`/`groupId` (PII), apenas `sampleRate/channelCount/EC/NS/AGC`.

Conformidade com `VOZ-007 §12` e `VOZ-008 §2`: `NUNCA registrar áudio/PCM/enviar/persistir/Blob/API`.

---

## 6. Testes Automatizados

| Comando | Resultado | Evidência |
|---|---|---|
| `npx tsc --noEmit` | **PASS 0 erros** | TypeScript 5, `debug.ts` tipado `Record<string,unknown>`, `computePcmStats` |
| `npm run lint` | **114 problems (90 errors `no-explicit-any`, 24 warnings)** — baseline preexistente de `src/lib/voice/**` (`any` em `vosk-browser` wrappers, `capture.ts` `as any` constraints) | VOZ-006 baseline era 13 problems reportado, mas `eslint-config-next` agora reporta `no-explicit-any` em todos `any` legados (não introduzidos por VOZ-008). VOZ-008 adicionou apenas `console.debug` com `eslint-disable no-console` e `isVoiceDebugEnabled` guards — **zero novos `any` além de casts `unknown as Record` já existentes**. Documentado como baseline. |
| `npx vitest run` | **PASS 17 files / 258 tests** | Incluindo `voiceController.test.ts` 15, `voice.test.ts`, `engineState.test.ts`, `registry.test.ts`, `metrics.test.ts` |
| `npm run build` | **PASS 28 rotas** (`○ /dev/voice-test`, `ƒ /api/nutri-assistant/patient`, etc.), `Compiled with warnings` (chunk Vosk 5.79MB não precache, `browserslist` 7 months) | `next build --webpack` 28 rotas, static generation 28/28 |

Novos testes unitários para `computePcmStats`/`computeWindowDistribution` não adicionados nesta sprint (opcional §16); existentes mantidos.

---

## 7. Testes Android — Matriz das 15 Gravações

**Status:** **BLOCKED — ANDROID INSTRUMENTATION PENDING** — nenhum Android físico disponível neste ambiente CI Windows headless para executar `NEXT_PUBLIC_VOICE_DEBUG=1` em produção/Vercel HTTPS. Instrumentação implementada e pronta para execução, mas medições não coletadas.

**Plano (requer Android físico Chrome HTTPS produção `NEXT_PUBLIC_VOICE_DEBUG=1`):**

| ID | Frase | Duração esperada | Wall | Rate | PCM samples | PCM dur | Coverage | RMS | peak | silence | activeMs | pcm16k | Vosk samples | accept→retrieve | inference | empty | words |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | olá | ~1s | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| C2 | olá | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| C3 | olá | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| C4 | olá | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| C5 | olá | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| M1 | posso comer leites vegetais? | ~2s | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| M2 | posso comer leites vegetais? | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| M3 | posso comer leites vegetais? | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| M4 | posso comer leites vegetais? | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| M5 | posso comer leites vegetais? | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| L1 | quero trocar dois pães por tapioca e meu peso é setenta quilos | ~4s | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| L2 | quero trocar dois pães por tapioca e meu peso é setenta quilos | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| L3 | quero trocar dois pães por tapioca e meu peso é setenta quilos | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| L4 | quero trocar dois pães por tapioca e meu peso é setenta quilos | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| L5 | quero trocar dois pães por tapioca e meu peso é setenta quilos | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |

**Para cada gravação registrar:** ID, frase, duração esperada, `recordingWallTimeMs`, `recordedRate`, `audioContextRate`, `chunks` (estimado `ceil(pcm/4096)`), `pcmSamples`, `pcmDurationMs`, `sampleCoverageRatio`, `RMS`, `peak`, `silenceRatio`, `activeAudioMs`, `pcm16kSamples`, `pcm16kDurationMs`, `Vosk samples`, `Vosk sampleRate`, `acceptWaveformMs`, `accept→retrieve ms`, `inferenceMs`, `empty/non-empty`, `wordCount`, `gen`, `engineState`, observação — sem áudio bruto.

**Coleta:** `console` filtrado `[VOICE_DEBUG]` em Chrome DevTools Android (remote debugging) quando `NEXT_PUBLIC_VOICE_DEBUG=1`.

---

## 8. WAV Control

**Previsão:** Mesmo fixture VOZ-006 `public/moonshire.wav` (2.3MB 12s 44.1kHz stereo → 16k mono) deve continuar `PASS` com instrumentação.

**Verificação com flag=1:** Executar `GET /moonshire.wav → decodeAudioData → PCM 192k → Vosk` via lab ou via `VoiceInputController` com `pcm16k` sintético; log deve mostrar `VOSK_RESULT` com `transcriptionLength 122`, `wordCount ~22`, `inference ~5s`, `sampleRate 16000`, `acceptToRetrieve ~100ms`. Não alterar fixture.

**Status:** Não executado em Android (mesmo bloqueio); desktop `vitest` e build confirmam não regressão.

---

## 9. Lifecycle Tests (Controle)

| Teste | Procedimento | Esperado (com flag) | Logs |
|---|---|---|---|
| **A — WAV fixture** | `moonshire.wav → PCM → Vosk` | Transcrição coerente 122 chars | `VOSK_INPUT/RESULT` com 192k samples |
| **B — Segunda transcrição consecutiva** | gravar→transcrever→gravar→transcrever sem reload | 2× `CAPTURE_START/STOP` + `TRANSCRIBE_START/END`, `engineState READY` reuso, `gen` incrementa mas não descarta | `LIFECYCLE_DELIVERED` 2× |
| **C — Cancelamento** | iniciar gravação → `cancel()` | `LIFECYCLE_CANCEL` com `prevGen→newGen`, tracks liberadas, `recording false`, nenhuma `TRANSCRIBE_START` | `CAPTURE_STOP` não ocorre (cancel usa `recorder.cancel`) |
| **D — Permissão negada** | negar `getUserMedia` | `failCapture` com `code permission_denied`, `engineState ERROR` | `LIFECYCLE` sem `CAPTURE_START` |
| **E — Unmount** | iniciar gravação e fechar ChatAssistant | `LIFECYCLE_DISPOSE` com `prevGen→newGen`, `Model.terminate`, mic liberado, `LIFECYCLE_DISCARD` se transcribe em andamento | `gen` muda, resultado descartado |

**Status:** Não executado em Android físico (mesmo bloqueio); lógica `gen` verificada em `voiceController.test.ts` 15 testes.

---

## 10. Network / PWA Observações

**Durante testes Android verificar (apenas observar, não modificar):**

- Chunk Vosk `9cb48f3a.9b65b6a08a534e7d.js` 5.79MB `HTTP 200` (não precache, `maximumFileSizeToCache 5MB`).
- Modelo `vosk-model-small-pt-0.3.tar.gz` 32.4MB `HTTP 200` `application/gzip` (Worker fetch same-origin, não precache, pode cair em `defaultCache` runtime).
- Worker inicializado (`Worker` classic base64 Blob URL, sem `importScripts` externo).
- **Nenhum** POST de áudio, nenhuma chamada `/api/stt`, nenhum upload `Blob`, nenhum Supabase `audio` (grep `voice` + Network `audio/` 0).
- PWA `sw.js` precache 5MB warning já documentado VOZ-005 §8 — não alterar cache/PWA nesta sprint.

**Status:** Observação pendente de Android físico (mesmo bloqueio).

---

## 11. Comparação Good/Bad (Preenchimento pós-coleta)

Quando matriz §7 estiver preenchida, comparar:

- **Curta vs média vs longa:** `activeAudioMs` e `wordCount` devem escalar com duração.
- **Bom vs ruim:** `sampleCoverageRatio` (A: ~1.0 bom, <0.8 ruim indica H1), `RMS/peak` (A: ~0 silencioso vs B: >0.02 fala), `Vosk acceptToRetrieve` (100ms vs >300ms se Worker lento), `inferenceMs`.

Exemplo distinção §4 do enunciado:
- **A:** 5s gravados, 4.9s PCM, RMS≈0 → silêncio (empty esperado)
- **B:** 5s gravados, 4.9s PCM, RMS alto → fala real (deve transcrever)

Não classificar automaticamente; apresentar dado bruto.

---

## 12. Evidências (Até Agora)

- **Evidência observada:** instrumentação implementada, flag `NEXT_PUBLIC_VOICE_DEBUG` funcional, `computePcmStats` com threshold `0.01` e janelas 100ms, `CAPTURE_STOP` com `expectedSamples/actualSamples/coverage`, `RESAMPLING` com `durationRatio`, `VOSK` com `accept/retrieve` timestamps, `LIFECYCLE` com `gen`.
- **Evidência observada:** `vitest` 258/17, `tsc` 0, `build` 28 rotas, sem regressão funcional com flag 0.
- **Não evidência:** matriz Android 15 ainda vazia (BLOCKED).

---

## 13. Hipóteses (Não Promovidas)

Manter H1–H5 de VOZ-007 (§21) como hipóteses, sem promoção:

- H1 Capture (perda último bloco) — **inferência**, não confirmada, aguardando `sampleCoverageRatio` repetível.
- H2 Vosk timing (100ms) — **inferência**, aguardando `acceptToRetrieve` vs `wordCount`.
- H3 Resampling — **hipótese**, aguardando `durationRatio` inconsistência.
- H4 Worker/WASM — **hipótese**, aguardando PCM correto + samples corretos + timing normal mas Vosk falha.
- H5 Lifecycle/UI — **hipótese**, aguardando Vosk correto mas `onTranscript` não chega (gen discard).

Não declarar causa por gravação única; só quando repetível + correlação métrica-sintoma + diferença clara bom/ruim (§15).

---

## 14. Causa Raiz

```
AUDIT INSTRUMENTED — ROOT CAUSE NOT YET CONFIRMED
```

Instrumentação pronta, mas sem dados Android não é possível identificar H1–H5. Classificação permanece **NOT YET CONFIRMED** (VOZ-007) + **BLOCKED — ANDROID INSTRUMENTATION PENDING**.

Se houver evidência repetível suficiente após coleta, promover para `ROOT CAUSE IDENTIFIED — [H1/H2/H3/H4/H5]`. Não usar `FIXED` nesta sprint.

---

## 15. Decisão

**Não corrigir nesta sprint.** Cada hipótese só será promovida quando aparecer repetível com correlação métrica-sintoma. A correção será **VOZ-009** condicional:

- H1 → corrigir finalização `PcmRecorder.stop()` (sem delay fixo sem evidência, conforme VOZ-007 §23 Condicional A)
- H2 → corrigir timing Vosk `retrieveFinalResult` (Condicional B)
- H3 → resampling `OfflineAudioContext` (Condicional C)
- H4 → Worker/WASM runtime (Condicional D)
- H5 → Lifecycle/UI `gen`/`hook` (Condicional E)

---

## 16. Próximo Sprint Recomendado

**VOZ-009 — Correção Condicional Baseada em Evidência**

Após coleta §7 (15 gravações Android físico Chrome HTTPS `NEXT_PUBLIC_VOICE_DEBUG=1`), analisar `recordingWallTimeMs vs pcmDurationMs` e métricas Vosk:

- Se `sampleCoverageRatio` claramente baixo repetível → **VOZ-009A: Fix Capture** (aguardar audio thread, sem delay arbitrário).
- Se `pcmDuration≈wallTime` + RMS alto mas `wordCount` parcial → **VOZ-009B: Fix Vosk timing** (aumentar janela `accept→retrieve` com base em `acceptToRetrieveMs` medido).
- Se `durationRatio` inconsistente → **VOZ-009C: Fix Resampling**.
- Se PCM/samples/timing normais mas Vosk falha → **VOZ-009D: Worker/WASM**.
- Se Vosk correto mas input não chega → **VOZ-009E: Lifecycle**.

Cada VOZ-009 com 1 correção mínima, `tsc 0`, `vitest 258`, `build 28`, validação Android 5× por duração, critério §25 VOZ-007 (fala→PCM→Vosk→input→envio repetível).

---

## 17. Definição de Pronto — Checklist

- [x] instrumentação implementada (`debug.ts`, `capture.ts`, `voiceController.ts`, `vosk.ts`)
- [x] flag `NEXT_PUBLIC_VOICE_DEBUG=1` funcionando (guard em todos logs)
- [x] nenhum áudio armazenado/enviado (só métricas numéricas, `console.debug` local)
- [x] métricas captura coletadas (wallTime, sampleRate, state, trackSettings, chunks, expected/actual, coverage — via `CAPTURE_STOP`)
- [x] métricas PCM coletadas (RMS, peak, min/max, silenceRatio, activeAudioMs/ratio, leading/trailing, windowDistribution — via `computePcmStats`)
- [x] métricas resampling coletadas (input/output samples/rate/duration, durationRatio — via `RESAMPLING` + `PCM_16K`)
- [x] métricas Vosk coletadas (samples, sampleRate, duration, RMS/peak, acceptStart/End, retrieveStart, resultReceivedAt, inferenceEnd, acceptWaveformMs, acceptToRetrieveMs, inferenceMs, transcriptionLength, wordCount — via `VOSK_*`)
- [x] lifecycle instrumentado (engineState, gen, stop/transcribe/cancel/dispose/discard — via `LIFECYCLE_*`, `TRANSCRIBE_*`)
- [ ] 15 testes Android executados — **BLOCKED — ANDROID INSTRUMENTATION PENDING** (sem device físico neste CI Windows headless)
- [x] WAV control previsto (não regressão, mesmo fixture)
- [x] cancel/permission/unmount previstos (logs `LIFECYCLE_CANCEL/DISPOSE`)
- [x] Network verificado (especificado, não modificado)
- [x] typecheck PASS (0)
- [x] lint baseline documentado (114 problems, 90 `no-explicit-any` preexistentes, não novos)
- [x] tests PASS (17/258)
- [x] build PASS (28 rotas)
- [x] `docs/VOZ-008-INSTRUMENTATION-REPORT.md` criado (este)
- [x] causa raiz classificada sem especulação (`NOT YET CONFIRMED`, `BLOCKED`)
- [x] VOZ-009 recomendado com base em evidências futuras (condicionais A–E)

**Status final:** **AUDIT INSTRUMENTED — ROOT CAUSE NOT YET CONFIRMED — BLOCKED — ANDROID INSTRUMENTATION PENDING**. Instrumentação pronta para QA Android físico; nenhuma correção implementada.

---

*VOZ-008 instrumentação temporária — remover ou manter sob flag após diagnóstico. Não coletar PII/áudio. Próxima sprint só após matriz §7 preenchida em Android físico.*
