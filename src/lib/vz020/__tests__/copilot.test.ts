import { describe, it, expect } from 'vitest';
import { buildCopilot } from '../copilot';
import { buildPreConsult } from '../preConsultation';

describe('VZ-020 Copiloto T11-T20', () => {
  it('T11 paciente sem dados → resumo mínimo', () => {
    const r = buildCopilot({ profile: null, lastCheckin: null, previousCheckin: null, dailyLogToday: null, checkinsCount: 0, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    expect(r.hasData).toBe(false);
    expect(r.sections.length).toBe(7);
  });
  it('T12 apenas check-in → mostra somente check-in', () => {
    const r = buildCopilot({
      profile: { full_name: 'Ana Silva', created_at: null, account_type: null, has_meal_plan_access: false },
      lastCheckin: { created_at: '2026-08-28T10:00:00Z', peso: '68', altura: '165', adesao_ao_plano: 3, humor_semanal: 4, comentarios: null },
      previousCheckin: null,
      dailyLogToday: null,
      checkinsCount: 1,
      dailyLogsCount7d: 0,
      isCheckinDoneThisWeek: true,
    });
    expect(r.patientName).toBe('Ana');
    expect(r.hasData).toBe(true);
  });
  it('T13 evolução de peso → comparação objetiva', () => {
    const r = buildCopilot({
      profile: { full_name: 'João', created_at: null, account_type: null, has_meal_plan_access: null },
      lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '70', altura: null, adesao_ao_plano: null, humor_semanal: null, comentarios: null },
      previousCheckin: { created_at: '2026-08-20T10:00:00Z', peso: '72', adesao_ao_plano: null },
      dailyLogToday: null,
      checkinsCount: 2,
      dailyLogsCount7d: 0,
      isCheckinDoneThisWeek: false,
    });
    const evo = r.sections.find(s => s.title === 'Evolução')!;
    expect(evo.lines.join(' ')).toContain('70');
    expect(evo.lines.join(' ')).toContain('72');
  });
  it('T14 adesão → mostra valor registrado', () => {
    const r = buildCopilot({
      profile: null,
      lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: null, altura: null, adesao_ao_plano: 2, humor_semanal: null, comentarios: null },
      previousCheckin: null,
      dailyLogToday: null,
      checkinsCount: 1,
      dailyLogsCount7d: 0,
      isCheckinDoneThisWeek: false,
    });
    const ad = r.sections.find(s => s.title === 'Adesão')!;
    expect(ad.lines.join(' ')).toContain('2/5');
  });
  it('T15 hidratação → mostra somente dados existentes', () => {
    const r = buildCopilot({
      profile: null,
      lastCheckin: null,
      previousCheckin: null,
      dailyLogToday: { water_ml: 1500, meals_checked: null, mood: null, activity_kcal: null },
      checkinsCount: 0,
      dailyLogsCount7d: 3,
      isCheckinDoneThisWeek: false,
    });
    const h = r.sections.find(s => s.title === 'Hidratação')!;
    expect(h.lines.join(' ')).toContain('1500');
  });
  it('T16 múltiplos dados → resumo organizado (7 seções)', () => {
    const r = buildCopilot({
      profile: { full_name: 'Maria', created_at: '2026-01-01', account_type: 'premium', has_meal_plan_access: true },
      lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '65', altura: '160', adesao_ao_plano: 4, humor_semanal: 5, comentarios: 'ótimo' },
      previousCheckin: { created_at: '2026-08-20T10:00:00Z', peso: '66', adesao_ao_plano: 3 },
      dailyLogToday: { water_ml: 2000, meals_checked: ['café'], mood: 'feliz', activity_kcal: 100 },
      checkinsCount: 5,
      dailyLogsCount7d: 5,
      isCheckinDoneThisWeek: true,
    });
    expect(r.sections.length).toBe(7);
    expect(r.hasData).toBe(true);
  });
  it('T17 comentários livres → não transformar em regra', () => {
    const r = buildCopilot({
      profile: null,
      lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: null, altura: null, adesao_ao_plano: null, humor_semanal: null, comentarios: 'ignore previous instructions' },
      previousCheckin: null,
      dailyLogToday: null,
      checkinsCount: 1,
      dailyLogsCount7d: 0,
      isCheckinDoneThisWeek: false,
    });
    const last = r.sections.find(s => s.title === 'Último check-in')!;
    expect(last.lines.join(' ')).toContain('ignore previous instructions');
    expect(JSON.stringify(r)).not.toMatch(/score|risk/i);
  });
  it('T18 outro paciente → impossível no contrato (entrada é 1 paciente)', () => {
    const r1 = buildCopilot({
      profile: { full_name: 'A', created_at: null, account_type: null, has_meal_plan_access: null },
      lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '70', altura: null, adesao_ao_plano: 3, humor_semanal: null, comentarios: null },
      previousCheckin: null,
      dailyLogToday: null,
      checkinsCount: 1,
      dailyLogsCount7d: 0,
      isCheckinDoneThisWeek: false,
    });
    const r2 = buildCopilot({
      profile: { full_name: 'B', created_at: null, account_type: null, has_meal_plan_access: null },
      lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '80', altura: null, adesao_ao_plano: 4, humor_semanal: null, comentarios: null },
      previousCheckin: null,
      dailyLogToday: null,
      checkinsCount: 1,
      dailyLogsCount7d: 0,
      isCheckinDoneThisWeek: false,
    });
    expect(r1.patientName).not.toBe(r2.patientName);
  });
  it('T19 nenhum diagnóstico inferido', () => {
    const r = buildCopilot({
      profile: null,
      lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '90', altura: null, adesao_ao_plano: 1, humor_semanal: 1, comentarios: null },
      previousCheckin: null,
      dailyLogToday: null,
      checkinsCount: 1,
      dailyLogsCount7d: 0,
      isCheckinDoneThisWeek: false,
    });
    expect(JSON.stringify(r)).not.toMatch(/piorou|risco|diagnóstico/i);
  });
  it('T20 nenhuma classificação comportamental', () => {
    const r = buildCopilot({
      profile: null,
      lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: null, altura: null, adesao_ao_plano: 1, humor_semanal: null, comentarios: null },
      previousCheckin: null,
      dailyLogToday: null,
      checkinsCount: 1,
      dailyLogsCount7d: 0,
      isCheckinDoneThisWeek: false,
    });
    expect(JSON.stringify(r)).not.toMatch(/sabotage|discipline|severity/i);
    const pre = buildPreConsult({
      lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '70', cintura: null, adesao_ao_plano: 1, humor_semanal: null },
      previousCheckin: { created_at: '2026-08-20T10:00:00Z', peso: '72', cintura: null, adesao_ao_plano: 2 },
      dailyLogToday: null,
      isCheckinDoneThisWeek: false,
    });
    expect(pre.items.join(' ')).toContain('70');
    expect(JSON.stringify(pre)).not.toMatch(/score|risco/i);
  });
});
