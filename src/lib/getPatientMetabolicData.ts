import { createClient } from '@/lib/supabase/client';
import { buildMetabolicSnapshot, calculateAvgActivity, calculateWeightTrend, calculateWeightVelocity } from '@/lib/metabolicModel';
import type { RecommendationResult } from '@/lib/nutrition';
import { calculateBodyComposition, calculateAge, normalizeSex } from '@/lib/nutrition/bodyComposition';

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
  recommendation: RecommendationResult | null;
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

  // 5. Buscar dobras para calcular % gordura e massa magra (via motor único — DO-000.0)
  // Antes: cálculo inline com soma 7 errada (biceps+calf) e fallback sexo invertido.
  // Agora: delega ao motor (JP7 corrigido, null!=0, sem fallback).
  let bfPercent: number | null = null;
  if (!leanMass && weight && ageStr && age !== null) {
    const { data: lastSkinfolds } = await supabase
      .from('skinfolds')
      .select('id, triceps, biceps, subscapular, axillary_media, pectoral, suprailiac, abdominal, thigh, calf, measurement_date, protocol')
      .eq('user_id', patientId)
      .order('measurement_date', { ascending: false })
      .limit(1);

    if (lastSkinfolds && lastSkinfolds.length > 0) {
      const skin = lastSkinfolds[0] as Record<string, unknown>;
      // F3.6 — prioriza body_compositions is_official
      const { data: official } = await supabase
        .from('body_compositions')
        .select('*')
        .eq('skinfold_id', (skin as any).id)
        .eq('is_official', true)
        .maybeSingle();
      if (official) {
        // Conjunto indivisível do oficial
        bfPercent = (official as any).bf;
        if (bfPercent !== null && bfPercent > 0 && bfPercent < 60) {
          bf = bfPercent;
          leanMass = (official as any).lean_mass ?? null;
        }
      } else {
      const rawProtocol = (skin as any).protocol ?? null;
      const isValidProtocol = rawProtocol === 'jp3' || rawProtocol === 'jp7' || rawProtocol === 'petroski4';
      if (!isValidProtocol) {
        // Protocolo NULL histórico → não calcular como JP7 oficial
      } else {
      // Usar idade na data da medida quando houver measurement_date; senão idade atual (compat Fase 1)
      const skinAge = skin.measurement_date
        ? calculateAge(ageStr, skin.measurement_date as string) ?? age
        : age;
      const sexNorm = normalizeSex(gender);
      const comp = calculateBodyComposition({
        protocol: rawProtocol as any,
        sex: sexNorm,
        age: skinAge,
        weight,
        height: null,
        skinfolds: skin as never,
        conversion: 'siri',
      });
      if (comp && comp.bf !== null && (comp as { bf: number }).bf !== null) {
        const c = comp as { bf: number; density: number; sum: number; leanMass: number | null; fatMass: number | null };
        bfPercent = c.bf;
        // Manter compat de tipos antigos (bf/leanMass com 1 casa) mas derivar de bf não-arredondado no motor
        // Se peso disponível, o motor já calculou leanMass sem arredondamento intermediário
        if (bfPercent > 0 && bfPercent < 60) {
          bf = bfPercent; // não arredondar aqui; apresentação arredonda na borda
          if (c.leanMass !== null) leanMass = c.leanMass;
        }
      }
      }
      }
    }
  }

  // 6. Buscar logs de atividade dos últimos 7 dias (média pela quantidade REAL)
  const { data: recentLogs } = await supabase
    .from('daily_logs')
    .select('activity_kcal')
    .eq('user_id', patientId)
    .order('date', { ascending: false })
    .limit(7);

  const avgActivity = calculateAvgActivity(recentLogs || []);

  // 7. Calcular tendência e velocidade de peso via modelo (SSOT)
  const { data: recentCheckins } = await supabase
    .from('checkins')
    .select('peso, created_at')
    .eq('user_id', patientId)
    .order('created_at', { ascending: false })
    .limit(7);

  const checkinsAsc = [...(recentCheckins || [])].reverse();
  const weightTrend = calculateWeightTrend(checkinsAsc.map(c => c.peso));
  const weightVelocity = calculateWeightVelocity(checkinsAsc);

  // 8. Processar TMB, GET e Recomendação via Single Source of Truth
  let metabolic = null;

  if (weight && height && age !== null) {
    metabolic = buildMetabolicSnapshot({
      weight,
      height,
      age,
      gender,
      bf,
      leanMass,
      avgActivity,
      weightTrend,
      weightVelocity
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
    tmbMethod: metabolic?.tmbMethod || (leanMass ? 'Katch-McArdle' : 'Mifflin-St Jeor'),
    getVal: metabolic?.get || 0,
    recommendation: metabolic?.recommendation || null,
    bfPercent
  };
}