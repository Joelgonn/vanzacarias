import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiUrl, getApiBase, isCrossOriginApi } from '../apiBase';
import { getBearerToken } from '../supabase/serverAuth';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('CAP-PROD-003 — API_BASE (frontend local × web)', () => {
  it('web (sem Capacitor): base vazia e URLs relativas (comportamento atual)', () => {
    expect(getApiBase()).toBe('');
    expect(isCrossOriginApi()).toBe(false);
    expect(apiUrl('/api/nutri-assistant/patient')).toBe('/api/nutri-assistant/patient');
  });

  it('Capacitor nativo: base remota (produção) e URLs absolutas', () => {
    const w = globalThis as unknown as { window?: unknown };
    w.window = { Capacitor: { isNativePlatform: () => true } };
    expect(getApiBase()).toBe('https://vanzacarias-mu.vercel.app');
    expect(isCrossOriginApi()).toBe(true);
    expect(apiUrl('/api/nutri-assistant/patient')).toBe(
      'https://vanzacarias-mu.vercel.app/api/nutri-assistant/patient'
    );
  });
});

describe('CAP-PROD-003 — Bearer (serverAuth)', () => {
  it('extrai token Bearer válido (case-insensitive) e ignora ausentes/inválidos', () => {
    expect(getBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(getBearerToken('bearer   xyz')).toBe('xyz');
    expect(getBearerToken(null)).toBeNull();
    expect(getBearerToken('Basic abc')).toBeNull();
    expect(getBearerToken('')).toBeNull();
  });
});
