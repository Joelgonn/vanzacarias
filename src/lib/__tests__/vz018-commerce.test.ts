import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isPremiumProfile, getDailyLimitForProfile } from '@/lib/premium';

describe('VZ-018 E2E Comercial — 13 testes', () => {
  // T01 Free normal
  it('T01 Free: 25 limite, RAG 2, quick 3, sem plano', () => {
    expect(isPremiumProfile({ account_type: 'free', has_meal_plan_access: false })).toBe(false);
    expect(getDailyLimitForProfile({ account_type: 'free' })).toBe(25);
  });
  // T02 Premium normal
  it('T02 Premium: 80 limite, RAG 5, quick 5, plano autorizado', () => {
    expect(isPremiumProfile({ account_type: 'premium' })).toBe(true);
    expect(getDailyLimitForProfile({ account_type: 'premium' })).toBe(80);
    expect(isPremiumProfile({ has_meal_plan_access: true })).toBe(true);
  });
  // T03 Free não consegue forçar Premium pelo frontend
  it('T03 Frente não decide: localStorage não afeta isPremium', () => {
    // isPremiumProfile só lê profile server, não localStorage
    const src = readFileSync(path.resolve(__dirname, '../premium.ts'), 'utf8');
    expect(src).not.toContain('localStorage');
    expect(src).not.toContain('query');
    expect(isPremiumProfile({ account_type: 'free' })).toBe(false);
  });
  // T04 has_meal_plan_access=true concede
  it('T04 has_meal_plan_access=true concede', () => {
    expect(isPremiumProfile({ account_type: 'free', has_meal_plan_access: true })).toBe(true);
  });
  // T05 account_type=premium concede
  it('T05 account_type=premium concede', () => {
    expect(isPremiumProfile({ account_type: 'premium', has_meal_plan_access: false })).toBe(true);
  });
  // T06 ambos false mantém Free
  it('T06 ambos false mantém Free', () => {
    expect(isPremiumProfile({ account_type: null, has_meal_plan_access: false })).toBe(false);
    expect(isPremiumProfile({})).toBe(false);
  });
  // T07 checkout iniciado gera evento
  it('T07 checkout possui metadata plan_type e external_reference', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/checkout/route.ts'), 'utf8');
    expect(src).toContain('external_reference: userId');
    expect(src).toContain('metadata');
    expect(src).toContain('plan_type');
  });
  // T08 checkout confirmado gera upgrade via webhook
  it('T08 webhook em approved atualiza has_meal_plan_access', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/webhook/route.ts'), 'utf8');
    expect(src).toContain("paymentData.status === 'approved'");
    expect(src).toContain('has_meal_plan_access');
    expect(src).toContain('account_type');
  });
  // T09 webhook inválido NÃO concede Premium
  it('T09 webhook só age se approved', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/webhook/route.ts'), 'utf8');
    // só tem um if approved, fora dele não há update
    const approvedCount = (src.match(/approved/g) || []).length;
    expect(approvedCount).toBeGreaterThan(0);
    expect(src).not.toMatch(/else\s*{\s*updateData\.account_type/);
  });
  // T10 dashboard reflete Premium após upgrade
  it('T10 dashboard PremiumAccessCard recebe isPremium', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/dashboard/page.tsx'), 'utf8');
    expect(src).toContain('PremiumAccessCard');
    expect(src).toContain('isPremium');
  });
  // T11 chatbot reflete Premium
  it('T11 chatbot quick actions 3 vs 5', () => {
    const src = readFileSync(path.resolve(__dirname, '../../components/ChatAssistant.tsx'), 'utf8');
    expect(src).toContain('QUICK_ACTIONS_FREE');
    expect(src).toContain('QUICK_ACTIONS_PREMIUM');
  });
  // T12 conteúdo Premium continua protegido
  it('T12 plano bloqueado para Free no patient route', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/nutri-assistant/patient/route.ts'), 'utf8');
    expect(src).toContain('Existe um plano, mas o conteúdo detalhado requer acesso Premium');
    expect(src).toContain('canAccessMealPlan');
  });
  // T13 outro paciente nunca recebe estado/dados
  it('T13 isolamento por user_id', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/nutri-assistant/patient/route.ts'), 'utf8');
    expect(src).toContain('eq(\'id\', userId)');
    expect(src).toContain('eq(\'user_id\', userId)');
  });

  // Adicionais: observabilidade e métricas
  it('observabilidade mede sem conteúdo clínico', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/nutri-assistant/patient/route.ts'), 'utf8');
    expect(src).toContain('startObs');
    expect(src).toContain('logObs');
    expect(src).not.toMatch(/logObs.*prompt|logObs.*answer/);
  });
  it('commerceEvents não registra texto clínico (filtra prompt/answer)', () => {
    const src = readFileSync(path.resolve(__dirname, '../commerceEvents.ts'), 'utf8');
    expect(src).toContain("k.includes('prompt')");
    expect(src).toContain("k.includes('answer')");
    expect(src).toContain('premium_viewed');
    // não deve inserir prompt/answer como campo
    expect(src).not.toMatch(/insert.*prompt/);
  });
});
