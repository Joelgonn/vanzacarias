# COMPOSER-001 — Refatoração UX do Composer

**Sprint:** COMPOSER-001 — UX/UI do Composer de mensagens, reproduzindo o comportamento estrutural do Composer do ChatGPT: **um único container** (textarea + controles) que cresce verticalmente com o texto, com altura máxima + scroll interno e ações ancoradas na parte inferior.
**Data:** 2026-09-05
**Base:** VOZ-012.5 `IMPLEMENTED_NOT_VALIDATED` (389 testes verdes — 30 arquivos). Sprints de voz encerradas (VOZ-012 → VOZ-012.5). Esta sprint **não é de voz**.
**Tipo:** Refatoração exclusiva de UX/UI/layout do Composer. Nenhuma mudança em voz, Vosk, `voiceController`, `useVoiceInput` (exceto zero), anexos, envio, API, backend, RAG, prompts, cache, modelo.
**Status:** `IMPLEMENTED_NOT_VALIDATED` — implementação completa, 406 testes verdes (31 arquivos), `tsc --noEmit` 0 erros, build 28 rotas; validação Android física pendente (Testes A–I) para elevar a `VALIDATED · DEPLOYED · COMMITTED`.
**Regra:** não iniciar outra sprint automaticamente; apresentar somente este relatório e aguardar a validação; nenhum commit antes da validação física.

---

## 1. Status

`IMPLEMENTED_NOT_VALIDATED` — aguardando validação Android (realme RMX3461, Testes A–I de §20). Não commitado.

## 2. Componente(s) identificado(s)

O Composer real é o `ChatAssistant.tsx` (`src/components/ChatAssistant.tsx`, `'use client'`, 952 linhas) — widget de chat com painel e **Composer embutido no próprio arquivo** (textarea + anexar + microfone + enviar, linhas ~805–917). Não existe um componente Composer separado. Não havia outro componente de mensagem.

## 3. Estrutura anterior

Já existia uma "pill" única (`rounded-[2rem] bg-stone-50`), porém:
- alinhamento `items-center` → os botões **centralizavam verticalmente** quando o textarea crescia com várias linhas (contrário à referência e ao §6);
- auto-grow duplicado (inline no `onChange` + `useEffect`) com `maxH` literal `200` espalhado e **sem recalcular em resize/orientação/teclado**;
- sem `min-w-0` no textarea (risco de overflow horizontal em 320px);
- sem padding inferior seguro para a área de gestos do Android (safe-area).

## 4. Estrutura nova

Um único container (pill) envolvendo textarea e controles, com ações ancoradas na base:

```
Composer (pílula única, rounded-[2rem], bg-stone-50)
├── anexar/imagem  (min-w-[44px], botão)
├── microfone      (min-w-[44px], botão; cancelar durante gravação)
├── textarea       (flex-1 min-w-0, sem caixa própria)
└── enviar         (min-w-[48px], botão)
```
- Ações ancoradas no rodapé: `items-end` na pill (mantém botões na parte inferior quando o texto cresce — §6).
- Composer externo com `pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4` para não ficar cortado pela barra de gestos.
- Sem segunda "caixa" para o textarea (nenhum wrapper/borda própria).

## 5. Estratégia de auto-grow

Uma única rotina `resizeComposer()` mede **linhas reais renderizadas** via `scrollHeight` (inclui quebra automática por largura — não é contagem de caracteres):
1. `style.height = 'auto'` (descola de altura anterior);
2. lê `scrollHeight` após o reflow;
3. aplica `style.height = min(scrollHeight, max)` (clamp no limite);
4. `overflow-y` = `'auto'` se passou do limite, senão `'hidden'`.

Disparos:
- **Digitar/apagar/colar/transcrição de voz** → `onChange` (síncrono, sem layout jump) + `useEffect` em `[state.input]` (pós-render, cobre inserções programáticas e limpeza);
- **Largura/orientação/teclado** → listener em `window resize`, `orientationchange` e `visualViewport resize` (teclado/rotação) com cleanup;
- Envio limpa o input → efeito recua o Composer.

## 6. min-height

- Textarea: `min-h-[44px]` (altura confortável para toque, uma linha).
- Botões: `min-w-[44px] h-[44px]` (anexar/microfone) e `min-w-[48px] h-[48px]` (enviar).
- Estado inicial = uma linha + padding da pill (compacto, controles visíveis).

## 7. max-height

- `COMPOSER_MAX_HEIGHT = 200` (constante única, mesma do `max-h-[200px]`) — baseado na altura já validada no VOZ-012, adequada para desktop e mobile; não pequena arbitrariamente. O valor deve ser verificado no Android (Teste D/I) e ajustado se a medição real indicar necessidade (documentado, sem mudança arbitrária).

## 8. Estratégia de scroll

- Abaixo do limite: `overflow-y: hidden` (escondido — o Composer cresce).
- No limite: `overflow-y: auto` (scroll interno; a página não cresce; controles continuam fora da área rolável, dentro da pill).
- `resize-none` (sem alça manual) + `min-w-0` (sem overflow horizontal em 320px).

## 9. Posicionamento das ações

`items-end` na pill: anexar, microfone (e cancelar) e enviar permanecem **sempre na parte inferior** do Composer, mesmo com 4+ linhas — comportamento da referência do ChatGPT (§6/§8). O textarea cresce acima delas.

## 10. Arquivos alterados

- `src/components/ChatAssistant.tsx` — única alteração de lógica/layout do Composer.
- `src/components/__tests__/composerCOMPOSER001.test.ts` — **novo** (T-COMP-1..T-COMP-12).
- Nada em `useVoiceInput.ts`, `voiceController.ts`, Vosk, anexos, envio, API, backend, RAG, prompts, cache, modelo, auth, PWA, config.

## 11. Testes adicionados

`composerCOMPOSER001.test.ts` (padrão do projeto: vitest node, inspeção de fonte — não há jsdom/RTL instalado; o comportamento **visual** é coberto pela validação Android):
- **T-COMP-1** — vazio: `min-h-[44px]`, `rows={1}`, controles visíveis (aria-labels de anexar/microfone/enviar).
- **T-COMP-2** — 1 linha: compacto (1 linha + min 44px; sem `min-h-[132px]`).
- **T-COMP-3** — multi-linha: UMA pill com rounded-[2rem] contém anexar, microfone, textarea e enviar; texto dentro do mesmo container; só 1 `<textarea>` no arquivo.
- **T-COMP-4** — ultrapassa max: `COMPOSER_MAX_HEIGHT = 200` + `max-h-[200px]` + clamp `Math.min(scrollHeight, maxH)` + branch `overflowY` auto/hidden + `resize-none`.
- **T-COMP-5** — apagar: efeito `[state.input]` + `setInput` → recua.
- **T-COMP-6** — colar: `onChange` recalcula (`setInput` + `resizeComposer`).
- **T-COMP-7** — transcrição longa: `onTranscript` → `setInput(prev => ...)` preserva texto + efeito recalcula.
- **T-COMP-8** — anexo: `type="file"`, `accept="image/*"`, `handleImageSelect`, preview, remover — intactos.
- **T-COMP-9** — enviar: `onClick={handleSend}`, disabled `!hasContent`/isLoading, spinner — intactos.
- **T-COMP-10** — Enter/Shift+Enter: Enter sem Shift envia; Shift não envia.
- **T-COMP-11** — mobile: `min-w-0`, `w-full`, áreas de toque ≥44/48px, responsivos `sm:` intactos, sem overflow horizontal.
- **T-COMP-12** — regressão: invariantes de voz (`useVoiceInput`, cronômetro, estados PROCESSANDO/TRANSCRIBENDO, cancelar) e de anexo/enviar permanecem.

## 12. Suíte completa

`npx vitest run` → **31 arquivos, 406 testes, todos verdes**. Quantidade anterior: 389; atual: 406; novos: 17; resultado: sucesso. Duração ~7s. Nenhum teste de voz regredido.

## 13. TypeScript

`npx tsc --noEmit` → **0 erros**.

## 14. Build

`npm run build` → **sucesso, 28 rotas** (estáticas + Proxy Middleware), com o warning pré-existente de precache (~5.8MB). Sem mudanças em `next.config.ts`.

## 15. Validação Android (pendente — realme RMX3461)

Via `https://192.168.70.75:3001`:
- **A** — Composer vazio: tamanho/aparência em 1 linha.
- **B** — uma linha: digitar mensagem curta.
- **C** — 2–4 linhas: quebra em várias linhas; cresce; controles dentro e na parte inferior.
- **D** — texto muito longo: atinge o limite; scroll interno; enviar acessível.
- **E** — apagar: Composer recua.
- **F** — voz: transcrição multi-linha → Composer cresce, sem perda de texto.
- **G** — anexo: funcionalidade preservada.
- **H** — envio: comportamento preservado.
- **I** — teclado aberto: sem layout quebrado; Composer não cortado; sem overflow horizontal; medir se o `visualViewport` recalcula a altura.

## 16. Testes de voz

Nenhuma lógica alterada. `useVoiceInput`, controller, Vosk e engine intactos; mic movido dimensionalmente dentro da pill (nada funcional mudou). Regressão: testes VOZ-012.x e T-COMP-7/T-COMP-12 verdes na suíte completa + validação Android F.

## 17. Testes de anexos

Botão, input file, compressão (`compressImage`), preview, remoção e envio intactos — apenas reposicionamento visual na pill (T-COMP-8 + validação G).

## 18. Testes de envio

Enter/Shift+Enter, botão enviar, disabled, loading, vazio/com anexo/longo — inalterados (T-COMP-9/10 + validação H).

## 19. Riscos residuais

- Altura máxima 200px é a validada no VOZ-012; se o Android apontar necessidade de aumento para mensagens longas, é mudança cosmética de uma constante (a ser feita após medição real, nunca arbitrária).
- `visualViewport` resize dispara apenas em navegadores que o suportam (Chrome Android sim); fallback `window resize`/`orientationchange` cobre o restante.
- Com o teclado aberto num painel `fixed` (sem viewport `interactive-widget=resizes-content`), o Chrome Android **sobrepõe** o teclado sobre o rodapé (pré-existente; mitigado por listener e safe-area). Mudança de `interactive-widget` é global ao app — fora do escopo desta sprint (§20) e a verificar no Teste I.
- Painel ainda é um sheet fixo (não in-page): se o teclado cobrir, logar e documentar — sem correção fora do escopo.

## 20. Problemas fora do escopo

- Teclado sobreposto ao painel fixo por `interactive-widget` do viewport (afeta todo o app; requer mudança global de meta e validação ampla — **documentado, não corrigido**).
- Segundo `<textarea>` em `CheckinForm.tsx` (fora do escopo do Composer; intacto).
- Composer não existe em `/dev/voice-test` (página de laboratório STT sem chat — referência da própria página "sem ChatAssistant").
- Qualquer alteração de voz, Vosk, STT, cache, backend, RAG, prompts, auth — proibidas nesta sprint e não realizadas.

## 21. Commit

**Nenhum commit realizado.** VOZ-012.3/012.4/012.5 e COMPOSER-001 seguem sem commit até as respectivas validações físicas e conversão para `VALIDATED · DEPLOYED · COMMITTED`. Não iniciamos outra sprint.