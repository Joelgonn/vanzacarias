import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userId, subscription } = await req.json();

    if (!userId || !subscription) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios: userId ou subscription' }, { status: 400 });
    }

    // Validação das variáveis de ambiente
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('ERRO: Variáveis de ambiente do Supabase não configuradas na API.');
      return NextResponse.json({ error: 'Erro de configuração no servidor' }, { status: 500 });
    }

    // Usamos o service_role key para ignorar RLS e gravar direto
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({ 
        user_id: userId, 
        subscription: subscription 
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Erro Supabase:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro na Rota de Push:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}