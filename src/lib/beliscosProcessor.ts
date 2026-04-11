// ============================================================================
// BELISCOS PROCESSOR - PROCESSAMENTO DE DADOS DE BELISCOS
// NÃO SUBSTITUI o beliscoUtils.ts, apenas adiciona processamento para API
// ============================================================================

import { z } from 'zod';

// ============================================================================
// SCHEMAS DE VALIDAÇÃO
// ============================================================================
export const BeliscoItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  grams: z.number().optional(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  timestamp: z.string().optional()
});

export const BeliscosDataSchema = z.object({
  items: z.array(BeliscoItemSchema).optional().default([])
});

export type BeliscoItem = z.infer<typeof BeliscoItemSchema>;
export type BeliscosData = z.infer<typeof BeliscosDataSchema>;

export interface BeliscosProcessed {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: BeliscoItem[];
  hasBeliscos: boolean;
}

// ============================================================================
// TIPAGEM PARA O HISTÓRICO DO SUPABASE
// ============================================================================
type DailyLogBeliscos = {
  date: string;
  beliscos: BeliscosData | null;
};

// ============================================================================
// 🔥 FUNÇÃO PRINCIPAL: PROCESSAR BELISCOS
// ============================================================================
export function processBeliscos(beliscosData: any): BeliscosProcessed {
  const parsed = BeliscosDataSchema.safeParse(beliscosData);
  
  if (!parsed.success || !parsed.data.items || parsed.data.items.length === 0) {
    return {
      totalKcal: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      items: [],
      hasBeliscos: false
    };
  }

  const items = parsed.data.items;
  
  const totals = items.reduce((acc, item) => ({
    totalKcal: acc.totalKcal + (item.kcal || 0),
    totalProtein: acc.totalProtein + (item.protein || 0),
    totalCarbs: acc.totalCarbs + (item.carbs || 0),
    totalFat: acc.totalFat + (item.fat || 0)
  }), {
    totalKcal: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0
  });

  return {
    totalKcal: totals.totalKcal,
    totalProtein: totals.totalProtein,
    totalCarbs: totals.totalCarbs,
    totalFat: totals.totalFat,
    items,
    hasBeliscos: true
  };
}

// ============================================================================
// 🔥 FUNÇÃO PARA BUSCAR HISTÓRICO DE BELISCOS
// ============================================================================
export async function fetchHistoricoBeliscos(
  supabase: any,
  userId: string,
  currentDate: string,
  limit: number = 4
): Promise<{ data: string; totalKcal: number; itemsCount: number }[]> {
  const { data: historicoRaw } = await supabase
    .from('daily_logs')
    .select('date, beliscos')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);
  
  if (!historicoRaw || !Array.isArray(historicoRaw)) {
    return [];
  }

  return historicoRaw.map((log: DailyLogBeliscos) => {
    const parsed = processBeliscos(log.beliscos);
    return {
      data: log.date,
      totalKcal: parsed.totalKcal,
      itemsCount: parsed.items.length
    };
  }).filter(d => d.data !== currentDate);
}

// ============================================================================
// 🔥 FUNÇÃO PARA FORMATAR BELISCOS PARA EXIBIÇÃO
// ============================================================================
export function formatBeliscosForDisplay(beliscos: BeliscosProcessed): string {
  if (!beliscos.hasBeliscos || beliscos.totalKcal === 0) {
    return 'Nenhum belisco registrado';
  }

  let text = `Total: ${Math.round(beliscos.totalKcal)} kcal | `;
  text += `P:${Math.round(beliscos.totalProtein)}g | `;
  text += `C:${Math.round(beliscos.totalCarbs)}g | `;
  text += `G:${Math.round(beliscos.totalFat)}g`;
  
  if (beliscos.items.length > 0) {
    text += ` (${beliscos.items.length} itens)`;
  }
  
  return text;
}