'use client';

import { useMemo } from 'react';
import VZ020CopilotCard from '@/components/admin/VZ020CopilotCard';
import { buildCopilot } from '@/lib/vz020/copilot';
import { buildPreConsult } from '@/lib/vz020/preConsultation';

interface PatientProfile {
  id: string;
  full_name: string;
  phone?: string;
  data_nascimento?: string;
  sexo?: string;
  tipo_perfil?: string;
  meta_peso?: number | null;
  altura?: number | null;
}

interface CheckinData {
  id: string;
  created_at: string;
  peso: number;
  altura: number;
  imc: number;
  adesao_ao_plano: number;
  humor_semanal: number;
  comentarios: string;
}

interface DailyLog {
  id: string;
  date: string;
  water_ml: number;
  mood: string;
  meals_checked: string[];
  activity_kcal?: number;
  activities?: unknown[];
}

interface Props {
  profile: PatientProfile | null;
  history: CheckinData[];
  dailyLogs: DailyLog[];
}

export default function CopilotTab({ profile, history, dailyLogs }: Props) {
  const todayStr = new Date().toISOString().split('T')[0];

  const { copilot, preConsult } = useMemo(() => {
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const lastCheckin = sortedHistory.at(-1) ?? null;
    const previousCheckin = sortedHistory.at(-2) ?? null;

    const dailyToday = dailyLogs.find((d) => d.date === todayStr) ?? null;

    const c = buildCopilot({
      profile: profile
        ? {
            full_name: profile.full_name,
            created_at: null,
            account_type: null,
            has_meal_plan_access: null,
          }
        : null,
      lastCheckin: lastCheckin
        ? {
            created_at: lastCheckin.created_at,
            peso: String(lastCheckin.peso),
            altura: String(lastCheckin.altura),
            adesao_ao_plano: lastCheckin.adesao_ao_plano,
            humor_semanal: lastCheckin.humor_semanal,
            comentarios: lastCheckin.comentarios,
          }
        : null,
      previousCheckin: previousCheckin
        ? {
            created_at: previousCheckin.created_at,
            peso: String(previousCheckin.peso),
            adesao_ao_plano: previousCheckin.adesao_ao_plano,
          }
        : null,
      dailyLogToday: dailyToday
        ? {
            water_ml: dailyToday.water_ml ?? null,
            meals_checked: Array.isArray(dailyToday.meals_checked) ? dailyToday.meals_checked : null,
            mood: dailyToday.mood ?? null,
            activity_kcal: typeof dailyToday.activity_kcal === 'number' ? dailyToday.activity_kcal : null,
          }
        : null,
      checkinsCount: history.length,
      dailyLogsCount7d: dailyLogs.slice(0, 7).length,
      isCheckinDoneThisWeek: (() => {
        if (!lastCheckin) return false;
        // eslint-disable-next-line react-hooks/purity
        const diff = Date.now() - new Date(lastCheckin.created_at).getTime();
        return diff <= 7 * 24 * 60 * 60 * 1000;
      })(),
    });

    const pre = buildPreConsult({
      lastCheckin: lastCheckin
        ? {
            created_at: lastCheckin.created_at,
            peso: String(lastCheckin.peso),
            cintura: null,
            adesao_ao_plano: lastCheckin.adesao_ao_plano,
            humor_semanal: lastCheckin.humor_semanal,
          }
        : null,
      previousCheckin: previousCheckin
        ? {
            created_at: previousCheckin.created_at,
            peso: String(previousCheckin.peso),
            cintura: null,
            adesao_ao_plano: previousCheckin.adesao_ao_plano,
          }
        : null,
      dailyLogToday: dailyToday
        ? {
            water_ml: dailyToday.water_ml ?? null,
            meals_checked: Array.isArray(dailyToday.meals_checked) ? dailyToday.meals_checked : null,
            mood: dailyToday.mood ?? null,
          }
        : null,
      isCheckinDoneThisWeek: (() => {
        if (!lastCheckin) return false;
        // eslint-disable-next-line react-hooks/purity
        return Date.now() - new Date(lastCheckin.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000;
      })(),
    });

    return { copilot: c, preConsult: pre };
  }, [profile, history, dailyLogs, todayStr]);

  return (
    <div className="animate-in fade-in duration-300">
      <VZ020CopilotCard copilot={copilot} preConsult={preConsult} />
    </div>
  );
}
