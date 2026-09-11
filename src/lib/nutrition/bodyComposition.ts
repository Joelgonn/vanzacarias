// ============================================================================
// BODY COMPOSITION ENGINE — Motor único (DO-000.0 / Fase 1)
// Suporta: JP3, JP7, Petroski 4 dobras
// Referências:
//  - Jackson AS, Pollock ML. Br J Nutr. 1978;40:497-504 (JP 7M e JP 3M)
//  - Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc. 1980;12:175-182 (JP 7F e JP 3F)
//  - Petroski EL. Tese UFSM 1995 (Petroski 4M/4F)
//  - Siri WE. 1961; Brozek J et al. 1963
// ============================================================================

export type ProtocolId = 'jp3' | 'jp7' | 'petroski4';
export type Sex = 'M' | 'F';
export type Conversion = 'siri' | 'brozek';

// Campos armazenados (9 medidas do banco)
export type Skinfolds = {
  triceps?: unknown;
  biceps?: unknown;
  subscapular?: unknown;
  axillary_media?: unknown;
  pectoral?: unknown;
  suprailiac?: unknown;
  abdominal?: unknown;
  thigh?: unknown;
  calf?: unknown;
};

export type BodyCompositionInput = {
  protocol: ProtocolId;
  sex: Sex | null; // null => indisponível, sem fallback
  age: number | null; // idade na data da medida
  weight: number | null; // kg
  height: number | null; // cm (só Petroski F exige)
  skinfolds: Skinfolds | null | undefined;
  conversion?: Conversion; // default 'siri'
};

export type BodyCompositionResult = {
  protocol: ProtocolId;
  label: string;
  sites: (keyof Skinfolds)[];
  sum: number; // soma exata do protocolo
  density: number; // g/cm³ sem arredondamento
  bf: number; // % sem arredondamento
  fatMass: number | null;
  leanMass: number | null;
  missing: (keyof Skinfolds)[];
  warnings: string[];
};

export type IncompatibleResult = {
  protocol: ProtocolId;
  label: string;
  sites: (keyof Skinfolds)[];
  sum: number | null;
  density: null;
  bf: null;
  fatMass: null;
  leanMass: null;
  missing: (keyof Skinfolds)[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Helpers: parsing e idade
// ---------------------------------------------------------------------------

/**
 * Converte valor bruto de dobra para number válido ou null.
 * null/undefined/''/0/<=0/NaN => null (ausente). Nunca 0 silencioso.
 */
export function parseFoldValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const str = typeof value === 'string' ? value.replace(',', '.').trim() : String(value);
  if (str === '') return null;
  const n = Number(str);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Normaliza sexo para 'M' | 'F' | null (sem fallback).
 */
export function normalizeSex(gender: string | null | undefined): Sex | null {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  // Checar formas longas antes de prefixo 'm'/'f' para evitar 'mulher'.startsWith('m')
  if (['feminino', 'mulher', 'female', 'woman'].some(v => g === v)) return 'F';
  if (['masculino', 'homem', 'male', 'man'].some(v => g === v)) return 'M';
  if (g === 'f') return 'F';
  if (g === 'm') return 'M';
  // fallback por prefixo sem colisão: feminino/female, masculino/male, mulher já tratado
  if (g.startsWith('feminino') || g.startsWith('female')) return 'F';
  if (g.startsWith('masculino') || g.startsWith('male')) return 'M';
  return null;
}

/**
 * Calcula idade na data de referência.
 * birthDate: ISO string (YYYY-MM-DD)
 * referenceDate: ISO string ou Date (measurement_date). Se ausente, usa hoje.
 */
export function calculateAge(
  birthDate: string | null | undefined,
  referenceDate?: string | Date | null
): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  if (isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age < 0 ? null : age;
}

// ---------------------------------------------------------------------------
// Registro declarativo de protocolos
// ---------------------------------------------------------------------------

type DensityFn = (sum: number, age: number, weight?: number | null, height?: number | null) => number;

const PROTOCOLS: Record<
  ProtocolId,
  {
    label: string;
    sitesBySex: Record<Sex, (keyof Skinfolds)[]>;
    requiresWeight: Record<Sex, boolean>; // peso obrigatório para DC
    requiresHeight: Record<Sex, boolean>; // estatura obrigatória para DC
    density: Record<Sex, DensityFn>;
    ageRange: Record<Sex, [number, number]>;
  }
> = {
  jp3: {
    label: 'Jackson & Pollock 3 dobras',
    sitesBySex: {
      M: ['pectoral', 'abdominal', 'thigh'],
      F: ['triceps', 'suprailiac', 'thigh'],
    },
    requiresWeight: { M: false, F: false },
    requiresHeight: { M: false, F: false },
    density: {
      M: (sum, age) => 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age,
      F: (sum, age) => 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age,
    },
    ageRange: { M: [18, 61], F: [18, 61] },
  },
  jp7: {
    label: 'Jackson & Pollock 7 dobras',
    sitesBySex: {
      M: ['pectoral', 'axillary_media', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh'],
      F: ['pectoral', 'axillary_media', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh'],
    },
    requiresWeight: { M: false, F: false },
    requiresHeight: { M: false, F: false },
    density: {
      M: (sum, age) => 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age,
      F: (sum, age) => 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * age,
    },
    ageRange: { M: [18, 61], F: [18, 61] },
  },
  petroski4: {
    label: 'Petroski 4 dobras',
    sitesBySex: {
      M: ['subscapular', 'triceps', 'suprailiac', 'calf'],
      F: ['axillary_media', 'suprailiac', 'thigh', 'calf'],
    },
    requiresWeight: { M: false, F: true },
    requiresHeight: { M: false, F: true },
    density: {
      M: (sum, age) => 1.10726863 - 0.00081201 * sum + 0.00000212 * sum * sum - 0.00041761 * age,
      // Feminina (tese UFSM 1995): 1.03465850 -0.00063129*Σ4 +0.00000187*Σ4² -0.00031165*idade -0.00048890*peso +0.00051345*estatura
      F: (sum, age, weight, height) =>
        1.0346585 - 0.00063129 * sum + 0.00000187 * sum * sum - 0.00031165 * age - 0.0004889 * (weight as number) + 0.00051345 * (height as number),
    },
    ageRange: { M: [18, 66], F: [18, 51] },
  },
};

export function getProtocolSites(protocol: ProtocolId, sex: Sex): (keyof Skinfolds)[] {
  return PROTOCOLS[protocol].sitesBySex[sex];
}

// ---------------------------------------------------------------------------
// Conversão DC -> %G
// ---------------------------------------------------------------------------

function toBodyFat(density: number, conversion: Conversion): number {
  if (conversion === 'brozek') return (4.57 / density - 4.142) * 100;
  return (4.95 / density - 4.5) * 100; // siri default
}

// ---------------------------------------------------------------------------
// Normalização de estatura: mm vs cm vs m
// Só usada para Petroski F quando height vier em metros (ex: 1.75)
// Se height < 3, assume metros e converte para cm. Caso contrário, assume cm.
// Deve ser explícito: caller deve preferir passar cm; esta é tolerância validada.
// ---------------------------------------------------------------------------
function normalizeHeightCm(height: number | null): number | null {
  if (height === null || height === undefined) return null;
  if (!Number.isFinite(height) || height <= 0) return null;
  if (height < 3) return height * 100;
  return height;
}

// ---------------------------------------------------------------------------
// Motor único
// ---------------------------------------------------------------------------

export function calculateBodyComposition(
  input: BodyCompositionInput
): BodyCompositionResult | IncompatibleResult | null {
  const { protocol, sex, age, weight, height, skinfolds, conversion = 'siri' } = input;

  const proto = PROTOCOLS[protocol];
  if (!proto) return null;

  // Sexo sem fallback
  if (sex !== 'M' && sex !== 'F') {
    const fallbackSites: (keyof Skinfolds)[] = [];
    return {
      protocol,
      label: proto.label,
      sites: fallbackSites,
      sum: null,
      density: null,
      bf: null,
      fatMass: null,
      leanMass: null,
      missing: ['sex' as unknown as keyof Skinfolds],
      warnings: ['Sexo não definido — cálculo indisponível (sem fallback).'],
    } as IncompatibleResult;
  }

  const sites = proto.sitesBySex[sex];
  const warnings: string[] = [];

  // Idade obrigatória para todos os protocolos
  if (age === null || age === undefined || !Number.isFinite(age)) {
    return {
      protocol,
      label: proto.label,
      sites,
      sum: null,
      density: null,
      bf: null,
      fatMass: null,
      leanMass: null,
      missing: [],
      warnings: ['Idade não informada — cálculo indisponível.'],
    };
  }

  // Verificar faixa etária (warning, não bloqueio) — por sexo
  const range = proto.ageRange[sex];
  if (age < range[0] || age > range[1]) {
    warnings.push(`Idade ${age} fora da faixa de validação ${range[0]}-${range[1]} anos para ${proto.label}.`);
  }

  // Verificar dobras obrigatórias (null não vira zero)
  const missing: (keyof Skinfolds)[] = [];
  const values: number[] = [];
  for (const site of sites) {
    const raw = skinfolds ? (skinfolds as Record<string, unknown>)[site as string] : undefined;
    const parsed = parseFoldValue(raw);
    if (parsed === null) missing.push(site);
    else values.push(parsed);
  }

  if (missing.length > 0) {
    return {
      protocol,
      label: proto.label,
      sites,
      sum: null,
      density: null,
      bf: null,
      fatMass: null,
      leanMass: null,
      missing,
      warnings: [...warnings, `Dobras ausentes: ${missing.join(', ')}`],
    };
  }

  const sum = values.reduce((a, b) => a + b, 0);

  // Verificar peso/estatura para Petroski F
  if (proto.requiresWeight[sex]) {
    const w = weight;
    if (w === null || w === undefined || !Number.isFinite(w) || w <= 0) {
      return {
        protocol,
        label: proto.label,
        sites,
        sum,
        density: null,
        bf: null,
        fatMass: null,
        leanMass: null,
        missing: [],
        warnings: [...warnings, 'Peso obrigatório para Petroski feminino não informado.'],
      };
    }
  }

  let heightCm: number | null = null;
  if (proto.requiresHeight[sex]) {
    heightCm = normalizeHeightCm(height);
    if (heightCm === null || !Number.isFinite(heightCm) || heightCm <= 0) {
      return {
        protocol,
        label: proto.label,
        sites,
        sum,
        density: null,
        bf: null,
        fatMass: null,
        leanMass: null,
        missing: [],
        warnings: [...warnings, 'Estatura obrigatória para Petroski feminino não informada (esperado em cm).'],
      };
    }
    // Validar plausibilidade
    if (heightCm < 100 || heightCm > 250) {
      warnings.push(`Estatura ${heightCm} cm fora do intervalo plausível (100-250 cm).`);
    }
  }

  // Calcular densidade
  const densityFn = proto.density[sex];
  const density = densityFn(sum, age, weight, heightCm);

  if (!Number.isFinite(density) || density <= 0) {
    return {
      protocol,
      label: proto.label,
      sites,
      sum,
      density: null,
      bf: null,
      fatMass: null,
      leanMass: null,
      missing: [],
      warnings: [...warnings, `Densidade corporal inválida: ${density}`],
    };
  }

  // Converter para %G
  const bf = toBodyFat(density, conversion);

  // Sanidade: BF fora de (0,60) => indisponível com warning (não null silencioso)
  if (!Number.isFinite(bf) || bf <= 0 || bf >= 60) {
    return {
      protocol,
      label: proto.label,
      sites,
      sum,
      density,
      bf: null as unknown as number,
      fatMass: null,
      leanMass: null,
      missing: [],
      warnings: [...warnings, `BF% fora do intervalo de sanidade (0-60): ${bf.toFixed(2)}%`],
    };
  }

  // Massas a partir de bf não-arredondado
  let fatMass: number | null = null;
  let leanMass: number | null = null;
  if (weight !== null && weight !== undefined && Number.isFinite(weight) && weight > 0) {
    fatMass = weight * (bf / 100);
    leanMass = weight - fatMass;
  } else {
    warnings.push('Peso não informado — massa gorda/magra indisponíveis (DC/BF calculados).');
  }

  return {
    protocol,
    label: proto.label,
    sites,
    sum,
    density,
    bf,
    fatMass,
    leanMass,
    missing: [],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Compat: helpers legados (deprecated, mantidos para Fase 2)
// ---------------------------------------------------------------------------

/** @deprecated Use calculateBodyComposition({protocol, ...}) */
export function calculateSkinfoldSum(skin: Skinfolds | null | undefined): number {
  if (!skin) return 0;
  // Mantido para compat mas agora soma as 7 corretas quando usado via build antigo.
  // Não usar em código novo.
  const sites: (keyof Skinfolds)[] = ['pectoral', 'axillary_media', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh'];
  let sum = 0;
  for (const s of sites) {
    const v = parseFoldValue((skin as Record<string, unknown>)[s as string]);
    if (v !== null) sum += v;
  }
  return sum;
}

/**
 * @deprecated Use calculateBodyComposition com protocol jp7.
 * Mantido para compatibilidade temporária; sexo null agora retorna null (sem fallback).
 */
export function buildBodyComposition(params: {
  skin: Skinfolds | null | undefined;
  weight: number | null;
  birthDate: string | null | undefined;
  gender: string | null | undefined;
  measurementDate?: string | null | undefined;
  protocol?: ProtocolId;
}): BodyCompositionResult | null {
  const { skin, weight, birthDate, gender, measurementDate, protocol = 'jp7' } = params;
  const sex = normalizeSex(gender);
  const age = calculateAge(birthDate, measurementDate ?? undefined);
  const result = calculateBodyComposition({
    protocol,
    sex,
    age,
    weight,
    height: null,
    skinfolds: skin,
    conversion: 'siri',
  });
  if (!result || result.bf === null || result.density === null) return null;
  // Retornar no formato legado reduzido para compat (mas com valores não-arredondados convertidos para legado)
  return result as BodyCompositionResult;
}

// Re-export para testes e consumidores que precisam do registro
export { PROTOCOLS };
