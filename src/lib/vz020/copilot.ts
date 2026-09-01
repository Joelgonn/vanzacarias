import type { CopilotInput, CopilotResult } from './types';

// VZ-020 — Copiloto determinístico, sem diagnóstico, sem score
export function buildCopilot(input: CopilotInput): CopilotResult {
  const name = input.profile?.full_name?.split(' ')[0] || 'Paciente';
  const sections: CopilotResult['sections'] = [];
  let hasData = false;

  // EVOLUÇÃO
  {
    const lines: string[] = [];
    if (input.lastCheckin?.peso) {
      lines.push(`Peso registrado: ${input.lastCheckin.peso} kg`);
      hasData = true;
      if (input.previousCheckin?.peso && input.lastCheckin.peso !== input.previousCheckin.peso) {
        lines.push(`Anterior: ${input.previousCheckin.peso} kg`);
      }
    } else {
      lines.push('Peso: sem registro');
    }
    lines.push(`Check-ins: ${input.checkinsCount}`);
    if (input.lastCheckin?.created_at) {
      lines.push(`Último check-in: ${new Date(input.lastCheckin.created_at).toLocaleDateString('pt-BR')}`);
      hasData = true;
    }
    sections.push({ title: 'Evolução', lines });
  }

  // ADESÃO
  {
    const lines: string[] = [];
    if (typeof input.lastCheckin?.adesao_ao_plano === 'number') {
      lines.push(`Adesão registrada: ${input.lastCheckin.adesao_ao_plano}/5`);
      hasData = true;
      if (typeof input.previousCheckin?.adesao_ao_plano === 'number' && input.previousCheckin.adesao_ao_plano !== input.lastCheckin.adesao_ao_plano) {
        lines.push(`Anterior: ${input.previousCheckin.adesao_ao_plano}/5`);
      }
    } else {
      lines.push('Adesão: sem registro');
    }
    lines.push(`Check-in semanal: ${input.isCheckinDoneThisWeek ? 'em dia' : 'pendente'}`);
    sections.push({ title: 'Adesão', lines });
  }

  // HUMOR
  {
    const lines: string[] = [];
    if (input.lastCheckin?.humor_semanal != null) {
      lines.push(`Humor semanal registrado: ${input.lastCheckin.humor_semanal}/5`);
      hasData = true;
    } else if (input.dailyLogToday?.mood) {
      lines.push(`Humor hoje: ${input.dailyLogToday.mood}`);
      hasData = true;
    } else {
      lines.push('Humor: sem registro');
    }
    sections.push({ title: 'Humor', lines });
  }

  // HIDRATAÇÃO
  {
    const lines: string[] = [];
    if (typeof input.dailyLogToday?.water_ml === 'number') {
      lines.push(`Água hoje: ${input.dailyLogToday.water_ml} ml`);
      hasData = true;
    } else {
      lines.push('Hidratação hoje: sem registro');
    }
    if (input.dailyLogsCount7d > 0) {
      lines.push(`Registros nos últimos 7 dias: ${input.dailyLogsCount7d}`);
    }
    sections.push({ title: 'Hidratação', lines });
  }

  // COMPORTAMENTO REGISTRADO (apenas fatos)
  {
    const lines: string[] = [];
    if (input.dailyLogToday?.meals_checked && input.dailyLogToday.meals_checked.length > 0) {
      lines.push(`Refeições hoje: ${input.dailyLogToday.meals_checked.join(', ')}`);
      hasData = true;
    } else {
      lines.push('Refeições hoje: sem registro');
    }
    if (typeof input.dailyLogToday?.activity_kcal === 'number' && input.dailyLogToday.activity_kcal > 0) {
      lines.push(`Atividade hoje: ${input.dailyLogToday.activity_kcal} kcal`);
      hasData = true;
    }
    sections.push({ title: 'Comportamento registrado', lines });
  }

  // ÚLTIMO CHECK-IN
  {
    const lines: string[] = [];
    if (input.lastCheckin?.created_at) {
      lines.push(`Data: ${new Date(input.lastCheckin.created_at).toLocaleDateString('pt-BR')}`);
      if (input.lastCheckin.altura) lines.push(`Altura: ${input.lastCheckin.altura}`);
      if (input.lastCheckin.comentarios) lines.push(`Comentário: "${input.lastCheckin.comentarios.slice(0, 80)}"`);
      hasData = true;
    } else {
      lines.push('Sem check-in registrado');
    }
    sections.push({ title: 'Último check-in', lines });
  }

  // PONTOS PARA CONVERSAR (apenas fatos, sem diagnóstico)
  {
    const lines: string[] = [];
    if (!input.isCheckinDoneThisWeek) lines.push('Check-in semanal pendente');
    if (input.lastCheckin?.adesao_ao_plano != null && input.lastCheckin.adesao_ao_plano <= 2) {
      lines.push(`Adesão registrada baixa: ${input.lastCheckin.adesao_ao_plano}/5`);
    }
    if (input.dailyLogToday && !input.dailyLogToday.meals_checked?.length) {
      lines.push('Sem refeições registradas hoje');
    }
    if (lines.length === 0) lines.push('Sem pontos pendentes objetivos');
    sections.push({ title: 'Pontos para conversar', lines });
  }

  return { patientName: name, sections, hasData };
}
