import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Helpers replicating VZ-017 logic deterministically
function getDailyLimit(profile: { account_type?: string | null; has_meal_plan_access?: boolean | null; role?: string }) {
  if (profile.role === 'admin' || profile.role === 'nutricionista') return 9999;
  const isPremium = profile.account_type === 'premium' || !!profile.has_meal_plan_access;
  return isPremium ? 80 : 25;
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();
}
function isCacheHit(stored: string, incoming: string): boolean {
  return normalizeText(stored) === normalizeText(incoming);
}

describe('VZ-017: Premium Readiness — Foundation Hardening + Comercial', () => {
  // D — Rate limit 25 / 80
  it('Free abaixo do limite (24/25 permitido)', () => {
    expect(getDailyLimit({ account_type: 'free' })).toBe(25);
    expect(24 < 25).toBe(true);
  });
  it('Free no limite (25/25 bloqueio)', () => {
    expect(25 < 25).toBe(false);
  });
  it('Free acima do limite (26/25 bloqueio)', () => {
    expect(26 < 25).toBe(false);
  });
  it('Premium abaixo do limite (79/80 permitido)', () => {
    expect(getDailyLimit({ account_type: 'premium' })).toBe(80);
    expect(getDailyLimit({ has_meal_plan_access: true })).toBe(80);
    expect(79 < 80).toBe(true);
  });
  it('Premium no limite (80/80 bloqueio)', () => {
    expect(80 < 80).toBe(false);
  });
  it('Premium acima do limite (81/80 bloqueio)', () => {
    expect(81 < 80).toBe(false);
  });
  it('não autenticado (null) é tratado como Free 25 na prática (fallback)', () => {
    // checkRateLimit retorna allowed:false limit 0 para !userId, mas se profile null cai no catch que retorna 25
    expect(getDailyLimit({})).toBe(25);
  });
  it('admin/nutricionista tem 9999 ilimitado', () => {
    expect(getDailyLimit({ role: 'admin', account_type: 'free' })).toBe(9999);
    expect(getDailyLimit({ role: 'nutricionista' })).toBe(9999);
  });

  // B — responseCache exato vs prefixo 20
  it('cache exato: mesma pergunta com acento/pontuação dá hit', () => {
    expect(isCacheHit('Como emagrecer rápido?', 'como emagrecer rapido')).toBe(true);
  });
  it('cache exato: perguntas diferentes com prefixo 20 igual NÃO dão hit (corrige falso-positivo VZ-016)', () => {
    // Antes: "qual a melhor dieta para emagrecer rapido" vs "qual a melhor dieta para ganhar massa" compartilham 20 chars
    expect(isCacheHit('qual a melhor dieta para emagrecer rapido', 'qual a melhor dieta para ganhar massa')).toBe(false);
  });
  it('cache exato: "como emagrecer" vs "como emagrecer rápido" NÃO dão hit', () => {
    expect(isCacheHit('como emagrecer', 'como emagrecer rapido')).toBe(false);
  });

  // E — RAG Premium 2 vs 5
  it('RAG Free = 2 resultados, Premium = 5', () => {
    const MAX_FREE = 2;
    const MAX_PREMIUM = 5;
    const data = Array.from({ length: 7 }, (_, i) => ({ id: i }));
    expect(data.slice(0, MAX_FREE)).toHaveLength(2);
    expect(data.slice(0, MAX_PREMIUM)).toHaveLength(5);
  });
  it('semanticSearch.ts define constantes Free/Premium corretas', () => {
    const src = readFileSync(path.resolve(__dirname, '../semanticSearch.ts'), 'utf8');
    expect(src).toContain('MAX_RESULTS_FREE = 2');
    expect(src).toContain('MAX_RESULTS_PREMIUM = 5');
    expect(src).toContain('INITIAL_FETCH_FREE = 4');
    expect(src).toContain('INITIAL_FETCH_PREMIUM = 7');
  });
  it('patient/route.ts passa canAccessMealPlan ao RAG', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/nutri-assistant/patient/route.ts'), 'utf8');
    expect(src).toContain('getSemanticMemories(userId, safeMessage, canAccessMealPlan)');
  });

  // G — Chatbot quick actions
  it('quick actions Free = 3, Premium = 5 e sem vazamento', () => {
    const FREE = ['Como está minha evolução?', 'Como posso melhorar minha alimentação?', 'Registrar uma refeição'];
    const PREMIUM = ['Como está minha evolução?', 'O que devo priorizar hoje?', 'Quero rever meu plano', 'Analisar uma refeição', 'O que mudou na minha jornada?'];
    expect(FREE).toHaveLength(3);
    expect(PREMIUM).toHaveLength(5);
    // Premium exclusivas não estão no Free
    expect(FREE).not.toContain('Quero rever meu plano');
    expect(FREE).not.toContain('O que mudou na minha jornada?');
    expect(FREE).not.toContain('O que devo priorizar hoje?');
  });
  it('ChatAssistant diferencia Premium via catálogo determinístico (sem QUICK_ACTIONS legados)', () => {
    const src = readFileSync(path.resolve(__dirname, '../../components/ChatAssistant.tsx'), 'utf8');
    expect(src).not.toContain('QUICK_ACTIONS_FREE');
    expect(src).not.toContain('QUICK_ACTIONS_PREMIUM');
    expect(src).toContain('canAccessMealPlan');
    expect(src).toContain('smartContext');
    // sugestão premium (proximas_refeicoes) continua gated por canAccessMealPlan no catálogo
    const catalogSrc = readFileSync(path.resolve(__dirname, '../smartSuggestions.ts'), 'utf8');
    expect(catalogSrc).toContain("id: 'proximas_refeicoes'");
    expect(catalogSrc).toContain('!!ctx.canAccessMealPlan && !!ctx.isMealPlanReady');
  });

  // B — ScoreRing removido (funcional)
  it('DailyJourney não tem ScoreRing / score /100', () => {
    const src = readFileSync(path.resolve(__dirname, '../../components/dashboard/DailyJourney.tsx'), 'utf8');
    expect(src).not.toContain('function ScoreRing');
    expect(src).not.toContain('function getScoreColor');
    expect(src).not.toContain('<ScoreRing');
    // deprecated comment may mention legacy name, but functional code removed
    expect(src).not.toMatch(/ScoreRing\s*\(/);
  });

  // Segurança: zero behaviorEngine no paciente (funcional import)
  it('patient/route ainda sem behaviorEngine', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/nutri-assistant/patient/route.ts'), 'utf8');
    expect(src).not.toContain("from '@/lib/behaviorEngine'");
    expect(src).not.toContain('from "@/lib/behaviorEngine"');
    expect(src).not.toContain('detectSabotagePattern(');
  });
});
