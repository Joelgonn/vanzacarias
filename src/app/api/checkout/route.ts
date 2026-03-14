import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, name } = body;

    // 1. LÓGICA DE URL PARA LOCALHOST:
    // O Mercado Pago é exigente com URLs. Se estivermos locais, usamos um domínio fake com HTTPS
    // apenas para o validador aceitar a criação do link.
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    if (!siteUrl || siteUrl.includes('localhost')) {
      siteUrl = 'https://vanusazacariasnutri.com.br'; 
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID é obrigatório' }, { status: 400 });
    }

    // 2. BUSCAR PREÇO DINÂMICO NO SUPABASE (Configurado pela Vanusa no Painel)
    let finalPrice = 297.00; // Valor de segurança caso o banco falhe
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );
      
      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('premium_price')
        .eq('id', 1)
        .single();

      if (settings?.premium_price) {
        finalPrice = parseFloat(settings.premium_price);
        console.log("Preço dinâmico recuperado do banco:", finalPrice);
      }
    } catch (e) {
      console.error("Erro ao buscar preço, usando padrão 297.00");
    }

    // 3. VALIDAR TOKEN MERCADO PAGO
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) {
      return NextResponse.json({ error: 'Configuração de pagamento ausente no servidor.' }, { status: 500 });
    }

    // 4. INICIALIZAR MERCADO PAGO
    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const preference = new Preference(client);

    // 5. CRIAR PREFERÊNCIA DE PAGAMENTO (O que o cliente vê na tela do MP)
    const response = await preference.create({
      body: {
        items: [
          {
            id: 'premium_plan',
            title: 'Plano Premium - Vanusa Zacarias',
            description: 'Acesso completo ao plano alimentar, métricas e histórico clínico.',
            unit_price: finalPrice, // <--- VALOR QUE VEM DO PAINEL ADMIN!
            quantity: 1,
            currency_id: 'BRL',
          }
        ],
        payer: {
          // Se o email for o da Vanusa (vendedor), trocamos para um teste para evitar erro de auto-pagamento
          email: email.includes('vankadosh') ? 'paciente_teste_mp@email.com' : email,
          name: name || 'Paciente',
        },
        external_reference: userId, // ID vital para o Webhook saber quem pagou
        back_urls: {
          success: `${siteUrl}/dashboard?payment=success`,
          failure: `${siteUrl}/dashboard?payment=failure`,
          pending: `${siteUrl}/dashboard?payment=pending`,
        },
        // Métodos de pagamento: Bloqueamos Boleto (ticket) para evitar demora na liberação
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          installments: 12 // Permite parcelar em até 12x
        },
        // URL que o Mercado Pago avisará quando o PIX/Cartão for aprovado
        notification_url: `${siteUrl}/api/webhook`,
      }
    });

    // 6. RETORNAR O LINK DE PAGAMENTO (init_point)
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