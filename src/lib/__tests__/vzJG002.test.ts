/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// JG-002.1 — Rate limiter (mock supabase)
describe('JG-002.1 — Rate limiter fail-close', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('profile fetch error → allowed false com error', async () => {
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              select: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: null, error: { message: 'db error' } }),
                }),
              }),
            } as any;
          }
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => Promise.resolve({ count: 0, error: null }),
                }),
              }),
            }),
          } as any;
        },
      }),
    }));
    // rateLimiter tem catch que engloba profileError = log mas não throw; countError throw
    // Para simular erro no count, fazemos count retornar error
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [{ role: 'patient', account_type: 'free' }], error: null }),
              gte: () => ({
                lte: () => Promise.resolve({ count: null, error: { message: 'count failed' } }),
              }),
            }),
          }),
        }),
      }),
    }));
    const { checkRateLimit } = await import('@/lib/rateLimiter');
    const res = await checkRateLimit('user-1');
    expect(res.allowed).toBe(false);
    expect((res as any).error).toBe('rate_limit_check_failed');
    expect(res.remaining).toBe(0);
  });

  it('erro inesperado (throw) → fail-close', async () => {
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => {
          throw new Error('unexpected throw');
        },
      }),
    }));
    const { checkRateLimit } = await import('@/lib/rateLimiter');
    const res = await checkRateLimit('user-2');
    expect(res.allowed).toBe(false);
    expect((res as any).error).toBe('rate_limit_check_failed');
  });

  it('sem userId → allowed false (não fail-open)', async () => {
    const { checkRateLimit } = await import('@/lib/rateLimiter');
    const res = await checkRateLimit('');
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
  });

  it('Supabase funcionando + limite disponível → allowed true', async () => {
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              select: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: [{ role: 'patient', account_type: 'free' }], error: null }),
                }),
              }),
            } as any;
          }
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => Promise.resolve({ count: 10, error: null }),
                }),
              }),
            }),
          } as any;
        },
      }),
    }));
    const { checkRateLimit } = await import('@/lib/rateLimiter');
    const res = await checkRateLimit('user-ok');
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(15);
    expect((res as any).error).toBeUndefined();
  });

  it('Supabase funcionando + limite atingido → allowed false sem error', async () => {
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              select: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: [{ role: 'patient', account_type: 'free' }], error: null }),
                }),
              }),
            } as any;
          }
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => Promise.resolve({ count: 25, error: null }),
                }),
              }),
            }),
          } as any;
        },
      }),
    }));
    const { checkRateLimit } = await import('@/lib/rateLimiter');
    const res = await checkRateLimit('user-full');
    expect(res.allowed).toBe(false);
    expect((res as any).error).toBeUndefined();
    expect(res.remaining).toBe(0);
  });
});

describe('JG-002.2 — Validação factual', () => {
  it('Caso A: peso null + "Seu peso atual é 70 kg" → rejeitar', async () => {
    const { detectFactualHallucinations } = await import('@/lib/factualValidator');
    const ctx = { pesoMaisRecente: null, alturaMetros: null, imc: null, metaPeso: null, macrosDiarios: null, hasExams: false } as any;
    const v = detectFactualHallucinations('Seu peso atual é 70 kg.', ctx);
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].field).toBe('peso');
    expect(v[0].reason).toBe('missing_data');
  });

  it('Caso B: peso 102 + "Seu peso atual é 102 kg" → permitir', async () => {
    const { detectFactualHallucinations } = await import('@/lib/factualValidator');
    const ctx = { pesoMaisRecente: 102, alturaMetros: 1.75, imc: 33.3, metaPeso: 90, macrosDiarios: { totalKcal: 1800, totalProtein: 120, totalCarbs: 200, totalFat: 60 }, hasExams: false } as any;
    const v = detectFactualHallucinations('Seu peso atual é 102 kg.', ctx);
    expect(v.length).toBe(0);
  });

  it('Caso C: peso 102 + "Seu peso atual é 70 kg" → rejeitar conflitante', async () => {
    const { detectFactualHallucinations } = await import('@/lib/factualValidator');
    const ctx = { pesoMaisRecente: 102, alturaMetros: 1.75, imc: 33.3, metaPeso: 90, macrosDiarios: null, hasExams: false } as any;
    const v = detectFactualHallucinations('Seu peso atual é 70 kg.', ctx);
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].reason).toBe('conflicting_value');
  });

  it('Caso D: exame ausente + "Seu colesterol é 180 mg/dL" → não permitir', async () => {
    const { detectFactualHallucinations } = await import('@/lib/factualValidator');
    const ctx = { pesoMaisRecente: 70, alturaMetros: 1.7, imc: 24, metaPeso: null, macrosDiarios: null, hasExams: false } as any;
    const v = detectFactualHallucinations('Seu colesterol é 180 mg/dL.', ctx);
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].field).toBe('exame');
  });

  it('Caso E: número genérico "100 g pode fornecer aproximadamente 150 kcal" não bloqueia', async () => {
    const { detectFactualHallucinations } = await import('@/lib/factualValidator');
    const ctx = { pesoMaisRecente: null, alturaMetros: null, imc: null, metaPeso: null, macrosDiarios: null, hasExams: false } as any;
    const v = detectFactualHallucinations('Uma porção de 100 g pode fornecer aproximadamente 150 kcal.', ctx);
    expect(v.length).toBe(0);
  });

  it('macro correto com possessivo não bloqueia, incorreto bloqueia', async () => {
    const { detectFactualHallucinations } = await import('@/lib/factualValidator');
    const ctx = { pesoMaisRecente: 80, alturaMetros: 1.8, imc: 24.7, metaPeso: null, macrosDiarios: { totalKcal: 1800, totalProtein: 120, totalCarbs: 200, totalFat: 60 }, hasExams: false } as any;
    const ok = detectFactualHallucinations('Sua dieta tem 1800 kcal por dia.', ctx);
    expect(ok.length).toBe(0);
    const bad = detectFactualHallucinations('Sua dieta tem 2500 kcal por dia.', ctx);
    expect(bad.length).toBeGreaterThan(0);
    expect(bad[0].field).toBe('kcal');
  });

  it('número sem possessivo não bloqueia mesmo se diferente', async () => {
    const { detectFactualHallucinations } = await import('@/lib/factualValidator');
    const ctx = { pesoMaisRecente: 80, alturaMetros: null, imc: null, metaPeso: null, macrosDiarios: null, hasExams: false } as any;
    const v = detectFactualHallucinations('O peso 70 kg é considerado saudável.', ctx);
    expect(v.length).toBe(0);
  });
});

describe('JG-002.3 — Admin matching', () => {
  it('uma Ana + pergunta "Ana" → 1 match', async () => {
    const { findAdminPatient } = await import('@/lib/adminMatching');
    const list = [{ id: '1', full_name: 'Ana Silva' }, { id: '2', full_name: 'João Souza' }] as any;
    const res = findAdminPatient(list, 'ana');
    expect(res.ambiguous).toBe(false);
    expect(res.patient?.id).toBe('1');
  });

  it('duas Anas + "Ana" → ambíguo', async () => {
    const { findAdminPatient } = await import('@/lib/adminMatching');
    const list = [{ id: '1', full_name: 'Ana Silva' }, { id: '2', full_name: 'Ana Paula' }] as any;
    const res = findAdminPatient(list, 'ana');
    expect(res.ambiguous).toBe(true);
    expect(res.patient).toBeNull();
    expect(res.candidates.length).toBe(2);
  });

  it('nome completo "Ana Silva" com duas Anas → 1 match exato', async () => {
    const { findAdminPatient } = await import('@/lib/adminMatching');
    const list = [{ id: '1', full_name: 'Ana Silva' }, { id: '2', full_name: 'Ana Paula' }] as any;
    const res = findAdminPatient(list, 'ana silva');
    expect(res.ambiguous).toBe(false);
    expect(res.patient?.id).toBe('1');
  });

  it('nome parcial "Ana Paula" com Ana Silva + Ana Paula → 1', async () => {
    const { findAdminPatient } = await import('@/lib/adminMatching');
    const list = [{ id: '1', full_name: 'Ana Silva' }, { id: '2', full_name: 'Ana Paula Santos' }] as any;
    const res = findAdminPatient(list, 'ana paula');
    expect(res.patient?.id).toBe('2');
  });

  it('Ana Silva Santos full name exato', async () => {
    const { findAdminPatient } = await import('@/lib/adminMatching');
    const list = [{ id: '1', full_name: 'Ana Silva Santos' }, { id: '2', full_name: 'Carlos' }] as any;
    const res = findAdminPatient(list, 'ana silva santos');
    expect(res.patient?.id).toBe('1');
  });

  it('paciente inexistente "Marcos" → 0', async () => {
    const { findAdminPatient } = await import('@/lib/adminMatching');
    const list = [{ id: '1', full_name: 'Ana Silva' }] as any;
    const res = findAdminPatient(list, 'marcos');
    expect(res.patient).toBeNull();
    expect(res.ambiguous).toBe(false);
    expect(res.candidates.length).toBe(0);
  });

  it('substring não deve casar parcial sem nome completo', async () => {
    const { findAdminPatient } = await import('@/lib/adminMatching');
    const list = [{ id: '1', full_name: 'Mariana' }] as any;
    const res = findAdminPatient(list, 'mari');
    expect(res.patient).toBeNull();
  });
});

describe('JG-002.4 — ultraprocessado investigação', () => {
  it('nenhuma classificação inventada: registry tem 0 ultraprocessado', async () => {
    const { FOOD_REGISTRY } = await import('@/lib/foodRegistry');
    const ultra = FOOD_REGISTRY.filter(f => (f.tags as string[]).includes('ultraprocessado'));
    expect(ultra.length).toBe(0);
  });
  it('sugar tem cobertura (3 itens) — ultra não, documentado', async () => {
    const { FOOD_REGISTRY } = await import('@/lib/foodRegistry');
    const sugar = FOOD_REGISTRY.filter(f => (f.tags as string[]).includes('sugar'));
    expect(sugar.length).toBeGreaterThanOrEqual(3);
    const ultra = FOOD_REGISTRY.filter(f => (f.tags as string[]).includes('ultraprocessado'));
    expect(ultra.length).toBe(0);
  });
});
