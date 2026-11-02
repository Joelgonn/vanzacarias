'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X } from 'lucide-react';
import { ONBOARDING_INTRO_CONTENT } from '@/lib/onboarding/introContent';
import OnboardingWelcomeContent from '@/components/onboarding/OnboardingWelcomeContent';
import {
  JOURNEY_STEP_ORDER,
  type JourneyStepKey,
} from '@/lib/patientJourney';

export interface OnboardingStepIntroProps {
  stepKey: JourneyStepKey;
  open: boolean;
  completedCount?: number;
  totalSteps?: number;
  onStart: () => void;
  onDismiss: () => void;
  /** Elemento que deve receber o foco ao fechar (ex.: primeiro campo). */
  focusTargetSelector?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// `useSyncExternalStore` evita setState em efeito para detectar o cliente.
const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Introdução visual compartilhada do onboarding.
 *
 * Apresentacional: não consulta banco, não decide a etapa pendente e não
 * navega. O chamador controla `open` e a dispensa.
 */
export default function OnboardingStepIntro({
  stepKey,
  open,
  completedCount = 0,
  totalSteps = JOURNEY_STEP_ORDER.length,
  onStart,
  onDismiss,
  focusTargetSelector,
}: OnboardingStepIntroProps) {
  const isClient = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot
  );
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const content = ONBOARDING_INTRO_CONTENT[stepKey];
  const isWelcome = Boolean(content.characterMessage);
  const stepIndex = JOURNEY_STEP_ORDER.indexOf(stepKey);
  const currentStep = stepIndex >= 0 ? stepIndex + 1 : 1;
  const safeTotal = Math.max(1, totalSteps);
  const safeCompleted = Math.min(Math.max(0, completedCount), safeTotal);

  useEffect(() => {
    if (!open || !isClient) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children).filter(
      (element) => element !== overlay
    );
    const previousInert = siblings.map((element) => element.getAttribute('inert'));

    siblings.forEach((element) => element.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';

    const focusTimer = window.requestAnimationFrame(() => {
      const primary = dialogRef.current?.querySelector<HTMLElement>(
        '[data-onboarding-intro-primary]'
      );
      (primary ?? dialogRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = bodyOverflow;
      siblings.forEach((element, index) => {
        if (previousInert[index] === null) element.removeAttribute('inert');
        else element.setAttribute('inert', previousInert[index] as string);
      });

      const target = focusTargetSelector
        ? document.querySelector<HTMLElement>(focusTargetSelector)
        : null;
      (target ?? previousFocusRef.current)?.focus();
    };
  }, [open, isClient, focusTargetSelector]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onDismiss]);

  if (!open || !isClient) return null;

  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-stone-950/55 p-0 backdrop-blur-md sm:items-center sm:p-4"
      data-onboarding-intro-backdrop="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className={`relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:rounded-[2rem] sm:p-8 ${
          isWelcome ? 'max-w-xl' : 'max-w-lg'
        }`}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar introdução"
          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nutri-700 focus-visible:ring-offset-2"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2 pr-12">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-nutri-700">
            Etapa {currentStep} de {safeTotal}
          </p>
          {content.badge && (
            <span className="rounded-full bg-nutri-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-nutri-800">
              {content.badge}
            </span>
          )}
        </div>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={safeTotal}
          aria-valuenow={currentStep}
          aria-valuetext={`Etapa ${currentStep} de ${safeTotal}`}
          aria-label="Progresso do onboarding"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-nutri-600 to-nutri-800"
            style={{ width: `${(currentStep / safeTotal) * 100}%` }}
          />
        </div>

        {isWelcome ? (
          <OnboardingWelcomeContent
            content={content}
            titleId={titleId}
            descriptionId={descriptionId}
            onStart={onStart}
            onDismiss={onDismiss}
            showDismiss
          />
        ) : (
          <>
            <h2
              id={titleId}
              className="mt-6 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl"
            >
              {content.title}
            </h2>
            <p
              id={descriptionId}
              className="mt-3 text-sm font-medium leading-relaxed text-stone-600 sm:text-base"
            >
              {content.description}
            </p>
            <p className="mt-4 text-xs font-semibold text-stone-500">
              {safeCompleted} de {safeTotal} etapas concluídas
            </p>

            <div className="mt-7 flex flex-col gap-3">
              <button
                type="button"
                data-onboarding-intro-primary="true"
                onClick={onStart}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-nutri-900 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-nutri-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nutri-700 focus-visible:ring-offset-2"
              >
                {content.cta}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nutri-700 focus-visible:ring-offset-2"
              >
                Agora não
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
