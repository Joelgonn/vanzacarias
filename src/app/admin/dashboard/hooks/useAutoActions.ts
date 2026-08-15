'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Patient, PatientScore } from '../types';

// Mapa para controlar notificações já enviadas (evitar spam)
const notifiedPatients = new Map<string, number>();

interface PriorityChangeRecord {
  patientId: string;
  patientName: string;
  from: string;
  to: string;
  timestamp: number;
}

/**
 * Hook que gerencia ações automáticas baseadas no score do paciente
 * 
 * @param patients - Lista de pacientes com score calculado
 * @param onSendReminder - Callback opcional para enviar lembrete automático
 */
export function useAutoActions(
  patients: Array<Patient & { score: PatientScore }>,
  onSendReminder?: (patientId: string, phone: string) => void
) {
  const previousPriorities = useRef<Map<string, string>>(new Map());
  
  // 1. Detectar mudanças de prioridade e disparar notificações
  useEffect(() => {
    patients.forEach(patient => {
      const currentPriority = patient.score.risk;
      const oldPriority = previousPriorities.current.get(patient.id);
      
      // Se houve mudança de prioridade
      if (oldPriority && oldPriority !== currentPriority) {
        const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const isWorsening = priorityOrder[currentPriority] > priorityOrder[oldPriority as keyof typeof priorityOrder];
        
        // Se a situação piorou (ex: MEDIUM → CRITICAL)
        if (isWorsening) {
          toast.warning(`⚠️ ${patient.full_name} entrou em estado ${currentPriority}`, {
            description: patient.score.suggestedAction,
            duration: 5000,
            action: {
              label: 'Ver agora',
              onClick: () => {
                const element = document.getElementById(`patient-${patient.id}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element?.classList.add('animate-pulse-ring');
                setTimeout(() => element?.classList.remove('animate-pulse-ring'), 1000);
              }
            }
          });
        }
        
        // Salvar mudança no localStorage para histórico
        const updates: PriorityChangeRecord[] = JSON.parse(localStorage.getItem('priority-changes') || '[]');
        updates.push({
          patientId: patient.id,
          patientName: patient.full_name,
          from: oldPriority,
          to: currentPriority,
          timestamp: Date.now()
        });
        localStorage.setItem('priority-changes', JSON.stringify(updates.slice(-20)));
      }
      
      // Atualizar o mapa de prioridades anteriores
      previousPriorities.current.set(patient.id, currentPriority);
    });
  }, [patients]);
  
  // 2. Enviar lembretes automáticos para pacientes críticos (a cada hora)
  useEffect(() => {
    const criticalPatients = patients.filter(p => p.score.risk === 'CRITICAL');
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    
    criticalPatients.forEach(patient => {
      const lastNotified = notifiedPatients.get(patient.id) || 0;
      
      // Notificar a cada hora para pacientes críticos
      if (now - lastNotified > ONE_HOUR) {
        notifiedPatients.set(patient.id, now);
        
        // Log no console para debug
        console.log(`[AUTO-ACTION] ${patient.full_name} - ${patient.score.suggestedAction}`);
        
        // Se tem telefone e callback, mostrar notificação para enviar lembrete
        if (patient.phone && onSendReminder) {
          toast.info(`📱 ${patient.full_name} - Lembrete pendente`, {
            description: 'Clique para enviar cobrança automática via WhatsApp',
            duration: 8000,
            action: {
              label: 'Enviar',
              onClick: () => onSendReminder(patient.id, patient.phone!)
            }
          });
        } else if (patient.phone) {
          // Se não tem callback, apenas mostrar notificação
          toast.info(`📱 ${patient.full_name} - Atenção necessária`, {
            description: patient.score.suggestedAction,
            duration: 6000
          });
        }
      }
    });
  }, [patients, onSendReminder]);
  
  // 3. Retornar flag indicando que o sistema está ativo
  return {
    watchPriorityChanges: true,
    autoActionsEnabled: true
  };
}