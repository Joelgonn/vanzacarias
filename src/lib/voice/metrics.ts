// VOZ-003 — Métricas WER/CER/RTF + Normalização

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[.,!?;:"'()\-—]/g, ' ') // pontuação -> espaço
    .replace(/\s+/g, ' ')
    .trim();
}

// WER = (S + D + I) / N
export function computeWER(reference: string, hypothesis: string, normalize = true): number {
  const refNorm = normalize ? normalizeText(reference) : reference.trim();
  const hypNorm = normalize ? normalizeText(hypothesis) : hypothesis.trim();
  const ref = refNorm ? refNorm.split(/\s+/).filter(Boolean) : [];
  const hyp = hypNorm ? hypNorm.split(/\s+/).filter(Boolean) : [];
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
  const dp: number[][] = Array(ref.length + 1).fill(0).map(() => Array(hyp.length + 1).fill(0));
  for (let i = 0; i <= ref.length; i++) dp[i][0] = i;
  for (let j = 0; j <= hyp.length; j++) dp[0][j] = j;
  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      if (ref[i - 1] === hyp[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[ref.length][hyp.length] / ref.length;
}

// CER = (S + D + I) / N em caracteres (sem espaços)
export function computeCER(reference: string, hypothesis: string, normalize = true): number {
  const refNorm = normalize ? normalizeText(reference).replace(/\s/g, '') : reference.replace(/\s/g, '');
  const hypNorm = normalize ? normalizeText(hypothesis).replace(/\s/g, '') : hypothesis.replace(/\s/g, '');
  const ref = [...refNorm];
  const hyp = [...hypNorm];
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
  const dp: number[][] = Array(ref.length + 1).fill(0).map(() => Array(hyp.length + 1).fill(0));
  for (let i = 0; i <= ref.length; i++) dp[i][0] = i;
  for (let j = 0; j <= hyp.length; j++) dp[0][j] = j;
  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      if (ref[i - 1] === hyp[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[ref.length][hyp.length] / ref.length;
}

export function computeRTF(inferenceMs: number, audioDurationMs: number): number {
  if (audioDurationMs <= 0) return 0;
  return inferenceMs / audioDurationMs;
}
