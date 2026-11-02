import { useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isCheckinDoneThisWeek } from '@/lib/checkin';

interface UseCheckinStatusOptions {
  enabled?: boolean;
}

export function useCheckinStatus(
  supabase: SupabaseClient,
  { enabled = true }: UseCheckinStatusOptions = {}
) {
  const [isDone, setIsDone] = useState(false);
  const [doneChecked, setDoneChecked] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsDone(false);
        setUnavailable(false);
        setDoneChecked(true);
        return;
      }

      const { data, error } = await supabase
        .from('checkins')
        .select('created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Falha de consulta não pode virar "pendente" nem "concluído".
      if (error) throw error;

      setUnavailable(false);
      if (data && data.length > 0) {
        setIsDone(isCheckinDoneThisWeek([data[0]] as { created_at: string }[]));
      } else {
        setIsDone(false);
      }
    } catch {
      setIsDone(false);
      setUnavailable(true);
    } finally {
      setDoneChecked(true);
    }
  }, [supabase, enabled]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await load();
    })();
    const handler = () => {
      if (active) load();
    };
    window.addEventListener('patient:checkin-updated', handler);
    return () => {
      active = false;
      window.removeEventListener('patient:checkin-updated', handler);
    };
  }, [load]);

  return { isDone, doneChecked, unavailable };
}
