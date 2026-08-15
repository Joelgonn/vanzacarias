'use client';

import { useMemo } from 'react';
import { Patient } from '../types';

export type RetentionStatus = 'active' | 'at_risk' | 'inactive';

export interface RetentionMetrics {
  active: number;
  atRisk: number;
  inactive: number;
  total: number;
  retentionRate: number;
  churnRisk: number;
}

/**
 * Calcula o status de retenção de um paciente baseado em days_since_last
 * days_since_last vem da VIEW admin_dashboard
 */
export function getRetentionStatus(daysSinceLast: number | null | undefined): RetentionStatus {
  // Se não tem nenhum registro, considera inativo
  if (daysSinceLast === null || daysSinceLast === undefined) {
    return 'inactive';
  }
  
  if (daysSinceLast <= 7) return 'active';
  if (daysSinceLast <= 14) return 'at_risk';
  return 'inactive';
}

/**
 * Hook que calcula métricas de retenção baseadas em days_since_last
 * 
 * @param patients - Lista de pacientes com o campo days_since_last (vindo da VIEW)
 * @returns Métricas de retenção
 */
export function useRetentionMetrics(patients: Patient[]) {
  return useMemo(() => {
    let active = 0;
    let atRisk = 0;
    let inactive = 0;
    
    for (const patient of patients) {
      const status = getRetentionStatus(patient.days_since_last);
      
      if (status === 'active') {
        active++;
      } else if (status === 'at_risk') {
        atRisk++;
      } else {
        inactive++;
      }
    }
    
    const total = patients.length;
    
    // Retenção = % de pacientes ativos nos últimos 7 dias
    const retentionRate = total > 0 ? Math.round((active / total) * 100) : 0;
    
    // Risco de Churn = % de pacientes inativos + % em risco (8+ dias sem atividade)
    const churnRisk = total > 0 ? Math.round(((inactive + atRisk) / total) * 100) : 0;
    
    return {
      active,
      atRisk,
      inactive,
      total,
      retentionRate,
      churnRisk
    };
  }, [patients]);
}