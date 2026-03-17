import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Configura as chaves VAPID (as mesmas que você pôs no Vercel)
webpush.setVapidDetails(
  'mailto:suporte@vanusazacarias.com.br',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function GET(req: Request) {
  try {
    // 1. Pega a "Chave Mestra" para ler todos os inscritos
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Busca todos os pacientes que aceitaram notificações
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription');

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return NextResponse.json({ message: 'Nenhum paciente inscrito ainda.' });
    }

    // 3. Define a mensagem (Pode ser dinâmica depois)
    const payload = JSON.stringify({
      title: 'Hora da Água! 💧',
      body: 'Sua meta diária está te esperando. Que tal um copo agora?',
    });

    // 4. Envia para todo mundo em paralelo
    const notifications = subs.map((s: any) => 
      webpush.sendNotification(s.subscription, payload).catch(err => {
        console.error('Erro ao enviar para um usuário:', err);
        // Opcional: deletar do banco se o token expirou (status 410)
      })
    );

    await Promise.all(notifications);

    return NextResponse.json({ success: true, sentCount: subs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}