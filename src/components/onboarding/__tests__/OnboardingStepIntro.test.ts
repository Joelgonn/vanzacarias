// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import OnboardingStepIntro from '@/components/onboarding/OnboardingStepIntro';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let outsideTarget: HTMLInputElement;
let root: Root;

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function renderIntro(open: boolean, onStart = vi.fn(), onDismiss = vi.fn()) {
  await act(async () => {
    root.render(
      createElement(OnboardingStepIntro, {
        stepKey: 'perfil',
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
      'Vamos começar pelo seu perfil'
    );
    expect(dialog?.querySelector(`[id="${descriptionId}"]`)?.textContent).toContain(
      'personalizar seu acompanhamento nutricional'
    );
    expect(dialog?.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('expõe CTA e opção de dispensa com área mínima', async () => {
    await renderIntro(true);

    const primary = document.querySelector<HTMLButtonElement>(
      '[data-onboarding-intro-primary]'
    );
    expect(primary?.textContent).toContain('Preencher meu perfil');
    expect(primary?.className).toContain('min-h-[48px]');

    const dismiss = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Agora não')
    );
    expect(dismiss).toBeTruthy();
    expect(dismiss?.className).toContain('min-h-[44px]');
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
