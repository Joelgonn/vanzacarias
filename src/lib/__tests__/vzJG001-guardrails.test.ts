import { describe, it, expect } from 'vitest';
import { expandRestrictions } from '@/lib/nutrition/restrictions';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';
import { PatientRequestSchema } from '@/lib/patientValidation';
import { extractFoodIdsFromText } from '@/lib/guardrailHelpers';

// JG-001.1 — limite server-side
describe('JG-001.1 — PatientRequestSchema limite 500', () => {
  it('499 aceita', () => {
    const r = PatientRequestSchema.safeParse({ userId: 'u1', message: 'a'.repeat(499) });
    expect(r.success).toBe(true);
  });
  it('500 aceita', () => {
    const r = PatientRequestSchema.safeParse({ userId: 'u1', message: 'a'.repeat(500) });
    expect(r.success).toBe(true);
  });
  it('501 rejeita', () => {
    const r = PatientRequestSchema.safeParse({ userId: 'u1', message: 'a'.repeat(501) });
    expect(r.success).toBe(false);
  });
  it('1000 rejeita', () => {
    const r = PatientRequestSchema.safeParse({ userId: 'u1', message: 'a'.repeat(1000) });
    expect(r.success).toBe(false);
  });
  it('20000 rejeita (message)', () => {
    const r = PatientRequestSchema.safeParse({ userId: 'u1', message: 'a'.repeat(20000) });
    expect(r.success).toBe(false);
  });
  it('history 20000 ainda aceita (contrato legítimo preservado)', () => {
    const r = PatientRequestSchema.safeParse({ userId: 'u1', message: 'oi', history: [{ role: 'user', content: 'a'.repeat(20000) }] });
    expect(r.success).toBe(true);
  });
  it('history 20001 rejeita', () => {
    const r = PatientRequestSchema.safeParse({ userId: 'u1', history: [{ role: 'user', content: 'a'.repeat(20001) }] });
    expect(r.success).toBe(false);
  });
});

// JG-001.2 — tag sugar
describe('JG-001.2 — tag:sugar', () => {
  it('sugar não resulta em blockedIds vazio', () => {
    const ids = expandRestrictions([{ type: 'restriction', tag: 'sugar' } as any]);
    expect(ids.size).toBeGreaterThan(0);
  });
  it('sugar contém demerara_sugar', () => {
    const ids = expandRestrictions([{ type: 'restriction', tag: 'sugar' } as any]);
    expect(ids.has('demerara_sugar')).toBe(true);
  });
  it('sugar contém coconut_sugar e honey', () => {
    const ids = expandRestrictions([{ type: 'restriction', tag: 'sugar' } as any]);
    expect(ids.has('coconut_sugar')).toBe(true);
    expect(ids.has('honey')).toBe(true);
  });
  it('FOOD_REGISTRY tem sugar tag', () => {
    const withSugar = FOOD_REGISTRY.filter(f => (f.tags as string[]).includes('sugar'));
    expect(withSugar.length).toBeGreaterThanOrEqual(3);
  });
});

// JG-001.3 — tag ultraprocessado
describe('JG-001.3 — tag:ultraprocessado comportamento seguro', () => {
  it('ultraprocessado resulta em 0 mas sem inventar cobertura', () => {
    const ids = expandRestrictions([{ type: 'restriction', tag: 'ultraprocessado' } as any]);
    expect(ids.size).toBe(0);
    // documentado como limitação: não há alimentos com tag ultraprocessado no registry
    const withUltra = FOOD_REGISTRY.filter(f => (f.tags as string[]).includes('ultraprocessado'));
    expect(withUltra.length).toBe(0);
  });
  it('lactose ainda bloqueia (controle)', () => {
    const ids = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    expect(ids.size).toBeGreaterThan(0);
  });
  it('gluten ainda bloqueia (controle)', () => {
    const ids = expandRestrictions([{ type: 'intolerance', tag: 'gluten' } as any]);
    expect(ids.size).toBeGreaterThan(0);
  });
});

// JG-001.4 — pluralização
describe('JG-001.4 — pluralização conservadora', () => {
  it('leite detectado', () => {
    expect(extractFoodIdsFromText('leite').ids.size).toBeGreaterThan(0);
  });
  it('leites detectado (plural)', () => {
    expect(extractFoodIdsFromText('leites').ids.size).toBeGreaterThan(0);
  });
  it('queijo detectado', () => {
    expect(extractFoodIdsFromText('queijo').ids.size).toBeGreaterThan(0);
  });
  it('queijos detectado', () => {
    expect(extractFoodIdsFromText('queijos').ids.size).toBeGreaterThan(0);
  });
  it('iogurte detectado', () => {
    expect(extractFoodIdsFromText('iogurte').ids.size).toBeGreaterThan(0);
  });
  it('iogurtes detectado', () => {
    expect(extractFoodIdsFromText('iogurtes').ids.size).toBeGreaterThan(0);
  });
  it('ovo detectado', () => {
    expect(extractFoodIdsFromText('ovo').ids.size).toBeGreaterThan(0);
  });
  it('ovos detectado', () => {
    expect(extractFoodIdsFromText('ovos').ids.size).toBeGreaterThan(0);
  });
  it('peixe detectado', () => {
    expect(extractFoodIdsFromText('peixe').ids.size).toBeGreaterThan(0);
  });
  it('peixes detectado', () => {
    expect(extractFoodIdsFromText('peixes').ids.size).toBeGreaterThan(0);
  });
  it('frango / frangos', () => {
    expect(extractFoodIdsFromText('frango').ids.size).toBeGreaterThan(0);
    expect(extractFoodIdsFromText('frangos').ids.size).toBeGreaterThan(0);
  });
  it('carne / carnes', () => {
    expect(extractFoodIdsFromText('carne').ids.size).toBeGreaterThan(0);
    expect(extractFoodIdsFromText('carnes').ids.size).toBeGreaterThan(0);
  });
  it('pão / pães (acentos preservados)', () => {
    expect(extractFoodIdsFromText('pão').ids.size).toBeGreaterThan(0);
    expect(extractFoodIdsFromText('pães').ids.size).toBeGreaterThan(0);
  });
  it('aliases preservados — frango e amendoim torrado', () => {
    expect(extractFoodIdsFromText('frango').ids.size).toBeGreaterThan(0);
    expect(extractFoodIdsFromText('amendoim torrado').ids.size).toBeGreaterThan(0);
  });
});

// JG-001.5 — falsos positivos controlados
describe('JG-001.5 — SAFE_PHRASES sem regressão', () => {
  it('leite vegetal permitido (não bloqueia lactose)', () => {
    const lactoseBlocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const mentioned = extractFoodIdsFromText('Você pode comer leite vegetal?').ids;
    const violations = [...mentioned].filter(id => lactoseBlocked.has(id));
    expect(violations.length).toBe(0);
  });
  it('leite de soja permitido', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const mentioned = extractFoodIdsFromText('leite de soja').ids;
    expect([...mentioned].filter(id => blocked.has(id)).length).toBe(0);
  });
  it('leite de aveia permitido', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const mentioned = extractFoodIdsFromText('leite de aveia').ids;
    expect([...mentioned].filter(id => blocked.has(id)).length).toBe(0);
  });
  it('leite de coco permitido', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const mentioned = extractFoodIdsFromText('leite de coco').ids;
    expect([...mentioned].filter(id => blocked.has(id)).length).toBe(0);
  });
  it('queijo vegano permitido (não dispara lactose)', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const mentioned = extractFoodIdsFromText('queijo vegano').ids;
    expect([...mentioned].filter(id => blocked.has(id)).length).toBe(0);
  });
  it('iogurte vegano permitido', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const mentioned = extractFoodIdsFromText('iogurte vegano').ids;
    expect([...mentioned].filter(id => blocked.has(id)).length).toBe(0);
  });
  it('queijos veganos plural também permitido', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const mentioned = extractFoodIdsFromText('queijos veganos').ids;
    expect([...mentioned].filter(id => blocked.has(id)).length).toBe(0);
  });
  it('leite (puro) ainda bloqueia lactose', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const mentioned = extractFoodIdsFromText('Você pode comer leite.').ids;
    expect([...mentioned].filter(id => blocked.has(id)).length).toBeGreaterThan(0);
  });
  it('queijo puro ainda bloqueia', () => {
    const blocked = expandRestrictions([{ type: 'allergy', tag: 'lactose' } as any]);
    const mentioned = extractFoodIdsFromText('queijo').ids;
    expect([...mentioned].filter(id => blocked.has(id)).length).toBeGreaterThan(0);
  });
});
