# TTS-PROD-AUDIT-001 — Áudio sem som em produção (Web/PWA)

> Período: 2026-09-09 · Projeto `vanzacariasnutri` · **Auditoria apenas — nenhum código alterado, nenhum commit.**

## Resumo

**ROOT CAUSE CONFIRMED** — ausência de áudio no autoplay pós-resposta.

- CAUSA: política de **autoplay/user activation** do navegador: `AudioContext` criado fora de um gesto do usuário nasce `suspended`; `resume()` é bloqueado (em Chromium headed: rejeição `NotAllowedError`; em headless-new aqui: permanece pendente — ambos mantêm `suspended`); o `player.ts` ignora o erro de `resume()` (`catch {}`) e chama `source.start()` mesmo assim → nenhum sample é renderizado e `onended` nunca dispara.
- ONDE: `src/lib/tts/player.ts` — `play()` (linhas ~120–140) e `resume()` (~159–169): `getContext()` cria o contexto; `if (ctx.state === "suspended") { try { await ctx.resume() } catch {} }`; `startSource()` roda incondicionalmente.
- COMO: fluxo Chat → resposta assíncrona → `noteResponse` → `orchestrator.speak` → `player.play()` **sem user activation** → contexto suspenso → silêncio; a Promise da sessão nunca resolve (orchestrator fica em `PLAYING`).
- EVIDÊNCIA (Chromium real, contraste): `docs/TTS-PROD-AUDIT-AUTOPLAY-EVIDENCE-A.json` (padrão) vs `...-B.json` (autoplay permitido):
  - **A (padrão, sem gesto):** `AudioContext.state = suspended` (antes/depois/final); `resume()` não resolveu; `AudioBuffer` ok (0,2 s / 24 kHz / 4800); `source.start()` executou **sem exceção**; estado permaneceu `suspended` (sem avanço de `currentTime`, sem `onended`).
  - **B (autoplay permitido ≈ gesto):** `state = running`; `resume()` resolveu; `source.onended` disparou; `currentTime` avançou (2,4 s) — áudio renderizado.
- AMBIENTE AFETADO: qualquer fluxo de **autoplay** (TTS disparado automaticamente ao fim da resposta, sem clique). Fluxo iniciado por **gesto explícito** (botão/controle) funciona (B).
- POR QUE OS TESTES ANTERIORES NÃO DETECTARAM: as validações de pipeline (Chromium headless) rodaram com o flag `--autoplay-policy=no-user-gesture-required`, que **desativa a política** — o cenário real de produção não tinha esse flag.

## Linha temporal do pipeline (A)

| Ponto | Estado |
| --- | --- |
| T0–T9 (Chat→noteResponse→controller→orchestrator→load→worker→synth→AudioResult) | PASS (síntese válida — ver AUDIT-001/002 sobre AudioResult) |
| T10 AudioContext criado | PASS — porém `state=suspended` |
| T11 state | **suspended** |
| T12 resume iniciado | executado |
| T13 resume terminado | **não resolve / rejeitado (ignorado por `catch {}`)** |
| T14 AudioBuffer criado | PASS |
| T15 source.start | PASS (sem exceção) — mas contexto suspenso |
| T16 áudio audível | **FALHA (não renderizado)** |
| T17 onended | **não ocorre** |

## Conclusão
Causa confirmada para o silêncio no autoplay: restrição de **user activation/autoplay** + tratamento silencioso do erro de `resume()` + `startSource` incondicional. **Nenhuma correção aplicada** (auditoria). Correção candidata (fase futura, fora desta): obter ativação do usuário antes do autoplay ou expor o erro de `resume()` — não implementada.
