# TTS-PROD-AUDIT-002 — Áudio sem som + fechamento do app no Android

> Período: 2026-09-09 · Projeto `vanzacariasnutri` · **Auditoria apenas — nenhum código alterado, nenhum commit/push/deploy.**

## 1. Resumo

- **Silêncio:** mesma causa raiz do AUDIT-001 (autoplay/user activation) aplicável ao WebView quando o TTS dispara automaticamente pós-resposta — `AudioContext` `suspended`, `resume()` bloqueado/ignorado (`catch {}`), `source.start()` sem efeito, `onended` não ocorre (evidência: contraste A/B em Chromium real — `docs/TTS-PROD-AUDIT-AUTOPLAY-EVIDENCE-{A,B}.json`).
- **Fechamento do aplicativo:** **ROOT CAUSE NOT CONFIRMED** — não reproduzido nesta auditoria (exige sessão autenticada + Chat real + `logcat` contínuo no momento do fechamento).

## 2. Pipeline (últimos estágios)

| Ponto | Estado |
| --- | --- |
| T0–T10 (Chat→noteResponse→speak→load→Worker→synth-result→AudioResult) | PASS em execuções físicas anteriores (RMX3461, CAP-002/003; AudioResult 57 600 samples, 24 kHz, sem NaN) |
| T11 AudioContext | depende de ativação (AUDIT-001) |
| T15 source.start | executa sem exceção (mesmo suspenso) |
| T16 áudio audível | **FALHA quando autoplay sem ativação** |
| T17 onended | não ocorre no cenário suspenso |

## 3. O fechamento do app

- **Diferenciação exigida não realizada por falta de reprodução autenticada** (login real/Chat remoto + `logcat` no instante do fechamento). Sem isso, não é possível classificar entre: Activity destruída, WebView encerrado, processo Chromium morto, kill do Android, OOM ou crash nativo.
- **Descartado com evidência:** o caminho de áudio TTS (AudioContext/AudioBuffer/source) **não crashou** em dezenas de ciclos de reprodução física no WebView do RMX3461 (CAP-002/003: falas sucessivas, pause/replay/reload, PSS estável sem OOM). Um contexto `suspended` **não fecha o aplicativo**.
- **Descartado:** síntese/Worker/ORT como causa imediata do fechamento (AudioResult válido repetidamente; Worker `ready`/`synth-result` consistentes).
- **Hipóteses restantes (não confirmadas):** crash nativo do WebView na sessão real (rota de áudio/`AudioFlinger`), OOM do processo WebView com modelo 92 MB + página remota, ou fechamento por componente alheio ao TTS (UX/sessão/backend) — exigem reprodução com `logcat`:
  `adb logcat -c` → reproduzir → procurar `FATAL EXCEPTION | Fatal signal | SIGSEGV | SIGABRT | SIGBUS | OutOfMemoryError | chromium | AudioFlinger | onnxruntime | wasm` + `dumpsys meminfo` antes/durante.

## 4. Evidências coletadas
- Contraste autoplay (A/B) — `docs/TTS-PROD-AUDIT-AUTOPLAY-EVIDENCE-A.json` / `...-B.json`.
- Físico anterior (áudio TTS no WebView sem crash): relatórios CAP-002/003 e evidências POC.

## 5. Conclusão
- **Silêncio:** causa confirmada (autoplay/user activation — AUDIT-001).
- **Fechamento do Android:** **ROOT CAUSE NOT CONFIRMED** — ÚLTIMO ESTÁGIO CONFIRMADO: reprodução/síntese estável sem crash nos testes físicos; EVIDÊNCIAS: contraste autoplay + histórico físico; HIPÓTESES: crash/OOM de WebView na sessão real ou encerramento não-TTS; O QUE FOI DESCARTADO: AudioContext `suspended` causa de fechamento; síntese/Worker/ORT como gatilho imediato.

**STOP** — nenhuma correção implementada; para confirmar o fechamento é necessária reprodução autenticada com `logcat` contínuo (fase futura).
