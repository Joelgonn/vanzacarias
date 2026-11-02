'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  getOnboardingRoute,
  type PatientJourneySnapshot,
} from '@/lib/patientJourney';

interface UseOnboardingRedirectInput {
  snapshot: PatientJourneySnapshot | null;
  loading: boolean;
  enabled?: boolean;
}

/**
 * Gate de entrada do paciente.
 *
 * Só age na rota exata /dashboard — as demais rotas continuam navegáveis, o que
 * evita bloquear funcionalidades e impede ciclos quando o paciente quer corrigir
 * um dado já salvo. Em caso de consulta indisponível, não redireciona.
 */
export function useOnboardingRedirect({
  snapshot,
  loading,
  enabled = true,
}: UseOnboardingRedirectInput) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const lastRedirect = useRef<string | null>(null);

  const nextAction = snapshot?.nextAction ?? 'none';
  const hasUnavailable = snapshot?.hasUnavailable ?? false;
  const targetRoute = getOnboardingRoute(nextAction);

  const shouldRedirect =
    enabled &&
    !loading &&
    !!snapshot &&
    !hasUnavailable &&
    pathname === '/dashboard' &&
    !!targetRoute;

  useEffect(() => {
    if (!shouldRedirect || !targetRoute) return;
    if (lastRedirect.current === targetRoute) return;
    lastRedirect.current = targetRoute;
    router.replace(targetRoute);
  }, [shouldRedirect, targetRoute, router]);

  return { shouldRedirect, targetRoute, pathname };
}
