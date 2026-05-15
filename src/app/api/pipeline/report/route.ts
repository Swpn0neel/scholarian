import { NextResponse } from "next/server";
import { z } from "zod";
import { buildReportPrompt } from "@/lib/pipeline/report";
import { executeWithGeminiFallback } from "@/lib/pipeline/gemini";
import { requireAuth } from "@/lib/supabase/requireAuth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RankedPaper } from "@/types";

const schema = z.object({
  runId: z.string(),
  chatId: z.string(),
  topic: z.string().optional(),
  // Top-K ranked papers are passed from the client so the server doesn't need
  // a database lookup to reconstruct them.
  papers: z.array(
      z.object({
        title: z.string(),
        abstract: z.string().nullable().optional(),
        authors: z.array(z.string()),
        year: z.number().nullable().optional(),
        citationCount: z.number(),
        doi: z.string().nullable().optional(),
        venue: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        pdfUrl: z.string().nullable().optional(),
        source: z.string(),
        simScore: z.number(),
        citationScore: z.number(),
        recencyScore: z.number(),
        finalScore: z.number(),
        rank: z.number(),
      })
    ),
  isCustomRun: z.boolean().optional(),
  allPapers: z.array(z.any()).optional(),
  settings: z.any().optional(),
  events: z.array(z.any()).optional(),
});

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

async function* streamGeminiReport(
  papers: RankedPaper[],
  topic: string
): AsyncGenerator<string> {


  const paperContext = buildReportPrompt(papers);

  const prompt = `You are an expert academic research analyst. Based on the following ranked papers, write a comprehensive research report in Markdown format.

Topic: "${topic}"

Paper corpus (ranked by relevance, citation strength, and recency):
${paperContext}

Write a well-structured report with these sections:
1. Executive Summary (3–4 sentences)
2. Background & Core Concepts
3. Key Findings & Synthesis (discuss themes, consensus, and contradictions)
4. Comparative Analysis (refer to specific papers by their rank number)
5. Research Gaps & Open Questions
6. Future Research Directions
7. Conclusion
8. References (list all papers with rank, title, authors, year)

Use markdown formatting. Be precise, analytical, and cite papers by [rank].`;

  const result = await executeWithGeminiFallback(async (model) => {
    return await model.generateContentStream(prompt);
  }, "gemini-2.5-flash");
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = schema.parse(await request.json());
  const { runId, chatId, topic = "research topic", isCustomRun, allPapers, settings, events } = body;
  
  const supabase = await createServerSupabaseClient();

  const papers: RankedPaper[] = body.papers as RankedPaper[];
  
  if (!papers || papers.length === 0) {
    return NextResponse.json({ error: "No papers provided for report generation" }, { status: 400 });
  }

  // Branch a new run in the database if this is a custom report
  if (isCustomRun && allPapers && settings) {
    await supabase.from("run_metadata").insert({
      run_id: runId,
      chat_id: chatId,
      topic: settings.topic,
      max_papers: settings.maxPapers,
      top_k: settings.topK,
      weight_relevance: settings.weightRelevance,
      weight_citation: settings.weightCitation,
      weight_recency: settings.weightRecency,
      events: events ?? [],
    });

    const papersToInsert = allPapers.map((paper: RankedPaper) => ({
      run_id: runId,
      chat_id: chatId,
      ...paper,
      id: undefined, // let DB generate
    }));
    await supabase.from("papers").insert(papersToInsert);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullReport = "";
        for await (const chunk of streamGeminiReport(papers, topic)) {
          fullReport += chunk;
          send(controller, "report", { chunk });
        }
        
        const reportId = crypto.randomUUID();
        
        // Save to Supabase
        const { error: dbError } = await supabase.from("reports").insert({
          id: reportId,
          run_id: runId,
          chat_id: chatId,
          content_md: fullReport,
          type: "research"
        });
        
        if (dbError) {
          console.error("Failed to save report to database:", dbError);
        }

        send(controller, "done", {
          reportId,
          runId,
          content: fullReport,
        });
      } catch (error) {
        send(controller, "error", { message: error instanceof Error ? error.message : "Report generation failed" });
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
