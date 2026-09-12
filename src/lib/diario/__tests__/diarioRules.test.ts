import { describe, it, expect } from 'vitest'
import { getHydrationStatus, getMealStatus, getActivityStatus, getMoodStatus, getDayStatus, compareDiaryDays, deriveWaterGoal, classifyMealKind } from '../diarioRules'
import { getHydrationInsight, getMealInsight, getActivityInsight, getMoodInsight, getMealsSummaryInsight } from '../diarioInsights'
import fs from 'fs'

describe('diarioRules', () => {
  it('hidratação normal >=80%', () => {
    const h = getHydrationStatus(1800, 2000)
    expect(h.status).toBe('normal')
    expect(h.percent).toBe(90)
  })
  it('hidratação atencao 60%', () => {
    const h = getHydrationStatus(1200, 2000)
    expect(h.status).toBe('atencao')
  })
  it('hidratação risco <40%', () => {
    const h = getHydrationStatus(500, 2000)
    expect(h.status).toBe('risco')
  })
  it('hidratação sem meta', () => {
    const h = getHydrationStatus(1200, null)
    expect(h.status).toBe('atencao')
    expect(h.label).toContain('registrados')
  })
  it('hidratação sem registro', () => {
    const h = getHydrationStatus(null, 2000)
    expect(h.status).toBe('atencao')
    expect(h.waterMl).toBeNull()
  })
  it('refeição registrada vs não informado', () => {
    const m = getMealStatus(['Café da manhã'], ['Café da manhã', 'Almoço', 'Jantar'])
    expect(m.registeredCount).toBe(1)
    expect(m.items[0].status).toBe('normal')
    expect(m.items[1].status).toBe('atencao')
    expect(m.items[1].state).toBe('nao_informado')
  })
  it('refeição sem plano', () => {
    const m = getMealStatus(['Almoço'], null)
    expect(m.totalExpected).toBeNull()
    expect(m.overallStatus).toBe('normal')
  })
  it('atividade registrada', () => {
    const a = getActivityStatus({ id: '1', date: '2026-09-12', activity_kcal: 250, activities: [{ name: 'Caminhada' }] } as any)
    expect(a.hasActivity).toBe(true)
    expect(a.status).toBe('normal')
  })
  it('atividade ausente', () => {
    const a = getActivityStatus({ id: '1', date: '2026-09-12', activity_kcal: null, activities: [] } as any)
    expect(a.status).toBe('atencao')
  })
  it('dia sem dados', () => {
    const h = getHydrationStatus(null, 2000)
    const m = getMealStatus([], ['Almoço'])
    const a = getActivityStatus({ id: '1', date: '2026-09-12' } as any)
    const mood = getMoodStatus(null)
    const day = getDayStatus({ hydration: h, meals: m, activity: a, mood, hasLog: false })
    expect(day.overall).toBe('sem_dados')
  })
  it('dia com risco hidratação', () => {
    const h = getHydrationStatus(300, 2000)
    const m = getMealStatus(['Almoço'], ['Almoço'])
    const a = getActivityStatus({ id: '1', date: '2026-09-12', activity_kcal: 100 } as any)
    const mood = getMoodStatus('feliz')
    const day = getDayStatus({ hydration: h, meals: m, activity: a, mood, hasLog: true })
    expect(day.overall).toBe('risco')
  })
  it('NULL não vira zero', () => {
    const h = getHydrationStatus(null, 2000)
    expect(h.waterMl).toBeNull()
    expect(h.percent).toBeNull()
    const a = getActivityStatus({ id: '1', date: '2026-09-12', activity_kcal: null } as any)
    expect(a.kcal).toBeNull()
  })
  it('comparação hidratação aumentou', () => {
    const c = compareDiaryDays({ id: '1', date: '2026-09-12', water_ml: 1500 } as any, { id: '2', date: '2026-09-11', water_ml: 1000 } as any)
    expect(c.hydrationDelta.text).toContain('aumentou')
  })
  it('deriveWaterGoal', () => {
    expect(deriveWaterGoal(70, null)).toBe(2450)
    expect(deriveWaterGoal(null, 70)).toBe(2450)
    expect(deriveWaterGoal(null, null)).toBeNull()
  })
  it('insights não diagnosticam', () => {
    const ins = getHydrationInsight({ hasWater: true, percent: 60, hasGoal: true, waterMl: 1200 })
    expect(ins.description.toLowerCase()).not.toContain('desidratação')
    expect(ins.description.toLowerCase()).not.toContain('doença')
    const mealIns = getMealInsight('Almoço', 'nao_informado', 'almoco')
    expect(mealIns.description).toContain('não foi informado')
  })
  it('insight almoço não informado vs não realizado diferenciado', () => {
    const ni = getMealInsight('Almoço', 'nao_informado', 'almoco')
    const nr = getMealInsight('Almoço', 'nao_realizado', 'almoco')
    expect(ni.description).not.toEqual(nr.description)
    expect(ni.description).toContain('não foi informado')
    expect(nr.description).toContain('não realizado')
  })
  it('insight atividade ausente', () => {
    const ins = getActivityInsight(false)
    expect(ins.description).toContain('Não há atividade registrada')
  })
  it('meals summary insight completo vs incompleto', () => {
    const full = getMealsSummaryInsight(6, 6, 'normal')
    expect(full.status).toBe('normal')
    const partial = getMealsSummaryInsight(3, 6, 'atencao')
    expect(partial.status).toBe('atencao')
    expect(partial.description).toContain('3 de 6')
  })
  it('card hidratação insight no card não na lista inferior', () => {
    const meals = getMealStatus(['Café da manhã'], ['Café da manhã', 'Almoço', 'Jantar', 'Lanche', 'Jantar', 'Ceia'])
    expect(meals.items.length).toBe(6)
    expect(meals.items.every((i) => ['cafe','almoco','lanche','jantar','refeicao_generica'].includes(classifyMealKind(i.name)))).toBe(true)
  })
  it('lista inferior contém somente refeições (não hidratação/atividade/humor)', () => {
    const content = fs.readFileSync('src/components/admin/diario/DiarioDayCard.tsx', 'utf8')
    const listSection = content.split('Lista inferior')[1] || ''
    expect(listSection).not.toMatch(/label="Hidrata/)
    expect(listSection).not.toMatch(/label="Atividade"/)
    expect(content).toContain('Refeições do dia')
  })
})
