import { describe, it, expect } from "vitest";
import {
  prepareSpeakableText,
  countSpeakableWords,
  isSpeakableEligible,
  buildSpeakable,
  MIN_WORDS,
} from "../speakable";

describe("TTS-INTEGRATION-003 — texto falável", () => {
  describe("emojis (D15)", () => {
    it("remove emojis e mantém o texto", () => {
      expect(prepareSpeakableText("✅ Dieta adequada 🥗")).toBe("Dieta adequada");
    });
    it("remove emojis em qualquer posição", () => {
      expect(prepareSpeakableText("Beba água 💧 e se exercite 🏃‍♀️")).toBe("Beba água e se exercite");
    });
    it("texto só de emoji vira vazio", () => {
      expect(prepareSpeakableText("🎉🎊")).toBe("");
    });
  });

  describe("URLs (D15)", () => {
    it("remove https URL", () => {
      expect(prepareSpeakableText("Veja https://exemplo.com/dieta para mais")).toBe("Veja para mais");
    });
    it("remove www URL", () => {
      expect(prepareSpeakableText("Acesse www.site.com.br agora")).toBe("Acesse agora");
    });
    it("remove URL com parâmetros", () => {
      expect(prepareSpeakableText("Link: https://exemplo.com/plano?a=1&b=2")).toBe("Link:");
    });
  });

  describe("blocos de código (D15)", () => {
    it("remove bloco cercado por crases", () => {
      const md = "Siga os passos:\n```js\nconst x = 1;\nconsole.log(x);\n```\nDepois me avise.";
      expect(prepareSpeakableText(md)).toBe("Siga os passos: Depois me avise.");
    });
    it("remove bloco cercado por ~", () => {
      const md = "Exemplo:\n~~~bash\nnpm install\n~~~\nFim.";
      expect(prepareSpeakableText(md)).toBe("Exemplo: Fim.");
    });
    it("código inline vira texto", () => {
      expect(prepareSpeakableText("Use `npm install` para instalar")).toBe("Use npm install para instalar");
    });
  });

  describe("listas (D15)", () => {
    it("converte bullets em frases sem marcadores", () => {
      const md = "- Beba água.\n- Prefira alimentos naturais.\n- Evite pular refeições.";
      expect(prepareSpeakableText(md)).toBe("Beba água. Prefira alimentos naturais. Evite pular refeições.");
    });
    it("não adiciona 'primeiro/segundo'", () => {
      const md = "* Coma devagar\n* Mastigue bem";
      expect(prepareSpeakableText(md)).toBe("Coma devagar. Mastigue bem.");
    });
    it("lista ordenada sem numerais extras", () => {
      const md = "1. Beba água\n2. Durma 8 horas";
      expect(prepareSpeakableText(md)).toBe("Beba água. Durma 8 horas.");
    });
  });

  describe("cabeçalhos (D15)", () => {
    it("preserva cabeçalho como contexto semântico", () => {
      const md = "## Café da manhã\n\n- Ovos\n- Fruta";
      expect(prepareSpeakableText(md)).toBe("Café da manhã. Ovos. Fruta.");
    });
    it("não pronuncia o símbolo #", () => {
      expect(prepareSpeakableText("# Refeições do dia")).toBe("Refeições do dia.");
    });
  });

  describe("tabelas (D15)", () => {
    it("converte linhas de tabela em fala", () => {
      const md = "Arroz | 100 g | 130 kcal\nFrango | 100 g | 165 kcal";
      expect(prepareSpeakableText(md)).toBe("Arroz, 100 g, 130 kcal. Frango, 100 g, 165 kcal.");
    });
    it("descarta separador de tabela", () => {
      const md = "Alimento | Porção | Energia\n---|--- | ---\nArroz | 100 g | 130 kcal";
      expect(prepareSpeakableText(md)).toBe("Alimento, Porção, Energia. Arroz, 100 g, 130 kcal.");
    });
  });

  describe("markdown inline (D15)", () => {
    it("remove negrito/itálico/tachado mantendo o texto", () => {
      expect(prepareSpeakableText("Isso é **importante** e _essencial_")).toBe("Isso é importante e essencial");
    });
    it("mantém pontuação original do parágrafo", () => {
      expect(prepareSpeakableText("Beba água. Durma bem.")).toBe("Beba água. Durma bem.");
    });
  });

  describe("números e unidades (D16)", () => {
    it("NÃO expande unidades — normalização é do engine", () => {
      // A integração não duplica `voice-synthesis`: kcal/g/ml continuam intactos.
      const out = prepareSpeakableText("Consuma 500 kcal e 250 ml de água.");
      expect(out).toContain("500 kcal");
      expect(out).toContain("250 ml");
    });
    it("preserva horários sem expandir", () => {
      expect(prepareSpeakableText("Almoço às 12:30.")).toContain("12:30");
    });
  });

  describe("gate (D17/D18)", () => {
    it("vazio depois da preparação → não elegível", () => {
      const r = buildSpeakable("🎉🏆");
      expect(r.prepared).toBe("");
      expect(r.eligible).toBe(false);
    });
    it("3 palavras → não elegível", () => {
      const r = buildSpeakable("Beba mais água");
      expect(r.wordCount).toBe(3);
      expect(r.eligible).toBe(false);
    });
    it("4 palavras → elegível", () => {
      const r = buildSpeakable("Beba mais água agora");
      expect(r.wordCount).toBe(4);
      expect(r.eligible).toBe(true);
    });
    it("gate usa palavras, não caracteres", () => {
      expect(isSpeakableEligible("1 2 3 4 5")).toBe(true);
      expect(isSpeakableEligible("olá")).toBe(false);
    });
    it("MIN_WORDS = 4", () => {
      expect(MIN_WORDS).toBe(4);
    });
    it("countSpeakableWords: vazio/nulo → 0", () => {
      expect(countSpeakableWords("")).toBe(0);
      expect(countSpeakableWords("   ")).toBe(0);
      expect(countSpeakableWords(null as unknown as string)).toBe(0);
    });
  });

  describe("casos finais", () => {
    it("null/undefined → vazio", () => {
      expect(prepareSpeakableText(null as unknown as string)).toBe("");
      expect(prepareSpeakableText(undefined as unknown as string)).toBe("");
    });
    it("mingling de tudo", () => {
      const md =
        "## Dicas de hoje ✅\n\n- Coma 5 porções de frutas 🍎\n- Beba 2 litros de água\nVeja https://exemplo.com/guia";
      const out = prepareSpeakableText(md);
      expect(out).not.toContain("✅");
      expect(out).not.toContain("🍎");
      expect(out).not.toContain("http");
      expect(out).toContain("Dicas de hoje");
      expect(out).toContain("Coma 5 porções de frutas");
    });
  });
});