// Helper para F3.2 — último protocolo válido como default da nova avaliação
import type { ProtocolId } from './bodyComposition';

const ALLOWED: ProtocolId[] = ['jp3', 'jp7', 'petroski4'];

export function isValidProtocolValue(p: string | null | undefined): p is ProtocolId {
  return !!p && (ALLOWED as string[]).includes(p);
}

/**
 * Resolve protocolo inicial da NOVA avaliação.
 * lastValidProtocol: último protocolo válido do paciente (ou null se nenhum)
 * Retorna lastValidProtocol ?? 'jp7'
 */
export function resolveInitialProtocol(lastValidProtocol: ProtocolId | null): ProtocolId {
  if (lastValidProtocol && isValidProtocolValue(lastValidProtocol)) return lastValidProtocol;
  return 'jp7';
}

/**
 * Extrai último protocolo válido de um array de linhas skinfolds ordenadas por measurement_date DESC.
 * Ignora NULL e valores inválidos.
 */
export function pickLastValidProtocol(rows: Array<{ protocol?: string | null }>): ProtocolId | null {
  for (const r of rows) {
    if (isValidProtocolValue(r.protocol ?? null)) return r.protocol as ProtocolId;
  }
  return null;
}
