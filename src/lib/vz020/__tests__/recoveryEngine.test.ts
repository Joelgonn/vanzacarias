import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getRecoveryV2 } from '../recoveryEngine';

describe('VZ-020 Recovery T01-T10', () => {
  it('T01 nenhum sinal → NO_DATA', () => {
    const r = getRecoveryV2({ isCheckinDoneThisWeek: true, hasDailyLogToday: true, lastCheckinAdherence: 4, hasReturnedRecently: false, totalCheckins: 3 });
    expect(r.state).toBe('NO_DATA');
    expect(r.actions).toHaveLength(0);
  });
  it('T02 checkin pendente → checkin', () => {
    const r = getRecoveryV2({ isCheckinDoneThisWeek: false, hasDailyLogToday: true, lastCheckinAdherence: 4, hasReturnedRecently: false, totalCheckins: 1 });
    expect(r.actions[0].type).toBe('checkin');
  });
  it('T03 daily log ausente → daily_log (regra canônica existe)', () => {
    const r = getRecoveryV2({ isCheckinDoneThisWeek: true, hasDailyLogToday: false, lastCheckinAdherence: 4, hasReturnedRecently: false, totalCheckins: 2 });
    expect(r.actions.some(a => a.type === 'daily_log')).toBe(true);
  });
  it('T04 adesão baixa → adherence', () => {
    const r = getRecoveryV2({ isCheckinDoneThisWeek: true, hasDailyLogToday: true, lastCheckinAdherence: 2, hasReturnedRecently: false, totalCheckins: 2 });
    expect(r.actions[0].type).toBe('adherence');
  });
  it('T05 múltiplos sinais → ordem determinística checkin > daily_log > adherence > return', () => {
    const r = getRecoveryV2({ isCheckinDoneThisWeek: false, hasDailyLogToday: false, lastCheckinAdherence: 1, hasReturnedRecently: true, totalCheckins: 5 });
    expect(r.actions.map(a => a.type)).toEqual(['checkin', 'daily_log', 'adherence']);
  });
  it('T06 máximo 3 ações', () => {
    const r = getRecoveryV2({ isCheckinDoneThisWeek: false, hasDailyLogToday: false, lastCheckinAdherence: 1, hasReturnedRecently: true, totalCheckins: 5 });
    expect(r.actions.length).toBe(3);
  });
  it('T07 nenhum score', () => {
    const r = getRecoveryV2({ isCheckinDoneThisWeek: false, hasDailyLogToday: false, lastCheckinAdherence: 1, hasReturnedRecently: false, totalCheckins: 0 });
    expect(JSON.stringify(r)).not.toMatch(/score/i);
  });
  it('T08 nenhum riskLevel', () => {
    const r = getRecoveryV2({ isCheckinDoneThisWeek: false, hasDailyLogToday: false, lastCheckinAdherence: 1, hasReturnedRecently: false, totalCheckins: 0 });
    expect(JSON.stringify(r)).not.toMatch(/risk/i);
  });
  it('T09 nenhum behaviorEngine', () => {
    const src = readFileSync(path.resolve(__dirname, '../recoveryEngine.ts'), 'utf8');
    expect(src).not.toContain("from '@/lib/behaviorEngine'");
    expect(src).not.toContain('from "../behaviorEngine"');
    // comentário documental é permitido, mas não import funcional
    expect(src).not.toMatch(/import.*behaviorEngine/);
  });
  it('T10 dados insuficientes → NO_DATA', () => {
    const r = getRecoveryV2({ isCheckinDoneThisWeek: true, hasDailyLogToday: true, lastCheckinAdherence: null, hasReturnedRecently: false, totalCheckins: 0 });
    expect(r.state).toBe('NO_DATA');
  });
});
