# VOZ-009 — Integração do Microfone Real no ChatAssistant

**Sprint:** VOZ-009 — Integração ChatAssistant + Vosk PT-BR  
**Data:** 2026-09-05 14:02  
**Base:** VOZ-008.8 `ROOT_CAUSE_FIXED` (Vosk chunked 4096, `AudioContext.resume()`, `micPcmRef`/`fixtureRef` separados, UX `FALAR→PARAR` validada)  
**Tipo:** Integração — reutilização da camada de voz existente  
**Status:** `PASS` (código + testes + build) — `PENDING` validação física única no realme RMX3461  
**Fluxo validado:** `🎙️ Microfone → captura real → Vosk PT-BR local → texto → campo de mensagem → revisão → Enviar manual` (sem auto-send)

---

## 1. Arquitetura Reutilizada

**Camada de voz existente (VOZ-006/008.x) — sem nova arquitetura:**

```
ChatAssistant (src/components/ChatAssistant.tsx:512)
  ↓ useVoiceInput({onTranscript}) [src/lib/voice/useVoiceInput.ts:23]
    ↓ VoiceInputController [src/lib/voice/voiceController.ts:55]
      ↓ captureAudio → AudioContext({sampleRate: trackRate}) → resume() → running [capture.ts:81]
      ↓ createPcmRecorder → ScriptProcessor 4096 → PCM Float32 [capture.ts:180]
      ↓ resampleTo16k (48k→16k) [capture.ts:232]
      ↓ Vosk PT-BR chunked 4096 → retrieveFinalResult (sem setTimeout 100ms) [stt/vosk.ts:174]
      ↓ onTranscript(text) → ChatAssistant setInput
```

**Reutilização total:**

- `capture.ts` — `captureAudio`/`resampleTo16k`/`createPcmRecorder` com `AudioContext.resume()` e fallback `interrupted` (VOZ-008.5)
- `vosk.ts` — `transcribeWithVosk` chunked 4096, `guard 30s`, `vosk-model-small-pt-0.3` 32.4MB local, sem `cloud STT`
- `voiceController.ts` — `VoiceInputController` com `gen` token, `engineState`, `recordingStartMs`, `CAPTURE_*`/`VOSK_*` debug
- `useVoiceInput.ts` — hook com `controllerRef`, `status`/`isBusy`/`isRecording`, `dispose` no unmount
- `ChatAssistant.tsx` — `useChatState` + `patientLogic.runExchange` (fluxo textual existente)

**Não foi criado:** `/api/stt`, upload de áudio, `Supabase` para áudio, `Whisper`/`Moonshine`/`Web Speech API`/`AudioWorklet`/nova biblioteca.

---

## 2. Arquivos Alterados

| Arquivo | Alteração | Preservado |
|---|---|---|
| `src/components/ChatAssistant.tsx:515-524` | `onTranscript` agora **preserva texto existente**: `state.setInput(prev => prev.trim() ? `${prev.trim()} ${trimmed}` : trimmed)` em vez de sobrescrever `state.setInput(text)` | Layout, `micDisabled`, `handleSend`/`ask`/`retry`, `textarea`, `streamingText`, `isLoading`, `avatarMood` — intactos |
| `src/lib/voice/__tests__/chatAssistantVoice.test.ts` | **Novo** — 7 testes para `appendTranscript` (vazio→transcrição, existente+transcrição com espaço, transcrição vazia, trim, não auto-send, texto longo, integração `VoiceInputController` → `onTranscript`) | — |
| `docs/VOZ-009-REPORT.md` | **Novo** — este relatório | — |

**Não alterados (conforme regra):**

- `src/lib/voice/stt/vosk.ts` — chunked 4096 já validado em VOZ-008.8
- `src/lib/voice/stt/engines/vosk.ts` / `vosk-model-small-pt-0.3` / `resampleTo16k` / `capture.ts` (fora do `onTranscript`)
- `src/lib/voice/voiceController.ts` / `src/lib/voice/useVoiceInput.ts` — APIs existentes reutilizadas
- `src/app/api/**` / `src/lib/supabase/**` — backend
- `src/app/dev/voice-test/page.tsx` — UX `FALAR→PARAR` já validada (VOZ-008.6)

---

## 3. Comportamento da UX — ChatAssistant

**Botão de microfone junto ao campo de mensagem** (`ChatAssistant.tsx:804-834`):

- **Inativo:** `🎙️` `Falar` (tooltip/label `Falar mensagem`, `aria-label` acessível)
- **Gravando:** `⏹` rose `Parar e transcrever`, status `Gravando... — toque no microfone para parar` + `X` cancelar
- **Processando:** `Loader2` spinner, `Transcrevendo...`, `micDisabled = isLoading || (isBusy && !isRecording)` impede ações conflitantes
- **Resultado:** `onTranscript` → `state.setInput` (com preservação) → texto aparece no `textarea` (`value={state.input}`) para **revisão**

**Transcrição → campo de mensagem:**

```ts
onTranscript: (text) => {
  const trimmed = text?.trim();
  if (!trimmed) return;
  state.setInput((prev: string) => {
    const prevTrimmed = prev.trim();
    if (!prevTrimmed) return trimmed;
    return `${prevTrimmed} ${trimmed}`;
  });
}
```

- **Não executa** `submit`/`sendMessage`/`fetch`/`api` — usuário deve **ler, corrigir, editar, adicionar texto, tocar Enviar manualmente** (`handleSend` → `patientLogic.runExchange` → `POST /api/nutri-assistant/patient` fluxo normal)
- **Preserva texto existente:** `prev.trim()` + ` ` + `trimmed` (ex: campo `"preciso de ajuda"` + transcrição `"quero trocar"` → `"preciso de ajuda quero trocar"`)
- **Teste criado:** `chatAssistantVoice.test.ts` verifica concatenação com espaço, trim, vazio, longo, e que `onTranscript` não chama `sendMessage`

**Erros:**

- `getUserMedia` falha / permissão negada → `VoiceInputController.failCapture` → `onError` → `voice.error.userMessage` exibido em `role="status"` (`ChatAssistant.tsx:892`) como `Permissão de microfone negada...` / `Microfone em uso...` — feedback simples, sem expor `Vosk` interno
- Transcrição vazia → `code: 'empty'` → `Nenhuma fala detectada...`
- `VOICE_DEBUG` preservado (`NEXT_PUBLIC_VOICE_DEBUG=1` → `[VOICE_DEBUG] CAPTURE_START/STOP`, `VOSK_*` em `console.info`)

**Permissão:** usa `getUserMedia()` existente de `capture.ts`, sem sistema próprio.

**Desktop e Mobile:** layout `flex gap-2 bg-stone-50 rounded-[2rem]` com `shrink-0`, `min-w-[44px]`, `44px` touch target, `scrollRef`, `textarea` `max-h-[132px]` — não quebra `desktop`/`Android Chrome`/`input`/`enviar`/`mensagens`/`scroll`/`responsividade`.

---

## 4. Testes

**Novos:** `src/lib/voice/__tests__/chatAssistantVoice.test.ts` — 7 testes

| # | Teste | Verifica | Resultado |
|---|---|---|---|
| 1 | texto vazio + transcrição → transcrição | `''` + `'olá'` → `'olá'` | **PASS** |
| 2 | existente + transcrição → concatenado | `'oi'` + `'olá'` → `'oi olá'` | **PASS** |
| 3 | transcrição vazia não altera | `'texto'` + `''` → `'texto'` | **PASS** |
| 4 | trim antes de concatenar | `'  oi  '` + `'  olá  '` → `'oi olá'` | **PASS** |
| 5 | não auto-send, permite edição | `onTranscript` → `setInput` sem `sendMessage`, edição, `sendMessage` manual | **PASS** |
| 6 | texto longo | `'preciso de ajuda'` + `'quero trocar...'` | **PASS** |
| 7 | integração `VoiceInputController` → `onTranscript` | `ctrl.start/stop` → `onTranscript('teste de voz')` | **PASS** |

**Suíte completa:**

- `npx tsc --noEmit` → **PASS 0**
- `npx vitest run` → **PASS 20/289** (19→20 arquivos, `chatAssistantVoice` novo; `voiceController` 18, `voiceLabSeparation` 12, `voskChunk` 9)
- `npm run build` → **PASS 28 rotas** (`○ /`, `○ /dev/voice-test`, `ƒ /api/nutri-assistant/patient`, `5.79MB` chunk warning preexistente) — build `14:01` com `NEXT_PUBLIC_VOICE_DEBUG=1` ainda ativo, mas integração não depende de flag

**Gates VOZ-009 (12 critérios):**

| # | Critério | Verificado | Resultado |
|---|---|---|---|
| 1 | botão microfone aparece | `ChatAssistant.tsx:804` `Mic`/`Square` + `voice.isSupported` | **PASS** (código) |
| 2 | clicar inicia `useVoiceInput` | `onClick={() => voice.isRecording ? voice.stop() : voice.start()}` + `useVoiceInput` hook | **PASS** |
| 3 | parar encerra | `voice.stop()` → `VoiceInputController.stop()` → `recorder.stop()` | **PASS** |
| 4 | estado processando | `voice.isBusy` → `Transcrevendo...` + `Loader2` | **PASS** |
| 5 | `onTranscript` → input | `state.setInput` com append | **PASS** (teste 7) |
| 6 | não envia automaticamente | `onTranscript` sem `handleSend`/`fetch`, teste 5 | **PASS** |
| 7 | usuário pode editar | `textarea` `value={state.input}` editável, teste 5 | **PASS** |
| 8 | usuário pode enviar via fluxo normal | `handleSend` → `patientLogic.runExchange` → `POST /api/nutri-assistant/patient` intacto | **PASS** |
| 9 | texto existente não perdido | `prevTrimmed + ' ' + trimmed`, testes 2,4,6 | **PASS** |
| 10 | erro não quebra | `voice.error` → `role="status"` + `VOICE_DEBUG` | **PASS** |
| 11 | lifecycle/cancel não deixa ativa | `VoiceInputController.cancel` → `gen++`, `recorder.cancel`, `capture.cleanup` | **PASS** (teste 3 `cancel` + 15 `voiceController`) |
| 12 | botão enviar continua | `handleSend` `disabled={isLoading || !hasContent}` + `Send` | **PASS** |

---

## 5. Build

- `next.config.ts` — `withSerwist` `swSrc: src/sw.ts`, `maximumFileSizeToCacheInBytes: 5242880`
- `public/sw.js` — precache `G-U1...` (VOZ-008.4-R1 mismatch já corrigido via `taskkill` + rebuild `13:39` + restart `PID 3696`)
- `npm run build` `14:01` → `28 rotas` `○` static, `ƒ` dynamic, `Compiled with warnings` (chunk Vosk 5.79MB)

---

## 6. Validação Android — realme RMX3461

**Ambiente já validado (VOZ-008.7/008.8):**

- realme RMX3461 Android 11 SDK 30 Chrome 152.0.7977.75
- HTTPS `https://192.168.70.75:3001` via Caddy mkcert `isSecureContext true`
- `getUserMedia` + permissão OK, 48k mono, `AudioContext` `running` após `resume()`, PCM 16k, Vosk chunked 4096 validado fisicamente (`samples 110592`, `rms 0.0456`, frase 9 palavras reconhecida integralmente em VOZ-008.8)

**Validação VOZ-009 (ChatAssistant real, não `/dev/voice-test`):**

**Procedimento:**

1. Abrir `https://192.168.70.75:3001` → ChatAssistant (ícone `Nutri Van`)
2. Tocar `🎙️` → `Gravando...` (rose `⏹` + `X` cancelar)
3. Falar claramente:

   ```
   Olá, quero testar o reconhecimento de voz no ChatAssistant.
   ```

4. Tocar `⏹ Parar` → `Transcrevendo...`
5. Verificar que `Olá, quero testar o reconhecimento de voz no ChatAssistant.` aparece no **campo de mensagem** (`textarea`, não enviado)
6. Revisar/editar texto (ex: corrigir pontuação)
7. **Não** deve enviar automaticamente
8. Tocar `Enviar` ( `Send` ) manualmente
9. Confirmar que mensagem segue fluxo normal (`POST /api/nutri-assistant/patient` → resposta streaming `NDJSON` → bolha `assistant`)

**Segundo teste — texto existente:**

1. Digitar `Preciso de ajuda ` no campo
2. Tocar `🎙️` → falar `quero trocar pães` → parar
3. Verificar campo: `Preciso de ajuda quero trocar pães` (concatenado com espaço, não sobrescrito)

**Status:** **PENDING** — integração código `PASS`, aguardando **1 validação física única** no realme com build atual (`14:01` `PID 20148`, `curl 200` para `/dev/voice-test`). Não usar `/dev/voice-test` para esta validação.

**Transcrição obtida (esperada):** `Olá, quero testar o reconhecimento de voz no ChatAssistant.` (ou similar `wordCount ≥8`, PT-BR utilizável, como VOZ-008.8 `9 palavras reconhecida integralmente`)

---

## 7. Resultado Final

**Código + testes + build:** `PASS` — microfone dentro do `ChatAssistant`, `Vosk PT-BR` local (`vosk-model-small-pt-0.3` chunked 4096 sem `setTimeout 100ms`), `onTranscript` → `input` com preservação (`prev + ' ' + next`), sem auto-send, edição e envio manual via fluxo existente, sem upload de áudio (`/api/stt` não existe), `VOICE_DEBUG` preservado.

**Validação física:** `PENDING` — `ChatAssistant` real no Android realme RMX3461 com frase `Olá, quero testar o reconhecimento de voz no ChatAssistant.` + teste de concatenação com texto existente.

**Classificação VOZ-009:**

- Se validação física `PASS` (transcrição aparece, não auto-envia, edição + envio manual + concatenação OK, sem regressão desktop): **`PASS`**
- Se `FAIL` (sem transcrição, auto-send, texto perdido, quebra): registrar `texto falado`/`transcrição`/`wordCount`/`VOICE_DEBUG`/`estado` e abrir `VOZ-009.x` sem reabrir Vosk

**Próximo passo:** executar validação física única no realme com build `14:01` (`PID 20148`) e preencher §6 com `transcrição obtida` e `PASS/FAIL`.

---

*VOZ-009 — integração `MICROFONE → VOSK → TEXTO NO CHAT → REVISÃO → ENVIO MANUAL`, reutilizando `useVoiceInput`/`VoiceInputController`/`capture`/`vosk` validados, sem nova arquitetura.*
