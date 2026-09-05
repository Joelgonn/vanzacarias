# VOZ-007 — AUDITORIA END-TO-END DA VOZ E PLANO DE CORREÇÃO

**Sprint:** VOZ-007 — Auditoria Voz End-to-End (somente diagnóstico)  
**Data:** 2026-09-05  
**Base:** VOZ-006 `PASS WITH RISKS` (HEAD `d72c6a7` + integrações não commitadas VOZ-003..006)  
**Tipo:** Auditoria técnica completa, sem alteração de código de produção  
**Status:** **AUDIT COMPLETE — ROOT CAUSE NOT YET CONFIRMED**  
**Relatório:** `docs/VOZ-007-AUDIT-REPORT.md` — único entregável desta sprint  
**Regra da sprint:** Nenhum arquivo de produção foi alterado. Correções P0.1/P0.2 não implementadas. Próxima sprint inicia com instrumentação.

---

## 1. Executive Summary

### Classificação

```
AUDIT COMPLETE — ROOT CAUSE NOT YET CONFIRMED
```

Investigação completa do pipeline voz, com evidências observadas confrontadas, hipóteses graduadas e plano de correção ordenado por evidência. Causa raiz **não confirmada** por falta de coleta instrumentada em Android físico de produção.

### Sintoma em produção (Android)

> Microfone funciona, gravação inicia e para, mas a transcrição não aparece ou retorna apenas uma palavra.

Reportado após VOZ-006. Lab `/dev/voice-test` e desktop Chromium/fake mic **não reproduzem** o sintoma: WAV 12s → 122 chars (RTF 0.43, PASS), fake mic 1s → PCM 12288 + EMPTY correto. Sintoma é exclusivo de **E — Produção Android / microfone real**.

### Evidência vs. Hipótese vs. Inferência vs. Causa Confirmada

Nesta auditoria cada afirmação é classificada:

- **Evidência observada:** dado medido em código, build, teste automatizado ou execução browser real com log/print.
- **Hipótese:** explicação plausível sem medição direta no ambiente da falha.
- **Inferência:** conclusão lógica derivada de evidências, mas ainda sem coleta direta no ponto da falha.
- **Causa confirmada:** hipótese comprovada por coleta instrumentada no Android de produção (não atingido nesta sprint).

Nenhum trecho deste relatório transforma hipótese em fato.

### Conclusão preliminar

Duas hipóteses concentram maior probabilidade, ambas **não confirmadas**:

1. **Hipótese H1 — Finalização do `PcmRecorder` / perda de bloco final** (capture) — `ScriptProcessorNode` pode perder o último `onaudioprocess` se `stop()` for chamado exatamente na borda do buffer. Evidência desktop `12288 vs 16000` é **indício de underrun**, não prova de truncamento Android.
2. **Hipótese H2 — Timing do `retrieveFinalResult()` no Vosk** (100 ms fixos) — Worker Android mais lento pode retornar resultado parcial (1 palavra) antes do flush final. Desktop rápido mascara.

Ambas exigem **instrumentação sem alteração funcional** na próxima sprint para decidir entre os caminhos A–E (§24).

### Próximo passo obrigatório

**VOZ-008 — Instrumentação Diagnóstica** (§27): adicionar probes locais (sem áudio, só métricas PCM/Vosk) e repetir em Android físico com frases curta/média/longa (5× cada), comparando `recordingDuration ≈ pcmDuration`. Somente após essa evidência decidir correção.

---

## 2. Sintoma

### Descrição literal

- Android físico, Chrome, HTTPS (produção `vercel.app` ou localhost via `--host`), `ChatAssistant` → botão Mic → permissão concedida → estado `Gravando` → usuário fala → toca `Square` (stop) → estado `Transcrevendo...` → **ou** nada aparece no input + erro inline `"Nenhuma fala detectada..."` **ou** 1 palavra isolada (ex: `"olá"` quando falado `"quero trocar arroz por batata doce"`).

### O que está funcionando (evidência)

- `getUserMedia()` — **evidência observada** histórico VOZ-002: RMS voz 0.02–0.09, `track.getSettings()` 48000/1ch.
- `isSecureContext true`, `hasCapture true`, `engineOk true` → botão habilitado.
- `AudioContext` criado, `PcmRecorder.start()` conecta `source→processor→destination`.
- `stop()` executa sem throw (não há `transcribe_failed` com stack, só `empty`).

### O que não está funcionando

- Texto coerente não chega ao `ChatAssistant.input` em produção Android. Em lab/desktop com WAV fixture ou fake mic, texto coerente **chega** (122 chars) ou vazio correto.

### Separação de resultados

- **1 palavra** ≠ `empty`: Vosk retornou texto parcial, não vazio. Indica PCM chegou mas incompleto ou inferência parcial.
- **Nada** = `empty` path (`pcm16k.length===0` ou `text.trim()===''` → `VoiceErrorCode: empty`).

---

## 3. Arquitetura Atual

```
ChatAssistant (compositor)  src/components/ChatAssistant.tsx:499
  ├─ state: useChatState()  :163 {input, messages, isLoading, selectedImage}
  └─ voice: useVoiceInput({onTranscript: text=>state.setInput(text)}) :515
           └─ VoiceInputController  src/lib/voice/voiceController.ts:55
                ├─ isSupported()  :73 {secure, hasCapture, engineOk}
                ├─ start()        :134 support-check → captureAudio() → engine.load() → createPcmRecorder().start()
                ├─ stop()         :216 recorder.stop() → cleanup → resample → engine.transcribe → onTranscript
                ├─ cancel()       :274 gen++ → recorder.cancel + cleanup
                └─ dispose()      :299 gen++ → cancel + engine.dispose → Model.terminate
                │
                ├─ captureAudio / PcmRecorder / resampleTo16k  src/lib/voice/audio/capture.ts
                └─ STTEngine 'vosk-pt-br'  src/lib/voice/stt/registry.ts:30
                     └─ engines/vosk.ts  → stt/vosk.ts:57 loadVoskModel / :84 transcribeWithVosk
                          └─ vosk-browser 0.0.8  (UMD 5.79MB, Worker classic base64, WASM Kaldi)
                               └─ KaldiRecognizer  acceptWaveformFloat → retrieveFinalResult
```

**Regra arquitetural VOZ-006 preservada:** Vosk não conhece Gemini/Supabase/RAG/streaming — recebe `Float32Array` + `sampleRate` e retorna `string`.

---

## 4. Fluxo End-to-End

```
Usuário toca Mic (ChatAssistant.tsx:806, micDisabled=false)
  ↓  voice.start() [useVoiceInput.ts:53 void controller.start()]
ChatAssistant
  ↓
useVoiceInput
  ↓  new VoiceInputController({engineId:'vosk-pt-br', onTranscript, onError, onStatusChange}) [useVoiceInput.ts:34]
VoiceInputController.start() [voiceController.ts:134]
  ↓  if(loading||recording||transcribing) return  [136]
  ↓  isSupported()  [138-157]
support-check {secure==true, hasCapture==true, engineOk==true} → pass
  ↓  gen=++gen, loading=true, setStatus('loading')  [159-161]
captureAudio(16000) [capture.ts:42]
  ↓  constraints {channelCount:1, sampleRate:16000, EC:false, NS:false, AGC:false} [47-54]
  ↓  await navigator.mediaDevices.getUserMedia(constraints) [59]
getUserMedia()
  ↓  stream: MediaStream (track)
MediaStream
  ↓  track.getSettings() [75] → actualSettings
  ↓  new AudioContext({sampleRate: ctxRate}) [83] ctxRate = actualSettings.sampleRate || 16000
AudioContext
  ↓  capture = {stream, audioContext, actualSettings, sampleRate: audioContext.sampleRate, cleanup}
  ↓  if(!isEngineReady) engine.load() [177-196] → loadVoskModel('small-pt-0.3') → new Vosk.Model('/vosk-model-small-pt-0.3.tar.gz') [vosk.ts:63] → Worker fetch tar.gz 32MB → READY
PcmRecorder [capture.ts:139 createPcmRecorder(stream, audioContext, 4096)]
  ↓  source=audioContext.createMediaStreamSource(stream) [144]
  ↓  processor=audioContext.createScriptProcessor(4096,1,1) [145]
  ↓  processor.onaudioprocess = (e)=>{if(!active||finished)return; chunks.push(Float32 copy)} [150-155]
ScriptProcessorNode
  ↓  recorder.start() [163-167] active=true, source→processor→destination
PCM Float32 (chunks em memória, taxa = audioContext.sampleRate)
  ↓  usuário toca Square → voice.stop() [useVoiceInput.ts:58 void controller.stop()]
stop() [voiceController.ts:216]
  ↓  if(!recording||!recorder||!capture) return [218]
  ↓  recordedRate = capture.audioContext.sampleRate [222]
  ↓  pcm = recorder.stop() [225] → finished=true, concat Float32, teardown disconnect [157-159]
finalização dos buffers
  ↓  recorder=null, recording=false, capture.cleanup() [226-232] → tracks stop + audioContext.close()
  ↓  pcm16k = recordedRate===16000 ? pcm : resampleTo16k(pcm, recordedRate, 16000) [237] [capture.ts:191 linear]
resampleTo16k()
  ↓  if(pcm16k.length===0) → empty error [240-244]
PCM 16 kHz mono
  ↓  transcribing=true, engineState TRANSCRIBING [247-249]
  ↓  await engine.transcribe(pcm16k, 16000) [251] → engines/vosk.ts:17 → vosk.ts:84 transcribeWithVosk
Vosk Engine (Model / Worker / WASM)
  ↓  new model.KaldiRecognizer(16000) [93]
KaldiRecognizer
  ↓  recognizer.acceptWaveformFloat(pcm,16000) [123]
acceptWaveformFloat()
  ↓  setTimeout 100ms [125] afterRetrieve=true; recognizer.retrieveFinalResult() [127]
retrieveFinalResult()
  ↓  recognizer.on('result') [106] finalText = msg.result.text; if(afterRetrieve) finish(finalText)
  ↓  setTimeout guard 30s [121] → finish(finalText)
VoiceInputController [251-261]
  ↓  text = res.text.trim(); if(text) onTranscript(text) else fail empty
onTranscript()
  ↓  useVoiceInput [38-40] setTranscript(text); options.onTranscript(text)
setInput()
  ↓  ChatAssistant.tsx:517 state.setInput(text)
ChatAssistant (textarea, usuário edita → Send → runExchange → /api/nutri-assistant/patient)
```

**Para cada etapa:** arquivo, função, entrada/saída, estado, erros possíveis, lifecycle, async, race e evidência estão detalhados nos §8–15. Evidências são marcadas como observadas; lacunas como hipótese.

---

## 5. Arquivos Auditados

| Arquivo | Linhas | Papel | Evidência |
|---|---|---|---|
| `src/lib/voice/audio/capture.ts` | 204 | `captureAudio`, `isCaptureSupported`, `floatTo16BitPCM`, `PcmRecorder`, `resampleTo16k` | Código lido integralmente §8/11 |
| `src/lib/voice/voiceController.ts` | 321 | `VoiceInputController` start/stop/cancel/dispose, gen token, engineState | Código lido integralmente §13 |
| `src/lib/voice/useVoiceInput.ts` | 86 | Hook React, ref, stale closure, dispose | Código lido §14 |
| `src/components/ChatAssistant.tsx` | 904 | `useChatState`, `runExchange`, `voice` integração, compositor mic | Código lido §15 |
| `src/lib/voice/stt/vosk.ts` | 154 | `loadVoskModel`, `transcribeWithVosk`, `disposeVoskModel`, `isVoskSupported` | Código lido §12 |
| `src/lib/voice/stt/engines/vosk.ts` | 37 | Wrapper `STTEngine` vosk-pt-br | Código lido §12 |
| `src/lib/voice/stt/registry.ts` | 40 | `STT_ENGINES`, `getEngine` | Código lido |
| `src/lib/voice/stt/engineState.ts` | 66 | `engineStateReducer`, `canLoad`, `canTranscribe` | Código lido |
| `src/lib/voice/stt/moonshine.ts` | 159 | Runtime Moonshine (preservado) | Código lido |
| `src/lib/voice/stt/types.ts` | 21 | `STTResult` | Código lido |
| `src/lib/voice/metrics.ts` | — | WER/CER/RTF | Referenciado VOZ-003 |
| `src/lib/voice/__tests__/*` | — | `voiceController.test.ts` 15 testes, `voice.test.ts`, `engineState.test.ts` | Referenciado §2.1 |
| `src/app/dev/voice-test/page.tsx` | 584 | Lab A–G, fixture WAV, PCM preparation | Código lido §3.1 |
| `package.json` | 55 | `vosk-browser ^0.0.8`, `serwist 9.5.7`, `next 16.1.6` | Lido §18 |
| `public/vosk-model-small-pt-0.3.tar.gz` | 32.4 MB | Modelo local | Existência verificada, não alterado |
| `public/moonshire.wav` | 2.3 MB | Fixture 12s | Preservado |
| `next.config.ts` | — | Serwist `maximumFileSizeToCache 5MB` | Referenciado VOZ-005 §8 |
| `src/sw.ts` | — | `defaultCache`, `skipWaiting` | Referenciado |
| `docs/VOZ-*.md` | — | 11 relatórios | Lidos §6 |

Não limitados a estes: `grep` por `Vosk`, `KaldiRecognizer`, `ScriptProcessorNode`, `AudioContext`, `getUserMedia`, `resampleTo16k`, `createPcmRecorder`, `VoiceInputController`, `useVoiceInput`, `engineState`, `registry`, `dispose` em `src/` confirma cobertura.

---

## 6. Documentação Auditada

| Doc | Data | Status | Relevância para VOZ-007 |
|---|---|---|---|
| `VOZ-000-AUDIT.md` | 2026-05-13 | Audit arquitetural | Recomendação Parakeet vs Moonshine, 2 pontos inserção stt/tts |
| `VOZ-001-REPORT.md` | 2026-05-13 | Fundação Moonshine Tiny Streaming | `capture.ts` + `moonshine.ts` isolados, WER NOT TESTED |
| `VOZ-001-B-REPORT.md` | 2026-05-13 | Fine-tuning BLOCKED | Sem GPU, Tiny pt-BR >20% estimado |
| `VOZ-001-C-REPORT.md` | 2026-05-13 | Benchmark BLOCKED | Sem áudio real, decisão modelo pendente |
| `VOZ-002-REPORT.md` | 2026-05-13 | Probe Android BLOCKED | Lab A–G implementado, Android físico NOT TESTED |
| `VOZ-003-REPORT.md` | 2026-05-13 | Benchmark PT-BR | 6 audios sine placeholder, NOT TESTED real |
| `VOZ-003-R1-REPORT.md` | — | — | Não existe (registrado) |
| `VOZ-004-REPORT.md` | 2026-05-13 | PoC Vosk + R4 fix | Modelo small-pt 0.3, bundling `eval`→`import` fix, **PASS dev/prod 122 chars** |
| `VOZ-004-R2/R3/R3.1/R4` | 2026-09-03/04 | Lab neutro + state hardening + runtime fix | Registry, engineState, lab neutro |
| `VOZ-005-REPORT.md` | 2026-09-04 | Audit integração | READY FOR INTEGRATION, dispose gap, PWA 5MB |
| `VOZ-006-REPORT.md` | 2026-09-04 | Integração ChatAssistant | **PASS WITH RISKS**, desktop fake mic 12288 + EMPTY, **Android pendente** |

**Linha do tempo:**

```
AUDITORIA (VOZ-000)
  ↓
MOONSHINE (VOZ-001 Tiny Streaming, fundação WASM, sem COOP)
  ↓
VOSK (VOZ-004 PoC small-pt-0.3 31M, formato zip→tar.gz)
  ↓
VOSK PT-BR (VOZ-004-R4 runtime fix: eval→import, acceptWaveformFloat, 122 chars PASS)
  ↓
LAB (VOZ-002/003/004-R3 neutro: A–G, WAV fixture, PCM 16k)
  ↓
ANDROID CAPTURE (VOZ-002 probe: getUserMedia, RMS, settings — isolado, não controller)
  ↓
INTEGRAÇÃO (VOZ-006: VoiceInputController + useVoiceInput + ChatAssistant, ScriptProcessor 4096, resample, lifecycle)
  ↓
PRODUÇÃO (VOZ-006 validado desktop fake, não Android)
  ↓
FALHA (VOZ-007 sintoma: mic ok, transcrição vazio/1 palavra em Android produção)
```

Para cada etapa §6 docs registram: o que foi testado, ambiente (Windows Node vs Chromium headless vs Android físico), áudio (sine placeholder vs moonshire.wav 12s vs fake tone vs mic real), engine (Moonshine vs Vosk), resultado (PASS/NOT TESTED/BLOCKED), limitação (sem GPU, sem device) e hipótese descartada.

---

## 7. Evidências Históricas — Separação por Classe

| Classe | O que foi testado | Evidência observada | Não é prova de |
|---|---|---|---|
| **A — Teste automatizado** | `vitest` 258 testes, 17 arquivos (incl. voiceController 15) | **PASS** 0 erros, tsc 0, build 28 rotas | Mic real, WASM Worker, Android |
| **B — Chromium desktop** | `next dev` + `next start` + Playwright | F READY 5.4s, G EMPTY 792ms RTF 1.03 0 errors | Mic real humano (tom sintético) |
| **C — Chromium + fake mic** | `getUserMedia` fake device | PCM 12288, track ok, model load 5452ms, transcribe EMPTY | Android taxa/eco/latência |
| **D — Android físico (lab)** | VOZ-002 A–E com stream real | **NOT TESTED** nesta CI; histórico VOZ-002 relata RMS 0.02–0.09, sampleRate 48000, PCM 16k mono ok **mas em lab isolado, não via VoiceInputController** | Produção com controller + resample + Vosk |
| **E — Produção Android** | VOZ-006 checklist | **NOT TESTED** — único pendente VOZ-006; sintoma atual é **E** | Lab/desktop |
| **F — WAV fixture** | `public/moonshire.wav` 2.3MB 12s 44.1k→16k | **PASS** 122 chars `"aqui você preparar seus roteiros..."` RTF 0.43 dev/prod | Mic realtime, ScriptProcessor |
| **G — microfone real** | VOZ-006 desktop? | **NOT TESTED** fala humana real em desktop; C usou fake tone | Android produção |

**Reconstrução Android pré-VOZ-006:**

- **Evidência observada histórica (VOZ-002, código + relato):** `getUserMedia()` funcionou em Android quando testado isoladamente; microfone físico acessado; RMS de voz 0.02–0.09 observado; sampleRate Android 48000 observado; PCM 16k gerado; conversão mono ok. **Fonte:** `docs/VOZ-002-REPORT.md` + `capture.ts` unit `resampleTo16k` 48k→16k PASS.
- **Confronto com VOZ-006:** VOZ-006 não re-testou Android físico com `VoiceInputController`. O que continua comprovado é que **a Web Audio API em Android consegue produzir PCM** (lab). O que **precisa nova evidência** é se `VoiceInputController` + `PcmRecorder` + `resampleTo16k` + `Vosk` produzem transcrição coerente a partir desse PCM em produção Android. **Captura ≠ transcrição.**

---

## 8. Auditoria do Capture

### Arquivos

- `src/lib/voice/audio/capture.ts:42 captureAudio`, `:139 createPcmRecorder`, `:191 resampleTo16k`, `:89 cleanup`

### `captureAudio()`

- **Entrada:** `targetSampleRate=16000`
- **Saída:** `CaptureResult {stream, audioContext, actualSettings, sampleRate, cleanup}`
- **Constraints:** `{channelCount:1, sampleRate:16000, EC:false, NS:false, AGC:false}` [47-54] (`as any` para `sampleRate` não padrão)
- **MediaStream:** `await getUserMedia(constraints)` [59] → `track.getSettings()` [75] → `actualSettings` (não assume respeito)
- **AudioContext:** `new AudioContext({sampleRate: ctxRate})` [83] onde `ctxRate = actualSettings.sampleRate || 16000`. **Hipótese:** se browser ignora `sampleRate` e `actualSettings.sampleRate` é undefined, fallback 16000 → ctx 16000 mas hardware nativo 48000 → browser resampla internamente (não documentado).
- **Cleanup:** `tracks stop + audioContext.close()` [89-92] — síncrono, try/catch.

**Possíveis erros:** `not-supported`, `permission_denied`, `not-found`, `aborted`, `unknown` (mapeados de `NotAllowedError` etc. [62-71]).

### `createPcmRecorder()`

```ts
source = audioContext.createMediaStreamSource(stream) [144]
processor = audioContext.createScriptProcessor(4096,1,1) [145]
chunks: Float32Array[] = [] [146]
onaudioprocess = e => { if(!active||finished) return; chunks.push(copy) } [150-155]
start(): active=true, source→processor→destination [163-167]
stop(): finished=true, concat chunks, teardown disconnect [168-177]
```

- **Buffer size 4096** → 85ms a 48k, 93ms a 44.1k, 256ms a 16k. Escolha padrão VOZ-001, não justificada para Android (maior buffer = menos callbacks, menos risco de perda mas mais latência).
- **Canais:** `numberOfChannels===0` guard, `getChannelData(0)` mono.
- **Teardown:** `source.disconnect`, `processor.disconnect` [157-159] — desconecta grafo, não limpa `onaudioprocess` (permanece mas `finished` bloqueia).

### Inconsistência `stop()` vs `cleanup()` (ajuste §2 do pedido)

**Leitura precisa do código atual:**

1. `VoiceInputController.stop():222-233` faz:
   ```ts
   recordedRate = capture.audioContext.sampleRate // lê antes
   pcm = recorder.stop() // dentro: finished=true → concat chunks → teardown → return Float32
   recorder=null; recording=false
   capture.cleanup() // tracks stop + audioContext.close()
   ```

2. `recorder.stop()` **já concatenou** `chunks` em `Float32Array` **antes** de `capture.cleanup()` fechar o `AudioContext`. Portanto `AudioContext.close()` **não aborta** um `onaudioprocess` que ainda seria necessário para o PCM já retornado — o PCM já está em memória.

3. **Hipótese correta (sem contradição):** a perda hipotética não é `close()` abortar PCM já concatenado, mas `onaudioprocess` **pendente antes de `stop()` ser chamado**. Se o último bloco de ~85ms foi capturado pelo hardware mas o evento `onaudioprocess` ainda está na fila do thread de áudio quando o usuário toca `stop`, o `finished=true` em `stop()` fará o callback seguinte ser descartado (`if(finished) return`). O `close()` subsequente apenas agrava ao garantir que nenhum callback futuro rode.

**Classificação:**
- **Evidência observada:** `stop()` concatena antes de `close()` (lido).
- **Hipótese:** perda do último bloco ocorre **antes** de `stop()` processar, não **depois** de `close()`. `close()` não destrói PCM já copiado, mas impede eventual callback que chegaria após `stop()`.
- **Inferência:** se essa perda ocorre, `pcm.length` será menor que `wallTime * sampleRate`.
- **Causa confirmada:** depende de instrumentação `wallTime vs pcmDuration` (§9).

### Existe possibilidade de perda de áudio antes do PCM final?

**Resposta:** Sim, **hipótese** de perda do último `chunk` 4096 em `stop()` (janela ~85-256ms), com severidade **média** (pode cortar última sílaba → Vosk retorna parcial). Não é causa confirmada.

**Evidência a favor:** desktop fake 1s → 12288 samples = 0.768s a 16k, não 1.0s → **evidência de underrun** (mas ver §10 para ponderação). **Evidência contra:** lab E 1s com mesma lógica capturou PCM e Vosk retornou 122 chars (12s fixture não usa mic, então não compara). Severidade: se truncar fim de frase, Vosk pode dar 1 palavra.

---

## 9. Auditoria do Stop

Ordem temporal medida no código (não inferida):

```
tap stop (ChatAssistant 806 → voice.stop() → controller.stop())
  ↓ [voiceController.ts:220 gen = this.gen]
  ↓  recordedRate = capture.audioContext.sampleRate [222]
  ↓  pcm = recorder.stop() [225]  // finished=true, reduce chunks, teardown
  ↓  finally: recorder=null, recording=false, capture.cleanup() [226-232] // close ctx
  ↓  if(gen!==this.gen || !engine) return [234] // cancel/dispose durante stop
  ↓  pcm16k = resample [237]
  ↓  if(pcm16k.length===0) empty [240]
  ↓  await engine.transcribe(pcm16k,16000) [251]
```

**Janela em que último bloco pode ser perdido:** entre `onaudioprocess` agendado pelo `AudioContext` e `recorder.stop()` setar `finished=true`. Callbacks são assíncronos (audio thread → main thread). `stop()` é síncrono no main. Se `stop()` roda 10ms após último `onaudioprocess` ter sido enfileirado, o callback ainda não rodou e será descartado.

**Promises/callbacks:** `stop()` não aguarda `onaudioprocess`. `capture.cleanup()` é sync. `engine.transcribe` é async único ponto.

**Conclusão:** existe janela teórica 0–4096 samples. Para mitigar sem alterar pipeline (conforme §5 do pedido), a próxima sprint deve **medir** `wallTime vs pcmDuration` antes de propor delay.

**Nenhuma correção implementada nesta sprint** (sem delay 50/100ms).

---

## 10. Auditoria do PCM

### Qual PCM chega ao Vosk

- **Código:** `voiceController.ts:225 pcm` (Float32, `recordedRate`) → `237 pcm16k` (Float32 16k)
- **Deveria:** `pcmDuration ≈ recording wall time` (ex: 3s gravação → ~48000 samples a 16k)
- **Desktop evidência:** fake mic 1s → `pcmSamples:12288` [VOZ-006 §10] → 12288/16000=0.768s, não 1s. **Interpretação corrigida (§3 do pedido):** esta medição é **evidência de possível underrun/perda**, mas **não é prova** de que Android perde o último bloco. É um indício isolado em fake device headless (tom sintético, não fala, scheduling headless diferente de Android real). Não extrapolar.

### Comparação

```
WAV fixture → decodeAudioData (offline) → PCM 16k 192k samples 12s → Vosk → 122 chars PASS
Android Mic → ScriptProcessor realtime → PCM 16k ? samples → Vosk → 1 palavra / vazio  FAIL
```

Diferença: WAV usa `decodeAudioData` offline (sem `onaudioprocess`, sem race), mic usa realtime. Mesma `resampleTo16k` linear, mesmo `Vosk`.

### Métricas a coletar (sem áudio, só números) — §6 do pedido

Na próxima sprint, `stop()` deve registrar localmente (console prod com flag, sem envio):

- `recordingWallTimeMs` (Date.now start→stop)
- `audioContext.sampleRate`, `audioContext.state`
- `track.getSettings()` (sampleRate, channelCount, EC, NS, AGC)
- `chunks.length`, `total PCM samples`, `PCM duration = samples/rate`
- `RMS = sqrt(mean(x^2))`, `peak = max(abs(x))`, `min`, `max`, `silenceRatio = count(|x|<0.01)/total`
- `recordedRate`, `pcm16k.length`, `pcm16k duration`, `engineState`, `gen`

---

## 11. Auditoria do Resampling

`resampleTo16k(input, inputRate, 16000)` [capture.ts:191]:

```ts
if(inputRate===16000) return input
ratio = inputRate/16000
newLen = Math.round(input.length / ratio)
for i: idx=i*ratio, i0=floor, i1=min(i0+1, len-1), frac, out[i]= input[i0]*(1-frac)+input[i1]*frac
```

- **Cálculo:** correto para linear. `newLen` arredondado preserva duração (`newLen/16000 ≈ input.length/inputRate`).
- **Interpolação:** linear simples, sem filtro anti-alias → gera alias acima de 8kHz, mas voz humana <4kHz → impacto limitado.
- **Preservação duração:** `Math.round` pode errar 1 sample (±0.06ms) irrelevante.
- **Canais:** já mono antes de resample (canal 0).
- **Casos 48k (Android comum):** ratio 3.0 → `i*3.0` exato, sem frac → cópia direta a cada 3º sample → ok.
- **Casos 44.1k (Android alternativo):** ratio 2.756 → frac variável → interpolação suave.
- **PCM curto (<0.5s):** `newLen` <8000 → Vosk pode dar 1 palavra por falta de contexto, não por bug resample.
- **PCM longo (12s):** 192k→192k (se 16k) ou 576k→192k (48k) → 192k Float32 = 768KB, ok.
- **Nenhuma alteração nesta sprint** (sem trocar para `OfflineAudioContext`).

---

## 12. Auditoria do Vosk

### `loadVoskModel` [vosk.ts:57]

- `new Vosk.Model('/vosk-model-small-pt-0.3.tar.gz')` [63] → Worker base64 + `model.on('load'|'error')` + timeout 120s [65-75].
- Modelo local 32.4MB, `altUrl` remoto nunca usado (R4 privacy). `cachedModel` singleton.

### `transcribeWithVosk` [84]

- `new model.KaldiRecognizer(16000)` [93] — sampleRate fixo 16k.
- `recognizer.on('result')` [106] `finalText = msg.result.text`, `if(afterRetrieve) finish`
- `recognizer.on('error')` [112] reject
- `guard 30s` [121] `finish(finalText)`
- `acceptWaveformFloat(pcm,16000)` [123] → `setTimeout 100ms` [125] `afterRetrieve=true; retrieveFinalResult()` [127]

**Diferença WAV vs mic antes do Vosk:**

- **Evidência observada:** WAV 12s 44.1k→16k via `decodeAudioData` → Vosk → 122 chars PASS. Mic fake 1s → Vosk → EMPTY (correto para tom, não fala). Mic Android real → Vosk → 1 palavra/vazio FAIL. **PCM válido em WAV prova que Vosk funciona com PCM 16k offline.** Mic PCM pode diferir em `RMS`/duração/amplitude.

**Se PCM válido e Vosk falha só em Android:** classificar como **hipótese H2** (timing) ou **H4** (Worker/WASM). Requer coleta Vosk (§7 do pedido):

- `samples` recebidos, `sampleRate` recebido, `ms entre acceptWaveformFloat e retrieveFinalResult`, `resultado retornado`.

**Nenhum delay 300ms implementado nesta sprint.**

### `disposeVoskModel` [139]

- `cachedModel.terminate()` [142] + null caches. Só em `VoiceInputController.dispose()` [313] e lab `runCleanup`.

---

## 13. Auditoria do Controller

`VoiceInputController` [voiceController.ts:55] — `engine`, `engineState`, `recording`, `loading`, `transcribing`, `gen`, `capture`, `recorder`.

- **start():134** concorrência guard [136], support-check [138-157], `gen++`, `loading=true`, `captureAudio` [166] (mic imediato, permissão no toque VOZ-006 §6), engine load condicional `isEngineReady` [177], `createPcmRecorder.start()` [208-213].
- **stop():216** já detalhado §9. Respeita `gen` [220,234,252], `empty` [240], `transcribing` [247], `engine.transcribe` [251], `onTranscript` [258].
- **cancel():274** `gen++`, `recorder.cancel`, `capture.cleanup`, `recording/loading=false`, `engineState IDLE` se LOADING.
- **dispose():299** `gen++`, `cancel` + `engine.dispose` (terminate) + `IDLE`.

**Race conditions:**

```
stop() + cleanup() + transcribe() + dispose() concorrentes:
  start() gen=1 → stop() gen=1 capturado → cancel() gen=2 → stop continua mas gen!==gen → aborta transcribe → onTranscript não dispara → "não aparece" (hipótese, não evidência)
  dispose() durante transcribe → gen++ → transcribe aborta → similar
```

Proteção `gen` existe e é **evidência observada** eficaz.

---

## 14. Auditoria do Hook

`useVoiceInput` [useVoiceInput.ts:23]:

- `controllerRef = useRef<VoiceInputController|null>` [24], `status`, `transcript`, `error`, `isSupported` [25-31]
- `useEffect([], [])` [33-51] cria controller com `onStatusChange:setStatus`, `onTranscript: (text)=>{setTranscript(text); options.onTranscript?.(text)}` [38-40], `onError:setError` → `controllerRef.current = controller`, `isSupported` update, `return ()=> dispose()`
- `start/stop/cancel/reset` via `useCallback` com `controllerRef.current?.start()` [53-70]

**Closure/stale:** `useEffect` deps `[]` + `eslint-disable` [50] → `options.onTranscript` capturado na montagem. Se `ChatAssistant` recria callback (ex: `onTranscript: text=>state.setInput(text)`), `state.setInput` é estável (React setter), então stale não causa perda. **Inferência:** não é causa de 1 palavra, mas de "não aparece" se controller fosse recriado. `isSupported` inicial `window.isSecureContext && getUserMedia` é redundante com `controller.isSupported()` [45].

**Unmount/dispose:** `controllerRef.current=null` + `void controller.dispose()` [46-48] → Worker terminate. Se `stop()` estava em `await transcribe`, `gen++` aborta → `onTranscript` não chega → input não atualiza.

**Re-render:** `setTranscript` + `options.onTranscript` disparam rerender, mas não sobrescrevem `transcript` com vazio (só `reset` limpa).

---

## 15. Auditoria do ChatAssistant

Integração voz [ChatAssistant.tsx:512-522]:

```ts
const voice = useVoiceInput({onTranscript: text=>{ if(text?.trim()) state.setInput(text) }}) [515-518]
micDisabled = state.isLoading || (voice.isBusy && !voice.isRecording) [521]
button onClick: voice.isRecording ? voice.stop() : voice.start() [806]
```

- `onTranscript → setInput(text)` [517] — **substitui** input, não concatena. Se usuário digitava, perde digitação (risco VOZ-006 §14 P3, documentado).
- **Chega ao estado:** `state.input` é `useState` string, `setInput(text)` reflete no `<textarea value={state.input}>` [837].
- **Substituído/limpo/sobrescrito:** `runExchange` faz `state.setInput('')` [282] ao enviar, e `setStreamingText('')` [312]. Nenhum `useEffect` limpa `input` fora do envio [530-535] só restaura altura. Não há race com `isLoading`.
- **Rerender:** `useEffect scroll` [524-528] não afeta input.
- **Aparece no DOM:** `textarea` controlado, `value={state.input}` — se `setInput` chamado, DOM atualiza. Não há `key` que remonte.
- **Não modificado nesta auditoria.**

---

## 16. Auditoria de Produção

**Diferenças localhost vs produção:**

| Aspecto | localhost `next dev` | produção `vercel.app` |
|---|---|---|
| Build | `next dev --webpack` (HMR, chunks não minificados) | `next build --webpack` (minificado, hash) |
| Chunks | `vosk-browser` 5.79MB dinâmico | idem, mas com `Cache-Control: immutable` |
| Worker | Blob URL base64 | idem |
| WASM | inline no Worker | idem |
| Headers | `isSecureContext true` (localhost) | `true` (HTTPS) |
| CSP | default Next | idem + Vercel |
| COOP/COEP | ausente (VOZ-000) | ausente |
| Modelo | `GET /vosk-model...tar.gz` 200 local | idem, via CDN/Vercel |
| PWA/SW | `disable` fora de prod (`next.config 5MB`) | `sw.js` ativo, precache 5MB limite |

**Evidência:** VOZ-004-R4 mediu dev load 7447ms vs prod 4954ms (prod mais rápido). VOZ-006 desktop prod não testado com mic real.

**Não presumir dev=prod:** lab em dev com `next dev` não prova produção. Sintoma só em prod Android → focar em prod.

---

## 17. Auditoria PWA / Service Worker

- `next.config.ts:5-11` Serwist `swSrc:"src/sw.ts"`, `swDest:"public/sw.js"`, `disable` fora prod, `maximumFileSizeToCacheInBytes: 5242880` (5 MB) — **evidência observada** VOZ-005 §8.
- `src/sw.ts`: `defaultCache` runtime, `skipWaiting`, `navigationPreload`, push listeners.
- **Interferência voz:**
  - Chunk Vosk 5.79 MB >5MB → **não precache** (warning build) → load on-demand → requer rede.
  - Modelo tar.gz 32MB >5MB → **não precache** → fetch same-origin pelo Worker → pode cair em `defaultCache` runtime em revisitas (não testado).
  - `vosk-browser` Worker base64 não é asset precacheável → não afetado.
- **Classificação:** `PWA warning` (chunk não precache, voice online-first) ≠ `PWA causal failure` (não há evidência de SW bloquear Worker/fetch). **Inferência:** improvável causar 1 palavra.

---

## 18. Auditoria do Bundle

- `package.json:36 vosk-browser ^0.0.8` UMD `dist/vosk.js` 5.79MB autocontido (sem `require/process/window` top-level, Worker classic base64, WASM embutido) — verificado VOZ-004-R4 §5.
- Desktop e Android usam mesmos artefatos (build único, hash `_next/static/chunks/9cb48f...`). Se produção serve bundle stale, `document.querySelector('script[src*="vosk"]')` deve comparar hash dev vs prod.
- **Evidência:** não há divergência de bundle entre desktop e Android (mesmo build). Stale só se SW cache segurar chunk antigo → testar limpar SW.

---

## 19. Auditoria de Memória

| Recurso | Tamanho | Lifecycle |
|---|---|---|
| Modelo tar.gz | 32.4 MB (fetched) → descompactado ~60MB em Worker | Singleton `cachedModel`, `Model.terminate()` só em dispose (unmount ChatAssistant) |
| Worker/WASM | ~20MB heap | idem |
| PCM 3s | 48k samples *4B=192KB / 16k 48k samples=192KB | `chunks` array, liberado após `stop()` concat |
| AudioContext | ~few KB | `capture.cleanup()` fecha |
| Recognizer | por transcrição, `remove()` | [vosk.ts:102] |

**OOM em Android?** 32MB+20MB+0.2MB <100MB, em device 3GB não OOM. Pressão de memória/battery saver pode matar Worker em background, mas `isSupported` checaria. **Sem evidência** de OOM (não há `terminate` inesperado logado). GC agressivo não observado.

---

## 20. Auditoria de Performance

| Métrica | Desktop (evidência observada) | Android (estimado/hipótese) |
|---|---|---|
| Model load | 5452ms (fake mic), 7447ms dev / 4954ms prod (WAV 12s) | 5–10s (4G), warm 250ms (Cache) |
| Recording | 1s (fake) | 3s wall |
| PCM generation | 12288 samples 0.768s (underrun indício) | ? |
| Inference | 792ms EMPTY, 5182ms 12s RTF 0.43 | 1–2s para 3s (RTF <1) |
| Total | ~6s | ~8–13s |

Anomalia grosseira não detectada; única anomalia é `12288 vs 16000` (underrun). Benchmark formal não é objetivo desta sprint.

---

## 21. Matriz de Hipóteses

| Hipótese | Evidência a favor | Evidência contra | Confiança | Próximo teste (sem alteração funcional) |
|---|---|---|---|---|
| **Capture — perda de bloco final `onaudioprocess`** | Desktop fake 12288 vs 16000 (0.768s vs 1s) indício underrun; `finished=true` descarta callback pendente; janela 85ms | Lab E 1s com lógica similar não deu perda visível; `stop()` concatena antes de `close()` então `close()` não destrói PCM já copiado (ver §8) | **MEDIUM (inferência)** | Log `wallTime`, `chunks.length`, `pcm.length`, `pcmDuration` em Android 5×; comparar `wallTime*rate vs pcm.length` |
| **ScriptProcessor deprecated** | Deprecated, pode ter scheduling diferente em Android Chrome | Funciona em desktop; não explica 1 palavra isolado | LOW | Medir `onaudioprocess` contagem por segundo em Android |
| **Stop/race — `cleanup` antes do flush** | `cleanup()` sync após `stop()` sem await | `stop()` já leu chunks, `close()` não afeta PCM copiado (§8) | LOW | Log `audioContext.state` antes/depois `cleanup` |
| **PCM — curta duração / silêncio** | 1 palavra sugere PCM truncado; Vosk EMPTY para silêncio | Desktop fake EMPTY é correto para tom; mic real deve ter RMS >0.02 | MEDIUM | Log `RMS`, `peak`, `silenceRatio`, `duration` antes de `transcribe` |
| **Resampling — aliasing linear** | Sem filtro, 48k→16k ratio 3 | WAV 44.1k→16k funcionou 122 chars; não explica 1 palavra | LOW | Log `recordedRate`, `pcm16k.length`; comparar `OfflineAudioContext` offline (só leitura) |
| **Vosk — `retrieveFinalResult` 100ms precoce** | Worker Android mais lento; desktop 12s passou mas 3s pode ser parcial; 1 palavra = parcial | Desktop 12s funcionou com 100ms; guard 30s existe | **MEDIUM (inferência)** | Log `samples`, `sampleRate`, `ms(accept→retrieve)`, `finalText` antes/depois; testar 100ms vs 300ms só após coleta |
| **Worker/WASM — load/fetch falha prod** | Model 32MB fetch pode falhar por SW/CSP em prod | Gravação ocorre → load passou (READY) | UNKNOWN | Network: GET tar.gz status, `Model.on('error')`, `engineState` |
| **Lifecycle — `gen` token aborta `onTranscript`** | `cancel()`/`dispose()` incrementam `gen` → `stop()` aborta | Não explica 1 palavra, só vazio | LOW | Log `gen` antes/depois `transcribe` |
| **React callback — stale closure/unmount** | `useEffect []` dep, `controller.dispose` no unmount | `setInput` estável; `transcript` espelha | LOW | Log `isSupported`, `controllerRef` existência no `stop` |
| **Production bundle — stale chunk** | PWA pode segurar chunk 5.79MB antigo | Mesmo build hash dev/prod; não há divergência evidenciada | MEDIUM | Comparar chunk hash dev vs prod Android via `__NEXT_DATA__` |
| **PWA/cache — offline-first block** | Model não precache, requer rede | Load passou → online | LOW | Desabilitar SW temporário em teste diagnóstico |
| **Android browser — EC/NS/AGC ignorados** | `getUserMedia` constraints podem ser ignoradas em device barato | `track.getSettings()` em VOZ-002 mostrou EC false respeitado | LOW | Log `actualSettings` completo |

**Níveis:** HIGH/MEDIUM/LOW/UNKNOWN — nenhum HIGH sem coleta Android.

---

## 22. Root Cause

```
ROOT CAUSE NOT YET CONFIRMED
```

**Por que não confirmado:** nenhuma das duas hipóteses prioritárias (H1 capture, H2 Vosk timing) foi medida em **produção Android** com PCM/Vosk instrumentados. Evidências atuais são:

- **Evidência observada:** WAV 12s → 122 chars PASS (prova Vosk funciona offline); desktop fake 1s → 12288 underrun **indício**, não prova Android; `stop()` concatena antes de `close()` (lido) → `close()` não destrói PCM.
- **Hipótese:** perda de bloco final e timing Vosk.
- **Inferência:** se `pcmDuration << wallTime` → H1; se `pcmDuration≈wallTime` mas `finalText` parcial → H2.

**Experimento decisivo (sem alteração funcional, §6–10 do pedido):** instrumentação diagnóstica local (sem áudio) + Android 5× por duração. Ver §27.

Se após instrumentação `recordingDuration≈pcmDuration` e Vosk recebe `samples` corretos mas retorna 1 palavra, então **D — runtime Worker/WASM** ou **E — outra causa** (ex: `MediaTrackSettings` 8kHz inesperado).

---

## 23. Plano de Correção — Revisado Ordenado por Evidência (Não Implementar Ainda)

> **Regra desta sprint:** Nenhuma correção implementada. Itens abaixo são **propostas condicionais** à evidência da próxima sprint. Ordenados para coleta primeiro, correção depois.

### Fase Instrumentação (VOZ-008) — Obrigatória antes de qualquer P0

**Objetivo:** coletar §6–7 métricas sem alterar pipeline.

- **Arquivo:** `src/lib/voice/voiceController.ts:stop()` + `src/lib/voice/stt/vosk.ts:84` + `src/lib/voice/audio/capture.ts` (apenas logs)
- **Alteração proposta (condicional):** adicionar `if (process.env.NEXT_PUBLIC_VOICE_DEBUG==='1') console.debug({...})` com métricas listadas §10/§7.
- **Justificativa:** decidir entre A–E sem adivinhar.
- **Risco:** Nulo (dev/prod com flag, sem áudio, sem PII).
- **Critério de sucesso:** logs coletados em Android para 3 durações ×5.

### Condicional A — Corrigir finalização/capture (se `pcmDuration < wallTime * 0.9`)

- *Objetivo:* eliminar perda de bloco final.
- *Arquivo:* `src/lib/voice/audio/capture.ts:168`
- *Alteração esperada:* aguardar 1 tick do audio thread antes de concat (ex: `await new Promise(r=>requestAnimationFrame(r))` ou `setTimeout 0` antes de `finished=true`), ou migrar para `AudioWorklet` em sprint separada. **Não implementar 50/100ms fixo sem evidência.**
- *Teste:* `pcmDuration ≈ wallTime`.
- *Rollback:* remover await.

### Condicional B — Corrigir timing Vosk (se `pcmDuration≈wallTime` mas Vosk retorna parcial)

- *Arquivo:* `src/lib/voice/stt/vosk.ts:125`
- *Alteração:* aumentar `setTimeout` para 300ms ou aguardar `result` com `isFinal` flag, sem mudar `acceptWaveformFloat`.
- *Risco:* +200ms latência.
- *Sucesso:* frase média 4 palavras completa em 5/5.

### Condicional C — Resampling (se `recordedRate` anômalo ou `pcm16k` distorcido)

- *Arquivo:* `capture.ts:191`
- *Alteração:* usar `OfflineAudioContext` para resample com filtro, mantendo fallback linear.
- *Risco:* Médio.

### Condicional D — Runtime Worker/WASM (se `load`/`Model` falha em prod)

- *Arquivo:* `vosk.ts:57`, `next.config.ts` (não alterar agora)
- *Alteração:* retry load, ou hospedar tar.gz com `Cache-Control: immutable`, ou verificar CSP.

### Condicional E — Outra causa (se nenhum acima)

- Investigar `track.getSettings()` divergente, `AudioContext` sampleRate fallback, ou `ChatAssistant` sobrescrita.

**Prioridade final:** Instrumentação → A → B → C → D → E, **ordenado por evidência coletada**, não por probabilidade prévia. Cada condicional só entra se seu gatilho de evidência for atingido.

---

## 24. Plano de Validação (Pós-Correção, quando autorizada)

### Laboratório

- WAV `moonshire.wav` 12s 44.1k→16k → Vosk → 122 chars, RTF <0.5, `pcmSamples` 192k, `pcmDuration` 12s.

### Desktop

- Chromium fake mic 1s → EMPTY correto; Chromium real mic frase média `"quero trocar arroz por batata doce"` → >4 palavras, editável.

### Android (físico, HTTPS, Chrome)

- **Frase curta (1–2 palavras):** `"olá"` — 5 repetições
- **Frase média (4–6 palavras):** `"posso comer leites vegetais?"` — 5 repetições
- **Frase longa (8+ palavras):** `"quero trocar dois pães por tapioca e meu peso é setenta quilos"` — 5 repetições
- **Casos:** cancelar (X), permissão negada (NotAllowedError), reuso READY (2ª gravação sem reload), unmount (fechar chat durante gravação → mic liberado).

### Produção

Repetir Android médio/longo em `vercel.app`, verificar Network: chunk 5.79MB 200, tar.gz 32MB 200, Worker 200, 0 POST áudio, console 0 errors, PWA cache hit/miss.

---

## 25. Critério de Sucesso da Futura Correção

Não é:

- botão funciona / microfone funciona / 1 palavra apareceu

É:

```
fala humana PT-BR (3 durações, 5× cada)
  ↓ PCM válido (pcmDuration≈wallTime, RMS>0.02, peak>0.1)
  ↓ Vosk (samples corretos, sampleRate 16k, retrieve 100-300ms, texto coerente)
  ↓ transcrição coerente (>80% das repetições com ≥4 palavras para frase média)
  ↓ input ChatAssistant (textarea mostra texto, editável)
  ↓ usuário edita (opcional)
  ↓ envio normal (runExchange → patient route, sem regressão)
```

Com repetibilidade 5/5 por duração.

---

## 26. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| 1 | Sem Android físico, root cause permanece NOT CONFIRMED | Alta | VOZ-008 instrumentação obrigatória |
| 2 | Instrumentação adiciona overhead de log (sem áudio, só números) | Baixa | Flag `NEXT_PUBLIC_VOICE_DEBUG`, prod só com consentimento QA |
| 3 | `ScriptProcessorNode` deprecated pode ser removido | Média | Planejar VOZ-009 AudioWorklet como P2, não P0 |
| 4 | Modelo tar.gz 32MB em 4G lento → timeout load 120s | Média | Indicador progresso, retry, cache HTTP |
| 5 | `setInput` substitui texto digitado | Baixa | Documentado VOZ-006 §14, aceitar ou trocar por append em decisão produto |
| 6 | Correção prematura sem evidência mascarar sintoma | Alta | **Não implementar P0.1/P0.2 antes de VOZ-008** (regra desta sprint) |

---

## 27. Próxima Sprint Recomendada

**VOZ-008 — Instrumentação Diagnóstica Sem Alteração Funcional**

**Duração:** 3–5 dias  
**Objetivo:** coletar evidência decisiva §6–10 sem alterar pipeline, ChatAssistant, backend, Vosk model ou arquitetura.

**Tarefas VOZ-008:**

1. **Instrumentar `voiceController.stop()`** (feature flag `NEXT_PUBLIC_VOICE_DEBUG`):
   ```
   recordingWallTimeMs, audioContext.sampleRate/state, track.getSettings(),
   chunks.length, total PCM samples, PCM duration, RMS, peak, min, max,
   silenceRatio, recordedRate, pcm16k.length, pcm16k duration,
   engineState, generation token
   ```
2. **Instrumentar `transcribeWithVosk()`**:
   ```
   samples recebidos, sampleRate recebido,
   ms entre acceptWaveformFloat() e retrieveFinalResult(),
   resultado retornado, inferenceMs
   ```
3. **Teste Android físico:**
   - Frase curta / média / longa ×5 repetições (total 15 gravações)
   - Logar `recordingDuration` vs `pcmDuration` por gravação
   - Verificar `Network` payload, `Worker` status, `engineState`, `gen`
4. **Análise:**
   - Comparar `recordingDuration ≈ pcmDuration` → truncamento?
   - Se truncado → caminho **A** (capture)
   - Se não truncado mas Vosk 1 palavra → caminho **B** (Vosk timing) ou **D** (Worker)
   - Se `recordedRate` divergente → caminho **C** (resampling)
5. **Entrega:** relatório `VOZ-008-INSTRUMENTATION-REPORT.md` com matriz Cliente→Vosk e decisão A/B/C/D/E.

**Gates VOZ-008:** `tsc 0`, `lint 13`, `build 28 rotas`, `vitest 258`, instrumentação removível via flag, sem alteração funcional em prod sem flag.

**Após VOZ-008:** implementar correção condicional única (A **ou** B **ou** C **ou** D) como **VOZ-009 — Fix**, com validação §24.

**Não iniciar nesta etapa:** VOZ-013, Whisper, voz, redesign chatbot, alteração memória/RAG, P0.1/P0.2, AudioWorklet, resampling.

---

## 28. Classificação Final

> **AUDIT COMPLETE — ROOT CAUSE NOT YET CONFIRMED**

Auditoria end-to-end concluída com evidências observadas, hipóteses graduadas e plano ordenado por evidência. Causa raiz depende de coleta instrumentada em Android físico (VOZ-008). Nenhuma correção implementada nesta sprint, conforme regra absoluta.

**Próximo passo:** aguardar autorização para VOZ-008 instrumentação.

---

*Gerado em Plan Mode auditado, Build Mode sem alterações de produção. Artefatos preservados: `src/lib/voice/**`, `src/components/ChatAssistant.tsx`, `src/app/dev/voice-test`, `public/vosk-model-small-pt-0.3.tar.gz`, `ChatAssistant` backend intacto.*
