'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadOnboardingState } from '@/lib/onboarding/loadOnboardingState';
import type { JourneyStepKey, PatientJourneySnapshot } from '@/lib/patientJourney';
import {
  getOnboardingIntroStorageKey,
  shouldShowOnboardingIntro,
} from '@/lib/onboarding/introState';

interface UseOnboardingStepIntroOptions {
  step: JourneyStepKey;
  supabase: SupabaseClient;
  /** Só consulta/abre quando habilitado (ex.: etapa 3 do assistente, modal aberto). */
  enabled?: boolean;
  /**
   * Snapshot já confiável (ex.: Dashboard). Quando informado — inclusive `null` —
   * o hook NÃO refaz as consultas de onboarding.
   */
  snapshot?: PatientJourneySnapshot | null;
  isExempt?: boolean;
}

/**
 * Gate compartilhado da introdução visual.
 *
 * Não altera conclusão, não navega e não persiste no banco. Quando não recebe
 * um snapshot confiável, usa o loader central já existente. A dispensa é
 * isolada por usuário + etapa em sessionStorage.
 */
export function useOnboardingStepIntro({
  step,
  supabase,
  enabled = true,
  snapshot: providedSnapshot,
  isExempt = false,
}: UseOnboardingStepIntroOptions) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loadedSnapshot, setLoadedSnapshot] = useState<PatientJourneySnapshot | null>(null);
  const [loadedExempt, setLoadedExempt] = useState(false);
  const [loading, setLoading] = useState(enabled && providedSnapshot === undefined);
  const [loadError, setLoadError] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissChecked, setDismissChecked] = useState(false);

  const snapshot = providedSnapshot !== undefined ? providedSnapshot : loadedSnapshot;
  const resolvedExempt = providedSnapshot !== undefined ? isExempt : loadedExempt;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoadError(false);
    if (providedSnapshot === undefined) setLoading(true);
    else setLoading(false);

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active) return;

        if (!session?.user) {
          setUserId(null);
          setLoading(false);
          return;
        }

        setUserId(session.user.id);

        // Snapshot confiável já veio do chamador: não refaz queries.
        if (providedSnapshot !== undefined) {
          setLoading(false);
          return;
        }

        const result = await loadOnboardingState(supabase, session.user.id);
        if (!active) return;
        setLoadedSnapshot(result.snapshot);
        setLoadedExempt(result.isExempt);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [enabled, supabase, providedSnapshot]);

  const storageKey = useMemo(
    () => (userId ? getOnboardingIntroStorageKey(userId, step) : null),
    [userId, step]
  );

  useEffect(() => {
    setDismissChecked(false);
    if (!storageKey) {
      setDismissed(false);
      return;
    }

    try {
      setDismissed(sessionStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    }
    setDismissChecked(true);
  }, [storageKey]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // sessionStorage indisponível (modo privado/restrição): a dispensa
      // continua valendo em memória durante este mount.
    }
  }, [storageKey]);

  const show = useMemo(
    () =>
      shouldShowOnboardingIntro({
        step,
        snapshot,
        isExempt: resolvedExempt,
        enabled,
        loading,
        loadError,
        userId,
        dismissed,
        dismissChecked,
      }),
    [
      step,
      snapshot,
      resolvedExempt,
      enabled,
      loading,
      loadError,
      userId,
      dismissed,
      dismissChecked,
    ]
  );

  return {
    show,
    snapshot,
    isExempt: resolvedExempt,
    loading,
    unavailable: loadError || !!snapshot?.hasUnavailable,
    userId,
    dismiss,
  };
}
