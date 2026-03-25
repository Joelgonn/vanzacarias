import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildContext } from '@/lib/contextBuilder'
import { checkRateLimit } from '@/lib/rateLimiter'
import { getCachedResponse } from '@/lib/responseCache'
import { getUserSummary, updateUserSummary } from '@/lib/memorySummary'
import { getSemanticMemories } from '@/lib/semanticSearch'
import { generateEmbedding } from '@/lib/embeddingService'

// O client Service Role ignora as RLS (Row Level Security).
// Por isso, é CRÍTICO validarmos quem é o usuário antes de executar buscas profundas.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 🛠️ FUNÇÕES AUXILIARES
// ==========================================
function isComplexRequest(message: string, hasImage: boolean): boolean {
  const msg = message.toLowerCase();
  if (hasImage) return true;
  if (msg.includes('trocar') || msg.includes('substituir') || msg.includes('substituicao')) return true;
  if (msg.includes('emagrec') || msg.includes('resultado') || msg.includes('nao emagreci')) return true;
  if (msg.includes('desanimei') || msg.includes('não consegui') || msg.includes('nao consegui')) return true;
  return false;
}

function normalizeString(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ==========================================
// 🛠️ CONSTRUTOR DE CONTEXTO ADMIN
// ==========================================
function buildAdminContext(adminData: any, currentTimeBR: string, deepContext: string): string {
  const patientsResumo = adminData?.patients?.map((p: any) => {
    const isDietReady = p.meal_plan && Array.isArray(p.meal_plan) && p.meal_plan.length > 0;
    const aguaHoje = p.todayLog?.water_ml ? `${p.todayLog.water_ml}ml` : '0ml';
    const humorHoje = p.todayLog?.mood || 'Não registrou';

    return `- Nome: ${p.full_name || 'Desconhecido'} | Dieta: ${isDietReady ? 'Pronta' : 'Pendente'} | Atrasado: ${p.isLate ? 'Sim' : 'Não'} | Meta: ${p.meta_peso ? `${p.meta_peso}kg` : 'N/A'} | Água: ${aguaHoje} | Humor: ${humorHoje}`;
  }).join('\n') || 'Nenhum paciente cadastrado.';

  const leadsResumo = adminData?.leads?.map((l: any) => 
    `- Nome: ${l.nome} | Whats: ${l.whatsapp} | Status: ${l.status}`
  ).join('\n') || 'Nenhum lead pendente.';

  return `
Você é a Assistente de Inteligência Artificial exclusiva da Nutricionista Vanusa.
Você está operando no PAINEL ADMINISTRATIVO dela. 
Data e hora (Brasília): ${currentTimeBR}.

Seu objetivo é agir como uma co-piloto clínica e administrativa.

📊 DADOS DE USO:
- Mensagens da IA hoje: ${adminData?.todayTotalMessages || 0}
- Pacientes ativos no chat: ${Object.keys(adminData?.usageStats || {}).length}

👥 VISÃO GERAL DOS PACIENTES:
${patientsResumo}

🎯 OPORTUNIDADES (LEADS):
${leadsResumo}

${deepContext ? `\n🔍 DADOS CLÍNICOS PROFUNDOS ENCONTRADOS NO BANCO DE DADOS:\n${deepContext}\n` : ''}

REGRAS:
- Dirija-se a ela como "Vanusa" ou "Nutri".
- Analise os dados profundamente quando solicitado.
`.trim();
}

export async function POST(req: Request) {
  try {
    const { userId, message, history, image, isAdmin, adminData } = await req.json()
    const safeMessage = message?.trim() || '';

    if (!safeMessage && !image) {
      return NextResponse.json({ reply: "Por favor, digite uma mensagem ou envie uma foto." }, { status: 200 });
    }

    if (!userId) {
       return NextResponse.json({ reply: "Sessão inválida. Por favor, faça login novamente." }, { status: 401 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ reply: "Erro de configuração no servidor (Gemini API Key)." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const dataAtual = new Date();
    const todayStr = dataAtual.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const currentTimeBR = dataAtual.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });

    // ==========================================
    // 👑 MODO ADMINISTRADOR (Validado e Otimizado)
    // ==========================================
    if (isAdmin) {
      console.log(`[API Nutri Assistant] Iniciando verificação de Admin. UserId recebido:`, userId);

      // 1. CAMADA DE SEGURANÇA: Retiramos o .single() para evitar o erro de coerção JSON.
      // Solicitamos um array com limite de 1.
      const { data: profilesData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role') 
        .eq('id', userId)
        .limit(1);

      if (profileError) {
        return NextResponse.json({ 
          reply: `Erro de segurança ao consultar o banco de dados: ${profileError.message}` 
        }, { status: 403 });
      }

      // Extraímos o primeiro item do array de forma segura
      const userProfile = profilesData && profilesData.length > 0 ? profilesData[0] : null;

      if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'nutricionista')) {
        return NextResponse.json({ 
          reply: `Acesso negado. Perfil não encontrado ou sem permissão de administrador. (UserId buscado: ${userId})` 
        }, { status: 403 });
      }

      let deepContext = '';
      const normalizedMsg = normalizeString(safeMessage);
      
      // 2. IDENTIFICAÇÃO DE PACIENTE (Mais Robusta)
      const mentionedPatient = adminData?.patients?.find((p: any) => {
        if (!p.full_name) return false;
        const patientNameParts = normalizeString(p.full_name).split(' ');
        const firstName = patientNameParts[0];
        
        // Ex: Procura o primeiro nome se ele for maior que 2 letras
        return firstName.length > 2 && normalizedMsg.includes(firstName);
      });

      // 3. BUSCA DE DADOS LIMITADA (Evitar consumo excessivo de tokens)
      if (mentionedPatient) {
        const targetId = mentionedPatient.id;

        const [antro, skin, bio, notes, logs, qfa, evals, checkins] = await Promise.all([
          supabaseAdmin.from('anthropometry').select('*').eq('user_id', targetId).order('measurement_date', { ascending: false }).limit(3),
          supabaseAdmin.from('skinfolds').select('*').eq('user_id', targetId).order('measurement_date', { ascending: false }).limit(3),
          supabaseAdmin.from('biochemicals').select('*').eq('user_id', targetId).order('exam_date', { ascending: false }).limit(2),
          supabaseAdmin.from('clinical_notes').select('*').eq('user_id', targetId).order('created_at', { ascending: false }).limit(3),
          supabaseAdmin.from('daily_logs').select('*').eq('user_id', targetId).order('date', { ascending: false }).limit(7),
          supabaseAdmin.from('qfa_responses').select('*').eq('user_id', targetId).order('created_at', { ascending: false }).limit(1),
          supabaseAdmin.from('evaluations').select('*').eq('user_id', targetId).limit(1),
          supabaseAdmin.from('checkins').select('*').eq('user_id', targetId).order('created_at', { ascending: false }).limit(3)
        ]);

        // Tratamento de erros das queries (opcional, apenas para log)
        if (antro.error || logs.error) console.error("Erro ao buscar contexto profundo:", antro.error || logs.error);

        deepContext = `
        DADOS DO PACIENTE: ${mentionedPatient.full_name}
        📋 AVALIAÇÃO: ${JSON.stringify(evals.data)}
        ✅ ÚLTIMOS 3 CHECK-INS: ${JSON.stringify(checkins.data)}
        📊 ANTROPOMETRIA (Últimas 3): ${JSON.stringify(antro.data)}
        🤏 DOBRAS (Últimas 3): ${JSON.stringify(skin.data)}
        🩸 EXAMES (Últimos 2): ${JSON.stringify(bio.data)}
        📝 NOTAS DA NUTRI (Últimas 3): ${JSON.stringify(notes.data)}
        💧 DIÁRIO (Últimos 7 dias): ${JSON.stringify(logs.data)}
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

      let result;
      if (image) {
        result = await chat.sendMessage([
          safeMessage || "Analise essa imagem",
          { inlineData: { mimeType: "image/jpeg", data: image } }
        ]);
      } else {
        result = await chat.sendMessage(safeMessage);
      }

      const adminReply = result.response.text();

      // 4. SALVAR HISTÓRICO DO ADMIN (Background Task)
      (async () => {
        try {
          await supabaseAdmin.from('ai_messages').insert({ 
            user_id: userId, 
            question: `[ADMIN] ${safeMessage || 'Imagem enviada'}`, 
            answer: adminReply 
          });
        } catch (err) {
          console.error('[Admin Log Error]', err);
        }
      })();

      return NextResponse.json({ reply: adminReply, remaining: 999 });
    }

    // ==========================================
    // ⚡ FLUXO PADRÃO (PACIENTE)
    // ==========================================

    // 1. CACHE C/ CONSUMO DE LIMITE
    if (!image && safeMessage) {
      const cached = await getCachedResponse(userId, safeMessage);

      if (cached) {
        const currentRate = await checkRateLimit(userId);
        
        if (!currentRate.allowed) {
          return NextResponse.json({
            reply: `Você atingiu o limite diário de ${currentRate.limit} mensagens.\n\nVolte amanhã ou fale com a nutricionista no WhatsApp 💬`,
            limitReached: true,
            remaining: 0
          }, { status: 200 });
        }

        const { data: insertedMsg, error: insertError } = await supabaseAdmin
          .from('ai_messages')
          .insert({ user_id: userId, question: safeMessage, answer: cached })
          .select('id')
          .single();

        if (!insertError && insertedMsg && safeMessage.length > 10) {
          (async () => {
            try {
              const embeddingText = `Pergunta: ${safeMessage}\nResposta: ${cached}`;
              const embeddingVector = await generateEmbedding(embeddingText);
              if (embeddingVector) {
                await supabaseAdmin.from('ai_messages').update({ embedding: embeddingVector }).eq('id', insertedMsg.id);
              }
            } catch (bgError) {
              console.error('[Background Cache Error]', bgError);
            }
          })();
        }

        return NextResponse.json({
          reply: cached,
          cached: true,
          remaining: Math.max(currentRate.remaining - 1, 0),
          limit: currentRate.limit
        }, { status: 200 });
      }
    }

    // 2. RATE LIMIT
    const rate = await checkRateLimit(userId);
    if (!rate.allowed) {
      return NextResponse.json({
        reply: `Você atingiu o limite diário de ${rate.limit} mensagens.\n\nVolte amanhã ou fale com a nutricionista pelo WhatsApp 💬`,
        limitReached: true,
        remaining: 0
      }, { status: 200 });
    }

    // 3. BUSCAR DADOS DO PACIENTE
    const [profileRes, dailyLogRes, evalRes, qfaRes, antroRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, meta_peso, meal_plan').eq('id', userId).limit(1),
      supabaseAdmin.from('daily_logs').select('water_ml, meals_checked, mood').eq('user_id', userId).eq('date', todayStr).limit(1),
      supabaseAdmin.from('evaluations').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabaseAdmin.from('qfa_responses').select('answers').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabaseAdmin.from('anthropometry').select('weight, waist, measurement_date').eq('user_id', userId).order('measurement_date', { ascending: false }).limit(2)
    ]);

    // Otimização e prevenção do mesmo erro de JSON (.single()) nos dados do paciente
    const profile = profileRes.data?.[0];
    const dailyLog = dailyLogRes.data?.[0];
    const evaluation = evalRes.data?.[0];
    const qfa = qfaRes.data?.[0];
    const antro = antroRes.data;

    // 4. PROCESSAMENTO DE CONTEXTO
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

    // 5. CONTEXTO INTELIGENTE + RAG VETORIAL
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
[INFORMAÇÃO DO SISTEMA]: A data e hora exata agora (Horário de Brasília) é: ${currentTimeBR}. Use isso para saber o momento do dia e agir adequadamente.

${baseContext}
${summary ? `RESUMO DO COMPORTAMENTO DO PACIENTE:\n${summary}\n` : ''}
${semanticMemory || ''}
    `.trim();

    // 6. MODELO HÍBRIDO E LOGGING
    const useComplexModel = isComplexRequest(safeMessage, !!image);
    const modelName = useComplexModel ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
    const remainingReal = Math.max(rate.remaining - 1, 0);

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
        safeMessage || "Analise esse prato para mim",
        { inlineData: { mimeType: "image/jpeg", data: image } }
      ]);
    } else {
      result = await chat.sendMessage(safeMessage);
    }

    const reply = result.response.text();
    if (!reply) return NextResponse.json({ reply: "Pode repetir?" }, { status: 200 });

    // 7. SALVAR HISTÓRICO E RAG EM BACKGROUND
    if (userId) {
      const questionText = safeMessage || 'Enviou uma imagem';
      // Aqui usamos data[0] em vez de single() para manter o padrão seguro e evitar bugs no insert
      const { data: insertedMsgs, error: insertError } = await supabaseAdmin
        .from('ai_messages')
        .insert({ user_id: userId, question: questionText, answer: reply })
        .select('id');

      const insertedMsg = insertedMsgs?.[0];

      if (!insertError && insertedMsg) {
        (async () => {
          try {
            await updateUserSummary(userId, { question: questionText, answer: reply });
            if (questionText.length > 10) {
              const embeddingText = `Pergunta: ${questionText}\nResposta: ${reply}`;
              const embeddingVector = await generateEmbedding(embeddingText);
              if (embeddingVector) {
                await supabaseAdmin.from('ai_messages').update({ embedding: embeddingVector }).eq('id', insertedMsg.id);
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