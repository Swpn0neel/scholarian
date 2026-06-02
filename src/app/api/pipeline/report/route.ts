import { NextResponse } from "next/server";
import { z } from "zod";
import { buildReportPrompt } from "@/lib/pipeline/report";
import { executeGeminiStreamWithFallback, executeWithGeminiFallback } from "@/lib/pipeline/gemini";
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
  enhanceReport: z.boolean().optional(),
});

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

async function generatePromptEnhancement(topic: string, papers: RankedPaper[]): Promise<string> {
  // Build a compact snapshot (title + first 300 chars of abstract) for the enhancer
  const paperSnapshot = papers
    .slice(0, 10)
    .map((p, i) => {
      const snippet = p.abstract
        ? p.abstract.slice(0, 300).trimEnd() + (p.abstract.length > 300 ? "…" : "")
        : "No abstract.";
      return `[${i + 1}] "${p.title}" (${p.year ?? "n/a"}, ${p.citationCount} citations)\n${snippet}`;
    })
    .join("\n\n");

  const prompt = `You are a domain expert and senior academic editor preparing a detailed brief for a junior analyst who will write a literature review.

Topic: "${topic}"

Top papers being reviewed:
${paperSnapshot}

Produce a structured analytical brief that the analyst MUST apply when writing every section of the report. The brief must be:
- Grounded in the actual papers above (not generic advice)
- Specific enough that a different topic would produce a completely different brief
- Actionable: each point should directly change what gets written

Return EXACTLY this structure (no preamble, no extra text outside these sections):

**DOMAIN EVALUATION CRITERIA**
List 3-4 field-specific quality dimensions that distinguish strong papers in this area from weak ones. Be precise (e.g. "Evaluate whether encryption schemes prove CPA/CCA security formally" not just "assess rigor").

**KEY DEBATES & FAULT LINES**
Identify 2-3 genuine methodological disagreements, unresolved controversies, or competing paradigms visible in the papers above. Name specific tensions the analyst should surface.

**CRITICAL METRICS & BENCHMARKS**
List the 3-4 specific performance metrics, datasets, or evaluation benchmarks expert reviewers in this field expect to see compared. Flag if key papers above omit them.

**SYNTHESIS DIRECTIVE**
One precise instruction for how the analyst should frame the overall narrative arc — what argument or conclusion the synthesis should build toward given these specific papers.`;

  try {
    const result = await executeWithGeminiFallback(async (model) => {
      const response = await model.generateContent(prompt);
      return response.response.text().trim();
    }, "gemini-2.5-flash-lite");
    return result || "";
  } catch (error) {
    console.warn("Failed to generate prompt enhancement, falling back to empty instructions.", error);
    return "";
  }
}

async function* streamGeminiReport(
  papers: RankedPaper[],
  topic: string,
  enhancedInstructions: string
): AsyncGenerator<string> {
  const paperContext = buildReportPrompt(papers);

  const prompt = `You are an expert academic research analyst. Based on the following ranked papers, write a comprehensive research report in Markdown format.

Topic: "${topic}"
${
  enhancedInstructions
    ? `\n---\n## MANDATORY ANALYTICAL BRIEF\nApply every directive below throughout ALL sections of the report:\n${enhancedInstructions}\n---\n`
    : ""
}
Paper corpus (ranked by relevance, citation strength, and recency):
${paperContext}

Write a well-structured report with these sections:
1. Executive Summary (3-4 sentences)
2. Background & Core Concepts
3. Key Findings & Synthesis (discuss themes, consensus, and contradictions${enhancedInstructions ? " — surface the KEY DEBATES & FAULT LINES from the brief" : ""})
4. Comparative Analysis (You MUST include a comprehensive Markdown comparison table comparing all the listed papers with each other. The table should have columns for: [Rank], Title, Authors & Year, Methodology/Approach, Key Findings/Results, and Main Strengths/Limitations. IMPORTANT: Do NOT generate excessive or infinite dashes for the table separator. Use exactly "|---|---|---|---|---|---|" for the separator. Follow the table with a comparative narrative referring to specific papers by [Rank].${enhancedInstructions ? " Use the CRITICAL METRICS & BENCHMARKS from the brief as the primary comparison dimensions." : ""})
5. Research Gaps & Open Questions${enhancedInstructions ? " (apply DOMAIN EVALUATION CRITERIA to identify where papers fall short)" : ""}
6. Future Research Directions
7. Conclusion${enhancedInstructions ? " (build toward the SYNTHESIS DIRECTIVE from the brief)" : ""}
8. References (list all papers with rank, title, authors, year)

Use markdown formatting. Be precise, analytical, and cite papers by [rank].`;

  yield* executeGeminiStreamWithFallback(prompt, "gemini-2.5-flash");
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = schema.parse(await request.json());
  const { runId, chatId, topic = "research topic", enhanceReport, isCustomRun, allPapers, settings, events } = body;
  
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
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors,
      year: paper.year,
      citationCount: paper.citationCount,
      doi: paper.doi,
      venue: paper.venue,
      url: paper.url,
      pdfUrl: paper.pdfUrl,
      source: paper.source,
      simScore: paper.simScore,
      citationScore: paper.citationScore,
      recencyScore: paper.recencyScore,
      finalScore: paper.finalScore,
      rank: paper.rank,
    }));
    await supabase.from("papers").insert(papersToInsert);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let enhancedInstructions = "";
        if (enhanceReport) {
          send(controller, "step", { step: "generating_report", message: "Designing domain-specific analytical lens..." });
          enhancedInstructions = await generatePromptEnhancement(topic, papers);
          if (enhancedInstructions) {
            send(controller, "step", { step: "generating_report", message: "Enhanced report prompt with domain-specific criteria." });
          }
        }
        send(controller, "step", { step: "generating_report", message: "Synthesizing report..." });

        let fullReport = "";
        for await (const chunk of streamGeminiReport(papers, topic, enhancedInstructions)) {
          if (chunk === "__STREAM_RESET__") {
            fullReport = "";
            send(controller, "reset", {});
            continue;
          }
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
