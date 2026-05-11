import { executeWithGeminiFallback, getGeminiKeys } from "./gemini";

const EMBEDDING_DIMENSIONS = 768;

export async function embedText(text: string): Promise<number[]> {
  if (getGeminiKeys().length === 0) return deterministicEmbedding(text);

  try {
    return await executeWithGeminiFallback(async (model) => {
      const result = await model.embedContent(text);
      return result.embedding.values;
    }, "gemini-embedding-001");
  } catch (error) {
    console.warn("Embedding failed, falling back to deterministic embedding:", error);
    return deterministicEmbedding(text);
  }
}

export async function embedTexts(texts: string[], batchSize = 20): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);
    embeddings.push(...(await Promise.all(batch.map((text) => embedText(text)))));
    if (index + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return embeddings;
}

function deterministicEmbedding(text: string) {
  const values = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  for (let index = 0; index < text.length; index += 1) {
    values[index % EMBEDDING_DIMENSIONS] += text.charCodeAt(index) / 255;
  }
  return values;
}
