# CAP-PROD-001 REPORT — Arquitetura do APK de produção (decisão)

> Período: 2026-09-08 · Projeto real: `vanzacariasnutri` (Next.js 16 SSR + Supabase/Auth + Gemini/RAG + Capacitor 8 + Vosk local + Kokoro/pf_dora local) · Sprint de **decisão** — nenhuma alteração de produção realizada. Evidência: inspeção do projeto + builds existentes + relatórios CAP-001/002/003 e TTS-PWA-001.

## 1. Estado atual

| Item | Evidência |
| --- | --- |
| `capacitor.config.ts` | `appId br.com.vanusazacarias.nutri` · `webDir: public` · **`server.url: https://vanzacarias-mu.vercel.app`** (remoto) · `androidScheme: https` · `cleartext:false` |
| `next.config.ts` | Sem `output:` → **Next SSR padrão** · `@serwist/next` (PWA, um SW) · `serverExternalPackages: ["voice-synthesis","onnxruntime-node"]` · header cache p/ modelo Vosk |
| Rotas de servidor (`src/app/api`) | `checkout`, `nutri-assistant/patient`, `nutri-assistant/admin`, `push/send`, `push/subscribe`, `tts/[...path]` (dev assets), `webhook` |
| Autenticação | `src/lib/supabase/{client,serverAuth}.ts` — SSR com cookies (server-side) |
| Chat | `ChatAssistant` chama **same-origin** `/api/nutri-assistant/patient|admin` (→ Gemini/RAG/Supabase no servidor) |
| PWA/SW | `src/sw.ts` (Serwist): precache + runtime caching (Vosk; TTS `tts-assets-v1`) |
| Assets locais | `public/assets/tts` **129 MB** (gitignored; copiados no sync Android — TTS local) · `public/vosk-model-*tar.gz` 30,9 MB (web + APK) |
| APK real (debug, com assets) | **153,4 MB** (`android/app/build/outputs/apk/debug/app-debug.apk`) |
| TTS/Vosk no device | TTS local validado fisicamente (CAP-001/002/003, RMX3461); Vosk = modelo baixado do mesmo domínio (padrão atual do web/PWA) |

## 2. Arquitetura A — `server.url` remoto (atual)

- **Como funciona hoje:** o APK é um shell WebView que carrega `https://vanzacarias-mu.vercel.app`; tudo (páginas SSR, Chat, Gemini/RAG, Supabase/Auth via cookies, PWA/SW do domínio) roda no conteúdo remoto. Vosk funciona no padrão atual (modelo 30,9 MB servido pelo domínio e cacheado no WebView — SW/Cache **registram** no WebView, sonda CAP-002).
- **TTS local:** **impossível** com a origem remota — os assets/worker locais (`/assets/tts`, scheme do dispositivo) **não são alcançáveis** de uma página de outra origem sem bridge (proibida). TTS no APK real **hoje não funciona** (o domínio não serve modelo/rotas TTS de produção — pendência documentada no TTS-PWA-001/D23).
- Prós: Chat/Auth/APIs/RAG/PWA funcionam como hoje; atualização do frontend imediata (deploy) sem novo APK; APK pequeno (~40,7 MB sem assets); Vosk OK.
- Contras: sem TTS local (o ativo validado) sem re-servir ~120 MB no domínio + dependência de rede p/ tudo; TTS offline não faz sentido sem modelo local.

## 3. Arquitetura B — Web app embarcado/local no APK

- **Verificação (não por suposição):** o projeto é **Next SSR** com 7 rotas `/api`, autenticação Supabase **server-side (cookies/`serverAuth`)**, middleware/proxy, Sanity e `serverExternalPackages`. **Não há `output: export`** e o app não exporta para static sem quebrar: APIs, sessão por cookies, Gemini/RAG e SSR ficariam sem servidor.
- Embarcar o Next em execução exigiria servidor Node dentro do APK ou rewrite total para CSR — ambos **fora** do modelo Capacitor atual e proibidos (sem servidor local).
- **Veredito:** B **não é viável** com o sistema real atual (exigiria reescrita de arquitetura → regra STOP se fosse necessário implementar para decidir; aqui apenas documenta-se a inviabilidade técnica atual).

## 4. Arquitetura C — Híbrido (frontend local + backend/API remoto)

- Conceito: shell Capacitor com **frontend local** (assets do APK: TTS 129 MB + Vosk 31 MB + UI) e todas as APIs/auth/Supabase/Gemini/RAG **remotas** via base URL explícita; Vosk e Kokoro **locais** (validados no device).
- **Viabilidade atual:** **não implementável sem refatoração** — o frontend atual é SSR e chama APIs **same-origin** (`/api/nutri-assistant/*`) com sessão por cookies; para C seria necessário: (a) cliente CSR/local com `API_BASE` remoto; (b) autenticação por token (não só cookie SSR); (c) movimentar páginas/client components para bundle local. Não existe hoje um bundle local do frontend (só `public` estático). Exigiria sprint de refatoração dedicado — **não feito** (regras absolutas).
- Potencial: única arquitetura em que **TTS e Vosk locais validados** convivem com Chat/backend remoto e atualização de backend independente do APK; Chat continua online (requisito) e TTS offline local.

## 5. Matriz comparativa

| Critério | A — Remoto (atual) | B — Local total | C — Híbrido |
| --- | --- | --- | --- |
| Chat (Gemini/RAG) | ✅ hoje | 🔴 (sem backend no APK) | ✅ (backend remoto, requer refactor client) |
| Supabase/Auth | ✅ (SSR cookies) | 🔴 | ⚠️ (token/client auth, refactor) |
| APIs | ✅ | 🔴 | ✅ (base remota) |
| TTS local (Kokoro) | 🔴 (origem remota) | ✅ (validado) | ✅ (validado) |
| Vosk | ⚠️ (modelo baixado do domínio) | ✅ | ✅ (modelo local) |
| Offline TTS | 🔴 | ✅ | ✅ |
| Atualização do frontend | ✅ imediata (deploy) | 🔴 (novo APK) | 🔴 frontend novo APK; backend deploy |
| APK size | ~41 MB | ~153 MB | ~153+ MB |
| Manutenção | baixa (1 código web) | alta | média-alta (2 entregas + base) |
| Segurança | 🔒 cookies/SSR | n/a | ⚠️ token management |
| Complexidade | baixa (atual) | muito alta | **alta (refactor)** |
| Produção | hoje | inviável | destino, sem alteração agora |

**Riscos:** A = sem TTS local no produto (e depender de re-servir modelo no domínio para TTS remoto); B = inviável; C = refatoração grande (auth, base API, build local) e manutenção de duas entregas. **Benefícios:** C entrega o único modelo que usa os motores locais validados. **Impacto operacional:** decisão C implica planejar sprint de refatoração de frontend; até lá A permanece.

## 6. Riscos / 7. Impactos (consolidados)

- **Risco técnico (A→C):** conversão SSR/CSR e auth por token pode quebrar fluxos existentes; mitigação: camada `API_BASE` + testes E2E (fora desta sprint).
- **Risco de produto:** manter A deixa o TTS local validado sem uso no APK real.
- **Impacto APK:** ~153 MB é o custo da estratégia com motores locais (129 MB de assets + 31 MB Vosk no mesmo bundle); sem sacrifício da voz (regra). Redução real só viria de distribuir o modelo fora do APK (Play Asset Delivery/baixável) — **não** implementado nem recomendado como requisito desta decisão.

## 8. Evidências

- Config real (acima); 7 rotas `/api`; `next.config.ts` sem `output:export` e com `serverExternalPackages`; Chat chamando `/api/nutri-assistant/*` same-origin; Supabase SSR (`serverAuth`); PWA/SW único; assets locais 129 MB + Vosk 30,9 MB → APK 153,4 MB; sonda WebView: SW/Cache **registram** (`registered`, `caches=true`, CAP-002) — base para eventual TTS remoto-cacheado sob A.
- CAP-001/002/003: TTS local físico PASS (RMX3461), Vosk não integrado na PoC (NÃO VALIDADO) — fluxo Vosk real depende da UI/backend (CAP-003).

## 9. Recomendação final

> **ARQUITETURA RECOMENDADA: C — HÍBRIDO** (frontend local no APK com Vosk e Kokoro locais + backend/API/Supabase/Gemini/RAG remotos).

Justificativa (evidências do projeto): é a **única** arquitetura em que os motores locais **já validados fisicamente** (Kokoro Q8/pf_dora/vozz e Vosk) operam dentro do produto real, mantendo Chat/backend remoto (requisito: Chat **não** offline) e atualização de backend independente do APK. **B é inviável** no sistema Next-SSR atual; **A** (atual) mantém o produto funcional, porém **sem TTS local** (o domínio não serve o modelo TTS de produção).

**Declaração explícita:** C **não é implementável hoje sem refatoração** (frontend SSR/same-origin/SSR-auth → cliente local com `API_BASE` remoto + auth por token + bundle local). Por regra, **nada foi implementado**; esta é uma decisão de destino. **Interim recomendado: permanecer em A** até o sprint de refatoração de C.

## 10. Próximo sprint (não iniciado — depende de revisão)

1. Sprint de refatoração (escopo fechado): criar cliente local (bundle web) com `API_BASE` remoto configurável; mover auth para token compatível com Supabase client; manter páginas/UX atuais.
2. Empacotar frontend local + Vosk + Kokoro no Capacitor (`webDir` local), preservando PWA web em paralelo (dois modos).
3. Validar E2E físico real (Chat+Vosk+TTS) — fechando as lacunas NÃO VALIDADAS do CAP-003.
4. Reavaliar tamanho/distribuição do modelo (PAD/baixável) **sem** sacrifício da voz — após decisão de produto.

**GATE: PASS** — recomendação clara e sustentada pelo projeto real; nenhuma alteração de produção realizada. **STOP** — nenhuma implementação iniciada nesta sprint.
