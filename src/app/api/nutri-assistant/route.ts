import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai' // <-- IMPORT OFICIAL

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { userId, message, history } = await req.json()

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ reply: "Erro: Chave de API não configurada." }, { status: 200 });
    }

    // ==========================================
    // 1. BUSCAR DADOS DO BANCO (OS 4 PILARES)
    // ==========================================
    
    // (SEU CÓDIGO SUPABASE PERMANECE EXATAMENTE IGUAL)
    const { data: profile } = await supabase.from('profiles').select('full_name, meta_peso, meal_plan').eq('id', userId).single();
    const todayStr = new Date().toLocaleDateString('en-CA');
    const { data: dailyLog } = await supabase.from('daily_logs').select('water_ml, meals_checked, mood').eq('user_id', userId).eq('date', todayStr).single();
    const { data: evaluation } = await supabase.from('evaluations').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
    const { data: qfa } = await supabase.from('qfa_responses').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
    const { data: antro } = await supabase.from('anthropometry').select('weight, waist, measurement_date').eq('user_id', userId).order('measurement_date', { ascending: false }).limit(2);

    // ==========================================
    // 2. PROCESSAR DADOS PARA O PRONTUÁRIO
    // ==========================================
    
    // (SEU CÓDIGO DE PROCESSAMENTO PERMANECE EXATAMENTE IGUAL)
    const nomePaciente = profile?.full_name?.split(' ')[0] || 'Paciente';
    const objetivoPrincipal = evaluation?.answers?.["0"] || 'Não informado';
    const rotinaSono = evaluation?.answers?.["3"] || '';
    const vontadesDoces = evaluation?.answers?.["7"] || '';

    let alimentosEvitar: string[] = [];
    if (qfa?.answers) {
      alimentosEvitar = Object.entries(qfa.answers).filter(([_, frequencia]) => frequencia === "0").map(([alimento]) => alimento.replace(/_/g, ' '));
    }

    let cardapioFormatado = 'Cardápio ainda não elaborado.';
    if (profile?.meal_plan && Array.isArray(profile.meal_plan)) {
      cardapioFormatado = profile.meal_plan.map((meal: any) => {
        const opcao = meal.options?.[0];
        return `- ${meal.time} | ${meal.name}: ${opcao?.description || 'Sem descrição'} (${opcao?.kcal || 0} kcal)`;
      }).join('\n');
    }

    let evolucaoTxt = 'Iniciando acompanhamento.';
    if (antro && antro.length === 2) {
      const pesoPerdido = antro[1].weight - antro[0].weight;
      const cinturaPerdida = antro[1].waist - antro[0].waist;
      evolucaoTxt = `Última medição: Peso ${antro[0].weight}kg, Cintura ${antro[0].waist}cm. `;
      if (pesoPerdido > 0) evolucaoTxt += `Já perdeu ${pesoPerdido.toFixed(1)}kg. `;
      if (cinturaPerdida > 0) evolucaoTxt += `Já reduziu ${cinturaPerdida.toFixed(1)}cm de cintura.`;
    }

    const humorHoje = dailyLog?.mood || 'Não registrado';
    const aguaHoje = dailyLog?.water_ml || 0;
    const refeicoesFeitas = dailyLog?.meals_checked?.length || 0;

    // ==========================================
    // 3. MONTAR O PRONTUÁRIO DINÂMICO DA IA
    // ==========================================
    const contextoInjetado = `
      Você é a Assistente Nutricional da Nutricionista Vanusa. 
      Seu tom é humano, acolhedor, empático (estilo WhatsApp) e direto. NUNCA corte uma frase no meio.
      
      DADOS DO PACIENTE:
      Nome: ${nomePaciente}
      Objetivo: ${objetivoPrincipal}
      Meta de Peso: ${profile?.meta_peso ? `${profile.meta_peso}kg` : 'Manutenção'}
      Evolução Clínica: ${evolucaoTxt}
      Queixas de Rotina: Sono (${rotinaSono}), Doces/Fome (${vontadesDoces}).
      Aversões: ${alimentosEvitar.length > 0 ? alimentosEvitar.join(', ') : 'Nenhuma restrição.'}

      CARDÁPIO ATUAL DO PACIENTE:
      ${cardapioFormatado}

      STATUS DO DIA DE HOJE (${todayStr}):
      Humor reportado hoje: ${humorHoje}
      Água bebida hoje: ${aguaHoje}ml
      Refeições feitas: ${refeicoesFeitas}

      REGRAS DE CONDUTA:
      1. Se o paciente perguntar sobre trocas, baseie-se no CARDÁPIO ATUAL. NÃO sugira Aversões.
      2. Se o humor for "difícil", seja empática e motive-o.
      3. Se a água de hoje estiver baixa (<1500ml), lembre-o gentilmente.
      4. Use Markdown (negrito) para destacar alimentos.
      5. Seja concisa no dia a dia, mas dê respostas completas ao detalhar cardápio.
    `;

    // ==========================================
    // 4. CHAMADA GOOGLE GEMINI (USANDO A BIBLIOTECA OFICIAL)
    // ==========================================
    
    // Inicializa a IA
    const genAI = new GoogleGenerativeAI(geminiKey);

    // Configura o modelo, já passando as instruções de sistema (System Prompt)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: contextoInjetado,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    // Formata o histórico recebido do Frontend para o padrão da biblioteca
    const rawHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Mantemos a sua lógica excelente de validação de turnos alternados
    let validHistory: any[] = [];
    let expectedRole = 'user';
    for (const msg of rawHistory) {
      if (msg.role === expectedRole) {
        validHistory.push(msg);
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      }
    }
    if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
      validHistory.pop();
    }

    // Inicia o chat já com o histórico
    const chat = model.startChat({
      history: validHistory,
    });

    // Envia a mensagem atual e aguarda a resposta
    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    if (!reply) {
      return NextResponse.json({ reply: "Pode repetir de outra forma? Não consegui processar." }, { status: 200 })
    }

    // SALVAR NO BANCO
    if (userId) {
      await supabase.from('ai_messages').insert({ user_id: userId, question: message, answer: reply })
    }

    return NextResponse.json({ reply })

  } catch (error) {
    console.error('Erro na rota:', error)
    // Tratamento de erro mais amigável
    return NextResponse.json({ reply: 'Tive um pequeno soluço técnico aqui. Pode me mandar a mensagem de novo?' }, { status: 200 })
  }
}