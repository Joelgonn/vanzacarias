// /lib/embeddingService.ts

import { GoogleGenerativeAI } from '@google/generative-ai'

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Sem API key");

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "embedding-001"
  });

  const result = await model.embedContent(text);

  return result.embedding.values;
}