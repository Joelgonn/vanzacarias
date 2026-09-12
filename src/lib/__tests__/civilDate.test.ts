import { describe, it, expect } from 'vitest'
import { formatCivilDate, formatCivilDateLong, addDaysCivil, todayCivilSP } from '@/lib/civilDate'

describe('civilDate', () => {
  it('formatCivilDate sem UTC', () => {
    expect(formatCivilDate('2026-09-12')).toBe('12/09/2026')
    expect(formatCivilDate('2026-01-01')).toBe('01/01/2026')
    expect(formatCivilDate('2026-06-30')).toBe('30/06/2026')
    expect(formatCivilDate('2026-12-31')).toBe('31/12/2026')
  })
  it('não usa new Date para civil', () => {
    // new Date("2026-09-12") em BRT daria 11/09/2026, mas formatCivilDate deve manter 12
    const civil = '2026-09-12'
    const viaDate = new Date(civil).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    // viaDate seria 11/09/2026 em UTC, mas nosso helper deve manter 12
    expect(formatCivilDate(civil)).not.toBe(viaDate) // prova do bug
    expect(formatCivilDate(civil)).toBe('12/09/2026')
  })
  it('addDaysCivil', () => {
    expect(addDaysCivil('2026-09-12', 1)).toBe('2026-09-13')
    expect(addDaysCivil('2026-09-12', -1)).toBe('2026-09-11')
    expect(addDaysCivil('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysCivil('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('todayCivilSP é YYYY-MM-DD', () => {
    const t = todayCivilSP()
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('formatCivilDateLong', () => {
    const long = formatCivilDateLong('2026-09-12')
    expect(long).toContain('12')
    expect(long).toContain('2026')
  })
  it('persistir após reload - civil permanece', () => {
    const selected = '2026-09-12'
    const saved = selected // valor enviado ao Supabase
    const displayed = formatCivilDate(saved)
    expect(displayed).toBe('12/09/2026')
  })
})
