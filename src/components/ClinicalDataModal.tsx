'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  X, Save, Loader2, Activity, Ruler, 
  Syringe, Layers, Calendar, ChevronRight 
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProtocolId } from '@/lib/nutrition/bodyComposition';
import { PROTOCOLS, normalizeSex } from '@/lib/nutrition/bodyComposition';
import { pickLastValidProtocol, resolveInitialProtocol } from '@/lib/nutrition/protocolDefault';

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

// =========================================================================
// INTERFACES E TIPAGENS
// =========================================================================

interface ClinicalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  /**
   * F3.2 — para NOVA avaliação: undefined (busca último protocolo válido do paciente).
   * Para EDIÇÃO de medição existente: protocol = 'jp3'|'jp7'|'petroski4' | null (NULL histórico preservado).
   */
  protocol?: ProtocolId | null;
  /** Sexo do paciente para destacar campos obrigatórios (opcional, se não houver mostra aviso) */
  patientSex?: string | null;
}

type TabType = 'antropometria' | 'dobras' | 'bioquimicos';

// Tipo genérico para os estados dos formulários antes de limpar
type FormDataState = Record<string, string>;

const getLocalDateString = () => new Date().toLocaleDateString('en-CA');
const parseNumber = (value: string) => parseFloat(value.replace(',', '.'));

export default function ClinicalDataModal({ isOpen, onClose, patientId, patientName, protocol: initialProtocol, patientSex }: ClinicalDataModalProps) {
  // =========================================================================
  // ESTADOS — F3.2 protocolo por medição, default = último válido do paciente
  // =========================================================================
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('antropometria');
  const [date, setDate] = useState(getLocalDateString());

  const [antropometria, setAntropometria] = useState<FormDataState>({});
  const [dobras, setDobras] = useState<FormDataState>({});
  const [bioquimicos, setBioquimicos] = useState<FormDataState>({});

  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolId>('jp7');
  const [loadingProtocol, setLoadingProtocol] = useState(false);
  const [resolvedSex, setResolvedSex] = useState<string | null>(patientSex ?? null);

  const supabase = createClient();

  // F3.2 — determinar protocolo inicial: edição usa protocol da medição, nova busca último válido
  useEffect(() => {
    if (!isOpen || !patientId) return;
    // Modo edição: initialProtocol definido (inclui null = histórico sem protocolo)
    if (initialProtocol !== undefined) {
      if (initialProtocol === null) {
        // Histórico NULL preservado — mostra jp7 como sugestão visual mas mantém null até usuário escolher
        setSelectedProtocol('jp7');
      } else {
        setSelectedProtocol(initialProtocol);
      }
      setLoadingProtocol(false);
      return;
    }
    // Modo nova avaliação: buscar último protocolo válido
    setLoadingProtocol(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('skinfolds')
          .select('protocol, measurement_date, id')
          .eq('user_id', patientId)
          .in('protocol', ['jp3','jp7','petroski4'])
          .order('measurement_date', { ascending: false })
          .order('id', { ascending: false })
          .limit(10);
        if (error) throw error;
        const last = pickLastValidProtocol((data as any[]) || []);
        setSelectedProtocol(resolveInitialProtocol(last));
      } catch {
        setSelectedProtocol('jp7');
      } finally {
        setLoadingProtocol(false);
      }
    })();
  }, [isOpen, patientId, initialProtocol, supabase]);

  // Resolver sexo se não veio por prop (para destacar campos obrigatórios)
  useEffect(() => {
    if (!isOpen || !patientId) return;
    if (patientSex !== undefined) {
      setResolvedSex(patientSex);
      return;
    }
    supabase.from('profiles').select('sexo').eq('id', patientId).single().then(({ data }) => {
      if (data) setResolvedSex((data as any).sexo ?? null);
    });
  }, [isOpen, patientId, patientSex, supabase]);

  if (!isOpen) return null;

  // =========================================================================
  // HANDLERS DE FORMULÁRIO
  // =========================================================================
  const handleAntroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAntropometria(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDobrasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDobras(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleBioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBioquimicos(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Função para limpar dados vazios e converter strings para números antes de enviar
  const cleanData = (obj: FormDataState) => {
    const cleaned: Record<string, number> = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val !== '' && val !== null && val !== undefined) {
        const parsed = parseNumber(val);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          cleaned[key] = parsed;
        }
      }
    });
    return cleaned;
  };

  // =========================================================================
  // SUBMIT PARA O SUPABASE
  // =========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading("Registrando dados clínicos...");

    const antroData = cleanData(antropometria);
    const dobrasData = cleanData(dobras);
    const bioData = cleanData(bioquimicos);

    try {
      // Usamos execuções sequenciais para capturar qual tabela deu erro, se houver
      if (Object.keys(antroData).length > 0) {
        const { error } = await supabase.from('anthropometry').insert([{ user_id: patientId, measurement_date: date, ...antroData }]);
        if (error) throw new Error("Erro Antropometria: " + error.message);
      }

      if (Object.keys(dobrasData).length > 0) {
        // F3.1/F3.2 — protocolo selecionado no seletor (não fallback silencioso histórico)
        const dobrasInsert: Record<string, unknown> = { user_id: patientId, measurement_date: date, ...dobrasData };
        const allowed: ProtocolId[] = ['jp3','jp7','petroski4'];
        const toPersist = selectedProtocol as ProtocolId;
        dobrasInsert.protocol = allowed.includes(toPersist) ? toPersist : 'jp7';
        const { data: insertedSkin, error } = await supabase.from('skinfolds').insert([dobrasInsert]).select('id').single();
        if (error) throw new Error("Erro Dobras: " + error.message);
        // F3.4 — persistência do resultado oficial em body_compositions (se completo)
        if (insertedSkin?.id) {
          try {
            const { data: prof } = await supabase.from('profiles').select('data_nascimento, sexo').eq('id', patientId).single();
            const w = (antroData as any).weight ?? null;
            const h = (antroData as any).height ?? null;
            const { persistBodyComposition } = await import('@/lib/nutrition/bodyCompositionService');
            await persistBodyComposition({
              skinfoldId: (insertedSkin as any).id,
              userId: patientId,
              measurementDate: date,
              protocol: dobrasInsert.protocol as ProtocolId,
              method: 'siri',
              skinfolds: dobrasData as any,
              birthDate: (prof as any)?.data_nascimento ?? null,
              sex: (prof as any)?.sexo ?? resolvedSex,
              weight: w != null ? Number(w) : null,
              height: h != null ? Number(h) : null,
            });
          } catch (e) {
            console.warn('body_compositions persist falhou (coleta preservada):', e);
          }
        }
      }

      if (Object.keys(bioData).length > 0) {
        const { error } = await supabase.from('biochemicals').insert([{ user_id: patientId, exam_date: date, ...bioData }]);
        if (error) throw new Error("Erro Bioquímicos: " + error.message);
      }

      toast.success("Avaliação clínica registrada com sucesso!", { id: toastId });
      
      // Reseta os formulários após sucesso
      setAntropometria({}); 
      setDobras({}); 
      setBioquimicos({});
      onClose();

    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.message ? err.message : "Ocorreu um erro ao salvar os dados.";
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[92vh] sm:h-auto sm:max-h-[90vh] animate-fade-in-up relative">
        
        {/* Barrinha puxadora (Mobile) */}
        <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 mb-2 sm:hidden"></div>

        {/* HEADER */}
        <div className="flex justify-between items-center p-6 md:px-8 border-b border-stone-100 bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-nutri-50 p-3 rounded-2xl text-nutri-800 border border-nutri-100 shadow-sm">
              <Activity size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-xl md:text-2xl text-stone-900 tracking-tight leading-tight">Avaliação Clínica</h3>
              <p className="text-xs md:text-sm text-stone-500 font-medium mt-0.5">Paciente: <span className="text-nutri-900 font-bold">{patientName}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="bg-stone-50 border border-stone-200 text-stone-400 hover:text-stone-700 hover:bg-stone-100 p-2.5 rounded-full transition-all active:scale-90"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* TABS NAVEGAÇÃO */}
        <div className="flex overflow-x-auto border-b border-stone-100 px-6 md:px-8 pt-4 gap-4 md:gap-8 bg-stone-50/50 scrollbar-hide shrink-0">
          <button 
            onClick={() => setActiveTab('antropometria')} 
            className={`pb-4 text-xs md:text-sm font-black uppercase tracking-widest border-b-[3px] transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'antropometria' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
          >
            <Ruler size={16} /> Medidas
          </button>
          <button 
            onClick={() => setActiveTab('dobras')} 
            className={`pb-4 text-xs md:text-sm font-black uppercase tracking-widest border-b-[3px] transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'dobras' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
          >
            <Layers size={16} /> Dobras
          </button>
          <button 
            onClick={() => setActiveTab('bioquimicos')} 
            className={`pb-4 text-xs md:text-sm font-black uppercase tracking-widest border-b-[3px] transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'bioquimicos' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
          >
            <Syringe size={16} /> Bioquímicos
          </button>
        </div>

        {/* CORPO FORMULÁRIO */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white scrollbar-thin scrollbar-thumb-stone-200">
          <form id="clinical-form" onSubmit={handleSubmit} className="space-y-8 pb-10">
            
            <div className="bg-stone-50 p-5 rounded-[1.5rem] border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-stone-100">
                  <Calendar size={18} className="text-nutri-800" />
                </div>
                <span className="text-xs font-black text-stone-500 uppercase tracking-widest">Data da Avaliação</span>
              </div>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
                className="w-full md:w-auto p-3.5 border border-stone-200 rounded-xl bg-white outline-none text-sm font-bold text-stone-800 focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 transition-all shadow-sm" 
              />
            </div>

            {/* ABA: ANTROPOMETRIA */}
            {activeTab === 'antropometria' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 animate-fade-in">
                {[
                  { label: "Peso (kg)", name: "weight" },
                  { label: "Altura (m)", name: "height" },
                  { label: "Cintura (cm)", name: "waist" },
                  { label: "Abdominal (cm)", name: "abdominal" },
                  { label: "Quadril (cm)", name: "hip" },
                  { label: "Braço (cm)", name: "arm" },
                  { label: "Antebraço (cm)", name: "forearm" },
                  { label: "Coxa (cm)", name: "thigh" },
                  { label: "Panturrilha (cm)", name: "calf" },
                  { label: "Pescoço (cm)", name: "neck" },
                  { label: "Tórax (cm)", name: "chest" }
                ].map((field) => (
                  <div key={field.name} className="group">
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-nutri-800 transition-colors">{field.label}</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      name={field.name} 
                      value={antropometria[field.name] || ''} 
                      onChange={handleAntroChange} 
                      placeholder="0.00" 
                      className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50 focus:bg-white focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none text-base font-black text-stone-700 transition-all shadow-inner focus:shadow-sm" 
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ABA: DOBRAS CUTÂNEAS - 9 campos sempre coletáveis, protocolo determina obrigatórios */}
            {activeTab === 'dobras' && (() => {
              const sexNorm = normalizeSex(resolvedSex);
              const required: string[] | null = (() => {
                if (!sexNorm) return null;
                const proto = PROTOCOLS[selectedProtocol];
                return proto ? [...proto.sitesBySex[sexNorm]] : null;
              })();
              const isRequired = (name: string) => required ? required.includes(name) : false;
              // Petroski F extra
              const petroskiF = selectedProtocol === 'petroski4' && sexNorm === 'F';
              return (
                <div className="space-y-4 animate-fade-in">
                  <div className="rounded-2xl border border-nutri-200 bg-nutri-50/50 p-4 shadow-sm">
                    <label htmlFor="protocol-select" className="block text-[10px] font-black uppercase tracking-widest text-nutri-800 mb-2">
                      Protocolo da avaliação
                    </label>
                    <select
                      id="protocol-select"
                      aria-label="Protocolo da avaliação"
                      value={selectedProtocol}
                      onChange={(e) => setSelectedProtocol(e.target.value as ProtocolId)}
                      disabled={loadingProtocol}
                      className="w-full p-3.5 border border-nutri-200 rounded-xl bg-white text-sm font-bold text-stone-800 focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none disabled:opacity-60"
                    >
                      <option value="jp3">{PROTOCOLS.jp3.label}</option>
                      <option value="jp7">{PROTOCOLS.jp7.label}</option>
                      <option value="petroski4">{PROTOCOLS.petroski4.label}</option>
                    </select>
                    {loadingProtocol ? (
                      <p className="mt-2 text-xs font-medium text-stone-500">Carregando último protocolo...</p>
                    ) : initialProtocol === undefined ? (
                      <p className="mt-2 text-xs font-medium text-stone-500">
                        Nova avaliação — padrão: último protocolo válido do paciente{sexNorm ? '' : ' (sexo não informado)'}.
                      </p>
                    ) : initialProtocol === null ? (
                      <p className="mt-2 text-xs font-bold text-amber-600">Protocolo não registrado nesta medição histórica — selecione para nova avaliação.</p>
                    ) : null}
                    {!sexNorm && (selectedProtocol === 'jp3' || petroskiF) ? (
                      <p className="mt-2 text-xs font-bold text-amber-600">Sexo não disponível — não é possível determinar campos específicos do protocolo até que o sexo esteja cadastrado.</p>
                    ) : required ? (
                      <p className="mt-2 text-xs font-medium text-stone-600">
                        Necessárias para {PROTOCOLS[selectedProtocol].label}: <span className="font-bold text-nutri-800">{required.map(c=>FOLD_PT[c]||c).join(', ')}</span>
                        {petroskiF ? <span className="font-bold"> + peso e altura</span> : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {[
                      { label: "Tricipital", name: "triceps" },
                      { label: "Bicipital", name: "biceps" },
                      { label: "Subescapular", name: "subscapular" },
                      { label: "Axilar Média", name: "axillary_media" },
                      { label: "Peitoral", name: "pectoral" },
                      { label: "Suprailíaca", name: "suprailiac" },
                      { label: "Abdominal", name: "abdominal" },
                      { label: "Coxa", name: "thigh" },
                      { label: "Panturrilha", name: "calf" }
                    ].map((field) => {
                      const req = isRequired(field.name);
                      return (
                        <div key={field.name} className="group">
                          <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ml-1 transition-colors ${req ? 'text-nutri-700' : 'text-stone-400 group-focus-within:text-nutri-800'}`}>
                            {field.label} (mm) {req ? <span className="text-nutri-600">•</span> : null}
                          </label>
                          <input 
                            type="number" 
                            step="0.1" 
                            name={field.name} 
                            value={dobras[field.name] || ''} 
                            onChange={handleDobrasChange} 
                            placeholder="0.0" 
                            className={`w-full p-4 border rounded-2xl bg-stone-50 focus:bg-white focus:ring-4 focus:ring-nutri-800/10 outline-none text-base font-black transition-all shadow-inner focus:shadow-sm ${req ? 'border-nutri-300 focus:border-nutri-800' : 'border-stone-200 focus:border-nutri-800 text-stone-700'}`} 
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ABA: BIOQUÍMICOS */}
            {activeTab === 'bioquimicos' && (
              <div className="space-y-8 animate-fade-in">
                
                {/* Grupo Metabólico */}
                <div className="bg-stone-50/50 p-6 md:p-8 rounded-[2rem] border border-stone-100 shadow-sm">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><ChevronRight size={14} className="text-nutri-400"/> Glicêmico & Insulina</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {[
                      { label: "Glicose", name: "glucose" },
                      { label: "Insulina", name: "insulin" },
                      { label: "HbA1c (%)", name: "hba1c" }
                    ].map(f => (
                      <div key={f.name} className="group">
                        <label className="block text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-nutri-800 transition-colors">{f.label}</label>
                        <input 
                          type="number" step="0.01" name={f.name} value={bioquimicos[f.name] || ''} onChange={handleBioChange} placeholder="0.00"
                          className="w-full p-3.5 border border-stone-200 rounded-xl bg-white text-sm font-bold text-stone-700 outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 transition-all" 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grupo Lipídico */}
                <div className="bg-stone-50/50 p-6 md:p-8 rounded-[2rem] border border-stone-100 shadow-sm">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><ChevronRight size={14} className="text-nutri-400"/> Perfil Lipídico</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                    {[
                      { label: "Colest. Total", name: "total_cholesterol" },
                      { label: "HDL", name: "hdl" },
                      { label: "LDL", name: "ldl" },
                      { label: "Triglicérides", name: "triglycerides" }
                    ].map(f => (
                      <div key={f.name} className="group">
                        <label className="block text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-nutri-800 transition-colors">{f.label}</label>
                        <input 
                          type="number" step="0.01" name={f.name} value={bioquimicos[f.name] || ''} onChange={handleBioChange} placeholder="0.00"
                          className="w-full p-3.5 border border-stone-200 rounded-xl bg-white text-sm font-bold text-stone-700 outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 transition-all" 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grupo Inflamatório e Órgãos */}
                <div className="bg-stone-50/50 p-6 md:p-8 rounded-[2rem] border border-stone-100 shadow-sm">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><ChevronRight size={14} className="text-nutri-400"/> Inflamação & Órgãos</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {[
                      { label: "Ferritina", name: "ferritin" },
                      { label: "PCR", name: "pcr" },
                      { label: "TGP (Fígado)", name: "tgp" },
                      { label: "Creatinina", name: "creatinine" },
                      { label: "Ureia", name: "urea" }
                    ].map(f => (
                      <div key={f.name} className="group">
                        <label className="block text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-nutri-800 transition-colors">{f.label}</label>
                        <input 
                          type="number" step="0.01" name={f.name} value={bioquimicos[f.name] || ''} onChange={handleBioChange} placeholder="0.00"
                          className="w-full p-3.5 border border-stone-200 rounded-xl bg-white text-sm font-bold text-stone-700 outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 transition-all" 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grupo Vitaminas */}
                <div className="bg-stone-50/50 p-6 md:p-8 rounded-[2rem] border border-stone-100 shadow-sm">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><ChevronRight size={14} className="text-nutri-400"/> Vitaminas & Hormonal</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                    {[
                      { label: "Vitamina D", name: "vitamin_d" },
                      { label: "Vitamina B12", name: "vitamin_b12" },
                      { label: "TSH", name: "tsh" },
                      { label: "Ferro", name: "iron" }
                    ].map(f => (
                      <div key={f.name} className="group">
                        <label className="block text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-nutri-800 transition-colors">{f.label}</label>
                        <input 
                          type="number" step="0.01" name={f.name} value={bioquimicos[f.name] || ''} onChange={handleBioChange} placeholder="0.00"
                          className="w-full p-3.5 border border-stone-200 rounded-xl bg-white text-sm font-bold text-stone-700 outline-none focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 transition-all" 
                        />
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </form>
        </div>

        {/* FOOTER DO MODAL */}
        <div className="p-6 md:p-8 border-t border-stone-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-10">
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest text-center md:text-left flex items-center gap-2">
            <Save size={12} /> Salva no Prontuário
          </p>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 md:flex-none px-6 py-4 rounded-xl font-bold text-stone-500 hover:bg-stone-100 hover:text-stone-800 text-sm transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              form="clinical-form" 
              disabled={loading} 
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-nutri-900 text-white px-10 py-4 rounded-xl text-sm font-bold hover:bg-nutri-800 transition-all shadow-lg shadow-nutri-900/20 disabled:opacity-50 active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {loading ? 'Salvando...' : 'Salvar Avaliação'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
