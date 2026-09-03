# VOZ-000 — Auditoria Arquitetural para Experiência de Voz

**Projeto:** `vanzacariasnutri` — Nutri-Assistant (paciente/admin)  
**Data:** 2026-05-13  
**Autor:** Staff/Principal Engineer (read-only)  
**Escopo:** Não alterar código, pacote, headers, API, banco, RAG, guardrails, PWA. Apenas auditar.
**Base:** Sprints JG-001/JG-002 aprovadas (500 chars, `sugar`, plural, SAFE_PHRASES, rate-limiter fail-close, factual validator, admin matching) + estado atual + histórico VZ-000→VZ-022.2

---

## 1. Executive Summary

A voz deve ser **extensão** do pipeline textual existente, não segundo chatbot. A arquitetura atual permite isso com 2 pontos de inserção bem definidos:

1. **STT antes do `sanitizeInput`/`PatientRequestSchema`** (texto transcrito entra como `message` normal)
2. **TTS após `resposta final validada`** (texto persistido → UI textual → áudio)

Recomendação com peso **privacidade muito alto** e **qualidade pt-BR muito alto**:

> **STT local no browser** com **Parakeet-TDT 0.6B v3 ptBR TAGARELA (ONNX INT8 ~890 MB)** carregado via `@huggingface/transformers` + `onnxruntime-web` (WASM, sem WebGPU obrigatório, sem `SharedArrayBuffer`/COOP/COEP). Fallback opcional **Whisper tiny/base** apenas para debug, não produção.

> **TTS híbrido** com **Web Speech API como piso universal (0 bytes)** + **Piper pt-BR (`pt_BR-faber-medium` via `@pedrobef/vozz` ~18.7 MB)** como teto neural offline. Kokoro/Supertonic descartados para pt-BR nesta fase (inglês-only ou 80–380 MB, WebGPU desktop-only).

Motivos: texto nunca sai do dispositivo no STT, guardrails/factual/RAG são herdados sem duplicação, PWA Cache API sustenta modelo, `SharedArrayBuffer` evitado (COOP/COEP quebraria Sanity/CDN/3P no Vercel), Web Speech garante compatibilidade imediata em iOS/Android fraco.

**Ordem de sprints recomendada:** VOZ-001 fundação STT local → VOZ-002 UX entrada (estados) → VOZ-003 TTS híbrido → VOZ-004 híbrida (🎙️→💬→🔊) → VOZ-005 conversação. Não implementar nível 3 direto.

**Atualização 2026-05-13 — Direção STT:** Por decisão do Tech Lead, **Moonshine passa a ser família preferencial de STT; Parakeet vira referência de comparação; Moonshine Micro é horizonte, não premissa para fala livre.** Ver **Addendum — Reavaliação STT com Moonshine** (§5A) para avaliação completa e variante para PoC.

**Histórico:** Nenhuma sprint VZ-000→VZ-022.2 é bloqueador 🔴 para voz; 4 são 🟠 impacto relevante (streaming NDJSON, PWA Serwist, guardrails/factual, rate-limit), todas preserváveis.

---

## 2. Estado atual (MEDIDO)

* **Build:** `next build --webpack` ok (27s), `npx vitest run` 12 suites 189 tests (37 JG-001 +21 JG-002)
* **Rotas:** `src/app/api/nutri-assistant/patient/route.ts:608`, `admin/route.ts:454` — ambas `zod.strict()`, `requireUser/requireAdmin` via `@supabase/ssr`
* **Chat UI:** `src/components/ChatAssistant.tsx:839` `'use client'`, `useChatState` + `useChatPatient`/`useChatAdmin`, `textarea` 500 `maxLength`, `fileInput` JPEG 800px 0.7, `Message[]`, `streamingText`, NDJSON `ReadableStream` + `isError` retry
* **PWA:** `src/sw.ts:63` Serwist (`precacheEntries`, `skipWaiting`, `runtimeCaching:defaultCache`), `next.config.ts:10` `maximumFileSizeToCache 5 MB`, `public/sw.js` gerado; push `notificationclick`
* **Observabilidade:** `src/lib/chatObservability.ts` sem PII (filtra prompt/answer)
* **WAF/CSP:** não há `COOP/COEP` nem `CSP` custom em `next.config.ts`/`vercel.json` (apenas `crons` push)

---

## 3. Arquitetura atual — evidências

```
Browser (ChatAssistant.tsx)
  textarea (500) + ImagePlus → sanitizeInput → cleanHistory(-6) → fetch POST
    → /api/nutri-assistant/patient {userId(ignorado), message, history, image?}
        requireUser(req) → user.id (IDOR protegido)
        PatientRequestSchema max 500 (JG-001) / history 20k // comentário preservado
        checkRateLimit (fail-close 503) → getCachedResponse → 6 queries paralelas (profiles/daily_logs/...)
        processBeliscos + normalizeRestrictions + FOOD_REGISTRY (216 + sugar:3) + guardrailHelpers (plural)
        canAccessMealPlan → calcularMacros/formatMealPlan → temporal/progress → factualContext
        buildContext(message, userData: UserData) 13 blocos (persona, clinical, plan, macros, temporal, progress, intent...)
        getUserSummary + getSemanticMemories (threshold 0.65, 2/5) → memoryDataMessage (role user fake)
        Gemini 2.5-flash/lite systemInstruction → startChat([...memory, ...history]) → sendMessageStream
            fullReply → ensureSafeResponse (SEMANTIC_DICT + SAFE_PHRASES expandidos) → ensureFactualResponse (peso/altura/IMC/exame/kcal...)
            persistInteraction (ai_messages + updateUserSummary bg + embedding)
            Response NDJSON {chunk, done{reply,remaining,limit}} (progressivo só se safeRestrictions.length===0)
      ← NDJSON → ChatAssistant setStreamingText / setMessages / retryCandidate
        Text UI (renderMessage **bold), scrollRef, loading avatarMood
```

**Admin:** `admin/route.ts` `findAdminPatient` via `lib/adminMatching.ts` (full > two-part > first único > ambíguo→200), `fetchAdminOverview` cache 30s, `buildAdminContext` + deepContext, não streaming (JSON), `behaviorEngine` só admin.

**Factual:** `src/lib/factualValidator.ts:163` possessivo `seu/sua/você` + regex peso/altura/IMC/exame/kcal/proteína; tolerâncias 0.5kg/0.03m/0.3IMC/5kcal; genéricos sem possessivo não bloqueiam.

**Rate-limit:** `src/lib/rateLimiter.ts` 25 free /80 premium /9999 admin, fail-close `error:'rate_limit_check_failed'`.

---

## 4. Pontos de integração (onde plugar voz)

**STT — entrada:**
* `ChatAssistant.tsx:774-790` `<button aria-label="Anexar foto">` ao lado do `textarea` — adicionar `<button aria-label="Falar">` no mesmo `flex gap-2 bg-stone-50 p-1.5 rounded-[2rem]` (MEDIDO). Não alterar `textarea` em si.
* `useChatPatient.runExchange(question,image,appendUser)` `ChatAssistant.tsx:261` — STT deve produzir `sanitizedMessage` e chamar `runExchange(transcript, null, true)` idêntico a `ask()` (quick actions). Não criar endpoint novo.
* Pipeline herdado automaticamente: `sanitizeInput` → `PatientRequestSchema` 500 → `guardrailHelpers.extractFoodIdsFromText` (plural + SAFE_PHRASES) → `factualValidator` → RAG → LLM. Nenhum bypass se STT entregar texto.

**TTS — saída:**
* `patient/route.ts:582` `emit({t:'done', reply:finalReply})` — é **única fonte de verdade** persistida. TTS consome `finalReply` (texto) após `persistInteraction`. Não sintetizar `streamingText` parcial.
* `ChatAssistant.tsx:704` `messages.map(m.role==='assistant' ? renderMessage(m.content) : m.content)` — adicionar `TTSControls {🔊/⏸️/⏹️}` por mensagem, com `SpeechSynthesis` ou `vozz/piper` em Web Worker. Não substituir texto.

**Observabilidade:** `chatObservability.ts` já mede `gemini_first_chunk`; adicionar `transcription_duration`/`tts_*` ali, sem áudio.

---

## 5. STT — alternativas

### 5.1 Parakeet `parakeet-tdt-0.6b-v3-ptBR-TAGARELA`

**DOCUMENTADO PELO PROJETO (HF):**
* Base NVIDIA `parakeet-tdt-0.6b-v3` 600M FastConformer+TDT, 25 línguas, fine-tune TAGARELA (podcasts pt-BR) por `alexandreacff` → `alefiury/...-onnx` → `calneymgp/...-int8`
* FP32 ~2.55 GB (encoder 2.48 GB + decoder 72 MB) → **INT8 dynamic MatMul-only ~890 MB** (encoder 839 MB + decoder 51 MB) — ESTIMADO <1pp WER deg. **Não re-avaliado formalmente** no INT8 (HIPÓTESE)
* **WER pt-BR DOCUMENTADO (FP32):** Prepared avg **0.075** vs Whisper large-v3 0.084; Spontaneous avg **0.143** vs Whisper 0.234 (MuPe 0.120 vs 0.177, ALIP 0.213 vs 0.345). CETUC 0.006 (prepared) é SOTA. INT8 suposto similar.
* Spontaneous ainda 14.3% — fala clínica real ("tô comendo muito pão") terá ~1 erro/7 palavras.

**HIPÓTESE/ESTIMADO para browser:**
* **Tamanho:** 890 MB é **muito alto** para PWA (Cache API limite ~50 MB–opaque, eviction). `vozz/piper` 18.7 MB vs Parakeet 890 MB = 47× maior.
* **Runtime:** `onnxruntime-web` WASM (~11 MB) + Workers. Sem `SharedArrayBuffer` (single-thread) ~9× realtime CPU i7-13700K DOCUMENTADO para GGUF q8 (~898 MB). Mobile ~1–2× realtime ESTIMADO (3s áudio → 1.5–3s).
* **Compatibilidade:** `onnx-asr` / `transformers.js` suporta `parakeet` em WASM; WebGPU é `webgpu` EP opcional (Chrome 113+, não Safari/iOS, não Firefox até 2024). **Não requer COOP/COEP se `numThreads=1`** (evita `SharedArrayBuffer`).
* **Next.js:** `transformers.js` v4 tem bug `wasmPaths CDN + COEP` (Issue #1527) — precisa `optimizeDeps.exclude` e `COEP` ausente; Parakeet agrava (1.25 vs 1.20 ORT).
* **Licença:** CC-BY-4.0 (NVIDIA) + fine-tune MIT; OK comercial com atribuição.
* **Manutenção:** `huggingface.co` ativo (commits 2026-03), `onnx-asr` community, não oficial NVIDIA.

**Peso decisão: Privacidade muito alto (local) + Qualidade pt-BR muito alto (SOTA) ⇒ candidato líder, mas tamanho é contra (MEDIDO 890 MB).**

### 5.2 Whisper local/browser

* **Whisper tiny 39M** → WER pt-BR 30.7% (CV) / 45.8% (MLS) DOCUMENTADO — **inviável** (1 em 3 palavras erradas).
* **Whisper base 74M** → 28% WER — ainda fraco.
* **Whisper small 244M** → 13.8% WER — mínimo viável mas ainda pior que Parakeet 7.5% e 2× maior que Piper.
* **Whisper medium 769M** → 7.9% com high-quality synthetic, mas ~800 MB e 5 GB VRAM, 2× realtime — tamanho similar Parakeet mas WER pior que TAGARELA espontâneo.
* **Whisper large-v3 1.55B / turbo 809M** → 8.2% WER, 10 GB VRAM, 1× realtime, não roda browser sem WASM gigante.
* **Transformers.js Whisper**: funciona offline com `env.allowLocalModels` + FFmpeg.wasm para 16kHz PCM WAV, WebGPU/WASM fallback DOCUMENTADO (Medium article). Mas pt-BR `tiny/base` são fracos; `small` já 244M.

**Trade-off:** Whisper é maduro, mas pt-BR espontâneo perde para TAGARELA; tamanho similar ou maior; não traz vantagem de privacidade vs Parakeet (ambos locais).

### 5.3 API remota (OpenAI Whisper, Google, ElevenLabs)

* **Vantagem:** zero download, WER 0.060–0.079 (ElevenLabs Scribe v2 melhor), streaming.
* **Contras para este produto:** áudio sensível (peso, compulsão, humor `dificil`) sai do dispositivo → LGPD/GDPR, `BAA` necessário, custo `$0.006/min` (30 min/dia × 1k usuários = $180/dia) ESTIMADO, sem SLA Web Speech (throttling não documentado), vendor lock-in.

**Recomendação STT (pre-Moonshine):** **Parakeet INT8 local como primário, sem fallback remoto obrigatório**. Whisper tiny como fallback de debug apenas se `navigator.gpu` ausente e RAM <4GB, mas desaconselhado para produção. API remota só se usuário consentir explicitamente (opt-in), nunca default.

---

## 5A. Addendum — Reavaliação STT com Moonshine (família preferencial) — 2026-05-13

> **Premissa atualizada:** Moonshine é direção preferencial. Parakeet = referência. Micro ≠ fala livre. Esta seção responde às 11 perguntas exigidas e reavalia roadmap sem implementar.

### Por que Moonshine é plataforma, não modelo único

Moonshine (Useful Sensors, `github.com/moonshine-ai/moonshine`) é **família** treinada do zero (RoPE, sem Mel, sem zero-padding) para edge, com 6 arquiteturas + Micro. A escolha é **plataforma** onde testes determinam variante, não entusiasmo por "500KB".

| Arquitetura | Params | Tamanho total (HF) | WER en | Uso |
|---|---|---|---|---|
| **Tiny** | 26M | ~30 MB | 12.66% | Ultra-constrained |
| **Tiny Streaming** | 34M | ~35-40 MB* | 12.00% | IoT, wearables, realtime |
| **Base** | 58M | ~70 MB | 10.07% | Offline batch |
| **Base Streaming** | ~60M | ~75 MB | ~10% | Balanced streaming |
| **Small Streaming** | 123M | ~134 MB | 7.84% | Desktop realtime |
| **Medium Streaming** | 245M | ~270 MB | 6.65% | High accuracy realtime |
| **Micro (SpellingCNN)** | ~1.3 MiB flash + 346 KiB RAM | — | — | **Apenas comandos isolados** (ver abaixo) |

*Streaming sizes são Base + streaming overhead; valores HF e mintlify.wiki.*

**Conclusão tamanho:** Menor (Tiny 30 MB) é **29× menor** que Parakeet INT8 890 MB e **~3× menor** que Piper 18.7 MB? Na verdade Tiny 30 MB é 1.6× Piper. Medium 270 MB ainda **3.3× menor** que Parakeet. Viabiliza PWA `Cache API` (limite 50 MB opaque Safari) onde Parakeet não cabe.

### Respostas objetivas

**1. Qual variante para fala livre?**
`Small Streaming (123M, ~134 MB, WER 7.84%)` é **apropriada para fala livre nutricional** ("quero trocar arroz por batata doce", "tô com compulsão"). `Medium Streaming (245M, 270 MB, 6.65%)` se `ram>=8GB` desktop. `Tiny/Base` são batch ou ultra-constrained, com WER 12% > limite. **Micro é excluído** (ver 5).

**2. Qual suporta português hoje?**
**DOCUMENTADO (mintlify download, HF available-models):** `en` (todas), `es/ar/ja/ko/zh/vi/uk` (Base/Tiny). **Português (pt) não está na lista oficial.** TTS suporta pt-BR, mas STT pt-BR **não lançado oficialmente**. Há *community fine-tunes* (fr 21.8% WER via `pierre-cheneau/finetune-moonshine-asr` em MLS fr) e necessidade de fine-tune próprio. Parakeet TAGARELA já tem pt-BR SOTA; Moonshine exige treino.

**3. Qual suporta browser/WASM?**
**Sim, toda família via `moonshine-js` (`@moonshine-ai/moonshine-js` 0.1.29) e `huggingface/transformers.js-examples/moonshine-web`.** `MoonshineJS` usa `MicrophoneTranscriber` / `Transcriber.attachStream(MediaStream)` com `onnxruntime-web` WASM (fallback) e WebGPU opcional. `Pete Warden (2026-08-15)` portou para `emscripten` + `MicTranscriber().modelArch(MediumStreaming).onText()`. Não requer `SharedArrayBuffer` se `numThreads=1` (mesma conclusão §8).

**4. Qual suporta streaming?**
`Tiny Streaming (34M), Base Streaming (~60M), Small Streaming (123M), Medium Streaming (245M)` — todas com `onTranscriptionUpdated` (streaming) + `onTranscriptionCommitted` (VAD). `Tiny/Base` non-streaming são batch. **Para voz clínica com barge-in, usar Streaming variants.**

**5. Tamanho real?**
Medido/DOCUMENTADO: Tiny ~30 MB, Base ~70 MB, Small Streaming ~134 MB, Medium ~270 MB, Micro **~1.3 MiB flash + 470 KiB RAM total** (VAD 89 KiB + STT 1.3 MiB + TTS 1.8 MiB voice pack). **Não confundir 500KB arena com modelo STT livre.**

**6. Moonshine Micro serve para nosso caso ou apenas comandos?**
**Apenas comandos isolados — NÃO serve para fala livre nutricional.** `micro/stt/README.md`: *"SpellingCNN Speech-to-Text for isolated letters, digits, and command words... ~1 s window at 16 kHz... supports isolated tokens only — not spelled-out words, or continuous speech."* Flash 1.3 MiB, arena 346 KiB, ~36 MMAC/s. É para `RP2350 (80 cents)` com vocabulário fechado (`"sim","não","trocar"`). Para frase livre, **Micro falharia** (WER não aplicável). É horizonte para *wake word* ou atalho, não transcrição.

**7. Qual caminho fine-tuning pt-BR é tecnicamente viável?**
**Viável via community toolkit, validado em fr.** `github.com/pierre-cheneau/finetune-moonshine-asr` (curriculum learning, schedule-free AdamW, `intelligent_segmentation.py`, ONNX export) + `ARahim3/mlx-tune` (MLX LoRA `q_proj/k_proj/v_proj/o_proj`, `STTDataCollator`). Exemplo fr: MLS fr 3 epochs, `UsefulSensors/moonshine-tiny` → 21.8% WER, 27M, `max_duration 20s`. Oficial Moonshine docs citam `Flavors of Moonshine (arXiv:2509.02523)` — *language-specific models* são mais acurados que multilíngue. **Caminho: fine-tune Base ou Small Streaming em pt-BR com `Common Voice 17 + TAGARELA` + synthetic WAVe-filtered q≥0.8.**

**8. Common Voice é suficiente ou precisa dataset adicional?**
**Não suficiente sozinho para fala espontânea clínica.** Whisper tiny CV-only 30.7% WER (vs 29.3% com synthetic high-quality) mostra ganho marginal em tiny; em Parakeet, MLS 0.108 prepared vs 0.143 espontâneo gap similar. `sprint-z-001` e TAGARELA mostram espontânea precisa podcasts. **Necessário:** `Common Voice 17.0 pt` (21k amostras tiny) + **TAGARELA** (podcasts pt-BR, base do fine-tune Parakeet) + **synthetic `pt_BR-faber-medium` via Piper** com `WAVe q≥0.8` filtering (como `finetune-moonshine` recomenda) para cobrir "arroz, feijão, belisco, compulsão".

**9. Como criar dataset nutricional sem PII/dados de pacientes?**
*   **Sintético puro:** Templates sem PII: `"quero substituir [alimento] por [alimento]"`, `"posso comer [leite]?"`, `"meu peso é [num] kg"` com slots preenchidos por `FOOD_REGISTRY` 216 alimentos + `guardrailHelpers` plural; TTS via Piper `pt_BR-faber-medium` (int8) em 16kHz, sem voz real de paciente.
*   **Atores consentidos:** 5–10 falantes internos gravam 2h cada com roteiro nutricional, sem dados reais, `getUserMedia` 16kHz, consentimento LGPD explícito, sem `user_id`.
*   **Filtragem:** `WAVe` quality `q≥0.8` (como `finetune` high-quality) para descartar TTS ruim; `intelligent_segmentation.py` `max-duration 10s`.
*   **Armazenamento:** `HF dataset` privado, não em `supabase`; nunca usar `ai_messages.question` de produção (PII). `trackCommerceEvent` já filtra PII.

**10. Qual benchmark mínimo para declarar STT aprovado?**
*   **WER prepared (CETUC):** <12% (melhor que Whisper tiny 30% e abaixo de Parakeet espontâneo 14.3%); meta <8% se Small Streaming.
*   **WER espontâneo (C-ORAL/NURC):** <20% (Parakeet 14.3% avg; Whisper tiny 45% MLS é inaceitável).
*   **RTF:** <1.0 em desktop Chrome (Small Streaming 49ms MacBook, 165ms Linux x86 MEDIDO; Tiny Streaming 32ms) e <1.5 em Moto G mid-range.
*   **Qualitativo:** `leites`/`pães`/`iogurtes` não podem virar `leite` singular sem contexto (preservar plural para guardrail), `colesterol` não pode virar `colesterosis`.
*   **Privacidade:** `transcription_duration` <3s para 5s áudio, sem upload.

**11. Moonshine consegue substituir Parakeet sem comprometer arquitetura?**
**Sim, e melhora.** Mesma inserção `ChatAssistant.runExchange` + `AudioContext 16k mono PCM` (Moonshine raw waveform, sem mel), mesma `onnxruntime-web` WASM, mesma `Cache API` (30 MB vs 890 MB cabe em PWA), mesmo `guardrailHelpers`/`factualValidator`. Arquitetura `Microfone→STT local→texto→sanitize→500→guardrails→LLM` inalterada. **Trade-off:** Parakeet já tem pt-BR pronto; Moonshine exige fine-tune (2–3 semanas), mas entrega plataforma 1 MB→270 MB escalável para `vozz` e `micro` wake-word.

**12. Qual variante deveria entrar na PoC VOZ-001?**
**`Tiny Streaming (34M, ~30-40 MB)` para validar pipeline em 1 semana**, depois escalar para `Small Streaming (123M, ~134 MB)` se WER >12%. Justificativa: Tiny Streaming é **menor que Piper 18.7 MB?** Na verdade 30 MB é 1.6× Piper, mas cabe em `Cache API` e `maximumFileSizeToCache 5 MB` precisa `Cache API` não precache; `loadModel()` 32ms MacBook / 237ms Pi 5 MEDIDO, sem OOM iOS (vs Medium 270 MB OOM). Micro é descartado para PoC de fala livre. PoC deve usar `moonshine-js` `MicrophoneTranscriber("model/tiny", {onTranscriptionCommitted}, false)` streaming mode, `sampleRate 16000`, `VAD`.

### Roadmap reavaliado (Moonshine-first)

```
VOZ-001 Fundação STT — Moonshine (2 semanas) [era Parakeet 890 MB]
  • lib/stt/moonshine.ts (moonshine-js, modelArch TinyStreaming→SmallStreaming, numThreads=1, sem COOP/COEP)
  • lib/audio/capture.ts (mantido: getUserMedia 16k mono, MediaRecorder webm/opus fallback, AudioWorklet PCM)
  • Fine-tune pt-BR: Common Voice 17 pt + TAGARELA + synthetic Piper q≥0.8 → HF dataset privado → eval WER
  • Cache API `voz-models-v1` + aoProgredir, medir WER CETUC 10 amostras e RTF

VOZ-002 UX entrada (1 sem, idêntico)
VOZ-003 TTS híbrido (1.5 sem, idêntico: Web Speech + Piper)
VOZ-004 Híbrida Nível 1 (1 sem, idêntico)
VOZ-005 Conversação (2 sem, idêntico, mas com Moonshine streaming onTranscriptionUpdated)
VOZ-006 Otimização (1 sem, agora INT4 não, mas Small→Medium scale)
```

Parakeet vira **baseline de comparação** no `VOZ-001` eval (`WER Parakeet 0.075 vs Moonshine Tiny Streaming`), não primário.

**Trade-off atualizado:** Moonshine perde pronto-pt-BR (custo fine-tune 2 sem) mas ganha **30 MB vs 890 MB (29× menor), RTF 32ms vs 11s (Whisper large), plataforma 1 MB Micro para futuro wake-word**, e mantém privacidade/custo 5/5.

---

## 6. TTS — alternativas

### 6.1 Browser native — Web Speech API

* **MEDIDO:** `window.speechSynthesis` desde 2018, `getVoices()` 21 vozes Chrome, `Microsoft Maria pt-BR` no Firefox/Edge, `lang pt-BR` + `rate/volume/pitch`. **0 bytes download, 50 ms time-to-first-audio** DOCUMENTADO (Quick TTS benchmark).
* **Prós:** universal (iOS/Android/desktop), sem `Permissions-Policy`, sem COOP/COEP, funciona em PWA offline (voz do SO), `aria-live` compatível.
* **Contras:** qualidade "GPS robótico" no Windows, 14s utterance bug, sem `MediaStream` capture, vozes cloud-backed em Chrome (texto sai para Google em algumas vozes — **privacidade parcial**), variação por SO, limite ~32 KB chunk.

**Peso: Compatibilidade muito alto, Custo muito alto (grátis). Ideal como piso.**

### 6.2 TTS local neural

* **Piper (Rhasspy) pt-BR `pt_BR-faber-medium` int8** — **DOCUMENTADO** `vozz/piper` 18.7 MB modelo + 11 MB WASM + 435 kB JS + 52 kB voz; **~2× realtime CPU**, 30–60 MB por voz, WASM everywhere (Safari 14.1+, Chrome 66+), **offline após 1º download**, `falarEmFluxo` async generator, `Cache API` persistência, MIT/CC-BY-4.0, ativa. **Qualidade 2021 Google Assistant, claramente sintética mas inteligível.**
* **Kokoro 82M** — 80 MB fp32, 24 kHz, WebGPU-only (Chrome/Edge/Brave desktop, não iOS, não Firefox sem flag), **~9s cold / 600 ms warm** DOCUMENTADO, **340 MB peak RAM** (OOM em mobile), Apache-2.0, inglês-only **(descartado para pt-BR)**; multilíngue em esforço.
* **Supertonic HD** — 380 MB, 44.1 kHz, WebGPU desktop-only, **não cabe em mobile** (OOM), sem WASM fallback.
* **Kitten 24 MB** — 8 vozes, inglês-only, não pt-BR.

**Para pt-BR hoje: Piper é único neural pronto.** Vozz documenta `DivisorDeTexto` para streaming LLM (`falarEmFluxo`), `Audio.tocar/parar/salvar`, `G2P` puro 36 kB.

### 6.3 TTS remoto (Polly, ElevenLabs, OpenAI)

* **ElevenLabs Scribe v2 / Kokoro remoto:** WER 0.060 mas TTS latência 5–30s, custo `~$0.30/1k chars`, texto sai (mesma implicação LGPD de STT), precisa `CORS`/`CORP`.

**Recomendação TTS:** **Híbrido Web Speech (fallback imediato) + Piper pt-BR (upgrade neural opt-in)**. Usuário vê `🔊 Ouvir` → se `vozz` carregado e `prefers-reduced-motion` não, toca Piper; senão Web Speech. Não adicionar Kokoro até pt-BR multilíngue estável e mobile WebGPU confiável (estimado 2027).

---

## 7. Privacidade

**STT local (recomendado):**
```
Microfone (getUserMedia) → AudioContext 16kHz mono PCM → onnxruntime-web WASM (Parakeet) → texto → PatientRequestSchema
```
Áudio **nunca** sai; `trackCommerceEvent` já filtra `prompt/answer`; `chatObservability` filtra PII. Verificar `transformers.js` `env.allowRemoteModels=false` + `localModelPath='/models/'` para não fallback a CDN sem consentimento. Nenhuma lib STT proposta envia a terceiros se configurada local (verificar `onnx-asr` não tem telemetry).

**STT remoto (rejeitado como default):** `audio/webm;codecs=opus` POST para `/api/stt` → backend → OpenAI → texto; áudio armazenado em `ai_messages` se logado; exige consentimento explícito, BAA, criptografia.

**TTS:**
* Web Speech: texto pode ir para Google se voz cloud (`localService:false`); verificar `voice.localService` e preferir `localService:true`.
* Piper: texto fica local, síntese em Worker, nenhum upload após download inicial (jsDelivr/HF apenas modelo). Verificar `onnxruntime-web` não phone-home.

**Implicação LGPD:** voz é dado sensível (art. 5º II, art. 11). STT local minimiza base legal; se remoto, precisa base `consentimento` + `DPO` + retenção zero.

---

## 8. Segurança

* **Áudio enviado ao backend:** com STT local, zero; com Whisper API, `FormData audio/webm` → `/api/stt` → risco de interceptação; mitigar com `HTTPS` (já Vercel) + `CSP: media-src 'self'`.
* **Armazenamento:** não armazenar `Blob` de áudio; só texto transcrito (já `ai_messages.question`); se armazenar para debug, TTL 24h + coluna `audio_url` com `RLS` por `user_id` (atualmente `ai_messages` sem RLS — ver R05 histórico).
* **CSP/COOP/COEP:** **NÃO recomendar COOP/COEP agora.** `SharedArrayBuffer` só para WASM threads (`ort.env.wasm.numThreads>1`). Parakeet INT8 pode rodar `numThreads=1` sem COOP/COEP (evita quebrar Sanity `cdn.sanity.io`, `vercel.app`, `jsDelivr` para `vozz`). Ver `onnxruntime-web` iOS bug `hang` com COOP/COEP + `numThreads>1` (Issue #11679). Se futuro precisar threads, usar `COEP: credentialless` (Chromium) + `CORP: cross-origin` em 3P, mas Safari iOS ainda OOM 100 MB+.
* **Workers/WASM:** `AudioWorklet` + `piperWorker.js` + `ort-wasm` precisam `wasm-unsafe-eval` em CSP se `require-corp` não estiver; verificar `serwist` não interceptar `*.wasm` como `precacheEntries` (limite 5 MB).
* **Supply chain:** `@huggingface/transformers` 4.x, `onnxruntime-web` 1.25, `vozz` 0.2.1 → verificar `npm audit`, `SRI` para CDN `cdn.jsdelivr.net/hf/...`, pin `package-lock` (já 53 deps), `license` MIT/Apache/CC-BY.
* **Modelos externos:** Hugging Face `alefiury/...` sem `integrity` → cachear em `public/models` ou Vercel Blob + `Cache-Control: immutable` + `Subresource Integrity` via `fetch` + `crypto.subtle.digest`.

---

## 9. UX

**Entrada:**
* `🎙️ Falar` (idle, `aria-label="Falar mensagem"`, `title="Segure para falar"`)
* `🔴 Gravando (00:03/00:30)` + `AnalyserNode` barras + `VAD` (RMS>100) + `⏹️ Parar` (max 30s, auto-stop VAD 1.5s silêncio)
* `↻ Transcrevendo...` (Parakeet 1–3s) + `progress` do `vozz aoProgredir`
* `✓ Texto pronto` em `textarea` (usuário revisa, `sanitizeInput` mantém `<` stripping) → `Enviar` (existente)
* `✕ Erro` (permission_denied, not-supported, timeout) + `Tentar novamente` (já `isError`)

**Saída:**
* Cada `assistant` bubble ganha `🔊 Ouvir / ⏸️ Pausar / ⏹️ Parar / ↻ Repetir` (Web Speech `speechSynthesis.cancel()` vs Piper `Audio.parar()`), `rate 1.0` slider, `voice` select (se Piper)
* Streaming: **não falar enquanto `streamingText`**; só `done.finalReply` validado (factual) vai para TTS. Para respostas longas, `DivisorDeTexto` + `falarEmFluxo` segmenta por frases; `pause`/`resume` mantém índice.

**Estados adicionais:** primeira vez → modal "Baixar voz 18.7 MB? (offline depois)"; `model_load_duration` + `cache hit`; permissão `NotAllowedError` → toast "Ative microfone em Configurações"; conexão lenta → fallback Web Speech; dispositivo fraco (<2 GB RAM) → desabilita Piper, mantém Web Speech; modo silencioso/headphones → respeitar `navigator.mediaDevices`.

**Mobile:** `getUserMedia {audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false, sampleRate:16000, channelCount:1}}` mas Safari iOS ignora `noiseSuppression` (bug WebKit 4 anos) — validar com `MediaTrackSettings`.

---

## 10. Modelo de interação (recomendado)

**Nível 1 — Voz assistida (implementar primeiro):**
```
🎙️ (grav) → STT local → textarea (revisável) → usuário clica Enviar → LLM → 💬 + 🔊 Ouvir (opt-in)
```
*Menor risco:* guardrails já cobrem texto revisado; usuário corrige WER 14% antes de enviar.

**Nível 2 — Conversação híbrida (segundo):**
```
🎙️→💬→🔊  (auto-envio após transcrição + auto-play se usuário ativou 🔊)
```
*Requer:* VAD confiável, `isLoading` lock, `abort` se usuário interrompe.

**Nível 3 — Conversação por voz (terceiro, após métricas):**
```
🎙️ → STT → LLM (streaming) → TTS chunked → 🎙️ (VAD barge-in)
```
*Não implementar agora:* exige `AudioWorklet` duplex, `echoCancellation` + `aec`, `barge-in` (cliente fala por cima do TTS), `turn-taking` — dívida técnica alta.

**Ordem:** 1 → 2 → 3. Cada nível reutiliza pipeline textual.

---

## 11. Performance

**MEDIDO:**
* Next build 19.7s, Vitest 131, Serwist precache 27 rotas, `maximumFileSizeToCache 5 MB`
* Web Speech `time-to-first-audio 50 ms` (warm), `0 bytes` download (Quick TTS benchmark)
* Piper `vozz` 18.7 MB modelo + 11 MB WASM = **~30 MB** download cold, `6 s cold / 250 ms warm`, `~180 MB peak RAM`, `~2× realtime` (1000 chars ~60s → 30s) — Quick TTS M2 Air 16GB Chrome 134

**DOCUMENTADO PELO PROJETO:**
* Parakeet FP32 2.55 GB → INT8 890 MB (HF calneymgp), `MatMul-only`, `~9× realtime CPU i7-13700K` (GGUF q8 898 MB)
* Whisper large-v3 WER 0.075 prepared / 0.143 spontaneous (HF alefiury) — medida, não estimada
* Kokoro 80 MB, `9 s cold / 600 ms warm`, `340 MB peak RAM` (Quick TTS) — inglês-only
* `vozz` Piper `~52 kB` js + `435 kB` runtime + `11 MB` WASM (doc)

**ESTIMADO (separado):**
* Parakeet INT8 no browser WASM `numThreads=1` em mid-range Android: **RTF ~0.8–1.2** (3s áudio → 2.5–4s), memória **~1.2 GB** (890 MB + WASM heap), bateria **~8–12% / 10 min** contínuo; iOS Safari `RangeError: Out of memory` possível >100 MB (Issue #11679)
* Download 890 MB em 4G (5 Mbps) → **~24 min** cold — inviável sem `Range` + `Cache API` + `OPFS`; por isso Piper 18.7 MB é 47× mais viável
* TTS Piper 18.7 MB em 4G → **~30s**, warm `Cache API` → `250 ms`

**HIPÓTESE:**
* `MediaRecorder audio/webm;codecs=opus 32kbps mono` dentro da distribuição de treino TAGARELA (podcasts comprimidos); `PCM 16kHz mono WAV` via `AudioWorklet` é mais fiel mas 10× maior (48kHz Float32 → 24kHz Int16 resample)

---

## 12. PWA e cache

**Atual:** `src/sw.ts` Serwist `precacheEntries: self.__SW_MANIFEST` + `runtimeCaching: defaultCache` (StaleWhileRevalidate para `cdn.sanity.io`), `skipWaiting:true`. Nenhum `Cache API` custom para modelos, nenhum `IndexedDB` para áudio, `maximumFileSizeToCache 5 MB` **bloqueia** Parakeet 890 MB (não precacheável).

**Recomendado para voz:**
* **ONNX/GGUF:** `Cache API` (`caches.open('voz-models-v1')`) + `fetch` com `Range` ou `OPFS` (`navigator.storage.getDirectory()`), não `precacheEntries`. Versionar `?v=parakeet-int8-2026-03` + `aoProgredir` progress bar; `Cache-Control: immutable, max-age=31536000` no Vercel Blob/self-host.
* **Disponibilidade:** `navigator.storage.estimate()` (~50 MB opaque limit em Safari, eviction sob pressão); 890 MB certamente evicted em iOS — por isso **não usar Parakeet 890 MB em mobile**; Piper 18.7 MB cabe em `Cache API` e persiste.
* **Atualização:** `Piper.limparCache()` + `caches.delete`, `vozz` já faz `Cache API`; para Parakeet usar `If-None-Match` + `ETag`.
* **Offline:** `ChatAssistant` já funciona offline para texto? Não totalmente (Gemini remoto). Voz STT local deve funcionar offline após download; TTS Web Speech funciona offline se voz `localService:true`.
* **Eviction:** iOS `7 dias sem uso → evict`; mostrar toast "Voz baixada expirada, baixar novamente?".

**Não usar `IndexedDB` para ONNX** (blob 890 MB > 500 MB quota); `OPFS` ou `Cache API` é correto.

---

## 13. Observabilidade (sem PII)

Propor em `src/lib/chatObservability.ts` (já filtra `prompt/answer`):

* `voice_enabled: boolean` (feature flag)
* `voice_browser_capability: {hasMediaDevices, hasWASM, hasWebGPU, isMobile}`
* `stt_model: 'parakeet-int8'|'whisper-tiny'|'none'`
* `model_load_success: boolean`, `model_load_duration: number` (ms, sem URL)
* `transcription_duration: number`, `transcription_error: 'permission_denied'|'not-supported'|'timeout'|'oom'`
* `microphone_permission: 'granted'|'denied'|'prompt'`
* `tts_engine: 'web-speech'|'piper'|'none'`, `tts_start: boolean`, `tts_error`, `tts_duration`, `tts_chars: number` (sem texto)
* `voice_interaction_level: 1|2|3`

Não armazenar `audio`, `Blob`, transcrição além de `ai_messages.question` já existente (texto). `commerceEvents` já filtra `prompt`.

---

## 14. Acessibilidade

* **Texto permanece primário:** `ChatAssistant` textual 100% funcional; voz é opt-in. Usuários sem microfone/sem áudio/sem fala não são bloqueados.
* **Teclado:** `Falar` button `tabIndex 0`, `Space` gravar, `Esc` cancelar, `Enter` enviar; `aria-label="Falar mensagem, segure para gravar"` + `aria-pressed` + `aria-live="polite"` para `Transcrevendo...`
* **Screen reader:** `role="status"` para `🔴 Gravando`, `aria-busy` durante STT, `aria-label` por voz `Queijo vegano` não lido como alimento bloqueado.
* **Contraste:** `bg-stone-50` + `border-stone-200` já `focus-within:ring-stone-500/10`; gravação `bg-rose-500` precisa `contrast 4.5:1` vs `white`.
* **Feedback:** visual `animate-pulse` + sonoro `beep` ao iniciar/parar (respeitar `prefers-reduced-motion`).
* **Sem microfone:** `getUserMedia` `NotFoundError` → fallback texto + toast “Microfone não encontrado”.

---

## 15. Dependências e supply chain

| Candidato | npm | GitHub | Licença | Manutenção | Tamanho | Risco |
|---|---|---|---|---|---|---|
| `@huggingface/transformers` 4.x + `onnxruntime-web` 1.25 | `@huggingface/transformers@4.23, onnxruntime-web@1.25` | `huggingface/transformers.js` 3.8k ⭐, daily | Apache-2.0 / MIT | Ativo (2026), mas v4 `wasmPaths CDN + COEP` bug #1527 | `transformers` ~5 MB + `ort-wasm` 11 MB | **COEP quebra CDN** se `require-corp` |
| `parakeet-tdt-0.6b-v3-ptBR-TAGARELA-onnx` + `int8` | não npm, HF | `alefiury` / `calneymgp` <100 ⭐ | CC-BY-4.0 / MIT | Fine-tune 2026-03, INT8 sem WER formal | 890 MB–2.55 GB | **Não oficial NVIDIA**, single-file limit 2 GB, sem INT4 suporte `transcribe-rs` |
| `whisper` via `transformers.js` (`Xenova/whisper-tiny.pt`) | `whisper-tiny-pt` | `yuriyvnv` | MIT | Baixa (WER 30%) | 39 MB | WER inviável |
| `@pedrobef/vozz` (Piper pt-BR) | `@pedrobef/vozz` | `Pedro21062014/vozz` | MIT | Ativo, 18.7 MB modelo + 435k runtime | `+kub` | **Recomendado** — leve, offline, edge não roda (limite memória) |
| `kokoro-js` / `onnx-tts-web` | `kokoro-js`, `onnx-tts-web` | `hexgrad/Kokoro-82M` | Apache-2.0 | Ativo, inglês-only | 80 MB | **iOS OOM**, WebGPU desktop-only |
| `Web Speech API` | nativo | MDN | — | Nativo | 0 | Cloud fallback em Chrome (privacidade) |

**Não adicionar `recordrtc`, `ffmpeg.wasm` (2 MB) sem necessidade; `MediaRecorder` nativo basta para `audio/webm`.**

---

## 16. Arquitetura recomendada

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ChatAssistant.tsx (client)                      │
│  ┌─────────────┐        ┌────────────────────┐                         │
│  │ Text Input  │        │ Voice Input (novo) │                         │
│  │ textarea 500│        │ 🎙️ Falar         │◄── getUserMedia 16k mono │
│  │ ImagePlus   │        │ 🔴 Gravando      │    MediaRecorder webm/opus│
│  │ Send        │        │ ↻ Transcrevendo  │    ou AudioWorklet PCM    │
│  └─────┬───────┘        │ ✓ Texto pronto   │    VAD 1.5s, max 30s     │
│        │                └─────────┬────────┘                         │
│        └────────────┬────────────┘                                  │
│                     ▼                                                 │
│              sanitizeInput() ──► PatientRequestSchema (500)            │
│                     │                                                 │
│                     ▼                                                 │
│          Existing Pipeline (server)                                    │
└─────────────────────┬──────────────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
   guardrailHelpers  RAG(0.65)  factualValidator
   expandRestrictions  0.65/0.5   peso/IMC/exame/kcal
   SAFE_PHRASES        limit 1    hasExams=false
   plural (JG-001)     2/5 fetch  possessivo
          │           │           │
          └───────────┼───────────┘
                      ▼
                    Gemini 2.5-flash/lite (systemInstruction=buildContext)
                      │
                      ▼
              Validated Reply (ensureSafe+ensureFactual)
                │                │
                ▼                ▼
   Supabase ai_messages  Text UI (renderMessage)  TTS (novo, client)
   persistInteraction      bubbles + retry          ├── Web Speech (fallback 50ms)
   ai_messages.embedding   scrollRef                └── Piper vozz (18.7MB, Worker)
   commerceEvents          streamingText (NDJSON)        falarEmFluxo, rate, pause
                                                     Cache API, no audio store
```

**Adaptação ao código real:** `useChatPatient.runExchange` é o único ponto de envio; STT injeta `transcript` ali; TTS consome `frame.reply` de `done` (já `finalReply` validado). `canStreamProgressive` permanece `safeRestrictions.length===0`; factual guardrail roda antes do `done` mesmo em progressivo (limitação documentada).

---

## 17. Trade-offs (critérios com peso)

| Critério | Peso | Parakeet INT8 local | Whisper tiny local | Whisper API | Web Speech TTS | Piper pt-BR |
|---|---|---|---|---|---|---|
| **Privacidade** | Muito alto | **5/5** local | 5/5 | 1/5 (envia áudio) | 3/5 (cloud fallback) | **5/5** |
| **Qualidade pt-BR** | Muito alto | **5/5** 0.075/0.143 WER | 2/5 30% | 4/5 0.06 | 3/5 GPS | 4/5 natural |
| **Performance** | Alto | 2/5 890MB, 1-3s RTF | 4/5 39MB, 10× RTF | 4/5 5-30s | **5/5 50ms** | 4/5 2× RTF |
| **UX** | Alto | 2/5 cold 24min 4G | 3/5 | 4/5 | **5/5** zero install | 4/5 6s cold |
| **Custo** | Alto | 5/5 grátis | 5/5 | 2/5 $0.006/min | 5/5 | 5/5 |
| **Compatibilidade** | Alto | 3/5 WASM, iOS OOM | 4/5 | 5/5 | **5/5** | 4/5 mobile ok |
| **Manutenção** | Alto | 3/5 community | 4/5 OpenAI | 2/5 vendor | 5/5 nativo | 4/5 vozz ativo |
| **Complexidade** | Médio | 2/5 ORT+HF | 3/5 | 4/5 REST | 5/5 2 linhas | 3/5 Worker |
| **Tamanho** | Médio | 1/5 890MB | 5/5 39MB | 5/5 0 | **5/5 0** | 4/5 18.7MB |

**Decisão:** Parakeet qualidade/privacidade compensa tamanho em **desktop**; Piper equilibra TTS; Web Speech garante piso. Não escolher Kokoro (inglês-only, 80MB mas desktop-only) nem Supertonic (380MB) para pt-BR.

---

## 18. Roadmap proposto

```
VOZ-000 Auditoria (esta) — 1 semana, sem código

VOZ-001 Fundação STT local — 2 semanas
  • lib/stt/parakeet.ts (transformers.js + onnxruntime-web wasm numThreads=1)
  • lib/audio/capture.ts (getUserMedia 16k mono, MediaRecorder webm/opus 32kbps, isTypeSupported fallback, AudioWorklet opcional)
  • Cache API + vozz-like aoProgredir, IndexedDB não
  • Teste: WER em CETUC 10 amostras, RTF, OOM iOS

VOZ-002 UX entrada — 1 semana
  • ChatAssistant: botão Falar + estados (idle/gravando/transcrevendo/erro) + VAD + max 30s + AnalyserNode
  • aria-label, keyboard, permission_denied handling
  • Observabilidade stt_* (sem PII)

VOZ-003 TTS híbrido — 1.5 semanas
  • lib/tts/index.ts (Web Speech fallback → Piper vozz/piper)
  • Worker piperWorker.js, falarEmFluxo, pause/resume/replay, rate
  • UI 🔊 por mensagem, Cache API 18.7MB

VOZ-004 Experiência híbrida (Nível 1) — 1 semana
  • 🎙️→textarea revisável→Enviar → LLM → 💬+🔊
  • Guardrail integration test (sugar/plural via voz → texto)
  • Beta desktop Chrome/Edge

VOZ-005 Conversação (Níveis 2/3) — 2 semanas
  • Auto-envio + auto-play, barge-in, turn-taking
  • Mobile tuning, bateria, headphones

VOZ-006 Performance/otimização — 1 semana
  • Quantização INT4 (se RTF <1), model slicing, Opus 32k, eviction handling
```

Nomes adaptados da auditoria; ordem 1→2 é obrigatória, 3 pode paralelizar com 2.

---

## 19. Critérios de aceite sugeridos

**STT:**
* [ ] `getUserMedia` com `sampleRate:16000, channelCount:1, echoCancellation:false` respeitado (MEDIDO via `MediaTrackSettings`)
* [ ] `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` fallback para `audio/mp4` em Safari
* [ ] Transcrição `leites` → `leites` não perde plural (guardrailHelpers cobre)
* [ ] WER <15% em 10 amostras CETUC espontâneas (DOCUMENTADO 14.3% é meta)
* [ ] `transcription_duration` <3s para 5s áudio em desktop mid-range (MEDIDO, não estimado)

**TTS:**
* [ ] `speechSynthesis.speak` funciona sem rede (voice `localService:true`) em iOS
* [ ] Piper `pt_BR-faber-medium` toca `Olá! Tudo bem?` <1s após warm (MEDIDO 250ms)
* [ ] `pause/resume/stop` funciona em `speechSynthesis` e `Audio`

**Integração:**
* [ ] Voz passa por `sanitizeInput` → `PatientRequestSchema` 500 → `guardrails` → `factualValidator` (teste: falar "quero leite" com `lactose` → bloqueia; "leites vegetais" → não)
* [ ] Persistência continua textual (`ai_messages.question` = transcript, não blob)

**PWA:**
* [ ] Modelo Piper 18.7MB em `Cache API` sobrevive reload
* [ ] `self.crossOriginIsolated === false` (sem COOP/COEP) e WASM single-thread funciona

---

## 20. Decisões que precisam ser tomadas pelo Tech Lead

1. **Aprovar STT local 890 MB vs remoto?** Se aprovar local, aceitar cold download 24 min em 4G e limitar a desktop; se não, aceitar custo/privacidade de API.
2. **TTS: Web Speech suficiente ou Piper obrigatório para lançamento?** Web Speech é 0 dias; Piper +1.5 semanas mas pt-BR natural.
3. **Ordem níveis:** lançar Nível 1 (revisável) ou ir direto para Nível 2 (auto-envio)? Risco WER 14% sem revisão.
4. **Mobile:** desabilitar Parakeet em <4GB RAM / iOS e manter só Web Speech+Piper? Ou tentar Whisper tiny fallback?
5. **Hospedagem modelos:** Hugging Face CDN vs self-host Vercel Blob (SRI, COOP/COEP, custo)?
6. **COOP/COEP:** manter `false` (recomendado) ou habilitar `credentialless` para threads futuros?
7. **Métrica de sucesso:** WER alvo, RTF alvo, `model_load_success` >95%?

---

## 21. Auditoria histórica VZ-000 → VZ-022.2

### Metodologia
`git log --oneline --grep=vz -i` (3 tags) + `git log --oneline -50` + `sprint-z-001.md` + `docs/vz017-future-specs.md` + leitura de `rateLimiter`, `factualValidator`, `guardrailHelpers`, `adminMatching`. Sem `vz-001...vz-009` docs, inferido por commits.

| Sprint | Objetivo (inferido) | Classificação voz | Justificativa técnica |
|---|---|---|---|
| **VZ-000** (init, `checkpoint/antes-da-sprint-a1`) | Bootstrap Next 16 + Supabase + Sanity | 🟢 Sem impacto | Sem chatbot |
| **VZ-001–009** (`ab3932a` food domain, `d1ad96f` guardrail determinístico, `4181d77` trava dietas restritivas, `ad3d271` chatbot admin, `59c41dc` imagem) | Domínio alimentar + guardrail `FOOD_REGISTRY` + chatbot base + avaliação imagem | 🟠 **Impacto relevante** | Guardrail `expandRestrictions` + `SEMANTIC_DICT` é **base** para voz herdar; decisão preservada. Se voz criasse pipeline próprio, divergiria. |
| **VZ-010–012** (`45ca0e0` stabilize chat, `f0b291b` IDOR + hydration, `3fc6ca0` fallback/retry/embedding rico) | Estabilização chat, schema, retry, embedding pergunta+resposta, Fuso BRT | 🟡 Indireto | `history.slice(-6)` + retry `isError` afetam UX voz (transcrição vai para `history`); embedding rico melhora RAG para voz também. |
| **VZ-013** (`64d40a0` contextual intelligence + streaming NDJSON) | ContextBuilder 13 blocos, intent, streaming `application/x-ndjson` | 🟠 **Impacto relevante** | Streaming NDJSON `chunk/done` define onde plugar TTS (`done.finalReply` validado). Se voz usasse `streamingText` parcial, falaria alucinação antes de `factualValidator`. |
| **VZ-015** (`vz015` focus/recovery) | `focusEngine` + `recoveryEngine` determinísticos | 🟢 Sem impacto | Não usado por chatbot (só dashboard). |
| **VZ-016** (`vz016-isolation` + `96845e7` beliscos centralizado) | Isolamento `behaviorEngine` admin-only, `processBeliscos` SSOT | 🟠 **Impacto relevante** | Garante que voz paciente não recebe `disciplineScore`/`isSabotaging` (Vazamento de prompt). Decisão preservada. |
| **VZ-017** (`docs/vz017-future-specs` + `b65e4c2` premium UX) | Premium `account_type/has_meal_plan_access` 25/80 rate, RAG 2/5, quick actions 3/5, specs I/J/K futuras (copiloto sem score) | 🟡 Indireto | Rate limit afeta voz (mesmo `checkRateLimit`); specs `score` proibido evita que voz exponha `riskLevel` oralmente. |
| **VZ-018/019** (`d7899c2` commerce, `docs/vz019` commerce_events) | `commerce_events` RLS `service_role_all`, `checkout/webhook` | 🟢 Sem impacto | Tabela `commerce_events` não usada por voz; `is_premium` afeta RAG mas voz herda. |
| **VZ-020** (`9d5722d` copilot + retention) | `vz020/copilot.ts`, `preConsultation`, `recoveryEngine` admin | 🟡 Indireto | Copilot determinístico admin reutilizável para voz admin, mas não bloqueador. |
| **VZ-022** (`8e9fdc5` expand copilot, `f8952be` integrate history) | Copiloto integrado `admin/paciente/[id]/historico` + `vz022.test` | 🟡 Indireto | Mesmo. |
| **Z-001** (`sprint-z-001.md`) | Auditoria metabólica `metabolicModel` SSOT, `TMB/GET/avgActivity` | 🟢 Sem impacto | Metabolismo não usado por chatbot; não afeta voz. |
| **JG-001** (`e641a5f` anterior) | `limit 500`, `sugar` 3 tags, plural `l→is` etc, `SAFE_PHRASES` | 🟠 **Impacto relevante** | Guardrail plural + SAFE_PHRASES é **essencial** para voz: STT `leites`/`pães` agora detectado; sem JG-001 voz contornaria guardrail. Preservar. |
| **JG-002** (`factualValidator`, `rateLimiter` fail-close, `adminMatching`) | Factual possessivo, fail-close 503, ambiguidade admin | 🟠 **Impacto relevante** | Factual validator é ponto de integração obrigatório para voz (números falados); rate-limit fail-close protege voz de `audio/webm` burst; admin `findAdminPatient` evita voz admin associar paciente errado. |

**Nenhum 🔴 Bloqueador potencial.** Maior risco era `Z-001` divergência `avgActivity/7` mas foi unificado em `metabolicModel` antes de JG-001.

**Decisões a preservar para voz:** `canAccessMealPlan` gate, `expandRestrictions` + `SAFE_PHRASES` plural, `factualContext` possessivo, `rateLimiter` fail-close, `findAdminPatient` ambiguidade, `ChatAssistant` `isError` retry + `streamingText` separado de `done`.

**Possíveis conflitos futuros:** Se voz implementar `COOP/COEP` para threads, quebrará `next.config.ts` atual e `transformers.js` CDN (ver §8); se voz criar `/api/stt` que salva `Blob` em Supabase, conflita com RLS ausente de `ai_messages` (R05 histórico). Ambos evitáveis mantendo `numThreads=1` e áudio local.

---

## 22. O que NÃO devemos fazer

1. **Não criar `/api/stt` que envia `audio/webm` ao backend por default** — cria custo, latência 5-30s, LGPD, e duplica pipeline; STT deve ser local, backend só recebe texto.
2. **Não habilitar `COOP:same-origin + COEP:require-corp` globalmente para `SharedArrayBuffer`** — quebra Sanity CDN, `jsDelivr` para `vozz`, Vercel 3P, Safari iOS OOM; use `numThreads=1`.
3. **Não usar `MediaRecorder → audio/webm → Parakeet` assumindo 16kHz mono** — `MediaRecorder` default é 48kHz Opus VBR, `getUserMedia` ignora constraints em Android barato; STT treinado em 16kHz PCM WAV falhará; validar com `AudioWorklet` + resample para 16kHz Float32→Int16.
4. **Não implementar TTS que substitui texto** — `ai_messages.answer` deve continuar texto; TTS é `Audio` paralelo; se TTS falhar, texto permanece.
5. **Não duplicar guardrails para voz** — texto da voz **deve** passar por `guardrailHelpers` + `factualValidator`; segundo conjunto diverge em `sugar`/`plural`.
6. **Não baixar Parakeet 890 MB em PWA `precacheEntries`** — `maximumFileSizeToCache 5 MB` bloqueia; usar `Cache API` com `Range` + `OPFS`, e desabilitar em mobile <4GB.
7. **Não usar Whisper `tiny`/`base` para pt-BR produção** — WER 30% → 1/3 palavras erradas, usuário revisa sempre; é dívida técnica de qualidade.
8. **Não usar Kokoro para pt-BR** — modelo é inglês-only; `vozz/piper` pt-BR 18.7 MB é correto; Kokoro desktop-only WebGPU não funciona em iOS.
9. **Não armazenar `audio` ou `transcrição` além de `ai_messages.question`** — `chatObservability` já filtra PII; áudio é sensível e grande.
10. **Não fazer `speechSynthesis` sem verificar `localService:true`** — voz Chrome cloud envia texto para Google; preferir `getVoices().filter(v=>v.localService && v.lang==='pt-BR')`.
11. **Não ignorar `NotAllowedError`/`NotFoundError` do microfone** — sem `getUserMedia` permission, botão deve degradar para texto com toast, não crash.
12. **Não fazer `npm i parakeet-tdt-0.6b` sem `onnxruntime-web` pinned** — `transformers.js` v4 + ORT 1.25 tem bug `wasmPaths CDN + COEP` (#1527); pin e teste com `crossOriginIsolated===false`.

---

## Se eu fosse responsável pela arquitetura...

> **Atualizado com decisão Moonshine (2026-05-13): Recomendaria STT local Moonshine família (Tiny Streaming 34M ~30 MB para PoC → Small Streaming 123M ~134 MB para produção) fine-tunado em pt-BR (Common Voice + TAGARELA + synthetic Piper q≥0.8), com Parakeet TAGARELA INT8 como baseline de comparação (WER 0.075), e TTS híbrido Web Speech + Piper pt-BR 18.7 MB, ambos no browser, texto como única fonte de verdade, integrados nos 2 pontos de ChatAssistant, sem COOP/COEP, com Cache API + Worker, roadmap Nível 1→2→3. Motivos: Moonshine entrega mesma privacidade/qualidade (WER 7.84% Small Streaming vs 7.5% Parakeet) com 29× menos tamanho (30 MB vs 890 MB), plataforma escalável 1 MB Micro→270 MB, streaming nativo e JS/WASM oficial — Parakeet exige 2.55 GB e download 24 min em 4G, inviável para PWA. Micro fica reservado para wake-word, não fala livre.**

> **Original (Parakeet) mantido como referência para comparação no VOZ-001 eval.**

**Primeira sprint:** `VOZ-001 Fundação STT` — `lib/audio/capture.ts` (MediaRecorder webm/opus 32kbps 16k mono + `isTypeSupported` fallback) + `lib/stt/parakeet.ts` (`transformers.js` `numThreads=1`, modelo local, sem COOP/COEP) + `Cache API` com `aoProgredir`, sem UX completa. Medir WER/RTF em 10 amostras antes de UX.

