import type { RecoveryInput, RecoveryResult, RecoveryAction } from './types';

// VZ-020 — Engine de Recuperação determinístico, sem score/risk/behaviorEngine
// Recebe somente dados objetivos, não acessa Supabase/LLM

function push(actions: RecoveryAction[], a: RecoveryAction) {
  actions.push(a);
}

export function getRecoveryV2(input: RecoveryInput): RecoveryResult {
  const actions: RecoveryAction[] = [];

  if (!input.isCheckinDoneThisWeek) {
    push(actions, {
      id: 'vz020-checkin',
      type: 'checkin',
      title: 'Check-in semanal pendente',
      description: 'Check-in desta semana ainda não registrado.',
      reason: 'Último check-in há mais de 7 dias ou inexistente.',
      cta: 'Enviar lembrete',
    });
  }

  if (!input.hasDailyLogToday) {
    push(actions, {
      id: 'vz020-daily-log',
      type: 'daily_log',
      title: 'Sem registro hoje',
      description: 'Nenhum registro de hoje encontrado.',
      reason: 'Daily log de hoje ausente.',
      cta: 'Enviar lembrete',
    });
  }

  if (typeof input.lastCheckinAdherence === 'number' && input.lastCheckinAdherence <= 2) {
    push(actions, {
      id: 'vz020-adherence',
      type: 'adherence',
      title: 'Adesão registrada baixa',
      description: 'Último check-in registrou adesão 1 ou 2 em 5.',
      reason: `Adesão ${input.lastCheckinAdherence}/5 no último check-in.`,
      cta: 'Abrir paciente',
    });
  }

  if (input.hasReturnedRecently) {
    push(actions, {
      id: 'vz020-return',
      type: 'return',
      title: 'Retomou os registros',
      description: 'Voltou a registrar após período sem registros.',
      reason: 'Novo registro após intervalo sem registros.',
      cta: 'Ver jornada',
    });
  }

  const ordered = actions.slice(0, 3);
  if (ordered.length === 0) return { state: 'NO_DATA', actions: [] };
  return { state: 'OK', actions: ordered };
}
