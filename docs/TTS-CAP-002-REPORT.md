# TTS-CAP-002 REPORT

> Período: 2026-09-08 · App real: `vanzacariasnutri` (Capacitor 8 · Android SDK 36/24 · Gradle 8.14.3) · Dispositivo físico: Realme RMX3461 (Android 11, arm64-v8a, WebView Chrome 151) · Engine: `voice-synthesis` intacto · Liberado após TTS-CAP-001 = PASS/B (assets locais no APK)

## Decisão

**GATE: PASS (integração TTS Android, escopo definido)** — com ressalvas explícitas em VALIDADO/NÃO VALIDADO. **STOP** (sem produção/integração extra).

A integração real usa a **menor adaptação comprovada no CAP-001**: assets TTS **locais no bundle Capacitor** (`/assets/tts/**`) + a **mesma cadeia** aprovada (Browser Runtime → Dedicated Worker → onnxruntime-web/WASM → Kokoro Q8 + pf_dora + vozz → AudioResult → player existente). Web/PWA **intactos** (modo separado por ambiente).

---

## VALIDADO WEB

- Consumer mantém defaults web (`/api/tts/models|wasm/*` + `/tts/worker.js` + CacheFirst `tts-assets-v1`) quando **não** é Capacitor nativo.
- Regressões verdes: `vanzacariasnutri` typecheck / testes / build e `voice-synthesis` typecheck / typecheck:tests / testes / build (ver REGRESSÕES).
- Testes de contrato ampliados (8/8) cobrindo o **modo nativo** (`detectNativeCapacitor` → assets locais `/assets/tts/**`).

## VALIDADO ANDROID

Implementação (mínima, sem duplicar engine/G2P/player/Worker):
- `synthesizer.ts`: nova `detectNativeCapacitor()` (via `Capacitor.isNativePlatform/getPlatform` — **não** por hostname) + `NATIVE_ASSET_DEFAULTS` (`/assets/tts/`, `/assets/tts/wasm/`, `/assets/tts/worker.js`). Seleção: browser+PWA → defaults web; Capacitor nativo → defaults locais. Override por `options.browser` continua válido.
- `scripts/prepare-tts-android-assets.mjs` (+ `npm run android:tts:assets`): copia **somente** o necessário ao runtime Android (8 arquivos, 128,9 MB: `model_quantized.onnx`, `tokenizer.json`, `voices/pf_dora.bin`, `worker.js`, `ort-wasm-simd-threaded.{mjs,wasm}`, `ort-wasm-simd-threaded.jsep.{mjs,wasm}`) para `public/assets/tts/**` (GITIGNORED → não vai ao deploy web/Vercel). Sem FP32/laboratório/benchmark/espeak/Python/onnxruntime-node.
- APK real integrado (debug): **160 856 645 B (~153,4 MB)** vs baseline **42 671 432 B (~40,7 MB)** → **+~112,7 MB** (modelo Q8 dominante) — compatível com a referência CAP-001.

## VALIDADO FISICAMENTE (RMX3461 — modo nativo `/assets/tts/**`)

Execução no device (ronda online e **offline** com `svc wifi/data disable` — idênticas):

| Teste | ok (on/offline) | tempo total | áudio (s) |
| --- | :-: | ---: | ---: |
| T01 curta | ✅/✅ | 22,8 / 22,1 s | 2,40 |
| T02 `500 kcal` | ✅/✅ | 21,3 / 21,2 s | 3,13 |
| T03 `500 ml` | ✅/✅ | 17,0 / 17,0 s | 2,48 |
| T04 `10h30` | ✅/✅ | 17,7 / 17,7 s | 2,60 |
| T05 `82,5 kg` | ✅/✅ | 26,8 / 26,8 s | 3,93 |
| T06 longo | ✅/✅ | ~60 s | 8,90 |

- **Worker/ORT/WASM/Kokoro/pf_dora/vozz**: funcionam no WebView com assets locais (sem erro de origem/MIME/fetch; `worker=true wasm=true`; COI=false → single-thread, característica conhecida, sem forçar threads).
- **Ciclos de memória 3× + reload (online e offline)**: load 3,3–4,3 s; synth 14,1–14,6 s (2,4 s de áudio); 57 600 samples; `noNaN:true`; **sem crescimento progressivo** (PSS ~130–225 MB; fim ~130 MB; Native 6–17 MB).
- **Offline**: instalado → sem rede → abre → fala (assets locais; sem Vercel, sem `/api/tts`, sem CDN, sem Service Worker como requisito). Service Worker do app continua existindo mas não é requisito do TTS local.

## NÃO VALIDADO

- **Fluxo Chat completo no Android (UI real + Gemini/Supabase remoto)**: o app real carrega conteúdo remoto (`server.url` → Vercel) e o Chat depende de backend online; a validação física executou a **mesma cadeia que o Chat invoca** (consumer → controller → orchestrator → Browser Runtime → player) com assets locais — a UI/Chat ponta-a-ponta no device não foi executada nesta rodada (requer sessão/backend) e **não é reportada como validada**.
- **Vosk + Kokoro simultâneos no app real** (STT não modificado; PoC sem Vosk) — sem evidência de conflito; validação quantitativa pendente.
- **Audibilidade física** (agente não ouve) — reprodução observada no grafo de áudio do device; percepção sonora requer humano.
- Estado de pausa/resume/replay/interrupção **no Android**: comportamentos cobertos pelos testes do controller/orchestrator (mesmo código do Chat); não re-executados um a um como gestos no device nesta rodada.

## PROBLEMAS

- Nenhum bloqueante. Observações:
  1. App real usa `server.url` remoto → modo local/assets locais exige build/execução sem `server.url` (já é o comportamento da PoC e dos debug builds Capacitor que rodam local); para o app publicado que carrega o site remoto, o TTS local exige revisão de deploy (produção — fora do escopo; não alterado).
  2. `dumpsys` Java Heap não parseado (PSS/Native registrados).

## ADAPTAÇÕES

- Modo Capacitor no consumer (assets locais `/assets/tts/**`) — implementada.
- Empacotamento mínimo por script + gitignore (APK sem lixo; web intocado) — implementada.
- Chat real no device, Vosk simultâneo e audição: **não são adaptações de código TTS** — permanecem NÃO VALIDADOS (validação posterior com backend/sessão).

## MÉTRICAS

- Primeiro load físico: Worker/ORT/modelo prontos em **~3,3–4,3 s** (ciclos); fala curta ponta-a-ponta **~17–23 s** (single-thread; RTF ~6–7); texto longo ~60 s. Latência percebida: mesma ordem da síntese (sem streaming/otimização — fora do escopo).
- APK: baseline 40,7 MB → integrado **153,4 MB** (+~112,7 MB).

## REGRESSÕES

- `vanzacariasnutri`: typecheck PASS · testes (inclui 8/8 do contrato nativo) · build PASS · PWA/SW preservados (nenhuma alteração em `sw.ts`/precache).
- `voice-synthesis`: typecheck / typecheck:tests / build / testes PASS — engine intacto.
- Android: `cap sync` + Gradle `assembleDebug` do app real: BUILD SUCCESSFUL; APK 160,9 MB; instalação/execução da validação física: PASS.

## DECISÃO

**PASS** para a integração TTS Android no escopo deste sprint (assets locais, Worker, ORT, Kokoro, pf_dora, vozz, offline, memória estável, Web/PWA intactos), com a lista explícita de NÃO VALIDADO acima. **STOP** — produção/publicação/nova integração ficam para decisão posterior.

Evidência: `docs/TTS-CAP-002-POC-EVIDENCE.json` (112 eventos, RMX3461, modo nativo, rondas online/offline).
