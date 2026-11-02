import { describe, expect, it } from 'vitest';
import {
  getOnboardingRoute,
  getPatientJourneyState,
  hasValidCheckin,
  isPerfilBasicoComplete,
  isPerfilAlimentarComplete,
  isQfaResponseComplete,
  isValidBirthDate,
  isValidCheckinRecord,
  type PatientJourneyInput,
} from '@/lib/patientJourney';
import { QFA_ITEM_IDS, QFA_OPTIONS } from '@/lib/qfa/schema';

// =========================================================================
// Jornada de onboarding — quatro etapas na ordem aprovada:
//   Perfil → Perfil alimentar → Raio-X (QFA) → Check-in
// =========================================================================

const NOW = new Date('2026-01-10T12:00:00Z');

const perfilCompleto = {
  full_name: 'Ana Souza',
  phone: '11999999999',
  data_nascimento: '1990-01-01',
  sexo: 'feminino',
};

const qfaLegadoCompleto = () =>
  Object.fromEntries(QFA_ITEM_IDS.map((id) => [id, '0'])) as Record<string, string>;

const qfaRicoCompleto = () =>
  QFA_ITEM_IDS.map((id) => ({
    id,
    value: QFA_OPTIONS[0],
    label: id,
    category: 'teste',
  }));

const checkinValido = {
  created_at: '2025-11-01T10:00:00Z',
  peso: '72.5',
  adesao_ao_plano: 4,
  humor_semanal: 5,
};

const baseInput = (overrides: Partial<PatientJourneyInput> = {}): PatientJourneyInput => ({
  perfilBasicoProfile: null,
  perfilAlimentarProfile: null,
  qfaAnswers: null,
  checkins: [],
  now: NOW,
  ...overrides,
});

describe('Etapa 1 — Perfil básico', () => {
  it('perfil ausente ou incompleto não conclui', () => {
    expect(isPerfilBasicoComplete(null)).toBe(false);
    expect(isPerfilBasicoComplete(undefined)).toBe(false);
    expect(isPerfilBasicoComplete({})).toBe(false);
    expect(
      isPerfilBasicoComplete({ ...perfilCompleto, full_name: '   ' })
    ).toBe(false);
    expect(isPerfilBasicoComplete({ ...perfilCompleto, phone: null })).toBe(false);
    expect(isPerfilBasicoComplete({ ...perfilCompleto, sexo: '' })).toBe(false);
  });

  it('exige data de nascimento civil válida e não futura', () => {
    expect(isValidBirthDate('1990-01-01', NOW)).toBe(true);
    expect(isValidBirthDate('2026-02-30', NOW)).toBe(false);
    expect(isValidBirthDate('01/01/1990', NOW)).toBe(false);
    expect(isValidBirthDate('2026-01-11', NOW)).toBe(false);
    expect(isValidBirthDate('1899-12-31', NOW)).toBe(false);
  });

  it('todos os campos válidos concluem', () => {
    expect(isPerfilBasicoComplete(perfilCompleto, NOW)).toBe(true);
  });
});

describe('Etapa 2 — Perfil alimentar', () => {
  it('nunca respondido (null/undefined) não conclui', () => {
    expect(isPerfilAlimentarComplete(null)).toBe(false);
    expect(isPerfilAlimentarComplete(undefined)).toBe(false);
    expect(isPerfilAlimentarComplete({})).toBe(false);
    expect(isPerfilAlimentarComplete({ food_restrictions: null })).toBe(false);
  });

  it('lista vazia é resposta explícita válida ("não tenho restrições")', () => {
    expect(isPerfilAlimentarComplete({ food_restrictions: [] })).toBe(true);
  });

  it('lista com restrições é válida; formato inválido não conclui', () => {
    expect(
      isPerfilAlimentarComplete({
        food_restrictions: [{ type: 'allergy', food: 'leite' }],
      })
    ).toBe(true);
    expect(
      isPerfilAlimentarComplete({ food_restrictions: 'nenhuma' })
    ).toBe(false);
    expect(
      isPerfilAlimentarComplete({ food_restrictions: { lactose: true } })
    ).toBe(false);
  });
});

describe('Etapa 3 — Raio-X Alimentar (QFA)', () => {
  it('ausente, vazio ou incompleto não conclui', () => {
    expect(isQfaResponseComplete(null)).toBe(false);
    expect(isQfaResponseComplete(undefined)).toBe(false);
    expect(isQfaResponseComplete({})).toBe(false);

    const parcial = qfaLegadoCompleto();
    delete parcial[QFA_ITEM_IDS[0]];
    expect(isQfaResponseComplete(parcial)).toBe(false);
  });

  it('aceita o formato legado completo', () => {
    expect(isQfaResponseComplete(qfaLegadoCompleto())).toBe(true);
  });

  it('aceita o formato rico completo (array de respostas)', () => {
    expect(isQfaResponseComplete(qfaRicoCompleto())).toBe(true);
  });

  it('valor fora da allowlist invalida a resposta', () => {
    const invalido = qfaLegadoCompleto();
    invalido[QFA_ITEM_IDS[0]] = 'todos os dias';
    expect(isQfaResponseComplete(invalido)).toBe(false);

    const vazio = qfaLegadoCompleto();
    vazio[QFA_ITEM_IDS[0]] = '';
    expect(isQfaResponseComplete(vazio)).toBe(false);
  });

  it('item bloqueado por alergia continua exigido com "0"', () => {
    const semAlergia = qfaLegadoCompleto();
    delete semAlergia.leite;
    expect(isQfaResponseComplete(semAlergia)).toBe(false);
  });
});

describe('Etapa 4 — Check-in inicial', () => {
  it('exige peso > 0, adesão e humor entre 1 e 5 e data legível', () => {
    expect(isValidCheckinRecord(checkinValido)).toBe(true);
    expect(isValidCheckinRecord({ ...checkinValido, peso: '0' })).toBe(false);
    expect(isValidCheckinRecord({ ...checkinValido, peso: null })).toBe(false);
    expect(
      isValidCheckinRecord({ ...checkinValido, adesao_ao_plano: 0 })
    ).toBe(false);
    expect(
      isValidCheckinRecord({ ...checkinValido, humor_semanal: 6 })
    ).toBe(false);
    expect(
      isValidCheckinRecord({ ...checkinValido, created_at: 'não é data' })
    ).toBe(false);
  });

  it('basta um registro válido entre registros inválidos', () => {
    expect(hasValidCheckin([])).toBe(false);
    expect(hasValidCheckin(null)).toBe(false);
    expect(
      hasValidCheckin([{ ...checkinValido, peso: 0 }, checkinValido])
    ).toBe(true);
  });

  it('check-in antigo (fora da janela semanal) ainda conclui o onboarding', () => {
    // A recorrência semanal é regra separada (src/lib/checkin.ts). Para concluir
    // o onboarding basta o primeiro check-in válido, mesmo com meses de idade.
    const snapshot = getPatientJourneyState(
      baseInput({
        perfilBasicoProfile: perfilCompleto,
        perfilAlimentarProfile: { food_restrictions: [] },
        qfaAnswers: qfaLegadoCompleto(),
        checkins: [{ ...checkinValido, created_at: '2025-01-01T10:00:00Z' }],
      })
    );
    expect(snapshot.checkin).toBe('completed');
    expect(snapshot.nextAction).toBe('none');
  });
});

describe('getPatientJourneyState — ordem e estados', () => {
  it('1. tudo pendente → direciona ao Perfil', () => {
    const s = getPatientJourneyState(baseInput());
    expect(s).toMatchObject({
      perfil: 'not_started',
      perfilAlimentar: 'not_started',
      raioX: 'not_started',
      checkin: 'not_started',
      nextAction: 'perfil',
      hasPending: true,
      completedCount: 0,
      totalSteps: 4,
    });
  });

  it('2. perfil completo, perfil alimentar pendente → direciona ao Perfil alimentar', () => {
    const s = getPatientJourneyState(
      baseInput({ perfilBasicoProfile: perfilCompleto })
    );
    expect(s.perfil).toBe('completed');
    expect(s.nextAction).toBe('perfilAlimentar');
  });

  it('3. perfil + alimentar completos, QFA pendente → direciona ao Raio-X', () => {
    const s = getPatientJourneyState(
      baseInput({
        perfilBasicoProfile: perfilCompleto,
        perfilAlimentarProfile: { food_restrictions: [] },
      })
    );
    expect(s.completedCount).toBe(2);
    expect(s.nextAction).toBe('raioX');
  });

  it('4. três etapas completas, check-in pendente → direciona ao Check-in', () => {
    const s = getPatientJourneyState(
      baseInput({
        perfilBasicoProfile: perfilCompleto,
        perfilAlimentarProfile: { food_restrictions: [] },
        qfaAnswers: qfaLegadoCompleto(),
      })
    );
    expect(s.completedCount).toBe(3);
    expect(s.nextAction).toBe('checkin');
  });

  it('5. todas concluídas → nenhuma ação pendente', () => {
    const s = getPatientJourneyState(
      baseInput({
        perfilBasicoProfile: perfilCompleto,
        perfilAlimentarProfile: { food_restrictions: [] },
        qfaAnswers: qfaRicoCompleto(),
        checkins: [checkinValido],
      })
    );
    expect(s).toMatchObject({
      perfil: 'completed',
      perfilAlimentar: 'completed',
      raioX: 'completed',
      checkin: 'completed',
      nextAction: 'none',
      hasPending: false,
      hasUnavailable: false,
      completedCount: 4,
    });
  });

  it('6. erro de consulta vira unavailable, nunca conclusão nem pendência', () => {
    const s = getPatientJourneyState(
      baseInput({
        perfilBasicoProfile: perfilCompleto,
        perfilBasicoError: true,
        perfilAlimentarProfile: { food_restrictions: [] },
        perfilAlimentarError: true,
        qfaAnswers: qfaLegadoCompleto(),
        qfaError: true,
        checkins: [checkinValido],
        checkinError: true,
      })
    );
    expect(s.perfil).toBe('unavailable');
    expect(s.perfilAlimentar).toBe('unavailable');
    expect(s.raioX).toBe('unavailable');
    expect(s.checkin).toBe('unavailable');
    expect(s.hasUnavailable).toBe(true);
    expect(s.nextAction).toBe('none');
    expect(s.completedCount).toBe(0);
  });

  it('7. etapa indisponível interrompe o direcionamento posterior', () => {
    const semPerfilAlimentar = getPatientJourneyState(
      baseInput({
        perfilBasicoProfile: perfilCompleto,
        perfilAlimentarProfile: null,
        perfilAlimentarError: true,
        qfaAnswers: qfaLegadoCompleto(),
      })
    );
    expect(semPerfilAlimentar.perfilAlimentar).toBe('unavailable');
    expect(semPerfilAlimentar.raioX).toBe('completed');
    expect(semPerfilAlimentar.nextAction).toBe('none');
  });

  it('8. etapa pendente confirmada antes de uma indisponível ainda é direcionada', () => {
    const s = getPatientJourneyState(
      baseInput({
        perfilBasicoProfile: null,
        qfaError: true,
      })
    );
    expect(s.perfil).toBe('not_started');
    expect(s.raioX).toBe('unavailable');
    expect(s.nextAction).toBe('perfil');
  });

  it('9. QFA incompleto não conclui a etapa nem libera o check-in', () => {
    const parcial = qfaLegadoCompleto();
    delete parcial.arroz;
    const s = getPatientJourneyState(
      baseInput({
        perfilBasicoProfile: perfilCompleto,
        perfilAlimentarProfile: { food_restrictions: [] },
        qfaAnswers: parcial,
        checkins: [checkinValido],
      })
    );
    expect(s.raioX).toBe('not_started');
    expect(s.checkin).toBe('completed');
    expect(s.nextAction).toBe('raioX');
  });

  it('10. perfil alimentar vazio salvo não volta a ser pendente', () => {
    const s = getPatientJourneyState(
      baseInput({
        perfilBasicoProfile: perfilCompleto,
        perfilAlimentarProfile: { food_restrictions: [] },
      })
    );
    expect(s.perfilAlimentar).toBe('completed');
    expect(s.nextAction).toBe('raioX');
  });
});

describe('getOnboardingRoute', () => {
  it('mapeia cada etapa para sua rota real', () => {
    expect(getOnboardingRoute('perfil')).toBe('/dashboard/perfil');
    expect(getOnboardingRoute('perfilAlimentar')).toBe(
      '/dashboard/completar-perfil'
    );
    expect(getOnboardingRoute('raioX')).toBe('/paciente/avaliacao');
    expect(getOnboardingRoute('checkin')).toBe('/dashboard/checkin');
  });

  it('sem pendência não há rota de onboarding', () => {
    expect(getOnboardingRoute('none')).toBeNull();
  });
});
