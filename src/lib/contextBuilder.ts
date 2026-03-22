// contextBuilder.ts (VERSÃO PRO)

type UserData = {
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
  todayStr: string;
  hasImage?: boolean; // 🔥 NOVO
};

type IntentType =
  | 'troca'
  | 'resultado'
  | 'motivacional'
  | 'geral';

// ===============================
// 🔍 CLASSIFICADOR DE INTENÇÃO
// ===============================
function detectIntent(message: string): IntentType {
  const msg = message.toLowerCase();

  if (
    msg.includes('trocar') ||
    msg.includes('substituir') ||
    msg.includes('substituicao')
  ) return 'troca';

  if (
    msg.includes('emagrec') ||
    msg.includes('resultado') ||
    msg.includes('não emagreci') ||
    msg.includes('nao emagreci')
  ) return 'resultado';

  if (
    msg.includes('desanimei') ||
    msg.includes('desanimado') ||
    msg.includes('não consegui') ||
    msg.includes('nao consegui') ||
    msg.includes('dificil') ||
    msg.includes('difícil')
  ) return 'motivacional';

  return 'geral';
}

// ===============================
// 🧠 BUILDER PRINCIPAL
// ===============================
export function buildContext(
  message: string,
  data: UserData
): string {

  const intent = detectIntent(message);

  // ===============================
  // 🔹 BASE FIXA (SEMPRE)
  // ===============================
  let contexto = `
Você é a Assistente Nutricional da Nutricionista Vanusa.

Tom:
- humano
- direto
- acolhedor (estilo WhatsApp)
- motivador quando necessário
- NUNCA robótico

Regra crítica:
- Nunca responda de forma genérica
- Sempre considere o contexto do paciente
- Nunca corte frase no meio

DADOS DO PACIENTE:
Nome: ${data.nomePaciente}
Objetivo: ${data.objetivoPrincipal}
Meta de Peso: ${data.metaPeso}
`;

  // ===============================
  // 🔹 CONTEXTO POR INTENÇÃO
  // ===============================

  if (intent === 'troca') {
    contexto += `
CONTEXTO PARA TROCAS:
Aversões: ${
      data.alimentosEvitar.length > 0
        ? data.alimentosEvitar.join(', ')
        : 'Nenhuma'
    }

CARDÁPIO ATUAL:
${data.cardapioFormatado}

INSTRUÇÃO:
- Sugira substituições equivalentes
- Evite alimentos da lista de aversões
- Seja prático (1–3 opções)
`;
  }

  if (intent === 'resultado') {
    contexto += `
CONTEXTO DE RESULTADO:
${data.evolucaoTxt}

ROTINA:
Sono: ${data.rotinaSono}
Doces: ${data.vontadesDoces}

INSTRUÇÃO:
- Identifique possíveis erros
- Dê ajustes simples
- Evite resposta genérica
`;
  }

  if (intent === 'motivacional') {
    contexto += `
CONTEXTO EMOCIONAL:
Humor: ${data.humorHoje}
Refeições feitas: ${data.refeicoesFeitas}
Água: ${data.aguaHoje}ml

INSTRUÇÃO:
- Seja empática
- Reforce progresso
- Dê um passo simples possível hoje
`;
  }

  if (intent === 'geral') {
    contexto += `
CONTEXTO GERAL:
Aversões: ${
      data.alimentosEvitar.length > 0
        ? data.alimentosEvitar.join(', ')
        : 'Nenhuma'
    }

CARDÁPIO:
${data.cardapioFormatado}

STATUS HOJE:
Humor: ${data.humorHoje}
Água: ${data.aguaHoje}ml
Refeições: ${data.refeicoesFeitas}
`;
  }

  // ===============================
  // 🔥 INTELIGÊNCIA ADICIONAL
  // ===============================

  // 🔻 Baixa ingestão de água
  if (data.aguaHoje < 1500) {
    contexto += `
ALERTA:
Paciente com baixa ingestão de água.
- Incentive aumento de forma leve.
`;
  }

  // 🔻 Baixa adesão alimentar
  if (data.refeicoesFeitas <= 2) {
    contexto += `
ALERTA:
Baixa adesão ao plano alimentar hoje.
- Sugira retomada simples (sem culpa).
`;
  }

  // 🔻 Humor difícil
  if (data.humorHoje === 'dificil') {
    contexto += `
ALERTA EMOCIONAL:
Paciente em dia difícil.
- Priorize acolhimento antes de orientação técnica.
`;
  }

  // ===============================
  // 🔥 MODO IMAGEM
  // ===============================
  if (data.hasImage) {
    contexto += `
ANÁLISE DE IMAGEM:
- Identifique alimentos visíveis
- Estime calorias (aproximação)
- Avalie qualidade do prato
- Sugira melhorias simples

IMPORTANTE:
- Não inventar alimentos não visíveis
- Assumir estimativa, não precisão
`;
  }

  // ===============================
  // 🔹 REGRAS FINAIS
  // ===============================
  contexto += `
REGRAS FINAIS:
1. Use linguagem simples
2. Use negrito para alimentos importantes
3. Evite respostas longas demais
4. Seja útil e direto
`;

  return contexto.trim();
}