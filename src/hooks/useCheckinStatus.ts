import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isCheckinDoneThisWeek } from '@/lib/checkin';

interface UseCheckinStatusOptions {
  /** Define se a consulta deve ser executada (ex.: apenas quando logado) */
  enabled?: boolean;
}

/**
 * Hook que sincroniza o estado do check-in semanal com a FONTE ÚNICA
 * (src/lib/checkin · isCheckinDoneThisWeek) para Sidebar, Drawer Mobile
 * e qualquer superfície de navegação.
 *
 * Faz apenas UMA query leve (created_at do último check-in) e NÃO duplica
 * a regra semanal — ela vive em checkin.ts.
 *
 * Retorna:
 *  - isDone:         boolean do check-in concluído nesta janela de 7 dias
 *  - doneChecked:    true quando a consulta já terminou (útil p/ evitar
 *    flash de "pendente" antes de saber o estado real)
 */
export function useCheckinStatus(
  supabase: SupabaseClient,
  { enabled = true }: UseCheckinStatusOptions = {}
) {
  const [isDone, setIsDone] = useState(false);
  const [doneChecked, setDoneChecked] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (!session) {
          setDoneChecked(true);
          return;
        }

        const { data } = await supabase
          .from('checkins')
          .select('created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!active) return;
        if (data && data.length > 0) {
          setIsDone(isCheckinDoneThisWeek([data[0]] as { created_at: string }[]));
        }
      } catch {
        // Estado indeterminado: mantém isDone=false (PENDENTE) — nunca
        // apresenta falsamente "Feito esta semana" em caso de erro.
      } finally {
        if (active) setDoneChecked(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase, enabled]);

  return { isDone, doneChecked };
}
