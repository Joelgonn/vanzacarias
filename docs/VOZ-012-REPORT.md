# VOZ-012 — Estabilização UX e Ciclo de Vida da Voz

**Sprint:** VOZ-012 — Estabilização UX + Ciclo de Vida
**Data:** 2026-09-05  
**Base:** VOZ-011 `NO_SAFE_IMPROVEMENT_FOUND` — Vosk fixo como baseline. Baseline físico realme RMX3461 valido (VOZ-010: `samples 110592`, `rms 0.0456`, `peak 0.4666`, `wordCount ≥8`)
**Tipo:** Auditoria UX + correção de congelamento + robustez de ciclo de vida + textarea expansível
**Status:** `IMPLEMENTED_NOT_VALIDATED` — correções implementadas e testes verdes; validação Android física (FASE 9) pendente
**Modelo:** `vosk-model-small-pt-0.3`, `sampleRate 16kHz`, chunked 4096, `trimSilence` + `normalizePcm` (VOZ-010) — **inalterados**

---

## 1. Problema Observado

Dois problemas reais relatados:

1. **Congelamento percebido:** ao pressionar GRAVAR, havia um período em que o botão parecia travado até ficar novamente disponível.
2. **Textarea não expande:** transcrição longa estourava o campo fixo (`max-h 132px`, `overflow-hidden` no textarea), dificultando a leitura.

Meta da sprint: endurecer o ciclo de vida (gravações múltiplas, cancelamento, permissão/erro) sem regressão no reconhecimento VOZ-010.

---

## 2. Diagnóstico da Latência

### Antes (`start()` em `voiceController.ts`)

Ordem do clique até "gravando":

```
clique → loading=true
  → await captureAudio (getUserMedia + AudioContext)   [assíncrono, barra de permissão]
  → [ENGINE] LOAD_START → await engine.load()          ← modelo Vosk ENTRE a captura
    → if READY, pula
  → resume() do AudioContext
  → recorder.start() → setStatus('recording')
```

O **problema**: `await this.engine.load()` (download/extração/Worker do modelo `small-pt-0.3`, centenas de ms no Android) ficava **entre** a captura e `setStatus('recording')`. Enquanto o load rodava, o botão permanecia em `loading` sem feedback de gravação → percepção de congelamento. Na primeira gravação o modelo não está carregado, então o delay é máximo na primeira interação.

### Depois (implementado)

```
clique → loading=true
  → await captureAudio                                     [assíncrono, barra de permissão]
  → resume() do AudioContext
  → recorder.start() → setStatus('recording')              ← feedback IMEDIATO
  → [ENGINE] LOAD_START (em background, parallelo à gravação)
    → load termina → LOAD_SUCCESS (sem tocar na UI)
```

- `status='recording'` é emitido **antes** do load; o usuário vê o botão "PARAR" imediatamente após a captura.
- O engine carrega em segundo plano **durante** a gravação. Em gravações seguintes, `isEngineReady` é `true` e o load é pulado (zero delay).
- **Corrida resolvida:** `stop()` agora aguarda `pendingEngineLoad` antes de transcrever (ver §5), evitando `transcribe` antes do modelo estar pronto e o carregamento concorrente do mesmo modelo (`loadVoskModel` não deduplica chamadas em voo — `stt/vosk.ts:61`).

### Instrumentação (FASE 2)

Addos marcadores `#[VOICE_DEBUG]` (gated por `isVoiceDebugEnabled()`), reaproveitando a infra `src/lib/voice/debug.ts` — sem sistema paralelo:

| Marcador | Onde |
|---|---|
| `VOICE_CLICK` | `start()` após `++gen` |
| `VOICE_CAPTURE_START` / `VOICE_CAPTURE_ERROR` / `VOICE_CAPTURE_READY` | `start()` fluxo de captura |
| `VOICE_RECORDING_STARTED` | `start()` logo após `setStatus('recording')` |
| `VOICE_ENGINE_LOAD_START` / `LOAD_ERROR` / `LOAD_SUCCESS` | `start()` bloco 4 |
| `VOICE_STOP` | `stop()` início |
| `VOICE_WAIT_ENGINE_LOAD` | `stop()` quando aguarda load em background |
| `VOICE_PROCESS_START` | `stop()` antes do resample/transcribe |
| `VOICE_VOSK_START` / `VOICE_VOSK_END` | `stop()` envolta de `engine.transcribe` |
| `VOICE_TRANSCRIPT` | `stop()` (controller) e `ChatAssistant.onTranscript` |
| `VOICE_UI_UPDATED` | `ChatAssistant` após `setInput` (próximo tick React) |

Todos logam apenas `gen`, durações, `wordCount`, `transcriptionLength` e `textPreview.slice(0,80)` (já existente) — **nunca o texto integral**.

---

## 3. Diagnóstico do Textarea

### Antes (`ChatAssistant.tsx`)

```tsx
// useEffect só em state.input === '' (restaura altura após envio)
className="... resize-none overflow-hidden ... min-h-[44px] max-h-[132px]"
```

- Altura limite fixa de `132px` com `overflow-hidden`: transcrições longas eram **cortadas** sem scroll.
- O `useEffect` só reagia ao input limpo (`''`); o texto entregue por `onTranscript` (via `setInput`) **não** disparava reajuste → não crescia.

### Depois

```tsx
className="... resize-none overflow-y-auto ... min-h-[44px] max-h-[200px]"

// useEffect reage a state.input (qualquer valor)
useEffect(() => {
  if (textareaRef.current) {
    textareaRef.current.style.height = 'auto';
    const maxH = 200;
    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, maxH) + 'px';
    textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > maxH ? 'auto' : 'hidden';
  }
}, [state.input]);

// onChange (digitação manual) — mesmo auto-ajuste, maxH 200
```

- `texto curto → altura normal (~44px)`; `texto médio → cresce`; `texto longo → até 200px → overflow-y-auto (scroll interno)`.
- Reage tanto a digitação quanto à chegada de transcrição (`state.input` como dependência).
- `maxLength/handleSend/onKeyDown/disabled` intactos — envio continua acessível.

---

## 4. Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `src/lib/voice/voiceController.ts` | Reordenação record-before-load; `pendingEngineLoad`; `stop()` aguarda load; evita reset de estado compartilhado em continuações obsoletas; `cancel()` trata `TRANSCRIBING→READY` e `transcribing=false`; early-fail engine ausente; marcadores `VOICE_*` |
| `src/components/ChatAssistant.tsx` | Textarea auto-expansão 200px (`useEffect` + `onChange` + classe `overflow-y-auto max-h-[200px]`); imports/marcadores debug; `VOICE_TRANSCRIPT`/`VOICE_UI_UPDATED` |
| `src/lib/voice/__tests__/voiceLifecycleVOZ012.test.ts` | **Novo** — 8 testes: transição imediata; gravação única/dupla/tríplice; cancelamento; cleanup; permissão negada; STOP-durante-load; CANCEL-durante-load; load falha → retry |
| `src/lib/voice/__tests__/textareaVOZ012.test.ts` | **Novo** — 4 testes estruturais do textarea (max 200, overflow-y-auto, useEffect + onChange, min/max) |
| `docs/VOZ-012-REPORT.md` | **Novo** — este relatório |

**Preservados (inalterados):** `capture.ts`, `vosk.ts`, `normalize.ts`, `resampleTo16k`, `trimSilence`, modelo, API, backend, engineState reducer, fluxo `FALAR → PARAR → transcrever`, classes de `useVoiceInput`.

---

## 5. Correções Implementadas

### 5.1 Congelamento na gravação (FASE 3)

- `start()`: captura → resume → `recorder.start()` → `setStatus('recording')` **antes** do engine load.
- Engine carrega em background; falha de load encerra a gravação (cancel) e reporta `load_failed` com cleanup completo.
- Engine ausente falha **antes** de tocar no microfone (`load_failed` imediato).

### 5.2 Corrida load × transcribe (FASE 4)

- Novo campo `pendingEngineLoad`. `stop()`, se chamado enquanto o engine ainda carrega, faz `await` da promise **antes** de transcrever.
- Evita: `transcribe` com modelo não pronto, e **dois carregamentos concorrentes** do mesmo modelo Vosk (`loadVoskModel` sem deduplicação em voo — o parallel load sobrescreveria `cachedModel`, vazando um `Model`).

### 5.3 Robustez de geração / continuações obsoletas (FASE 4/5)

- Continuação obsoleta do load (gen antigo) não mais nullifica `recorder`/`recording`/`capture` de uma geração nova — antes, `cancel()` + novo `start()` podia ter o recorder da 2ª gravação anulado pela 1ª continuação.
- `cancel()`: define `transcribing = false` e, se `TRANSCRIBING`, restaura `READY` (modelo já carregado) — **nenhum estado preso**.

### 5.4 Textarea (FASE 7)

Conforme §3.

---

## 6. Testes

`npx tsc --noEmit` → **PASS 0**  
`npx vitest run` → **PASS 314/314** (23 arquivos; +8 novos testes VOZ-012)  
`npm run build` → **PASS 28 rotas** (`○ /dev/voice-test`; chunk 5.79MB Vosk não-precache — warning pré-existente)

Novos testes:

- `voiceLifecycleVOZ012.test.ts` (8): transição imediata `recording` antes do load; gravação única; 2ª e 3ª gravações consecutivas (load não repetido, sem acúmulo); cancelamento (nenhuma transcrição, estado recuperável, nova gravação funciona); cleanup (`capture`/`recorder` nulled, `engine.dispose`); permissão negada → `error` sem estado preso; **STOP durante load** (aguarda e transcreve 1×, sem corrida); **CANCEL durante load** (descarta, sem erro, nova gravação funciona); **load falha** → `load_failed`, recursos liberados, retry funciona.
- `textareaVOZ012.test.ts` (4): classes `max-h-[200px]`/`overflow-y-auto`; `Math.min(scrollHeight, 200)` em onChange + useEffect; `overflowY` gerenciado; `min-h-[44px]`.

Regressões: nenhuma. Todos os 306 testes pré-existentes seguem PASS.

---

## 7. Validação Android

**PENDENTE** — sem dispositivo físico no ambiente de CI. Necessário executar FASE 9 no realme RMX3461 (LAN, HTTPS Caddy `https://192.168.70.75:3001`, `NEXT_PUBLIC_VOICE_DEBUG=1`):

| Teste | Roteiro | Critério |
|---|---|---|
| T1 resposta do botão | pressionar GRAVAR | botão responde imediatamente, estado muda sem congelamento |
| T2 frase curta | "Olá, quero testar o reconhecimento de voz em português brasileiro." | UX + transcrição + tempo |
| T3 frase longa | "Quero trocar dois pães por tapioca e meu peso é setenta quilos." | transcrição + textarea cresce + editável + enviar acessível |
| T4 múltiplas gravações | GRAVAR→PARAR→resultado ×3 (sem reload) | todas funcionam, sem acúmulo |
| T5 cancelamento | GRAVAR→CANCELAR→GRAVAR | 2ª gravação funciona |
| T6 texto muito longo | frase longa | crescimento → limite 200px → scroll interno |

---

## 8. Comparação Antes/Depois

| Métrica | Antes | Depois |
|---|---|---|
| Estado após clique | `loading` até engine load completar (1ª gravação: centenas de ms) | `recording` imediato após captura; load em background |
| Botão durante 1ª gravação | "esperando" sem feedback de gravação | "PARAR" imediato (vermelho, ícone quadrado) |
| Gravações seguintes | load pulado (READY) — sem delay | idem |
| STOP durante 1º load | risco de transcrever com modelo não pronto / double-load | aguarda `pendingEngineLoad`, transcreve 1× |
| Cancelar durante transcrição | `transcribing` podia ficar preso | `cancel()` → `READY` reiniciável |
| Altura do textarea | fixa 132px, `overflow-hidden` (cortava) | auto: 44px→200px + scroll interno |
| Textarea após transcrição | não reagia a `state.input` | reage (grows) |
| Testes automatizados | 306 | **314** (+8 VOZ-012) |
| Reconhecimento Vosk | baseline VOZ-010 | **inalterado** (nenhuma linha de `vosk.ts`/`normalize.ts` tocada) |

---

## 9. Problemas Restantes

- **Validação física pendente** (FASE 9): comportamento percepível no Android real ainda não confirmado (classificação atual `IMPLEMENTED_NOT_VALIDATED`).
- **Concorrência de load no module-level** (`stt/vosk.ts:61`): `loadVoskModel` não deduplica chamadas em voo; mitigado nesta camada pelo `pendingEngineLoad`, mas um refactor futuro poderia hoist a promise (fora do escopo desta sprint — preservar `vosk.ts`).
- **Chunk 5.79MB Vosk não-precache**: warning pré-existente, sem impacto funcional.
- Base lint: 114 problemas pré-existentes (`no-explicit-any`), sem novos.

---

## 10. Resultado Final

**`IMPLEMENTED_NOT_VALIDATED`**

- Congelamento UX corrigido: `recording` emitido antes do engine load; load em background.
- Ciclo de vida endurecido: corrida load×transcribe resolvida via `pendingEngineLoad`; continuações obsoletas não resetam estado novo; `cancel()` sem estado preso; falhas de load/permissão com cleanup completo e retry funcional.
- Textarea: crescimento curto→médio→longo até 200px + scroll interno, reagindo a digitação e a transcrição.
- Instrumentação `#[VOICE_DEBUG]` completa no fluxo clique→captura→gravação→load→stop→processa→Vosk→transcript→UI, sem texto integral.
- Gates: tsc 0, vitest 314/314, build 28 rotas — sem regressões no baseline VOZ-010/VOZ-011.
- **Aguardando** validação física FASE 9 (realme RMX3461) para elevar a `VALIDATED`.

---

## 11. Recomendação da Próxima Etapa

Executar os 6 testes da FASE 9 (§7) no realme RMX3461 com `NEXT_PUBLIC_VOICE_DEBUG=1` e reclassificar para `VALIDATED` se T1–T6 passarem. Não reabrir Vosk/STT/modelo/API. Permanecer vigilante quanto à não-corrida de `stop()` antes do load (marcador `VOICE_WAIT_ENGINE_LOAD` no DevTools/log cat).

---

*VOZ-012 — UX e ciclo de vida estabilizados, reconhecimento VOZ-010 preservado; validação física pendente. Resultado: `IMPLEMENTED_NOT_VALIDATED`.*