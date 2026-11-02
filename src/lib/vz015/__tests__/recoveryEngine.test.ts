import { describe, expect, it } from 'vitest';
import { getRecovery } from '../recoveryEngine';
import type { FocusInput } from '../types';
import type { CheckinStatus } from '@/lib/checkin';

function baseInput(overrides: Partial<FocusInput> = {}): FocusInput {
  return {
    dailyLog: null,
    checkin: null,
    jornada: {
      isCheckinDoneThisWeek: true,
      hasMealPlan: false,
      canAccessMealPlan: false,
    },
    access: {
      canAccessMealPlan: false,
    },
    ...overrides,
  };
}

describe('getRecovery', () => {
  it('returns NO_DATA when nothing needs recovery', () => {
    const result = getRecovery(
      baseInput({
        dailyLog: {
          date: '2026-08-30',
          water_ml: 2000,
          meals_checked: ['cafe'],
          activities: [],
        },
        checkin: {
          adesao_ao_plano: 4,
        },
      }),
    );

    expect(result.state).toBe('NO_DATA');
    expect(result.actions).toHaveLength(0);
  });

  it('prioritizes checkin before daily log and adherence', () => {
    const result = getRecovery(
      baseInput({
        dailyLog: null,
        checkin: {
          adesao_ao_plano: 1,
        },
        jornada: {
          isCheckinDoneThisWeek: false,
          hasMealPlan: false,
          canAccessMealPlan: false,
        },
      }),
    );

    expect(result.state).toBe('OK');
    expect(result.actions.map((action) => action.type)).toEqual(['checkin', 'daily_log', 'adherence']);
  });

  it('caps the result at three actions', () => {
    const result = getRecovery(
      baseInput({
        dailyLog: null,
        checkin: {
          adesao_ao_plano: 1,
        },
        jornada: {
          isCheckinDoneThisWeek: false,
          hasMealPlan: false,
          canAccessMealPlan: false,
        },
      }),
    );

    expect(result.actions).toHaveLength(3);
  });

  it('does not add daily log recovery when a log already exists', () => {
    const result = getRecovery(
      baseInput({
        dailyLog: {
          date: '2026-08-30',
          water_ml: 0,
          meals_checked: [],
          activities: [],
        },
        checkin: null,
      }),
    );

    expect(result.actions.map((action) => action.type)).not.toContain('daily_log');
  });
});

describe('Fase 2.2 — getRecovery com estado explícito do Check-in', () => {
  function inputWith(
    checkinStatus?: CheckinStatus,
    isCheckinDoneThisWeek = false
  ): FocusInput {
    return {
      ...baseInput(),
      dailyLog: null,
      checkin: { adesao_ao_plano: 1 },
      jornada: {
        isCheckinDoneThisWeek,
        ...(checkinStatus ? { checkinStatus } : {}),
        hasMealPlan: false,
        canAccessMealPlan: false,
      },
    };
  }

  const types = (status?: CheckinStatus, done = false) =>
    getRecovery(inputWith(status, done)).actions.map((action) => action.type);

  it('pendência confirmada → recomenda check-in', () => {
    expect(types('pending')).toContain('checkin');
  });

  it('concluído → não recomenda check-in, mantém diário/adesão', () => {
    expect(types('done', true)).toEqual(['daily_log', 'adherence']);
  });

  it('carregando → não recomenda check-in nem o classifica como pendente', () => {
    const result = getRecovery(inputWith('loading'));
    expect(result.actions.map((action) => action.type)).toEqual([
      'daily_log',
      'adherence',
    ]);
    // O motivo de "adesão" pode citar o último check-in como dado clínico;
    // o que não pode existir é uma ação/título que mande fazer check-in.
    expect(
      result.actions.some((action) =>
        `${action.title} ${action.description}`.toLowerCase().includes('check-in')
      )
    ).toBe(false);
  });

  it('indisponível → não recomenda check-in nem o classifica como pendente', () => {
    const result = getRecovery(inputWith('unavailable'));
    expect(result.actions.map((action) => action.type)).toEqual([
      'daily_log',
      'adherence',
    ]);
    expect(
      result.actions.some((action) =>
        `${action.title} ${action.description}`.toLowerCase().includes('check-in')
      )
    ).toBe(false);
  });

  it('sem o campo novo, preserva o comportamento legado', () => {
    expect(types(undefined, false)).toContain('checkin');
    expect(types(undefined, true)).not.toContain('checkin');
  });
});
