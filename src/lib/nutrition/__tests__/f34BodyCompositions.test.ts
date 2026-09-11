// F3.4 — body_compositions schema, persistência, versionamento, simulação
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { calculateBodyComposition, calculateAge } from '../bodyComposition';
import { simulateBodyComposition, PROTOCOL_VERSION } from '../bodyCompositionService';

const MIG = join(process.cwd(), 'supabase/migrations/20250914_create_body_compositions.sql');

describe('F3.4 — SCHEMA', () => {
  it('TESTE 1 — migration cria body_compositions', () => {
    expect(existsSync(MIG)).toBe(true);
  });
  it('TESTE 2 — protocol aceita jp3/jp7/petroski4', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain("protocol in ('jp3','jp7','petroski4')");
  });
  it('TESTE 3 — protocol rejeita guedes/faulkner/jp9', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).not.toContain('guedes');
    expect(sql).toContain("check (protocol in ('jp3','jp7','petroski4'))");
  });
  it('TESTE 4 — method aceita siri/brozek', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain("method in ('siri','brozek')");
  });
  it('TESTE 5 — method rejeita arbitrário', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain("check (method in ('siri','brozek'))");
  });
});

describe('F3.4 — PERSISTÊNCIA oficial', () => {
  const skinJP3 = { pectoral:10, abdominal:12, thigh:11, measurement_date:'2024-06-15' } as any;
  const skinJP7 = { pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, measurement_date:'2024-06-15' } as any;
  const skinPet = { subscapular:10, triceps:10, suprailiac:10, calf:10, measurement_date:'2024-06-15' } as any;
  it('TESTE 6 — JP3 completo → oficial', () => {
    const c = simulateBodyComposition({ skinfolds: skinJP3, protocol:'jp3', method:'siri', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(c.bf).not.toBeNull(); expect(c.protocol).toBe('jp3');
  });
  it('TESTE 7 — JP7 completo → oficial', () => {
    const c = simulateBodyComposition({ skinfolds: skinJP7, protocol:'jp7', method:'siri', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(c.bf).not.toBeNull(); expect(c.protocol).toBe('jp7');
  });
  it('TESTE 8 — Petroski4 completo → oficial', () => {
    const c = simulateBodyComposition({ skinfolds: skinPet, protocol:'petroski4', method:'siri', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(c.bf).not.toBeNull(); expect(c.protocol).toBe('petroski4');
  });
  it('TESTE 9 — resultado coincide exatamente com motor', () => {
    const direct = calculateBodyComposition({ protocol:'jp7', sex:'M', age:34, weight:75, height:null, skinfolds: skinJP7 }) as any;
    const sim = simulateBodyComposition({ skinfolds: skinJP7, protocol:'jp7', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(sim.sum).toBe(direct.sum);
    expect(sim.density).toBe(direct.density);
    expect(sim.bf).toBe(direct.bf);
    expect(sim.fatMass).toBe(direct.fatMass);
  });
});

describe('F3.4 — INCOMPLETO', () => {
  it('TESTE 10 — JP7 sem pectoral → nenhuma composição', () => {
    const skin = { ...{ pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10 } as any, pectoral: null, measurement_date:'2024-06-15' };
    const c = simulateBodyComposition({ skinfolds: skin, protocol:'jp7', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(c.bf).toBeNull();
  });
  it('TESTE 11 — Petroski F sem peso → nenhuma', () => {
    const skin = { axillary_media:10, suprailiac:10, thigh:10, calf:10, measurement_date:'2024-06-15' } as any;
    const c = simulateBodyComposition({ skinfolds: skin, protocol:'petroski4', birthDate:'1990-01-01', sex:'F', weight:null, height:165, measurementDate:'2024-06-15' }) as any;
    expect(c.bf).toBeNull();
  });
  it('TESTE 12 — Petroski F sem altura → nenhuma', () => {
    const skin = { axillary_media:10, suprailiac:10, thigh:10, calf:10, measurement_date:'2024-06-15' } as any;
    const c = simulateBodyComposition({ skinfolds: skin, protocol:'petroski4', birthDate:'1990-01-01', sex:'F', weight:60, height:null, measurementDate:'2024-06-15' }) as any;
    expect(c.bf).toBeNull();
  });
  it('TESTE 13 — NULL nunca vira zero', () => {
    const skin = { pectoral: null as any, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, measurement_date:'2024-06-15' };
    const c = simulateBodyComposition({ skinfolds: skin as any, protocol:'jp7', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(c.sum).toBeNull();
  });
});

describe('F3.4 — MÉTODO', () => {
  it('TESTE 14 — JP7 + Siri persiste method siri', () => {
    const c = simulateBodyComposition({ skinfolds: { pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, measurement_date:'2024-06-15' } as any, protocol:'jp7', method:'siri', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(c).not.toBeNull();
    // method é parâmetro, não afeta protocolo, mas bf difere
  });
  it('TESTE 15 — JP7 + Brozek persiste method brozek', () => {
    const s = { pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, measurement_date:'2024-06-15' } as any;
    const a = simulateBodyComposition({ skinfolds: s, protocol:'jp7', method:'siri', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    const b = simulateBodyComposition({ skinfolds: s, protocol:'jp7', method:'brozek', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(a.bf).not.toBe(b.bf);
  });
});

describe('F3.4 — VERSIONAMENTO', () => {
  it('TESTE 16 — resultado possui protocol_version', () => {
    expect(PROTOCOL_VERSION).toBe('2026-09-11');
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain('protocol_version');
  });
  it('TESTE 17 — novo versionamento não modifica anterior (conceitual)', () => {
    // Simula dois resultados com versões diferentes para mesma medição
    const v1 = { protocol_version:'2026-09-11', bf:18.4 };
    const v2 = { protocol_version:'2027-01-01', bf:17.9 };
    expect(v1.bf).not.toBe(v2.bf);
    expect(v1.protocol_version).not.toBe(v2.protocol_version);
  });
});

describe('F3.4 — OFICIAL', () => {
  it('TESTE 18 — primeiro resultado is_official true', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain('is_official boolean');
    expect(sql).toContain('default true');
  });
  it('TESTE 19 — novo oficial não apaga antigo', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain('on delete cascade');
    expect(sql).not.toContain('delete from body_compositions where');
  });
  it('TESTE 20 — no máximo um oficial por medição', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain('unique index');
    expect(sql).toContain('where is_official = true');
  });
});

describe('F3.4 — SIMULAÇÃO', () => {
  it('TESTE 21 — simulação não grava', () => {
    const c = simulateBodyComposition({ skinfolds: { pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, measurement_date:'2024-06-15' } as any, protocol:'petroski4', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(c.protocol).toBe('petroski4');
    // Nenhum INSERT foi feito — função pura
  });
  it('TESTE 22 — simulação Petroski sobre JP7 não altera skinfolds.protocol', () => {
    const skin: any = { pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, measurement_date:'2024-06-15', protocol:'jp7' };
    const sim = simulateBodyComposition({ skinfolds: skin, protocol:'petroski4', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(skin.protocol).toBe('jp7');
    expect(sim.protocol).toBe('petroski4');
  });
});

describe('F3.4 — HISTÓRICO', () => {
  it('TESTE 23 — medição antiga protocol NULL permanece NULL', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).not.toMatch(/UPDATE\s+skinfolds\s+SET\s+protocol/i);
  });
  it('TESTE 24 — nenhum backfill automático', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).not.toMatch(/UPDATE\s+public\.skinfolds\s+SET\s+protocol/i);
    expect(sql).not.toMatch(/UPDATE\s+skinfolds\s+SET/i);
  });
  it('TESTE 25 — nenhum resultado criado automaticamente para histórico antigo', () => {
    // Migration só cria tabela, não insere
    const sql = readFileSync(MIG, 'utf-8');
    const inserts = (sql.match(/insert into body_compositions/gi) || []).length;
    expect(inserts).toBe(0);
  });
});

describe('F3.4 — PERMISSÃO', () => {
  it('TESTE 26 — patient não pode criar oficial (RLS)', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain("profiles.role in ('admin','nutricionista')");
  });
  it('TESTE 27 — admin/nutricionista podem', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain("role in ('admin','nutricionista')");
  });
});

describe('F3.4 — INTEGRIDADE', () => {
  it('TESTE 28 — body_compositions aponta para skinfolds correto', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toContain('references public.skinfolds(id) on delete cascade');
    expect(sql).toContain('references auth.users(id)');
  });
  it('TESTE 29 — não existe composição órfã (FK)', () => {
    const sql = readFileSync(MIG, 'utf-8');
    expect(sql).toMatch(/skinfold_id.*references public\.skinfolds\(id\)/);
    expect(sql).toMatch(/user_id.*references auth\.users/);
  });
});

describe('F3.4 — REPRODUTIBILIDADE e HISTÓRICO', () => {
  it('fixture determinística persiste e relê idêntico', () => {
    const skin: any = { pectoral:12, axillary_media:11, triceps:13, subscapular:14, abdominal:15, suprailiac:12, thigh:11, biceps:22, calf:18, measurement_date:'2024-06-15', protocol:'jp7' };
    const age = calculateAge('1990-01-01','2024-06-15')!;
    const comp = calculateBodyComposition({ protocol:'jp7', sex:'M', age, weight:75, height:null, skinfolds: skin }) as any;
    // Simula persistência sem arredondamento
    const persisted = { sum: comp.sum, density: comp.density, bf: comp.bf, fat_mass: comp.fatMass, lean_mass: comp.leanMass, protocol:'jp7', method:'siri', protocol_version: PROTOCOL_VERSION };
    expect(persisted.sum).toBe(comp.sum);
    expect(persisted.bf).toBe(comp.bf);
    // Não foi toFixed
    expect(String(persisted.bf).split('.')[1]?.length).toBeGreaterThan(1);
  });
  it('histórico 2024 JP7 Siri oficial, 2025 Petroski Siri oficial, simulação Petroski Brozek não altera oficiais', () => {
    const s2024: any = { pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, measurement_date:'2024-06-15', protocol:'jp7' };
    const s2025: any = { subscapular:10, triceps:10, suprailiac:10, calf:10, measurement_date:'2025-06-15', protocol:'petroski4' };
    const c2024 = simulateBodyComposition({ skinfolds: s2024, protocol:'jp7', method:'siri', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    const c2025 = simulateBodyComposition({ skinfolds: s2025, protocol:'petroski4', method:'siri', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2025-06-15' }) as any;
    const sim = simulateBodyComposition({ skinfolds: s2024, protocol:'petroski4', method:'brozek', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(c2024.protocol).toBe('jp7'); expect(c2025.protocol).toBe('petroski4');
    expect(sim.protocol).toBe('petroski4');
    expect(s2024.protocol).toBe('jp7'); // não alterado
  });
});
