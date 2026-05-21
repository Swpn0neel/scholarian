import { NextResponse } from "next/server";
import { z } from "zod";
import { executeWithGeminiFallback } from "@/lib/pipeline/gemini";
import { requireAuth } from "@/lib/supabase/requireAuth";

const schema = z.object({
  chatId: z.string(),
  feedback: z.string().min(1),
  currentTopic: z.string().optional(),
  excludeTitles: z.array(z.string()).optional(),
  currentSettings: z
    .object({
      topic: z.string(),
      maxPapers: z.number(),
      topK: z.number(),
      weightRelevance: z.number(),
      weightCitation: z.number(),
      weightRecency: z.number(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { feedback, currentTopic, excludeTitles, currentSettings } = schema.parse(
    await request.json()
  );

  const excludeContext =
    excludeTitles?.length
      ? `Papers to exclude (already reviewed):\n${excludeTitles.map((t) => `- ${t}`).join("\n")}`
      : "";

  const prompt = `You are an academic research assistant helping refine a literature search.

Current research topic: "${currentTopic ?? "unknown"}"
User refinement request: "${feedback}"
${excludeContext}

Based on the user's feedback, generate:
1. A refined/updated research topic query (one concise sentence)
2. A brief explanation of what changed and why

Respond ONLY with valid JSON in this exact format:
{
  "refinedTopic": "...",
  "explanation": "..."
}`;

  try {
    const text = await executeWithGeminiFallback(async (model) => {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { refinedTopic: string; explanation: string }) : null;

    return NextResponse.json({
      ok: true,
      refinedTopic: parsed?.refinedTopic ?? currentTopic ?? "",
      explanation: parsed?.explanation ?? "",
      suggestedSettings: currentSettings,
    });
  } catch (error) {
    console.error("Gemini refinement failed, using fallback:", error);
    const fallbackTopic = generateFallbackTopic(currentTopic ?? "", feedback);
    return NextResponse.json({
      ok: true,
      refinedTopic: fallbackTopic,
      explanation: `Used fallback query: "${fallbackTopic}" (Gemini API failed to refine).`,
      suggestedSettings: currentSettings,
    });
  }
}

function generateFallbackTopic(currentTopic: string, feedback: string): string {
  // 1. Try to extract quoted text (matches double quotes, single quotes, or curly quotes)
  const quoteRegex = /['"“‘]([^'"“”‘’]+)['"”’]/;
  const match = feedback.match(quoteRegex);
  if (match && match[1] && match[1].trim().length > 3) {
    return match[1].trim();
  }

  // 2. If no quotes, clean the feedback of common instruction prefixes
  let cleanFeedback = feedback.replace(/^(refine|add|search|find|focus|limit|show|give|get)\b/i, "");
  cleanFeedback = cleanFeedback.replace(/^(the|papers|paper|selection|topic|by|about|on|from|with|to|using)\b\s*/gi, "");
  cleanFeedback = cleanFeedback.replace(/\b(papers|selection|topic|by|adding|from)\b/gi, "");
  cleanFeedback = cleanFeedback.trim().replace(/\s+/g, " ");

  if (cleanFeedback.length > 0) {
    // If clean feedback is short (up to 4 words), combine with current topic
    if (cleanFeedback.split(" ").length <= 4) {
      const words = cleanFeedback.split(" ");
      const newWords = words.filter(w => !currentTopic.toLowerCase().includes(w.toLowerCase()));
      if (newWords.length > 0) {
        return `${currentTopic} ${newWords.join(" ")}`.trim();
      }
    }
    return cleanFeedback;
  }

  // Absolute fallback
  return feedback.trim() || currentTopic;
}
