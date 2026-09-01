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
      const planType = paymentData.metadata?.plan_type;
      const paymentId = String(paymentData.id);

      if (userId) {
        // Idempotência: se já existe upgrade_success para este payment_id, não reprocessa
        const { data: existing } = await supabaseAdmin
          .from('commerce_events')
          .select('id')
          .eq('user_id', userId)
          .eq('event', 'upgrade_success')
          .contains('metadata', { payment_id: paymentId })
          .limit(1);
        if (existing && existing.length > 0) {
          console.log(`[WEBHOOK] Pagamento ${paymentId} já processado para ${userId} — idempotente`);
          return NextResponse.json({ success: true, deduplicated: true }, { status: 200 });
        }

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
          await supabaseAdmin
            .from('consultation_credits') 
            .insert([{ user_id: userId, status: 'paid', created_at: new Date().toISOString() }]);
        }

        const { error } = await supabaseAdmin
          .from('profiles')
          .update(updateData)
          .eq('id', userId);

        if (error) throw error;
        
        // VZ-019: registra upgrade_success sem conteúdo clínico, com payment_id para idempotência
        const isPremium = planType === 'premium' || planType === 'meal_plan';
        try {
          await supabaseAdmin.from('commerce_events').insert({
            user_id: userId,
            event: 'upgrade_success',
            is_premium: !!isPremium,
            metadata: { plan_type: planType, payment_id: paymentId }
          });
          // também checkout_completed para funil
          await supabaseAdmin.from('commerce_events').insert({
            user_id: userId,
            event: 'checkout_completed',
            is_premium: !!isPremium,
            metadata: { plan_type: planType, payment_id: paymentId }
          });
        } catch (e) {
          console.warn('[WEBHOOK] falha ao registrar commerce_events (não quebra webhook)', e);
        }
        
        console.log(`[SUCESSO] Pagamento aprovado (${planType}) para ${userId} payment ${paymentId}`);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[ERRO FATAL] Webhook:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}