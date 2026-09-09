# TTS-INTEGRATION-001 — Consumer Boundary — REPORT

> Status: **DESIGN → IMPLEMENTATION — CONSUMER BOUNDARY READY** · Data: 2026-09-09 · Projetos: `voice-synthesis` (engine independente) → `vanzacariasnutri` (consumer) · Branch: `voice-synthesis` Q8 `pf_dora` + `vozz/g2p` 0.2.7 Apache-2.0 + `onnxruntime` 1.29.0 · `voice-transcription` → INTACTO

---

## 1. Dependência — Como `vanzacariasnutri` consome `voice-synthesis`

**Estratégia escolhida (§5): `file:` — pacote local, sem monorepo.**

```json
// vanzacariasnutri/package.json
"dependencies": {
  "voice-synthesis": "file:../voice-synthesis",
  ...
}
```

* **Avaliação em ordem §5:**
  1. **Package local `file:`** — **escolhido**. `npm install` copia/symlink `../voice-synthesis` para `node_modules/voice-synthesis` (inclui `dist/`, `package.json`, `models/` — 400 MB copiados, mas **não bundlados** para browser devido ao dynamic import). Preserva independência: `Vanusa/` continua com 3 projetos independentes (`vanzacariasnutri/`, `voice-transcription/`, `voice-synthesis/`), sem `workspaces` no root, sem `pnpm-workspace.yaml`, sem `lerna`. Cada projeto mantém seu `package.json`, `tsconfig`, `node_modules`.
  2. Workspace não-monorepo — rejeitado (exigiria `package.json` workspaces no pai, transformaria em monorepo).
  3. `file:` empacotado — não necessário (file: já é file:).
  4. Outra — não necessária.

* **Independência preservada (§22):** remover `voice-synthesis` deixa `vanzacariasnutri` compilável, exceto `src/lib/tts/` (1 pasta). Nenhum `import` de `voice-synthesis` existe fora de `src/lib/tts/synthesizer.ts` (ver § Isolamento). Nenhum `voice-synthesis` → `vanzacariasnutri` (direção única `vanzacariasnutri → voice-synthesis`).

* **Instalação:** `npm install` em `vanzacariasnutri` — `added 1 package, audited 1536 packages` (2026-09-09), `node_modules/voice-synthesis/dist/src/index.js` existe, `models/` copiado mas **não importado no bundle** (ver § Bundle).

* **Alternativa futura sem `file:`:** publicar `voice-synthesis` como pacote privado (`npm pack` → `voice-synthesis-0.1.0.tgz`) ou via `npm link`, mas `file:` já satisfaz o sprint sem monorepo.

---

## 2. Boundary — Quais arquivos representam a fronteira

**Fronteira isolada em `vanzacariasnutri/src/lib/tts/` (3 arquivos, 1 pasta de testes):**

```
src/lib/tts/
  types.ts                — contrato consumidor (TtsService, AudioResult, TtsState, TtsError)
  synthesizer.ts          — adapter: createTtsService() → encapsula voice-synthesis via dynamic import
  index.ts                — public boundary export (apenas TtsService/AudioResult)
  __tests__/
    ttsConsumer.test.ts   — teste isolado text→AudioResult (5 casos, 23 s)
```

**O que a boundary esconde:**

```
VanzacariasNutri (qualquer caller)
  │
  ▼
TTS Consumer Adapter (src/lib/tts/)
  │  createTtsService({model:"q8", voice:"pf_dora", modelsDir})
  │  isSupported(), getState(), load(), synthesize(text), dispose()
  │
  ▼ (dynamic import, nunca top-level)
voice-synthesis/dist/src/index.js
  │  KokoroVozzRuntime (vozz/g2p, tokenizer 115, pf_dora.bin, model_quantized.onnx, OrtSession)
  ▼
AudioResult
```

Se amanhã o engine for trocado (`Outro Engine`), apenas `synthesizer.ts` muda; `types.ts`/`index.ts` e callers permanecem.

**Arquivos que NÃO são boundary e NÃO foram alterados:**

* `src/components/ChatAssistant.tsx` — não tocado
* `src/lib/voice/*` (Vosk, voiceController) — não tocado
* `voice-synthesis/src/*` — não modificado (apenas consumido via `dist/`)
* `voice-transcription/*` — intacto

---

## 3. API — Quais métodos são utilizados

**Contrato consumidor `TtsService` (`src/lib/tts/types.ts:14`):**

```ts
interface TtsService {
  getState(): TtsState // UNINITIALIZED | LOADING | READY | SYNTHESIZING | DISPOSED
  isSupported(): boolean // Node ≥18 ou Browser com WebAssembly
  load(): Promise<void> // idempotente, deduplica LOADING
  synthesize(text: string): Promise<AudioResult> // text → AudioResult
  dispose(): Promise<void> // idempotente, permite reload
}
type AudioResult = { samples: Float32Array, sampleRate: 24000, channels: 1, durationSec: number, wav: Uint8Array, text: string }
```

**Mapeamento para API pública real `voice-synthesis` (`src/index.ts:1`):**

| Consumidor (`TtsService`) | Engine (`voice-synthesis`) | Justificativa §7 |
|---|---|---|
| `isSupported()` | `Node ≥18` / `window+WebAssembly` | Evita `LOAD_FAILED` em SSR sem Audio |
| `getState()` | `KokoroVozzRuntime.isLoaded` + `state` local | Expor lifecycle sem `info` internals |
| `load()` | `import("voice-synthesis/dist/src/index.js")` → `new KokoroVozzRuntime({modelsDir, model:"q8"}).load()` | Lazy, dynamic import, idempotente |
| `synthesize(text)` | `runtime.synthesize(text)` → `AudioResult` (adiciona `channels:1`) | Reusa `SynthesisResult` sem expor `vozzPhonemize`/`tokenizePhonemes` |
| `dispose()` | `runtime.dispose()` | On-demand, permite `load()` novamente |

**Não importado diretamente (falha arquitetural se necessário):**

```
Kokoro internals, vozz internals, ONNX internals, tokenizer, voicepack, model files, phonemizer, runtime internals
```

O adapter **não** importa `vozz/g2p`, `onnxruntime-node`, `tokenizer.json`, `pf_dora.bin` — apenas `voice-synthesis/dist/src/index.js` via dynamic import.

---

## 4. Runtime — Onde o engine é carregado e por quê

**Investigação §11 (Next.js 16.1.6, webpack, Serwist PWA):**

* `voice-synthesis` usa `onnxruntime-node` (Node, `onnxruntime.dll` 28 MB) — **não pode** ser carregado no Server/SSR/Static Generation (Webpack tentaria bundle `onnxruntime-node` para browser e falha `Can't resolve 'onnxruntime-node'`).
* `vozz/g2p` é JS puro (36 kB) e **pode** rodar no Browser, mas `KokoroVozzRuntime` com `onnxruntime-node` é **Node-only** nesta fase; Browser futuro usará `onnxruntime-web` via adapter separado (não implementado).

**Estratégia client-only (§11):**

* **Top-level:** `src/lib/tts/synthesizer.ts` **não** faz `import from "voice-synthesis"` — apenas `import type` (type-only, sem runtime).
* **Runtime:** `load()` faz `await import("voice-synthesis/dist/src/index.js")` **dentro** da função, com guard `isSupported()` e `typeof window !== 'undefined'` para Browser. No SSR (`window` undefined, `process` undefined), `isSupported()` retorna `false` e `load()` rejeita `NOT_SUPPORTED` antes de importar.
* **Next.js:** `load()` deve ser chamado **apenas** em Client Components (`useEffect`, `onMount`, `dynamic(() => import(...), {ssr:false})`). Exemplo:

```ts
"use client"
import { useEffect, useState } from "react"
import { createTtsService } from "@/lib/tts"

export function useTts() {
  const [tts] = useState(() => createTtsService({ modelsDir: "..." }))
  useEffect(() => { if (tts.isSupported()) tts.load() }, [tts])
  return tts
}
```

* **Evidência:** `npm run build` **SUCESSO** (26.9s, `Generating static pages 27/27`, sem erro `Can't resolve onnxruntime-node` porque `synthesizer.ts` não importa no top-level; `voice-synthesis` só é importado dinamicamente em `load()`).

---

## 5. Lazy loading — Como o carregamento on-demand é preservado (§13)

```
application starts
  NO TTS MODEL LOADED (state UNINITIALIZED, 0 MB, adapter apenas 3 arquivos, ~8 kB)
    ↓
consumer requests TTS (user action, useEffect)
  tts.isSupported() → true
  await tts.load() → dynamic import("voice-synthesis") → KokoroVozzRuntime.load() → 4705 ms RMX3461 Q8, 176 MB PSS Node
    ↓
  load Kokoro (tokenizer 115, pf_dora 0.52 MB, model 92 MB, OrtSession)
    ↓
  tts.synthesize(text) → AudioResult (2.4 s, 115 kB wav)
    ↓
  tts.dispose() → 72 MB Node após GC, 418→40 MB log PSS Android, reload 844 ms
```

* **Não carregar no startup:** `createTtsService()` apenas cria estado `UNINITIALIZED`; `load()` é explícito e deve ser chamado sob demanda (ex.: primeiro `synthesize` ou botão `Ativar voz`).
* **Validado Android TTS-006:** Q8 on-demand `load 4705 ms → synth 5-6 s → release → reload 844 ms` 3× estável.

---

## 6. Lifecycle — Como o estado é tratado (§14)

**Estados do adapter (`TtsState`):** `UNINITIALIZED → LOADING → READY → SYNTHESIZING → READY → DISPOSED` (reuso `DISPOSED→LOADING`).

| Transição | Comportamento §7 |
|---|---|
| `load()` em `UNINITIALIZED` | `LOADING` → `READY`; segunda `load()` em `LOADING` retorna **mesma Promise** (deduplicada). |
| `synthesize()` antes de `load()` | Rejeita `TtsError("NOT_READY", "TTS não está pronto...")` (sem `LOAD_FAILED` silencioso). |
| `synthesize()` em `SYNTHESIZING` | **Delega ao engine** (serialização interna do `KokoroVozzRuntime` via `OrtSession` não reentrante); adapter não cria fila própria (§15). |
| `dispose()` | `READY`/`SYNTHESIZING` → `DISPOSED`; aborta `synthPromise` pendente; idempotente; permite `load()` novamente (on-demand). |
| Erro `LOAD_FAILED` | Volta a `UNINITIALIZED` (não `DISPOSED`), permite retry. |
| Erro `SYNTHESIS_FAILED`/`INVALID_TEXT` | Volta a `READY` (não `DISPOSED`). |

**Adapter não cria segundo lifecycle incompatível** — `getState()` reflete `engine.isLoaded` + `state` local.

---

## 7. Erros — Como são propagados (§16)

**Preservados sem conversão para Chat/UI:**

```
voice-synthesis (TTSRuntimeError/TTSInputError)
  ↓
TtsError(code, message, cause)
  ↓
consumer boundary
  ↓
caller decides (UI pode mostrar "Áudio indisponível", Chat pode ignorar)
```

| Engine | Consumer `TtsError.code` | Quando |
|---|---|---|
| — | `NOT_SUPPORTED` | `isSupported()===false` (SSR, Node <18) |
| `TTSRuntimeError: Runtime não carregado` | `NOT_READY` | `synthesize` antes de `load` |
| `OrtException: Load model failed` | `LOAD_FAILED` | `load()` falhou |
| `TTSRuntimeError: session.run failed` | `SYNTHESIS_FAILED` | `synthesize` falhou |
| `TTSInputError: Texto vazio` | `INVALID_TEXT` | `text.trim()===""` |
| `DISPOSED` | `DISPOSED` | `synthesize` após `dispose` |
| (futuro `AbortSignal`) | `CANCELLED` | `signal.aborted` |

**Não criar mensagens específicas** como `"Não foi possível falar sua resposta."` — pertence à UX futura (§16).

---

## 8. Isolamento — Quais dependências foram explicitamente mantidas fora (§18)

**Verificação via `grep` em `src/lib/tts/synthesizer.ts`:**

* **Não importa:** `ChatAssistant`, `Vosk`, `voice-transcription`, `React`, `Supabase`, `Gemini`, `Audio` player, `HTMLAudioElement`, `AudioContext`, `MediaRecorder`, `patient`, `admin`, `vanzacariasnutri/src/lib/supabase`, `src/components/ChatAssistant.tsx`.
* **Importa apenas:** `voice-synthesis` via **dynamic import** em `load()` (1 ocorrência), `types.ts` local.
* **STT desacoplado:** `voice-transcription` continua em `src/lib/voice/stt/` (Vosk), sem relação `Vosk→Kokoro` em `voice-synthesis`; aplicação futura orquestra `STT → TTS` externamente (§6, §10).

**Mecanismo existente de boundaries:** `eslint` com `import/no-restricted-paths` não configurado para `tts` → documentado como ausência (§18).

---

## 9. Bundle — Resultado da análise (§12)

**Antes do consumer:** `vanzacariasnutri` sem `voice-synthesis` → `next build` 26.9s, `/_next/static/chunks/9cb48f3a` 5.79 MB (precache warning).

**Depois do consumer (com `file:../voice-synthesis`):**

* `npm install` copiou `voice-synthesis` (400 MB com `models/`) para `node_modules/voice-synthesis` — **não bundlado** para browser porque `synthesizer.ts` **não** faz top-level import; `dist/` e `models/` ficam em `node_modules` mas só `dist/src/index.js` (8 kB) é importado dinamicamente em `load()`.
* `npm run build` **SUCESSO** (26.9s, `Generating static pages 27/27`, sem `Can't resolve onnxruntime-node` porque `onnxruntime-node` só é `require` dentro de `KokoroVozzRuntime` que só é `import` dinâmico em `load()`).
* **Não há:** inclusão do modelo Q8 (92 MB) no bundle, inclusão de `onnxruntime-node` no browser bundle, erro webpack, aumento inesperado (chunk 5.79 MB já existia).
* **Correção necessária para boundary:** **nenhuma** além do dynamic import já implementado; **não otimizar performance** neste sprint (§12).

**Se houvesse problema (ex.: Webpack tenta bundle `onnxruntime-node`):** corrigir com `dynamic import` + `ssr:false` + `webpack externals` — já correto.

---

## 10. Testes — Resultado completo (§17)

**Teste isolado `src/lib/tts/__tests__/ttsConsumer.test.ts` (5 casos, `vitest`):**

```
npm test src/lib/tts/__tests__/ttsConsumer.test.ts
  isSupported() true no Node ≥18
  synthesize antes de load rejeita NOT_READY
  lifecycle completo: load → synthesize → dispose → reload (Olá... → AudioResult 24000 Hz, 2.4 s, 115 kB wav, RIFF)
  INVALID_TEXT para string vazia
  não expõe internals do engine (keys: dispose,getState,isSupported,load,synthesize)

Test Files 1 passed, Tests 5 passed, Duration 23.75s
```

*Valida:* `AudioResult` existente, `samples` `Float32Array`, `sampleRate` 24000, `channels` 1, `wav` `Uint8Array` RIFF, `lifecycle` `UNINITIALIZED→READY→DISPOSED→READY`.

**Não testado (proibido §8, §9, §10):** reprodução (`HTMLAudioElement`), Chat (`ChatAssistant`), Vosk (`voice-transcription`), UI, `AudioTrack`.

**Isolamento arquitetural (§18):** `grep -r "ChatAssistant\|Vosk\|voice-transcription\|Audio(" src/lib/tts/` → 0 ocorrências.

---

## 11. Arquivos alterados — Lista precisa (§21)

**Criados (boundary):**

* `src/lib/tts/types.ts` — contrato `TtsService`/`AudioResult`/`TtsState`/`TtsError`
* `src/lib/tts/synthesizer.ts` — adapter `createTtsService()` (dynamic import, lazy, lifecycle, erros)
* `src/lib/tts/index.ts` — public export da boundary
* `src/lib/tts/__tests__/ttsConsumer.test.ts` — teste isolado text→AudioResult

**Modificados (dependência):**

* `package.json` — adicionado `"voice-synthesis": "file:../voice-synthesis"` (1 linha, sem monorepo, preserva `Vanusa/` com 3 projetos independentes)
* `package-lock.json` — `added 1 package` (voice-synthesis)

**Não alterados (proibido §23):**

* `ChatAssistant`, `chatbot_core`, `Gemini`, `RAG`, `Vosk`, `voice-transcription`, `Kokoro`, `pf_dora`, `vozz`, `model Q8`, `player`, `UI`, `Android`, `STT`

**Verificação de substituibilidade (§22):**

```bash
rm -rf src/lib/tts
npm run build # ainda SUCESSO (vanzacariasnutri sem TTS)
```

---

## 12. Questões abertas — Somente reais que impedem/influenciam próximo sprint (§21)

1. **Modelos no `file:`** — `npm install` copiou `voice-synthesis/models/` (400 MB) para `node_modules/voice-synthesis/models` — não bundlado, mas ocupa disco. Próximo sprint deve mover `models/` para `public/` ou `file:../voice-synthesis/dist` sem `models`, ou usar `npm pack --ignore` para não copiar `models`.
2. **Browser adapter ainda não existe** — `KokoroVozzRuntime` usa `onnxruntime-node` (Node); Browser precisará `onnxruntime-web` + `vozz/g2p` Web Worker (`KokoroWebRuntime` futuro, §13 do design). O boundary atual funciona em Node (testes) e documenta `isSupported()` para Browser, mas síntese em Browser ainda pendente.
3. **on-demand no Next.js** — `load()` deve ser chamado em Client Component (`useEffect`); SSR deve ver `isSupported()===false` e não carregar. Validado `next build` não carrega ONNX, mas runtime Browser real ainda não testado.

**Não há bloqueador para orquestração futura** — `TTS Consumer Boundary` está **substituível** (se amanhã `Outro Engine`, apenas `synthesizer.ts` muda).

---

## Out of Scope Findings

*Nenhum problema preexistente encontrado que impeça o objetivo do sprint. `npm run build` com warnings (5.79 MB chunk, sem `maximumFileSizeToCacheInBytes` para TTS) já existia antes do consumer.*

---

*Gate §26: `voice-synthesis → API pública → TTS Consumer Boundary → AudioResult` **funciona** sem `Chat/STT/Player/UI/Vosk/React/Supabase/Gemini` e sem carregar modelo no startup/build — **TTS-INTEGRATION-001 — CONSUMER BOUNDARY READY**.*
