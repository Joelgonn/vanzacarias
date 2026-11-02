// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import OnboardingStepIntro from '@/components/onboarding/OnboardingStepIntro';
import type { JourneyStepKey } from '@/lib/patientJourney';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let outsideTarget: HTMLInputElement;
let root: Root;

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function renderIntro(
  open: boolean,
  onStart = vi.fn(),
  onDismiss = vi.fn(),
  stepKey: JourneyStepKey = 'perfil'
) {
  await act(async () => {
    root.render(
      createElement(OnboardingStepIntro, {
        stepKey,
        open,
        completedCount: 0,
        totalSteps: 4,
        onStart,
        onDismiss,
        focusTargetSelector: '#intro-target',
      })
    );
  });
  await flush();
  return { onStart, onDismiss };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  outsideTarget = document.createElement('input');
  outsideTarget.id = 'intro-target';
  document.body.appendChild(outsideTarget);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  outsideTarget.remove();
  document.body.style.overflow = '';
});

describe('OnboardingStepIntro — diálogo acessível', () => {
  it('renderiza role dialog, aria-modal e associação de título/descrição', async () => {
    await renderIntro(true);

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');

    const titleId = dialog?.getAttribute('aria-labelledby');
    const descriptionId = dialog?.getAttribute('aria-describedby');
    expect(titleId).toBeTruthy();
    expect(descriptionId).toBeTruthy();
    expect(dialog?.querySelector(`[id="${titleId}"]`)?.textContent).toContain(
      'SUA SAÚDE É IMPORTANTE PARA NÓS'
    );
    expect(dialog?.querySelector(`[id="${descriptionId}"]`)?.textContent).toContain(
      'Para a nutricionista Vanusa montar um plano alimentar'
    );
    expect(dialog?.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('apresenta a imagem oficial, a fala da Nutri Van e os indicadores', async () => {
    await renderIntro(true);
    const dialog = document.querySelector('[role="dialog"]');

    expect(dialog?.textContent).toContain('Etapa 1 de 4');
    expect(dialog?.textContent).toContain('BOAS-VINDAS');
    expect(dialog?.textContent).toContain('Olá, eu sou a Nutri Van, sua assistente virtual.');
    expect(dialog?.textContent).toContain('JORNADA PERSONALIZADA');
    expect(dialog?.textContent).toContain('Seguro');
    expect(dialog?.textContent).toContain('Personalizado');
    expect(dialog?.textContent).toContain('Gratuito');

    const image = dialog?.querySelector('img');
    expect(image).not.toBeNull();
    expect(decodeURIComponent(image?.getAttribute('src') ?? '')).toContain(
      '/avatars/nutri-feliz.png'
    );
    expect(image?.getAttribute('alt')).toBe('');
  });

  it('centraliza o título e o divide em duas linhas equilibradas', async () => {
    await renderIntro(true);
    const title = document.querySelector('[role="dialog"] h2');

    expect(title?.className).toContain('text-center');
    expect(title?.className).toContain('text-xl');
    expect(title?.className).toContain('sm:text-2xl');
    expect(title?.className).toContain('max-w-md');
    expect(title?.querySelectorAll('span.block')).toHaveLength(2);
    expect(title?.textContent?.trim()).toBe('SUA SAÚDE É IMPORTANTE PARA NÓS');
  });

  it('expõe CTA e opção de dispensa com área mínima', async () => {
    await renderIntro(true);

    const primary = document.querySelector<HTMLButtonElement>(
      '[data-onboarding-intro-primary]'
    );
    expect(primary?.textContent).toContain('Começar agora');
    expect(primary?.className).toContain('min-h-[48px]');

    const dismiss = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Agora não')
    );
    expect(dismiss).toBeTruthy();
    expect(dismiss?.className).toContain('min-h-[44px]');
  });

  it('mantém as etapas 2, 3 e 4 no layout genérico, sem a personagem', async () => {
    const steps = [
      ['perfilAlimentar', 'Informar minhas restrições'],
      ['raioX', 'Iniciar meu Raio-X Alimentar'],
      ['checkin', 'Fazer meu check-in'],
    ] as const;

    for (const [stepKey, cta] of steps) {
      await renderIntro(true, vi.fn(), vi.fn(), stepKey);
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.querySelector('[data-onboarding-intro-primary]')?.textContent).toContain(
        cta
      );
      expect(dialog?.querySelector('img')).toBeNull();
      expect(dialog?.textContent).not.toContain('Olá, eu sou a Nutri Van');
      expect(dialog?.textContent).not.toContain('BOAS-VINDAS');
      expect(dialog?.textContent).not.toContain('JORNADA PERSONALIZADA');
      expect(dialog?.querySelector('h2')?.className).not.toContain('text-center');
      expect(dialog?.querySelectorAll('h2 span.block')).toHaveLength(0);
    }
  });

  it('inicia e dispensa pelos botões, e Escape também dispensa', async () => {
    const { onStart, onDismiss } = await renderIntro(true);

    const primary = document.querySelector<HTMLButtonElement>(
      '[data-onboarding-intro-primary]'
    );
    await act(async () => {
      primary?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onStart).toHaveBeenCalledTimes(1);

    const dismiss = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Agora não')
    );
    await act(async () => {
      dismiss?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('bloqueia o fundo com inert e scroll, e restaura ao fechar', async () => {
    await renderIntro(true);
    expect(container.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    await renderIntro(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('restaura o foco no alvo configurado ao fechar', async () => {
    await renderIntro(true);
    await renderIntro(false);
    expect(document.activeElement?.id).toBe('intro-target');
  });
});
