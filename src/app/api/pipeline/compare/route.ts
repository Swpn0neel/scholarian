import { NextResponse } from "next/server";
import { z } from "zod";
import { executeWithGeminiFallback } from "@/lib/pipeline/gemini";
import { requireAuth } from "@/lib/supabase/requireAuth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  chatId: z.string(),
  reportAIndex: z.number().int().positive(), // 1-based index
  reportBIndex: z.number().int().positive(),
});

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { chatId, reportAIndex, reportBIndex } = schema.parse(await request.json());
  const supabase = await createServerSupabaseClient();

  // Fetch all reports for this chat ordered by creation time
  const { data: reports, error } = await supabase
    .from("reports")
    .select("id, content_md, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error || !reports || reports.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 reports to compare." },
      { status: 400 }
    );
  }

  const reportA = reports[reportAIndex - 1];
  const reportB = reports[reportBIndex - 1];

  if (!reportA || !reportB) {
    return NextResponse.json(
      { error: `Invalid report indexes. This chat has ${reports.length} reports.` },
      { status: 400 }
    );
  }

  const prompt = `You are an expert academic research analyst. A researcher has run two different research pipeline configurations and obtained two distinct reports. Your task is to produce a rigorous, structured comparison.

## Report ${reportAIndex}
${reportA.content_md.slice(0, 3000)}

---

## Report ${reportBIndex}
${reportB.content_md.slice(0, 3000)}

---

Generate a comprehensive comparison report in clean Markdown. Structure it as follows:

# Comparison: Report ${reportAIndex} vs Report ${reportBIndex}

## Overview
Brief summary of what each report covers and the key differences in scope.

## Methodology Comparison
Compare the research approaches, scope, and focus areas.

## Key Findings — Agreement
Points where both reports agree or converge.

## Key Findings — Divergence
Points where the reports differ, contradict, or emphasise different aspects.

## Paper Coverage
Notable papers unique to each report and any shared references.

## Recommendation
Based on both reports, what are the most important takeaways for a researcher?

Write in clear academic prose. Use **bold** for key terms. Keep the comparison balanced and evidence-based.`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, "step", { step: "generating_report", message: "Generating comparison report…" });

        const text = await executeWithGeminiFallback(async (model) => {
          const result = await model.generateContent(prompt);
          return result.response.text();
        });

        // Stream in chunks to match the existing SSE contract
        const chunkSize = 200;
        for (let i = 0; i < text.length; i += chunkSize) {
          send(controller, "report", { chunk: text.slice(i, i + chunkSize) });
          await new Promise((r) => setTimeout(r, 10));
        }

        // Save comparison to reports table
        const { data: saved } = await supabase
          .from("reports")
          .insert({
            chat_id: chatId,
            content_md: text,
            type: "comparison",
          })
          .select("id")
          .single();

        send(controller, "done", { reportId: saved?.id });
      } catch (err) {
        send(controller, "error", { message: err instanceof Error ? err.message : "Comparison failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
