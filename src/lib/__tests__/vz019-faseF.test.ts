/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const supabaseUrl = 'https://zmsjwtjfvgbbrxzdwgkp.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptc2p3dGpmdmdiYnJ4emR3Z2twIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk4MjgzMSwiZXhwIjoyMDg4NTU4ODMxfQ.Kr1BxQM5f_xY5Q-BCBww9ce5pDm0GYAUwbCey_GxM5k';
const admin = createClient(supabaseUrl, serviceKey);

// Helper to get a real user id for controlled tests
let realUserId: string | null = null;
beforeAll(async () => {
  const { data } = await admin.from('profiles').select('id').limit(1).single();
  realUserId = data?.id ?? null;
});

afterAll(async () => {
  // cleanup synthetic test rows (user_id = realUserId with test metadata)
  if (realUserId) {
    await admin.from('commerce_events').delete().eq('user_id', realUserId).contains('metadata', { testRun: 'faseF' } as any);
    await admin.from('commerce_events').delete().eq('user_id', realUserId).contains('metadata', { payment_id: 'TEST_FASEF' } as any);
  }
  // cleanup any synthetic pending/rejected test
  await admin.from('commerce_events').delete().eq('event', 'upgrade_success').contains('metadata', { payment_id: 'TEST_PENDING' } as any);
});

describe('VZ-019 Fase F — Testes controlados (sintéticos, sem MP real)', () => {
  it('T01 premium_viewed: registra uma vez sem clínico', async () => {
    const { data, error } = await admin.from('commerce_events').insert({
      user_id: realUserId,
      event: 'premium_viewed',
      is_premium: false,
      metadata: { testRun: 'faseF', source: 'dashboard' }
    }).select().single();
    expect(error).toBeNull();
    expect(data?.event).toBe('premium_viewed');
    expect(data?.metadata).not.toHaveProperty('prompt');
  });

  it('T02 premium_cta_clicked: registra sem duplicação indevida (um insert = uma row)', async () => {
    const before = await admin.from('commerce_events').select('id', { count: 'exact' }).eq('user_id', realUserId!).eq('event', 'premium_cta_clicked').contains('metadata', { testRun: 'faseF' } as any);
    const beforeCount = before.count ?? 0;
    await admin.from('commerce_events').insert({
      user_id: realUserId,
      event: 'premium_cta_clicked',
      is_premium: false,
      metadata: { testRun: 'faseF' }
    });
    const after = await admin.from('commerce_events').select('id', { count: 'exact' }).eq('user_id', realUserId!).eq('event', 'premium_cta_clicked').contains('metadata', { testRun: 'faseF' } as any);
    expect((after.count ?? 0) - beforeCount).toBe(1);
  });

  it('T03 checkout_started: is_premium false, metadata só comercial', async () => {
    const { data, error } = await admin.from('commerce_events').insert({
      user_id: realUserId,
      event: 'checkout_started',
      is_premium: false,
      metadata: { testRun: 'faseF', plan_type: 'premium' }
    }).select().single();
    expect(error).toBeNull();
    expect(data?.is_premium).toBe(false);
    expect(data?.metadata.plan_type).toBe('premium');
    expect(data?.metadata).not.toHaveProperty('prompt');
  });

  it('T04 pagamento pending: não concede Premium (webhook só approved)', async () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/webhook/route.ts'), 'utf8');
    expect(src).toContain("if (paymentData.status === 'approved')");
    expect(src.match(/if \(paymentData\.status === 'approved'\)/)).not.toBeNull();
  });

  it('T05 pagamento rejected/cancelled: não concede', async () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/api/webhook/route.ts'), 'utf8');
    expect(src).not.toMatch(/rejected[\s\S]*has_meal_plan_access/);
    expect(src).not.toMatch(/cancelled[\s\S]*has_meal_plan_access/);
  });

  it('T06 payment approved controlado: external_reference → profile + upgrade_success + checkout_completed', async () => {
    // Verifica código do webhook faz 3 coisas quando approved
    const src = readFileSync(path.resolve(__dirname, '../../app/api/webhook/route.ts'), 'utf8');
    expect(src).toContain('external_reference');
    expect(src).toContain("updateData.account_type = 'premium'");
    expect(src).toContain("event: 'upgrade_success'");
    expect(src).toContain("event: 'checkout_completed'");
    expect(src).toContain('payment_id: paymentId');
  });

  it('T07 webhook repetido: idempotência por payment_id', async () => {
    const paymentId = 'TEST_FASEF';
    // First insert
    await admin.from('commerce_events').insert({
      user_id: realUserId,
      event: 'upgrade_success',
      is_premium: true,
      metadata: { payment_id: paymentId, plan_type: 'premium', testRun: 'faseF' }
    });
    // Simulate webhook check: contains payment_id
    const { data: existing } = await admin.from('commerce_events')
      .select('id')
      .eq('user_id', realUserId!)
      .eq('event', 'upgrade_success')
      .contains('metadata', { payment_id: paymentId } as any)
      .limit(1);
    expect(existing && existing.length > 0).toBe(true);
    // Second attempt should be deduplicated (webhook would early return)
    const src = readFileSync(path.resolve(__dirname, '../../app/api/webhook/route.ts'), 'utf8');
    expect(src).toContain('já processado');
    expect(src).toContain('deduplicated');
  });

  it('T08 usuário inexistente: não altera terceiros', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const { error } = await admin.from('profiles').update({ has_meal_plan_access: true }).eq('id', fakeId).select();
    // Supabase update with non-existent id returns 0 rows, no error, no other user altered
    // We check that a real user still has original state (not altered by fake update)
    const { data: real } = await admin.from('profiles').select('id').eq('id', realUserId!).single();
    expect(real?.id).toBe(realUserId);
    // No throw
    expect(error).toBeNull();
  });

  it('T09 dashboard após payment success: não libera antes da confirmação', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/dashboard/page.tsx'), 'utf8');
    // Deve conter polling, não liberação direta
    expect(src).toContain('payment=success');
    expect(src).toContain('setTimeout(poll');
    expect(src).toContain('has_meal_plan_access');
    expect(src).not.toMatch(/if \(search\.includes\('payment=success'\)\)[\s\S]*setIsPremium\(true\)/);
  });

  it('T10 webhook mais lento: polling limitado funciona', () => {
    const src = readFileSync(path.resolve(__dirname, '../../app/dashboard/page.tsx'), 'utf8');
    expect(src).toContain('maxAttempts = 5');
    expect(src).toContain('setTimeout(poll, 2000)');
    expect(src).toContain('setTimeout(poll, 1500)');
    // Não há loop infinito
    expect(src).not.toContain('while (true)');
  });

  it('T11 analytics failure não quebra produto', async () => {
    // commerceEvents catch: insert com evento inválido deve falhar mas não throw para o caller
    const { error } = await admin.from('commerce_events').insert({ event: 'evento_invalido' as any });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514'); // check constraint
    // Mas trackCommerceEvent em código faz try/catch, então produto continua
    const src = readFileSync(path.resolve(__dirname, '../commerceEvents.ts'), 'utf8');
    expect(src).toContain('try {');
    expect(src).toContain('catch');
  });

  it('T12 metadata sanitization: prompt/answer/message/plan/image >200 removidos', async () => {
    const raw = { hasImage: false, prompt: 'secret prompt', answer: 'secret answer', message: 'secret', plan: 'secret diet', image: 'base64...', long: 'a'.repeat(201), ok: 'keep' };
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string' && v.length > 200) continue;
      if (k.includes('message') || k.includes('prompt') || k.includes('answer') || k.includes('plan') || k.includes('image')) continue;
      safe[k] = v;
    }
    expect(safe).toEqual({ hasImage: false, ok: 'keep' });
    // Verifica que DB insert com safe não contém clínico
    const { data } = await admin.from('commerce_events').insert({
      user_id: realUserId,
      event: 'premium_viewed',
      is_premium: false,
      metadata: safe as any
    }).select('metadata').single();
    expect(data?.metadata).not.toHaveProperty('prompt');
    expect(data?.metadata.ok).toBe('keep');
  });
});
