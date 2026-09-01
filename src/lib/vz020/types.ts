// VZ-020 — SSOT Recovery + Copiloto + Pré-consulta
// Sem score, sem riskLevel, sem behaviorEngine, sem diagnóstico

export type RecoverySignalType = 'checkin' | 'daily_log' | 'adherence' | 'return';

export type RecoveryAction = {
  id: string;
  type: RecoverySignalType;
  title: string;
  description: string;
  reason: string;
  cta: string;
};

export type RecoveryResult = {
  state: 'OK' | 'NO_DATA';
  actions: RecoveryAction[];
};

export type RecoveryInput = {
  isCheckinDoneThisWeek: boolean;
  hasDailyLogToday: boolean;
  lastCheckinAdherence: number | null;
  hasReturnedRecently: boolean;
  totalCheckins: number;
};

// Copiloto — dados objetivos já existentes
export type CopilotInput = {
  profile: {
    full_name: string | null;
    created_at: string | null;
    account_type: string | null;
    has_meal_plan_access: boolean | null;
  } | null;
  lastCheckin: {
    created_at: string | null;
    peso: string | null;
    altura: string | null;
    adesao_ao_plano: number | null;
    humor_semanal: number | null;
    comentarios: string | null;
  } | null;
  previousCheckin: {
    created_at: string | null;
    peso: string | null;
    adesao_ao_plano: number | null;
  } | null;
  dailyLogToday: {
    water_ml: number | null;
    meals_checked: string[] | null;
    mood: string | null;
    activity_kcal: number | null;
  } | null;
  checkinsCount: number;
  dailyLogsCount7d: number;
  isCheckinDoneThisWeek: boolean;
};

export type CopilotSection = {
  title: string;
  lines: string[];
};

export type CopilotResult = {
  patientName: string;
  sections: CopilotSection[];
  hasData: boolean;
};

// Pré-consulta — "O que mudou desde a última consulta?"
export type PreConsultInput = {
  lastCheckin: {
    created_at: string | null;
    peso: string | null;
    cintura: string | null;
    adesao_ao_plano: number | null;
    humor_semanal: number | null;
  } | null;
  previousCheckin: {
    created_at: string | null;
    peso: string | null;
    cintura: string | null;
    adesao_ao_plano: number | null;
  } | null;
  dailyLogToday: {
    water_ml: number | null;
    meals_checked: string[] | null;
    mood: string | null;
  } | null;
  isCheckinDoneThisWeek: boolean;
};

export type PreConsultResult = {
  title: string;
  items: string[];
  hasChanges: boolean;
};
