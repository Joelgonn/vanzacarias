// CAP-PROD-003 — API_BASE centralizada para o frontend local (arquitetura C).
//
// WEB: base vazia → chamadas relativas (comportamento atual, cookie + SSR).
// CAPACITOR (shell local): base remota (produção) → Bearer via chatApi.
// Ponto único de verdade para evitar URLs espalhadas.
type CapacitorLike = { isNativePlatform?: () => boolean; getPlatform?: () => string } | undefined
function detectNativeCapacitor(): boolean {
  if (typeof window === "undefined") return false
  const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor
  if (!cap) return false
  if (typeof cap.isNativePlatform === "function") {
    try {
      if (cap.isNativePlatform() === true) return true
    } catch {}
  }
  const platform = typeof cap.getPlatform === "function" ? cap.getPlatform() : "web"
  return platform !== "web" && platform !== ""
}

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
