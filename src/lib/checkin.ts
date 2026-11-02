// =========================================================================
// REGRA SEMANAL DO CHECK-IN — FONTE ÚNICA DA VERDADE
// =========================================================================
// Encapsula a regra exata que antes vivia apenas em dashboard/page.tsx.
// Compartilhada por Dashboard, Sidebar desktop e Drawer mobile para que
// os três representem o MESMO estado semanal, sem duplicar lógica.
//
// Semântica preservada (100% idêntica à versão original):
//   "esta semana" = janela móvel de 7 dias desde o ÚLTIMO check-in,
//   usando a data local do navegador (diffInDays <= 7).
// =========================================================================

export interface CheckinLike {
  created_at: string;
  /** O campo `peso` é opcional para fins da regra semanal */
  peso?: string | number | null;
}

/**
 * Estado de apresentação do Check-in nas superfícies de navegação/UI.
 * - loading: consulta inicial ainda não respondeu (nem conclusão nem pendência)
 * - done: consulta OK e check-in dentro da janela semanal
 * - pending: consulta OK e check-in fora da janela
 * - unavailable: a consulta falhou; não classificar como pendente nem concluído
 */
export type CheckinStatus = 'loading' | 'done' | 'pending' | 'unavailable';

/**
 * Deriva o estado visual do Check-in a partir do hook de status.
 * Fonte única para Sidebar desktop e Drawer mobile — evita que cada
 * superfície interprete `doneChecked`/erro de forma diferente.
 */
export function getCheckinNavState(input: {
  isDone: boolean;
  doneChecked: boolean;
  unavailable?: boolean;
}): CheckinStatus {
  if (!input.doneChecked) return 'loading';
  if (input.unavailable) return 'unavailable';
  return input.isDone ? 'done' : 'pending';
}

/**
 * Retorna true se o usuário já fez check-in nos últimos 7 dias.
 * Lança zero queries — é apenas um cálculo puro sobre os dados fornecidos.
 */
export function isCheckinDoneThisWeek(
  checkins: CheckinLike[],
  now: Date = new Date()
): boolean {
  if (!checkins || checkins.length === 0) return false;
  const lastCheckinDate = new Date(checkins[checkins.length - 1].created_at);
  const diffInDays = (now.getTime() - lastCheckinDate.getTime()) / (1000 * 3600 * 24);
  return diffInDays <= 7;
}
