// JG-002.3 — matching administrativo sem ambiguidade
// Extraído de admin/route.ts para permitir testes sem exportar de rota Next.js

export interface OverviewPatientForMatch {
  id: string;
  full_name?: string | null;
}

function normalizeString(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function findAdminPatient(
  patientsList: OverviewPatientForMatch[],
  normalizedMsg: string
): { patient: OverviewPatientForMatch | null; ambiguous: boolean; candidates: OverviewPatientForMatch[] } {
  if (!normalizedMsg || patientsList.length === 0) return { patient: null, ambiguous: false, candidates: [] };

  const fullMatches = patientsList.filter(p => {
    if (!p?.full_name) return false;
    const fullNorm = normalizeString(p.full_name);
    return normalizedMsg.includes(fullNorm);
  });
  if (fullMatches.length === 1) return { patient: fullMatches[0], ambiguous: false, candidates: fullMatches };
  if (fullMatches.length > 1) return { patient: null, ambiguous: true, candidates: fullMatches };

  const twoPartMatches = patientsList.filter(p => {
    if (!p?.full_name) return false;
    const parts = normalizeString(p.full_name).split(' ').filter(Boolean);
    if (parts.length < 2) return false;
    const two = `${parts[0]} ${parts[1]}`;
    return normalizedMsg.includes(two);
  });
  if (twoPartMatches.length === 1) return { patient: twoPartMatches[0], ambiguous: false, candidates: twoPartMatches };
  if (twoPartMatches.length > 1) return { patient: null, ambiguous: true, candidates: twoPartMatches };

  const firstMatches = patientsList.filter(p => {
    if (!p?.full_name) return false;
    const first = normalizeString(p.full_name).split(' ')[0];
    return first.length > 2 && normalizedMsg.includes(first);
  });
  if (firstMatches.length === 1) return { patient: firstMatches[0], ambiguous: false, candidates: firstMatches };
  if (firstMatches.length > 1) return { patient: null, ambiguous: true, candidates: firstMatches };

  return { patient: null, ambiguous: false, candidates: [] };
}
