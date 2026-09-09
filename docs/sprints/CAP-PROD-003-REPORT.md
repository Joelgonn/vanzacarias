# CAP-PROD-003 REPORT — Frontend Local → Auth → Backend Remoto → Chat

> Período: 2026-09-08 · Projeto real `vanzacariasnutri` · Implementação **mínima e controlada** do caminho híbrido C (Fases 1–3, 5–7 código; Fase 4 avaliada) — **sem migração completa, sem alterar Vosk/Kokoro/Gemini/RAG/schema/UX/PWA**, versão web preservada.

## 1. Alterações realizadas

| Arquivo | Mudança |
| --- | --- |
| `src/lib/supabase/serverAuth.ts` | `getAuthenticatedUser` aceita **`Authorization: Bearer <access_token>`** (validado por `supabase.auth.getUser(token)`); cookie permanece para web; novo helper puro `getBearerToken`; autorização/roles inalterados e centralizados |
| `src/proxy.ts` | CORS **restrito** para `/api/*` quando `Origin = https://localhost` (nunca `*`): métodos `GET,POST,OPTIONS`, headers `Authorization, Content-Type`, `OPTIONS` → 204; web/outras origens seguem sem headers; matcher estendido com `/api/:path*` (o ramo de páginas/auth não roda para APIs) |
| `src/lib/apiBase.ts` | **API_BASE centralizada**: web = `''` (comportamento atual); Capacitor nativo (`detectNativeCapacitor`) = `https://vanzacarias-mu.vercel.app` (config canônica do projeto / `NEXT_PUBLIC_API_BASE`) |
| `src/lib/chatApi.ts` | Transporte do Chat: `chatApiFetch` monta URL via `apiUrl` e injeta **`Authorization: Bearer`** quando cross-origin (token da sessão Supabase client); web não envia token (cookie) |
| `src/components/ChatAssistant.tsx` | As duas chamadas do Chat (`/api/nutri-assistant/patient` e `/admin`) passam a usar `chatApiFetch` (transporte/origem/auth apenas; nenhuma mudança de lógica/UI) |
| `src/app/api/poc/whoami/route.ts` | Rota **PoC** marcada (GET, `requireUser`): retorna `{ok,id,email}` do usuário autenticado (Bearer ou cookie) — para validar identidade sem afetar produção |
| `src/lib/__tests__/hybridApi.test.ts` | 3 testes novos (API_BASE web/Capacitor; extração de Bearer) |

## 2. `serverAuth`
Centralizado: `getAuthenticatedUser` resolve identidade via **Bearer (Capacitor)** OU **cookie (web)**; `requireUser`/`requireAdmin` inalterados; nenhum `user_id` de cliente é confiado (identidade vem do Supabase).

## 3. Bearer
`Authorization: Bearer <access_token>` — validado pelo Supabase (getUser(token)); sem bypass (Bearer inválido → 401 igual ao cookie inválido).

## 4. CORS
Restrito a `https://localhost` (origem do shell Capacitor), sem `*`, sem abrir globalmente; headers/métodos mínimos; pré-flight `OPTIONS` 204; web intocada.

## 5. API_BASE
`src/lib/apiBase.ts`: `''` (web) × remota (Capacitor). Chat migrado para o mecanismo centralizado (`chatApiFetch`). Nenhuma outra chamada alterada.

## 6. Build local
Avaliação (Fase 4): o Next atual é **SSR** (7 rotas `/api`, Supabase SSR, Sanity, `serverExternalPackages`); **`output: export` não é aplicável** sem quebrar funcionalidades. Build local mínimo para Capacitor continua exigindo um **subset cliente dedicado** (login + Chat) — escopo de sprint seguinte; **nada de build web foi alterado/destruído** (build de produção PASS).

## 7. Login
Caminho implementado (client-side via `createBrowserClient` existente + Bearer no transporte). **Teste físico real: BLOCKED — credencial de teste não disponível** no ambiente (regra: não simular login). Nenhuma senha/credencial registrada.

## 8. API autenticada
Rota PoC `/api/poc/whoami` criada (marcada PoC). **Execução ponta-a-ponta BLOCKED** — exige credencial real + redeploy do backend com Bearer/CORS (indisponível nesta sessão). Validação automatizada: testes de unidade do Bearer/API_BASE (3/3) e suíte 575/575.

## 9. Chat / 10. Streaming
Transporte adaptado (`chatApiFetch` + Bearer quando cross-origin; streaming por `fetch` continua idêntico — o cliente já lê o stream). Sem alteração em Gemini/RAG/prompts/memória. **Chat ponta-a-ponta real: BLOCKED (mesma pré-condição).**

## 11. TTS
Nenhuma alteração; assets locais `/assets/tts`, Worker, ORT-WASM, Kokoro Q8, pf_dora, vozz e AudioContext preservados. Físico anterior: PASS (CAP-002/003, RMX3461) sob a mesma origem `https://localhost` — compatível com a arquitetura local.

## 12. Vosk
Nenhuma alteração. Regra sequencial mantida (`Vosk → libera → Chat → Kokoro → nova pergunta → interrompe`); sem teste de simultaneidade.

## 13. Teste Android
- APK integrado local (shell + TTS local): instalado/executado fisicamente no RMX3461 nas sprints anteriores (frontend local abre sob `https://localhost`; TTS local funcional, online e offline).
- Login real + API + Chat no device: **BLOCKED — credencial de teste não disponível e backend remoto ainda sem Bearer/CORS (requer redeploy)**. Não simulado.

## 14. Teste web
- `npm run typecheck` PASS · `npm test` **575 passed (575)** · `npm run build` PASS.
- Caminho web (cookie → `serverAuth` → API) preservado: Bearer só é usado quando há header; CORS só ativo para `https://localhost`; proxy de páginas inalterado.

## 15. Evidências
- Código/commits em working tree (lista §1); testes `hybridApi` (3) + suíte 575; builds PASS.
- Físico anterior (local frontend + TTS): `docs/TTS-CAP-002/003-*` e evidências JSON.
- Backend remoto: alcance/CORS/404 de `/api/tts` verificados em CAP-PROD-002 (probe).

## 16. Problemas encontrados
1. **Pré-condições externas para o teste ponta-a-ponta**: credencial de teste Supabase ausente; backend publicado sem o Bearer/CORS (não há como redeploy nesta sessão) → registro como **BLOCKED** de validação física (não é defeito de implementação).
2. Nenhum defeito nas mudanças locais (typecheck/testes/build verdes).

## 17. Limitações
- A rota PoC `whoami` e o Bearer só terão efeito após **deploy** do backend; validação E2E real depende disso + credencial.
- Build local dedicado (login+Chat) para Capacitor permanece pendente (subset dedicado, não `output:export`).

## 18. Próximo passo (CAP-PROD-004, não iniciado)
1. Redeploy do backend com Bearer/CORS (código já pronto neste sprint).
2. Criar credencial de teste (ou usar conta controlada) e executar o fluxo real no RMX3461: login → `/api/poc/whoami` → Chat streaming → TTS local → Vosk sequencial.
3. Build local mínimo dedicado (login+Chat) para o shell Capacitor, mantendo o deploy web intacto.

## COMMIT E DEPLOY

- Commit: `9fa1b4b feat: testando pela primeira vez audio no chat` (contém CAP-PROD-003: serverAuth Bearer+cookie, CORS restrito https://localhost, API_BASE, chatApiFetch, /api/poc/whoami, hybridApi.test.ts) — working tree clean, já existente em origin/main antes desta operação
- Branch: `main`
- Push: PASS — `git push origin main` → Everything up-to-date (origin/main = 9fa1b4b)
- Deploy: BLOCKED — mecanismo oficial é Git integration Vercel (projeto `vanzacarias` → `https://vanzacarias-mu.vercel.app`, `capacitor.config.ts:8`). Vercel CLI sem credenciais (`vercel ls` → No existing credentials); Git push já realizado mas backend publicado NÃO contém o código do CAP-PROD-003 (evidência § abaixo); sem token não há como forçar redeploy nesta sessão; não criado novo mecanismo
- URL: `https://vanzacarias-mu.vercel.app`
- GET /api/poc/whoami: FAIL — esperado 401, obtido **404** (Next 404 page, `X-Matched-Path: /404`) — rota PoC não existe no backend publicado
- OPTIONS CORS: FAIL — `OPTIONS /api/poc/whoami` com `Origin: https://localhost` → **204** mas **sem `Access-Control-Allow-Origin`** (headers: Content-Disposition, Strict-Transport-Security, X-Matched-Path:/404, X-Vercel-Cache:BYPASS, sem ACAO; esperado `Access-Control-Allow-Origin: https://localhost` + `Authorization, Content-Type`)
- Bearer: NOT EXECUTED — credential unavailable — sem credencial de teste no ambiente, não simulado (regra §6.3)

Validação local desta operação (2026-09-09 09:21 UTC):
- `npm test` → 575 passed (575) — PASS
- `npm run typecheck` → PASS (tsc --noEmit sem erros)
- `npm run build` → PASS (Next 16.1.6 webpack, 7 workers, rota /api/poc/whoami presente no build local)

Evidência deploy: `GET /api/poc/whoami` 404 + `OPTIONS` 204 sem ACAO confirma backend publicado stale (commit 9fa1b4b não deployado). `GET /api/nutri-assistant/patient` → 405 MethodNotAllowed confirma que outras rotas /api existem, mas a PoC não.

---

**GATE: PASS COM RESSALVAS (código) / BLOCKED (deploy)** — arquitetura implementada corretamente no código (Bearer + CORS restrito + API_BASE + transporte do Chat + rota PoC), versão web íntegra (typecheck/testes/build verdes) e motores locais preservados. Ressalva explícita: o teste físico ponta-a-ponta depende de pré-condições externas (credencial de teste + redeploy do backend) — **registrado, sem simulação**. Deploy BLOCKED nesta sessão por falta de credenciais Vercel / Git integration não publicou o commit. **STOP.**
