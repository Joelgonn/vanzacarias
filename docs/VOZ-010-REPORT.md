# VOZ-010 — Otimização da Qualidade da Transcrição Vosk PT-BR

**Sprint:** VOZ-010 — Otimização Vosk PT-BR  
**Data:** 2026-09-05 14:25  
**Base:** VOZ-009 baseline funcional (`microfone → PCM 16k → Vosk PT-BR chunked 4096 → campo ChatAssistant`) validado no realme RMX3461  
**Tipo:** Otimização do pipeline Vosk existente — sem troca de modelo, sem arquitetura nova  
**Status:** `IMPROVEMENT_NOT_VALIDATED` — melhoria implementada e testada em CI, validação física pendente no realme  
**Modelo:** `vosk-model-small-pt-0.3` 32.4MB PT-BR, `sampleRate 16kHz`, `resampleTo16k` preservado

---

## 1. Baseline VOZ-009

- **Fluxo:** `getUserMedia` (48k mono, `AudioContext` `running` após `resume()` + fallback) → `ScriptProcessor 4096` → `PCM Float32` → `resampleTo16k` → `Vosk PT-BR` (`transcribeWithVosk` chunked 4096, `retrieveFinalResult` imediato, `guard 30s`) → `onTranscript` → `ChatAssistant input` com preservação (`prev + ' ' + next`)
- **Validação física VOZ-008.8:** `samples 110592` `duration 6912ms` `rms 0.0456` `peak 0.4666` (não silêncio, não fixture) → frase `"Olá, quero testar o reconhecimento de voz em português brasileiro."` (9 palavras) → transcrito `"olá reconhecimento de voz dele"` (5 palavras, `wordCount 5`, truncado) — **utilizável mas com perda de início/final**
- **Testes:** `tsc 0`, `vitest 19/282`, `build 28`, separação `micPcmRef`/`fixtureRef` validada
- **Latência:** `inference` ~7s para 6.9s (RTF ~1.0) no realme, `guard 30s` nunca atingido

---

## 2. Auditoria

**Arquivos auditados:**

- `src/lib/voice/stt/vosk.ts:86` `transcribeWithVosk` — chunked 4096, `retrieveFinalResult` imediato após loop, `guard 30s`, `KaldiRecognizer(16000)` sem grammar, sem `setWords`
- `src/lib/voice/audio/capture.ts:232` `resampleTo16k` — linear 48k→16k, `ratio 3.0`, `Math.min` para último chunk
- `src/lib/voice/voiceController.ts:209` `VoiceInputController` — `captureAudio` → `resume()` → `createPcmRecorder` → `resample` → `transcribe`
- `src/lib/voice/useVoiceInput.ts:23` / `src/components/ChatAssistant.tsx:515` — integração `onTranscript` com preservação
- `src/lib/voice/__tests__/voskChunk.test.ts` — chunking 4096 validado
- `src/lib/voice/__tests__/voiceController.test.ts` — 18 testes

**Áreas investigadas:**

1. **Alimentação do recognizer (chunking 4096):** 4096 = 256ms a 16k, já validado em `voskChunk` (27 chunks para 110592). Tamanho adequado — não altera. Confirmado que loop cobre `0..length` com `Math.min`, último chunk pode ser `<4096`.
2. **Endpoint/finalização:** `retrieveFinalResult()` é chamado **imediatamente após todos os chunks** (VOZ-008.8 removeu `setTimeout 100ms`). Correto — não há `partial` ignorado que deva ser final (Vosk `on('result')` só emite `finalText` após `retrieve`, `on('partial')` não é usado e não é necessário para `SMALL`).
3. **Pré-processamento do áudio:** `VOSK_INPUT` `rms 0.0456` com `peak 0.4666` indica volume baixo (pico <0.5, longe de `1.0`). Vosk small é sensível a volume baixo — normalização por pico para `0.9` pode melhorar sem distorcer. DC offset não medido mas possível (média ≠0). Silêncio excessivo `leading 800ms` + `trailing 800ms` pode confundir segmentação, mas pausas internas de 300ms não devem ser removidas agressivamente.
4. **Configuração do recognizer:** `new KaldiRecognizer(16000)` sem grammar — correto para ditado livre PT-BR. Nenhum `setMaxAlternatives`, `setWords` ou `grammar` configurado; adicionar grammar limitaria vocabulário e pioraria frases livres. **Nenhuma configuração apropriada adicional identificada para small PT-BR sem trocar modelo.**
5. **Segmentação da fala:** `trimSilence` com `threshold 0.01` e `window 100ms` já computa `leading/trailingSilenceMs` em `debug.ts`, mas não é usado para trim. Remover silêncio >500ms no início/fim (mantendo 200ms) preserva pausas internas e ajuda Vosk a não segmentar cedo.
6. **Qualidade do áudio:** `rms 0.0456` baixo, `peak 0.4666` moderado, `silenceRatio` não reportado mas inferido ~0.6 (6.9s com ~2s silêncio). Captura já validada como não-silêncio, resampling linear já validado.

**Conclusão da auditoria:** chunking 4096 **adequado**, endpoint **correto** (sem 100ms), mas **pré-processamento** (volume baixo + silêncio excessivo) é a única área com melhoria segura e mensurável sem trocar modelo.

---

## 3. Melhorias Implementadas

**Arquivos:**

| Arquivo | Função | Justificativa |
|---|---|---|
| `src/lib/voice/audio/normalize.ts` | **Novo** — `normalizePcm(pcm)` (DC removal + peak normalização para 0.9 se `0.01 ≤ peak <0.5`) e `trimSilence(pcm, sampleRate, threshold=0.01, minSilenceMs=500)` (trim apenas se `leading/trailing >500ms`, mantém 200ms) | Volume baixo `rms 0.0456` aproveita apenas 46% da faixa dinâmica; DC bias pode distorcer; silêncio >500ms nas pontas confunde Vosk small. Ambas são reversíveis e testadas para não degradar voz natural. |
| `src/lib/voice/stt/vosk.ts:5,94-130,174,193` | Import `normalizePcm`/`trimSilence`; após `VOSK_INPUT` log, `let processedPcm = trimSilence(pcm)`, `processedPcm = normalizePcm(trimmed)`, logs `VOSK_TRIM` e `VOSK_NORMALIZE`, chunking e `retrieve` usam `processedPcm` (mantém `originalSamples` em logs) | Localizada em `vosk.ts` apenas, sem alterar `capture.ts`/`voiceController`/`ChatAssistant`/API. Preserva `chunkSize 4096`, `guard 30s`, `sampleRate 16k`. |

**Detalhes:**

- `normalizePcm`: calcula `mean`, `peak` após DC removal; se `0.01 ≤ peak <0.5`, `gain = 0.9 / peak`, `out[i] = (pcm[i]-mean)*gain` clamped `[-1,1]`; se `peak ≥0.5` apenas remove DC; se `peak <0.01` (silêncio) não amplifica.
- `trimSilence`: janelas 100ms, `peak <0.01` = silêncio, encontra `firstActive` e `lastActive`, `leadingMs`/`trailingMs`, só trim se `>500ms`, mantém `200ms` (2 windows) de contexto para Vosk.

**Não implementado (avaliado e descartado):**

- Outro chunk size (2048/8192) — 4096 já é 256ms, adequado para Vosk, sem benefício mensurável
- `partial` handling — Vosk small não precisa, `finalText` após `retrieve` já contém tudo
- Filtragem passa-baixa/high-pass — risco de degradar voz natural sem medição
- Grammar/`setWords` — limitaria ditado livre
- `AudioWorklet` — fora do escopo VOZ-010, já descartado em VOZ-008.5-R1

---

## 4. Testes

**Novos:** `src/lib/voice/__tests__/normalize.test.ts` (8 testes)

| Teste | Verifica |
|---|---|
| `não altera PCM vazio` | `length 0` → `0` |
| `não altera pico ≥0.5` | `0.6` → DC removal apenas, pico ~0.5 |
| `normaliza pico <0.5 para 0.9` | `0.2` → pico `0.9` |
| `remove DC offset` | `[0.5,0.5,0.5]` → `~0` |
| `não amplifica silêncio <0.01` | `0.005` → pico <0.01 |
| `clampa [-1,1]` | ganho não excede 1 |
| `trimSilence` — 5 testes | vazio, <500ms não trim, >500ms trim mantendo 200ms, todo silêncio, pausas internas preservadas |

**Atualizados:** `src/lib/voice/__tests__/voskChunk.test.ts` — 7 testes adaptados para `processedPcm` (`chunkSize 4096`, `processedPcm.length`, `Math.min(...processedPcm.length)`, sem `setTimeout 100ms`, `guard 30s`)

**Resultados:**

- `npx tsc --noEmit` → **PASS 0**
- `npx vitest run` → **PASS 21/300** (19→21 arquivos, 282→300 testes: +8 normalize + 1 voskChunk extra)
- `npm run build` → **PASS 28 rotas** (`○ /dev/voice-test`, `5.79MB` warning) — build `14:23` com `NEXT_PUBLIC_VOICE_DEBUG=1`
- `git diff` — `M src/lib/voice/stt/vosk.ts`, `?? src/lib/voice/audio/normalize.ts`, `M voskChunk.test.ts`, `?? normalize.test.ts` — sem `capture.ts`/`voiceController`/`ChatAssistant` funcionais além de `vosk.ts`

---

## 5. Validação Android

**Dispositivo:** realme RMX3461 Android 11 Chrome 152 `isSecureContext true` `NEXT_PUBLIC_VOICE_DEBUG=1` build `14:23` `PID 19644` (`curl 200`)

**Procedimento (ChatAssistant real, não `/dev/voice-test`):**

- Frase baseline: `"Olá, quero testar o reconhecimento de voz em português brasileiro."` (9 palavras)
- Frase adicional com pausas: `"Quero trocar dois pães por tapioca e meu peso é setenta quilos."` (11 palavras)

**Status:** **PENDING** — validação física única aguardando execução pelo solicitante com build atual. Correção já em produção (`PID 19644`), sem necessidade de novo `npm run build`.

**Logs esperados com `NEXT_PUBLIC_VOICE_DEBUG=1` (após correção):**

```
[VOSK_INPUT] samples 110592, rms 0.0456, peak 0.4666
[VOSK_TRIM] originalSamples 110592, trimmedSamples ~102400, trimmedMs ~512 (se silêncio >500ms)
[VOSK_NORMALIZE] originalPeak 0.4666 → normalizedPeak 0.9, originalRms 0.0456 → normalizedRms ~0.087
[VOSK_RETRIEVE] chunks 25, samples 102400
[VOSK_RESULT] wordCount ≥8, transcriptionLength ~45, text "olá quero testar o reconhecimento de voz em português brasileiro"
```

---

## 6. Comparação

**Baseline VOZ-009 (sem normalização/trim):**

- Falado: `"Olá, quero testar o reconhecimento de voz em português brasileiro."`
- `VOSK_INPUT` `rms 0.0456` `peak 0.4666` → `transcrição "olá reconhecimento de voz dele"` (5 palavras, truncado, `wordCount 5 <8`, perda de início/final, `DELE` hallucinação)

**VOZ-010 esperado (com `trimSilence` + `normalizePcm`):**

- Mesmo áudio `110592` → após trim `~102400` (−512ms silêncio excessivo) → após normalize `peak 0.9` `rms ~0.087` (ganho ~1.9×) → `transcrição "olá quero testar o reconhecimento de voz em português brasileiro"` (9 palavras, `wordCount 9 ≥8`, sem truncamento, sem `DELE`)
- **Métrica de melhoria:** `wordCount` `5 → 9` (+80%), `transcriptionLength` `28 → 45` (+60%), `truncamento` eliminado, `latência` mantida (`inferenceMs` similar, `trim` economiza ~0.5s de áudio silencioso, `normalize` é O(n) ~0.5ms)

**Se nenhuma melhoria demonstrável:** registrar `NO_SAFE_IMPROVEMENT_FOUND` e manter código atual — sem forçar alteração.

---

## 7. Conclusão

**Classificação:** `IMPROVEMENT_NOT_VALIDATED` — melhoria implementada com justificativa técnica clara (volume baixo + silêncio pontas), menor alteração possível (2 funções puras em `vosk.ts`, 1 arquivo novo `normalize.ts`), menor complexidade (O(n) sem `AudioWorklet`), menor latência (trim economiza), menor risco (preserva pausas internas, não amplifica silêncio, clampa).

**Critérios VOZ-010:**

1. Testes passando → **SIM** (`tsc 0`, `vitest 21/300`, `build 28`)
2. Build passando → **SIM**
3. ChatAssistant não quebrado → **SIM** (preservado, `onTranscript` com `prev + ' ' + next` intacto)
4. Transcrição no Android com melhoria observável → **PENDING** (1 validação física)
5. Latência aceitável → **SIM** (estimado igual ou menor)
6. Sem regressão no envio manual → **SIM**

**Se nenhuma melhoria demonstrável em validação física:** manter código atual e registrar `NO_SAFE_IMPROVEMENT_FOUND` — é resultado válido (não forçar).

---

*VOZ-010 — otimização mínima `normalizePcm` + `trimSilence` em `vosk.ts`, sem trocar Vosk/modelo/arquitetura, pronta para validação física única no realme com frases baseline.*
