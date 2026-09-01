import type { FocusAction, FocusInput, FocusResult } from '@/lib/vz015/types';

function toFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pushAction(actions: FocusAction[], action: FocusAction) {
  actions.push(action);
}

export function getFocus(input: FocusInput): FocusResult {
  const actions: FocusAction[] = [];

  if (input.jornada.isCheckinDoneThisWeek === false) {
    pushAction(actions, {
      id: 'focus-checkin',
      type: 'checkin',
      title: 'Faça seu check-in',
      description: 'Seu check-in desta semana ainda não foi registrado.',
      reason: 'Seu check-in semanal está pendente.',
      priority: 1,
    });
  }

  const totalMeals = toFiniteNumber(input.totalMeals);
  const mealsChecked = input.dailyLog?.meals_checked?.length ?? 0;
  if (input.jornada.hasMealPlan && totalMeals !== null && totalMeals > 0 && mealsChecked < totalMeals) {
    pushAction(actions, {
      id: 'focus-meals',
      type: 'meals',
      title: 'Registrar suas refeições',
      description: 'Você ainda tem refeições do dia para registrar.',
      reason: 'Seu registro diário ainda está incompleto.',
      priority: 2,
    });
  }

  const latestWeight = toFiniteNumber(input.latestWeightForWater);
  const explicitWaterGoal = toFiniteNumber(input.waterGoal);
  const derivedWaterGoal = latestWeight !== null ? Math.round(latestWeight * 35) : null;
  const waterGoal = explicitWaterGoal ?? derivedWaterGoal;
  const currentWaterMl = toFiniteNumber(input.dailyLog?.water_ml) ?? 0;
  if (waterGoal !== null && waterGoal > 0 && currentWaterMl < waterGoal) {
    pushAction(actions, {
      id: 'focus-hydration',
      type: 'hydration',
      title: 'Acompanhar hidratação',
      description: 'Sua meta de água de hoje ainda não foi atingida.',
      reason: 'Sua hidratação de hoje ainda está abaixo da meta atual.',
      priority: 3,
    });
  }

  const adherence = input.checkin?.adesao_ao_plano;
  if (typeof adherence === 'number' && adherence <= 2) {
    pushAction(actions, {
      id: 'focus-adherence',
      type: 'adherence',
      title: 'Retome sua rotina',
      description: 'Vale voltar a acompanhar sua rotina alimentar.',
      reason: 'Seu último check-in registrou uma adesão abaixo do esperado.',
      priority: 3,
    });
  }

  const orderedActions = actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  if (orderedActions.length === 0) {
    return { state: 'NO_DATA', actions: [] };
  }

  return { state: 'OK', actions: orderedActions };
}
