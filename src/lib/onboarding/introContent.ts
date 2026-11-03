import type { JourneyStepKey } from '@/lib/patientJourney';

export interface OnboardingIntroContent {
  title: string;
  /** Quebra visual controlada; o texto acessível continua sendo `title`. */
  titleLines?: readonly string[];
  description: string;
  cta: string;
  /** Campos opcionais: apenas a introdução de boas-vindas da etapa 1 os usa. */
  badge?: string;
  characterMessage?: string;
  journeyLabel?: string;
  highlights?: readonly string[];
  /** Composição ilustrada usada pela etapa do Raio-X Alimentar. */
  variant?: 'illustrated';
  illustrationSrc?: string;
  illustrationAlt?: string;
  footerIndicators?: readonly string[];
}

/**
 * Conteúdo curto e específico de cada etapa do onboarding.
 * Este módulo não decide quando a introdução aparece — isso é responsabilidade
 * do gate central (`shouldShowOnboardingIntro`) e do hook.
 */
export const ONBOARDING_INTRO_CONTENT: Record<JourneyStepKey, OnboardingIntroContent> = {
  perfil: {
    badge: 'BOAS-VINDAS',
    characterMessage: 'Olá, eu sou a Nutri Van, sua assistente virtual.',
    journeyLabel: 'JORNADA PERSONALIZADA',
    title: 'SUA SAÚDE É IMPORTANTE PARA NÓS',
    titleLines: ['SUA SAÚDE É IMPORTANTE', 'PARA NÓS'],
    description:
      'Para a nutricionista Vanusa montar um plano alimentar seguro e adaptado às suas necessidades, responda às perguntas a seguir.',
    cta: 'Começar agora',
    highlights: ['Seguro', 'Personalizado', 'Gratuito'],
  },
  perfilAlimentar: {
    title: 'Agora, suas restrições alimentares',
    description:
      'Cada pessoa tem necessidades diferentes. Alergias, intolerâncias e outras restrições são importantes para sua saúde. Conte-nos o que você precisa evitar para que a nutricionista Vanusa possa personalizar seu plano com segurança.',
    cta: 'Informar minhas restrições',
  },
  raioX: {
    badge: 'SEU PERFIL ALIMENTAR',
    variant: 'illustrated',
    illustrationSrc: '/avatars/nutri-feliz.png',
    title: 'Vamos descobrir como você se alimenta?',
    description:
      'O que você come no dia a dia conta uma história sobre seus hábitos. Responda às perguntas sobre sua alimentação para ajudar a nutricionista Vanusa a preparar orientações personalizadas para você.',
    cta: 'Começar meu Raio-X Alimentar',
    footerIndicators: ['Personalizado', 'Sem julgamentos', 'No seu ritmo'],
  },
  checkin: {
    title: 'Seu primeiro check-in',
    description:
      'Registrar o check-in inicial permite estabelecer a referência para o acompanhamento. Informe peso, adesão e humor; se ainda não houver uma altura registrada, também pediremos sua altura.',
    cta: 'Fazer meu check-in',
  },
};
