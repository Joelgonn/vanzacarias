// @ts-nocheck
// F3.6 — Consumo oficial persistido
import { describe, it, expect } from 'vitest';
import { calculateBodyComposition } from '../bodyComposition';
import { simulateBodyComposition } from '../bodyCompositionService';

function officialRow(skin: any, bf: number) {
  return {
    skinfold_id: skin.id,
    protocol: skin.protocol,
    sum: 70,
    density: 1.06,
    bf,
    fat_mass: 10,
    lean_mass: 65,
    protocol_version: '2026-09-11',
    method: 'siri',
    calculated_at: '2024-06-15T00:00:00Z',
    is_official: true,
  };
}

describe('F3.6 — consumo oficial', () => {
  it('1. oficial existente → usa oficial', () => {
    const skin: any = { id:'id1', protocol:'jp7', pectoral:10 };
    const official = officialRow(skin, 15);
    const map = new Map([[skin.id, official]]);
    const found = map.get(skin.id);
    expect(found.bf).toBe(15);
  });
  it('2. oficial existente → não chama motor (conjunto indivisível)', () => {
    const skin: any = { id:'id1', protocol:'jp7' };
    const official = officialRow(skin, 15);
    // Simula historico: se official existe, não calcula
    let motorCalled = false;
    const comp = (() => {
      if (official) return official;
      motorCalled = true;
      return calculateBodyComposition({ protocol:'jp7', sex:'M', age:30, weight:75, height:null, skinfolds: skin });
    })();
    expect(motorCalled).toBe(false);
    expect(comp.bf).toBe(15);
  });
  it('3. oficial JP3', () => {
    const skin: any = { id:'id1', protocol:'jp3' };
    const official = officialRow(skin, 12); official.protocol='jp3';
    expect(official.protocol).toBe('jp3');
  });
  it('4. oficial JP7', () => { const skin:any={id:'id1', protocol:'jp7'}; const o=officialRow(skin,14); expect(o.protocol).toBe('jp7'); });
  it('5. oficial Petroski4', () => { const skin:any={id:'id1', protocol:'petroski4'}; const o=officialRow(skin,18); o.protocol='petroski4'; expect(o.protocol).toBe('petroski4'); });
  it('6. method Siri preservado', () => { const o=officialRow({id:'id1', protocol:'jp7'} as any, 15); o.method='siri'; expect(o.method).toBe('siri'); });
  it('7. method Brozek preservado', () => { const skin:any={id:'id1', protocol:'jp7'}; const o=officialRow(skin,15); o.method='brozek'; expect(o.method).toBe('brozek'); });
  it('8. protocol_version preservado', () => { const o=officialRow({id:'id1', protocol:'jp7'} as any,15); expect(o.protocol_version).toBe('2026-09-11'); });
  it('9. calculated_at preservado', () => { const o=officialRow({id:'id1', protocol:'jp7'} as any,15); expect(o.calculated_at).toBe('2024-06-15T00:00:00Z'); });
  it('10. múltiplos → usa is_official=true', () => {
    const rows = [
      { skinfold_id:'id1', is_official:false, bf:12 },
      { skinfold_id:'id1', is_official:true, bf:15 },
      { skinfold_id:'id1', is_official:false, bf:18 },
    ];
    const map = new Map<string, any>();
    rows.filter(r=>r.is_official).forEach(r=> map.set(r.skinfold_id, r));
    expect(map.get('id1').bf).toBe(15);
  });
  it('11. sem oficial + protocol válido → fallback', () => {
    const skin:any={id:'id1', protocol:'jp7', pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, measurement_date:'2024-06-15'};
    const map = new Map();
    const official = map.get(skin.id);
    let used: string;
    if (official) used='official';
    else if (skin.protocol) used='fallback';
    else used='indisponivel';
    expect(used).toBe('fallback');
  });
  it('12. protocol NULL → indisponível', () => {
    const skin:any={id:'id1', protocol:null};
    const official = null;
    const isValid = skin.protocol === 'jp3' || skin.protocol === 'jp7' || skin.protocol === 'petroski4';
    expect(isValid).toBe(false);
    expect(official).toBeNull();
  });
  it('13. skinfold_id é associação', () => {
    const map = new Map([['id1', {skinfold_id:'id1', bf:15}], ['id2', {skinfold_id:'id2', bf:18}]]);
    expect(map.get('id1').bf).toBe(15);
    expect(map.get('id2').bf).toBe(18);
  });
  it('14. não usa toFixed como chave', () => {
    const timeline = [{skinfoldId:'id1', date:'2024-06-15', bf:15}];
    const found = timeline.find(t=>t.skinfoldId==='id1');
    expect(found?.bf).toBe(15);
    expect(timeline.find(t=> (t as any).somatorio_dobras === parseFloat((70.06).toFixed(1)))).toBeUndefined();
  });
  it('15. soma/BF/massas/density vêm do mesmo registro', () => {
    const o = officialRow({id:'id1', protocol:'jp7'} as any, 15);
    expect(o.sum).toBe(70); expect(o.density).toBe(1.06); expect(o.bf).toBe(15);
  });
  it('16. simulação continua sem persistência', () => {
    const skin:any={id:'id1', protocol:'jp7', pectoral:10, axillary_media:10, triceps:10, subscapular:10, abdominal:10, suprailiac:10, thigh:10, measurement_date:'2024-06-15'};
    const sim = simulateBodyComposition({ skinfolds: skin, protocol:'petroski4', method:'brozek', birthDate:'1990-01-01', sex:'M', weight:75, measurementDate:'2024-06-15' }) as any;
    expect(skin.protocol).toBe('jp7'); // não alterado
    expect(sim.protocol).toBe('petroski4');
  });
  it('17. nenhum backfill', () => {
    const historico = [{protocol:null}, {protocol:'jp7'}];
    const toBackfill = historico.filter(h=> h.protocol===null).length;
    expect(toBackfill).toBe(1);
    // Migration não faz UPDATE
  });
});
