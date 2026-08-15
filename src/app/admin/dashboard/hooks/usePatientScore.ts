'use client';

import { useMemo } from 'react';
import { Patient, PatientScore, PatientPriority } from '../types';
import { getRetentionStatus } from './useRetentionMetrics';

/**
 * Calcula o score completo de um paciente
 * 
 * @param patient - Paciente com dados da VIEW
 * @param usage - Número de mensagens do paciente hoje
 * @returns Score calculado
 */
export function calculatePatientScore(patient: Patient, usage: number): PatientScore {
  // 1. Engagement Score (0-100) - baseado em mensagens do dia
  const engagementScore = Math.min(usage * 6.66, 100);
  
  // 2. Recency Score (0-100) - baseado em days_since_last da VIEW
  let recencyScore = 100;
  const daysSinceLast = patient.days_since_last;
  
  if (daysSinceLast === null || daysSinceLast === undefined) {
    recencyScore = 0;
  } else if (daysSinceLast <= 1) {
    recencyScore = 100;
  } else if (daysSinceLast <= 3) {
    recencyScore = 80;
  } else if (daysSinceLast <= 7) {
    recencyScore = 50;
  } else if (daysSinceLast <= 14) {
    recencyScore = 20;
  } else {
    recencyScore = 0;
  }
  
  // 3. Adherence Score (0-100) - baseado em plano alimentar
  let adherenceScore = 30; // base baixa sem plano
  
  if (patient.meal_plan && Array.isArray(patient.meal_plan) && patient.meal_plan.length > 0) {
    adherenceScore = 70;
  }
  
  // Se tem mensagens hoje, aumenta adesão
  if (usage > 0) {
    adherenceScore = Math.min(adherenceScore + 15, 100);
  }
  
  // Se tem checkin recente (days_since_last <= 3), aumenta adesão
  if (daysSinceLast !== undefined && daysSinceLast !== null && daysSinceLast <= 3) {
    adherenceScore = Math.min(adherenceScore + 15, 100);
  }
  
  // 4. Weighted Total (pesos ajustados)
  const total = (engagementScore * 0.35) + (recencyScore * 0.40) + (adherenceScore * 0.25);
  
  // 5. Risk Level e Suggested Action
  let risk: PatientPriority = 'LOW';
  let suggestedAction = '';
  
  // Verifica se está inativo (mais de 14 dias)
  const retentionStatus = getRetentionStatus(patient.days_since_last);
  
  if (retentionStatus === 'inactive' || total < 20) {
    risk = 'CRITICAL';
    suggestedAction = '💰 Cobrar imediatamente via WhatsApp';
  } else if (retentionStatus === 'at_risk' || total < 40) {
    risk = 'HIGH';
    suggestedAction = '📞 Contatar para reengajamento';
  } else if (!patient.meal_plan || (Array.isArray(patient.meal_plan) && patient.meal_plan.length === 0)) {
    risk = 'MEDIUM';
    suggestedAction = '🍽️ Montar plano alimentar';
  } else if (total < 70) {
    risk = 'MEDIUM';
    suggestedAction = '📊 Revisar progresso esta semana';
  } else {
    risk = 'LOW';
    suggestedAction = '✅ Acompanhamento normal';
  }
  
  return {
    total: Math.round(total),
    engagement: Math.round(engagementScore),
    recency: Math.round(recencyScore),
    adherence: Math.round(adherenceScore),
    risk,
    suggestedAction
  };
}

/**
 * Hook que enriquece pacientes com score calculado
 * 
 * @param patients - Lista de pacientes
 * @param usageStats - Mapa de uso de mensagens por paciente
 * @returns Pacientes com score e contagem de críticos
 */
export function usePatientScore(patients: Patient[], usageStats: Record<string, number>) {
  const patientsWithScore = useMemo(() => {
    return patients.map(patient => {
      const usage = usageStats[patient.id] || 0;
      const score = calculatePatientScore(patient, usage);
      return {
        ...patient,
        score,
        priority: score.risk
      };
    });
  }, [patients, usageStats]);
  
  const criticalCount = useMemo(() => 
    patientsWithScore.filter(p => p.score?.risk === 'CRITICAL').length, 
    [patientsWithScore]
  );
  
  const autoActions = useMemo(() => {
    return patientsWithScore
      .filter(p => p.score?.risk === 'CRITICAL' || p.score?.risk === 'HIGH')
      .map(p => ({
        patientId: p.id,
        patientName: p.full_name,
        action: p.score?.suggestedAction || '',
        phone: p.phone
      }));
  }, [patientsWithScore]);
  
  return {
    patientsWithScore,
    autoActions,
    criticalCount
  };
}