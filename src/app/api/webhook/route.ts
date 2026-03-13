import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente Admin do Supabase 
// Usamos a chave SERVICE_ROLE para ter permissão de atualizar o banco sem precisar estar logado
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // O Mercado Pago envia os dados via URL (query params) ou Body
    const url = new URL(request.url);
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('data.id') || url.searchParams.get('id');

    // 1. Se não for uma notificação de pagamento, ignoramos e respondemos 200 OK (para o MP não travar)
    if (topic !== 'payment' || !id) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    // 2. Inicializa o SDK do Mercado Pago
    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MP_ACCESS_TOKEN! 
    });
    const payment = new Payment(client);

    // 3. Busca os detalhes reais do pagamento direto na base do Mercado Pago
    // (Isso evita que hackers tentem enviar webhooks falsos para liberar o sistema)
    const paymentData = await payment.get({ id: id });

    // 4. Verifica se o pagamento foi APROVADO
    if (paymentData.status === 'approved') {
      
      // O external_reference é o ID do usuário (paciente) que configuramos lá na rota de checkout
      const userId = paymentData.external_reference;

      if (userId) {
        // 5. Atualiza o perfil do paciente para PREMIUM no Supabase
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ 
            account_type: 'premium',
            payment_status: 'approved',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (error) {
          console.error(`Erro ao atualizar usuário ${userId} no Supabase:`, error);
          throw new Error('Falha ao atualizar banco de dados.');
        }
        
        console.log(`[SUCESSO] Pagamento aprovado! Paciente ${userId} agora é PREMIUM.`);
      }
    }

    // 6. Retorna 200 OK obrigatório para o Mercado Pago saber que recebemos a mensagem
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error('[ERRO FATAL] Falha no Webhook do Mercado Pago:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}