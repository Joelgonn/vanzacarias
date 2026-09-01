import { describe, expect, it } from 'vitest';
import { getRecovery } from '../recoveryEngine';
import type { FocusInput } from '../types';

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
