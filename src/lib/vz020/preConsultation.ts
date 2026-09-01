import type { PreConsultInput, PreConsultResult } from './types';

// VZ-022 — Pré-consulta "O que mudou?" determinístico, sem inferência clínica
// Responde: "O que mudou desde a última consulta?"
// Nunca inferir melhora/piora. Quando sem dados suficientes: mensagem canônica.

function fmt(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return null;
  }
}

export function buildPreConsult(input: PreConsultInput): PreConsultResult {
  const hasPrev = !!input.previousCheckin;
  const items: string[] = [];

  // Se não há anterior comparável, mensagem canônica única por seção faltante
  if (!hasPrev) {
    return {
      title: 'O que mudou desde a última consulta?',
      items: ['Sem registro anterior suficiente para comparação.'],
      hasChanges: false,
    };
  }

  const prev = input.previousCheckin!;
  const last = input.lastCheckin;

  // Peso: X → Y ou manter
  if (last?.peso && prev.peso) {
    if (last.peso !== prev.peso) {
      items.push(`Peso: ${prev.peso} → ${last.peso} kg`);
    } else {
      items.push(`Peso: manteve ${last.peso} kg`);
    }
  } else if (last?.peso) {
    items.push(`Peso: ${last.peso} kg (sem anterior para comparar)`);
  } else if (prev.peso) {
    items.push(`Peso: sem registro atual para comparar (anterior ${prev.peso} kg)`);
  } else {
    items.push('Peso: sem registro para comparar');
  }

  // Adesão: X → Y
  if (typeof last?.adesao_ao_plano === 'number' && typeof prev.adesao_ao_plano === 'number') {
    if (last.adesao_ao_plano !== prev.adesao_ao_plano) {
      items.push(`Adesão: ${prev.adesao_ao_plano} → ${last.adesao_ao_plano}/5`);
    } else {
      items.push(`Adesão: manteve ${last.adesao_ao_plano}/5`);
    }
  } else if (typeof last?.adesao_ao_plano === 'number') {
    items.push(`Adesão registrada no último check-in: ${last.adesao_ao_plano}/5`);
  } else if (typeof prev.adesao_ao_plano === 'number') {
    items.push(`Adesão: sem registro atual (anterior ${prev.adesao_ao_plano}/5)`);
  } else {
    items.push('Adesão: sem registro');
  }

  // Humor: semanal X → Y se existir
  if (typeof last?.humor_semanal === 'number' || typeof (prev as unknown as { humor_semanal?: number | null }).humor_semanal === 'number') {
    const ph = (prev as unknown as { humor_semanal?: number | null }).humor_semanal ?? null;
    if (typeof last?.humor_semanal === 'number' && typeof ph === 'number') {
      items.push(`Humor: ${ph} → ${last.humor_semanal}/5`);
    } else if (typeof last?.humor_semanal === 'number') {
      items.push(`Humor registrado: ${last.humor_semanal}/5`);
    } else if (typeof ph === 'number') {
      items.push(`Humor: sem registro atual (anterior ${ph}/5)`);
    }
  }

  // Hidratação (dailyLog)
  if (typeof input.dailyLogToday?.water_ml === 'number') {
    items.push(`Hidratação hoje: ${input.dailyLogToday.water_ml} ml`);
  } else {
    items.push('Hidratação hoje: sem registro');
  }

  // Cintura se existir
  if (last?.cintura && prev.cintura) {
    if (last.cintura !== prev.cintura) items.push(`Cintura: ${prev.cintura} → ${last.cintura}`);
    else items.push(`Cintura: manteve ${last.cintura}`);
  }

  // Data do último check-in
  if (last?.created_at) {
    const d = fmt(last.created_at);
    items.push(`Último check-in em ${d ?? last.created_at}`);
    items.push(`Check-in semanal: ${input.isCheckinDoneThisWeek ? 'em dia' : 'pendente'}`);
  } else {
    items.push('Sem check-in registrado');
  }

  // Se só houver mensagens genéricas de ausência, trocar por canônica
  const allEmpty = items.every((i) => i.includes('sem registro') || i.includes('Sem registro'));
  if (allEmpty && items.length <= 2) {
    return {
      title: 'O que mudou desde a última consulta?',
      items: ['Sem registro anterior suficiente para comparação.'],
      hasChanges: false,
    };
  }

  const hasChanges = items.some((i) => i.includes('→') || i.includes('manteve'));
  return { title: 'O que mudou desde a última consulta?', items, hasChanges };
}
