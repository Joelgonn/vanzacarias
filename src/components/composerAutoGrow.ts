// CHAT-UX-008 — Lógica pura do auto-grow do Composer (sem DOM, testável em node).
//
// Contrato (agnóstico de navegador/dispositivo):
//   scrollHeight (conteúdo real, medido pelo browser após o commit do React)
//     → heightPx = min(scrollHeight, maxHeight)
//     → overflowY = 'auto' SOMENTE quando scrollHeight > maxHeight;
//                   caso contrário 'hidden' (o Composer cresce, sem scroll).
//
// O crescimento visual progressivo (1→2→3→4→5 linhas) é consequência direta de
// aplicar heightPx ao <textarea>: cada linha nova aumenta scrollHeight, o que
// aumenta heightPx até o teto; só então o scroll interno entra em ação.
// Nenhum min-height/max-height artificial é usado como "solução".

export const AUTO_GROW_MAX_HEIGHT = 200;

export type AutoGrowResult = {
  /** Altura (px) a aplicar via style.height — acompanha o conteúdo até o teto. */
  heightPx: number;
  /** overflow-y do textarea: 'hidden' enquanto cresce; 'auto' somente no teto. */
  overflowY: 'auto' | 'hidden';
};

export function autoGrowHeight(
  scrollHeight: number,
  maxHeight: number = AUTO_GROW_MAX_HEIGHT
): AutoGrowResult {
  const safe = Number.isFinite(scrollHeight) && scrollHeight > 0 ? scrollHeight : 0;
  const clamped = Math.min(safe, maxHeight);
  return {
    heightPx: Math.round(clamped),
    overflowY: safe > maxHeight ? 'auto' : 'hidden',
  };
}

/** Linhas aproximadas (24px/linha + 20px de padding vertical) — só diagnóstico. */
export function estimateLines(scrollHeight: number): number {
  const safe = Number.isFinite(scrollHeight) && scrollHeight > 0 ? scrollHeight : 0;
  if (safe <= 20) return 1;
  return Math.max(1, Math.round((safe - 20) / 24));
}
