# TTS-INTEGRATION-003 — Chat TTS Integration — REPORT

> Status: **IMPLEMENTED — CHAT INTEGRATION READY** · Data: 2026-09-08 · Projeto: `vanzacariasnutri` (consumer) + `voice-synthesis` (engine, **UNCHANGED**) · `voice-transcription`/Vosk/Gemini/RAG/Supabase → **INTACTO**

---

## 1. Objetivo

Integrar o pipeline TTS-001/TTS-002 ao **Chat** (`ChatAssistant`), conforme a spec (seções 1–29, decisões D01–D37):

* preferência TTS **única** ON/OFF por usuário (localStorage), compartilhada por **Chat e Settings** (D04);
* autoplay da **última resposta válida** quando ativo (§10);
* interrupção por **nova interação**, **invalidate** (§11/§13);
* player **Play/Pause/Resume/Replay** (transporte D10–D13/D22);
* texto falável **determinístico** (D15–D18), gate ≥ 4 palavras;
* erros **não desativam** o TTS (§19).

## 2. Arquitetura implementada

```
ChatAssistant (client component, 'use client')
   │  useChatTts (React hook, useSyncExternalStore)
   │     │  cria ChatTtsController (framework-agnostic)
   │     │     ├─ preference.ts  (localStorage tts_enabled:<userId>)
   │     │     ├─ speakable.ts   (buildSpeakable: gate ≥4 palavras)
   │     │     └─ orchestrator.ts (estados/transporte)
   │     │           ├─ synthesizer.ts (dynamic import voice-synthesis)
   │     │           └─ player.ts (AudioContext / fake p/ testes)
   │     └─ UI: botão único do header + ícones lucide
   └─ Settings (perfil/page.tsx): toggle ON/OFF — MESMA fonte de verdade
```

O engine (`voice-synthesis`) **não conhece** Chat/React/Supabase/Gemini/Vosk. A preferência é um external store puro; o Chat e o Settings leem **o mesmo** `subscribeTts`/`getTtsSnapshot`.

## 3. Módulos novos (src/lib/tts)

| Arquivo | Papel |
|---|---|
| `speakable.ts` | `prepareSpeakableText` / `countSpeakableWords` / `isSpeakableEligible` / `buildSpeakable` + `MIN_WORDS=4` |
| `preference.ts` | external store: `getTts/setTts/setTtsUser/subscribeTts/getTtsSnapshot/getTtsStorageKey/ttsPreferenceDebugReset` |
| `player.ts` | `createAudioPlayer` (Web Audio) + `createFakeAudioPlayer` (+ tipo `FakeAudioPlayer`) — transporte pause/resume/replay, sessão com promise única |
| `orchestrator.ts` | estados `IDLE/LOADING/SYNTHESIZING/PLAYING/PAUSED/ENDED/ERROR/DISPOSED`, `getTransport()`, `pause/resume/replay/subscribe`, anti-race via `gen` |
| `chatTtsController.ts` | `createChatTtsController({ orchestrator? | createOrchestrator? })` p/ testes; ciclo do botão único D23–D27 |
| `useChatTts.ts` | hook `'use client'` (lazy factory do orchestrator); retorna `{ ui, toggle, replay, stop, setEnabled, noteResponse, invalidate }` |
| `stubs/empty.ts` | stub do engine nativo para o webpack do **bundle cliente** |

## 4. Preferência única (D04–D06)

* Chave `localStorage`: `tts_enabled` (fallback) ou `tts_enabled:<userId>` quando a sessão é conhecida.
* `setTtsUser(userId)` troca a chave ativa; **Chat e Settings** leem o mesmo store → toggle reflete instantaneamente nos dois lugares.
* Sem Supabase/banco; sem sincronização entre dispositivos (escolha da spec).
* `useSyncExternalStore` com snapshot cacheado → hydration SSR segura.

## 5. Texto falável (D15–D18)

* `buildSpeakable(markdown)` → `{ prepared, eligible }`.
* **Gate:** palavra = unidade `\w+` (com acentos); resposta só fala com **≥ 4 palavras** (`MIN_WORDS`).
* **Regras de CPD:** listas/cabeçalhos/tabelas viram unidades de frase com "."; parágrafos comuns **mantêm a pontuação original** (spec: "Dieta adequada" sem ponto); injunjões removidas (bloco de código/fences); URLs/emails/emoji removidos; sólidos (`,` `;` `:` `…` `!` `?`).
* Números/unidades **não** são expandidos — normalização numérica permanece responsabilidade do engine (fora do escopo deste sprint).

## 6. Controller (D23–D27)

**Ciclo do botão único do Chat:**

```
OFF ──toggle──► ON+autoplay (se target elegível)
               PLAYING ──toggle──► PAUSED ──toggle──► RESUME (ponto exato)
               ENDED ──toggle──► REPLAY (mesmo áudio, sem nova síntese §11/D22)
               IDLE/ERROR ──toggle──► Replay (se target) senão OFF
               LOADING/SYNTHESIZING ──toggle──► (busy: ignora)
```

* `noteResponse(markdown)`: resposta concluída → `buildSpeakable`; elegível e ON → fala (§10). **Mesmo texto já concluído → replay**, não re-sintetiza (§11).
* `invalidate()`: nova interação → `orch.stop()` (§11/§13).
* `stop()`: ao sair/fechar o chat (§12) e no dispose (§14).
* **Erros não desativam** o TTS (§19): fase `error` reflete no botão, `enabled` permanece.

## 7. Integração no ChatAssistant

* Hook `useChatTts()` alimenta `ui`/`toggle`/`stop`/`noteResponse`/`invalidate`.
* `noteResponse` chamado **apenas em conclusão de resposta**: frame `done` (stream paciente), `data.reply` não-stream (paciente e admin).
* `invalidate` no início de `runExchange` (paciente) e `handleSend` (admin).
* `setTtsUser(session.user.id)` ligado à sessão (efet de montagem); `stop()` ao fechar o chat.
* Botão de TTS no header **somente para paciente** (`!isRoleAdmin`), com `aria-label` dinâmico e ícones `Play / Pause / Volume2 / VolumeX / RotateCcw`.

## 8. Settings (perfil)

`src/app/dashboard/perfil/page.tsx`: card "Leitura das respostas (voz)" com toggle `role="switch"` ligado à **mesma** `subscribeTts`/`getTtsSnapshot`/`setTtsEnabled`. `setTtsUser(session.user.id)` no `loadProfile` → chave por usuário idêntica à do Chat.

## 9. Build — binário nativo (.node) e webpack

**Problema:** `voice-synthesis` depende de `onnxruntime-node`, que carrega binários nativos `onnxruntime_binding.node`. O webpack tenta **parsear** o binário em qualquer camada do App Router (server RSC inclui o gráfico das páginas; client incluía o chunk do dynamic import), falhando com `Module parse failed`.

**Solução em `next.config.ts`:**

* `serverExternalPackages: ["voice-synthesis", "onnxruntime-node"]` → no servidor o pacote continua **externo** (Node carrega os `.node` em runtime).
* `webpack(config)`: alias de `voice-synthesis`, `voice-synthesis/dist/src/index.js` e `onnxruntime-node` → `src/lib/tts/stubs/empty.ts` **em todas as camadas**. O engine não entra no bundle cliente (síntese em browser = limitação conhecida); erros degradam com segurança (§19).
* Ajuste no controller: **nenhum import direto de `synthesizer`** no `chatTtsController.ts` — a criação lazy do orchestrator é injetada via factory (hook), mantendo código-split limpo e o controller 100% testável.

**Resultado:** `npm run build` **PASS** (27/27 rotas estáticas, exit 0).

## 10. Teste obrigatórios

| Suíte | Arquivo | Testes |
|---|---|---|
| Speakable (D15–D18) | `speakable.test.ts` | 28/28 |
| Preference (D04–D06) | `preference.test.ts` | 10/10 |
| Player transporte (D10–D13/D22) | `player.test.ts` | 10/10 |
| Orchestrator + transporte (T01–T15) | `ttsOrchestrator.test.ts` | 15/15 |
| Chat TTS Controller (T20–T31) | `chatTtsController.test.ts` | 12/12 |
| Consumer boundary (TTS-001) | `ttsConsumer.test.ts` | 5/5 |
| **Total TTS** | | **80/80** |

Regressões completas no `vanzacariasnutri`:

* `npm run test` → **37 files, 552 tests PASS**
* `npm run typecheck` (`tsc --noEmit`) → **clean**
* `npm run build` → **PASS**
* `npm run lint` → `src/lib/tts` e alterações do sprint **0 problemas** (erros pré-existentes fora de tts mantidos intactos)

## 11. Limitações conhecidas

* **Síntese no browser:** o engine usa `onnxruntime-node` (Node). O bundle cliente usa o stub; em produção o browser provavelmente não sintetiza e o erro degrada silenciosamente (§19). O pipeline de UI/player/estado funciona independente da síntese.
* **Validação física do áudio:** sem ambiente de gravação neste projeto — marcado **BLOCKED**; a reprodução real precisa de validação manual com dispositivo de áudio.
* **Fragmentos do player:** todo o transporte foi coberto por testes unitários com fake player; audição em AudioContext real não validada manualmente.

## 12. Arquivos alterados

**Criados:** `src/lib/tts/{speakable,preference,chatTtsController,useChatTts}.ts`, `src/lib/tts/stubs/empty.ts`, `src/lib/tts/__tests__/{speakable,preference,player,ttsOrchestrator,chatTtsController}.test.ts`.

**Modificados:** `src/lib/tts/{player,orchestrator,index,synthesizer,types}.ts`, `src/components/ChatAssistant.tsx`, `src/app/dashboard/perfil/page.tsx`, `next.config.ts`, `package.json` (scripts `test`/`typecheck`).

**Não alterados:** `voice-synthesis`, `voice-transcription`, `src/lib/voice`, Gemini, RAG, Supabase, Vosk.

---

*Gate: Chat assistido por voz (toggle ON/OFF por usuário, autoplay, interrupção, transporte Play/Pause/Resume/Replay, gate ≥4 palavras) integrado ao Chat e refletido no Settings — **TTS-INTEGRATION-003 COMPLETO**, pendente apenas validação auditiva em device real.*