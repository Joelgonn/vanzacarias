import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Adicionamos o planType para identificar o que está sendo comprado
    // Pode ser: 'premium', 'meal_plan' ou 'consultation'
    const { userId, email, name, planType = 'premium' } = body;

    // 1. LÓGICA DE URL PARA LOCALHOST:
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    if (!siteUrl || siteUrl.includes('localhost')) {
      siteUrl = 'https://vanusazacariasnutri.com.br'; 
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID é obrigatório' }, { status: 400 });
    }

    // 2. BUSCAR PREÇOS DINÂMICOS NO SUPABASE
    // Valores de segurança caso o banco falhe
    let finalPrice = 297.00; 
    let productTitle = 'Plano Premium - Vanusa Zacarias';
    let productDescription = 'Acesso completo ao plano alimentar, métricas e histórico clínico.';
    let productId = 'premium_plan';

    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );
      
      // Assumindo que você criará as colunas meal_plan_price e consultation_price na tabela system_settings
      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('premium_price, meal_plan_price, consultation_price')
        .eq('id', 1)
        .single();

      // Define o valor e os detalhes com base no tipo de plano escolhido
      if (planType === 'premium') {
        if (settings?.premium_price) finalPrice = parseFloat(settings.premium_price);
        productId = 'premium_plan';
        productTitle = 'Plano Premium - Vanusa Zacarias';
        productDescription = 'Acesso completo ao plano alimentar, métricas e check-ins.';
      } 
      else if (planType === 'meal_plan') {
        if (settings?.meal_plan_price) finalPrice = parseFloat(settings.meal_plan_price);
        // Se a coluna ainda não existir no DB, usamos um valor padrão de fallback
        else finalPrice = 147.00; 
        productId = 'meal_plan_only';
        productTitle = 'Meu Plano Alimentar - Vanusa Zacarias';
        productDescription = 'Acesso exclusivo ao plano alimentar (cardápio) em PDF.';
      }
      else if (planType === 'consultation') {
        if (settings?.consultation_price) finalPrice = parseFloat(settings.consultation_price);
        else finalPrice = 197.00;
        productId = 'consultation';
        productTitle = 'Agendamento de Consulta - Vanusa Zacarias';
        productDescription = 'Pagamento referente à consulta com a Nutricionista.';
      }

      console.log(`Checkout gerado para: ${planType} | Preço: ${finalPrice}`);
    } catch (e) {
      console.error("Erro ao buscar preços dinâmicos, usando valores padrão.", e);
    }

    // 3. VALIDAR TOKEN MERCADO PAGO
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) {
      return NextResponse.json({ error: 'Configuração de pagamento ausente no servidor.' }, { status: 500 });
    }

    // 4. INICIALIZAR MERCADO PAGO
    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const preference = new Preference(client);

    // 5. CRIAR PREFERÊNCIA DE PAGAMENTO
    const response = await preference.create({
      body: {
        items: [
          {
            id: productId,
            title: productTitle,
            description: productDescription,
            unit_price: finalPrice,
            quantity: 1,
            currency_id: 'BRL',
          }
        ],
        payer: {
          email: email.includes('vankadosh') ? 'paciente_teste_mp@email.com' : email,
          name: name || 'Paciente',
        },
        external_reference: userId, // ID vital para o Webhook saber quem pagou
        // Passamos o planType na metadata para o webhook saber O QUE liberar no banco de dados
        metadata: {
          plan_type: planType
        },
        back_urls: {
          success: `${siteUrl}/dashboard?payment=success`,
          failure: `${siteUrl}/dashboard?payment=failure`,
          pending: `${siteUrl}/dashboard?payment=pending`,
        },
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          installments: 12 
        },
        notification_url: `${siteUrl}/api/webhook`,
      }
    });

    // 6. RETORNAR O LINK DE PAGAMENTO
    return NextResponse.json({ 
      init_point: response.init_point,
      id: response.id
    });

  } catch (error: any) {
    console.error("ERRO NO CHECKOUT (DETALHADO):", JSON.stringify(error.cause || error, null, 2));
    return NextResponse.json({ 
      error: 'Falha ao processar pagamento.', 
      details: error?.message 
    }, { status: 500 });
  }
}