# VOZ-005 — AUDITORIA DE INTEGRAÇÃO VOSK PT-BR

> Sprint de **auditoria apenas** — sem implementação. Objetivo: determinar, com evidência de código,
> como integrar o runtime Vosk PT-BR (já funcional no lab `/dev/voice-test` desde VOZ-004-R4)
> ao produto principal **sem alterar o comportamento do ChatAssistant**.

- Data: 2026-09-04
- Branch: `main` (HEAD `d72c6a7`)
- Status: **PASS — READY FOR INTEGRATION** (com riscos documentados)

---

## 1. Executive Summary

O runtime Vosk PT-BR está **maduro e verificado** — carrega modelo local (~31 MB) em browser e
transcreve áudio pt-BR real em ~5,2 s para 12 s de áudio (RTF ~0,43, ~2,3× em tempo real), em
`/dev/voice-test`, **sem nenhum `/api/stt` e sem upload de áudio** (evidência VOZ-004-R4, §3).

A auditoria confirma:

1. **A única superfície de integração é o compositor do chat** (textarea + anexo + enviar). Todo o
   HTTP do chat passa por `runExchange` → `/api/nutri-assistant/patient` ou `/api/nutri-assistant/admin`.
   Um microfone apenas precisa injetar texto no `input` (ou chamar `ask`/`runExchange`) — **nenhuma
   mudança nos backend, guardrails, streaming, Supabase ou histórico é necessária** (§9).
2. **Nenhum módulo de voz é importado pelo ChatAssistant hoje** — `src/lib/voice/**` só é consumido
   por `src/app/dev/voice-test/page.tsx` e testes. Não há acoplamento que precise ser removido (§9).
3. **A camada de abstração já existe e é mínima**: `registry.ts` (engines), `engineState.ts`
   (máquina de estados), `engines/*` (wrappers), `audio/capture.ts` (mic→PCM 16 kHz mono),
   `metrics.ts` (WER/CER/RTF). Pode ser reutilizada integralmente na integração (§4, §14).
4. **Riscos identificados (não bloqueiam)**: (a) `dispose()` do wrapper Vosk não encerra o
   Worker/modelo (`model.terminate()` não é chamado) — memória do modelo permanece residente após
   dispose, mitigada por singleton e página única; (b) textos de ajuda no lab (`page.tsx:498/539/568`)
   ainda descrevem o erro de bundling do Vosk como "esperado/não corrigido", contradizendo o runtime
   corrigido na R4 — drift de UI/documentação, corrigível no VOZ-006; (c) o chunk do Vosk (5,79 MB)
   não é precacheado pelo PWA e o modelo (~31 MB) também não — voice offline-first exigiria
   estratégia própria; (d) `public/vosk-model-small-pt-0.3.zip` (30,9 MB) é duplicata não usada pelo
   runtime (§13).

**Classificação final: PASS — READY FOR INTEGRATION.**

---

## 2. Repository State

Evidência `git status --short` (auditoria, sem commits novos):

```
 M docs/VOZ-002-REPORT.md
 M package-lock.json
 M package.json
 M src/app/dev/voice-test/page.tsx
 M src/lib/voice/stt/moonshine.ts
?? docs/VOZ-003-R1-REPORT.md
?? docs/VOZ-003-REPORT.md
?? docs/VOZ-004-REPORT.md
?? public/moonshire.wav
?? public/voice-benchmark/
?? public/vosk-model-small-pt-0.3.tar.gz
?? public/vosk-model-small-pt-0.3.zip
?? scripts/
?? src/lib/voice/__tests__/engineState.test.ts
?? src/lib/voice/__tests__/metrics.test.ts
?? src/lib/voice/__tests__/registry.test.ts
?? src/lib/voice/metrics.ts
?? src/lib/voice/stt/engineState.ts
?? src/lib/voice/stt/engines/
?? src/lib/voice/stt/registry.ts
?? src/lib/voice/stt/vosk.ts
```

- Histórico VOZ: apenas **1 commit** (`d72c6a7 feat: VOZ-002: add isolated Android voice diagnostic probe`).
- Todo o trabalho VOZ-003 / VOZ-004 (R1, R3, R3.1, R4) está **não commitado** (docs + código de voz
  untracked; `page.tsx`, `package.json`, `moonshine.ts`, `docs/VOZ-002-REPORT.md` tracked-modificados).
- **Divergência doc-vs-código relevante**: os relatórios VOZ-003/004 descrevem correções e verificações
  que só existem no working tree; o histórico Git não reflete o estado atual do produto de voz.
  Registrar commit consolidado de voz no VOZ-006.

---

## 3. VOZ-004-R4 Verification (evidência reaproveitada, sem re-executar)

Métricas reais em Chromium headless (verificação da R4, dev `next dev` porta 3000 e prod `next start`
porta 3123), com `playwright-core@1.62.0`:

| Métrica | dev | prod |
|---|---|---|
| F → READY (load modelo) | 11,8 s (7447 ms modelo) | 8,7 s (4954 ms modelo) |
| G → RESULT (inferência 12 s áudio) | 6,2 s | 6,2 s |
| Inferência pura | 5182 ms | 5313 ms |
| RTF | 0,432 | 0,443 |

- Transcrição real pt-BR: `"aqui você preparar seus roteiros com segurança e clareza o poder da fé a fé é o firmen fundamento das coisas que se esperam"` (122 chars) — **vetor Ground Truth `moonshire.wav`**.
- Fixture `public/moonshire.wav` = 2.301.962 bytes (11,99 s, 44,1 kHz → 16 kHz monocanal).
- Modelo `public/vosk-model-small-pt-0.3.tar.gz` = 30,9 MB, servido localmente, buscado pelo Worker
  (GET same-origin, `application/gzip`).
- Network: apenas GETs locais (página, chunks, modelo); **0 POST de áudio**; sem erros de console/page.
- Pré-fix repro `verify-prod.js`: F → ERROR exato `Failed to resolve module specifier 'vosk-browser'`,
  sem requisição de modelo, G desabilitado (máquina de estados funcionando antes mesmo da correção).

---

## 4. Vosk Architecture Audit

### 4.1 Runtime (`src/lib/voice/stt/vosk.ts`)

- Instalado `vosk-browser@^0.0.8`. Pacote é **UMD autocontido** (`dist/vosk.js`, 5.794.767 bytes):
  sem `require()`/`process.`/`window.`/`navigator` em nível raiz; **classic Worker** criado a partir
  de script base64 inline + `Blob URL` (`createBase64WorkerFactory`); WASM Kaldi embutido no Worker.
- `loadVoskModel(modelId = 'small-pt-0.3', onProgress?)` (`vosk.ts:57`): `new Vosk.Model(url)` com
  eventos `load`/`error` + timeout de 120 s (evita a rejeição silenciosa do `createModel`);
  singleton module-level `cachedModel`/`cachedNS` (`vosk.ts`).
- `transcribeWithVosk(pcm, sampleRate, model)` (`vosk.ts:84`): cria KaldiRecognizer com
  `acceptWaveformFloat(pcm, sampleRate)` (API oficial comfirmada), escuta evento `result`, usa
  `retrieveFinalResult()`, guarda de 30 s e chama `recognizer.remove()`.
- **Falta de `model.terminate()` no dispose** (ver §6/§7).

### 4.2 Wrapper de engine (`src/lib/voice/stt/engines/vosk.ts`)

- Interface `STTEngine`: `load` → `loadVoskModel('small-pt-0.3')`; `transcribe` → `transcribeWithVosk`
  (com auto-load se necessário) + `inferenceMs`; `dispose` → apenas `cachedModel = null`
  (`engines/vosk.ts:26-28`); `isSupported` → `WebAssembly && Worker`.
- Interface `STTResult` em `registry.ts:6-11` (`text`, `inferenceMs?`, `modelLoadMs?`, `metadata?`).

### 4.3 Registry (`src/lib/voice/stt/registry.ts`)

- `STT_ENGINES` registra `'vosk-pt-br'` (Vosk PT-BR) e `'moonshine-tiny'` (preservado) — ponto único
  de registro (`registry.ts:29-32`); `getEngine`/`listEngines` (`registry.ts:34-39`). Moonshine
  permanece para compatibilidade; não é usado como fallback do Vosk neste momento.

### 4.4 Máquina de estados (`src/lib/voice/stt/engineState.ts`)

- Estados: `IDLE | LOADING | READY | TRANSCRIBING | RESULT | ERROR`; ações `LOAD_START/SUCCESS/ERROR`,
  `TRANSCRIBE_START/SUCCESS/ERROR`, `ENGINE_CHANGE`, `RESET`.
- Guards `canLoad` (IDLE/ERROR/READY/RESULT) e `canTranscribe`/`isEngineReady` (READY/RESULT) —
  **reutilizáveis na integração**; já exercitados por 17 testes unitários.

### 4.5 Captura (`src/lib/voice/audio/capture.ts`)

- `captureAudio(targetSampleRate = 16000)` (`capture.ts:42`) com constraints `echoCancellation:false,
  noiseSuppression:false, autoGainControl:false, channelCount:1`; lê `MediaTrackSettings` reais (não
  assume que o browser respeitou), cria `AudioContext` na taxa real e expõe `cleanup()` que para tracks
  e fecha o contexto (`capture.ts:89-92`). Ajudantes `floatTo16BitPCM` (`:119`) e `resampleTo16k`
  (`:128`) — prontos para produção.

### 4.6 Métricas (`src/lib/voice/metrics.ts`)

- `normalizeText`, `computeWER`, `computeCER`, `computeRTF` — prontos para monitorar qualidade da
  transcrição na integração (sem benchmarking nesta sprint).

---

## 5. Client/Server Boundary

- **Voz = 100% client-side.** `src/lib/voice/**` não é importado por nenhum Server Component nem por
  rota `/api`. `vosk.ts` usa `import('vosk-browser')` explícito no cliente (correção R4); `moonshine.ts`
  guarda `typeof window` para SSR.
- Build confirma: `/dev/voice-test` é **`○` estático** (prerenderizado). Nenhuma rota nova; **não existe
  `/api/stt`** no build (28 rotas listadas, nenhuma de voz).
- O webpack resolve o Vosk como **chunk dinâmico** `/_next/static/chunks/9cb48f3a.9b65b6a08a534e7d.js`
  (5,79 MB), carregado apenas quando o módulo de voz é importado pela primeira vez — download
  on-demand, sem impacto no bundle inicial do `/`.
- `next.config.ts` não tem qualquer configuração de voz (nada a remover/ajustar para a integração).

---

## 6. Worker/WASM Lifecycle

- Ao `new Vosk.Model(url)`, `vosk-browser` cria **Worker clássico** (base64 → `Blob URL`, mesmo origin)
  e, dentro dele, instancia o runtime Kaldi WASM;
- o Worker então **busca** `/vosk-model-small-pt-0.3.tar.gz` (30,9 MB) e descompacta em runtime;
- o reconhecedor é criado **por transcrição** (`KaldiRecognizer`) e finalizado com `remove()`;
- o modelo e o Worker **persistem entre transcrições** (singleton `cachedModel` module-level) → gains
  de latência em interações subsequentes;
- **encerramento:** não há chamada a `Model.terminate()` (existe em `model.d.ts` do pacote) em
  `engines/vosk.ts:26-28` — o Worker/modelo só morrem via GC da página. No lab é aceitável (página
  única); na integração, decidir estratégia (reuso entre sessões de chat vs dispose explícito ao fechar).

---

## 7. Memory Analysis (estática)

| Item | Análise |
|---|---|
| Modelo | 30,9 MB (tar.gz). Gráfico do modelo permanece em memória do Worker enquanto `cachedModel` viver (singleton). |
| Worker | Um único Worker (clássico) por page. WASM Kaldi embutido. |
| AudioContext/Mic | `capture.ts:89-92` para tracks + fecha contexto; lab também fecha no `runCleanup` de `page.tsx`. |
| Reconhecedor | Criado por transcrição; `remove()` no `finally` de `transcribeWithVosk`. |
| **Gap** | `dispose()` do wrapper Vosk não encerra Worker/modelo (`model.terminate()` ausente). Risco baixo no lab; **deve ser resolvido na VOZ-006** com `dispose()` → `cachedModel?.terminate?.()` + null das caches module-level. |

Transcrições acumuladas não são persistidas (resultado apenas em memória do componente; lab exibe sem
gravar). Nenhum histórico de áudio é mantido.

---

## 8. PWA / Serwist Analysis

- `next.config.ts:5-11` (Serwist): `swSrc: "src/sw.ts"`, `swDest: "public/sw.js"`,
  `disable` fora de produção, **`maximumFileSizeToCacheInBytes: 5242880` (5 MB)**.
- `src/sw.ts`: `defaultCache` (runtime), `skipWaiting`, `navigationPreload`; ouvintes push/notification
  preservados.
- **Impacto voz:**
  - Chunk Vosk 5,79 MB > 5 MB → **não pré-cacheado** (warning real do build):
    `/_next/static/chunks/9cb48f3a.9b65b6a08a534e7d.js is 5.79 MB, and won't be precached`.
  - Modelo tar.gz + zip (30,9 MB c/u) > 5 MB → **não pré-cacheados**; modelo é buscado por rede no
    primeiro load do Worker (o fetch same-origin do Worker passa pelo SW e pode cair no runtime cache
    `defaultCache` em re-visitas — comportamento não testado nesta auditoria).
  - `moonshire.wav` (2,2 MB) < 5 MB → seria pré-cacheado (lab).
- **Recomendação VOZ-006:** não mexer na config hoje. Para voice offline-first, avaliar elevar o limite
  + runtime cache específico do modelo, OU aceitar voz apenas online (texto segue online de qualquer
  forma). Documentar decisão.

---

## 9. ChatAssistant Integration Analysis

Anatomia dos 839 linhas de `src/components/ChatAssistant.tsx` (nada modificado nesta auditoria):

- **Compositor** (`:772-831`): storage com botão de anexo (`:774-782`, `ImagePlus`), `textarea`
  (`:792-813`), botão enviar (`:815-830`, `Send`). `state.isLoading` desabilita tudo.
- **Estado** (`useChatState`, `:162-190`): `input`, `setInput`, `messages`, `isLoading`, `selectedImage`,
  `retryCandidate`, `streamingText`. **É aqui que o texto transcrito entra** — bastará `setInput(transcrito)`
  (edição prévia pelo usuário) ou chamada direta a `ask(transcrito)`.
- **Envio** (`handleSend` `:525-532` → patient `runExchange` `:261-394` / admin `:404-489`): único fluxo.
  Sanitização (`sanitizeInput`, `:84`), limite `MAX_MESSAGE_LENGTH = 500` (`:88`) e histórico `slice(-6)`
  aplicam-se igualmente ao texto transcrito — **nenhuma exceção necessária**.
- **Sem voz hoje:** nenhum import de `voice/**`, nenhum `useState` de mic, nenhum `getUserMedia`.
  (Grep em `src/` confirma: `voice/stt|vosk-browser|getMoonshineRuntime|moonshine` só ocorre no lab +
  testes + lib.)

### Ponto de integração proposto (sem implementar)

```
[Botão mic no composer (ChatAssistant)]          [Camada de voz reutilizada]
└─ opcional: prop enableVoice (default false)     ├─ VoiceInputController (administra estado/cleanup)
   └─ onTranscript(committed) ──────────────────► ├─ STTEngine (registry → vosk-pt-br)
                                                   └─ capture.ts (mic → PCM 16k mono)
                                             ↓
                                      texto entra em state.input ou patientLogic.ask()
                                             ↓
                    runExchange → /api/nutri-assistant/patient|admin (fluxo existente intocado)
```

**Regra de blindagem:** a camada de STT **não conhece** Gemini/OpenAI/Supabase/RAG/streaming/guardrails;
ela só produz texto. Todo o restante já existente (sanitize, limite de 500, histórico, sessão, streaming)
permanece como fonte de verdade da mensagem.

---

## 10. Privacy Analysis

- **Fase AUDIO (LOCAL):** mic → PCM Float32 em memória → Vosk (Worker local) → texto. **Nenhum áudio
  sai do dispositivo**: sem `/api/stt`, sem POST de áudio (verificado em dev e prod, §3), modelo 100%
  local (`/public/vosk-model-small-pt-0.3.tar.gz`).
- **Fase TEXTO (CHAT NORMAL):** o texto transcrito entra no fluxo normal do chat e **é enviado ao
  backend** (`/api/nutri-assistant/...`) junto com o histórico, exatamente como texto digitado.
- **Conclusão honesta: NÃO se deve declarar "100% local" para o fluxo completo.** É possível afirmar
  que: (a) o processamento de voz (áudio→texto) é 100% local; (b) o texto resultante segue as mesmas
  proteções/destinos do texto digitado. Material de produto deve usar esta redação.

---

## 11. Dependency Analysis

| Dependência | Versão | Classificação | Justificativa |
|---|---|---|---|
| `vosk-browser` | `^0.0.8` | **KEEP** | Runtime do STT; pacote UMD estável; verificado em dev/prod real. |
| `@moonshine-ai/moonshine-js` | `^0.1.29` | **REMOVE LATER** | Preservado por compat. (regras da sprint); sem pt-BR; não é caminho da integração. Carga via CDN opcional + pacote — candidato a sair quando VOZ-006 consolidar. |
| `lucide-react` | `^0.577.0` | KEEP | Ícones existentes (incluir `Mic` na integração, já disponível no pacote). |
| `@serwist/next` / `serwist` | `^9.5.7` | KEEP | PWA existente; sem mudança neste sprint. |
| `typescript` / `vitest` | `^5` / `^4.1.10` | KEEP | Tooling; base de 243 testes. |
| Modelos/assets `public/` | tar.gz 30,9 MB; zip 30,9 MB; wav 2,2 MB | **KEEP tar.gz/wav; zip UNKNOWN (duplicata)** | Runtime usa apenas tar.gz; `.zip` é artefato legado (30,9 MB) não referenciado — avaliar remoção no VOZ-006. |

---

## 12. Test/Build Status

Executado nesta auditoria (sem preparação extra):

- `npx tsc --noEmit` → **PASS** (0 erros).
- `npx vitest run` → **PASS** — 16 arquivos / 243 testes (17 do engineState + 6 do registry + WER/CER +
  lab).
- `npm run build` → **PASS** — 28 rotas; `/dev/voice-test` `○` estático; nenhuma rota `/api/stt`;
  warning único conhecido: chunk Vosk 5,79 MB não pré-cacheado (PWA, §8).
- Suite de voz atual: `__tests__/engineState.test.ts`, `registry.test.ts`, `metrics.test.ts`,
  `voice.test.ts` — cobrem estado/registry/métricas; **não** cobrem integração (proibida nesta sprint).
  Testes de integração (mock de engine → textarea) pertencem ao VOZ-006.

---

## 13. Risks

| # | Risco | Severidade | Mitigação (VOZ-006) |
|---|---|---|---|
| 1 | `dispose()` não chama `model.terminate()`; Worker/modelo residentes após dispose | Baixa (lab), Média (prod) | Adicionar `cachedModel.terminate()` + limpeza de caches module-level no dispose; decidir política de ciclo de vida do chat. |
| 2 | Textos do lab contradizem o runtime: `page.tsx:498` ("vosk-browser bundling está bloqueado nesta sprint"), `:539`/`:568` (erro `Failed to resolve module specifier` como causa esperada) — drift pós-R4 | Baixa (UX dev) | Atualizar os hints do lab para refletir o runtime corrigido. |
| 3 | Chunk Vosk 5,79 MB + modelo 30,9 MB fora do precache; voz offline-first não garantida | Baixa/Média | Decidir estratégia PWA (runtime cache do modelo ou voz só online). |
| 4 | `public/vosk-model-small-pt-0.3.zip` (30,9 MB) duplicata não usada pelo runtime | Baixa | Remover no VOZ-006 (após confirmar que nada referencia). |
| 5 | Worktree VOZ-003/004 não commitado; docs divergem do histórico Git | Média (revisibilidade) | Commit consolidado de voz no início do VOZ-006. |
| 6 | `MAX_MESSAGE_LENGTH=500` e `sanitizeInput` limitam texto transcrito (frases longas podem ser truncadas/rejeitadas) | Baixa | Experiência igual ao texto digitado; aceitável. |
| 7 | VAD/streaming parcial: Moonshine suporta partial, Vosk não (nesta integração) | Baixa | Não exibir feedback parcial de voz; usar indicator simples (Rec…). |

---

## 14. Recommended VOZ-006 Architecture

### 14.1 Arquivos

**Reutilizar (sem mudar):**
- `src/lib/voice/stt/vosk.ts`, `.../stt/engineState.ts`, `.../stt/registry.ts`, `.../stt/engines/vosk.ts`
- `src/lib/voice/audio/capture.ts`, `src/lib/voice/metrics.ts`
- `public/moonshire.wav`, `public/vosk-model-small-pt-0.3.tar.gz`
- Os testes de voz existentes.

**Criar:**
- `src/components/chat/VoiceInputController.tsx` (ou `src/lib/voice/integration/`) — controlador:
  lazy-import do Vosk só no 1º toque no mic; `engineState`; captura → PCM → `transcribe`;
  `dispose` ao fechar chat; estados `idle|loading|ready|recording|transcribing|error|unsupported`.
- Botão mic reutilizável (componente pequeno) com props `disabled` (quando `state.isLoading`) e
  `onTranscript(text)`.

**Modificar (mínimo, cirúrgico):**
- `src/components/ChatAssistant.tsx`: renderizar o botão mic no compositor (junto a `ImagePlus`, linha ~774)
  **atrás de prop `enableVoice` opcional (default `false`)** e ligar `onTranscript` → `setInput(committed)`
  (usuário confirma antes de enviar) — preservando 100% do fluxo existente.
- `page.tsx`: atualizar os hints do lab (risco 2).

**NÃO modificar:**
- `/api/nutri-assistant/*`, Supabase, Gemini/OpenAI, RAG, guardrails, streaming NDJSON, `next.config.ts`,
  `sw.ts`, `package.json` (exceto adicionar `@types` se necessário), Moonshine.

### 14.2 Fluxo de dados

```
mic → captureAudio(16000) → PCM Float32 (memória)
    → engine.load() [se não READY] → transcribe(pcm, 16000) → { text, inferenceMs }
    → onTranscript(text) → ChatAssistant setInput(text)
    → usuário envia → runExchange (fluxo atual, sem alterações)
```

### 14.3 Ciclo de vida

- **Lazy-load:** chunk do Vosk só baixa no 1º toque em mic (evita custo no bundle inicial).
- **Engine:** manter READY entre transcrições (singleton); bloquear re-load via `engineState`
  (`canLoad`/`canTranscribe`).
- **Dispose:** ao fechar o chat / desmontar, executar `capture.cleanup()` (tracks + AudioContext) e
  `engine.dispose()` — neste sprint **sem** `model.terminate()`; na VOZ-006, melhorar o dispose Vosk
  (risco 1).
- **Concorrência:** mic desabilitado enquanto `state.isLoading` (mesmo padrão do botão enviar).

### 14.4 Estratégias

- **Modelo:** local (`/vosk-model-small-pt-0.3.tar.gz`), on-demand, timeout 120 s (já implementado),
  indicador de progresso opcional. Sem CDN.
- **PWA:** manter config atual; decisão explícita voz online-first (recomendada) ou runtime cache do
  modelo offline (documentar na PR).
- **Mobile:** `capture.ts` já lida com sample rate real e cleanup; testar iOS Safari (WebAudio) e
  Android (exige overlay/HTTPS). Constraints 16 kHz mono preservadas.
- **Erro:** superfície via `engineState.ERROR`; mic mostra estado e permite retry F; mensagem amigável.
- **Fallback:** se `engine.isSupported()` falso (sem `WebAssembly`/`Worker`) → ocultar mic e manter
  texto. Sem fallback automático para Moonshine (idioma en→pt não é fallback válido).

---

## 15. Explicit Non-Changes

Nenhum arquivo foi modificado nesta auditoria. Confirmado por:
- `git status --short` idêntico antes/depois da sessão (nenhum novo `M`/`??`);
- `chatassistant.tsx` intocado (grep de `voice/**` no componente: 0 ocorrências);
- nenhum `/api/stt` criado, nenhum botão de mic criado, nenhuma rota nova;
- moonshine, fixture e modelo preservados; nenhum benchmark novo; nenhum teste de integração adicionado.

---

## 16. Final Classification

> **PASS — READY FOR INTEGRATION**

O runtime Vosk PT-BR está verificado em browser real (dev e prod), roda 100% local, sem `/api/stt`,
sem upload de áudio, com abstração pronta (registry + estado + engines + captura + métricas) e
superfície de integração conhecida e isolada no composer do chat. Os riscos (dispose incompleto, textos
de lab defasados, PWA offline, zip duplicado) são mitigáveis e **não bloqueiam** o início do VOZ-006.