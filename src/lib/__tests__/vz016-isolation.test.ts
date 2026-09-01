import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildContext, type UserData } from '@/lib/contextBuilder';

// Base UserData mínimo válido (sem behaviorEngine) — simula fluxo paciente VZ-016
function baseUserData(): UserData {
  return {
    nomePaciente: 'Teste',
    objetivoPrincipal: 'Emagrecimento',
    metaPeso: '65kg',
    rotinaSono: 'Regular',
    vontadesDoces: 'Moderada',
    alimentosEvitar: [],
    restrictions: [],
    cardapioFormatado: 'Café: 2 ovos',
    evolucaoTxt: 'Iniciando.',
    humorHoje: 'neutro',
    aguaHoje: 1000,
    refeicoesFeitas: 1,
    atividadesHojeFormatadas: 'Nenhuma',
    activityKcal: 0,
    todayStr: '2026-08-30',
    hasImage: false,
    canAccessMealPlan: true,
    temporal: {
      diasDesdeUltimoCheckin: 2,
      ultimoCheckinData: '28/08/2026',
      totalCheckins: 3,
      periodoCoberto: 'de 01/08/2026 a 28/08/2026',
      idadeContaDias: 30,
      temPlano: true,
      temAvaliacao: true,
      temQFA: true,
      ultimaAtividade: null,
      comentarioUltimoCheckin: null,
    },
    progress: {
      totalCheckins: 3,
      totalCheckinsComPeso: 3,
      pesoInicial: 70,
      pesoMaisRecente: 68.5,
      registrosSuficientes: true,
      imc: 22.5,
      adesaoMaisRecente: 4,
      humorMaisRecente: 4,
      metaPeso: 65,
    },
  };
}

describe('VZ-016: behaviorEngine não chega ao paciente', () => {
  it('patient context sem behaviorPattern NÃO contém score/risk/sabotage', () => {
    const data = baseUserData();
    const ctx = buildContext('Como está minha evolução?', data);

    expect(ctx).not.toMatch(/SCORE DE DISCIPLINA/i);
    expect(ctx).not.toMatch(/PREVISÃO DE RISCO/i);
    expect(ctx).not.toMatch(/riskLevel/i);
    expect(ctx).not.toMatch(/disciplineScore/i);
    expect(ctx).not.toMatch(/sabotage|isSabotaging/i);
    expect(ctx).not.toContain('[ANÁLISE COMPORTAMENTAL');
  });

  it('admin context COM behaviorPattern ainda gera análise (preservação admin)', () => {
    const data: UserData = {
      ...baseUserData(),
      behaviorPattern: {
        isSabotaging: true,
        signals: {
          highCalories: true,
          frequentSnacks: false,
          emotionalEating: false,
          lateNightSnacking: false,
          recorrente: false,
        },
        severity: 'high',
        percent: 25,
        totalKcal: 400,
        itemsCount: 2,
        lateNightCount: 0,
        emotionalTrigger: false,
        patternSummary: {
          frequencia: 'ocasional',
          periodoCritico: 'nenhum',
          diasConsecutivos: 0,
          tendencia: 'evento isolado',
        },
        impactOnGoal: 'impacto moderado no déficit calórico',
        riskLevel: { level: 'alto', score: 55, description: 'RISCO ALTO' },
        disciplineScore: {
          score: 45,
          level: 'regular',
          components: { refeicoes: 15, agua: 10, beliscos: 10, atividade: 10 },
        },
      },
      interventionSuggestion: 'Retome o plano na próxima refeição.',
    };
    const ctx = buildContext('Paciente com beliscos?', data);
    expect(ctx).toMatch(/ANÁLISE COMPORTAMENTAL/);
    expect(ctx).toMatch(/PREVISÃO DE RISCO/);
    expect(ctx).toMatch(/SCORE DE DISCIPLINA/);
  });

  it('patient/route.ts não importa behaviorEngine (isolamento arquivo)', () => {
    const patientRoute = readFileSync(
      path.resolve(__dirname, '../../app/api/nutri-assistant/patient/route.ts'),
      'utf8'
    );
    expect(patientRoute).not.toContain('from \'@/lib/behaviorEngine\'');
    expect(patientRoute).not.toContain('from "@/lib/behaviorEngine"');
    expect(patientRoute).not.toContain('detectSabotagePattern');
    expect(patientRoute).not.toContain('buildIntervention');
  });

  it('admin/route.ts ainda importa behaviorEngine (preservação admin)', () => {
    const adminRoute = readFileSync(
      path.resolve(__dirname, '../../app/api/nutri-assistant/admin/route.ts'),
      'utf8'
    );
    expect(adminRoute).toContain('behaviorEngine');
    expect(adminRoute).toContain('detectSabotagePattern');
  });
});
