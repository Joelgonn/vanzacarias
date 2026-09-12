import { createClient } from '@supabase/supabase-js';
import { calculateBodyComposition, calculateAge, normalizeSex } from '@/lib/nutrition/bodyComposition';
import type { ProtocolId } from '@/lib/nutrition/bodyComposition';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key);
}

export type ClinicalIndicesResult = {
  protocol: ProtocolId;
  protocolLabel: string;
  measurementDate: string | null;
  imc: number | null;
  sum: number | null;
  density: number | null;
  bf: number | null;
  fatMass: number | null;
  leanMass: number | null;
  missing: string[];
  warnings: string[];
  weight: number | null;
  height: number | null;
  error?: string;
};

function protocolLabel(p: ProtocolId): string {
  if (p === 'jp3') return 'JP3';
  if (p === 'jp7') return 'JP7';
  return 'Petroski';
}

function parseProtocolFromMessage(message: string): ProtocolId | null {
  const m = message.toLowerCase();
  if (/\bjp\s*3\b/.test(m) || /\bjp3\b/.test(m)) return 'jp3';
  if (/\bjp\s*7\b/.test(m) || /\bjp7\b/.test(m)) return 'jp7';
  if (/\bpetroski\b/.test(m)) return 'petroski4';
  return null;
}

export function detectClinicalIndicesRequest(message: string): boolean {
  const m = message.toLowerCase();
  return /(imc|índice|indice|gordura|percentual|massa gorda|massa magra|composi[cç]ão corporal|skinfold|dobras)/.test(m);
}

export async function getClinicalIndicesForPatient(
  patientId: string,
  requestedProtocol: ProtocolId | null
): Promise<ClinicalIndicesResult | { error: string }> {
  const protocol = requestedProtocol ?? 'jp7';
  if (!['jp3','jp7','petroski4'].includes(protocol)) {
    return { error: `Protocolo inválido: ${protocol}` } as any;
  }
  const sb = getSupabaseAdmin();

  // Buscar última avaliação válida (skinfolds)
  const { data: skinRows, error: skinErr } = await sb
    .from('skinfolds')
    .select('*')
    .eq('user_id', patientId)
    .order('measurement_date', { ascending: false })
    .limit(1);
  if (skinErr) return { error: 'Erro ao buscar dobras' } as any;
  const skin: any = skinRows?.[0] ?? null;
  if (!skin) return { error: 'Paciente sem dobras cutâneas registradas.' } as any;

  // Buscar perfil para idade/sexo/altura fallback
  const { data: profile } = await sb.from('profiles').select('data_nascimento, sexo, altura').eq('id', patientId).single();
  // Buscar antropometria da mesma data para peso/altura
  let weight: number | null = null;
  let height: number | null = null;
  if (skin.measurement_date) {
    const { data: antro } = await sb.from('anthropometry').select('weight, height').eq('user_id', patientId).eq('measurement_date', skin.measurement_date).maybeSingle();
    if (antro) {
      weight = antro.weight != null ? Number(antro.weight) : null;
      height = antro.height != null ? Number(antro.height) : null;
    }
  }
  // Fallback para último peso/altura se não houver na mesma data
  if (weight === null) {
    const { data: lastAntro } = await sb.from('anthropometry').select('weight').eq('user_id', patientId).order('measurement_date', { ascending: false }).limit(1).maybeSingle();
    if (lastAntro?.weight != null) weight = Number(lastAntro.weight);
  }
  if (height === null) {
    const h = (profile as any)?.altura ?? null;
    if (h != null) height = Number(h);
    if (height !== null && height < 3) height = height * 100; // m -> cm handled later, but keep raw for IMC
  }

  // Altura para IMC em metros
  let heightM: number | null = null;
  if (height !== null) {
    heightM = height < 3 ? height : height / 100;
    if (heightM < 0.5 || heightM > 2.5) heightM = null;
  }
  // Peso já em kg

  const imc = weight !== null && heightM !== null && heightM > 0 ? Number((weight / (heightM * heightM)).toFixed(1)) : null;

  const birthDate = (profile as any)?.data_nascimento ?? null;
  const sexRaw = (profile as any)?.sexo ?? null;
  const sexNorm = normalizeSex(sexRaw);
  const age = birthDate ? calculateAge(birthDate, skin.measurement_date ?? null) : null;

  // Altura para Petroski em cm
  let heightCm: number | null = null;
  if (height !== null) {
    heightCm = height < 3 ? height * 100 : height;
  }

  const comp: any = calculateBodyComposition({
    protocol: protocol as ProtocolId,
    sex: sexNorm,
    age,
    weight,
    height: heightCm,
    skinfolds: skin,
    conversion: 'siri',
  });

  if (!comp || comp.bf === null) {
    const missingRaw = comp?.missing ?? [];
    const warnings = comp?.warnings ?? [];
    let missing: any[] = [...missingRaw];
    if (missing.length === 0) {
      const w = warnings.join(' ');
      if (/Peso obrigatório/i.test(w)) missing.push('weight');
      if (/Estatura obrigatória/i.test(w)) missing.push('height');
      if (/Sexo não definido/i.test(w)) missing.push('sex');
      if (/Idade não informada/i.test(w)) missing.push('age');
      if (/Dobras ausentes/i.test(w) && missing.length === 0) {
        // já coberto por missingRaw, mas fallback
        const m = w.match(/Dobras ausentes: ([^;]+)/);
        if (m) missing = m[1].split(',').map((s:string)=>s.trim());
      }
    }
    // Informar campos ausentes
    const missingStr = missing.length > 0 ? missing.join(', ') : 'dados insuficientes';
    return {
      protocol,
      protocolLabel: protocolLabel(protocol as ProtocolId),
      measurementDate: skin.measurement_date ?? null,
      imc,
      sum: comp?.sum ?? null,
      density: comp?.density ?? null,
      bf: null,
      fatMass: null,
      leanMass: null,
      missing,
      warnings,
      weight,
      height: heightCm,
      error: `Não foi possível calcular o protocolo ${protocolLabel(protocol as ProtocolId)} porque faltam: ${missingStr}.`,
    } as any;
  }

  return {
    protocol,
    protocolLabel: protocolLabel(protocol as ProtocolId),
    measurementDate: skin.measurement_date ?? null,
    imc,
    sum: comp.sum,
    density: comp.density,
    bf: comp.bf,
    fatMass: comp.fatMass,
    leanMass: comp.leanMass,
    missing: [],
    warnings: comp.warnings ?? [],
    weight,
    height: heightCm,
  };
}

export { parseProtocolFromMessage };
