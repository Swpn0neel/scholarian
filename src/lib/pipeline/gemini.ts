import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiKeys(): string[] {
  // Support both plural (comma-separated) and singular key env vars
  const keysStr = process.env.GOOGLE_AI_API_KEYS || process.env.GOOGLE_AI_API_KEY;
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

/**
 * Executes a streaming Gemini model action with automatic fallback across multiple API keys.
 * If the stream fails to initialize or parse chunk-by-chunk (e.g. rate limit, ECONNRESET),
 * it falls back to the next key.
 */
export async function* executeGeminiStreamWithFallback(
  prompt: string,
  modelName: string = "gemini-2.5-flash"
): AsyncGenerator<string> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error("No Gemini API keys configured. Set GOOGLE_AI_API_KEYS in .env.");
  }

  let lastError: unknown;
  let hasYieldedFromAnyKey = false;
  
  for (let i = 0; i < keys.length; i++) {
    try {
      const genAI = new GoogleGenerativeAI(keys[i]);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContentStream(prompt);
      
      let isFirstChunkOfThisKey = true;
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          if (isFirstChunkOfThisKey && hasYieldedFromAnyKey) {
            yield "__STREAM_RESET__";
          }
          yield text;
          hasYieldedFromAnyKey = true;
          isFirstChunkOfThisKey = false;
        }
      }
      // Stream completed successfully, terminate generator
      return;
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      console.warn(`[Gemini Stream Fallback] API key ${i + 1}/${keys.length} failed: ${err?.message || error}`);
      lastError = error;
      
      // Bad Request (400) usually indicates a prompt or syntax issue, do not retry
      if (err?.status === 400) {
        throw error;
      }
    }
  }

  throw lastError;
}

if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (msg.includes("Failed to parse stream")) {
      console.warn("[Gemini SDK Ignored Rejection]: Failed to parse stream (already handled by fallback)");
    }
  });
}
