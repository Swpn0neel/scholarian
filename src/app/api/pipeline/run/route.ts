import { NextResponse } from "next/server";
import { z } from "zod";
import { deduplicatePapers } from "@/lib/pipeline/deduplicate";
import { rankPapers, embedQuery } from "@/lib/pipeline/rank";
import { requireAuth } from "@/lib/supabase/requireAuth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchArxivPapers } from "@/lib/pipeline/fetchers/arxiv";
import { fetchSemanticScholarPapers } from "@/lib/pipeline/fetchers/semanticScholar";
import { fetchSerpApiPapers } from "@/lib/pipeline/fetchers/serpapi";
import type { RawPaper } from "@/types";
import { executeWithGeminiFallback } from "@/lib/pipeline/gemini";

/**
 * Uses gemini-2.5-flash-lite to assess whether the user's query is vague and,
 * if so, rewrites it into a precise, academic-grade search query.
 * Returns the original query if refinement fails.
 */
async function refineQueryIfNeeded(originalQuery: string): Promise<string> {
  const wordCount = originalQuery.trim().split(/\s+/).length;

  const prompt = `You are an expert academic research librarian. Your job is to transform a user's research topic into a rich, precise academic search query optimised for databases like arXiv and Semantic Scholar.

User's topic: "${originalQuery}"

Rules:
1. ALWAYS expand and enrich the query — even if it already sounds technical. Short queries (fewer than 6 words) are ALWAYS too vague and MUST be expanded significantly.
2. Add specific techniques, methods, algorithms, or sub-domains relevant to the topic.
3. Include application context or problem framing where it helps narrow the scope.
4. Use terminology that would appear in academic paper titles and abstracts.
5. Keep the final query under 20 words.
6. Return ONLY the refined query — no explanation, no quotes, no bullet points. Just the raw query text.

Examples:
- "image encryption" → "chaos-based image encryption algorithms using hyperchaotic maps and pixel scrambling"
- "AI in medicine" → "deep learning for medical image segmentation and clinical decision support systems"
- "quantum computers" → "quantum error correction algorithms for fault-tolerant superconducting qubit systems"
- "climate change" → "climate change impacts on ecosystem resilience and biodiversity loss mechanisms"
- "drug discovery" → "machine learning approaches for molecular property prediction and de novo drug design"
- "neural networks" → "deep neural network architectures for image classification and transfer learning"
- "blockchain security" → "blockchain consensus mechanisms and smart contract vulnerability detection"

Current query word count: ${wordCount} word${wordCount === 1 ? "" : "s"} — ${wordCount < 6 ? "DEFINITELY too short, must be expanded significantly" : "may still need enrichment"}.

Refined academic query:`;

  try {
    const result = await executeWithGeminiFallback(
      async (model) => {
        const response = await model.generateContent(prompt);
        return response.response.text().trim();
      },
      "gemini-2.5-flash-lite"
    );
    // Sanity check: if the model returns something wildly long or empty, fall back
    if (!result || result.length > 300) return originalQuery;
    // Strip any accidental leading/trailing quotes the model may add
    const cleaned = result.replace(/^["']|["']$/g, "").trim();
    return cleaned || originalQuery;
  } catch {
    // Refinement is a best-effort step — never block the pipeline
    return originalQuery;
  }
}


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
    enhanceQuery: z.boolean().optional().default(false),
  }),
});

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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
        const originalQuery = settings.topic;
        let query = originalQuery;

        if (settings.enhanceQuery) {
          send(controller, "step", { step: "fetching", message: `Analysing query with Gemini...` });
          query = await refineQueryIfNeeded(originalQuery);
          const wasRefined = query.toLowerCase().trim() !== originalQuery.toLowerCase().trim();

          if (wasRefined) {
            send(controller, "step", {
              step: "fetching",
              message: `Query refined: "${originalQuery}" → "${query}"`,
            });
          } else {
            send(controller, "step", {
              step: "fetching",
              message: `Query is already specific — using as-is: "${query}"`,
            });
          }
        }

        send(controller, "step", { step: "fetching", message: `Fetching papers using query: "${query}"...` });
        
        // Ask every source for the full maxPapers quota so that if one source
        // under-delivers (or fails), the others can compensate. Each fetcher
        // already clamps to its own API ceiling (SerpAPI → 20, Semantic Scholar
        // → 100), so we won't over-fetch beyond those hard limits.
        const [arxiv, semantic, serp] = await Promise.allSettled([
          fetchArxivPapers(query, settings.maxPapers),
          fetchSemanticScholarPapers(query, settings.maxPapers),
          fetchSerpApiPapers(query, settings.maxPapers),
        ]);
      
        const arxivPapers = arxiv.status === "fulfilled" ? arxiv.value : [];
        const semanticPapers = semantic.status === "fulfilled" ? semantic.value : [];
        const serpPapers = serp.status === "fulfilled" ? serp.value : [];

        // Log per-source counts and surface any sources that failed/contributed nothing
        const failedSources: string[] = [];
        if (arxiv.status === "rejected") failedSources.push("arXiv");
        if (semantic.status === "rejected") failedSources.push("Semantic Scholar");
        if (serp.status === "rejected") failedSources.push("Google Scholar");

        send(controller, "step", {
          step: "fetching",
          message: `Sources returned: arXiv ${arxivPapers.length}, Semantic Scholar ${semanticPapers.length}, Google Scholar ${serpPapers.length}${failedSources.length ? ` · ⚠ ${failedSources.join(", ")} unavailable` : ""}.`,
        });

        // Merge all source results into one pool (no round-robin cap yet —
        // we rank all candidates first and let quality decide the final set).
        const allPapers: RawPaper[] = [...arxivPapers, ...semanticPapers, ...serpPapers];

        send(controller, "step", {
          step: "fetching",
          message: `Combined ${allPapers.length} candidates from all sources. Beginning quality filtering...`,
        });

        // Filter out papers already seen in the previous run so fresh results
        // get ranked higher in refinement cycles.
        const filtered = excludedSet.size > 0
          ? allPapers.filter((p) => !excludedSet.has(p.title.toLowerCase().trim()))
          : allPapers;

        if (excludedSet.size > 0) {
          send(controller, "step", {
            step: "fetching",
            message: `Excluded ${allPapers.length - filtered.length} previously-seen papers. ${filtered.length} new candidates remaining.`,
          });
        }

        // Deduplicate the full pool — no cap yet; we want every candidate
        // available for the internal quality-filter pass.
        const deduped = deduplicatePapers(filtered);
        send(controller, "step", {
          step: "deduplicating",
          message: `${filtered.length} papers → ${deduped.length} unique after deduplication.`,
        });

        send(controller, "step", { step: "embedding", message: "Generating 768-dimensional semantic embeddings..." });

        // Embed the query so we can compute real cosine similarity
        // against each paper's abstract embedding.
        const queryEmbedding = await embedQuery(query);

        send(controller, "step", { step: "embedding", message: "Embeddings complete. Comparing vector distances..." });

        // ── Single-pass ranking ───────────────────────────────────────────────
        send(controller, "step", {
          step: "scoring",
          message: `Ranking all ${deduped.length} candidates directly.`,
        });

        const ranked = await rankPapers(deduped, settings, queryEmbedding);
        
        const runId = crypto.randomUUID();
        
        send(controller, "step", { step: "ranked", message: "Saving papers to database..." });
        
        // Insert papers into Supabase — use the actual DB column names.
        // Note: this table was created with camelCase column names.
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

        // Persist run metadata (settings + events) immediately on the server so the
        // run is fully recoverable even if the user navigates away before the client
        // has a chance to call /api/pipeline/metadata.
        const scoringEventMsg = `Ranked all ${deduped.length} candidates directly.`;

        const pipelineEvents = [
          { step: "fetching",      message: `Sources returned: arXiv ${arxivPapers.length}, Semantic Scholar ${semanticPapers.length}, Google Scholar ${serpPapers.length}${failedSources.length ? ` · ⚠ ${failedSources.join(", ")} unavailable` : ""}.`, ts: Date.now() - 6000 },
          { step: "fetching",      message: `Combined ${allPapers.length} candidates from all sources.`,                                                                                 ts: Date.now() - 5000 },
          { step: "deduplicating", message: `${filtered.length} papers → ${deduped.length} unique after deduplication.`,                                                                ts: Date.now() - 4000 },
          { step: "embedding",     message: "Embeddings complete. Comparing vector distances...",                                                                                         ts: Date.now() - 3000 },
          { step: "scoring",       message: scoringEventMsg,                                                                                                                             ts: Date.now() - 2000 },
          { step: "ranked",        message: `Ranked ${ranked.length} papers by composite score.`,                                                                                        ts: Date.now() - 1000 },
        ];

        const { error: metaError } = await supabase.from("run_metadata").upsert(
          {
            run_id: runId,
            chat_id: chatId,
            topic: settings.topic,
            max_papers: settings.maxPapers,
            top_k: settings.topK,
            weight_relevance: settings.weightRelevance,
            weight_citation: settings.weightCitation,
            weight_recency: settings.weightRecency,
            events: pipelineEvents,
          },
          { onConflict: "run_id" }
        );
        if (metaError) {
          console.error("Failed to save run metadata to database:", metaError);
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
