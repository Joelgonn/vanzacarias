'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Save, Loader2, Activity, Ruler, Syringe, Layers, Calendar, ChevronRight } from 'lucide-react';

interface ClinicalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

export default function ClinicalDataModal({ isOpen, onClose, patientId, patientName }: ClinicalDataModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'antropometria' | 'dobras' | 'bioquimicos'>('antropometria');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Estados detalhados
  const [antropometria, setAntropometria] = useState<any>({});
  const [dobras, setDobras] = useState<any>({});
  const [bioquimicos, setBioquimicos] = useState<any>({});

  const supabase = createClient();

  if (!isOpen) return null;

  const handleAntroChange = (e: React.ChangeEvent<HTMLInputElement>) => setAntropometria({ ...antropometria, [e.target.name]: e.target.value });
  const handleDobrasChange = (e: React.ChangeEvent<HTMLInputElement>) => setDobras({ ...dobras, [e.target.name]: e.target.value });
  const handleBioChange = (e: React.ChangeEvent<HTMLInputElement>) => setBioquimicos({ ...bioquimicos, [e.target.name]: e.target.value });

  const cleanData = (obj: any) => {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== '' && obj[key] !== null && obj[key] !== undefined) {
        cleaned[key] = parseFloat(obj[key]);
      }
    });
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const antroData = cleanData(antropometria);
    const dobrasData = cleanData(dobras);
    const bioData = cleanData(bioquimicos);

    try {
      if (Object.keys(antroData).length > 0) {
        const { error } = await supabase.from('anthropometry').insert([{ user_id: patientId, measurement_date: date, ...antroData }]);
        if (error) throw new Error("Erro Antropometria: " + error.message);
      }

      if (Object.keys(dobrasData).length > 0) {
        const { error } = await supabase.from('skinfolds').insert([{ user_id: patientId, measurement_date: date, ...dobrasData }]);
        if (error) throw new Error("Erro Dobras: " + error.message);
      }

      if (Object.keys(bioData).length > 0) {
        const { error } = await supabase.from('biochemicals').insert([{ user_id: patientId, exam_date: date, ...bioData }]);
        if (error) throw new Error("Erro Bioquímicos: " + error.message);
      }

      alert("Avaliação registrada com sucesso!");
      setAntropometria({}); setDobras({}); setBioquimicos({});
      onClose();

    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[92vh] sm:h-auto sm:max-h-[90vh] animate-fade-in-up">
        
        <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 mb-2 sm:hidden"></div>

        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-nutri-50 p-2.5 rounded-2xl text-nutri-800 border border-white shadow-sm">
              <Activity size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg md:text-xl text-stone-900 tracking-tight leading-tight">Avaliação Clínica</h3>
              <p className="text-xs md:text-sm text-stone-500 font-medium">Paciente: <span className="text-nutri-900 font-bold">{patientName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="bg-stone-100 text-stone-400 hover:text-stone-700 p-2.5 rounded-full transition-colors active:scale-90">
            <X size={20} />
          </button>
        </div>

        {/* TABS NAVEGAÇÃO */}
        <div className="flex overflow-x-auto border-b border-stone-100 px-6 pt-4 gap-4 md:gap-8 bg-stone-50/50 scrollbar-hide">
          <button onClick={() => setActiveTab('antropometria')} className={`pb-3 text-xs md:text-sm font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'antropometria' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400'}`}>
            <Ruler size={16} /> Medidas
          </button>
          <button onClick={() => setActiveTab('dobras')} className={`pb-3 text-xs md:text-sm font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'dobras' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400'}`}>
            <Layers size={16} /> Dobras
          </button>
          <button onClick={() => setActiveTab('bioquimicos')} className={`pb-3 text-xs md:text-sm font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'bioquimicos' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400'}`}>
            <Syringe size={16} /> Bioquímicos
          </button>
        </div>

        {/* CORPO FORMULÁRIO */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white">
          <form id="clinical-form" onSubmit={handleSubmit} className="space-y-8 pb-10">
            
            <div className="bg-stone-50 p-5 rounded-[1.5rem] border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-nutri-800" />
                <span className="text-sm font-bold text-stone-700 uppercase tracking-widest">Data da Avaliação</span>
              </div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full md:w-auto p-3 border border-stone-200 rounded-xl bg-white outline-none text-sm font-bold text-stone-800 focus:ring-2 focus:ring-nutri-800" />
            </div>

            {/* CONTEÚDO ANTROPOMETRIA */}
            {activeTab === 'antropometria' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 animate-fade-in">
                {[
                  { label: "Peso (kg)", name: "weight" }, { label: "Altura (m)", name: "height" },
                  { label: "Cintura (cm)", name: "waist" }, { label: "Quadril (cm)", name: "hip" },
                  { label: "Braço (cm)", name: "arm" }, { label: "Panturrilha (cm)", name: "calf" }, { label: "Pescoço (cm)", name: "neck" }
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">{field.label}</label>
                    <input type="number" step="0.01" name={field.name} value={antropometria[field.name] || ''} onChange={handleAntroChange} placeholder="0.00" className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50/50 focus:bg-white focus:border-nutri-800 outline-none text-sm font-bold" />
                  </div>
                ))}
              </div>
            )}

            {/* CONTEÚDO DOBRAS */}
            {activeTab === 'dobras' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 animate-fade-in">
                {[
                  { label: "Tricipital", name: "triceps" }, { label: "Bicipital", name: "biceps" },
                  { label: "Subescapular", name: "subscapular" }, { label: "Suprailíaca", name: "suprailiac" },
                  { label: "Abdominal", name: "abdominal" }, { label: "Coxa", name: "thigh" }, { label: "Panturrilha", name: "calf" }
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">{field.label} (mm)</label>
                    <input type="number" step="0.1" name={field.name} value={dobras[field.name] || ''} onChange={handleDobrasChange} placeholder="0.0" className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50/50 focus:bg-white focus:border-nutri-800 outline-none text-sm font-bold" />
                  </div>
                ))}
              </div>
            )}

            {/* CONTEÚDO BIOQUÍMICOS (COMPLETO E AGRUPADO) */}
            {activeTab === 'bioquimicos' && (
              <div className="space-y-8 animate-fade-in">
                {/* Grupo Metabólico */}
                <div className="bg-stone-50/30 p-6 rounded-3xl border border-stone-100">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><ChevronRight size={12}/> Glicêmico & Insulina</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: "Glicose", name: "glucose" }, { label: "Insulina", name: "insulin" }, { label: "HbA1c (%)", name: "hba1c" }
                    ].map(f => (
                      <div key={f.name}>
                        <label className="block text-[9px] font-black text-stone-400 uppercase mb-2">{f.label}</label>
                        <input type="number" step="0.01" name={f.name} value={bioquimicos[f.name] || ''} onChange={handleBioChange} className="w-full p-3 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-nutri-800" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grupo Lipídico */}
                <div className="bg-stone-50/30 p-6 rounded-3xl border border-stone-100">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><ChevronRight size={12}/> Perfil Lipídico</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Colest. Total", name: "total_cholesterol" }, { label: "HDL", name: "hdl" }, { label: "LDL", name: "ldl" }, { label: "Triglicérides", name: "triglycerides" }
                    ].map(f => (
                      <div key={f.name}>
                        <label className="block text-[9px] font-black text-stone-400 uppercase mb-2">{f.label}</label>
                        <input type="number" step="0.01" name={f.name} value={bioquimicos[f.name] || ''} onChange={handleBioChange} className="w-full p-3 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-nutri-800" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grupo Inflamatório e Órgãos */}
                <div className="bg-stone-50/30 p-6 rounded-3xl border border-stone-100">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><ChevronRight size={12}/> Inflamação & Órgãos</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: "Ferritina", name: "ferritin" }, { label: "PCR", name: "pcr" }, { label: "TGP (Fígado)", name: "tgp" }, { label: "Creatinina", name: "creatinine" }, { label: "Ureia", name: "urea" }
                    ].map(f => (
                      <div key={f.name}>
                        <label className="block text-[9px] font-black text-stone-400 uppercase mb-2">{f.label}</label>
                        <input type="number" step="0.01" name={f.name} value={bioquimicos[f.name] || ''} onChange={handleBioChange} className="w-full p-3 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-nutri-800" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grupo Vitaminas */}
                <div className="bg-stone-50/30 p-6 rounded-3xl border border-stone-100">
                  <p className="text-[10px] font-black text-nutri-800 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><ChevronRight size={12}/> Vitaminas & Hormonal</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: "Vitamina D", name: "vitamin_d" }, { label: "Vitamina B12", name: "vitamin_b12" }, { label: "TSH", name: "tsh" }, { label: "Ferro", name: "iron" }
                    ].map(f => (
                      <div key={f.name}>
                        <label className="block text-[9px] font-black text-stone-400 uppercase mb-2">{f.label}</label>
                        <input type="number" step="0.01" name={f.name} value={bioquimicos[f.name] || ''} onChange={handleBioChange} className="w-full p-3 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-nutri-800" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-stone-100 bg-stone-50/80 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] text-stone-400 italic text-center md:text-left">Os dados informados serão salvos no prontuário histórico do paciente.</p>
          <div className="flex gap-3 w-full md:w-auto">
            <button type="button" onClick={onClose} className="flex-1 md:flex-none px-6 py-4 rounded-2xl font-bold text-stone-500 hover:bg-stone-200 text-sm transition-all">Cancelar</button>
            <button type="submit" form="clinical-form" disabled={loading} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-nutri-900 text-white px-10 py-4 rounded-2xl text-sm font-bold hover:bg-nutri-800 transition-all shadow-lg shadow-nutri-900/20 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Avaliação
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}