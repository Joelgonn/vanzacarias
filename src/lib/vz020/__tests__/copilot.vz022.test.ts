import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildCopilot } from '../copilot';
import { buildPreConsult } from '../preConsultation';
import { getRecoveryV2 } from '../recoveryEngine';

describe('VZ-022 REBIRTH T01-T24', () => {
  // T01 Copilot abre
  it('T01 Copilot abre', () => {
    const r = buildCopilot({ profile: { full_name: 'Teste', created_at: null, account_type: null, has_meal_plan_access: null }, lastCheckin: null, previousCheckin: null, dailyLogToday: null, checkinsCount: 0, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    expect(r.sections.length).toBe(8);
    expect(r.patientName).toBe('Teste');
  });
  // T02 Perfil continua acessível (arquivo page.tsx contém tab-perfil)
  it('T02 Perfil continua acessível', () => {
    const src = readFileSync(path.resolve(__dirname, '../../../app/admin/dashboard/page.tsx'), 'utf8');
    expect(src).toContain('id="tab-perfil"');
    expect(src).toContain("setEvalModalActiveTab('perfil')");
  });
  // T03 Avaliação continua acessível
  it('T03 Avaliação continua acessível', () => {
    const src = readFileSync(path.resolve(__dirname, '../../../app/admin/dashboard/page.tsx'), 'utf8');
    expect(src).toContain('id="tab-avaliacao"');
    expect(src).toContain('panel-avaliacao');
  });
  // T04 QFA continua acessível
  it('T04 QFA continua acessível', () => {
    const src = readFileSync(path.resolve(__dirname, '../../../app/admin/dashboard/page.tsx'), 'utf8');
    expect(src).toContain('id="tab-qfa"');
    expect(src).toContain('qfaData');
  });
  // T05 Restrições continuam acessíveis
  it('T05 Restrições continuam acessíveis', () => {
    const src = readFileSync(path.resolve(__dirname, '../../../app/admin/dashboard/page.tsx'), 'utf8');
    expect(src).toContain('foodRestrictions');
    expect(src).toContain('Alergias');
  });
  // T06 paciente selecionado correto
  it('T06 paciente selecionado correto', () => {
    const r = buildCopilot({ profile: { full_name: 'Vanusa Zacarias', created_at: null, account_type: null, has_meal_plan_access: null }, lastCheckin: null, previousCheckin: null, dailyLogToday: null, checkinsCount: 0, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    expect(r.patientName).toBe('Vanusa');
  });
  // T07 paciente A não recebe dados de B
  it('T07 paciente A não recebe dados de B', () => {
    const a = buildCopilot({ profile: { full_name: 'Alice', created_at: null, account_type: null, has_meal_plan_access: null }, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '60', altura: null, adesao_ao_plano: 2, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: { water_ml: 1000, meals_checked: null, mood: null, activity_kcal: null }, checkinsCount: 1, dailyLogsCount7d: 1, isCheckinDoneThisWeek: false });
    const b = buildCopilot({ profile: { full_name: 'Bob', created_at: null, account_type: null, has_meal_plan_access: null }, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '90', altura: null, adesao_ao_plano: 5, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: { water_ml: 2000, meals_checked: null, mood: null, activity_kcal: null }, checkinsCount: 1, dailyLogsCount7d: 1, isCheckinDoneThisWeek: true });
    expect(a.sections.find(s=>s.title==='Adesão')!.lines.join(' ')).toContain('2/5');
    expect(b.sections.find(s=>s.title==='Adesão')!.lines.join(' ')).toContain('5/5');
    expect(a.patientName).not.toBe(b.patientName);
  });
  // T08 adesão 1
  it('T08 adesão 1 → pergunta operacional', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: null, altura: null, adesao_ao_plano: 1, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: null, checkinsCount: 1, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    const pontos = r.sections.find(s=>s.title==='Pontos para conversar')!.lines.join(' ');
    expect(pontos).toContain('Como foi sua rotina alimentar');
  });
  // T09 adesão 2
  it('T09 adesão 2 → pergunta operacional', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: null, altura: null, adesao_ao_plano: 2, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: { water_ml: 500, meals_checked: null, mood: null, activity_kcal: null }, checkinsCount: 1, dailyLogsCount7d: 1, isCheckinDoneThisWeek: false });
    const pontos = r.sections.find(s=>s.title==='Pontos para conversar')!.lines.join(' ');
    expect(pontos).toContain('Como foi sua rotina alimentar');
  });
  // T10 adesão 3 sem alerta de baixa adesão
  it('T10 adesão 3 → sem pergunta de adesão baixa', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: null, altura: null, adesao_ao_plano: 3, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: { water_ml: 1500, meals_checked: ['café'], mood: null, activity_kcal: null }, checkinsCount: 1, dailyLogsCount7d: 1, isCheckinDoneThisWeek: true });
    const pontos = r.sections.find(s=>s.title==='Pontos para conversar')!.lines.join(' ');
    expect(pontos).not.toContain('Como foi sua rotina alimentar desde o último check-in?');
  });
  // T11 adesão null
  it('T11 adesão null → sem registro', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: null, peso: null, altura: null, adesao_ao_plano: null, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: null, checkinsCount: 0, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    const ad = r.sections.find(s=>s.title==='Adesão')!.lines.join(' ');
    expect(ad).toContain('sem registro');
  });
  // T12 comparação de peso
  it('T12 comparação de peso', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '68', altura: null, adesao_ao_plano: null, humor_semanal: null, comentarios: null }, previousCheckin: { created_at: '2026-08-20T10:00:00Z', peso: '70', adesao_ao_plano: null }, dailyLogToday: null, checkinsCount: 2, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    const evo = r.sections.find(s=>s.title==='Evolução')!.lines.join(' ');
    expect(evo).toContain('68');
    expect(evo).toContain('70');
    expect(evo).toContain('Diferença');
    const pre = r.sections.find(s=>s.title==='Pré-consulta')!.lines.join(' ');
    expect(pre).toContain('70 → 68');
  });
  // T13 sem comparação
  it('T13 sem comparação → mensagem canônica', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '70', altura: null, adesao_ao_plano: 3, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: null, checkinsCount: 1, dailyLogsCount7d: 0, isCheckinDoneThisWeek: true });
    const pre = r.sections.find(s=>s.title==='Pré-consulta')!.lines.join(' ');
    expect(pre).toContain('Sem registro anterior suficiente para comparação');
    const pre2 = buildPreConsult({ lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '70', cintura: null, adesao_ao_plano: 3, humor_semanal: null }, previousCheckin: null, dailyLogToday: null, isCheckinDoneThisWeek: true });
    expect(pre2.items.join(' ')).toContain('Sem registro anterior suficiente para comparação');
  });
  // T14 hidratação
  it('T14 hidratação', () => {
    const r = buildCopilot({ profile: null, lastCheckin: null, previousCheckin: null, dailyLogToday: { water_ml: 1800, meals_checked: null, mood: null, activity_kcal: null }, checkinsCount: 0, dailyLogsCount7d: 2, isCheckinDoneThisWeek: false });
    const rotina = r.sections.find(s=>s.title==='Rotina')!.lines.join(' ');
    expect(rotina).toContain('1800');
  });
  // T15 refeições
  it('T15 refeições', () => {
    const r = buildCopilot({ profile: null, lastCheckin: null, previousCheckin: null, dailyLogToday: { water_ml: null, meals_checked: ['café da manhã', 'almoço'], mood: null, activity_kcal: null }, checkinsCount: 0, dailyLogsCount7d: 1, isCheckinDoneThisWeek: false });
    const rotina = r.sections.find(s=>s.title==='Rotina')!.lines.join(' ');
    expect(rotina).toContain('café da manhã');
  });
  // T16 humor
  it('T16 humor', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: null, altura: null, adesao_ao_plano: null, humor_semanal: 4, comentarios: null }, previousCheckin: null, dailyLogToday: null, checkinsCount: 1, dailyLogsCount7d: 0, isCheckinDoneThisWeek: true });
    const humor = r.sections.find(s=>s.title==='Humor')!.lines.join(' ');
    expect(humor).toContain('4/5');
  });
  // T17 pontos para conversar
  it('T17 pontos para conversar', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: null, altura: null, adesao_ao_plano: 2, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: null, checkinsCount: 1, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    const pontos = r.sections.find(s=>s.title==='Pontos para conversar')!;
    expect(pontos.lines.length).toBeGreaterThan(0);
    expect(pontos.lines.join(' ')).toContain('?');
  });
  // T18 sem diagnóstico
  it('T18 sem diagnóstico', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '90', altura: null, adesao_ao_plano: 1, humor_semanal: 1, comentarios: 'triste' }, previousCheckin: null, dailyLogToday: null, checkinsCount: 1, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    const txt = JSON.stringify(r);
    expect(txt).not.toMatch(/desmotivado|abandonando|risco|piorou|diagnóstico/i);
    expect(txt).not.toMatch(/Paciente está/i);
  });
  // T19 sem score
  it('T19 sem score', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '70', altura: null, adesao_ao_plano: 2, humor_semanal: 3, comentarios: null }, previousCheckin: null, dailyLogToday: null, checkinsCount: 1, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    expect(JSON.stringify(r)).not.toMatch(/score/i);
    expect(JSON.stringify(getRecoveryV2({ isCheckinDoneThisWeek: false, hasDailyLogToday: false, lastCheckinAdherence: 2, hasReturnedRecently: false, totalCheckins: 1 }))).not.toMatch(/score/i);
  });
  // T20 sem risk
  it('T20 sem risk', () => {
    const r = buildCopilot({ profile: null, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '70', altura: null, adesao_ao_plano: 1, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: null, checkinsCount: 1, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    expect(JSON.stringify(r)).not.toMatch(/risk/i);
  });
  // T21 sem behaviorEngine (import funcional proibido, comentário permitido)
  it('T21 sem behaviorEngine', () => {
    const srcCopilot = readFileSync(path.resolve(__dirname, '../copilot.ts'), 'utf8');
    const srcPre = readFileSync(path.resolve(__dirname, '../preConsultation.ts'), 'utf8');
    const srcRec = readFileSync(path.resolve(__dirname, '../recoveryEngine.ts'), 'utf8');
    [srcCopilot, srcPre, srcRec].forEach(s => {
      expect(s).not.toMatch(/import.*behaviorEngine/);
      expect(s).not.toContain("from '@/lib/behaviorEngine'");
    });
  });
  // T22 Free sem conteúdo Premium (copilot não expõe premium)
  it('T22 Free sem conteúdo Premium', () => {
    const r = buildCopilot({ profile: { full_name: 'Free User', created_at: null, account_type: 'free', has_meal_plan_access: false }, lastCheckin: null, previousCheckin: null, dailyLogToday: null, checkinsCount: 0, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    expect(JSON.stringify(r)).not.toMatch(/premium.*conteúdo|conteúdo premium/i);
  });
  // T23 Copilot com dados completos
  it('T23 Copilot com dados completos', () => {
    const r = buildCopilot({ profile: { full_name: 'Completo', created_at: '2026-01-01T10:00:00Z', account_type: 'premium', has_meal_plan_access: true }, lastCheckin: { created_at: '2026-08-30T10:00:00Z', peso: '65', altura: '160', adesao_ao_plano: 4, humor_semanal: 5, comentarios: 'tudo bem' }, previousCheckin: { created_at: '2026-08-20T10:00:00Z', peso: '66', adesao_ao_plano: 3 }, dailyLogToday: { water_ml: 2000, meals_checked: ['café', 'almoço'], mood: 'bem', activity_kcal: 300 }, checkinsCount: 5, dailyLogsCount7d: 5, isCheckinDoneThisWeek: true });
    expect(r.hasData).toBe(true);
    expect(r.sections.length).toBe(8);
    expect(r.sections.map(s=>s.title)).toEqual(['Resumo','Evolução','Adesão','Rotina','Humor','Recuperação','Pré-consulta','Pontos para conversar']);
  });
  // T24 Copilot com dados parciais
  it('T24 Copilot com dados parciais', () => {
    const r = buildCopilot({ profile: { full_name: 'Parcial', created_at: null, account_type: null, has_meal_plan_access: null }, lastCheckin: { created_at: null, peso: null, altura: null, adesao_ao_plano: null, humor_semanal: null, comentarios: null }, previousCheckin: null, dailyLogToday: { water_ml: null, meals_checked: null, mood: null, activity_kcal: null }, checkinsCount: 0, dailyLogsCount7d: 0, isCheckinDoneThisWeek: false });
    expect(r.sections.length).toBe(8);
    expect(r.sections.find(s=>s.title==='Evolução')!.lines.join(' ')).toContain('sem registro');
    expect(r.sections.find(s=>s.title==='Pré-consulta')!.lines.join(' ')).toContain('Sem registro anterior suficiente');
  });
});
