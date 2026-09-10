# TTS-RESET-002 — Auditoria Completa da Integração TTS no VanzacariasNutri

> **Data:** 2026-09-10 · **Diretório:** `C:\Users\joelg\Documents\Vanusa\vanzacariasnutri`
> **Regra:** NÃO ALTERAR NADA — somente leitura. Laboratório em `../voice-synthesis` não tocado.
> **Classificação:** `CONFIRMADO — execução real` | `CONFIRMADO — código` | `CONFIRMADO — teste automatizado` | `HIPÓTESE` | `NÃO VALIDADO`

---

## 1. Resumo executivo

A integração TTS no `vanzacariasnutri` é **tecnicamente distinta** dos laboratórios que a originaram e **não reproduz** o fluxo validado em `_tts-cap-poc`. Três famílias de falhas foram mapeadas:

| Família | Causa confirmada | Impacto |
|---------|------------------|---------|
| **AUDIO (silêncio pós-resposta)** | `AudioContext` criado fora de gesto → `suspended`, `resume()` ignorado (`catch{}`), `source.start()` no silêncio | Silêncio no autoplay, orchestrator preso em `PLAYING`, sem `onended` — `CONFIRMADO — execução real` Chromium + teste (PROD-AUDIT-001) — **corrigido** em `6d5df07` (FIX-001) |
| **MEMÓRIA (app fecha 3/3)** | Download 92 MB → `Uint8Array` + `encodeBase64` ≈123 MB string + cópia Filesystem bridge → alocação única `150994952 B ≈144 MB` sobre heap já 335 MB, `growth limit 402653184` → `OutOfMemoryError` via `WebMessageListenerAdapter` | App crash **antes** de síntese/playback, toda vez que cache ausente (primeiro uso pós-reinstalação) — `CONFIRMADO — execução real` RMX3461 (`TTS-PROD-FIX-001-ANDROID-E2E-OOM-EVIDENCE.md:32`) — **não corrigido** |
| **ARQUITETURA (produto ≠ lab)** | `capacitor.config.ts` aponta `server.url https://vanzacarias-mu.vercel.app` (WebView remota, não `www` local); `ModelManager` baixa para `Filesystem Directory.Data` com base64; Worker **ainda** refetcha via rede; APK 153 MB inclui `public/downloads/*.apk` (38 MB) + `vosk tar 51 MB` | Fluxo real é `fetch→Uint8Array→SHA→base64→Filesystem.writeFile→readFile→base64→decode→Worker fetch novamente` — 4-5 cópias vs 1 do lab | Diferença aumenta pico 144 MB e impede offline puro como PoC |

**Veredito arquitetural:** a integração atual **não deve ser corrigida incrementalmente** apenas com patches locais; o gargalo é **estrutural** (cópia base64 do bridge Capacitor para 92 MB). Recomendação: **C — remover o ModelManager/CapacitorStorage atual e reintegrar** via entrega sem cópia base64 (chunked/streaming ou PAD/`public/assets` local) + manter o fix de áudio já entregue. Detalhe no §20-21.

---

## 2. Arquitetura atual

```
next.config.ts  ── withSerwist(sw.ts), alias onnxruntime-node→empty.ts (client), serverExternalPackages ["onnxruntime-node"]
public/tts/worker.js  ← scripts/build-tts-worker.mjs (esbuild worker.ts, extern-wasm)
public/assets/tts/{worker.js,wav/ort-wasm-*}  ← scripts/prepare-tts-android-assets.mjs (somente runtime, sem modelo desde FASE 3)
src/app/api/tts/[...path]/route.ts  ← nodejs, serve public/tts-assets/models (Vercel) ou fallback ../voice-synthesis/models/kokoro (dev)
capacitor.config.ts  ← appId br.com.vanusazacarias.nutri, webDir public, server.url https://vanzacarias-mu.vercel.app, androidScheme https
android/  ← Gradle 8, Capacitor 8.5.1, plugin @capacitor/filesystem 8.1.3, splash+MainActivity (singleTask)

src/lib/tts/
  types.ts              TtsService, AudioResult, TtsBrowserRuntimeOptions
  core/{errors,kokoro,kokoro-pipeline,vozz-g2p}.ts  — vendado de voice-synthesis (Apache-2.0)
  wav.ts                encodeWav/concatSamples
  runtime/browser/{index,worker,asset-loader,types}.ts — vendado (BrowserWorker, KokoroBrowserRuntime)
  model/{manifest,config,errors,download,storage,capacitorStorage,modelManager}.ts — CAP-004 FASE 2-4
  pwa/modelCache.ts     CacheFirst sw para /api/tts/models/*, /api/tts/wasm/*, /tts/worker.js (v1)
  synthesizer.ts        createTtsService (adapter consumer, ModelManager+BrowserRuntime)
  player.ts             createAudioPlayer (AudioContext+BufferSource, FIX-001 unlock)
  orchestrator.ts       createTtsOrchestrator (speak/pause/resume/replay/unlock, gen anti-race)
  chatTtsController.ts  createChatTtsController (noteResponse/invalidate/toggle/unlock)
  useChatTts.ts         hook React (lazy orchestrator, useSyncExternalStore)
  speakable.ts          buildSpeakable (Markdown→texto falável, gate 4 palavras)
  preference.ts         localStorage tts_enabled:userId
  __tests__/            10 suítes (603 testes)
src/lib/voice/          Vosk STT (vosk-browser) — isolado, não tocado
src/components/ChatAssistant.tsx — ChatAssistant (client, useChatTts, noteResponse/invalidate/unlock nos gestos)
src/sw.ts               Serwist: Vosk CacheFirst + TTS CacheFirst (ANTES do defaultCache)
```

**Dependências:** `package.json:17-21` `@capacitor/* 8.5.1`, `@capacitor/filesystem 8.1.3`, `@pedrobef/vozz 0.2.7`, `onnxruntime-web 1.29.0`, `serwist 9.5.7`. Sem `onnxruntime-node` em runtime (stub).

---

## 3. Fluxo real (confirmado pelo código)

```
usuário (tap Enviar / toggle TTS)
  ↓ gesto capturado em ChatAssistant.tsx:408 noteResponse→invalidate() + unlock() [FIX-001 gesto A/B]
  ↓ ChatAssistant useChatPatient.runExchange:408-413 / useChatAdmin.handleSend:479
Chat (Next.js, streaming NDJSON /api/nutri-assistant/patient)
  ↓ await reader.read() → frame t:chunk/done → finalReply
  ↓ tts.noteResponse(finalReply)  chatTtsController.ts:206
     → buildSpeakable.ts:176 gate ≥4 palavras → eligible?
     → speakPrepared(text) → orchestrator.speak(text)
ChatTtsController  chatTtsController.ts:192 speakPrepared → ensureOrch() lazyCreateOrchestrator()
  ↓ useChatTts.ts:25 lazyCreateOrchestrator: Promise.all(import synthesizer, player, orchestrator)
Orchestrator  orchestrator.ts:205 speak(text)
  ↓ player.stop() anterior; gen++ anti-race
  ↓ if tts.getState UNINITIALIZED|DISPOSED → setState LOADING → await tts.load()
TtsService  synthesizer.ts:135 load()
  ↓ isSupported() browser? Worker+WASM? (false se SSR)
  ↓ modelManager.ensureAvailable()  modelManager.ts:102
     → storage.isAvailable(manifest) → CapacitorModelStorage.has() → Filesystem.stat tts-model/v1/{model,tokenizer,voice} em Directory.Data
     → se false: downloadAll() sequencial  modelManager.ts:87
        → downloadAsset()  download.ts:59 fetch(resolveAssetUrl(origin,path)) onde origin = getTtsModelOrigin() → NEXT_PUBLIC_TTS_ASSETS_ORIGIN || DEFAULT https://raw.githubusercontent.com/Joelgonn/vanzacarias/tts-assets-v1/
        → res.arrayBuffer() → Uint8Array 92MB  download.ts:85
        → verifyAsset() bytes===92361116 && sha256Hex===fbae9257…  download.ts:32
     → storage.put(path,version,data)  storage.ts:73 ou capacitorStorage.ts:99
        → encodeBase64(data)  capacitorStorage.ts:18 Buffer→base64 ≈123MB string
        → Filesystem.writeFile({path:"tts-model/v1/...", directory:Directory.Data, data:b64, recursive:true})
     → verify() pós-persistência (read + SHA)
  ↓ mod = await import("./runtime/browser/index")  synthesizer.ts:173 lazy
  ↓ native = detectNativeCapacitor()  synthesizer.ts:175 via window.Capacitor
  ↓ effectiveBaseUrl = browser.baseUrl ?? managerOrigin/ ?? native? https://localhost/assets/tts/ : https://origin/api/tts/models/
     wasmPaths = /assets/tts/wasm/ ou /api/tts/wasm/  synthesizer.ts:179-188
  ↓ runtime = new KokoroBrowserRuntime({model:"q8", voice:"pf_dora", baseUrl, wasmPaths, workerUrl, workerFactory})
     → assetUrls: baseUrl + model_quantized.onnx / tokenizer.json / voices/pf_dora.bin
     → worker = new Worker(workerUrl, {type:"module"})  runtime/browser/index.ts:220 (default /tts/worker.js)
     → worker.postMessage({kind:"init", payload:{model,voice,assetUrls,wasmPaths,numThreads}})
Worker  runtime/browser/worker.ts:57 init(payload)
  ↓ loader.fetchBytes(modelUrl) + fetchText(tokenizerUrl) + fetchBytes(voiceUrl)  Promise.all  worker.ts:67
     → fetch(resolved) → arrayBuffer() → Uint8Array (segundo download, mesmo origin)
  ↓ styleRows = Float32Array(voiceBytes.buffer)  worker.ts:79
  ↓ vocab = parseKokoroTokenizer(tokenizerText) 115 tokens
  ↓ session = ort.InferenceSession.create(modelBytes, {executionProviders:["wasm"], graphOptimizationLevel:"all"})
  ↓ post({kind:"ready", payload:{info, ortVersion, downloadedBytes, threads, simd, cores}})
Orchestrator resume:  setState SYNTHESIZING → await tts.synthesize(trimmed)  synthesizer.ts:253
  ↓ KokoroBrowserRuntime.synthesize → enqueue FIFO synthTail → worker.postMessage({kind:"synth", payload:{text,speed:1}})
Worker synth  worker.ts:93
  ↓ vozzPhonemize(text, {normalizar:true}) → preNormalizarKcal + vozz/normalize + fonemizar
  ↓ synthesizeKokoroPipeline({text, phonemes, vocab, styleRows, speed, runChunk:{session.run}})
     → chunkPhonemes ≤510 → tokenize → buildKokoroChunkInputs → ort.Tensor input_ids/style/speed → session.run → waveform
  ↓ concatSamples(gap 0.12) → encodeWav → {audio Float32 24kHz, wav Uint8Array PCM16, durationSec, phonemes, ortMs}
  ↓ post({kind:"synth-result", payload:result}, [audio.buffer, wav.buffer]) transfer list
Main thread  synthesizer.ts:220 samples = res.audio ?? res.samples → AudioResult {samples,sampleRate 24000,channels 1,durationSec,wav,text}
Orchestrator  orchestrator.ts:270 setState PLAYING → await player.play(audio)
Player  player.ts:183 play(audio)
  ↓ stop() anterior; getContext() lazy AudioContext; resolveUnlocked() → if running ok else resume() await ctx.resume()
     → se !ok: throw unlockError → orchestrator ERROR (FIX-001)
     → buffer = ctx.createBuffer(1, samples.length, 24000); buffer.copyToChannel(samples,0)
     → source = ctx.createBufferSource(); source.buffer=buffer; source.connect(destination); source.onended→finishSession(); source.start(0,offset)
  ↓ promise aguarda onended
  ↓ orchestrator setState ENDED
 saida física: speaker via Web Audio (ou AudioTrack se fluxo nativo futuro)
```

**Diferença para o diagrama ideal do enunciado:** o produto tem um estágio extra `model manager / download / Filesystem base64` **antes** de `Worker`, e o Worker **refetcha** os mesmos assets (double-fetch).

---

## 4. Comparação com laboratório `voice-synthesis`

| Componente | `voice-synthesis` Lab | `vanzacariasnutri` Produto | Veredito |
|------------|------------------------|-----------------------------|----------|
| runtime Node | `onnxruntime-node` 1.29.0 real (KokoroVozzRuntime) | stub `src/lib/tts/stubs/empty.ts` via `next.config.ts:49` alias, `synthesizer.ts:150` lança `NOT_SUPPORTED` | **Diferente — produto remove Node** (`CONFIRMADO — código`) |
| runtime Browser | `src/runtime/browser/*` identico (vendado) | `src/lib/tts/runtime/browser/*` cópia vendada (mesmo `core/*`, `wav.ts`, `asset-loader`, `worker.ts:14` `onnxruntime-web`) | **Igual** (vendado, sem `file:../voice-synthesis`) (`CONFIRMADO — código`) |
| core vozz | `src/core/vozz-g2p.ts` preNormalizarKcal | idem `src/lib/tts/core/vozz-g2p.ts` | Igual |
| wav | `src/wav.ts` | `src/lib/tts/wav.ts` clone | Igual |
| Worker bundle | `models/kokoro/*.onnx` lidos via `readFile` Node / `fetch` no worker | `public/tts/worker.js` gerado por `scripts/build-tts-worker.mjs` (esbuild extern-wasm) | **Igual lógica, diferente build** |
| Storage | `models/` FS (Node) / `www/assets/tts/` bundled (PoC) | `ModelManager` + `CacheStorage` (`https://tts-model.local/v1/...`) + `CapacitorModelStorage` (`Directory.Data` + base64) — `storage.ts:39` / `capacitorStorage.ts:99` | **Diferente — produto adiciona persistência cross-session** |
| Download | `scripts/download-kokoro.mjs` pré-build (CI) | `download.ts:59` fetch runtime + `verifyAsset` SHA/size, singleflight, abort — `modelManager.ts:87` | **Diferente — produto baixa em runtime** |
| Bridge | sem Filesystem | `Filesystem.writeFile/readFile` base64 via `WebMessageListenerAdapter` | **Diferente — novo gargalo OOM** |
| Player | sem player | `player.ts:44` AudioContext + BufferSource + unlock FIX-001 | Diferente (produto adiciona) |
| API | `load/synthesize/dispose` | mesma, mas `isSupported()` produto só browser | Diferença menor |

**O que preservou comportamento:** pipeline `vozz→tokenizer→ORT→WAV` idêntico, 115 tokens, pf_dora, q8 92MB SHA `fbae9257…`.

**O que não preservou:** entrega de assets (produto exige 92MB via bridge base64 vs lab FS/bundle). `CONFIRMADO — código`.

---

## 5. Comparação com PoC Android `_tts-cap-poc`

| Aspecto | `_tts-cap-poc` (prova que funcionou) | `vanzacariasnutri` produto | Diferença |
|---------|--------------------------------------|-----------------------------|-----------|
| `capacitor.config` | `webDir www`, sem `server.url`, `androidScheme https` — WebView **local** `https://localhost` serve `www/assets/tts/*` | `webDir public`, **`server.url https://vanzacarias-mu.vercel.app`** — WebView **remota** (live update) | Produto não serve assets locais; depende de rede+Vercel |
| Modelo | bundled `www/assets/tts/model_quantized.onnx` 92MB no APK — offline 100%, 12/12 sínteses RMX3461 OK (result-poc.json) | **fora do APK** desde FASE 3 (`prepare-tts-android-assets.mjs` remove modelo) → baixado via `ModelManager` + `CapacitorStorage` | PoC prova que bundling funciona offline; produto removeu e introduziu OOM |
| Worker assets | `BrowserAssetLoader` fetch `https://localhost/assets/tts/*` (local, 0 cópia base64) | `Worker` fetch `https://raw.githubusercontent.com/.../tts-assets-v1/model_quantized.onnx` (remoto, + base64 Filesystem) | Produto adiciona rede + base64 |
| Storage | nenhum (tudo no APK) | `Directory.Data/tts-model/v1/` + `CacheStorage tts-assets-v1` | Novo |
| Reprodução | `AudioContext` simples (prova 2.4-8.9s) | mesmo, mas com FIX-001 unlock gesto | Melhor no produto |
| Teste físico | 12 sínteses RMX3461 físico OK | 0/3 E2E OK pós-FIX-001 (app fecha antes de síntese) | Regressão |

Conclusão: o PoC que funcionou **não** usou download nem Filesystem; o produto que falha **usa**.

---

## 6. Histórico da integração (git)

```
e90eb34 feat: add Android Capacitor app (config remota, webDir public, sem TTS)
2282fda feat: extract engine and clean up voice laboratory
b055937 2026-09-09 13:20 feat: TTS-CAP-004 FASE 3/4 — modelo fora do APK, CapacitorStorage Directory.Data, origin GitHub raw (32 arquivos, +2888 linhas) — vendagem runtime, ModelManager, manifest v1, download+SHA, storage tríplice, prepare-tts-android-assets remove modelo do APK
db2494a 2026-09-09 14:05 feat(tts): release on-demand Android TTS (docs gate)
f19dcf3 docs: production gate
6d5df07 2026-09-09 15:05 fix(tts): desbloquear AudioContext no gesto antes do autoplay (TTS-PROD-FIX-001) — 9 arquivos, +465 linhas (player/orchestrator/controller/useChatTts/ChatAssistant + testes FIX-P/O/C + mockAudioContext)
```

Entre `b055937` e `6d5df07`, `docs/TTS-CAP-004-FASE-3-REPORT.md:277` já documenta `origin` vazio → 404 em produção (bloqueio externo). `6d5df07` corrige apenas áudio, não memória. `CONFIRMADO — git log` + `git show --stat`.

---

## 7. Investigação do modelo

* **Modelo:** `model_quantized.onnx` 92_361_116 B SHA `fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478` + `tokenizer.json` 3497 SHA `77a02c8e…` + `voices/pf_dora.bin` 522240 SHA `3da7b5b2…` — `model/manifest.ts:32`. `CONFIRMADO — código`.
* **Origem:** `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` → `src/lib/tts/model/config.ts:22` default `https://raw.githubusercontent.com/Joelgonn/vanzacarias/tts-assets-v1/` (Fase 4). `.env.local:23` define exatamente isso. Antes (FASE 3, `.vercel` sem env) origin vazio → same-origin `https://vanzacarias-mu.vercel.app/api/tts/models/` → 404 (pois `public/tts-assets/models` vazio). `CONFIRMADO — código + env`.
* **Fluxo real no produto:**
```
origin (GitHub raw) → downloadAsset fetch(url, {signal}) → res.arrayBuffer() → Uint8Array 92MB (1ª cópia JS)
 → verifyAsset bytes+SHA → ModelManager.downloadAll sequencial  manifest.model→tokenizer→voice
 → storage.put → CapacitorModelStorage.put → encodeBase64(Uint8Array) → string base64 ≈123MB (2ª cópia, 4/3×) → Filesystem.writeFile(..., {data:b64, directory:Data})
 → Worker init → loader.fetchBytes(modelUrl) → fetch(origin/model_quantized.onnx) novamente → ArrayBuffer → Uint8Array (3ª cópia) → ort.InferenceSession.create(modelBytes) → WASM heap
```
Identifica **4 cópias potenciais** simultâneas em primeiro uso (92 + 123 + 92 + WASM). `CONFIRMADO — código` `capacitorStorage.ts:18`, `download.ts:84`, `worker.ts:67`.

---

## 8. Investigação memória — ponto prioritário OOM

**Erro observado (3/3 repro, RMX3461, pós-FIX-001):**
```
java.lang.OutOfMemoryError: Failed to allocate a 150994952 byte allocation with 25165824 free bytes and 72MB until OOM, target footprint 351358696, growth limit 402653184
Process: br.com.vanusazacarias.nutri  VmSize 31692108 kB
StartupManager reason=crash exceptionClass=java.lang.OutOfMemoryError  via WebMessageListenerAdapter.onPostMessage
```
`docs/TTS-PROD-FIX-001-ANDROID-E2E-OOM-EVIDENCE.md:32` — `CONFIRMADO — execução real` logcat 2026-09-09 15:12/15:14.

| Pergunta | Resposta |
|----------|----------|
| **1. qual código solicita 150994952 B?** | `src/lib/tts/model/capacitorStorage.ts:99-104` `Filesystem.writeFile({data: encodeBase64(data)})` + `encodeBase64` `capacitorStorage.ts:18` (Buffer→base64 ou btoa chunked). A ponte `WebMessageListenerAdapter` (Capacitor Filesystem) aloca `String`/`byte[]` no heap Java. |
| **2. qual API?** | `Capacitor Filesystem` (`@capacitor/filesystem 8.1.3`) `writeFile` com `Directory.Data`; bridge `WebView → Native` via `postMessage`. |
| **3. por que ~144 MB?** | `92_361_116 * 4/3 = 123_148_155` + overhead JSON/bridge/Capacitor → **150994952**. Base64 aumenta 33%. `cap-prod-003` reporta mesmo cálculo. `CONFIRMADO — código` `encodeBase64` sem `encoding: utf8`. |
| **4. existe base64?** | **SIM** — `capacitorStorage.ts:18-34` `encodeBase64`/`decodeBase64`, `put:103 b64 = encodeBase64(data)`. |
| **5. existe cópia ArrayBuffer?** | **SIM** — `download.ts:85 res.arrayBuffer() → Uint8Array`, `modelManager.ts:125 downloaded Map<String,Uint8Array>`, `storage.put` clone `new Uint8Array(data)` (MemoryStorage) ou base64 (Capacitor). |
| **6. Uint8Array/base64 duplicação** | **SIM** — `Uint8Array 92MB` + `String base64 123MB` vivas simultaneamente em `put` + JSON do bridge duplica. |
| **7. duplicação Filesystem.write?** | **SIM** — `b64` string + `Uint8Array` original + `Filesystem.writeFile` internamente aloca `byte[]` no Java heap (além do 25MB free). |
| **8. Worker recebe outra cópia?** | **SIM** — `worker.ts:67` `fetchBytes(modelUrl)` refetcha mesmo `origin` (não consome `storage.get`). `ModelManager` e `Worker` não compartilham buffer — double-fetch. |
| **9. antes ou depois do storage?** | **ANTES do modelo chegar ao storage definitivo** — o crash ocorre em `ensureAvailable()` **durante** `storage.put` do primeiro asset, antes de `isAvailable true` ou síntese. `E2E-OOM-EVIDENCE.md:46` “anterior à síntese/playback”. Estado permanece `isAvailable false` → próximo launch tentará baixar novamente. |

**Tamanhos envolvidos:**
* modelo 92.4 MB, tokenizer 3.5 KB, voice 0.5 MB, WASM ~11 MB (wasm simd-threaded), worker 0.49 MB — `pwa/modelCache.ts:57` `TTS_CORE_ASSETS_BYTES`.
* Durante download: `Uint8Array 92MB` + `base64 123MB` + `ArrayBuffer` do `fetch` + `WASM placeholders` → >250 MB temporário além do VmSize 31 GB (heap Java 402 MB limit).
* `AndroidManifest.xml` sem `android:largeHeap="true"` (linha 10); `growth limit 402653184` = 384 MB heap Java padrão.

**Não há** cópia `Uint8Array/base64` no lab PoC (bundle local, sem Filesystem).

---

## 9. Investigação audio playback

**Arquivo:** `src/lib/tts/player.ts:44` `createAudioPlayer`, `src/lib/tts/orchestrator.ts`, `src/lib/tts/chatTtsController.ts`, `src/components/ChatAssistant.tsx`.

* **AudioContext lifecycle:** `getContext()` lazy (`player.ts:60`), `audioContext` singleton, `startedAt/currentTime`, `startOffset` para pause/resume exato (`player.ts:49-53`), `source.onended → finishSession` (`player.ts:164`), `stop()` resolve sessão pendente (`player.ts:248`), `dispose()` `ctx.close()` (`player.ts:269`).
* **Antes do FIX-001:** `play()` fazia `if suspended try resume catch{} ` e `startSource` incondicional → silêncio, `PLAYER_OBS` `suspended` perpétuo, `onended` nunca, `orchestrator` preso `PLAYING` — `PROD-AUDIT-001-REPORT.md:9`.
* **Depois do FIX-001:** `resolveUnlocked():player.ts:104` fast-path `running→ok` sem resume; `suspended→await resume()` com estado real; `play()` rejeita se `!ok` (`player.ts:193`), `resume()` mantém `PAUSED` se bloqueado (`player.ts:232`), `unlock()` público `player.ts:139`. `ChatAssistant.tsx:313/481` `tts.unlock()` no gesto (Envio/toggle) **antes** da resposta assíncrona; resposta chega **7s depois** ainda `running` (Chromium harness D/E PASS).
* **Diferença gesto vs async:** gesto `unlock()` (B: toggle) ou `runExchange` (A: Enviar) roda em `click` (user activation sticky por origin — `PROD-FIX-001-REPORT.md:88`), resposta async vem depois, encontra contexto `running` → toca. Sem gesto (autoplay puro) → `resume` pendente/rejeitado → `phase:error` observável, TTS permanece ativo (§19). `CONFIRMADO — teste automatizado` `player.test.ts` 10 FIX-P + Chromium A-E `CHROMIUM-EVIDENCE.json`.
* **WebView RMX3461:** `ANDROID-POLICY-PROBE.json` `state running` nativo sem restrição — `unlock` é no-op seguro.
* **Pending:** `6d5df07` corrige silêncio mas não remove OOM que bloqueia chegada a `play()` em primeiro uso.

---

## 10. Investigação Worker

* **Criação:** `new Worker(workerUrl,{type:"module"})` onde `workerUrl` é `/tts/worker.js` (web) ou `/assets/tts/worker.js` (Capacitor nativo) — `runtime/browser/index.ts:220`. Build `scripts/build-tts-worker.mjs:19` esbuild `platform:browser, extern-wasm`.
* **Mensagens:** `index.ts:156` `worker.postMessage({kind:"init",payload})`, `worker.ts:185` `onmessage switch init/synth/dispose`, `post({kind:"ready"|"synth-result"|"error"|"disposed"}, transfer)` with `worker.ts:32`.
* **Transferência:** `worker.ts:196 post(...,[audio.buffer,wav.buffer])` zero-copy transfer list — `CONFIRMADO — código`. `arrayBuffer`/`Float32Array`/`Uint8Array` sem base64.
* **Lifecycle:** `index.ts:177 dispose()` posta `dispose` com timeout 3000ms + `removeEventListener` → `terminate()`; `worker.ts:146 dispose()` `session.release()`. `synthTail` FIFO `index.ts:224` serializa (`run().then(run)`), `busy` guard `worker.ts:94` throws se concorrente.
* **Cópias:** desnecessárias são **fetch duplo** (ModelManager já baixou, Worker refetcha mesmo URL) — não há compartilhamento `storage.get → postMessage(ArrayBuffer)`. Futura otimização documentada `CAP-004-FASE-3-REPORT.md:282` (double-fetch).

---

## 11. Investigação Next.js

* **Client/server boundary:** `ChatAssistant.tsx` `'use client'`, TTS imports dinâmicos `useChatTts.ts:25` `Promise.all(import synthesizer/player/orchestrator)` chunk `tts-engine` — evita `onnxruntime-node` no client. SSR `isSupported false`.
* **next.config.ts:44** `serverExternalPackages ["onnxruntime-node"]` + `webpack alias onnxruntime-node → empty.ts` client (`next.config.ts:49`) — stub legada FASE 1, mantém build sem `voice-synthesis`.
* **Dynamic imports:** `synthesizer.ts:173` `await import("./runtime/browser/index")` dentro de `load()` — nunca top-level → `onnxruntime-web` não no bundle principal.
* **Assets/APIs:** `src/app/api/tts/[...path]/route.ts:32` serve `public/tts-assets/models` ou fallback `../voice-synthesis/models/kokoro` (dev) — Vercel não tem `voice-synthesis`, então sem CDN modelo 404 antes de FASE 4.
* **PWA:** Serwist `next.config.ts:6` `swSrc src/sw.ts → public/sw.js`, `maximumFileSizeToCacheInBytes 5242880` (5MB) — exclui modelos grandes; runtime cache via `sw.ts`.
* **Efeito lab vs produto:** lab é Vite/Node sem Next; produto adiciona Serwist + Webpack alias + dynamic import — não quebra lab, mas introduz `service worker` intercept (`sw.ts:60` CacheFirst) que pode mascarar 404 do modelo (vide §14).

`CONFIRMADO — código` `next.config.ts:6-53`, `useChatTts.ts:20`, `synthesizer.ts:173`.

---

## 12. Investigação Capacitor

* **`capacitor.config.ts:3-12`**
```ts
appId 'br.com.vanusazacarias.nutri', appName 'Vanusa Zacarias Nutri', webDir 'public',
server: { url:'https://vanzacarias-mu.vercel.app', cleartext:false, androidScheme:'https' }
```
`server.url` = **remoto** Vercel, não `www` local. WebView carrega `https://vanzacarias-mu.vercel.app` (live), não `https://localhost`. Contrastar PoC local que carregava `https://localhost/assets/...`.

* **Origem WebView:** `https://vanzacarias-mu.vercel.app` (Vercel) — `location.origin` é Vercel, não `localhost`. `detectNativeCapacitor()` via `window.Capacitor.isNativePlatform()` true → defaults `NATIVE_ASSET_DEFAULTS` `/assets/tts/` mas `ModelManager` `origin` é `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` (GitHub raw), não `assets`. `synthesizer.ts:175` `native ? NATIVE_ASSET_DEFAULTS : BROWSER_ASSET_DEFAULTS`.

* **Bridge JS→Native:** `@capacitor/filesystem` via `WebMessageListenerAdapter` (log OOM). Sem `Permissions` extras (`AndroidManifest.xml:44` apenas INTERNET/RECORD_AUDIO/MODIFY_AUDIO_SETTINGS).

* **Assets APK:** `android/app/src/main/assets/public/*` é cópia de `public/` no `cap sync`. Desde FASE 3, `public/assets/tts` contém só `worker.js+wAsm` (40.4MB) — `TTS-CAP-004-FASE-3-REPORT.md:122`. Modelo **fora** do APK. APK debug `153.2 MB` (build) / `95.8 MB` prod debug (E2E) — inclui `public/downloads/vanzacarias-nutri-1.0.apk 38.8MB` auto-embarcado (bloat `webDir=public`).

* **Conclusão:** partes locais: `worker.js`, `wasm`, `vosk tar` em `public/` → `assets/public` no APK. Partes remotas: Chat/Capacitor `server.url`, modelo `GitHub raw`, `on-demand` Filesystem `Directory.Data`. `CONFIRMADO — código + report`.

---

## 13. Investigação PWA / Service Worker

* **`src/sw.ts:60-74`** `TTS_ASSETS_RUNTIME_CACHING` `matcher: sameOrigin && isTtsAssetRequest(url)` onde `isTtsAssetRequest` é `src/lib/tts/pwa/modelCache.ts:50` para `paths /api/tts/models/*, /api/tts/wasm/*, /tts/worker.js` — `CacheFirst` com `ExpirationPlugin maxEntries 16, maxAge 365d`. **Regra ANTES do `defaultCache` (first-match wins).**
* **Interferência potencial:**
  - `Worker.ts` faz `fetch(payload.assetUrls.modelUrl)` onde `modelUrl` é `effectiveBaseUrl + model_quantized.onnx`. Se `effectiveBaseUrl` é GitHub raw (`https://raw.githubusercontent.com/...`), **não é sameOrigin** → **não** é interceptado pelo SW (correto — modelo não é cacheado pelo SW, mas por `CapacitorStorage`). Se `effectiveBaseUrl` fosse same-origin `/api/tts/models/` (antes de FASE 4), **seria** interceptado e cacheado em `tts-assets-v1` — `TSW cacheName tts-assets-v1`.
  - `pwa/modelCache.ts:22` comentário: “modelo vira CacheFirst … primeira fetch 200 → entra no cache” — valida.
  - `sw.ts:129` `activate` `pruneOldTtsCaches(2)` mantém 2 versões.
  - **Não interfere** em `Worker`/`WASM` `/dashboard`/`Chat` — matcher restrito; `public/sw.js` bundle minificado já contém `isTtsAssetRequest`. `CONFIRMADO — código`.
  - **Risco:** se `origin` GitHub raw falhar CORS ou `Content-Length` divergir, SW não ajuda (não é sameOrigin). Produto corretamente usa `CapacitorStorage`, não SW, para modelo.

---

## 14. Investigação produção (localhost vs Vercel vs Android)

| Aspecto | localhost (`next dev`) | Vercel (`vanzacarias-mu.vercel.app`) | Android/Capacitor (`br.com.vanusazacarias.nutri`) |
|---------|------------------------|--------------------------------------|---------------------------------------------------|
| URL base TTS modelo | `http://localhost:3000/api/tts/models/` fallback `voice-synthesis/models/kokoro` se existir | `https://vanzacarias-mu.vercel.app/api/tts/models/` (rota serve `public/tts-assets/models` — vazio até FASE 4) → 404 sem `NEXT_PUBLIC_TTS_ASSETS_ORIGIN`; com FASE 4 `https://raw.githubusercontent.com/Joelgonn/vanzacarias/tts-assets-v1/` | `https://raw.githubusercontent.com/...` (env .env.local em build Vercel → bundle) + `Filesystem Directory.Data` |
| CORS | sameOrigin → ok | sameOrigin → ok (mas 404) | cross-origin GitHub raw `Access-Control-Allow-Origin *` → fetch ok |
| Cache | `MemoryStorage` (vitest) / `CacheStorage` browser | `CacheStorage tts-assets-v1` + SW CacheFirst (sameOrigin only) | `CapacitorStorage Directory.Data` persistente |
| SW | `disable: NODE_ENV!==production` → dev sem SW | SW ativo `public/sw.js` precache `runtime` | SW ativo no WebView (sameOrigin Vercel) mas modelo cross-origin não passa pelo SW |
| Env | `.env.local:23` `NEXT_PUBLIC_TTS_ASSETS_ORIGIN=https://raw.../tts-assets-v1/` | Vercel env igual (via push) — `DEFAULT_TTS_ASSETS_ORIGIN` fallback | Bundleado no APK via build Vercel → client usa mesmo origin |
| Worker | `/tts/worker.js` local dev (`public/tts/worker.js`) | `/tts/worker.js` CDN Vercel | `/assets/tts/worker.js` no APK + `/tts/worker.js` em `public/` (duplicado) |
| Auth/Chat | dev Supabase local | prod Supabase `zmsjwtjfvgbbrxzdwgkp.supabase.co` + `chatApiFetch` | mesmo, WebView com session |
| Comportamento muda em | download funciona dev se `voice-synthesis` existir (fallback rota) → prod 404 sem CDN → Android OOM no primeiro `put` | prod sem modelo até FASE 4; pós-FASE 4 GitHub raw ok mas OOM persiste | Android primeiro uso sempre crash |

`CONFIRMADO — código` `config.ts:22`, `route.ts:32`, `capacitor.config.ts:8`.

---

## 15. Histórico git (reconstrução)

Ver §6. Commits relevantes `src/lib/tts`:

* `2282fda` extract engine (vendagem core/wav)
* `b055937` Fase 3/4 — runtime vendado completo + ModelManager + CapacitorStorage (32 arquivos)
* `db2494a` release on-demand (docs gate)
* `6d5df07` FIX-001 (audio unlock) — **único commit pós-ModelManager que altera runtime**
* Nenhum commit de remoção/reversão de ModelManager; `6d5df07` não toca `model/*`.

`CONFIRMADO — git log --oneline + git show --stat` §6.

---

## 16. Testes — mapeamento

| Suíte | Tipo | N | Estado | Nota |
|-------|------|---|--------|------|
| `player.test.ts` | unitário (FIX-P) | 10 novos + existentes | **PASS** 603/603 | `CONFIRMADO — teste automatizado` |
| `ttsOrchestrator.test.ts` | unitário | | PASS | |
| `chatTtsController.test.ts` | unitário (FIX-C) | +3 | PASS | |
| `ttsIntegration007.test.ts` | integração browser (FakeTtsWorker) | 8 | PASS | Sem network, sem real model |
| `modelManager.test.ts` | unitário download/SHA/singleflight | 10 | PASS | `MemoryStorage` fixture, não Filesystem real |
| `ttsModelIntegration.test.ts` | integração ModelManager+Worker | 3 | PASS | |
| `pwaModelCache.test.ts` | unitário SW cache | | PASS | |
| Chromium `TTS-PROD-FIX-001-CHROMIUM-EVIDENCE.json` | **Chromium real** (headless+PMP) A-E sem flag | 5 cenários | **PASS** | `CONFIRMADO — execução real` local, não device |
| Android policy probe `...-ANDROID-POLICY-PROBE*.json` | WebView real RMX3461 probe `getContext().state` | | PASS (running) | `CONFIRMADO — execução real` |
| Android E2E OOM `...-ANDROID-E2E-OOM-EVIDENCE.md` | **Android físico** RMX3461 `adb logcat` 3/3 crash | 3 runs | **FAIL (OOM)** antes de síntese | `CONFIRMADO — execução real` |
| CAP-001/002 PoC `_tts-cap-poc/result-poc.json` | Android físico WebView local | 12 sínteses | **PASS** | Mas com modelo **bundled**, não Filesystem |

**Classificação:**
* PASS: unit/integração Chromium local
* FAIL: Android E2E pós-Merge (OOM)
* BLOCKED: áudio E2E pós-FIX-001 (OOM precondição)
* NÃO VALIDADO: Android físico ModelManager `Directory.Data` real download 92 MB + reload offline (teste só MemoryStorage)

---

## 17. Causas das falhas — matriz

| Problema | Causa confirmada? | Evidência | Camada |
|----------|-------------------|-----------|--------|
| **Sem áudio (autoplay)** | **CAUSA CONFIRMADA** — `AudioContext suspended` sem gesto + `catch{} + start` incondicional | `src/lib/tts/player.ts:183` pre-FIX + `TTS-PROD-AUDIT-001-REPORT.md` A/B `suspended` vs `running`, `onended` não dispara, `PROD-FIX-001-CHROMIUM-EVIDENCE.json` A-E `CONFIRMADO — execução real` | `player.ts` → `AudioContext` |
| **OOM 150994952 B** | **CAUSA CONFIRMADA** — `CapacitorStorage.put` `encodeBase64 92MB→123MB` + bridge `WebMessageListenerAdapter` aloca 144MB sobre heap 335MB, `growth limit 402653184` | `src/lib/tts/model/capacitorStorage.ts:18,103` `Filesystem.writeFile` + logcat `OutOfMemoryError Failed to allocate ... 150994952 ... growth limit 402653184` `CONFIRMADO — execução real` RMX3461 3/3 | `model/capacitorStorage` → `Filesystem` |
| **App fecha (crash)** | **CAUSA CONFIRMADA** — OOM acima propaga `StartupManager has died` | logcat `ActivityManager Process has died` `CONFIRMADO — execução real` | Android/Java heap |
| **Worker não inicia** | **HIPÓTESE** — não confirmado; worker ainda não alcançado devido OOM em `ensureAvailable` antes de `KokoroBrowserRuntime.load` | `synthesizer.ts:158` `ensureAvailable` antes de `import browser/index`; E2E log mostra `Preparando áudio...` mas não `ready` | ModelManager |
| **Model download 404** | **CAUSA CONFIRMADA histórica** (pré-FASE 4) — `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` vazio → `/api/tts/models` vazio → 404 | `docs/TTS-CAP-004-FASE-3-REPORT.md:277` + `src/app/api/tts/route.ts:40` fallback vazio `CONFIRMADO — código`; FASE 4 corrige para GitHub raw | `model/config` / `api/tts/route` |
| **Playback (resume/pause)** | **CAUSA CONFIRMADA parcialmente** (mesmo root cause áudio, já corrigido) | FIX-001 `player.ts:232 resume mantém PAUSED se blocked` | Player |
| **PWA interferência** | **NÃO — HIPÓTESE descartada** — matcher `isTtsAssetRequest` restrito, origem GitHub raw cross-origin não passa pelo SW | `src/sw.ts:60` `sameOrigin && isTtsAssetRequest` `CONFIRMADO — código` | SW |
| **Capacitor remote WebView** | **CAUSA CONFIRMADA contribuinte** — `server.url` remoto impede servir `assets/tts/model` local e obriga download via Filesystem | `capacitor.config.ts:8` `CONFIRMADO — código`; PoC local não usava `server.url` | Capacitor |
| **Produção Vercel** | **CAUSA CONFIRMADA** — `public/tts-assets/models` vazio + `public/downloads/*.apk` bloat 38MB embarcado → APK 153MB | `TTS-CAP-004-FASE-3-REPORT.md:120` AP `160M vs 153M` `CONFIRMADO — relatório` | Vercel/public |

Separação rigorosa: **OOM e Áudio já são CAUSA CONFIRMADA** (não hipótese). Worker/PWA são não-causa ou pendente.

---

## 18. Ponto mais importante — por que o lab não foi reproduzido

**Resposta concreta (não genérica):**

1. **Lab `voice-synthesis` e PoC `_tts-cap-poc` entregam o modelo sem cópia Java heap:** `voice-synthesis` lê `readFile` (Node) / `PoC` bundle `www/assets/tts/model_quantized.onnx` direto no APK e `fetch` local `https://localhost/assets/...` → `Uint8Array` → `ort.InferenceSession.create` — **1 cópia JS + WASM heap**, sem bridge, sem base64, 12/12 OK RMX3461 (`result-poc.json`). `CONFIRMADO — código` `voice-synthesis/src/engine/kokoro-vozz-runtime.ts:96` e `voice-synthesis/src/runtime/browser/worker.ts:67`.

2. **Produto `vanzacariasnutri` trocou entrega por `Filesystem Directory.Data` com base64:** `src/lib/tts/model/capacitorStorage.ts:99` `Filesystem.writeFile({data: encodeBase64(Uint8Array 92MB)})` produz **string base64 123 MB** + `Uint8Array 92MB` vivas + cópia `byte[]` no Java heap da ponte `WebMessageListenerAdapter`. Alocação única `150994952 B` exige `402 MB` heap Java — falha 3/3 `growth limit 402653184` (`ANDROID-E2E-OOM-EVIDENCE.md:32`) **antes** de o Worker sequer iniciar. Ooom nunca ocorre no lab porque lab nunca chama `Filesystem`.

3. **Adaptação que quebrou:** `scripts/prepare-tts-android-assets.mjs` FASE 3 **remove** `model_quantized.onnx` do APK (FASE 2 ainda tinha 92 MB no APK e não crashava) para “modelo fora do APK” — decisão arquitetural FASE 3/4 sem validar custo base64. O PoC que funcionou tinha modelo **dentro** do APK; o produto que falha tem modelo **fora** via download.

4. **Double-fetch agrava:** `ModelManager` baixa para Filesystem e `Worker` refetcha `GitHub raw` novamente (`worker.ts:67 Promise.all(fetchBytes(modelUrl))`) — não reusa `storage.get` — dobrando tempo e mantendo pico alto.

5. **Capacitor config remoto amplifica:** `capacitor.config.ts:8 server.url Vercel` impede `webDir public` local; mesmo que modelo estivesse em `public/assets/tts`, WebView remota não serviria `https://localhost/assets/...` sem `server.url` vazio. PoC local usava `capacitor.config https localhost` e servia local.

**Em uma frase:** o lab entregava 92 MB como arquivo local sem transitar por heap Java; o produto entrega 92 MB como **string base64 123 MB** pelo bridge Capacitor de 384 MB, estourando `growth limit` no primeiro `writeFile`.

---

## 19. Avaliação arquitetural

| Opção | Adequada? | Justificativa |
|-------|-----------|---------------|
| **A. Correção incremental** (adicionar `largeHeap`, chunked base64, reuso buffer) | **Insuficiente** — `largeHeap` apenas adia (512MB vs 402MB, ainda 150MB+WASM+Chrome), base64 continua 33% overhead, double-fetch permanece | Poderia mitigar mas não elimina raiz (base64 bridge) |
| **B. Reescrita parcial** (Manter `ModelManager` API, trocar `CapacitorStorage` interno) | **Viável como B** — manter contrato `ensureAvailable/singleflight/SHA`, substituir `Filesystem.writeFile base64` por `writeFileInChunks`/`Filesystem.append`/streaming ou `CapacitorHttp` download nativo → `Directory.Data` sem passar por JS string | Menor churn, preserva testes |
| **C. Remoção e reintegração** (Remover ModelManager/CapacitorStorage e voltar a bundle) | **Recomendada — C** | Causa é estrutural: 92 MB não deve cruzar bridge como base64 única. Voltar a `public/assets/tts/model_quantized.onnx` no APK (como PoC) **ou** `Play Asset Delivery` **ou** `Range/Chunked` nativo sem JS, mantendo FIX-001 de áudio. Elimina download, elimina OOM, prova offline já existe. Custo: APK 92 MB adicional, mas sem bloat `public/downloads/*.apk` cai para ~115 MB (FASE-3 report). |
| **D. Arquitetura diferente** (onnxruntime-android AAR + AudioTrack nativo) | **Opcional D paralelo** — `android/kokoro-poc` já valida `onnxruntime-android` AAR `PSS 418MB` via Kotlin, sem WebView, sem bridge. Se WebView OOM persistir, D é fallback | Maior trabalho, mas isola TTS do heap WebView |

**Recomendação: C (total, para fluxo web/PWA) + preservar FIX-001 + avaliar B/D se modelo deve ficar fora do APK.**

---

## 20. Arquivos que compõem a integração (inventário fechado)

```
src/lib/tts/
  types.ts, wav.ts, core/{errors,kokoro,kokoro-pipeline,vozz-g2p}.ts,
  runtime/browser/{index,worker,asset-loader,types}.ts,
  model/{manifest,config,errors,download,storage,capacitorStorage,modelManager}.ts,
  pwa/modelCache.ts, synthesizer.ts, player.ts, orchestrator.ts, chatTtsController.ts,
  useChatTts.ts, speakable.ts, preference.ts, engine/types.ts, stubs/empty.ts, index.ts,
  __tests__/{player,orchestrator,chatTtsController,speakable,preference,modelManager,ttsIntegration007,ttsModelIntegration,ttsConsumer,pwa}
src/components/ChatAssistant.tsx (TTS hook + gestures)
src/app/api/tts/[...path]/route.ts
src/sw.ts
scripts/{build-tts-worker.mjs, prepare-tts-android-assets.mjs}
next.config.ts (withSerwist, alias onnxruntime-node)
capacitor.config.ts
android/{capacitor.build.gradle, app/src/main/assets/public/*, AndroidManifest.xml}
public/{tts/worker.js (gitignored), assets/tts/{worker.js,wasm/*}, sw.js, vosk*}
.env.local (NEXT_PUBLIC_TTS_ASSETS_ORIGIN)
docs/TTS-*-REPORT.md (CAP-004-FASE-3/4, INTEGRATION-007, PROD-AUDIT-001/002, PROD-FIX-001-*)
```

---

## 21. Componentes preservados vs descartados

**Preservar:**
* `core/*` vozz G2P (Apache-2.0, 36kB, 115 tokens) + `wav.ts` + `runtime/browser/*` vendados — `CONFIRMADO — testes` 51/51 pipeline
* `player.ts` FIX-001 `unlock/resolveUnlocked` + `orchestrator` gen + `chatTtsController` + `useChatTts` + `ChatAssistant` gestos A/B — `CONFIRMADO — execução real` Chromium RMX3461 `running`
* `model/manifest.ts+config.ts+errors.ts+download.ts` (SHA/size, origin, singleflight) — `CONFIRMADO — teste`
* `pwa/modelCache.ts` CacheFirst SW — `CONFIRMADO — código` restrito, não interfere
* `modelManager` API (isAvailable/ensureAvailable/verify/abort) — mas **não** sua `CapacitorStorage` interna

**Descartar / Reintegrar:**
* `model/capacitorStorage.ts` `encodeBase64→writeFile(base64)` — **causa OOM** (`CONFIRMADO — execução real` 150MB). Substituir por chunked/streaming ou remover.
* `model/storage.ts` `isNativeCapacitorEnvironment → CapacitorModelStorage` auto-seleção — rever para bundling local ou PAD
* `scripts/prepare-tts-android-assets.mjs` FASE 3 lógica `remove LEGACY_LARGE model` — reverter para bundle (PoC que funcionou)
* `public/downloads/vanzacarias-nutri-1.0.apk` embarcado no APK via `webDir public` — remover (38MB bloat)
* Double-fetch `ModelManager` + `Worker.fetchBytes` mesmo origin — unificar (storage.get → transfer)

---

## 22. Plano recomendado para futura reintegração

1. **Congelar** `b055937` ModelManager/CapacitorStorage como **não-deploy** até reintegração; manter `6d5df07` FIX-001 (áudio) em `main`.
2. **Escolher entrega do modelo** (decisão única, antes de codar):
   * **Opção C1 (menor risco):** voltar a `public/assets/tts/model_quantized.onnx` no APK (PoC 12/12 OK), `cap sync` → `assets/public/assets/tts` — offline 100%, sem download, sem Filesystem. APK ~115MB sem bloat downloads.
   * **Opção C2 (fora do APK sem base64):** `Play Asset Delivery` (`install-time` 92MB) ou `CapacitorHttp` native download → `Directory.Data` via `writeFile` binário chunked (sem base64 única 123MB string).
3. **Eliminar double-fetch:** `synthesizer.ts` após `ensureAvailable` fazer `storage.get` → `ArrayBuffer` → `worker.postMessage({kind:"initInitWithBuffer", modelBuffer}, [modelBuffer])` ou Worker ler `capacitor://` URL local — sem segundo `fetch` remoto.
4. **Corrigir Capacitor config para local quando modelo bundled:** `capacitor.config.ts` sem `server.url` (ou `server.url` só para live-update, mas `webDir` serve `assets`) — como PoC.
5. **Manter FIX-001** desbloqueio no gesto (A Enviar, B toggle) — já validado Chromium A-E + RMX3461 `running`.
6. **Prosseguir para `TTS-CAP-002-PRODUCT-E2E`** com harness `result-poc.json` equivalente: 6 sínteses PT-BR T01..T06 + 4 ciclos load/synth/dispose, meminfo `dumpsys`, offline (`svc wifi/data disable`), **sem** `growth limit` OOM, `phase ended 6/6`, `samplesDelta 57600-213600`.
7. **Gate:** `PASS` somente com `E2E RMX3461 físico 6/6` + `OOM 0/3` + `PSS pico <250MB` WebView.

---

*Não alterar `voice-synthesis`. Não importar código dele. Não copiar arquivos. Não criar `file:../voice-synthesis`. Relatório salvo em `docs/TTS-RESET-002-PRODUCT-AUDIT.md` — sem commit/push/deploy.*
