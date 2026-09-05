# VOZ-006 — INTEGRAÇÃO VOSK PT-BR NO CHATASSISTANT

> Objetivo: `Vosk PT-BR → texto → input normal do ChatAssistant`. A voz é apenas uma nova forma de
> preencher o campo de entrada; o fluxo textual existente continua sendo a fonte única de verdade do
> envio. Regra arquitetural: o Vosk NÃO conhece Gemini/OpenAI/Supabase/RAG/streaming/guardrails/backend
> — recebe áudio, retorna `string`.

- Data: 2026-09-04
- Branch: `main` (HEAD `d72c6a7` + worktree VOZ-003/006 não commitado)
- Status: **PASS WITH RISKS — validação manual Android pendente de dispositivo físico**

---

## 1. Executive Summary

A entrada por voz foi integrada ao ChatAssistant de forma **cirúrgica e não destrutiva**:

1. Nova camada de controle `VoiceInputController` + hook `useVoiceInput` entre a UI e a engine
   (reutiliza `registry`, `engineState`, `capture.ts`); **o Vosk continua sem conhecer o backend**.
2. Botão de microfone no compositor: gravação explícita (toque para falar, toque para parar e
   transcrever, botão "X" para cancelar), estados visuais claros, `disabled` quando a engine não pode
   rodar ou enquanto o chat está enviando, **sem auto-send** — a transcrição vai para `setInput(text)`,
   o usuário revisa e envia pelo fluxo existente.
3. **Lifecycle completo resolvido:** `Model.terminate()` (API pública real do `vosk-browser`,
   `model.d.ts:17`) agora é chamado no `dispose()` — encerra Worker/WASM. Recognizer já era removido
   por transcrição (`recognizer.remove()`), AudioContext/tracks são liberados pelo `cleanup()` de
   `capture.ts`.
4. CI verde: `tsc` 0 erros, `vitest` 258 testes (17 arquivos, +15 do controller), `npm run build`
   PASS (28 rotas, `/dev/voice-test` estático). **Nenhuma rota `/api/stt` criada, nenhum upload de áudio.**
5. **Validação desktop com microfone:** Chromium real com dispositivo de áudio falso — permissão
   concedida (auto-grant), PCM 16k gerado, modelo carregado (5,4 s) e transcrição executada com
   **0 erros de console** (resultado `EMPTY` para o tom sintético, comportamento correto da "transcrição
   vazia").
6. **Validação Android físico: NÃO REALIZADA** (sem aparelho disponível neste ambiente) — checklist
   fornecido no Anexo A. Único critério de aceite pendente → classificação `PASS WITH RISKS`.

Limpeza de lab incluída: textos obsoletos `vosk-browser bundling bloqueado` removidos de
`page.tsx:498/539/568`; `public/vosk-model-small-pt-0.3.zip` (30,9 MB) removido (auditoria VOZ-005
confirmou que o runtime usa apenas o `tar.gz`).

---

## 2. Architecture

```
ChatAssistant (compositor)
      │  useVoiceInput()  ─ texto → state.setInput(text)   (SEM auto-send)
      ▼
VoiceInputController (novo)
      ├─ start():  support-check → captureAudio() → engine.load() (engineState) → createPcmRecorder().start()
      ├─ stop():   recorder.stop() → resampleTo16k(opcional) → engine.transcribe(pcm,16000) → onTranscript(text)
      ├─ cancel(): recorder.cancel() + capture.cleanup()  (descarta, não transcreve)
      └─ dispose(): migrate → capture.cleanup() → engine.dispose() → engineState RESET
      │
      ├─ captura  → src/lib/voice/audio/capture.ts   (captureAudio + createPcmRecorder + resampleTo16k)
      ├─ engine   → src/lib/voice/stt/registry.ts    (STT_ENGINES['vosk-pt-br'])
      └─ estado   → src/lib/voice/stt/engineState.ts (engineStateReducer, isEngineReady, canLoad)
```

Fluxo do dado:

```
mic → PCM Float32 (memória, taxa real do AudioContext)
    → 16 kHz mono
    → Vosk local (Worker/WASM)
    → texto → input do ChatAssistant
    → usuário edita → envio NORMAL (runExchange → /api/nutri-assistant/patient|admin)
```

Banheiro: a camada de voz produz **apenas texto**. `sanitizeInput`, `MAX_MESSAGE_LENGTH=500`,
histórico `slice(-6)`, sessão Supabase e streaming seguem valendo exatamente como para texto digitado.

---

## 3. Files Changed

| Arquivo | Tipo | Mudança |
|---|---|---|
| `src/lib/voice/audio/capture.ts` | mod (untracked) | + `createPcmRecorder` (linha 139): gravação contínua ScriptProcessorNode reutilizando stream/AudioContext existentes; `PcmRecorder` (`start/stop/cancel/cleanup`). |
| `src/lib/voice/stt/vosk.ts` | mod (untracked) | + `disposeVoskModel()` (linha 139): chama `Model.terminate()` (API real, `model.d.ts:17`/`vosk.js:705`) e limpa caches module-level. |
| `src/lib/voice/stt/engines/vosk.ts` | mod (untracked) | `dispose()` agora também chama `disposeVoskModel()` (linhas 26-32). |
| `src/lib/voice/voiceController.ts` | **novo** | `VoiceInputController` (linha 55) — camada de controle framework-agnóstica e testável. |
| `src/lib/voice/useVoiceInput.ts` | **novo** | Hook React (linha 23) espelhando status/transcript/error; dispose no unmount. |
| `src/lib/voice/__tests__/voiceController.test.ts` | **novo** | 15 testes (idle→recording→transcribing→result, cancel, erro de permissão/not-found, duplicate start, dispose/cleanup, transcript, empty, resample 48k→16k, reuse READY, transcribe_failed, engine ausente, unsupported). |
| `src/components/ChatAssistant.tsx` | mod (tracked) | Hook `useVoiceInput` (linha 515); botão microfone + stop + cancel no compositor (linha ~805); status/erro inline (`role="status"`); `micDisabled` respeita `state.isLoading`. |
| `src/app/dev/voice-test/page.tsx` | mod (tracked) | Stale texts `vosk bloqueado` → runtime corrigido (linhas 498/539/568). |
| `public/vosk-model-small-pt-0.3.zip` | **removido** | Duplicata não usada (30,9 MB). |

Nenhum arquivo de backend, Supabase, Gemini/OpenAI, RAG, guardrails, PWA/serwist ou `package.json`
foi alterado. `/dev/voice-test` preservado.

---

## 4. Voice Controller

`VoiceInputController` (`src/lib/voice/voiceController.ts`) — camada entre UI e engine:

- **start()**: guarda concorrência (`loading|recording|transcribing` → no-op); checa suporte
  (contexto seguro + `getUserMedia` + `engine.isSupported()`); `captureAudio(16000)` imediato
  (permissão no toque); load da engine apenas se não for `READY/RESULT` (via `engineStateReducer`);
  inicia `createPcmRecorder`.
- **stop()**: finaliza PCM na taxa real do `AudioContext`, reamostra para 16 kHz quando necessário
  (`resampleTo16k`), libera captura, transcreve (`engine.transcribe(pcm,16000)`), entrega texto em
  `onTranscript`. Transcrição vazia → erro `empty` (engine permanece pronta, nada é enviado).
- **cancel()**: descarta PCM e libera captura **sem transcrever**; invalida conclusões assíncronas
  em andamento (token de geração).
- **dispose()**: libera recorder/captura e chama `engine.dispose()` (→ `Model.terminate()`), estado
  volta a `IDLE`.
- Injeção de dependências (`getEngine`, `capture`, `recorderFactory`) permite testes em node sem DOM.

Máquina de estados: reutiliza `engineStateReducer` (LOAD/TRANSCRIBE/ERROR) e deriva o status da UI
(`idle/loading/recording/transcribing/result/error` via `recording` flag) — **uma única fonte de
verdade**, sem máquina paralela (VOZ-006 §4).

---

## 5. ChatAssistant Integration

`src/components/ChatAssistant.tsx` (851 linhas, +12 net):

- `const voice = useVoiceInput({ onTranscript: (text) => state.setInput(text) })` (linha 515).
  **Nenhuma chamada de envio originada da voz** — o usuário revisa e envia pelo botão/Enter normal.
- Compositor: botão `Mic` (44×44, acessível `aria-label`/`title`, `min-h44`) entre anexar foto e
  textarea. Durante gravação vira botão rosa `Square` "Parar e transcrever" + botão `X` "Cancelar
  gravação". Durante load/transcribe mostra `Loader2` (spinner) e `disabled`.
- `micDisabled = state.isLoading || (voice.isBusy && !voice.isRecording)` — não interfere no envio;
  desabilita enquanto o chat está respondendo.
- Feedback inline (`role="status"`, `aria-live="polite"`): "Gravando — toque no microfone para
  parar", "Transcrevendo...", ou a mensagem de erro amigável.
- **Mobile-friendly**: mesma largura de toque dos botões existentes, elementos `shrink-0`, sem
  dependência de hover para a ação principal.

Regra correta evidenciada: a voz preenche o input; o texto transcrito passa por `sanitizeInput` e
limite de 500 caracteres **no momento do envio**, sem exceção.

---

## 6. Vosk Lifecycle

| Recurso | Ciclo de vida (VOZ-006) |
|---|---|
| Microfone (MediaStream) | Adquirido no `start()`; `capture.cleanup()` para tracks em `stop()`/`cancel()`/`dispose()`. |
| AudioContext | Criado por `captureAudio`; fechado no mesmo `cleanup()`. |
| `PcmRecorder` (ScriptProcessorNode) | `source.disconnect()`/`processor.disconnect()` em `stop/cancel/cleanup`. |
| KaldiRecognizer | Criado por transcrição em `transcribeWithVosk`; **`recognizer.remove()`** no final (já existia). |
| Model + Worker/WASM | **Correção desta sprint:** `dispose()` → `disposeVoskModel()` → **`Model.terminate()`** (API pública do `vosk-browser`, `model.d.ts:17`), encerrando o Worker; caches `cachedModel/cachedModelId` limpos. Próximo `load()` recria tudo. |

`Model.terminate()` **existe** no pacote (confirmado em `node_modules/vosk-browser/dist/model.d.ts:17`
e `dist/vosk.js:705` — envia `{action:"terminate"}` ao Worker). Nenhuma API inventada.

---

## 7. Permission Handling

Captura usa `captureAudio` (que mapeia erros `getUserMedia` para `CaptureError` com código) e o
controller traduz para mensagens compreensíveis:

| Condição | Código | Mensagem ao usuário |
|---|---|---|
| Contexto inseguro (não HTTPS) | `insecure` | "O microfone exige um contexto seguro (HTTPS ou localhost)." |
| Permissão negada (`NotAllowedError`) | `permission_denied` | "Permissão de microfone negada. Permita o acesso no navegador e tente novamente." |
| Sem dispositivo (`NotFoundError`) | `not_found` | "Nenhum microfone encontrado no dispositivo." |
| Em uso/`NotReadableError` | `aborted` | "Microfone em uso por outro aplicativo..." |
| Sem `getUserMedia`/engine | `unsupported` | "Captura de áudio não é suportada neste navegador." |

Suporte é verificado antes do `start()` (suporte inválido → botão `disabled` com `title` explicativo);
erros de permissão mantêm o botão utilizável para nova tentativa.

---

## 8. Privacy

```
MICROFONE → PCM (memória) → VOSK LOCAL (Worker/WASM) → TEXTO
```

- **Nenhum áudio sai do dispositivo**: sem `/api/stt`, sem POST de áudio, sem Blob/Storage/Supabase.
  Verificado: (a) build sem rota `/api/stt`; (b) validação desktop com Network local apenas
  (0 erros, GETs locais); (c) VOZ-004-R4 já mediu 0 upload de áudio em dev/prod.
- Depois da transcrição: texto → input → fluxo normal existente → backend (`/api/nutri-assistant/*`),
  como texto digitado.
- **Redação correta:** apenas o processamento áudio→texto é local; o ChatAssistant completo **não** é
  "100% local".

---

## 9. PWA

- Nenhuma alteração no Serwist (`next.config.ts`, `src/sw.ts`) nem precache do modelo.
- Modelo (~32 MB `tar.gz`) **não é pré-cacheado** (chunk 5,79 MB e modelo excedem
  `maximumFileSizeToCacheInBytes: 5242880`). Comportamento real: **primeiro uso → download sob
  demanda** (GET same-origin pelo Worker); reusos posteriores reutilizam o `cachedModel` em memória e,
  a critério do cache HTTP do browser, podem reaproveitar a resposta do modelo.
- Consequência registrada: voz **online-first** por design; voice offline-first exigiria runtime cache
  dedicado (fora de escopo desta sprint).

---

## 10. Desktop Validation

Validação em **Chromium real (headless shell) + dispositivo de áudio falso** (auto-grant de permissão),
driving `/dev/voice-test` via Playwright (`pw-verif/voz006-mic.js`):

| Etapa | Resultado |
|---|---|
| `isSecureContext` | `true` |
| B — Permissão `getUserMedia` (fake) | **OK** ("Sucesso — track: ...") |
| E — PCM 16k mono (1 s de mic) | **OK** (`pcmSamples: 12288`) |
| F — Load Vosk PT-BR | **OK** (modelo carregado em **5452 ms**) |
| G — Transcribe | **OK** — `status: EMPTY`, `inferenceMs: 792`, `rtf: 1.031` (tol sintético não gera palavras — caminho "transcrição vazia" correto) |
| Console errors | **0** |

Limitante honesto: a validação de microfone real (fala humana e browser com mic físico) exige o teste
manual Android/desktop do Anexo A.

---

## 11. Android Validation

**NÃO TESTADO — dispositivo físico não disponível neste ambiente.** É o único critério pendente
(§17). O checklist exato do sprint está no Anexo A. Ao executá-lo, atualizar este item para
`TESTADO (data)` e promover a classificação para `PASS — VOICE INTEGRATED`.

Observação: o pipeline (ScriptProcessorNode, AudioContext com sample rate real, resample para 16 kHz,
Worker clássico) é o mesmo padrão do lab e de `capture.ts`, já compatível com Web Audio em Android/WebView
quando em contexto seguro.

---

## 12. Regression Tests

Automático: `npx vitest run` → **17 arquivos / 258 testes PASS** (243 pré-existentes + 15 do
controller). `npx tsc --noEmit` 0 erros. `npm run build` PASS.

Estático (nada foi tocado): pipeline HTTP (`/api/nutri-assistant/patient|admin`), streaming NDJSON,
`runExchange`, histórico, `sanitizeInput`, `MAX_MESSAGE_LENGTH`, Supabase `createClient`, avatar/humor,
ações rápidas, anexo de imagem — sem alterações. A voz não envia, não duplica, não substitui nenhum
passo: `handleSend`/`ask`/`retry` permanecem idênticos.

Teste manual de regressão do chat (Anexo B) continua recomendado para confirmar streaming/erro/histórico
no fluxo real autenticado.

---

## 13. Performance

Dados observados nesta sprint (lab, Chromium real, fake mic; dispositivo de produção não registrado):

| Métrica | Valor |
|---|---|
| Model load time | **5452 ms** (esta rodada); dev/prod R4: 7447/4954 ms |
| Recording duration (teste desktop) | ~1 s (conforme click de E) |
| Inference time (PCM vazio/tom) | **792 ms** |
| RTF (teste vazio) | 1,031 |
| Transcription length | 0 (tom sintético) |

Transcrição real humana: referência VOZ-004-R4 (12 s de fala, inferência ~5,2 s, RTF ~0,43).
Benchmark não é objetivo desta sprint.

---

## 14. Risks

| # | Risco | Mitigação |
|---|---|---|
| 1 | **Validação Android físico não realizada** (único critério pendente) | Executar Anexo A; em caso de falha mobile, tratar como bloco próprio. |
| 2 | `dispose()` chamado no unmount encerra o Worker/modelo → reabrir o chat recarrega o modelo (~5-8 s) | Comportamento intencional (libera memória); aceitável para o fluxo atual. |
| 3 | `setInput(transcrição)` **substitui** o texto que o usuário estivesse digitando | Trancode substitui para evitar mistura; se indesejado, trocar por concatenação (decisão de produto). |
| 4 | Voz online-first (modelo não pré-cacheado) — offline usa texto | Documentado (§9); runtime cache do modelo fica para sprint futura. |
| 5 | Vosk não produz partial/streaming — sem feedback de palavra a palavra | UI usa indicador "Gravando/Transcrevendo"; aceitável. |
| 6 | `Model.terminate()` enquanto houver reconhecedor ativo pode falhar | Só chamado em dispose (fora de transcrição); envolto em try/catch. |
| 7 | Remoção do `vosk-model-small-pt-0.3.zip` (30,9 MB) | Fonte remota original preservada (URL de referência em `vosk.ts`); recarregável se necessário. |

---

## 15. Non-Changes

- Não removido `/dev/voice-test` (apenas corrigidos textos obsoletos).
- Não removido Moonshine de `package.json`; engine `moonshine-tiny` segue registrada.
- Não criado `/api/stt`; nenhuma alteração em backend, Gemini/OpenAI, RAG, guardrails, Supabase,
  streaming NDJSON, Serwist/PWA, `next.config.ts`, `sw.ts`.
- Não implementado auto-send (a voz só preenche o input).
- Sem redesign do ChatAssistant (edição apenas no compositor + feedback inline).
- Sem fallback remoto; sem upload de áudio em nenhum cenário.
- Modelo não duplicado; pipeline Vosk não duplicado; ZIP legado removido por auditoria (VOZ-005 §11/§13).

---

## 16. Final Classification

> **PASS WITH RISKS — integração funcional; validação manual Android pendente de dispositivo físico.**

A definição de sucesso do sprint está implementada na camada de código: o usuário fala, o Vosk transcreve
localmente, o texto aparece no input normal, o usuário corrige e envia pelo fluxo existente — com o
restante do sistema intacto (CI 100% verde; validação desktop de mic em Chromium real; 0 erros de
console; 0 uploads de áudio).

**Risco único pendente:** teste manual em Android físico (Anexo A). Após executá-lo com sucesso,
promover para `PASS — VOICE INTEGRATED`.

---

## Anexo A — Teste Manual Android (obrigatório antes de PASS)

Após `npm run dev` (ou build+start) em contexto seguro (HTTPS ou localhost):

1. Abrir ChatAssistant → tocar o microfone;
2. Conceder permissão de microfone;
3. Falar frase curta em português;
4. Verificar transcrição no campo de texto;
5. Editar o texto;
6. Enviar (fluxo normal do chatbot funciona);
7. Parar/cancelar (toque no `Square`/`X` durante gravação);
8. Repetir pelo menos 3 vezes.

Testar também: negar permissão (mensagem "Permissão de microfone negada..."); iniciar/parar rápido
(transcrição vazia → "Nenhuma fala detectada..."); segunda e terceira transcrições consecutivas
(``engine READY`` reutilizada); troca de tela/unmount durante gravação (mic liberado).

## Anexo B — Regressão do chat (manuais, texto)

- Mensagem textual normal, streaming (NDJSON), erro + tentar novamente, loading, histórico (`slice(-6)`),
  autenticação — válidos como antes; nenhuma chamada HTTP foi modificada.