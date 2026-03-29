import { createClient } from '@/lib/supabase/client';
import calculateMetabolism from '@/lib/metabolicEngine';

interface MetabolicDataInput {
  patientId: string;
  weight?: number | null;
  height?: number | null;
  data_nascimento?: string | null;
  sexo?: string | null;
  bf?: number | null;
  leanMass?: number | null;
}

export interface MetabolicDataOutput {
  weight: number | null;
  height: number | null;
  age: number | null;
  gender: string;
  bf: number | null;
  leanMass: number | null;
  avgActivity: number;
  weightTrend: 'losing' | 'gaining' | 'stable';
  tmb: number;
  tmbMethod: string;
  getVal: number;
  recommendation: any | null;
  bfPercent: number | null;
}

/**
 * Busca os dados metabólicos mais recentes do paciente
 * - Último check-in (peso, altura)
 * - Última antropometria (peso, altura)
 * - Últimas dobras cutâneas (para calcular % gordura e massa magra)
 * - Média de atividade dos últimos 7 dias
 * - Tendência de peso (últimos 2 check-ins)
 */
export async function getPatientMetabolicData(
  patientId: string,
  profileData?: MetabolicDataInput
): Promise<MetabolicDataOutput> {
  const supabase = createClient();

  // Valores iniciais
  let weight = profileData?.weight || null;
  let height = profileData?.height || null;
  const gender = profileData?.sexo || '';
  const ageStr = profileData?.data_nascimento || null;
  let bf = profileData?.bf || null;
  let leanMass = profileData?.leanMass || null;

  // 1. Buscar último check-in
  const { data: lastCheckin } = await supabase
    .from('checkins')
    .select('peso, altura')
    .eq('user_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1);

  // 2. Buscar última antropometria
  const { data: lastAntro } = await supabase
    .from('anthropometry')
    .select('weight, height')
    .eq('user_id', patientId)
    .order('measurement_date', { ascending: false })
    .limit(1);

  // 3. Usar dados mais recentes (prioridade: checkin > antropometria > perfil)
  if (lastCheckin && lastCheckin.length > 0) {
    if (lastCheckin[0].peso) weight = lastCheckin[0].peso;
    if (lastCheckin[0].altura) height = lastCheckin[0].altura;
  }

  if (!weight && lastAntro && lastAntro.length > 0) {
    if (lastAntro[0].weight) weight = lastAntro[0].weight;
    if (lastAntro[0].height) height = lastAntro[0].height;
  }

  // 4. Calcular idade
  let age: number | null = null;
  if (ageStr) {
    const birth = new Date(ageStr);
    const today = new Date();
    age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
  }

  // 5. Buscar dobras para calcular % gordura e massa magra
  let bfPercent: number | null = null;
  if (!leanMass && weight && height && ageStr && age !== null) {
    const { data: lastSkinfolds } = await supabase
      .from('skinfolds')
      .select('triceps, biceps, subscapular, suprailiac, abdominal, thigh, calf')
      .eq('user_id', patientId)
      .order('measurement_date', { ascending: false })
      .limit(1);

    if (lastSkinfolds && lastSkinfolds.length > 0) {
      const skin = lastSkinfolds[0];
      const sum = (parseFloat(skin.triceps?.toString() || "0") +
                  parseFloat(skin.biceps?.toString() || "0") +
                  parseFloat(skin.subscapular?.toString() || "0") +
                  parseFloat(skin.suprailiac?.toString() || "0") +
                  parseFloat(skin.abdominal?.toString() || "0") +
                  parseFloat(skin.thigh?.toString() || "0") +
                  parseFloat(skin.calf?.toString() || "0"));

      if (sum > 0) {
        const isFemale = ['f', 'feminino', 'female', 'mulher'].some(v => gender.toLowerCase().trim().startsWith(v));

        let bd = 0;
        if (isFemale) {
          bd = 1.097 - (0.00046971 * sum) + (0.00000056 * (sum * sum)) - (0.00012828 * age);
        } else {
          bd = 1.112 - (0.00043499 * sum) + (0.00000055 * (sum * sum)) - (0.00028826 * age);
        }

        if (bd > 0) {
          bfPercent = (4.95 / bd - 4.5) * 100;
          if (bfPercent > 0 && bfPercent < 60) {
            bf = parseFloat(bfPercent.toFixed(1));
            leanMass = parseFloat((weight - (weight * (bfPercent / 100))).toFixed(1));
          }
        }
      }
    }
  }

  // 6. Buscar média de atividade dos últimos 7 dias
  const { data: recentLogs } = await supabase
    .from('daily_logs')
    .select('activity_kcal')
    .eq('user_id', patientId)
    .order('date', { ascending: false })
    .limit(7);

  let avgActivity = 0;
  if (recentLogs && recentLogs.length > 0) {
    const totalActivity = recentLogs.reduce((acc, log) => acc + (Number(log.activity_kcal) || 0), 0);
    avgActivity = Math.round(totalActivity / recentLogs.length);
  }

  // 7. Calcular tendência de peso
  const { data: recentCheckins } = await supabase
    .from('checkins')
    .select('peso')
    .eq('user_id', patientId)
    .order('created_at', { ascending: false })
    .limit(2);

  let weightTrend: 'losing' | 'gaining' | 'stable' = 'stable';
  if (recentCheckins && recentCheckins.length === 2) {
    const diff = recentCheckins[0].peso - recentCheckins[1].peso;
    if (diff <= -0.5) weightTrend = 'losing';
    else if (diff >= 0.5) weightTrend = 'gaining';
  }

  // 8. Processar TMB, GET e Recomendação via Single Source of Truth
  let metabolic = null;

  if (weight && height && age !== null) {
    metabolic = calculateMetabolism({
      weight,
      height,
      age,
      gender,
      bf,
      leanMass,
      avgActivity,
      weightTrend
    });
  }

  return {
    weight,
    height,
    age,
    gender,
    bf,
    leanMass,
    avgActivity,
    weightTrend,
    tmb: metabolic?.tmb || 0,
    tmbMethod: leanMass ? 'Katch-McArdle' : 'Mifflin-St Jeor',
    getVal: metabolic?.get || 0,
    recommendation: metabolic?.recommendation || null,
    bfPercent
  };
}