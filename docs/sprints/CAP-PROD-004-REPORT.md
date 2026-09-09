# CAP-PROD-004 REPORT — Fechamento da Arquitetura Híbrida C

> Período: 2026-09-08 · Projeto real `vanzacariasnutri` · Dispositivo físico disponível (RMX3461) · Sprint de **validação física e fechamento** — sem nova arquitetura, sem alterar motores.

## 1. Deploy
**BLOCKED (dependência externa)**: o backend publicado (`https://vanzacarias-mu.vercel.app`) **não contém** o código do CAP-PROD-003 (Bearer/CORS/whoami). Não há credenciais de deploy nesta sessão para publicar.

**Evidência real (probe 2026-09-08):**
- `GET /api/poc/whoami` com `Authorization: Bearer …` → **404** (rota PoC não deployada);
- `OPTIONS /api/poc/whoami` com `Origin: https://localhost` → **204 sem cabeçalho `Access-Control-Allow-Origin`** (sem CORS do CAP-PROD-003 no ambiente publicado).

## 2. Build local
Shell local (frontend + TTS local) já existe e foi instalado/executado fisicamente nas sprints anteriores (CAP-002/003; APK ~94 MB na PoC; app real integrado ~153–160 MB). Nenhuma alteração de build web foi feita; deploy web intacto.

## 3. Dispositivo
RMX3461 conectado (`adb devices` → `device`, Android 11, arm64-v8a).

## 4. Login
**BLOCKED — credencial de teste não disponível.** Regra seguida: **não simular login**; nenhuma senha/credencial registrada em arquivo ou relatório.

## 5. Bearer
Implementado no código (CAP-PROD-003: `serverAuth` aceita Bearer validado por `supabase.auth.getUser(token)`; cookie web preservado). **Validação contra o backend publicado: BLOCKED** (código não deployado — 404 acima).

## 6. `whoami`
Rota PoC existe no código (`/api/poc/whoami`, GET, `requireUser`). **Validação real: BLOCKED** (não deployada; sem credencial).

## 7. Chat / 8. Streaming
Transporte adaptado no código (`chatApiFetch` + Bearer cross-origin; streaming inalterado). **Execução real ponta-a-ponta: BLOCKED** (mesmas pré-condições: deploy + credencial).

## 9. TTS
Motor local **não alterado**; validado fisicamente no RMX3461 nas sprints anteriores (assets `/assets/tts`, Worker, ORT-WASM, Kokoro Q8, pf_dora, vozz, AudioContext; offline incluso). Sem regressão (nenhuma mudança).

## 10. Interrupção / 11. Vosk / 12. Handoff TTS → Vosk
Lógica sequencial preservada (controller `invalidate`/stop; regra `Vosk → libera → Chat → Kokoro → nova pergunta → interrompe → Vosk`). **Validação física do handoff com Chat real: BLOCKED** (depende do login/Chat reais). Sem simultaneidade exigida; Vosk não alterado.

## 13. Ciclos repetidos
TTS-only (interações sucessivas + memória): **PASS físico** anterior (CAP-002/003 — suite 6 falas + 3 ciclos + reload, rondas online/offline, sem crescimento de PSS). Ciclos completos Vosk→Chat→TTS: **BLOCKED** (pré-condições acima).

## 14. Regressão web
Executada: `npm run typecheck` **PASS** · `npm test` → **575 passed (575)** · `npm run build` **PASS** (CAP-PROD-003). Caminho web (cookie → `serverAuth` → API) preservado e independente do Bearer.

## 15. Regressão dos motores
Executada: `voice-synthesis` `typecheck`/`typecheck:tests`/`test` **PASS** (59✓ | 2 skipped) — Vosk/Kokoro/TTS browser/voice-synthesis intactos (nenhuma alteração).

## 16. Logs/evidências
- Probe do backend publicado (404 whoami; OPTIONS 204 sem ACAO) — §1.
- Regressões web/motores — §14/§15.
- Físico local anterior (local frontend + TTS local): `docs/TTS-CAP-002/003-REPORT.md` + `docs/*POC-EVIDENCE.json`.

## 17. Problemas encontrados
1. **Deploy do backend indisponível** nesta sessão (sem credenciais de deploy) — o backend publicado permanece sem Bearer/CORS/whoami.
2. **Credencial de teste indisponível** — proibido simular login.
3. Nenhum defeito nas mudanças locais (regressões verdes); nenhuma alteração fora do escopo realizada.

## 18. Gate final

**`BLOCKED`** — dependências externas reais impedem a validação física ponta-a-ponta:

1. **backend publicado não contém o CAP-PROD-003** (evidência: 404 em `/api/poc/whoami` e OPTIONS sem `Access-Control-Allow-Origin`); deploy não executável nesta sessão;
2. **credencial de teste não disponível** (regra: não simular autenticação).

Não foi declarado PASS nem simulado sucesso. Partes independentes comprovadas: código pronto (Bearer/CORS/API_BASE/whoami/chat transport — CAP-PROD-003), regressões web/motores verdes, TTS local físico PASS (sprints anteriores) e dispositivo disponível.

**Próximo passo (quando as pré-condições existirem — não iniciado):** realizar o deploy do CAP-PROD-003; fornecer credencial de teste; executar no RMX3461: login real → whoami → Chat streaming → TTS local → interrupção → Vosk → ciclos repetidos; então fechar com **PASS**.

**STOP.**
