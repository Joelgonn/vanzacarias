import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isExemptRole,
  loadOnboardingState,
  resolveNextOnboardingRoute,
} from '@/lib/onboarding/loadOnboardingState';
import { QFA_ITEM_IDS } from '@/lib/qfa/schema';

// =========================================================================
// Carregamento central: exceção de admin/nutricionista, falha de consulta e
// decisão da próxima rota. Supabase é substituído por um cliente fake thenable.
// =========================================================================

const NOW = new Date('2026-01-10T12:00:00Z');
const USER_ID = '00000000-0000-0000-0000-000000000000';

type TableName = 'profiles' | 'qfa_responses' | 'checkins';

interface FakeResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

function fakeClient(results: Record<TableName, FakeResult>): SupabaseClient {
  return {
    from(table: TableName) {
      const result = results[table];
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        maybeSingle: () => Promise.resolve(result),
        then: (onFulfilled: unknown, onRejected: unknown) =>
          Promise.resolve(result).then(
            onFulfilled as (value: FakeResult) => unknown,
            onRejected as (reason: unknown) => unknown
          ),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const perfilCompleto = {
  full_name: 'Ana Souza',
  phone: '11999999999',
  data_nascimento: '1990-01-01',
  sexo: 'feminino',
  food_restrictions: [],
  role: 'patient',
};

const qfaCompleto = Object.fromEntries(
  QFA_ITEM_IDS.map((id) => [id, '0'])
);

const checkinValido = {
  created_at: '2025-11-01T10:00:00Z',
  peso: 72.5,
  adesao_ao_plano: 4,
  humor_semanal: 5,
};

function completeResults(): Record<TableName, FakeResult> {
  return {
    profiles: { data: perfilCompleto, error: null },
    qfa_responses: { data: { answers: qfaCompleto }, error: null },
    checkins: { data: [checkinValido], error: null },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isExemptRole', () => {
  it('isenta admin e nutricionista do onboarding de paciente', () => {
    expect(isExemptRole('admin')).toBe(true);
    expect(isExemptRole('nutricionista')).toBe(true);
    expect(isExemptRole('patient')).toBe(false);
    expect(isExemptRole(null)).toBe(false);
  });
});

describe('loadOnboardingState', () => {
  it('lê as três fontes e conclui as quatro etapas', async () => {
    const result = await loadOnboardingState(fakeClient(completeResults()), USER_ID, NOW);

    expect(result.isExempt).toBe(false);
    expect(result.snapshot).toMatchObject({
      perfil: 'completed',
      perfilAlimentar: 'completed',
      raioX: 'completed',
      checkin: 'completed',
      nextAction: 'none',
      completedCount: 4,
    });
    expect(result.errors).toEqual({ profile: false, qfa: false, checkin: false });
  });

  it('perfil ausente é "não iniciado", não indisponível', async () => {
    const results = completeResults();
    results.profiles = { data: null, error: null };
    const result = await loadOnboardingState(fakeClient(results), USER_ID, NOW);

    expect(result.snapshot.perfil).toBe('not_started');
    expect(result.snapshot.nextAction).toBe('perfil');
    expect(result.errors.profile).toBe(false);
  });

  it('falha de consulta vira unavailable e não presume pendência', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const results = completeResults();
    results.qfa_responses = { data: null, error: { message: 'RLS' } };

    const result = await loadOnboardingState(fakeClient(results), USER_ID, NOW);

    expect(result.snapshot.raioX).toBe('unavailable');
    expect(result.snapshot.hasUnavailable).toBe(true);
    expect(result.snapshot.nextAction).toBe('none');
    expect(result.errors.qfa).toBe(true);
    expect(consoleError).toHaveBeenCalled();
  });

  it('admin/nutricionista não recebem pendência de onboarding', async () => {
    const results = completeResults();
    results.profiles = {
      data: { ...perfilCompleto, role: 'nutricionista' },
      error: null,
    };

    const result = await loadOnboardingState(fakeClient(results), USER_ID, NOW);

    expect(result.isExempt).toBe(true);
  });
});

describe('resolveNextOnboardingRoute', () => {
  it('paciente completo não é redirecionado', async () => {
    const result = await resolveNextOnboardingRoute(
      fakeClient(completeResults()),
      USER_ID,
      NOW
    );
    expect(result).toEqual({ route: null, unavailable: false, exempt: false });
  });

  it('paciente com perfil pendente é enviado à etapa 1', async () => {
    const results = completeResults();
    results.profiles = { data: null, error: null };

    const result = await resolveNextOnboardingRoute(fakeClient(results), USER_ID, NOW);

    expect(result.route).toBe('/dashboard/perfil');
    expect(result.unavailable).toBe(false);
  });

  it('consulta indisponível não devolve rota presumida', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const results = completeResults();
    results.checkins = { data: null, error: { message: 'timeout' } };

    const result = await resolveNextOnboardingRoute(fakeClient(results), USER_ID, NOW);

    expect(result).toEqual({ route: null, unavailable: true, exempt: false });
  });

  it('admin/nutricionista é conduzido ao painel administrativo, mesmo com consultas falhando', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = fakeClient({
      profiles: {
        data: { ...perfilCompleto, role: 'admin' },
        error: null,
      },
      qfa_responses: { data: null, error: { message: 'RLS' } },
      checkins: { data: null, error: { message: 'RLS' } },
    });

    const result = await resolveNextOnboardingRoute(client, USER_ID, NOW);

    expect(result).toEqual({
      route: '/admin/dashboard',
      unavailable: false,
      exempt: true,
    });
  });
});
