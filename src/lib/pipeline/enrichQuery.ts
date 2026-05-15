import { executeWithGeminiFallback, getGeminiKeys } from "./gemini";

export async function enrichQuery(topic: string) {
  if (getGeminiKeys().length === 0) return topic.trim();

  try {
    // 5-second timeout: if Gemini is slow/rate-limited, fall back to raw topic
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const text = await executeWithGeminiFallback(async (model) => {
        const result = await model.generateContent([
          "You are an academic research assistant. Expand the user's topic into a precise academic search query. Return ONLY the enriched query string.",
          topic,
        ]);
        return result.response.text().trim();
      }, "gemini-2.5-flash");
      clearTimeout(timeout);
      return text || topic.trim();
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn("Enrich query failed or timed out, using raw topic:", error);
    return topic.trim();
  }
}
