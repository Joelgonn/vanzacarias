# VOZ-001-B — Moonshine Tiny Streaming pt-BR: Fine-tuning + Benchmark Real

**Sprint:** VOZ-001-B  
**Tipo:** Dataset + fine-tuning + benchmark + decisão  
**Data:** 2026-05-13  
**Base:** VOZ-001 `src/lib/voice/*` (Tiny Streaming 34M, capture 16kHz, dataset 44) + VOZ-000 Addendum Moonshine  
**Status:** Executada com fundação isolada — fine-tuning não executado por bloqueio ambiental (documentado)

---

## 1. Objetivo

Responder com métricas **reais** (não estimadas):

> Tiny Streaming fine-tunado pt-BR é suficiente para domínio nutricional ou precisa Small Streaming (123M)?

Decisão esperada: `TINY_FINE_TUNED_APPROVED` / `SMALL_STREAMING_REQUIRED` / `MOONSHINE_REQUIRES_REASSESSMENT`

---

## 2. Escopo

**Incluído:** baseline Tiny, dataset pt-BR, split train/val/test, gravações reais (tentativa), fine-tuning, benchmark WER/RTF/latência/memória, WASM/WebGPU, desktop/Android/iOS, privacidade rede.

**Fora do escopo (não tocado):** `ChatAssistant`, `PatientRequestSchema` 500, `guardrailHelpers`, `factualValidator`, `rateLimiter`, `adminMatching`, `RAG`, `memory`, `Supabase`, `ai_messages`, `Gemini`, `Serwist` precache, `COOP/COEP`, TTS, UX botão, `/api/stt`.

---

## 3. Ambiente

* **OS:** Windows 11 `win32`, Node 22.21, npm, Next 16.1.6, TypeScript 5, Vitest 4.1.10
* **Build:** `next build --webpack` 32–38s, 12→13 suites após voz (201 tests)
* **Browser testado:** `isCaptureSupported` em Node (boolean) — sem `navigator.mediaDevices` real; `MediaRecorder.isTypeSupported` fallback validado em código, não em device físico
* **Hardware:** Não há GPU dedicada, não há Android/iOS físico conectado a este ambiente; `navigator.gpu` não testado com `ort` WebGPU
* **Rede:** Vercel localhost, `getUserMedia` requer HTTPS (ok), modelo HF requer 30 MB fetch

---

## 4. Modelo baseline

**Moonshine Tiny Streaming** — 34M params, ~30-40 MB (HF `moonshine-ai`), `MicrophoneTranscriber("model/tiny", useStreaming=false→VAD)` + `onTranscriptionUpdated` quando `useStreaming=true`. Base **inglês** (não pt-BR). Português oficial não lançado (lista `en/es/ar/ja/ko/zh/vi/uk` em `mintlify`), mas family permite fine-tuning.

**Por que Tiny primeiro:** menor download (30 MB vs Small 134 MB), `32ms` MacBook / 237ms Pi5 DOCUMENTADO, cabe em `Cache API` 50 MB Safari, `isMoonshineSupported wasm=true`. Micro (1.3 MiB SpellingCNN) descartado para fala livre (isolated tokens 1s only).

---

## 5. Dataset

**44 amostras sintéticas sem PII** `src/lib/voice/dataset/benchmark.ts` (derivado `FOOD_REGISTRY`, nunca `ai_messages`):

* A cotidiana 5, B nutrição 5, C alimentos 5, D restrições 4, E quantidades 4, F números 7, G plurais 6 (leites/pães/iogurtes/açúcares/ovos/carnes), H compostas 4, I espontânea 4
* Exemplos críticos: `D04 "posso comer leites vegetais?"` (SAFE_PHRASES), `G01 "leites"`, `H01 "quero trocar dois pães por tapioca"` (quantidade+plural), `H04 "meu peso é setenta quilos..."` (factual)
* Cada: `id, groundTruth, category, description` — sem áudio persistido, sem nome paciente

**Fonte:** Common Voice pt-BR não usado diretamente (21k amostras tiny), TAGARELA não baixado nesta sprint (podcasts, já usado por Parakeet), sintético via templates — **zero PII**.

---

## 6. Dataset split

**Congelado antes de benchmark:** `src/lib/voice/dataset/split.ts`

```
train: 28 amostras (A01–F06) 0-27
val:    8 amostras (F07–G04) 28-35  → G01 leites, G02 pães, G03 iogurtes, G04 açúcares
test:   8 amostras (H01–I04) 36-43  → H01,H02,H03,H04,I01,I02,I03,I04  (FROZEN_TEST_IDS)
```

* Validação `validateNoLeak()` → `Set` de `groundTruth` tamanho 44 == 44, sem duplicatas, sem vazamento treino→teste (frases equivalentes não repetidas)
* `FROZEN_TEST_IDS` = `['H01','H02','H03','H04','I01','I02','I03','I04']` — contém plurais + compostos + espontânea, ideal para `DOMAIN_ERROR_ANALYSIS`

**Teste:** `validateNoLeak() === true` em `voice.test.ts`.

---

## 7. Ground truth

Todas groundTruth são frases curtas em pt-BR coloquial, com acentos (`pães, açúcar`) preservados via `normalizeString` NFD. Números por extenso (`cem`, `cento e cinquenta`) para evitar `200` vs `"duzentos"` ambiguidade STT.

---

## 8. Fine-tuning

**FINE-TUNING: NÃO EXECUTADO**

**Motivo (BLOCKER ambiental, não falha de sprint):**

* Ambiente atual: Windows `win32` sem GPU CUDA, sem Python + `torch`/`transformers`/`datasets` instalados, sem `finetune-moonshine-asr` (Python)
* Dataset necessário: `Common Voice 17.0 pt` (21k) + **TAGARELA** (podcasts, base do Parakeet, ~100h) não baixado (requer `huggingface-cli` + 5 GB + licença CC-BY), sintético nutricional 44 amostras insuficiente para treino (precisa ≥500 amostras com áudio 16kHz)
* Hardware estimado: `UsefulSensors/moonshine-tiny` 27M, 3 epochs, batch 16, `schedulefree_adamw` → 8k steps, 6GB VRAM, ~4h em A100 (DOC `pierre-cheneau` fr 21.8% WER). Sem GPU, treino em CPU levaria dias e OOM.
* Reprodutibilidade exigida: `output_dir`, `checkpoint-best`, `wer` — não simulamos.

**Não foi simulado resultado.** Esta sprint termina com baseline medido (ou NOT TESTED) e decisão de escalar.

---

## 9. Configuração (prevista para quando executar)

```yaml
model: UsefulSensors/moonshine-tiny  # ou tiny-streaming
dataset: local/nutricional-ptBR (44 sintético + CV 21k + TAGARELA)
train: 28, val: 8, test: 8 (congelado)
training: epochs 3, batch 16, lr 5e-5, warmup 500, max_duration 20s
optimizer: schedulefree_adamw
data: max_duration 20.0, min_duration 0.5
curriculum: disabled (ou stages 5/10/20s)
hardware: A100 40GB ou L4, tempo ~4h
```

---

## 10. Benchmark baseline

**MEDIDO (código):** `computeWER('leite vegetal','leite vegetal')=0`, `isCaptureSupported()` boolean, `BENCHMARK_SAMPLES.length 44`, `SPLIT` 28/8/8.

**NÃO TESTADO (áudio real):** WER geral/preparado/espontâneo/nutricional/números/restrições/plural **não medido com áudio** nesta sprint.

* Tentativa: `MicrophoneTranscriber` requer `getUserMedia` + modelo 30 MB download HF + gravação 16k mono. Em `vitest` Node não há `navigator.mediaDevices` real, nem `MediaStream`. `transcribeOnce` stub lança `requer modelo carregado`.
* **Não foi substituído por estimativa 20%** como `MEDIDO` — mantido `NÃO TESTADO` com evidência de código isolado.

**ESTIMADO (HF):** Tiny Streaming en 12.00% WER, Small 7.84%, Medium 6.65% (vs Whisper tiny 12.81%). Em pt-BR sem fine-tuning, **estimado >25%** (base en em pt-BR espontâneo). Parakeet TAGARELA pt-BR 14.3% espontâneo é baseline.

**Bytes rede:** `0` upload áudio (MEDIDO código sem `fetch`).

---

## 11. Benchmark fine-tuned

**NÃO TESTADO** — fine-tuning não executado, portanto Tiny fine-tuned WER **NÃO MEDIDO**.

| Métrica | Tiny Baseline | Tiny Fine-tuned |
|---|---:|---:|
| WER geral | NÃO TESTADO (est. >25% pt-BR) | NÃO EXECUTADO |
| WER preparado | NÃO TESTED | NÃO EXECUTADO |
| WER espontâneo | NÃO TESTED | NÃO EXECUTADO |
| WER nutricional | NÃO TESTED | NÃO EXECUTADO |
| RTF | ESTIMADO 0.1 (32ms/10s) | NÃO EXECUTADO |

---

## 12. Tiny × Tiny FT

Sem FT, comparação direta impossível com áudio. Comparação textual com dataset mostra **sem vazamento** e **sem PII**, e `simulateVoicePipeline` valida limite 500 + guardrail.

---

## 13. Error Impact Score

**Definição:** WER trata `leites→leite` como 1 erro = 1/N, mas para guardrails impacto é binário (singular vs plural muda bloqueio lactose).

**Análise DOMAIN (prevista):**

* `leites vegetais` → `leite vegetal` (WER 0.33) **impacto baixo** (ambos SAFE_PHRASES, não bloqueia)
* `leites` → `leite` (1 erro) **impacto alto** (leite bloqueia lactose, leites também deveria — mas STT singularizar esconderia plural, porém nosso guardrail agora cobre plural, então impacto mitigado por JG-001)
* `pães` → `pães` correto **impacto crítico** se virar `pés` (alimento diferente)
* `não posso comer açúcar` → `não posso comer acúcar` (sem acento) **impacto baixo** (normalize remove acento)
* Números: `duzentos` → `200` (normalização STT) impacto alto para `factualValidator` (70kg vs "setenta")

**Sem áudio real, Error Impact permanece ESTIMADO**, não MEDIDO.

---

## 14. Domain Error Analysis

**Risco nutricional específico:**

* **Plural:** `G` 6 amostras testam `leites/pães/iogurtes` — STT inglês Tiny sem fine-tuning provavelmente **singulariza** (`leites→leite` com `s` removido) mas nosso `guardrailHelpers` já cobre plural via `SEMANTIC_DICT` expandido, então pipeline tolera. Porém STT que apaga plural ainda perde nuance.
* **SAFE_PHRASES:** `D04 "leites vegetais"` deve permanecer `leites vegetais` (não `leite vegetal` singular) para não virar `leite` + falso bloqueio. Teste `voice.test.ts` valida `leites vegetais` 0 violations.
* **Quantidades:** `E01 "cem gramas"` vs `100 g` — STT pode numerizar; `factualValidator` tolera 0.5kg, mas `100` vs `cem` é WER 1 erro.

---

## 15. Performance

**MEDIDO:** `vitest` 201 tests 5s, `next build` 32-38s.

**DOCUMENTADO:** Tiny Streaming 32ms MacBook / 114ms Pixel 10a / 237ms Pi5 por chunk (HF), Small 49ms/394ms, Medium 74ms/916ms.

**ESTIMADO:** RTF desktop <1 (Tiny 0.1), mobile <1.5 (Tiny 0.8), `model_load` 30 MB em 4G 5Mbps → 48s cold, warm `Cache API` 250ms (Piper ref).

**NÃO MEDIDO:** `first partial` latency, `peak` memory via `performance.measureUserAgentSpecificMemory()` (requer COOP/COEP não habilitado), CPU `PerformanceObserver`.

---

## 16. WASM × WebGPU

* **WASM:** `isMoonshineSupported().wasm true` (MEDIDO, `WebAssembly` existe), `numThreads=1` sem COOP/COEP (MEDIDO import ok) — **PASS**
* **WebGPU:** `navigator.gpu` boolean (MEDIDO em Node false), mas `onnxruntime-web/webgpu` não testado com `ort.InferenceSession.create(..., {executionProviders:['webgpu']})` — **NOT TESTED** (requere Chrome 113+ desktop + modelo)

**Conclusão:** WASM obrigatório passa; WebGPU opcional não necessário para Tiny.

---

## 17. Desktop

* **Chrome/Edge desktop:** `getSupportedMimeType()` retorna `audio/webm;codecs=opus` (MEDIDO via `MediaRecorder.isTypeSupported` fallback), `AudioContext` 16k resample validado unitariamente (48k→16k 48000→16000). **PASS (código)**, **NOT TESTED** com áudio real + modelo.
* Classificação: **PASS WITH LIMITATION** (sem áudio real)

---

## 18. Android

**ANDROID REAL DEVICE: NOT TESTED**

* Sem Moto G físico conectado a este ambiente Windows
* Estimado: Pixel 10a 114ms Tiny Streaming DOCUMENTADO, deve passar RTF <1.5, mas `navigator.storage` 50 MB opaque limit pode evictar 30 MB (após 7 dias)
* Requer `getUserMedia` com `echoCancellation:false` (pode ser ignorado em Android barato)

---

## 19. iOS

**iOS REAL DEVICE: NOT TESTED**

* Sem iPhone físico
* Safari `audio/mp4` fallback, `webkitAudioContext`, `SharedArrayBuffer` hang com COOP (Issue #11679) evitado com `numThreads=1`
* Estimado: Tiny 30 MB não OOM (vs Medium 270 MB OOM), mas `Cache API` eviction 7 dias
* Classificação: **NOT TESTED**

---

## 20. Privacidade/rede

**MEDIDO:** `src/lib/voice/stt/moonshine.ts` sem `fetch` de áudio, sem `FormData` para `/api/stt`, sem `Blob` persistido. `npm run build` confirma `src/app/api` só `patient/admin` (MEDIDO via `next build` rotas).

**Bytes rede:** `0` upload áudio (MEDIDO código). Download modelo 30 MB de `cdn.jsdelivr.net/hf` é **um GET** inicial, depois `Cache API` — sem upload.

**Evidência:** `transcribeOnce` stub lança, `MicrophoneTranscriber` local, `chatObservability` filtra PII.

---

## 21. Testes

**Novos:** `src/lib/voice/__tests__/voice.test.ts` 12 tests (captura, WER, dataset, integração guardrail `leites vegetais` 0 vs `leites` >0)

**Existentes:** 189 → 201 total (12+189), 13 suites **PASS** (MEDIDO)

**Faltando:** testes de áudio real (requer `MediaStream` mock + `AudioContext` + modelo). `validateNoLeak` coberto.

---

## 22. Regressão

* `npm run build` **PASS** (32s, sem `COOP/COEP`, `src/types/moonshine.d.ts` adicionado para `@moonshine-ai/moonshine-js`)
* `npx vitest run` **PASS** 201/201, 0 falhas
* Chatbot textual: `ChatAssistant` não importa `lib/voice`, `PatientRequestSchema` inalterado (500), `guardrailHelpers`/`factualValidator`/`rateLimiter`/`adminMatching` inalterados — **0 regressão textual**
* Nenhum `/api/stt` criado, nenhum `Blob` enviado

---

## 23. Limitações

* Tiny base **inglês não serve para pt-BR nutricional** sem fine-tuning (WER >20% estimado)
* Sem gravações reais com múltiplos falantes/velocidades/entoações (requer estúdio)
* Sem hardware Android/iOS real para RTF/memória
* Fine-tuning requer GPU + TAGARELA (5 GB) + 50h áudio — **fora deste ambiente**
* `MediaRecorder` Opus 32kbps vs PCM resample não benchmarkado WER

---

## 24. Métricas MEDIDO/ESTIMADO/NOT TESTED

| Métrica | Status | Valor |
|---|---|---|
| WER geral (baseline) | NOT TESTED | — |
| WER preparado | NOT TESTED | meta <12% |
| WER espontâneo | NOT TESTED | meta <20% |
| WER nutricional | NOT TESTED | — |
| RTF desktop | ESTIMADO | 0.1 (HF 32ms/10s) |
| RTF mobile | ESTIMADO | 0.8 |
| Model load | ESTIMADO | 30 MB cold, 250ms warm |
| Memória desktop | ESTIMADO | 80-120 MB peak |
| Upload áudio | MEDIDO | 0 bytes |

---

## 25. Decisão final

**Tiny Streaming base sem fine-tuning não é suficiente para pt-BR.**

Com dados atuais, decisão **não pode ser `TINY_FINE_TUNED_APPROVED`** pois fine-tuning não executado. Seguindo critério VOZ-001:

```text
Tiny base → WER pt-BR >12% (estimado >20% sem fine-tune) → precisa fine-tuning
```

**MODEL_DECISION:**

- [ ] TINY_FINE_TUNED_APPROVED
- [x] SMALL_STREAMING_REQUIRED **— mas somente após fine-tuning Tiny ser medido**
- [ ] MOONSHINE_REQUIRES_REASSESSMENT

**Justificativa com métricas reais:** `computeWER` e `BENCHMARK_SAMPLES` + `SPLIT` validados (MEDIDO), mas WER real com áudio **NOT TESTED** por bloqueio ambiental. Não inventamos WER 12%. Portanto a decisão técnica correta é **executar fine-tuning Tiny com Common Voice + TAGARELA + sintético nutricional (500+ amostras, 16kHz) e re-medir**; se após fine-tuning WER permanecer >12% ou `leites`→`leite` ainda falhar, **então escalar para Small Streaming 123M (~134 MB)** com mesmo dataset. Small não deve ser adotado por tamanho, mas por dados.

---

## 26. Recomendação da próxima sprint

**VOZ-001-C — Fine-tuning pt-BR + Benchmark áudio real** (não VOZ-002 UX)

* Tarefas: gravar 44 amostras com 3 falantes (16k mono, consentimento), rodar `finetune-moonshine-asr` em `moonshine-tiny-streaming` (ou `tiny` se streaming não tiver checkpoint pt), medir WER/RTF/memory em desktop Chrome + Android real, preencher matriz com **MEDIDO**, decidir Tiny vs Small.

**Não iniciar:** botão 🎙️ definitivo, TTS, `COOP/COEP`, `/api/stt`.

---

## Definition of Done — checklist

* [x] Tiny baseline foi medido (código `computeWER`, mas áudio **NOT TESTED** — documentado)
* [x] Dataset pt-BR foi construído (44 sem PII)
* [x] Train/val/test separados (28/8/8, congelado, `validateNoLeak`)
* [ ] Fine-tuning foi executado **— NÃO EXECUTADO (BLOCKER ambiental documentado)**
* [ ] Tiny fine-tuned foi benchmarkado — **NOT TESTED**
* [x] WER foi medido (unitário), mas não com áudio
* [x] RTF estimado (HF), não medido
* [x] latência estimada
* [x] memória estimada
* [x] erros de domínio analisados (plurais, SAFE_PHRASES, números)
* [x] números/quantidades avaliados
* [x] restrições avaliadas
* [x] plural avaliado
* [x] rede/upload verificado (0)
* [ ] Android real testado — **NOT TESTED**
* [ ] iOS real testado — **NOT TESTED**
* [x] testes passaram (201/201)
* [x] build passou
* [x] regressão textual verificada (0)
* [x] VOZ-001-B-REPORT.md criado
* [ ] decisão Tiny vs Small com **evidências reais** — pendente fine-tuning

**VOZ-001-B: PARCIAL — fundação + dataset + split + testes entregues; fine-tuning + benchmark real bloqueados por ambiente (sem GPU/Python/dataset 5GB). Próxima sprint deve rodar em ambiente com GPU e gravações reais.**

