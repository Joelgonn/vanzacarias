import type { JourneyStepKey } from '@/lib/patientJourney';

export interface OnboardingIntroContent {
  title: string;
  description: string;
  cta: string;
}

/**
 * Conteúdo curto e específico de cada etapa do onboarding.
 * Este módulo não decide quando a introdução aparece — isso é responsabilidade
 * do gate central (`shouldShowOnboardingIntro`) e do hook.
 */
export const ONBOARDING_INTRO_CONTENT: Record<JourneyStepKey, OnboardingIntroContent> = {
  perfil: {
    title: 'Vamos começar pelo seu perfil',
    description:
      'Seus dados básicos — nome, WhatsApp, data de nascimento e sexo — são usados para personalizar seu acompanhamento nutricional.',
    cta: 'Preencher meu perfil',
  },
  perfilAlimentar: {
    title: 'Agora, suas restrições alimentares',
    description:
      'Informar alergias, intolerâncias ou restrições — ou confirmar que não possui nenhuma — ajuda a adequar as orientações alimentares ao seu caso.',
    cta: 'Informar minhas restrições',
  },
  raioX: {
    title: 'Seu Raio-X Alimentar',
    description:
      'Responder ao questionário de frequência alimentar ajuda a compreender seus hábitos atuais e a orientar o acompanhamento. Se já tiver começado, você pode continuar de onde parou.',
    cta: 'Iniciar meu Raio-X Alimentar',
  },
  checkin: {
    title: 'Seu primeiro check-in',
    description:
      'Registrar o check-in inicial permite estabelecer a referência para o acompanhamento. Informe peso, adesão e humor; se ainda não houver uma altura registrada, também pediremos sua altura.',
    cta: 'Fazer meu check-in',
  },
};
