'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Save, Loader2, Activity, Ruler, Layers, Syringe, Calendar, ChevronRight, ChevronLeft, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { ProtocolId } from '@/lib/nutrition/bodyComposition';
import { PROTOCOLS, normalizeSex } from '@/lib/nutrition/bodyComposition';
import { pickLastValidProtocol, resolveInitialProtocol } from '@/lib/nutrition/protocolDefault';
import { AnthropometryTooltip } from '@/components/admin/historico/AnthropometryTooltip';

interface ClinicalDataModalSteppedProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  protocol?: ProtocolId | null;
  patientSex?: string | null;
  mode?: 'anthropometry' | 'skinfolds' | 'biochemicals' | 'full';
}

const getLocalDateString = () => new Date().toLocaleDateString('en-CA');
const parseNumber = (value: string) => parseFloat(value.replace(',', '.'));

const ANTHRO_FIELDS: { label: string; name: string; unit: string }[] = [
  { label: 'Peso', name: 'weight', unit: 'kg' },
  { label: 'Altura', name: 'height', unit: 'm' },
  { label: 'Cintura', name: 'waist', unit: 'cm' },
  { label: 'Abdominal', name: 'abdominal', unit: 'cm' },
  { label: 'Quadril', name: 'hip', unit: 'cm' },
  { label: 'Braço', name: 'arm', unit: 'cm' },
  { label: 'Antebraço', name: 'forearm', unit: 'cm' },
  { label: 'Coxa', name: 'thigh', unit: 'cm' },
  { label: 'Panturrilha', name: 'calf', unit: 'cm' },
  { label: 'Pescoço', name: 'neck', unit: 'cm' },
  { label: 'Tórax', name: 'chest', unit: 'cm' },
];

const SKINFOLD_FIELDS: { label: string; name: string }[] = [
  { label: 'Tricipital', name: 'triceps' },
  { label: 'Bicipital', name: 'biceps' },
  { label: 'Subescapular', name: 'subscapular' },
  { label: 'Axilar Média', name: 'axillary_media' },
  { label: 'Peitoral', name: 'pectoral' },
  { label: 'Suprailíaca', name: 'suprailiac' },
  { label: 'Abdominal', name: 'abdominal' },
  { label: 'Coxa', name: 'thigh' },
  { label: 'Panturrilha', name: 'calf' },
];

const BIO_GROUPS: { title: string; fields: { label: string; name: string }[] }[] = [
  { title: 'Glicêmico & Insulina', fields: [{ label: 'Glicose', name: 'glucose' }, { label: 'Insulina', name: 'insulin' }, { label: 'HbA1c (%)', name: 'hba1c' }] },
  { title: 'Perfil Lipídico', fields: [{ label: 'Colest. Total', name: 'total_cholesterol' }, { label: 'HDL', name: 'hdl' }, { label: 'LDL', name: 'ldl' }, { label: 'Triglicerídeos', name: 'triglycerides' }] },
  { title: 'Inflamação & Órgãos', fields: [{ label: 'Ferritina', name: 'ferritin' }, { label: 'PCR', name: 'pcr' }, { label: 'TGP', name: 'tgp' }, { label: 'Creatinina', name: 'creatinine' }, { label: 'Ureia', name: 'urea' }] },
  { title: 'Vitaminas & Hormonal', fields: [{ label: 'Vitamina D', name: 'vitamin_d' }, { label: 'Vitamina B12', name: 'vitamin_b12' }, { label: 'TSH', name: 'tsh' }, { label: 'Ferro', name: 'iron' }] },
];

// Ordem obrigatória Exames 1-16 para coleta progressiva
const BIO_EXAMS: { label: string; name: string; unit: string; group: string }[] = [
  { label: 'Glicose', name: 'glucose', unit: 'mg/dL', group: 'Glicêmico' },
  { label: 'Insulina', name: 'insulin', unit: 'µUI/mL', group: 'Glicêmico' },
  { label: 'HbA1c', name: 'hba1c', unit: '%', group: 'Glicêmico' },
  { label: 'Colesterol total', name: 'total_cholesterol', unit: 'mg/dL', group: 'Lipídico' },
  { label: 'HDL', name: 'hdl', unit: 'mg/dL', group: 'Lipídico' },
  { label: 'LDL', name: 'ldl', unit: 'mg/dL', group: 'Lipídico' },
  { label: 'Triglicerídeos', name: 'triglycerides', unit: 'mg/dL', group: 'Lipídico' },
  { label: 'Ferritina', name: 'ferritin', unit: 'ng/mL', group: 'Inflamação e órgãos' },
  { label: 'PCR', name: 'pcr', unit: 'mg/dL', group: 'Inflamação e órgãos' },
  { label: 'TGP', name: 'tgp', unit: 'U/L', group: 'Inflamação e órgãos' },
  { label: 'Creatinina', name: 'creatinine', unit: 'mg/dL', group: 'Inflamação e órgãos' },
  { label: 'Ureia', name: 'urea', unit: 'mg/dL', group: 'Inflamação e órgãos' },
  { label: 'Vitamina D', name: 'vitamin_d', unit: 'ng/mL', group: 'Vitaminas e hormonal' },
  { label: 'Vitamina B12', name: 'vitamin_b12', unit: 'pg/mL', group: 'Vitaminas e hormonal' },
  { label: 'TSH', name: 'tsh', unit: 'µUI/mL', group: 'Vitaminas e hormonal' },
  { label: 'Ferro', name: 'iron', unit: 'µg/dL', group: 'Vitaminas e hormonal' },
];

const FOLD_PT: Record<string, string> = {
  triceps: 'Tricipital',
  biceps: 'Bicipital',
  subscapular: 'Subescapular',
  axillary_media: 'Axilar média',
  pectoral: 'Peitoral',
  suprailiac: 'Supra-ilíaca',
  abdominal: 'Abdominal',
  thigh: 'Coxa',
  calf: 'Panturrilha',
};
const foldLabelPt = (code: string) => FOLD_PT[code] || code;

type Step =
  | { type: 'anthro'; field: typeof ANTHRO_FIELDS[number] }
  | { type: 'skinfold'; field: typeof SKINFOLD_FIELDS[number] }
  | { type: 'bio'; title?: string; exam?: typeof BIO_EXAMS[number] };

export default function ClinicalDataModalStepped({ isOpen, onClose, patientId, patientName, protocol: initialProtocol, patientSex, mode = 'full' }: ClinicalDataModalSteppedProps) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(getLocalDateString());
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolId>('jp7');
  const [loadingProtocol, setLoadingProtocol] = useState(false);
  const [resolvedSex, setResolvedSex] = useState<string | null>(patientSex ?? null);
  const supabase = createClient();

  // 3 aferições por medida — temporário
  const [anthroEntries, setAnthroEntries] = useState<Record<string, [string, string, string]>>({});
  const [skinfoldEntries, setSkinfoldEntries] = useState<Record<string, [string, string, string]>>({});
  const [bioEntries, setBioEntries] = useState<Record<string, string>>({});

  const [currentStep, setCurrentStep] = useState(0);
  const [showReview, setShowReview] = useState(false);

  const sexNorm = normalizeSex(resolvedSex);
  const showProtocolSelector = mode === 'skinfolds' || mode === 'full';

  const steps: Step[] = (() => {
    if (mode === 'anthropometry') return ANTHRO_FIELDS.map(f => ({ type: 'anthro' as const, field: f }));
    if (mode === 'skinfolds') {
      // Progresso deve respeitar protocolo real (JP3=3, JP7=7, Petroski=4), não 9
      const proto = PROTOCOLS[selectedProtocol];
      if (proto) {
        let sites: string[] | null = null;
        if (sexNorm) sites = proto.sitesBySex[sexNorm] as string[];
        else if (selectedProtocol === 'jp7') sites = proto.sitesBySex['M'] as string[];
        if (sites) {
          const filtered = SKINFOLD_FIELDS.filter(f => sites.includes(f.name));
          if (filtered.length > 0) return filtered.map(f => ({ type: 'skinfold' as const, field: f }));
        }
      }
      // Sem sexo para JP3/Petroski: mostra 9 com aviso (evita travar)
      return SKINFOLD_FIELDS.map(f => ({ type: 'skinfold' as const, field: f }));
    }
    if (mode === 'biochemicals') return BIO_EXAMS.map(exam => ({ type: 'bio' as const, exam }));
    return [
      ...ANTHRO_FIELDS.map(f => ({ type: 'anthro' as const, field: f })),
      ...SKINFOLD_FIELDS.map(f => ({ type: 'skinfold' as const, field: f })),
      { type: 'bio' as const, title: 'Exames laboratoriais' },
    ];
  })();
  const totalSteps = steps.length;

  // Protocolo inicial — somente para modos com dobras
  useEffect(() => {
    if (!isOpen || !patientId) return;
    if (!showProtocolSelector) { setLoadingProtocol(false); return; }
    if (initialProtocol !== undefined) {
      if (initialProtocol === null) {
        // sem protocolo ainda — manter jp7 como sugestão mas tab controla confirmação
        setSelectedProtocol('jp7');
      } else {
        setSelectedProtocol(initialProtocol);
      }
      setLoadingProtocol(false);
      return;
    }
    setLoadingProtocol(true);
    (async () => {
      try {
        const { data, error } = await supabase.from('skinfolds').select('protocol, measurement_date, id').eq('user_id', patientId).in('protocol', ['jp3','jp7','petroski4']).order('measurement_date', { ascending: false }).order('id', { ascending: false }).limit(10);
        if (error) throw error;
        const last = pickLastValidProtocol((data as any[]) || []);
        setSelectedProtocol(resolveInitialProtocol(last));
      } catch {
        setSelectedProtocol('jp7');
      } finally {
        setLoadingProtocol(false);
      }
    })();
  }, [isOpen, patientId, initialProtocol, supabase, showProtocolSelector]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setShowReview(false);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen || !patientId) return;
    if (patientSex !== undefined) { setResolvedSex(patientSex); return; }
    supabase.from('profiles').select('sexo').eq('id', patientId).single().then(({ data }) => { if (data) setResolvedSex((data as any).sexo ?? null); });
  }, [isOpen, patientId, patientSex, supabase]);

  if (!isOpen) return null;

  const current = steps[currentStep];
  const isAnthro = current?.type === 'anthro';
  const isBio = current?.type === 'bio';
  const isBioSingle = isBio && !!(current as any).exam;
  const fieldName = isBio ? ((current as any).exam?.name ?? '') : (current as any)?.field?.name ?? '';
  const fieldLabel = isBio ? ((current as any).exam?.label ?? 'Exames laboratoriais') : (current as any)?.field?.label ?? '';
  const fieldUnit = isBio ? ((current as any).exam?.unit ?? '') : isAnthro ? (current as any).field.unit : 'mm';
  const bioExam = isBioSingle ? (current as any).exam as typeof BIO_EXAMS[number] : null;
  const bioIndex = isBioSingle ? currentStep + 1 : 0; // 1-based for biochemicals mode
  const bioTotal = mode === 'biochemicals' ? BIO_EXAMS.length : 0;

  const getEntries = (name: string): [string,string,string] => {
    if (isAnthro) return anthroEntries[name] || ['', '', ''];
    return skinfoldEntries[name] || ['', '', ''];
  };
  const setEntry = (name: string, idx: number, value: string) => {
    if (isAnthro) setAnthroEntries(prev => ({ ...prev, [name]: [0,1,2].map(i => i===idx ? value : (prev[name]?.[i] ?? '')) as [string,string,string] }));
    else setSkinfoldEntries(prev => ({ ...prev, [name]: [0,1,2].map(i => i===idx ? value : (prev[name]?.[i] ?? '')) as [string,string,string] }));
  };

  const entries = !isBio ? getEntries(fieldName) : ['', '', ''] as [string,string,string];
  const parsed = !isBio ? entries.map(v => parseNumber(v)) : [];
  const allValid = isBio ? true : parsed.every(v => !Number.isNaN(v) && v > 0);
  const average = !isBio && allValid ? (parsed[0] + parsed[1] + parsed[2]) / 3 : null;

  const requiredForProtocol: string[] | null = (() => {
    if (!sexNorm) return null;
    const proto = PROTOCOLS[selectedProtocol];
    return proto ? [...proto.sitesBySex[sexNorm]] : null;
  })();
  const isRequired = (name: string) => requiredForProtocol ? requiredForProtocol.includes(name) : false;

  const canNext = isBio ? true : allValid;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleNext = () => {
    if (!canNext) { toast.error('Preencha as três aferições válidas para avançar.'); return; }
    if (currentStep < totalSteps - 1) setCurrentStep(s => s + 1);
    else setShowReview(true);
  };
  const handleBack = () => {
    if (showReview) { setShowReview(false); return; }
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const buildAverages = () => {
    const antroAvg: Record<string, number> = {};
    Object.entries(anthroEntries).forEach(([k, vals]) => {
      const p = vals.map(v => parseNumber(v));
      if (p.every(v => !Number.isNaN(v) && v > 0)) antroAvg[k] = (p[0]+p[1]+p[2])/3;
    });
    const dobrasAvg: Record<string, number> = {};
    Object.entries(skinfoldEntries).forEach(([k, vals]) => {
      const p = vals.map(v => parseNumber(v));
      if (p.every(v => !Number.isNaN(v) && v > 0)) dobrasAvg[k] = (p[0]+p[1]+p[2])/3;
    });
    const bioAvg: Record<string, number> = {};
    Object.entries(bioEntries).forEach(([k,v]) => {
      const p = parseNumber(v);
      if (!Number.isNaN(p) && p >=0) bioAvg[k] = p;
    });
    return { antroAvg, dobrasAvg, bioAvg };
  };

  const handleSave = async () => {
    setLoading(true);
    const toastId = toast.loading("Registrando avaliação...");
    const { antroAvg, dobrasAvg } = buildAverages();
    const bioData: Record<string, number> = {};
    Object.entries(bioEntries).forEach(([k,v]) => {
      const p = parseNumber(v);
      if (!Number.isNaN(p) && p >=0) bioData[k] = p;
    });
    try {
      // Modo antropometria: só medidas
      if (mode === 'anthropometry') {
        if (Object.keys(antroAvg).length === 0) throw new Error("Preencha ao menos uma medida.");
        const { error } = await supabase.from('anthropometry').insert([{ user_id: patientId, measurement_date: date, ...antroAvg }]);
        if (error) throw new Error("Erro Antropometria: " + error.message);
      } else if (mode === 'skinfolds') {
        if (Object.keys(dobrasAvg).length === 0) throw new Error("Preencha ao menos uma dobra.");
        const dobrasInsert: Record<string, unknown> = { user_id: patientId, measurement_date: date, ...dobrasAvg, protocol: selectedProtocol };
        const { data: insertedSkin, error } = await supabase.from('skinfolds').insert([dobrasInsert]).select('id').single();
        if (error) throw new Error("Erro Dobras: " + error.message);
        if (insertedSkin?.id) {
          try {
            const { data: prof } = await supabase.from('profiles').select('data_nascimento, sexo').eq('id', patientId).single();
            // Peso/altura da mesma data ou último válido (regra existente)
            let w: number | null = null;
            let h: number | null = null;
            const { data: antroSame } = await supabase.from('anthropometry').select('weight, height').eq('user_id', patientId).eq('measurement_date', date).maybeSingle();
            if ((antroSame as any)?.weight != null) w = Number((antroSame as any).weight);
            if ((antroSame as any)?.height != null) h = Number((antroSame as any).height);
            if (w === null) {
              const { data: lastAntro } = await supabase.from('anthropometry').select('weight, height').eq('user_id', patientId).order('measurement_date', { ascending: false }).limit(1).maybeSingle();
              if ((lastAntro as any)?.weight != null) w = Number((lastAntro as any).weight);
              if (h === null && (lastAntro as any)?.height != null) h = Number((lastAntro as any).height);
            }
            // fallback altura do perfil se ainda null
            if (h === null) {
              const { data: profH } = await supabase.from('profiles').select('altura').eq('id', patientId).single();
              if ((profH as any)?.altura != null) h = Number((profH as any).altura);
            }
            const { persistBodyComposition } = await import('@/lib/nutrition/bodyCompositionService');
            await persistBodyComposition({
              skinfoldId: (insertedSkin as any).id,
              userId: patientId,
              measurementDate: date,
              protocol: selectedProtocol,
              method: 'siri',
              skinfolds: dobrasAvg as any,
              birthDate: (prof as any)?.data_nascimento ?? null,
              sex: (prof as any)?.sexo ?? resolvedSex,
              weight: w,
              height: h,
            });
          } catch (e) { console.warn('body_compositions persist falhou (coleta preservada):', e); }
        }
      } else if (mode === 'biochemicals') {
        if (Object.keys(bioData).length === 0) throw new Error("Preencha ao menos um exame.");
        const { error } = await supabase.from('biochemicals').insert([{ user_id: patientId, exam_date: date, ...bioData }]);
        if (error) throw new Error("Erro Bioquímicos: " + error.message);
      } else {
        // full — mantém comportamento anterior
        if (Object.keys(antroAvg).length > 0) {
          const { error } = await supabase.from('anthropometry').insert([{ user_id: patientId, measurement_date: date, ...antroAvg }]);
          if (error) throw new Error("Erro Antropometria: " + error.message);
        }
        if (Object.keys(dobrasAvg).length > 0) {
          const dobrasInsert: Record<string, unknown> = { user_id: patientId, measurement_date: date, ...dobrasAvg, protocol: selectedProtocol };
          const { data: insertedSkin, error } = await supabase.from('skinfolds').insert([dobrasInsert]).select('id').single();
          if (error) throw new Error("Erro Dobras: " + error.message);
          if (insertedSkin?.id) {
            try {
              const { data: prof } = await supabase.from('profiles').select('data_nascimento, sexo').eq('id', patientId).single();
              const { persistBodyComposition } = await import('@/lib/nutrition/bodyCompositionService');
              await persistBodyComposition({
                skinfoldId: (insertedSkin as any).id,
                userId: patientId,
                measurementDate: date,
                protocol: selectedProtocol,
                method: 'siri',
                skinfolds: dobrasAvg as any,
                birthDate: (prof as any)?.data_nascimento ?? null,
                sex: (prof as any)?.sexo ?? resolvedSex,
                weight: (antroAvg as any).weight ?? null,
                height: (antroAvg as any).height ?? null,
              });
            } catch (e) { console.warn('body_compositions persist falhou (coleta preservada):', e); }
          }
        }
        if (Object.keys(bioData).length > 0) {
          const { error } = await supabase.from('biochemicals').insert([{ user_id: patientId, exam_date: date, ...bioData }]);
          if (error) throw new Error("Erro Bioquímicos: " + error.message);
        }
      }
      toast.success("Avaliação registrada com sucesso!", { id: toastId });
      setAnthroEntries({}); setSkinfoldEntries({}); setBioEntries({}); setCurrentStep(0); setShowReview(false);
      onClose();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.message ? err.message : "Erro ao salvar.";
      toast.error(message, { id: toastId });
    } finally { setLoading(false); }
  };

  const handleBioChange = (e: React.ChangeEvent<HTMLInputElement>) => setBioEntries(prev => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl w-full max-w-2xl md:max-w-3xl lg:max-w-4xl overflow-hidden flex flex-col h-[92vh] sm:h-auto sm:max-h-[90vh] relative">
        <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mt-3 mb-1 sm:hidden"></div>
        <div className="flex justify-between items-center p-4 md:px-6 border-b border-stone-100 bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-nutri-50 p-3 rounded-2xl text-nutri-800 border border-nutri-100 shadow-sm"><Activity size={24} /></div>
            <div>
              <h3 className="font-extrabold text-xl md:text-2xl text-stone-900 tracking-tight leading-tight">{mode==='anthropometry' ? 'Medidas antropométricas' : mode==='skinfolds' ? 'Dobras cutâneas' : mode==='biochemicals' ? 'Registro de exames laboratoriais' : 'Nova Medição'}</h3>
              <p className="text-xs md:text-sm text-stone-500 font-medium mt-0.5">Paciente: <span className="text-nutri-900 font-bold">{patientName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="bg-stone-50 border border-stone-200 text-stone-400 hover:text-stone-700 hover:bg-stone-100 p-2.5 rounded-full transition-all active:scale-90"><X size={20} /></button>
        </div>

        <div className="px-4 md:px-6 pt-3 bg-white shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Progresso</span>
            <span className="text-[11px] font-bold text-stone-600">{showReview ? 'Revisão' : mode==='skinfolds' ? `Dobra ${currentStep + 1} de ${totalSteps}` : mode==='biochemicals' ? `Exame ${bioIndex} de ${bioTotal}` : `${currentStep + 1} / ${totalSteps}`}</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-nutri-800 h-1.5 rounded-full transition-all duration-300" style={{ width: `${showReview ? 100 : progress}%` }} />
          </div>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-white overscroll-contain">
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm mb-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-white p-1.5 rounded-lg shadow-sm border border-stone-100"><Calendar size={16} className="text-nutri-800" /></div>
              <span className="text-[11px] font-black text-stone-500 uppercase tracking-widest">Data da Avaliação</span>
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full md:w-auto p-2.5 border border-stone-200 rounded-xl bg-white outline-none text-sm font-bold text-stone-800 focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 transition-all shadow-sm" />
          </div>

          {!showReview ? (
            <div className="space-y-6 animate-fade-in">
              {showProtocolSelector && (
                <div className="rounded-2xl border border-nutri-200 bg-nutri-50/50 p-4 shadow-sm">
                  <label htmlFor="protocol-select-stepped" className="block text-[10px] font-black uppercase tracking-widest text-nutri-800 mb-2">Protocolo da avaliação</label>
                  <select id="protocol-select-stepped" value={selectedProtocol} onChange={(e) => setSelectedProtocol(e.target.value as ProtocolId)} disabled={loadingProtocol} className="w-full p-3.5 border border-nutri-200 rounded-xl bg-white text-sm font-bold text-stone-800 focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none disabled:opacity-60">
                    <option value="jp3">{PROTOCOLS.jp3.label}</option>
                    <option value="jp7">{PROTOCOLS.jp7.label}</option>
                    <option value="petroski4">{PROTOCOLS.petroski4.label}</option>
                  </select>
                <p className="mt-2 text-xs font-medium text-stone-600">
                  {PROTOCOLS[selectedProtocol].label}: <span className="font-bold text-nutri-800">{(() => { const s = normalizeSex(resolvedSex); if (!s) return '—'; return PROTOCOLS[selectedProtocol].sitesBySex[s].map(c=>foldLabelPt(c as string)).join(', '); })() || '—'}</span>
                </p>
                </div>
              )}

              {isBio ? (
                isBioSingle && bioExam ? (
                  <div className="space-y-4">
                    <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Syringe size={18} className="text-nutri-800" />
                        <h4 className="text-base font-black text-stone-800">Registro de exames laboratoriais</h4>
                      </div>
                      <p className="text-xs text-stone-500 mb-1">Grupo: <span className="font-bold text-stone-700">{bioExam.group}</span></p>
                      <p className="text-xs font-bold text-nutri-700 mb-4">Exame {bioIndex} de {bioTotal} — {bioExam.label}</p>
                      <div className="group">
                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">{bioExam.label} {bioExam.unit ? `(${bioExam.unit})` : ''}</label>
                        <input type="number" step="0.01" inputMode="decimal" name={bioExam.name} value={bioEntries[bioExam.name] || ''} onChange={handleBioChange} placeholder="Informe o resultado" autoFocus className="w-full p-3.5 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none text-base font-black text-stone-700 transition-all shadow-inner focus:shadow-sm" />
                        <p className="mt-2 text-[10px] text-stone-400">Deixe vazio para ignorar este exame. Você pode voltar para editar.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                      <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800 font-medium">Exames laboratoriais — preenchimento único (não usa média). Deixe vazio se não houver exame nesta data.</p>
                    </div>
                    {BIO_GROUPS.map(group => (
                      <div key={group.title} className="bg-stone-50 p-4 rounded-[1.5rem] border border-stone-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3">{group.title}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {group.fields.map(f => (
                            <div key={f.name} className="group">
                              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">{f.label}</label>
                              <input type="number" step="0.01" inputMode="decimal" name={f.name} value={bioEntries[f.name] || ''} onChange={handleBioChange} placeholder="—" className="w-full p-3.5 border border-stone-200 rounded-xl bg-white text-sm font-bold text-stone-700 outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 transition-all" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  {isAnthro ? <Ruler size={18} className="text-nutri-800" /> : <Layers size={18} className="text-nutri-800" />}
                  <h4 className="flex items-center gap-1.5 text-base font-black text-stone-800">
                    <span>{fieldLabel} <span className="text-xs font-bold text-stone-400">({fieldUnit})</span></span>
                    {isAnthro ? <AnthropometryTooltip itemKey={fieldName} category="medida" /> : !isBio ? <AnthropometryTooltip itemKey={fieldName} category="dobra" /> : null}
                  </h4>
                  {!isAnthro && !isBio && isRequired(fieldName) && <span className="ml-1 text-[10px] font-black uppercase tracking-widest bg-nutri-800 text-white px-2 py-0.5 rounded-full">Obrigatória</span>}
                  {!isAnthro && !isBio && !isRequired(fieldName) && <span className="ml-1 text-[10px] font-bold uppercase tracking-widest bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Opcional</span>}
                  <span title="Medição com adipômetro/padiola conforme protocolo" className="ml-auto cursor-help"><Info size={14} className="text-stone-400" /></span>
                </div>
                  <p className="text-xs text-stone-500 mb-4">{isAnthro ? 'Realize três aferições da mesma medida.' : 'Realize três medições da dobra com adipômetro.'}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[0,1,2].map(idx => (
                      <div key={idx} className="group">
                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">Medição {idx+1}</label>
                        <input type="number" step="0.01" inputMode="decimal" value={entries[idx] || ''} onChange={(e)=> setEntry(fieldName, idx, e.target.value)} placeholder={isAnthro ? "Ex.: 70" : "Ex.: 12.0"} className="w-full p-3.5 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none text-base font-black text-stone-700 transition-all shadow-inner focus:shadow-sm" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-nutri-50 border border-nutri-100 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-nutri-700">Média</span>
                    <span className="text-lg font-black text-nutri-800">{average !== null ? average.toFixed(2) : '—'} <span className="text-xs font-bold text-stone-500">{fieldUnit}</span></span>
                  </div>
                  {!allValid && <p className="mt-2 text-xs font-bold text-amber-600">Preencha as três aferições válidas (&gt;0) para avançar.</p>}
                </div>
              )}
            </div>
            ) : (
            <div className="space-y-6 animate-fade-in">
              <h4 className="text-sm font-black uppercase tracking-widest text-stone-800">Revisão final</h4>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                {(mode === 'anthropometry' || mode === 'full') && ANTHRO_FIELDS.map(f => {
                  const vals = anthroEntries[f.name];
                  if (!vals) return null;
                  const p = vals.map(v=>parseNumber(v));
                  if (p.some(v=> Number.isNaN(v) || v<=0)) return null;
                  const avg = (p[0]+p[1]+p[2])/3;
                  return <div key={f.name} className="flex justify-between text-sm border-b border-stone-100 py-2"><span className="font-bold text-stone-600">{f.label}</span><span className="font-black text-stone-800">{avg.toFixed(2)} {f.unit}</span></div>;
                })}
                {(mode === 'skinfolds' || mode === 'full') && SKINFOLD_FIELDS.map(f => {
                  const vals = skinfoldEntries[f.name];
                  if (!vals) return null;
                  const p = vals.map(v=>parseNumber(v));
                  if (p.some(v=> Number.isNaN(v) || v<=0)) return null;
                  const avg = (p[0]+p[1]+p[2])/3;
                  return <div key={f.name} className="flex justify-between text-sm border-b border-stone-100 py-2"><span className="font-bold text-stone-600">{f.label}</span><span className="font-black text-stone-800">{avg.toFixed(1)} mm</span></div>;
                })}
                {(mode === 'biochemicals' || mode === 'full') && Object.entries(bioEntries).filter(([,v]) => v !== '' && !Number.isNaN(parseNumber(v))).map(([k,v]) => {
                  const label = BIO_GROUPS.flatMap(g=>g.fields).find(f=>f.name===k)?.label || k;
                  return <div key={k} className="flex justify-between text-sm border-b border-stone-100 py-2"><span className="font-bold text-stone-600">{label}</span><span className="font-black text-stone-800">{v}</span></div>;
                })}
                {mode === 'full' && Object.keys(bioEntries).length>0 && <div className="text-xs font-bold text-stone-500">Bioquímicos: {Object.keys(bioEntries).filter(([,v])=> v!=='' ).length} campos</div>}
              </div>
              <p className="text-xs text-stone-500">
                {mode === 'anthropometry' && `Serão persistidas somente as médias antropométricas na data ${date}.`}
                {mode === 'skinfolds' && `Serão persistidas somente as médias das dobras na data ${date} com protocolo ${PROTOCOLS[selectedProtocol].label}.`}
                {mode === 'biochemicals' && `Serão persistidos somente os exames na data ${date}.`}
                {mode === 'full' && `Serão persistidas somente as médias na data ${date} com protocolo ${PROTOCOLS[selectedProtocol].label}.`}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 md:px-6 border-t border-stone-100 bg-white flex justify-between items-center gap-2 shrink-0">
          <button type="button" onClick={handleBack} disabled={currentStep===0 && !showReview} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed text-sm border border-stone-200">
            <ChevronLeft size={16} /> Voltar
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="hidden sm:inline-flex px-4 py-2.5 rounded-xl font-bold text-stone-500 hover:bg-stone-100 text-sm">Cancelar</button>
            {isBioSingle && !showReview && (
              <button type="button" onClick={handleNext} className="px-4 py-2.5 rounded-xl font-bold text-stone-600 hover:bg-stone-100 border border-stone-200 text-sm">Pular exame</button>
            )}
            {!showReview ? (
                <button type="button" onClick={handleNext} disabled={!canNext} className="flex items-center gap-1.5 bg-nutri-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-nutri-800 disabled:opacity-50">
                  {isBioSingle && currentStep === totalSteps - 1 ? 'Revisar exames' : 'Próximo'} <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={handleSave} disabled={loading} className="flex items-center gap-1.5 bg-nutri-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-nutri-800 disabled:opacity-50">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} {mode==='anthropometry' ? 'Salvar medidas' : mode==='skinfolds' ? 'Salvar dobras' : mode==='biochemicals' ? 'Salvar exames' : 'Salvar avaliação'}
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
