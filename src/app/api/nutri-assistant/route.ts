import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildContext } from '@/lib/contextBuilder'
import { checkRateLimit } from '@/lib/rateLimiter'
import { getCachedResponse } from '@/lib/responseCache'
import { getUserSummary, updateUserSummary } from '@/lib/memorySummary'
import { getSemanticMemories } from '@/lib/semanticSearch'
import { generateEmbedding } from '@/lib/embeddingService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🧠 DETECTOR DE COMPLEXIDADE
// ==========================================
function isComplexRequest(message: string, hasImage: boolean): boolean {
  const msg = message.toLowerCase();
  if (hasImage) return true;
  if (msg.includes('trocar') || msg.includes('substituir') || msg.includes('substituicao')) return true;
  if (msg.includes('emagrec') || msg.includes('resultado') || msg.includes('nao emagreci')) return true;
  if (msg.includes('desanimei') || msg.includes('não consegui') || msg.includes('nao consegui')) return true;
  return false;
}

// ==========================================
// 🛠️ CONSTRUTOR DE CONTEXTO ADMIN
// ==========================================
function buildAdminContext(adminData: any, currentTimeBR: string, deepContext: string): string {
  const patientsResumo = adminData?.patients?.map((p: any) => {
    const isDietReady = p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0;
    const objetivo = p.evaluation?.answers?.["0"] || 'Não definido';
    const aguaHoje = p.todayLog?.water_ml ? `${p.todayLog.water_ml}ml` : '0ml';
    const humorHoje = p.todayLog?.mood || 'Não registrou';

    return `- Nome: ${p.full_name || 'Desconhecido'} | Dieta: ${isDietReady ? 'Pronta' : 'Pendente'} | Novo: ${p.isNew ? 'Sim' : 'Não'} | Atrasado: ${p.isLate ? 'Sim' : 'Não'} | Meta: ${p.meta_peso ? `${p.meta_peso}kg` : 'N/A'} | Água Hoje: ${aguaHoje} | Humor Hoje: ${humorHoje}`;
  }).join('\n') || 'Nenhum paciente cadastrado.';

  const leadsResumo = adminData?.leads?.map((l: any) => 
    `- Nome: ${l.nome} | Whats: ${l.whatsapp} | Status: ${l.status}`
  ).join('\n') || 'Nenhum lead pendente.';

  return `
Você é a Assistente de Inteligência Artificial exclusiva da Nutricionista Vanusa.
Você está operando no PAINEL ADMINISTRATIVO dela. 
A data e hora exata agora (Horário de Brasília) é: ${currentTimeBR}.

O seu objetivo é agir como uma co-piloto clínica e administrativa da Vanusa. 

📊 DADOS DE USO HOJE:
- Mensagens hoje: ${adminData?.todayTotalMessages || 0}
- Pacientes ativos no chat hoje: ${Object.keys(adminData?.usageStats || {}).length}

👥 VISÃO GERAL DOS PACIENTES:
${patientsResumo}

🎯 OPORTUNIDADES (LEADS):
${leadsResumo}

${deepContext ? `\n🔍 DADOS CLÍNICOS PROFUNDOS ENCONTRADOS NO BANCO DE DADOS:\n${deepContext}\n` : ''}

REGRAS:
- Dirija-se a ela como "Vanusa" ou "Nutri".
- Você tem acesso direto ao banco de dados Supabase dela (Antropometria, Exames Bioquímicos, Dobras Cutâneas, Diários Históricos, Notas Clínicas).
- Quando a Vanusa perguntar sobre medidas, histórico de água, balanço hídrico ou exames de um paciente específico, USE OS DADOS PROFUNDOS fornecidos acima para dar uma resposta analítica e precisa.
- Nunca limite o tamanho das suas respostas se a análise clínica exigir profundidade.
`.trim();
}

export async function POST(req: Request) {
  try {
    const { userId, message, history, image, isAdmin, adminData } = await req.json()
    const safeMessage = message?.trim() || '';

    if (!safeMessage && !image) {
      return NextResponse.json({ reply: "Por favor, digite uma mensagem ou envie uma foto do seu prato." }, { status: 200 });
    }

    if (!userId) {
       return NextResponse.json({ reply: "Sessão inválida. Por favor, faça login novamente." }, { status: 401 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ reply: "Erro: Chave de API não configurada." }, { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const dataAtual = new Date();
    const todayStr = dataAtual.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const currentTimeBR = dataAtual.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });

    // ==========================================
    // 👑 MODO ADMINISTRADOR (Varredura de Todas as Tabelas)
    // ==========================================
    if (isAdmin && adminData) {
      let deepContext = '';
      const safeMessageLower = safeMessage.toLowerCase();
      
      // Tenta identificar o paciente pelo primeiro nome na mensagem
      const mentionedPatient = adminData.patients?.find((p: any) => {
        if (!p.full_name) return false;
        const firstName = p.full_name.split(' ')[0].toLowerCase();
        return safeMessageLower.includes(firstName);
      });

      if (mentionedPatient) {
        const targetId = mentionedPatient.id;

        // 🔥 VARREDURA TOTAL: Busca em TODAS as tabelas clínicas filtrando por user_id
        const [antro, skin, bio, notes, logs, qfa, evals, checkins] = await Promise.all([
          supabase.from('anthropometry').select('*').eq('user_id', targetId).order('measurement_date', { ascending: false }),
          supabase.from('skinfolds').select('*').eq('user_id', targetId).order('measurement_date', { ascending: false }),
          supabase.from('biochemicals').select('*').eq('user_id', targetId).order('exam_date', { ascending: false }),
          supabase.from('clinical_notes').select('*').eq('user_id', targetId).order('created_at', { ascending: false }),
          supabase.from('daily_logs').select('*').eq('user_id', targetId).order('date', { ascending: false }).limit(30),
          supabase.from('qfa_responses').select('*').eq('user_id', targetId).order('created_at', { ascending: false }).limit(1),
          supabase.from('evaluations').select('*').eq('user_id', targetId).limit(1),
          supabase.from('checkins').select('*').eq('user_id', targetId).order('created_at', { ascending: false }).limit(4)
        ]);

        deepContext = `
        DADOS DO PACIENTE: ${mentionedPatient.full_name}
        
        📋 AVALIAÇÃO INICIAL (Histórico de Saúde): ${JSON.stringify(evals.data)}
        🍎 QFA (Questionário de Frequência Alimentar): ${JSON.stringify(qfa.data)}
        ✅ ÚLTIMOS CHECK-INS (Evolução relatada): ${JSON.stringify(checkins.data)}
        📊 ANTROPOMETRIA (Peso/Medidas): ${JSON.stringify(antro.data)}
        🤏 DOBRAS CUTÂNEAS: ${JSON.stringify(skin.data)}
        🩸 EXAMES BIOQUÍMICOS: ${JSON.stringify(bio.data)}
        📝 NOTAS DA NUTRI: ${JSON.stringify(notes.data)}
        💧 DIÁRIO (Últimos 30 dias): ${JSON.stringify(logs.data)}
        `;
      }

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: buildAdminContext(adminData, currentTimeBR, deepContext),
      });

      const chat = model.startChat({
        history: (history || []).slice(-10).map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }))
      });

      const result = await chat.sendMessage(safeMessage);
      return NextResponse.json({ reply: result.response.text(), remaining: 999 });
    }

    // ==========================================
    // ⚡ FLUXO PADRÃO (PACIENTE)
    // ==========================================

    // ==========================================
    // ⚡ 1. CACHE C/ CONSUMO DE LIMITE (PACIENTE)
    // ==========================================
    if (!image && safeMessage) {
      const cached = await getCachedResponse(userId, safeMessage);

      if (cached) {
        console.log(`[Cache Hit] Resposta instantânea via cache para o usuário ${userId}`);
        
        const currentRate = await checkRateLimit(userId);
        
        if (!currentRate.allowed) {
          return NextResponse.json({
            reply: `Você atingiu o limite diário de ${currentRate.limit} mensagens.\n\nVolte amanhã ou fale com a nutricionista pelo WhatsApp 💬`,
            limitReached: true,
            remaining: 0
          }, { status: 200 });
        }

        const { data: insertedMsg, error: insertError } = await supabase
          .from('ai_messages')
          .insert({ user_id: userId, question: safeMessage, answer: cached })
          .select('id')
          .single();

        if (!insertError && insertedMsg) {
          if (safeMessage.length > 10) {
            (async () => {
              try {
                const embeddingText = `Pergunta: ${safeMessage}\nResposta: ${cached}`;
                const embeddingVector = await generateEmbedding(embeddingText);
                if (embeddingVector) {
                  await supabase.from('ai_messages').update({ embedding: embeddingVector }).eq('id', insertedMsg.id);
                }
              } catch (bgError) {
                console.error('[Background Cache Error]', bgError);
              }
            })();
          }
        }

        return NextResponse.json({
          reply: cached,
          cached: true,
          remaining: Math.max(currentRate.remaining - 1, 0),
          limit: currentRate.limit
        }, { status: 200 });
      }
    }

    // ==========================================
    // 🔒 2. RATE LIMIT (PACIENTE)
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
    const { data: profile } = await supabase.from('profiles').select('full_name, meta_peso, meal_plan').eq('id', userId).single();
    const { data: dailyLog } = await supabase.from('daily_logs').select('water_ml, meals_checked, mood').eq('user_id', userId).eq('date', todayStr).single();
    const { data: evaluation } = await supabase.from('evaluations').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
    const { data: qfa } = await supabase.from('qfa_responses').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
    const { data: antro } = await supabase.from('anthropometry').select('weight, waist, measurement_date').eq('user_id', userId).order('measurement_date', { ascending: false }).limit(2);

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
    // 5. CONTEXTO INTELIGENTE + RAG VETORIAL
    // ==========================================
    const baseContext = buildContext(safeMessage, {
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

    const summary = await getUserSummary(userId);

    const msgLower = safeMessage.toLowerCase();
    const shouldUseMemory =
      !!image ||
      safeMessage.length > 20 ||
      msgLower.includes('trocar') ||
      msgLower.includes('emagrec') ||
      msgLower.includes('não consegui') ||
      msgLower.includes('nao consegui');

    const semanticMemory = (shouldUseMemory && safeMessage) 
      ? await getSemanticMemories(userId, safeMessage) 
      : '';

    const contextoInjetado = `
[INFORMAÇÃO DO SISTEMA]: A data e hora exata agora (Horário de Brasília) é: ${currentTimeBR}. Use isso para saber em que momento do dia o paciente está (manhã, tarde, noite) e agir adequadamente.

${baseContext}
${summary ? `RESUMO DO COMPORTAMENTO DO PACIENTE:\n${summary}\n` : ''}
${semanticMemory || ''}
    `.trim();

    // ==========================================
    // 6. MODELO HÍBRIDO E LOGGING
    // ==========================================
    const useComplexModel = isComplexRequest(safeMessage, !!image);
    const modelName = useComplexModel ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
    const remainingReal = Math.max(rate.remaining - 1, 0);

    console.log(`[AI] Modelo: ${modelName} | Restante Real: ${remainingReal} | Usa Resumo: ${!!summary} | Usa Vector RAG: ${!!semanticMemory}`);

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

    let result;
    if (image) {
      result = await chat.sendMessage([
        { text: safeMessage || "Analise esse prato para mim" },
        { inlineData: { mimeType: "image/jpeg", data: image } }
      ]);
    } else {
      result = await chat.sendMessage(safeMessage);
    }

    const reply = result.response.text();
    if (!reply) return NextResponse.json({ reply: "Pode repetir?" }, { status: 200 })

    // ==========================================
    // 7. SALVAR HISTÓRICO E RAG EM BACKGROUND
    // ==========================================
    if (userId) {
      const questionText = safeMessage || 'Enviou uma imagem';
      const { data: insertedMsg, error: insertError } = await supabase
        .from('ai_messages')
        .insert({ user_id: userId, question: questionText, answer: reply })
        .select('id')
        .single();

      if (!insertError && insertedMsg) {
        (async () => {
          try {
            await updateUserSummary(userId, { question: questionText, answer: reply });
            if (questionText.length > 10) {
              const embeddingText = `Pergunta: ${questionText}\nResposta: ${reply}`;
              const embeddingVector = await generateEmbedding(embeddingText);
              if (embeddingVector) {
                await supabase.from('ai_messages').update({ embedding: embeddingVector }).eq('id', insertedMsg.id);
              }
            }
          } catch (bgError) {
            console.error('[Background Task Error]', bgError);
          }
        })();
      }
    }

    return NextResponse.json({
      reply,
      remaining: remainingReal, 
      limit: rate.limit
    });

  } catch (error) {
    console.error('Erro na API do Assistente:', error);
    return NextResponse.json({ reply: 'Tive um pequeno soluço técnico. Pode tentar novamente?' }, { status: 200 });
  }
}