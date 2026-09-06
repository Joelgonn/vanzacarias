# CHAT-UX-005 — AUDITORIA DE CONFORMIDADE VISUAL E INTERAÇÃO

**Modo:** AUDIT / PLAN ONLY — nenhum código, teste, configuração, commit, push ou deploy foi realizado.
**Base de verificação:** HEAD `27cf4a6` (CHAT-UX-004); `src/components/ChatAssistant.tsx` (1083 linhas, lido integralmente); `src/components/__tests__/composerCOMPOSER001.test.ts` (651 linhas); `src/app/globals.css`; `tailwind.config.ts`; `src/app/layout.tsx`; `src/lib/voice/useVoiceInput.ts`; relatórios `docs/CHAT-UX-001-AUDIT.md`, `CHAT-UX-002-REPORT.md`, `CHAT-UX-003-REPORT.md`, `CHAT-UX-004-REPORT.md`, `COMPOSER-001-REPORT.md`, `COMPOSER-001.1-REPORT.md` (lidos integralmente).
**Limitação de evidência:** não há screenshot dentro do repositório. Toda "evidência visual" citada é DOC-REPORTADA (descrições de capturas do Realme RMX3461 nos relatórios CHAT-UX-003/004). Esta auditoria não executou teste em dispositivo.

---

## 1. Executive Summary

A cadeia COMPOSER-001 → COMPOSER-001.1 → CHAT-UX-001/002/003/004 produziu código + suítes verdes (406→449 testes) afirmando corrigir exatamente os sintomas que o Realme continua exibindo (caixa interna/contorno verde, crescimento "limitado a ~2 linhas", resposta em caixa estreita). Causa sistêmica, provada pelos próprios relatórios:

1. **Nenhuma validação Android formal foi executada** em toda a cadeia — cada sprint declara "Validação Android A–x: NÃO EXECUTADA" e termina `IMPLEMENTED_NOT_VALIDATED`. As correções reagem a capturas ad-hoc de builds anteriores, nunca validam a própria.
2. **Os testes são 100% estáticos** (regex sobre strings de classe via `fs.readFileSync` + `toMatch`); não há jsdom/RTL/Playwright. Os números "44/68/93/117/141/200px" são valores esperados por inspeção, nunca medidos em browser/dispositivo.
3. Análise estática do código ATUAL: a composição-alvo está majoritariamente implementada (dock transparente; pill única; textarea sem borda/ring/fundo; mensagem da assistente `w-full bg-transparent`; Enter = nova linha; 3 sugestões; menu de anexo 3 opções; drag isolado). As divergências reais com explicação estática são: **margens laterais mobile** (`max-w-[min(440px,calc(100vw-32px))]` sem prefixo `sm:` — cimentada pelo teste F-01) e o **cenário "crescimento limitado"** (sem cap estático no CSS; hipótese dominante = teclado do Chrome Android sobrepondo o painel `fixed`, ausência de `interactive-widget=resizes-content`).

Regra aplicada: **nenhuma afirmação de comportamento visual pode ser considerada validada por teste unitário/regex/inspeção estática** — separar explicitamente "código implementado" de "comportamento visual comprovado".

## 2. Estado atual

HEAD `27cf4a6`. ChatAssistant é o único Composer (nenhum componente separado). Acumulado até CHAT-UX-004: shell mobile/desktop (420–440px desktop), header nutri, conversation com mensagens da assistente em largura integral, Composer vertical single-surface, voz em linha única (×/●/waveform/timer/■), menu de anexo, drag bottom-sheet, 3 sugestões, Enter = nova linha (verificado: **zero** `onKeyDown` no arquivo). Validação Android A–AE: **pendente**.

## 3. Evidências

- Código: todos os classNames da região do chat conferidos (linhas em §4).
- Testes: 651 linhas de assertions de fonte (detalhe em §21).
- Relatórios: nenhum promovido a `VALIDATED`; matrizes Android A–I / A–O / A–AB / A–AE todas "NÃO EXECUTADA"; capturas descritas pertencem a builds anteriores ao código atual.
- Números de altura declarados nos relatórios = projeção de inspeção, não medição.

## 4. DOM real do ChatAssistant (linhas atuais)

- Overlay `:703`: `fixed inset-0 z-[60] flex items-end justify-center sm:items-end sm:justify-end sm:p-8 bg-stone-900/30 backdrop-blur-sm` (dismiss ao clicar fora).
- Painel `:708-719`: `w-full sm:w-[420px] lg:w-[440px] max-w-[min(440px,calc(100vw-32px))] h-[85vh] h-[85dvh] sm:h-[min(600px,85dvh)] max-h-[800px] bg-white rounded-t-3xl sm:rounded-3xl shadow-premium border border-stone-100 flex flex-col overflow-hidden animate-slide-in-bottom` + drag `onTouchStart/Move/End` + `style.transform translateY(dragY)`.
- Handle mobile `:721-728` (`touch-none`, `w-8 h-1 bg-stone-300`).
- Header `:730-792`: `bg-nutri-900 bg-[#1A3B2B] px-4 py-3`; avatar 40px `:732`; linha 1 `:742-754` (Nutri Van + badge Premium/Gratuito); **linha 2 `:755-767` = dot pulsante verde + texto** ('Assistente IA da Nutri' / 'De olho em você' / 'Online agora'); direita `:771-791` WhatsApp (ícone) + X `w-11 h-11`.
- Conversation `:794`: `flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto space-y-4 bg-white scrollbar-hide role="log" aria-live="polite"`.
- Mensagens `:836-857`: usuário `max-w-[75%] bg-[#1A3B2B] text-white rounded-2xl rounded-tr-sm …`; **assistente `w-full bg-transparent border-0 shadow-none rounded-none px-1 py-2 text-stone-800 text-left`**; streaming `:859-864` idem; loading com borda `:865-878`.
- Dock `:881`: `p-2 sm:p-3 shrink-0 relative z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3` — **transparente (sem bg/border/shadow)**.
- Pill/Composer `:883`: `flex flex-col w-full bg-white p-2.5 rounded-3xl border border-stone-200 shadow-sm transition-all min-h-0` + ternário `` (recording: `min-h-[68px] justify-center`) | (foco||conteúdo: `min-h-[120px]`) | (idle: `min-h-[68px] justify-center`) ``.
- Textarea `:943-957`: `w-full min-w-0 bg-transparent border-0 focus:border-0 focus:ring-0 focus:outline-none ring-0 outline-none shadow-none px-1 text-[15px] … leading-[1.6] min-h-[44px] max-h-[200px] resize-none overflow-y-auto`; `py-2.5`; placeholder centralizado no idle; **sem `onKeyDown`**.
- Ações `:959-1055`: barra `flex items-center justify-between pt-2 mt-2`; menu anexo `:961-998`; inputs `:1000-1021` (galeria `image/*`, câmera `capture="environment"`, arquivo `*/*`); microfone `:1023-1036`; enviar `:1039-1054` (`bg-nutri-800 bg-[#2A5C43]`).
- Gravação `:907-940`: X cancelar (cinza) | grupo central `flex-1 … justify-center` (dot `●` rose pulsante `:918`, waveform 9 barras `max-w-[160px]` `:919-929`, timer `:930`) | **Parar `:932-939`: `bg-rose-600 text-white … w-11 h-11` + `Square size 12`**.
- Auto-grow: `resizeComposer` `:560-567`; efeito `[state.input]` `:569-573`; listeners `:575-585`; `COMPOSER_MAX_HEIGHT = 200` `:96`.
- Drag `:597-623` (mobile <640px; `delta>0` → `dragY`+`preventDefault`; threshold 100 fecha).
- Sugestões `:102-112`: **3 free + 3 premium** (Evolução / Priorizar hoje / Analisar refeição).
- Voz `useVoiceInput.ts`: `status`, `recordingElapsedMs` (cronômetro só em `recording`, `:49-67`), `formatElapsedMs = M:SS` sem zeros de minuto (`:19-25`), `isBusy` inclui `processing`/`transcribing` (`:108`).

## 5. CSS/Tailwind relevante

- `layout.tsx` viewport: `themeColor #1A3B2B`, `width=device-width`, `initialScale:1`, `maximumScale:1`, `userScalable:false` — **sem `interactive-widget`, sem `viewport-fit`**.
- `tailwind.config.ts`: paleta nutri (900 #1A3B2B, 800 #2A5C43, …); `boxShadow.premium`; animações; não define `pulse-soft`/`slide-in-bottom` (definidos manualmente no globals.css).
- `globals.css`: scrollbars; keyframes `pulse-soft`/`slide-in-bottom`/etc.; **nenhuma regra que afete textarea/composer** (grep).
- Preflight Tailwind: `box-sizing: border-box` global.

## 6. Composer — análise estrutural

Cadeia: Panel(flex-col, overflow-hidden) → [header shrink-0 | conversation flex-1 min-h-0 | dock shrink-0 + safe-area] → Pill(flex-col `bg-white border rounded-3xl`) → [textarea | barra de ações `pt-2 mt-2` | status voz]. Textarea e ações são **irmãos na mesma pill** (superfície única); dock transparente; sem `border-t` interno; sem `focus-within:ring`; textarea sem borda/ring/outline/fundo. Estrutura confere com o alvo "um container + textarea + ações".

## 7. Composer — causa do limite de duas linhas

**Não determinável com segurança por inspeção estática (regra §24 — não inventar causa).** Hipóteses ranqueadas + instrumentação mínima:

- **H1 (cenário "digitando, teclado aberto") — teclado do Chrome Android sobrepõe o painel `fixed`.** Painel `fixed inset-0` + viewport **sem `interactive-widget=resizes-content`** ⇒ o layout viewport não encolhe; o teclado desenha sobre o rodapé; a porção visível do Composer acima do teclado comporta ~1–2 linhas, independentemente do `height` inline do textarea. Risco documentado pelo próprio projeto (COMPOSER-001-REPORT §19/20; CHAT-UX-001 S-08 CRÍTICO). Explica "scrollHeight 141 no DOM vs ~2 linhas visíveis" **sem nenhum clip interno no CSS**.
- **H2 (teclado fechado) — não existe cap estático de 2 linhas no código atual.** Nenhum ancestral (textarea→pill→dock→conversation→panel) tem `max-height` < conteúdo; conversation `flex-1 min-h-0` absorve; `max-h-[200px]` só no próprio textarea. Se uma captura com teclado fechado ainda mostrar 2 linhas, a causa **não está no CSS atual** → contradiz a premissa e exige medição (ou a captura era de texto curto).
- **H3 — percepção/geometria:** as ações ocupam linha própria sempre visível e a pill idle já mede ~124px (§8), reduzindo o espaço percebido para texto; com 1 linha digitada o Composer focado tem piso `min-h-[120px]` → visual de "campo alto com pouco texto".
- **H4 — instrumentação anterior inexistente:** números 44/68/93/117/141/200 foram declarados "DOM real" sem browser; são projeções.

**Elemento provável que "impede o crescimento percebido" (se H1 confirmar):** a janela/browser (teclado sobre painel fixo), não textarea/wrapper/pill/dock/conversation/panel/CSS global. Correção mínima candidata a validar: viewport `interactive-widget=resizes-content` (efeito global) **ou** painel limitado a `visualViewport.height` enquanto o teclado abre.

**Instrumentação mínima obrigatória (especificação):** no Realme via `chrome://inspect`, com 1/3/5 linhas e teclado aberto/fechado, coletar por elemento: `clientHeight`, `offsetHeight`, `scrollHeight`, `getBoundingClientRect()` (textarea, pill, dock, conversation, panel), `innerHeight`, `visualViewport.height/offsetTop`, `document.documentElement.clientHeight`, estado do teclado, `elementFromPoint` no rodapé. Identificar em qual retângulo o texto visível termina.

## 8. Composer — cálculo de altura

Linha = 15px × `leading-[1.6]` = **24px**; textarea ≈ linhas×24 + 20 (py-2.5); pill ≈ textarea + 60 (mt-2 8 + pt-2 8 + barra 44) + 20 (p-2.5). **Pill idle ≈ 124px** (conteúdo > min-h 68 ⇒ o piso idle é inócuo; testes "COMPOSER-UX-01 min-h 68/72" verificam só a classe, não a altura real). 5 linhas ≈ pill ~220px. Texto >200px ⇒ textarea 200 + scroll interno. Regras atuais coerentes (`COMPOSER_MAX_HEIGHT=200` + `max-h-[200px]` + JS `min(scrollHeight,200)`).

## 9. Composer — espaçamento vertical

Fontes no idle/foco: dock p-2 (8) + safe-area pb (≥12) + pill p-2.5 (20) + textarea py-2.5 + barra `mt-2 pt-2` (16) + botões 44 + **piso `min-h-[120px]` em foco/conteúdo** ⇒ estado focado ≈ ≥124px mesmo com 1 linha. Meta do usuário: idle compacto e crescimento por conteúdo. Redução mínima proposta (especificação): remover o piso de foco `min-h-[120px]`, reduzir `pt-2 mt-2` (ex.: 8px/0 ou gap), validar idle 72–88px no Realme.

## 10. Composer — espaçamento horizontal

**Causa estática CONFIRMADA das margens laterais mobile:** painel `:710` com `max-w-[min(440px,calc(100vw-32px))]` **sem prefixo de breakpoint** → no mobile (`w-full`) a largura vira `100vw−32px` (16px de margem em cada lado), centralizado pelo overlay `justify-center`. O teste F-01 (`composerCOMPOSER001.test.ts:365`) **cimenta a classe** — "testes verdes" com o comportamento errado. Correção mínima (especificação): remover o `max-w-*` base (mobile = `w-full`, colado nas bordas) e aplicar o teto somente em `sm:` (`sm:w-[420px] lg:w-[440px]` já existem; adicionar `sm:max-w-[440px]` ou equivalente); manter `rounded-t-3xl` mobile (cantos superiores) e `sm:rounded-3xl`. Desktop 420–440 inalterado. Atualizar F-01/STRUCT.

## 11. Composer — single surface

Código atual = **1 superfície**: dock transparente (`:881`), pill única `bg-white border border-stone-200 rounded-3xl shadow-sm`, textarea `bg-transparent border-0 ring-0 outline-none shadow-none`, sem `focus-within:ring` (removido no CHAT-UX-004). O painel (card branco `border-stone-100`) é o contêiner do chat, não uma segunda superfície do Composer. A "caixa dentro de caixa" **não existe mais no código**. Pendente: validação Realme do critério C (foco sem contorno verde) — se o Android pintar foco nativo, tratar com CSS de foco (o textarea já tem `focus:outline-none`).

## 12. Composer — foco

`onFocus/onBlur` → `isComposerFocused` (`:946-947`); classes anti-contorno no textarea; pill sem ring; placeholder centralizado quando idle (`text-center placeholder:text-center`); piso `min-h-[120px]` ao focar (§9). Sem contorno verde no código atual.

## 13. Voz — estrutura

Gravação (`:907-940`): pill troca para linha única `[X cancelar 44px] [grupo central flex-1 justify-center: ● rose pulsante + waveform 9 barras max-w-[160px] + timer M:SS] [■ parar 44px bg-rose-600]`; pill `min-h-[68px] justify-center`. Fora da gravação: mic `:1023-1036`; estados Processando/Transcrevendo/Preparando + erros `:1059-1074`.

## 14. Voz — distribuição horizontal

Atual: X (44) | centro `justify-center` (dot+waveform+timer agrupados, waveform limitado a 160px) | ■ (44). Alvo do usuário: X esquerda, ■ direita, **waveform elástico no centro**, timer compacto logo após o waveform (sem reserva para `00:00`). Gap: em telas largas sobra espaço simétrico vazio; melhorar com `space`/layout onde waveform ocupa o espaço flexível e timer fica à direita (P1).

## 15. Header

Atual `:730-792`: linha 1 = avatar 40 + `Nutri Van` + badge; **linha 2 (`:755-767`) = dot + texto de status**. Alvo: remover linha 2 e texto; dot verde pulsante pequeno **inline após "Nutri Van"**; manter badge Premium/Gratuito e botões WhatsApp/X. Mudança localizada `:741-768`. Atualizar testes F-03/R-02 que referenciam o status `text-[10px] text-white/60`.

## 16. Mensagens

Código atual: assistente `w-full bg-transparent border-0 shadow-none rounded-none px-1 py-2 text-left` (`:838-842`, streaming `:859-864`) — sem card, sem borda cinza, largura integral, alinhada à esquerda, Markdown preservado; usuário `max-w-[75%] bg-[#1A3B2B]`. A captura "caixa estreita" era do CHAT-UX-002 e **já foi removida no código** (sem validação Android — critérios V/W/X). Nenhuma mudança de código prevista; se o dispositivo ainda mostrar caixa, instrumentar (não há wrapper limitante hoje).

## 17. Sugestões

`QUICK_ACTIONS_FREE`/`_PREMIUM` = **3 itens** (`:102-112`), sem rotação/contexto — conforme alvo. Evolução futura separada (P2): Smart Suggestions com catálogo 10–12, exibição de 3, seleção contextual+rotação+anti-repetição.

## 18. Anexos

Menu `:961-998` com "Tirar foto" (`capture="environment"`), "Escolher da galeria" (`image/*`), "Arquivo" (`*/*`) — exatamente o alvo; `capture` não é usado isoladamente; anexo oculto durante gravação. Fluxo compressão/preview/remoção intacto. Validação Android pendente (AA/AB).

## 19. Drag

Implementado `:597-623` + handlers no painel e handle; mobile <640px; `delta>0` → `dragY` + `preventDefault`; threshold 100; transform só no painel; sem listeners globais. Riscos estáticos: (a) handlers no painel inteiro — puxar para baixo com conversation no topo pode fechar em vez de rolar (restringir ao handle ou exigir `scrollTop<=0`); (b) `dragY` em closure no `handleTouchEnd` (estado assíncrono) — preferir ref do delta. Proposta P1.

## 20. Mobile viewport

Painel `fixed inset-0` `h-[85vh] h-[85dvh]`; sem `interactive-widget` (H1, §7); `userScalable:false`; safe-area só no dock; sem `viewport-fit=cover` (validar notch em PWA standalone). Largura efetiva mobile hoje = `100vw−32px` (§10).

## 21. Desktop viewport

`sm:p-8 sm:items-end sm:justify-end`; painel `sm:w-[420px] lg:w-[440px] sm:h-[min(600px,85dvh)] max-h-[800px] rounded-3xl shadow-premium`; FAB `fixed bottom-8 right-8`. Não alterar.

## 22. Accessibility

Presentes: dialog/aria-modal, role=log+aria-live, aria-labels, role=menu/menuitem, aria-expanded/haspopup, alvos ≥44px. Riscos: contraste do placeholder (`text-stone-400`/branco ≈ 3:1, risco AA); foco visível do teclado quando composer não focado; timer é decoração com `aria-label` no container (ok).

## 23. Regressões potenciais

Testes estáticos que citam strings alteradas (F-01, STRUCT-*, R-02, COMPOSER-UX-01/05, VOICE-UX-06) precisam de atualização na sprint; layout desktop (proteger com `sm:`); drag (se restringir origem do gesto); botão Parar (somente classes); header admin (remoção de texto de status não afeta função); `interactive-widget` é global (validar app inteiro). Fora de mudança: voz-core, anexos, envio, streaming, backend, RAG, prompts, MAX 500, compressImage, histórico.

## 24. Causa raiz

**P0-1 — textarea "limitado a 2 linhas"**
- Elemento: painel `fixed` + janela/teclado do Chrome Android (provável); nenhum ancestral CSS corta abaixo de 200px.
- Propriedade: ausência de `interactive-widget=resizes-content`; painel ancorado ao layout viewport; `h-[85vh]/[85dvh]`.
- Valor atual: viewport meta sem interactive-widget (`layout.tsx`).
- Efeito: teclado sobrepõe o rodapé; porção visível do Composer ≈ 1–2 linhas.
- Por que limita: o texto cresce abaixo da borda do teclado (invisível); não é CSS interno.
- Correção mínima (validar em device): `interactive-widget=resizes-content` (global) OU painel ≤ visualViewport; remover piso `min-h-[120px]`.
- Se a captura for com teclado fechado: sem causa estática — executar instrumentação §7 antes de corrigir (não "aumentar para 200px").

**P0-2 — margens laterais mobile**
- Elemento: painel (`ChatAssistant.tsx:710`).
- Propriedade/Valor: `max-w-[min(440px,calc(100vw-32px))]` sem prefixo de breakpoint.
- Efeito: largura mobile = 100vw−32px (16px de margem cada lado).
- Correção mínima: mover teto de largura para `sm:`; mobile `w-full` 100vw colado nas bordas; cantos superiores arredondados; desktop 420–440 intacto. Atualizar F-01.

**P0-3 — botão Parar**
- Elemento: `:932-939`.
- Propriedade/Valor: `bg-rose-600 … w-11 h-11` + `Square size 12`.
- Efeito: grande superfície vermelha; semântica de cor invertida (vermelho = ação, verde = estado).
- Correção mínima: fundo verde nutri (`bg-nutri-800 #2A5C43`, hover `#1A3B2B`), quadrado menor, alvo de toque 44×44 mantido; vermelho exclusivo do `●` (`:918`).

**P0-4 — Header**
- Elemento: `:755-767`.
- Propriedade/Valor: segunda linha dot+texto de status.
- Efeito: ruído; duas linhas no header.
- Correção mínima: remover linha/texto; dot pulsante inline após "Nutri Van"; manter badge e ações.

**P0-5 — resposta estreita**
- Código atual já corrigido (`:838-842`, `w-full bg-transparent border-0`). Causa do desvio: CHAT-UX-002 (`max-w-[75%]`+card) — removida. Correção mínima: nenhuma no código; validar V/W/X no device.

**P0-6 — espaço vertical (Composer idle/foco)**
- Elemento: pill + barra de ações sempre visível + piso `min-h-[120px]` + espaçamentos.
- Valor: idle ≈ 124px (arítmetica §8), piso de foco 120px.
- Efeito: Composer alto no estado vazio/1 linha.
- Correção mínima: remover piso de foco, reduzir `pt-2 mt-2` e paddings, validar idle 72–88px.

## 25. Solução mínima recomendada (especificação para CHAT-UX-006)

1. Mobile full-width: sem `max-w-*` base; teto só em `sm:`.
2. Composer cresce por conteúdo: remover `min-h-[120px]`; reduzir `pt-2 mt-2`; idle compacto; manter `min-h-0`, `min-w-0`, auto-grow 200px, scroll interno, textarea transparente `border-0 ring-0`.
3. Botão Parar verde nutri + quadrado menor (alvo 44px); vermelho só no `●`.
4. Header 1 linha `Nutri Van ● [badge]`; remover status/linha 2.
5. Enter já = nova linha; envio só pelo botão (manter).
6. Voz: waveform elástico + timer compacto à direita (P1).
7. Drag: restringir início do gesto ao handle (ou `scrollTop<=0`).
8. Não mudar mensagens/sugestões/anexos/voz-core/backend/streaming.

## 26. Solução ideal recomendada

Painel mobile com gestão de teclado (`interactive-widget=resizes-content` ou acompanhamento de visualViewport — decisão global validada); Composer sem pisos de foco (vazio compacto → 1–5 linhas → scroll >200px); waveform/timer elásticos; acessibilidade (contraste placeholder, foco visível); Playwright smoke desktop (mic fake) para medir crescimento real e overflow — infra de teste de UI como evolução P2.

## 27. O que NÃO alterar

Vosk, `voiceController`, `useVoiceInput`, engine/acumulação de transcrição, streaming NDJSON, backend, RAG, prompts, histórico, `MAX_MESSAGE_LENGTH=500`, `compressImage`, anexos (menu + 3 inputs), lógica de envio, drag funcional, 3 sugestões, painel desktop 420–440, FAB, empty state. Testes não alterados nesta auditoria.

## 28. Plano para a próxima sprint (CHAT-UX-006)

1. Aplicar P0-2/P0-3/P0-4/P0-6 (+ itens §25.6–7 se aprovados) em `ChatAssistant.tsx`.
2. Atualizar testes estáticos afetados (F-01, STRUCT, R-02, COMPOSER-UX-01/05, VOICE-UX-06) e adicionar testes que só passem com a nova estrutura (sem `max-w-*` base; Parar sem `bg-rose-600`; header sem linha 2/"De olho em você"; sem `min-h-[120px]`).
3. Instrumentação no Realme (§7) antes e depois, para confirmar quem limita as linhas (teclado vs CSS) — o "limite de 2 linhas" só vira implementação após essa medição.
4. Rodar `vitest run`, `tsc --noEmit`, `npm run build`; executar A–AE no Realme; promover a `VALIDATED` somente com capturas anexadas.

## 29. Critérios de aceitação (visual, no Realme — captura obrigatória)

A–B: idle compacto (72–88px) + placeholder centralizado, sem contorno/ring no foco. C–H: 1–5 linhas crescendo (teclado aberto E fechado; medições §7 anexadas). I: >200px → scroll interno, ações visíveis/clicáveis. J–M: apagar recua; Enter/Shift+Enter = nova linha; botão envia. N–T: voz — iniciar, waveform central elástico, timer 0:00–0:59 compacto, X cancela, ■ verde pequeno (alvo 44px), sem vermelho no botão, sem textos. V–X: mensagem assistente largura integral sem borda/card; streaming integral. AA–AC: anexos (menu 3 opções) e drag sem mover a página. AD–AE: fechar e 3 sugestões. Mobile: painel colado nas bordas, cantos superiores arredondados; desktop 420–440 inalterado.

## 30. Conclusão

O código atual (CHAT-UX-004) já implementa a maior parte da composição-alvo; a divergência persistente tem causa sistêmica provada: **nenhuma validação Android formal executada** e **testes 100% estáticos** (não medem layout). Divergências com explicação estática concreta: margens laterais mobile (`max-w-[min(440px,calc(100vw-32px))]` no mobile, cimentada por F-01) e sobreposição do teclado sobre painel fixo no cenário de digitação (sem `interactive-widget=resizes-content`). O "limite de 2 linhas" **não tem cap estático no CSS atual** — deve ser medido no dispositivo antes de qualquer correção. Mensagens/sugestões/anexos/drag/Enter-nova-linha já estão conforme o alvo no código; falta validação visual. Recomenda-se CHAT-UX-006 = implementação mínima (P0-2/3/4/6) + instrumentação de crescimento + validação A–AE com capturas. Nenhum comportamento visual deve ser declarado validado por testes unitários.

---

**CHAT-UX-005 AUDIT_COMPLETE**

Documento: `docs/CHAT-UX-005-AUDIT.md`
Código alterado: NÃO
Testes alterados: NÃO
Configuração alterada: NÃO
Commit: NÃO
Push: NÃO
Deploy: NÃO

Principais causas raiz:
1. Margens laterais mobile = `max-w-[min(440px,calc(100vw-32px))]` sem prefixo `sm:` em `ChatAssistant.tsx:710` (teste F-01 cimenta o comportamento errado).
2. "Limite de 2 linhas" sem cap estático no CSS atual; hipótese dominante = teclado Chrome Android sobre painel `fixed` (sem `interactive-widget=resizes-content`); exige instrumentação no Realme — não corrigir "às cegas".
3. Nenhuma validação Android formal executada na cadeia (A–I→A–AE todas "NÃO EXECUTADA") + testes 100% estáticos ⇒ "verde" nunca significou "visual correto".

Próxima implementação recomendada: **CHAT-UX-006**
