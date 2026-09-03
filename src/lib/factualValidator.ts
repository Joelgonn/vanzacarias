// JG-002.2 — Validação factual mínima contra alucinação numérica
// Não bloqueia números genéricos ("100 g pode fornecer aproximadamente...").
// Só bloqueia afirmações possessivas ("seu peso é X") quando dado ausente ou conflitante.

export interface FactualContext {
  pesoMaisRecente: number | null;
  alturaMetros: number | null;
  imc: number | null;
  metaPeso: number | null;
  macrosDiarios: { totalKcal: number; totalProtein: number; totalCarbs: number; totalFat: number } | null;
  // macrosPorRefeicao opcional para validação futura (kcal por refeição)
  macrosPorRefeicao?: Array<{ kcal: number; protein: number; carbs: number; fat: number }>;
  // Exames: atualmente nenhum dado estruturado é fornecido ao modelo
  hasExams: boolean; // sempre false no contexto atual
}

function parseNumber(raw: string): number | null {
  const n = Number(raw.replace(',', '.'));
  return isFinite(n) ? n : null;
}

function withinTolerance(claimed: number, actual: number, tol: number): boolean {
  return Math.abs(claimed - actual) <= tol;
}

function findPatientPossessiveClaims(text: string, fieldPattern: RegExp): Array<{ claimed: number; raw: string }> {
  // Busca sentenças com pronome possessivo + campo + número
  // Ex: "seu peso é 70 kg", "sua altura é 1.70", "seu IMC é 22.5"
  const claims: Array<{ claimed: number; raw: string }> = [];
  // Split por sentença simples
  const sentences = text.split(/[.!?\n]/);
  for (const sent of sentences) {
    const lower = sent.toLowerCase();
    // Só considera se sentença contém possessivo paciente ("seu","sua","você","vc","seu peso" etc)
    const hasPossessive = /\b(seu|sua|seus|suas|voce|você|vc)\b/.test(lower);
    if (!hasPossessive) continue;
    // Aplica pattern específico
    const m = sent.match(fieldPattern);
    if (m && m[1]) {
      const val = parseNumber(m[1]);
      if (val !== null) claims.push({ claimed: val, raw: m[0] });
    }
  }
  return claims;
}

export interface FactualViolation {
  field: string;
  reason: 'missing_data' | 'conflicting_value';
  claimed: number;
  actual: number | null;
  snippet: string;
}

export function detectFactualHallucinations(reply: string, ctx: FactualContext): FactualViolation[] {
  const violations: FactualViolation[] = [];

  // --- PESO ---
  // Padrões: "seu peso ... 70 kg" / "você pesa 70" / "peso atual ... 70"
  const pesoPattern = /(?:peso[^0-9]*|pesa[^0-9]*)([0-9]+(?:[.,][0-9]+)?)\s*kg?/i;
  for (const c of findPatientPossessiveClaims(reply, pesoPattern)) {
    if (ctx.pesoMaisRecente === null) {
      violations.push({ field: 'peso', reason: 'missing_data', claimed: c.claimed, actual: null, snippet: c.raw });
    } else if (!withinTolerance(c.claimed, ctx.pesoMaisRecente, 0.5)) {
      violations.push({ field: 'peso', reason: 'conflicting_value', claimed: c.claimed, actual: ctx.pesoMaisRecente, snippet: c.raw });
    }
  }

  // --- ALTURA ---
  const alturaPattern = /altura[^0-9]*([0-9]+(?:[.,][0-9]+)?)\s*m/i;
  for (const c of findPatientPossessiveClaims(reply, alturaPattern)) {
    if (ctx.alturaMetros === null) {
      violations.push({ field: 'altura', reason: 'missing_data', claimed: c.claimed, actual: null, snippet: c.raw });
    } else if (!withinTolerance(c.claimed, ctx.alturaMetros, 0.03)) {
      violations.push({ field: 'altura', reason: 'conflicting_value', claimed: c.claimed, actual: ctx.alturaMetros, snippet: c.raw });
    }
  }

  // --- IMC ---
  const imcPattern = /imc[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i;
  for (const c of findPatientPossessiveClaims(reply, imcPattern)) {
    if (ctx.imc === null) {
      violations.push({ field: 'imc', reason: 'missing_data', claimed: c.claimed, actual: null, snippet: c.raw });
    } else if (!withinTolerance(c.claimed, ctx.imc, 0.3)) {
      violations.push({ field: 'imc', reason: 'conflicting_value', claimed: c.claimed, actual: ctx.imc, snippet: c.raw });
    }
  }

  // --- EXAMES (colesterol, glicose, etc) — sempre ausente no contexto atual
  // Se reply afirma "seu colesterol é 180", é hallucinação
  if (!ctx.hasExams) {
    const examPattern = /(?:colesterol|glicose|triglicerides|triglicerídeos|hemoglobina|ferritina|vitamina\s*d|tsh|hdl|ldl)[^0-9]*([0-9]+(?:[.,][0-9]+)?)\s*(?:mg\/dl|mg\/dL|ng\/ml)?/i;
    for (const c of findPatientPossessiveClaims(reply, examPattern)) {
      violations.push({ field: 'exame', reason: 'missing_data', claimed: c.claimed, actual: null, snippet: c.raw });
    }
  }

  // --- MACROS DIÁRIOS (kcal, proteína, carbo, gordura) — só valida se frase é possessiva
  if (ctx.macrosDiarios) {
    // kcal: captura "2500 kcal" (número antes da unidade) — possessivo já filtrado
    const kcalPattern = /([0-9]+(?:[.,][0-9]+)?)\s*(?:kcal|calorias)/i;
    for (const c of findPatientPossessiveClaims(reply, kcalPattern)) {
      if (!withinTolerance(c.claimed, ctx.macrosDiarios.totalKcal, 5)) {
        violations.push({ field: 'kcal', reason: 'conflicting_value', claimed: c.claimed, actual: ctx.macrosDiarios.totalKcal, snippet: c.raw });
      }
    }
    // proteína: captura "30 g de proteína" ou "proteína 30 g" — suporta ambos
    for (const sent of reply.split(/[.!?\n]/)) {
      if (!/\b(seu|sua|seus|suas|voce|você|vc)\b/i.test(sent.toLowerCase())) continue;
      const m1 = sent.match(/prote[ií]na[^0-9]*([0-9]+(?:[.,][0-9]+)?)\s*g/i);
      const m2 = sent.match(/([0-9]+(?:[.,][0-9]+)?)\s*g[^0-9]*prote[ií]na/i);
      const raw = m1?.[1] || m2?.[1];
      if (raw) {
        const val = parseNumber(raw);
        if (val !== null && !withinTolerance(val, ctx.macrosDiarios.totalProtein, 1.5)) {
          violations.push({ field: 'proteina', reason: 'conflicting_value', claimed: val, actual: ctx.macrosDiarios.totalProtein, snippet: sent.trim() });
          break;
        } else if (val !== null && withinTolerance(val, ctx.macrosDiarios.totalProtein, 1.5)) {
          // ok, não adiciona
        }
      }
    }
    // carboidrato também pode aparecer como "200 g de carboidratos"
    for (const sent of reply.split(/[.!?\n]/)) {
      if (!/\b(seu|sua|seus|suas|voce|você|vc)\b/i.test(sent.toLowerCase())) continue;
      const m1 = sent.match(/carboidrato[^0-9]*([0-9]+(?:[.,][0-9]+)?)\s*g/i);
      const m2 = sent.match(/([0-9]+(?:[.,][0-9]+)?)\s*g[^0-9]*carboidrato/i);
      const raw = m1?.[1] || m2?.[1];
      if (raw) {
        const val = parseNumber(raw);
        if (val !== null && !withinTolerance(val, ctx.macrosDiarios.totalCarbs, 1.5)) {
          violations.push({ field: 'carbo', reason: 'conflicting_value', claimed: val, actual: ctx.macrosDiarios.totalCarbs, snippet: sent.trim() });
          break;
        }
      }
    }
    for (const sent of reply.split(/[.!?\n]/)) {
      if (!/\b(seu|sua|seus|suas|voce|você|vc)\b/i.test(sent.toLowerCase())) continue;
      const m1 = sent.match(/gordura[^0-9]*([0-9]+(?:[.,][0-9]+)?)\s*g/i);
      const m2 = sent.match(/([0-9]+(?:[.,][0-9]+)?)\s*g[^0-9]*gordura/i);
      const raw = m1?.[1] || m2?.[1];
      if (raw) {
        const val = parseNumber(raw);
        if (val !== null && !withinTolerance(val, ctx.macrosDiarios.totalFat, 1.5)) {
          violations.push({ field: 'gordura', reason: 'conflicting_value', claimed: val, actual: ctx.macrosDiarios.totalFat, snippet: sent.trim() });
          break;
        }
      }
    }
  } else {
    // Se não há macros (sem plano), qualquer afirmação possessiva de macros é hallucinação?
    // Conservador: não bloquear — documentar limitação (evita falso positivo quando Free sem macros)
    // Apenas bloqueia se disser "seu plano tem X kcal" e temPlano=false seria hallucinação,
    // mas macrosDiarios null já indica sem plano, mas não sabemos se é hallucinação ou genérico.
    // Optamos por não bloquear neste sprint para evitar falso positivo clínico.
  }

  return violations;
}

export function hasFactualHallucination(reply: string, ctx: FactualContext): boolean {
  return detectFactualHallucinations(reply, ctx).length > 0;
}
