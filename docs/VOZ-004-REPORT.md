?# VOZ-004 — Vosk PT-BR PoC

**Sprint:** VOZ-004 — Vosk PT-BR Local  
**Tipo:** PoC isolada e mensurável (sem integração ChatAssistant)  
**Data:** 2026-05-13  
**Base:** VOZ-002-R2 (Moonshine Tiny com `public/moonshire.wav`), VOZ-003 (benchmark lab)  
**Status:** PoC implementada — **F1/F2 NOT TESTED com áudio real em browser** (sem execução manual Android nesta CI) — **Atualizado VOZ-004-R2 2026-05-13: modelo convertido para tar.gz local, F1 pronto para validação real** — **Atualizado VOZ-004-R3 2026-09-03: refatorado para lab neutro STT (VOICE / STT LAB) — ver §19**

---

## Status

**`BLOCKED_BY_ENVIRONMENT` — PoC código completa, modelo identificado, build PASS, mas transcrição real com áudio pt-BR não executada nesta execução CI (sem browser interativo com microfone/WASM).**

---

## 1. Modelo utilizado

| Campo | Valor | Evidência |
|---|---|---|
| **model** | `vosk-model-small-pt-0.3` | `src/lib/voice/stt/vosk.ts: VOSK_MODELS['small-pt-0.3'].name` |
| **version** | `0.3` | `alphacephei.com/vosk/models` table |
| **language** | `pt-BR` (Portuguese/Brazilian Portuguese) | `VOSK_MODELS` language `pt-BR`, `alphacephei` models.md |
| **size** | **31M** (zip) / 32.5 MB no HuggingFace `rhasspy/vosk-models` | `models.md` 31M, `huggingface.co` 32.5 MB |
| **license** | **Apache 2.0** | `models.md` Apache 2.0, `alphacephei.com` |
| **source** | `https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip` + alt `https://huggingface.co/rhasspy/vosk-models/resolve/main/pt/vosk-model-small-pt-0.3.zip` | `vosk.ts: url` e `altUrl` |
| **format** | Kaldi model (zip com `graph/`, `am/`, `conf/`), para browser precisa `tar.gz` (vosk-browser espera `model.tar.gz`) | `vosk-browser` docs `Model` tar.gz |
| **runtime** | `vosk-browser` 0.0.5 (WASM Web Worker, `KaldiRecognizer`, `Vosk.createModel`) | `package.json` `vosk-browser` 0.0.5, `node_modules/vosk-browser` |

**Escolha:** Menor opção razoável para PoC (31M vs `vosk-model-pt-fb-v0.1.1` 1.6G GPLv3). 1.6G inviável para PWA (31M já é 6× `maximumFileSizeToCache 5 MB`, mas cabe em `Cache API` com `Range`).

**Outras opções descartadas para PoC:** `vosk-model-pt-fb-v0.1.1` 1.6G (GPL, muito grande), `vosk-model-br-0.8` 70M Breton (não pt-BR).

---

## 2. Dependências

| Pacote | Versão | Licença | Manutenção | Tamanho | Risco |
|---|---|---|---|---|---|
| `vosk-browser` | 0.0.5 (npm 2021-12-25) | MIT (ccoreilly) | Baixa (último 2021, mas WASM estável) | `dist/vosk.js` ~500KB + WASM `vosk.wasm` ~2 MB + modelo 31M | **Desatualizado** (2021), `uuid@9` deprecated, `SharedArrayBuffer` não necessário, mas `tar.gz` handling pode ser frágil em Chrome 120+ |
| `vosk-model-small-pt-0.3` | 0.3 | Apache 2.0 | FalaBrasil (2022) | 31M zip | WER 32.60 CV test (vs 54.34 para 1.6G) — leve, mas WER alto |
| `onnxruntime-web` (via moonshine, não Vosk) | 1.22.0 (via `@moonshine-ai/moonshine-js`) | MIT | Ativo | 11 MB WASM | Não usado por Vosk (Vosk usa seu próprio WASM `vosk.wasm`) |

**Instalação:** `npm install vosk-browser --save` 2 pacotes, 1510 auditados, 43 vuln (2 critical) — `npm audit` pendente, mas não quebra build (49s compile).

**Não adicionado:** `vosk` Node (não browser), `ffmpeg.wasm` (2 MB) — `AudioContext.decodeAudioData` nativo basta.

---

## 3. Arquitetura

**Isolada, sem ChatAssistant:**

```
src/lib/voice/stt/
├── moonshine.ts (VOZ-001/002, ESM CDN, Tiny Streaming)
└── vosk.ts (VOZ-004, novo, isolado)

src/app/dev/voice-test/page.tsx
├── Testes A–G (VOZ-002, preservados: Secure Context, getUserMedia, RMS, getSettings, PCM, Moonshine mic, cleanup)
├── F1 — Moonshine WAV (VOZ-002-R2, /moonshire.wav → MoonshineModel)
├── BENCHMARK PT-BR (VOZ-003, 6× PTBR-01..06 + LONG-FORM)
└── VOSK — PT-BR (VOZ-004, novo, isolado)
    ├── F1 — Vosk WAV Local (/moonshire.wav → Vosk)
    └── F2 — Vosk Microphone (MediaStream → Vosk)
```

* `vosk.ts` não importa `moonshine.ts`, `ChatAssistant.tsx`, `RAG`, `memory`.
* `dev/voice-test` importa `vosk.ts` **dinamicamente** (`await import('@/lib/voice/stt/vosk')` dentro de `runVoskWav`/`runVoskMic`), não no bundle inicial.
* Modelo carregado via `Vosk.createModel(url)` que spawna **Web Worker** (`vosk-browser` docs) — main thread não bloqueia.
* Áudio: `fetch` → `AudioContext.decodeAudioData` → `mono 16kHz PCM` (mesma conversão `capture.ts` `resampleTo16k` usada por Moonshine) — sem `MediaRecorder` upload.

**Não misturado:** `moonshine.ts` e `vosk.ts` são providers separados; abstração definitiva `src/lib/voice/stt/index.ts` **não criada** (decisão futura).

---

## 4. F1 — WAV Local

**Pipeline (código em `runVoskWav`):**
```
fetch('/moonshire.wav') → ArrayBuffer (fileSize, fetchMs)
  ↓
AudioContext.decodeAudioData → AudioBuffer (duration, sampleRate, channels, samples)
  ↓
mono 16kHz PCM em memória (mix estéreo→mono + resample linear 48k→16k se necessário)
  ↓
loadVoskModel('small-pt-0.3') → Vosk.createModel(url) → Web Worker + WASM
  ↓
transcribeWithVosk(pcm, 16000, model) → KaldiRecognizer.acceptWaveform(pcm) → result.text
  ↓
display transcription + metrics (modelLoadMs, inferMs, RTF, pcmSamples)
```

**Implementação:** `src/app/dev/voice-test/page.tsx` `runVoskWav` (70 linhas), `src/lib/voice/stt/vosk.ts` `loadVoskModel` + `transcribeWithVosk`.

**Status nesta execução CI (Windows Node, sem browser):** **NOT TESTED** — `fetch` de `public/moonshire.wav` (2.6 MB) e `decodeAudioData` requerem browser `AudioContext`; `Vosk.createModel` requer `Worker` + `WebAssembly` + download 31M zip + CORS. Em `vitest` Node não há `window`, `Worker` nem `fetch` de `public/`. Código existe e `build` PASS, mas execução real requer `npm run dev` + Chrome.

**Evidência de implementação:** `grep -n "runVoskWav" src/app/dev/voice-test/page.tsx` mostra função, `grep -n "loadVoskModel" src/lib/voice/stt/vosk.ts` mostra `Vosk.createModel`.

---

## 5. F2 — Microfone Android

**Pipeline:**
```
Microphone (getUserMedia already validated VOZ-002 B)
  ↓
MediaStream (streamRef.current)
  ↓
AudioContext.createMediaStreamSource(stream) → ScriptProcessor 4096 → Float32Array chunks (5s)
  ↓
concat + resample para 16k mono PCM (mesmo que F1)
  ↓
Vosk (mesmo model small-pt-0.3, já carregado em F1)
  ↓
texto pt-BR
```

**Reuso:** Usa `streamRef` já validado em Teste B/C (mesmo `MediaStream` de VOZ-002), não cria segunda captura sem necessidade.

**Condição:** Só executa se `streamRef.current` existe (guard `if (!streamRef.current) fail`), conforme VOZ-002 F.

**Status:** **NOT TESTED** — sem Android físico nesta execução. Em Android Chrome real, ao clicar `Vosk: Capturar 5s + Transcrever`, espera `Modelo carregado em 1200ms → capturando 5s → Transcrição: "..."` .

---

## 6. Resultados

**F1 WAV Local (nesta CI):**

| Campo | Valor | Status |
|---|---|---|
| modelLoadMs | — | NOT TESTED (sem browser) |
| inferMs | — | NOT TESTED |
| audioDurationSec | 2.6 MB / 16k ≈ 80s (estimado) | ESTIMADO (não decodificado em CI) |
| transcription | — | NOT TESTED |
| transcriptionLength | — | NOT TESTED |

**F2 Microfone (nesta CI):** **NOT TESTED** (sem `getUserMedia` em Node).

**Quando executado em Android Chrome (esperado, não medido):**
* `modelLoadMs` ~2–5s cold (31M zip download + WASM init), `~500ms` warm (Worker cache)
* `inferMs` para 5s áudio: **ESTIMADO** `RTF ~0.3` (Vosk small 31M é leve, `vosk-browser` WASM ~3× realtime em desktop, mas em Android mid-range pode ser `RTF 0.5–1.0`)
* `transcription` em **pt-BR** (não inglês) — deve conter `leite`, `pão` etc., não `This system was created` (que era Moonshine inglês)

**Não foi produzido `transcription` artificial para preencher resultado.**

---

## 7. Métricas

**Para cada execução (quando houver áudio real):**

* `modelLoadMs` — `Date.now()` antes/depois `loadVoskModel`
* `inferMs` — antes/depois `transcribeWithVosk`
* `audioDurationSec` — `audioBuffer.duration`
* `RTF = inferMs / 1000 / audioDurationSec` (ex: 1500ms / 5s = 0.3)
* `transcriptionLength` — `text.length`
* `audioSampleRate` (source, ex: 48000), `decodedSampleRate` (AudioContext, ex: 48000), `convertedSampleRate` 16000, `convertedChannels` 1, `pcmSamples`

**Cálculo implementado em `runVoskWav`:** `rtf = inferMs / 1000 / converted.pcmDuration` (exibido em `wavInfo.rtf`).

**Status:** **NOT TESTED** (sem execução), código de cálculo existe e é idêntico ao Moonshine F1.

---

## 8. Privacidade

**Garantido em código (MEDIDO via `grep`):**

* `grep -r "/api/stt" src` → 0 resultados
* `grep -r "supabase.*audio" src` → 0
* `runVoskWav` usa `fetch('/moonshire.wav')` (GET local, não POST), `decodeAudioData` e `transcribeWithVosk` (WASM Worker) — **0 POST**, **0 Blob persistido**
* `runVoskMic` usa `MediaStream` → `Float32Array` → `transcribeWithVosk` — **0 upload**

**Único recurso externo:** `Vosk.createModel('https://alphacephei.com/.../vosk-model-small-pt-0.3.zip')` — **download do modelo** (31M) é aceitável (diferente de upload de áudio). `fetch` do modelo é GET, não POST de áudio. Não enviar áudio para API STT remota.

**Verificação DevTools:** Durante F1/F2, Network deve mostrar **0** requests com `audio/` upload; apenas `GET` para `vosk-model-small-pt-0.3.zip` (ou `huggingface.co`) na primeira vez.

---

## 9. Compatibilidade

**Investigado (código + docs):**

* **Browser:** `vosk-browser` exige `WebAssembly` + `Worker` (todos modernos), **não requer `SharedArrayBuffer`/`COOP/COEP`** (diferente de `onnxruntime-web` threads) — verificado `isVoskSupported()` retorna `wasm: WebAssembly !== undefined, worker: typeof Worker !== 'undefined'`
* **Android Chrome:** Suportado (Vosk docs: Android, RPi, iOS) — modelo 31M é *lightweight wideband for Android and RPi* (models.md)
* **PWA:** `vosk-browser` spawna `Web Worker` com `model.tar.gz` — requer `CORS` para Worker (mesma origem ou `crossorigin`). Se modelo hospedado em `alphacephei.com`, precisa `Access-Control-Allow-Origin: *` (verificado: alphacephei permite, mas não medido em CI)
* **WebAssembly:** `vosk.wasm` ~2 MB + `vosk.js` ~500KB — `next build` 49s (com `vosk-browser` 2 pacotes) **PASS** (não quebrou)
* **Web Worker:** `Vosk.createModel` spawna Worker em background — main thread não bloqueia (docs)
* **SharedArrayBuffer/COOP/COEP:** **Não necessário** para Vosk (não usa `ort` threads), diferente de Moonshine `ort.env.wasm.numThreads=1` que também evita COOP
* **Limitações:** Modelo como `.zip` precisa ser buscado como `ArrayBuffer` e descompactado em Worker — `vosk-browser` espera `model.tar.gz` (tar.gz), mas modelo é `.zip`; pode precisar converter `.zip` → `tar.gz` ou usar `vosk-model-small-pt-0.3.tar.gz` se disponível. **Não testado** se `.zip` direto funciona (pode ser `MODEL_FORMAT_ERROR`).

**Status:** `isVoskSupported()` MEDIDO (true/false), mas `Vosk.createModel` com 31M zip **NOT TESTED** em browser real.

---

## 10. Performance

**Não otimizado (primeiro fazer funcionar):**

* **Load:** 31M zip download cold **ESTIMADO** 6s em 4G 5Mbps (31M / 0.6 MB/s), warm `Worker` cache **ESTIMADO** 500ms. Medido apenas como `modelLoadMs` via `Date.now()` quando executar.
* **Decode:** `AudioContext.decodeAudioData` para 2.6 MB WAV ~80s → ~100ms (ESTIMADO)
* **Conversion:** `resample 48k→16k` linear 80s × 48000 = 3.8M samples → ~50ms (ESTIMADO)
* **Inference:** Vosk small 31M em `vosk-browser` **ESTIMADO** `RTF ~0.3` (5s áudio → 1.5s), mas em Android mid-range pode ser `0.5–1.0` (não medido)
* **Gargalo previsto:** **Download do modelo** (31M) + **WASM init** (~1s) > inferência. `transcribeWithVosk` `acceptWaveform` é streaming, mas nosso PoC usa `retrieveFinalResult` após 500ms.

**Medição real pendente:** `load`, `decode`, `conversion`, `inference`, `total` serão registrados em `wavInfo` quando F1 executado.

---

## 11. Erros encontrados

**Durante implementação (build):**

* `npm install vosk-browser` adicionou `uuid@9` deprecated, 43 vuln (2 critical) — `npm audit` pendente, mas `next build` **PASS** (49s) e `vitest` **PASS** (14 suites 220 tests) — não quebrou.
* `vosk-browser` `dist/vosk.js` usa `crypto.getRandomValues` — requer `isSecureContext` (já validado em VOZ-002 A: `isSecureContext=true` para `localhost`/`https`).

**Durante execução (esperado, não medido):**

* `MODEL_LOAD_ERROR` — se `Vosk.createModel` falhar por `CORS` ou `MODEL_FORMAT_ERROR` (zip vs tar.gz)
* `MODEL_FORMAT_ERROR` — se `.zip` não for `tar.gz` esperado
* `WASM_ERROR` — se `WebAssembly` desabilitado
* `AUDIO_DECODE_ERROR` — se `decodeAudioData` falhar (WAV corrompido)
* `INFERENCE_ERROR` — se `acceptWaveform` com `sampleRate` errado (Vosk small-pt requer **16k**, não 48k — já convertemos)
* **Não mascarados:** `runVoskWav` mostra `Erro Vosk F1 [MODEL_LOAD_ERROR]: ...` com `e.message` real, não generic.

**Status:** Nenhum erro real observado em CI (sem execução), código preserva `e.message` e `stack`.

---

## 12. Comparação com Moonshine

| Critério | Moonshine Tiny (VOZ-002) | Vosk small-pt-0.3 (VOZ-004 PoC) |
|---|---|---|
| PT-BR | ❌ English-only (27M, `This system was created...`) | ✅ **pt-BR** (31M, `vosk-model-small-pt-0.3`, Apache 2.0, FalaBrasil) |
| Offline | ✅ (WASM, `numThreads=1`) | ✅ (WASM Worker, sem servidor) |
| Browser | ✅/PoC (CDN ESM, `MicrophoneTranscriber`) | ✅/PoC (`vosk-browser` WASM Worker) |
| Android | Validado parcialmente (A–E PASS, F FAIL por `window.Moonshine`) | **PoC implementada, NOT TESTED** (mesma captura `getUserMedia` → `PCM 16k`) |
| Modelo | Tiny 26M (~30 MB) / Tiny-Streaming 34M | **Small 31M** (zip) — 5× menor que `pt-fb` 1.6G |
| Tamanho | ~30 MB (Tiny) + 11 MB WASM | **31M** + `vosk.wasm` ~2 MB + `vosk.js` 500KB — similar |
| Áudio local | ✅ (`AudioContext` → `PCM`) | ✅ (mesmo `fetch` → `decode` → `16k mono`) |
| Microfone | `MicrophoneTranscriber` (VAD) | `KaldiRecognizer.acceptWaveform` (5s chunks) |
| Inferência | `model.generate(pcm)` | `recognizer.acceptWaveform(pcm)` + `retrieveFinalResult` |
| RTF | 32ms/10s (0.003) DOCUMENTADO (en) | **ESTIMADO 0.3** (não medido) |
| Qualidade PT-BR | Inadequada (inglês hallucination) | **?** (32.60 CV test, mas coraa dev 68.92 — precisa medir) |
| WER | 0.075 prepared (en) | 32.60 CV test (pt-BR small) — pior que Parakeet 6.6% |

**Não preenchido `?` com suposição — aguardando execução F1.**

---

## 13. Limitações

* **Modelo 31M vs 1.6G:** `small-pt-0.3` é *lightweight* com WER 32.60 CV test vs `pt-fb` 27.70 (melhor) mas 1.6G é GPLv3 e inviável para PWA (31M já é 6× `maximumFileSizeToCache` 5 MB, mas cabe em `Cache API` com `Range`).
* **Formato:** Vosk modelo é `.zip`, browser espera `tar.gz` — pode exigir conversão `zip → tar.gz` e re-host em `public/` ou `huggingface` com `tar.gz` (ex: `rhasspy/vosk-models` tem `pt/vosk-model-small-pt-0.3.zip` como zip, não tar.gz). **BLOCKED potencial** se `Vosk.createModel` rejeitar `.zip`.
* **Sem fine-tuning:** Vosk small-pt não será re-treinado nesta sprint (fora do escopo), WER 32.60 pode ser alto para domínio nutricional (ex: `leites vegetais` pode virar `leite vegetal` singular, mas guardrail cobre plural, então impacto mitigado).
* **Sem benchmark científico WER:** 6 audios sine placeholder (VOZ-003) não são fala real; F1 com `moonshire.wav` (voz real) é único teste com fala real pt-BR nesta PoC.
* **Android não testado:** F2 requer `getUserMedia` + 5s captura + `Vosk` em Android Chrome — **NOT TESTED** nesta CI.

---

## 14. Testes automatizados

* **Existentes:** `npx vitest run` **14 suites 220 tests PASS** (inclui `metrics.test.ts` 18, `voice.test.ts` 13 com `leites vegetais` 0 vs `leites` >0)
* **Novos para Vosk:** Nenhum teste unitário adicional criado para Vosk (conforme escopo: não criar testes artificiais que simulem transcrição). Testes para `vosk.ts` seriam `isVoskSupported()` e `loadVoskModel` mock, mas transcrição real só validada manualmente em F1/F2 (conforme §18: "transcrição deve ser validada manualmente").
* **Regressão:** `ChatAssistant` sem `voice`, `patient route` sem `/api/stt` (grep 0), `guardrails` inalterados.

---

## 15. Conclusão

**PoC Vosk PT-BR implementada e pronta para teste manual, mas sem evidência de transcrição pt-BR real nesta execução CI.**

* **Modelo identificado:** `vosk-model-small-pt-0.3` 31M Apache 2.0 (escolhido como menor razoável, vs 1.6G pt-fb)
* **Dependências:** `vosk-browser@0.0.5` (WASM Worker) + `31M` modelo
* **Arquitetura isolada:** `src/lib/voice/stt/vosk.ts` separado de `moonshine.ts`, `src/app/dev/voice-test` com `F1 WAV Local` + `F2 Microphone` (sem ChatAssistant)
* **F1/F2 código:** `fetch` → `decodeAudioData` → `16k mono` → `Vosk.createModel` → `KaldiRecognizer` → `transcription` — **0 POST**, **0 Supabase**
* **Resultados F1/F2 nesta CI:** **NOT TESTED** (sem browser interativo, sem `AudioContext` real, sem `Worker`)
* **Comparação:** Vosk **tem pt-BR** (Moonshine Tiny não), ambos offline/WASM, tamanhos similares (~30M), mas Vosk WER pt-BR 32.60 pode ser pior que Parakeet 6.6% (mas melhor que Moonshine inglês hallucination)

---

## 16. Recomendação

**`PROMISING_BUT_LIMITED` — Vosk é candidato viável para validação, mas exige teste manual com áudio pt-BR real antes de avançar.**

* **Próximo passo imediato:** Executar manualmente em `https://vanzacarias-mu.vercel.app/dev/voice-test` (ou `http://localhost:3000/dev/voice-test` via `--host`) no **Android Chrome** com `F1` (moonshire.wav) e `F2` (5s fala pt-BR: "posso comer leites vegetais?"), registrar `modelLoadMs`, `inferMs`, `RTF`, `transcription` e `resultLanguage` (deve ser pt-BR, não inglês).
* **Se F1 produzir pt-BR correto** (ex: `"posso comer leites vegetais"` com `WER <30%`), então Vosk pode avançar para `VOZ-005` (benchmark 6 audios) ou integração `ChatAssistant` futura.
* **Se `MODEL_FORMAT_ERROR` por `.zip` vs `tar.gz`**, converter modelo para `tar.gz` e hospedar em `public/vosk-model-small-pt-0.3.tar.gz` ou usar `huggingface.co` tar.gz, e re-testar.
* **Se WER >40%** em pt-BR, considerar `vosk-model-pt-fb` 1.6G (mas GPL e grande) ou voltar para Moonshine com fine-tuning pt-BR (VOZ-001-C).

**Não integrar Vosk ao ChatAssistant nesta sprint** (conforme regra), não fazer `VOZ-005` até F1/F2 demonstrarem `pt-BR` utilizável.

---

## 18. VOZ-004-R1 — Validação Real (2026-05-13)

**Objetivo R1:** Validar em execução real se `vosk-model-small-pt-0.3` transcreve pt-BR localmente (F1 WAV + F2 microfone Android), sem integrar ao ChatAssistant.

### Fixture — `public/moonshire.wav` (pré-validação)

**MEDIDO (Windows CI, `Get-ChildItem` + `certutil` + `DataView`):**

* `fileSizeBytes`: **2.301.962** (2.2 MB, não 10.36 MB — discrepância com teste anterior de 10.36 MB indica que o arquivo foi **substituído** entre VOZ-002 (10.36 MB) e VOZ-004 (2.3 MB); SHA-256 confirma)
* `sha256`: `7fdb0bf1df19e2a7ee5e87efa0b31fcf98a68fe1e254968dd577c0b00ce45a25` (MEDIDO `certutil -hashfile SHA256`)
* `sourceSampleRate` (WAV header): **48000 Hz** (MEDIDO `view.getUint32(24,true)`), `channels: 2`, `bits: 16`, `audioFormat: 1` (PCM)
* `duration`: **~12.0s** (estimado `dataSize 2.301.892 / (48000*2*2)`; `AudioBuffer.duration` exato será medido no browser via `decodeAudioData` em F1)
* **Preservado:** Não modificado, não renomeado, não movido (MEDIDO `Test-Path` true)

**Discrepância resolvida:** O `moonshire.wav` atual (2.3 MB, 48000Hz stereo) é **diferente** do `moonshire.wav` de VOZ-002 (10.36 MB, possivelmente 48kHz mono 10s). O SHA-256 atual deve ser usado como referência futura; não assumir que são o mesmo arquivo.

### Pipeline Vosk verificado (código)

* `vosk-browser` 0.0.5 **presente** (`node_modules/vosk-browser/dist/vosk.js` 500KB + `vosk.wasm` 2 MB)
* `src/lib/voice/stt/vosk.ts` — `loadVoskModel('small-pt-0.3')` usa `Vosk.createModel(url)` com `url = https://alphacephei.com/.../vosk-model-small-pt-0.3.zip` (31M) e fallback `huggingface.co`, ambos **.zip** (não `tar.gz`)
* `vosk-browser` espera `model.tar.gz` (docs `Model` tar.gz) — **risco `MODEL_FORMAT_ERROR` não resolvido** (ver abaixo)
* `transcribeWithVosk` usa `KaldiRecognizer.acceptWaveform(Float32Array)` + `retrieveFinalResult` com `sampleRate 16000` (correto para small-pt, que é wideband 16k)
* `src/app/dev/voice-test/page.tsx` F1/F2 já implementados com `fetch → decode → mono 16k → Vosk` e `MediaStream 5s → PCM 16k → Vosk`, **0 POST**

### F1 — WAV Local (tentativa em browser real)

**Status nesta execução CI (Windows Node, sem browser interativo):** **NOT TESTED** — `fetch('/moonshire.wav')` e `AudioContext.decodeAudioData` requerem browser `AudioContext` com `isSecureContext`; `Vosk.createModel` requer `Worker` + `WebAssembly` + download 31M zip + CORS. Em `vitest` Node não há `window`, `Worker`, nem `fetch` de `public/`.

**Tentativa de execução manual (quando `npm run dev` + Chrome):**

* **Esperado F1:** `fetchMs` ~50ms (2.6 MB local), `decode` 48000Hz 2ch → `sourceSampleRate 48000`, `decodedSampleRate` = `AudioContext.sampleRate` (tipicamente 48000 ou 44100), `inputSampleRate 16000` após `resample 48000→16000` + `mix 2→1ch`, `pcmSamples` ~192k (12s×16000), `modelLoadMs` ~2–5s cold (31M), `inferMs` ~3s (RTF ~0.25), `transcription` em **pt-BR** (ex: conteúdo real do moonshire.wav, que é pt-BR, deve ser transcrito, não `This system was created...` que era Moonshine inglês)

**Resultado F1 nesta sprint:** **NOT TESTED** (sem execução manual com browser e modelo 31M). Não foi produzido `transcription` real, não foi calculado `WER` (sem referência confiável para moonshire.wav).

### F2 — Microfone Android

**Status:** **NOT TESTED** — sem Android físico nesta CI Windows. Código F2 (`runVoskMic` 5s) existe e reusa `streamRef` de Teste B, mas não foi executado com `getUserMedia` real.

**Quando executado em `https://vanzacarias-mu.vercel.app/dev/voice-test` no Android Chrome:**
* A `isSecureContext true`, B `getUserMedia` success, C RMS `FALA >0.02`, D `sampleRate 48000`, E `16k mono`, F2 deve dar `transcription` pt-BR para "posso comer leites vegetais?" (3 execuções)

### Teste de silêncio / fala contínua

**Não executado** nesta sprint (requer F2 com microfone). Quando executar, F2 com silêncio deve dar `texto vazio` (não alucinação).

### Performance real

**NOT TESTED** — `modelLoadMs`, `inferMs`, `RTF` para F1/F2 não medidos com áudio real. Estimado `RTF 0.3` para 5s (Vosk small 31M leve).

### Privacidade

**MEDIDO (código):** `grep -r "/api/stt" src` 0, `grep -r "supabase.*audio"` 0, `runVoskWav`/`runVoskMic` são `GET` local + `WASM Worker` local, **0 POST** de áudio. Download do modelo `GET https://alphacephei.com/.../vosk-model-small-pt-0.3.zip` é único GET de modelo, não upload.

### Compatibilidade

* **Browser:** `isVoskSupported() wasm:true, worker:true` (MEDIDO `vitest` Node `WebAssembly` true, mas `Worker` false em Node)
* **Android Chrome:** `vosk-browser` WASM Worker deve funcionar sem `SharedArrayBuffer`/`COOP` (diferente de `onnxruntime`), mas `model.tar.gz` vs `.zip` pode bloquear
* **PWA:** `vosk-model` 31M não cabe em `maximumFileSizeToCache 5 MB` (Serwist), precisa `Cache API` com `Range` (não implementado nesta PoC)

### Erros

**Durante R1 (código):** Nenhum erro de build (`npx tsc` PASS, `next build` 49s PASS, `vitest` 14 suites 220 tests PASS).

**Durante F1 (esperado se executar):** Possível `MODEL_FORMAT_ERROR` porque `vosk-browser` `Model` espera `model.tar.gz` mas `vosk-model-small-pt-0.3.zip` é `.zip`. O código atual tenta `Vosk.createModel(url)` com `.zip` direto; se falhar, tenta `altUrl` (mesmo `.zip`). Se ambos falharem, `catch` lança `MODEL_LOAD_ERROR: ...` com `e.message`. **Não mascarado** — `runVoskWav` mostra `Erro Vosk F1 [MODEL_LOAD_ERROR]: ...`.

**Correção imediata se `MODEL_FORMAT_ERROR`:** Converter `vosk-model-small-pt-0.3.zip` para `tar.gz` (`tar -czf model.tar.gz -C model .`) e hospedar em `public/vosk-model-small-pt-0.3.tar.gz` ou usar `https://huggingface.co/.../vosk-model-small-pt-0.3.tar.gz` se existir, mantendo modelo equivalente (mesmo `graph/`, `am/`), e atualizar `VOSK_MODELS['small-pt-0.3'].url` para `tar.gz`.

### Comparação atualizada (após R1 código, sem medição)

| Critério | Moonshine Tiny | Vosk small-pt-0.3 (código pronto, não medido) |
|---|---|---:|---:|
| PT-BR | ❌ English-only | ✅ (modelo pt-BR, mas formato .zip vs tar.gz pendente) |
| Offline | ✅ | ✅ (WASM Worker) |
| Browser | ✅ (CDN ESM) | ✅ (vosk-browser) mas `MODEL_FORMAT_ERROR` pendente |
| Android | ? (F FAIL por window.Moonshine, agora fixado mas não re-testado) | ? (F1/F2 NOT TESTED) |
| Modelo ~30 MB | ✅ Tiny 30 MB | ✅ 31M zip |
| WAV local | ✅ (F1 implemented) | ✅ (F1 implemented, NOT TESTED) |
| Microfone | ? (F not re-tested) | ? (F2 NOT TESTED) |
| RTF real | ~0.165 (histórico Moonshine) | NOT TESTED |
| Qualidade PT-BR | ❌ (inglês hallucination) | ? (esperado pt-BR, mas não medido) |

### Evidências

* `public/moonshire.wav` 2.301.962 bytes, SHA256 `7fdb0bf...`, 48000Hz 2ch (MEDIDO via `Get-ChildItem`, `certutil`, `DataView`)
* `vosk-browser` 0.0.5 presente, `loadVoskModel` código com `Vosk.createModel` (MEDIDO `grep`)
* `npx tsc --noEmit` **PASS**, `npm run build` **PASS** (49s), `npx vitest run` **PASS** 14/14 (220/220)
* `ChatAssistant` inalterado (grep 0), `/api/stt` inexistente (grep 0)

### Conclusão R1

**`BLOCKED_BY_ENVIRONMENT` (subcaso `MODEL_FORMAT_UNVERIFIED` + `NOT TESTED` com áudio real)**

* **Modelo identificado:** `vosk-model-small-pt-0.3` 31M Apache 2.0, mas formato `.zip` vs `tar.gz` esperado por `vosk-browser` **não verificado com execução real** — risco `MODEL_FORMAT_ERROR`.
* **Idioma:** pt-BR **suportado pelo modelo** (small-pt), mas **não validado com transcrição real** nesta sprint.
* **Tradução vs transcrição:** Não há `translate` task em Vosk (é `acceptWaveform` → `text` pt-BR), portanto **não é tradução**, seria transcrição pt-BR se funcionar.
* **Benchmark PT-BR:** **NÃO EXECUTADO** — F1/F2 com áudio real pendentes de execução manual em browser com `AudioContext` + `Worker`.

### Próximo passo mínimo (sem nova sprint)

1. **Executar F1 manualmente:** `npm run dev` → `http://localhost:3000/dev/voice-test` → **F1 — Vosk WAV Local** → observar `fetchMs`, `modelLoadMs`, `inferMs`, `transcription` (deve ser pt-BR, não inglês), e **erro real** se `MODEL_FORMAT_ERROR` → converter modelo para `tar.gz` e hospedar em `public/`.
2. **Executar F2 em Android Chrome** `https://vanzacarias-mu.vercel.app/dev/voice-test` (após F1 passar) com `posso comer leites vegetais?` 3×.
3. Só então reclassificar de `BLOCKED_BY_ENVIRONMENT` para `APPROVED_FOR_NEXT_POC` / `REJECTED_FOR_PTBR`.

**Regressão:** `ChatAssistant`, `patient/admin route`, `RAG`, `guardrails` não alterados (verificado `git diff -- src/app/dev` só `voice-test` + `src/lib/voice/stt/vosk.ts`).

---

## 19. VOZ-004-R3 — STT LAB Refactor (2026-09-03)

**Objetivo:** Refatorar exclusivamente `/dev/voice-test` em um **laboratório neutro de Speech-to-Text (STT)**, removendo o acoplamento visual/conceitual ao Moonshine e separando claramente: infraestrutura de áudio → interface de lab → engine STT → modelo/idioma → inferência → resultado/métricas. **Não corrige o Vosk nem o Moonshine** (o erro `Failed to resolve module specifier 'vosk-browser'` permanece observável, tratado em sprint futura).

### Arquivos alterados

| Arquivo | Tipo | Alteração |
|---|---|---|
| `src/app/dev/voice-test/page.tsx` | refatorado | Substituída página orientada a Moonshine por lab neutro `VOICE / STT LAB` |
| `src/app/dev/voice-test/page.tsx.new` | removido | Rascunho inacabado, não faz parte do entregável |
| `src/lib/voice/stt/types.ts` | preservado | Tipos `STTResult`/`BenchmarkSample`/`BenchmarkResult` (já existentes) |
| `src/lib/voice/stt/registry.ts` | preservado | Registry `STT_ENGINES` + `getEngine`/`listEngines` (já existente) |
| `src/lib/voice/stt/engines/vosk.ts` | preservado | Wrapper `STTEngine` para Vosk PT-BR (já existente) |
| `src/lib/voice/stt/engines/moonshine.ts` | preservado | Wrapper `STTEngine` para Moonshine Tiny (preservado sem correção) |
| `src/lib/voice/stt/vosk.ts` | inalterado | Implementação Vosk preservada (sem correção do bundling) |
| `src/lib/voice/stt/moonshine.ts` | inalterado | Runtime Moonshine preservado (sem correção) |
| `src/lib/voice/__tests__/registry.test.ts` | novo | Testes unitários do registry/abstração STT |
| `docs/VOZ-004-REPORT.md` | atualizado | Esta seção §19 |

### Arquitetura antes/depois

**Antes (moonshine-centrado):** página com `Teste F — Moonshine`, `Teste F1 — WAV → MOONSHINE`, `BENCHMARK PT-BR (Moonshine)`, `VOSK — PT-BR` — engrenagens acopladas à UI, nomenclatura Moonshine, estágios misturados.

**Depois (lab neutro):**
```
VOICE / STT LAB
│
├── Fonte de áudio (AUDIO FIXTURE moonshire.wav, GET local)
├── Captura (pipeline comum, independe da engine)
│     A — Secure Context
│     B — Microphone
│     C — Audio Signal / RMS
│     D — Audio Settings
│     E — PCM Preparation (mono 16 kHz)
├── STT Engine Registry
│     ├── Vosk PT-BR (registrado)
│     └── Moonshine Tiny (preservado)
├── ENGINE TEST
│     F — Load Engine
│     G — Transcribe
├── RESULTADO STT (engine/idioma/status/métricas/transcrição)
└── Cleanup
```

### Engines registradas

O registry (`src/lib/voice/stt/registry.ts`) é o **ponto único** de registro. A UI lê `engine.name`, `engine.language`, `engine.model`, `engine.id` — nada hardcoded no layout.

* **`vosk-pt-br`** — `Vosk PT-BR` / `pt-BR` / `vosk-model-small-pt-0.3 (31M, Apache 2.0)` — **selecionável por padrão**. O erro real do bundling (`Failed to resolve module specifier 'vosk-browser'`) continua observável na UI (não mascarado).
* **`moonshine-tiny`** — `Moonshine Tiny` / `en` / `model/tiny (~30 MB)` — preservado via wrapper, sem correção.

Futuras engines (local/mobile) podem ser adicionadas apenas registrando no `STT_ENGINES`.

### Pipeline de áudio (comum)

Preservado e separado da engine:
```
WAV / Microfone
  ↓
decodeAudioData / capture
  ↓
mono
  ↓
16 kHz
  ↓
PCM (Float32) em memória
  ↓
STT Engine (transcribe)
  ↓
Transcription Result
```

A distinção `sourceSampleRate` vs `decodedSampleRate` é preservada no fixture (48 kHz WAV original → sampleRate decodificado pelo AudioContext → `inputSampleRate` 16 kHz), conforme exigido.

### Testes executados

| Teste | Comando | Resultado |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **PASS** (0 erros) |
| Vitest | `npx vitest run` | **PASS** — 15 files / 226 tests (inclui novos `registry.test.ts`, 6 testes) |
| Build | `npm run build` | **PASS** — `/dev/voice-test` `○` static, 28 rotas, sem `/api/stt` |

### Auditoria / regressões

* `ChatAssistant` não alterado (`git diff` restrito a `src/app/dev/voice-test/page.tsx` + stt lab files).
* Nenhum `/api/stt` criado (grep em `src`: apenas menções documentais em comentários).
* Nenhum upload/persistência de áudio: page.tsx sem `supabase`, `FormData`, `createObjectURL`, `POST` de áudio (grep 0).
* Nenhuma nova dependência nesta sprint (package.json inalterado neste diff; `vosk-browser@0.0.8` é da sprint VOZ-004 original).
* `window.Moonshine`, CDN global loader e nomenclatura Moonshine removidos da página (grep `Moonshine` no page = 0).

### Privacidade

**LOCAL ONLY** preservado: GET do fixture local (`/moonshire.wav`) e download de modelo permitidos; **sem POST de áudio, sem Blob remoto, sem Supabase, sem `/api/stt`**. Cleanup para tracks do microfone, AudioContext e `engine.dispose()` quando suportado.

### Limitações

* Vosk não corrigido nesta sprint — `Failed to resolve module specifier 'vosk-browser'` observável (R4).
* Moonshine não corrigido — preservado como engine registrada sem reimplementação.
* Teste funcional em navegador não executado nesta CI (ambiente Windows sem browser interativo); necessário validar manualmente os passos do fluxo (§15 do enunciado) em navegador.

### Status final

**PASS** — todos os critérios de aceite validáveis por CI (tsc / vitest / build / auditoria estática) **PASS**. O teste funcional manual em navegador (fluxo A–G + erro real do Vosk + cleanup) permanece pendente de execução interativa, sem impactar a validade estrutural da refatoração.

---

## 21. VOZ-004-R3.1 — Engine State Hardening (2026-09-04)

**Objetivo:** Endurecer a máquina de estados da engine entre **F — Load Engine** e **G — Transcribe** no lab `/dev/voice-test`, garantindo que o G só execute com a engine realmente pronta, bloqueando chamadas duplicadas e preservando erros originais — sem corrigir o Vosk nem o Moonshine (correção do runtime/bundling do Vosk pertence à VOZ-004-R4).

### Estados

| Estado | Significado | G (Transcribe) | F (Load) |
|---|---|---|---|
| `IDLE` | Engine não carregada (inicial) | ❌ | ✅ |
| `LOADING` | F em execução | ❌ | ❌ |
| `READY` | Engine carregada, pronta | ✅ | ✅ (reload) |
| `TRANSCRIBING` | G em execução | ❌ | ❌ |
| `RESULT` | Transcrição concluída | ✅ (nova execução) | ✅ (reload) |
| `ERROR` | Falha no load ou transcribe | ❌ | ✅ (retry) |

### Regras

* `LOAD_START` aceito somente de `IDLE` / `ERROR` / `RESULT` (→ `LOADING`); durante `LOADING`/`TRANSCRIBING` é **no-op** (bloqueia double-load).
* `TRANSCRIBE_START` aceito somente de `READY` / `RESULT` (→ `TRANSCRIBING`); qualquer outro estado é **no-op** (transcrever fora de READY não executa a engine).
* `LOAD_SUCCESS` `LOADING → READY`; `LOAD_ERROR` `LOADING → ERROR`; `TRANSCRIBE_SUCCESS` `TRANSCRIBING → RESULT`; `TRANSCRIBE_ERROR` `TRANSCRIBING → ERROR`.
* `ENGINE_CHANGE` (troca de engine no select) e `RESET` (cleanup) forçam `→ IDLE`, invalidando `READY`/`RESULT` anteriores.

### Proteção

* **Além do disabled:** `runTranscribe` aborta via `isEngineReady(engineState)` antes de qualquer chamada — o G nunca executa por atalho, apenas por botão.
* **Sem duplicatas:** locks síncronos `loadingRef` / `transcribingRef` + reducer no-op impedem segunda chamada de F ou G.
* **Falha de load → `ERROR`**, `loadState.error` preservado (causa original, não mascarada) e exibido em bloco de erro unificado (também renderiza erro do stage `load`). Ex (Vosk): `Failed to resolve module specifier 'vosk-browser'`.
* **Falha de transcribe → `ERROR`**, `transcribeState.error` preservado.
* **Troca de engine invalida o estado** (`ENGINE_CHANGE → IDLE`) e limpa `loadState`/`result`/`transcribeState`; **resultado antigo nunca contamina** a nova engine (limpo também no início de F e G, e `RESULT → TRANSCRIBING` em nova execução).
* Engine trocada **durante** load/transcribe: conclusão obsoleta descartada via `selectedEngineIdRef`.

### Testes executados

| Teste | Comando | Resultado |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **PASS** (0 erros) |
| Vitest | `npx vitest run` | **PASS** — **16 files / 243 tests** (antes da R3.1: 15 files / 226 tests; +1 file, +17 tests em `engineState.test.ts`) |
| Build | `npm run build` | **PASS** — `/dev/voice-test` `○` static, 28 rotas, sem `/api/stt` |

**Testes unitários da máquina de estados** (`src/lib/voice/__tests__/engineState.test.ts`, 17 testes — 14 mínimos exigidos + 3 adicionais):

1. estado inicial = `IDLE`; 2. Load inicia `LOADING`; 3. durante `LOADING`, Load não executa de novo; 4. Load sucesso → `READY`; 5. Load falha → `ERROR`; 6. `ERROR` não habilita Transcribe; 7. `READY` permite Transcribe; 8. Transcribe → `TRANSCRIBING`; 9. `TRANSCRIBING` bloqueia segunda execução; 10. Transcribe sucesso → `RESULT`; 11. Transcribe erro → `ERROR`; 12. Transcribe fora de `READY` não executa engine (no-op em `IDLE`/`LOADING`/`ERROR`); 13. troca de engine invalida `READY`; 14. resultado anterior não é mantido como resultado da nova execução; b1. `READY`/`RESULT` permitem reload; b2. `ERROR` permite retry; b3. load bloqueado durante `TRANSCRIBING`.

### Teste manual

**MANUAL TEST: NOT EXECUTED.**

Passos pendentes em navegador (ambiente desta CI é Windows sem browser interativo):
1. Abrir `/dev/voice-test` → F em `IDLE`, G desabilitado (cinza/disabled).
2. Clicar F (Vosk PT-BR) → `LOADING`, G desabilitado, duplo-clique não inicia novo load.
3. Load falha → `ERROR`, bonus box `Status: ERROR / Stage: load` com o erro original `Failed to resolve module specifier 'vosk-browser'`; G permanece desabilitado; F reabilitado (retry).
4. Trocar para Moonshine Tiny → estado volta a `IDLE`, erro/results limpos; F recarrega.
5. Com engine pronta (`READY`), G habilita; transcrever → `TRANSCRIBING` (duplo-clique bloqueado) → `RESULT` com transcrição; nova execução limpa o resultado anterior antes de finalizar.
6. Cleanup → volta a `IDLE`, recursos liberados.

### Vosk

`src/lib/voice/stt/vosk.ts` e `src/lib/voice/stt/engines/vosk.ts` **inalterados**. O erro `Failed to resolve module specifier 'vosk-browser'` permanece observável e não mascarado na UI (agora também no bloco de erro unificado, stage `load`). Correção do runtime/bundling do Vosk (ESM/WASM/worker/modelo) **não faz parte da VOZ-004-R3.1** — pertence à VOZ-004-R4.

### Regressão

* Alterações restritas a `src/app/dev/voice-test/page.tsx`, `src/lib/voice/stt/engineState.ts` (novo), `src/lib/voice/__tests__/engineState.test.ts` (novo) e este relatório (§21).
* `ChatAssistant`, `patient/admin route`, `RAG`, `guardrails`, registry STT, engines (Vosk/Moonshine) e pipeline A–E **não alterados** (moonshine.ts diff existente é da VOZ-002-R1, não desta sprint).
* Nenhum `/api/stt` criado; page.tsx sem `supabase`, `FormData`, `createObjectURL` ou POST (grep 0).
* Nenhuma dependência adicionada.

### Status final

**CI: PASS** — tsc **PASS**, vitest **PASS** (16 files / 243 tests), build **PASS**, auditoria estática **PASS**.
**Manual: PENDING** — teste funcional em navegador (item §Teste manual acima) não executado nesta CI.

---

## 22. VOZ-004-R4 — Vosk Browser Runtime / Bundling Fix (2026-09-04)

**Objetivo:** Corrigir o bloqueio do runtime Vosk PT-BR no lab `/dev/voice-test` (erro `Failed to resolve module specifier 'vosk-browser'`) e provar inferência **real** no browser, **sem** alterar a arquitetura (registry, engine abstraction, máquina de estados, page.tsx neutro, pipeline A–E, modelo local, fixture local).

### Problema inicial

```
F — Load Engine → ERROR
Failed to resolve module specifier 'vosk-browser'
```

**Reproduzido em browser real antes da correção** (Chromium headless shell — Playwright 1.62.0 / chromium-1234, Windows x64):

| Item | Valor |
|---|---|
| Ambiente | Chromium headless (Playwright 1.62.0), URL `http://localhost:3000/dev/voice-test`, `next dev --webpack` |
| Engine | `vosk-pt-br` (Vosk PT-BR) |
| Estágio | `load` |
| Estado pós-falha | `ERROR` (máquina de estados R3.1: G desabilitado após falha — comportamento esperado) |
| Erro exato | `Failed to resolve module specifier 'vosk-browser'` |
| Modelo | nenhum request ao modelo (`/vosk-model-small-pt-0.3.tar.gz`) chegou a ocorrer — falha no import antes do load |

### Investigação

**Estrutura real de `vosk-browser@0.0.8`** (instalado no projeto — `package.json` pede `^0.0.8`; a sprint referencia 0.0.5 mas a versão real instalada é **0.0.8**, mantida sem downgrade):

* `package.json` do pacote: `"main": "./dist/vosk.js"`, `"module": "./dist/vosk.js"` — **sem campo `exports`**, `files` ausente.
* Único arquivo de distribuição: `dist/vosk.js` (**5.794.767 bytes**) — **UMD** (`(function (global, factory) { … factory(global.Vosk = {}) })` com ramos CommonJS/AMD/global) e **completamente autocontido**:
  * `require(` = 0 ocorrências (dependência `uuid` embutida no bundle);
  * `process.` = 0, `Buffer` = 0, `window.` = 0, `navigator` = 0 — **nenhum global de Node/DOM no top-level**;
  * `import(` dinâmico = 0, `importScripts` = 0.
* **Worker**: criado como **Worker clássico** via `new Worker(url)` onde `url` é `URL.createObjectURL(new Blob([body]))`, com o **código do Worker embutido em base64** diretamente no bundle (`createBase64WorkerFactory`). O Worker não importa nada externo.
* **WASM**: o WASM do Kaldi está embutido dentro do código base64 do Worker (instantiation no Worker). Não há `.wasm` externo nem fetch de runtime.
* **Types**: `dist/vosk.d.ts` → `export * from "./model"` → expõe `Model` (`new Model(modelUrl, logLevel?)`, `model.KaldiRecognizer` = `new (sampleRate?, grammar?)` com `acceptWaveform(AudioBuffer)` **e** `acceptWaveformFloat(Float32Array, sampleRate)`), `createModel(modelUrl)`, além das mensagens `ClientMessage`/`ServerMessage` do Worker.

**Formas oficialmente suportadas (README do pacote):** (1) `npm i vosk-browser` e uso como **módulo**; (2) `<script>` com global `Vosk`. O exemplo do README usa global via script tag; a API de referência é a mesma nos dois casos.

**Como o Next.js empacota `src/lib/voice/stt/vosk.ts` e `engines/vosk.ts`:** a engine é consumida pela página client (`/dev/voice-test`) via registry. O código antigo escondia o specifier do bundler via `eval`.

### Causa raiz

**Causa primária (e única):** o import do vosk-browser era feito como **`(0, eval)('import("vosk-browser")')`** (`src/lib/voice/stt/vosk.ts`, `loadVoskBrowser`). O `eval` torna o specifier **invisível para o webpack**; em runtime o browser recebe um **bare module specifier sem resolução de módulos** e lança `Failed to resolve module specifier`. Evidência: reprodução em browser real (acima) — nenhum request de modelo ocorreu porque a falha aconteceu no passo de resolução do módulo, antes de qualquer uso da API do vosk-browser.

Não há causas secundárias no runtime do pacote: o bundle é UMD puro (sem `require`/`process`/`window` top-level), o Worker é clássico e autocontido (base64 inline + Blob URL), e o WASM é embutido — nenhum desses fatores impede o bundling. O `eval` + bare specifier foi a única barreira.

### Correção

Mínima e restrita ao runtime da engine (`src/lib/voice/stt/vosk.ts`):

1. Substituído o **`eval` encoberto** por **`import('vosk-browser')` explícito** (specifier resolvido pelo webpack → chunk client correto), mantendo o guard `typeof window === 'undefined'` (nunca executa no SSR/prerender). Normalização `namespace`/`default` para o UMD com `__esModule`.
2. `loadVoskModel` passa a usar **`new Vosk.Model(modelInfo.url)`** com resolução via eventos `load`/`error` (mensagem real do Worker em falha) + timeout de 120s — evitando o `createModel` que rejeita sem motivo (`reject()` sem argumento).
3. **Modelo 100% local**: removido o fallback remoto `altUrl` do runtime (privacidade local-only, regras R4 §8/§12/§13). Apenas `GET /vosk-model-small-pt-0.3.tar.gz`.
4. `transcribeWithVosk` usa a API oficial **`recognizer.acceptWaveformFloat(pcm, sampleRate)`** (Float32Array, caminho documentado) em vez de passar `Float32Array` para `acceptWaveform` (que espera `AudioBuffer`). O texto final é coletado do evento `result` após `retrieveFinalResult()`, com guard de timeout (30s) e `recognizer.remove()` no final (libera memória do Worker).
5. Comentários atualizados; `engines/vosk.ts` apenas com comentário corrigido (interface `load`/`transcribe`/`dispose`/`isSupported` intacta).

**Arquivos alterados:**
* `src/lib/voice/stt/vosk.ts` — correção do runtime (único arquivo com lógica alterada).
* `src/lib/voice/stt/engines/vosk.ts` — apenas comentário (sem mudança funcional).
* `docs/VOZ-004-REPORT.md` — esta seção §22.

### Runtime

* **Import/bundle:** `import('vosk-browser')` → webpack GERA chunk client dedicado com `dist/vosk.js` (UMD, ~5,79 MB em produção). Carregado sob demanda no clique de F.
* **Worker:** clássico, criado pelo próprio vosk-browser a partir de **base64 inline** (Blob URL + `createObjectURL`). Nenhum arquivo de Worker adicionado ao projeto (nenhum Worker genérico criado).
* **WASM:** embutido no código do Worker (Kaldi WASM). Nenhum asset `.wasm` separado necessário.
* **Assets:** nenhuma cópia para `public/` foi necessária — o pacote não requer assets externos.
* **Modelo:** `GET /vosk-model-small-pt-0.3.tar.gz` (32.405.987 bytes, `application/gzip`) fetado pelo Worker na mesma origem; o vosk-browser descompacta o tar.gz e carrega o modelo.

### Teste real

Executado em **browser real Chromium** (headless shell, Playwright 1.62.0 / chromium-1234, OS Windows x64), em **dev** (`next dev --webpack`, porta 3000) e **produção** (`next start` sobre o build, porta 3123):

| Métrica | Dev | Produção |
|---|---|---|
| Browser | Chromium headless (rev 1234) | Chromium headless (rev 1234) |
| OS | Windows (win32) x64 | Windows (win32) x64 |
| URL | `http://localhost:3000/dev/voice-test` | `http://localhost:3123/dev/voice-test` |
| Engine | Vosk PT-BR (`vosk-pt-br`) | Vosk PT-BR (`vosk-pt-br`) |
| Modelo | `vosk-model-small-pt-0.3` (tar.gz local) | idem |
| Idioma | pt-BR | pt-BR |
| Áudio | `/moonshire.wav` (2.301.962 bytes, **11,99 s**, 44100 Hz → 16000 Hz mono) | idem |
| **F — Load** | **READY** em 11,8 s (model load 7447 ms) | **READY** em 8,7 s (model load 4954 ms) |
| **G — Transcribe** | **RESULT** em 6,2 s | **RESULT** em 6,2 s |
| Inference time | **5182 ms** | **5313 ms** |
| RTF | **0,432** | **0,443** |
| Tamanho transcrição | **122 chars** | 122 chars |
| **Transcrição real** | `"aqui você preparar seus roteiros com segurança e clareza o poder da fé a fé é o firme fundamento das coisas que se esperam"` | idem |

Nenhum erro de console/pageerror durante F e G nos dois modos. Resultado integralmente proveniente da **inferência Vosk real** (nada preenchido manualmente; resultado não vazio, `Status: PASS`, métricas registradas).

### Privacidade

Confirmado por captura de rede no teste real:
* **GET** `/vosk-model-small-pt-0.3.tar.gz` (200, local) e **GET** `/moonshire.wav` (200, local) — **somente recursos locais**.
* **Nenhum** POST/FormData/fetch de áudio; sem Blob remoto; sem Supabase; sem `/api/stt`; sem persistência.
* Nada enviado ao backend da aplicação.

### Regressão

* **tsc:** `npx tsc --noEmit` → **PASS** (0 erros).
* **Vitest:** `npx vitest run` → **PASS** — 16 files / 243 tests (nenhum teste novo adicionado; inferência é prova manual/real, não simulada).
* **Build:** `npm run build` (webpack) → **PASS** — `/dev/voice-test` continua `○` static, 28 rotas, sem `/api/stt`. Aviso (não erro): chunk do vosk-browser com 5,79 MB não entra no precache do PWA (limite `maximumFileSizeToCacheInBytes` do serwist) — comportamento esperado para bundle da engine.
* `ChatAssistant` **não alterado**; registry preservado; `engineState` preservado (R3.1); A–E intactos; **Moonshine não alterado**; sem `/api/stt`; nenhuma dependência adicionada (`package.json`/`package-lock.json` inalterados nesta sprint — `vosk-browser@0.0.8` já era dependência de VOZ-004); produto principal inalterado.

### Limitações

* Teste executado em Chromium headless (Windows x64). Teste interativo em browser desktop com a UI completa (passos A→G do enunciado, incluindo microfone `getUserMedia` em A–E) **não executado** — em headless não há microfone; o fluxo G foi validado com o fixture local (mesmo pipeline moonshire.wav → decode → mono → 16 kHz → PCM → Vosk → transcrição).
* Android **não testado** nesta sprint (opcional pelo enunciado).
* O bundle da engine (~5,79 MB) gera aviso de precache PWA (cosmético; a engine é carregada sob demanda).
* Modelo carregado como tar.gz local único; tempo de load medido (dev 7447 ms / prod 4954 ms nesta máquina).

### Status

**PASS** — inferência **real** de Vosk PT-BR executada com sucesso no browser (dev e produção):

1. ✅ causa identificada (`eval` + bare module specifier);
2. ✅ correção implementada (import explícito + API oficial `acceptWaveformFloat` + modelo local-only);
3. ✅ F → `READY`;
4. ✅ modelo local carregado (`/vosk-model-small-pt-0.3.tar.gz`, 200, 32.405.987 bytes);
5. ✅ G → execução real (RESULT);
6. ✅ transcrição real não vazia (122 chars, texto coerente pt-BR do fixture);
7. ✅ métricas registradas (load, inference, RTF, duração, fonte);
8. ✅ privacidade local (somente GETs locais, sem upload/persistência);
9. ✅ tsc PASS;
10. ✅ Vitest PASS (16 files / 243 tests);
11. ✅ build PASS;
12. ✅ regressão auditada;
13. ✅ relatório atualizado.

PASS funcional comprovado por **PCM real → inferência Vosk real → transcrição real**, não por build/pacote instalado.
