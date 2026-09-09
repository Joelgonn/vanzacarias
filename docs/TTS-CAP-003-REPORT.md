# TTS-CAP-003 REPORT — Validação E2E Android + Vosk

> Período: 2026-09-08 · Dispositivo físico: Realme RMX3461 (Android 11, arm64-v8a, WebView Chrome 151) · APK da integração CAP-002 instalado (`br.com.vanusakokoro.poc`, versionName 1.0) · Engine `voice-synthesis` intacto · Método: Harness ADB + telemetria + `dumpsys meminfo` (VALIDADO PELO HARNESS) e execução física no device (VALIDADO FISICAMENTE)

## 1. Dispositivo
RMX3461 conectado (`adb devices` → `device`), Android 11 (SDK 30), arm64-v8a, WebView Chrome/151.

## 2. Versão do APK
PoC integrada do TTS-CAP-002 (assets locais `/assets/tts/**`, modo Capacitor nativo) — `br.com.vanusakokoro.poc` v1.0 instalado. APK de produção real (160,9 MB, remote `server.url`) **não é utilizável para E2E local**: carrega conteúdo remoto e exige sessão/backend (ver limitações). Tamanho APK validado: **94,4 MB** (PoC) e **160,9 MB** (projeto real integrado, CAP-002).

## 3. Resultados E01–E13

| # | Cenário | Resultado | Evidência |
| --- | --- | --- | --- |
| E01 | TTS OFF → resposta sem síntese | **PASS (lógica/unit)** · NÃO VALIDADO (UI física) | controller: `T20`/`T32` (nenhuma síntese com OFF) |
| E02 | TTS ON → resposta completa → fala | **PASS (físico — cadeia integrada)** · NÃO VALIDADO (UI real) | device: T01–T06 `ended`, áudio 2,4–8,9 s (rondas 1 e 2) |
| E03 | Streaming espera resposta completa | **PASS (lógica/design)** · NÃO VALIDADO (UI física) | `noteResponse` só no fim do stream (Chat web validado; unit) |
| E04 | Nova pergunta interrompe fala A | **PASS (lógica/unit)** · NÃO VALIDADO (gesto físico) | controller `invalidate`/`gen` (testes interrupção) |
| E05 | Pause mantém posição | **PASS (unit player/controller)** · NÃO VALIDADO (gesto físico) | `player.test`/`T-pause` |
| E06 | Resume da posição | **PASS (unit)** · NÃO VALIDADO (gesto físico) | idem |
| E07 | Replay do alvo atual (sem re-síntese) | **PASS (unit `T23`)** · NÃO VALIDADO (gesto físico) | idem |
| E08 | Nova resposta substitui o alvo | **PASS (físico — sequência de novos textos falados no device + unit `T30`)** | suite T01→T06 (cada nova resposta substituiu a anterior e foi falada) |
| E09 | OFF durante fala para imediatamente | **PASS (lógica/unit)** · NÃO VALIDADO (gesto físico) | controller `setEnabled(false)`/stop (unit) |
| E10 | Vosk → Chat → TTS | **NÃO VALIDADO** (Vosk real + UI/backend indisponíveis) | — |
| E11 | TTS → Vosk (mic pós-fala) | **NÃO VALIDADO** (idem) | — |
| E12 | Repetição Vosk→Chat→TTS ×3 | **PARCIAL**: repetição TTS-only **PASS físico** (6 falas sucessivas + 3 ciclos, memória estável) · Vosk real **NÃO VALIDADO** | device rondas 1/2 |
| E13 | TTS offline com assets instalados | **PASS físico** (TTS local sem rede) · Chat offline completo **NÃO VALIDADO** (depende de backend — documentado) | ronda 2 (`svc wifi/data disable`) |

## 4. Resultados — síntese física (VALIDADO FISICAMENTE, ronda online e offline idênticas)

| Fala | ok on/off | tempo total | áudio |
| --- | :-: | ---: | ---: |
| T01 curta | ✅/✅ | 22,3 / 22,3 s | 2,40 s |
| T02 `500 kcal` | ✅/✅ | 21,2 / 21,3 s | 3,13 s |
| T03 `500 ml` | ✅/✅ | 17,0 / 17,0 s | 2,48 s |
| T04 `10h30` | ✅/✅ | 17,7 / 17,7 s | 2,60 s |
| T05 `82,5 kg` | ✅/✅ | 26,8 / 26,8 s | 3,93 s |
| T06 longo | ✅/✅ | ~60 s | 8,90 s |

Ciclos (load→synth→dispose ×3 + reload): load 3,2–3,9 s · synth 14,1–14,7 s · 57 600 samples · `noNaN:true`.

## 5. Evidências
`docs/TTS-CAP-003-POC-EVIDENCE.json` (109 eventos: fases, resultados, `dumpsys meminfo` por fase; rondas online/offline no RMX3461).

## 6. Logs
Telemetria por evento no JSON acima; `ua` WebView Chrome/151 registrado em cada ronda.

## 7. Memória (E12/E2E)
PSS por fase (ronda 1): ~126 MB baseline → ~208–216 MB durante load/synth → **~126–143 MB após dispose/fim**; rondas 1 e 2 sem crescimento progressivo (fim ≈ início). Native Heap 5–15 MB (GC). Reload pós-dispose OK (3,2–3,3 s).

## 8. Vosk
**NÃO VALIDADO** — Vosk real exige a UI/app (microfone, modelo, sessão) que não está executável nesta rodada (app publicado = shell remoto; PoC isolada não contém Vosk). Vosk não foi modificado; nenhum conflito observado porque não houve execução simultânea.

## 9. TTS
Cadeia integrada **PASS físico**: Worker dedicado, onnxruntime-web/WASM, Kokoro Q8, `pf_dora`, vozz/G2P, AudioResult, reprodução no player WebView, dispose/reload — sem NaN, sem crash, offline incluído.

## 10. Offline
TTS local **PASS físico** (assets no APK; ronda 2 sem rede). Chat offline completo **NÃO VALIDADO** — o Chat depende do backend remoto (Gemini/Supabase) para gerar novas respostas; isso é limitação do app, não do motor TTS (documentado, sem confundir TTS offline × Chat offline).

## 11. Performance
Integração real não apresentou comportamento pior que a PoC: single-thread (COI=false), RTF ≈ 6–7, fala curta ~17–23 s, longo ~60 s (8,9 s de áudio). Latência resposta→fala ≈ tempo de síntese (sem streaming de áudio — fora do escopo). Nenhuma otimização aplicada.

## 12. Problemas encontrados
1. **Pré-condições ausentes para E2E completo (§3):** (a) o app real carrega conteúdo remoto (`server.url`) e o Chat exige **sessão Supabase/backend online** (sem credenciais nesta rodada); (b) não há build local com a UI/Chat do app para exercitar E01–E11 na UI; (c) Vosk real necessita da UI/mic. → **STOP parcial e documentação** (regra §3), sem simular.
2. `dumpsys` Java Heap não parseado (PSS/Native registrados).
3. Nenhum defeito da integração TTS encontrado (nenhuma correção necessária).

## 13. Correções realizadas
Nenhuma (sem defeito no escopo TTS).

## 14. Regressões
- Web: `vanzacariasnutri` typecheck ✅ · **572 testes ✅** · build ✅ · PWA/SW preservados.
- `voice-synthesis`: typecheck / typecheck:tests / build / testes ✅ (59✓) — engine intacto.
- Android: `cap sync` + `assembleDebug` (CAP-002) ✅ · instalação ✅ · execução física nesta rodada ✅.

## 15. Limitações
- UI/Chat real e Vosk real não executáveis sem sessão/backend e build local com UI (pré-condição do sprint).
- Audição humana não disponível (agente não ouve) — reprodução verificada por estado `ended`/samples no grafo de áudio; percepção sonora requer humano (registro separado).
- Gesto físico de pause/resume/replay/interrupção não re-executado um a um no device nesta rodada (lógica coberta por testes do controller/player — mesmo código do Chat; E08 sequencial físico cobriu substituição de alvo).

## 16. Decisão final

- **VALIDADO FISICAMENTE**: TTS Kokoro/Q8 + `pf_dora` + vozz + Worker + ORT-WASM integrados e funcionando no RMX3461, inclusive **offline**, com memória estável e ciclos/reload corretos; interações sucessivas (novo texto → novo alvo) estáveis.
- **NÃO VALIDADO (pré-condição indisponível)**: fluxo **UI Chat real + backend** e **Vosk real** (Vosk→Chat→TTS), conforme §3 — **STOP e documentar**; não foi transformado em PASS.

**GATE FINAL: não declarado PASS integral.** A parte executável (integração TTS Android física/offline/memória + regressões) está **PASS**; a afirmação completa do objetivo ("conversa corretamente com o Vosk no Chat real") permanece **NÃO VALIDADA** até haver build local do app com UI + sessão/backend e Vosk disponíveis. **STOP ABSOLUTO** — nenhuma produção, publicação, otimização ou novo sprint iniciado; decisões de produção/UX ficam para revisão deste relatório.
