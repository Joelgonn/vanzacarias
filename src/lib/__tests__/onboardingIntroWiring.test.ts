import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Integração estrutural da introdução visual nas quatro etapas.
// O comportamento do gate/hook é coberto em runtime; aqui garantimos que cada
// página usa o componente no ponto correto e que o modal do check-in também.

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const content = read('src/lib/onboarding/introContent.ts');
const hook = read('src/hooks/useOnboardingStepIntro.ts');
const component = read('src/components/onboarding/OnboardingStepIntro.tsx');
const welcomeContent = read('src/components/onboarding/OnboardingWelcomeContent.tsx');
const welcomeStep = read('src/components/onboarding/OnboardingWelcomeStep.tsx');
const perfil = read('src/app/dashboard/perfil/page.tsx');
const completar = read('src/app/dashboard/completar-perfil/page.tsx');
const qfaPage = read('src/app/paciente/avaliacao/page.tsx');
const qfaForm = read('src/components/QFAForm.tsx');
const checkin = read('src/app/dashboard/checkin/page.tsx');
const dashboard = read('src/app/dashboard/page.tsx');

describe('Introdução — conteúdo das quatro etapas', () => {
  it('define títulos e CTAs específicos', () => {
    for (const cta of [
      'Começar agora',
      'Informar minhas restrições',
      'Começar meu Raio-X Alimentar',
      'Fazer meu check-in',
    ]) {
      expect(content).toContain(cta);
    }
    expect(content).toContain('SUA SAÚDE É IMPORTANTE PARA NÓS');
    expect(content).toContain("titleLines: ['SUA SAÚDE É IMPORTANTE', 'PARA NÓS']");
    expect(content).toContain(
      'Para a nutricionista Vanusa montar um plano alimentar seguro e adaptado às suas necessidades, responda às perguntas a seguir.'
    );
    expect(content).not.toContain('necessidades. Responda');
    expect(content).toContain('Olá, eu sou a Nutri Van, sua assistente virtual.');
    expect(content).toContain('JORNADA PERSONALIZADA');
    expect(content).toContain("badge: 'BOAS-VINDAS'");
    expect(content).toContain("highlights: ['Seguro', 'Personalizado', 'Gratuito']");
    expect(content).toContain(
      'Cada pessoa tem necessidades diferentes. Alergias, intolerâncias e outras restrições são importantes para sua saúde. Conte-nos o que você precisa evitar para que a nutricionista Vanusa possa personalizar seu plano com segurança.'
    );
    expect(content).not.toContain('Informar alergias, intolerâncias ou restrições');
    expect(content).toContain("badge: 'SEU PERFIL ALIMENTAR'");
    expect(content).toContain("variant: 'illustrated'");
    expect(content).toContain("illustrationSrc: '/avatars/nutri-feliz.png'");
    expect(content).toContain('Vamos descobrir como você se alimenta?');
    expect(content).toContain(
      'O que você come no dia a dia conta uma história sobre seus hábitos. Responda às perguntas sobre sua alimentação para ajudar a nutricionista Vanusa a preparar orientações personalizadas para você.'
    );
    expect(content).toContain(
      "footerIndicators: ['Personalizado', 'Sem julgamentos', 'No seu ritmo']"
    );
    expect(content).toContain('check-in inicial');
  });
});

describe('Introdução — componente apresentacional', () => {
  it('usa portal, diálogo acessível, Escape e bloqueio de fundo', () => {
    expect(component).toContain('createPortal');
    expect(component).toContain('role="dialog"');
    expect(component).toContain('aria-modal="true"');
    expect(component).toContain('aria-labelledby={titleId}');
    expect(component).toContain('aria-describedby={descriptionId}');
    expect(component).toContain("event.key === 'Escape'");
    expect(component).toContain("setAttribute('inert', '')");
    expect(component).toContain("document.body.style.overflow = 'hidden'");
    expect(component).toContain('motion-safe:');
    expect(component).toContain('min-h-[44px]');
    expect(component).toContain('focusTargetSelector');
    expect(component).toContain('isIllustrated');
    expect(component).toContain('content.illustrationSrc');
    expect(component).toContain('content.footerIndicators');
    expect(component).toContain('data-onboarding-illustration');
  });

  it('reutiliza o corpo de boas-vindas compartilhado', () => {
    expect(component).toContain('OnboardingWelcomeContent');
    expect(welcomeContent).toContain('src="/avatars/nutri-feliz.png"');
    expect(welcomeContent).toContain('alt=""');
    expect(welcomeContent).toContain('content.characterMessage');
    expect(welcomeContent).toContain('content.highlights');
    expect(welcomeContent).toContain('HIGHLIGHT_ICONS');
    expect(welcomeContent).toContain('sm:flex-row');
    expect(welcomeContent).toContain('sm:hidden');
    expect(welcomeContent).toContain('sm:block');
  });

  it('a primeira etapa do assistente usa a composição personalizada, não a tela genérica', () => {
    expect(completar).toContain('<OnboardingWelcomeStep');
    expect(completar).toContain("step === 1 ? 'max-w-xl' : 'max-w-lg'");
    expect(welcomeStep).toContain('<OnboardingWelcomeContent');
    expect(welcomeStep).toContain('content={ONBOARDING_INTRO_CONTENT.perfil}');
    expect(welcomeStep).toContain('onStart={onNext}');
    expect(welcomeStep).not.toContain('Vamos cuidar de');
    expect(welcomeStep).not.toContain('Sparkles');
  });
});

describe('Introdução — fonte central e sessionStorage', () => {
  it('o hook usa o loader central e não duplica a regra de conclusão', () => {
    expect(hook).toContain('loadOnboardingState');
    expect(hook).toContain('shouldShowOnboardingIntro');
    expect(hook).toContain('getOnboardingIntroStorageKey');
    expect(hook).toContain('sessionStorage.getItem(storageKey)');
    expect(hook).toContain("sessionStorage.setItem(storageKey, '1')");
    expect(hook).toContain('providedSnapshot !== undefined');
  });
});

describe('Introdução — integrações por etapa', () => {
  it('perfil usa o hook/componente na página', () => {
    expect(perfil).toContain("step: 'perfil'");
    expect(perfil).toContain('stepKey="perfil"');
    expect(perfil).toContain('focusTargetSelector="#profile-full-name"');
    expect(perfil).toContain('resolveNextOnboardingRoute');
    expect(perfil).toContain('.upsert');
  });

  it('restrições aparecem na etapa 3 do assistente, sem usar o array local como gate', () => {
    const step3 = completar.slice(
      completar.indexOf('{step === 3 && ('),
      completar.indexOf('{step === 4 && (')
    );
    expect(step3).toContain('<OnboardingStepIntro');
    expect(step3).toContain('stepKey="perfilAlimentar"');
    expect(step3).not.toContain('foodRestrictions.length');
    expect(step3.indexOf('<OnboardingStepIntro')).toBeLessThan(
      step3.indexOf('<StepRestrictions')
    );
    expect(completar).toContain('enabled: !fetching && !loadError');
    expect(completar).toContain('.update({');
    expect(completar).toContain('resolveNextOnboardingRoute');
  });

  it('QFA espera o formulário carregar e só aparece se não estiver concluído', () => {
    expect(qfaPage).toContain("step: 'raioX'");
    expect(qfaPage).toContain('enabled: !loading && !loadError && !alreadyAnswered');
    expect(qfaPage).toContain('onboardingIntro={');
    expect(qfaPage).toContain('stepKey="raioX"');
    expect(qfaForm).toContain('onboardingIntro?: React.ReactNode');
    expect(qfaForm.indexOf('{onboardingIntro}')).toBeGreaterThan(
      qfaForm.indexOf('if (loadError)')
    );
  });

  it('check-in aparece na página e no modal do Dashboard', () => {
    expect(checkin).toContain("step: 'checkin'");
    expect(checkin).toContain('stepKey="checkin"');
    expect(checkin).toContain('focusTargetSelector="#checkin-weight"');

    expect(dashboard).toContain("step: 'checkin'");
    expect(dashboard).toContain('enabled: isCheckinModalOpen');
    expect(dashboard).toContain('snapshot: journey');
    expect(dashboard).toContain('stepKey="checkin"');
  });

  it('preserva a persistência e a navegação existentes', () => {
    expect(checkin).toContain("router.push('/dashboard')");
    expect(qfaPage).toContain('resolveNextOnboardingRoute');
    expect(perfil).toContain('resolveNextOnboardingRoute');
  });
});
