import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Campos atualizados na tabela 'profiles' quando o pagamento é aprovado
interface ProfileUpdate {
  payment_status: string;
  updated_at: string;
  account_type?: string;
  has_meal_plan_access?: boolean;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('data.id') || url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: id });

    if (paymentData.status === 'approved') {
      const userId = paymentData.external_reference;
      // Recuperamos o tipo de plano que passamos na metadata do checkout
      const planType = paymentData.metadata?.plan_type; 

      if (userId) {
        const updateData: ProfileUpdate = { 
          payment_status: 'approved',
          updated_at: new Date().toISOString() 
        };

        // LÓGICA CONDICIONAL DE LIBERAÇÃO
        if (planType === 'premium') {
          updateData.account_type = 'premium';
          updateData.has_meal_plan_access = true;
        } 
        else if (planType === 'meal_plan') {
          updateData.has_meal_plan_access = true;
        }
        else if (planType === 'consultation') {
          // Aqui você pode criar uma entrada na tabela de agendamentos/pagamentos
          // se quiser registrar que o paciente tem uma consulta paga pendente
          await supabaseAdmin
            .from('consultation_credits') 
            .insert([{ user_id: userId, status: 'paid', created_at: new Date().toISOString() }]);
        }

        const { error } = await supabaseAdmin
          .from('profiles')
          .update(updateData)
          .eq('id', userId);

        if (error) throw error;
        
        console.log(`[SUCESSO] Pagamento aprovado (${planType}) para ${userId}`);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[ERRO FATAL] Webhook:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}