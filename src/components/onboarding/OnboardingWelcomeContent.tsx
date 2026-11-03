'use client';

import Image from 'next/image';
import { ArrowRight, Gift, ShieldCheck, Sparkles } from 'lucide-react';
import type { OnboardingIntroContent } from '@/lib/onboarding/introContent';

interface OnboardingWelcomeContentProps {
  content: OnboardingIntroContent;
  onStart: () => void;
  onDismiss?: () => void;
  showDismiss?: boolean;
  titleId?: string;
  descriptionId?: string;
}

const HIGHLIGHT_ICONS = [ShieldCheck, Sparkles, Gift] as const;

/**
 * Corpo compartilhado da introdução de boas-vindas.
 *
 * Usado pelo diálogo de `/dashboard/perfil` e pelo StepWelcome inline de
 * `/dashboard/completar-perfil`, garantindo uma única composição.
 */
export default function OnboardingWelcomeContent({
  content,
  onStart,
  onDismiss,
  showDismiss = false,
  titleId,
  descriptionId,
}: OnboardingWelcomeContentProps) {
  const titleLines = content.titleLines;

  return (
    <>
      {content.characterMessage && (
        <div
          data-welcome-character="true"
          className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3"
        >
          <Image
            src="/avatars/nutri-feliz.png"
            alt=""
            width={661}
            height={377}
            className="h-32 w-auto max-w-full shrink-0 object-contain sm:h-36"
          />
          <div
            data-welcome-speech="true"
            className="relative w-full max-w-sm rounded-2xl border border-nutri-200 bg-nutri-50 px-4 py-3 text-center shadow-sm sm:mt-0 sm:w-56 sm:shrink-0"
          >
            <span
              aria-hidden="true"
              className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-nutri-200 bg-nutri-50 sm:hidden"
            />
            <span
              aria-hidden="true"
              className="absolute -left-1.5 top-1/2 hidden h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-nutri-200 bg-nutri-50 sm:block"
            />
            <p className="relative text-sm font-semibold leading-relaxed text-stone-700">
              Olá, eu sou a{' '}
              <strong className="font-black text-nutri-900">Nutri Van</strong>, sua assistente virtual.
            </p>
          </div>
        </div>
      )}

      {content.journeyLabel && (
        <p className="mt-5 text-center text-[10px] font-black uppercase tracking-[0.24em] text-nutri-700">
          {content.journeyLabel}
        </p>
      )}

      <h2
        id={titleId}
        className="mx-auto mt-3 max-w-md text-center text-xl font-black uppercase leading-tight tracking-tight text-stone-900 sm:text-2xl"
      >
        {titleLines
          ? titleLines.map((line, index) => (
              <span key={line} className="block">
                {line}
                {index < titleLines.length - 1 ? ' ' : ''}
              </span>
            ))
          : content.title}
      </h2>
      <p
        id={descriptionId}
        data-welcome-description="true"
        className="mx-auto mt-3 max-w-md text-pretty text-center text-sm font-medium leading-relaxed text-stone-600 sm:text-base"
      >
        {content.description}
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

        {content.highlights && content.highlights.length > 0 && (
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-1">
            {content.highlights.map((label, index) => {
              const Icon = HIGHLIGHT_ICONS[index] ?? ShieldCheck;
              return (
                <li
                  key={label}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600"
                >
                  <Icon size={14} className="text-nutri-700" aria-hidden="true" />
                  {label}
                </li>
              );
            })}
          </ul>
        )}

        {showDismiss && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nutri-700 focus-visible:ring-offset-2"
          >
            Agora não
          </button>
        )}
      </div>
    </>
  );
}
