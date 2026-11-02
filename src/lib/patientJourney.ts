import { isCheckinDoneThisWeek } from '@/lib/checkin';
import { QFA_ITEM_IDS, isQfaOption } from '@/lib/qfa/schema';

// =========================================================================
// JORNADA DE ONBOARDING — FONTE ÚNICA DE VERDADE
// -------------------------------------------------------------------------
// Quatro etapas obrigatórias, na ordem aprovada:
//   1. Perfil            (full_name, phone, data_nascimento, sexo)
//   2. Perfil alimentar  (profiles.food_restrictions)
//   3. Raio-X Alimentar  (qfa_responses.answers completo)
//   4. Check-in          (pelo menos um registro válido)
//
// A regra de recorrência semanal do check-in continua em src/lib/checkin.ts.
// Ela NÃO é usada para concluir o onboarding: aqui basta o primeiro check-in
// válido, mesmo que antigo.
// =========================================================================

export type JourneyStepState = 'not_started' | 'completed' | 'unavailable';
export type JourneyStepKey = 'perfil' | 'perfilAlimentar' | 'raioX' | 'checkin';
export type JourneyNextAction = JourneyStepKey | 'none';

export const JOURNEY_STEP_ORDER: readonly JourneyStepKey[] = [
  'perfil',
  'perfilAlimentar',
  'raioX',
  'checkin',
];

export const ONBOARDING_ROUTES: Record<JourneyStepKey, string> = {
  perfil: '/dashboard/perfil',
  perfilAlimentar: '/dashboard/completar-perfil',
  raioX: '/paciente/avaliacao',
  checkin: '/dashboard/checkin',
};

export interface PerfilBasicoProfile {
  full_name?: string | null;
  phone?: string | null;
  data_nascimento?: string | null;
  sexo?: string | null;
}

export interface PerfilAlimentarProfile {
  food_restrictions?: unknown;
}

export interface CheckinJourneyRecord {
  created_at?: string | null;
  peso?: string | number | null;
  adesao_ao_plano?: string | number | null;
  humor_semanal?: string | number | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  const parsed = toFiniteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

/**
 * Data civil YYYY-MM-DD válida, não futura e com ano plausível.
 * Evita aceitar "2026-02-31" ou datas digitadas em formato inválido.
 */
export function isValidBirthDate(
  value: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!isNonEmptyString(value)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  return value <= today;
}

/**
 * Etapa 1 — Perfil básico.
 * Regra baseada nos campos exigidos pelo formulário /dashboard/perfil e usados
 * pelo motor clínico (data de nascimento e sexo são usados no cálculo corporal).
 */
export function isPerfilBasicoComplete(
  profile: PerfilBasicoProfile | null | undefined,
  now: Date = new Date()
): boolean {
  if (!profile) return false;
  return (
    isNonEmptyString(profile.full_name) &&
    isNonEmptyString(profile.phone) &&
    isValidBirthDate(profile.data_nascimento, now) &&
    isNonEmptyString(profile.sexo)
  );
}

/**
 * Etapa 2 — Perfil alimentar.
 * `null`/`undefined` = nunca respondido.
 * Qualquer array = resposta explícita: `[]` significa "não tenho restrições".
 * O conteúdo de cada item é validado pelo formulário/domínio, não aqui — esta
 * etapa mede se o paciente respondeu, não a qualidade clínica da resposta.
 */
export function isPerfilAlimentarComplete(
  profile: PerfilAlimentarProfile | null | undefined
): boolean {
  if (!profile) return false;
  return Array.isArray(profile.food_restrictions);
}

/**
 * Etapa 3 — Raio-X Alimentar (QFA autenticado).
 * Um registro só é válido quando cobre TODOS os itens do schema atual e cada
 * resposta está na allowlist de frequência. Isso aceita tanto o formato rico
 * (array de QFARichAnswer) quanto o formato legado (objeto id -> valor).
 * Itens bloqueados por alergia também precisam estar presentes com "0",
 * exatamente como o formulário os preenche automaticamente.
 */
export function isQfaResponseComplete(answers: unknown): boolean {
  if (answers === null || answers === undefined) return false;

  const byId = new Map<string, unknown>();

  if (Array.isArray(answers)) {
    for (const entry of answers) {
      if (!entry || typeof entry !== 'object') continue;
      const id = (entry as { id?: unknown }).id;
      if (typeof id === 'string') {
        byId.set(id, (entry as { value?: unknown }).value);
      }
    }
  } else if (typeof answers === 'object') {
    for (const [id, value] of Object.entries(answers as Record<string, unknown>)) {
      byId.set(id, value);
    }
  } else {
    return false;
  }

  return QFA_ITEM_IDS.every((id) => byId.has(id) && isQfaOption(byId.get(id)));
}

/**
 * Etapa 4 — Check-in inicial.
 * Reutiliza as validações do formulário atual: peso > 0, adesão e humor entre
 * 1 e 5 e data de criação legível. A janela semanal NÃO entra aqui.
 */
export function isValidCheckinRecord(
  checkin: CheckinJourneyRecord | null | undefined
): boolean {
  if (!checkin) return false;
  if (!isNonEmptyString(checkin.created_at)) return false;
  if (Number.isNaN(new Date(checkin.created_at as string).getTime())) return false;

  const peso = toFiniteNumber(checkin.peso);
  if (peso === null || peso <= 0) return false;

  return (
    isIntegerInRange(checkin.adesao_ao_plano, 1, 5) &&
    isIntegerInRange(checkin.humor_semanal, 1, 5)
  );
}

export function hasValidCheckin(checkins: CheckinJourneyRecord[] | null | undefined): boolean {
  if (!Array.isArray(checkins)) return false;
  return checkins.some(isValidCheckinRecord);
}

export interface PatientJourneyInput {
  perfilBasicoProfile: PerfilBasicoProfile | null | undefined;
  perfilBasicoError?: boolean;
  perfilAlimentarProfile: PerfilAlimentarProfile | null | undefined;
  perfilAlimentarError?: boolean;
  qfaAnswers: unknown;
  qfaError?: boolean;
  checkins: CheckinJourneyRecord[] | null | undefined;
  checkinError?: boolean;
  now?: Date;
}

export interface PatientJourneySnapshot {
  perfil: JourneyStepState;
  perfilAlimentar: JourneyStepState;
  raioX: JourneyStepState;
  checkin: JourneyStepState;
  nextAction: JourneyNextAction;
  hasPending: boolean;
  hasUnavailable: boolean;
  completedCount: number;
  totalSteps: number;
}

export function getPatientJourneyState(
  input: PatientJourneyInput
): PatientJourneySnapshot {
  const now = input.now ?? new Date();

  const perfil: JourneyStepState = input.perfilBasicoError
    ? 'unavailable'
    : isPerfilBasicoComplete(input.perfilBasicoProfile, now)
      ? 'completed'
      : 'not_started';

  const perfilAlimentar: JourneyStepState = input.perfilAlimentarError
    ? 'unavailable'
    : isPerfilAlimentarComplete(input.perfilAlimentarProfile)
      ? 'completed'
      : 'not_started';

  const raioX: JourneyStepState = input.qfaError
    ? 'unavailable'
    : isQfaResponseComplete(input.qfaAnswers)
      ? 'completed'
      : 'not_started';

  const checkin: JourneyStepState = input.checkinError
    ? 'unavailable'
    : hasValidCheckin(input.checkins)
      ? 'completed'
      : 'not_started';

  const states: Record<JourneyStepKey, JourneyStepState> = {
    perfil,
    perfilAlimentar,
    raioX,
    checkin,
  };

  // Só avança para uma etapa posterior quando todas as anteriores estão
  // comprovadamente concluídas. Se uma consulta falhou, não presumimos que a
  // etapa esteja concluída nem pendente: interrompemos o direcionamento.
  let nextAction: JourneyNextAction = 'none';
  for (const step of JOURNEY_STEP_ORDER) {
    if (states[step] === 'not_started') {
      nextAction = step;
      break;
    }
    if (states[step] === 'unavailable') break;
  }

  const hasUnavailable = JOURNEY_STEP_ORDER.some(
    (step) => states[step] === 'unavailable'
  );
  const completedCount = JOURNEY_STEP_ORDER.filter(
    (step) => states[step] === 'completed'
  ).length;

  return {
    perfil,
    perfilAlimentar,
    raioX,
    checkin,
    nextAction,
    hasPending: nextAction !== 'none',
    hasUnavailable,
    completedCount,
    totalSteps: JOURNEY_STEP_ORDER.length,
  };
}

export function getOnboardingRoute(action: JourneyNextAction): string | null {
  if (action === 'none') return null;
  return ONBOARDING_ROUTES[action];
}

/**
 * Mantido para consumidores antigos que precisam apenas da regra semanal.
 * O onboarding usa `hasValidCheckin` (primeiro check-in válido), não esta regra.
 */
export { isCheckinDoneThisWeek };
