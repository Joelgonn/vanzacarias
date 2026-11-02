// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';

// Fase 2.2 — teste de runtime do hook (jsdom + React), sem Supabase real.
// Cobre carregamento inicial, concluído, pendente, indisponível, atualização
// por evento e remoção do listener no unmount.

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = { created_at: string };
type HookState = ReturnType<typeof useCheckinStatus>;

interface FakeState {
  rows: Row[];
  error: boolean;
  session: boolean;
  sessionGate?: Promise<void>;
  queries: number;
  eq: Array<[string, string]>;
}

const OLD_CHECKIN = '2026-01-01T12:00:00.000Z';
const nowIso = () => new Date().toISOString();

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeFake(options: {
  rows?: Row[];
  error?: boolean;
  session?: boolean;
  sessionGate?: Promise<void>;
} = {}) {
  const state: FakeState = {
    rows: options.rows ?? [],
    error: !!options.error,
    session: options.session !== false,
    sessionGate: options.sessionGate,
    queries: 0,
    eq: [],
  };

  const chain = {
    select: vi.fn(),
    eq: vi.fn((column: string, value: string) => {
      state.eq.push([column, value]);
      return chain;
    }),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => {
      state.queries += 1;
      if (state.error) {
        return { data: null, error: { message: 'falha de consulta' } };
      }
      return { data: state.rows, error: null };
    }),
  };
  chain.select.mockReturnValue(chain);

  const client = {
    auth: {
      getSession: vi.fn(async () => {
        if (state.sessionGate) await state.sessionGate;
        return {
          data: { session: state.session ? { user: { id: 'user-1' } } : null },
        };
      }),
    },
    from: vi.fn(() => chain),
  };

  return { client: client as unknown as SupabaseClient, state };
}

let container: HTMLDivElement;
let root: Root;
let latest: HookState | null;
let mounted: boolean;

function Probe({ client }: { client: SupabaseClient }) {
  latest = useCheckinStatus(client);
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

async function mount(client: SupabaseClient) {
  await act(async () => {
    root.render(createElement(Probe, { client }));
  });
  mounted = true;
}

async function unmount() {
  if (!mounted) return;
  await act(async () => {
    root.unmount();
  });
  mounted = false;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
  mounted = false;
});

afterEach(async () => {
  await unmount();
  container.remove();
});

describe('Fase 2.2 — useCheckinStatus', () => {
  it('carregamento inicial não afirma conclusão nem pendência', async () => {
    const gate = deferred();
    const { client } = makeFake({
      rows: [{ created_at: nowIso() }],
      sessionGate: gate.promise,
    });

    await mount(client);
    await flush();

    expect(latest?.doneChecked).toBe(false);
    expect(latest?.isDone).toBe(false);
    expect(latest?.unavailable).toBe(false);

    gate.resolve();
    await waitFor(() => latest?.doneChecked === true, 'doneChecked');
    expect(latest?.isDone).toBe(true);
    expect(latest?.unavailable).toBe(false);
  });

  it('check-in concluído -> isDone true e consulta do usuário autenticado', async () => {
    const fake = makeFake({ rows: [{ created_at: nowIso() }] });
    await mount(fake.client);
    await waitFor(() => latest?.doneChecked === true, 'doneChecked');

    expect(latest?.isDone).toBe(true);
    expect(latest?.unavailable).toBe(false);
    expect(fake.state.eq).toEqual([['user_id', 'user-1']]);
  });

  it('check-in pendente confirmado -> isDone false sem indisponibilidade', async () => {
    const fake = makeFake({ rows: [{ created_at: OLD_CHECKIN }] });
    await mount(fake.client);
    await waitFor(() => latest?.doneChecked === true, 'doneChecked');

    expect(latest?.isDone).toBe(false);
    expect(latest?.unavailable).toBe(false);
  });

  it('falha na consulta -> unavailable e nunca conclusão', async () => {
    const fake = makeFake({ error: true, rows: [{ created_at: nowIso() }] });
    await mount(fake.client);
    await waitFor(() => latest?.doneChecked === true, 'doneChecked');

    expect(latest?.isDone).toBe(false);
    expect(latest?.unavailable).toBe(true);
  });

  it('sem sessão -> consulta não é feita e não há indisponibilidade', async () => {
    const fake = makeFake({ session: false });
    await mount(fake.client);
    await waitFor(() => latest?.doneChecked === true, 'doneChecked');

    expect(latest?.isDone).toBe(false);
    expect(latest?.unavailable).toBe(false);
    expect(fake.state.queries).toBe(0);
  });

  it('evento de check-in atualiza sem remontar o componente', async () => {
    const fake = makeFake({ rows: [{ created_at: OLD_CHECKIN }] });
    await mount(fake.client);
    await waitFor(() => latest?.doneChecked === true, 'doneChecked');
    expect(latest?.isDone).toBe(false);

    fake.state.rows = [{ created_at: nowIso() }];
    await act(async () => {
      window.dispatchEvent(new Event('patient:checkin-updated'));
    });
    await waitFor(() => latest?.isDone === true, 'isDone após evento');

    expect(fake.state.queries).toBe(2);
    expect(fake.state.eq).toEqual([
      ['user_id', 'user-1'],
      ['user_id', 'user-1'],
    ]);
  });

  it('após falha, uma nova consulta bem-sucedida limpa unavailable', async () => {
    const fake = makeFake({ error: true });
    await mount(fake.client);
    await waitFor(() => latest?.doneChecked === true, 'doneChecked');
    expect(latest?.unavailable).toBe(true);

    fake.state.error = false;
    fake.state.rows = [{ created_at: nowIso() }];
    await act(async () => {
      window.dispatchEvent(new Event('patient:checkin-updated'));
    });
    await waitFor(() => latest?.isDone === true, 'isDone após recuperação');

    expect(latest?.unavailable).toBe(false);
  });

  it('remove o listener no unmount (nenhuma consulta posterior)', async () => {
    const fake = makeFake({ rows: [{ created_at: nowIso() }] });
    await mount(fake.client);
    await waitFor(() => latest?.doneChecked === true, 'doneChecked');
    const queriesBeforeUnmount = fake.state.queries;

    await unmount();
    window.dispatchEvent(new Event('patient:checkin-updated'));
    await flush();
    await flush();

    expect(fake.state.queries).toBe(queriesBeforeUnmount);
  });
});
