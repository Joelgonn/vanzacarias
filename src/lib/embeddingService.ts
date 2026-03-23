// /lib/embeddingService.ts

import { GoogleGenerativeAI } from '@google/generative-ai'

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Sem API key");

  const genAI = new GoogleGenerativeAI(apiKey);

  // 🔥 SOLUÇÃO APLICADA: Atualizando para o modelo de embedding mais recente e suportado.
  const model = genAI.getGenerativeModel({
    model: "text-embedding-004" 
  });

  const result = await model.embedContent(text);

  return result.embedding.values;
}