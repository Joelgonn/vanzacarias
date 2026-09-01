# VZ-017 — Especificações Futuras (NÃO IMPLEMENTADO)

> FASE I/J/K — Especificações apenas, sem código, sem LLM decisório, sem novos scores.

## I — Copiloto da Nutricionista (FUTURO)

**Objetivo:** Dar à Nutri uma visão objetiva do paciente sem diagnóstico automático.

**Dados necessários (todos já existentes no Supabase, nenhum novo schema):**

```
Paciente
├── Identificação: profiles.full_name, id, created_at
├── Evolução: checkins (peso, altura -> IMC), anthropometry (weight, waist), deltas, timelineData
├── Adesão: checkins.adesao_ao_plano (1-5, R6 classificação já em progressContext), daily_logs.meals_checked vs meal_plan
├── Humor: daily_logs.mood (feliz/neutro/dificil), checkins.humor_semanal (1-5)
├── Hidratação: daily_logs.water_ml vs waterGoal (35ml/kg quando há peso), thin bars já existentes
├── Comportamento objetivo: beliscosHoje (totalKcal, items.length, sem interpretação sabotage)
├── Último check-in: temporalContext.diasDesdeUltimoCheckin + comentario literal + data
└── Pontos para conversar: lista determinística derivada dos acima (ex: "adesão 2/5 há 5 dias", "sem check-in há 18 dias", "humor difícil hoje"), sem score
```

**Regras:**
- Não criar `patientScore`, `riskLevel`, `sabotage`, `disciplineScore`.
- Exibir apenas dados + `periodoCoberto` e `totalCheckins`, nunca "risco alto".
- Admin mantém `behaviorEngine` apenas se necessário para copiloto futuro, mas deve ser reavaliado — hoje admin já tem `buildBehaviorAnalysisContext` preservado (VZ-016).

**UI futura:** nova aba `admin/dashboard` "Foco Paciente" com cards objetivos, sem ranking visual.

---

## J — Resumo Pré-Consulta "O que mudou desde a última consulta?"

**Pergunta:** Gerar texto objetivo sem LLM para consulta.

**Fonte de verdade:** `checkins.created_at` + `daily_logs.date` + `timelineData`.

**Mapeamento:**

| Dado | Query | Apresentação objetiva |
|---|---|---|
| `alterações` | diff entre último e penúltimo checkin (peso, cintura, adesao, humor) | "Peso: 68.5kg (era 69.2kg há 12 dias, delta -0.7kg)" |
| `datas` | `periodoCoberto`, `diasDesdeUltimoCheckin`, `idadeContaDias` | Período coberto |
| `evolução` | `progressContext` (pesoInicial→maisRecente, registrosSuficientes, IMC, tendência R2 só se >=3) | Sem frase de tendência se <3 |
| `adesão` | `progress.adesaoMaisRecente` (R6: Alta/Moderada/Baixa) | "Última adesão: 3 — Moderada" |
| `registros` | `daily_logs` últimos 7 dias (water, meals, mood, activities) | Lista diária objetiva |
| `jornada` | `journeyContext` (QFA, avaliação, check-in existência, plano acesso) | "Onboarding: QFA ok, plano existe" |
| `pontos que merecem conversa` | determinístico: se `diasDesdeUltimoCheckin >14` → "sem check-in há X dias"; se `adesao <=2` → "adesão baixa no último check-in"; se `beliscosHoje.hasBeliscos` → "registrou beliscos hoje" | Sem diagnóstico, só citação |

**Não inferir causas clínicas.** Texto deve ser lista, não narrativa.

---

## K — Retenção e Renovação (FUTURO)

**Três janelas temporais objetivas (sem score):**

1. **ENGAJAMENTO OBJETIVO → continuidade**
   - Métrica: `dailyLog` existe hoje? `water_ml`, `meals_checked`, `activities` nos últimos 7 dias (contagem, não score).
   - Uso: mostrar "você registrou 5 de 7 dias" — sem `score/100`.

2. **SINAL OBJETIVO DE RETOMADA → recuperação**
   - Já implementado: `recoveryEngine` (`!dailyLog` → `daily_log`, `isCheckinDoneThisWeek===false` → `checkin`, `adesao <=2` → `adherence`). Reuso direto.
   - Gatilho futuro: se `diasDesdeUltimoCheckin > X` (X a definir em Gate, não nesta sprint) → card recuperação.

3. **FIM DO CICLO → renovação**
   - Dado: `checkins` + `profiles.created_at` + plano prazo (não existe ainda — requer Gate para definir ciclo, ex: 30/60/90 dias).
   - Sem `abandono automático`; apenas "seu plano iniciado há Y dias, próximo check-in em Z".

**Proibido nesta fase:** `score de engajamento`, `score de retenção`, `riskLevel`, `abandono automático`, novos thresholds sem aprovação.

---

**Conclusão:** Todas as 3 features futuras são viáveis com dados atuais + `vz015` determinístico. Nenhuma exige novo banco, novo RAG ou novo LLM.
