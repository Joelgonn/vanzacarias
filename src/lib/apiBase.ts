// CAP-PROD-003 — API_BASE centralizada para o frontend local (arquitetura C).
//
// WEB: base vazia → chamadas relativas (comportamento atual, cookie + SSR).
// CAPACITOR (shell local): base remota (produção) → Bearer via chatApi.
// Ponto único de verdade para evitar URLs espalhadas.
import { detectNativeCapacitor } from './tts/synthesizer';

/** URL do backend remoto usada pelo shell local (config canônica do projeto). */
const REMOTE_BACKEND_URL =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ?? 'https://vanzacarias-mu.vercel.app';

/** Base da API conforme o ambiente (web = '', Capacitor = remota). */
export function getApiBase(): string {
  if (detectNativeCapacitor()) return REMOTE_BACKEND_URL;
  return '';
}

/** true quando a chamada é cross-origin (exige Authorization Bearer). */
export function isCrossOriginApi(): boolean {
  return getApiBase() !== '';
}

/** Monta a URL absoluta de um endpoint (caminho começa com '/'). */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
}
