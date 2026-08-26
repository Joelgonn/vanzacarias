import React from 'react';

interface Rule {
  match: RegExp;
  category: string;
}

export const TOOLTIP_RULES: Rule[] = [
  { match: /\b(batata doce|arroz branco|arroz integral|arroz|batata inglesa|macarr[ãa]o|aveia|p[ãa]o franc[êe]s|p[ãa]o|cuscuz|tapioca|mandioca|macaxeira|granola)\b/gi, category: "Carboidratos" },
  { match: /\b(peito de frango|frango|carne bovina|carne|til[áa]pia|peixe|lombo|ovos?|atum|whey|leite|iogurte|queijo)\b/gi, category: "Proteínas e Laticínios" },
  { match: /\b(feij[ãa]o|lentilha|gr[ãa]o de bico|ervilha)\b/gi, category: "Leguminosas" },
  { match: /\b(azeite|castanhas?|pasta de amendoim|amendoim|abacate|chia|linha[çc]a|manteiga|requeij[ãa]o|chocolate|cacau)\b/gi, category: "Gorduras/Extras" },
  { match: /\b(ma[çc][ãa]|banana|mam[ãa]o|morangos?|abacaxi|laranja|melancia|uvas?|frutas?)\b/gi, category: "Frutas" },
  { match: /\b(alface|tomate|br[óo]colis|cenoura|ab[óo]bora|abobrinha|chuchu|beterraba|legumes|verduras|salada)\b/gi, category: "Vegetais e Saladas" }
];

export const COMBINED_RULE = (() => {
  const patterns = TOOLTIP_RULES.map(rule => `(${rule.match.source})`).join('|');
  return new RegExp(patterns, 'gi');
})();

export const renderDescriptionWithTooltips = (text: string, onWordClick: (categoria: string) => void) => {
  if (!text) return text;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let globalKeyCounter = 0;

  COMBINED_RULE.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = COMBINED_RULE.exec(text)) !== null) {
    const matchedText = match[0];
    const matchStart = match.index;
    const matchEnd = matchStart + matchedText.length;

    if (matchStart > lastIndex) {
      elements.push(text.substring(lastIndex, matchStart));
    }

    let category = '';
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        const ruleIndex = i - 1;
        if (ruleIndex < TOOLTIP_RULES.length) {
          category = TOOLTIP_RULES[ruleIndex].category;
        }
        break;
      }
    }

    elements.push(
      <button
        key={`tooltip-${globalKeyCounter++}`}
        onClick={() => onWordClick(category)}
        className="border-b-2 border-dashed border-orange-400 text-orange-700 font-bold cursor-pointer transition-colors hover:bg-orange-100 rounded-sm px-[2px] active:scale-95"
        title={`Ver substituições inteligentes para ${category}`}
      >
        {matchedText}
      </button>
    );

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
};
