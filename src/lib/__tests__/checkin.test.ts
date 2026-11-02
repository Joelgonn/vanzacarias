import { describe, it, expect } from 'vitest';
import { getCheckinNavState, isCheckinDoneThisWeek } from '@/lib/checkin';

describe('isCheckinDoneThisWeek', () => {
  it('nenhum check-in -> false', () => {
    expect(isCheckinDoneThisWeek([])).toBe(false);
  });

  it('dentro da janela (7 dias) -> true', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    expect(isCheckinDoneThisWeek([{ created_at: '2026-01-09T12:00:00Z' }], now)).toBe(true);
  });

  it('fora da janela (>7 dias) -> false', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    expect(isCheckinDoneThisWeek([{ created_at: '2026-01-01T11:00:00Z' }], now)).toBe(false);
  });

  it('limite exato 7 dias -> true', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    // diff = 7 dias exatos
    expect(isCheckinDoneThisWeek([{ created_at: '2026-01-03T12:00:00Z' }], now)).toBe(true);
  });

  it('usa o último check-in da lista', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    const list = [
      { created_at: '2025-12-01T12:00:00Z' },
      { created_at: '2026-01-09T12:00:00Z' },
    ];
    expect(isCheckinDoneThisWeek(list, now)).toBe(true);
  });
});

describe('getCheckinNavState', () => {
  it('consulta ainda pendente -> loading, sem conclusão ou pendência', () => {
    expect(
      getCheckinNavState({ isDone: true, doneChecked: false, unavailable: false })
    ).toBe('loading');
    expect(
      getCheckinNavState({ isDone: false, doneChecked: false, unavailable: false })
    ).toBe('loading');
  });

  it('consulta concluída e check-in feito -> done', () => {
    expect(
      getCheckinNavState({ isDone: true, doneChecked: true, unavailable: false })
    ).toBe('done');
  });

  it('consulta concluída e sem check-in -> pending', () => {
    expect(
      getCheckinNavState({ isDone: false, doneChecked: true, unavailable: false })
    ).toBe('pending');
  });

  it('falha na consulta -> unavailable, mesmo com isDone residual', () => {
    expect(
      getCheckinNavState({ isDone: true, doneChecked: true, unavailable: true })
    ).toBe('unavailable');
    expect(
      getCheckinNavState({ isDone: false, doneChecked: true, unavailable: true })
    ).toBe('unavailable');
  });
});
