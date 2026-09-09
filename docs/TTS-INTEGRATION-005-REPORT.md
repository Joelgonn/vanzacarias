# TTS-INTEGRATION-005 REPORT

## Objetivo

Determinar, com evidência técnica, se o `voice-synthesis` — **Kokoro Q8 (`model_quantized.onnx`) + `pf_dora` + G2P `vozz`** — pode executar diretamente no navegador via `onnxruntime-web`, preservando a arquitetura definida nas sprints anteriores (consumer → orchestrator → voice-synthesis → CORE/RUNTIME). Sprint **diagnóstica/arquitetural**: nenhuma correção aplicada.

Veredito final: **B — Browser Runtime Viable With Changes**.

---

## Escopo

- **App (`vanzacariasnutri`)**: `src/lib/tts/**` (synthesizer, orchestrator, player, useChatTts, chatTtsController), `next.config.ts`, `package.json`.
- **Engine (`voice-synthesis`)**: `src/**`, `package.json`, `tsconfig.json`, runtime Kokoro-vozz, tokenizer, G2P/normalização, síntese, dispose, `wav`.
- **Artefatos reais**: `model.onnx` (310,5 MB), `model_quantized.onnx` (88,1 MB / 92.361.116 bytes), `tokenizer.json` (3,5 KB), `voices/pf_dora.bin` (510 KB), `manifest-kokoro.json`.
- **Consulta**: documentação oficial ONNX Runtime (web, operadores WASM/WebGPU/WebGL, build), npi do modelo quantizado, issues públicas.

---

## D01 — Node Coupling

Mapa `arquivo → import → camada → responsabilidade` (engine, `src/**`):

| Arquivo | Imports Node/ONNX | Camada | Responsabilidade |
| --- | --- | --- | --- |
| `engine/kokoro-vozz-runtime.ts` | `node:fs/promises`, `node:module` (createRequire), `node:path`, `onnxruntime-node`, `import.meta.url` | **RUNTIME** | `KokoroVozzRuntime` (load/synthesize/dispose, sessão ORT) |
| `engine/kokoro.ts` | `node:fs/promises`, `node:module`, `node:path`, `onnxruntime-node` + `kokoro-phonemizer` | **RUNTIME + CORE** | `KokoroRuntime` (espeak sidecar) **e** helpers core: `KOKORO_INFO`, `loadKokoroTokenizer` (fs), `tokenizePhonemes` (puro), `chunkPhonemes` (puro) |
| `engine/kokoro-phonemizer.ts` | `node:child_process`, `node:fs`, `node:module`, `node:path`, `node:readline` | RUNTIME-only | Sidecar Python/espeak (não usado por kokoro-vozz) |
| `engine/vozz-g2p.ts` | nenhum (JS puro; `@pedrobef/vozz/g2p`) | **CORE** | G2P + normalização (kcal pre, vozz normalize/fonemizar) |
| `engine/vozz-runtime.ts` | `node:module`, `node:path`, `onnxruntime-node` | RUNTIME | Piper-vozz (legado, não usado pelo app) |
| `engine/model-server.ts` | `node:http`, `node:fs/promises`, `node:path` | tooling | Servidor de modelos (dev) |
| `metrics.ts` | `node:os`, `process` | tooling | Env info |
| `wav.ts` | nenhum (ArrayBuffer/DataView) | **CORE** | encodeWav/concat/wavInfo/resample |
| `engine/types.ts` | nenhum | **CORE** | `TTSRuntime` (interface), `SynthesisResult`, erros |
| `index.ts` | — (re-export estático de TODOS os acima) | **ENTRY** | API pública |

**Respostas objetivas:**
- Quem importa `onnxruntime-node`: `kokoro-vozz-runtime.ts`, `kokoro.ts`, `vozz-runtime.ts` (**import estático no top-level**), via `import * as ort`.
- Qual camada: exclusivamente **RUNTIME** (os três arquivos de runtime). `vozz-g2p.ts`, `wav.ts`, `types.ts`, `tokenizePhonemes`, `chunkPhonemes`, `KOKORO_INFO` **não** dependem de Node.
- O **core depende do runtime?** Não inversamente: o core é puro; os runtimes consomem o core (vozz, tokenizer, chunk, wav). Kokoro mishmash: `kokoro.ts` exporta core E runtime — o import `node:fs`/`onnxruntime-node` no top-level do arquivo atinge até quem só usa `tokenizePhonemes`/`KOKORO_INFO`.
- **Interface abstrata?** Existe (`TTSRuntime` em `types.ts`), mas **não existe adapter real**: apenas `KokoroVozzRuntime`/`KokoroRuntime` (Node). Nenhuma implementação browser.
- Código específico de Node misturado ao Kokoro? Sim: `createRequire(import.meta.url)` para ler versão do `onnxruntime-node/package.json`, `readFile` para modelo/tokenizer/voz, e todo o runtime ORT.
- **Ponto de acoplamento fatal para browser**: `dist/src/index.js` re-exporta tudo estaticamente — qualquer import do pacote em bundle client puxa `node:fs` + `onnxruntime-node` (causa raiz do TTS-004).

---

## D02 — Kokoro Pipeline

Caminho real (ref: `kokoro-vozz-runtime.ts`):

```
texto → normalizar (vozz normalize + kcal pre) → phonemes IPA (vozz/g2p)
      → chunk (≤510 fonemas) → tokenize (Map vocab 115 tokens → ids uint32)
      → tensores {input_ids int64 [1,n+2], style float [1,256], speed float [1]}
      → ONNX → tensor float waveform [1,T] → Float32Array
      → concatenate (gap 0,12s) → encodeWav 24 kHz mono → AudioResult/SynthesisResult
```

| Etapa | Browser-compatible? | Filesystem | Buffer | process | native | DOM/Web API |
| --- | --- | --- | --- | --- | --- | --- |
| normalização (vozz + kcal) | ✅ sim (JS puro) | não | não | não | não | não |
| G2P (vozz/g2p) | ✅ sim (JS puro, sem WASM/Python) | não | não | não | não | não |
| chunk | ✅ sim (puro) | não | não | não | não | não |
| tokenizer load | ⚠️ lógica pura; **leitura do arquivo** é `fs` (Node-only) | **sim (Node)** | — | não | não | — |
| style rows load | ⚠️ lógica pura; **leitura do `.bin`** é `fs` (Node-only) | **sim (Node)** | — | não | não | — |
| tensores input | ✅ sim (`BigInt64Array`/`Float32Array`) | não | não | não | não | não |
| sessão/fwd ONNX | ⚠️ **Node-only hoje** (`onnxruntime-node`); browser EXIGE runtime alternativo | não | não | não | **sim (native .node)** | não |
| audio tensor → Float32Array | ✅ sim | não | não | não | não | não |
| concatenate / encodeWav / wavInfo | ✅ sim (ArrayBuffer/DataView) | não | não | não | não | não |

Conclusão: **somente 4 dependências são Node-only** — (a) a sessão ORT nativa (`onnxruntime-node`), (b) leitura do arquivo ONNX, (c) leitura do `tokenizer.json`, (d) leitura do `pf_dora.bin` — todas substituíveis no browser por `onnxruntime-web` + `fetch`. Todo o resto é core puro e já portável. Os dados de entrada/saída têm o **mesmo contrato de tensores** nos dois runtimes (verificado empiricamente, §22).

---

## D03 — ONNX Runtime Web

Modelo real inspecionado (`model_quantized.onnx`, protobuf via `onnx 1.22.0`):

- formato `.onnx`; `ir_version 9`; producer `onnx.quantize` 0.1.0.
- **opset**: `ai.onnx:20` + contrib `com.microsoft:1` (imports: `ai.onnx.ml:5`, `training:1` etc. declarados/vazios).
- **3613 nós, 775 initializers, 90,9 MB de pesos** (dtypes: INT8 108, UINT8 122, FLOAT 501, INT64 42, INT32 2).
- Entradas: `input_ids` INT64 `[1, D?]`, `style` FLOAT `[1,256]`, `speed` FLOAT `[1]`.
- Saída: `waveform` FLOAT `[1, T?]` (dynamic).
- Operadores-chave: `MatMulInteger` 148, `DynamicQuantizeLinear` 139, `ConvInteger` 87, `LayerNormalization` 19, `Softmax` 12, `Resize` 6, `ConvTranspose` 6, `STFT` 1, **`com.microsoft/DynamicQuantizeLSTM` 6**, **`com.microsoft/FastGelu` 12**, **`com.microsoft/SkipLayerNormalization` 12**, **`com.microsoft/FusedMatMul` 1**.

Determinação **por EP (docs oficiais + evidência empírica)**:

| EP | Suporta este modelo (Q8)? | Evidência |
| --- | --- | --- |
| **WASM** | ✅ **SIM** | Docs: *“All ONNX operators are supported by WASM”* (ai.onnx/ai.onnx.ml). Empírico: `onnxruntime-web@1.29.0` criou sessão e inferiu o modelo **completo** (incl. contrib `com.microsoft`). CONFIRMADO |
| WebGPU | ❌ NÃO para Q8 | Tabela oficial `webgpu-operators.md`: **sem** ops inteiros (sem `MatMulInteger`/`DynamicQuantizeLinear`/`ConvInteger`/`QuantizeLinear`/`LSTM`/`STFT`/`DynamicQuantizeLSTM`). Exigiria modelo fp32/fp16. |
| WebGL | ❌ NÃO | Tabela `webgl-operators.md`: sem ops de quantização/LSTM (em manutenção). |

Resposta: **este modelo** executa no WASM; não em WebGPU/WebGL no estado atual.

---

## D04 — Q8 Model

Registro do artefato:

```
modelo:            onnx-community/Kokoro-82M-v1.0-ONNX, quantizado por onnx.quantize (DynamicQuantizeLinear + MatMulInteger/ConvInteger + DynamicQuantizeLSTM com scale/zero-point)
tamanho:           92.361.116 bytes (88,1 MB) em disco
quantização:       dinâmica — pesos INT8/UINT8 (230 tensores), ativações quantizadas em runtime
opset:             ai.onnx:20 + com.microsoft:1
inputs:            input_ids INT64 [1,D?] • style FLOAT [1,256] • speed FLOAT [1]  (dynamic)
outputs:           waveform FLOAT [1,T?] (dynamic)
operators:         (D03) Mul/Add/Cast/MatMulInteger/DynamicQuantizeLinear/ConvInteger/LayerNormalization/…/STFT/DynamicQuantizeLSTM/FastGelu/SkipLayerNormalization/FusedMatMul
```

**Q8 funciona diretamente no ONNX Runtime Web?** **SIM (WASM), CONFIRMADO por execução real** (§22): 3613 nós compilaram, sessão criada, inferência produziu waveform de 82200 samples (3,43 s @ 24 kHz) idêntica em forma à saída nativa (`onnxruntime-node` 1.29.0, mesma máquina, mesmos inputs). **Não exige conversão nem outro modelo**. Exigiria re-export só se o alvo fosse WebGPU (fp32/fp16 ≈ 324 MB — inviável por tamanho) — documentado como requisito futuro, não executado.

---

## D05 — WASM

- **Compatibilidade de operadores**: ✅ GREEN (provado empiricamente, histórico §22).
- **SIMD**: disponível Chrome/Edge/FF/Safari 16.4+; **histórico de resultado incorreto no Safari/iOS 16.4+** (issue `microsoft/onnxruntime#15644`, ort 1.14, 2023 — mensagem trocada com SIMD ativo) → **YELLOW/RISK**: validar em iOS real; considerar forçar SIMD off no iOS se necessário.
- **Threads**: `onnxruntime-web` multi-thread usa `SharedArrayBuffer` → exige **cross-origin isolation** (`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`). Sem headers, cai para single-thread (funciona, mais lento).
- **Impacto Next.js**: headers configuráveis em `headers()`. **Risco**: fluxos que redirecionam para origem externa (ex.: auth Supabase/OAuth) precisam ser validados sob `require-corp`.
- **Impacto PWA**: wasm (13–27 MB) e modelo (92 MB) servidos same-origin, cacheáveis (§14).
- **Suporte navegadores-alvo**: Wasm EP listado como ✔ em Chrome/Edge/Android/iOS/MacOS/Windows/Firefox; Node só single-thread (não afeta).
- Agente usado: 8 cores, cross-origin isolated ✓ (§22).

Classificação: **GREEN (baseline técnico)**, YELLOW para threads/headers/SIMD-iOS.

---

## D06 — WebGPU

- **Necessário?** Não. Apenas aceleração.
- **Funciona com o Q8?** Não — EP WebGPU não possui kernels para os ops inteiros/quant deste modelo (tabela oficial, §3).
- **Browsers-alvo**: suficiente? WebGPU exige Chromium 113+ (desktop) / 121+ (Android) para fp16; **indisponível em Safari iOS** — bloqueia boa parte do público mobile-alvo.
- **Complexidade**: alta (shaders, memória GPU, fallback).
- **WASM como baseline?** Sim — é o baseline recomendado; WebGPU só como aceleração futura de um modelo re-exportado.
- **Conclusão**: não habilitar. Requisito documentado (futuro), não executado.

---

## D07 — Next.js Bundle

Precisamos coexistir:

```
Client bundle  → BrowserKokoroRuntime → onnxruntime-web  (wasm/.wasm em /public + fetch)
Server bundle  → NodeKokoroRuntime    → onnxruntime-node (serverExternalPackages, inalterado)
```

Resposta concreta — **é possível coexistir**, com as seguintes premissas (todas compatíveis com a config atual):

1. **Dois entry points**: runtime browser em módulo próprio (`runtime/browser.ts`) nunca importado no top-level RSC; carregado com `next/dynamic(..., { ssr: false })` (ou diretamente num Web Worker). O server continua com `serverExternalPackages: ["voice-synthesis", "onnxruntime-node"]` (já presente).
2. **O client nunca importa `onnxruntime-node`** — manter o alias/stub existente no webpack para `onnxruntime-node` (o `resolve.alias` já faz isso; o stub existe e o TTS-004 provou que o external vence o alias — para o runtime browser **`voice-synthesis` precisa de entrada browser-safe**, pois re-exporta Node).
3. **`onnxruntime-web` é instalado e bundleado apenas nos chunks client**; os arquivos `.wasm` servidos de `/public` ou CDN e apontados via `ort.env.wasm.wasmPaths`. O modelo (92 MB) **não entra no bundle** — vai para `/public` (ou CDN/SW).
4. Webpack do Next lida com ambos os runtimes sem conflito de símbolo (o pacote `onnxruntime-web` expõe `ort-web`; o `onnxruntime-node` é externo no server apenas).

Limitação registrada: o `index.ts` do engine re-exporta Node estaticamente; **a coexistência exige a entrada/split do §8** (não o isolamento do webpack — TTS-004 já mostrou que externals × aliases não bastam para o import dinâmico atual).

---

## D08 — Node/Browser Separation

A estrutura atual não permite troca limpa de runtime (entry estática + imports Node no topo). **Desenho recomendado** (não implementado):

```
TTSRuntime (types.ts — interface já existente)
   ├── NodeKokoroRuntime  → onnxruntime-node  (kokoro-vozz-runtime atual)
   └── BrowserKokoroRuntime → onnxruntime-web  (novo adapter; assets via fetch)
   CORE compartilhado (puro): vozz-g2p (+normalize), tokenizer helpers, chunk,
                              wav, KOKORO_INFO, SynthesisResult, erros
   AssetLoader injetável: Node → fs ; Browser → fetch(url) → ArrayBuffer
```

Pré-requisitos (requisitos documentados, não executados):
- (a) entrada browser-safe no engine que **não** re-exporte runtimes/`node:*` estaticamente;
- (b) `loadKokoroTokenizer`/voice-load desacoplados de `fs` (AssetLoader);
- (c) factory por ambiente (sem `process` no browser — usar feature detection `WebAssembly`, `fetch`).

---

## D09 — Model e assets

| Asset | Hoje | Node/browser | FS | fetch | bundling | Tamanho |
| --- | --- | --- | --- | --- | --- | --- |
| `model_quantized.onnx` | `models/kokoro/` via `readFile` | Node hoje; **browser: mesmo arquivo via fetch(URL)** | sim (Node) | sim (browser, com Range) | **não** (servir em `/public` ou SW) | 92,4 MB |
| `tokenizer.json` | `readFile` | browser: fetch | sim (Node) | sim | opcional (3,5 KB) | 3,5 KB |
| `voices/pf_dora.bin` | `readFile` → Float32Array | browser: fetch → `arrayBuffer` → Float32Array (idêntico) | sim (Node) | sim | opcional (510 KB) | 510 KB |
| `config*.json` | metadados | fetch | — | sim | — | <2,4 KB |

**O browser PODE usar os mesmos artefatos: CONFIRMADO empiricamente** — o probe serviu exatamente `model_quantized.onnx` + `pf_dora.bin` + `tokenizer.json` (sem conversão/reescrita) e o fluxo completo funcionou. Observação: o `onnxruntime-web` baixa o modelo com **requests de Range** (206) — o servidor/`headers()`/SW deve suportar.

---

## D10 — AudioResult

Contrato atual: `{ text, audio: Float32Array, sampleRate: 24000, channels: 1, durationSec, wav }`.

- Browser runtime produz `waveform` FLOAT32 `[1,T]` 24 kHz mono — **mesmo tensor, mesmo shape, mesma contagem de samples** que Node (82200/82200, CONFIRMADO).
- Invariantes coincidem entre `onnxruntime-web` e `onnxruntime-node` nas 3 execuções independentes (browser, node-wasm, node-native): `maxAbs` 0.680 vs 0.662 e `rms` 0.0695 vs 0.0691 (diferença esperada entre kernels int8 wasm vs nativo; equivalência auditiva **INFERIDA**, não audível).
- **Nenhuma mudança no contrato público necessária** → o `player.ts` existente (que consome `AudioResult`) funciona sem alteração. Validação audível continua **BLOCKED** (sem dispositivo/ambiente).

---

## D11 — Lifecycle

- `load()`: no browser = download/parse do modelo (92 MB, ~4,4 s local no probe; rede domina) + `InferenceSession.create`. Estado `LOADING` será naturalmente longo — publicar progresso.
- `synthesize()`: mesmo fluxo e serialização (uma sessão = uma run por vez, não reentrante, igual ao Node).
- `stop/cancel`: **não existe hoje** (nem no Node); a regra atual de interrupção por nova interação (parar o `player` antes de nova síntese) **não é alterada** e funciona igual no browser.
- `dispose()`/reload: suportados (recreate pós-dispose).
- Requisito documentado (não executado): se desejar cancelar run em andamento, Web Worker + `AbortController`/sequenciação — só faz sentido no browser.

---

## D12 — Memória

Baseline: Q8 ≈ 88–92 MB em disco; PSS ≈ 408 MB no Android (Node). Breakdown esperado no browser:

| Componente | Estimativa | Status |
| --- | --- | --- |
| Modelo (pesos) no wasm heap | ~90,9 MB | INFERIDO |
| Runtime onnxruntime-web (wasm) | 13–27 MB (SIMD+threads: 26,5 MB `jsep`, ou 13,3 MB sem JSEP) | CONFIRMADO (tamanho dos artefatos) |
| JS heap | **95,2 MB medidos** no Chrome desktop pós sessão+runs (`performance.memory`) | MEDIDO (desktop) |
| Saias/áudio em buffer | ~0,3 MB (Float32) + ~0,7 MB (wav 16-bit) por resposta | INFERIDO |
| Overhead browser | Chrome ~50–100 MB | INFERIDO |
| Total estimado (low-end Android) | **~300–450 MB RSS em pico** | INFERIDO |

Classificação: **YELLOW — exige atenção** (compatível com o baseline Android PSS 408 MB, mas apertado em dispositivos de 3–4 GB RAM; sem `wasm.memory` físico medido em device-alvo).

---

## D13 — Performance

Medições empíricas (mesma máquina, modelo Q8, mesmo prompt, 61 tokens → 82200 samples / 3,43 s de áudio):

| Contexto | Runtime | Session create | run | RTF |
| --- | --- | --- | --- | --- |
| Node | onnxruntime-node (native CPU) | 1.710 ms | 6.368 ms | ≈ 1,9 |
| Node (single-thread) | onnxruntime-web wasm | 2.472 ms | 9.664–10.260 ms | ≈ 2,8 |
| **Browser Chromium** | onnxruntime-web wasm (8 threads, cross-origin isolated) | 4.430 ms | **13.059–14.970 ms** | ≈ 3,8 |

- Viável? **Sim** (execução real). Porém para texto de chat típico (5–15 s de áudio), a síntese levaria ~20–60 s em desktop e pior em mobile (baseline RMX3461 RTF nativo 1,03–3,50 → browser estimado **RTF 4–7, INFERIDO**).
- Primeira carga muito pesada: 92 MB download + compilação wasm.
- Síntese **bloqueia a UI** se rodada no main thread (run de 13 s congela a página). **Web Worker é requisito de UX, não otimização** (§22 permite, não implementado).
- Recomendação registrada: warm-up do modelo em background no idle (após first paint / ao entrar no chat).

---

## D14 — PWA / Offline

- Assets cacheáveis: sim — wasm (13–27 MB), modelo (92 MB), tokenizer/voz (pequenos), same-origin, com `Cache-Control: immutable`.
- **Limite do serwist**: `maximumFileSizeToCacheInBytes: 5 242 880` (5 MB) no `next.config.ts` → o modelo **não** entra no precache manifest; exige **runtime caching** (CacheFirst) via rota de SW para `/model_quantized.onnx?v=` e para os `.wasm`. Requisito documentado.
- Service Worker pode servir o modelo offline: sim (fetch interceptado; precisa dar suporte a **Range** /206 no handler).
- Storage: cota de origem é suficiente em desktop (>100 MB) e viável em Android (chamar `navigator.storage.persist()`); 92 MB ok.
- Versionamento: modelo por URL versionada (padrão já usado no Vosk, `VOZ-012.4`).
- Veredito: **viável**, com as mudanças de cache/SW acima (requisitos, não executadas).

---

## D15 — Capacitor / Android

- `onnxruntime-web` (wasm) roda em WebView Android (Chromium) — **reutiliza o mesmo runtime browser** e compartilha o CORE; sem conflito com `onnxruntime-android` (EPs diferentes e mutuamente exclusivos por escolha do adapter).
- Não exigiria runtime específico obrigatório (poderia usar o mesmo BrowserKokoroRuntime; onnxruntime-android ficaria como alternativa futura via mesma interface).
- **Não compromete o plano Android**: pelo contrário, o split Node/Browser/Android encaixa no diagrama de camadas (RUNTIME por ambiente).
- Risco: download de 92 MB dentro do WebView + memória low-end (YELLOW). Requer teste em aparelho real.

---

## D16 — Segurança/isolamento

- `eval`: o EP WASM do ort-web **não usa eval** (WASM compilado). Histórico de `new Function` em backends JS legados não se aplica ao EP wasm.
- WASM: instanciação dinâmica — CSP restritiva exigirá `'wasm-unsafe-eval'`; workers exigirão `worker-src 'self' blob:`.
- COOP/COEP: **obrigatório** para threads/SharedArrayBuffer (ver D05).
- Modelo: carregamento same-origin; nenhum download remoto de terceiros (privacidade máxima).
- Nenhum dado do paciente sai do dispositivo — vantagem estrutural sobre bridge.

---

## D17 — Server Bridge (comparado, não implementado)

```
Browser → API (Next route/Action) → Node → voice-synthesis → onnxruntime-node
        → AudioResult (wav/base64) → Browser → player
```

| Critério | Bridge |
| --- | --- |
| Preserva engine atual? | ✅ 100% (zero mudanças no runtime) |
| Servidor online? | ✅ exige (rota + CPU) — **quebra offline** |
| Offline/PWA | ❌ incompatível com o requisito offline |
| Latência | rede + encode; ~ok; primeira geração sem download local |
| Custo/escala | CPU do servidor por síntese; provisioning |
| Privacidade | ❌ texto (dados de paciente) trafega/processa no servidor |
| Capacitor | funciona (mesma rede/servidor) |

O bridge é a alternativa **mais simples e de menor mudança**, mas sacrifica offline e privacidade — ambos centrais para o produto (PWA + dados clínicos). Não recomendado como escolha primária; útil como fallback temporário se perf mobile for bloqueante (não é, com worker).

---

## Decision Matrix

| Critério | Browser Runtime | Server Bridge |
| --- | --- | --- |
| Offline | ✅ sim (SW + 92 MB) | ❌ não |
| Privacidade | ✅ texto nunca sai do device | ❌ texto no servidor |
| Latência (cold) | descarga/parsing pesados | rede + CPU server |
| Latência (warm) | RTF ≈ 3,8 desktop; pior em mobile | RTF ≈ 1–2 no servidor |
| Memória dispositivo | alto (~300–450 MB estimado) | baixo |
| Complexidade | alta (adapters, worker, headers, SW) | média (rota + auth) |
| Reuso Android | ✅ (mesmo runtime wasm no WebView) | ✅ (mesma API) |
| Reuso Node | parcial (CORE); precisa adapter | ✅ total |
| Bundle | pesado (wasm + modelo servido) | leve |
| PWA | ✅ offline real | ❌ |
| Escalabilidade | ✅ zero servidor | exige infra |
| Manutenção | média-alta (versões ort/wasm/model) | média |

## Evidence Classification

| # | Afirmação | Classe |
| --- | --- | --- |
| 1 | Modelo Q8 inteiro (3613 nós, contrib ops) cria sessão e infere em `onnxruntime-web` WASM | **CONFIRMADO** (execução Node + browser) |
| 2 | Browser real (Chromium) → fetch do mesmo modelo → wasm → waveform 82200 samples | **CONFIRMADO** (probe headless, §22) |
| 3 | Mesmos artefatos (modelo/tokenizer/voz) reutilizados sem conversão | **CONFIRMADO** (§22) |
| 4 | `AudioResult`/tensores de saída idênticos em forma/contagem | **CONFIRMADO** (shape/samples/estatística) |
| 5 | WASM suporta todos os ops `ai.onnx` | **CONFIRMADO** (docs oficiais) |
| 6 | WebGPU/WebGL não suportam o Q8 (ops inteiros ausentes) | **CONFIRMADO** (tabelas oficiais webgpu/webgl-operators) |
| 7 | RTF browser ≈ 3,8 nesta máquina; native Node ≈ 1,9 | **CONFIRMADO** (medido nesta máquina) |
| 8 | RTF mobile-browser/celular estimado 4–7; memória RSS 300–450 MB | **INFERIDO** |
| 9 | Equivalência auditiva wasm↔nativo | **INFERIDO** (estatística ok; áudio não ouvido) |
| 10 | SIMD/Safari iOS seguro | **NÃO VERIFICADO / RISCO** (issue #15644) |
| 11 | Fluxo de auth em produção sob COOP/COEP | **NÃO VERIFICADO** |
| 12 | Storage/offline em device-alvo com 92 MB | **NÃO VERIFICADO** |
| 13 | Validação física/audível do áudio | **BLOQUEADO** (sem device/ambiente) |

## Blockers

**Nenhum bloqueador técnico** para a execução browser do modelo atual via WASM (prova completa do fluxo). Bloqueadores condicionais (requerem mudanças): cross-origin isolation para threads; worker para não congelar UI; cache/offline de 92 MB; validação iOS Safari.

## Risks

1. **COOP/COEP** pode afetar fluxos de redirecionamento externo (auth Supabase/OAuth) — validar em produção antes de habilitar threads.
2. **SIMD no Safari/iOS** — histórico de resultado incorreto (issue #15644); testar e, se preciso, desabilitar SIMD no iOS.
3. **Perf em low-end móvel** — RTF alto + memória; mitigar com worker + warmup + limite de tamanho de síntese (já existe gate de palavras).
4. **Download 92 MB na primeira carga** — progresso, cache versionado, pré-carregar no idle.
5. **Range/206 para o modelo** — servidor/SW deve suportar.
6. **`voice-synthesis` entry statico** — qualquer integração browser precisa primeiro da entrada browser-safe (o erro `MODULE_NOT_FOUND` do TTS-004 permanece até lá).

## Recommended Architecture

Confirmada a viabilidade técnica, a arquitetura tecnicamente correta para o botão "Ouvir" no navegador:

```
vanzacariasnutri
  useChatTts → chatTtsController → orchestrator → TtsService (interface, inalterada)
       ↓ resolve por ambiente
  BrowserRuntime (Web Worker):  import onnxruntime-web  +  CORE reutilizado
       ↓
  BrowserKokoroRuntime (novo adapter, TTSRuntime):
       load()   = fetch(model_quantized.onnx) + fetch(tokenizer.json) + fetch(pf_dora.bin)
                  + InferenceSession.create({ep:['wasm']}, wasmPaths=/wasm)
       synth    = run({input_ids int64, style [1,256], speed [1]}) → waveform → AudioResult
       dispose  = session.release()
  ServerRuntime (inalterado):  onnxruntime-node (kokoro-vozz-runtime) para testes/backfill
```

- CORE permanece independente (vozz, tokenizer, wav — sem React/DOM/Supabase/player) e o RUNTIME muda por ambiente.
- Infra necessária (requisitos p/ próxima sprint, não implementados): `headers()` COOP/COEP; `wasm`+modelo em `/public`; entrada browser-safe no engine; rota de SW (runtime cache, Range) para modelo/wasm versionados; worker.
- WebGPU fica fora; bridge fica como fallback contingente (não recomendado como primário por offline/privacidade).

## Final Verdict

**B — Browser Runtime Viable With Changes**

- **Sem bloqueador técnico**: demonstrado de ponta a ponta (browser → `onnxruntime-web@1.29.0` WASM → modelo Q8 real de 92 MB → tensores idênticos → `AudioResult` 24 kHz mono), com o CORE intacto.
- **Exige mudanças arquiteturais claramente delimitadas**: (1) split do runtime Node/Browser no engine com entry browser-safe; (2) AssetLoader via `fetch`; (3) Web Worker para a síntese; (4) COOP/COEP + SIMD/threads; (5) PWA/offline versionado para o modelo; (6) validação iOS Safari e device-alvo.
- **Gate da sprint**: *arquitetura tecnicamente correta para o botão "Ouvir" sem quebrar a independência do `voice-synthesis`* → **runtime browser via `onnxruntime-web` (WASM) mantendo a interface `TTSRuntime`**, CORE compartilhado e isento, síntese em Worker — **não** a bridge (que quebra offline/privacidade), **não** WebGPU (incompatível com Q8).

## Validation

- `npm run typecheck` (vanzacariasnutri): **PASS** (exit 0)
- `npm test` (vanzacariasnutri): **PASS** — 37 files / **552 tests**
- `npm run build` (vanzacariasnutri, Next 16.1.6): **PASS** (exit 0)
- `npm run typecheck` (voice-synthesis): **PASS** (exit 0)
- `npm test` (voice-synthesis): **PASS** — 4 files / 44 passed, 2 skipped

## Changes Made

None. Nenhuma alteração de produção em `voice-synthesis` ou `vanzacariasnutri`. Probes temporários (parsing ONNX com `onnx` em venv isolada; servidor HTTP Range + página browser `onnxruntime-web@1.29.0` + CDP headless Chromium) foram **executados, coletados e removidos** — verificável: sem artefatos remanescentes no temp, `git status` do app mostra apenas as mudanças das sprints anteriores (TTS-003) + reports 001–004. Só este relatório permanece.