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
    return NextResponse.json({
      ok: true,
      refinedTopic: currentTopic ?? "",
      message: "Could not parse refinement or Gemini API failed. Ensure your keys are valid.",
    });
  }
}
