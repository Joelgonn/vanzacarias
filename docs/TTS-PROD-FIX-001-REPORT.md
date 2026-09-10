# TTS-PROD-FIX-001 — Correção definitiva: Autoplay / AudioContext (sem som pós-resposta)

> Sprint de **correção** do ROOT CAUSE confirmado em TTS-PROD-AUDIT-001/002.
> **Nenhum commit/push/deploy foi executado** — aguardando autorização (regra do sprint).
> Período: sessão FIX-001 · Projeto `vanzacariasnutri` (web/PWA + Capacitor).

---

## 1. Causa corrigida

Antes: `play()` criava o `AudioContext` apenas no momento de tocar; se o contexto
nascesse `suspended` (autoplay sem gesto do usuário), o `resume()` era tentado com
`catch {}` (falha engolida) e `source.start()` rodava **incondicionalmente** →
nenhum sample renderizado, `onended` nunca disparava, orchestrator preso em
`PLAYING` e **silêncio sem nenhum sinal observável**.

Depois: o unlock vira uma etapa **explícita, idempotente e observável**, acionada
dentro de gestos reais do usuário, e `play()`/`resume()` **nunca mais tratam
`source.start()` como "tocando"** sem o contexto efetivamente `running`.

---

## 2. Arquivos alterados (somente camada de reprodução/auth do TTS)

| Arquivo | Papel na correção |
| --- | --- |
| `src/lib/tts/player.ts` | Núcleo: interface `AudioPlayer.unlock()` + `AudioUnlockResult`; `resolveUnlocked()` (fast-path síncrono quando `running`, `resume()` real quando `suspended`, nunca engole falha); `play()` **rejeita** se não desbloqueado (sem falso PLAYING/ENDED); `resume()` mantém `PAUSED` se bloqueado; `FakeAudioPlayer.unlock()`. |
| `src/lib/tts/orchestrator.ts` | `TtsOrchestrator.unlock()` — delega ao player, retorna o resultado real; propagado no objeto retornado. |
| `src/lib/tts/chatTtsController.ts` | `ChatTtsController.unlock()` — cria (lazy) o orchestrator se preciso e devolve `AudioUnlockResult \| null` (best-effort no gesto, sem engolir a falha). |
| `src/lib/tts/useChatTts.ts` | Hook expõe `unlock()` (callback estável) para a UI. |
| `src/components/ChatAssistant.tsx` | **Gesto (A):** `tts.unlock()` no início de todo envio do usuário (paciente: `runExchange` → `handleSend`/`ask`/`retry`; admin: `handleSend`) — **antes** de a resposta disparar o autoplay, sem depender da conclusão da resposta. **Gesto (B):** botão único de TTS chama `unlock()` ao **ativar** a leitura (clique real). |
| `src/lib/tts/__tests__/player.test.ts` | +10 testes FIX-P (unlock running/suspended/reject/stay-suspended/closed/idempotência/play bloqueado/fast-path/resume bloqueado/sem suporte). |
| `src/lib/tts/__tests__/ttsOrchestrator.test.ts` | +2 testes FIX-O (delegação ok / bloqueio propagado sem derrubar o orchestrator) + stub `failingPlayer.unlock`. |
| `src/lib/tts/__tests__/chatTtsController.test.ts` | +3 testes FIX-C (unlock independente da resposta; bloqueio → phase error observável com TTS ativo; recuperação após gesto → ENDED). |
| `src/lib/tts/__tests__/helpers/mockAudioContext.ts` | (novo) AudioContext falso com estado/resume controláveis para os cenários de política. |

Nenhuma alteração em Kokoro, pf_dora, Worker, ONNX, model download/CDN, Vosk,
Gemini, RAG, Supabase/Auth, transporte do Chat, arquitetura Capacitor, APK,
PWA/cache, UX do Chat, avatar ou lógica de síntese.

---

## 3. Mecânica do unlock

1. **`player.unlock()` / `ensureUnlocked()`** (público, sempre `Promise`):
   - contexto `running` → `{ ok: true, state: "running" }` sem chamar `resume()`;
   - contexto `suspended` → `await ctx.resume()` e retorna o **estado real** pós-promessa:
     `running` → ok; ainda `suspended` → `ok:false` com mensagem explícita;
     `resume()` rejeitou → `ok:false` com `NomeErro: mensagem` (não engole);
   - `closed`/indisponível → `ok:false` informativo; falha ao criar o contexto →
     `{ ok:false, state:"none", error }`.
2. **Fast-path interno** (`resolveUnlocked()`): quando o contexto **já está
   `running`**, play/resume seguem **síncronos** (sem microtask/await) — preserva o
   comportamento determinístico anterior (regressões de timing intactas).
3. **`play()`**: só cria o source depois de o contexto estar `running`. Se estiver
   bloqueado, **rejeita** com erro do unlock → orchestrator vai a `ERROR` (nunca
   falso `ENDED`) → controller mostra `phase: error` e **mantém o TTS ativado**
   (Chat continua utilizável — §19/D19).
4. **`resume()`**: se bloqueado, **permanece `PAUSED`** (sem recriar source no
   silêncio; a promise da sessão segue pendente para retomada futura).
5. **Propagação**: `ChatAssistant` (gestos A/B) → `useChatTts.unlock` →
   `controller.unlock` → `orchestrator.unlock` → `player.unlock`. O unlock **não
   depende** da resposta do Chat: roda no clique/toque de enviar ou de ativar TTS.
6. Sem autoplay artificial, sem síntese de fallback, sem segundo player, sem flag
   `--autoplay-policy=no-user-gesture-required`.

---

## 4. Testes e regressões

- **15 testes novos** (FIX-P1…P10, FIX-O1/O2, FIX-C1/C2/C3) — todos PASS.
- Suíte completa: **603 passed (603)** — 42 arquivos (588 anteriores + 15 novos).
- `npm run typecheck` (`tsc --noEmit`): **PASS**.
- `npm run build` (`next build --webpack`): **PASS** (28 páginas; apenas warnings
  pré-existentes de tamanho de precache no SW).
- `npx cap sync android`: **PASS** (assets web copiados; 1 plugin Capacitor).
- `assembleDebug` (APK): **PASS** — `app-debug.apk` = **95.856.556 bytes** (mesmo
  tamanho limpo da release: modelo/pf_dora/onnxruntime não entram no APK).

---

## 5. Validação Chromium real (política de autoplay PADRÃO — SEM flag)

Método: Chrome headless (versão instalada) **sem** `--autoplay-policy`; página
harness servida localmente que embala os **módulos reais** `player/orchestrator/
controller` (esbuild); gestos reais via CDP `Input.dispatchMouseEvent`.

Descoberta metodológica registrada: o Chrome concede ativação **sticky por origin**
— após o 1º clique real num origin, contextos seguintes têm autoplay liberado.
Por isso cada cenário "bloqueado" rodou num origin próprio `127.0.0.N` **sem
nenhuma interação prévia**, garantindo que o bloqueio é real e não resíduo de
ativação.

Resultado (evidência: `docs/TTS-PROD-FIX-001-CHROMIUM-EVIDENCE.json`):

| Cenário | Verifica | Resultado |
| --- | --- | --- |
| **A** | Sem gesto: unlock e play permanecem bloqueados; player nunca `playing`/`paused` (nenhum start no silêncio) | **PASS** |
| **B** | Gesto real (clique CDP): `unlock()` → `{ok:true, state:"running"}`; 2ª chamada idempotente ok | **PASS** |
| **C** | Play sem gesto NÃO inicia (`playing:false`, sem fim); após unlock no gesto + 7 s, o mesmo player toca e termina (contexto `running` basta) | **PASS** |
| **D** | Unlock dentro do gesto → autoplay **7 s depois, sem gesto**, toca e termina (paridade Chat: resposta chega muito depois do clique) | **PASS** |
| **E** | Controller: `noteResponse` sem gesto → orchestrator `PLAYING` mas **player não iniciou** (`playerPlaying:false`, áudio retido) = bloqueio observável; unlock no gesto + 7 s → `stop/replay` → `phase: ended`, TTS permanece ativo | **PASS** |

**Caveat de ambiente (documentado):** em headless o `resume()` bloqueado tende a
**permanecer pendente** (não rejeita) — por isso em E o estado intermediário é
`phase: playing` (pendente) em vez de `phase: error`. Em navegadores headed /
WebView reais o `resume()` **rejeita** (`NotAllowedError`) e o caminho testado
exatamente por FIX-C2 → `phase: error` observável. Em ambos os casos o player
**não inicia source no silêncio** e o unlock no gesto recupera o áudio.

---

## 6. Android físico (RMX3461) — pós-autorização de deploy

- **Deploy autorizado e executado:** commit único `6d5df07` → `origin/main` → Vercel
  (fingerprint de produção mudou ~72 s). Bundle corrigido **confirmado no device**
  (chunk `4776.b9699d4e68300975.js` contém o marcador do FIX-001; `.../ANDROID-E2E-OOM-EVIDENCE.md`).
- **E2E físico executado com sessão real** (sem simular login): dashboard autenticado →
  chat aberto → TTS já ativado (preferência persistida; unlock real = gesto do Envio) →
  envio real → resposta gerada → controller entra em `Preparando áudio...`.
- **App-close reproduzido (determinístico 3/3) — REGISTRO DE FATO (não investigado,
  regra FIX-001):** `java.lang.OutOfMemoryError: Failed to allocate a 150994952 byte
  allocation (≈144 MB) ... growth limit 402653184` no **provisionamento do modelo TTS**
  (download/cache via bridge Capacitor/Filesystem; `WebMessageListenerAdapter`),
  anterior à síntese/playback e compartilhado com o código antigo — **não é causado
  pelo FIX-001**. Reproduzível porque a reinstalação do APK deixou o cache ausente
  (1º uso). Validações físicas anteriores com áudio tinham cache presente.
- **Áudio E2E físico do FIX-001: BLOCKED por essa pré-condição (OOM de provisionamento
  de assets)** — o fluxo não alcança síntese/playback nesta condição do device.
  Cobertura da correção: testes (603/603), Chromium real A–E e deploy confirmado.
- Probes de política no WebView real (`...-ANDROID-POLICY-PROBE*.json`): este WebView
  não impõe restrição de user activation para Web Audio (ctx nasce `running`) — o
  unlock é no-op seguro aqui; a superfície real do bug/fix é o Chrome/PWA e WebViews
  restritivos.

---

## 7. Confirmações solicitadas

- **`voice-synthesis` fora do repositório/git**: confirmado — `voice-synthesis` é
  pasta irmã **sem `.git`** (não é repositório, nunca entra em deploy) e **nenhum
  arquivo foi escrito** em `Vanusa\voice-synthesis` nem em qualquer local fora de
  `vanzacariasnutri`/TEMP durante esta sprint.
- **Commit/deploy (autorizado posteriormente pelo usuário):** **um único commit**
  `6d5df07 fix(tts): desbloquear AudioContext no gesto antes do autoplay
  (TTS-PROD-FIX-001)` (9 arquivos: 4 src + ChatAssistant + 4 arquivos de teste/helper)
  enviado a `origin/main` → deploy Vercel confirmado. **Nenhum outro commit.**
  Documentos `docs/TTS-PROD-FIX-001-*` e de auditoria permanecem como registro local
  (não commitados), seguindo o padrão das auditorias.
- Documentos novos (não commitados): `docs/TTS-PROD-FIX-001-REPORT.md`,
  `docs/TTS-PROD-FIX-001-CHROMIUM-EVIDENCE.json`,
  `docs/TTS-PROD-FIX-001-ANDROID-POLICY-PROBE{,-FRESH}.json`,
  `docs/TTS-PROD-FIX-001-ANDROID-E2E-OOM-EVIDENCE.md` (+ auditorias anteriores não
  rastreadas já existentes).

---

## 8. Caveats finais

1. Fluxo nominal pós-correção: **todo envio** (paciente/admin) e **ativação do
   botão TTS** disparam o unlock dentro do gesto; a resposta que chega depois
   encontra contexto `running` e reproduz (cenários C/D/E reais).
2. Caso residual documentado: se o TTS já estiver ativado de sessão anterior e o
   usuário enviar a **primeira** mensagem sem nenhuma interação prévia com o
   domínio nesta sessão, o 1º unlock pode criar o contexto fora da janela de
   ativação (dynamic import do chunk pode atrasar); o resultado é **erro/falha
   observável** (nunca silêncio mascarado) e o unlock repete nos gestos seguintes
   (idempotente) — comportamento preferível e explícito versus o `catch {}` antigo.
3. Reprodução do bloqueio em headless exige origin sem interações (ativação
   sticky); ver seção 5 para detalhes metodológicos.
