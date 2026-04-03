// ============================================================================
// BODY COMPOSITION ENGINE (Jackson & Pollock 7 dobras)
// ============================================================================

export interface BodyCompositionResult {
  bf: number;           // percentual de gordura (%)
  fatMass: number;      // kg
  leanMass: number;     // kg
}

// ----------------------------------------------------------------------------
// CALCULAR IDADE
// ----------------------------------------------------------------------------
export function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

// ----------------------------------------------------------------------------
// SOMA DAS 7 DOBRAS
// ----------------------------------------------------------------------------
export function calculateSkinfoldSum(skin: any): number {
  if (!skin) return 0;

  return (
    parseFloat(skin.triceps || 0) +
    parseFloat(skin.biceps || 0) +
    parseFloat(skin.subscapular || 0) +
    parseFloat(skin.suprailiac || 0) +
    parseFloat(skin.abdominal || 0) +
    parseFloat(skin.thigh || 0) +
    parseFloat(skin.calf || 0)
  );
}

// ----------------------------------------------------------------------------
// JACKSON & POLLOCK
// ----------------------------------------------------------------------------
export function calculateBodyComposition(
  sum7: number,
  age: number | null,
  gender: string | null | undefined,
  weight: number | null
): BodyCompositionResult | null {

  if (!sum7 || sum7 === 0 || !weight || age === null) return null;

  const isMale =
    gender?.toLowerCase() === 'masculino' ||
    gender?.toLowerCase() === 'homem';

  let bd = 0;

  if (isMale) {
    bd =
      1.112 -
      (0.00043499 * sum7) +
      (0.00000055 * sum7 * sum7) -
      (0.00028826 * age);
  } else {
    bd =
      1.097 -
      (0.00046971 * sum7) +
      (0.00000056 * sum7 * sum7) -
      (0.00012828 * age);
  }

  if (bd === 0) return null;

  const bf = (4.95 / bd - 4.5) * 100;

  // sanity check clínico
  if (bf <= 0 || bf > 60) return null;

  const fatMass = weight * (bf / 100);
  const leanMass = weight - fatMass;

  return {
    bf: parseFloat(bf.toFixed(1)),
    fatMass: parseFloat(fatMass.toFixed(1)),
    leanMass: parseFloat(leanMass.toFixed(1)),
  };
}

// ----------------------------------------------------------------------------
// HELPER COMPLETO (USO DIRETO)
// ----------------------------------------------------------------------------
export function buildBodyComposition(params: {
  skin: any;
  weight: number | null;
  birthDate: string | null | undefined;
  gender: string | null | undefined;
}) {
  const { skin, weight, birthDate, gender } = params;

  const sum = calculateSkinfoldSum(skin);
  if (!sum) return null;

  const age = calculateAge(birthDate);
  if (!age) return null;

  return calculateBodyComposition(sum, age, gender, weight);
}