import type { JourneyStepKey, PatientJourneySnapshot } from '@/lib/patientJourney';

const STORAGE_PREFIX = 'onboarding-intro:v1';

/**
 * Chave de dispensa da introdução: usuário + etapa.
 * sessionStorage é intencionalmente isolado por aba/sessão e nunca vai ao banco.
 */
export function getOnboardingIntroStorageKey(
  userId: string,
  step: JourneyStepKey
): string {
  return `${STORAGE_PREFIX}:${userId}:${step}`;
}

export interface OnboardingIntroGateInput {
  step: JourneyStepKey;
  snapshot: PatientJourneySnapshot | null;
  isExempt: boolean;
  enabled: boolean;
  loading: boolean;
  loadError: boolean;
  userId: string | null;
  dismissed: boolean;
  dismissChecked: boolean;
}

/**
 * Regra pura de exibição. Só mostra quando:
 * - o gate está habilitado e sem carregamento/erro;
 * - há usuário e a dispensa da sessão já foi lida;
 * - o usuário não é isento;
 * - a etapa é exatamente a próxima ação pendente e ainda não concluída.
 */
export function shouldShowOnboardingIntro(input: OnboardingIntroGateInput): boolean {
  if (!input.enabled || input.loading || input.loadError) return false;
  if (!input.userId || !input.dismissChecked || input.dismissed) return false;
  if (input.isExempt) return false;

  const snapshot = input.snapshot;
  if (!snapshot || snapshot.hasUnavailable) return false;
  if (snapshot.nextAction !== input.step) return false;
  if (snapshot[input.step] !== 'not_started') return false;

  return true;
}
