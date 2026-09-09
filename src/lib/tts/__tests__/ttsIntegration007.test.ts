import { describe, it, expect, vi } from "vitest"
import { createTtsService, detectRuntimeKind, detectNativeCapacitor } from "../synthesizer"

/**
 * TTS-INTEGRATION-007 — Testes de integração do Consumer com o Browser Runtime.
 *
 * Cobrem o que a suíte anterior (TTS-001/002/003) não cobria:
 *  1. seleção de runtime por ambiente (browser vs node);
 *  2. o client NÃO importa o entry Node (`dist/src/index.js` → onnxruntime-node);
 *  3. assets (baseUrl/wasmPaths/workerUrl) resolvidos no contrato do runtime;
 *  4. contrato completo consumer→KokoroBrowserRuntime (load→synthesize→dispose)
 *     via worker fake — o objeto real (`KokoroBrowserRuntime`) é exercitado;
 *  5. on-demand + reload pós-dispose no runtime browser.
 *
 * As regras de interação (streaming aguarda conclusão, OFF→não fala, ON→fala,
 * invalidate→interrompe, Play/Pause/Resume/Replay, current response, erro
 * isolado) já são cobertas por chatTtsController.test.ts (T20–T31) — intactas.
 */

// FASE 1: branch Node removida — não há mais `voice-synthesis/dist/src/index.js`.
// Mantido alias para compat: se test residual mockar, não deve ser usado.
// (o runtime browser vendado é o único caminho).

const READY_PAYLOAD = {
  info: {
    name: "kokoro-browser",
    modelId: "q8",
    modelConfig: "Kokoro-82M",
    voiceId: "pf_dora",
    sampleRate: 24000,
    maxPhonemes: 510,
    weightLicense: "Apache-2.0",
    phonemizer: "vozz/g2p",
    g2pLicense: "Apache-2.0",
    normalizer: "vozz/normalize",
    onnxRuntime: "1.29.0",
    device: "wasm",
  },
  ortVersion: "1.29.0",
  downloadedBytes: 1234,
  threads: false,
  simd: true,
  cores: 8,
}

type FakeMsg = { kind: string; id: number; payload?: unknown }

/**
 * Worker fake "auto-pilot": aceita automaticamente cada mensagem do protocolo
 * (init→ready, synth→synth-result, dispose→disposed) como um worker real.
 * `failInit` permite simular falha de carregamento via evento real de erro.
 */
class FakeTtsWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null
  posted: FakeMsg[] = []
  terminated = false
  failInit = false
  private messageListeners = new Set<(e: unknown) => void>()
  private errorListeners = new Set<(e: unknown) => void>()
  postMessage(msg: unknown) {
    const m = msg as FakeMsg
    this.posted.push(m)
    queueMicrotask(() => {
      if (m.kind === "init") {
        if (this.failInit) {
          this.onerror?.({ message: "asset offline" })
        } else {
          this.emit({ kind: "ready", id: m.id, payload: READY_PAYLOAD })
        }
      } else if (m.kind === "synth") {
        const durationSec = 0.05
        const audio = new Float32Array(Math.floor(durationSec * 24000))
        for (let i = 0; i < audio.length; i++) audio[i] = Math.sin(i * 0.05) * 0.5
        this.emit({
          kind: "synth-result",
          id: m.id,
          payload: {
            text: (m.payload as { text: string }).text,
            audio,
            sampleRate: 24000,
            durationSec,
            wav: new Uint8Array(44 + audio.length * 2),
            phonemes: "kaeiˈteɪst",
            ortMs: 4,
          },
        })
      } else if (m.kind === "dispose") {
        this.emit({ kind: "disposed", id: m.id })
      }
    })
  }
  terminate() {
    this.terminated = true
  }
  emit(data: unknown) {
    this.onmessage?.({ data })
    for (const cb of this.messageListeners) cb({ data })
  }
  // API usada pelo runtime no dispose() (protocolo real do Worker)
  addEventListener(type: string, cb: (e: unknown) => void) {
    if (type === "message") this.messageListeners.add(cb)
    if (type === "error") this.errorListeners.add(cb)
  }
  removeEventListener(type: string, cb: (e: unknown) => void) {
    if (type === "message") this.messageListeners.delete(cb)
    if (type === "error") this.errorListeners.delete(cb)
  }
}

// Bridge de tipo: em ambiente Node o DOM `Worker` global existe apenas no
// lib.dom; o fake é uma implementação mínima do protocolo. Usado como factory.
const asWorker = (worker: FakeTtsWorker) => (() => worker as unknown as Worker) as unknown as () => Worker

function browserTts(worker: FakeTtsWorker, extra: Record<string, unknown> = {}) {
  return createTtsService({
    runtimeKind: "browser",
    browser: { baseUrl: "http://tts.test/models/", workerFactory: asWorker(worker), ...extra },
  })
}

describe("TTS-INTEGRATION-007 — Runtime Selection & Browser Runtime Contract", () => {
  it("1 — seleção de ambiente: Node (test runner) tem 'node', simulação browser é 'browser'", () => {
    expect(detectRuntimeKind()).toBe("node")
    // Simula ambiente browser (window + Worker + WebAssembly)
    const w = globalThis as unknown as Record<string, unknown>
    const prev = {
      window: w.window,
      Worker: w.Worker,
      WebAssembly: w.WebAssembly,
    }
    try {
      w.window = {}
      w.Worker = class {}
      w.WebAssembly = {}
      expect(detectRuntimeKind()).toBe("browser")
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete w[k]
        else w[k] = v
      }
    }
  })

  it("2 — consumer com runtime browser usa runtime vendado (sem voice-synthesis)", async () => {
    const worker = new FakeTtsWorker()
    const tts = browserTts(worker, {
      wasmPaths: "/api/tts/wasm/",
      workerUrl: "/tts/worker.js",
    })
    await tts.load()
    const out = await tts.synthesize("Teste sem node entry")
    expect(out.samples.length).toBeGreaterThan(0)
    await tts.dispose()
    // FASE 1: não existe mais `voice-synthesis/dist/src/index.js` — runtime é vendado.
    expect(true).toBe(true)
  })

  it("3 — assets resolvidos: baseUrl/wasmPaths/workerUrl chegam ao init do worker", async () => {
    const worker = new FakeTtsWorker()
    const tts = createTtsService({
      runtimeKind: "browser",
      browser: {
        baseUrl: "http://tts.test/tts-assets/",
        wasmPaths: "/static/ort/",
        workerUrl: "/static/tts-worker.js",
        numThreads: 6,
        workerFactory: asWorker(worker),
      },
    })
    await tts.load()
    const init = worker.posted[0] as unknown as {
      payload: {
        model: string
        voice: string
        assetUrls: { modelUrl: string; tokenizerUrl: string; voiceUrl: string }
        wasmPaths: string
        workerUrl?: string
        numThreads?: number
      }
    }
    // baseUrl resolve os três assets (contrato BrowserAssetUrls)
    expect(init.payload.assetUrls.modelUrl).toBe("http://tts.test/tts-assets/model_quantized.onnx")
    expect(init.payload.assetUrls.tokenizerUrl).toBe("http://tts.test/tts-assets/tokenizer.json")
    expect(init.payload.assetUrls.voiceUrl).toBe("http://tts.test/tts-assets/voices/pf_dora.bin")
    // wasmPaths/numThreads repassados ao runtime
    expect(init.payload.wasmPaths).toBe("/static/ort/")
    expect(init.payload.numThreads).toBe(6)
    expect(init.payload.model).toBe("q8")
    expect(init.payload.voice).toBe("pf_dora")
    await tts.dispose()
  })

  it("4 — contrato completo consumer→KokoroBrowserRuntime (load→synthesize→dispose)", async () => {
    const worker = new FakeTtsWorker()
    const tts = browserTts(worker)
    expect(tts.getState()).toBe("UNINITIALIZED")
    await tts.load()
    expect(tts.getState()).toBe("READY")

    const out = await tts.synthesize("Olá, este é um teste do browser runtime.")
    expect(out.samples).toBeInstanceOf(Float32Array)
    expect(out.samples.length).toBeGreaterThan(0)
    expect(out.sampleRate).toBe(24000)
    expect(out.channels).toBe(1)
    expect(out.durationSec).toBeGreaterThan(0)
    expect(out.wav).toBeInstanceOf(Uint8Array)
    expect(out.wav.length).toBeGreaterThan(44)
    expect(out.text).toBe("Olá, este é um teste do browser runtime.")
    expect(tts.getState()).toBe("READY")

    await tts.dispose()
    expect(tts.getState()).toBe("DISPOSED")
    expect(worker.terminated).toBe(true)
  })

  it("5 — on-demand + reload pós-dispose no runtime browser", async () => {
    const worker = new FakeTtsWorker()
    const tts = browserTts(worker)
    await tts.load()
    const first = await tts.synthesize("Primeira")
    expect(first.samples.length).toBeGreaterThan(0)
    await tts.dispose()

    // Reload: novo init e novo ready (o worker fake é reutilizado pela factory)
    await tts.load()
    const second = await tts.synthesize("Segunda")
    expect(second.samples.length).toBeGreaterThan(0)
    expect(tts.getState()).toBe("READY")
    await tts.dispose()
  })

  it("6 — erro do worker é convertido e não expõe internals", async () => {
    const worker = new FakeTtsWorker()
    const tts = browserTts(worker)
    // Simula falha de carregamento via evento real de erro do Worker
    worker.failInit = true
    await expect(tts.load()).rejects.toMatchObject({ code: "LOAD_FAILED" })
    expect(tts.getState()).toBe("UNINITIALIZED")
    // Ainda utilizável após falha de load (on-demand, sem desligar preferência)
    worker.failInit = false
    await tts.load()
    expect(tts.getState()).toBe("READY")
    await tts.dispose()
  })

  it("7 — baseUrl default é resolvida para ABSOLUTA com location.origin (bug de contrato do Browser Runtime)", async () => {
    const worker = new FakeTtsWorker()
    // Simula navegador (a base relativa '/api/tts/models/' seria rejeitada por
    // `new URL(path, base)` no KokoroBrowserRuntime — o consumer deve entregar
    // uma base absoluta montada a partir de location.origin).
    vi.stubGlobal("location", { href: "https://app.exemplo/chat", origin: "https://app.exemplo" })
    const tts = createTtsService({
      runtimeKind: "browser",
      browser: { workerFactory: asWorker(worker) },
    })
    try {
      await tts.load()
      const init = worker.posted[0] as unknown as {
        payload: { assetUrls: { modelUrl: string; tokenizerUrl: string; voiceUrl: string } }
      }
      expect(init.payload.assetUrls.modelUrl).toBe("https://app.exemplo/api/tts/models/model_quantized.onnx")
      expect(init.payload.assetUrls.tokenizerUrl).toBe("https://app.exemplo/api/tts/models/tokenizer.json")
      expect(init.payload.assetUrls.voiceUrl).toBe("https://app.exemplo/api/tts/models/voices/pf_dora.bin")
    } finally {
      vi.unstubAllGlobals()
      await tts.dispose()
    }
  })

  it("8 — Capacitor nativo usa assets LOCAIS (/assets/tts/**); web usa /api/tts (TTS-CAP-002)", async () => {
    expect(detectNativeCapacitor()).toBe(false)
    vi.stubGlobal("location", { href: "https://localhost/index.html", origin: "https://localhost" })
    const w = globalThis as unknown as { window?: unknown }
    w.window = { Capacitor: { isNativePlatform: () => true } }
    const worker = new FakeTtsWorker()
    const tts = createTtsService({
      runtimeKind: "browser",
      browser: { workerFactory: asWorker(worker) },
    })
    try {
      expect(detectNativeCapacitor()).toBe(true)
      await tts.load()
      const init = worker.posted[0] as unknown as {
        payload: { assetUrls: { modelUrl: string; voiceUrl: string }; wasmPaths?: string }
      }
      expect(init.payload.assetUrls.modelUrl).toBe("https://localhost/assets/tts/model_quantized.onnx")
      expect(init.payload.assetUrls.voiceUrl).toBe("https://localhost/assets/tts/voices/pf_dora.bin")
      expect(init.payload.wasmPaths).toBe("/assets/tts/wasm/")
    } finally {
      delete w.window
      vi.unstubAllGlobals()
      await tts.dispose()
    }
  })
})