'use client'

import type { DiaryStatus } from './diarioRules'

export interface DiaryInsightContent {
  title: string
  status: DiaryStatus
  description: string
  recommendation?: string
  questions?: string[]
}

// Textos educativos — nunca diagnósticos, sem causalidade, linguagem de investigação

export function getHydrationInsight(evalArgs: { hasWater: boolean; percent: number | null; hasGoal: boolean; waterMl: number | null }): DiaryInsightContent {
  const { hasWater, hasGoal, percent } = evalArgs
  if (!hasWater) {
    return {
      title: 'Hidratação — sem registro',
      status: 'atencao',
      description: 'Não há registro de hidratação para este dia. Confirme com o paciente se o consumo não ocorreu ou se apenas deixou de ser registrado.',
      recommendation: 'Vale verificar a rotina de hidratação e se houve dificuldade de acesso à água ou de registro.',
      questions: ['O consumo de água foi menor hoje?', 'Houve dificuldade para registrar?', 'Alguma orientação de hidratação está em uso?'],
    }
  }
  if (!hasGoal) {
    return {
      title: 'Hidratação — sem meta individual',
      status: 'atencao',
      description: 'Existe registro de ingestão de água, mas não há uma meta individual disponível para comparação. Avalie o volume, a distribuição ao longo do dia e a orientação definida no plano alimentar.',
      questions: ['Como a água foi distribuída ao longo do dia?', 'Há orientação de meta a definir com a nutricionista?'],
    }
  }
  if (percent !== null && percent >= 80) {
    return {
      title: 'Hidratação — adequada',
      status: 'normal',
      description: 'A ingestão registrada está próxima da meta definida para este paciente. Reforce as estratégias que ajudaram a distribuir o consumo de água ao longo do dia.',
    }
  }
  if (percent !== null && percent >= 40) {
    return {
      title: 'Hidratação — abaixo da meta',
      status: 'atencao',
      description: 'O volume registrado está abaixo da meta configurada. Avalie com o paciente em quais horários a ingestão foi menor e quais estratégias podem facilitar a hidratação ao longo do dia.',
      questions: ['Em quais horários a ingestão foi menor?', 'O que poderia facilitar o consumo?', 'A meta atual está compatível com a rotina?'],
    }
  }
  return {
    title: 'Hidratação — muito abaixo da meta',
    status: 'risco',
    description: 'O volume registrado está muito abaixo da meta individual válida. Investigue o contexto do dia antes de qualquer orientação; a repetição desse padrão merece acompanhamento.',
    recommendation: 'Avalie se houve limitação de acesso, rotina atípica ou orientação clínica específica.',
    questions: ['O que dificultou a hidratação hoje?', 'Esse padrão tem se repetido?'],
  }
}

export function getMealInsight(mealName: string, state: 'registrado' | 'nao_informado' | 'nao_realizado', kind: string): DiaryInsightContent {
  const label = mealName.charAt(0).toUpperCase() + mealName.slice(1)
  if (state === 'registrado') {
    if (kind === 'cafe') return { title: `${label} — registrado`, status: 'normal', description: 'O café da manhã foi registrado. A regularidade das refeições ajuda a acompanhar a organização alimentar e a distribuição dos alimentos ao longo do dia. Avalie também a composição da refeição quando os alimentos consumidos estiverem disponíveis.' }
    if (kind === 'almoco') return { title: `${label} — registrado`, status: 'normal', description: 'O almoço foi registrado. Use esse momento para avaliar a regularidade, a composição da refeição e a compatibilidade com o plano alimentar, caso esses dados estejam disponíveis.' }
    if (kind === 'lanche') return { title: `${label} — registrado`, status: 'normal', description: 'O registro do lanche ajuda a avaliar a distribuição alimentar e a organização da rotina. A necessidade e a composição do lanche devem ser analisadas conforme o plano individual.' }
    if (kind === 'jantar') return { title: `${label} — registrado`, status: 'normal', description: 'O registro do jantar ajuda a acompanhar a distribuição alimentar ao longo do dia. Avalie a composição, o horário e a relação com a fome noturna quando essas informações estiverem disponíveis.' }
    return { title: `${label} — registrado`, status: 'normal', description: 'Refeição registrada. Avalie a regularidade e a compatibilidade com o plano alimentar quando a composição estiver disponível.' }
  }
  if (state === 'nao_realizado') {
    if (kind === 'cafe') return { title: `${label} — não realizado`, status: 'atencao', description: 'O café da manhã foi marcado como não realizado. Investigue se isso ocorreu por falta de fome, rotina, horário de trabalho, estratégia de jejum ou outro motivo. A conduta deve considerar o contexto e o plano alimentar do paciente.', questions: ['O que dificultou o café?', 'Foi estratégia de jejum orientada?', 'A rotina interferiu?'] }
    if (kind === 'almoco') return { title: `${label} — não realizado`, status: 'atencao', description: 'O almoço foi marcado como não realizado. Investigue o motivo com o paciente antes de definir qualquer conduta. A repetição de longos períodos sem alimentação pode dificultar a distribuição de energia e nutrientes e prejudicar a adesão ao plano alimentar.', questions: ['O que dificultou o almoço?', 'Foi falta de tempo ou fome?', 'A rotina de trabalho interferiu?', 'Existe orientação específica de jejum?'] }
    return { title: `${label} — não realizado`, status: 'atencao', description: 'Refeição marcada como não realizada. Investigue o motivo dentro da rotina individual antes de definir conduta.', questions: ['O que dificultou a refeição?', 'Esse padrão tem se repetido?'] }
  }
  // nao_informado — limitação real do banco: não afirmar que não realizou
  if (kind === 'cafe') return { title: `${label} — não informado`, status: 'atencao', description: 'O café da manhã não foi informado. Confirme com o paciente se a refeição foi realizada e, caso não tenha sido, investigue o motivo dentro da rotina individual.' }
  if (kind === 'almoco') return { title: `${label} — não informado`, status: 'atencao', description: 'O almoço não foi informado. O sistema não sabe se o paciente não almoçou ou apenas não preencheu o Diário. Confirme com o paciente antes de qualquer interpretação clínica.', questions: ['O almoço foi realizado?', 'Houve dificuldade de registro?'] }
  if (kind === 'jantar') return { title: `${label} — não informado`, status: 'atencao', description: 'O jantar não foi informado. Confirme com o paciente se a refeição ocorreu e avalie a distribuição alimentar do dia.' }
  if (kind === 'lanche') return { title: `${label} — não informado`, status: 'atencao', description: 'O lanche não foi informado. O registro do lanche ajuda a avaliar a distribuição alimentar; confirme se foi realizado ou se ficou pendente de registro.' }
  return { title: `${label} — não informado`, status: 'atencao', description: 'Refeição não informada. Não afirmar automaticamente que não foi realizada; confirme com o paciente se houve realização ou apenas falta de registro.' }
}

export function getActivityInsight(hasActivity: boolean): DiaryInsightContent {
  if (hasActivity) return { title: 'Atividade — registrada', status: 'normal', description: 'A atividade foi registrada. Avalie o tipo, a duração, a frequência e a compatibilidade com a orientação individual. O registro ajuda a acompanhar a consistência da rotina.' }
  return { title: 'Atividade — sem registro', status: 'atencao', description: 'Não há atividade registrada para este dia. Confirme se não houve atividade ou se o registro ficou pendente. Não interpretar automaticamente como falta de adesão.' }
}

export function getMoodInsight(mood: string | null): DiaryInsightContent {
  if (!mood) return { title: 'Humor — sem registro', status: 'sem_dados', description: 'Sem humor registrado para este dia. Quando disponível, o humor pode ajudar a contextualizar a rotina alimentar e a adesão ao plano, sem tratar o registro isolado como diagnóstico.' }
  return { title: 'Humor — registrado', status: 'normal', description: 'O humor registrado pode ajudar a contextualizar a rotina alimentar e a adesão ao plano. Use essa informação como ponto de conversa, sem tratar o registro isolado como diagnóstico.' }
}

export function getOverallDayInsight(status: DiaryStatus, hasAnyData: boolean): DiaryInsightContent {
  if (!hasAnyData) return { title: 'Dia sem dados', status: 'sem_dados', description: 'Nenhum registro diário disponível para este dia. Não há base para status clínico; confirme com o paciente se o registro ficou pendente.' }
  if (status === 'normal') return { title: 'Dia — NORMAL', status: 'normal', description: 'Registros do dia dentro do esperado com base nos dados disponíveis. Mantenha o acompanhamento da regularidade.' }
  if (status === 'atencao') return { title: 'Dia — ATENÇÃO', status: 'atencao', description: 'Há itens com registro incompleto ou abaixo do objetivo. Avalie com o paciente os motivos e as estratégias para os próximos dias.' }
  return { title: 'Dia — RISCO', status: 'risco', description: 'Há itens com condição que merece investigação clínica priorizada. Converse com o paciente sobre o contexto do dia e a repetição do padrão.' }
}

export function getMealsSummaryInsight(registeredCount: number, totalExpected: number | null, overallStatus: DiaryStatus): DiaryInsightContent {
  if (totalExpected === null) {
    if (registeredCount > 0) return { title: 'Refeições — registradas', status: 'normal', description: `${registeredCount} refeição(ões) registrada(s). Avalie a regularidade e a distribuição ao longo do dia conforme o plano individual.` }
    return { title: 'Refeições — sem registro', status: 'atencao', description: 'Nenhuma refeição informada para este dia. Confirme com o paciente se houve realização ou apenas falta de registro. Não afirmar automaticamente que não se alimentou.' }
  }
  if (registeredCount === totalExpected) return { title: 'Refeições — completas', status: 'normal', description: `Todas as ${totalExpected} refeições esperadas foram registradas. A regularidade ajuda a acompanhar a organização alimentar.` }
  if (registeredCount === 0) return { title: 'Refeições — nenhuma informada', status: 'atencao', description: `Nenhuma das ${totalExpected} refeições esperadas foi informada. O sistema não sabe se o paciente não realizou as refeições ou apenas não preencheu o Diário. Confirme com o paciente antes de qualquer interpretação.` }
  return { title: 'Refeições — incompletas', status: 'atencao', description: `${registeredCount} de ${totalExpected} refeições registradas. Algumas refeições não foram informadas. Avalie com o paciente a rotina e se houve dificuldade de registro. A diferença entre “não informado” e “não realizado” deve ser confirmada em conversa.`, questions: ['Quais refeições ficaram sem registro?', 'Houve falta de tempo ou de fome?', 'A rotina interferiu?'] }
}
