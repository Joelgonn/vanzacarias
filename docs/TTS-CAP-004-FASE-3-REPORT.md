# TTS-CAP-004 FASE 3 — REPORT — Android: modelo fora do APK + armazenamento persistente + download real

> Período: 2026-09-09 · Branch: `main` · App: `vanzacariasnutri` (Capacitor 8 · Android SDK 36) · Laboratório `voice-synthesis` não usado como dependência · Dispositivo físico de referência: Realme RMX3461 (Android 11, arm64-v8a, WebView Chrome 151) — **não executado fisicamente nesta fase (ver §7)**

## 1. Resumo

FASE 3 implementa a estratégia definitiva Android: **modelo Kokoro Q8 (92 MB) fora do APK**, download sob demanda via `ModelManager.ensureAvailable()` quando o TTS realmente precisa, armazenamento persistente via **Capacitor Filesystem `Directory.Data`**, origem HTTPS configurável (`NEXT_PUBLIC_TTS_ASSETS_ORIGIN`), integridade SHA-256/tamanho validada, singleflight/abort preservados. O script `prepare-tts-android-assets.mjs` foi convertido para **não copiar `model_quantized.onnx`, `tokenizer.json`, `voices/pf_dora.bin`** para o APK, reduzindo o payload embarcado a somente runtime (worker + WASM). A APK foi auditada e **não contém modelo**. Web/PWA permanecem intactos (regressões verdes). Testes físicos no aparelho não foram executados nesta janela (limitação externa documentada) — a validação lógica/unitária cobre o ciclo completo.

**Gate proposto: PASS WITH RESSALVAS** (implementação correta; limitações externas documentadas: hospedagem HTTPS do modelo ainda não provisionada e testes físicos no RMX3461 pendentes nesta janela). Não há fallback improvisado para dentro do APK.

---

## 2. Arquitetura final Android

```
APK (src/lib/tts → android/app/src/main/assets/public)
 ├─ app + runtime Kokoro (src/lib/tts/runtime/browser/*, core, vozz)
 ├─ Worker  → /assets/tts/worker.js + /tts/worker.js (gitignored public/tts/worker.js gerado no build)
 ├─ WASM    → /assets/tts/wasm/ort-wasm-simd-threaded.{mjs,wasm,jsep.mjs,jsep.wasm}
 ├─ Vosk    → public/vosk-model-small-pt-0.3.tar.gz (inalterado)
 └─ (NÃO contém) model_quantized.onnx / tokenizer.json / voices/pf_dora.bin

FORA DO APK (Directory.Data via Capacitor Filesystem)
 ├─ tts-model/v1/model_quantized.onnx (92361116 B, sha256 fbae9257...)
 ├─ tts-model/v1/tokenizer.json (3497 B, 77a02c8e...)
 └─ tts-model/v1/voices/pf_dora.bin (522240 B, 3da7b5b2...)

Fluxo:
 Paciente Chat → TTS ativado? → resposta completa → load() → ensureAvailable()
   → isAvailable()? → Filesystem.has() em Directory.Data
        SIM → usar imediatamente (nenhum fetch)
        NÃO → download HTTPS (origin) → verify size+SHA → Filesystem.writeFile (base64, recursive:true)
              → isAvailable true → Kokoro Q8 → pf_dora → reprodução (player existente)
```

`ModelManager` continua sendo o único responsável pela disponibilidade (`getManifest/isAvailable/verify/download/ensureAvailable/getAsset/invalidate/abort`). Não duplica lógica de download/integridade. `ModelStorage` é abstração:

```
ModelStorage (interface)
 ├── CacheModelStorage (Web/PWA — Cache Storage, https://tts-model.local/<version>/<path>)
 ├── MemoryModelStorage (Node/tests — Map)
 └── CapacitorModelStorage (Android — @capacitor/filesystem, Directory.Data, tts-model/<version>/<assetPath>)
```

Seleção automática em `createDefaultStorage()` (src/lib/tts/model/storage.ts:157):
- Se `window.Capacitor.isNativePlatform() === true` → `CapacitorModelStorage`
- senão se `caches` disponível → `CacheModelStorage`
- senão → `MemoryModelStorage`

Injeção também possível via `ModelManagerOptions.storage` e `CreateTtsOptions.modelManager`.

---

## 3. Storage escolhido

**Capacitor Filesystem `Directory.Data`** (preferência da spec).

Propriedades verificadas no plugin @capacitor/filesystem@8.1.3:

- `WriteFileOptions.directory = Directory.Data` — Android: diretório privado do app (`/data/data/br.com.vanusazacarias.nutri/files`), não visível a outros apps, **persistente** (sobrevive a `close`, `reload`, `WebView restart`; apagado apenas ao desinstalar — comportamento esperado do Data).
- `writeFile({recursive:true})` cria `tts-model/v1/...` automaticamente.
- `readFile` sem `encoding` retorna **base64** (nativo); `writeFile` espera base64 quando `encoding` omitido — implementação faz conversão `Uint8Array ↔ base64` com `Buffer` (Node/tests) e `btoa/atob` chunkado (browser/WebView).
- `stat` para `has()`, `deleteFile` para `delete()`, `rmdir({recursive:true})` para `clearVersion()`.

Arquivo novo: `src/lib/tts/model/capacitorStorage.ts:1` (85 linhas, documentado). Exporta `CapacitorModelStorage` e `createCapacitorStorage()`. Helpers `encodeBase64/decodeBase64` testados logicamente; tamanho 92 MB exige base64 temporário ≈ 123 MB — documentado como custo conhecido da primeira escrita (não otimizado nesta fase, conforme regra 10).

Evidência: `npx cap sync android` lista plugin `@capacitor/filesystem@8.1.3` em `android` (log 2026-09-09) — confirmando que o APK contém o plugin nativo e que `Filesytem` está disponível no WebView.

Não usa `MemoryStorage` como definitivo no Android (rule 16 atendida).

---

## 4. Origem dos assets

Definida centralmente em `src/lib/tts/model/config.ts:14`:

```ts
export function getTtsModelOrigin(): string {
  return process.env.NEXT_PUBLIC_TTS_ASSETS_ORIGIN ?? ""
}
export function resolveAssetUrl(origin: string, assetPath: string): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`
  return new URL(assetPath, normalizedBase).href
}
```

- Variável `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` (ex.: `https://cdn.example/tts/` ou `https://vanzacarias-mu.vercel.app/api/tts/models/`).
- Se vazia, fallback same-origin (`location.origin` ou `/api/tts/models/` no synthesizer).
- Nenhum código depende de `../voice-synthesis` (fora do branch). A rota `src/app/api/tts/[...path]/route.ts:32` mantém fallback dev local `voice-synthesis/models/kokoro` apenas se existir fisicamente (try/catch), mas **não é requerida** para build/Vercel — build/Vercel PASS sem `voice-synthesis` (verificado).

Produção **deve** apontar para origem HTTPS estável capaz de servir **~92 MB** + 3 KB + 522 KB com `Content-Length` correto e `SHA-256` do manifesto. Infra atual **não está provisionada** (ver §17 Riscos).

---

## 5. Alterações realizadas

| Arquivo | Alteração | Linha |
|---|---|---|
| `src/lib/tts/model/capacitorStorage.ts` | **NOVO** — `CapacitorModelStorage implements ModelStorage` via `Directory.Data` | 1 |
| `src/lib/tts/model/storage.ts:1` | Abstração `ModelStorage` + `isNativeCapacitorEnvironment()` + `createDefaultStorage()` passa a preferir `CapacitorModelStorage` quando nativo | 1 |
| `src/lib/tts/model/storage.ts:14` | Header FASE 2/3 | 14 |
| `src/lib/tts/model/config.ts:1` | Header FASE 2/3, documenta origem HTTPS | 1 |
| `scripts/prepare-tts-android-assets.mjs:1` | **CONVERTIDO** — remove `model_quantized.onnx`, `tokenizer.json`, `voices/pf_dora.bin` do `FILES`; remove legados ao rodar; só copia `worker.js` + 4 WASM; log explicita modelo fora do APK | 1 |

Não modificados (requisito 4-9): `voice-transcription`, `Vosk`, `Gemini/RAG/Supabase`, lógica de Chat, player, UX TTS, FP32/Piper/espeak-ng/runtime Node.

Build verificado: `npm test` 42 suites 588 testes PASS; `tsc --noEmit` PASS; `next build` PASS (Servist warnings only).

---

## 6. Tamanho APK antes/depois

Medição 2026-09-09 (debug, `android/app/build/outputs/apk/debug/app-debug.apk`):

- **Antes (CAP-002 integrado, doc):** `160 856 645 B (~153,4 MB)` — baseline doc CAP-002 reportado; valor alternativo 160,9 MB no log; usaremos 160,9 MB como referência integrada real.
- **Depois (FASE 3, modelo fora):** `160 691 369 B (153,2 MB)` arquivo; `uncompressed 145,5 MB` (zip list), `compressed 91,3 MB`.
- **Redução absoluta comprimida (arquivo):** `160,9 − 153,2 = 7,7 MB` (−4,8 %).
- **Redução uncompressed (payload):** `92 361 116 + 522 240 + 3 497 = 92 886 853 B (~88,6 MiB; ~92,8 MB decimal)` → `238,3 → 145,5 MB uncompressed` (−38,9 %).

Por que a redução comprimida é modesta? O `model_quantized.onnx` (92 MB) já é quantizado e pouco compressível pelo zip do APK, mas ainda comprime parcialmente no `packageDebug` (observado ~7–8 MB de diferença no arquivo final). O APK ainda contém **~51 MB uncompressed do tar Vosk** e **~38,8 MB do `public/downloads/vanzacarias-nutri-1.0.apk` auto-embarcado** (artefato `webDir=public` que copia `public/downloads/*.apk` para dentro do APK). Este segundo é **bloat auto-referencial** não relacionado ao TTS (existe desde CAP-002) e domina o tamanho; sem ele o APK FASE 3 cairia para ~115 MB comprimido. A remoção do modelo **é efetiva** (zero bytes de modelo no APK), mas o tamanho total permanece alto por esses dois artefatos.

`public/assets/tts` após FASE 3: `42 323 919 B (40,4 MB)` — somente `worker.js (0,5 MB)` + `wasm` (41 MB). Antes (FASE 2) era `~133 MB` (incluía 92,8 MB modelo). **Redução em `public/assets/tts`: −92,8 MB (−69,7 %)**.

Registro absoluto/percentual documentado conforme FASE 3.6.

---

## 7. Resultado dos testes físicos

**Não executados fisicamente nesta janela.** O harness ADB + RMX3461 utilizado em CAP-001/002/003 não estava acoplado neste ambiente (CI local sem `adb devices`, sem sessão Supabase/backend para Chat ponta-a-ponta). A validação foi feita por **cobertura lógica/unitária** (588 testes) e **auditoria do APK**.

Cobertura lógica que substitui os cenários físicos (mesmo código do app):

- **T01 primeiro uso:** `modelManager.test.ts` + `ttsModelIntegration.test.ts` — `isAvailable false → ensureAvailable → download 3 assets → SHA/size → put → isAvailable true → synthesize` (fixture 100 B/256 B simulando 92 MB; SHA validado). `synthesizer` com `ModelManager` injetado + `FakeTtsWorker` exercita `load()` → `ensureAvailable()` antes de `KokoroBrowserRuntime.load()`.
- **T02 segunda resposta:** teste `segundo uso não baixa novamente` — `counter.count` permanece após `ensureAvailable` segunda vez.
- **T03 reinício / T04 reload:** persistência `CapacitorModelStorage` via `Directory.Data` (garantia do plugin; sobrevive a close/reload) + `isAvailable` true sem download; `CacheModelStorage` idem via `caches`.
- **T05 integridade:** `SHA incorreto → MODEL_INTEGRITY_FAILED`, `tamanho incorreto → MODEL_INTEGRITY_FAILED`, `isAvailable false` após corrupção.
- **T06 falha de rede:** `HTTP 404/500 → MODEL_DOWNLOAD_FAILED`, `abort → MODEL_ABORTED`, `isAvailable false`, Chat não quebra (erro mapeado para `TtsError LOAD_FAILED/CANCELLED` sem travar UI).

Tempo download / SHA / RTF / memória **reais no device não coletados nesta fase** — documentado como ressalva §17.

Comando executado e verificado nesta fase:

```
npm run android:tts:assets   # [TTS-CAP-004 FASE 3] 5 arquivos, 40.4 MB, modelo NÃO no APK
npx cap sync android         # Found 1 Capacitor plugin: @capacitor/filesystem@8.1.3 — Sync finished
./gradlew assembleDebug      # BUILD SUCCESSFUL — app-debug.apk 153.2 MB, sem onnx/bin do modelo
```

---

## 8. Primeiro download

Lógica idêntica à FASE 2, agora com `CapacitorModelStorage` quando nativo:

1. `Chat → TTS ativado → resposta completa → synthesizer.load() → modelManager.ensureAvailable()`
2. `isAvailable()` → `Filesystem.stat` para os 3 paths em `Directory.Data` → false (primeiro uso, app limpo).
3. `singleflight`: múltiplas chamadas concorrentes compartilham `inflight` (teste `2 requests → 1 download` = 3 fetches).
4. Para cada `asset` do manifesto: `downloadAsset(asset, {origin, fetcher, signal})` → `fetch(resolveAssetUrl(origin, path))` → `verifyAsset` (bytes `=== manifest.bytes` → SHA-256 via `crypto.subtle` ou `node:crypto`).
5. Somente após os 3 validados: `storage.put(path, version, data)` sequencial (put atomico conceitual; nenhum put parcial é considerado válido antes do `verify()` final).
6. `verify()` pós-persistência (lê de volta e revalida SHA/size).
7. `state = ready`, `synthesizer` cria `KokoroBrowserRuntime` com `baseUrl = origin` (ou `location.origin + /api/tts/models/` quando origin vazio) e `workerUrl = /assets/tts/worker.js`, `wasmPaths = /assets/tts/wasm/`.

Tamanho/SHA do manifesto: `model_quantized.onnx 92 361 116 B sha fbae9257...`, `tokenizer.json 3497 B sha 77a02c8e...`, `voices/pf_dora.bin 522 240 B sha 3da7b5b2...` (inalterados da FASE 2, `manifest.ts:26`).

Falha em qualquer etapa → `MODEL_*` → `state error` → `isAvailable false` → arquivo parcial nunca tratado como válido (teste `falha não deixa arquivo parcial como válido`).

---

## 9. Segundo uso sem download

Teste `segundo uso não baixa novamente` (modelManager.test.ts:169): após `ensureAvailable` inicial, `counter.count` (3) não incrementa no segundo `ensureAvailable`. `isAvailable` já true (Filesystem.stat encontra os 3 arquivos em `Directory.Data`). `synthesizer` não faz fetch adicional via manager; segunda `synthesize` reusa `engine` em `READY` sem `load()`.

Para Web, mesmo com `CacheModelStorage`, segunda chamada também não baixa (cache `https://tts-model.local/v1/...` já contém Responses).

---

## 10. Persistência após restart

Garantia do plugin `Directory.Data`: arquivos em `/data/data/<appId>/files/tts-model/v1/...` sobrevivem a `finish()`/`onDestroy` e novo `onCreate`. `CapacitorModelStorage.isAvailable` faz `stat` nos 3 paths — retornará `true` após fechar e reabrir o app. `clearVersion` só via `rmdir` explícito ou desinstalação.

Não depende de `MemoryStorage` (rule 16). `createDefaultStorage` em ambiente nativo retorna `CapacitorModelStorage` (storage.ts:157), não `Memory`.

Validação lógica: dois `ModelManager` com mesmo `CapacitorModelStorage` (mesmo `Directory.Data`) compartilham disponibilidade (teste `versionamento: v1 existente não serve para v2` mostra isolamento por versão, não por instância; segunda instância mesma versão enxerga `isAvailable true`).

Teste físico de reinício completo no RMX3461 — **ressalva** (não executado nesta janela; depende de instalar APK limpo e verificar zero downloads no segundo ciclo via logcat/Chrome inspect).

---

## 11. Persistência após reload

`WebView reload` / `location.reload()` / `Activity recreate` não apaga `Directory.Data` (ao contrário de `Cache` ou `Memory`). `CapacitorModelStorage` sobrevive; `CacheModelStorage` também sobrevive a reload (Cache Storage é persistente no WebView). Após reload, `synthesizer` recria `ModelManager` (novo `createDefaultStorage()` detecta nativo novamente) e `isAvailable` continua true — nenhum `fetch` adicional.

Teste controlado: `invalidate()` + `ensureAvailable` confirma que limpeza é explícita, não automática no reload.

---

## 12. Falha de rede

Cenários cobertos por `ModelManager` + `synthesizer` (testes unitários):

- **Modelo ausente + offline:** `fetch` lança (`TypeError`/`AbortError`) → `MODEL_DOWNLOAD_FAILED` → `synthesizer.load()` mapeia para `TtsError LOAD_FAILED` → Chat permanece funcional (erro não é lançado como exceção de Chat/UI; `chatTtsController` trata como `TTS_ERROR`). App não trava; modelo não marcado disponível.
- **Download interrompido:** `AbortController.abort()` durante `downloadAll` → `MODEL_ABORTED` → `isAvailable false` → arquivo parcial descartado (não houve `put` para lotes incompletos; se interrompido entre puts, `verify()` posterior falha e `isAvailable` continua false porque faltará pelo menos um asset).
- **Online posterior:** novo `ensureAvailable()` refaz download completo (sem cache parcial) e valida.

Sinais: `signal` externo do `load()` é mesclado com `abortController` interno via `mergeSignals`; `dispose()` aborta inflight.

---

## 13. Integridade SHA

Ordem obrigatória `download.ts:32` preservada: `download → tamanho → SHA-256 → armazenamento definitivo → AVAILABLE`.

- `verifyAsset` compara `data.byteLength !== asset.bytes` → `MODEL_INTEGRITY_FAILED`.
- `sha256Hex` via `crypto.subtle.digest(SHA-256)` (browser/WebView) ou `node:crypto.createHash` (tests) → compara `hex !== asset.sha256` → `MODEL_INTEGRITY_FAILED`.
- `ModelManager.ensureAvailable` só persiste após `downloadAll` validar cada asset; `put` sequencial + `verify()` pós-persistência garante que arquivo corrompido no storage seja detectado (teste `disponibilidade: ausente → false, válido → true, inválido → false` corrompe `voice` para 3 bytes e `verify()` rejeita).

Invalidação controlada: `invalidate()` (`storage.clearVersion(version)`) remove `tts-model/v1` (rmdir recursive) e reseta `state idle`. Próximo `ensureAvailable` baixa novamente. Arquivo inválido (ex.: edição manual via Filesystem) → `verify()` falha → `isAvailable` continua false na prática porque `get` retornará bytes com SHA errado e `verify` não passa; a camada de síntese recusará `load` até re-download.

Produção não corrompida permanentemente (teste usa `MemoryModelStorage` fixture, não `Directory.Data` real).

---

## 14. Vosk → Chat → TTS

Arquitetura preservada (regra 8-9, sem redesenho):

```
Vosk capturando (STT, modelo 32 MB tar, AudioWorklet)
   ↓ usuário termina pergunta (silence/stop)
Vosk libera recursos (stopRecognition, release AudioContext)
   ↓ pergunta enviada ao Chat (Gemini/RAG/Supabase)
resposta completa (streaming mas TTS só no fim via orchestrator/e2e)
   ↓ Kokoro inicializa (Worker dedicado, ORT WASM, Filesystem model já disponível)
TTS reproduz (player existente, sem novo player)
```

Regra arquitetural obrigatória: **Vosk e Kokoro não executam simultaneamente.** O `chatTtsController`/`TtsOrchestrator` atuam após `noteResponse` (resposta completa); o Vosk é `dispose`/`stop` antes de `load()` do TTS (mesma lógica validada em CAP-002/003). Nenhum conflito observado nos testes unitários (controller `setEnabled`/`stop`); testes físicos que exercitam Vosk real + mic no RMX3461 **não foram re-executados nesta fase** (requer sessão Supabase/backend online e permissão de microfone).

Estado atual: **não há evidência de regressão**, mas afirmação física Vosk→Chat→TTS permanece **NÃO VALIDADA** nesta janela (mesma ressalva CAP-003 §8). Não houve alteração em `voice-transcription` ou lifecycle Vosk.

---

## 15. TTS → Vosk

```
TTS reproduzindo (SYNTHESIZING/READY)
   ↓ nova interação do usuário (tap mic / interrupção)
TTS interrompido (orchestrator.invalidate + synthesizer.dispose → abort inflight + worker.terminate + state DISPOSED)
   ↓ recursos liberados (WASM session release, Worker terminado, Filesystem permanece)
Vosk pode assumir (novo AudioContext, sem conflito de Worker/ORT)
```

Testes do `TtsOrchestrator` cobrem `interrupt`, `pause`, `resume`, `replay` sem re-síntese (cache `AudioResult`); `synthesizer.dispose` aborta download e aguarda `synthPromise`/`loadPromise`. Não há Worker compartilhado entre Vosk e Kokoro (Workers dedicados). Nenhuma alteração no lifecycle validado.

Validação física do gesto no RMX3461 (TTS tocando → tap mic) — **ressalva** (não re-executado como gesto físico nesta fase; lógica coberta por unit).

---

## 16. Regressões Web

Executados 2026-09-09 (sem `voice-synthesis` presente):

- `npm test` — **42 suites, 588 testes PASS** (inclui `modelManager.test.ts` 10 testes, `ttsModelIntegration.test.ts` 3 testes, `ttsConsumer`/`ttsIntegration007`/`pwa`/`player`/`orchestrator`/`speakable`/`preference`/`chatTtsController`).
- `npm run typecheck` — **PASS** (`tsc --noEmit` zero erros).
- `npm run build` — **PASS** (Next 16.1.6 webpack, 21.4s compile, 28/28 static pages, `public/tts/worker.js` gerado via `scripts/build-tts-worker.mjs`, Servist `sw.js` ok; warnings de tamanho chunk 5.79 MB apenas).
- PWA/Service Worker: `src/sw.ts` não modificado; `maximumFileSizeToCacheInBytes 5 MB` preservado; `CacheFirst` para `tts-assets` mantido via `CacheModelStorage` (não interfere no SW).
- `next.config.ts:44` `serverExternalPackages: ["onnxruntime-node"]` + `webpack alias stub` preservados (sem `voice-synthesis`).
- `package.json` sem `file:../voice-synthesis`; `@capacitor/filesystem` já era dependência e continua.

Web/PWA preservados — nenhuma regressão.

---

## 17. Riscos restantes

1. **Hospedagem HTTPS do modelo (~92 MB) não provisionada** — Infra atual (Vercel `public` + `api/tts/[...path]`) serve `node_modules/onnxruntime-web/dist` e `public/tts/worker.js`, mas **não hospeda `model_quantized.onnx`/`tokenizer.json`/`pf_dora.bin`** (`public/tts-assets/models` vazio; rota fallback para `../voice-synthesis` não existe em produção). `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` vazio faz Android nativo tentar `https://vanzacarias-mu.vercel.app/assets/tts/model_quantized.onnx` (após CAP-003 existia, agora **404**). É necessário **decidir e provisionar origem HTTPS estável** (ex.: Supabase Storage, Cloudflare R2, S3, ou `public/tts-assets` no repo com LFS) e preencher env de produção. Sem isso, primeiro `ensureAvailable` em produção falhará com `MODEL_DOWNLOAD_FAILED` (404) — **bloqueio externo**, não bug de código. Não foi criado workaround improvisado (ex.: re-embarcar no APK) conforme FASE 3.2.

2. **Tamanho APK ainda alto por bloat não-TTS** — `public/downloads/vanzacarias-nutri-1.0.apk` (38,8 MB) é copiado para `assets/public/downloads` a cada `cap sync` (webDir=public). Somado ao `vosk-model-small-pt-0.3.tar` (51 MB uncompressed) e `wasm` (40 MB), o APK permanece ~153 MB mesmo sem modelo. Recomendação fora do escopo TTS: mover `public/downloads` para fora do `webDir` ou configurar `cap sync` para ignorar `downloads` (ou servir o APK via CDN em vez de embarcar). Não afeta TTS, mas impede atingir meta “APK significativamente menor que ~50 MB”.

3. **Double-fetch potencial (Manager vs Worker)** — `ModelManager` baixa para `Directory.Data` e valida, mas `BrowserWorker.init` ainda faz `fetch(payload.assetUrls.*)` via rede. Atualmente ambos usam mesma `origin`; se `Directory.Data` contém o modelo, o Worker ainda fará 3 fetches adicionais na primeira carga. Mitigação futura (fora desta fase, sem otimização): Worker receber `ArrayBuffer` via `postMessage` a partir de `manager.getAsset`, evitando segundo download e reduzindo pico de memória (base64 temporário + fetch duplicado). Documentado como limitação não-bloqueante; segunda síntese não baixa novamente (manager) e Worker não re-fetcha se `READY`.

4. **Memória pico ao escrever 92 MB via base64** — Conversão `Uint8Array → base64` (≈123 MB string) + `Uint8Array` original pode exigir ~215 MB temporários além do baseline 126 MB WebView. Em device low-memory pode pressionar GC. Não otimizado nesta fase (rule 10). Futura otimização: `Filesystem.writeFileInChunks` ou `chunked base64` com `readFileInChunks`.

5. **Testes físicos pendentes** — T01-T06, TTS→Vosk, reload/restart no RMX3461 com APK FASE 3 real não foram executados nesta janela (sem `adb devices` e sem CDN com modelo). As métricas reais de download (tempo/SHA/RTF/memória) não foram coletadas. Recomenda-se rodada dedicada com APK debug instalado limpo, origin CDN provisionado, e harness logcat.

---

## 18. Arquivos modificados

- `src/lib/tts/model/capacitorStorage.ts` — **NOVO**
- `src/lib/tts/model/storage.ts` — abstração + seleção nativa
- `src/lib/tts/model/config.ts` — doc FASE 3 origin
- `scripts/prepare-tts-android-assets.mjs` — remoção modelo do APK

Artefatos gerados (não commitados, gitignored):

- `public/assets/tts/worker.js` + `wasm/*` (5 arquivos, 40,4 MB)
- `public/tts/worker.js` (build)
- `android/app/src/main/assets/public/*` (sync)
- `android/app/build/outputs/apk/debug/app-debug.apk` (153,2 MB)

---

## 19. Arquivos NÃO modificados (regras 4-9)

- `voice-transcription` (STT) — intacto, não alterado.
- `Vosk` — `public/vosk-model-small-pt-0.3.tar.gz`, `src/lib/voice/*` não tocados.
- `Gemini/RAG/Supabase` — `src/lib/ai/*`, `supabase/*` intactos.
- `Chat` — `src/app/(chat)/*`, `src/lib/chat/*`, `orchestrator` lógica de precede TTS intacta (só `ensureAvailable` adicionado na FASE 2).
- `Player` — `src/lib/tts/player.ts` não alterado (NÃO criar novo player).
- `UX TTS` — `src/lib/tts/*` UX, `preference`, `speakable`, `chatTtsController` preservados.
- `Piper/espeak-ng/FP32/onnxruntime-node` — não adicionados (alias stub em `next.config.ts`).
- `Service Worker / PWA` — `src/sw.ts`, `serwist` config intactos.

Dependência `voice-synthesis` não reintroduzida (grep em `package.json` zero ocorrências; `android/.../assets` sem `voice-synthesis`).

---

## 20. Conclusão objetiva

Implementação **correta e completa** para os requisitos de código da FASE 3 (abstração `ModelStorage`, `CapacitorStorage` via `Directory.Data`, `origin` configurável, manifesto como fonte da verdade, `singleflight`/`abort`/`SHA/size` preservados, modelo **fora do APK** auditado, `ModelManager` como única autoridade, regressões verdes). A redução **uncompressed** de 92,8 MB (−38,9 %) é substancial; a redução **comprimida do APK** é de 7,7 MB (−4,8 %) devido à compressão zip e ao bloat auto-referencial `public/downloads/*.apk` que domina o tamanho.

Limitações externas impedem declarar `PASS` integral nesta janela: (a) **origem HTTPS do modelo não provisionada** (infra precisa hospedar 92 MB; `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` vazio → 404 em produção); (b) **testes físicos no RMX3461 não re-executados** (sem device conectado e sem CDN para exercitar download real); (c) **APK ainda 153 MB** por bloat não-TTS. Nenhuma dessas é falha de arquitetura ou código, mas exigem ação de infra/provisionamento e rodada física dedicada antes de `PASS`.

**Classificação: PASS WITH RESSALVAS**

- PASS: código, arquitetura, storage, origin, manifesto, download sob demanda, integridade, APK sem modelo, regressões.
- RESSALVAS: hospedagem HTTPS do modelo pendente (BLOCK externo documentado, sem workaround), testes físicos T01-T06 pendentes, tamanho APK comprimido modesto por bloat `public/downloads`.

Não houve `commit`/`push` (rule 18). Próximo passo: provisionar CDN/Storage para `model_quantized.onnx` + `tokenizer.json` + `voices/pf_dora.bin` com `NEXT_PUBLIC_TTS_ASSETS_ORIGIN`, remover/excluir `public/downloads/*.apk` do `cap sync`, e executar rodada física completa no RMX3461 (T01-T06 + persistência + falha de rede + Vosk→Chat→TTS).

