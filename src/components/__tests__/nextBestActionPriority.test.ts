import { describe, expect, it } from 'vitest';
import {
  getNextBestAction,
  type NextBestActionInput,
} from '@/components/dashboard/NextBestAction';
import type {
  JourneyNextAction,
  PatientJourneySnapshot,
} from '@/lib/patientJourney';

// =========================================================================
// Prioridade determinística do Próximo Passo.
// O onboarding manda; depois dele, a vida normal do paciente (semanal, plano).
// =========================================================================

function snapshot(
  nextAction: JourneyNextAction,
  overrides: Partial<PatientJourneySnapshot> = {}
): PatientJourneySnapshot {
  const stepFor = (key: JourneyNextAction) =>
    key === 'none' ? 'completed' : 'not_started';

  return {
    perfil: stepFor(nextAction === 'perfil' ? nextAction : 'none'),
    perfilAlimentar: stepFor(nextAction === 'perfilAlimentar' ? nextAction : 'none'),
    raioX: stepFor(nextAction === 'raioX' ? nextAction : 'none'),
    checkin: stepFor(nextAction === 'checkin' ? nextAction : 'none') as PatientJourneySnapshot['checkin'],
    nextAction,
    hasPending: nextAction !== 'none',
    hasUnavailable: false,
    completedCount: 4,
    totalSteps: 4,
    ...overrides,
  };
}

function input(overrides: Partial<NextBestActionInput> = {}): NextBestActionInput {
  return {
    journey: snapshot('none'),
    isCheckinDoneThisWeek: true,
    isLocked: false,
    canAccessMealPlan: true,
    isMealPlanReady: true,
    ...overrides,
  };
}

describe('getNextBestAction — onboarding primeiro', () => {
  it('respeita a ordem Perfil → Alimentar → Raio-X → Check-in', () => {
    expect(getNextBestAction(input({ journey: snapshot('perfil') }))).toBe('perfil');
    expect(getNextBestAction(input({ journey: snapshot('perfilAlimentar') }))).toBe(
      'perfilAlimentar'
    );
    expect(getNextBestAction(input({ journey: snapshot('raioX') }))).toBe('raioX');
    expect(getNextBestAction(input({ journey: snapshot('checkin') }))).toBe('checkin');
  });

  it('primeiro check-in não é bloqueado por premium/trial', () => {
    expect(
      getNextBestAction(
        input({ journey: snapshot('checkin'), isLocked: true })
      )
    ).toBe('checkin');
  });

  it('não pula para o plano enquanto houver etapa de onboarding', () => {
    expect(
      getNextBestAction(
        input({
          journey: snapshot('raioX'),
          canAccessMealPlan: true,
          isMealPlanReady: true,
        })
      )
    ).toBe('raioX');
  });
});

describe('getNextBestAction — vida normal após o onboarding', () => {
  it('check-in semanal pendente e acessível tem prioridade sobre o plano', () => {
    expect(
      getNextBestAction(
        input({
          journey: snapshot('none'),
          isCheckinDoneThisWeek: false,
          isLocked: false,
        })
      )
    ).toBe('checkin');
  });

  it('check-in semanal bloqueado não impede o acesso ao plano', () => {
    expect(
      getNextBestAction(
        input({
          journey: snapshot('none'),
          isCheckinDoneThisWeek: false,
          isLocked: true,
          canAccessMealPlan: true,
          isMealPlanReady: true,
        })
      )
    ).toBe('plano_pronto');
  });

  it('check-in indisponível não vira pendência', () => {
    expect(
      getNextBestAction(
        input({
          journey: snapshot('none', { checkin: 'unavailable' }),
          isCheckinDoneThisWeek: false,
        })
      )
    ).toBe('plano_pronto');
  });

  it('plano pronto, em elaboração e bloqueado', () => {
    expect(getNextBestAction(input())).toBe('plano_pronto');
    expect(
      getNextBestAction(input({ isMealPlanReady: false }))
    ).toBe('plano_elaboracao');
    expect(
      getNextBestAction(input({ canAccessMealPlan: false }))
    ).toBe('plano_bloqueado');
  });
});
