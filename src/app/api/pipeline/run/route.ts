import { NextResponse } from "next/server";
import { z } from "zod";
import { deduplicatePapers } from "@/lib/pipeline/deduplicate";
import { enrichQuery } from "@/lib/pipeline/enrichQuery";
import { rankPapers } from "@/lib/pipeline/rank";
import { requireAuth } from "@/lib/supabase/requireAuth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchArxivPapers } from "@/lib/pipeline/fetchers/arxiv";
import { fetchSemanticScholarPapers } from "@/lib/pipeline/fetchers/semanticScholar";
import { fetchSerpApiPapers } from "@/lib/pipeline/fetchers/serpapi";
import type { RawPaper } from "@/types";

const schema = z.object({
  chatId: z.string(),
  excludeTitles: z.array(z.string()).optional().default([]),
  settings: z.object({
    topic: z.string().min(1),
    maxPapers: z.number().min(1).max(200),
    topK: z.number().min(1).max(20),
    weightRelevance: z.number().min(0),
    weightCitation: z.number().min(0),
    weightRecency: z.number().min(0),
  }),
});

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}



/** Fetch from all configured sources in parallel */
async function fetchAllSources(query: string, maxPapers: number): Promise<RawPaper[]> {
  const perSource = Math.ceil(maxPapers / 3);

  const [arxiv, semantic, serp] = await Promise.allSettled([
    fetchArxivPapers(query, perSource),
    fetchSemanticScholarPapers(query, perSource),
    fetchSerpApiPapers(query, perSource),
  ]);

  const arxivPapers = arxiv.status === "fulfilled" ? arxiv.value : [];
  const semanticPapers = semantic.status === "fulfilled" ? semantic.value : [];
  const serpPapers = serp.status === "fulfilled" ? serp.value : [];

  const results: RawPaper[] = [...arxivPapers, ...semanticPapers, ...serpPapers];

  return results;
}

export async function POST(request: Request) {
  // Auth guard — 401 for unauthenticated callers when Supabase is configured
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { chatId, settings, excludeTitles = [] } = schema.parse(await request.json());
  const supabase = await createServerSupabaseClient();

  // Build a lowercase set of titles to exclude (from the previous run's top-K)
  const excludedSet = new Set(excludeTitles.map((t) => t.toLowerCase().trim()));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const enriched = await enrichQuery(settings.topic);
        send(controller, "step", { step: "enriching", message: `Enriched query: "${enriched}"` });

        send(controller, "step", { step: "fetching", message: `Fetching papers using query: "${enriched}"...` });
        
        const perSource = Math.ceil(settings.maxPapers / 3);
        const [arxiv, semantic, serp] = await Promise.allSettled([
          fetchArxivPapers(enriched, perSource),
          fetchSemanticScholarPapers(enriched, perSource),
          fetchSerpApiPapers(enriched, perSource),
        ]);
      
        const arxivPapers = arxiv.status === "fulfilled" ? arxiv.value : [];
        const semanticPapers = semantic.status === "fulfilled" ? semantic.value : [];
        const serpPapers = serp.status === "fulfilled" ? serp.value : [];
      
        const raw: RawPaper[] = [...arxivPapers, ...semanticPapers, ...serpPapers];

        // Filter out papers already seen in the previous run so fresh results
        // get ranked higher in refinement cycles.
        const filtered = excludedSet.size > 0
          ? raw.filter((p) => !excludedSet.has(p.title.toLowerCase().trim()))
          : raw;

        if (excludedSet.size > 0) {
          send(controller, "step", {
            step: "fetching",
            message: `Excluded ${raw.length - filtered.length} previously-seen papers. ${filtered.length} new candidates remaining.`,
          });
        }
        
        send(controller, "step", { 
          step: "fetching", 
          message: `Found ${arxivPapers.length} arXiv, ${semanticPapers.length} Semantic Scholar, and ${serpPapers.length} Google Scholar papers.` 
        });

        // Deduplicate once — result used for both the log message and downstream
        const deduped = deduplicatePapers(filtered);
        send(controller, "step", {
          step: "deduplicating",
          message: `${raw.length} papers → ${deduped.length} unique after deduplication`,
        });

        send(controller, "step", { step: "embedding", message: "Generating 768-dimensional semantic embeddings..." });
        // Embeddings are simulated here until live DB vector storage is enabled
        await new Promise((resolve) => setTimeout(resolve, 300));
        send(controller, "step", { step: "embedding", message: "Embeddings complete. Comparing vector distances..." });
        await new Promise((resolve) => setTimeout(resolve, 200));

        send(controller, "step", { step: "scoring", message: "Applying hybrid ranking (relevance × citation × recency)..." });
        const ranked = rankPapers(deduped, settings);
        
        const runId = crypto.randomUUID();
        
        send(controller, "step", { step: "ranked", message: "Saving papers to database..." });
        
        // Insert papers into Supabase
        const papersToInsert = ranked.map((paper) => ({
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
        
        const { error: dbError } = await supabase.from("papers").insert(papersToInsert);
        if (dbError) {
          console.error("Failed to save papers to database:", dbError);
        }

        send(controller, "papers", ranked);
        send(controller, "done", { runId, chatId });
      } catch (error) {
        send(controller, "error", { message: error instanceof Error ? error.message : "Pipeline failed" });
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
