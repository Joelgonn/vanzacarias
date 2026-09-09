/**
 * TTS-006 — Tipos/contrato do runtime browser (compartilhados index↔worker).
 *
 * O runtime principal (main thread) fala com o worker via mensagens
 * estruturadas (`WorkerRequest`/`WorkerResponse`). O resultado de síntese
 * atravessa via structured clone com transfer list (AudioResult em
 * Float32Array 24 kHz mono + WAV PCM16, como no runtime Node).
 */

import type { TTSRuntimeInfo } from "../../engine/types";
import type { BrowserAssetUrls } from "./asset-loader";
import type { SynthesisResult } from "../../engine/types";

/** Estados do ciclo de vida (espelha TtsService do app). */
export type BrowserRuntimeState =
  | "UNINITIALIZED"
  | "LOADING"
  | "READY"
  | "SYNTHESIZING"
  | "DISPOSED";

export interface BrowserCapabilities {
  /** Ambiente consegue criar Worker (main thread). */
  readonly worker: boolean;
  /** crossOriginIsolated (COOP/COEP) → WASM threads disponíveis. Preenchido pelo worker. */
  readonly threads: boolean;
  /** WASM SIMD habilitado no onnxruntime-web. Preenchido pelo worker. */
  readonly simd: boolean;
  /** Núcleos lógicos (navigator.hardwareConcurrency). Preenchido pelo worker. */
  readonly cores: number;
}

export type BrowserModel = "fp32" | "q8";

export interface KokoroBrowserRuntimeOptions {
  readonly model?: BrowserModel;
  readonly voice?: string;
  /** Se true, aplica normalização vozz (números, unidades, horários, %). Padrão true. */
  readonly normalizar?: boolean;
  /** Diretório dos assets (modelo/tokenizer/voz). Padrão: novas URLs a partir de assetUrls. */
  readonly baseUrl?: string;
  /** URLs customizadas dos assets (sobrepõem os defaults de baseUrl). */
  readonly assetUrls?: Partial<BrowserAssetUrls>;
  /** URL do worker (bundle). Padrão: ./worker.js ao lado deste módulo. */
  readonly workerUrl?: string;
  /** Número de threads WASM (usa min(numThreads, cores)) quando crossOriginIsolated. */
  readonly numThreads?: number;
  /** Onde servir os .wasm do onnxruntime-web (wasmPaths). */
  readonly wasmPaths?: string;
  /** Cria o Worker (injeção para testes; padrão: new Worker(...)). */
  readonly workerFactory?: () => Worker;
  readonly logger?: (line: string) => void;
}

export interface KokoroBrowserSynthResult extends SynthesisResult {
  readonly phonemes: string;
  readonly ortMs: number;
}

/** Info do runtime browser — estende o contrato mínimo com os metadados de voce. */
export interface KokoroBrowserInfo extends TTSRuntimeInfo {
  readonly modelConfig: string;
  readonly voiceId: string;
  readonly maxPhonemes: number;
  readonly weightLicense: string;
  readonly phonemizer: string;
  readonly g2pLicense: string;
  readonly normalizer: string;
}

export interface BrowserInitPayload {
  readonly model: BrowserModel;
  readonly voice: string;
  readonly normalizar: boolean;
  readonly assetUrls: BrowserAssetUrls;
  readonly wasmPaths?: string;
  readonly numThreads?: number;
}

export type WorkerRequest =
  | { readonly kind: "init"; readonly id: number; readonly payload: BrowserInitPayload }
  | { readonly kind: "synth"; readonly id: number; readonly payload: { readonly text: string; readonly speed?: number } }
  | { readonly kind: "dispose"; readonly id: number };

export interface WorkerReadyPayload {
  readonly info: KokoroBrowserInfo;
  readonly ortVersion: string;
  readonly downloadedBytes: number;
  readonly threads: boolean;
  readonly simd: boolean;
  readonly cores: number;
}

export type WorkerResponse =
  | { readonly kind: "ready"; readonly id: number; readonly payload: WorkerReadyPayload }
  | { readonly kind: "synth-result"; readonly id: number; readonly payload: KokoroBrowserSynthResult }
  | { readonly kind: "error"; readonly id: number; readonly payload: { readonly name: string; readonly message: string } }
  | { readonly kind: "disposed"; readonly id: number };