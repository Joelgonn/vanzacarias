import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getPatientJourneyState,
  getOnboardingRoute,
  type CheckinJourneyRecord,
  type PatientJourneySnapshot,
} from '@/lib/patientJourney';

// =========================================================================
// CARREGAMENTO CENTRAL DO ONBOARDING
// -------------------------------------------------------------------------
// Uma única função consulta as três fontes necessárias e aplica a máquina de
// estados pura de patientJourney.ts. Formulários usam `resolveNextOnboardingRoute`
// depois de salvar; o Dashboard usa `loadOnboardingState` para o gate.
//
// Regras de segurança:
// - erro de consulta vira `unavailable`, nunca "pendente" nem "concluído";
// - nenhum dado clínico é enviado para logs (apenas mensagem técnica do erro);
// - nenhuma escrita é feita aqui.
// =========================================================================

const PROFILE_SELECT = 'full_name, phone, data_nascimento, sexo, food_restrictions, role';
const QFA_SELECT = 'answers';
const CHECKIN_SELECT = 'created_at, peso, adesao_ao_plano, humor_semanal';

export interface OnboardingProfile {
  full_name?: string | null;
  phone?: string | null;
  data_nascimento?: string | null;
  sexo?: string | null;
  food_restrictions?: unknown;
  role?: string | null;
}

export interface OnboardingDataResult {
  snapshot: PatientJourneySnapshot;
  profile: OnboardingProfile | null;
  isExempt: boolean;
  errors: {
    profile: boolean;
    qfa: boolean;
    checkin: boolean;
  };
}

export interface ResolveNextRouteResult {
  route: string | null;
  unavailable: boolean;
  exempt: boolean;
}

export function isExemptRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'nutricionista';
}

export async function loadOnboardingState(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<OnboardingDataResult> {
  const [profileRes, qfaRes, checkinRes] = await Promise.all([
    supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle(),
    supabase.from('qfa_responses').select(QFA_SELECT).eq('user_id', userId).maybeSingle(),
    supabase
      .from('checkins')
      .select(CHECKIN_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  if (profileRes.error) {
    console.error('[onboarding] falha ao consultar profiles:', profileRes.error.message);
  }
  if (qfaRes.error) {
    console.error('[onboarding] falha ao consultar qfa_responses:', qfaRes.error.message);
  }
  if (checkinRes.error) {
    console.error('[onboarding] falha ao consultar checkins:', checkinRes.error.message);
  }

  const profile = (profileRes.data as OnboardingProfile | null) ?? null;
  const isExempt = isExemptRole(profile?.role);

  const snapshot = getPatientJourneyState({
    perfilBasicoProfile: profile,
    perfilBasicoError: !!profileRes.error,
    perfilAlimentarProfile: profile,
    perfilAlimentarError: !!profileRes.error,
    qfaAnswers: qfaRes.data?.answers ?? null,
    qfaError: !!qfaRes.error,
    checkins: (checkinRes.data as CheckinJourneyRecord[] | null) ?? null,
    checkinError: !!checkinRes.error,
    now,
  });

  return {
    snapshot,
    profile,
    isExempt,
    errors: {
      profile: !!profileRes.error,
      qfa: !!qfaRes.error,
      checkin: !!checkinRes.error,
    },
  };
}

/**
 * Usado pelos formulários depois de confirmar a persistência. Retorna a rota da
 * primeira etapa ainda pendente; `null` quando todas estão concluídas.
 * Em caso de falha de consulta, retorna `unavailable: true` e nenhuma rota —
 * o chamador não deve presumir a próxima etapa.
 */
export async function resolveNextOnboardingRoute(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<ResolveNextRouteResult> {
  const result = await loadOnboardingState(supabase, userId, now);
  if (result.isExempt) {
    return { route: '/admin/dashboard', unavailable: false, exempt: true };
  }
  if (result.snapshot.hasUnavailable) {
    return { route: null, unavailable: true, exempt: false };
  }
  return {
    route: getOnboardingRoute(result.snapshot.nextAction),
    unavailable: false,
    exempt: false,
  };
}
