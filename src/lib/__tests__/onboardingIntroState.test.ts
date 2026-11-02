import { describe, expect, it } from 'vitest';
import {
  getOnboardingIntroStorageKey,
  shouldShowOnboardingIntro,
  type OnboardingIntroGateInput,
} from '@/lib/onboarding/introState';
import type { JourneyStepKey, PatientJourneySnapshot } from '@/lib/patientJourney';

function snapshot(overrides: Partial<PatientJourneySnapshot> = {}): PatientJourneySnapshot {
  return {
    perfil: 'completed',
    perfilAlimentar: 'completed',
    raioX: 'completed',
    checkin: 'completed',
    nextAction: 'none',
    hasPending: false,
    hasUnavailable: false,
    completedCount: 4,
    totalSteps: 4,
    ...overrides,
  };
}

function gate(overrides: Partial<OnboardingIntroGateInput> = {}): OnboardingIntroGateInput {
  return {
    step: 'perfil',
    snapshot: snapshot({
      perfil: 'not_started',
      perfilAlimentar: 'not_started',
      raioX: 'not_started',
      checkin: 'not_started',
      nextAction: 'perfil',
      hasPending: true,
      completedCount: 0,
    }),
    isExempt: false,
    enabled: true,
    loading: false,
    loadError: false,
    userId: 'user-1',
    dismissed: false,
    dismissChecked: true,
    ...overrides,
  };
}

function sequenceSnapshot(step: JourneyStepKey): PatientJourneySnapshot {
  const order: JourneyStepKey[] = ['perfil', 'perfilAlimentar', 'raioX', 'checkin'];
  const index = order.indexOf(step);
  const state: PatientJourneySnapshot = snapshot({
    nextAction: step,
    hasPending: true,
    completedCount: index,
  });
  order.forEach((key, keyIndex) => {
    state[key] = keyIndex < index ? 'completed' : 'not_started';
  });
  return state;
}

describe('Fase 6 — gate da introdução por etapa', () => {
  for (const step of ['perfil', 'perfilAlimentar', 'raioX', 'checkin'] as const) {
    it(`mostra a introdução correta para ${step}`, () => {
      const state = sequenceSnapshot(step);
      for (const candidate of ['perfil', 'perfilAlimentar', 'raioX', 'checkin'] as const) {
        expect(
          shouldShowOnboardingIntro(gate({ step: candidate, snapshot: state }))
        ).toBe(candidate === step);
      }
    });
  }

  it('não mostra durante carregamento', () => {
    expect(shouldShowOnboardingIntro(gate({ loading: true }))).toBe(false);
  });

  it('não mostra em erro ou indisponibilidade', () => {
    expect(shouldShowOnboardingIntro(gate({ loadError: true }))).toBe(false);
    expect(
      shouldShowOnboardingIntro(gate({ snapshot: snapshot({ hasUnavailable: true }) }))
    ).toBe(false);
  });

  it('não mostra para usuários isentos', () => {
    expect(shouldShowOnboardingIntro(gate({ isExempt: true }))).toBe(false);
  });

  it('não mostra quando a etapa já está concluída', () => {
    expect(
      shouldShowOnboardingIntro(
        gate({
          snapshot: snapshot({
            nextAction: 'perfilAlimentar',
            completedCount: 1,
          }),
        })
      )
    ).toBe(false);
  });

  it('não mostra sem usuário, sem checagem de dispensa ou com gate desabilitado', () => {
    expect(shouldShowOnboardingIntro(gate({ userId: null }))).toBe(false);
    expect(shouldShowOnboardingIntro(gate({ dismissChecked: false }))).toBe(false);
    expect(shouldShowOnboardingIntro(gate({ enabled: false }))).toBe(false);
  });

  it('não mostra quando a dispensa da sessão está marcada', () => {
    expect(shouldShowOnboardingIntro(gate({ dismissed: true }))).toBe(false);
  });

  it('não mostra se o snapshot for nulo', () => {
    expect(shouldShowOnboardingIntro(gate({ snapshot: null }))).toBe(false);
  });
});

describe('Fase 6 — chave de dispensa isolada', () => {
  it('inclui usuário e etapa e é distinta entre eles', () => {
    const a = getOnboardingIntroStorageKey('user-a', 'perfil');
    const b = getOnboardingIntroStorageKey('user-a', 'checkin');
    const c = getOnboardingIntroStorageKey('user-b', 'perfil');

    expect(a).toContain('user-a');
    expect(a).toContain('perfil');
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
