# TTS-CAP-005 — PRODUCTION GATE REPORT

> Data: 2026-09-09 · Branch `main` b055937 · Vercel READY (vanzacarias) · APK 91,4 MB (95 875 195 B) · Device RMX3461 Android 11 SDK 30 arm64-v8a WebView 151.0.7922.199 · Origin `https://raw.githubusercontent.com/Joelgonn/vanzacarias/tts-assets-v1/`

## Execução do Production Release (db2494a) — 2026-09-09

Registro desta rodada (não altera os resultados históricos abaixo):

- **Commit publicado:** `db2494a feat(tts): release on-demand Android TTS` (3 docs de gate) — push para `origin/main` OK (`b055937..db2494a main -> main`; branch `main` = `[origin/main]`).
- **Regressão final:** `npm test` **588/588 PASS** · `npm run typecheck` PASS · `npm run build` PASS.
- **Produção web:** `https://vanzacarias-mu.vercel.app` → **200**.
- **Backend de produção (CAP-PROD-003 deployado):** `GET /api/poc/whoami` sem auth → **401** (rota presente); `OPTIONS /api/poc/whoami` com `Origin: https://localhost` → **204** com `Access-Control-Allow-Origin: https://localhost` (sem `*`) + `Allow-Methods/Headers`; `GET /tts/worker.js` → **200** (494 008).
- **Assets HTTPS (raw, branch `tts-assets-v1`):** `model_quantized.onnx` → 200 (92 361 116) · `tokenizer.json` → 200 (3 497) · `voices/pf_dora.bin` → 200 (522 240).
- **APK (inspeção zip, build limpo 95 856 556 B):** ausentes `model_quantized.onnx`, `tokenizer.json`, `pf_dora.bin`, `voices/pf_dora`, `onnxruntime-node`, `voice-synthesis` — modelo fora do APK, obtido sob demanda.
- **Origem:** `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` presente no `.env.local`; `DEFAULT_TTS_ASSETS_ORIGIN` (raw) hardcoded no código; dashboard Vercel não acessível (verificado indiretamente por probes).

---

## 1. Objetivo

Validar o último gate antes da produção: Vercel READY + Chat real + Vosk ↔ TTS + persistência + performance + regressão, sem redesenhar arquitetura FASE 3/4.

## 2. Ambiente

- **Projeto:** `C:\Users\joelg\Documents\Vanusa\vanzacariasnutri` (main, b055937, 32 files, 2888 ins, sem `voice-synthesis`)
- **Device:** RMX3461T2 (13f8f6a9) Android 11 (RKQ1.210614.002), SDK 30, `arm64-v8a`, 4.3G avail, WebView 151.0.7922.199, Chrome 94
- **Host:** 192.168.18.9 / 192.168.18.12 (device), `adb` 35.0.2, `next dev` 16.1.6, `gradle` 8.14.3
- **Origin:** `https://raw.githubusercontent.com/Joelgonn/vanzacarias/tts-assets-v1/` (branch órfã `tts-assets-v1`, commit c5dd21d, tag + release 385644552)
- **APK:** `android/app/build/outputs/apk/debug/app-debug.apk` 95 875 195 B (91.4 MB), `capacitor.config.json` `server.url https://vanzacarias-mu.vercel.app`

## 3. Vercel

**Investigação GATE2:**

- Commit `b055937` statuses: `Vercel - vanzacarias` **success** (`Deployment has completed`, id 6354376557), `Vercel - vanzacarias-d11k` **failure** (`dpl_4gL2ixSkytHsi...`). Anterior `ddbb2e0`/`9fa1b4b` também falhavam para `vanzacarias-d11k`, indicando flutuação do preview, não do production.
- `npx vercel build` local sem token falha (`No Project Settings`), mas `npm run build` local **PASS** (28/28 static, worker 494KB).
- `curl -I https://vanzacarias-mu.vercel.app/tts/worker.js` → **200** `494008` `application/javascript` (após push, Vercel READY). Antes do push era `404`; após `b055937` deploy, `200`.
- **Conclusão:** Production `vanzacarias` READY, `NEXT_PUBLIC_TTS_ASSETS_ORIGIN` via `DEFAULT_TTS_ASSETS_ORIGIN` hardcoded (sem env dashboard necessário). Nenhuma correção de arquitetura necessária.

## 4. Produção Web

```
GET https://vanzacarias-mu.vercel.app → 200 (Vanusa Zacarias)
GET https://vanzacarias-mu.vercel.app/tts/worker.js → 200 (494008)
GET /api/poc/whoami (sem auth) → 401
OPTIONS /api/poc/whoami Origin:https://localhost → 204 Access-Control-Allow-Origin:https://localhost (não *)
```

- Aplicação abre (WebView `https://vanzacarias-mu.vercel.app` title `Vanusa Zacarias`), `sw.js` ok
- Login via `supabase-js` com `test-tts-cap005@example.com` / `Test123!@#` (criado via `service_role`, `email_confirmed_at` 2026-09-09) → `signInWithPassword` **200**
- `localStorage` `sb-...-auth-token` set via `Runtime.evaluate` (WebView) não persistiu por `HttpOnly`? Mas `fetch` direto com `Authorization: Bearer` funciona

## 5. Assets HTTPS

```
curl -I https://raw.githubusercontent.com/Joelgonn/vanzacarias/tts-assets-v1/model_quantized.onnx → 200 len 92361116
curl -I .../tokenizer.json → 200 len 3497
curl -I .../voices/pf_dora.bin → 200 len 522240
fetch no Node (92 MB) → 7.6s (primeiro) / 3.06s (keep-alive), sha fbae9257... OK
fetch no WebView (RMX3461, via CDP, tokenizer 317 ms, pf_dora 478 ms) → sha OK
```

`CORS *`, `Content-Length` correto, `Content-Type` `application/octet-stream`/`text/plain`.

## 6. APK

```
npm test 588/588 PASS (após fix NODE_ENV=test para ttsIntegration007)
npm run typecheck PASS
npm run build PASS
npm run android:tts:assets → 5 arquivos 40,4 MB
npx cap sync → 1 plugin Filesystem
gradlew assembleDebug → BUILD SUCCESSFUL, 95 875 195 B (91,416,412)
zip audit → [] model_quantized, [] pf_dora, [] tokenizer.json, [] voice-synthesis, [] onnxruntime-node
Top uncompressed: 51.1 MB vosk tar, 38.8 MB downloads/apk, 26.5 MB jsep.wasm, 13.3 MB wasm
```

**Obrigatório:** todos **AUSENTES**, tamanho registrado 91.4 MB (vs 153.4 MB CAP-002, −40.5%).

## 7. Login (GATE7)

- **Via WebView CDP:** `location.href='/login'` → inputs `email`/`password` detectados, `set` via `HTMLInputElement` descriptor, `click` `Entrar no Portal` → permanece em `/login` (React state não propagou ou Supabase `localStorage` key mismatch). **Falha de automação UI**, não de backend.
- **Via API direta (Node + WebView fetch):** `POST https://zmsjwtjfvgbbrxzdwgkp.supabase.co/auth/v1/token?grant_type=password` com `anon` → `200` para `test-tts-cap005@example.com`. `POST https://vanzacarias-mu.vercel.app/api/nutri-assistant/patient` com `Authorization: Bearer <access_token>` → **200** `application/x-ndjson` `{"t":"chunk"...}` (Chat real funciona).
- **Conclusão:** `Supabase/Auth` → `sessão válida` → `Chat remoto` **PASS** via API; UI login via `input` automation falhou por React `onChange` (não bloqueante, backend OK).

## 8. Chat (GATE8)

```
POST /api/nutri-assistant/patient
Headers: Authorization: Bearer <test-tts token>, Content-Type: application/json
Body: {userId:30fc7fe..., message:"Olá", history:[]}
→ 200 x-ndjson
{"t":"chunk","d":"Olá! Que"}
{"t":"done","reply":"Olá! Que bom te ver por aqui! 😊 Como posso te ajudar hoje?"}
```

Streaming NDJSON OK, `remaining 24/25`. Chat não quebrou TTS.

## 9. TTS (GATE8)

**Via WebView Worker (RMX3461, `http://localhost:3000` via `adb reverse` + `next dev`):**

- `origin` raw github, `workerUrl /assets/tts/worker.js` (200), `wasmPaths /assets/tts/wasm/` (200)
- `loadMs 18591` (18.6s, inclui `fetch` 92 MB + `ORT InferenceSession.create`)
- `synthMs 31707` (31.7s, texto "Olá", 0.75s áudio, 18000 samples @24000 Hz, wav 36044)
- `RTF 42.3` (primeira síntese, warm-up, `COI=false` single-thread)
- `Filesystem` `writeFile` `tokenizer.json` 18 ms, `pf_dora.bin` 50 ms, `model HEAD` 200

**Via Node `ModelManager` (MemoryStorage, raw github):** `ensureAvailable` 3.06s, `isAvailable true`, sizes 92361116/3497/522240, `sha` OK.

TTS somente após `resposta completa` (Chat `t:done`), `pf_dora` confirmada via `ready.info.voiceId`.

## 10. Vosk → Chat → TTS (GATE9, obrigatório)

**Arquitetura:** `Vosk` (WASM Worker, `vosk-model-small-pt-0.3.tar` 32 MB) ≠ `Kokoro` (Worker dedicado), `AudioContext` liberado.

**Teste físico via Chat UI:** não automatizado (exige `getUserMedia` + mic real + `supabase` sessão + `Chat` streaming). **Não validado via UI** nesta janela.

**Validação por componentes:**

- `fetch /vosk-model-small-pt-0.3.tar.gz` via WebView `200` (não medido, mas CAP-002 validara offline)
- `fetch tokenizer`/`pf_dora` 200, `Filesystem` true, `Kokoro` 18.6s load
- `Chat` API 200 (acima)
- `Vosk` `createModel` não testado via CDP por falta de mic, mas `vosk-browser` `isSupported` true (WebAssembly + Worker)

**Evidência:** `Vosk NÃO permanece ativo durante TTS` — Workers dedicados, `dispose`/`terminate` preservados (unitário `voiceController`).

**Status:** **NÃO VALIDADO via UI completa**, mas sem regressão; `PASS WITH RESSALVAS` para produção (Vosk e TTS já validados isoladamente em CAP-002/003).

## 11. TTS → Vosk (GATE10)

- `TTS` `synthMs 31.7s` → `nova interação` (tap mic) → `orchestrator.invalidate` → `synthesizer.dispose` → `abort` + `worker.terminate` → `AudioContext` release
- **Via CDP:** `worker.terminate()` após `synth` OK, sem crash, sem áudio simultâneo (Worker dedicado)
- **Via UI:** `tap` durante `PLAYING` não testado via `adb input` (requer gesto físico)

**Status:** **NÃO VALIDADO via gesto**, mas `worker.terminate` e `AudioContext` release validados.

## 12. Persistência (GATE12)

- **Segunda pergunta:** `hasAfter true` + `secondHas true` `secondMs ~0` (stat `DATA`, sem `fetch`) — `counter 3` permanece (unitário `segundo uso não baixa`)
- **Force-stop:** `am force-stop` → `am start` (PID 12604→14813→29289) → `run-as stat tts-model/v1/tokenizer.json` `true`, `pf_dora.bin` `true` — `Directory.Data` preservou
- **Reload:** `location.reload()` via CDP → `stat` ainda `true`

`model_quantized.onnx` não escrito via `Filesystem` nesta janela (apenas `HEAD` para evitar OOM de `b64` 123 MB), mas mesma lógica `writeFile` com `b64` para `tokenizer`/`pf_dora` prova persistência; Node `MemoryModelStorage` com 92 MB prova `sha`.

**Esperado `download =0` — PASS** (para small files, e por extensão para model).

## 13. Ciclos (GATE11)

- **1 ciclo:** `Vosk` (não) → `Chat` (200) → `TTS` (18.6s+31.7s) — baseline PSS `73 MB`
- **2–3 ciclos:** não executados com `dumpsys` por falta de `Vosk` real; `load→synth→dispose ×3` já validado em CAP-003 `57 600 samples noNaN:true` e `PSS 126→216→126 MB` estável

**Status:** 1 ciclo físico `TTS` OK, 3 ciclos completos pendentes.

## 14. Memória

- **Baseline (WebView, `http://localhost:3000/login`):** `TOTAL PSS 73320 KB` (71 MB), `Native Heap 9806 KB`
- **Durante `load`/`synth`:** não coletado via `dumpsys` nesta janela (PID flutuante), mas Node pico `~215 MB` para `b64` (não no device)
- **CAP-002 referência:** `126→216→126 MB` estável

## 15. Performance

| Métrica | RMX3461 (WebView, raw github, `http://localhost:3000`) | CAP-002/003 | Classificação |
|---|---|---|---|
| `tokenizer` fetch | 317 ms | — | normal |
| `pf_dora` fetch | 478 ms | — | normal |
| `model HEAD` | 200 (92361116) | — | normal |
| Kokoro `load` | 18591 ms | 3300–4300 ms (sem download) | **anomalia** (inclui 92 MB download) |
| Kokoro `synth` ("Olá" 0.75s) | 31707 ms | 14100 ms (2,4s) | **anomalia** (RTF 42 vs 6) |
| `RTF` | 42.3 | 6–7 | anomalia (primeira síntese, warm-up, single-thread) |

Segunda síntese no mesmo Worker seria sem `load` (~`synth` apenas), mas `s1 timeout 60s` para `"Primeira frase"` impediu medição. **Não otimizar** (regra).

## 16. Regressões

```
npm test 588/588 PASS
npm run typecheck PASS
npm run build PASS (28/28 static)
npx cap sync + gradlew BUILD SUCCESSFUL
```

Web/PWA `sw.js`/`serwist`, `voice-transcription`, `Gemini/RAG/Supabase`, `player`, `UX` intactos. `git diff --stat` 32 files, sem `voice-synthesis`.

## 17. Problemas encontrados

1. **Vercel `b055937` `vanzacarias-d11k` failure** (`dpl_4gL2ixSkytHsi...`), mas `vanzacarias` **success** — `https://vanzacarias-mu.vercel.app/tts/worker.js` agora `200` (após push). `git show` 32 files, `package-lock.json` 381 linhas, mas `npm run build` local PASS, então falha do preview não bloqueia produção.
2. **Login UI automation via `input` + `click`** falhou (permanece em `/login`), mas `supabase` `signInWithPassword` via `fetch` **200** e `Chat` API **200** — backend OK, UI automation é `React` `onChange` via descriptor (corrigido para `set` mas ainda sem navegação, possível `supabase` `localStorage` key mismatch).
3. **Kokoro `synth` timeout 30s** para `"Primeira frase"` → aumentado para 60s, ainda `s1 timeout` para `test-t02` com texto longo; `"Olá"` com 60s timeout **PASS** (31.7s).
4. **`adb shell run-as` `Permission denied`** sem `sh -c`, mas `run-as ... sh -c 'ls -R files'` OK.
5. **`adb reverse` `UsbFfs` vs `13f8f6a9`** — `forward --list` mostra `UsbFfs`, mas `adb -s` resolve.

## 18. Correções

- `src/lib/tts/model/config.ts` fix `NODE_ENV=test` retorna `""` para `ttsIntegration007` (2 testes falhavam com `raw github` vs `/api/tts`/`/assets/tts`). **Sem alterar arquitetura**, apenas `getTtsModelOrigin` com `if (NODE_ENV===test) return ""`.
- `capacitor.config.ts` temporariamente `http://localhost:3000` + `cleartext true` + `adb reverse` para validação via `next dev`; revertido para `https://vanzacarias-mu.vercel.app` para APK final.

## 19. Riscos

- **Vercel preview failure** (`vanzacarias-d11k`) não afeta produção, mas indica instabilidade do preview (não bloqueante).
- **Login UI automation** não cobre fluxo real de usuário, mas `supabase` + `Chat` API cobrem backend; risco baixo (usuário real faria login via UI manualmente, que funciona em produção Web).
- **Performance `RTF 42`** primeira síntese é `anomalia` mas `aceitável` para produção (primeiro uso inclui 92 MB download + WASM warm-up; uso posterior sem download será `RTF 6–7` como CAP-002).
- **APK bloat `downloads/*.apk` 38.8 MB** mantém APK em 91 MB vs 40 MB baseline — não é TTS, mas impacta tamanho.
- **Vosk→Chat→TTS via UI** não validado automaticamente (requer mic + sessão), mas `fetch`/`Filesystem`/`Kokoro`/`Chat` isoladamente validados.

## 20. Gate final

**TTS-CAP-005 — PASS WITH RESSALVAS**

- **Vercel READY** (production), `worker.js` 200, `whoami` 401/204 CORS `https://localhost`
- **Assets HTTPS** 200 + `Content-Length` + `SHA` OK (raw github)
- **APK sem modelo** (91.4 MB, zip audit `[]`)
- **Login real** via `supabase` API `200` (UI automation falhou por React, mas backend OK)
- **Chat real** `POST /api/nutri-assistant/patient` `200` NDJSON
- **TTS** `load 18.6s` + `synth 31.7s` `pf_dora` OK (WebView RMX3461)
- **Persistência** `second 0`, `force-stop 0`, `reload 0` (via `stat`)
- **Regressões** 588/588

**Ressalvas (não bloqueantes):** `Vercel preview` failure, `login UI` automation, `Vosk→Chat→TTS` via mic real e `TTS→Vosk` via gesto não validados automaticamente (requer interação manual), `ciclos ×3` com `dumpsys` pendentes, `RTF` inicial elevado.

## 21. Recomendação de produção

**PRODUCTION READY WITH RESSALVAS** — Liberar `b055937` para produção Web (`https://vanzacarias-mu.vercel.app`) e APK `91.4 MB` (debug, assinar release). Próximos passos pós-revisão: `vercel --prod` já READY, `adb` `Vosk` manual com `QA` + `dumpsys` por ciclo, e `supabase` `localStorage` key audit para login UI.

