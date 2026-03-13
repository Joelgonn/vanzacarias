import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, name } = body;

    // 1. Validação básica
    if (!userId) {
      return NextResponse.json({ error: 'User ID é obrigatório' }, { status: 400 });
    }

    // 2. Inicializa o cliente do Mercado Pago com a chave secreta
    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MP_ACCESS_TOKEN || '' 
    });

    const preference = new Preference(client);

    // 3. Cria a intenção de pagamento (Preferência)
    const response = await preference.create({
      body: {
        items: [
          {
            id: 'premium_plan',
            title: 'Acompanhamento Nutricional Premium - Vanusa Zacarias',
            description: 'Acesso completo ao plano alimentar, métricas e histórico clínico.',
            quantity: 1,
            unit_price: 297.00, // VALOR DA CONSULTA/PLANO (Altere aqui se necessário)
            currency_id: 'BRL',
          }
        ],
        payer: {
          email: email || 'paciente@email.com',
          name: name || 'Paciente',
        },
        // O external_reference é o segredo da integração! 
        // É através dele que o webhook saberá qual paciente no Supabase pagou.
        external_reference: userId, 
        
        // URLs para onde o paciente volta após pagar
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?payment=success`,
          failure: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?payment=failure`,
          pending: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?payment=pending`,
        },
        auto_return: 'approved',
        
        // Formas de pagamento (Aqui bloqueamos boleto se quiser, deixando só PIX/Cartão)
        payment_methods: {
          excluded_payment_types: [
            { id: 'ticket' } // Remove Boleto para aprovação ser imediata
          ],
          installments: 12 // Permite parcelar em até 12x no cartão
        },
        
        // URL que o Mercado Pago vai chamar silenciosamente quando o pagamento for aprovado
        notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhook`,
      }
    });

    // 4. Retorna a URL de checkout gerada pelo Mercado Pago (init_point)
    return NextResponse.json({ 
      init_point: response.init_point, // Link padrão
      id: response.id
    });

  } catch (error: any) {
    console.error('Erro crítico ao gerar pagamento no Mercado Pago:', error);
    return NextResponse.json(
      { error: 'Falha ao processar o checkout', details: error.message }, 
      { status: 500 }
    );
  }
}