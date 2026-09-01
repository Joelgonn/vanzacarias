// Observabilidade do chatbot VZ-018 — sem conteúdo clínico
// Mede durações técnicas, nunca prompt/resposta/plano/memória/RAG/image

export type ChatObsTimings = {
  request_start: number;
  auth_duration?: number;
  data_fetch_duration?: number;
  memory_duration?: number;
  rag_duration?: number;
  gemini_first_chunk?: number;
  gemini_done?: number;
  guardrail_duration?: number;
  persistence_duration?: number;
  total_duration?: number;
};

export function startObs(): ChatObsTimings {
  return { request_start: Date.now() };
}

export function mark(t: ChatObsTimings, key: keyof ChatObsTimings): void {
  (t as Record<string, number>)[key] = Date.now() - t.request_start;
}

export function logObs(
  userId: string,
  timings: ChatObsTimings,
  extra: Record<string, unknown> = {}
): void {
  const safeExtra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (k.includes('prompt') || k.includes('message') || k.includes('answer') || k.includes('plan') || k.includes('image') || k.includes('memory') || k.includes('rag')) continue;
    safeExtra[k] = v;
  }
  const payload = {
    userId,
    ...timings,
    ...safeExtra,
    ttfb: timings.gemini_first_chunk,
    total: timings.total_duration,
  };
  // Log estruturado sem PII clínica — permite responder "por que demorou?" sem "o que conversou?"
  console.log('[CHAT_OBS]', JSON.stringify(payload));
}
