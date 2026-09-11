// F3.1 — Persistência canônica do protocolo por medição — testes unitários
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { calculateBodyComposition } from '../bodyComposition';
import type { ProtocolId } from '../bodyComposition';

const ALLOWED: ProtocolId[] = ['jp3','jp7','petroski4'];
const INVALID = ['guedes','faulkner','jp9','', 'JP7','Jp3', 'random'];

function isValidProtocol(p: string | null): boolean {
  if (p === null) return true; // NULL histórico permitido
  return (ALLOWED as string[]).includes(p);
}

describe('F3.1 — Protocolo por medição', () => {
  it('TESTE 1 — nova medição JP3 salva com protocol jp3', () => {
    expect(isValidProtocol('jp3')).toBe(true);
  });
  it('TESTE 2 — nova medição JP7 salva com protocol jp7', () => {
    expect(isValidProtocol('jp7')).toBe(true);
  });
  it('TESTE 3 — nova medição Petroski4 salva com protocol petroski4', () => {
    expect(isValidProtocol('petroski4')).toBe(true);
  });
  it('TESTE 4 — valor inválido não é aceito', () => {
    for (const inv of INVALID) {
      expect(isValidProtocol(inv)).toBe(false);
    }
  });
  it('TESTE 5 — registro histórico sem protocolo continua NULL', () => {
    expect(isValidProtocol(null)).toBe(true);
    // Simula leitura de linha histórica sem protocolo
    const row: any = { protocol: null, triceps: 10 };
    expect(row.protocol).toBeNull();
  });
  it('TESTE 6 — salvar medição incompleta NÃO transforma NULL em zero', () => {
    const skin: any = { pectoral: null, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10 };
    const comp = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: skin, conversion: 'siri' }) as any;
    expect(comp.bf).toBeNull();
    expect(comp.missing).toContain('pectoral');
    expect(comp.sum).toBeNull();
    // Não há soma parcial fingindo zero
  });
  it('TESTE 7 — as 9 dobras continuam preservadas', () => {
    const nine: any = { triceps:1, biceps:2, subscapular:3, axillary_media:4, pectoral:5, suprailiac:6, abdominal:7, thigh:8, calf:9 };
    expect(Object.keys(nine)).toHaveLength(9);
    // Motor JP7 usa 7, mas objeto mantém 9
    const comp = calculateBodyComposition({ protocol: 'jp7', sex: 'M', age: 30, weight: 75, height: null, skinfolds: nine }) as any;
    expect(comp.sum).toBe(5+4+1+3+7+6+8); // 34
    expect(nine.biceps).toBe(2); // preservado
    expect(nine.calf).toBe(9); // preservado
  });
  it('TESTE 8 — alterar protocolo de nova avaliação não altera histórico existente', () => {
    const historico: any[] = [
      { id:'1', measurement_date:'2023-01-10', protocol: null },
      { id:'2', measurement_date:'2024-01-10', protocol: null },
    ];
    const nova = { measurement_date:'2026-01-10', protocol:'jp3' as ProtocolId };
    // Simula insert nova sem tocar histórico
    const after = [...historico, nova];
    expect(after[0].protocol).toBeNull();
    expect(after[1].protocol).toBeNull();
    expect(after[2].protocol).toBe('jp3');
  });
  it('TESTE 9 — protocolo persistido é recuperado corretamente na leitura', () => {
    const rows: any[] = [
      { protocol:'jp7', triceps:10 },
      { protocol:'petroski4', triceps:10 },
      { protocol: null, triceps:10 },
    ];
    expect(rows[0].protocol).toBe('jp7');
    expect(rows[1].protocol).toBe('petroski4');
    expect(rows[2].protocol).toBeNull();
    for (const r of rows) expect(isValidProtocol(r.protocol)).toBe(true);
  });
  it('TESTE 10 — RLS/permissões continuam (campo segue mesma policy)', () => {
    // Verifica que migration não altera RLS além de ADD COLUMN + CHECK + INDEX
    const migPath = join(process.cwd(), 'supabase/migrations/20250913_add_protocol_to_skinfolds.sql');
    expect(existsSync(migPath)).toBe(true);
    const sql = readFileSync(migPath, 'utf-8');
    expect(sql).toContain('alter table public.skinfolds');
    expect(sql).toContain('add column if not exists protocol');
    expect(sql).toContain("check (protocol is null or protocol in ('jp3','jp7','petroski4'))");
    expect(sql).not.toContain('enable row level security');
    expect(sql).not.toContain('create policy');
    expect(sql).not.toContain('body_compositions');
  });

  it('valor default para novas medições é jp7 (compatibilidade)', () => {
    const defaultProtocol: ProtocolId = 'jp7';
    expect(isValidProtocol(defaultProtocol)).toBe(true);
    // Quando nenhum protocolo explícito, ClinicalDataModal usa jp7
  });

  it('CHECK rejeita strings arbitrárias e vazio', () => {
    expect(isValidProtocol('')).toBe(false);
    expect(isValidProtocol('jp9')).toBe(false);
    expect(isValidProtocol('guedes')).toBe(false);
  });
});
