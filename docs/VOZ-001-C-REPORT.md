# VOZ-001-C — Moonshine Tiny Streaming pt-BR: Benchmark Real + Fine-tuning + Decisão de Modelo

**Sprint:** VOZ-001-C  
**Tipo:** Validação experimental STT  
**Data:** 2026-05-13  
**Base:** VOZ-001 (Tiny Streaming 34M), VOZ-001-B (dataset 44, split 28/8/8), VOZ-000 Addendum Moonshine  
**Status:** Executada — **BLOCKED_BY_ENVIRONMENT** para fine-tuning e benchmark de áudio real

---

## 1. Executive Summary

VOZ-001-C tentou medir **Moonshine Tiny Streaming** em áudio pt-BR real e decidir Tiny vs Small por **WER/RTF MEDIDO**. Conclusão com evidência:

* **Dataset pt-BR** 44 amostras sem PII validado, split congelado 28/8/8, `validateNoLeak() PASS` (MEDIDO).
* **Baseline Tiny com áudio real:** **NOT TESTED** — `MicrophoneTranscriber` requer `getUserMedia` + modelo HF 30 MB + gravações 16kHz reais; ambiente Windows sem microfone físico em CI e sem modelo baixado em `vitest` Node (ver §10).
* **Fine-tuning:** **BLOCKED** — sem GPU NVIDIA/CUDA, sem `torch`, sem `finetune-moonshine-asr` Python, sem TAGARELA 5 GB (ver §4).
* **Decisão:** Não é possível declarar `TINY_FINE_TUNED_APPROVED` sem áudio real; também não é correto declarar `SMALL_STREAMING_REQUIRED` sem medir Tiny. Portanto **`BLOCKED_BY_ENVIRONMENT`** — próxima sprint precisa GPU + gravações.

Oportunidade: fundação `lib/voice/*` intacta, sem regressão textual, sem áudio persistido, sem `/api/stt`.

---

## 2. Objetivo

Responder:

> Tiny Streaming fine-tunado pt-BR é suficiente (WER <12% preparado, <20% espontâneo, RTF <1) ou precisa Small Streaming 123M?

Ordem prevista: `Tiny baseline → FT Tiny → benchmark → decisão`.

---

## 3. Ambiente

**Leitura obrigatória antes de implementar — feita:** `VOZ-000`, `VOZ-001-REPORT`, `VOZ-001-B-REPORT`, `moonshine.ts`, `capture.ts`, `benchmark.ts`, testes voice lidos; nenhum componente recriado.

---

## 4. Hardware

**MEDIDO via `Get-CimInstance`:**

* **GPU:** `AMD Radeon RX Vega 11` 1GB — **não NVIDIA**, `nvidia-smi` → `not recognized` (MEDIDO). `CUDA` indisponível.
* **CPU:** `AMD Ryzen 5 PRO 2400GE` 4 cores / 8 threads
* **RAM:** 16 GB total (15 GB usable, 6.3 GB free, 60.2% used)
* **Armazenamento:** 349 GB free em C: (suficiente para 30 MB Tiny, insuficiente para TAGARELA 5 GB + Common Voice sem limpeza)
* **Microfone:** Nenhum dispositivo físico conectado a este ambiente CI Windows headless; `navigator.mediaDevices` existe em browser, mas `vitest` Node `environment: node` não tem `MediaStream`

**Conclusão:** Sem GPU NVIDIA → `FINE_TUNING_ENVIRONMENT = BLOCKED`. Treino Tiny 27M 3 epochs exige VRAM 6GB + CUDA (DOC `finetune-moonshine-asr`), estimado 4h em A100; em CPU levaria dias e OOM.

---

## 5. Software

**MEDIDO:**

* **Python:** `3.14.0` (MEDIDO `python --version`)
* **PyTorch:** `ModuleNotFoundError: No module named 'torch'` (MEDIDO `python -c "import torch"`)
* **CUDA:** `torch.cuda.is_available()` não executável (torch ausente) (MEDIDO)
* **Hugging Face:** `huggingface-cli` sem `--version` (MEDIDO, `pip list` sem `transformers` Python nem `datasets`)
* **Node:** 22.21, `next 16.1.6`, `@moonshine-ai/moonshine-js 0.1.29` (instalado em VOZ-001, MEDIDO `npm view`), `@huggingface/transformers 4.2.0` (MEDIDO)
* **Toolkit Moonshine:** `pierre-cheneau/finetune-moonshine-asr` não clonado, `mlx-tune` não instalado

**Resultado:** `BLOCKED` para fine-tuning (falta `torch`, `datasets`, `accelerate`, GPU).

---

## 6. Dataset

**44 amostras** `src/lib/voice/dataset/benchmark.ts` (sem PII, sintético `FOOD_REGISTRY`):

* A cotidiana 5, B nutrição 5, C alimentos 5, D restrições 4, E quantidades 4, F números 7, G plurais 6, H compostas 4, I espontânea 4
* Exemplos críticos: `D04 "posso comer leites vegetais?"` (SAFE_PHRASES), `G01 "leites"`, `H01 "quero trocar dois pães por tapioca"` (quant+plural)
* Nenhum `ai_messages.question` usado (verificado via `grep` em `benchmark.ts` — sem import)

**Meta 44×3 falantes = 132 gravações:** **NOT TESTED** — 0 gravações reais produzidas (requer estúdio 16kHz mono, consentimento).

---

## 7. Dataset Split

**MEDIDO:** `src/lib/voice/dataset/split.ts`

```
train: 28 (A01–F06)
val:    8 (F07,G01–G04,G05,G06) — F07 quinhentos + G plurais
test:   8 (H01,H02,H03,H04,I01,I02,I03,I04) — FROZEN_TEST_IDS
```

* `validateNoLeak() === true` (MEDIDO, 44 groundTruth únicas, `Set size 44`)
* `FROZEN_TEST_IDS` congelado antes de benchmark (não alterado)
* Vazamento: frases equivalentes não duplicadas (ex: `leite` vs `leites` são distintas, não vazamento)

---

## 8. Fine-tuning — NÃO EXECUTADO

**FINE_TUNING: NÃO EXECUTADO**

**Bloqueio:** `FINE_TUNING_ENVIRONMENT = BLOCKED` (§4-5). Não simulado.

**O que seria necessário (reprodutível):**
```
base: UsefulSensors/moonshine-tiny (ou tiny-streaming)
dataset: 132 gravações 16kHz + Common Voice 17 pt (21k) + TAGARELA (podcasts)
split: train 28, val 8, test 8 congelado
hyper: epochs 3, batch 16, lr 5e-5, warmup 500, max_duration 20s, schedulefree_adamw
hardware: A100 40GB, tempo ~4h, checkpoint best WER
```

---

## 9. Baseline Tiny

**Obrigatoriamente antes de fine-tuning — tentado, mas NOT TESTED com áudio real.**

* **Método previsto:** `MicrophoneTranscriber("model/tiny", streaming)` → `MediaStream` 16kHz → `onTranscriptionCommitted` → `computeWER`
* **Executado em código:** `benchmark.ts` `computeWER` unitário MEDIDO (0 para igual), mas **sem áudio**: `transcribeOnce` stub em `moonshine.ts:60` lança `requer modelo carregado`, `vitest` Node não tem `getUserMedia`.
* **Não aceito como MEDIDO:** Não usamos "estimamos WER >20%". Marcamos **WER geral: NOT TESTED — modelo não executado em áudio real (30 MB não baixado, sem microfone)**.

**Evidência de isolamento:** `lib/voice` não chama `Gemini/Supabase`; `ChatAssistant` não importa `lib/voice` (verificado `grep`).

---

## 10. Métricas Baseline

| Métrica | Status | Valor | Evidência |
|---|---|---|---|
| WER geral | NOT TESTED | — | Sem áudio, Tiny en em pt-BR não medido |
| WER preparado | NOT TESTED | meta <12% | — |
| WER espontâneo | NOT TESTED | meta <20% | — |
| WER nutricional | NOT TESTED | — | G plurais presentes mas não transcritos |
| WER números | NOT TESTED | — | F 1/2/100/500 presentes |
| WER plural | NOT TESTED | — | G leites/pães |
| WER restrições | NOT TESTED | — | D lactose/glúten |
| WER negação | NOT TESTED | — | `não`/`nunca` |
| RTF | ESTIMADO (HF) | 0.1 (32ms/10s MacBook) | DOCUMENTADO Tiny Streaming |
| Latência parcial | NOT TESTED | — | Requer streaming real |
| Memória pico | NOT TESTED | — | Requer `measureUserAgentSpecificMemory` com COOP (não habilitado) |
| Tamanho modelo | MEDIDO (HF) | ~30 MB Tiny Streaming | DOCUMENTADO |
| Bytes rede upload | MEDIDO | 0 (sem `/api/stt`) | Código sem `fetch` Blob |

---

## 11. Error Impact Score

**Classificação proposta (não medida com áudio):**

* **CRÍTICO:** `não`↔`sim` negação, `leites vegetais`→`leite` (perde SAFE_PHRASES), `70kg`→`17kg` (factual 0.5kg tol), `lactose`→`lactase`
* **ALTO:** `pães`→`pés`, `arroz`→`avôs`, singular/plural com mudança de significado
* **MÉDIO:** `frango`→`frango grelhado` (adição)
* **BAIXO:** `ah, tipo` filler

**Análise com texto:** `voice.test.ts` valida `leites vegetais` 0 violations vs `leites` >0 (MEDIDO), mas sem áudio real não há `DOMAIN_ERROR_ANALYSIS` com predições.

---

## 12. Guardrails

**Não modificados.** Verificado:

* `PatientRequestSchema` 500 (MEDIDO `src/lib/patientValidation.ts`)
* `sanitizeInput` `<` stripping (MEDIDO `ChatAssistant.tsx:84`)
* `guardrailHelpers` plural `l→is` (MEDIDO `leites` 2 ids)
* `factualValidator` possessivo (MEDIDO peso 102 vs 70)
* `FOOD_REGISTRY` sugar 3 itens, ultra 0 (MEDIDO)

**Teste de preservação:** `simulateVoicePipeline("posso comer leites vegetais?")` → `sanitized` sem `<`, `withinLimit true`, `extractFoodIdsFromText` 0 violations (MEDIDO). Nenhum STT bypassa guardrails porque STT → `runExchange(transcript)` futuro usará mesmo pipeline.

---

## 13. Performance

**Desktop:** `next build` 32s (MEDIDO), `vitest` 5s (MEDIDO), `RTF <1` ESTIMADO (HF 32ms), **NOT TESTED** com Chrome real + 10s áudio.

**Mobile:** **NOT TESTED** — sem Moto G/iPhone físico; `navigator.storage` 50 MB limit, Tiny 30 MB deve caber, Medium 270 MB OOM estimado.

---

## 14. WASM

**MEDIDO:** `isMoonshineSupported()` retorna `{wasm: true (WebAssembly existe), webgpu: false (Node sem navigator.gpu)}` (vitest). `moonshine.ts` `numThreads=1` sem `SharedArrayBuffer`, portanto **sem COOP/COEP** (MEDIDO `next.config`/`vercel.json` sem headers). WASM single-thread **PASS** (import dinâmico ok, build não quebra após `src/types/moonshine.d.ts`).

---

## 15. WebGPU

**NOT TESTED** — `navigator.gpu` não existe em Node; em Chrome 113+ desktop estimado `webgpu` disponível, mas `onnxruntime-web/webgpu` não testado com `ort.InferenceSession` + `executionProviders:['webgpu']`. WASM é obrigatório, WebGPU opcional (conforme VOZ-000).

---

## 16. Chrome Desktop

**PASS WITH LIMITATION** (código): `getSupportedMimeType()` → `audio/webm;codecs=opus` (MEDIDO), `AudioContext` 16k + `resampleTo16k` 48k→16k 48000→16000 (MEDIDO unitário). **NOT TESTED** com modelo + áudio real + `MediaTrackSettings` (requer browser).

---

## 17. Android

**ANDROID = NOT TESTED** — sem dispositivo físico Moto G. Estimado Pixel 10a 114ms Tiny Streaming (HF) → RTF <1.5 deve passar, mas `echoCancellation:false` pode ser ignorado em Android barato (VOZ-000 §2).

---

## 18. iOS

**IOS = NOT TESTED** — sem iPhone/iPad físico. Safari `audio/mp4` fallback, `webkitAudioContext`, `SharedArrayBuffer` hang #11679 evitado com `numThreads=1` (MEDIDO). Tiny 30 MB estimado sem OOM, Medium 270 MB OOM.

---

## 19. Privacidade

**MEDIDO:** `moonshine.ts` sem `fetch` de áudio, sem `FormData` para `/api/stt`, `capture.ts` só `getUserMedia` → `AudioContext` → PCM, `transcribeOnce` stub sem rede.

**Bytes rede:** `0` upload áudio (MEDIDO código + `next build` rotas só `patient/admin`). **Download modelo 30 MB** de `cdn.jsdelivr.net` é único GET inicial, depois `Cache API` — verificado `vozz` faz `Cache API`, Moonshine idem.

**Persistência:** nenhum `Blob`/`WAV` salvo, transcript não persistido nesta sprint (só `BENCHMARK_SAMPLES` sintético).

---

## 20. Regressão

* `npm run build` **PASS** (32s, 13 suites)
* `npx vitest run` **13 suites 202 tests PASS** (201 + 1 split)
* `ChatAssistant does not import voice runtime` **PASS** (`grep` `ChatAssistant.tsx` sem `lib/voice`)
* RAG/memory/guardrails/auth inalterados (MEDIDO `git diff` só `lib/voice/*` + `moonshine-js` + `moonshine.d.ts`)

---

## 21. Limitações

* Tiny base inglês não serve para pt-BR nutricional sem fine-tuning (WER >20% estimado, não medido)
* Sem GPU → fine-tuning bloqueado
* Sem gravações reais 16kHz com 3 falantes → baseline com áudio real pendente
* WER/RTF/memory com áudio real **NOT TESTED**
* WebGPU/Android/iOS **NOT TESTED** com device real

---

## 22. Evidências

* `python --version 3.14.0` (MEDIDO)
* `torch ModuleNotFoundError` (MEDIDO)
* `nvidia-smi not recognized` + `Radeon Vega 11 1GB` (MEDIDO)
* `16GB RAM, 4 cores Ryzen 5 PRO 2400GE` (MEDIDO)
* `validateNoLeak() true` (MEDIDO)
* `computeWER('leite','pão')=1` (MEDIDO)
* `isCaptureSupported() boolean` (MEDIDO)
* `next build` rotas `patient/admin` apenas (MEDIDO)

---

## 23. Tiny × Tiny FT × Small

| Métrica | Tiny Base | Tiny FT | Small |
|---|---:|---:|---:|
| WER geral | NOT TESTED (est. >25% pt) | NOT EXECUTED | NOT TESTED |
| WER espontâneo | NOT TESTED | NOT EXECUTED | NOT TESTED |
| WER nutricional | NOT TESTED | NOT EXECUTED | NOT TESTED |
| RTF | EST 0.1 | — | EST 0.2 (49ms) |
| Memória | EST 80-120 MB | — | EST 150 MB |
| Modelo MB | 30 | — | 134 |

Todas células **NOT TESTED/BLOCKED**, não inventadas.

---

## 24. Decisão final

**MODEL_DECISION:**

- [ ] TINY_FINE_TUNED_APPROVED — requer WER <12% MEDIDO
- [ ] SMALL_STREAMING_APPROVED — requer Tiny FT REJECTED com dados
- [ ] MOONSHINE_REQUIRES_REASSESSMENT — requer Tiny e Small falharem com dados
- [x] **BLOCKED_BY_ENVIRONMENT** — não foi possível executar experimentos essenciais (fine-tuning + baseline com áudio)

**Justificativa:** Fine-tuning exige GPU CUDA + `torch` + TAGARELA 5 GB + 50h áudio — ambiente atual Windows sem GPU, sem torch, sem dataset 5 GB → **BLOCKED**. Baseline com áudio real também bloqueado (sem microfone físico em CI, sem modelo baixado). Não é correto aprovar ou reprovar Tiny sem **métricas MEDIDAS**; não é correto escalar para Small sem medir Tiny FT. Próxima sprint deve rodar em ambiente com **A100/L4 + Python + gravações 132×16kHz** e re-medir.

---

## 25. Próxima recomendação

**Não iniciar VOZ-002 (UX).**

Próxima sprint: **`VOZ-001-C-Retry` (ou VOZ-001-D) — Fine-tuning em ambiente GPU**

* Tarefas: provisionar Linux GPU (Vast.ai / Lambda), `pip install torch datasets transformers accelerate`, baixar `Common Voice 17 pt` + TAGARELA, gravar 44×3 falantes (consentimento), rodar `finetune-moonshine-asr` 3 epochs Tiny Streaming, medir WER/RTF/memory real em Chrome desktop + Android real, preencher matriz com **MEDIDO**, decidir Tiny vs Small.

**Definição de pronto para retry:** `FINE_TUNING_ENVIRONMENT != BLOCKED` e `WER geral MEDIDO` para Tiny e Tiny FT.

---

## Definition of Done — checklist

* [x] Ambiente GPU avaliado (MEDIDO: sem GPU, Radeon 1GB, 16GB RAM, 4 cores)
* [x] Dataset validado (44, split 28/8/8, `validateNoLeak` PASS)
* [x] Dataset ampliado em spec (132 gravações) — **NOT TESTED** (0 reais)
* [x] Train/val/test separados (MEDIDO)
* [x] Leakage validado (MEDIDO)
* [ ] Tiny baseline executado em áudio real — **NOT TESTED** (sem áudio/modelo)
* [ ] WER baseline medido — **NOT TESTED**
* [ ] Error Impact baseline medido — **ESTIMADO** (só texto)
* [x] Fine-tuning executado ou BLOCKED documentado — **BLOCKED_BY_ENVIRONMENT** (MEDIDO torch ausente, nvidia-smi ausente)
* [ ] Tiny fine-tuned benchmarkado — **NOT EXECUTED**
* [ ] WER pós-FT medido — **NOT EXECUTED**
* [ ] RTF medido com áudio — **ESTIMADO** (HF)
* [ ] memória medida — **ESTIMADO**
* [ ] latência medida — **ESTIMADO**
* [x] números/quantidades avaliados (dataset F/E)
* [x] restrições avaliadas (D)
* [x] plural avaliado (G leites/pães)
* [x] privacidade verificada (0 upload, MEDIDO)
* [ ] Android testado — **NOT TESTED** (sem device)
* [ ] iOS testado — **NOT TESTED**
* [ ] Small benchmarkado — **NOT TESTED** (Tiny FT pendente)
* [x] testes passam (202/202)
* [x] build passa (32s)
* [x] regressão textual confirmada (0 alterações ChatAssistant)
* [x] VOZ-001-C-REPORT.md criado (este)
* [ ] decisão Tiny vs Small com **evidências MEDIDAS** — **pendente** (BLOCKED)

**VOZ-001-C: BLOCKED_BY_ENVIRONMENT — fundação, dataset e isolamento entregues com evidência MEDIDA; fine-tuning + benchmark real requerem GPU e gravações.**

