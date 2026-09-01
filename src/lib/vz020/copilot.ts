import type { CopilotInput, CopilotResult } from './types';
import { getRecoveryV2 } from './recoveryEngine';

// VZ-022 — Copiloto REBIRTH determinístico
// Responde: "O que preciso saber sobre este paciente antes de conversar com ele?"
// Sem diagnóstico, sem score, sem riskLevel, sem behaviorEngine
// 8 blocos: Resumo, Evolução, Adesão, Rotina, Humor, Recuperação, Pré-consulta, Pontos para conversar

function formatDateBR(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return null;
  }
}

function buildTalkingPoints(input: CopilotInput): string[] {
  const qs: string[] = [];
  // Adesão baixa -> pergunta operacional neutra
  if (typeof input.lastCheckin?.adesao_ao_plano === 'number' && input.lastCheckin.adesao_ao_plano <= 2) {
    qs.push('Como foi sua rotina alimentar desde o último check-in?');
  }
  // Hidratação
  if (input.dailyLogToday?.water_ml == null) {
    qs.push('Como ficou sua hidratação nos últimos dias?');
  }
  // Check-in pendente
  if (!input.isCheckinDoneThisWeek) {
    qs.push('O que dificultou a realização do último check-in?');
  }
  // Refeições
  if (!input.dailyLogToday?.meals_checked || input.dailyLogToday.meals_checked.length === 0) {
    // só pergunta se já existe dailyLog mas sem refeições, ou se não há refeições e estamos sem adesão baixa para evitar duplicar demais
    if (input.dailyLogToday !== null) {
      qs.push('Como esteve sua rotina de refeições hoje?');
    } else if (qs.length === 0) {
      qs.push('Como esteve sua rotina de refeições nos últimos dias?');
    }
  }
  // Humor registrado baixo (sem interpretar)
  if (typeof input.lastCheckin?.humor_semanal === 'number' && input.lastCheckin.humor_semanal <= 2) {
    qs.push('Como você tem se sentido nos últimos dias?');
  } else if (input.dailyLogToday?.mood && qs.length < 3) {
    // não gera pergunta extra se já temos 3, apenas para garantir diversidade
  }
  // Sem pontos objetivos -> pergunta aberta neutra baseada em disponibilidade
  if (qs.length === 0) {
    qs.push('Há algo que gostaria de compartilhar sobre sua rotina desde o último registro?');
  }
  // dedup e limite 4
  return [...new Set(qs)].slice(0, 4);
}

export function buildCopilot(input: CopilotInput): CopilotResult {
  const name = input.profile?.full_name?.split(' ')[0] || 'Paciente';
  const sections: CopilotResult['sections'] = [];
  let hasData = false;

  // 1. RESUMO
  {
    const lines: string[] = [];
    if (input.lastCheckin?.created_at) {
      const d = formatDateBR(input.lastCheckin.created_at);
      lines.push(`Último check-in: ${d ?? input.lastCheckin.created_at}`);
      hasData = true;
    } else {
      lines.push('Último check-in: sem registro');
    }
    if (input.dailyLogToday) {
      const parts: string[] = [];
      if (typeof input.dailyLogToday.water_ml === 'number') parts.push(`água ${input.dailyLogToday.water_ml} ml hoje`);
      if (input.dailyLogToday.meals_checked?.length) parts.push(`${input.dailyLogToday.meals_checked.length} refeição(ões) hoje`);
      if (input.dailyLogToday.mood) parts.push(`humor hoje: ${input.dailyLogToday.mood}`);
      if (parts.length > 0) {
        lines.push(`Atividade recente: ${parts.join(' • ')}`);
        hasData = true;
      } else {
        lines.push('Atividade recente: sem registros hoje');
      }
    } else {
      lines.push('Atividade recente: sem registros hoje');
    }
    lines.push(`Registros recentes: ${input.checkinsCount} check-in(s) • ${input.dailyLogsCount7d} dia(s) com registro nos últimos 7 dias`);
    if (input.checkinsCount > 0) hasData = true;
    sections.push({ title: 'Resumo', lines });
  }

  // 2. EVOLUÇÃO
  {
    const lines: string[] = [];
    if (input.lastCheckin?.peso) {
      lines.push(`Peso atual: ${input.lastCheckin.peso} kg`);
      hasData = true;
      if (input.previousCheckin?.peso) {
        lines.push(`Peso anterior: ${input.previousCheckin.peso} kg`);
        const cur = parseFloat(input.lastCheckin.peso);
        const prev = parseFloat(input.previousCheckin.peso);
        if (!isNaN(cur) && !isNaN(prev)) {
          const diff = cur - prev;
          const sign = diff > 0 ? '+' : '';
          lines.push(`Diferença: ${sign}${diff.toFixed(1)} kg`);
        }
      } else {
        lines.push('Peso anterior: sem registro para comparar');
      }
    } else {
      lines.push('Peso: sem registro');
    }
    lines.push(`Quantidade de check-ins: ${input.checkinsCount}`);
    sections.push({ title: 'Evolução', lines });
  }

  // 3. ADESÃO (sem julgamento)
  {
    const lines: string[] = [];
    if (typeof input.lastCheckin?.adesao_ao_plano === 'number') {
      const d = formatDateBR(input.lastCheckin.created_at);
      lines.push(`Adesão registrada: ${input.lastCheckin.adesao_ao_plano}/5${d ? ` em ${d}` : ''}`);
      hasData = true;
      if (typeof input.previousCheckin?.adesao_ao_plano === 'number') {
        lines.push(`Anterior: ${input.previousCheckin.adesao_ao_plano}/5`);
      }
    } else {
      lines.push('Adesão: sem registro');
    }
    lines.push(`Check-in semanal: ${input.isCheckinDoneThisWeek ? 'em dia' : 'pendente'}`);
    sections.push({ title: 'Adesão', lines });
  }

  // 4. ROTINA
  {
    const lines: string[] = [];
    if (typeof input.dailyLogToday?.water_ml === 'number') {
      lines.push(`Hidratação hoje: ${input.dailyLogToday.water_ml} ml`);
      hasData = true;
    } else {
      lines.push('Hidratação hoje: sem registro');
    }
    if (input.dailyLogToday?.meals_checked && input.dailyLogToday.meals_checked.length > 0) {
      lines.push(`Refeições hoje: ${input.dailyLogToday.meals_checked.join(', ')}`);
      hasData = true;
    } else {
      lines.push('Refeições hoje: sem registro');
    }
    if (typeof input.dailyLogToday?.activity_kcal === 'number' && input.dailyLogToday.activity_kcal > 0) {
      lines.push(`Atividade hoje: ${input.dailyLogToday.activity_kcal} kcal`);
      hasData = true;
    } else {
      lines.push('Atividade hoje: sem registro');
    }
    sections.push({ title: 'Rotina', lines });
  }

  // 5. HUMOR (sem interpretação psicológica)
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

  // 6. RECUPERAÇÃO (sinais objetivos do Recovery Engine)
  {
    const lines: string[] = [];
    const rec = getRecoveryV2({
      isCheckinDoneThisWeek: input.isCheckinDoneThisWeek,
      hasDailyLogToday: !!(input.dailyLogToday?.water_ml != null || input.dailyLogToday?.mood || (input.dailyLogToday?.meals_checked?.length ?? 0) > 0),
      lastCheckinAdherence: input.lastCheckin?.adesao_ao_plano ?? null,
      hasReturnedRecently: false,
      totalCheckins: input.checkinsCount,
    });
    if (rec.state === 'OK' && rec.actions.length > 0) {
      rec.actions.forEach((a) => lines.push(`${a.title}: ${a.reason}`));
    } else {
      lines.push('Sem sinais objetivos pendentes');
    }
    sections.push({ title: 'Recuperação', lines });
  }

  // 7. PRÉ-CONSULTA (o que mudou desde último registro comparável)
  {
    const lines: string[] = [];
    if (input.previousCheckin) {
      // peso
      if (input.lastCheckin?.peso && input.previousCheckin.peso) {
        if (input.lastCheckin.peso !== input.previousCheckin.peso) {
          lines.push(`Peso: ${input.previousCheckin.peso} → ${input.lastCheckin.peso} kg`);
        } else {
          lines.push(`Peso: manteve ${input.lastCheckin.peso} kg`);
        }
      } else if (input.lastCheckin?.peso) {
        lines.push(`Peso: ${input.lastCheckin.peso} kg (sem anterior para comparar)`);
      }
      // adesão
      if (typeof input.lastCheckin?.adesao_ao_plano === 'number' && typeof input.previousCheckin.adesao_ao_plano === 'number') {
        if (input.lastCheckin.adesao_ao_plano !== input.previousCheckin.adesao_ao_plano) {
          lines.push(`Adesão: ${input.previousCheckin.adesao_ao_plano} → ${input.lastCheckin.adesao_ao_plano}/5`);
        } else {
          lines.push(`Adesão: manteve ${input.lastCheckin.adesao_ao_plano}/5`);
        }
      } else if (typeof input.lastCheckin?.adesao_ao_plano === 'number') {
        lines.push(`Adesão: ${input.lastCheckin.adesao_ao_plano}/5 (sem anterior)`);
      }
      if (lines.length === 0) lines.push('Sem registro anterior suficiente para comparação.');
    } else {
      lines.push('Sem registro anterior suficiente para comparação.');
    }
    sections.push({ title: 'Pré-consulta', lines });
  }

  // 8. PONTOS PARA CONVERSAR (perguntas operacionais derivadas exclusivamente dos dados)
  {
    const questions = buildTalkingPoints(input);
    sections.push({ title: 'Pontos para conversar', lines: questions.map((q) => `• ${q}`) });
  }

  return { patientName: name, sections, hasData };
}
