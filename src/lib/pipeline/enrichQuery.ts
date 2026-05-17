import { executeWithGeminiFallback, getGeminiKeys } from "./gemini";

export async function enrichQuery(topic: string) {
  if (getGeminiKeys().length === 0) return topic.trim();

  // Race the Gemini call against a 5-second timeout. If Gemini is slow or
  // rate-limited we fall back to the raw topic so the pipeline isn't blocked.
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("enrichQuery timeout")), 5000)
  );

  try {
    const text = await Promise.race([
      executeWithGeminiFallback(async (model) => {
        const result = await model.generateContent([
          "You are an academic research assistant. Expand the user's topic into a precise academic search query. Return ONLY the enriched query string.",
          topic,
        ]);
        return result.response.text().trim();
      }, "gemini-2.5-flash"),
      timeoutPromise,
    ]);
    return text || topic.trim();
  } catch (error) {
    console.warn("Enrich query failed or timed out, using raw topic:", error);
    return topic.trim();
  }
}
