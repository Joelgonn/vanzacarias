// =========================================================================
// TIPAGENS DO CONTEXTO
// =========================================================================
export type UserData = {
  nomePaciente: string;
  objetivoPrincipal: string;
  metaPeso: string;
  rotinaSono: string;
  vontadesDoces: string;
  alimentosEvitar: string[];
  cardapioFormatado: string;
  evolucaoTxt: string;
  humorHoje: string;
  aguaHoje: number;
  refeicoesFeitas: number;
  atividadesHojeFormatadas: string;
  activityKcal: number;
  todayStr: string;
  hasImage?: boolean;
  // NOVOS CAMPOS DE MACROS
  macrosDiarios?: {
    totalKcal: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
  };
  macrosPorRefeicao?: Array<{
    nome: string;
    horario: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
};

type IntentType = 'troca' | 'resultado' | 'motivacional' | 'geral';

// =========================================================================
// 🔍 1. CLASSIFICADOR DE INTENÇÃO (Otimizado com Regex)
// =========================================================================
function detectIntent(message: string): IntentType {
  // Normaliza a string (remove acentos e joga pra minúsculo) para melhorar a detecção
  const msg = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (/(troca|substitui|lugar de|em vez de|posso comer)/.test(msg)) {
    return 'troca';
  }

  if (/(emagrec|resultado|peso|medida|estagnei|nao perdi|balanca|quanto pes|quantos quilos)/.test(msg)) {
    return 'resultado';
  }

  if (/(desanim|nao consegui|dificil|chutei o balde|jacad|compulsa|triste|ansios|culpa)/.test(msg)) {
    return 'motivacional';
  }

  // NOVA DETECÇÃO PARA PERGUNTAS SOBRE MACROS
  if (/(caloria|kcal|proteina|protein|carbo|carboidrato|gordura|macro|valor nutricional)/.test(msg)) {
    return 'geral'; // Será tratado com contexto de macros
  }

  return 'geral';
}

// =========================================================================
// 🧩 2. MÓDULOS DE CONSTRUÇÃO DO PROMPT (Separação de Responsabilidades)
// =========================================================================

function buildSystemPersona(): string {
  return `
[PERSONA E TOM DE VOZ]
Você é a Assistente Virtual Exclusiva da Nutricionista Vanusa.
Seu papel é atuar como uma extensão do atendimento dela, oferecendo suporte rápido, preciso e acolhedor via WhatsApp/App.
- TOM: Humano, direto, empático e encorajador.
- PROIBIDO: Falar de forma robótica, dar respostas genéricas de internet, ou receitar medicamentos.
- REGRA DE OURO: Você NUNCA substitui a consulta. Se a dúvida for muito complexa clínica ou medicamente, oriente o paciente a agendar um retorno com a Vanusa.
`.trim();
}

function buildClinicalContext(data: UserData): string {
  const aversões = data.alimentosEvitar.length > 0 ? data.alimentosEvitar.join(', ') : 'Nenhuma relatada';
  
  return `
[DADOS CLÍNICOS DO PACIENTE]
- Nome: ${data.nomePaciente}
- Objetivo Principal: ${data.objetivoPrincipal}
- Meta de Peso: ${data.metaPeso}
- Evolução até agora: ${data.evolucaoTxt}
- Alimentos a Evitar (Aversões/Alergias): ${aversões}

[CARDÁPIO ATUAL]
${data.cardapioFormatado}
`.trim();
}

// NOVO MÓDULO: MACROS NUTRICIONAIS
function buildMacrosContext(data: UserData): string {
  if (!data.macrosDiarios && (!data.macrosPorRefeicao || data.macrosPorRefeicao.length === 0)) {
    return '';
  }

  let macrosText = '\n[MACROS NUTRICIONAIS DO CARDÁPIO]\n';

  if (data.macrosDiarios) {
    macrosText += `
📊 **TOTAIS DIÁRIOS:**
- Calorias: ${data.macrosDiarios.totalKcal} kcal
- Proteínas: ${data.macrosDiarios.totalProtein}g
- Carboidratos: ${data.macrosDiarios.totalCarbs}g
- Gorduras: ${data.macrosDiarios.totalFat}g
`;
  }

  if (data.macrosPorRefeicao && data.macrosPorRefeicao.length > 0) {
    macrosText += '\n🍽️ **MACROS POR REFEIÇÃO:**\n';
    data.macrosPorRefeicao.forEach(ref => {
      macrosText += `- ${ref.nome} (${ref.horario}): ${ref.kcal} kcal | P: ${ref.protein}g | C: ${ref.carbs}g | G: ${ref.fat}g\n`;
    });
  }

  return macrosText.trim();
}

function buildBehavioralContext(data: UserData): string {
  return `
[ROTINA E COMPORTAMENTO]
- Padrão de Sono: ${data.rotinaSono}
- Relação com Doces: ${data.vontadesDoces}
- Status de Hoje (${data.todayStr}):
  * Água Ingerida: ${data.aguaHoje}ml
  * Refeições Feitas: ${data.refeicoesFeitas}
  * Atividades Físicas de Hoje: ${data.atividadesHojeFormatadas}
  * Calorias Gastas com Atividade: ${data.activityKcal} kcal
`.trim();
}

function buildEmotionalContext(data: UserData): string {
  let alertas = '';

  if (data.humorHoje === 'dificil') {
    alertas += '\n⚠️ ALERTA EMOCIONAL: O paciente relatou que o dia hoje está "difícil". Priorize o acolhimento, valide o esforço dele e pegue leve nas cobranças técnicas.';
  }
  if (data.aguaHoje < 1500 && data.aguaHoje > 0) {
    alertas += '\n💧 ALERTA DE HIDRATAÇÃO: Paciente bebeu pouca água hoje. Lembre-o gentilmente de se hidratar.';
  }
  if (data.refeicoesFeitas <= 2 && data.humorHoje !== 'Não registrado') {
    alertas += '\n🍽️ ALERTA DE ADESÃO: Paciente pulou refeições hoje. Sugira uma retomada simples na próxima refeição, sem gerar culpa.';
  }
  if (data.activityKcal > 0) {
    alertas += '\n🔥 ALERTA DE EXERCÍCIO: O paciente se exercitou hoje! Use isso para elogiá-lo e reforçar que a constância nos treinos potencializa os resultados.';
  }

  return `
[ESTADO EMOCIONAL DE HOJE]
- Humor Relatado: ${data.humorHoje}
${alertas}
`.trim();
}

function buildIntentInstructions(intent: IntentType, hasMacros: boolean): string {
  // Instrução específica para perguntas sobre macros
  if (hasMacros && intent === 'geral') {
    return `
[INSTRUÇÃO DE TAREFA: CONSULTA DE MACROS NUTRICIONAIS]
O paciente está perguntando sobre valores nutricionais, calorias ou composição do cardápio.

**COMO RESPONDER:**
1. Utilize os dados de [MACROS NUTRICIONAIS DO CARDÁPIO] para responder com precisão.
2. Se o paciente perguntar sobre uma refeição específica, localize no cardápio e informe os valores exatos.
3. Se perguntar sobre totais do dia, use os totais diários.
4. Para substituições, compare os macros do alimento original com as opções sugeridas.
5. Sempre contextualize: explique o que os valores significam para o objetivo dele (ex: "Essa quantidade de proteína vai te ajudar a manter a massa magra").
6. Seja educativa: ajude o paciente a entender a importância dos macros para o objetivo dele.

**EXEMPLO DE RESPOSTA:**
"Olá! Seu almoço hoje tem 613 kcal, com 54g de proteína, 46g de carboidratos e 21g de gorduras. Essa quantidade de proteína é ótima para te ajudar a manter a massa muscular enquanto emagrece. Se quiser trocar algo, posso sugerir opções que mantenham esses valores equilibrados!"
`.trim();
  }

  switch (intent) {
    case 'troca':
      return `
[INSTRUÇÃO DE TAREFA: SUBSTITUIÇÃO DE ALIMENTOS]
O paciente quer trocar um alimento.
1. Olhe o [CARDÁPIO ATUAL] e os [MACROS NUTRICIONAIS DO CARDÁPIO] para ver o valor nutricional do que ele deveria comer.
2. Olhe as [Aversões] para NÃO sugerir o que ele odeia.
3. Sugira de 1 a 3 opções de substituições nutricionalmente equivalentes (mesmo grupo alimentar e macros semelhantes).
4. Mostre a diferença de macros quando possível (ex: "Se trocar o frango por ovo, você teria que comer cerca de 8 ovos para igualar as 54g de proteína. Que tal adicionar mais ovos e um pouco de queijo?").
5. Seja prático e direto nas quantidades aproximadas.
`.trim();

    case 'resultado':
      return `
[INSTRUÇÃO DE TAREFA: RESULTADOS E ESTAGNAÇÃO]
O paciente está perguntando sobre peso, medidas ou resultados.
1. Analise a [Evolução até agora]. Se ele já perdeu peso, celebre isso!
2. Lembre-o de que oscilações de peso são normais (água, intestino, sono).
3. Revise o [Padrão de Sono], [Relação com Doces] e [Atividades Físicas] e sugira que o foco na constância (dieta e treino) é mais importante que a balança hoje.
4. Se houver [MACROS NUTRICIONAIS], mostre como ele está se alimentando bem e que a consistência nos macros é o que realmente importa.
`.trim();

    case 'motivacional':
      return `
[INSTRUÇÃO DE TAREFA: SUPORTE MOTIVACIONAL]
O paciente está desanimado, falhou na dieta ou está com dificuldade.
1. Seja extremamente empática. Mostre que falhar faz parte do processo.
2. Use a regra do "feito é melhor que perfeito".
3. Não dê uma aula de nutrição agora. Apenas encoraje-o a beber um copo de água ou fazer uma refeição leve na próxima oportunidade.
4. Se ele mencionou ter "chutado o balde", evite focar nos macros do deslize. Foque em retomar o próximo compromisso (água, próximo café, etc.).
`.trim();

    case 'geral':
    default:
      return `
[INSTRUÇÃO DE TAREFA: DÚVIDA GERAL]
Responda à dúvida do paciente baseando-se no plano alimentar dele, nos macros nutricionais e nos dados de rotina. Seja útil, amigável e concisa.
`.trim();
  }
}

function buildImageAnalysisRules(): string {
  return `
[INSTRUÇÃO DE TAREFA: ANÁLISE DE IMAGEM DO PRATO]
O paciente enviou uma foto da refeição.
1. Identifique os alimentos visíveis no prato com entusiasmo ("Que prato lindo! Vi que você colocou...").
2. Avalie a proporção do prato (tem proteína suficiente? Salada?).
3. Estime as calorias e macros (deixe claro que é uma aproximação visual baseada nos alimentos identificados).
4. Compare com os [MACROS NUTRICIONAIS DO CARDÁPIO] se possível.
5. Elogie os acertos e, se necessário, sugira uma pequena melhoria para a próxima vez.
6. NÃO invente alimentos que não estão visíveis.
`.trim();
}

// =========================================================================
// 🧠 3. CONSTRUTOR PRINCIPAL (Orquestrador)
// =========================================================================
export function buildContext(message: string, data: UserData): string {
  const intent = detectIntent(message);
  const hasMacros = !!(data.macrosDiarios || (data.macrosPorRefeicao && data.macrosPorRefeicao.length > 0));

  // Monta o array apenas com as partes válidas e junta com duas quebras de linha
  const promptParts = [
    buildSystemPersona(),
    buildClinicalContext(data),
    buildMacrosContext(data), // NOVO MÓDULO INSERIDO AQUI
    buildBehavioralContext(data),
    buildEmotionalContext(data),
    buildIntentInstructions(intent, hasMacros),
    data.hasImage ? buildImageAnalysisRules() : '',
    `
[REGRAS DE FORMATAÇÃO]
1. Use parágrafos curtos (máximo de 2-3 linhas por parágrafo) para facilitar a leitura no celular.
2. Use emojis com moderação para dar um tom amigável.
3. Use **negrito** para destacar alimentos, valores nutricionais ou informações muito importantes.
4. Nunca termine a frase pela metade.
5. Quando citar macros, formate sempre como: "kcal | P: Xg | C: Yg | G: Zg" para fácil leitura.
    `.trim()
  ];

  // Filtra itens vazios (caso hasImage seja false) e une tudo
  return promptParts.filter(part => part.length > 0).join('\n\n');
}