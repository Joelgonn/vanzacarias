/**
 * TTS-CAP-004 FASE 3.1 — CapacitorStorage (persistência Android).
 *
 * Abstração ModelStorage para Android via Capacitor Filesystem Directory.Data
 *  - Sobrevive a fechar app, reload, WebView restart.
 *  - Não coloca modelo dentro do APK.
 *  - Binário armazenado como base64 (contrato do plugin quando encoding omitido).
 *
 * ModelManager não conhece Capacitor diretamente; apenas recebe ModelStorage.
 * O download/integridade continuam centralizados em ModelManager + download.ts.
 */

import type { ModelManifest } from "./manifest"
import { ModelError } from "./errors"
import type { ModelStorage } from "./storage"

// Helpers base64: funcionam em browser (btoa/atob) e Node (Buffer) para testes.
function encodeBase64(bytes: Uint8Array): string {
  // Node: Buffer é mais eficiente e evita limites de String.fromCharCode para 92 MB.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any
  if (typeof g.Buffer !== "undefined" && typeof g.Buffer.from === "function") {
    return g.Buffer.from(bytes).toString("base64")
  }
  // Browser chunked btoa para evitar stack overflow
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    // String.fromCharCode.apply com chunk 32k é seguro
    binary += String.fromCharCode.apply(null, sub as unknown as number[])
  }
  return btoa(binary)
}

function decodeBase64(b64: string): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any
  if (typeof g.Buffer !== "undefined" && typeof g.Buffer.from === "function") {
    const buf = g.Buffer.from(b64, "base64")
    return new Uint8Array(buf)
  }
  const binary = atob(b64)
  const len = binary.length
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i)
  return out
}

function assetFilePath(assetPath: string, version: string): string {
  // Namespace: tts-model/<version>/<assetPath> dentro de Directory.Data
  // assetPath ex.: "model_quantized.onnx" ou "voices/pf_dora.bin"
  return `tts-model/${version}/${assetPath}`
}

function versionDir(version: string): string {
  return `tts-model/${version}`
}

async function getFilesystem() {
  // dynamic import para não quebrar build web/SSR quando plugin não inicializado
  const mod = await import("@capacitor/filesystem")
  return mod
}

export class CapacitorModelStorage implements ModelStorage {
  async has(assetPath: string, version: string): Promise<boolean> {
    try {
      const { Filesystem, Directory } = await getFilesystem()
      const path = assetFilePath(assetPath, version)
      await Filesystem.stat({ path, directory: Directory.Data })
      return true
    } catch {
      return false
    }
  }

  async get(assetPath: string, version: string): Promise<Uint8Array | null> {
    try {
      const { Filesystem, Directory } = await getFilesystem()
      const path = assetFilePath(assetPath, version)
      const result = await Filesystem.readFile({ path, directory: Directory.Data })
      const data = result.data
      if (typeof data === "string") {
        // plugin retorna base64 quando encoding omitido
        if (data.length === 0) return new Uint8Array(0)
        return decodeBase64(data as string)
      }
      if (data instanceof Blob) {
        const buf = await (data as Blob).arrayBuffer()
        return new Uint8Array(buf)
      }
      return null
    } catch {
      return null
    }
  }

  async put(assetPath: string, version: string, data: Uint8Array): Promise<void> {
    try {
      const { Filesystem, Directory } = await getFilesystem()
      const path = assetFilePath(assetPath, version)
      const b64 = encodeBase64(data)
      await Filesystem.writeFile({ path, directory: Directory.Data, data: b64, recursive: true })
    } catch (e) {
      throw new ModelError("MODEL_STORAGE_FAILED", `Falha ao persistir ${assetPath} em Capacitor Filesystem`, { cause: e })
    }
  }

  async delete(assetPath: string, version: string): Promise<void> {
    try {
      const { Filesystem, Directory } = await getFilesystem()
      const path = assetFilePath(assetPath, version)
      await Filesystem.deleteFile({ path, directory: Directory.Data })
    } catch {
      // idempotente
    }
  }

  async clearVersion(version: string): Promise<void> {
    try {
      const { Filesystem, Directory } = await getFilesystem()
      const dir = versionDir(version)
      // rmdir recursive remove todos os assets da versão
      await Filesystem.rmdir({ path: dir, directory: Directory.Data, recursive: true })
    } catch {
      // se diretório não existe, considera limpo
      // fallback: tenta deletar assets individuais se rmdir não suportado
      try {
        const { Filesystem: FS2, Directory: Dir2 } = await getFilesystem()
        // listar e deletar individualmente (best-effort)
        const dir = versionDir(version)
        const listing = await FS2.readdir({ path: dir, directory: Dir2.Data }).catch(() => null)
        if (listing && listing.files) {
          for (const f of listing.files) {
            const sub = `${dir}/${f.name}`
            try {
              if (f.type === "directory") await FS2.rmdir({ path: sub, directory: Dir2.Data, recursive: true })
              else await FS2.deleteFile({ path: sub, directory: Dir2.Data })
            } catch {}
          }
          await FS2.rmdir({ path: dir, directory: Dir2.Data, recursive: true }).catch(() => {})
        }
      } catch {}
    }
  }

  async isAvailable(manifest: ModelManifest): Promise<boolean> {
    for (const asset of [manifest.assets.model, manifest.assets.tokenizer, manifest.assets.voice] as const) {
      if (!(await this.has(asset.path, manifest.version))) return false
    }
    return true
  }
}

/** Factory helper para testes/inspeção */
export function createCapacitorStorage(): CapacitorModelStorage {
  return new CapacitorModelStorage()
}
