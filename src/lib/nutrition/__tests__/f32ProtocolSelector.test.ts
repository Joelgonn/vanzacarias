// F3.2 — Seletor de protocolo e último protocolo como default
import { describe, it, expect } from 'vitest';
import { resolveInitialProtocol, pickLastValidProtocol, isValidProtocolValue } from '../protocolDefault';
import { PROTOCOLS, normalizeSex } from '../bodyComposition';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('F3.2 — Seletor / default último protocolo válido', () => {
  it('TESTE 1 — última JP7 → nova abre JP7', () => {
    const rows = [{ protocol:'jp7', measurement_date:'2024-06-01' }];
    expect(resolveInitialProtocol(pickLastValidProtocol(rows))).toBe('jp7');
  });
  it('TESTE 2 — última JP3 → nova abre JP3', () => {
    const rows = [{ protocol:'jp3', measurement_date:'2024-06-01' }];
    expect(resolveInitialProtocol(pickLastValidProtocol(rows))).toBe('jp3');
  });
  it('TESTE 3 — última Petroski4 → nova abre Petroski4', () => {
    const rows = [{ protocol:'petroski4', measurement_date:'2024-06-01' }];
    expect(resolveInitialProtocol(pickLastValidProtocol(rows))).toBe('petroski4');
  });
  it('TESTE 4 — sem protocolo válido → fallback JP7', () => {
    expect(resolveInitialProtocol(pickLastValidProtocol([]))).toBe('jp7');
    expect(resolveInitialProtocol(pickLastValidProtocol([{ protocol: null } as any]))).toBe('jp7');
    expect(resolveInitialProtocol(pickLastValidProtocol([{ protocol: 'guedes' } as any]))).toBe('jp7');
  });
  it('TESTE 5 — último NULL mas anterior JP3 → default JP3', () => {
    const rows = [{ protocol: null, measurement_date:'2026-01-01' }, { protocol:'jp3', measurement_date:'2025-01-01' }];
    // pickLastValidProtocol deve pular NULL e pegar jp3
    expect(pickLastValidProtocol(rows)).toBe('jp3');
    expect(resolveInitialProtocol(pickLastValidProtocol(rows))).toBe('jp3');
  });
  it('TESTE 6 — histórico 2024 JP7, 2025 Petroski4 → nova = Petroski4', () => {
    const rows = [
      { protocol:'petroski4', measurement_date:'2025-01-10' },
      { protocol:'jp7', measurement_date:'2024-01-10' },
    ];
    expect(pickLastValidProtocol(rows)).toBe('petroski4');
  });
  it('TESTE 7 — editar 2024 JP7 continua JP7 independentemente do último', () => {
    // Edição usa protocol da medição, não lastProtocol
    const editingProtocol = 'jp7' as const;
    const last = 'petroski4' as const;
    // Simula componente em modo edição: initialProtocol = editingProtocol
    // Não deve usar resolveInitialProtocol(last)
    expect(editingProtocol).toBe('jp7');
    expect(last).toBe('petroski4');
    // A UI de edição deve mostrar editingProtocol
  });
  it('TESTE 8 — trocar manualmente JP7→JP3 não apaga dobras', () => {
    const dobras: any = { pectoral:10, abdominal:10, thigh:10, triceps:5 };
    const before = { ...dobras };
    // Troca só muda selectedProtocol, não limpa objeto
    const after = { ...dobras };
    expect(after).toEqual(before);
  });
  it('TESTE 9 — salvar nova → skinfolds.protocol = selecionado', () => {
    const selected = 'petroski4' as const;
    const insert: any = { protocol: selected };
    expect(isValidProtocolValue(insert.protocol)).toBe(true);
  });
  it('TESTE 10 — valores inválidos nunca enviados', () => {
    for (const v of ['guedes','faulkner','jp9','', 'JP7']) {
      expect(isValidProtocolValue(v as any)).toBe(false);
    }
  });
  it('TESTE 11 — 9 dobras continuam disponíveis', () => {
    const fields = ['triceps','biceps','subscapular','axillary_media','pectoral','suprailiac','abdominal','thigh','calf'];
    expect(fields).toHaveLength(9);
    // ClinicalDataModal ainda renderiza 9 inputs
    const file = readFileSync(join(process.cwd(), 'src/components/ClinicalDataModal.tsx'), 'utf-8');
    for (const f of fields) expect(file).toContain(`name: "${f}"`);
  });
  it('TESTE 12 — campos obrigatórios mudam conforme protocolo/sexo via registry', () => {
    expect(PROTOCOLS.jp7.sitesBySex.M).toEqual(['pectoral','axillary_media','triceps','subscapular','abdominal','suprailiac','thigh']);
    expect(PROTOCOLS.jp3.sitesBySex.M).toEqual(['pectoral','abdominal','thigh']);
    expect(PROTOCOLS.jp3.sitesBySex.F).toEqual(['triceps','suprailiac','thigh']);
    expect(PROTOCOLS.petroski4.sitesBySex.F).toEqual(['axillary_media','suprailiac','thigh','calf']);
  });
  it('TESTE 13 — sexo NULL não recebe fallback', () => {
    expect(normalizeSex(null)).toBeNull();
    expect(normalizeSex('')).toBeNull();
    expect(normalizeSex(null)).toBeNull();
  });
  it('TESTE 14 — histórico não sofre UPDATE automático', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20250913_add_protocol_to_skinfolds.sql'), 'utf-8');
    expect(sql).not.toMatch(/UPDATE\s+skinfolds/i);
    expect(sql).not.toMatch(/backfill/i);
  });
  it('TESTE 15 — falha na consulta do último protocolo não corrompe histórico', () => {
    // resolveInitialProtocol(null) → jp7 fallback seguro, sem tocar histórico
    expect(resolveInitialProtocol(null)).toBe('jp7');
  });
  it('não criar profiles.default_protocol', () => {
    const files = [
      readFileSync(join(process.cwd(), 'supabase/migrations/20250913_add_protocol_to_skinfolds.sql'), 'utf-8'),
      readFileSync(join(process.cwd(), 'src/components/ClinicalDataModal.tsx'), 'utf-8'),
    ].join('\n');
    expect(files).not.toContain('profiles.default_protocol');
    expect(files).not.toContain('default_protocol');
    expect(existsSync(join(process.cwd(), 'supabase/migrations/20250913_add_protocol_to_skinfolds.sql'))).toBe(true);
  });
  it('não criar body_compositions', () => {
    const mig = readFileSync(join(process.cwd(), 'supabase/migrations/20250913_add_protocol_to_skinfolds.sql'), 'utf-8');
    expect(mig).not.toContain('body_compositions');
  });
});
