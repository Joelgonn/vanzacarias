// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useOnboardingStepIntro } from '@/hooks/useOnboardingStepIntro';
import { getOnboardingIntroStorageKey } from '@/lib/onboarding/introState';
import type {
  JourneyStepKey,
  PatientJourneySnapshot,
} from '@/lib/patientJourney';
import { QFA_ITEM_IDS } from '@/lib/qfa/schema';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const USER_ID = 'user-1';
const QFA_ANSWERS = Object.fromEntries(QFA_ITEM_IDS.map((id) => [id, '0']));

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

interface FakeResults {
  profiles: FakeResult;
  qfa_responses: FakeResult;
  checkins: FakeResult;
}

function resultsFor(next: JourneyStepKey | 'none', role = 'patient'): FakeResults {
  const profile = {
    full_name: 'Ana Souza',
    phone: '11999999999',
    data_nascimento: '1990-01-01',
    sexo: 'feminino',
    food_restrictions: [] as unknown,
    role,
  };
  const completeCheckin = {
    created_at: '2026-01-09T10:00:00Z',
    peso: 72.5,
    adesao_ao_plano: 4,
    humor_semanal: 5,
  };

  const state: FakeResults = {
    profiles: { data: profile, error: null },
    qfa_responses: { data: { answers: QFA_ANSWERS }, error: null },
    checkins: { data: [completeCheckin], error: null },
  };

  if (next === 'perfil') {
    state.profiles = { data: { ...profile, full_name: '' }, error: null };
    state.qfa_responses = { data: null, error: null };
    state.checkins = { data: [], error: null };
  } else if (next === 'perfilAlimentar') {
    state.profiles = { data: { ...profile, food_restrictions: null }, error: null };
  } else if (next === 'raioX') {
    state.qfa_responses = { data: null, error: null };
  } else if (next === 'checkin') {
    state.checkins = { data: [], error: null };
  }

  return state;
}

function makeFake(
  results: FakeResults,
  options: { sessionGate?: Promise<void>; throwOnFrom?: boolean } = {}
) {
  const fromCalls: string[] = [];
  const builder = (result: FakeResult) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      maybeSingle: async () => result,
      then: (onFulfilled: unknown, onRejected: unknown) =>
        Promise.resolve(result).then(
          onFulfilled as (value: FakeResult) => unknown,
          onRejected as (reason: unknown) => unknown
        ),
    };
    return chain;
  };

  const client = {
    auth: {
      getSession: vi.fn(async () => {
        if (options.sessionGate) await options.sessionGate;
        return { data: { session: { user: { id: USER_ID } } } };
      }),
    },
    from: vi.fn((table: keyof FakeResults) => {
      if (options.throwOnFrom) throw new Error('from() não deveria ser chamado');
      fromCalls.push(table);
      return builder(results[table]);
    }),
  };

  return { client: client as unknown as SupabaseClient, fromCalls };
}

function snapshotFor(next: JourneyStepKey): PatientJourneySnapshot {
  const order: JourneyStepKey[] = ['perfil', 'perfilAlimentar', 'raioX', 'checkin'];
  const index = order.indexOf(next);
  const snapshot: PatientJourneySnapshot = {
    perfil: 'completed',
    perfilAlimentar: 'completed',
    raioX: 'completed',
    checkin: 'completed',
    nextAction: next,
    hasPending: true,
    hasUnavailable: false,
    completedCount: index,
    totalSteps: 4,
  };
  order.forEach((key, keyIndex) => {
    snapshot[key] = keyIndex < index ? 'completed' : 'not_started';
  });
  return snapshot;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latest: ReturnType<typeof useOnboardingStepIntro> | null = null;

function Probe({
  client,
  step,
  enabled = true,
  snapshot,
}: {
  client: SupabaseClient;
  step: JourneyStepKey;
  enabled?: boolean;
  snapshot?: PatientJourneySnapshot | null;
}) {
  const state = useOnboardingStepIntro({ step, supabase: client, enabled, snapshot });
  useEffect(() => {
    latest = state;
  }, [state]);
  return null;
}

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function waitFor(predicate: () => boolean, label: string) {
  for (let i = 0; i < 30; i++) {
    if (predicate()) return;
    await flush();
  }
  throw new Error(`timeout aguardando ${label}`);
}

async function mount(props: Parameters<typeof Probe>[0]) {
  if (!container || !root) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root?.render(createElement(Probe, props));
  });
  await flush();
}

async function unmount() {
  if (!root) return;
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  latest = null;
}

beforeEach(() => {
  sessionStorage.clear();
  latest = null;
});

afterEach(async () => {
  await unmount();
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

describe('useOnboardingStepIntro — estado central', () => {
  it('não mostra durante o carregamento', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { client } = makeFake(resultsFor('perfil'), { sessionGate: gate });

    await mount({ client, step: 'perfil' });
    expect(latest?.loading).toBe(true);
    expect(latest?.show).toBe(false);

    release();
    await waitFor(() => latest?.loading === false, 'fim do carregamento');
    await waitFor(() => latest?.show === true, 'intro exibida');
  });

  it('não mostra quando a consulta central falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const results = resultsFor('perfil');
    results.qfa_responses = { data: null, error: { message: 'RLS' } };
    const { client } = makeFake(results);

    await mount({ client, step: 'perfil' });
    await waitFor(() => latest?.loading === false, 'fim do carregamento');

    expect(latest?.show).toBe(false);
    expect(latest?.unavailable).toBe(true);
  });

  it('não mostra para usuário isento', async () => {
    const { client } = makeFake(resultsFor('perfil', 'admin'));

    await mount({ client, step: 'perfil' });
    await waitFor(() => latest?.loading === false, 'fim do carregamento');

    expect(latest?.isExempt).toBe(true);
    expect(latest?.show).toBe(false);
  });

  it('mostra somente a etapa que é a próxima ação', async () => {
    for (const step of ['perfil', 'perfilAlimentar', 'raioX', 'checkin'] as const) {
      const { client } = makeFake(resultsFor(step));
      await mount({ client, step });
      await waitFor(() => latest?.loading === false, 'fim do carregamento');
      await waitFor(() => latest?.show === true, `intro ${step}`);
      expect(latest?.snapshot?.nextAction).toBe(step);
      await unmount();
    }
  });

  it('não mostra quando a etapa já está concluída', async () => {
    const { client } = makeFake(resultsFor('none'));

    await mount({ client, step: 'checkin' });
    await waitFor(() => latest?.loading === false, 'fim do carregamento');

    expect(latest?.show).toBe(false);
  });

  it('usa snapshot confiável e não refaz consultas', async () => {
    const { client, fromCalls } = makeFake(resultsFor('none'), { throwOnFrom: true });

    await mount({
      client,
      step: 'perfil',
      snapshot: snapshotFor('perfil'),
    });
    await waitFor(() => latest?.loading === false, 'fim do carregamento');

    expect(latest?.show).toBe(true);
    expect(fromCalls).toHaveLength(0);
  });
});

describe('useOnboardingStepIntro — dispensa por usuário/etapa', () => {
  it('persiste a dispensa no sessionStorage com chave isolada', async () => {
    const { client } = makeFake(resultsFor('perfil'));
    await mount({ client, step: 'perfil' });
    await waitFor(() => latest?.show === true, 'intro exibida');

    await act(async () => {
      latest?.dismiss();
    });

    expect(latest?.show).toBe(false);
    expect(sessionStorage.getItem(getOnboardingIntroStorageKey(USER_ID, 'perfil'))).toBe('1');
  });

  it('não reapresenta após nova montagem na mesma sessão', async () => {
    const { client } = makeFake(resultsFor('perfil'));
    await mount({ client, step: 'perfil' });
    await waitFor(() => latest?.show === true, 'intro exibida');
    await act(async () => {
      latest?.dismiss();
    });
    await unmount();

    await mount({ client, step: 'perfil' });
    await waitFor(() => latest?.loading === false, 'fim do carregamento');
    expect(latest?.show).toBe(false);
  });

  it('reexibe em uma nova sessão (sessionStorage limpo)', async () => {
    const { client } = makeFake(resultsFor('perfil'));
    await mount({ client, step: 'perfil' });
    await waitFor(() => latest?.show === true, 'intro exibida');
    await act(async () => {
      latest?.dismiss();
    });
    await unmount();

    sessionStorage.clear();
    await mount({ client, step: 'perfil' });
    await waitFor(() => latest?.show === true, 'intro reexibida');
  });

  it('não compartilha a dispensa entre etapas', async () => {
    const { client } = makeFake(resultsFor('perfil'));
    await mount({ client, step: 'perfil' });
    await waitFor(() => latest?.show === true, 'intro exibida');
    await act(async () => {
      latest?.dismiss();
    });
    await unmount();

    // Mesmo usuário, próxima etapa: chave diferente.
    const next = makeFake(resultsFor('perfilAlimentar'));
    await mount({ client: next.client, step: 'perfilAlimentar' });
    await waitFor(() => latest?.show === true, 'intro da próxima etapa');
  });
});
