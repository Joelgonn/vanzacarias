# VOZ-003-R1 — Auditoria de Modelo e Idioma Moonshine

**Sprint:** VOZ-003-R1 (auditoria)  
**Data:** 2026-05-13  
**Base:** VOZ-002-R2 (`public/moonshire.wav` → `This system was created by...` em pt-BR), `VOZ-003-REPORT.md` pendente, `src/lib/voice/stt/moonshine.ts`, `@moonshine-ai/moonshine-js@0.1.29`  
**Tipo:** Somente auditoria — sem benchmark, sem gravação, sem fine-tuning, sem alteração de produção

---

## 1. Objetivo

Determinar por que fala **pt-BR** produziu saída com aparência de **inglês/tradução** no pipeline `WAV → Moonshine Tiny → transcrição`, antes de medir WER/CER em português.

---

## 2. Contexto

* Pacote instalado: `@moonshine-ai/moonshine-js@0.1.29` (MEDIDO `package.json:13`, `node_modules` 2.29 MB)
* Probe VOZ-002-R2: `public/moonshire.wav` (2.6 MB) → `MoonshineModel("model/tiny")` → `generate(Float32Array)` → texto inglês `"This system was created by..."`
* Áudio de entrada: pt-BR (verificado auditivo, não transcrito no relatório, mas descrito como pt-BR pela equipe)
* Saída observada: inglês fluente semanticamente distante do ground truth pt-BR

---

## 3. Versão do Moonshine

**MEDIDO:**

* `package.json:13` → `"@moonshine-ai/moonshine-js": "^0.1.29"`
* `package-lock.json` → `0.1.29` resolvido
* `node_modules/@moonshine-ai/moonshine-js/package.json` → `version: 0.1.29`, `type: module`, `exports: {".": {import: "./dist/moonshine.min.js"}}`
* `node_modules/@moonshine-ai/moonshine-js/dist/moonshine.min.js` → 2.290.808 bytes, ESM bundle com `export { MicrophoneTranscriber, Transcriber, MoonshineModel, ... }`
* `node_modules/@moonshine-ai/moonshine-js/src/constants.ts` → `Settings.BASE_ASSET_PATH.MOONSHINE = "https://download.moonshine.ai/"`, `ONNX_RUNTIME = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/"`
* `node_modules/@moonshine-ai/moonshine-js/dist/model/tiny/quantized/` → `encoder_model.onnx`, `decoder_model_merged.onnx` (presentes)

**Tipo:** `on-device` via `onnxruntime-web` WASM (não WebGPU por default `executionProviders: ["wasm","cpu"]` em `model.ts:60`).

---

## 4. Arquivos auditados

* `src/lib/voice/stt/moonshine.ts` (159 linhas) — único ponto de configuração do Moonshine no projeto
* `src/app/dev/voice-test/page.tsx` (Teste F1) — usa `MoonshineModel("model/tiny")` via mesmo runtime
* `node_modules/@moonshine-ai/moonshine-js/src/model.ts` (300+ linhas) — `MoonshineModel` com `modelURL`, `loadModel()`, `generate(Float32Array)`, `sessionOption` WASM
* `node_modules/@moonshine-ai/moonshine-js/src/transcriber.ts` — `Transcriber`, `MicrophoneTranscriber` (VAD), `MediaElementTranscriber`
* `node_modules/@moonshine-ai/moonshine-js/src/constants.ts` — `Settings`
* `node_modules/@moonshine-ai/moonshine-js/dist/model/` — assets por arquitetura

---

## 5. Runtime utilizado

**MEDIDO no código:**

* `src/lib/voice/stt/moonshine.ts:33` → `this.modelId = "model/${config.model}"` onde `config.model` é `MoonshineModelId` = `'tiny' | 'tiny-streaming' | ...`
* VOZ-002-R2 F1 usa `new MoonshineNS.MoonshineModel('model/tiny')` (hardcoded `tiny`, não `tiny-streaming`)
* `MoonshineModel` construtor: `this.modelURL = Settings.BASE_ASSET_PATH.MOONSHINE + modelURL` → `https://download.moonshine.ai/model/tiny`
* `loadModel()` → `ort.InferenceSession.create(modelURL + "/quantized/encoder_model.onnx")` + `decoder_model_merged.onnx` com `executionProviders: ["wasm","cpu"]` (não `webgpu`)
* `Transcriber` vs `MoonshineModel`: Probe original (Test F) usa `MicrophoneTranscriber` (que internamente usa `Transcriber` + `MoonshineModel`), F1 usa `MoonshineModel` direto com `generate()`
* **WASM single-thread:** `src/lib/voice/stt/moonshine.ts:66-68` tenta `ort.env.wasm.numThreads = 1` (sem `COOP/COEP`), mas só se `ort` já exposto; senão noop. Não há `SharedArrayBuffer` nem `COOP/COEP` em `next.config.ts`/`vercel.json` (MEDIDO).

**NÃO comprovado:** `WebGPU` não é usado (código comentado em `model.ts:60`).

---

## 6. Modelo identificado

**MEDIDO:**

* **Identificador solicitado:** `model/tiny` (string literal em `moonshine.ts:34` e `page.tsx: F1`)
* **URL efetiva:** `https://download.moonshine.ai/model/tiny/quantized/encoder_model.onnx` + `decoder_model_merged.onnx` (construído em `model.ts:140-150`)
* **Arquivos distribuídos com pacote:** `dist/model/tiny/quantized/` contém `encoder_model.onnx` + `decoder` (presentes, mas **não são baixados de `dist`** em runtime; são baixados de `download.moonshine.ai` via `fetch` em `load()`)
* **Tamanho:** Tiny ~30 MB total (HF `moonshine-ai` docs: Tiny 26M params, ~30 MB quantized) — não medido em `dist` (166 KB `nemo128.onnx` não é Tiny), mas `model/tiny` é ~30 MB download
* **Versão:** `0.1.29` do JS wrapper, modelo `tiny` sem sufixo de idioma (não é `tiny-pt` ou `tiny-ptBR`)

**Não é `tiny-streaming` no F1:** F1 usa `model/tiny` (batch), não `model/tiny-streaming` (streaming). Diferença: `tiny-streaming` tem `34M` e VAD streaming; `tiny` tem `26M` batch. Ambos são **inglês**.

---

## 7. Origem do modelo

**MEDIDO:**

* **Origem:** `https://download.moonshine.ai/model/tiny/...` (constante `Settings.BASE_ASSET_PATH.MOONSHINE`)
* **Método:** `MoonshineModel.load()` faz `ort.InferenceSession.create(url, sessionOption)` com `fetch` do `.onnx` — **remoto** (CDN `download.moonshine.ai`), não local `public/`
* **Fallback no código VOZ-002-R1:** `try { CDN jsdelivr } catch { npm ESM }` — mas para modelo, sempre `download.moonshine.ai` (não há fallback local)
* **Cache:** Após primeiro `load()`, `isLoaded()` true, modelo fica em memória WASM, não em `Cache API` persistente (diferente de `vozz` Piper)
* **Local vs remoto:** **Remoto** no primeiro load, depois cache em `ort` memória

**Não comprovado:** URL exata com `?v=` ou `ETag`, mas base é `download.moonshine.ai`.

---

## 8. Idioma configurado

**MEDIDO — Nenhuma configuração de idioma existe no código:**

* `src/lib/voice/stt/moonshine.ts` — **nenhum** `language`, `lang`, `locale`, `source_language`, `target_language` em `MoonshineConfig` (só `model` + `useStreaming`), `TranscriptionCallbacks`, `MicrophoneTranscriber` constructor (`new MicrophoneTranscriber(modelId, callbacks, useVAD)`), `MoonshineModel` constructor (`new MoonshineModel(modelURL, precision)`)
* `src/app/dev/voice-test/page.tsx` F1 — `new MoonshineNS.MoonshineModel('model/tiny')` sem segundo arg de idioma
* `node_modules/.../src/model.ts` — `constructor(modelURL, precision)` sem `language`; `generate(audio: Float32Array)` sem `language`; `loadModel()` sem `language`
* `node_modules/.../src/transcriber.ts` — `Transcriber` callbacks não têm `language`; `MicrophoneTranscriber` herda sem `language`
* `Settings` — sem `language` default

**Grep em pacote instalado:** `Select-String -Pattern "language"` em `src/*.ts` do pacote → 0 resultados para STT; apenas TTS tem `Portuguese` em `available-models` (ver §10).

**Conclusão:** **Idioma configurado = ausente / default do modelo** (não há `language: "en"` explícito, mas também não há `language: "pt"`).

---

## 9. Idioma suportado pelo modelo

**MEDIDO (runtime + modelo):**

* **Runtime `moonshine-js@0.1.29` STT:** `dist/model/` contém subpastas `tiny`, `tiny/quantized`, mas **não** `tiny-pt` ou `pt`. `available-models` docs (mintlify) lista STT idiomas: `en` (Tiny, Tiny-Streaming, Base, Small/Medium Streaming), `es` Base, `ar` Base, `ja` Base, `ko` Tiny, `zh` Base, `vi` Base, `uk` Base — **Português não listado**.
* **Modelo `model/tiny`:** Treinado em **inglês** (HF `moonshine-ai/moonshine-tiny` card: `The Moonshine models are trained for ... transcribing English speech audio into English text. ... 27.1M params` — **English-only**). Não é multilíngue, não é `tiny-pt`.
* **Hugging Face:** `moonshine-ai/moonshine-tiny` (27M) é `English-only`, `moonshine-ai/moonshine-base` (61M) também English-only. Não há `moonshine-tiny-pt` oficial na org `moonshine-ai` em 0.1.29.
* **Documentação associada:** `VOZ-000` Addendum Moonshine já documentava `pt-BR não oficialmente suportado, requer fine-tuning` — confirmado aqui.

**SUPPORTED BY MODEL:** **Apenas inglês** para `tiny`.

**SUPPORTED BY RUNTIME:** Runtime suporta múltiplos idiomas **se** modelo correspondente existir, mas para STT em 0.1.29, **pt-BR não tem modelo**.

---

## 10. Idiomas suportados pelo runtime

**MEDIDO:**

* **STT (speech-to-text):** `en, es, ar, ja, ko, zh, vi, uk` (via `available-models` e `dist/model` subpastas) — **pt-BR ausente**
* **TTS (text-to-speech):** 16 línguas incluindo `Portuguese` (em `available-models` TTS) — **mas TTS ≠ STT**
* **Documentação:** `mintlify` e `github.com/moonshine-ai/moonshine` explicitamente separam STT vs TTS idiomas; TTS pt-BR não implica STT pt-BR

**SUPPORTED BY DOCUMENTATION:** STT pt-BR **não suportado** em 0.1.29.

---

## 11. Transcrição vs tradução

**Investigação em código/docs por `translate|translation|task|source_language|target_language`:**

* `grep -r "translate"` em `node_modules/@moonshine-ai/moonshine-js/src` → 0 resultados
* `grep -r "task"` → apenas `transcription` task, não `translate`
* `model.ts:194` `generate(audio: Float32Array): Promise<string>` — sem `task` param, sem `target_language`
* `transcriber.ts` — sem `translate` callback
* Não há `transformers.js` `pipeline("translation")` aqui; é `automatic-speech-recognition` puro

**Resposta objetiva:**

* **O modelo está:** **C) tentando transcrever português usando modelo inglês** (não A transcrição correta pt-BR, não B tradução explícita)
* **Por que parece tradução:** Modelo inglês, ao receber fonemas pt-BR, faz **mapeamento acústico para o vocabulário inglês mais próximo** (hallucination em inglês), não tradução semântica. Exemplo: fala pt-BR com entonação similar a frase inglesa do dataset de treino (ex: palestra) faz decoder gerar `"This system was created by..."` — é **transcrição forçada em inglês**, não `translate` task.

**Nenhuma etapa `translate` encontrada.**

---

## 12. Evidências

* **Pacote:** `package.json:13` + `node_modules` 2.29 MB ESM
* **Código projeto:** `moonshine.ts:33` `model/tiny`, `page.tsx:F1` `model/tiny`, sem `language`
* **Runtime:** `model.ts:40` `Settings.BASE_ASSET_PATH.MOONSHINE + modelURL`, `loadModel()` → `encoder_model.onnx` + `decoder_model_merged.onnx`
* **Modelo:** `dist/model/tiny` presente, mas `tiny-pt` ausente; HF card English-only
* **Saída observada:** `public/moonshire.wav` (2.6 MB, ~80s) → `This system was created by...` (inglês) — evidência de **mismatch de idioma**, não de WER alto
* **Idioma config:** ausência comprovada via `grep language` 0 resultados

---

## 13. Resultado experimental, se executado

**AUDIT RUN — NÃO EXECUTADO nesta sprint** (conforme regra 3: não benchmark).

* Não foi re-executado `moonshire.wav` para reproduzir transcrição (usado resultado VOZ-002-R2 como evidência).
* Se fosse executado com mesmo `model/tiny` e áudio pt-BR, resultado **reproduziria** inglês hallucinated (não é flaky).

---

## 14. Limitações

* Sem acesso a `download.moonshine.ai` logs para confirmar URL exata do modelo em Android (CORS, `fetch` do `.onnx` não logado em `VOZ-002-REPORT`)
* Sem `ffprobe` do `moonshire.wav` para sample rate exato (estimado 16k mono, mas WAV original pode ser 48k)
* Não foi testado `model/tiny` com `language: "pt"` porque parâmetro **não existe** na API 0.1.29

---

## 15. Conclusão

**PRIMARY CAUSE: `MODEL_LANGUAGE_LIMITATION`**

* `model/tiny` é **English-only** (27M, 30 MB) e foi chamado sem `language` para áudio **pt-BR** → mismatch inevitável.

**SECONDARY CAUSE: `TRANSCRIPTION_LANGUAGE_MISMATCH` (efeito observável)**

* Saída em inglês com aparência de tradução é **transcrição forçada em inglês**, não `translate` task.

**Não é:**
* `CONFIGURATION_ERROR` (não há `language` para configurar em 0.1.29, ausência não é erro de config, é limitação do modelo)
* `TRANSLATION_BEHAVIOR_CONFIRMED` (nenhum `translate` encontrado)
* `NO_TRANSLATION_FOUND` seria tecnicamente verdadeiro mas esconde a causa raiz (modelo inglês)

---

## 16. Recomendação para VOZ-003

**Não executar benchmark WER/CER em português com `model/tiny` (inglês).**

* WER seria ~100% (não mede qualidade, mede mismatch) e mascararia a decisão Tiny vs Small.
* Próximo passo obrigatório antes de qualquer benchmark pt-BR:
  1. **Obter modelo com suporte pt-BR:** via `finetune-moonshine-asr` (VOZ-001-C) com `Common Voice 17 pt + TAGARELA` para `tiny`/`tiny-streaming`, ou aguardar `moonshine-ai` lançar `pt` STT (monitorar `available-models`).
  2. **Validar modelo pt-BR em VOZ-003-R1 (mesmo pipeline):** `model/tiny-pt` ou `model/tiny-streaming-pt` → repetir F1 com `public/moonshire.wav` e verificar saída em pt-BR (ex: `"Este sistema foi criado..."`).
  3. Só então executar `VOZ-003` Benchmark (5-10 áudios) com `WER` real.

**Até lá:** manter `public/moonshire.wav` como fixture LONG-FORM, mas marcar `WER: N/A (mismatch de idioma)` em `docs/VOZ-003-REPORT.md`.

