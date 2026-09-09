/**
 * TTS-INTEGRATION-003 — Preferência única de TTS do Chat.
 *
 * Fonte de verdade ÚNICA (D04): Chat e Settings compartilham o mesmo valor.
 * Persistência: localStorage, por usuário/paciente (chave com userId), sem
 * Supabase, sem banco, sem sincronização entre dispositivos.
 *
 * Implementado como external store (padrão já usado no app, ex.: WhatsAppButton):
 * - `useSyncExternalStore` para atualização reativa sem Context.
 * - Snapshot com cache para hydration consistente (SSR).
 * - `setTtsUser` troca a chave quando a sessão é conhecida.
 */

const STORAGE_KEY_PREFIX = "tts_enabled";

let activeUserId: string | null = null;
let cached: boolean | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  return activeUserId ? `${STORAGE_KEY_PREFIX}:${activeUserId}` : STORAGE_KEY_PREFIX;
}

function readFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey()) === "true";
  } catch {
    return false;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

/** Define o usuário ativo (redefine a chave por paciente). null = chave genérica. */
export function setTtsUser(userId: string | null): void {
  const next = userId || null;
  if (next === activeUserId) return;
  activeUserId = next;
  cached = readFromStorage();
  emit();
}

/** Leitura síncrona da preferência (usada pelo controller/hook). */
export function getTtsEnabled(): boolean {
  if (cached === null) cached = readFromStorage();
  return cached;
}

/** Persiste e notifica (fonte de verdade de ON/OFF). */
export function setTtsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  const next = !!enabled;
  try {
    window.localStorage.setItem(storageKey(), String(next));
  } catch {}
  cached = next;
  emit();
}

export function subscribeTts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot estável para `useSyncExternalStore` (hydration segura). */
export function getTtsSnapshot(): boolean {
  if (cached === null) cached = readFromStorage();
  return cached;
}

export function getTtsStorageKey(): string {
  return storageKey();
}

export function ttsPreferenceDebugReset(): void {
  activeUserId = null;
  cached = null;
  listeners.clear();
}

// Reexporta a chave usada nos testes.
export { STORAGE_KEY_PREFIX };