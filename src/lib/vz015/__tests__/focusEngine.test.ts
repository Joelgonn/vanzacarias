import { describe, expect, it } from 'vitest';
import { getFocus } from '@/lib/vz015/focusEngine';

describe('getFocus', () => {
  it('T01 sem dados → NO_DATA / 0 ações', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: true,
        hasMealPlan: false,
        canAccessMealPlan: false,
      },
      access: { canAccessMealPlan: false },
    });

    expect(result.state).toBe('NO_DATA');
    expect(result.actions).toHaveLength(0);
  });

  it('T02 check-in pendente → checkin', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: false,
        hasMealPlan: false,
        canAccessMealPlan: false,
      },
      access: { canAccessMealPlan: false },
    });

    expect(result.actions[0]?.type).toBe('checkin');
  });

  it('T03 check-in pendente + refeições incompletas → checkin primeiro', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: false,
        hasMealPlan: true,
        canAccessMealPlan: true,
      },
      dailyLog: {
        date: '2026-08-30',
        meals_checked: ['Café da manhã'],
        water_ml: 250,
        mood: 'neutro',
        activities: [],
        activity_kcal: 0,
      },
      totalMeals: 4,
      waterGoal: 2000,
      latestWeightForWater: 57,
      access: { canAccessMealPlan: true },
    });

    expect(result.actions[0]?.type).toBe('checkin');
    expect(result.actions.some((action) => action.type === 'meals')).toBe(true);
  });

  it('T04 sem check-in + refeições incompletas → meals', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: true,
        hasMealPlan: true,
        canAccessMealPlan: true,
      },
      dailyLog: {
        date: '2026-08-30',
        meals_checked: ['Café da manhã'],
        water_ml: 250,
        mood: 'neutro',
        activities: [],
        activity_kcal: 0,
      },
      totalMeals: 4,
      waterGoal: 2000,
      latestWeightForWater: 57,
      access: { canAccessMealPlan: true },
    });

    expect(result.actions[0]?.type).toBe('meals');
  });

  it('T05 sem P1/P2 + hidratação abaixo da meta existente → hydration', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: true,
        hasMealPlan: false,
        canAccessMealPlan: false,
      },
      dailyLog: {
        date: '2026-08-30',
        water_ml: 1000,
        meals_checked: [],
        mood: 'neutro',
        activities: [],
        activity_kcal: 0,
      },
      waterGoal: 2000,
      latestWeightForWater: 57,
      access: { canAccessMealPlan: false },
    });

    expect(result.actions[0]?.type).toBe('hydration');
  });

  it('T06 adesão baixa registrada → adherence', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: true,
        hasMealPlan: false,
        canAccessMealPlan: false,
      },
      checkin: {
        lastCheckinAt: '2026-08-29T10:00:00.000Z',
        daysSinceLastCheckin: 1,
        adesao_ao_plano: 2,
        humor_semanal: 3,
      },
      access: { canAccessMealPlan: false },
    });

    expect(result.actions[0]?.type).toBe('adherence');
  });

  it('T07 múltiplos candidatos → ordem checkin > meals > hydration > adherence', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: false,
        hasMealPlan: true,
        canAccessMealPlan: true,
      },
      dailyLog: {
        date: '2026-08-30',
        water_ml: 800,
        meals_checked: ['Café da manhã'],
        mood: 'neutro',
        activities: [],
        activity_kcal: 0,
      },
      checkin: {
        lastCheckinAt: '2026-08-29T10:00:00.000Z',
        daysSinceLastCheckin: 1,
        adesao_ao_plano: 2,
        humor_semanal: 3,
      },
      totalMeals: 4,
      waterGoal: 2000,
      latestWeightForWater: 57,
      access: { canAccessMealPlan: true },
    });

    expect(result.actions.map((action) => action.type)).toEqual(['checkin', 'meals', 'hydration']);
  });

  it('T08 mais de 3 candidatos → máximo 3', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: false,
        hasMealPlan: true,
        canAccessMealPlan: true,
      },
      dailyLog: {
        date: '2026-08-30',
        water_ml: 100,
        meals_checked: [],
        mood: 'neutro',
        activities: [],
        activity_kcal: 0,
      },
      checkin: {
        lastCheckinAt: '2026-08-29T10:00:00.000Z',
        daysSinceLastCheckin: 1,
        adesao_ao_plano: 2,
        humor_semanal: 3,
      },
      totalMeals: 4,
      waterGoal: 2000,
      latestWeightForWater: 57,
      access: { canAccessMealPlan: true },
    });

    expect(result.actions).toHaveLength(3);
  });

  it('T09 dados insuficientes para meals → não gerar meals', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: true,
        hasMealPlan: true,
        canAccessMealPlan: true,
      },
      dailyLog: {
        date: '2026-08-30',
        meals_checked: ['Café da manhã'],
        water_ml: 1500,
        mood: 'neutro',
        activities: [],
        activity_kcal: 0,
      },
      access: { canAccessMealPlan: true },
    });

    expect(result.actions.some((action) => action.type === 'meals')).toBe(false);
  });

  it('T10 Free + plano bloqueado → nenhum conteúdo Premium', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: true,
        hasMealPlan: true,
        canAccessMealPlan: false,
      },
      dailyLog: {
        date: '2026-08-30',
        meals_checked: [],
        water_ml: 500,
        mood: 'neutro',
        activities: [],
        activity_kcal: 0,
      },
      totalMeals: 3,
      waterGoal: 2000,
      latestWeightForWater: 57,
      access: { canAccessMealPlan: false },
    });

    expect(result.actions.every((action) => !action.description.toLowerCase().includes('cardápio'))).toBe(true);
    expect(result.actions.every((action) => !action.description.toLowerCase().includes('macro'))).toBe(true);
  });

  it('T11 Premium → pode consumir somente dados autorizados', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: true,
        hasMealPlan: true,
        canAccessMealPlan: true,
      },
      dailyLog: {
        date: '2026-08-30',
        meals_checked: [],
        water_ml: 500,
        mood: 'neutro',
        activities: [],
        activity_kcal: 0,
      },
      totalMeals: 3,
      waterGoal: 2000,
      latestWeightForWater: 57,
      access: { canAccessMealPlan: true },
    });

    expect(result.state).toBe('OK');
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('T12 nenhum candidato objetivo → NO_DATA', () => {
    const result = getFocus({
      jornada: {
        isCheckinDoneThisWeek: true,
        hasMealPlan: false,
        canAccessMealPlan: false,
      },
      dailyLog: {
        date: '2026-08-30',
        water_ml: 2500,
        meals_checked: [],
        mood: 'feliz',
        activities: [],
        activity_kcal: 0,
      },
      access: { canAccessMealPlan: false },
    });

    expect(result.state).toBe('NO_DATA');
    expect(result.actions).toHaveLength(0);
  });
});
