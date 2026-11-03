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
  illustrationWidth?: number;
  illustrationHeight?: number;
  illustrationSize?: 'portrait';
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
    badge: 'SEU ACOMPANHAMENTO COMEÇA AQUI',
    variant: 'illustrated',
    illustrationSrc: '/avatars/nutri-checkin.png',
    illustrationWidth: 1312,
    illustrationHeight: 1199,
    illustrationSize: 'portrait',
    title: 'Vamos acompanhar sua evolução?',
    description:
      'Seu primeiro check-in é o ponto de partida para acompanhar sua jornada. Registre seu peso, sua adesão ao plano e como você está se sentindo. A cada semana, você poderá atualizar essas informações e acompanhar sua evolução junto à nutricionista Vanusa.',
    cta: 'Fazer meu primeiro check-in',
    footerIndicators: ['Um passo de cada vez', 'Seu ritmo', 'Seu acompanhamento'],
  },
};
