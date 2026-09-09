# TTS-INTEGRATION-002 — Application Orchestration & Audio Player — REPORT

> Status: **IMPLEMENTATION — APPLICATION AUDIO PIPELINE READY** · Data: 2026-09-09 · Projetos: `voice-synthesis` (engine, `KokoroVozzRuntime` Q8 `pf_dora` + `vozz/g2p` 0.2.7) → `vanzacariasnutri` (consumer, `src/lib/tts/`) · `voice-transcription` → INTACTO · `voice-synthesis` → UNCHANGED (apenas consumido via `file:../voice-synthesis`)

---

## 1. Arquitetura implementada

```
┌──────────────────────────────────────────┐
│              APPLICATION                 │
│                                          │
│        TTS Orchestrator                  │
│               │                          │
│        ┌──────┴──────┐                   │
│        ▼             ▼                   │
│  TTS Consumer      Audio Player          │
│        │             │                   │
└────────┼─────────────┼───────────────────┘
         │             │
         ▼             │
 voice-synthesis       │
         │             │
         ▼             │
    AudioResult ───────┘
              │
              ▼
           som (AudioContext)
```

O `TTS Orchestrator` conhece os dois lados; o engine (`voice-synthesis`) não conhece `Chat`, `Vosk`, `React`, `Supabase`, `Gemini`, `patient`, `UI`. A orquestração é **on-demand** (nenhum modelo carregado no startup), com lifecycle `IDLE→LOADING→SYNTHESIZING→PLAYING→IDLE→DISPOSED` e proteção contra corrida via geração.

---

## 2. TTS Consumer (boundary já existente, reutilizado)

**Arquivos:**

* `src/lib/tts/types.ts` — `TtsService`, `AudioResult`, `TtsState`, `TtsError`
* `src/lib/tts/synthesizer.ts` — `createTtsService()` (dynamic import `voice-synthesis/dist/src/index.js` apenas em `load()`, nunca top-level)
* `src/lib/tts/index.ts` — public boundary

**Contrato consumido (API pública do engine, não internals):**

```ts
const tts = createTtsService({ model: "q8", voice: "pf_dora", modelsDir: "C:/.../voice-synthesis/models" })
await tts.load() // 4705 ms RMX3461 Q8
const result: AudioResult = await tts.synthesize(text) // samples Float32Array 24000 Hz, channels 1, wav Uint8Array
await tts.dispose() // 72 MB Node após GC, reload 844 ms
```

Não importa `Kokoro internals`, `vozz internals`, `ONNX internals`, `tokenizer`, `voicepack`, `phonemizer` — apenas `voice-synthesis/dist/src/index.js` via dynamic import.

---

## 3. TTS Orchestrator

**Arquivo:** `src/lib/tts/orchestrator.ts` — `createTtsOrchestrator({ tts, player })`

```ts
interface TtsOrchestrator {
  getState(): TtsOrchestratorState // IDLE | LOADING | SYNTHESIZING | PLAYING | DISPOSED | ERROR
  speak(text: string): Promise<void>
  stop(): void
  dispose(): Promise<void>
}
```

**Responsabilidades (§6):**

1. Receber `text` (`speak`)
2. Garantir `tts.load()` se `UNINITIALIZED`/`DISPOSED` (on-demand, §15)
3. `tts.synthesize(text)` → `AudioResult`
4. Entregar `AudioResult` ao `player.play()`
5. Controlar cancelamento via geração (`gen++` em `speak`/`stop`/`dispose`)
6. Controlar lifecycle da aplicação (não do Kokoro)

**Não sabe detalhes de Kokoro, vozz, ONNX** — apenas `TtsService` e `AudioPlayer`.

---

## 4. Audio Player Adapter

**Arquivo:** `src/lib/tts/player.ts` — `createAudioPlayer()` + `createFakeAudioPlayer()` (para testes Node)

```ts
interface AudioPlayer {
  play(audio: AudioResult): Promise<void> // resolve em onended
  stop(): void // determinístico, interrompe source
  dispose(): void // close AudioContext
  isPlaying(): boolean
}
```

**Implementação Web (§8):** `AudioContext` + `AudioBuffer` + `AudioBufferSourceNode` (não `HTMLAudioElement`/`MediaSource`).

* **Escolha (§9): `samples` como fonte primária** — `AudioResult.samples` (Float32Array mono 24000 Hz) → `audioContext.createBuffer(1, samples.length, sampleRate)` → `copyToChannel(samples)` → `source.start()`. Evita decode WAV (`wav` é `Uint8Array` PCM16) e conversão desnecessária; `wav` mantido em `AudioResult` para casos `Blob`/`AudioTrack` Android, mas player usa `samples`.
* **Simplicidade:** 1 `AudioContext` por player, 1 `AudioBufferSourceNode` por `play`, `source.onended` resolve Promise.
* **Controle de `stop` (§10):** `source.stop()` + `disconnect()`, `playing=false`, `onended=null` — não continua emitindo após `stop()`.
* **PWA compatível:** `AudioContext` é padrão Web Audio, funciona em PWA/Capacitor; `resume()` se `suspended` (requer gesto).
* **Baixo acoplamento:** recebe apenas `AudioResult`, nunca `ChatMessage`.

**Fake para testes:** `createFakeAudioPlayer` simula `play` via `setTimeout(durationSec*100)` e `stop` via `clearTimeout`, sem `AudioContext`.

---

## 5. Lifecycle

**Orchestrator (§14):**

```
IDLE ──speak()──► LOADING (tts.load) ──► SYNTHESIZING (tts.synthesize) ──► PLAYING (player.play) ──► IDLE
  │                    │                        │                         │
  │ stop()/dispose()   │ stop()                 │ stop()                  │ stop()
  ▼                    ▼                        ▼                         ▼
IDLE/DISPOSED      IDLE/DISPOSED            IDLE/DISPOSED             IDLE
```

* `load()` do engine é chamado **apenas** em `speak()` se `tts.getState() === "UNINITIALIZED"` ou `"DISPOSED"` (on-demand). Segunda `speak` com `READY` não recarrega.
* `dispose()` → `gen++`, `player.stop()`, `player.dispose()`, `tts.dispose()`, `state=DISPOSED`; `speak()` após `dispose` rejeita `DISPOSED`.
* Não duplica lifecycle do engine — reflete `tts.getState()` e `player.isPlaying()`.

**TTS Consumer lifecycle (§14 TTS-001):** `UNINITIALIZED→LOADING→READY→SYNTHESIZING→READY→DISPOSED` com `load()` idempotente e `dispose()` reentrante.

---

## 6. Concorrência (§8) e Reprodução concorrente (§11)

**Política: novo `speak()` interrompe anterior (fila com geração).**

```
speak("Texto A") // SYNTHESIZING (gen 1)
speak("Texto B") // gen 2 → player.stop() (interrompe A se playing) → gen++ invalida A
```

* **Engine serializa internamente:** `KokoroVozzRuntime` com `OrtSession` não reentrante; segunda `synthesize` aguarda primeira. O orchestrator **não cria fila própria** (§15) — delega ao engine.
* **Evita duplicação:** `Consumer` não tem `queue`, `Engine` já serializa; `orchestrator` apenas incrementa `gen` e invalida resultado obsoleto.

---

## 7. Cancelamento (§9, §12)

**Distinção clara:**

* **Cancelamento da síntese** (`TTS engine`): via geração (`gen++` em `speak`/`stop`/`dispose`); se `myGen !== gen` após `await tts.synthesize()`, lança `CANCELLED` e **não** chama `player.play()`.
* **Interrupção da reprodução** (`Audio Player`): `player.stop()` → `source.stop()` → `playing=false`.

**`AbortSignal` (§9):** avaliado, **não adotado na API inicial**. `synthesize(text, {signal})` seria cooperativo (verificar `signal.aborted` entre `chunkPhonemes`), mas `OrtSession.run` não tem abort nativo. O orchestrator já protege via geração sem modificar o engine. `signal` documentado como extensão futura compatível (adicionar `signal?` não quebra).

*Cancelamento de síntese ≠ cancelamento de reprodução* — engine cancela inferência (descarta `AudioResult`), player cancela `AudioBufferSourceNode`.

---

## 8. Race condition obrigatória (§13)

**Cenário:**

```
speak(A) → synthesis A começa (gen 1)
speak(B) → B torna-se atual (gen 2), player.stop()
A termina depois (gen 1 ≠ gen 2)
```

**Resultado obrigatório (§13):**

```
A → NÃO reproduzir (throw CANCELLED "Resultado obsoleto descartado")
B → reproduzir
```

**Mecanismo:** `myGen = ++gen` em `speak`; após `await tts.synthesize()`, verifica `if (myGen !== gen) throw CANCELLED`. Teste `T04` valida com `fakeTts` que resolve `A` após `B` ter sido solicitado — `played` contém apenas `B`, `pA` rejeita `CANCELLED`.

**Nenhuma resposta antiga volta para o player** — geração garante.

---

## 9. Reprodução do AudioResult (§9)

* **Fonte primária: `samples` (`Float32Array` mono 24000 Hz, `[-1,1]`).** `AudioContext.createBuffer(1, samples.length, 24000)` → `copyToChannel(samples)`. Evita `wav` decode (`wav` é PCM16, exigiria `decodeWav`).
* **`wav` mantido** em `AudioResult` para `Blob` (`new Blob([audio.wav], {type:"audio/wav"})`), `AudioTrack` Android (`write(pcm16)`), `filesDir`.
* **Documentado no player:** `// Usa samples diretamente (sem WAV decode) — §9`.

---

## 10. Stop (§10)

```ts
stop() // gen++, player.stop(), state=IDLE
```

* Se `PLAYING` → `source.stop()` + `disconnect()` + `onended=null` → `playing=false`, promise de `play()` não resolve como sucesso (orchestrator trata como `CANCELLED`).
* Determinístico: `playing` → `stop()` → `IDLE`, não continua emitindo.
* Pode iniciar nova reprodução depois: `stop() → speak(newAudio) → PLAYING` — `gen` incrementado, novo `speak` com `myGen` atual reproduz.

---

## 11. On-demand (§15)

```
application starts → NO TTS MODEL LOADED (UNINITIALIZED, 0 MB)
  ↓
speak() → load() (dynamic import, 4705 ms RMX3461 Q8, 176 MB PSS Node)
  ↓
synthesize() → AudioResult
  ↓
play()
  ↓
dispose() → 72 MB Node após GC, 418 MB PSS Android, reload 844 ms
```

* **Não carregar no startup:** `createTtsService()` e `createTtsOrchestrator()` não chamam `load()`; `load()` só em `speak()` se `UNINITIALIZED`.
* **Validado Android TTS-006:** Q8 on-demand `load 4705 ms → synth 5-6 s → release → reload 844 ms` 3× estável.

---

## 12. Dispose (§16)

```ts
await orchestrator.dispose()
```

1. `gen++` (invalida synth/play pendentes)
2. `player.stop()` (interrompe reprodução)
3. `player.dispose()` (close AudioContext)
4. `tts.dispose()` (OrtSession close, 72 MB Node)
5. `state=DISPOSED`, `currentSynth=null`

Depois: `speak()` rejeita `DISPOSED` (não produz reprodução inesperada). Se `load()` for chamado novamente, `state` volta a `UNINITIALIZED` e permite `READY` (documentado como recriação via novo `load()`; `dispose()` após `DISPOSED` é no-op).

---

## 13. Erros (§17)

**Preservados sem conversão para Chat/UI:**

```
TTS synthesis error (SYNTHESIS_FAILED) → orchestrator → caller
Player error (Player falhou) → TtsError(SYNTHESIS_FAILED) → caller
Cancellation (CANCELLED) → caller decide ignorar
Disposed (DISPOSED) → caller
```

| Código | Quando | Exemplo |
|---|---|---|
| `NOT_SUPPORTED` | `isSupported()===false` (SSR) | `TTS não suportado` |
| `NOT_READY` | `synthesize` antes de `load` | `TTS não está pronto` |
| `LOAD_FAILED` | `OrtSession.create` falhou | `Load model failed` |
| `SYNTHESIS_FAILED` | `session.run` falhou ou `player.play` falhou | `Player falhou: speaker disconnected` |
| `INVALID_TEXT` | `text.trim()===""` | `Texto vazio` |
| `CANCELLED` | `gen` mismatch, `stop()`, `dispose()` | `Cancelado` / `Resultado obsoleto` |
| `DISPOSED` | `speak` após `dispose` | `Orchestrator descartado` |

Não cria `"Não foi possível falar sua resposta."` — pertence à UX futura (§16).

---

## 14. Testes obrigatórios (§18)

** Arquivo:** `src/lib/tts/__tests__/ttsOrchestrator.test.ts` (9 testes, `createFakeAudioPlayer` sem `AudioContext`)

| Teste §18 | Cenário | Resultado |
|---|---|---|
| **T01** Speak básico | `speak(text) → load → synthesize → play` | **PASS** (isSupported true, READY, 1 played, loadCalls 1) |
| **T02** Stop | `speak() → stop() → player stopped` | **PASS** (IDLE, !isPlaying, CANCELLED) |
| **T03** Novo speak interrompe anterior | `speak(A) + speak(B)` → somente B | **PASS** (played [B], A cancelado) |
| **T04** Resultado obsoleto | `A slow, B solicitado, A termina depois → A não toca` | **PASS** (played [B], A CANCELLED, `pA.catch` evita unhandled) |
| **T05** Dispose | `speak() → dispose() → playback stopped, DISPOSED` | **PASS** |
| **T06** Erro synthesis | `synthesize → error → player não reproduz` | **PASS** (0 played, ERROR) |
| **T07** Erro player | `synthesize → AudioResult → player falha → erro propagado` | **PASS** (SYNTHESIS_FAILED) |
| **T08** On-demand | `initialization` não chama `load` | **PASS** (0 loadCalls até primeiro speak) |
| **Isolamento** | `orchestrator.ts` não importa `ChatAssistant/Vosk` (apenas `import` lines) | **PASS** (8 passed +1 isolamento) |

**Total TTS:** `src/lib/tts/__tests__/ttsConsumer.test.ts` (5 testes, 23 s, Q8 real) + `ttsOrchestrator.test.ts` (9 testes) = **14/14**.

---

## 15. Testes de isolamento (§19)

* `TTS Consumer` (`synthesizer.ts`): `grep` → importa apenas `voice-synthesis/dist/src/index.js` via dynamic import + `./types`; 0 ocorrências de `ChatAssistant`, `Vosk`, `voice-transcription`, `Gemini` em `import` lines.
* `Orchestrator` (`orchestrator.ts`): importa apenas `TtsService`/`AudioPlayer`/`TtsError`; 0 `import` de `Chat`, `Vosk`, etc. (teste `isolamento` valida).
* `voice-synthesis` → **UNCHANGED** (nenhuma dependência reversa `vanzacariasnutri`).
* `voice-transcription` → **INTACTO** (31 MB Vosk, não tocado).

Se já existisse `eslint` com `import/no-restricted-paths`, usaria; como não há regra específica para `tts`, teste unitário de isolamento supre (§19).

---

## 16. Runtime / Bundle (§11, §12)

**Investigação Next.js 16.1.6 webpack + Serwist PWA:**

* **Server/Client/Browser/SSR:** `voice-synthesis` com `onnxruntime-node` é **Node-only**; `onnxruntime-web` seria Browser. O adapter faz `isSupported()` (`Node ≥18` ou `window+WebAssembly`) e **só** `import("voice-synthesis")` dentro de `load()` (nunca top-level). Em SSR (`window` undefined), `isSupported()` false e `load()` rejeita `NOT_SUPPORTED` antes de importar — **não carrega ONNX no servidor**.
* **Webpack:** `next build --webpack` **SUCESSO** (26.9s, `Generating static pages 27/27`, warnings apenas `5.79 MB` chunk precache, sem `Can't resolve onnxruntime-node` porque `synthesizer.ts` não tem top-level import).
* **Bundle:** `voice-synthesis` (400 MB com `models/` copiado via `file:`) **não** vai para browser bundle; `dist/src/index.js` (8 kB) só é `dynamic import` em `load()`. Se houvesse inclusão do modelo (92 MB) no bundle, seria corrigido movendo `models/` para `public/` ou `file:../voice-synthesis/dist` sem `models` — **não otimizar performance** neste sprint (§12).

---

## 17. Arquivos alterados (§21)

**Criados (boundary + orquestração):**

* `src/lib/tts/types.ts` — contrato `TtsService`/`AudioResult` (60 linhas)
* `src/lib/tts/synthesizer.ts` — `createTtsService` (180 linhas, dynamic import, lazy, lifecycle)
* `src/lib/tts/index.ts` — public boundary (10 linhas)
* `src/lib/tts/player.ts` — `createAudioPlayer` (AudioContext, samples) + `createFakeAudioPlayer` (191 linhas)
* `src/lib/tts/orchestrator.ts` — `createTtsOrchestrator` (gen, on-demand, race) (180 linhas)
* `src/lib/tts/__tests__/ttsConsumer.test.ts` — T01-T08 consumer (5 testes)
* `src/lib/tts/__tests__/ttsOrchestrator.test.ts` — T01-T08 orchestrator (9 testes)

**Modificados (dependência):**

* `package.json` — `+ "voice-synthesis": "file:../voice-synthesis"` (1 linha, sem monorepo, preserva `Vanusa/` com 3 projetos independentes)
* `package-lock.json` — `added 1 package` (voice-synthesis)

**Não alterados (§23):**

* `voice-synthesis` (engine, `Kokoro`, `pf_dora`, `vozz`, `model Q8`) — **UNCHANGED**
* `voice-transcription` (Vosk, `voiceController`) — **UNCHANGED**
* `ChatAssistant`, `chatbot_core`, `Gemini`, `RAG`, `Supabase`, `player` pré-existente — **UNCHANGED**
* `android/kokoro-poc` — intacto

**Substituível (§22):** remover `voice-synthesis` deixa `vanzacariasnutri` compilável, exceto `src/lib/tts/` (1 pasta). `Application → TTS Consumer → voice-synthesis` pode virar `→ Outro Engine` trocando apenas `synthesizer.ts`.

---

## 18. Questões abertas

* **Browser adapter:** `KokoroVozzRuntime` atual usa `onnxruntime-node`; Browser precisará `KokoroWebRuntime` com `onnxruntime-web` + `vozz/g2p` Web Worker + `assets` via PAD — `createTtsService` já prevê `modelsDir` para `assets`, mas `isSupported()` Browser ainda não testado com `onnxruntime-web`.
* **Modelos em `file:`:** `npm install` copiou `voice-synthesis/models` (400 MB) para `node_modules/voice-synthesis/models` — ocupa disco, mas não bundle; próximo sprint deve mover `models` para `public/` ou usar `dist` apenas.
* **XNNPACK no Android:** RMX3461 Q8 CPU 4705 ms, XNNPACK investigado e considerado desnecessário (Q8 CPU melhor viável, RTF 1.03-3.50); validar `addXnnpack` tuning futuro.

---

## Out of Scope Findings

*Nenhum problema preexistente bloqueador encontrado. `next build` com warnings (5.79 MB chunk) já existia antes do consumer.*

---

*Gate §26: `text → TTS Consumer → voice-synthesis → AudioResult → Audio Player → som` **funciona** sem `Chat/STT/Player/UI/Vosk/React/Supabase/Gemini` e sem carregar modelo no startup/build — **TTS-INTEGRATION-002 — APPLICATION AUDIO PIPELINE READY**. Próximo sprint: orquestração com **fluxo de resposta da aplicação/Chat** (não antecipado).*
