'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Save, Loader2, Activity, Ruler, Syringe, Layers, Calendar } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[92vh] sm:h-auto sm:max-h-[90vh] animate-fade-in-up">
        
        {/* INDICADOR DE GAVETA (MOBILE ONLY) */}
        <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 mb-2 sm:hidden"></div>

        {/* HEADER DO MODAL */}
        <div className="flex justify-between items-center p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="bg-nutri-50 p-2.5 rounded-2xl text-nutri-800 border border-white shadow-sm">
              <Activity size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg md:text-xl text-stone-900 tracking-tight leading-tight">Avaliação Clínica</h3>
              <p className="text-xs md:text-sm text-stone-500 font-medium truncate max-w-[200px] md:max-w-none">Paciente: <span className="text-nutri-900 font-bold">{patientName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="bg-stone-100 text-stone-400 hover:text-stone-700 p-2.5 rounded-full transition-colors active:scale-90">
            <X size={20} />
          </button>
        </div>

        {/* NAVEGAÇÃO DE ABAS (TABS) - Scrollable no mobile */}
        <div className="flex overflow-x-auto border-b border-stone-100 px-6 pt-4 gap-4 md:gap-8 bg-stone-50/50 scrollbar-hide">
          <button onClick={() => setActiveTab('antropometria')} className={`pb-3 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'antropometria' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
            <Ruler size={16} /> Antropometria
          </button>
          <button onClick={() => setActiveTab('dobras')} className={`pb-3 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'dobras' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
            <Layers size={16} /> Dobras
          </button>
          <button onClick={() => setActiveTab('bioquimicos')} className={`pb-3 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'bioquimicos' ? 'border-nutri-800 text-nutri-900' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
            <Syringe size={16} /> Bioquímicos
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white">
          <form id="clinical-form" onSubmit={handleSubmit} className="space-y-8 pb-10">
            
            {/* DATA DA MEDIÇÃO (Estilizada Premium) */}
            <div className="bg-stone-50 p-5 rounded-[1.5rem] border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-nutri-800" />
                <span className="text-sm font-bold text-stone-700 uppercase tracking-widest">Data da Coleta/Exame</span>
              </div>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
                className="w-full md:w-auto p-3 border border-stone-200 rounded-xl bg-white focus:ring-4 focus:ring-nutri-800/10 focus:border-nutri-800 outline-none text-sm font-bold text-stone-800" 
              />
            </div>

            {/* ABA: ANTROPOMETRIA */}
            {activeTab === 'antropometria' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-5 animate-fade-in">
                {[
                  { label: "Peso (kg)", name: "weight" },
                  { label: "Altura (m)", name: "height" },
                  { label: "Cintura (cm)", name: "waist" },
                  { label: "Quadril (cm)", name: "hip" },
                  { label: "Braço (cm)", name: "arm" },
                  { label: "Panturrilha (cm)", name: "calf" },
                  { label: "Pescoço (cm)", name: "neck" },
                ].map((field) => (
                  <div key={field.name} className="flex flex-col">
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">{field.label}</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      name={field.name} 
                      value={antropometria[field.name] || ''} 
                      onChange={handleAntroChange} 
                      placeholder="0.00"
                      className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none transition-all text-sm font-bold" 
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ABA: DOBRAS CUTÂNEAS */}
            {activeTab === 'dobras' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-5 animate-fade-in">
                {[
                  { label: "Tricipital (mm)", name: "triceps" },
                  { label: "Bicipital (mm)", name: "biceps" },
                  { label: "Subescap. (mm)", name: "subscapular" },
                  { label: "Suprailíaca (mm)", name: "suprailiac" },
                  { label: "Abdominal (mm)", name: "abdominal" },
                  { label: "Coxa (mm)", name: "thigh" },
                  { label: "Pantu. (mm)", name: "calf" },
                ].map((field) => (
                  <div key={field.name} className="flex flex-col">
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">{field.label}</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      name={field.name} 
                      value={dobras[field.name] || ''} 
                      onChange={handleDobrasChange} 
                      placeholder="0.0"
                      className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none transition-all text-sm font-bold" 
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ABA: BIOQUÍMICOS */}
            {activeTab === 'bioquimicos' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-5 animate-fade-in">
                {[
                  { label: "Glicose", name: "glucose" },
                  { label: "HbA1c (%)", name: "hba1c" },
                  { label: "Colest. Total", name: "total_cholesterol" },
                  { label: "HDL", name: "hdl" },
                  { label: "LDL", name: "ldl" },
                  { label: "Triglicérides", name: "triglycerides" },
                  { label: "Vitamina D", name: "vitamin_d" },
                  { label: "Ferro", name: "iron" },
                  { label: "Creatinina", name: "creatinine" },
                ].map((field) => (
                  <div key={field.name} className="flex flex-col">
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">{field.label}</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      name={field.name} 
                      value={bioquimicos[field.name] || ''} 
                      onChange={handleBioChange} 
                      placeholder="0.00"
                      className="w-full p-4 border border-stone-200 rounded-2xl bg-stone-50/50 hover:bg-stone-50 focus:bg-white focus:border-nutri-800 focus:ring-4 focus:ring-nutri-800/10 outline-none transition-all text-sm font-bold" 
                    />
                  </div>
                ))}
              </div>
            )}

          </form>
        </div>

        {/* FOOTER DO MODAL */}
        <div className="p-6 border-t border-stone-100 bg-stone-50/80 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] md:text-xs text-stone-400 italic text-center md:text-left leading-tight">Campos vazios serão ignorados.<br className="hidden md:block"/> Preencha apenas o que coletou.</p>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 md:flex-none px-6 py-4 rounded-2xl font-bold text-stone-500 hover:bg-stone-200 transition-colors text-sm active:scale-95"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              form="clinical-form" 
              disabled={loading} 
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-nutri-900 text-white px-8 py-4 rounded-2xl text-sm font-bold hover:bg-nutri-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}