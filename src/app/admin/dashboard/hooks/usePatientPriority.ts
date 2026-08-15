'use client';

import { useMemo } from 'react';
import { Patient } from '../types';

export interface PatientScore {
  total: number;
  engagement: number;
  recency: number;
  adherence: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedAction: string;
}

export function calculatePatientScore(patient: Patient, usage: number): PatientScore {
  // 1. Engagement Score (0-100)
  const engagementScore = Math.min(usage * 6.66, 100); // 15+ msgs = 100
  
  // 2. Recency Score (0-100)
  let recencyScore = 100;
  if (patient.is_late) {
    recencyScore = 0;
  } else if (patient.days_since_last) {
    recencyScore = Math.max(0, 100 - (patient.days_since_last * 14));
  }
  
  // 3. Adherence Score (0-100)
  let adherenceScore = 50; // neutral start
  if (patient.meal_plan && patient.meal_plan.length > 0) {
    adherenceScore = 70;
  }
  if (patient.messages_today && patient.messages_today > 0) {
    adherenceScore = Math.min(adherenceScore + 10, 100);
  }
  
  // 4. Weighted Total
  const total = (engagementScore * 0.4) + (recencyScore * 0.35) + (adherenceScore * 0.25);
  
  // 5. Risk Level
  let risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  let suggestedAction = '';
  
  if (patient.is_late || total < 20) {
    risk = 'CRITICAL';
    suggestedAction = '💰 Cobrar imediatamente via WhatsApp';
  } else if (total < 40) {
    risk = 'HIGH';
    suggestedAction = '📞 Contatar para reengajamento';
  } else if (!patient.meal_plan || patient.meal_plan.length === 0) {
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

export function usePatientScore(patients: Patient[], usageStats: Record<string, number>) {
  const patientsWithScore = useMemo(() => {
    return patients.map(patient => {
      const usage = usageStats[patient.id] || 0;
      const score = calculatePatientScore(patient, usage);
      return {
        ...patient,
        score,
        priority: score.risk // sync with priority system
      };
    });
  }, [patients, usageStats]);
  
  const criticalPatients = useMemo(() => 
    patientsWithScore.filter(p => p.score.risk === 'CRITICAL'), 
    [patientsWithScore]
  );
  
  const autoActions = useMemo(() => {
    return criticalPatients.map(p => ({
      patientId: p.id,
      patientName: p.full_name,
      action: p.score.suggestedAction,
      phone: p.phone
    }));
  }, [criticalPatients]);
  
  return {
    patientsWithScore,
    autoActions,
    criticalCount: criticalPatients.length
  };
}