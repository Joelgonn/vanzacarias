import { describe, it, expect, vi } from "vitest"
import { createHash } from "node:crypto"
import { ModelManager } from "../model/modelManager"
import { MemoryModelStorage } from "../model/storage"
import type { ModelManifest } from "../model/manifest"

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function makeFixtureManifest(): { manifest: ModelManifest; fixtures: Record<string, Uint8Array> } {
  const model = new TextEncoder().encode("x".repeat(100)) // 100 bytes
  const tokenizer = new TextEncoder().encode('{"vocab":{"$":0,"a":1}}')
  const voice = new TextEncoder().encode("v".repeat(256))
  const manifest: ModelManifest = {
    version: "v1",
    assets: {
      model: { path: "model_quantized.onnx", bytes: model.byteLength, sha256: sha256(model) },
      tokenizer: { path: "tokenizer.json", bytes: tokenizer.byteLength, sha256: sha256(tokenizer) },
      voice: { path: "voices/pf_dora.bin", bytes: voice.byteLength, sha256: sha256(voice) },
    },
  }
  return { manifest, fixtures: { [manifest.assets.model.path]: model, [manifest.assets.tokenizer.path]: tokenizer, [manifest.assets.voice.path]: voice } }
}

function makeFetcher(fixtures: Record<string, Uint8Array>, opts?: { delayMs?: number; failOn?: string; counter?: { count: number } }) {
  const delay = opts?.delayMs ?? 0
  return async (url: string, init?: RequestInit): Promise<Response> => {
    if (opts?.counter) opts.counter.count++
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError")
    // extract path last segment(s)
    const path = Object.keys(fixtures).find((p) => url.endsWith(p)) ?? url
    if (opts?.failOn && url.endsWith(opts.failOn)) return new Response("not found", { status: 404 })
    const data = fixtures[path as string]
    if (!data) return new Response("not found", { status: 404 })
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError")
    return new Response(data as unknown as BodyInit, { status: 200, headers: { "content-length": String(data.byteLength) } })
  }
}

describe("ModelManager — TTS-CAP-004 FASE 2", () => {
  it("disponibilidade: ausente → false, válido → true, inválido → false", async () => {
    const { manifest, fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    const mgr = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: makeFetcher(fixtures), storage })
    expect(await mgr.isAvailable()).toBe(false)
    await mgr.ensureAvailable()
    expect(await mgr.isAvailable()).toBe(true)
    // corrompe um asset no storage (tamanho errado)
    await storage.put(manifest.assets.voice.path, manifest.version, new Uint8Array([1, 2, 3]))
    await expect(mgr.verify()).rejects.toMatchObject({ code: "MODEL_INTEGRITY_FAILED" })
  })

  it("download bem-sucedido persiste e recupera conteúdo idêntico", async () => {
    const { manifest, fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    const mgr = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: makeFetcher(fixtures), storage })
    await mgr.ensureAvailable()
    const model = await mgr.getAsset(manifest.assets.model.path)
    expect(model).not.toBeNull()
    expect(Buffer.from(model!)).toEqual(Buffer.from(fixtures[manifest.assets.model.path]!))
  })

  it("download HTTP error → MODEL_DOWNLOAD_FAILED e não marca disponível", async () => {
    const { manifest, fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    const mgr = new ModelManager({
      manifest,
      origin: "http://fixture.test",
      fetcher: makeFetcher(fixtures, { failOn: manifest.assets.model.path }),
      storage,
    })
    await expect(mgr.ensureAvailable()).rejects.toMatchObject({ code: "MODEL_DOWNLOAD_FAILED" })
    expect(await mgr.isAvailable()).toBe(false)
  })

  it("integridade: SHA incorreto → FAIL, tamanho incorreto → FAIL", async () => {
    const { manifest } = makeFixtureManifest()
    // manifest com sha errado
    const badManifest: ModelManifest = {
      version: "v1",
      assets: {
        model: { ...manifest.assets.model, sha256: "0".repeat(64) },
        tokenizer: manifest.assets.tokenizer,
        voice: manifest.assets.voice,
      },
    }
    const { fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    const mgr = new ModelManager({ manifest: badManifest, origin: "http://fixture.test", fetcher: makeFetcher(fixtures), storage })
    await expect(mgr.ensureAvailable()).rejects.toMatchObject({ code: "MODEL_INTEGRITY_FAILED" })
    expect(await mgr.isAvailable()).toBe(false)

    // tamanho incorreto
    const badSize: ModelManifest = {
      version: "v1",
      assets: {
        model: { ...manifest.assets.model, bytes: 999999 },
        tokenizer: manifest.assets.tokenizer,
        voice: manifest.assets.voice,
      },
    }
    const mgr2 = new ModelManager({ manifest: badSize, origin: "http://fixture.test", fetcher: makeFetcher(fixtures), storage: new MemoryModelStorage() })
    await expect(mgr2.ensureAvailable()).rejects.toMatchObject({ code: "MODEL_INTEGRITY_FAILED" })
  })

  it("singleflight: 2 requests concorrentes → 1 download", async () => {
    const { manifest, fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    const counter = { count: 0 }
    const mgr = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: makeFetcher(fixtures, { delayMs: 30, counter }), storage })
    const p1 = mgr.ensureAvailable()
    const p2 = mgr.ensureAvailable()
    await Promise.all([p1, p2])
    // 3 assets por download, mas singleflight faz só 1 lote = 3 fetches
    expect(counter.count).toBe(3)
    expect(await mgr.isAvailable()).toBe(true)
  })

  it("cancelamento: abort durante download → MODEL_ABORTED e não persiste", async () => {
    const { manifest, fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    const mgr = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: makeFetcher(fixtures, { delayMs: 50 }), storage })
    const controller = new AbortController()
    const p = mgr.ensureAvailable({ signal: controller.signal })
    setTimeout(() => controller.abort(), 10)
    await expect(p).rejects.toMatchObject({ code: "MODEL_ABORTED" })
    expect(await mgr.isAvailable()).toBe(false)
    expect(mgr.getState()).toBe("error")
  })

  it("versionamento: v1 existente não serve para v2", async () => {
    const { manifest: v1, fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    const mgrV1 = new ModelManager({ manifest: v1, origin: "http://fixture.test", fetcher: makeFetcher(fixtures), storage })
    await mgrV1.ensureAvailable()
    expect(await mgrV1.isAvailable()).toBe(true)

    // v2 com mesma fixtures mas versão diferente → deve baixar de novo (storage separado)
    const v2: ModelManifest = { version: "v2", assets: v1.assets }
    const mgrV2 = new ModelManager({ manifest: v2, origin: "http://fixture.test", fetcher: makeFetcher(fixtures), storage })
    expect(await mgrV2.isAvailable()).toBe(false)
    await mgrV2.ensureAvailable()
    expect(await mgrV2.isAvailable()).toBe(true)
    // v1 continua disponível
    expect(await mgrV1.isAvailable()).toBe(true)
  })

  it("falha não deixa arquivo parcial como válido", async () => {
    const { manifest, fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    // falha no último asset (voice)
    const failingFetcher = async (url: string, init?: RequestInit) => {
      if (url.endsWith(manifest.assets.voice.path)) return new Response("err", { status: 500 })
      const p = Object.keys(fixtures).find((k) => url.endsWith(k))!
      return new Response(fixtures[p] as unknown as BodyInit, { status: 200 })
    }
    const mgr = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: failingFetcher as unknown as typeof fetch, storage })
    await expect(mgr.ensureAvailable()).rejects.toMatchObject({ code: "MODEL_DOWNLOAD_FAILED" })
    expect(await mgr.isAvailable()).toBe(false)
    // nenhum asset válido parcial deve fazer isAvailable true (precisa dos 3)
    const maybeModel = await storage.get(manifest.assets.model.path, manifest.version)
    // pode ter sido posto antes da falha? Nossa implementação é atômica: só persiste após todos baixados
    // então mesmo model não deve estar lá (ou se estiver, isAvailable ainda false)
    expect(await mgr.isAvailable()).toBe(false)
  })

  it("segundo uso não baixa novamente (isAvailable true)", async () => {
    const { manifest, fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    const counter = { count: 0 }
    const mgr = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: makeFetcher(fixtures, { counter }), storage })
    await mgr.ensureAvailable()
    const firstCount = counter.count
    await mgr.ensureAvailable()
    expect(counter.count).toBe(firstCount) // nenhum fetch adicional
  })

  it("invalidate limpa versão", async () => {
    const { manifest, fixtures } = makeFixtureManifest()
    const storage = new MemoryModelStorage()
    const mgr = new ModelManager({ manifest, origin: "http://fixture.test", fetcher: makeFetcher(fixtures), storage })
    await mgr.ensureAvailable()
    expect(await mgr.isAvailable()).toBe(true)
    await mgr.invalidate()
    expect(await mgr.isAvailable()).toBe(false)
  })
})
