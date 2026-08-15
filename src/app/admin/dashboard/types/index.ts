export type PatientPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PatientScore {
  total: number;
  engagement: number;
  recency: number;
  adherence: number;
  risk: PatientPriority;
  suggestedAction: string;
}

export interface Patient {
  id: string;
  full_name: string;
  phone?: string;
  data_nascimento?: string;
  sexo?: string;
  tipo_perfil?: string;
  meta_peso?: number | null;
  account_type?: string;
  created_at: string;
  meal_plan?: any[];
  evaluation_answers?: Record<string, string>;
  is_late?: boolean;
  days_since_last?: number;
  is_new?: boolean;
  water_ml?: number | null;
  mood?: string | null;
  messages_today?: number;
  peso?: number | null;
  weight?: number | null;
  altura?: number | null;
  height?: number | null;
  bf?: number | null;
  leanMass?: number | null;
  food_restrictions?: any[];
  priority?: PatientPriority;
  score?: PatientScore;
}