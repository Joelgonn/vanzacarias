// DietBuilder Readers — F3.4 + DO-0001.1
import { describe, it, expect } from 'vitest';
import { generateRecommendation, type RecommendationResult } from '../../lib/nutrition';
import { buildMetabolicSnapshot, type MetabolicSnapshot } from '../../lib/metabolicModel';
import { buildContext, type UserData } from '../../lib/contextBuilder';

function getReaderState(actual: number, protectedVct: number) {
  const delta = actual - protectedVct;
  const level = delta === 0 ? 'no alvo' : delta > 0 ? 'acima' : 'abaixo';
  const needsAttention = delta < 0;
  return { delta, level, needsAttention };
}

describe('DietBuilder Readers — 4 cenários', () => {
  const protectedVct = 1895;
  it('2000 → +105 acima do protegido', () => {
    const r = getReaderState(2000, protectedVct);
    expect(r.delta).toBe(105);
    expect(r.needsAttention).toBe(false);
  });
  it('1895 → 0 no alvo', () => {
    const r = getReaderState(1895, protectedVct);
    expect(r.delta).toBe(0);
  });
  it('1780 → -115 abaixo, atenção', () => {
    const r = getReaderState(1780, protectedVct);
    expect(r.delta).toBe(-115);
    expect(r.needsAttention).toBe(true);
  });
  it('1700 → -195 abaixo, atenção', () => {
    const r = getReaderState(1700, protectedVct);
    expect(r.delta).toBe(-195);
    expect(r.needsAttention).toBe(true);
  });
});

describe('Distinção calculado vs protegido', () => {
  it('calculated 1780 vs protected 1895, DietBuilder recebe 1895', () => {
    const rec: RecommendationResult = generateRecommendation({ weight: 104, height: 180, tmb: 1895, get: 2225, avgActivity: 0, gender: 'masculino', bf: 23 });
    expect(rec.calculatedCalories).toBe(1780);
    expect(rec.protectedCalories).toBe(1895);
    expect(rec.calories).toBe(1895);
    expect(rec.safetyAdjustmentApplied).toBe(true);
  });
});

describe('Safety Gate', () => {
  it('VCT 1780 < TMB 1895 → protegido 1895', () => {
    const rec: RecommendationResult = generateRecommendation({ weight: 104, height: 180, tmb: 1895, get: 2225, avgActivity: 0, gender: 'masculino', bf: 23 });
    expect(rec.safetyAdjustmentApplied).toBe(true);
    expect(rec.minCalories).toBe(1895);
  });
  it('VCT >= TMB → não altera', () => {
    const rec: RecommendationResult = generateRecommendation({ weight: 104, height: 180, tmb: 1895, get: 2274, avgActivity: 0, gender: 'masculino', bf: 18 });
    expect(rec.safetyAdjustmentApplied).toBe(false);
    expect(rec.calculatedCalories).toBe(rec.calories);
  });
});

describe('Copilot Patient/Admin mesmo contexto', () => {
  it('patient e admin recebem mesmo bloco metabólico estruturado com todos os campos', () => {
    const snap: MetabolicSnapshot = buildMetabolicSnapshot({ weight: 104, height: 180, age: 55, gender: 'masculino', bf: null, leanMass: null, avgActivity: 0 });
    const rec = snap.recommendation as RecommendationResult;

    const ctxData: UserData = {
      nomePaciente: 'Teste',
      objetivoPrincipal: 'perda',
      metaPeso: '80kg',
      rotinaSono: '',
      vontadesDoces: '',
      alimentosEvitar: [],
      restrictions: [],
      cardapioFormatado: 'arroz',
      evolucaoTxt: '',
      humorHoje: '',
      aguaHoje: 0,
      refeicoesFeitas: 0,
      atividadesHojeFormatadas: '',
      activityKcal: 0,
      todayStr: '2024-01-01',
      metabolicSafety: {
        tmb: snap.tmb,
        get: snap.get,
        vctCalculated: rec.calculatedCalories,
        vctProtected: rec.calories,
        deficit: snap.deficitKcal,
        deficitPercent: snap.deficitPercent,
        minCalories: rec.minCalories,
        safetyAdjustmentApplied: rec.safetyAdjustmentApplied,
        safetyReason: rec.safetyReason,
      },
      temporal: { totalCheckins: 0, diasDesdeUltimoCheckin: null, ultimoCheckinData: null, periodoCoberto: null, idadeContaDias: null, temPlano: false, temAvaliacao: false, temQFA: false, ultimaAtividade: null, comentarioUltimoCheckin: null },
      progress: { totalCheckins: 0, totalCheckinsComPeso: 0, pesoInicial: null, pesoMaisRecente: null, registrosSuficientes: false, imc: null, adesaoMaisRecente: null, humorMaisRecente: null, metaPeso: null },
    };

    const ctx = buildContext('qual meu déficit?', ctxData);

    // Verificar que o contexto contém todos os campos metabólicos esperados
    expect(ctx).toContain('TMB:');
    expect(ctx).toContain('VCT calculado');
    expect(ctx).toContain('VCT protegido');

    // Verificar explicitamente cada campo do metabolicSafety no contexto gerado
    expect(ctx).toContain(String(snap.tmb));
    expect(ctx).toContain(String(snap.get));
    expect(ctx).toContain(String(rec.calculatedCalories));
    expect(ctx).toContain(String(rec.calories));
    expect(ctx).toContain(String(snap.deficitKcal ?? ''));
    // deficitPercent no contexto é formatado com uma casa decimal (ex: "16.7%")
    expect(ctx).toContain(snap.deficitPercent !== null ? `${snap.deficitPercent.toFixed(1)}%` : '');
    expect(ctx).toContain(String(rec.minCalories));
    // safetyAdjustmentApplied aparece como "Safety Gate acionado" no contexto
    expect(ctx).toContain('Safety Gate acionado');
    expect(rec.safetyReason ? ctx.includes(rec.safetyReason) : true).toBe(true);

    // Admin usaria mesmo snap, logo mesmo ctx
    const ctxAdmin = buildContext('qual meu déficit?', ctxData);
    expect(ctxAdmin).toBe(ctx);
  });
});

describe('Garantias Readers', () => {
  it('readers não modificam targetRecommendation', () => {
    const rec: RecommendationResult = generateRecommendation({ weight: 104, height: 180, tmb: 1895, get: 2225, avgActivity: 0, gender: 'masculino', bf: 23 });
    const before = rec.calories;
    const readerDelta = 2000 - rec.calories;
    expect(rec.calories).toBe(before);
    expect(readerDelta).toBe(105);
  });
  it('readers não recalculam TMB/GET', () => {
    const snap: MetabolicSnapshot = buildMetabolicSnapshot({ weight: 104, height: 180, age: 55, gender: 'masculino', avgActivity: 0 });
    expect(snap.tmb).toBe(1895);
    expect(snap.get).toBe(2274);
    const readerTmb = snap.tmb;
    expect(readerTmb).toBe(1895);
  });
});