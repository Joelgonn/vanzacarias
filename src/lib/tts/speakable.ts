/**
 * TTS-INTEGRATION-003 — Camada determinística de "texto falável" (aplicação).
 *
 * Pertence à aplicação (não ao engine `voice-synthesis`). Converte a resposta
 * Markdown do Chat em texto natural para síntese, SEM duplicar a normalização
 * do engine (números/unidades/horários continuam com `voice-synthesis`).
 *
 * Regras (D15):
 *  - Emojis removidos.
 *  - URLs removidas (o link permanece visível no Chat).
 *  - Blocos de código removidos (código permanece visível).
 *  - Listas convertidas em fala natural (sem marcadores, sem "primeiro/segundo").
 *  - Cabeçalhos preservados como contexto semântico (sem Markdown).
 *  - Tabelas convertidas em fala ("célula, célula, célula." por linha).
 *  - Números/unidades NÃO são expandidos aqui — `voice-synthesis` normaliza.
 *
 * Gate (D18): mínimo de 4 palavras.
 */

export const MIN_WORDS = 4;

// Emojis (blocos Unicode relevantes), variação seletora, ZWJ e dígitos regionais.
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}\u{2B50}\u{2764}-\u{2764}\u{1F1E6}-\u{1F1FF}]/gu;

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Linha de separador de tabela: | --- | :---: | etc.
const TABLE_SEPARATOR_RE = /^\s*\|?[\s:|-]+\|?\s*$/;

const SENTENCE_END_RE = /[.!?…]\s*$/;

function stripFences(t: string): string {
  return t
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`([^`]*)`/g, "$1");
}

function stripEmojis(t: string): string {
  return t.replace(EMOJI_RE, " ");
}

function stripInlineMarkdown(t: string): string {
  return t
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/__([^_]*)__/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/_([^_]*)_/g, "$1")
    .replace(/~~([^~]*)~~/g, "$1");
}

function isTableCell(line: string): boolean {
  return line.includes("|") && line.split("|").filter((c) => c.trim().length > 0).length >= 2;
}

function cellToSpeakable(rawCell: string): string {
  return rawCell.replace(/^\|/, "").replace(/\|$/, "").trim();
}

/**
 * Converte um bloco de texto Markdown em texto falável.
 * Retorna "" quando nada restou para ser falado.
 */
export function prepareSpeakableText(markdown: string): string {
  const raw = String(markdown ?? "");
  if (!raw.trim()) return "";

  let t = stripFences(raw);
  t = t.replace(URL_RE, " ");
  t = t.replace(EMAIL_RE, " ");
  t = stripEmojis(t);
  if (!t.trim()) return "";

  // Processa linha a linha para capturar a SEMÂNTICA (listas, cabeçalhos, tabelas).
  const units: Array<{ text: string; sentence: boolean }> = [];

  for (const rawLine of t.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // Separadores de tabela são descartados.
    if (TABLE_SEPARATOR_RE.test(line)) continue;

    // Tabela: | A | B | C | → "A, B, C" (unidade de frase).
    if (isTableCell(line)) {
      const cells = line
        .split("|")
        .map(cellToSpeakable)
        .filter((c) => c.length > 0);
      if (cells.length) units.push({ text: cells.join(", "), sentence: true });
      continue;
    }

    // Cabeçalho: texto vira contexto semântico.
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      const text = heading[1]!.trim();
      if (text) units.push({ text, sentence: true });
      continue;
    }

    // Lista não ordenada.
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      const text = bullet[1]!.trim();
      if (text) units.push({ text, sentence: true });
      continue;
    }

    // Lista ordenada.
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (ordered) {
      const text = ordered[1]!.trim();
      if (text) units.push({ text, sentence: true });
      continue;
    }

    // Citação.
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      const text = quote[1]!.trim();
      if (text) units.push({ text: text, sentence: false });
      continue;
    }

    // Parágrafo comum: flui como texto contínuo.
    units.push({ text: line, sentence: false });
  }

  if (!units.length) return "";

  const parts: string[] = [];
  for (const unit of units) {
    let text = stripInlineMarkdown(unit.text).trim();
    if (!text) continue;
    if (unit.sentence && !SENTENCE_END_RE.test(text)) text += ".";
    parts.push(text);
  }

  if (!parts.length) return "";

  const out = parts
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s([,.!?…;:])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim();

  return out;
}

/** Conta palavras em texto preparado (fonte do gate). */
export function countSpeakableWords(text: string): number {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Gate D18: 0–3 palavras não sintetiza; 4+ palavras elegível. */
export function isSpeakableEligible(text: string): boolean {
  return countSpeakableWords(text) >= MIN_WORDS;
}

export type SpeakableResult = {
  /** Texto falável preparado ("" se nada falável). */
  readonly prepared: string;
  /** Palavras no texto preparado. */
  readonly wordCount: number;
  /** Elegível ao gate: preparado não-vazio e >= 4 palavras. */
  readonly eligible: boolean;
};

/** Prepara e aplica o gate (D14/D17/D18) em uma única chamada. */
export function buildSpeakable(markdown: string): SpeakableResult {
  const prepared = prepareSpeakableText(markdown);
  const wordCount = countSpeakableWords(prepared);
  return {
    prepared,
    wordCount,
    eligible: prepared.length > 0 && wordCount >= MIN_WORDS,
  };
}