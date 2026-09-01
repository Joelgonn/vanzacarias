export type FocusActionType =
  | 'checkin'
  | 'meals'
  | 'hydration'
  | 'adherence'
  | 'activity'
  | 'no_data';

export type FocusAction = {
  id: string;
  type: FocusActionType;
  title: string;
  description: string;
  reason: string;
  priority: 1 | 2 | 3;
};

export type FocusResult = {
  state: 'OK' | 'NO_DATA';
  actions: FocusAction[];
};

export type FocusInput = {
  dailyLog?: {
    date: string;
    water_ml?: number | null;
    meals_checked?: string[] | null;
    mood?: 'feliz' | 'neutro' | 'dificil' | null;
    activities?: { id: string; name?: string }[] | null;
    activity_kcal?: number | null;
  } | null;

  checkin?: {
    lastCheckinAt?: string | null;
    daysSinceLastCheckin?: number | null;
    adesao_ao_plano?: number | null;
    humor_semanal?: number | null;
  } | null;

  jornada: {
    isCheckinDoneThisWeek: boolean;
    hasMealPlan: boolean;
    canAccessMealPlan: boolean;
  };

  meta?: {
    meta_peso?: number | null;
    currentWeight?: number | null;
    totalRecords?: number | null;
  };

  access: {
    canAccessMealPlan: boolean;
  };

  totalMeals?: number | null;
  waterGoal?: number | null;
  latestWeightForWater?: number | null;
};

export type RecoveryActionType = 'checkin' | 'daily_log' | 'adherence' | 'no_data';

export type RecoveryAction = {
  id: string;
  type: RecoveryActionType;
  title: string;
  description: string;
  reason: string;
  priority: 1 | 2 | 3;
};

export type RecoveryResult = {
  state: 'OK' | 'NO_DATA';
  actions: RecoveryAction[];
};
