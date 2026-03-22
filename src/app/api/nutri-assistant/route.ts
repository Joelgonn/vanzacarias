import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildContext } from '@/lib/contextBuilder'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { userId, message, history, image } = await req.json()

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ reply: "Erro: Chave de API não configurada." }, { status: 200 });
    }

    // ==========================================
    // 1. BUSCAR DADOS (INALTERADO)
    // ==========================================
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, meta_peso, meal_plan')
      .eq('id', userId)
      .single();

    const todayStr = new Date().toLocaleDateString('en-CA');

    const { data: dailyLog } = await supabase
      .from('daily_logs')
      .select('water_ml, meals_checked, mood')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .single();

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

    const { data: antro } = await supabase
      .from('anthropometry')
      .select('weight, waist, measurement_date')
      .eq('user_id', userId)
      .order('measurement_date', { ascending: false })
      .limit(2);

    // ==========================================
    // 2. PROCESSAMENTO (INALTERADO)
    // ==========================================
    const nomePaciente = profile?.full_name?.split(' ')[0] || 'Paciente';
    const objetivoPrincipal = evaluation?.answers?.["0"] || 'Não informado';
    const rotinaSono = evaluation?.answers?.["3"] || '';
    const vontadesDoces = evaluation?.answers?.["7"] || '';

    let alimentosEvitar: string[] = [];
    if (qfa?.answers) {
      alimentosEvitar = Object.entries(qfa.answers)
        .filter(([_, frequencia]) => frequencia === "0")
        .map(([alimento]) => alimento.replace(/_/g, ' '));
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
    // 3. CONTEXTO INTELIGENTE
    // ==========================================
    const contextoInjetado = buildContext(message, {
      nomePaciente,
      objetivoPrincipal,
      metaPeso: profile?.meta_peso ? `${profile.meta_peso}kg` : 'Manutenção',
      rotinaSono,
      vontadesDoces,
      alimentosEvitar,
      cardapioFormatado,
      evolucaoTxt,
      humorHoje,
      aguaHoje,
      refeicoesFeitas,
      todayStr
    });

    const genAI = new GoogleGenerativeAI(geminiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: contextoInjetado,
    });

    const chat = model.startChat({
      history: (history || []).slice(-7).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    // ==========================================
    // 🔥 ENVIO COM OU SEM IMAGEM
    // ==========================================
    let result;

    if (image) {
      result = await chat.sendMessage([
        { text: message || "Analise esse prato para mim" },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: image // base64
          }
        }
      ]);
    } else {
      result = await chat.sendMessage(message);
    }

    const reply = result.response.text();

    if (!reply) {
      return NextResponse.json({ reply: "Pode repetir?" }, { status: 200 })
    }

    if (userId) {
      await supabase.from('ai_messages').insert({
        user_id: userId,
        question: message,
        answer: reply
      })
    }

    return NextResponse.json({ reply })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ reply: 'Erro, tenta de novo.' }, { status: 200 })
  }
}