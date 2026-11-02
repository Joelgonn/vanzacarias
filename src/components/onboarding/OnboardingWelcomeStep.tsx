'use client';

import OnboardingWelcomeContent from '@/components/onboarding/OnboardingWelcomeContent';
import { ONBOARDING_INTRO_CONTENT } from '@/lib/onboarding/introContent';

interface OnboardingWelcomeStepProps {
  onNext: () => void;
}

/**
 * Primeira etapa inline do assistente de perfil alimentar.
 * Usa o mesmo corpo de boas-vindas do diálogo de onboarding.
 */
export default function OnboardingWelcomeStep({ onNext }: OnboardingWelcomeStepProps) {
  return (
    <div className="text-center">
      <OnboardingWelcomeContent
        content={ONBOARDING_INTRO_CONTENT.perfil}
        onStart={onNext}
      />
    </div>
  );
}
