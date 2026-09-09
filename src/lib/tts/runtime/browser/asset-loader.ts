/**
 * TTS-006 — AssetLoader do runtime browser (fetch puro).
 *
 * O runtime Node lê os assets do filesystem; o browser baixa via `fetch`.
 * Falhas de rede/HTTP viram `TTSRuntimeError` com status e URL — nunca expõe
 * internals do ONNX como contrato público. URLs relativas são resolvidas
 * contra `baseUrl` (self.location.href quando ausente).
 */

import { TTSRuntimeError } from "../../core/errors";

export interface BrowserAssetUrls {
  /** URL do modelo ONNX (ex.: model_quantized.onnx). */
  readonly modelUrl: string;
  /** URL do tokenizer.json. */
  readonly tokenizerUrl: string;
  /** URL do arquivo de voz (.bin) — ex.: voices/pf_dora.bin. */
  readonly voiceUrl: string;
}

export interface AssetLoaderOptions {
  /** Base resolvida para URLs relativas (ex.: origem do host estático/CDN). */
  readonly baseUrl?: string;
}

export class BrowserAssetLoader {
  private readonly baseUrl: string | undefined;

  constructor(options: AssetLoaderOptions = {}) {
    this.baseUrl = options.baseUrl;
  }

  /** Resolve uma URL relativa contra baseUrl (ou devolve como está). */
  resolve(url: string): string {
    if (!this.baseUrl) return url;
    return new URL(url, this.baseUrl).href;
  }

  async fetchBytes(url: string): Promise<Uint8Array> {
    const resolved = this.resolve(url);
    const response = await fetch(resolved);
    if (!response.ok) {
      throw new TTSRuntimeError(
        `Falha ao baixar asset (${response.status} ${response.statusText || "erro"}): ${url}`,
      );
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async fetchText(url: string): Promise<string> {
    const resolved = this.resolve(url);
    const response = await fetch(resolved);
    if (!response.ok) {
      throw new TTSRuntimeError(
        `Falha ao baixar asset (${response.status} ${response.statusText || "erro"}): ${url}`,
      );
    }
    return response.text();
  }
}