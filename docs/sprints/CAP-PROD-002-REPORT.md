# CAP-PROD-002 REPORT — Viabilidade controlada do Frontend Local (Híbrido C)

> Período: 2026-09-08 · Projeto real: `vanzacariasnutri` (Next.js 16 SSR · Capacitor 8 · Supabase/Auth · Gemini/RAG · Sanity · Vosk local · Kokoro/pf_dora local) · Sprint de **auditoria + PoC mínima** — nenhuma migração, nenhuma alteração de produção, Vosk/Kokoro/Chat não modificados.

## 1. Estado atual

- `capacitor.config.ts`: `server.url: https://vanzacarias-mu.vercel.app` (remoto), `webDir: public`, `androidScheme: https`.
- `next.config.ts`: SSR padrão (sem `output:`); `serverExternalPackages: ["voice-synthesis","onnxruntime-node"]`; Serwist/PWA (um SW); rotas de API: `checkout`, `nutri-assistant/patient`, `nutri-assistant/admin`, `push/{send,subscribe}`, `webhook`, `tts/[...path]` (assets dev).
- Supabase: `src/lib/supabase/client.ts` (`createBrowserClient`) e `serverAuth.ts` (SSR por cookies, comentário IDOR/“nunca confia no userId do cliente”).
- Chat: `ChatAssistant` → `fetch('/api/nutri-assistant/patient|admin')` **same-origin** (fluxo streaming com frames `done/error` no cliente); rota `patient` (632 linhas) com lógica server-heavy (Supabase service-role, Gemini, RAG/memória semântica, guardrails, rate limit).
- APK real integrado: 153,4 MB (129 MB TTS local + 30,9 MB modelo Vosk no bundle).

## 2. Dependências SSR encontradas

- **Server Components**: páginas `async` (`src/app/**/page.tsx` — dashboard, admin, perfil, agendamentos, blog, avaliação etc.) com dados server-side.
- **Server Actions**: **0** (`'use server'` não encontrado no `src`) — não há bloqueio por Server Actions.
- `cookies()`/`headers()` diretos: 0 usos no `src` (autenticação delegada a `serverAuth`).
- **Rotas `/api` (7)** — dependências: `@supabase/ssr`/service-role, `@google/generative-ai`, Sanity, RAG/memória, checkout/webhook/push; runtime Node obrigatório.
- **Autenticação server-side por cookie** (`getAuthenticatedUser` → `supabase.auth.getUser()` com cookies do request) usada por todas as APIs protegidas.

## 3. Dependências de same-origin

- Todas as chamadas do Chat e APIs usam **URLs relativas** (`/api/...`) — dependência de mesma origem.
- Sessão via **cookie Supabase** (same-origin) — é o mecanismo de todas as APIs; não há passagem de token por header hoje.
- TTS/Vosk locais **não** dependem de origem web (assets no scheme local — validado em CAP-001/002/003).

## 4. Autenticação atual

- Login/logout: clientes (`login`, `cadastro`, `atualizar-senha`, dashboards) usando Supabase client; sessão materializada **server-side via cookies** para as rotas de API (`serverAuth`).
- `client.ts` = `createBrowserClient(URL, ANON_KEY)` — pronto para uso em qualquer origem (depende apenas de CORS/redirects do projeto Supabase).

## 5. APIs necessárias

| Rota | Método | Auth | Streaming | Notas |
| --- | --- | --- | --- | --- |
| `/api/nutri-assistant/patient` | POST | cookie (`serverAuth`) | sim (frames) | Chat do paciente; server-heavy |
| `/api/nutri-assistant/admin` | POST | cookie+role | sim | Chat admin |
| `/api/checkout` · `/api/push/*` · `/api/webhook` | POST | cookie / secreto | não | demais recursos |
| `/api/tts/[...path]` | GET | — | não | assets **dev** — 404 em produção (confirmado: GET `/api/tts/models/model_quantized.onnx` → 404 na URL publicada) → TTS local é obrigatório |

## 6. Chat e streaming

- Endpoint real: `/api/nutri-assistant/patient` (e `admin`), POST same-origin, autenticado por cookie, resposta em streaming (leitura de frames no cliente).
- CORS: hoje as chamadas são same-origin; **não há necessidade atual** de CORS de API. Para frontend local (origem `https://localhost`) seria necessário CORS **restrito** (allowlist de `https://localhost`) + **Authorization Bearer** (porque cookie cross-origin não se aplica ao domínio remoto).
- Sem mudanças estruturais no streaming: `fetch` cross-origin lê o mesmo stream normalmente quando o servidor responde com CORS adequado.

## 7. CORS / origem

- **Origem local real do Capacitor 8:** `https://localhost` (`androidScheme: https`) — confirmada fisicamente nos CAP-001/002/003 (assets e UA do WebView no RMX3461).
- Backend remoto publicado responde hoje com `Access-Control-Allow-Origin: *` no HTML (probe: GET `https://vanzacarias-mu.vercel.app/` → 200, `ACAO: *`); **não** se deve depender de `*` (regra) — produção exigirá allowlist `https://localhost` (e demais origens controladas).
- Supabase: exigirá `https://localhost` em allowed redirects/URLs para o login client-side do shell local.

## 8. Estratégia possível para frontend local

Caminho mínimo identificado (sem migração completa):

1. **Frontend local = bundle web do cliente** servido pelo Capacitor (origem `https://localhost`), com `NEXT_PUBLIC_API_BASE` apontando para o backend remoto (`https://vanzacarias-mu.vercel.app`).
2. **Autenticação**: client-side via `@supabase/supabase-js` (token access/refresh no cliente) — mecanismo já existente (`createBrowserClient`).
3. **APIs**: passar `Authorization: Bearer <access_token>`; `serverAuth.getAuthenticatedUser` passa a aceitar token (mantendo cookie para web) — alteração pequena e delimitada.
4. **CORS**: allowlist `https://localhost` no backend/Supabase (sem `*`).
5. **TTS/Vosk**: intocados — assets locais `/assets/tts` + modelos já validados sob a mesma origem `https://localhost`.
6. **PWA/web**: permanece como está (dois modos; um SW por modo).

## 9. PoC executada

- **Origem local**: PoC Capacitor (CAP-002) executada fisicamente no RMX3461 sob `https://localhost` com TTS local funcional (assets `/assets/tts`), worker/ORT/Kokoro/vozz validados, online e offline.
- **Backend remoto (probe real, 2026-09-08):** `GET https://vanzacarias-mu.vercel.app/` → **200** (HTML); `GET /api/push/subscribe` → **405** (rota presente); `GET /api/tts/models/model_quantized.onnx` → **404** (assets TTS não servidos em produção ⇒ confirma necessidade de assets locais); cabeçalho `Access-Control-Allow-Origin: *` presente no HTML.
- **Autenticação E2E (login → API remota reconhecendo o usuário):** **NÃO EXECUTÁVEL** nesta rodada — exige credenciais de teste Supabase e redeploy com a mudança de Bearer/CORS (documentado; nada foi simulado).

## 10. Resultado da PoC

- **SIM**, é possível gerar/executar frontend local no Capacitor na origem `https://localhost` com os motores locais (já físico).
- **Backend remoto alcançável** e CORS/métodos observáveis; **/api/tts ausente em produção** reforça assets locais.
- **Autenticação local→remota**: caminho técnico claro e pequeno (Bearer + CORS allowlist); **ainda não demonstrado ponta a ponta por falta de credenciais/deploy** (ressalva).
- **Sem bloqueador arquitetural desconhecido**: nenhuma Server Action; servidor concentrado em rotas de API (não nas páginas de chat/UI críticas para o shell local).

## 11. Alterações necessárias para implementação completa (CAP-PROD-003)

1. `serverAuth`: aceitar `Authorization: Bearer` (validar com `supabase.auth.getUser(token)`); cookie permanece para web.
2. Cliente local: base URL de API configurável (`NEXT_PUBLIC_API_BASE`) substituindo chamadas relativas no módulo de rede do Chat.
3. Login/refresh client-side no shell local (Supabase client + redirect `https://localhost`).
4. CORS allowlist (`https://localhost`) no backend + Supabase (auth) — sem `*`.
5. Build/empacotamento do bundle local para Capacitor (subset/estratégia de build dedicada — detalhada no próximo sprint; **não** é `output:export` ingênuo).
6. Preservar PWA/web (modos separados); TTS/Vosk locais intocados.

## 12. Riscos

- Segurança de token (armazenamento no cliente local; rotação/refresh) — exigirá práticas do Supabase client (sem service role no cliente).
- CORS mal configurado (evitar `*`; lista restrita).
- Dois builds (web SSR × shell local) aumentam superfície de manutenção.
- Chat/backend permanecem remotos e online (requisito mantido); TTS offline local já garantido.
- Redeploy necessário para ativar Bearer/CORS (fora deste sprint).

## 13. Estimativa de complexidade relativa

- Autenticação Bearer: **baixa** (1 função em `serverAuth` + client token).
- CORS/allowlist: **baixa**.
- Base URL configurável: **baixa–média** (módulos de rede).
- Bundle local/build dedicado: **média–alta** (subset estático do cliente; requer validação de páginas/componentes).
- Migração completa de SSR→local: **alta** (fora do escopo; não feita).

## 14. Recomendação para CAP-PROD-003

- Preparar o sprint de implementação controlada com escopo fechado: (1) Bearer em `serverAuth` + rota/POc protegida marcada; (2) `API_BASE` e chamadas do Chat com Authorization; (3) CORS allowlist `https://localhost`; (4) build local mínimo do frontend (página de login + Chat) servido pelo Capacitor, mantendo o deploy web intacto; (5) validação E2E física com usuário de teste (login → Chat → TTS; Vosk sequencial) fechando as lacunas do CAP-003.

---

**GATE: PASS COM RESSALVAS** — a estratégia (frontend local → backend remoto) é **tecnicamente determinada** e sem bloqueador desconhecido; a origem local, os motores locais e o backend remoto foram verificados; autenticação/Chat têm caminho claro e delimitado. Ressalvas: a perna autenticada ponta-a-ponta ainda não foi executada (exige credenciais de teste + redeploy com Bearer/CORS) — registrado, sem simulação. Nenhuma alteração de produção/Vosk/Kokoro/Chat/PWA foi feita. **STOP.**
