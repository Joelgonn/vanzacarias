'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

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
  // Estados para controle da UI
  const [uploading, setUploading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. Validação de presença de arquivo
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];
    
    // 2. Validação de tipo de arquivo (Apenas PDF)
    if (file.type !== 'application/pdf') {
      setError('O arquivo deve ser um PDF.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    // 3. Definição do nome do arquivo (Caminho organizado por ID)
    const fileExt = file.name.split('.').pop();
    const fileName = `${patientId}/plano-atual.${fileExt}`;

    try {
      // 4. Upload para o Storage (Upsert: true permite sobrescrever o arquivo do paciente caso já exista)
      const { error: uploadError } = await supabase.storage
        .from('planos-alimentares')
        .upload(fileName, file, {
          cacheControl: '0',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Erro ao enviar arquivo para o storage: ${uploadError.message}`);
      }

      // 5. Recuperar a URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from('planos-alimentares')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 6. Persistir no banco de dados (Tabela 'plans')
      // Utilizamos o upsert para garantir que, se o paciente já tiver um plano, ele apenas seja atualizado
      const { error: dbError } = await supabase
        .from('plans')
        .upsert(
          { 
            user_id: patientId, 
            file_url: publicUrl,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      if (dbError) {
        throw new Error(`Erro ao registrar plano no banco de dados: ${dbError.message}`);
      }

      // 7. Atualizar o status do paciente para 'plano_liberado' na tabela 'profiles'
      const { error: statusError } = await supabase
        .from('profiles')
        .update({ status: 'plano_liberado' })
        .eq('id', patientId);

      if (statusError) {
        throw new Error(`Erro ao atualizar status do paciente: ${statusError.message}`);
      }

      // 8. Finalização e feedback
      setSuccess(true);
      onUpdate(); // Atualiza a lista na tela de administração
      
      // Limpeza do feedback de sucesso após 3 segundos
      setTimeout(() => setSuccess(false), 3000);

    } catch (err: any) {
      console.error("Erro completo no processo de upload:", err);
      setError(err.message || 'Ocorreu um erro desconhecido durante o upload.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className={`
        flex items-center justify-center gap-2 cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
        ${uploading 
          ? 'bg-stone-200 text-stone-500 cursor-not-allowed' 
          : 'bg-nutri-800 text-white hover:bg-nutri-900 shadow-sm hover:shadow-md'
        }
      `}>
        {uploading ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            <span>Enviando...</span>
          </>
        ) : success ? (
          <>
            <CheckCircle2 size={16} />
            <span>Sucesso!</span>
          </>
        ) : (
          <>
            <Upload size={16} />
            <span>Enviar Plano</span>
          </>
        )}
        
        <input 
          type="file" 
          className="hidden" 
          accept="application/pdf" 
          onChange={handleUpload} 
          disabled={uploading} 
        />
      </label>

      {/* Exibição de Erros */}
      {error && (
        <div className="flex items-center gap-1 text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-100">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}