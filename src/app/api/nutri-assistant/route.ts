import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    
    // Pilar 1: Perfil e Cardápio
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, meta_peso, meal_plan')
      .eq('id', userId)
      .single();

    // Pilar 2: Diário de Hoje (Empatia)
    const todayStr = new Date().toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
    const { data: dailyLog } = await supabase
      .from('daily_logs')
      .select('water_ml, meals_checked, mood')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .single();

    // Pilar 3: Avaliação e Raio-X (Clínico)
    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('answers')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: qfa } = await supabase
      .from('qfa_responses')
      .select('answers')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Pilar 4: Antropometria (Resultados e Evolução)
    const { data: antro } = await supabase
      .from('anthropometry')
      .select('weight, waist, measurement_date')
      .eq('user_id', userId)
      .order('measurement_date', { ascending: false })
      .limit(2);

    // ==========================================
    // 2. PROCESSAR DADOS PARA O PRONTUÁRIO
    // ==========================================

    const nomePaciente = profile?.full_name?.split(' ')[0] || 'Paciente';
    const objetivoPrincipal = evaluation?.answers?.["0"] || 'Não informado';
    const rotinaSono = evaluation?.answers?.["3"] || '';
    const vontadesDoces = evaluation?.answers?.["7"] || '';

    // Mapear alimentos que o paciente NÃO come (frequência "0" no QFA)
    let alimentosEvitar: string[] = [];
    if (qfa?.answers) {
      alimentosEvitar = Object.entries(qfa.answers)
        .filter(([_, frequencia]) => frequencia === "0")
        .map(([alimento]) => alimento.replace(/_/g, ' '));
    }

    // Formatar Cardápio de forma limpa para a IA ler
    let cardapioFormatado = 'Cardápio ainda não elaborado.';
    if (profile?.meal_plan && Array.isArray(profile.meal_plan)) {
      cardapioFormatado = profile.meal_plan.map((meal: any) => {
        const opcao = meal.options?.[0]; // Pega a primeira opção de cada refeição
        return `- ${meal.time} | ${meal.name}: ${opcao?.description || 'Sem descrição'} (${opcao?.kcal || 0} kcal)`;
      }).join('\n');
    }

    // Calcular evolução (se perdeu peso ou cintura)
    let evolucaoTxt = 'Iniciando acompanhamento.';
    if (antro && antro.length === 2) {
      const pesoPerdido = antro[1].weight - antro[0].weight;
      const cinturaPerdida = antro[1].waist - antro[0].waist;
      evolucaoTxt = `Última medição: Peso ${antro[0].weight}kg, Cintura ${antro[0].waist}cm. `;
      if (pesoPerdido > 0) evolucaoTxt += `Já perdeu ${pesoPerdido.toFixed(1)}kg. `;
      if (cinturaPerdida > 0) evolucaoTxt += `Já reduziu ${cinturaPerdida.toFixed(1)}cm de cintura.`;
    }

    // Resumo do dia atual
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
      Aversões (Não sugerir estes alimentos): ${alimentosEvitar.length > 0 ? alimentosEvitar.join(', ') : 'Nenhuma restrição identificada.'}

      CARDÁPIO ATUAL DO PACIENTE:
      ${cardapioFormatado}

      STATUS DO DIA DE HOJE (${todayStr}):
      Humor reportado hoje: ${humorHoje}
      Água bebida hoje: ${aguaHoje}ml
      Refeições marcadas como feitas: ${refeicoesFeitas}

      REGRAS DE CONDUTA:
      1. Se o paciente perguntar sobre trocas ou lanches, baseie-se no CARDÁPIO ATUAL dele, sugerindo equivalentes do mesmo grupo alimentar. NÃO sugira nada que esteja na lista de Aversões.
      2. Se o humor de hoje for "difícil", seja empática, motive-o, lembre do objetivo dele.
      3. Se a água de hoje estiver baixa (menos de 1500ml), lembre-o gentilmente de beber água.
      4. Use formatação Markdown (negrito) para destacar alimentos e quantidades.
      5. Respostas sempre curtas, focadas em resolver a dúvida ou acolher o desabafo.
    `;

    // ==========================================
    // 4. CHAMADA GOOGLE GEMINI
    // ==========================================
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const rawHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

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

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: contextoInjetado }]
        },
        contents: [
          ...validHistory, 
          { role: 'user', parts: [{ text: message }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    })

    const data = await response.json()

    if (data.error) {
      console.error('Erro Gemini Detalhado:', JSON.stringify(data.error, null, 2))
      return NextResponse.json({ reply: "Tive um soluço técnico aqui. Pode repetir?" }, { status: 200 })
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Pode repetir de outra forma? Não consegui processar."

    // SALVAR NO BANCO
    if (userId) {
      await supabase.from('ai_messages').insert({ user_id: userId, question: message, answer: reply })
    }

    return NextResponse.json({ reply })

  } catch (error) {
    console.error('Erro na rota:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}