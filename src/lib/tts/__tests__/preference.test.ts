import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setTtsUser,
  setTtsEnabled,
  getTtsEnabled,
  getTtsSnapshot,
  subscribeTts,
  getTtsStorageKey,
  ttsPreferenceDebugReset,
  STORAGE_KEY_PREFIX,
} from "../preference";

function storageMock() {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  };
  return { store, map };
}

describe("TTS-INTEGRATION-003 — preferência TTS (localStorage por usuário)", () => {
  let env: {
    store: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
    map: Map<string, string>;
  };

  beforeEach(() => {
    env = storageMock();
    (globalThis as unknown as { window: unknown }).window = { localStorage: env.store };
    ttsPreferenceDebugReset();
  });

  afterEach(() => {
    ttsPreferenceDebugReset();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("default: TTS desligado sem valor persistido", () => {
    expect(getTtsEnabled()).toBe(false);
  });

  it("persiste ON em localStorage e re-lê", () => {
    setTtsEnabled(true);
    expect(env.store.getItem(`${STORAGE_KEY_PREFIX}`)).toBe("true");
    expect(getTtsEnabled()).toBe(true);
    ttsPreferenceDebugReset();
    expect(getTtsEnabled()).toBe(true);
  });

  it("persiste OFF", () => {
    setTtsEnabled(true);
    setTtsEnabled(false);
    expect(env.store.getItem(`${STORAGE_KEY_PREFIX}`)).toBe("false");
    expect(getTtsEnabled()).toBe(false);
  });

  it("por usuário: chaves diferentes por paciente (sem cruzamento)", () => {
    setTtsUser("paciente-A");
    setTtsEnabled(true);
    expect(env.store.getItem(`${STORAGE_KEY_PREFIX}:paciente-A`)).toBe("true");

    setTtsUser("paciente-B");
    expect(getTtsEnabled()).toBe(false); // B não herda A

    setTtsEnabled(false);
    setTtsUser("paciente-A");
    expect(getTtsEnabled()).toBe(true); // A preserva o próprio valor
  });

  it("sem usuário → volta para a chave genérica", () => {
    setTtsUser("paciente-A");
    setTtsEnabled(true);
    setTtsUser(null);
    expect(getTtsStorageKey()).toBe(STORAGE_KEY_PREFIX);
    expect(getTtsEnabled()).toBe(false);
  });

  it("getTtsStorageKey reflete o usuário ativo", () => {
    expect(getTtsStorageKey()).toBe(STORAGE_KEY_PREFIX);
    setTtsUser("u1");
    expect(getTtsStorageKey()).toBe(`${STORAGE_KEY_PREFIX}:u1`);
  });

  it("notifica assinantes (Chat e Settings reagem juntos)", () => {
    const listener = vi.fn();
    const unsub = subscribeTts(listener);
    setTtsEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setTtsUser("u1"); // mudança de chave também notifica
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
    setTtsEnabled(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("snapshot estável para useSyncExternalStore", () => {
    expect(getTtsSnapshot()).toBe(false);
    setTtsEnabled(true);
    expect(getTtsSnapshot()).toBe(true);
  });

  it("SSR seguro: sem window não quebra", () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    setTtsEnabled(true); // no-op
    expect(getTtsEnabled()).toBe(false);
    expect(getTtsSnapshot()).toBe(false);
  });

  it("storage inacessível (erro) → default false sem crash", () => {
    (globalThis as unknown as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      },
    };
    expect(getTtsEnabled()).toBe(false);
    setTtsEnabled(true);
  });
});