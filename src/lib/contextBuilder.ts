// =========================================================================
// IMPORTS DA ENGINE DE NUTRIÇÃO
// =========================================================================
import { expandRestrictions } from '@/lib/nutrition/restrictions';
import { type FoodRestriction } from '@/types/patient';
import { FOOD_REGISTRY } from '@/lib/foodRegistry';

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
  restrictions?: FoodRestriction[]; 
  cardapioFormatado: string;
  evolucaoTxt: string;
  humorHoje: string;
  aguaHoje: number;
  refeicoesFeitas: number;
  atividadesHojeFormatadas: string;
  activityKcal: number;
  todayStr: string;
  hasImage?: boolean;
  // CAMPOS DE MACROS
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
  // CAMPOS DE COMPOSIÇÃO CORPORAL
  composicaoCorporal?: {
    percentualGordura: number | null;
    massaGorda: number | null;
    massaMagra: number | null;
    ultimaAvaliacao: string | null;
    evolucaoGordura?: string;
    evolucaoMassaMagra?: string;
  };
};

type IntentType = 'troca' | 'resultado' | 'motivacional' | 'geral';

// =========================================================================
// 🔍 1. CLASSIFICADOR DE INTENÇÃO (Otimizado com Regex)
// =========================================================================
function detectIntent(message: string): IntentType {
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

  if (/(caloria|kcal|proteina|protein|carbo|carboidrato|gordura|macro|valor nutricional)/.test(msg)) {
    return 'geral'; 
  }

  if (/(gordura|bf|percentual de gordura|massa gorda|massa magra|composicao corporal|jackson pollock|dobras)/.test(msg)) {
    return 'resultado';
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
  // 1. Expande os IDs
  const blockedIds = expandRestrictions(data.restrictions || []);

  // 2. Nomes reais dos alimentos
  const blockedFoods = FOOD_REGISTRY
    .filter(f => blockedIds.has(f.id))
    .map(f => f.name);

  const legacyAversoes = data.alimentosEvitar || [];
  const allRestrictions = Array.from(new Set([...blockedFoods, ...legacyAversoes]));

  const restricoesTxt = allRestrictions.length > 0
    ? allRestrictions.join(', ')
    : 'Nenhuma relatada';

  // Extração de TAGS (Semântica para o LLM)
  const tags = (data.restrictions || [])
    .map(r => r.tag)
    .filter(Boolean) as string[];
  
  const uniqueTags = Array.from(new Set(tags));
  const tagsTxt = uniqueTags.length > 0 ? uniqueTags.join(', ') : '';

  return `
[DADOS CLÍNICOS DO PACIENTE]
- Nome: ${data.nomePaciente}
- Objetivo Principal: ${data.objetivoPrincipal}
- Meta de Peso: ${data.metaPeso}
- Evolução até agora: ${data.evolucaoTxt}

${tagsTxt ? `🚫 CATEGORIAS BLOQUEADAS (Atenção a derivados e generalizações):\n${tagsTxt}\n` : ''}
🚫 ALIMENTOS BLOQUEADOS (OBRIGATÓRIO RESPEITAR):
${restricoesTxt}

⚠️ REGRA CRÍTICA:
NUNCA sugerir as categorias ou alimentos listados acima em nenhuma hipótese, nem como substituição.

[CARDÁPIO ATUAL]
${data.cardapioFormatado}

📏 IMPORTANTE SOBRE MEDIDAS:
- Todas as quantidades do cardápio estão em GRAMAS (g)
- Ex: "150g frango" significa peso do alimento pronto/preparado
- Use essas quantidades como base para cálculos e substituições
`.trim();
}

// MÓDULO: MACROS NUTRICIONAIS
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

// MÓDULO: COMPOSIÇÃO CORPORAL (Jackson & Pollock)
function buildBodyCompositionContext(data: UserData): string {
  const comp = data.composicaoCorporal;
  
  if (!comp || !comp.percentualGordura) {
    return '';
  }
  
  let context = `
[COMPOSIÇÃO CORPORAL (Protocolo Jackson & Pollock - 7 Dobras)]
📊 **ÚLTIMA AVALIAÇÃO:** ${comp.ultimaAvaliacao || 'Data não registrada'}
- Percentual de Gordura Corporal: ${comp.percentualGordura}%
- Massa Gorda: ${comp.massaGorda !== null ? comp.massaGorda + ' kg' : 'N/A'}
- Massa Magra: ${comp.massaMagra !== null ? comp.massaMagra + ' kg' : 'N/A'}
`;

  if (comp.evolucaoGordura) {
    context += `- 📉 Evolução do % Gordura: ${comp.evolucaoGordura}\n`;
  }
  
  if (comp.evolucaoMassaMagra) {
    context += `- 💪 Evolução da Massa Magra: ${comp.evolucaoMassaMagra}\n`;
  }
  
  context += `
**🔬 INTERPRETAÇÃO CLÍNICA (para você usar no atendimento):**
- Percentual de gordura ideal para homens: 10-20% | Para mulheres: 18-28%
- Massa Magra é o principal indicador de metabolismo acelerado
- Redução de % gordura + manutenção/ganho de massa magra = resultado ideal
- Aumento de % gordura pode indicar necessidade de ajuste na dieta ou treino

**💬 COMO USAR ESSES DADOS NAS RESPOSTAS:**
1. **Quando perguntar sobre resultado/estagnação:**
   "Seu percentual de gordura reduziu X%! Isso é fantástico! A balança pode não ter mudado muito, mas você está perdendo gordura e ganhando saúde."

2. **Quando perguntar sobre motivação:**
   "Olha só que legal: você ganhou massa magra! Isso significa que seu metabolismo está mais acelerado. Continue focando nos treinos e na dieta que os resultados vêm."

3. **Quando identificar ganho de gordura:**
   "Identifiquei que seu percentual de gordura aumentou um pouco. Vamos revisar sua dieta juntos? Pode ser um sinal para ajustarmos algumas coisas."

4. **Para elogiar progresso:**
   "Você manteve a massa magra enquanto perdeu gordura - esse é exatamente o cenário ideal para emagrecimento saudável!"
`;
  
  return context;
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

function buildIntentInstructions(intent: IntentType, hasMacros: boolean, hasBodyComposition: boolean): string {
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

  if (hasBodyComposition && intent === 'resultado') {
    return `
[INSTRUÇÃO DE TAREFA: RESULTADOS E COMPOSIÇÃO CORPORAL]
O paciente está perguntando sobre resultados, peso ou composição corporal.

**COMO RESPONDER USANDO DADOS DE COMPOSIÇÃO CORPORAL:**
1. Sempre priorize os dados de [COMPOSIÇÃO CORPORAL] sobre o peso da balança.
2. Explique que perder gordura e ganhar massa magra é mais importante que o número na balança.
3. Use a evolução de % de gordura para contextualizar o progresso real.
4. Se houver ganho de massa magra, destaque como isso acelera o metabolismo.
5. Se houver aumento de gordura, seja honesta mas acolhedora: sugira revisão da dieta.

**EXEMPLOS DE RESPOSTA:**
- "Olha só que legal! Seu percentual de gordura reduziu de 28% para 25%! Isso significa que você perdeu 3kg de gordura pura. A balança pode não ter mudado tanto, mas sua composição corporal melhorou muito!"

- "Você ganhou 1.5kg de massa magra! Isso é excelente - massa magra acelera seu metabolismo e queima mais calorias em repouso. Continue com os treinos e a dieta que você está no caminho certo!"

- "Identifiquei que seu percentual de gordura aumentou um pouco. Isso é um sinal para ajustarmos algo na dieta. Vamos conversar com a Vanusa na próxima consulta para revisar?"
`;
  }

  switch (intent) {
    case 'troca':
      return `
[INSTRUÇÃO DE TAREFA: SUBSTITUIÇÃO DE ALIMENTOS]
O paciente quer trocar um alimento.
1. Olhe o [CARDÁPIO ATUAL] e os [MACROS NUTRICIONAIS DO CARDÁPIO] para ver o valor nutricional do que ele deveria comer.
2. Olhe as [CATEGORIAS BLOQUEADAS] e [ALIMENTOS BLOQUEADOS] para NÃO sugerir o que ele odeia ou tem intolerância.
3. Sugira de 1 a 3 opções de substituições nutricionalmente equivalentes (mesmo grupo alimentar e macros semelhantes).
4. Mostre a diferença de macros quando possível (ex: "Se trocar o frango por ovo, você teria que comer cerca de 8 ovos para igualar as 54g de proteína. Que tal adicionar mais ovos e um pouco de queijo?").
5. Seja prático e direto nas quantidades aproximadas.
`.trim();

    case 'resultado':
      return `
[INSTRUÇÃO DE TAREFA: RESULTADOS E ESTAGNAÇÃO]
O paciente está perguntando sobre peso, medidas ou resultados.
1. Analise a [Evolução até agora] e os dados de [COMPOSIÇÃO CORPORAL] se disponíveis.
2. Se ele já perdeu peso ou reduziu % de gordura, celebre isso!
3. Lembre-o de que oscilações de peso são normais (água, intestino, sono).
4. Revise o [Padrão de Sono], [Relação com Doces] e [Atividades Físicas] e sugira que o foco na constância (dieta e treino) é mais importante que a balança hoje.
5. Se houver [MACROS NUTRICIONAIS], mostre como ele está se alimentando bem e que a consistência nos macros é o que realmente importa.
`.trim();

    case 'motivacional':
      return `
[INSTRUÇÃO DE TAREFA: SUPORTE MOTIVACIONAL]
O paciente está desanimado, falhou na dieta ou está com dificuldade.
1. Seja extremamente empática. Mostre que falhar faz parte do processo.
2. Use a regra do "feito é melhor que perfeito".
3. Não dê uma aula de nutrição agora. Apenas encoraje-o a beber um copo de água ou fazer uma refeição leve na próxima oportunidade.
4. Se ele mencionou ter "chutado o balde", evite focar nos macros do deslize. Foque em retomar o próximo compromisso (água, próximo café, etc.).
5. Se houver dados de [COMPOSIÇÃO CORPORAL] positivos, use-os para motivar (ex: "Lembra que você já reduziu X% de gordura? Você consegue!").
`.trim();

    case 'geral':
    default:
      return `
[INSTRUÇÃO DE TAREFA: DÚVIDA GERAL]
Responda à dúvida do paciente baseando-se no plano alimentar dele, nas restrições obrigatórias, nos macros nutricionais, nos dados de composição corporal e nos dados de rotina. Seja útil, amigável e concisa.
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
  const hasBodyComposition = !!(data.composicaoCorporal && data.composicaoCorporal.percentualGordura);

  const promptParts = [
    buildSystemPersona(),
    buildClinicalContext(data),
    buildMacrosContext(data),
    buildBodyCompositionContext(data),
    buildBehavioralContext(data),
    buildEmotionalContext(data),
    buildIntentInstructions(intent, hasMacros, hasBodyComposition),
    data.hasImage ? buildImageAnalysisRules() : '',
    `
[REGRAS DE FORMATAÇÃO]
1. Use parágrafos curtos (máximo de 2-3 linhas por parágrafo) para facilitar a leitura no celular.
2. Use emojis com moderação para dar um tom amigável.
3. Use **negrito** para destacar alimentos, valores nutricionais ou informações muito importantes.
4. Nunca termine a frase pela metade.
5. Quando citar macros, formate sempre como: "kcal | P: Xg | C: Yg | G: Zg" para fácil leitura.
6. Quando citar composição corporal, destaque % de gordura e massa magra.
    `.trim()
  ];

  return promptParts.filter(part => part.length > 0).join('\n\n');
}