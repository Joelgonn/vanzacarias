# VOICE EXTERNAL AUDIT REPORT — Sistema de Captura de Áudio e Transcrição de Voz (Vosk PT-BR)

**Projeto:** `vanzacariasnutri` (Next.js 16.1.6, React 19.2.3, TypeScript 5, vitest 4)
**Escopo:** subsistema de voz em `src/lib/voice/**`, `src/components/ChatAssistant.tsx`, `src/app/dev/voice-test/page.tsx`, Service Worker (`src/sw.ts`, Serwist), asset `public/vosk-model-small-pt-0.3.tar.gz`
**Papel:** auditor técnico externo e independente (segunda opinião). Nenhum código, teste, configuração, banco ou documentação existente foi modificado. O `next build` regenerou apenas artefatos de build (`.next/`, `public/sw.js` idêntico ao versionado — `git status` limpo).
**Data da auditoria:** verificação contra o estado atual do repositório (HEAD `7c36d44`, 2026-09-05).

> **Aviso metodológico (regra §18/§20):** a auditoria foi conduzida sobre **evidência real de código, testes executados, typecheck, build e leitura da API de terceiros**. Não havia dispositivo Android físico nem microfone no ambiente desta auditoria. Portanto, nenhuma afirmação sobre Android/dispositivo real neste relatório é "validada por esta auditoria": as evidências de dispositivo citadas provêm dos relatórios internos `docs/VOZ-*.md`, que **se contradizem em pontos críticos** (ver §8, §10, §12) e cuja validação física final foi declarada `PENDING` pelos próprios relatórios. Essas afirmações são classificadas explicitamente como `DOC-REPORTADO` e tratadas como pistas, não como fato.

---

# 1. Executive Summary

O subsistema de voz do ChatAssistant é uma implementação **local-first, sem upload de áudio**, bem estruturada em camadas e com **qualidade de engenharia acima da média** para um recurso de chatbot:

- **Pipeline correto no caminho principal:** `getUserMedia → AudioContext/ScriptProcessor → PCM Float32 na taxa real → resample linear p/ 16 kHz mono → trim de silêncio + normalização por pico → Vosk (vosk-browser/WASM Worker) → texto → textarea (concatenação sem auto-send)`.
- **Lifecycle robusto:** token de geração (`gen`) invalida resultados obsoletos; gravação inicia antes do load do modelo (feedback imediato); `stop()` aguarda load pendente; cancel/dispose limpam mic, AudioContext, recorder e Worker do modelo. Estados `IDLE/LOADING/READY/TRANSCRIBING/RESULT/ERROR` com reducer puro testado.
- **Evidência executada nesta auditoria:** `vitest run` → **23 arquivos / 314 testes passando (exit 0)**; `tsc --noEmit` → **0 erros**; `next build` → **sucesso, 28 rotas**, com o aviso esperado de chunk de 5,79 MB acima do limite de precache de 5 MB.
- **Riscos reais encontrados** (nenhum confirmado como bug no caminho típico "push-to-talk de frase curta"):
  1. **Sobrescrita em vez de acumulação de resultados parciais-finais do Vosk** (`stt/vosk.ts`): se o Vosk emitir mais de um evento `result` na mesma sessão (pausas internas ≥ limiar de endpoint — o modelo não possui `conf/model.conf`), palavras do(s) primeiro(s) segmento(s) podem ser perdidas. **POSSÍVEL, não verificado em dispositivo**, e não coberto por testes.
  2. **Sem limite de duração de gravação** nem indicador de tempo: gravações acidentais longas acumulam PCM em memória sem teto.
  3. **Interrupções Android no meio da gravação** (chamada, tela bloqueada, perda de foco) não são tratadas (sem `statechange`/`visibilitychange`); o áudio pode conter buracos silenciosos sem aviso.
  4. **Primeiro uso móvel custa ~38 MB** (chunk 5,79 MB + modelo 32,4 MB) e o modelo é descarregado a cada desmonte do ChatAssistant (navegação), com recarga completa por visita.
  5. **Validação física Android do caminho de produção permanece pendente/contraditória nos docs** — a resolução do sintoma original de produção ("transcrição vazia/1 palavra no Android") nunca foi fechada com um run documentado e consistente.

**Veredito:** `READY WITH MINOR RISKS` (ver §15) — condicionado a: (a) teste em dispositivo com ditado longo contendo pausa (F01), e (b) validação física única e consistente do caminho ChatAssistant em Android real, que os próprios relatórios internos nunca concluíram.

---

# 2. Architecture Discovered

## 2.1 Stack

| Item | Valor encontrado |
|---|---|
| Framework | Next.js **16.1.6** (App Router), React **19.2.3** |
| Package manager | npm (`package-lock.json` 816 KB) |
| TypeScript | `^5`, `strict: true`, `moduleResolution: bundler` |
| STT | `vosk-browser@0.0.8` (WASM Web Worker clássico, base64/Blob), modelo **`vosk-model-small-pt-0.3`** local em `public/` (32.405.987 B ≈ 30,9 MiB) |
| STT alternativo (lab) | `@moonshine-ai/moonshine-js@0.1.29` (registrado, porém **não utilizável** — ver F12) |
| PWA | `@serwist/next@9.5.7`, `swDest: public/sw.js`, precache limitado a 5 MB |
| Testes | vitest 4.1.10 (node env, sem browser) |

## 2.2 Camadas e arquivos (mapa real)

```
src/components/ChatAssistant.tsx          → UI do chat; botão mic; injeta transcrição no textarea (concatena, sem auto-send)
src/lib/voice/useVoiceInput.ts            → Hook React fino (espelha status/transcript/error; dispose no unmount)
src/lib/voice/voiceController.ts          → VoiceInputController: orquestra captura→engine→texto; flags+gen token; estados
src/lib/voice/audio/capture.ts            → captureAudio() (getUserMedia+AudioContext+resume), createPcmRecorder()
                                             (ScriptProcessor 4096), resampleTo16k() (linear)
src/lib/voice/audio/normalize.ts          → normalizePcm() (DC + ganho p/ pico 0,9), trimSilence() (janela 100 ms, >500 ms)
src/lib/voice/stt/registry.ts             → STT_ENGINES (singletons): 'vosk-pt-br' + 'moonshine-tiny'
src/lib/voice/stt/engineState.ts          → reducer puro de EngineState + canLoad/canTranscribe/isEngineReady
src/lib/voice/stt/vosk.ts                 → loadVoskModel() (fetch 32 MB no Worker), transcribeWithVosk() (chunked
                                             acceptWaveformFloat 4096 + retrieveFinalResult), disposeVoskModel()
src/lib/voice/stt/engines/vosk.ts         → adapter STTEngine do Vosk (closure cachedModel)
src/lib/voice/stt/engines/moonshine.ts    → adapter Moonshine (não utilizável — F12)
src/lib/voice/stt/moonshine.ts            → runtime Moonshine (legacy lab; import via eval)
src/lib/voice/debug.ts                    → instrumentação numérica gated por NEXT_PUBLIC_VOICE_DEBUG==='1'
src/lib/voice/metrics.ts                  → WER/CER/RTF (usado em testes/bench)
src/lib/voice/dataset/*                   → dataset sintético sem PII (sem áudio real)
src/app/dev/voice-test/page.tsx           → lab dev (877 linhas; duplica resample; separação MIC vs FIXTURE)
public/vosk-model-small-pt-0.3.tar.gz     → modelo Vosk (30,9 MiB) — carregado pelo Worker do vosk-browser
public/moonshire.wav, public/voice-benchmark/PTBR-0x.wav → fixtures de áudio (só moonshire usado no lab)
src/sw.ts                                 → Service Worker Serwist (precache + defaultCache runtime)
```

## 2.3 Descobertas estruturais relevantes

1. **Desacoplamento framework/domínio:** o núcleo (`voiceController`, `capture`, `normalize`, `stt/*`) não importa React/Next/Supabase/domínio Nutri. O único ponto React é `useVoiceInput.ts`; o único ponto de produto é o `ChatAssistant` (§11).
2. **Code-splitting correto:** `vosk-browser` é `import()` dinâmico em `stt/vosk.ts` (chunk próprio de 5,79 MB, fora do bundle inicial); o modelo nunca entra no bundle.
3. **Instrumentação on/off em build-time** via `NEXT_PUBLIC_VOICE_DEBUG`; **confirmado compilado LIGADO** no build de produção gerado a partir de `.env.local` (ver F10).
4. **Dois pares de arquivos "gêmeos"** (`stt/vosk.ts` × `stt/engines/vosk.ts`; `stt/moonshine.ts` × `stt/engines/moonshine.ts`) indicam evolução em camadas; há código morto e duplicação (F11/F12).
5. **Docs internos (VOZ-000…VOZ-012) excedem o código em volume** e registram uma saga de depuração Android (VOZ-007→008.x) com **contradições internas** sobre qual build resolveu o quê (§12).

# 3. End-to-End Flow

Fluxo real encontrado no código (substituindo o fluxo hipotético do briefing):

```text
USUÁRIO (clique no mic)
  ↓  ChatAssistant.tsx:822  →  voice.start()
  ↓  useVoiceInput.start() → VoiceInputController.start()  (voiceController.ts:140)
  ↓
[1] Guards: start() rejeitado se loading||recording||transcribing (flag); checkSupport (secure context,
    getUserMedia, WebAssembly/Worker); engineId 'vosk-pt-br' do registry (singleton)
  ↓
[2] captureAudio(16000)  (audio/capture.ts:44)
    ├─ getUserMedia({audio:{channelCount:1, sampleRate:16000, echoCancellation:false,
    │                  noiseSuppression:false, autoGainControl:false}})
    ├─ lê MediaTrackSettings REAIS (não confia nas constraints)
    ├─ new AudioContext({sampleRate: track.sampleRate ?? 16000, latencyHint:'interactive'})
    │    com fallback SEM sampleRate (VOZ-008.5-R1: evita "WebAudio renderer error" no Android)
    └─ se state ∈ {suspended, interrupted} → await resume(); se não ficar 'running' → CaptureError
  ↓
[3] controller: verificação/resume adicional defensivo do AudioContext (voiceController.ts:193-226)
  ↓
[4] recorder = createPcmRecorder(stream, audioContext, 4096)  (audio/capture.ts:202)
    ├─ createMediaStreamSource(stream) → createScriptProcessor(4096, 1, 1)  [ScriptProcessorNode]
    ├─ onaudioprocess: push(new Float32Array(getChannelData(0)))  (cópia de ~4096 amostras @ctxRate)
    └─ start(): active=true; source→processor→destination (silêncio de saída; mantém o grafo ativo)
  ↓  status = 'recording' ANTES do load do modelo (VOZ-012: sem congelamento)
[5] engine.load() em background (só se engineState não for READY/RESULT)
    ├─ engine (stt/engines/vosk.ts) → loadVoskModel('small-pt-0.3') (stt/vosk.ts:60)
    │   ├─ import('vosk-browser') dinâmico (chunk 5,79 MB)
    │   ├─ new Vosk.Model('/vosk-model-small-pt-0.3.tar.gz') → Worker clássico fetches 32 MB
    │   └─ aguarda evento 'load' (timeout 120 s)
    └─ pendingEngineLoad registrado — stop() aguarda esta promise (anti-race VOZ-012)
  ↓
USUÁRIO (clique stop)  →  voice.stop()  →  VoiceInputController.stop()  (voiceController.ts:304)
  ├─ pcm = recorder.stop()  → concatenação de TODOS os chunks Float32 (taxa real do AudioContext, ex. 48 kHz)
  ├─ cleanup: source.disconnect/processor.disconnect, stream.stop(), audioContext.close()
  ├─ se PCM vazio → erro 'empty' (sem chamar Vosk)
  ├─ se engine ainda LOADING → await pendingEngineLoad (gen preservado)
  ├─ resample: recordedRate==16000 ? pcm : resampleTo16k(pcm, recordedRate, 16000)  (linear)
  ↓
[6] engine.transcribe(pcm16k, 16000)  →  transcribeWithVosk (stt/vosk.ts:87)
    ├─ VOSK_INPUT (stats numéricos)
    ├─ trimSilence(pcm, 16000, thr=0.01, min=500 ms)  → janelas de 100 ms; mantém 200 ms de margem
    ├─ normalizePcm()  → remove DC; se 0.01 ≤ pico < 0.5 → ganho p/ pico 0.9 (clamp [-1,1])
    ├─ new model.KaldiRecognizer(16000)
    ├─ para cada chunk de 4096 amostras: recognizer.acceptWaveformFloat(chunk, 16000)  (subarray; sem cópia)
    ├─ recognizer.retrieveFinalResult() imediatamente após o loop (sem setTimeout; antes havia 100 ms fixos)
    ├─ evento 'result' (após retrieve) → finish(text) ; evento 'error' → reject ; guard de 30 s
    └─ recognizer.remove() (libera memória do recognizer no Worker)
  ↓
[7] texto trimado → engine → controller: gen ainda válido? → engineState RESULT → status 'result'
    ├─ texto vazio → erro 'empty'
    └─ texto ok → onTranscript(text)  (nunca auto-send)
  ↓
[8] useVoiceInput.onTranscript → setTranscript + ChatAssistant.onTranscript (ChatAssistant.tsx:517-531)
    └─ setInput(prev => prev.trim() ? prev.trim()+' '+text : text)  → textarea auto-cresce (max 200 px + scroll)
  ↓
USUÁRIO revisa/edita e envia pelo fluxo textual normal (POST /api/nutri-assistant/*; limite 500 chars)
```

## 3.1 Características por etapa

| Etapa | Arquivo:função | Responsabilidade | Formato | Sample rate | Buffer/chunk | Sincronização | Erros | Lifecycle |
|---|---|---|---|---|---|---|---|---|
| Microfone | `audio/capture.ts:captureAudio` | adquirir stream | MediaStream (mono) | pede 16k; real é o do device (48k no Android doc-reportado) | — | permissão no gesto | CaptureError mapeado p/ códigos | stream parado no cleanup |
| AudioContext | `capture.ts:82-150` | PCM e grafo | — | = sampleRate real (fallback sem hint) | — | `resume()` se suspended/interrupted | falha se não 'running' | `close()` no cleanup |
| Gravação | `createPcmRecorder` | acumular PCM | Float32Array por callback | taxa do ctx | 4096 amostras (~85 ms @48k; 256 ms @16k) | callback do audio thread | try/catch em criação | `active/finished` flags |
| PCM final | `recorder.stop()` | concatenação | Float32Array único | taxa do ctx | soma de todos | síncrono no stop | — | teardown no stop/cancel |
| Resample | `capture.ts:resampleTo16k` | 48k/44.1k→16k | Float32 mono | 16000 | linear, 1 amostra por saída | síncrono | — | puro |
| Pré-proc | `normalize.ts` (chamado em `stt/vosk.ts:113-133`) | trim+nomalização | Float32 mono | 16000 | janelas 100 ms | síncrono | — | puro |
| Vosk feed | `stt/vosk.ts:200-219` | decodificação | Float32→HEAP (×0x8000 no lib) | 16000 | 4096 amostras por mensagem | fila de mensagens do Worker (ordem garantida) | guard 30 s; error event | recognizer.remove() no fim |
| Resultado | `recognizer.on('result')` + `retrieveFinalResult` | texto final | string | — | — | evento pós-retrieve | — | finish() idempotente |
| Entrega | `voiceController.ts:438-476` | valida gen, status, callback | string | — | — | gen token | transcribe_failed / empty | estado RESULT |

# 4. Findings

Severidade: CRITICAL / HIGH / MEDIUM / LOW / INFO — Confiança: CONFIRMADO / PROVÁVEL / POSSÍVEL — Categoria: CORREÇÃO FUNCIONAL / PERFORMANCE / CONCORRÊNCIA / AUDIO / STT / ANDROID / UX / ARQUITETURA / MANUTENÇÃO / TESTES / SEGURANÇA

| ID | Severidade | Confiança | Categoria | Problema | Evidência |
|----|-----------|-----------|-----------|---------|-----------|
| F01 | MEDIUM (pot. HIGH p/ ditado longo) | POSSÍVEL | STT / CORREÇÃO FUNCIONAL | Acumulação vs sobrescrita de resultados do Vosk: `finalText` é **sobrescrito** a cada evento `result`; se o Vosk emitir mais de um `result` na mesma sessão (endpoint por pausa interna — modelo sem `conf/model.conf`, defaults de endpoint ativos), palavras de segmentos anteriores podem ser perdidas no texto entregue | `stt/vosk.ts:174-179` (handler sobrescreve); worker do vosk-browser: `audioChunk→AcceptWaveform→Result()` por segmento e `retrieveFinalResult→FinalResult()` (decompilação do worker); guia Vosk: resultados devem ser **concatenados** para texto completo ([alphacep/vosk-api#499](https://github.com/alphacep/vosk-api/issues/499)); nenhum teste cobre 2 eventos `result` |
| F02 | MEDIUM | POSSÍVEL | STT / PERFORMANCE | Guard fixo de 30 s em `transcribeWithVosk` pode finalizar com texto parcial/vazio quando a inferência legítima excede 30 s (áudio longo + RTF ~1 em aparelho fraco), gerando "Nenhuma fala detectada" indevido; o guard começa antes do feed e não escala com a duração do áudio | `stt/vosk.ts:198`; RTF ~1,0–1,1 doc-reportado (realme) em docs VOZ-010; fixture 13,17 s ≈ 13,17 s de inferência |
| F03 | MEDIUM | POSSÍVEL | AUDIO / UX | Sem limite máximo de duração de gravação, sem auto-stop e sem indicador de tempo: gravação acidental longa acumula Float32 sem teto (chunks ~85 ms + cópia no stop + resample + normalize) → memória/latência em Android fraco | `createPcmRecorder` (acumula em `chunks[]`); `voiceController` sem timer/max; amostragem 48k doc-reportada |
| F04 | MEDIUM | POSSÍVEL | ANDROID / CONCORRÊNCIA | Interrupção **durante** a gravação não é tratada: não há listener de `statechange`/`visibilitychange`, nem auto-pause/stop/resume; AudioContext suspenso/interrompido (chamada, tela bloqueada, aba em background) paralisa `onaudioprocess` → buracos silenciosos no PCM sem aviso; o resume só existe no início (VOZ-008.5) | `capture.ts:105-150` e `voiceController.ts:193-226` tratam apenas estado no `start()`; ausência confirmada de listeners em todo `src/lib/voice/**`; estados `suspended/interrupted` do Android Chrome conhecidos |
| F05 | LOW-MEDIUM | PROVÁVEL | ANDROID / PERFORMANCE / ARQUITETURA | Custo de primeiro uso móvel ≈ 38 MB (chunk `vosk-browser` 5,79 MB **não precacheado** + modelo 32,4 MB) e modelo é **recarregado a cada desmonte** do ChatAssistant (navegação) porque `dispose()` faz `Model.terminate()` + `disposeVoskModel()`; sem estratégia de warm-up/preload entre visitas | Aviso do build: "`9cb48f3a...js is 5.79 MB, and won't be precached`" (limite 5 MB em `next.config.ts:10`); `useVoiceInput.ts:46-49` (dispose no unmount); `engines/vosk.ts:27-32` + `stt/vosk.ts:233-241` |
| F06 | LOW-MEDIUM | PROVÁVEL | PERFORMANCE / ANDROID | Service Worker `defaultCache` (rota `others`, NetworkFirst) **cacheia o modelo de 32,4 MB** na Cache Storage sem expiração ao primeiro fetch do Worker, e o HTTP cache pode manter cópia adicional; revalidação network-first por sessão; sem bypass nem tratamento de range para `.tar.gz` | `src/sw.ts:14-20`; rota `others` (sameOrigin, não-/api) NetworkFirst sem `ExpirationPlugin` (inspeção de `@serwist/next` `index.worker.js`); tamanho do asset |
| F07 | LOW | PROVÁVEL | CONCORRÊNCIA / ARQUITETURA | `start()` só guarda **flags** (`loading/recording/transcribing`), não `engineState` LOADING/TRANSCRIBING; chamada programática de `start()` durante load em background pós-stop dispararia `engine.load()` concorrente — e `loadVoskModel` **não deduplica** chamadas em voo → risco de 2º download/Worker (mascarado pela UI, que desabilita o mic) | `voiceController.ts:140-142` (guard por flags); `pendingEngineLoad` em `stop()` (comment VOZ-012 confirma não-dedupe); `stt/vosk.ts:60-82` (guard só após cache preenchido) |
| F08 | LOW | POSSÍVEL | UX / CONCORRÊNCIA | `cancel()` durante `await audioContext.resume()` (raro) pode produzir erro espúrio "AudioContext não está em running" após o cancelamento, pois não há re-checagem de `gen` entre o resume e o caminho de falha | `voiceController.ts:193-226` (sem `gen` check após resume) |
| F09 | LOW-MEDIUM | CONFIRMADO (quando flag ligada) | SEGURANÇA / PRIVACIDADE | `NEXT_PUBLIC_VOICE_DEBUG=1` está em `.env.local` e o build desta auditoria (que carrega `.env.local`) **compilou a instrumentação LIGADA** no bundle de produção (console `[VOICE_DEBUG]` com preview de até 80 chars da transcrição; sem áudio). Se um artefato assim for publicado, logs de voz vazam para o console do cliente; o texto transcrito completo em si só trafega pelo fluxo normal de chat (como texto digitado) | `debug.ts:4-6`; `.env.local`; build: "Environments: .env.local"; chunk 6700 compilado contém `(0,m.xe)()` (gate) + `VOICE_UI_UPDATED` |
| F10 | LOW | PROVÁVEL | MANUTENÇÃO | Duplicação do resample linear: `capture.ts:resampleTo16k` + **3 cópias inline** no lab (`voice-test/page.tsx`: runTestE, loadFixture, handleParar); os testes estáticos **forçam** a separação/duplicação em vez de reuso | grep: 4 implementações equivalentes; `voiceLabSeparation.test.ts` (asserts em fonte) |
| F11 | LOW | CONFIRMADO | MANUTENÇÃO | Código morto/legado: `floatTo16BitPCM` e `getSupportedMimeType` (só usados em teste), `stt/types.ts` sem importadores, engine Moonshine registrada no registry de produção mas **intencionalmente não utilizável** (transcribe lança; import via `(0,eval)` + specifier nu — padrão que o próprio VOZ-004-R4 corrigiu no Vosk) | grep de usos; `engines/moonshine.ts:38-42`; `stt/moonshine.ts:54-58` |
| F12 | MEDIUM | CONFIRMADO | TESTES | Lacuna real de cobertura: 314 testes passam, mas **nenhum** exercita áudio de browser real, Worker/WASM do Vosk, semântica de `result` múltiplo, Android, interrupção, nem gravação longa; vários testes são **asserts de regex sobre o texto-fonte** (frágil); fixture `moonshire.wav` sem ground-truth; fixtures `voice-benchmark/PTBR-*.wav` não usadas; docs alegam validação física com **contradições** (5/9 vs 9/9 palavras) e deixaram `PENDING` | `__tests__/*` (análise por arquivo em §12); docs VOZ-008.7 vs VOZ-009/010 (inconsistência); `voiceLabSeparation.test.ts`, `textareaVOZ012.test.ts`, `voskChunk.test.ts` (leem fonte com fs) |
| F13 | INFO | PROVÁVEL | STT / QUALIDADE | Teto de qualidade do modelo: `vosk-model-small-pt-0.3` (31M) tem WER alto em domínio aberto (doc-reportado ~32% CV), sem pontuação/caixa, números/nomes próprios frágeis, fala coloquial degrada; adequado para o micro-domínio de nutrição do produto | docs VOZ-003-R1/VOZ-011 (vendor WER); exemplos transcritos nos docs |
| F14 | INFO | CONFIRMADO | TESTES / ANDROID | Plataformas não evidenciadas por esta auditoria nem por teste automatizado: Android < 10, iOS Safari, bluetooth/fones, múltiplos mics; docs reportam apenas realme RMX3461 (Android 11, Chrome 152) | ausência em código de testes/browser; docs VOZ-008.4+ |
| F15 | LOW | POSSÍVEL | UX | Transcrições > 500 chars (limite `MAX_MESSAGE_LENGTH`) são aceitas no textarea (setInput ignora `maxLength`) e só falham no envio com mensagem genérica "Mensagem muito longa", confuso p/ voz; sem aviso no momento da transcrição | `ChatAssistant.tsx:267-270` (rejeição no envio), `:517-531` (append sem corte), `:871` (`maxLength` só no input do usuário) |
| F16 | INFO | POSSÍVEL | AUDIO | Resample linear/decimação (48k→16k = decimação a cada 3; 44,1k→16k = interpolação linear) sem filtro anti-alias: possível aliasing de 8–24 kHz, mas irrelevante para fala (energia < 8 kHz; interpolação atenua HF); sem mudança recomendada | `capture.ts:279-321`; docs VOZ-011 §4 (mesma conclusão) |
| F17 | LOW | POSSÍVEL | UX / PRIVACIDADE | Fechar o widget do chat (`isOpen=false`) **durante** gravação não para nem cancela: o hook fica montado e o mic continua capturando sem UI (indicador só no SO); só desmonte/navegação chama `dispose()` | `ChatAssistant.tsx:617-919` (painel condicional, componente sempre montado); `useVoiceInput.ts:46-49` (dispose apenas no unmount) |

**Nenhum achado CRITICAL ou HIGH confirmado.** Os itens F01/F03/F04 são os que mais merecem decisão consciente de produto (ver §13).

# 5. Audio Pipeline Analysis

## 5.1 Captura (getUserMedia / AudioContext / captura)

**Constraints solicitadas** (`audio/capture.ts:49-57`): `channelCount: 1`, `sampleRate: 16000`, `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`.

- **Comportamento real vs solicitado:** o código **não assume** que o browser respeitou as constraints — lê `track.getSettings()` e usa `actualSettings.sampleRate` para criar o AudioContext e depois reamostra para 16 kHz no `stop()`. Isso é a abordagem correta para Android Chrome, onde `sampleRate` é frequentemente ignorado (doc-reportado: 48 kHz no realme). `channelCount` mono costuma ser honrado; os flags AGC/NS/EC são best-effort e podem ser forçados pelo device — o código apenas loga os valores reais (debug).
- **AudioContext:** criado com `sampleRate = settings.sampleRate` e `latencyHint:'interactive'`, com **fallback sem sampleRate** (decisão VOZ-008.5-R1 documentada — "WebAudio renderer error" no Android). `resume()` é tentado se `suspended`/`interrupted` e a captura **falha de forma limpa** se não ficar `running` (nunca envia PCM vazio silencioso). `cleanup()` para tracks e fecha o contexto. ✓
- **Mecanismo: `ScriptProcessorNode` (4096, 1, 1).** Depreciado há anos mas ainda funcional em Chrome/Android; não há evidência de problema funcional atual (as tentativas anteriores de AudioWorklet foram adiadas com justificativa: o erro Android era de criação do contexto, não do node). O buffer de 4096 amostras = ~85 ms @48 kHz; perda de **um** buffer no momento do stop (~85 ms) é inerente e desprezível. Callbacks acumulam **cópia** de cada bloco (`new Float32Array`), evitando aliasing de buffer do audio thread.
- **Comportamento sob interrupção/tela bloqueada/perda de foco:** **não tratado** (F04) — `onaudioprocess` simplesmente para de disparar quando o contexto é suspenso e nada avisa o usuário; o PCM resultante terá um "buraco" de silêncio. Doc-reportado que o Android Chrome entra em `suspended`/`interrupted`.
- **Dispositivos Android antigos:** sem evidência; ScriptProcessor + worker WASM de ~20 MB heap são o limite prático (F05).

## 5.2 PCM — formato, resample, integridade

- Origem: Float32 mono na taxa **real** do AudioContext (48 kHz no Android doc-reportado; 44,1/48 kHz desktop).
- Destino: Float32 mono **16 kHz** — reamostrado por interpolação linear (`resampleTo16k`), O(n), custo desprezível. Para 48k→16k a razão é exata 3 → equivale a decimação com frac=0 (F16: sem filtro anti-alias, impacto desprezível para fala).
- Conversão para o Vosk: `acceptWaveformFloat` do vosk-browser escala internamente `×0x8000` para o domínio Int16 do Kaldi (confirmado no código do lib). O pipeline nunca converte para Int16 explícito (a função `floatTo16BitPCM` é morta — F11).
- **Integridade:** sem mecanismo de detecção de blocos perdidos em runtime (só instrumentação `sampleCoverageRatio` em debug). VOZ-008.4-R1 atribuiu o sintoma "vazio" a AudioContext `suspended` (corrigido) + SW stale (corrigido) + lab contaminado por fixture (corrigido). **Não há evidência nesta auditoria de perda de blocos no caminho atual** (doc-reportado `actualSamples` ≈ esperado no realme).

## 5.3 Silêncio e normalização (análise matemática)

Implementado em `normalize.ts`, aplicado em `stt/vosk.ts:113-133` **depois** do resample:

- **trimSilence:** janelas de 100 ms; janela "ativa" se pico ≥ 0,01; remove silêncio de borda **apenas se > 500 ms**, preservando **200 ms** de contexto; **não toca pausas internas** nem silêncio ≤ 500 ms.
  - Fala baixa (pico 0,01–0,05) **não é removida** (pico ≥ threshold). Ruído ambiente contínuo ≥ 0,01 impede o trim — correto (evita cortar fala). Silêncio total → sem trim (o controller já emite `empty` antes do Vosk).
- **normalizePcm:** remove DC (média global); se pico (pós-DC) ∈ [0,01, 0,5): ganho linear `0,9/pico` com clamp. Pico ≥ 0,5 → só DC. Pico < 0,01 → nada.
  - **Matematicamente limpo:** o ganho é **linear** → **SNR inalterado** (amplifica voz E ruído igualmente; não "inventa" ruído). O clamp praticamente nunca dispara (pico pós-ganho = 0,9 por construção). Remoção de DC evita bias.
  - **Efeito no reconhecimento:** Kaldi aplica CMVN; o ganho de amplitude ajuda modelos pequenos sensíveis a volume (métrica documentada: pico real 0,4666 → ganho ≈ 1,93×). **Não há evidência de que normalize/trim removam fonemas** (trim só de borda; pausas internas preservadas) nem de que amplifiquem ruído além do que já existia.
  - **Conclusão:** pré-processamento **adequado e seguro**; não recomendar mudança (regra §23).

## 5.4 Veredito do pipeline de áudio

Pipeline de áudio **tecnicamente correto para o caso de uso** (frases curtas push-to-talk, mono 16k). Pontos abertos: F03 (duração ilimitada), F04 (interrupções), F16 (INFO). Nada indica clipping, ganho excessivo, silêncio artificial ou ruído amplificado no código.

# 6. Vosk Analysis

## 6.1 Modelo e carregamento

- `vosk-browser@0.0.8` (UMD, Worker clássico base64/Blob; WASM do Kaldi embutido no Worker — sem COOP/COEP/SharedArrayBuffer).
- Modelo **local**: `public/vosk-model-small-pt-0.3.tar.gz` (30,9 MiB; conteúdo: `final.mdl`, `Gr.fst`, `HCLr.fst`, ivector…, `mfcc.conf`; **sem `conf/model.conf`**). URL `/vosk-model-small-pt-0.3.tar.gz`; sem fallback remoto em runtime (privacidade local-only). Conteúdo do tar verificado por listagem.
- `loadVoskModel` com cache module-level (`cachedModel`/`cachedModelId`) e timeout de 120 s; **sem deduplicação de chamadas em voo** (limitante conhecido, F07).
- `disposeVoskModel()` → `Model.terminate()` (encerra Worker/WASM) — só seguro sem recognizers ativos; no fluxo do controller isso é respeitado (dispose após stop/cancel), exceto transcribe em voo, que fica preso até o guard de 30 s (bounded).

## 6.2 Transcribe — `acceptWaveformFloat` + `retrieveFinalResult`

- Feed **chunked**: `subarray` de 4096 amostras (256 ms @16 kHz) por `acceptWaveformFloat(chunk, 16000)`, todos no mesmo tick; depois `retrieveFinalResult()` **imediato** (o antigo `setTimeout(100 ms)` foi removido em VOZ-008.8 — evidência histórica: o retrieve a ~100 ms retornava só o prefixo decodificado no Android lento).
- Semântica real do vosk-browser (verificada por decompilação do worker embutido): cada `audioChunk` → `AcceptWaveform()`; se `true` (endpoint) → evento `result` com `Result()` (texto do segmento finalizado); senão → `partialresult`; `retrieveFinalResult` → `FinalResult()` → evento `result` final. Fila do Worker garante ordem (retrieve após todos os chunks).
- **Ordem/truncamento:** correta para sessão de **um único segmento** (sem endpoint intermediário): só um evento `result` final com o texto completo. **Risco F01:** se houver endpoint intermediário (pausa interna), haverá **múltiplos** eventos `result`; o handler **sobrescreve** `finalText` em vez de acumular, e `finish()` entrega apenas o último. Como o modelo não traz `conf/model.conf`, os defaults de endpoint do Vosk estão ativos → pausas de ~0,5–1 s podem segmentar. Não testado, não verificado em dispositivo; o caso típico (frase contínua curta) não dispara.
- Guard de 30 s (F02); evento `error` rejeita; `finish()` idempotente; `recognizer.remove()` libera memória.
- **Resultados parciais (`partialresult`):** não usados — decisão correta para batch pós-stop (não há streaming no produto; usá-los não melhoraria o resultado final — concordância com docs VOZ-011).

## 6.3 Riscos de Vosk

| Risco | Avaliação |
|---|---|
| Truncamento por finalização prematura | Corrigido (chunked + retrieve imediato); históricamente era a causa do "1 palavra/parcial" (VOZ-008.7/008.8) |
| Perda de palavras por múltiplos `result` | **F01 — aberto** (POSSÍVEL) |
| Double-load / recognizer/modelo concorrente | Single-instance OK (controller); entre instâncias/mounts o `loadVoskModel` não deduplica (F07); `KaldiRecognizer` novo por transcrição; `remove()` no fim |
| Memória acumulada | Modelo ~60 MB descomprimido no Worker + heap WASM ~20 MB (doc-reportado < 100 MB, sem OOM em 3 GB); recognizers removidos; PCM temporário liberado |

# 7. Concurrency / Lifecycle

## 7.1 Estados que realmente existem

Máquina efetiva = **flags do controller** (`loading`, `recording`, `transcribing`) + `EngineState` (`IDLE→LOADING→READY→TRANSCRIBING→RESULT→ERROR`) + **token de geração `gen`** (cancel/dispose invalidam continuações assíncronas). Status observável: `idle | loading | ready | recording | transcribing | result | error` (misto flags/engineState via `getStatus()`).

## 7.2 Cenários (A–J)

| Cenário | Análise | Race/Perda? |
|---|---|---|
| **A. Gravar** | start() adquire mic, inicia recorder e seta 'recording' **antes** do load do modelo (VOZ-012). | OK — feedback imediato |
| **B. Parar rápido** | stop() com PCM vazio → erro `empty` limpo; não chama Vosk; engine permanece READY. | OK |
| **C. Gravar vários segundos** | Sem limite de duração; acumula chunks (F03). Transcribe pós-stop com trim de bordas. | Risco de memória/tempo (F03) e F01 se houver pausa interna |
| **D. Três gravações consecutivas** | UI serializa (mic desabilitado durante transcribe); teste cobre (load 1×, capturas 3×); sem acúmulo de texto (append deliberado no input). | OK |
| **E. Cancelar** | cancel() incrementa gen, limpa recorder/capture, flags zeradas; LOADING→IDLE, TRANSCRIBING→READY; continuações obsoletas descartadas por gen. | OK |
| **F. Nova gravação durante finalização** | UI bloqueia (isBusy) e flags `loading||recording||transcribing` barram start(); gen descarta resultado velho. | OK na UI; API direta: start() durante load pós-stop não é barrado por engineState (F07) |
| **G. Sair da página durante gravação** | unmount → dispose(): cancel recorder, cleanup capture (mic/AudioContext), `engine.dispose()` (Worker). Transcribe em voo fica preso até guard 30 s, descartado por gen. | OK (bounded) |
| **H. Perder foco** | Sem handler: gravação continua (mic aceso, sem UI). Android pode suspender o contexto → buracos (F04). | Risco AUDIO/privacidade (F04/F17) |
| **I. Android suspende AudioContext** | Só há resume no start; interrupção no meio não é detectada/recuperada. | Risco (F04) |
| **J. Parar com modelo ainda carregando** | stop() aguarda `pendingEngineLoad` antes de transcrever (anti-race VOZ-012); testes cobrem (load 1×, transcribe 1×). | OK |

## 7.3 Races remanescentes (detalhe)

1. **F07 — guard de start() por flags apenas:** `start()` retorna se `loading||recording||transcribing`, mas não consulta `engineState`; num estado `LOADING` pós-stop (engine carregando em background), uma chamada programática a `start()` prosseguiria e chamaria `engine.load()` concorrentemente (sem dedupe) e invalidaria (gen++) o resultado do stop anterior. **Inalcançável pela UI atual** (mic desabilitado), mas é uma inconsistência flag-vs-estado real.
2. **F08 — cancel() durante resume:** o caminho de falha pós-resume não re-checa `gen`; cancelamento nesse ínterim pode exibir erro espúrio. Raro e UI-inacessível (botão de cancelar só aparece em `recording`).
3. Transcribe em voo + dispose: bounded pelo guard de 30 s; sem vazamento de mic.

**Conclusão de concorrência:** a camada é **cuidadosamente projetada** (gen token + pendingEngineLoad + reducer + UI disable). Nenhum deadlock ou vazamento confirmado. Os riscos restantes são condicionais (F01, F03, F04, F07).

# 8. Android Analysis

Ambiente-alvo documentado: PWA/Next em HTTPS (Caddy/mkcert no lab), Android Chrome. **Esta auditoria não executou nenhum teste em Android real** (sem dispositivo). Classificação abaixo segue as categorias do briefing.

| # | Descoberta | Classificação | Base |
|---|---|---|---|
| A1 | `getUserMedia` entrega 48 kHz mono (constraint 16 kHz ignorada); pipeline reamostra corretamente para 16 kHz | CONFIRMADO (doc-reportado) / tratado no código | docs VOZ-002/008.x; `capture.ts` + `resampleTo16k` |
| A2 | AudioContext precisa de `resume()` explícito no Android (estado `suspended`/`interrupted`); sem isso `onaudioprocess` nunca dispara → PCM vazio | CONFIRMADO (doc-reportado) / corrigido no código (VOZ-008.5) | docs; `capture.ts:105-150`, `voiceController.ts:193-226` |
| A3 | `new AudioContext({sampleRate:…})` com taxa divergente do backend pode falhar com "The AudioContext encountered an error from the audio device or the WebAudio renderer." (×9 doc-reportado) | CONFIRMADO (doc-reportado) / mitigado com fallback sem sampleRate + try/catch | docs VOZ-008.5-R1; `capture.ts:84-99` |
| A4 | Service Worker stale (precache de build antigo → `bad-precaching-response` 404 → SW velho continua controlando) mascarou instrumentação e pode ter servido bundle antigo | CONFIRMADO (doc-reportado, causa-raiz da instrumentação ausente) / não há guarda estrutural no código atual (F06 relacionado) | docs VOZ-008.4-R1 |
| A5 | Interrupções **durante** gravação (chamada/bloqueio/background) não tratadas | PROVÁVEL (classe de comportamento Android) — POSSÍVEL no produto | código (ausência de listeners); F04 |
| A6 | Suspensão do AudioContext/tab em background → buracos silenciosos no PCM sem aviso | POSSÍVEL | F04 |
| A7 | Modelo 32,4 MB baixado pelo Worker em primeira fala + chunk 5,79 MB não precacheado; custo de dados/tempo móvel; recarga por montagem do ChatAssistant | PROVÁVEL (medição de tamanho) — impacto POSSÍVEL | F05/F06 |
| A8 | Cache Storage (rota `others` NetworkFirst) armazena 32,4 MB sem expiração | PROVÁVEL | F06 |
| A9 | ScriptProcessorNode em Android Chrome (depreciado) — sem evidência de falha atual; AudioWorklet adiado com justificativa técnica documentada | NÃO EVIDENCIADO como bug | docs VOZ-008.5-R1; código |
| A10 | Processamento em background, memória, PWA/Service Worker, HTTPS: sem evidência nova de problema além de A4/A7/A8 | NÃO EVIDENCIADO | — |
| A11 | Dispositivos Android antigos, iOS, Bluetooth/fones, múltiplos mics | NÃO TESTADO (nenhuma evidência) | F14 |
| A12 | Sintoma original de produção "transcrição vazia/1 palavra no Android" — resolução **não fechada** por um run físico consistente; docs se contradizem sobre qual build validou o quê | NÃO EVIDENCIADO (inconclusivo) | F12; docs VOZ-008.x/009/010 |

**Leitura honesta:** a saga VOZ-007→008.x encontrou causas reais e plausíveis (AudioContext suspenso, SW stale, lab contaminado por fixture, timing de retrieve) e o código atual incorpora as correções correspondentes. Mas **nenhum relatório interno fecha o ciclo com o run físico único e consistente** que eles próprios definiram como critério, e os números de qualidade citados (5/9 vs 9/9 palavras) se contradizem entre relatórios. Portanto: código defensável, validação Android pendente.

# 9. Performance

| Métrica | Valor/estado | Evidência |
|---|---|---|
| Load do modelo (primeira fala) | 32,4 MB download + inflate ~60 MB + init WASM; doc-reportado 4,9–7,4 s (desktop dev/prod); Android não medido de forma consistente | docs VOZ-008.x; tamanho do asset |
| Chunk JS do Vosk | 5,79 MB (não precacheado, carregado no 1º uso de voz) | aviso do `next build` |
| RTF (inferência) | ~1,0–1,1 doc-reportado no realme (6,9 s de áudio ≈ 7 s; fixture 13,17 s ≈ 13,17 s) — ou seja, **transcrição ~ tempo real** no mid-range | docs VOZ-010 |
| Custo de resample/normalize/trim | O(n) no main thread; desprezível (dezenas de ms para minutos de áudio) | análise do código |
| Memória do modelo | ~60 MB (descomprimido) + heap WASM ~20 MB no Worker; PCM temporário proporcional à duração (F03) | docs; código |
| Main thread | Feed envia chunks (transferables) para o Worker; UI livre durante inferência; sem bloqueio síncrono relevante | código |
| Guard de inferência | 30 s fixos (F02) | código |

**Avaliação por cenário de uso**
- **Celular intermediário (ex.: realme RMX3461):** adequado para frases curtas (RTF ~1; ~5–15 s p/ áudios curtos). Ditado longo (>30 s) ou gravação acidental: F02/F03.
- **Desktop:** folgado.
- **Múltiplas transcrições:** serializadas; modelo reutilizado enquanto o ChatAssistant está montado; recarregado a cada montagem (F05).
- **Áudios longos:** não suportados bem (sem limite de duração, guard de 30 s, acumulação em memória) — **fora do caso de uso atual**.

# 10. Recognition Quality (PT-BR)

**Metodologia:** nenhum WER formal foi medido pelo projeto (nem por esta auditoria, sem hardware). As evidências disponíveis são: (a) doc-reportado em dispositivo real (5/9 palavras → "olá reconhecimento de voz dele" pré-correção; wordCount ≥ 8–9 pós-correção, com contradições internas), (b) características do modelo.

**Atribuição de causa dos erros observados (históricos):**

| Sintoma | Atribuição mais provável | Base |
|---|---|---|
| Texto vazio/1 palavra no Android (produção) | CAPTURA (AudioContext suspended) + SW stale + timing de finalização Vosk — corrigidos em VOZ-008.5/008.4-R1/008.8; sintoma original **nunca fechado** por run físico único | docs; código |
| Perda de palavras iniciais/finais ("quero testar" sumiu; "…brasileiro"→"dele") | FINALIZAÇÃO (retrieve ~100 ms antes do decode terminar no Android) — corrigida por chunked + retrieve imediato | docs VOZ-008.7/008.8 |
| Qualidade geral | **MODELO** (small-pt-0.3, 31M): sem pontuação/caixa; números ("setenta", "cento e cinquenta"), plurais, nomes próprios e fala coloquial são frágeis; WER alto em domínio aberto (doc-reportado) | docs VOZ-011/F13 |
| Sotaques, ruído, frases longas | SEM evidência suficiente nesta auditoria | — |

**Resposta direta à pergunta do briefing (qualidade PT-BR limitada por áudio ou modelo?):** para o caso de uso atual (frases curtas de nutrição), o pipeline de áudio está correto e a limitação dominante é o **modelo pequeno** (vocabulário/robustez). Não há evidência nesta auditoria de que normalize/trim/resample/chunking estejam degradando o reconhecimento. Para erros residuais em casos específicos, **não há evidência suficiente para atribuir a causa** sem novos testes em dispositivo com ground-truth.

# 11. Architecture Reusability (motor áudio→texto independente)

**Classificação dos componentes:**

| Componente | Classe | Acoplamento atual |
|---|---|---|
| `audio/capture.ts`, `audio/normalize.ts` | **CORE REUTILIZÁVEL** | Nenhum (só `debug.ts`) |
| `voiceController.ts` | **CORE REUTILIZÁVEL** | Nenhum (injeção por options; sem import de UI/framework) |
| `stt/*` (registry, engineState, vosk, engines) | **CORE REUTILIZÁVEL** (registry é singleton de app — trivial trocar por injeção) | Nenhum |
| `stt/moonshine.ts`, `engines/moonshine.ts` | **LEGADO (não extrair)** | — |
| `useVoiceInput.ts` | **ADAPTER (React)** | React |
| `debug.ts` | ADAPTER (env var da app) | `NEXT_PUBLIC_*` |
| `ChatAssistant.tsx` (botão, status, onTranscript→textarea) | **UI / INTEGRAÇÃO DE PRODUTO** | React + `useChatState` |
| Modelo em `public/`, engineId `'vosk-pt-br'`, dataset/benchmark | INTEGRAÇÃO DE PRODUTO / assets | caminho `/vosk-model-small-pt-0.3.tar.gz` hardcoded em `VOSK_MODELS` |

**Acoplamentos que NÃO existem no núcleo (verificado):** React/Next (exceto hook), Supabase, auth, API de chat, Gemini/OpenAI, domínio Nutri, estado global, streaming/guardrails. O núcleo recebe PCM e devolve texto via callbacks — exatamente o contrato `ÁUDIO → ENGINE → TEXTO`.

**O que falta para virar motor independente (`voice-transcription-engine`):**
1. Empacotar `audio/**`, `voiceController.ts`, `stt/**` (exceto Moonshine) como pacote (sem `'use client'`, sem aliases `@/`).
2. Tornar a URL/registro do modelo configurável (hoje hardcoded `/vosk-model-small-pt-0.3.tar.gz` e engineId `'vosk-pt-br'`).
3. Substituir `debug.ts` (env da app) por um logger injetável; remover a dependência de `NEXT_PUBLIC_VOICE_DEBUG`.
4. Opcional: trocar `registry` singleton por injeção; expor `transcribe(pcm)` sem passar pelo controller (já existe via engine).
5. Não arrastar: `useVoiceInput`, `ChatAssistant`, `dataset/benchmark` (domínio Nutri), Moonshine, fixtures.

O desenho atual foi claramente feito com esse objetivo (comentários de arquitetura nos próprios arquivos); **a extração é de baixo risco** e não exige mudanças no núcleo.

# 12. Test Coverage

**Executado nesta auditoria:** `npx vitest run` → **23 arquivos / 314 testes, todos passando** (exit 0). `npx tsc --noEmit` → 0 erros. `npm run build` → sucesso, 28 rotas. Nenhum teste foi alterado.

**O que cada grupo de testes realmente prova:**

| Arquivo | Tipo | O que prova de verdade |
|---|---|---|
| `engineState.test.ts` (17) | unit puro | Transições da máquina de estados + guards (lógica real) |
| `metrics.test.ts` (18), `normalize.test.ts` (11), `voice.test.ts` (parte) | unit puro | Matemática de WER/CER/RTF, normalize/trim com sinais sintéticos |
| `voiceController.test.ts` (18), `voiceLifecycleVOZ012.test.ts` (10) | unit com mocks | Contrato do controller com capture/recorder/engine **mockados**: ordem start/stop, cancel, gen, load pendente, AudioContext resume, empty, resample 48k→16k |
| `chatAssistantVoice.test.ts` (7) | unit com mocks | Concatenação do texto no input (função duplicada no teste) + contrato onTranscript |
| `voskChunk.test.ts` (9) | **estático (regex na fonte)** + 2 runtime com recognizer mockado | Que a fonte contém o padrão chunked 4096; que o mock de `result` único resolve; **não prova** semântica real do Vosk, nem múltiplos `result` |
| `voiceLabSeparation.test.ts` (12), `textareaVOZ012.test.ts` (4) | **estático (regex na fonte)** | Forma textual do lab/textarea, não comportamento |
| `registry.test.ts` (6) | unit | Metadados do registry |
| `voice.test.ts` (parte: dataset/guardrail) | unit | Dataset sintético sem PII, integração texto→guardrail (não áudio) |

**Classificação por camada (briefing §14):**

| Camada | Status |
|---|---|
| Lógica pura (estados, WER, normalize, trim, concatenação) | TESTADO AUTOMATICAMENTE |
| Controller/lifecycle (com mocks) | TESTADO AUTOMATICAMENTE |
| Captura real (getUserMedia/AudioContext/ScriptProcessor) | NÃO TESTADO (só mocks; nenhum browser test) |
| Vosk real (Worker/WASM/semântica de eventos) | NÃO TESTADO (recognizer mockado; nenhum e2e browser) |
| Android real | NÃO TESTADO por esta auditoria; docs alegam runs físicos **inconsistentes e com validação PENDING** (F12) |
| Desktop real | NÃO TESTADO automatizado (apenas runs manuais doc-reportados) |
| iOS / outros devices | NÃO TESTADO |

**O que os 314 testes não provam:** ausência de bugs de áudio real; corretude da integração com o Worker real; comportamento com múltiplos `result` (F01); interrupções/background (F04); duração longa (F03); performance/RTF em dispositivo. **Fixtures:** `public/moonshire.wav` só no lab manual, sem ground-truth; `public/voice-benchmark/PTBR-*.wav` existem e **não são referenciadas** por nenhum teste.

**Veredito de testes:** boa rede **unitária/mockada**, mas a pilha de áudio (a parte que realmente quebrou no Android) **não tem teste automatizado de browser/dispositivo**; vários testes "amarraram" o texto-fonte (regex), o que reduz o valor de regressão e **dificulta refatorações legítimas** (ex.: extrair o motor independente, §11).

# 13. Recommended Actions

## IMEDIATO (baixo custo, fecha riscos condicionais)

**R1 — Acumular em vez de sobrescrever resultados do Vosk (F01).**
PROBLEMA → Perda potencial de palavras quando o Vosk emite >1 evento `result` na sessão (pausa interna).
EVIDÊNCIA → `stt/vosk.ts:174-179` sobrescreve `finalText`; worker do vosk-browser emite `result` por segmento finalizado e `FinalResult()` no retrieve; guia Vosk manda concatenar resultados.
CAUSA → Premissa implícita de "um único evento final" sem verificação; modelo sem `conf/model.conf` (endpoint defaults ativos).
IMPACTO → Ditados com pausa podem truncar na entrega; caso típico curto não afetado.
RECOMENDAÇÃO → Concatenar `msg.result.text` de eventos `result` (com espaço) em vez de sobrescrever; manter `finish()` disparando apenas no evento pós-retrieve; adicionar teste unitário com 2 eventos `result` e 1 `partialresult`.
RISCO DA MUDANÇA → Mínimo (append idempotente); verificar em dispositivo frase com pausa interna de ~1 s.

**R2 — Limite de duração/indicador de gravação (F03).**
RECOMENDAÇÃO → Cap de duração (ex.: 60 s) com auto-stop + aviso, e/ou cronômetro visível; liberar PCM incrementalmente se ditado longo for requisito.
RISCO → Baixo; decisão de produto.

**R3 — Tratar perda de foco/background durante gravação (F04/F17).**
RECOMENDAÇÃO → Listener `visibilitychange`/`document.hidden`: auto-cancelar (ou pausar com aviso) a gravação ao ocultar a aba; opcional: `audioContext.onstatechange` para detectar `interrupted`/`suspended` e abortar com mensagem clara.
RISCO → Baixo; melhora privacidade/UX (mic não fica "aceso" invisível).

## PRÓXIMO

**R4 — Guard de inferência proporcional à duração do áudio (F02).** Ex.: `timeout = 30s + k × audioDuration` (k≈3–5) em vez de 30 s fixos; logar `acceptToRetrieveMs` para calibrar.

**R5 — Evitar recarga completa do modelo por navegação (F05).** Não terminar o modelo no unmount do ChatAssistant (mover `dispose()` para pagehide/sessão), ou manter o Worker vivo entre rotas; medir custo real no Android antes.

**R6 — Servir o modelo de forma amigável a cache/PWA (F06).** Rota dedicada no SW para `/vosk-model-*.tar.gz` com CacheFirst + expiração/limite explícitos (hoje cai na rota `others` NetworkFirst sem expiração), e considerar `Cache-Control: immutable` no asset. Confirmar interação SW↔fetch do Worker.

**R7 — Alinhar flag de debug com produção (F10).** Garantir que `NEXT_PUBLIC_VOICE_DEBUG` nunca seja `1` em builds de produção publicados (o `.env.local` local hoje liga a instrumentação em `next build`); ideal: mover preview de transcrição para trás da flag + remover do bundle de produção.

**R8 — Teste de browser/dispositivo para a pilha de áudio (F12/F14).** Um único run físico documentado (frase curta, frase com pausa, 3 gravações seguidas, cancelar, background) com critérios objetivos (wordCount ≥ 8; duração≈wall time) fecharia a dívida deixada pelos docs VOZ-008.x–012. Automatizar o que for possível (Playwright com microfone fake) para o caminho desktop.

## FUTURO

**R9 — Extrair motor independente (§11)** quando houver um segundo consumidor; baixo risco, sem mudança no núcleo.

**R10 — Modelo maior/alternativo pt-BR** somente com benchmark com ground-truth do micro-domínio e medição de RTF/memória no Android (docs já indicam que o headroom sem troca de modelo está esgotado — VOZ-011).

**R11 — Limpeza de manutenção (F10/F11):** consolidar resample em um único utilitário usado por produto e lab; remover/arquivar código morto (`floatTo16BitPCM`, `getSupportedMimeType`, `stt/types.ts`, engine Moonshine ou torná-la explicitamente lab-only fora do registry de produção).

## NÃO NECESSÁRIO

- Migrar para AudioWorklet **agora** — sem evidência de falha do ScriptProcessor no fluxo atual (decisão documentada correta; revisitar apenas se ScriptProcessor voltar a falhar em device novo).
- Usar resultados parciais/streaming no produto — não melhora o resultado final (VOZ-011) e adiciona CPU no Android.
- Adicionar VAD dedicado, compressão dinâmica ou filtros — risco de cortar fonemas/amplificar ruído sem benefício demonstrável (VOZ-011).
- Trocar o resample por OfflineAudioContext/sinc — sem ganho mensurável para fala.
- Enviar áudio para servidor ou trocar para STT em nuvem — violaria o invariante de privacidade local-first do produto.

# 14. Things That Should NOT Be Changed

Com base em evidência (regra §23), estes componentes estão **tecnicamente adequados** e não devem ser alterados por "modernização":

1. **`voiceController.ts`** — design de lifecycle (gen token, pendingEngineLoad, gravação-antes-do-load, dispose completo). Sólido e testado.
2. **Chunking do Vosk (4096) + retrieve imediato** (`stt/vosk.ts`) — correção histórica correta; não reverter para feed único nem reintroduzir `setTimeout`.
3. **`resampleTo16k` (linear)** — suficiente para fala; não trocar por filtro sofisticado sem medição.
4. **`normalizePcm`/`trimSilence`** — matematicamente seguros (ganho linear → SNR inalterado; trim só de borda); limiares documentados e testados.
5. **AudioContext resume no start + fallback sem sampleRate** (`capture.ts`) — correções Android válidas.
6. **Fluxo "transcrição → textarea sem auto-send" + concatenação preservando texto existente** — comportamento de produto correto (revisão antes do envio).
7. **Code-splitting do `vosk-browser` (import dinâmico)** e modelo **local-only** sem fallback remoto — privacidade correta.
8. **Textarea auto-expansão (máx. 200 px + scroll)** — implementação adequada.
9. **Instrumentação numérica (sem áudio/PII)** como conceito — manter (apenas alinhar a flag com produção, R7).

# 15. Final Verdict

## READY WITH MINOR RISKS

**Justificativa objetiva:**

- **Pontos fortes confirmados por evidência executada:** 314/314 testes passando; `tsc` limpo; build de produção OK; arquitetura em camadas desacoplada; lifecycle com token de geração e anti-races documentados; pipeline de áudio correto para frases curtas; privacidade local-first respeitada (sem upload/persistência de áudio).
- **Riscos menores, todos condicionais (nenhum bug confirmado no caminho típico):** F01 (acumulação de resultados do Vosk — ditado com pausa), F03 (sem limite de duração), F04 (interrupções Android no meio da gravação), F05/F06 (custo de primeiro uso/recarga do modelo e cache SW de 32 MB), F07 (guard de start por flags).
- **Condições explícitas:** (1) se o produto pretende aceitar **ditados longos** (com pausas internas), trate F01 antes de considerar o recurso pronto — hoje ele é otimizado e validado para mensagens curtas de voz; (2) a **validação física Android do caminho de produção segue em aberto** nos relatórios internos, com contradições (5/9 vs 9/9 palavras); execute um run único documentado (R8) antes de divulgar o recurso em escala para Android.

Se qualquer uma dessas condições se confirmar como requisito de produto, o veredito deve migrar para `NEEDS IMPROVEMENT` — não por falha estrutural, mas por cobertura de cenário (ditado longo/interrupções) e dívida de validação em dispositivo.

---

## Apêndice A — Execução de testes (evidência)

| Comando | Resultado |
|---|---|
| `npx vitest run src/lib/voice src/lib/guardrailHelpers.ts` | 11 arquivos / 125 testes OK |
| `npx vitest run` (suite completa) | 23 arquivos / 314 testes OK (exit 0) |
| `npx tsc --noEmit -p tsconfig.json` | 0 erros (exit 0) |
| `npm run build` | sucesso; 28 rotas; aviso: chunk `9cb48f3a…` 5,79 MB "won't be precached" (limite 5 MB) |
| `git status` pós-build | limpo (nenhum arquivo versionado alterado) |

## Apêndice B — Fontes consultadas (amostra)

- Código: `src/lib/voice/**`, `src/components/ChatAssistant.tsx`, `src/app/dev/voice-test/page.tsx`, `src/sw.ts`, `next.config.ts`
- Pacote: `node_modules/vosk-browser` (d.ts + worker embutido decompilado para verificar semântica `result`/`partialresult`/`retrieveFinalResult`), `@serwist/next` defaultCache
- Docs internos (pistas, com contradições sinalizadas): `docs/VOZ-000…VOZ-012`
- Externas: [alphacep/vosk-api#499 — como combinar resultados](https://github.com/alphacep/vosk-api/issues/499), [vosk-browser npm](https://www.npmjs.com/package/vosk-browser)

## Apêndice C — Nota de escopo

Esta auditoria **não** modificou código, testes, configuração, banco ou documentação existentes (regra fundamental). `npm run build` regenerou apenas artefatos de build idênticos aos versionados. Nenhum hardware (Android/microfone) foi simulado nem declarado como validado (§20): toda evidência de dispositivo é DOC-REPORTADA e classificada como tal.
