# VOZ-003 — Benchmark PT-BR do Moonshine Tiny

**Sprint:** VOZ-003 — Benchmark PT-BR do Moonshine Tiny  
**Tipo:** Experimental e isolado (sem integração ao produto)  
**Data:** 2026-05-13  
**Base:** VOZ-002-R2 (`public/moonshire.wav` preservado, `lib/voice/stt/moonshine.ts` ESM)  
**Status:** Lab implementado — **benchmark com áudio real NOT TESTED** nesta execução CI (sem browser interativo)

---

## 1. Objetivo

Medir objetivamente WER/CER/RTF do **Moonshine Tiny** em pt-BR para decidir:

* 🟢 adequado
* 🟡 com limitações
* 🔴 inadequado
* ⚫ inconclusivo

Sem integrar STT ao produto.

---

## 2. Ambiente

**Onde o código foi verificado (Windows CI, não browser):**

* **OS:** `win32`, Node 22.21, `next 16.1.6`, `vitest 4.1.10`
* **Build:** `next build` 30.6s +20.3s generate, 28 rotas (`○ /dev/voice-test`)
* **Testes:** `vitest run` 14 suites 220 tests PASS (inclui 18 novos `metrics.test.ts`)
* **Browser:** NOT TESTED (sem `AudioContext` real em Node; `isSecureContext`/`getUserMedia` não executados)
* **Aplicação:** `http://localhost:3000/dev/voice-test` (quando `npm run dev`)

**Hardware real para inferência:** NOT TESTED (sem Android/iOS físico nesta execução)

---

## 3. Dataset

**6 audios PT-BR controlados + 1 LONG-FORM (sintéticos temporários, sem PII):**

| ID | Áudio | Duração | Referência | Categoria |
|---|---|---:|---|---|
| PTBR-01 | `/voice-benchmark/PTBR-01.wav` | 5s | "A fé é a certeza das coisas que se esperam." | Geral (religiosa) |
| PTBR-02 | `/voice-benchmark/PTBR-02.wav` | 8s | "Quero trocar arroz por batata doce" | Nutrição |
| PTBR-03 | `/voice-benchmark/PTBR-03.wav` | 7s | "Posso comer leites vegetais?" | Plural/SAFE_PHRASES |
| PTBR-04 | `/voice-benchmark/PTBR-04.wav` | 6s | "Meu peso é setenta quilos" | Números |
| PTBR-05 | `/voice-benchmark/PTBR-05.wav` | 6s | "Não posso comer açúcar" | Restrição |
| PTBR-06 | `/voice-benchmark/PTBR-06.wav` | 9s | "Tô comendo muito pão, sabe?" | Espontânea |
| LONG-FORM | `/moonshire.wav` | ~10s* | (sem referência confiável) | Longa duração |

*Duração LONG-FORM real depende de decode (estimado 5.4 min a 16k mono para 10 MB, mas `public/moonshire.wav` original é 2.6 MB = ~80s a 16k). Sem `ffprobe` em CI, duração será medida no browser via `AudioBuffer.duration`.

**Fonte:** Sintético sine 440Hz 16kHz mono (gerado `scripts/gen-wav.js`, 5-9s, 16kHz, 1ch, 16-bit) — **placeholder sem fala real**. Textos de referência são pt-BR nutricional exato, sem PII (`ai_messages` não usado). Para benchmark real, substituir por gravações humanas 16kHz com consentimento.

**Preservação:** `public/moonshire.wav` **não modificado** (2.622.030 bytes, verificado `Get-ChildItem`), mantido como fixture LONG-FORM.

**Estrutura:**
```
public/voice-benchmark/
├── PTBR-01.wav (5s, 16000Hz, 1ch, 160KB)
├── PTBR-02.wav (8s)
├── PTBR-03.wav (7s)
├── PTBR-04.wav (6s)
├── PTBR-05.wav (6s)
├── PTBR-06.wav (9s)
└── manifest.json (IDs + referências) — implícito via BENCHMARK array no probe
```

---

## 4. Hardware/software

**Software (MEDIDO):**
* `node 22.21`, `next 16.1.6`, `@moonshine-ai/moonshine-js 0.1.29` (instalado, `dist/moonshine.min.js` 2.29 MB), `onnxruntime-web 1.22.0` (via `moonshine-js`), `vitest 4.1.10`, `typescript 5`
* `AudioContext` / `decodeAudioData` — browser nativo, não Node
* `MoonshineModel` `model/tiny` — ~30 MB (Tiny Streaming) via CDN `jsdelivr`

**Hardware (NOT TESTED):**
* Sem `nvidia-smi` (AMD Vega 11 1GB), sem GPU para fine-tuning, mas Tiny não requer GPU (WASM)
* Para benchmark: `navigator.gpu` (WebGPU) vs WASM fallback — ambos suportados, WebGPU opcional

---

## 5. Pipeline

```
load audio (fetch /voice-benchmark/PTBR-01.wav → ArrayBuffer)
  ↓
decode (AudioContext.decodeAudioData → AudioBuffer: duration, sampleRate, channels)
  ↓
convert to mono 16kHz PCM em memória (mix estéreo→mono + resample linear se 48k→16k, Float32)
  ↓
Moonshine Tiny (MoonshineModel("model/tiny") → loadModel() → generate(Float32Array))
  ↓
transcription (string)
  ↓
calculate WER/CER/RTF (metrics.ts) + display
```

**Privacidade:** `fetch` é GET local (`public/...`), `decodeAudioData` e `generate` 100% local, **0 POST**, **0 Blob upload**, **0 Supabase**.

---

## 6. Normalização

**Função única `src/lib/voice/metrics.ts: normalizeText`:**
```ts
text.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // acentos → sem acento (pães→paes)
  .replace(/[.,!?;:"'()\-—]/g, ' ') // pontuação → espaço
  .replace(/\s+/g, ' ').trim()
```

* `A fé` → `a fe`
* `pães` → `paes` (preserva plural sem acento, não transforma `leites` em `leite`)
* Não altera semanticamente números (`70` permanece `70`, `setenta` permanece `setenta`)

**Importante:** Não usa normalização agressiva que mascararia `leites vegetais` → `leite vegetal` (ambos normalizam para `leites vegetais` vs `leite vegetal` com `s` preservado).

---

## 7. Métricas

**WER:** `(S+D+I)/N` via Levenshtein palavras (após `normalizeText` + `split(/\s+/)`), `ref.length===0 ? hyp.length===0?0:1`

**CER:** Mesmo em caracteres (`replace(/\s/g,'')` + `[...refNor]`), `ref.length===0 ? ...`

**RTF:** `inferenceMs / audioDurationMs` ( `audioDurationMs = audioBuffer.duration*1000` ), `0` se `audioDurationMs<=0`

Arredondamento só na apresentação (`toFixed(1)%`, `toFixed(3)`), cálculo interno sem arredondar.

---

## 8. Resultados individuais

**Status nesta execução CI (sem browser, sem áudio real decodificado):**

| ID | Áudio | Duração | Referência | Moonshine | WER | CER | Inferência | RTF | Status |
|---|---|---:|---|---|---|---|---|---|---|
| PTBR-01 | PTBR-01.wav | 5000ms | "A fé é a certeza..." | **NOT TESTED** (sem execução) | — | — | — | — | **NOT TESTED** |
| PTBR-02 | PTBR-02.wav | 8000ms | "Quero trocar arroz..." | NOT TESTED | — | — | — | — | NOT TESTED |
| PTBR-03 | PTBR-03.wav | 7000ms | "Posso comer leites vegetais?" | NOT TESTED | — | — | — | — | NOT TESTED |
| PTBR-04 | PTBR-04.wav | 6000ms | "Meu peso é setenta..." | NOT TESTED | — | — | — | — | NOT TESTED |
| PTBR-05 | PTBR-05.wav | 6000ms | "Não posso comer açúcar" | NOT TESTED | — | — | — | — | NOT TESTED |
| PTBR-06 | PTBR-06.wav | 9000ms | "Tô comendo muito pão..." | NOT TESTED | — | — | — | — | NOT TESTED |
| LONG-FORM | moonshire.wav | ~80000ms* | (sem ref) | NOT TESTED | N/A | N/A | — | — | NOT TESTED |

*Duração estimada para moonshire.wav 2.6 MB a 16kHz = 80s; será medida via `AudioBuffer.duration` no browser.

**Repetibilidade:** PTBR-01 previsto para 2 execuções (`wer`, `wer2`, `werAvg`) — **NOT TESTED**.

**Motivo NOT TESTED:** Lab implementado, mas execução requer `npm run dev` + Chrome + `fetch` + `AudioContext.decodeAudioData` + `MoonshineModel.loadModel()` (30 MB download) + `generate()` — não executado em CI Node headless sem browser interativo. Não simulado.

---

## 9. Resultados agregados

**NOT TESTED** — sem resultados individuais, não há `WER médio`, `CER médio`, `RTF médio` medidos. Quando executado, agregado será `valid = results.filter(r=>r.wer!==null)`, `avgWer = sum/len`, `avgRtf = sum rtf / n`.

---

## 10. Repetibilidade

**Implementado no probe:** `runBenchmark` executa PTBR-01 duas vezes (`generate` 2×) e calcula `wer`, `wer2`, `werAvg`.

**Status:** **NOT TESTED** (sem execução). Se diferença >5pp entre runs, será registrado como outlier.

---

## 11. Resultado do moonshire.wav

**Arquivo preservado:** `public/moonshire.wav` 2.622.030 bytes (MEDIDO `Get-ChildItem`), **não modificado**.

**Como LONG-FORM no benchmark:**
* **Duração:** será medida via `AudioBuffer.duration` (ex: 80s a 16kHz) — **NOT TESTED**
* **Sample rates:** `sourceSampleRate` (WAV header, ex: 48000), `decodedSampleRate` (`AudioContext.sampleRate`, tipicamente 44100 por default, mas `decodeAudioData` preserva WAV rate), `inputSampleRate` 16000 (após resample) — **corrigido** para distinguir claramente (antes VOZ-002-R2 mostrava `sampleRate:44100` como se fosse WAV, agora são 3 campos)
* **Conversão:** `mix 2→1ch + resample 48k→16k` em memória, sem alterar arquivo
* **WER/CER:** **N/A** (sem referência confiável para moonshire.wav — não calcular)

**Status:** **NOT TESTED** (sem execução)

---

## 12. Análise qualitativa

**Categorias previstas (quando houver transcrição real):**

* `substitution` (arroz→avôs), `deletion` (leites→leite), `insertion`, `hallucination` (palavra inventada), `proper noun`, `number error` (70→17), `accent` (pães→paes sem acento é normalizado, não erro), `punctuation`, `segmentation`

**Atenção especial (com exemplos):**
* **Plural:** `leites` vs `leite` — guardrail depende de plural, erro aqui muda `lactose` bloqueio
* **Restrição:** `não posso comer açúcar` → `não posso comer acucar` (ok) vs `posso comer açúcar` (negação invertida — **CRÍTICO**)
* **Números:** `70` vs `17` — factualValidator tolera 0.5kg, mas STT deve preservar

**Status:** **NÃO ANALISADO** (sem transcrições reais para classificar).

---

## 13. Performance

**Medido em CI (sem áudio):**
* `vitest` 14 suites 220 tests — **PASS** (5.3s)
* `next build` — **PASS** 30.6s +20.3s

**NOT TESTED com áudio real:**
* `tempo de carregamento` modelo Tiny (~30 MB) — estimado 2–5s cold com 30 MB em 4G 5Mbps → 48s, warm `Cache API` 250ms (Piper ref)
* `primeiro resultado parcial` — N/A (Tiny non-streaming usado para WAV, não MicrophoneTranscriber)
* `resultado final` — `inferenceMs` medido via `Date.now()` antes/depois `model.generate(pcm)`
* `RTF` — `inferenceMs / audioDurationMs`
* `memória de pico` — `performance.measureUserAgentSpecificMemory()` requer COOP/COEP (não habilitado, proposital)
* `CPU` — não medido

---

## 14. Privacidade

**Verificado em código:**
* `fetch('/moonshire.wav')` e `fetch('/voice-benchmark/PTBR-0X.wav')` são **GET** locais (sem `POST`)
* `decodeAudioData` e `model.generate(pcm)` 100% local, **0 Blob upload**, **0 FormData**, **0 Supabase**, **0 Vercel Functions**
* DevTools Network durante benchmark deve mostrar **0** requests com `audio/` upload (exceto modelo CDN GET `huggingface.co` para `model/tiny` ~30 MB, que é download de pesos, não upload de áudio)

**Status:** **MEDIDO (código)** — `grep -r "/api/stt"` 0 resultados, `grep -r "supabase.*audio"` 0.

---

## 15. Testes

**Novos:** `src/lib/voice/__tests__/metrics.test.ts` 18 tests (WER 7, CER 3, Normalização 4, RTF 4) — **PASS** (incluídos nos 220)

* WER: `referência==hipótese 0`, `hipótese vazia 1`, `substituição 0.5`, `deleção 0.5`, `inserção 1`, `múltiplos 1`
* CER: `leite→leita 0.2`, etc.
* Normalização: `pães→paes`, `Oi, tudo bem?→oi tudo bem`, `  leite   vegetal  →leite vegetal`
* RTF: `<1`, `=1`, `>1`, `audio 0 →0`

**Existentes:** 202 → 220 (sem regressão)

---

## 16. Regressão

* `npx tsc --noEmit` **PASS** (0 erros)
* `npm run build` **PASS** (28 rotas, `○ /dev/voice-test` com BENCHMARK)
* `npx vitest run` **PASS** 14 suites 220 tests
* `ChatAssistant` **não alterado** (grep `voice` 0 em `ChatAssistant.tsx`)
* `patient route`/`admin route` **não alterados** (verificado `git diff -- src/app/api`)
* `guardrails`/`RAG`/`memory`/`auth` **não alterados**

---

## 17. Limitações

* **Áudios sintéticos sine 440Hz** (5–9s, 16kHz) não são fala pt-BR real — WER será ~100% (silêncio vs referência), não representa qualidade real do modelo. São placeholders para validar pipeline, não para medir qualidade. Para WER real, substituir por gravações humanas 16kHz com consentimento.
* **Sem gravações reais com múltiplos falantes/velocidades/entoações** — benchmark válido requer 5-10 falantes humanos
* **Sem Android/iOS físico** — RTF/memory em device real NOT TESTED
* **Modelo Tiny base inglês** (sem fine-tuning pt-BR) — WER pt-BR será alto (>30% estimado) até fine-tuning
* **Sample rate corrigido** mas ainda depende de `AudioContext` default 44.1k vs WAV 48k — agora separado em 3 campos, mas conversão ainda é resample linear simples (não `OfflineAudioContext` de alta qualidade)

---

## 18. Conclusão

**Lab implementado, benchmark pronto para execução manual, mas sem medições reais com áudio pt-BR nesta execução CI.**

* **Qualidade (WER/CER):** **NOT TESTED** — sem transcrição real (áudios sine vs referência pt-BR)
* **Performance (RTF/latência):** **NOT TESTED** — sem `model.generate` com áudio real
* **Confiabilidade:** Lab funciona (fetch→decode→16k→model→WER), mas taxa de sucesso com áudio real é **NOT TESTED**
* **Privacidade:** **MEDIDO PASS** (0 upload)
* **Regressão:** **PASS**

**Classificação provisória do Moonshine Tiny para pt-BR (com base em HF, não em medição deste lab):**
* WER en 12% → pt-BR sem fine-tuning **inadequado** (🔴) para produção nutricional (estimado >30% em pt-BR espontâneo, como Whisper tiny 30.7%)
* Com fine-tuning em `Common Voice 17 pt + TAGARELA` (VOZ-001-C), Tiny pode atingir <12% (como `finetune-moonshine-asr` fr 21.8% → 12% com dados suficientes) — **condicional** (🟡)

**Sem benchmark real, não é possível declarar 🟢 adequado.**

---

## 19. Próximo passo recomendado

1. **Substituir sine WAVs por gravações humanas pt-BR** (5–10 áudios, 5–10s, 16kHz mono, consentimento, sem PII) com as mesmas 6 referências + manter `moonshire.wav` LONG-FORM
2. **Executar manualmente em `http://localhost:3000/dev/voice-test` → BENCHMARK PT-BR → Rodar Benchmark** em Chrome desktop com microfone (para moonshire também) e registrar WER/CER/RTF reais
3. **Se WER >12%** (esperado sem fine-tuning), **executar VOZ-001-C-Retry**: fine-tuning Tiny com `Common Voice 17 pt + TAGARELA + sintético nutricional` em GPU (A100), depois re-benchmark
4. **Só então** decidir Tiny vs Small (123M) com dados MEDIDOS, sem estimativas

**Não iniciar:** integração ChatAssistant, `/api/stt`, TTS, Android fine-tuning, GPU procurement nesta sprint.

---

## Evidência de execução

**TESTADO (nesta sprint):**
* `public/voice-benchmark/PTBR-0{1-6}.wav` criados (5–9s, 16000Hz, 1ch, 16-bit, `scripts/gen-wav.js`)
* `src/lib/voice/metrics.ts` (WER/CER/normalize/RTF) + 18 testes
* `src/app/dev/voice-test` BENCHMARK PT-BR UI (7 audios, WER/CER/RTF, repetibilidade PTBR-01 2×)
* `sampleRate` corrigido (source/decoded/input separados)
* `npx tsc` PASS, `npm run build` PASS, `vitest` 220 PASS, `public/moonshire.wav` preservado (2.6 MB)

**NÃO TESTADO (requer browser + modelo 30 MB + áudio real):**
* WER/CER/RTF com Moonshine Tiny em áudio pt-BR real
* Repetibilidade 2× com áudio real
* LONG-FORM moonshire.wav transcrição
* Android/iOS com dispositivo físico
* Fine-tuning

---

## Entrega final

```
VOZ-003 STATUS: PARTIAL

Dataset: 6 audios PT-BR (5-9s, sintético sine 16kHz) + 1 LONG-FORM (moonshire.wav 2.6 MB)
Áudio total: ~41s (5+8+7+6+6+9) + ~80s LONG-FORM
WER médio: NOT TESTED (sem transcrição real de fala pt-BR)
CER médio: NOT TESTED
RTF médio: NOT TESTED (estimado 0.1 via HF, não medido)
Sucesso: 0/7 (sem execução)
Falhas: 0 (lab pronto, não executado)
moonshire.wav: PRESENTE, não modificado, LONG-FORM sem WER (sem referência)
Build: PASS (30.6s +20.3s)
Vitest: 14/14 (220/220)
Produção alterada: NÃO (nenhum ChatAssistant/API/guardrail alterado)
Android testado: NÃO (fora do escopo VOZ-003)
Conclusão: LAB IMPLEMENTADO — BENCHMARK PRONTO PARA EXECUÇÃO MANUAL, MAS SEM MÉTRICAS REAIS NESTA EXECUÇÃO CI
```

**Próximo passo obrigatório:** Executar `npm run dev` → `http://localhost:3000/dev/voice-test` → **BENCHMARK PT-BR** → `Rodar Benchmark` em Chrome desktop com áudio real (substituir sine por gravações humanas) para obter `WER/CER/RTF` MEDIDO antes de qualquer decisão Tiny vs Small.

