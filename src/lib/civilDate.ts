/**
 * Data civil YYYY-MM-DD — sem conversão de fuso.
 * Nunca usar new Date("2026-09-12") para formatar civil.
 */
export function formatCivilDate(date: string): string {
  if (!date || typeof date !== 'string') return '—'
  const parts = date.split('-')
  if (parts.length !== 3) return date
  const [y, m, d] = parts
  if (!y || !m || !d) return date
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}

export function formatCivilDateLong(date: string): string {
  if (!date || typeof date !== 'string') return '—'
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return formatCivilDate(date)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatCivilDateShort(date: string): string {
  if (!date || typeof date !== 'string') return '—'
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return formatCivilDate(date)
  const dt = new Date(y, m - 1, d)
  // 12 set. 2026 — mês abreviado
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
}

export function todayCivilSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function addDaysCivil(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function isSameCivil(a: string, b: string): boolean {
  return a === b
}
