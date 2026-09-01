import type { FocusInput, RecoveryAction, RecoveryResult } from '@/lib/vz015/types';

function pushAction(actions: RecoveryAction[], action: RecoveryAction) {
  actions.push(action);
}

export function getRecovery(input: FocusInput): RecoveryResult {
  const actions: RecoveryAction[] = [];

  if (input.jornada.isCheckinDoneThisWeek === false) {
    pushAction(actions, {
      id: 'recovery-checkin',
      type: 'checkin',
      title: 'Retome seu check-in',
      description: 'Seu check-in desta semana ainda não foi registrado.',
      reason: 'O check-in semanal ainda está pendente.',
      priority: 1,
    });
  }

  if (!input.dailyLog) {
    pushAction(actions, {
      id: 'recovery-daily-log',
      type: 'daily_log',
      title: 'Registre sua rotina de hoje',
      description: 'Seu registro diário ainda não foi preenchido.',
      reason: 'Não há registro diário de hoje disponível.',
      priority: 2,
    });
  }

  const adherence = input.checkin?.adesao_ao_plano;
  if (typeof adherence === 'number' && adherence <= 2) {
    pushAction(actions, {
      id: 'recovery-adherence',
      type: 'adherence',
      title: 'Volte à rotina',
      description: 'Pode ser um bom momento para retomar uma refeição do seu plano.',
      reason: 'O último check-in mostrou uma adesão mais baixa.',
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
