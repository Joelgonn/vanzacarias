# TTS-PROD-FIX-001 — Evidência física RMX3461 (E2E pós-deploy) e app-close por OOM

> Registro de fatos da validação física (regra FIX-001: app-close é apenas REGISTRADO,
> não investigado/corrigido nesta sprint). Dispositivo: RMX3461 (`13f8f6a9`, Android 11,
> WebView Chrome 151.0.7922.199), APK debug `br.com.vanusazacarias.nutri` (95.856.556 B).

## 1. Deploy autorizado e confirmado

- Commit único autorizado: `6d5df07 fix(tts): desbloquear AudioContext no gesto antes do
  autoplay (TTS-PROD-FIX-001)` → `origin/main` (Vercel). Fingerprint do HTML de produção
  mudou ~72 s após o push.
- **Código corrigido confirmado em execução no WebView do device**: o chunk
  `https://vanzacarias-mu.vercel.app/_next/static/chunks/4776.b9699d4e68300975.js`
  (carregado pela página no device) contém o marcador do FIX-001 (`toque/enviar` /
  `para desbloquear` do erro de unlock).

## 2. E2E físico executado (sessão real, sem simular login)

- `/dashboard` carregado com sessão autenticada real do usuário no device.
- Chat aberto (`role=dialog[aria-label="Assistente Nutri Van"]`); TTS **já ativado**
  (preferência persistida; botão `aria-pressed=true` → o unlock do fluxo real é o gesto
  do **Envio**, gatilho A do FIX-001).
- Envio real via botão (gesto CDP): resposta do assistente gerada; UI transita para
  `Preparando áudio...` (controller iniciou o carregamento do TTS sob o código novo).

## 3. App-close reproduzido (determinístico 3/3) — OOM no provisionamento do modelo

Em 3 execuções independentes (force-stop + relaunch entre elas), o processo morre
**sempre** ~1–3 s após `Preparando áudio...`, no provisionamento do modelo TTS
(cache de assets via bridge Capacitor/Filesystem), com:

```
java.lang.OutOfMemoryError: Failed to allocate a 150994952 byte allocation with
25165824 free bytes and 72MB until OOM, target footprint 351358696,
growth limit 402653184
Process: br.com.vanusazacarias.nutri  (dumpsys: VmSize 31692108 kB)
```

- Alocação falhada = **150.994.952 B ≈ 144 MB** (≈ base64 do modelo Kokoro Q8 ~92 MB)
  sobre heap Java já em ~335 MB de 402 MB (growth limit).
- Stack: propagação via `WebMessageListenerAdapter.onPostMessage` (ponte WebView↔nativo,
  Capacitor) → `StartupManager reason=crash exceptionClass=java.lang.OutOfMemoryError
  packageName=br.com.vanusazacarias.nutri` → `ActivityManager: Process ... has died`.

### Interpretação (fatos, sem investigação adicional)
- Ocorre na **camada de provisionamento/cache de assets do TTS** (download + escrita via
  Capacitor Filesystem), **anterior à síntese/playback** e **compartilhada com o código
  antigo** — não é causado pelo FIX-001 (unlock/autoplay).
- Reproduzível porque a reinstalação do APK debug deixou o cache de assets ausente
  (primeiro uso), forçando o download do modelo completo via ponte → heap insuficiente
  (limite de crescimento 402 MB sem `largeHeap`).
- Validações físicas anteriores concluídas com áudio tinham o cache já presente.

## 4. Consequência para a validação do FIX-001

- **Áudio E2E físico pós-deploy: BLOCKED** por esse OOM pré-existente no device nesta
  condição (cache ausente) — o fluxo não alcança síntese/playback para ouvir o TTS.
- O que ficou comprovado fisicamente com o código corrigido: sessão real + envio real +
  controller entra em `Preparando áudio...` sob o bundle novo (marcador presente), sem
  erro de unlock — consistente com os probes de política (este WebView não restringe
  Web Audio; ctx nasce `running`).
- A correção de autoplay em si está coberta por: testes unitários (603/603), Chromium
  real A–E (sem flag) e o deploy confirmado do bundle corrigido.

## 5. Arquivos de suporte

- `docs/TTS-PROD-FIX-001-CHROMIUM-EVIDENCE.json` (A–E PASS).
- `docs/TTS-PROD-FIX-001-ANDROID-POLICY-PROBE.json` / `...-FRESH.json` (WebView sem
  restrição de user activation p/ Web Audio).
- Logcat acima reproduzido em `2026-09-09 15:12/15:14` (hora do device) — 3 ocorrências.
