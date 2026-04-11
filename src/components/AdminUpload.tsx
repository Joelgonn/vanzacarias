'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

/**
 * AdminUpload.tsx
 * Componente completo para gerenciamento de upload de planos alimentares.
 * Responsável por: Upload para Storage, Registro no Banco (plans) e Atualização de Status (profiles).
 */

export default function AdminUpload({ 
  patientId, 
  onUpdate 
}: { 
  patientId: string, 
  onUpdate: () => void 
}) {
  const [uploading, setUploading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      e.target.value = '';
      return;
    }

    const file = e.target.files[0];
    
    const isPdf = file.type === 'application/pdf' && file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      e.target.value = '';
      setError('O arquivo selecionado não é válido. Por favor, envie apenas PDF.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    const fileExt = file.name.split('.').pop();
    const fileName = `${patientId}/plano-atual.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('planos-alimentares')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Erro ao enviar arquivo para o storage: ${uploadError.message}`);
      }

      const { error: dbError } = await supabase
        .from('plans')
        .upsert(
          { 
            user_id: patientId, 
            file_url: fileName,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      if (dbError) {
        throw new Error(`Erro ao registrar plano no banco de dados: ${dbError.message}`);
      }

      const { error: statusError } = await supabase
        .from('profiles')
        .update({ status: 'plano_liberado' })
        .eq('id', patientId);

      if (statusError) {
        throw new Error(`Erro ao atualizar status do paciente: ${statusError.message}`);
      }

      setSuccess(true);
      onUpdate(); 
      
      setTimeout(() => setSuccess(false), 4000);

    } catch (err: any) {
      console.error("Erro completo no processo de upload:", err);
      setError(err.message || 'Ocorreu um erro desconhecido durante o upload.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full sm:w-auto">
      <label className={`
        relative group flex items-center justify-center gap-2.5 cursor-pointer px-6 py-4 md:py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 active:scale-[0.97] overflow-hidden min-w-[210px] select-none
        ${uploading 
          ? 'bg-stone-50 text-stone-400 cursor-wait border border-stone-200/80 shadow-inner' 
          : success
          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_8px_20px_rgba(16,185,129,0.25)] border border-emerald-400/50 hover:-translate-y-0.5'
          : 'bg-nutri-800 hover:bg-nutri-900 text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)] border border-white/10 hover:-translate-y-0.5'
        }
      `}>
        
        {/* Efeito de brilho animado no hover (visível apenas no estado padrão) */}
        {!uploading && !success && (
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        )}

        {uploading ? (
          <div className="flex items-center gap-2.5 animate-pulse">
            <Loader2 className="animate-spin text-stone-400" size={18} strokeWidth={2.5} />
            <span className="tracking-tight text-stone-500">Processando...</span>
          </div>
        ) : success ? (
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={20} strokeWidth={2.5} className="animate-in zoom-in duration-300 drop-shadow-sm" />
            <span className="tracking-tight drop-shadow-sm">Plano Liberado!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Upload size={18} strokeWidth={2.5} className="group-hover:-translate-y-0.5 transition-transform duration-300" />
            <span className="tracking-tight">Enviar Plano</span>
            <span className="flex items-center gap-1 text-[9px] font-black bg-white/20 px-1.5 py-0.5 rounded-md text-white ml-1 uppercase tracking-wider backdrop-blur-sm shadow-inner">
              <FileText size={10} strokeWidth={3} /> PDF
            </span>
          </div>
        )}
        
        <input 
          type="file" 
          className="hidden" 
          accept="application/pdf" 
          onChange={handleUpload} 
          disabled={uploading} 
        />
      </label>

      {/* Exibição de Erros Premium */}
      {error && (
        <div className="flex items-start gap-3 text-xs md:text-sm text-rose-600 bg-rose-50/80 backdrop-blur-md p-4 rounded-2xl border border-rose-100/80 shadow-[0_4px_14px_rgba(225,29,72,0.05)] animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" strokeWidth={2.5} />
          <span className="font-medium leading-relaxed">{error}</span>
        </div>
      )}
    </div>
  );
}
