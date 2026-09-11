// Service — body_compositions (F3.4)
// skinfolds = COLETA, body_compositions = CALCULADO, bodyComposition.ts = FORMULA

import { createClient } from '@/lib/supabase/client';
import { calculateBodyComposition, calculateAge, normalizeSex } from './bodyComposition';
import type { ProtocolId, Conversion } from './bodyComposition';

export const PROTOCOL_VERSION = '2026-09-11';

export type PersistParams = {
  skinfoldId: string;
  userId: string;
  measurementDate: string; // YYYY-MM-DD
  protocol: ProtocolId;
  method?: Conversion; // default siri
  skinfolds: Record<string, unknown>; // 9 dobras
  birthDate?: string | null;
  sex?: string | null;
  weight?: number | null; // kg
  height?: number | null; // cm
  createdBy?: string | null;
};

export type SimulateParams = {
  skinfolds: Record<string, unknown>;
  protocol: ProtocolId;
  method?: Conversion;
  birthDate?: string | null;
  sex?: string | null;
  weight?: number | null;
  height?: number | null;
  measurementDate?: string | null;
};

/**
 * Simulação — não persiste, retorna cálculo efêmero.
 * Permite protocol diferente de skinfolds.protocol (ex.: simular Petroski sobre JP7).
 */
export function simulateBodyComposition(params: SimulateParams) {
  const { skinfolds, protocol, method = 'siri', birthDate, sex, weight, height, measurementDate } = params;
  const age = birthDate ? calculateAge(birthDate, measurementDate ?? null) : null;
  const sexNorm = normalizeSex(sex ?? null);
  return calculateBodyComposition({
    protocol,
    sex: sexNorm,
    age,
    weight: weight ?? null,
    height: height ?? null,
    skinfolds,
    conversion: method,
  });
}

/**
 * Persistência do resultado oficial.
 * 1) valida protocolo/method
 * 2) calcula via motor
 * 3) se incompleto (bf null) → não persiste, retorna null
 * 4) desativa oficial anterior (is_official=true → false) para mesmo skinfold_id
 * 5) insere novo com is_official=true
 * Retorna linha inserida ou null se não persistido.
 */
export async function persistBodyComposition(params: PersistParams) {
  const { skinfoldId, userId, measurementDate, protocol, method = 'siri', skinfolds, birthDate, sex, weight, height, createdBy } = params;

  // Validação protocolo/method
  if (!['jp3','jp7','petroski4'].includes(protocol)) throw new Error(`Protocolo inválido: ${protocol}`);
  if (!['siri','brozek'].includes(method as string)) throw new Error(`Method inválido: ${method}`);

  const age = birthDate ? calculateAge(birthDate, measurementDate) : null;
  const sexNorm = normalizeSex(sex ?? null);

  const comp = calculateBodyComposition({
    protocol,
    sex: sexNorm,
    age,
    weight: weight ?? null,
    height: height ?? null,
    skinfolds,
    conversion: method as Conversion,
  });

  // Se incompleto (missing, bf null, density null) → não persistir
  if (!comp || comp.bf === null || comp.density === null || comp.sum === null) {
    return null;
  }

  const supabase = createClient();
  const user = createdBy ?? (await supabase.auth.getSession()).data.session?.user?.id ?? null;

  // Desativar oficial anterior (se existir) — não apagar
  await supabase
    .from('body_compositions')
    .update({ is_official: false })
    .eq('skinfold_id', skinfoldId)
    .eq('is_official', true);

  const payload = {
    skinfold_id: skinfoldId,
    user_id: userId,
    measurement_date: measurementDate,
    protocol,
    protocol_version: PROTOCOL_VERSION,
    method,
    sum: comp.sum,
    density: comp.density,
    bf: comp.bf,
    fat_mass: comp.fatMass,
    lean_mass: comp.leanMass,
    is_official: true,
    created_by: user,
  };

  const { data, error } = await supabase.from('body_compositions').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

/**
 * Leitura oficial — F3.6
 * Retorna body_compositions is_official=true para skinfold_id, ou null.
 * Não calcula, não faz fallback, não escolhe MAX.
 */
export async function getOfficialBodyComposition(skinfoldId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('body_compositions')
    .select('*')
    .eq('skinfold_id', skinfoldId)
    .eq('is_official', true)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Leitura em lote para N+1 — usado por historico/dashboard
 */
export async function getOfficialBodyCompositionsMap(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('body_compositions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_official', true);
  if (error) throw error;
  const map = new Map<string, Record<string, unknown>>();
  (data || []).forEach((row: Record<string, unknown>) => map.set(row.skinfold_id as string, row));
  return map;
}
