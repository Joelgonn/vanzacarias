// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import OnboardingWelcomeStep from '@/components/onboarding/OnboardingWelcomeStep';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function renderStep(onNext = vi.fn()) {
  await act(async () => {
    root.render(createElement(OnboardingWelcomeStep, { onNext }));
  });
  await flush();
  return onNext;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('OnboardingWelcomeStep — primeira etapa inline', () => {
  it('mostra a Nutri Van, o título, o texto e os benefícios', async () => {
    await renderStep();

    expect(container.textContent).toContain('Olá, eu sou a Nutri Van, sua assistente virtual.');
    expect(container.textContent).toContain('JORNADA PERSONALIZADA');
    expect(container.textContent).toContain('SUA SAÚDE É IMPORTANTE');
    expect(container.textContent).toContain('PARA NÓS');
    expect(container.textContent).toContain('Para a nutricionista Vanusa montar um plano alimentar');
    expect(container.textContent).toContain('Seguro');
    expect(container.textContent).toContain('Personalizado');
    expect(container.textContent).toContain('Gratuito');
    expect(container.textContent).not.toContain('Vamos cuidar de você');
    expect(container.textContent).not.toContain('Agora não');

    const image = container.querySelector('img');
    expect(decodeURIComponent(image?.getAttribute('src') ?? '')).toContain(
      '/avatars/nutri-feliz.png'
    );
    expect(image?.getAttribute('alt')).toBe('');
  });

  it('inicia o preenchimento pelo CTA e não abre um diálogo', async () => {
    const onNext = await renderStep();
    const primary = container.querySelector<HTMLButtonElement>(
      '[data-onboarding-intro-primary]'
    );
    expect(primary?.textContent).toContain('Começar agora');

    await act(async () => {
      primary?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
