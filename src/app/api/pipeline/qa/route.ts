import { NextResponse } from "next/server";
import { z } from "zod";
import { executeWithGeminiFallback } from "@/lib/pipeline/gemini";
import { requireAuth } from "@/lib/supabase/requireAuth";

const schema = z.object({
  question: z.string().min(1),
  reportMarkdown: z.string().optional(),
  topic: z.string().optional(),
  papers: z
    .array(
      z.object({
        title: z.string(),
        abstract: z.string().nullable().optional(),
        authors: z.array(z.string()),
        year: z.number().nullable().optional(),
        rank: z.number(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { question, reportMarkdown, topic, papers } = schema.parse(await request.json());

  const paperContext =
    papers
      ?.slice(0, 15)
      .map(
        (p) =>
          `[${p.rank}] ${p.title} (${p.year ?? "n/a"}) — ${p.abstract ?? "No abstract."}`
      )
      .join("\n\n") ?? "";

  const prompt = `You are a research assistant helping a scholar understand their research report.

${topic ? `Research topic: "${topic}"` : ""}

${reportMarkdown ? `Research report:\n${reportMarkdown.slice(0, 4000)}\n` : ""}

${paperContext ? `Key papers:\n${paperContext}\n` : ""}

Answer the following question precisely and cite relevant papers by their rank number [n] where appropriate.

Question: ${question}`;

  try {
    const text = await executeWithGeminiFallback(async (model) => {
      const result = await model.generateContent(prompt);
      return result.response.text();
    });
    return NextResponse.json({ answer: text });
  } catch {
    return NextResponse.json({
      answer: "Failed to generate answer. Ensure your Gemini API keys are valid and have quota available.",
    });
  }
}
