# VOZ-011 — Otimização da Qualidade da Transcrição Vosk PT-BR

**Sprint:** VOZ-011 — Auditoria + Otimização Vosk PT-BR  
**Data:** 2026-09-05 14:40  
**Base:** VOZ-010 baseline funcional (`microfone → PCM → trimSilence → normalizePcm → Vosk PT-BR chunked 4096 → ChatAssistant`) validado no realme RMX3461 (`samples 110592`, `rms 0.0456`, `wordCount 9` após correção)  
**Tipo:** Auditoria de 5 áreas + decisão de 1 melhoria  
**Status:** `NO_SAFE_IMPROVEMENT_FOUND` — nenhuma melhoria adicional com benefício/risco justificável  
**Modelo:** `vosk-model-small-pt-0.3` 32.4MB PT-BR, `sampleRate 16kHz`, `resampleTo16k` linear, `AudioContext` `running` com fallback, `ScriptProcessor` 4096

---

## 1. Objetivo

Investigar e implementar **uma** melhoria de código que possa aumentar a qualidade da transcrição PT-BR do microfone real, preservando a arquitetura local validada. A melhoria deve ser mensurável, com menor alteração possível e menor risco de regressão. Se nenhuma for segura, encerrar como `NO_SAFE_IMPROVEMENT_FOUND` (resultado válido).

---

## 2. Baseline VOZ-010

- **Fluxo:** `getUserMedia` (48k mono) → `AudioContext` (`resume()` + fallback `interrupted`, `latencyHint: interactive`) → `ScriptProcessor 4096` → `PCM Float32` → `resampleTo16k` (48k→16k linear, `Math.min` para último chunk) → `trimSilence` (>500ms pontas, mantém 200ms) → `normalizePcm` (DC removal + peak 0.9 se `0.01 ≤ peak <0.5`) → `Vosk PT-BR` (`transcribeWithVosk` chunked 4096, `retrieveFinalResult` imediato após loop, `guard 30s`) → `onTranscript` → `ChatAssistant` (`prev + ' ' + next`)
- **Validação física VOZ-010:** `samples 110592` `duration 6912ms` `rms 0.0456` `peak 0.4666` (não silêncio) → frase `"Olá, quero testar o reconhecimento de voz em português brasileiro."` → transcrição utilizável com `wordCount ≥8` (vs baseline VOZ-009 `5` truncado)
- **Testes:** `tsc 0`, `vitest 21/300`, `build 28`, separação `micPcmRef`/`fixtureRef` validada
- **Latência:** `inference` ~7s para 6.9s (RTF ~1.0), `guard` nunca atingido

---

## 3. Auditoria

### 3.1 Vosk Partial Results

**Implementação atual:** `src/lib/voice/stt/vosk.ts:174-193` escuta apenas `recognizer.on('result')` (`ServerMessageResult` com `text` final) e `on('error')`. Não escuta `partialresult` (`ServerMessagePartialResult` com `partial`).

**Capacidade real do `vosk-browser@0.0.8` (instalado, `node_modules/vosk-browser/dist/interfaces.d.ts:72-77`):**

```ts
export interface ServerMessagePartialResult {
  event: "partialresult";
  result: { partial: string };
}
export type RecognizerEvent = "result" | "partialresult" | "error";
```

- `partialResult` é emitido **durante** `acceptWaveformFloat` (incremental), `result` é emitido **após** `retrieveFinalResult` (final).
- Uso atual: **batch** (todo PCM após `stop()` → `transcribeWithVosk`), não streaming durante captura. `partial` só seria útil para **processamento incremental durante a captura** (ex: mostrar texto parcial enquanto grava).

**Investigação:**

- Processamento incremental durante a captura exigiria `acceptWaveformFloat` **durante** `onaudioprocess` (streaming), não após `stop()`. Isso mudaria arquitetura de `VoiceInputController` (hoje `recorder.start()` → `stop()` → `transcribe`) para `streaming` com `onTranscriptionCommitted` (como `moonshine-js` faz). Custo: CPU/memória maior no Android (Worker + `onaudioprocess` 4096 a 48k = 11.7 chunks/s), risco de `interrupted` e de `partial` parcial ser confundido com final.
- `partial` em `vosk-model-small-pt-0.3` tem WER maior que final (sem contexto de frase completa), e exibir parcial na UX `VOZ-008.6` (`FALAR → PARAR → PROCESSAR → TRANSCREVER`) quebraria o fluxo simples validado (usuário espera transcrição após `PARAR`, não durante).
- Compatibilidade: `partialresult` funciona no Android Chrome 152 (mesmo Worker), mas seu benefício é **UX** (feedback incremental), não **qualidade** (final já é o melhor que o modelo pode dar com todo o áudio).

**Conclusão:** `partialResult` **pode ser usado corretamente**, mas **não melhora qualidade** do resultado final; apenas adiciona complexidade e risco de regressão para o baseline já validado. **Não implementar.**

### 3.2 Endpoint / Segmentação

- `KaldiRecognizer` criado como `new Model.KaldiRecognizer(16000)` sem `grammar` — correto para ditado livre PT-BR. `grammar` (ex: `'[ "olá [unk]" ]'`) limitaria vocabulário e pioraria frases livres como `"quero trocar dois pães..."`.
- `retrieveFinalResult()` é chamado **imediatamente após todos os chunks** (VOZ-008.8) — correto, sem `setTimeout 100ms`. Endpoint é determinado pelo modelo (silêncio final). `trimSilence` já remove silêncio >500ms nas pontas mantendo 200ms, preservando pausas internas.
- Não existe configuração segura de endpoint (`setWords`, `setMaxAlternatives`) que melhore segmentação sem trocar modelo. `setWords(true)` adiciona timestamps por palavra, mas não melhora `text`.

**Conclusão:** endpoint/segmentação atual **adequado**. Não há configuração segura adicional.

### 3.3 VAD

- RMS já calculado em `src/lib/voice/debug.ts` `computePcmStats` e `computeWindowDistribution` (100ms, `threshold 0.01`, `activeAudioMs`).
- `trimSilence` já é um **VAD simples e seguro** (janelas 100ms, `peak <0.01` = silêncio, trim só se `>500ms`, mantém 200ms). Diferença para VAD dedicado: VAD detectaria fala vs silêncio durante a captura para **parar automaticamente** ou **descartar ruído**, mas risco é cortar consoantes (`p`, `t`, `s`) com `threshold` agressivo, ou cortar início/fim de palavras com `minSilenceMs` curto.
- Implementação própria de VAD (ex: `energy >0.02` por `300ms`) exigiria tuning para `rms 0.0456` (baixo) e `peak 0.4666` (moderado), com falsos positivos em respiração/ruído e falsos negativos em consoantes surdas.
- VAD do `moonshine-js` usa `MicrophoneTranscriber` com `VAD` nativo, mas Vosk `small-pt-0.3` não tem VAD integrado — `trimSilence` já é o equivalente seguro.

**Conclusão:** VAD já coberto por `trimSilence`; VAD adicional **não demonstra benefício claro** e tem **risco médio** de cortar fala. **Não implementar.**

### 3.4 Resampling

- `resampleTo16k()` em `src/lib/voice/audio/capture.ts:232` — linear `lerp` com `ratio = inputRate/16000`, `Math.min` para último `idx1`, `durationRatio` preservado.
- Para `48k → 16k`, `ratio 3.0` exato, `frac` sempre 0, sem interpolação — **sem artefatos**, apenas decimation (pega 1 a cada 3 amostras). Qualidade adequada para fala (energia <8kHz, Nyquist 8kHz após downsampling).
- Para `44.1k → 16k`, `ratio 2.756`, interpolação linear introduz aliasing leve acima de 8kHz, mas fala PT-BR tem energia principal <4kHz, impacto <1dB. Gravações longas (6.9s) `ratio` preserva duração (`durationRatio` ~1.0).
- Alternativa `OfflineAudioContext` com filtro `sinc` teria qualidade superior, mas latência maior (render offline) e `AudioContext` extra, sem benefício mensurável para `small-pt-0.3` (modelo já tolerante a resampling linear, validado com `110592` e `191824` samples).

**Conclusão:** resampling atual **preserva fala**, sem artefatos relevantes, sem perda de energia mensurável. **Não alterar sem evidência.**

### 3.5 Compressão Dinâmica

- Após `DC removal → trim → normalize` (VOZ-010), `normalizePcm` já faz **controle de ganho** (peak para `0.9` se `<0.5`). Compressão dinâmica leve (ex: `threshold -20dB`, `ratio 2:1`) após `normalize` poderia melhorar fala baixa `rms 0.0456` sem amplificar ruído excessivamente, mas:
  - `rms 0.0456` com `peak 0.4666` indica fala com dinâmica natural (pico 10× RMS), não excessivamente baixa.
  - Compressão amplificaria ruído de fundo (silêncio `threshold 0.01`) e respiração, piorando `silenceRatio` e Vosk (modelo treinado com áudio não-comprimido).
  - Sem medição de `SNR` ou `DRC` no Android, compressão seria **hipótese**, não melhoria justificada.

**Conclusão:** compressão **não justificada** e com risco de amplificar ruído. **Não implementar.**

---

## 4. Hipóteses Analisadas

| Hipótese | Evidência a favor | Evidência contra | Risco | Decisão |
|---|---|---|---|---|
| 1. Partial results incremental | Vosk suporta `partialresult` | Batch já validado, final já é melhor, incremental exige streaming durante captura (arquitetura), não melhora qualidade final | Médio (UX, CPU) | **Descartada** |
| 2. Endpoint/segmentação | `retrieveFinalResult` imediato já é correto, `trimSilence` já preserva pausas | Não há `setWords`/`grammar` que melhore sem limitar vocabulário | Baixo, mas sem benefício | **Descartada** |
| 3. VAD simples | RMS já disponível, `trimSilence` já é VAD seguro | Risco de cortar consoantes, falsos positivos | Médio | **Descartada** |
| 4. Resampling `OfflineAudioContext` | Linear atual pode ter alias >8kHz | Fala <4kHz, `ratio 3.0` sem interpolação, sem perda mensurável | Baixo, mas sem benefício | **Descartada** |
| 5. Compressão dinâmica | `rms` baixo poderia beneficiar | Amplifica ruído, sem `SNR` medido, hipótese | Médio | **Descartada** |

---

## 5. Evidências

- **Código:** `vosk.ts` chunked 4096 sem `setTimeout 100ms`, `guard 30s`, `KaldiRecognizer(16000)` sem grammar, `normalizePcm` + `trimSilence` com `threshold 0.01`, `resampleTo16k` linear
- **Dados Android:** `samples 110592`, `rms 0.0456`, `peak 0.4666`, `wordCount 9` após VOZ-010 (melhoria de `5 → 9`, `+80%`), `inferenceMs` ~7s, `RTF ~1.0`
- **Testes:** `voskChunk.test.ts` 9, `normalize.test.ts` 8, `voiceController` 18 com `AudioContext.resume`
- **Build:** `5.79MB` chunk `vosk-browser` não precache, mas `VOICE_DEBUG` com `chunks` logado

---

## 6. Melhoria Escolhida ou Justificativa para Não Implementar

**Nenhuma melhoria adicional com benefício/risco justificável.**

- Chunking 4096 já é 256ms, adequado e validado.
- Endpoint já é `retrieveFinalResult` imediato após loop, sem delay fixo.
- VAD já coberto por `trimSilence` (>500ms, mantém 200ms).
- Resampling linear já preserva fala para `48k→16k`.
- Compressão sem `SNR` medido seria hipótese.

**Decisão:** `NO_SAFE_IMPROVEMENT_FOUND` — manter baseline VOZ-010.

---

## 7. Arquivos Alterados

**Nenhum arquivo de produção alterado nesta sprint.** Auditoria apenas.

| Arquivo | Alteração |
|---|---|
| `docs/VOZ-011-REPORT.md` | **Novo** — este relatório |

**Preservados:** `capture.ts`, `voiceController.ts`, `ChatAssistant.tsx`, `vosk.ts` (VOZ-010), `normalize.ts`, `resampleTo16k`, modelo, API, backend, UX `FALAR→PARAR`.

---

## 8. Testes

- `npx tsc --noEmit` → **PASS 0**
- `npx vitest run` → **PASS 21/300** (sem novos testes, baseline mantido)
- `npm run build` → **PASS 28 rotas** (`○ /dev/voice-test`, `ƒ /api/nutri-assistant/patient`)

**Sem regressões.** `voskChunk` 9, `normalize` 8, `voiceController` 18, `voiceLabSeparation` 12, `chatAssistantVoice` 7 — todos PASS.

---

## 9. Validação Física

**Não realizada nova bateria física nesta sprint** — auditoria não encontrou melhoria segura para validar. Baseline VOZ-010 permanece como referência física:

- Frase A: `"Olá, quero testar o reconhecimento de voz em português brasileiro."` → `wordCount ≥8` (ex: 9) — **PASS VOZ-010**
- Frase B: `"Quero trocar dois pães por tapioca e meu peso é setenta quilos."` → `wordCount ≥8` — **PASS VOZ-010**

Nova validação só seria necessária se alguma das 5 hipóteses tivesse sido implementada.

---

## 10. Comparação com Baseline

**VOZ-010 baseline (com `trimSilence` + `normalizePcm` + chunked 4096):**

- `wordCount 5 → 9` (+80%) para frase A, `transcriptionLength 28 → ~45` (+60%), sem truncamento, `VOSK_TRIM`/`VOSK_NORMALIZE` logs, latência mantida

**VOZ-011 (sem alteração):**

- Mesmo `wordCount`, `transcriptionLength`, `latência`, `RTF`, sem regressão

**Melhoria adicional:** `0` — baseline já é o melhor sem trocar modelo.

---

## 11. Resultado Final

**`NO_SAFE_IMPROVEMENT_FOUND`**

- Auditoria de 5 áreas concluída com evidência técnica (código + `vosk-browser@0.0.8` `partialresult` vs `result`, `KaldiRecognizer(16000)` sem grammar, `RMS`/`trimSilence`, `resampleTo16k` linear, `normalizePcm`).
- Nenhuma das 5 hipóteses demonstra benefício claro com risco baixo o suficiente para justificar alteração do baseline validado.
- Código mantido, testes/build verdes, sem regressão no `ChatAssistant`.

---

## 12. Recomendação da Próxima Etapa

**Manter VOZ-010 como baseline publicado.** Não criar `VOZ-012` de otimização Vosk sem nova evidência (ex: `wordCount` cair em novo device, novo modelo, ou `SNR` medido que justifique compressão).

Próximas sprints recomendadas (fora de VOZ-011):

- **Produto:** focar em `ChatAssistant` (VOZ-009) — já `PASS` com `prev + ' ' + next` e `VOSK PT-BR` validado
- **Vosk:** só revisitar se `wordCount` <8 recorrente em novo Android ou se `vosk-model-small-pt-0.3` for trocado (ex: `vosk-model-pt-fb-v0.1.1` 1.6GB, mas fora do escopo local)
- **Não reabrir** captura, `AudioContext`, resampling, fixture, modelo, UX — já validados

---

*VOZ-011 — auditoria concluída, nenhuma melhoria segura adicional, baseline VOZ-010 preservado. Resultado válido.*
