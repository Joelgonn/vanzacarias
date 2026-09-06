# CHAT-UX-006 — Composer compacto, Full-Width Mobile e refinamento final do Chat

**Sprint:** CHAT-UX-006 — IMPLEMENTATION
**Base:** CHAT-UX-005-AUDIT (auditoria) + avaliação do Composer idle.
**Status:** `IMPLEMENTED_NOT_VALIDATED` — validação física Android (Realme, A–AL) **NÃO EXECUTADA neste ambiente** (sem dispositivo). Conforme §25/§26 da sprint, **não** é declarado `VALIDATED`, e nenhum commit/push/deploy foi realizado.

---

## 1. Implementado (código + testes)

Arquivos alterados:
- `src/components/ChatAssistant.tsx` — UI do Composer/Header/Painel (nenhuma mudança em voz-core/Vosk/anexos/envio/backend/RAG/streaming).
- `src/components/__tests__/composerCOMPOSER001.test.ts` — contrato atualizado + 11 novos testes CHAT-UX-006 (UX6-01..11).

Mudanças aplicadas:

1. **Idle compacto ↔ edição (grid dual-mode, §2–4):** um único `<textarea>` real, sempre montado, sem botão fake, sem segundo textarea e sem `display:none`. A mesma grade alterna as áreas via constantes:
   - `COMPOSER_IDLE_AREAS = '"attach mic input send"'` → idle em **1 linha** `[📎][🎙] placeholder flex-1 [➤]` (altura ~56–60px: botões 44 + `p-2`).
   - `COMPOSER_EDIT_AREAS = '"input input input input" "attach mic . send"'` → modo edição: textarea em linha cheia no topo + ações na linha inferior.
   - Colunas constantes `auto auto minmax(0,1fr) auto`.
   - Guarda `isComposerIdle = !isComposerFocused && !hasContent && !voice.isRecording && state.selectedImage === null` — texto/transcrição/imagem/gravação sempre mantêm o modo expandido.
   - **Removidos** os pisos artificiais `min-h-[68px]/[72px]/[120px]/[140px]` e o `justify-center`/`placeholder:text-center` do idle; a altura segue o conteúdo (auto-grow `scrollHeight` até `COMPOSER_MAX_HEIGHT=200`, depois scroll interno `overflow-y:auto`) — `min-h-0` preservado na conversation e na pill.
2. **Mobile full-width (§8):** removido `max-w-[min(440px,calc(100vw-32px))]` do mobile; aplicado `sm:max-w-[min(440px,calc(100vw-32px))]` apenas em `sm:` (desktop 420–440 inalterado, `lg:w-[440px]`, `sm:w-[420px]` preservados; `rounded-t-3xl` mobile / `sm:rounded-3xl` mantidos).
3. **Botão Parar (§9):** `■` agora com fundo verde nutri (`bg-[#2A5C43]`, hover `#1A3B2B`), quadrado branco `size 11`, touch target 44×44, sem vermelho; vermelho reservado ao `●` pulsante. Hover do `×` (cancelar) neutralizado (sem vermelho).
4. **Header (§11):** removida a segunda linha de status ("De olho em você"/"Online agora"/"Assistente IA da Nutri"); dot verde pulsante (`h-1.5 w-1.5`, ping) **inline após "Nutri Van"**, na mesma linha do nome e do badge Premium/Gratuito; ações (WhatsApp/X) mantidas.
5. **Voz (§10):** distribuição `× esquerda | ● | waveform elástico (flex-1, sem max-w-[160px]) | timer M:SS | ■ direita`; sem textos visíveis ("Gravando"/"Cancelar"/"Parar"); timer `0:00–0:59` (`formatElapsedMs`, sem `00:`), `tabular-nums`.
6. **Enter (§13):** confirmado — não há `onKeyDown`; Enter e Shift+Enter criam nova linha (comportamento nativo); somente o botão `[➤]` envia. `sanitizeInput`, `MAX_MESSAGE_LENGTH=500`, loading/streaming/histórico intactos.
7. **Resposta da assistente (§12):** mantida em largura integral `w-full bg-transparent border-0 shadow-none rounded-none px-1 py-2 text-left` (sem card/borda/raio); balão do usuário continua diferenciado (`max-w-[75%] bg-[#1A3B2B]`).
8. **Instrumentação temporária de crescimento (§5/§6):** efeito `[CHAT_DEBUG] composer metrics` atrás de `NEXT_PUBLIC_CHAT_DEBUG === '1'` — registra `scrollHeight/clientHeight/offsetHeight/rect` do textarea, altura do Composer/Conversation/Panel e viewport (`innerHeight`, `documentElement.clientHeight`, `visualViewport.height/offsetTop`) a cada mudança de texto/foco. **Não loga conteúdo digitado** (apenas métricas). Para ativar na validação: build com a flag (não fica ligada em produção sem a flag).
9. **Preservado:** anexos (menu Tirar foto/Galeria/Arquivo + 3 inputs), drag bottom-sheet (threshold 100, sem mover conteúdo atrás), 3 sugestões (Free/Premium), safe-area, acessibilidade (aria-labels, alvos ≥44px, `role=log`, `role=dialog`, TalkBack preservado pelo textarea único).

## 2. Validação técnica executada

```text
npx vitest run        → 31 arquivos, 460 testes, TODOS PASSAM (exit 0)
npx tsc --noEmit      → 0 erros (exit 0)
npm run build         → sucesso, 28 rotas (exit 0)
```

## 3. Android Realme — NÃO VALIDADO

Ambiente desta sprint **não possui dispositivo Realme físico**. Validação A–AL (§21) e capturas obrigatórias (§22) **pendentes** — não foram inventadas nem simuladas.

**Causa raiz do "crescimento ~2 linhas":** permanece **não confirmada** (consistente com CHAT-UX-005 §7). Hipóteses a discriminar no dispositivo com a instrumentação ativa (flag `NEXT_PUBLIC_CHAT_DEBUG=1` no build usado no Realme):
- H1 — teclado Chrome Android sobrepondo o painel `fixed` (viewport sem `interactive-widget=resizes-content`): registrar `panel.bottom` vs `visualViewport.height/offsetTop` com teclado aberto;
- H2 — clip interno por ancestral: nenhum cap estático foi encontrado; se persistir com teclado fechado, os logs de `scrollHeight vs rect` de textarea/pill/conversation/panel indicam o elemento exato;
- H3 — percepção/estado (idle antigo ~124px com piso de foco) — mitigado estruturalmente nesta sprint (idle real de 1 linha; sem piso).

**Correção de teclado (`interactive-widget=resizes-content`) NÃO aplicada** — a sprint exige diagnóstico no dispositivo antes de qualquer correção global (meta viewport afeta o app inteiro); decisão fica para a rodada de validação com base nas medições.

## 4. Capturas

Nenhuma (sem dispositivo). Anexar na validação: idle, foco, 3 linhas, 5 linhas, scroll, voz, resposta assistant, painel full-width.

## 5. Próximo passo

Rodada de validação no Realme (A–AL + capturas + logs `[CHAT_DEBUG]`). Somente após `VALIDATED`: commit/push/deploy.

---

**CHAT-UX-006**

Status: `IMPLEMENTED_NOT_VALIDATED`
Testes: 460/460 (31 arquivos)
TypeScript: PASS
Build: PASS
Android Realme: NÃO EXECUTADO (sem dispositivo neste ambiente)
Causa raiz do crescimento: não confirmada — instrumentação adicionada (`NEXT_PUBLIC_CHAT_DEBUG`); H1 (teclado sobre painel fixed) permanece a hipótese dominante para o cenário de digitação
Correção aplicada: idle compacto 1 linha ↔ edição (grid), full-width mobile, Parar verde, header 1 linha, voz/waveform/timer, Enter=só nova linha, resposta full-width, sem pisos de altura
Capturas: pendentes (A–AL)
Commit: NÃO
Push: NÃO
Deploy: NÃO
