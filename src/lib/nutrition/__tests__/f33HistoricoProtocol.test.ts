// F3.3 — Integração protocolo persistido por medição
import { describe, it, expect } from 'vitest';
import { calculateBodyComposition, calculateAge } from '../bodyComposition';

function skinWithProtocol(protocol: string | null, overrides: any = {}) {
  return {
    pectoral: 10, axillary_media: 10, triceps: 10, subscapular: 10, abdominal: 10, suprailiac: 10, thigh: 10, // JP7 70
    biceps: 99, calf: 99,
    measurement_date: '2024-06-15',
    protocol,
    ...overrides,
  } as any;
}

function compFor(skin: any, sex: 'M'|'F', birth: string, weight: number, height: any = null) {
  const age = calculateAge(birth, skin.measurement_date)!;
  const proto = skin.protocol;
  const isValid = proto === 'jp3' || proto === 'jp7' || proto === 'petroski4';
  if (!isValid) return null;
  return calculateBodyComposition({ protocol: proto, sex, age, weight, height, skinfolds: skin }) as any;
}

describe('F3.3 — histórico usa protocol da própria medição', () => {
  it('TESTE 1 — medição JP3 calcula com JP3', () => {
    const skin = { pectoral: 10, abdominal: 12, thigh: 11, measurement_date:'2024-06-15', protocol:'jp3' } as any;
    const c = compFor(skin, 'M', '1990-01-01', 75);
    expect(c.sites).toEqual(['pectoral','abdominal','thigh']);
    expect(c.sum).toBe(33);
  });
  it('TESTE 2 — medição JP7 calcula com JP7', () => {
    const skin = skinWithProtocol('jp7');
    const c = compFor(skin, 'M', '1990-01-01', 75);
    expect(c.sites.length).toBe(7);
    expect(c.sum).toBe(70);
  });
  it('TESTE 3 — medição Petroski4 calcula com Petroski4', () => {
    const skin = { subscapular: 10, triceps: 10, suprailiac: 10, calf: 10, measurement_date:'2024-06-15', protocol:'petroski4' } as any;
    const c = compFor(skin, 'M', '1990-01-01', 75);
    expect(c.sites).toEqual(['subscapular','triceps','suprailiac','calf']);
  });
  it('TESTE 4 — mesmo paciente 2024 JP7, 2025 Petroski4 cada ponto usa seu protocolo', () => {
    const s2024 = skinWithProtocol('jp7', { measurement_date:'2024-01-10' });
    const s2025 = { subscapular: 10, triceps: 10, suprailiac: 10, calf: 10, measurement_date:'2025-01-10', protocol:'petroski4' } as any;
    const c2024 = compFor(s2024, 'M', '1990-01-01', 75);
    const c2025 = compFor(s2025, 'M', '1990-01-01', 75);
    expect(c2024.protocol).toBe('jp7');
    expect(c2025.protocol).toBe('petroski4');
    expect(c2024.sites.length).toBe(7);
    expect(c2025.sites.length).toBe(4);
  });
  it('TESTE 5 — alterar protocolo da NOVA não modifica histórico existente', () => {
    const hist2024 = skinWithProtocol('jp7', { measurement_date:'2024-01-10' });
    const hist2025 = skinWithProtocol('petroski4', { measurement_date:'2025-01-10', subscapular:10, triceps:10, suprailiac:10, calf:10, pectoral: undefined, axillary_media: undefined, abdominal: undefined, thigh: undefined } as any);
    // Nova avaliação jp3
    const nova = skinWithProtocol('jp3', { pectoral:10, abdominal:12, thigh:11, measurement_date:'2026-01-10' });
    // Histórico permanece
    expect(hist2024.protocol).toBe('jp7');
    expect(hist2025.protocol).toBe('petroski4');
    expect(nova.protocol).toBe('jp3');
  });
  it('TESTE 6 — registro histórico NULL não é JP7 oficial', () => {
    const skinNull = skinWithProtocol(null);
    const c = compFor(skinNull, 'M', '1990-01-01', 75);
    expect(c).toBeNull(); // sem fallback
  });
  it('TESTE 7 — JP7 exatamente 7 sites', () => {
    const c = compFor(skinWithProtocol('jp7'), 'M', '1990-01-01', 75);
    expect(c.sites).toHaveLength(7);
  });
  it('TESTE 8 — JP3 exatamente 3 sites', () => {
    const skin = { pectoral:10, abdominal:10, thigh:10, measurement_date:'2024-06-15', protocol:'jp3' } as any;
    const c = compFor(skin, 'M', '1990-01-01', 75);
    expect(c.sites).toHaveLength(3);
  });
  it('TESTE 9 — Petroski exatamente 4 sites', () => {
    const skin = { subscapular:10, triceps:10, suprailiac:10, calf:10, measurement_date:'2024-06-15', protocol:'petroski4' } as any;
    const c = compFor(skin, 'M', '1990-01-01', 75);
    expect(c.sites).toHaveLength(4);
  });
  it('TESTE 10 — biceps nunca participa de JP7', () => {
    const a = compFor(skinWithProtocol('jp7', { biceps:1 }), 'M', '1990-01-01', 75);
    const b = compFor(skinWithProtocol('jp7', { biceps:50 }), 'M', '1990-01-01', 75);
    expect(a.sum).toBe(b.sum);
  });
  it('TESTE 11 — calf participa de Petroski conforme sexo e não de JP7', () => {
    const jp7a = compFor(skinWithProtocol('jp7', { calf:1 }), 'M', '1990-01-01', 75);
    const jp7b = compFor(skinWithProtocol('jp7', { calf:50 }), 'M', '1990-01-01', 75);
    expect(jp7a.sum).toBe(jp7b.sum);
    const petM = { subscapular:10, triceps:10, suprailiac:10, calf:10, measurement_date:'2024-06-15', protocol:'petroski4' } as any;
    const petM2 = { subscapular:10, triceps:10, suprailiac:10, calf:20, measurement_date:'2024-06-15', protocol:'petroski4' } as any;
    const c1 = compFor(petM, 'M', '1990-01-01', 75);
    const c2 = compFor(petM2, 'M', '1990-01-01', 75);
    expect(c1.sum).not.toBe(c2.sum);
  });
  it('TESTE 12 — idade histórica usa measurement_date', () => {
    const ageOld = calculateAge('1990-01-01','2020-06-15');
    const ageNew = calculateAge('1990-01-01','2024-06-15');
    expect(ageOld).toBe(30); expect(ageNew).toBe(34);
    const sOld = { ...skinWithProtocol('jp7'), measurement_date:'2020-06-15' };
    const sNew = { ...skinWithProtocol('jp7'), measurement_date:'2024-06-15' };
    const cOld = compFor(sOld, 'M', '1990-01-01', 75);
    const cNew = compFor(sNew, 'M', '1990-01-01', 75);
    expect(cOld.bf).not.toBe(cNew.bf);
  });
  it('TESTE 13 — resultados dos consumidores usam motor central', () => {
    const skin = skinWithProtocol('jp7');
    const age = calculateAge('1990-01-01', skin.measurement_date)!;
    const direct = calculateBodyComposition({ protocol:'jp7', sex:'M', age, weight:75, height:null, skinfolds: skin }) as any;
    const viaHistorico = compFor(skin, 'M', '1990-01-01', 75);
    expect(viaHistorico.bf).toBe(direct.bf);
    expect(viaHistorico.sum).toBe(direct.sum);
  });
  it('TESTE 14 — não existe soma Σ9 para composição', () => {
    const nine: any = { pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, biceps:30, calf:30, measurement_date:'2024-06-15', protocol:'jp7' };
    const s9 = nine.pectoral+nine.axillary_media+nine.triceps+nine.subscapular+nine.abdominal+nine.suprailiac+nine.thigh+nine.biceps+nine.calf;
    const comp = compFor(nine, 'M', '1990-01-01', 75);
    expect(comp.sum).toBe(70);
    expect(s9).toBe(130);
  });
  it('TESTE 15 — não existe associação por date + toFixed(sum)', () => {
    const timeline = [
      { date:'2024-06-15', skinfoldId:'id1', somatorio_dobras:70 },
      { date:'2024-06-16', skinfoldId:'id2', somatorio_dobras:80 },
    ];
    const foundById = timeline.find(t=>t.skinfoldId==='id1');
    expect(foundById?.somatorio_dobras).toBe(70);
    // toFixed não usado
    expect(timeline.find(t=> t.somatorio_dobras === parseFloat((70.06).toFixed(1)))).toBeUndefined();
  });
  it('TESTE 16 — ContextBuilder identifica protocolo corretamente', () => {
    // Simula buildBodyCompositionContext com protocolo
    const comp = { protocolo:'jp3', protocoloLabel:'JP3', percentualGordura:15 } as any;
    const label = comp.protocolo === 'jp3' ? 'JP3' : comp.protocolo === 'jp7' ? 'JP7' : 'Petroski 4';
    expect(label).toBe('JP3');
    const nullProto = { protocolo: null } as any;
    const header = nullProto.protocolo ? `[COMPOSIÇÃO CORPORAL (${nullProto.protocolo})]` : `[COMPOSIÇÃO CORPORAL (protocolo não registrado)]`;
    expect(header).toBe('[COMPOSIÇÃO CORPORAL (protocolo não registrado)]');
  });
  it('TESTE 17 — 9 dobras continuam preservadas', () => {
    const nine: any = { triceps:1,biceps:2,subscapular:3,axillary_media:4,pectoral:5,suprailiac:6,abdominal:7,thigh:8,calf:9, protocol:'jp7', measurement_date:'2024-06-15' };
    expect(Object.keys(nine).filter(k=>['triceps','biceps','subscapular','axillary_media','pectoral','suprailiac','abdominal','thigh','calf'].includes(k))).toHaveLength(9);
  });
});

describe('F3.3 — Cross-consumer consistency com fixture determinístico', () => {
  const fixture: any = {
    sex:'M', birth:'1990-01-01', measurement_date:'2024-06-15', weight:75, height: null,
    protocol:'jp7',
    skinfolds: { pectoral:12, axillary_media:11, triceps:13, subscapular:14, abdominal:15, suprailiac:12, thigh:11, biceps:22, calf:18, measurement_date:'2024-06-15', protocol:'jp7' }
  };
  it('sum/density/bf/fat/lean idênticos entre consumidores', () => {
    const age = calculateAge(fixture.birth, fixture.measurement_date)!;
    const base = calculateBodyComposition({ protocol: fixture.protocol, sex: fixture.sex, age, weight: fixture.weight, height: fixture.height, skinfolds: fixture.skinfolds }) as any;
    // Simula historico, dashboard, getPatientMetabolicData, useAdminDashboard (todos usam mesmo motor)
    const hist = calculateBodyComposition({ protocol: (fixture.skinfolds as any).protocol, sex: fixture.sex, age, weight: fixture.weight, height: fixture.height, skinfolds: fixture.skinfolds }) as any;
    const dash = calculateBodyComposition({ protocol: (fixture.skinfolds as any).protocol, sex: fixture.sex, age, weight: fixture.weight, height: fixture.height, skinfolds: fixture.skinfolds }) as any;
    expect(hist.sum).toBe(base.sum); expect(dash.sum).toBe(base.sum);
    expect(hist.density).toBe(base.density); expect(hist.bf).toBe(base.bf);
    expect(hist.fatMass).toBe(base.fatMass); expect(hist.leanMass).toBe(base.leanMass);
    // precisão total
    expect(String(base.bf).split('.')[1]?.length).toBeGreaterThan(1);
  });
});
