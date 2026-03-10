'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Save, Loader2, Activity, Ruler, Syringe, Layers } from 'lucide-react';

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

  // Estados separados para cada grupo de dados
  const [antropometria, setAntropometria] = useState<any>({});
  const [dobras, setDobras] = useState<any>({});
  const [bioquimicos, setBioquimicos] = useState<any>({});

  const supabase = createClient();

  if (!isOpen) return null;

  const handleAntroChange = (e: React.ChangeEvent<HTMLInputElement>) => setAntropometria({ ...antropometria, [e.target.name]: e.target.value });
  const handleDobrasChange = (e: React.ChangeEvent<HTMLInputElement>) => setDobras({ ...dobras, [e.target.name]: e.target.value });
  const handleBioChange = (e: React.ChangeEvent<HTMLInputElement>) => setBioquimicos({ ...bioquimicos, [e.target.name]: e.target.value });

  // Função para limpar campos vazios antes de enviar ao banco
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
      // Salva Antropometria se houver dados
      if (Object.keys(antroData).length > 0) {
        const { error } = await supabase.from('anthropometry').insert([{ user_id: patientId, measurement_date: date, ...antroData }]);
        if (error) throw new Error("Erro Antropometria: " + error.message);
      }

      // Salva Dobras se houver dados
      if (Object.keys(dobrasData).length > 0) {
        const { error } = await supabase.from('skinfolds').insert([{ user_id: patientId, measurement_date: date, ...dobrasData }]);
        if (error) throw new Error("Erro Dobras: " + error.message);
      }

      // Salva Bioquímicos se houver dados
      if (Object.keys(bioData).length > 0) {
        const { error } = await supabase.from('biochemicals').insert([{ user_id: patientId, exam_date: date, ...bioData }]);
        if (error) throw new Error("Erro Bioquímicos: " + error.message);
      }

      alert("Avaliação registrada com sucesso!");
      // Limpa os dados e fecha
      setAntropometria({}); setDobras({}); setBioquimicos({});
      onClose();

    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER DO MODAL */}
        <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="bg-nutri-100 p-2.5 rounded-xl text-nutri-800">
              <Activity size={24} />
            </div>
            <div>
              <h3 className="font-bold text-xl text-stone-900 tracking-tight">Avaliação Clínica</h3>
              <p className="text-sm text-stone-500 font-medium">Paciente: <span className="text-nutri-900">{patientName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 hover:bg-stone-200 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* NAVEGAÇÃO DE ABAS (TABS) */}
        <div className="flex border-b border-stone-100 px-6 pt-4 gap-6 bg-stone-50">
          <button onClick={() => setActiveTab('antropometria')} className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'antropometria' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
            <Ruler size={16} /> Antropometria
          </button>
          <button onClick={() => setActiveTab('dobras')} className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'dobras' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
            <Layers size={16} /> Dobras Cutâneas
          </button>
          <button onClick={() => setActiveTab('bioquimicos')} className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'bioquimicos' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
            <Syringe size={16} /> Bioquímicos
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <div className="p-8 overflow-y-auto flex-1">
          <form id="clinical-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* DATA DA MEDIÇÃO (Aparece em todas as abas) */}
            <div className="mb-6 bg-stone-50 p-4 rounded-xl border border-stone-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-700">Data da Coleta/Exame:</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="p-2 border border-stone-200 rounded-lg bg-white focus:ring-2 focus:ring-nutri-800 outline-none text-sm font-medium" />
            </div>

            {/* ABA: ANTROPOMETRIA */}
            {activeTab === 'antropometria' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 animate-fade-in">
                {[
                  { label: "Peso (kg)", name: "weight" },
                  { label: "Altura (m)", name: "height" },
                  { label: "Cintura (cm)", name: "waist" },
                  { label: "Quadril (cm)", name: "hip" },
                  { label: "Braço (cm)", name: "arm" },
                  { label: "Panturrilha (cm)", name: "calf" },
                  { label: "Pescoço (cm)", name: "neck" },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">{field.label}</label>
                    <input type="number" step="0.01" name={field.name} value={antropometria[field.name] || ''} onChange={handleAntroChange} className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:border-nutri-800 focus:ring-2 focus:ring-nutri-800/20 outline-none transition-all text-sm" />
                  </div>
                ))}
              </div>
            )}

            {/* ABA: DOBRAS CUTÂNEAS */}
            {activeTab === 'dobras' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 animate-fade-in">
                {[
                  { label: "Tricipital (mm)", name: "triceps" },
                  { label: "Bicipital (mm)", name: "biceps" },
                  { label: "Subescapular (mm)", name: "subscapular" },
                  { label: "Suprailíaca (mm)", name: "suprailiac" },
                  { label: "Abdominal (mm)", name: "abdominal" },
                  { label: "Coxa (mm)", name: "thigh" },
                  { label: "Panturrilha (mm)", name: "calf" },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">{field.label}</label>
                    <input type="number" step="0.1" name={field.name} value={dobras[field.name] || ''} onChange={handleDobrasChange} className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:border-nutri-800 focus:ring-2 focus:ring-nutri-800/20 outline-none transition-all text-sm" />
                  </div>
                ))}
              </div>
            )}

            {/* ABA: BIOQUÍMICOS */}
            {activeTab === 'bioquimicos' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 animate-fade-in">
                {[
                  { label: "Glicose", name: "glucose" },
                  { label: "HbA1c (%)", name: "hba1c" },
                  { label: "Colest. Total", name: "total_cholesterol" },
                  { label: "HDL", name: "hdl" },
                  { label: "LDL", name: "ldl" },
                  { label: "Triglicerídeos", name: "triglycerides" },
                  { label: "Vitamina D", name: "vitamin_d" },
                  { label: "Ferro", name: "iron" },
                  { label: "Creatinina", name: "creatinine" },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">{field.label}</label>
                    <input type="number" step="0.01" name={field.name} value={bioquimicos[field.name] || ''} onChange={handleBioChange} className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:border-nutri-800 focus:ring-2 focus:ring-nutri-800/20 outline-none transition-all text-sm" />
                  </div>
                ))}
              </div>
            )}

          </form>
        </div>

        {/* FOOTER DO MODAL */}
        <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-between items-center">
          <p className="text-xs text-stone-400 italic">Preencha apenas os campos desejados. O resto será ignorado.</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-medium text-stone-600 hover:bg-stone-200 transition-colors text-sm">
              Cancelar
            </button>
            <button type="submit" form="clinical-form" disabled={loading} className="flex items-center gap-2 bg-nutri-900 text-white px-8 py-3 rounded-xl text-sm font-medium hover:bg-nutri-800 transition-all shadow-md hover:shadow-lg">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Avaliação
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}