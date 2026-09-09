# TTS-CAP-001 REPORT (retomada — validação física)

> Período: 2026-09-08 (retomada) · Dispositivo físico: **Realme RMX3461 (RMX3461T2), Android 11 (SDK 30), arm64-v8a** · WebView Chrome/151.0.7922.199 · Capacitor 8 (PoC isolada `_tts-cap-poc`) · Engine: `voice-synthesis` (intacto) · Evidência: VALIDADO FISICAMENTE / VALIDADO AUTOMATICAMENTE / NÃO VALIDADO / BLOQUEADO

## Resumo da decisão

**`B — VIÁVEL COM ADAPTAÇÕES`**

A arquitetura já aprovada para Web/PWA (Kokoro Q8 + `pf_dora` + vozz/G2P + `onnxruntime-web`/WASM + Dedicated Worker + AudioResult + player WebView) **executou fisicamente no RMX3461** (síntese real, 6 textos, 3 ciclos + reload, online e offline). A adaptação delimitada necessária para o Capacitor é a **distribuição dos assets pelo próprio app/APK (estratégia A)** — validada fisicamente — em vez de depender das rotas de dev `/api/tts/**`; o Service Worker/Cache Storage **existe no WebView** (sonda registrou), mas **threads WASM não** (COI=false) e a estratégia PWA de download+CacheFirst **não foi re-validada de ponta a ponta neste WebView** (recomenda-se como passo opcional seguinte).

---

## VALIDADO FISICAMENTE (executado no RMX3461)

- **Worker dedicado** inicia no WebView; `/assets/tts-worker.js` (bundle real do Browser Runtime) carrega; mensagens `init/synth/dispose` funcionam; AudioResult atravessa corretamente. Nenhum erro de CORS/origin/URL/MIME/fetch/WASM observado (assets locais do mesmo scheme).
- **ONNX Runtime Web 1.29.0 / WASM**: carrega no WebView; Kokoro Q8 (`model_quantized.onnx`) e `pf_dora` carregados; execução sem crash; **sem NaN** (ciclos registram `noNaN:true`); resultado com 57 600 samples (2,4 s @24 kHz) nas frases de referência.
- **Síntese física (ronda online e offline idênticas — assets locais):**

| Teste | Texto (normalizado p/ exibição) | ok | Tempo total (ms) | Áudio tocado (s) |
| --- | --- | :-: | ---: | ---: |
| T01 curta | "Olá! Como posso ajudar você hoje?" | ✅ | 22 539 / 22 310 | 2,40 |
| T02 `500 kcal` | "Você consumiu 500 quilocalorias hoje." | ✅ | 21 480 / 21 499 | 3,13 |
| T03 `500 ml` | "Beba 500 mililitros de água." | ✅ | 16 975 / 16 989 | 2,48 |
| T04 `10h30` | "Seu próximo lanche é às 10 e 30." | ✅ | 17 723 / 17 986 | 2,60 |
| T05 `82,5 kg` | "Sua meta é reduzir 82 vírgula 5 quilogramas." | ✅ | 26 739 / 27 003 | 3,93 |
| T06 texto longo | resposta longa de nutrição | ✅ | 60 783 / 62 080 | 8,90 |

- **Ciclos de memória (3× load→synth→dispose + reload)** — ronda online:

| Fase | load (ms) | synth (ms) | samples | noNaN | PSS (MB) pós-fase |
| --- | ---: | ---: | ---: | --- | ---: |
| Ciclo 1 | 4 146 | 14 574 | 57 600 | ✅ | load ~217 / dispose ~152 |
| Ciclo 2 | 4 867 | 14 770 | 57 600 | ✅ | dispose ~140–162 |
| Ciclo 3 | 3 406 | 14 321 | 57 600 | ✅ | dispose ~151 / fim ~122–139 |
| Reload | 3 351 | 14 295 | 57 600 | ✅ | fim ~122–192 (ruído de amostragem) |

  **Sem crescimento progressivo**: PSS no fim ≈ início (121–139 MB), Native Heap 6–16 MB com variação de GC; não há evidência de leak nos ciclos testados.
- **Reload pós-dispose**: 4º load (3,3 s) + synth (14,3 s) funcionais.
- **Reprodução**: cada fala terminou em `ended` com samples chegando ao grafo de áudio do WebView (AudioContext → saída do dispositivo). **AUDIÇÃO FÍSICA (ouvir pelo alto-falante): BLOQUEADO para o agente** — não há como o agente confirmar o som percebido; não foi transformado em PASS auditivo (ver NÃO VALIDADO).
- **Offline (ronda 2 com `svc wifi/data disable`)**: suite completa repetida com **sucesso idêntico** (O1–O5 cobertos: 1º uso, 2ª fala, fechar/reabrir via `force-stop`, sem rede, novas respostas offline). Assets locais ⇒ offline por construção (O7 não se aplica: não há download em runtime nesta estratégia). **O6 (replay offline) NÃO VALIDADO** nesta rodada (não executado no device).

## VALIDADO AUTOMATICAMENTE (host/ADB/build)

- PoC instalada e orquestrada por ADB: `adb reverse tcp:9876`, telemetria http, `dumpsys meminfo` por fase, `svc wifi/data disable` para offline.
- APK da PoC: `_tts-cap-poc/android/app/build/outputs/apk/debug/app-debug.apk` — **94 299 351 B (~90 MB)** com ~169 MB brutos de assets comprimidos (modelo 92,4 MB + voz 0,52 + tokenizer + worker + variantes WASM ort-web). Instalação: `Success`.
- Regressões web (repositórios intactos neste sprint): `vanzacariasnutri` typecheck/test/build e `voice-synthesis` typecheck/typecheck:tests/build/test verdes nas rodadas anteriores ao PoC; nenhum código dos repositórios foi alterado nesta retomada (PoC isolada fora deles) — ver §18.
- Sonda WebView (2 rondas): `worker=true wasm=true caches=true indexedDB=true sw=registered cores=8 crossOriginIsolated=false persisted=false quota=10 GB`.

## NÃO VALIDADO

- **Audição física** do áudio (agente não ouve) — a reprodução observada é do grafo de áudio; percepção sonora requer humano.
- **Vosk + Kokoro simultâneos no device** (a PoC isolada não contém Vosk; STT não modificado). Análise: são workers/módulos independentes; validação quantitativa fica para o app integrado.
- **Estratégia PWA B no WebView de ponta a ponta** (download → CacheFirst → worker servido do cache → offline): a sonda mostra SW/Cache **disponíveis** (`registered`, `caches=true`), mas o fluxo completo B não foi executado no device (a PoC usou assets locais/A).
- **O6 replay offline** e **persistência de armazenamento** (persisted=false; quota 10 GB disponível) no device.
- Java Heap detalhado (`dumpsys` parser não capturou a coluna) — PSS/Native Heap registrados.

## BLOQUEADO

- **Nada bloqueia a arquitetura** no WebView. Threads WASM estão indisponíveis (COI=false) — não é bloqueio, é modo single-thread (desempenho medido acima).

---

## 1. Ambiente
Windows 10 · JDK 21 · Android SDK (`ANDROID_HOME`) · adb OK · Capacitor 8.5.1 (PoC) · Node v22.21.0 · dispositivos: RMX3461 físico (conectado) · AVDs existentes (não usados como evidência).

## 2. Configuração Capacitor (projeto de produção)
Capacitor 8.x · `appId br.com.vanusazacarias.nutri` · `webDir public` · `server.url = https://vanzacarias-mu.vercel.app` (remoto) · `androidScheme https` · compileSdk/targetSdk 36 · minSdk 24 · Gradle 8.14.3 · permissões INTERNET/RECORD_AUDIO/MODIFY_AUDIO_SETTINGS.

## 3. Dispositivo físico
RMX3461 (RMX3461T2) · Android 11 (SDK 30) · arm64-v8a · WebView Chrome/151 · estado `device`.

## 4. Arquitetura testada
PoC isolada `_tts-cap-poc` (fora dos repositórios) — Capacitor app local (`https://localhost`, sem `server.url`) empacotando os **mesmos assets reais** e a **mesma cadeia**: Browser Runtime (`createTtsService`) → Worker `/assets/tts-worker.js` → `onnxruntime-web@1.29.0` WASM → Kokoro Q8 + `pf_dora` + vozz/G2P → AudioResult → player AudioContext do WebView. Sem bridge nativa/WebGPU/server/segundo SW.

## 5. Estratégia de assets testada
**A — assets no APK/local (WebView)** — validada fisicamente (funciona online e offline). **B — Cache Storage (PWA)**: WebView **tem** SW+Caches (sonda), porém fluxo completo não re-validado no device; **C — híbrida**: arquitetura natural desta PoC (assets locais; modelo pode vir a ser baixável no futuro). Escolha pela evidência: **A (local) é a estratégia que deve ser usada no Capacitor**, mantendo B como caminho para navegadores/PWA e como opção futura de download (SW disponível no WebView).

## 6. Worker
VALIDADO FISICAMENTE: criação, carregamento do bundle, módulos, comunicação página↔Worker, init/synth/dispose, transferência do AudioResult; sem erros de origem/MIME/fetch.

## 7. ONNX Runtime
VALIDADO FISICAMENTE: WASM carrega, Q8 + `pf_dora` executam, sem NaN/crash, samples válidos (57 600). Sem `onnxruntime-node`/espeak/Python/WebGPU.

## 8. Métricas
Tabelas de síntese (T01–T06) e ciclos acima. RTF ≈ **6–7** no dispositivo (2,4 s de áudio em ~14–15 s de síntese no ciclo; fala completa 17–27 s por texto curto/3–9 s de áudio) — single-thread (COI=false). Nenhuma otimização aplicada.

## 9. Memória
PSS ~121–217 MB ao longo dos ciclos; pós-dispose volta a ~122–166 MB; sem crescimento progressivo nos 3 ciclos + reload. Native Heap 6–16 MB (GC). Não confundir pico de load (~200 MB, arena do modelo) com leak.

## 10. Vosk + TTS
NÃO VALIDADO no device (PoC sem Vosk). STT intocado. Coexistência: sem evidência de conflito (independentes), validação quantitativa pendente no app real.

## 11. Offline
O1–O5 VALIDADOS (ronda 2 com rede desligada — suite completa idêntica). O6 replay: NÃO VALIDADO. O7: não se aplica (assets locais). SW/Cache existem no WebView; a obtenção de assets do cache (fluxo B) não foi revalidada ponta a ponta.

## 12. APK
PoC debug **94 299 351 B** (com assets ~169 MB brutos → ~90 MB no APK). Baseline do app de produção (sem TTS): debug 42 671 432 B / release 40 726 404 B — referência; a PoC é app separado, não o APK de produção.

## 13. Problemas encontrados
1. `server.url` remoto no app de produção impede TTS local por padrão → a PoC rodou **sem `server.url`** (adaptação nº 1). 2. Threads WASM indisponíveis (COI=false) → single-thread (desempenho registrado; sem WebGPU). 3. `dumpsys` Java Heap não parseado (limitação do coletor). 4. Em versões de WebView sem SW/Cache (não é o caso deste device), B não valeria — assets locais (A) são imunes a isso.

## 14. Limitações
Audição física e Vosk simultâneo não validados; fluxo PWA B não revalidado ponta a ponta no WebView; um único device/browser (WebView Chrome 151); desempenho single-thread é a referência.

## 15. Decisão recomendada
**B — VIÁVEL COM ADAPTAÇÕES**, com a menor adaptação delimitada:
> problema: assets servidos por rotas de dev/`server.url` remoto não existem no WebView/APK
> causa: arquitetura atual espera `/api/tts/**` + rede/SW (PWA)
> menor adaptação: distribuir os assets do Browser Runtime pelo bundle Capacitor (`webDir`) — estratégia A local validada; Worker/`wasmPaths`/`baseUrl` apontando para o scheme local; sem `server.url` para builds TTS
> impacto: APK ~+86–90 MB (modelo 92,4 MB comprime pouco); offline imediato; sem dependência de SW no WebView
> evidência: rodadas online e offline da PoC no RMX3461 (todas as sínteses e ciclos PASS; sonda SW/Cache disponível como extensão futura)

## 16. Riscos
APK maior (~90 MB) vs disponibilidade imediata; desempenho single-thread (RTF ~6-7) em conversa longa; quota/persistência não solicitada (`persisted=false`; quota 10 GB disponível); necessidade de revalidar B (download+CacheFirst) se a estratégia de download for adotada futuramente.

## 17. Evidências / logs
- `_tts-cap-poc/result-poc.json` (112 eventos; cópia em `docs/TTS-CAP-001-POC-EVIDENCE.json`).
- Logcat/telemetria por fase (meminfo PSS/Native) no mesmo arquivo.
- APK da PoC: `_tts-cap-poc/android/app/build/outputs/apk/debug/app-debug.apk` (94 299 351 B).

## 18. Regressões
- Web: `vanzacariasnutri` typecheck/test/build (571 testes) e `voice-synthesis` typecheck/typecheck:tests/build/test (59✓) verdes nas rodadas desta sessão; **nenhum código dos repositórios alterado nesta retomada** (PoC isolada fora deles); Service Worker do app preservado.
- Android: Gradle `assembleDebug` da PoC BUILD SUCCESSFUL; instalação `Success`; execução física validada (acima).
