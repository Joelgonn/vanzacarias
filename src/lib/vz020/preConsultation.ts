import type { PreConsultInput, PreConsultResult } from './types';

// VZ-020 — Pré-consulta "O que mudou?" determinístico, sem inferência clínica
export function buildPreConsult(input: PreConsultInput): PreConsultResult {
  const items: string[] = [];

  // Peso
  if (input.lastCheckin?.peso && input.previousCheckin?.peso) {
    if (input.lastCheckin.peso !== input.previousCheckin.peso) {
      items.push(`Peso registrado passou de ${input.previousCheckin.peso} kg para ${input.lastCheckin.peso} kg`);
    } else {
      items.push(`Peso registrado manteve ${input.lastCheckin.peso} kg`);
    }
  } else if (input.lastCheckin?.peso) {
    items.push(`Peso registrado: ${input.lastCheckin.peso} kg (sem anterior para comparar)`);
  } else {
    items.push('Peso: sem registro para comparar');
  }

  // Cintura
  if (input.lastCheckin?.cintura && input.previousCheckin?.cintura && input.lastCheckin.cintura !== input.previousCheckin.cintura) {
    items.push(`Cintura registrada passou de ${input.previousCheckin.cintura} para ${input.lastCheckin.cintura}`);
  }

  // Adesão
  if (typeof input.lastCheckin?.adesao_ao_plano === 'number') {
    items.push(`Adesão registrada no último check-in: ${input.lastCheckin.adesao_ao_plano}/5`);
    if (typeof input.previousCheckin?.adesao_ao_plano === 'number' && input.previousCheckin.adesao_ao_plano !== input.lastCheckin.adesao_ao_plano) {
      items.push(`Adesão anterior: ${input.previousCheckin.adesao_ao_plano}/5`);
    }
  } else {
    items.push('Adesão: sem registro');
  }

  // Check-in data
  if (input.lastCheckin?.created_at) {
    items.push(`Último check-in em ${new Date(input.lastCheckin.created_at).toLocaleDateString('pt-BR')}`);
    items.push(`Check-in semanal: ${input.isCheckinDoneThisWeek ? 'em dia' : 'pendente'}`);
  } else {
    items.push('Sem check-in registrado');
  }

  // Hidratação
  if (typeof input.dailyLogToday?.water_ml === 'number') {
    items.push(`Hidratação hoje: ${input.dailyLogToday.water_ml} ml`);
  } else {
    items.push('Hidratação hoje: sem registro');
  }

  // Humor
  if (input.dailyLogToday?.mood) {
    items.push(`Humor hoje: ${input.dailyLogToday.mood}`);
  }

  const hasChanges = items.length > 0;
  return { title: 'O que mudou desde a última consulta?', items, hasChanges };
}
