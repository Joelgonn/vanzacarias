import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildContext } from '@/lib/contextBuilder'
import { checkRateLimit } from '@/lib/rateLimiter'
import { getRelevantMemories } from '@/lib/memoryRetriever'
import { getCachedResponse } from '@/lib/responseCache'
import { getUserSummary, updateUserSummary } from '@/lib/memorySummary' // 🔥 NOVO IMPORT

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🧠 DETECTOR DE COMPLEXIDADE
// ==========================================
function isComplexRequest(message: string, hasImage: boolean): boolean {
  const msg = message?.toLowerCase() || '';

  if (hasImage) return true;

  if (
    msg.includes('trocar') ||
    msg.includes('substituir') ||
    msg.includes('substituicao')
  ) return true;

  if (
    msg.includes('emagrec') ||
    msg.includes('resultado') ||
    msg.includes('não emagreci') ||
    msg.includes('nao emagreci')
  ) return true;

  if (
    msg.includes('desanimei') ||
    msg.includes('não consegui') ||
    msg.includes('nao consegui')
  ) return true;

  return false;
}

export async function POST(req: Request) {
  try {
    const { userId, message, history, image } = await req.json()

    // ==========================================
    // 🛡️ EARLY RETURN (Proteção Básica)
    // ==========================================
    if (!message && !image) {
      return NextResponse.json({ reply: "Por favor, digite uma mensagem ou envie uma foto do seu prato." }, { status: 200 });
    }

    if (!userId) {
       return NextResponse.json({ reply: "Sessão inválida. Por favor, faça login novamente." }, { status: 401 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ reply: "Erro: Chave de API não configurada." }, { status: 200 });
    }

    // ==========================================
    // ⚡ 1. CACHE (Roda Antes de Tudo)
    // ==========================================
    if (!image && message) {
      const cached = await getCachedResponse(userId, message);

      if (cached) {
        console.log(`[Cache Hit] Resposta instantânea via cache para o usuário ${userId}`);
        
        const currentRate = await checkRateLimit(userId);

        return NextResponse.json({
          reply: cached,
          cached: true,
          remaining: currentRate.remaining, 
          limit: currentRate.limit
        }, { status: 200 });
      }
    }

    // ==========================================
    // 🔒 2. RATE LIMIT
    // ==========================================
    const rate = await checkRateLimit(userId);

    if (!rate.allowed) {
      return NextResponse.json({
        reply: `Você atingiu o limite diário de ${rate.limit} mensagens.\n\nVolte amanhã ou fale com a nutricionista pelo WhatsApp 💬`,
        limitReached: true,
        remaining: 0
      }, { status: 200 });
    }

    // ==========================================
    // 3. BUSCAR DADOS DO PACIENTE
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
    // 4. PROCESSAMENTO DE CONTEXTO
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
    // 5. CONTEXTO INTELIGENTE + DUPLA MEMÓRIA 🔥
    // ==========================================
    
    // Constrói o contexto base
    const baseContext = buildContext(message || '', {
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
      todayStr,
      hasImage: !!image
    });

    // 🧠 5.1 Busca Memória de Longo Prazo (Resumo)
    const summary = await getUserSummary(userId);

    // 🧠 5.2 Busca Memória de Curto Prazo (Últimas interações, apenas se necessário)
    const msgLower = message?.toLowerCase() || '';
    const shouldUseMemory =
      !!image ||
      (message && message.length > 20) ||
      msgLower.includes('trocar') ||
      msgLower.includes('emagrec') ||
      msgLower.includes('não consegui') ||
      msgLower.includes('nao consegui');

    const memoryContext = shouldUseMemory
      ? await getRelevantMemories(userId)
      : '';

    // Injeta as memórias no contexto final
    const contextoInjetado = `
${baseContext}

${summary ? `RESUMO DO COMPORTAMENTO DO PACIENTE:\n${summary}\n` : ''}
${memoryContext ? `${memoryContext}` : ''}
    `.trim();

    // ==========================================
    // 6. MODELO HÍBRIDO E LOGGING
    // ==========================================
    const useComplexModel = isComplexRequest(message || '', !!image);

    const modelName = useComplexModel
      ? "gemini-2.5-flash"
      : "gemini-2.5-flash-lite";

    // Logging Estratégico Completo
    console.log(`[AI] Modelo: ${modelName} | Restante: ${rate.remaining} | Usa Resumo: ${!!summary} | Usa Memória: ${!!memoryContext}`);

    const genAI = new GoogleGenerativeAI(geminiKey);

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: contextoInjetado,
    });

    const chat = model.startChat({
      history: (history || []).slice(-7).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    // ==========================================
    // 7. ENVIO AO GEMINI
    // ==========================================
    let result;

    if (image) {
      result = await chat.sendMessage([
        { text: message || "Analise esse prato para mim" },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: image
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

    // ==========================================
    // 8. SALVAR INTERAÇÃO E ATUALIZAR RESUMO 🧠
    // ==========================================
    if (userId) {
      const questionText = message || 'Enviou uma imagem';
      
      // Salva a mensagem no histórico do banco
      await supabase.from('ai_messages').insert({
        user_id: userId,
        question: questionText,
        answer: reply
      });

      // 🔥 ATUALIZA O RESUMO (Background seguro)
      // Usamos um bloco try/catch isolado para que uma falha na IA de resumo 
      // não impeça o paciente de receber a resposta na tela.
      try {
        await updateUserSummary(userId, {
          question: questionText,
          answer: reply
        });
        console.log(`[AI Memory] Resumo atualizado para o usuário ${userId}`);
      } catch (summaryError) {
        console.error('[AI Memory Error] Falha ao atualizar resumo:', summaryError);
      }
    }

    // ==========================================
    // 9. RETORNO FINAL
    // ==========================================
    return NextResponse.json({
      reply,
      remaining: rate.remaining - 1,
      limit: rate.limit
    })

  } catch (error) {
    console.error('Erro na API do Assistente:', error)
    return NextResponse.json({ reply: 'Tive um pequeno soluço técnico. Pode tentar novamente?' }, { status: 200 })
  }
}