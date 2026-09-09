/**
 * TTS-CAP-004 FASE 2/3 — Armazenamento persistente do modelo.
 *
 * FASE 2 prioridade: Cache Storage (já usado em `src/lib/tts/pwa/modelCache.ts` para TTS-PWA-001).
 * FASE 3 prioridade Android: Capacitor Filesystem Directory.Data (persistente, sobrevive a
 * fechar app/reload/WebView restart, fora do APK).
 * Fallback: memória (para testes Node e quando caches/Filesystem indisponíveis).
 * Capacitor `Directory.Data` é plugável via abstração ModelStorage.
 *
 * Chave de armazenamento versionada: `tts-model-v1` (cada versão é um namespace isolado).
 * O ModelManager continua trabalhando contra a abstração ModelStorage.
 */

import type { ModelManifest } from "./manifest"
import { ModelError } from "./errors"
import { CapacitorModelStorage } from "./capacitorStorage"

export const TTS_MODEL_STORAGE_PREFIX = "tts-model" as const

export function storageCacheName(version: string): string {
  return `${TTS_MODEL_STORAGE_PREFIX}-${version}`
}

export interface ModelStorage {
  has(assetPath: string, version: string): Promise<boolean>
  get(assetPath: string, version: string): Promise<Uint8Array | null>
  put(assetPath: string, version: string, data: Uint8Array): Promise<void>
  delete(assetPath: string, version: string): Promise<void>
  clearVersion(version: string): Promise<void>
  isAvailable(manifest: ModelManifest): Promise<boolean>
}

/**
 * Implementação Cache Storage (browser real).
 * Cada asset é armazenado como Response com body = Uint8Array e header `content-length`.
 * A chave da cache é uma URL sintética `https://tts-model.local/<version>/<assetPath>`
 * para evitar colisão com rotas reais da app.
 */
export class CacheModelStorage implements ModelStorage {
  private cacheNameFor(version: string): string {
    return storageCacheName(version)
  }

  private keyUrl(assetPath: string, version: string): string {
    // URL sintética estável, não depende de location.origin
    return `https://tts-model.local/${version}/${assetPath}`
  }

  async has(assetPath: string, version: string): Promise<boolean> {
    if (typeof caches === "undefined") return false
    try {
      const cache = await caches.open(this.cacheNameFor(version))
      const hit = await cache.match(this.keyUrl(assetPath, version))
      return !!hit
    } catch {
      return false
    }
  }

  async get(assetPath: string, version: string): Promise<Uint8Array | null> {
    if (typeof caches === "undefined") return null
    try {
      const cache = await caches.open(this.cacheNameFor(version))
      const res = await cache.match(this.keyUrl(assetPath, version))
      if (!res) return null
      const buf = await res.arrayBuffer()
      return new Uint8Array(buf)
    } catch {
      return null
    }
  }

  async put(assetPath: string, version: string, data: Uint8Array): Promise<void> {
    if (typeof caches === "undefined") throw new ModelError("MODEL_STORAGE_FAILED", "Cache Storage indisponível")
    try {
      const cache = await caches.open(this.cacheNameFor(version))
      const res = new Response(data as unknown as BodyInit, {
        headers: { "content-length": String(data.byteLength), "content-type": "application/octet-stream" },
      })
      await cache.put(this.keyUrl(assetPath, version), res)
    } catch (e) {
      throw new ModelError("MODEL_STORAGE_FAILED", `Falha ao persistir ${assetPath}`, { cause: e })
    }
  }

  async delete(assetPath: string, version: string): Promise<void> {
    if (typeof caches === "undefined") return
    try {
      const cache = await caches.open(this.cacheNameFor(version))
      await cache.delete(this.keyUrl(assetPath, version))
    } catch {}
  }

  async clearVersion(version: string): Promise<void> {
    if (typeof caches === "undefined") return
    try {
      await caches.delete(this.cacheNameFor(version))
    } catch {}
  }

  async isAvailable(manifest: ModelManifest): Promise<boolean> {
    for (const asset of [manifest.assets.model, manifest.assets.tokenizer, manifest.assets.voice] as const) {
      if (!(await this.has(asset.path, manifest.version))) return false
    }
    return true
  }
}

/**
 * Implementação em memória (testes Node, fallback).
 * Namespace por versão via Map<cacheName, Map<assetPath, Uint8Array>>.
 */
export class MemoryModelStorage implements ModelStorage {
  private stores = new Map<string, Map<string, Uint8Array>>()

  private storeFor(version: string): Map<string, Uint8Array> {
    const name = storageCacheName(version)
    let s = this.stores.get(name)
    if (!s) {
      s = new Map()
      this.stores.set(name, s)
    }
    return s
  }

  async has(assetPath: string, version: string): Promise<boolean> {
    return this.storeFor(version).has(assetPath)
  }

  async get(assetPath: string, version: string): Promise<Uint8Array | null> {
    return this.storeFor(version).get(assetPath) ?? null
  }

  async put(assetPath: string, version: string, data: Uint8Array): Promise<void> {
    // clone para evitar mutação externa
    this.storeFor(version).set(assetPath, new Uint8Array(data))
  }

  async delete(assetPath: string, version: string): Promise<void> {
    this.storeFor(version).delete(assetPath)
  }

  async clearVersion(version: string): Promise<void> {
    this.stores.delete(storageCacheName(version))
  }

  async isAvailable(manifest: ModelManifest): Promise<boolean> {
    const store = this.storeFor(manifest.version)
    for (const asset of [manifest.assets.model, manifest.assets.tokenizer, manifest.assets.voice] as const) {
      if (!store.has(asset.path)) return false
    }
    return true
  }

  /** Introspecção para testes */
  size(version: string): number {
    return this.storeFor(version).size
  }
}

/** Detecta ambiente Capacitor nativo (Android/iOS) sem importar dinamicamente o plugin. */
export function isNativeCapacitorEnvironment(): boolean {
  if (typeof window === "undefined") return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor
  if (!cap) return false
  try {
    if (typeof cap.isNativePlatform === "function" && cap.isNativePlatform() === true) return true
  } catch {}
  const platform = typeof cap.getPlatform === "function" ? cap.getPlatform() : "web"
  return platform !== "web" && platform !== ""
}

export function createDefaultStorage(): ModelStorage {
  // FASE 3.1: Android nativo → Filesystem Directory.Data (persistente real)
  if (isNativeCapacitorEnvironment()) {
    try {
      return new CapacitorModelStorage()
    } catch {
      // fallback para Cache abaixo se Capacitor indisponível
    }
  }
  if (typeof caches !== "undefined") return new CacheModelStorage()
  return new MemoryModelStorage()
}

/** Factory para uso explícito em Android (quando injeção é preferida a createDefaultStorage). */
export function createCapacitorAwareStorage(): ModelStorage {
  if (isNativeCapacitorEnvironment()) {
    try {
      return new CapacitorModelStorage()
    } catch {}
  }
  return createDefaultStorage()
}
