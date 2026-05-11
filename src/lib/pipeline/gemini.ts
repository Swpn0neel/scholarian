import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiKeys(): string[] {
  // Support both singular and comma-separated keys
  const keysStr = process.env.GOOGLE_AI_API_KEYS || process.env.GOOGLE_AI_API_KEYS;
  if (!keysStr) return [];
  return keysStr.split(",").map((k) => k.trim()).filter(Boolean);
}

/**
 * Executes a Gemini model action with automatic fallback across multiple API keys.
 * If a key fails (e.g. rate limit, quota exceeded), it catches the error and tries the next key.
 */
export async function executeWithGeminiFallback<T>(
  action: (model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>, genAI: GoogleGenerativeAI) => Promise<T>,
  modelName: string = "gemini-2.5-flash"
): Promise<T> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error("No Gemini API keys configured. Set GOOGLE_AI_API_KEYS in .env.");
  }

  let lastError: unknown;
  
  for (let i = 0; i < keys.length; i++) {
    try {
      const genAI = new GoogleGenerativeAI(keys[i]);
      const model = genAI.getGenerativeModel({ model: modelName });
      return await action(model, genAI);
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      console.warn(`[Gemini Fallback] API key ${i + 1}/${keys.length} failed: ${err?.message || error}`);
      lastError = error;
      
      // Do not retry if the error is a 400 Bad Request, as this implies a flawed prompt
      // rather than an authentication or quota issue.
      if (err?.status === 400) {
        throw error;
      }
    }
  }

  throw lastError;
}
