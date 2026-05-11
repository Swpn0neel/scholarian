import { executeWithGeminiFallback, getGeminiKeys } from "./gemini";

export async function enrichQuery(topic: string) {
  if (getGeminiKeys().length === 0) return topic.trim();

  try {
    const text = await executeWithGeminiFallback(async (model) => {
      const result = await model.generateContent([
        "You are an academic research assistant. Expand the user's topic into a precise academic search query. Return ONLY the enriched query string.",
        topic,
      ]);
      return result.response.text().trim();
    }, "gemini-2.5-flash");
    
    return text || topic.trim();
  } catch (error) {
    console.error("Enrich query failed, using raw topic:", error);
    return topic.trim();
  }
}
